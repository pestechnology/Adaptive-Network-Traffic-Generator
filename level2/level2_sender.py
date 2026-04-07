import select
import socket
import struct
import time
import logging
from dataclasses import dataclass, field
from typing import List, Optional

from level0.job_state import JobState

logger = logging.getLogger(__name__)

MAGIC      = b"ATG1"
FRAME_SIZE = 32
FRAME_FMT  = "!4sIQQQ"


@dataclass
class ProbeResult:
    seq:          int
    sent_at_ns:   int
    ack_received: bool          = False
    rtt_ns:       Optional[int] = None
    rx_ts_ns:     Optional[int] = None


@dataclass
class ProbeSession:
    destination: str
    port:        int
    count:       int
    interval:    float
    packet_size: int   = 64
    timeout:     float = 2.0

    results:   List[ProbeResult] = field(default_factory=list)
    _sent:     int = 0
    _acked:    int = 0
    _rtt_sum:  int = 0

    def delivery_pct(self) -> float:
        return (self._acked / self._sent * 100) if self._sent else 0.0

    def avg_rtt_ms(self) -> float:
        return (self._rtt_sum / self._acked / 1_000_000) if self._acked else 0.0

    def min_rtt_ms(self) -> float:
        rtts = [r.rtt_ns for r in self.results if r.rtt_ns is not None]
        return min(rtts) / 1_000_000 if rtts else 0.0

    def max_rtt_ms(self) -> float:
        rtts = [r.rtt_ns for r in self.results if r.rtt_ns is not None]
        return max(rtts) / 1_000_000 if rtts else 0.0

    def jitter_ms(self) -> float:
        rtts = [r.rtt_ns / 1_000_000 for r in self.results if r.rtt_ns is not None]
        if len(rtts) < 2:
            return 0.0
        diffs = [abs(rtts[i] - rtts[i - 1]) for i in range(1, len(rtts))]
        return sum(diffs) / len(diffs)

    def loss(self) -> int:
        return max(0, self._sent - self._acked)


def run_probe_session(
    session:   ProbeSession,
    job_state: Optional[JobState] = None,
) -> ProbeSession:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5.0)
        sock.connect((session.destination, session.port))
        sock.setblocking(False)
    except OSError as exc:
        logger.error(
            "Cannot connect to agent at %s:%d — %s",
            session.destination, session.port, exc,
        )
        return session

    pending:  dict[int, ProbeResult] = {}
    recv_buf: bytes = b""

    def _flush_acks():
        nonlocal recv_buf
        while True:
            r, _, _ = select.select([sock], [], [], 0)
            if not r:
                break
            try:
                chunk = sock.recv(FRAME_SIZE * 64)
                if not chunk:
                    break
                recv_buf += chunk
            except BlockingIOError:
                break

        while len(recv_buf) >= FRAME_SIZE:
            frame    = recv_buf[:FRAME_SIZE]
            recv_buf = recv_buf[FRAME_SIZE:]
            magic, seq, rx_ts_ns, _, _ = struct.unpack(FRAME_FMT, frame)
            if magic != MAGIC:
                continue
            if seq in pending:
                pr           = pending.pop(seq)
                pr.ack_received = True
                pr.rx_ts_ns  = rx_ts_ns
                pr.rtt_ns    = time.time_ns() - pr.sent_at_ns
                session._acked   += 1
                session._rtt_sum += pr.rtt_ns

    try:
        for seq in range(session.count):
            if job_state and job_state.should_stop():
                break
            while job_state and job_state.get_state() == "PAUSED":
                time.sleep(0.05)

            sent_ns = time.time_ns()
            frame   = struct.pack(FRAME_FMT, MAGIC, seq, sent_ns, 0, 0)
            pr      = ProbeResult(seq=seq, sent_at_ns=sent_ns)

            try:
                sock.setblocking(True)
                sock.sendall(frame)
                sock.setblocking(False)
                session._sent += 1
                if job_state:
                    job_state.increment_attempt()
                    job_state.increment_sent()
                    job_state.add_bytes_sent(FRAME_SIZE)
            except OSError as exc:
                logger.debug("Probe send error seq=%d: %s", seq, exc)
                if job_state:
                    job_state.increment_attempt()
                    job_state.increment_error()
                continue

            pending[seq] = pr
            session.results.append(pr)
            _flush_acks()

            if session.interval > 0:
                time.sleep(session.interval)

        deadline = time.time() + session.timeout
        while pending and time.time() < deadline:
            _flush_acks()
            time.sleep(0.01)

    finally:
        sock.close()

    return session