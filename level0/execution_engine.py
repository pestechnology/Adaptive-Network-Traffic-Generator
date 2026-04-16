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
        self.pcap_path: Optional[str] = None

        # Single authoritative JobState. packet_sender receives this exact
        # reference via spec.job_state — never create a second instance.
        self.job_state = JobState(job_id, profile_name, destination)

        self._thread: Optional[threading.Thread] = None

    # ── Public control API ────────────────────────────────────────────────────

    def start(self) -> None:
        ExecutionRepository.create_execution(
            self.job_id, self.profile_name, self.destination
        )
        ExecutionRepository.update_status(self.job_id, RUNNING)
        self._thread = threading.Thread(
            target=self._run,
            daemon=True,
            name=f"engine-{self.job_id[:8]}",
        )
        self._thread.start()

    def stop(self) -> None:
        self.job_state.set_state(STOPPED)

    def pause(self) -> None:
        if self.job_state.get_state() == RUNNING:
            self.job_state.set_state(PAUSED)

    def resume(self) -> None:
        if self.job_state.get_state() == PAUSED:
            self.job_state.set_state(RUNNING)

    # ── Worker thread ─────────────────────────────────────────────────────────

    def _run(self) -> None:
        try:
            profile = ProfileRepository.get_profile(self.profile_name)
            if profile is None:
                raise ValueError(f"Profile '{self.profile_name}' not found.")

            traffic_items = profile.get("traffic", [])
            if not traffic_items:
                raise ValueError(
                    f"Profile '{self.profile_name}' has no traffic items."
                )

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
                    job_state   = self.job_state,   # same instance — critical
                    port        = port,
                    packet_size = packet_size,
                    interval    = interval,
                )
                send_packets(spec)

            if self.capture_manager:
                try:
                    self.pcap_path = self.capture_manager.stop()
                except Exception as exc:
                    logger.warning("Capture stop error job=%s: %s", self.job_id, exc)

            self._finalise()

        except Exception as exc:
            traceback.print_exc()
            logger.error("ExecutionEngine job=%s failed: %s", self.job_id, exc)
            self._finalise_error(str(exc))

    # ── Finalisers — CALL ORDER IS CRITICAL ───────────────────────────────────

    def _finalise(self) -> None:
        """
        Correct finalisation sequence — DO NOT reorder these steps.

        Step 1  snapshot_final()        duration still accumulating → throughput correct
        Step 2  set_state(COMPLETED)    sets end_time (we don't use it for metrics)
        Step 3  complete_execution()    writes correct metrics to MongoDB
        Step 4  on_complete callback    notifies ExecutionManager

        If steps 1 and 2 are swapped:
            end_time is set first → get_duration() returns milliseconds →
            throughput_mbps ≈ 0 permanently stored in MongoDB.
        """
        current_state = self.job_state.get_state()

        # Step 1 — snapshot while duration is still the full elapsed time
        metrics = self.job_state.snapshot_final()

        # Step 2 — mark terminal (this sets end_time, irrelevant to metrics now)
        if current_state not in (STOPPED, FAILED):
            self.job_state.set_state(COMPLETED)

        # Step 3 — persist to MongoDB with real, correct metrics
        if current_state == STOPPED:
            ExecutionRepository.stop_execution(self.job_id, metrics)
        else:
            ExecutionRepository.complete_execution(
                self.job_id, metrics, self.pcap_path
            )

        # Step 4 — notify manager
        self.on_complete(self.job_id, metrics)

        logger.info(
            "Job %s %s | attempted=%d sent=%d delivery=%.2f%% "
            "throughput=%.4f Mbps duration=%.2fs",
            self.job_id,
            self.job_state.get_state(),
            metrics["packets_attempted"],
            metrics["packets_successful"],
            metrics["delivery_percent"],
            metrics["throughput_mbps"],
            metrics["duration_sec"],
        )

    def _finalise_error(self, error: str) -> None:
        metrics = self.job_state.snapshot_final()
        self.job_state.set_state(FAILED)
        ExecutionRepository.fail_execution(self.job_id, error)
        self.on_failure(self.job_id, error)
        logger.error("Job %s FAILED: %s", self.job_id, error)