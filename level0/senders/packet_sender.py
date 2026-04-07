import os
import time
import socket
import struct
import random
import logging
from dataclasses import dataclass
from typing import Optional

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


def _checksum(data: bytes) -> int:
    if len(data) % 2:
        data += b"\x00"
    s = 0
    for i in range(0, len(data), 2):
        s += (data[i] << 8) + data[i + 1]
        s = (s >> 16) + (s & 0xFFFF)
    return ~s & 0xFFFF


def _send_icmp(spec: PacketSpec) -> None:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_ICMP)
        sock.settimeout(2.0)
    except PermissionError:
        logger.error(
            "ICMP raw socket requires Administrator (Windows) or root (Linux). "
            "Restart the application with elevated privileges."
        )
        spec.job_state.increment_error()
        return

    pid     = os.getpid() & 0xFFFF
    payload = b"X" * (spec.packet_size - _MIN_ICMP_SIZE)

    try:
        for seq in range(spec.count):
            if spec.job_state.should_stop():
                break

            while spec.job_state.get_state() == "PAUSED":
                time.sleep(0.1)
                if spec.job_state.should_stop():
                    return

            header = struct.pack("!BBHHH", 8, 0, 0, pid, seq)
            chk    = _checksum(header + payload)
            header = struct.pack("!BBHHH", 8, 0, chk, pid, seq)
            packet = header + payload

            spec.job_state.increment_attempt()
            try:
                sock.sendto(packet, (spec.destination, 0))
                spec.job_state.increment_sent()
                spec.job_state.add_bytes_sent(len(packet))
            except OSError as exc:
                logger.debug("ICMP send error seq=%d: %s", seq, exc)
                spec.job_state.increment_error()

            if spec.interval > 0:
                time.sleep(spec.interval)
    finally:
        sock.close()


def _build_tcp_payload(protocol: str, packet_size: int) -> bytes:
    size = max(0, packet_size - 40)

    bases = {
        "HTTP":  b"GET / HTTP/1.1\r\nHost: target\r\nConnection: close\r\n\r\n",
        "HTTPS": b"\x16\x03\x03\x00\xf1\x01\x00\x00\xed\x03\x03",
        "SSH":   b"SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6\r\n",
    }
    base = bases.get(protocol, b"")

    if len(base) >= size:
        return base[:size]
    return base + b"X" * (size - len(base))


def _send_tcp(spec: PacketSpec) -> None:
    payload = _build_tcp_payload(spec.protocol, spec.packet_size)

    for i in range(spec.count):
        if spec.job_state.should_stop():
            break

        while spec.job_state.get_state() == "PAUSED":
            time.sleep(0.1)
            if spec.job_state.should_stop():
                return

        spec.job_state.increment_attempt()
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
            spec.job_state.increment_sent()
            spec.job_state.add_bytes_sent(spec.packet_size)
        except Exception as exc:
            logger.debug("TCP send error i=%d proto=%s: %s", i, spec.protocol, exc)
            spec.job_state.increment_error()

        if spec.interval > 0:
            time.sleep(spec.interval)