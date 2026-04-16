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

import os
import threading
import logging
import tempfile
from typing import Optional, Tuple

from scapy.all import sniff, IP, wrpcap

logger = logging.getLogger(__name__)

_DEFAULT_IFACE: Optional[str] = os.environ.get("ATG_CAPTURE_IFACE") or None
_PCAP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "pcap_files")


class CaptureManager:

    def __init__(
        self,
        job_id:      str,
        destination: str,
        iface:       Optional[str] = None,
        save_pcap:   bool          = False,
    ):
        self.job_id      = job_id
        self.destination = destination
        self.iface       = iface or _DEFAULT_IFACE
        self.save_pcap   = save_pcap

        self._packets_captured = 0
        self._bytes_captured   = 0
        self._frames           = [] if save_pcap else None

        self._stop   = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._lock   = threading.Lock()

        self._bpf = f"host {destination}"

    def start(self):
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._sniff_loop,
            daemon=True,
            name=f"capture-{self.job_id[:8]}",
        )
        self._thread.start()
        logger.debug(
            "Capture started job=%s dst=%s iface=%s",
            self.job_id[:8], self.destination, self.iface or "default",
        )

    def stop(self) -> Optional[str]:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)
            if self._thread.is_alive():
                logger.warning(
                    "Capture thread did not exit cleanly within 5s — job=%s",
                    self.job_id[:8],
                )

        if self.save_pcap and self._frames:
            return self._write_pcap()
        return None

    def get_metrics(self) -> Tuple[int, int]:
        with self._lock:
            return self._packets_captured, self._bytes_captured

    def _sniff_loop(self):
        try:
            kwargs = dict(
                prn=self._handle_packet,
                store=False,
                stop_filter=lambda _: self._stop.is_set(),
                filter=self._bpf,
            )
            if self.iface:
                kwargs["iface"] = self.iface
            sniff(**kwargs)
        except Exception as exc:
            logger.error("Capture sniff error job=%s: %s", self.job_id[:8], exc)

    def _handle_packet(self, pkt):
        if IP not in pkt:
            return
        ip = pkt[IP]
        if ip.dst != self.destination and ip.src != self.destination:
            return
        with self._lock:
            self._packets_captured += 1
            self._bytes_captured   += len(pkt)
            if self._frames is not None:
                self._frames.append(pkt)

    def _write_pcap(self) -> str:
        os.makedirs(_PCAP_DIR, exist_ok=True)
        path = os.path.join(_PCAP_DIR, f"{self.job_id[:8]}.pcap")
        try:
            wrpcap(path, self._frames)
            logger.info("PCAP written: %s (%d frames)", path, len(self._frames))
        except Exception as exc:
            logger.error("PCAP write failed: %s", exc)
            return ""
        return path