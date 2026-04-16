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

import time
import threading

RUNNING   = "RUNNING"
PAUSED    = "PAUSED"
STOPPED   = "STOPPED"
COMPLETED = "COMPLETED"
FAILED    = "FAILED"


class JobState:

    def __init__(self, job_id: str, profile: str, destination: str):
        self.job_id      = job_id
        self.profile     = profile
        self.destination = destination

        self._state = RUNNING
        self._lock  = threading.RLock()

        self.start_time = time.time()
        self.end_time: float | None = None

        # Raw counters — written by packet_sender via record_success / record_failure
        self.packets_attempted = 0
        self.packets_sent      = 0
        self.errors            = 0
        self.bytes_sent        = 0
        self.bytes_received    = 0

        # Latency — written by capture layer, optional
        self._total_latency_ms = 0.0
        self._latency_samples  = 0

        # Cache written once by snapshot_final(), never mutated after
        self._final_metrics: dict | None = None

    # ── State machine ─────────────────────────────────────────────────────────

    def set_state(self, state: str) -> None:
        with self._lock:
            self._state = state
            if state in (STOPPED, COMPLETED, FAILED) and self.end_time is None:
                self.end_time = time.time()

    def get_state(self) -> str:
        with self._lock:
            return self._state

    def should_stop(self) -> bool:
        return self.get_state() in (STOPPED, FAILED)

    # ── Counter methods ───────────────────────────────────────────────────────

    def record_success(self, bytes_sent: int) -> None:
        """Atomic: attempted++ sent++ bytes+=bytes_sent. Call right after sendto()."""
        with self._lock:
            self.packets_attempted += 1
            self.packets_sent      += 1
            self.bytes_sent        += bytes_sent

    def record_failure(self) -> None:
        """Atomic: attempted++ errors++. Call on OSError / PermissionError."""
        with self._lock:
            self.packets_attempted += 1
            self.errors            += 1

    def add_bytes_received(self, count: int) -> None:
        with self._lock:
            self.bytes_received += count

    def record_latency(self, latency_ms: float) -> None:
        """Optional — called by capture layer for avg_latency_ms only."""
        with self._lock:
            self._total_latency_ms += latency_ms
            self._latency_samples  += 1

    # Legacy individual increments — kept for backward compatibility
    def increment_attempt(self) -> None:
        with self._lock:
            self.packets_attempted += 1

    def increment_sent(self) -> None:
        with self._lock:
            self.packets_sent += 1

    def increment_error(self) -> None:
        with self._lock:
            self.errors += 1

    def add_bytes_sent(self, count: int) -> None:
        with self._lock:
            self.bytes_sent += count

    # ── Duration ──────────────────────────────────────────────────────────────

    def get_duration(self) -> float:
        """
        ALWAYS returns time.time() - start_time, never end_time.

        Why: if we used end_time here, any export_metrics() call after
        set_state(COMPLETED) would compute duration = milliseconds (the tiny
        gap between start and the COMPLETED signal), collapsing throughput to ~0.

        The correct call sequence in execution_engine is:
            metrics = job_state.snapshot_final()   # duration still accumulating
            job_state.set_state(COMPLETED)          # end_time set here — too late to matter
            ExecutionRepository.complete_execution(job_id, metrics)
        """
        return max(0.001, time.time() - self.start_time)

    # ── Metric API ────────────────────────────────────────────────────────────

    def snapshot_final(self) -> dict:
        """
        Capture and permanently cache the final metric snapshot.

        MUST be called BEFORE set_state(COMPLETED / FAILED / STOPPED).
        Calling it after set_state is safe but produces slightly inaccurate
        throughput due to the end_time note above (which does not apply because
        get_duration() ignores end_time).

        All subsequent calls return the same cached dict.
        """
        with self._lock:
            if self._final_metrics is not None:
                return self._final_metrics
            self._final_metrics = self._compute_metrics()
            return self._final_metrics

    def export_metrics(self) -> dict:
        """
        Live metrics for polling. Returns cached final snapshot if available.
        Safe to call from any thread at any time.
        """
        with self._lock:
            if self._final_metrics is not None:
                return self._final_metrics
            return self._compute_metrics()

    # ── Internal computation — single source of truth ─────────────────────────

    def _compute_metrics(self) -> dict:
        """Must be called with self._lock held."""
        attempted = self.packets_attempted
        sent      = self.packets_sent
        duration  = self.get_duration()

        delivery = round((sent / attempted * 100), 4) if attempted > 0 else 0.0

        # Use actual bytes if available; fallback: assume 64-byte avg frame
        effective_bytes = self.bytes_sent if self.bytes_sent > 0 else (sent * 64)
        throughput_mbps = round(
            (effective_bytes * 8) / (duration * 1_000_000), 4
        )

        avg_latency_ms = round(
            self._total_latency_ms / self._latency_samples, 3
        ) if self._latency_samples > 0 else 0.0

        loss_count  = max(0, attempted - sent)
        packet_loss = round((loss_count / attempted * 100), 4) if attempted > 0 else 0.0

        return {
            # ── Exact field names expected by TypeScript Job interface ─────────
            "packets_successful":  sent,
            "packets_attempted":   attempted,
            "delivery_percent":    delivery,
            "reliability_score":   delivery,
            "throughput_mbps":     throughput_mbps,
            "avg_latency_ms":      avg_latency_ms,
            "packet_loss":         packet_loss,
            "out_of_order":        0,
            "duplicates":          0,
            "corrupted":           0,
            # ── Extended fields ────────────────────────────────────────────────
            "loss":                loss_count,
            "errors":              self.errors,
            "duration_sec":        round(duration, 3),
            "bytes_sent":          self.bytes_sent,
            "bytes_received":      self.bytes_received,
            # ── Legacy aliases (so old MongoDB records still deserialise) ──────
            "delivery":            delivery,
            "throughput":          throughput_mbps,
            "reliability":         delivery,
            "latency":             avg_latency_ms,
        }