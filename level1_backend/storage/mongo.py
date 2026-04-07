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