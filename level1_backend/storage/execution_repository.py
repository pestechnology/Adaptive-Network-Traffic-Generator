from datetime import datetime, timezone
from typing import Optional
from level1_backend.storage.mongo import db


class ExecutionRepository:

    collection = db.executions

    @classmethod
    def ensure_indexes(cls):
        cls.collection.create_index("job_id", unique=True)
        cls.collection.create_index("status")
        cls.collection.create_index("start_time")

    @classmethod
    def create_execution(cls, job_id: str, profile_name: str, destination: str):
        cls.collection.insert_one({
            "job_id": job_id,
            "profile_name": profile_name,
            "destination": destination,
            "status": "CREATED",
            "start_time": datetime.now(timezone.utc),
            "end_time": None,
            "metrics": {},
            "error": None,
            "pcap_path": None,
        })

    @classmethod
    def update_status(cls, job_id: str, status: str):
        cls.collection.update_one(
            {"job_id": job_id},
            {"$set": {"status": status}},
        )

    @classmethod
    def complete_execution(cls, job_id: str, metrics: dict, pcap_path: Optional[str] = None):
        update = {
            "status": "COMPLETED",
            "end_time": datetime.now(timezone.utc),
            "metrics": metrics,
        }
        if pcap_path:
            update["pcap_path"] = pcap_path
        cls.collection.update_one({"job_id": job_id}, {"$set": update})

    @classmethod
    def fail_execution(cls, job_id: str, error: str):
        cls.collection.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "FAILED",
                "end_time": datetime.now(timezone.utc),
                "error": error,
            }},
        )

    @classmethod
    def stop_execution(cls, job_id: str, metrics: dict):
        cls.collection.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "STOPPED",
                "end_time": datetime.now(timezone.utc),
                "metrics": metrics,
            }},
        )

    @classmethod
    def get_execution(cls, job_id: str) -> Optional[dict]:
        return cls.collection.find_one({"job_id": job_id}, {"_id": 0})

    @classmethod
    def list_executions(cls) -> list:
        return list(cls.collection.find({}, {"_id": 0}).sort("start_time", -1))

    @classmethod
    def list_active_executions(cls) -> list:
        return list(
            cls.collection.find(
                {"status": {"$in": ["CREATED", "RUNNING", "PAUSED"]}},
                {"_id": 0},
            ).sort("start_time", -1)
        )