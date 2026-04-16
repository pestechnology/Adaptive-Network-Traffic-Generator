##
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

import time
from level0.receiver_manager import ReceiverManager


def main():
    manager = ReceiverManager()
    print(manager.start_receiver())

    try:
        while True:
            time.sleep(5)
            print("[Receiver Metrics]", manager.get_metrics())
    except KeyboardInterrupt:
        print(manager.stop_receiver())


if __name__ == "__main__":
    main()
