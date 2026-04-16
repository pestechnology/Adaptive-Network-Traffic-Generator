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
from scapy.all import rdpcap, IP
from collections import Counter


class CaptureAnalyzer:

    @staticmethod
    def analyze(pcap_file: str, packets_attempted: int):

        if not os.path.exists(pcap_file):
            return {"verification_status": "PCAP_NOT_FOUND"}

        packets = rdpcap(pcap_file)

        outbound = 0
        bytes_total = 0
        protocol_counter = Counter()

        for pkt in packets:
            if IP in pkt:
                outbound += 1
                bytes_total += len(pkt)
                protocol_counter[pkt[IP].proto] += 1

        delivery_percent = 0
        if packets_attempted > 0:
            delivery_percent = (outbound / packets_attempted) * 100

        return {
            "pcap_packets_observed": outbound,
            "pcap_bytes_observed": bytes_total,
            "pcap_delivery_percent": round(delivery_percent, 2),
            "protocol_breakdown": dict(protocol_counter),
            "verification_status": "CONSISTENT"
        }