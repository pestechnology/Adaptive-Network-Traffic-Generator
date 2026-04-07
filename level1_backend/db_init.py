from level1_backend.storage.execution_repository import ExecutionRepository
from level1_backend.storage.profile_repository import ProfileRepository
from level1_backend.storage.mongo import db


def initialize_database():
    ExecutionRepository.ensure_indexes()
    ProfileRepository.ensure_indexes()
    db.scheduled_jobs.create_index("scheduled_id", unique=True)
    db.scheduled_jobs.create_index("status")
    db.rfc2544_reports.create_index("completed_at")
    db.rfc2544_reports.create_index("destination")