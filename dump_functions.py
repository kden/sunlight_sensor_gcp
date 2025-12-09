#!/usr/bin/env python3

#  dump_functions.py
#
#  Source code description.
#
#  Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
#  Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
#  Apache 2.0 Licensed as described in the file LICENSE


import os
import glob

# First loop - include all files
print("=== All specified files ===\n")
patterns = [
    # "terraform/cassandra_latest_readings.tf",
    # "terraform/astra_database.tf",
    # "terraform/astra_tables.tf",
    # "terraform/cloudrun*.tf",
    # "terraform/iam_deploy_cloud_run_functions.tf",
    # "terraform/providers.tf",
    # "sunlight_web_app/package.json",
    # "sunlight_web_app/firebase.json",
    # "sunlight_web_app/tsconfig.json",
    # "README.md",

".github/workflows/deploy_cassandra_latest_readings.yml",
".github/workflows/deploy_pubsub_to_cassandra.yml",
".github/workflows/deploy_rest_sensor_api.yml",
".github/workflows/deploy_sensor_monitor.yml",
"terraform/apis.tf",
"terraform/astra_database.tf",
"terraform/astra_tables.tf",
"terraform/cassandra_latest_readings.tf",
"terraform/cloudrun_pubsub_to_cassandra.tf",
"terraform/cloudrun_sensor_rest_proxy.tf",
"terraform/iam_deploy_cloud_run_functions.tf",
"terraform/iam_workload_identity_pool.tf",
"terraform/monitoring.tf",
"terraform/providers.tf",
"terraform/pubsub.tf",
"terraform/sensor_metadata.json_example",
"terraform/sensor_set_metadata.json_example",
"terraform/shared.tf",

]

exclude_patterns = ["__test__", "node_modules", ".next", ".swc", ".env.local"]  # paths containing these will be excluded
first_loop_files = set()  # Track files from first loop

for pattern in patterns:
    for file in glob.glob(pattern, recursive=True):
        if os.path.isfile(file):
            # Check if any exclude pattern is in the file path
            if not any(exclude in file for exclude in exclude_patterns):
                first_loop_files.add(file)  # Add to tracking set
                print("----------")
                print(file)
                print("----------")
                with open(file, 'r', encoding='utf-8', errors='ignore') as f:
                    print(f.read())
                print("\n")

            # Second loop - only include files containing specific keywords
print("=== Filtered files (containing keywords) ===\n")
filtered_patterns = [
    "functions/cassandra_latest_readings/**/*",
    "functions/pubsub_to_cassandra/**/*",
    "functions/rest_sensor_api_to_pubsub/**/*",
    "functions/sensor_status_monitor/**/*",
]

keywords = ["cloudrun", "cassandra", "datastax", "astra", "monitor"]  # your list of keywords
exclude_patterns = ["__test__", "node_modules", ".next", ".swc", ".env.local"]  # paths containing these will be excluded
first_loop_files = set()  # Track files from first loop

for pattern in filtered_patterns:
    for file in glob.glob(pattern, recursive=True):
        # Exclude if already in first loop
        if os.path.isfile(file) and file not in first_loop_files:
            if not any(exclude in file for exclude in exclude_patterns):
                try:
                    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                        # Check if any keyword appears in the file (case insensitive)
                        # if any(keyword.lower() in content.lower() for keyword in keywords):
                            print("----------")
                            print(file)
                            print("----------")
                            print(content)
                            print("\n")
                except Exception as e:
                    print(f"Error reading {file}: {e}\n")