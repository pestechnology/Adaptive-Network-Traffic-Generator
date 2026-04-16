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
from scapy.all import rdpcap, IP, TCP, ICMP
from collections import Counter


class HeaderInspector:

    @staticmethod
    def inspect(pcap_file: str):

        if not os.path.exists(pcap_file):
            return {"error": "PCAP file not found"}

        packets = rdpcap(pcap_file)

        protocol_counts = Counter()
        tcp_flags = Counter()
        icmp_types = Counter()
        packet_sizes = []

        for pkt in packets:

            packet_sizes.append(len(pkt))

            if IP in pkt:
                proto = pkt[IP].proto
                protocol_counts[proto] += 1

            if TCP in pkt:
                flags = str(pkt[TCP].flags)
                tcp_flags[flags] += 1

            if ICMP in pkt:
                icmp_types[pkt[ICMP].type] += 1

        return {
            "packet_count": len(packets),
            "protocol_counts": dict(protocol_counts),
            "tcp_flags": dict(tcp_flags),
            "icmp_types": dict(icmp_types),
            "packet_sizes": {
                "min": min(packet_sizes) if packet_sizes else 0,
                "max": max(packet_sizes) if packet_sizes else 0,
                "avg": sum(packet_sizes) / len(packet_sizes) if packet_sizes else 0
            }
        }