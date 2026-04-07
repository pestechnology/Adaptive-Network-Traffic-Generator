import time
import threading

RUNNING = "RUNNING"
PAUSED = "PAUSED"
STOPPED = "STOPPED"
COMPLETED = "COMPLETED"
FAILED = "FAILED"


class JobState:

    def __init__(self, job_id: str, profile: str, destination: str):
        self.job_id = job_id
        self.profile = profile
        self.destination = destination

        self._state = RUNNING
        self._lock = threading.RLock()

        self.start_time = time.time()
        self.end_time = None

        self.packets_attempted = 0
        self.packets_sent = 0
        self.errors = 0
        self.bytes_sent = 0
        self.bytes_received = 0

    def set_state(self, state: str):
        with self._lock:
            self._state = state
            if state in (STOPPED, COMPLETED, FAILED) and self.end_time is None:
                self.end_time = time.time()

    def get_state(self) -> str:
        with self._lock:
            return self._state

    def should_stop(self) -> bool:
        return self.get_state() in (STOPPED, FAILED)

    def increment_attempt(self):
        with self._lock:
            self.packets_attempted += 1

    def increment_sent(self):
        with self._lock:
            self.packets_sent += 1

    def increment_error(self):
        with self._lock:
            self.errors += 1

    def add_bytes_sent(self, count: int):
        with self._lock:
            self.bytes_sent += count

    def add_bytes_received(self, count: int):
        with self._lock:
            self.bytes_received += count

    def get_duration(self) -> float:
        end = self.end_time if self.end_time else time.time()
        return max(0.001, end - self.start_time)

    def export_metrics(self) -> dict:
        with self._lock:
            duration = self.get_duration()
            attempted = self.packets_attempted
            sent = self.packets_sent
            delivery = (sent / attempted * 100) if attempted else 0.0
            throughput = (self.bytes_sent * 8 / (duration * 1_000_000)) if duration else 0.0

            return {
                "delivery": round(delivery, 2),
                "latency": 0,
                "throughput": round(throughput, 3),
                "reliability": round(delivery, 2),
                "packets_successful": sent,
                "packets_attempted": attempted,
                "packet_loss": round(100 - delivery, 2) if attempted else 0,
                "loss": max(0, attempted - sent),
                "retransmissions": 0,
                "duplicates": 0,
                "corrupted": 0,
                "errors": self.errors,
                "duration_sec": round(duration, 2),
                "bytes_sent": self.bytes_sent,
                "bytes_received": self.bytes_received,
                "throughput_mbps": round(throughput, 4),
                "avg_latency_ms": 0,
                "reliability_score": round(delivery, 2),
                "delivery_percent": round(delivery, 2),
                "out_of_order": 0,
            }