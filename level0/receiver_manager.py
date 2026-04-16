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

from level0.receivers.tcp_receiver import TCPReceiver


class ReceiverManager:
    def __init__(self):
        self.receiver = None

    def start_receiver(self, host="0.0.0.0", port=8080):
        if self.receiver:
            return "[Manager] Receiver already running"

        self.receiver = TCPReceiver(host, port)
        self.receiver.start()
        return "[Manager] Receiver started"

    def stop_receiver(self):
        if not self.receiver:
            return "[Manager] Receiver not running"

        self.receiver.stop()
        self.receiver = None
        return "[Manager] Receiver stopped"

    def get_metrics(self):
        if not self.receiver:
            return {"error": "Receiver not running"}

        return self.receiver.get_metrics()