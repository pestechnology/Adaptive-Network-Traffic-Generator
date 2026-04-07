import threading
import time
import traceback
import logging
from typing import Callable, Optional

from level1_backend.storage.profile_repository import ProfileRepository
from level1_backend.storage.execution_repository import ExecutionRepository
from level1_backend.capture.capture_manager import CaptureManager
from level0.job_state import JobState, RUNNING, PAUSED, STOPPED, COMPLETED, FAILED
from level0.senders.packet_sender import send_packets, PacketSpec

logger = logging.getLogger(__name__)


class ExecutionEngine:

    def __init__(
        self,
        job_id:          str,
        profile_name:    str,
        destination:     str,
        on_complete:     Callable,
        on_failure:      Callable,
        capture_manager: Optional[CaptureManager] = None,
    ):
        self.job_id          = job_id
        self.profile_name    = profile_name
        self.destination     = destination
        self.on_complete     = on_complete
        self.on_failure      = on_failure
        self.capture_manager = capture_manager
        self.job_state       = JobState(job_id, profile_name, destination)
        self._thread: Optional[threading.Thread] = None

    def start(self):
        ExecutionRepository.create_execution(self.job_id, self.profile_name, self.destination)
        ExecutionRepository.update_status(self.job_id, RUNNING)
        self._thread = threading.Thread(
            target=self._run,
            daemon=True,
            name=f"engine-{self.job_id[:8]}",
        )
        self._thread.start()

    def stop(self):
        self.job_state.set_state(STOPPED)

    def pause(self):
        if self.job_state.get_state() == RUNNING:
            self.job_state.set_state(PAUSED)

    def resume(self):
        if self.job_state.get_state() == PAUSED:
            self.job_state.set_state(RUNNING)

    def _run(self):
        pcap_path = None
        try:
            profile = ProfileRepository.get_profile(self.profile_name)
            if profile is None:
                raise ValueError(f"Profile '{self.profile_name}' not found.")

            traffic_items = profile.get("traffic", [])
            if not traffic_items:
                raise ValueError(f"Profile '{self.profile_name}' has no traffic items.")

            if self.capture_manager:
                self.capture_manager.start()

            for item in traffic_items:

                while self.job_state.get_state() == PAUSED:
                    time.sleep(0.1)

                if self.job_state.should_stop():
                    break

                protocol    = item["protocol"].upper()
                count       = int(item["count"])
                packet_size = int(item.get("packet_size", 64))
                port        = int(item.get("port", 0))
                pps         = item.get("packets_per_second")
                duration    = item.get("duration_sec")

                if pps and float(pps) > 0:
                    interval = 1.0 / float(pps)
                elif duration and count > 0:
                    interval = float(duration) / count
                else:
                    interval = 0.0

                spec = PacketSpec(
                    protocol    = protocol,
                    destination = self.destination,
                    count       = count,
                    job_state   = self.job_state,
                    port        = port,
                    packet_size = packet_size,
                    interval    = interval,
                )
                send_packets(spec)

            if self.capture_manager:
                pcap_path = self.capture_manager.stop()

            final_state = self.job_state.get_state()
            if final_state not in (STOPPED, FAILED):
                self.job_state.set_state(COMPLETED)

            metrics = self.job_state.export_metrics()

            if final_state == STOPPED:
                ExecutionRepository.stop_execution(self.job_id, metrics)
            else:
                ExecutionRepository.complete_execution(self.job_id, metrics, pcap_path)

            self.on_complete(self.job_id, metrics)

        except Exception as exc:
            traceback.print_exc()
            logger.error("ExecutionEngine job=%s failed: %s", self.job_id, exc)
            self.job_state.set_state(FAILED)
            ExecutionRepository.fail_execution(self.job_id, str(exc))
            self.on_failure(self.job_id, str(exc))