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