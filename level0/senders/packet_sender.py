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


import os
import time
import socket
import struct
import random
import logging
from dataclasses import dataclass

from scapy.all import IP, TCP, Raw, send as scapy_send

from level0.job_state import JobState

logger = logging.getLogger(__name__)

_PORT_DEFAULTS = {
    "HTTP":  80,
    "HTTPS": 443,
    "SSH":   22,
    "TCP":   9999,
}

_MIN_TCP_SIZE  = 60
_MIN_ICMP_SIZE = 28


@dataclass
class PacketSpec:
    protocol:    str
    destination: str
    count:       int
    job_state:   JobState
    port:        int   = 0
    packet_size: int   = 64
    interval:    float = 0.0

    def __post_init__(self):
        self.protocol = self.protocol.upper()
        if self.port == 0:
            self.port = _PORT_DEFAULTS.get(self.protocol, 80)
        if self.protocol == "ICMP" and self.packet_size < _MIN_ICMP_SIZE:
            self.packet_size = _MIN_ICMP_SIZE
        if self.protocol != "ICMP" and self.packet_size < _MIN_TCP_SIZE:
            self.packet_size = _MIN_TCP_SIZE


def send_packets(spec: PacketSpec) -> None:
    if spec.protocol == "ICMP":
        _send_icmp(spec)
    else:
        _send_tcp(spec)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _checksum(data: bytes) -> int:
    if len(data) % 2:
        data += b"\x00"
    s = 0
    for i in range(0, len(data), 2):
        s += (data[i] << 8) + data[i + 1]
        s  = (s >> 16) + (s & 0xFFFF)
    return ~s & 0xFFFF


def _check_pause_stop(spec: PacketSpec) -> bool:
    """
    Block while PAUSED. Returns True if the job should stop.
    Consolidated helper used at the top of every send loop iteration.
    """
    while spec.job_state.get_state() == "PAUSED":
        time.sleep(0.1)
        if spec.job_state.should_stop():
            return True
    return spec.job_state.should_stop()


# ── ICMP sender ───────────────────────────────────────────────────────────────

def _send_icmp(spec: PacketSpec) -> None:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_ICMP)
        sock.settimeout(1.0)
    except PermissionError:
        logger.error("ICMP requires root / Administrator privileges.")
        # Record a failure for EVERY intended packet — not just one.
        # Without this, attempted=1 sent=0 delivery=0% misleads the UI.
        for _ in range(spec.count):
            spec.job_state.record_failure()
        return

    pid     = os.getpid() & 0xFFFF
    payload = b"ATG" + b"X" * max(0, spec.packet_size - _MIN_ICMP_SIZE - 3)

    try:
        for seq in range(spec.count):
            if _check_pause_stop(spec):
                break

            header = struct.pack("!BBHHH", 8, 0, 0, pid, seq)
            chk    = _checksum(header + payload)
            header = struct.pack("!BBHHH", 8, 0, chk, pid, seq)
            packet = header + payload

            try:
                sock.sendto(packet, (spec.destination, 0))

                # ── CRITICAL: record success immediately after sendto() ────────
                # Delivery = packets that left the NIC.
                # ICMP replies are optional and only used for latency — never delivery.
                spec.job_state.record_success(len(packet))

                # Optional: read reply for latency measurement only
                try:
                    data, _ = sock.recvfrom(1024)
                    spec.job_state.add_bytes_received(len(data))
                except socket.timeout:
                    pass  # No reply is fine — delivery already counted above

            except OSError as exc:
                logger.debug("ICMP send error seq=%d: %s", seq, exc)
                spec.job_state.record_failure()

            if spec.interval > 0:
                time.sleep(spec.interval)

    finally:
        sock.close()


# ── TCP sender ────────────────────────────────────────────────────────────────

def _build_tcp_payload(protocol: str, packet_size: int) -> bytes:
    size  = max(0, packet_size - 40)
    bases = {
        "HTTP":  b"GET / HTTP/1.1\r\nHost: target\r\nConnection: close\r\n\r\n",
        "HTTPS": b"\x16\x03\x03\x00\xf1\x01\x00\x00\xed\x03\x03",
        "SSH":   b"SSH-2.0-OpenSSH\r\n",
    }
    base = bases.get(protocol, b"")
    return base[:size] if len(base) >= size else base + b"X" * (size - len(base))


def _send_tcp(spec: PacketSpec) -> None:
    payload = _build_tcp_payload(spec.protocol, spec.packet_size)

    for _ in range(spec.count):
        if _check_pause_stop(spec):
            break

        try:
            pkt = (
                IP(dst=spec.destination)
                / TCP(
                    sport=random.randint(1024, 65535),
                    dport=spec.port,
                    flags="S",
                    seq=random.randint(0, 2**32 - 1),
                )
                / Raw(load=payload)
            )
            scapy_send(pkt, verbose=False)

            # ── record success immediately after scapy_send() ─────────────────
            spec.job_state.record_success(spec.packet_size)

        except Exception as exc:
            logger.debug("TCP send error: %s", exc)
            spec.job_state.record_failure()

        if spec.interval > 0:
            time.sleep(spec.interval)