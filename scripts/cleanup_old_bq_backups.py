"""
cleanup_old_bq_backups.py

Deletes old BigQuery backup datasets to manage storage costs.

This script performs the following actions:
1. Lists all datasets in the project.
2. Identifies datasets with names matching the 'backup_YYYYMMDDTHHMMSSZ' pattern.
3. Parses the timestamp from the dataset name.
4. Deletes any backup dataset older than the configured RETENTION_DAYS.

This is a destructive operation. Use with care.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""


import os
from datetime import datetime, timedelta, timezone
from google.cloud import bigquery

# --- Configuration ---
PROJECT_ID = os.getenv("GCP_PROJECT_ID")
BACKUP_PREFIX = "backup_"
# Timestamps are parsed using this format. It must match the backup script.
TIMESTAMP_FORMAT = "%Y%m%dT%H%M%SZ"
# Define how many days to keep backups. Backups older than this will be deleted.
RETENTION_DAYS = 30


def cleanup_old_backups():
    """Finds and deletes backup datasets older than the retention period."""
    if not PROJECT_ID:
        raise ValueError("The GCP_PROJECT_ID environment variable is not set.")

    client = bigquery.Client(project=PROJECT_ID)
    retention_limit = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)

    print(f"Scanning for backup datasets older than {RETENTION_DAYS} days (created before {retention_limit.date()})...")

    datasets = list(client.list_datasets())
    datasets_to_delete = []

    for dataset in datasets:
        dataset_id = dataset.dataset_id
        if dataset_id.startswith(BACKUP_PREFIX):
            timestamp_part = dataset_id.replace(BACKUP_PREFIX, "")
            try:
                # Parse the timestamp from the dataset name
                backup_time = datetime.strptime(timestamp_part, TIMESTAMP_FORMAT).replace(tzinfo=timezone.utc)
                if backup_time < retention_limit:
                    datasets_to_delete.append(dataset)
                    print(f"  - Found old backup: '{dataset_id}' (created on {backup_time.date()})")
            except ValueError:
                # Ignore datasets that match the prefix but not the timestamp format
                print(f"  - Skipping '{dataset_id}' (does not match expected timestamp format).")
                continue

    if not datasets_to_delete:
        print("\nNo old backup datasets found to delete.")
        return

    print(f"\nFound {len(datasets_to_delete)} datasets to delete.")
    # This input provides a safeguard before destructive actions.
    # You can remove this for automated execution (e.g., in a Cloud Function).
    confirm = input("Are you sure you want to permanently delete these datasets and all their tables? (y/n): ")

    if confirm.lower() == 'y':
        for dataset in datasets_to_delete:
            print(f"  - Deleting '{dataset.dataset_id}'...")
            try:
                client.delete_dataset(dataset, delete_contents=True)
                print("    ...Success.")
            except Exception as e:
                print(f"    ...FAILED to delete dataset. Reason: {e}")
        print("\nCleanup process completed.")
    else:
        print("\nCleanup aborted by user.")


if __name__ == "__main__":
    cleanup_old_backups()