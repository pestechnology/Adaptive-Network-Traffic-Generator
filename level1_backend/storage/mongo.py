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
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

MONGO_URI = os.environ.get("ATG_MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("ATG_DB_NAME", "atg_v1")


class MongoConnection:
    def __init__(self):
        self.client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
            maxPoolSize=50,
            minPoolSize=5,
            retryWrites=True,
            retryReads=True,
        )
        try:
            self.client.admin.command("ping")
        except (ConnectionFailure, ServerSelectionTimeoutError) as exc:
            raise RuntimeError(f"MongoDB unreachable at {MONGO_URI}: {exc}") from exc
        self.db = self.client[DB_NAME]


mongo = MongoConnection()
db = mongo.db