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

import argparse

from level0.profile_manager import save_profile, list_profiles, get_profile
from level0.execution_engine import ExecutionEngine

# Single execution engine instance (Level 0 = one profile at a time)
engine = ExecutionEngine()


def create_profile():
    profile_name = input("Profile name: ")
    destination = input("Destination IP: ")

    traffic = []

    while True:
        protocol = input("Protocol (ICMP / HTTP / HTTPS / SSH) or 'done': ").upper()
        if protocol == "DONE":
            break

        count = int(input("Count (packets / connections): "))
        duration = int(input("Duration (seconds): "))

        traffic.append({
            "protocol": protocol,
            "count": count,
            "duration_sec": duration
        })

    profile = {
        "profile_name": profile_name,
        "destination": destination,
        "traffic": traffic
    }

    save_profile(profile)
    print(f"Profile '{profile_name}' saved successfully.")


def view_profile(profile_name):
    profile = get_profile(profile_name)
    if not profile:
        print("Profile not found.")
        return

    print("\n--- Traffic Profile ---")
    print(f"Name        : {profile['profile_name']}")
    print(f"Destination : {profile['destination']}")
    print("Traffic:")
    for item in profile["traffic"]:
        print(
            f"  - {item['protocol']} | "
            f"Count: {item['count']} | "
            f"Duration: {item['duration_sec']}s"
        )


def main():
    parser = argparse.ArgumentParser(
        description="Adaptive Traffic Generator (Level 0)"
    )
    subparsers = parser.add_subparsers(dest="command")

    # Profile management
    subparsers.add_parser("create-profile")
    subparsers.add_parser("list-profiles")

    view_parser = subparsers.add_parser("view-profile")
    view_parser.add_argument("name")

    # Execution control
    start_parser = subparsers.add_parser("start-profile")
    start_parser.add_argument("name")

    subparsers.add_parser("pause")
    subparsers.add_parser("resume")
    subparsers.add_parser("stop")

    args = parser.parse_args()

    if args.command == "create-profile":
        create_profile()

    elif args.command == "list-profiles":
        print(list_profiles())

    elif args.command == "view-profile":
        view_profile(args.name)

    elif args.command == "start-profile":
        engine.start(args.name)

    elif args.command == "pause":
        engine.pause()

    elif args.command == "resume":
        engine.resume()

    elif args.command == "stop":
        engine.stop()

    else:
        parser.print_help()
