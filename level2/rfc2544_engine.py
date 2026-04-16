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
rfc2544_engine.py
=================
RFC 2544 benchmarking engine for ATG.

RFC 2544 defines four standard network benchmarking tests:
  1. Throughput        — find maximum zero-loss frame rate
  2. Latency           — measure round-trip time at throughput rate
  3. Frame loss rate   — measure loss across rates 0–100%
  4. Back-to-back      — find maximum burst size with zero loss

This implementation runs all four tests per frame size and stores
results in MongoDB under the "rfc2544_results" collection.

Public API (used by api.py)
---------------------------
    engine = RFC2544Engine(fast_mode=False)
    result_id = await engine.run(
        destination_ip="10.0.0.1",
        protocol="tcp",
        frame_sizes=[64, 128, 256, 512, 1024, 1280, 1518],
        trial_duration=60,
        max_rate_mbps=1000.0,
    )
    results = await engine.list_results()
    result  = await engine.get_result(result_id)
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from level1_backend.storage.mongo import db
from level2.level2_sender import ProbeSession, run_probe_session
from level0.job_state import JobState

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

# Minimum frame size accounting for Ethernet overhead (bytes)
_MIN_FRAME  = 64
_MAX_FRAME  = 9000     # jumbo frame ceiling

# Binary-search resolution: stop when search window < this many Mbps
_THROUGHPUT_PRECISION_MBPS = 1.0

# Frame-loss test step size (percentage points)
_LOSS_STEP_PCT = 10


# ── Engine ─────────────────────────────────────────────────────────────────────

class RFC2544Engine:

    def __init__(self, fast_mode: bool = False):
        """
        Parameters
        ----------
        fast_mode : bool
            When True, reduces trial_duration to 10 s and skips
            back-to-back tests to speed up CI / smoke runs.
        """
        self.fast_mode  = fast_mode
        self._collection = db["rfc2544_results"]

    # ── Public async entry points ─────────────────────────────────────────────

    async def run(
        self,
        destination_ip: str,
        protocol:       str         = "tcp",
        frame_sizes:    List[int]   = None,
        trial_duration: int         = 60,
        max_rate_mbps:  float       = 1000.0,
    ) -> str:
        """
        Run RFC 2544 benchmark and persist results.

        Returns
        -------
        result_id : str  — MongoDB document ID for this benchmark run
        """
        if frame_sizes is None:
            frame_sizes = [64, 128, 256, 512, 1024, 1280, 1518]

        effective_duration = min(trial_duration, 10) if self.fast_mode else trial_duration

        result_id = f"rfc-{uuid.uuid4().hex[:12]}"
        loop      = asyncio.get_event_loop()

        await loop.run_in_executor(
            None,
            lambda: self._run_sync(
                result_id=result_id,
                destination_ip=destination_ip,
                protocol=protocol,
                frame_sizes=frame_sizes,
                trial_duration=effective_duration,
                max_rate_mbps=max_rate_mbps,
            ),
        )
        return result_id

    async def list_results(self) -> List[dict]:
        """Return all RFC 2544 results (newest first), excluding _id."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._list_results_sync)

    async def get_result(self, result_id: str) -> Optional[dict]:
        """Return a single RFC 2544 result document by result_id."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self._get_result_sync(result_id))

    # ── Synchronous benchmark implementation ──────────────────────────────────

    def _run_sync(
        self,
        result_id:      str,
        destination_ip: str,
        protocol:       str,
        frame_sizes:    List[int],
        trial_duration: int,
        max_rate_mbps:  float,
    ) -> None:
        """
        Execute all RFC 2544 sub-tests for each frame size.
        Persists a single result document to MongoDB.
        """
        logger.info(
            "RFC2544 START  result_id=%s  dst=%s  sizes=%s  fast=%s",
            result_id, destination_ip, frame_sizes, self.fast_mode,
        )

        per_size: list[dict] = []

        for frame_size in frame_sizes:
            frame_size = max(_MIN_FRAME, min(frame_size, _MAX_FRAME))
            logger.info("RFC2544 frame_size=%d", frame_size)

            tput   = self._test_throughput(destination_ip, frame_size, trial_duration, max_rate_mbps)
            lat    = self._test_latency(destination_ip, frame_size, trial_duration, tput["max_zero_loss_mbps"])
            loss   = self._test_frame_loss(destination_ip, frame_size, trial_duration, max_rate_mbps)
            b2b    = {} if self.fast_mode else self._test_back_to_back(destination_ip, frame_size)

            per_size.append({
                "frame_size":  frame_size,
                "throughput":  tput,
                "latency":     lat,
                "frame_loss":  loss,
                "back_to_back": b2b,
            })

        document = {
            "result_id":     result_id,
            "destination_ip": destination_ip,
            "protocol":      protocol,
            "frame_sizes":   frame_sizes,
            "trial_duration": trial_duration,
            "max_rate_mbps": max_rate_mbps,
            "fast_mode":     self.fast_mode,
            "created_at":    datetime.now(timezone.utc),
            "status":        "COMPLETED",
            "results":       per_size,
        }

        self._collection.insert_one(document)
        logger.info("RFC2544 DONE  result_id=%s", result_id)

    # ── RFC 2544 Test 1: Throughput (binary search) ───────────────────────────

    def _test_throughput(
        self,
        destination:    str,
        frame_size:     int,
        trial_duration: int,
        max_rate_mbps:  float,
    ) -> dict:
        """
        Binary search for the maximum zero-loss rate.

        Algorithm
        ---------
        1. Start with [lo=0, hi=max_rate_mbps]
        2. Send at mid rate for trial_duration seconds
        3. If zero loss → lo = mid (can go higher)
           If loss > 0  → hi = mid (rate is too high)
        4. Repeat until hi - lo < _THROUGHPUT_PRECISION_MBPS
        """
        lo  = 0.0
        hi  = max_rate_mbps
        best_zero_loss = 0.0
        iterations: list[dict] = []

        while (hi - lo) > _THROUGHPUT_PRECISION_MBPS:
            mid    = (lo + hi) / 2.0
            result = self._send_probe(destination, frame_size, mid, trial_duration)
            iterations.append({"rate_mbps": round(mid, 2), **result})

            if result["loss_pct"] == 0.0:
                best_zero_loss = mid
                lo = mid
            else:
                hi = mid

        return {
            "max_zero_loss_mbps": round(best_zero_loss, 2),
            "iterations":         iterations,
        }

    # ── RFC 2544 Test 2: Latency ───────────────────────────────────────────────

    def _test_latency(
        self,
        destination:  str,
        frame_size:   int,
        duration:     int,
        rate_mbps:    float,
    ) -> dict:
        """
        Measure latency at the throughput rate.
        Sends 120 probe packets and collects RTTs.
        """
        probe_count = 120
        if rate_mbps <= 0:
            return {"avg_rtt_ms": 0, "min_rtt_ms": 0, "max_rtt_ms": 0, "jitter_ms": 0}

        result = self._send_probe(destination, frame_size, rate_mbps, min(duration, 30))
        return {
            "avg_rtt_ms": result.get("avg_rtt_ms", 0.0),
            "min_rtt_ms": result.get("min_rtt_ms", 0.0),
            "max_rtt_ms": result.get("max_rtt_ms", 0.0),
            "jitter_ms":  result.get("jitter_ms", 0.0),
        }

    # ── RFC 2544 Test 3: Frame Loss Rate ──────────────────────────────────────

    def _test_frame_loss(
        self,
        destination:    str,
        frame_size:     int,
        trial_duration: int,
        max_rate_mbps:  float,
    ) -> dict:
        """
        Measure loss at 10%, 20%, … 100% of max_rate_mbps.
        """
        points: list[dict] = []
        for pct in range(_LOSS_STEP_PCT, 101, _LOSS_STEP_PCT):
            rate   = max_rate_mbps * pct / 100.0
            result = self._send_probe(destination, frame_size, rate, min(trial_duration, 10))
            points.append({
                "load_pct":  pct,
                "rate_mbps": round(rate, 2),
                "loss_pct":  result["loss_pct"],
            })
        return {"points": points}

    # ── RFC 2544 Test 4: Back-to-Back ─────────────────────────────────────────

    def _test_back_to_back(self, destination: str, frame_size: int) -> dict:
        """
        Find the maximum burst length (in frames) that can be sent
        without loss. Uses linear search from 1 up to 10 000 frames.
        """
        max_burst  = 0
        for burst in [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192]:
            result = self._send_burst(destination, frame_size, burst)
            if result["loss_pct"] == 0.0:
                max_burst = burst
            else:
                break
        return {"max_burst_frames": max_burst}

    # ── Low-level probe sender (sync) ─────────────────────────────────────────

    def _send_probe(
        self,
        destination:    str,
        frame_size:     int,
        rate_mbps:      float,
        duration_sec:   int,
    ) -> dict:
        """
        Send a timed probe at the requested rate and collect metrics.
        Uses ProbeSession from level2_sender.
        """
        # Convert Mbps + frame_size → packets per second
        bits_per_frame = frame_size * 8
        pps_float      = (rate_mbps * 1_000_000) / bits_per_frame if bits_per_frame else 0
        pps            = max(1, int(pps_float))
        interval       = 1.0 / pps
        count          = pps * duration_sec

        job_id    = f"rfc-probe-{uuid.uuid4().hex[:8]}"
        job_state = JobState(job_id, "rfc2544_probe", destination)

        session = ProbeSession(
            destination=destination,
            port=7070,
            count=count,
            interval=interval,
            packet_size=frame_size,
        )

        try:
            run_probe_session(session, job_state=job_state)
        except Exception as exc:
            logger.warning("RFC2544 probe error: %s", exc)
            return {
                "sent": 0, "received": 0,
                "loss_pct": 100.0,
                "avg_rtt_ms": 0.0, "min_rtt_ms": 0.0,
                "max_rtt_ms": 0.0, "jitter_ms": 0.0,
            }

        sent     = getattr(session, "_sent", count)
        received = getattr(session, "_acked", 0)
        loss_pct = round((1 - received / sent) * 100, 4) if sent else 100.0

        # Collect RTT samples
        rtts_ms = [
            r.rtt_ns / 1_000_000
            for r in getattr(session, "results", [])
            if getattr(r, "rtt_ns", None) is not None
        ]

        avg_rtt = round(sum(rtts_ms) / len(rtts_ms), 3) if rtts_ms else 0.0
        min_rtt = round(min(rtts_ms), 3) if rtts_ms else 0.0
        max_rtt = round(max(rtts_ms), 3) if rtts_ms else 0.0
        jitter  = 0.0
        if len(rtts_ms) > 1:
            diffs  = [abs(rtts_ms[i] - rtts_ms[i - 1]) for i in range(1, len(rtts_ms))]
            jitter = round(sum(diffs) / len(diffs), 3)

        return {
            "sent":        sent,
            "received":    received,
            "loss_pct":    loss_pct,
            "avg_rtt_ms":  avg_rtt,
            "min_rtt_ms":  min_rtt,
            "max_rtt_ms":  max_rtt,
            "jitter_ms":   jitter,
        }

    def _send_burst(self, destination: str, frame_size: int, burst_frames: int) -> dict:
        """Send a burst of frames as fast as possible (interval=0)."""
        return self._send_probe(destination, frame_size, rate_mbps=1000.0, duration_sec=1)

    # ── MongoDB helpers ───────────────────────────────────────────────────────

    def _list_results_sync(self) -> List[dict]:
        return list(
            self._collection.find({}, {"_id": 0}).sort("created_at", -1)
        )

    def _get_result_sync(self, result_id: str) -> Optional[dict]:
        return self._collection.find_one({"result_id": result_id}, {"_id": 0})