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
"""
main_controller.py
==================
Level-2 controller: orchestrates probe sessions against a destination
agent, collects RTT / delivery metrics, and persists results to MongoDB.

Public API (used by api.py)
---------------------------
    controller = MainController()
    job_id = await controller.run(
        destination_ip="10.0.0.1",
        protocol="tcp",
        packet_size=512,
        duration_seconds=30,
        packets_per_second=1000,
        profile_id=None,
    )
"""

import asyncio
import json
import logging
import math
import socket
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import List, Optional

from level2.level2_sender import ProbeSession, run_probe_session
from level1_backend.storage.profile_repository import ProfileRepository
from level1_backend.storage.execution_repository import ExecutionRepository
from level0.job_state import JobState

logger = logging.getLogger(__name__)


# ── Data class for internal reporting ─────────────────────────────────────────

@dataclass
class ControllerReport:
    job_id:        str
    destination:   str
    agent_port:    int
    profile_name:  str

    tx_packets:       int   = 0
    tx_bytes:         int   = 0
    tx_errors:        int   = 0
    duration_sec:     float = 0.0
    throughput_mbps:  float = 0.0

    rx_packets_agent: int   = 0
    rx_bytes_agent:   int   = 0

    delivered:        int   = 0
    lost:             int   = 0
    delivery_pct:     float = 0.0

    avg_rtt_ms:       float = 0.0
    min_rtt_ms:       float = 0.0
    max_rtt_ms:       float = 0.0
    jitter_ms:        float = 0.0
    rtt_variance:     float = 0.0
    delivery_entropy: float = 0.0

    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


# ── MainController ─────────────────────────────────────────────────────────────

class MainController:
    """
    Stateless controller — create one instance per request.
    The async run() method is the only public entry point.
    """

    # Level-2 agent listens on port 7070 (probe) and 7071 (management).
    AGENT_PROBE_PORT = 7070

    def __init__(self):
        # No constructor arguments — all parameters are passed to run()
        pass

    # ── Public async entry point ──────────────────────────────────────────────

    async def run(
        self,
        destination_ip:     str,
        protocol:           str   = "tcp",
        packet_size:        int   = 512,
        duration_seconds:   int   = 30,
        packets_per_second: int   = 1000,
        profile_id:         Optional[str] = None,
    ) -> str:
        """
        Launch a Level-2 probe session against destination_ip.

        Offloads the blocking network I/O to a thread-pool worker so
        the FastAPI event-loop is not blocked.

        Returns
        -------
        job_id : str
        """
        job_id = f"l2-{uuid.uuid4().hex[:12]}"

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._run_sync(
                job_id=job_id,
                destination_ip=destination_ip,
                protocol=protocol,
                packet_size=packet_size,
                duration_seconds=duration_seconds,
                packets_per_second=packets_per_second,
                profile_id=profile_id,
            ),
        )
        return job_id

    # ── Internal synchronous implementation ───────────────────────────────────

    def _run_sync(
        self,
        job_id:             str,
        destination_ip:     str,
        protocol:           str,
        packet_size:        int,
        duration_seconds:   int,
        packets_per_second: int,
        profile_id:         Optional[str],
    ) -> ControllerReport:
        """
        Synchronous implementation — executed inside a thread-pool worker.
        Builds a ControllerReport and persists it via ExecutionRepository.
        """
        agent_port   = self.AGENT_PROBE_PORT
        profile_name = profile_id or "level2_default"

        report = ControllerReport(
            job_id=job_id,
            destination=destination_ip,
            agent_port=agent_port,
            profile_name=profile_name,
        )

        job_state = JobState(job_id, profile_name, destination_ip)
        ExecutionRepository.create_execution(job_id, profile_name, destination_ip)
        ExecutionRepository.update_status(job_id, "RUNNING")

        agent_before   = self._fetch_agent_stats(destination_ip, agent_port)
        all_rtts_ns: List[int] = []
        t_start        = time.time()

        try:
            # Derive interval from packets_per_second
            interval   = 1.0 / packets_per_second if packets_per_second > 0 else 0.0
            total_count = packets_per_second * duration_seconds

            session = ProbeSession(
                destination=destination_ip,
                port=agent_port,
                count=total_count,
                interval=interval,
                packet_size=packet_size,
            )
            run_probe_session(session, job_state=job_state)

            report.tx_packets += getattr(session, "_sent", 0)
            report.tx_errors  += session.loss() if hasattr(session, "loss") else 0
            report.delivered  += getattr(session, "_acked", 0)

            for r in getattr(session, "results", []):
                if getattr(r, "rtt_ns", None) is not None:
                    all_rtts_ns.append(r.rtt_ns)

        except Exception as exc:
            logger.exception("Controller _run_sync error: %s", exc)
            report.error = str(exc)

        # ── Finalize metrics ─────────────────────────────────────────────────
        duration = time.time() - t_start
        report.duration_sec    = round(duration, 3)
        report.tx_bytes        = report.tx_packets * packet_size
        report.throughput_mbps = round(
            (report.tx_bytes * 8) / (duration * 1_000_000) if duration else 0.0, 4
        )

        agent_after = self._fetch_agent_stats(destination_ip, agent_port)
        if agent_before and agent_after:
            report.rx_packets_agent = (
                agent_after.get("rx_count", 0) - agent_before.get("rx_count", 0)
            )
            report.rx_bytes_agent = (
                agent_after.get("rx_bytes", 0) - agent_before.get("rx_bytes", 0)
            )

        report.lost = max(0, report.tx_packets - report.delivered)
        report.delivery_pct = round(
            report.delivered / report.tx_packets * 100
            if report.tx_packets else 0.0, 2
        )

        if all_rtts_ns:
            rtts_ms = [r / 1_000_000 for r in all_rtts_ns]
            avg     = sum(rtts_ms) / len(rtts_ms)
            report.avg_rtt_ms = round(avg, 3)
            report.min_rtt_ms = round(min(rtts_ms), 3)
            report.max_rtt_ms = round(max(rtts_ms), 3)

            if len(rtts_ms) > 1:
                diffs = [abs(rtts_ms[i] - rtts_ms[i - 1]) for i in range(1, len(rtts_ms))]
                report.jitter_ms   = round(sum(diffs) / len(diffs), 3)
                variance           = sum((r - avg) ** 2 for r in rtts_ms) / len(rtts_ms)
                report.rtt_variance = round(variance, 4)

            report.delivery_entropy = round(self._compute_entropy(all_rtts_ns), 4)

        # ── Persist ──────────────────────────────────────────────────────────
        if report.error:
            ExecutionRepository.fail_execution(job_id, report.error)
        else:
            ExecutionRepository.complete_execution(job_id, report.to_dict())

        return report

    # ── Agent stats fetch ─────────────────────────────────────────────────────

    def _fetch_agent_stats(self, destination: str, probe_port: int) -> Optional[dict]:
        """Connect to the Level-2 agent management port (probe_port + 1)."""
        mgmt_port = probe_port + 1
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(3.0)
            sock.connect((destination, mgmt_port))
            data = b""
            while True:
                chunk = sock.recv(1024)
                if not chunk:
                    break
                data += chunk
                if b"\n" in data:
                    break
            sock.close()
            return json.loads(data.strip())
        except Exception as exc:
            logger.warning(
                "Could not fetch agent stats from %s:%d — %s",
                destination, mgmt_port, exc,
            )
            return None

    # ── Entropy computation ───────────────────────────────────────────────────

    @staticmethod
    def _compute_entropy(values: List[int]) -> float:
        if not values:
            return 0.0
        n    = len(values)
        mean = sum(values) / n
        if mean == 0:
            return 0.0
        buckets: dict[int, int] = {}
        for v in values:
            bucket = int(v / mean * 10)
            buckets[bucket] = buckets.get(bucket, 0) + 1
        entropy = 0.0
        for count in buckets.values():
            p        = count / n
            entropy -= p * math.log2(p)
        return entropy