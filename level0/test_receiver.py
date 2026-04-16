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

import socket
import json
import uuid
import time

packet = {
    "packet_id": str(uuid.uuid4()),
    "sequence": 1,
    "timestamp": time.time(),
    "data": "test"
}

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(("127.0.0.1", 5001))
sock.sendall(json.dumps(packet).encode())

ack = sock.recv(4096)
print("ACK RECEIVED:", ack.decode())

sock.close()
