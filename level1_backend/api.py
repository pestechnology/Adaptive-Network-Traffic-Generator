import ctypes
import ipaddress
import os
import secrets
import socket
import sys
import logging
import time
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field

from level1_backend.execution_manager import ExecutionManager
from level1_backend.storage.profile_repository import ProfileRepository
from level1_backend.storage.execution_repository import ExecutionRepository
from level1_backend.capture.header_inspector import HeaderInspector
from level1_backend.scheduler.scheduler_service import SchedulerService
from level1_backend.db_init import initialize_database
from level2.main_controller import MainController
from level2.rfc2544_engine import RFC2544Engine
from level2.malicious_profiles import dispatch_malicious_profile, MALICIOUS_REGISTRY

logger = logging.getLogger(__name__)

app = FastAPI(title="Adaptive Traffic Generator", version="2.0.0")

_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_API_KEY = os.environ.get("ATG_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-ATG-API-Key", auto_error=False)

_ALLOWED_TARGETS: set = {
    t.strip()
    for t in os.environ.get("ATG_ALLOWED_TARGETS", "").split(",")
    if t.strip()
}

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
]

# ── Approval token store (in-process; one-time use, 5-min TTL) ─────────────────
_approval_tokens: dict[str, float] = {}   # token → expiry epoch
_TOKEN_TTL = 300


def _generate_approval_token() -> str:
    token = secrets.token_urlsafe(32)
    _approval_tokens[token] = time.time() + _TOKEN_TTL
    return token


def _consume_approval_token(token: str) -> bool:
    expiry = _approval_tokens.pop(token, None)
    if expiry is None:
        return False
    return time.time() < expiry


# ── Auth ───────────────────────────────────────────────────────────────────────

async def verify_api_key(key: Optional[str] = Security(_api_key_header)):
    if not _API_KEY:
        return
    if key != _API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )


def _check_privileges():
    try:
        if sys.platform == "win32":
            if not ctypes.windll.shell32.IsUserAnAdmin():
                logger.warning(
                    "ATG is not running as Administrator. "
                    "Raw packet injection and ICMP will fail. "
                    "Restart as Administrator."
                )
        else:
            if os.geteuid() != 0:
                logger.warning(
                    "ATG is not running as root. "
                    "Raw packet injection and ICMP will fail. "
                    "Restart with sudo."
                )
    except Exception:
        pass


def _validate_destination(destination: str) -> str:
    dest = destination.strip()
    if not dest:
        raise HTTPException(status_code=422, detail="destination must not be empty.")

    try:
        resolved_ip = socket.gethostbyname(dest)
    except socket.gaierror:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot resolve destination '{dest}'. Check the hostname or IP address.",
        )

    try:
        addr = ipaddress.ip_address(resolved_ip)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"'{resolved_ip}' is not a valid IP address.",
        )

    if any(addr in net for net in _PRIVATE_NETWORKS):
        return dest

    if _ALLOWED_TARGETS and dest not in _ALLOWED_TARGETS and resolved_ip not in _ALLOWED_TARGETS:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Public destination '{dest}' is not in the allowed targets list. "
                "Add it to ATG_ALLOWED_TARGETS in your .env file."
            ),
        )

    return dest


manager = ExecutionManager()
scheduler: Optional[SchedulerService] = None


@app.on_event("startup")
async def startup():
    global scheduler
    _check_privileges()
    initialize_database()
    scheduler = SchedulerService(manager)


# ── Request Models ─────────────────────────────────────────────────────────────

class ExecuteRequest(BaseModel):
    profile_name:   str
    destination:    str
    enable_capture: bool = True
    save_pcap:      bool = False
    capture_iface:  Optional[str] = None


class ProfileCreateRequest(BaseModel):
    name:    str
    traffic: List[dict]


class ProfileUpdateRequest(BaseModel):
    traffic: List[dict]


class ScheduleOnceRequest(BaseModel):
    run_time:     datetime
    profile_name: str
    destination:  str


class ScheduleIntervalRequest(BaseModel):
    seconds:      int
    profile_name: str
    destination:  str


class Level2RunRequest(BaseModel):
    destination_ip:      str
    protocol:            str = "tcp"    # tcp | udp | icmp
    packet_size:         int = 512
    duration_seconds:    int = 30
    packets_per_second:  int = 1000
    profile_id:          Optional[str] = None


class RFC2544Request(BaseModel):
    destination_ip:  str
    protocol:        str = "tcp"
    frame_sizes:     List[int] = Field(default=[64, 128, 256, 512, 1024, 1280, 1518])
    trial_duration:  int   = 60
    max_rate_mbps:   float = 1000.0
    fast_mode:       bool  = False


class MaliciousApproveRequest(BaseModel):
    attack_type:    str   # must be in MALICIOUS_REGISTRY
    justification:  str   # logged to audit


class MaliciousRunRequest(BaseModel):
    approval_token:   str
    attack_type:      str
    target_ip:        str
    duration_seconds: int      = 10
    intensity:        str      = "low"   # low | medium | high


# ── Execution Routes ───────────────────────────────────────────────────────────

@app.post("/execute", dependencies=[Depends(verify_api_key)])
def execute(req: ExecuteRequest):
    dest = _validate_destination(req.destination)
    profile = ProfileRepository.get_profile(req.profile_name)
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail=f"Profile '{req.profile_name}' not found.",
        )
    job_id = manager.start_job(
        req.profile_name,
        dest,
        enable_capture=req.enable_capture,
        save_pcap=req.save_pcap,
        capture_iface=req.capture_iface,
    )
    return {"job_id": job_id, "status": "RUNNING"}


@app.post("/execute/stop/{job_id}", dependencies=[Depends(verify_api_key)])
def stop_job(job_id: str):
    if not manager.stop_job(job_id):
        raise HTTPException(
            status_code=404,
            detail="Job not found or already completed.",
        )
    return {"job_id": job_id, "status": "STOPPING"}


@app.post("/execute/pause/{job_id}", dependencies=[Depends(verify_api_key)])
def pause_job(job_id: str):
    if not manager.pause_job(job_id):
        raise HTTPException(
            status_code=404,
            detail="Job not found or not pausable.",
        )
    return {"job_id": job_id, "status": "PAUSED"}


@app.post("/execute/resume/{job_id}", dependencies=[Depends(verify_api_key)])
def resume_job(job_id: str):
    if not manager.resume_job(job_id):
        raise HTTPException(
            status_code=404,
            detail="Job not found or not paused.",
        )
    return {"job_id": job_id, "status": "RUNNING"}


@app.get("/jobs", dependencies=[Depends(verify_api_key)])
def get_jobs():
    return manager.get_all_job_snapshots()


@app.get("/jobs/{job_id}", dependencies=[Depends(verify_api_key)])
def get_job(job_id: str):
    snap = manager.get_job_snapshot(job_id)
    if snap is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return snap


# ── Execution History Routes ───────────────────────────────────────────────────

@app.get("/executions", dependencies=[Depends(verify_api_key)])
def list_executions():
    return ExecutionRepository.list_executions()


@app.get("/executions/{job_id}", dependencies=[Depends(verify_api_key)])
def get_execution(job_id: str):
    rec = ExecutionRepository.get_execution(job_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Execution not found.")
    return rec


@app.get("/executions/{job_id}/headers", dependencies=[Depends(verify_api_key)])
def get_headers(job_id: str):
    rec = ExecutionRepository.get_execution(job_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Execution not found.")
    pcap_path = rec.get("pcap_path")
    if not pcap_path:
        raise HTTPException(status_code=404, detail="No PCAP file for this execution.")
    return HeaderInspector.inspect(pcap_path)


@app.get("/executions/{job_id}/pcap", dependencies=[Depends(verify_api_key)])
def download_pcap(job_id: str):
    rec = ExecutionRepository.get_execution(job_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Execution not found.")
    pcap_path = rec.get("pcap_path")
    if not pcap_path or not os.path.exists(pcap_path):
        raise HTTPException(status_code=404, detail="PCAP file not found.")
    return FileResponse(
        path=pcap_path,
        media_type="application/vnd.tcpdump.pcap",
        filename=f"atg_{job_id[:8]}.pcap",
    )


# ── Profile Routes ─────────────────────────────────────────────────────────────

@app.post("/profiles", dependencies=[Depends(verify_api_key)])
def create_profile(req: ProfileCreateRequest):
    try:
        ProfileRepository.create_profile(req.name, req.traffic)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"name": req.name, "status": "created"}


@app.get("/profiles", dependencies=[Depends(verify_api_key)])
def list_profiles():
    profiles = ProfileRepository.list_profiles()
    return {"profiles": [p["name"] for p in profiles], "data": profiles}


@app.get("/profiles/{name}", dependencies=[Depends(verify_api_key)])
def get_profile(name: str):
    profile = ProfileRepository.get_profile(name)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Profile '{name}' not found.")
    return {"success": True, "profile": profile}


@app.put("/profiles/{name}", dependencies=[Depends(verify_api_key)])
def update_profile(name: str, req: ProfileUpdateRequest):
    try:
        ProfileRepository.update_profile(name, req.traffic)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"name": name, "status": "updated"}


@app.delete("/profiles/{name}", dependencies=[Depends(verify_api_key)])
def delete_profile(name: str):
    try:
        ProfileRepository.delete_profile(name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"name": name, "status": "deleted"}


# ── Scheduler Routes ───────────────────────────────────────────────────────────

@app.post("/schedule/once", dependencies=[Depends(verify_api_key)])
def schedule_once(req: ScheduleOnceRequest):
    dest = _validate_destination(req.destination)
    try:
        scheduled_id = scheduler.schedule_once(req.run_time, req.profile_name, dest)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"scheduled_id": scheduled_id}


@app.post("/schedule/interval", dependencies=[Depends(verify_api_key)])
def schedule_interval(req: ScheduleIntervalRequest):
    dest = _validate_destination(req.destination)
    try:
        scheduled_id = scheduler.schedule_interval(req.seconds, req.profile_name, dest)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"scheduled_id": scheduled_id}


@app.get("/schedule", dependencies=[Depends(verify_api_key)])
def list_scheduled():
    return scheduler.get_scheduled_jobs()


@app.delete("/schedule/{scheduled_id}", dependencies=[Depends(verify_api_key)])
def cancel_scheduled(scheduled_id: str):
    scheduler.cancel_job(scheduled_id)
    return {"scheduled_id": scheduled_id, "status": "cancelled"}


# ── Level-2 Routes ─────────────────────────────────────────────────────────────

@app.post("/level2/run", dependencies=[Depends(verify_api_key)])
async def level2_run(req: Level2RunRequest):
    dest = _validate_destination(req.destination_ip)
    controller = MainController()
    job_id = await controller.run(
        destination_ip=dest,
        protocol=req.protocol,
        packet_size=req.packet_size,
        duration_seconds=req.duration_seconds,
        packets_per_second=req.packets_per_second,
        profile_id=req.profile_id,
    )
    return {"job_id": job_id, "status": "started"}


# ── RFC-2544 Routes ────────────────────────────────────────────────────────────

@app.post("/rfc2544/run", dependencies=[Depends(verify_api_key)])
async def rfc2544_run(req: RFC2544Request):
    dest = _validate_destination(req.destination_ip)
    engine = RFC2544Engine(fast_mode=req.fast_mode)
    result_id = await engine.run(
        destination_ip=dest,
        protocol=req.protocol,
        frame_sizes=req.frame_sizes,
        trial_duration=req.trial_duration,
        max_rate_mbps=req.max_rate_mbps,
    )
    return {"result_id": result_id, "status": "benchmarking"}


@app.get("/rfc2544/results", dependencies=[Depends(verify_api_key)])
async def rfc2544_results():
    engine = RFC2544Engine()
    results = await engine.list_results()
    return {"results": results}


@app.get("/rfc2544/results/{result_id}", dependencies=[Depends(verify_api_key)])
async def rfc2544_result_detail(result_id: str):
    engine = RFC2544Engine()
    result = await engine.get_result(result_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Result not found.")
    return result


# ── Malicious Routes ───────────────────────────────────────────────────────────

@app.get("/malicious/registry", dependencies=[Depends(verify_api_key)])
def malicious_registry():
    return {"attacks": list(MALICIOUS_REGISTRY.keys())}


@app.post("/malicious/approve", dependencies=[Depends(verify_api_key)])
def malicious_approve(req: MaliciousApproveRequest):
    if req.attack_type not in MALICIOUS_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown attack type. Valid types: {list(MALICIOUS_REGISTRY.keys())}",
        )
    if not req.justification.strip():
        raise HTTPException(status_code=422, detail="justification must not be empty.")

    logger.warning(
        "MALICIOUS APPROVAL REQUEST  attack=%s  justification=%r",
        req.attack_type,
        req.justification,
    )
    token = _generate_approval_token()
    return {
        "approval_token": token,
        "expires_in_seconds": _TOKEN_TTL,
        "attack_type": req.attack_type,
    }


@app.post("/malicious/run", dependencies=[Depends(verify_api_key)])
async def malicious_run(req: MaliciousRunRequest):
    if not _consume_approval_token(req.approval_token):
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired approval token. Request a new one via POST /malicious/approve.",
        )
    if req.attack_type not in MALICIOUS_REGISTRY:
        raise HTTPException(status_code=400, detail="Unknown attack type.")

    target = _validate_destination(req.target_ip)

    if req.intensity not in ("low", "medium", "high"):
        raise HTTPException(status_code=422, detail="intensity must be low | medium | high.")

    logger.warning(
        "MALICIOUS RUN  attack=%s  target=%s  duration=%ds  intensity=%s",
        req.attack_type, target, req.duration_seconds, req.intensity,
    )

    job_id = await dispatch_malicious_profile(
        attack_type=req.attack_type,
        target_ip=target,
        duration_seconds=req.duration_seconds,
        intensity=req.intensity,
    )
    return {"job_id": job_id, "attack_type": req.attack_type, "status": "running"}