import uuid
import atexit
from datetime import datetime, timezone, timedelta
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.jobstores.base import JobLookupError

from level1_backend.storage.mongo import db

_PAST_TOLERANCE_SECONDS = 5


class SchedulerService:

    def __init__(self, execution_manager):
        self.scheduler = BackgroundScheduler(timezone=timezone.utc)
        self.scheduler.start()
        self.execution_manager = execution_manager
        self.collection = db.scheduled_jobs
        self.collection.create_index("scheduled_id", unique=True)
        atexit.register(self._shutdown)

    def _shutdown(self):
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)

    def schedule_once(self, run_time: datetime, profile_name: str, destination: str) -> str:
        if run_time.tzinfo is None:
            run_time = run_time.replace(tzinfo=timezone.utc)

        if run_time < datetime.now(timezone.utc) - timedelta(seconds=_PAST_TOLERANCE_SECONDS):
            raise ValueError(f"run_time {run_time.isoformat()} is in the past.")

        scheduled_id = str(uuid.uuid4())

        self.collection.insert_one({
            "scheduled_id": scheduled_id,
            "profile_name": profile_name,
            "destination": destination,
            "type": "once",
            "interval_seconds": None,
            "run_time": run_time,
            "status": "scheduled",
            "created_at": datetime.now(timezone.utc),
            "last_execution_job_id": None,
            "error": None,
        })

        self.scheduler.add_job(
            self._execute_once,
            trigger=DateTrigger(run_date=run_time),
            args=[scheduled_id],
            id=scheduled_id,
            replace_existing=True,
        )

        return scheduled_id

    def _execute_once(self, scheduled_id: str):
        job = self.collection.find_one({"scheduled_id": scheduled_id})
        if not job:
            return

        self.collection.update_one(
            {"scheduled_id": scheduled_id},
            {"$set": {"status": "running"}},
        )
        try:
            execution_job_id = self.execution_manager.start_job(
                job["profile_name"],
                job["destination"],
            )
            self.collection.update_one(
                {"scheduled_id": scheduled_id},
                {"$set": {"status": "completed", "last_execution_job_id": execution_job_id}},
            )
        except Exception as exc:
            self.collection.update_one(
                {"scheduled_id": scheduled_id},
                {"$set": {"status": "failed", "error": str(exc)}},
            )

    def schedule_interval(self, seconds: int, profile_name: str, destination: str) -> str:
        if seconds < 1:
            raise ValueError("Interval must be at least 1 second.")

        scheduled_id = str(uuid.uuid4())

        self.collection.insert_one({
            "scheduled_id": scheduled_id,
            "profile_name": profile_name,
            "destination": destination,
            "type": "interval",
            "interval_seconds": seconds,
            "run_time": None,
            "status": "scheduled",
            "created_at": datetime.now(timezone.utc),
            "last_execution_job_id": None,
            "error": None,
        })

        self.scheduler.add_job(
            self._execute_interval,
            trigger=IntervalTrigger(seconds=seconds),
            args=[scheduled_id],
            id=scheduled_id,
            replace_existing=True,
        )

        return scheduled_id

    def _execute_interval(self, scheduled_id: str):
        job = self.collection.find_one({"scheduled_id": scheduled_id})
        if not job or job.get("status") == "cancelled":
            return

        self.collection.update_one(
            {"scheduled_id": scheduled_id},
            {"$set": {"status": "running"}},
        )

        execution_job_id = None
        error_msg = None

        try:
            execution_job_id = self.execution_manager.start_job(
                job["profile_name"],
                job["destination"],
            )
        except Exception as exc:
            error_msg = str(exc)
        finally:
            update = {"status": "scheduled"}
            if execution_job_id:
                update["last_execution_job_id"] = execution_job_id
            if error_msg:
                update["error"] = error_msg
            self.collection.update_one(
                {"scheduled_id": scheduled_id},
                {"$set": update},
            )

    def cancel_job(self, scheduled_id: str):
        try:
            self.scheduler.remove_job(scheduled_id)
        except JobLookupError:
            pass
        self.collection.update_one(
            {"scheduled_id": scheduled_id},
            {"$set": {"status": "cancelled"}},
        )

    def get_scheduled_jobs(self) -> list:
        jobs = list(self.collection.find({}, {"_id": 0}))
        for job in jobs:
            sched_job = self.scheduler.get_job(job["scheduled_id"])
            job["next_run_time"] = (
                sched_job.next_run_time.isoformat()
                if sched_job and sched_job.next_run_time
                else None
            )
        return jobs