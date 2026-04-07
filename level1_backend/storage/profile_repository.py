from datetime import datetime, timezone
from typing import Optional
from level1_backend.storage.mongo import db


class ProfileRepository:

    collection = db.profiles

    @classmethod
    def ensure_indexes(cls):
        cls.collection.create_index("name", unique=True)

    @classmethod
    def create_profile(cls, name: str, traffic: list):
        if not name or not name.strip():
            raise ValueError("Profile name must not be empty.")
        if not traffic:
            raise ValueError("Profile must contain at least one traffic item.")
        if cls.collection.find_one({"name": name}):
            raise ValueError(f"Profile '{name}' already exists.")
        cls.collection.insert_one({
            "name": name,
            "traffic": traffic,
            "created_at": datetime.now(timezone.utc),
        })

    @classmethod
    def get_profile(cls, name: str) -> Optional[dict]:
        return cls.collection.find_one({"name": name}, {"_id": 0})

    @classmethod
    def list_profiles(cls) -> list:
        return list(cls.collection.find({}, {"_id": 0}))

    @classmethod
    def list_profile_names(cls) -> list:
        docs = cls.collection.find({}, {"_id": 0, "name": 1})
        return [d["name"] for d in docs]

    @classmethod
    def delete_profile(cls, name: str):
        result = cls.collection.delete_one({"name": name})
        if result.deleted_count == 0:
            raise ValueError(f"Profile '{name}' not found.")

    @classmethod
    def update_profile(cls, name: str, traffic: list):
        if not traffic:
            raise ValueError("Profile must contain at least one traffic item.")
        result = cls.collection.update_one(
            {"name": name},
            {"$set": {"traffic": traffic, "updated_at": datetime.now(timezone.utc)}},
        )
        if result.matched_count == 0:
            raise ValueError(f"Profile '{name}' not found.")