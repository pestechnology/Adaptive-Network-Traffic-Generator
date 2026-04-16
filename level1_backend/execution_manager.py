#
# Authors:
#   Anikait Nair - anikaitm752@gmail.com
#   Dr. Swetha P - swethap@pes.edu
#   Dr. Prasad B Honnavalli - prasadbh@pes.edu
#
# Contributors:
#   ISFCR - office.isfcr@pes.edu
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# SPDX-License-Identifier: Apache-2.0
#

import uuid
import threading
import logging
from datetime import datetime, timezone
from typing import Optional

from level0.execution_engine import ExecutionEngine
from level0.job_state import COMPLETED, FAILED, STOPPED
from level1_backend.capture.capture_manager import CaptureManager
from level1_backend.storage.execution_repository import ExecutionRepository

logger = logging.getLogger(__name__)

_TERMINAL = {COMPLETED, FAILED, STOPPED}


class ExecutionManager:

    def __init__(self):
        self.jobs: dict[str, ExecutionEngine] = {}
        self._lock = threading.Lock()

    # ── Startup cleanup ───────────────────────────────────────────────────────

    def cleanup_stale_jobs(self) -> int:
        """
        Called once at startup (from api.py startup event).

        Marks every MongoDB record that is still RUNNING as FAILED with
        reason 'backend_restart'. These are jobs from a previous process
        whose threads no longer exist — they can never complete or be stopped.

        Returns the number of records cleaned up.
        """
        count = ExecutionRepository.mark_stale_running_as_failed(
            reason="backend_restart"
        )
        if count:
            logger.warning(
                "Startup cleanup: marked %d stale RUNNING job(s) as FAILED.", count
            )
        return count

    # ── Job control ───────────────────────────────────────────────────────────

    def start_job(
        self,
        profile_name:   str,
        destination:    str,
        enable_capture: bool = True,
        save_pcap:      bool = False,
        capture_iface:  Optional[str] = None,
    ) -> str:
        job_id = str(uuid.uuid4())

        capture = (
            CaptureManager(
                job_id,
                destination,
                iface=capture_iface,
                save_pcap=save_pcap,
            )
            if enable_capture else None
        )

        engine = ExecutionEngine(
            job_id,
            profile_name,
            destination,
            self._on_complete,
            self._on_fail,
            capture,
        )

        with self._lock:
            self.jobs[job_id] = engine

        try:
            engine.start()
            logger.info(
                "Job started: %s  profile=%s  dst=%s",
                job_id, profile_name, destination,
            )
            return job_id
        except Exception as exc:
            logger.error("Failed to start job %s: %s", job_id, exc)
            with self._lock:
                self.jobs.pop(job_id, None)
            raise

    def stop_job(self, job_id: str) -> bool:
        with self._lock:
            engine = self.jobs.get(job_id)

        if engine:
            logger.info("Stopping live job %s", job_id)
            engine.stop()
            return True

        # Job not in memory — check if it exists in MongoDB as a stale RUNNING
        # record (e.g. from before a restart). Mark it FAILED directly.
        record = ExecutionRepository.get_execution(job_id)
        if record and record.get("status") == "RUNNING":
            ExecutionRepository.fail_execution(job_id, "stopped_by_user")
            logger.info("Marked orphan job %s as FAILED in MongoDB", job_id)
            return True

        logger.warning("stop_job: job %s not found in memory or MongoDB", job_id)
        return False

    def pause_job(self, job_id: str) -> bool:
        with self._lock:
            engine = self.jobs.get(job_id)
        if engine:
            engine.pause()
            return True
        return False

    def resume_job(self, job_id: str) -> bool:
        with self._lock:
            engine = self.jobs.get(job_id)
        if engine:
            engine.resume()
            return True
        return False

    # ── Lifecycle callbacks ───────────────────────────────────────────────────

    def _on_complete(self, job_id: str, metrics: dict) -> None:
        logger.info(
            "Job completed: %s  delivery=%.2f%%  throughput=%.4f Mbps",
            job_id,
            metrics.get("delivery_percent", 0),
            metrics.get("throughput_mbps", 0),
        )
        # Keep engine in memory for 300 s so the frontend's 3 s poller
        # can read the COMPLETED state and final metrics before eviction.
        threading.Timer(300.0, lambda: self.jobs.pop(job_id, None)).start()

    def _on_fail(self, job_id: str, error: str) -> None:
        logger.error("Job failed: %s  error=%s", job_id, error)
        threading.Timer(300.0, lambda: self.jobs.pop(job_id, None)).start()

    # ── Snapshot API ──────────────────────────────────────────────────────────

    def get_all_job_snapshots(self) -> list:
        """
        Returns a LIST of snapshot dicts — never a dict/object.

        The FastAPI /jobs route returns this value directly. The React
        frontend calls Array.map() on the response — if this were a dict
        the map would fail silently and every metric would read as 0.

        Strategy:
          1. Load MongoDB records as the historical baseline.
          2. Override with live in-memory engines (always more accurate).
          3. Return as a list sorted newest first.
        """
        snapshots: dict[str, dict] = {}

        for record in ExecutionRepository.list_executions():
            jid = record.get("job_id")
            if jid:
                try:
                    snapshots[jid] = self._mongo_to_snapshot(record)
                except Exception as exc:
                    logger.error("Failed to normalise MongoDB record %s: %s", jid, exc)

        with self._lock:
            live_items = list(self.jobs.items())

        for job_id, engine in live_items:
            try:
                snapshots[job_id] = self._build_snapshot(job_id, engine)
            except Exception as exc:
                logger.error("Failed to build live snapshot %s: %s", job_id, exc)

        result = list(snapshots.values())
        try:
            result.sort(key=lambda s: str(s.get("start_time") or ""), reverse=True)
        except Exception:
            pass

        return result

    def get_job_snapshot(self, job_id: str) -> Optional[dict]:
        """
        1. Live memory  → most accurate for running jobs.
        2. MongoDB      → fallback for completed/restarted jobs.
        3. None         → api.py raises 404.
        """
        with self._lock:
            engine = self.jobs.get(job_id)

        if engine:
            return self._build_snapshot(job_id, engine)

        record = ExecutionRepository.get_execution(job_id)
        if record:
            return self._mongo_to_snapshot(record)

        return None

    # ── Snapshot builders ─────────────────────────────────────────────────────

    def _build_snapshot(self, job_id: str, engine: ExecutionEngine) -> dict:
        """
        Build a snapshot from a live ExecutionEngine.
        Reads export_metrics() from the single authoritative job_state instance
        that packet_sender also writes to.
        """
        js      = engine.job_state
        metrics = js.export_metrics()

        # Helper: safely read a metric field with a typed default
        def _val(key: str, default):
            v = metrics.get(key)
            return v if v is not None else default

        # Helper: format a timestamp (float epoch or None) to ISO string
        def _fmt(ts) -> Optional[str]:
            if ts is None:
                return None
            if isinstance(ts, (int, float)):
                return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
            return str(ts)

        # Capture is diagnostic only — never used in metric calculations
        cap_pkts, cap_bytes = 0, 0
        if engine.capture_manager:
            try:
                cap_pkts, cap_bytes = engine.capture_manager.get_metrics()
            except Exception as exc:
                logger.warning("Capture metrics error job=%s: %s", job_id, exc)

        return {
            # Identity
            "job_id":             job_id,
            "profile_name":       engine.profile_name,
            "destination":        engine.destination,
            "state":              js.get_state(),

            # All 9 metric fields — exact names required by TypeScript Job interface
            "packets_successful": _val("packets_successful", 0),
            "packets_attempted":  _val("packets_attempted", 0),
            "delivery_percent":   _val("delivery_percent", 0.0),
            "reliability_score":  _val("reliability_score", 0.0),
            "throughput_mbps":    _val("throughput_mbps", 0.0),
            "avg_latency_ms":     _val("avg_latency_ms", 0.0),
            "packet_loss":        _val("packet_loss", 0.0),
            "out_of_order":       _val("out_of_order", 0),
            "duplicates":         _val("duplicates", 0),
            "corrupted":          _val("corrupted", 0),

            # Timing
            "start_time":         _fmt(js.start_time),
            "end_time":           _fmt(js.end_time),
            "duration_sec":       _val("duration_sec", 0.0),

            # Extended
            "errors":             _val("errors", 0),
            "pcap_path":          engine.pcap_path,

            # Diagnostic (capture) — not used in calculations
            "packets_captured":   cap_pkts,
            "bytes_captured":     cap_bytes,
        }

    @staticmethod
    def _mongo_to_snapshot(record: dict) -> dict:
        """
        Normalise a MongoDB execution record to the same shape as
        _build_snapshot(). Supports both current and legacy field names.
        """
        m = record.get("metrics") or {}

        def _get(primary: str, *aliases, default=0.0):
            for key in (primary, *aliases):
                if key in m and m[key] is not None:
                    return m[key]
            return default

        packets_successful = _get("packets_successful", default=0)
        packets_attempted  = _get("packets_attempted",  default=0)
        delivery_percent   = _get("delivery_percent", "delivery", default=0.0)

        # Recovery: recompute delivery if raw counts present but metric was lost
        if packets_attempted > 0 and delivery_percent == 0 and packets_successful > 0:
            delivery_percent = round(packets_successful / packets_attempted * 100, 4)

        packet_loss = _get(
            "packet_loss",
            default=round(
                max(0, packets_attempted - packets_successful)
                / packets_attempted * 100, 4
            ) if packets_attempted > 0 else 0.0,
        )

        def _iso(val) -> Optional[str]:
            if val is None:
                return None
            if isinstance(val, datetime):
                return val.replace(tzinfo=timezone.utc).isoformat()
            return str(val)

        return {
            "job_id":             record.get("job_id", ""),
            "profile_name":       record.get("profile_name", ""),
            "destination":        record.get("destination", ""),
            "state":              record.get("status", COMPLETED),

            "packets_successful": packets_successful,
            "packets_attempted":  packets_attempted,
            "delivery_percent":   delivery_percent,
            "reliability_score":  _get("reliability_score", "reliability",
                                       default=delivery_percent),
            "throughput_mbps":    _get("throughput_mbps", "throughput", default=0.0),
            "avg_latency_ms":     _get("avg_latency_ms",  "latency",    default=0.0),
            "packet_loss":        packet_loss,
            "out_of_order":       _get("out_of_order", default=0),
            "duplicates":         _get("duplicates",   default=0),
            "corrupted":          _get("corrupted",    default=0),

            "start_time":         _iso(record.get("start_time")),
            "end_time":           _iso(record.get("end_time")),
            "duration_sec":       _get("duration_sec", default=0.0),
            "errors":             _get("errors",       default=0),
            "pcap_path":          record.get("pcap_path"),
            "packets_captured":   0,
            "bytes_captured":     0,
        }