import uuid
import threading
import logging
from typing import Optional

from level0.execution_engine import ExecutionEngine
from level1_backend.capture.capture_manager import CaptureManager

logger = logging.getLogger(__name__)


class ExecutionManager:

    def __init__(self):
        self.jobs: dict[str, ExecutionEngine] = {}
        self._lock = threading.Lock()

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

        engine.start()
        logger.info("Job started: %s profile=%s dst=%s", job_id, profile_name, destination)
        return job_id

    def stop_job(self, job_id: str) -> bool:
        with self._lock:
            engine = self.jobs.get(job_id)
        if engine:
            engine.stop()
            return True
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

    def _on_complete(self, job_id: str, metrics: dict):
        with self._lock:
            self.jobs.pop(job_id, None)
        logger.info("Job completed: %s", job_id)

    def _on_fail(self, job_id: str, error: str):
        with self._lock:
            self.jobs.pop(job_id, None)
        logger.error("Job failed: %s error=%s", job_id, error)

    def get_all_job_snapshots(self) -> dict:
        with self._lock:
            items = list(self.jobs.items())

        snapshots = {}
        for job_id, engine in items:
            snapshots[job_id] = self._build_snapshot(job_id, engine)
        return snapshots

    def get_job_snapshot(self, job_id: str) -> Optional[dict]:
        with self._lock:
            engine = self.jobs.get(job_id)
        if not engine:
            return None
        return self._build_snapshot(job_id, engine)

    def _build_snapshot(self, job_id: str, engine: ExecutionEngine) -> dict:
        js        = engine.job_state
        attempted  = js.packets_attempted
        sent       = js.packets_sent
        duration   = js.get_duration()
        bytes_sent = js.bytes_sent

        cap_pkts, cap_bytes = 0, 0
        if engine.capture_manager:
            cap_pkts, cap_bytes = engine.capture_manager.get_metrics()

        delivery   = (cap_pkts / attempted * 100) if attempted else 0.0
        throughput = (bytes_sent * 8 / (duration * 1_000_000)) if duration else 0.0

        return {
            "job_id":             job_id,
            "profile":            engine.profile_name,
            "destination":        engine.destination,
            "state":              js.get_state(),
            "delivery":           round(delivery, 2),
            "delivery_percent":   round(delivery, 2),
            "latency":            0,
            "avg_latency_ms":     0,
            "throughput":         round(throughput, 3),
            "throughput_mbps":    round(throughput, 3),
            "reliability":        round(delivery, 2),
            "reliability_score":  round(delivery, 2),
            "packets":            cap_pkts,
            "packets_successful": sent,
            "packets_attempted":  attempted,
            "packet_loss":        round(100 - delivery, 2) if attempted else 0,
            "loss":               max(0, attempted - cap_pkts),
            "retransmissions":    0,
            "duplicates":         0,
            "out_of_order":       0,
            "corrupted":          0,
            "errors":             js.errors,
            "duration":           round(duration, 2),
            "duration_sec":       round(duration, 2),
        }