"""
backup_bq_tables.py

Creates a timestamped backup of key BigQuery tables.

This script performs the following actions:
1. Creates a new BigQuery dataset with a name like 'backup_20250520T123000Z'.
2. Copies a predefined list of tables from the source dataset ('sunlight_data')
   into the newly created backup dataset.

Prerequisites:
  - The `google-cloud-bigquery` library must be installed.
  - You must be authenticated with Google Cloud CLI. Run:
    `gcloud auth application-default login`
  - The GCP_PROJECT_ID environment variable must be set. Run:
    `export GCP_PROJECT_ID="your-gcp-project-id"`

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
import os
from datetime import datetime, timezone
from google.cloud import bigquery

# --- Configuration ---
PROJECT_ID = os.getenv("GCP_PROJECT_ID")
SOURCE_DATASET_ID = "sunlight_data"
LOCATION = "US"  # Must match the location of the source dataset

# List of tables to be included in the backup, matching your Terraform definitions
TABLES_TO_BACKUP = [
    "daily_historical_weather",
    "downsampled_sunlight_data",
    "sensor",
    "sensor_set",
    "sunlight_intensity",
    "transformed_sunlight_data",
]


def backup_bq_tables():
    """Creates a new dataset and copies tables into it."""
    if not PROJECT_ID:
        raise ValueError("The GCP_PROJECT_ID environment variable is not set.")

    client = bigquery.Client(project=PROJECT_ID)

    # 1. Generate a unique, timestamped name for the backup dataset
    timestamp_str = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup_dataset_id = f"backup_{timestamp_str}"
    backup_dataset_ref = f"{PROJECT_ID}.{backup_dataset_id}"

    # 2. Create the new backup dataset
    try:
        print(f"Creating new backup dataset: '{backup_dataset_ref}'...")
        dataset = bigquery.Dataset(backup_dataset_ref)
        dataset.location = LOCATION
        client.create_dataset(dataset, timeout=30)
        print("Dataset created successfully.")
    except Exception as e:
        print(f"Failed to create dataset: {e}")
        raise

    # 3. Loop through and copy each table
    print(f"\nStarting copy of {len(TABLES_TO_BACKUP)} tables from '{SOURCE_DATASET_ID}'...")
    for table_id in TABLES_TO_BACKUP:
        source_table_ref = f"{PROJECT_ID}.{SOURCE_DATASET_ID}.{table_id}"
        dest_table_ref = f"{backup_dataset_ref}.{table_id}"

        try:
            print(f"  - Copying '{table_id}'...")
            copy_job = client.copy_table(source_table_ref, dest_table_ref)
            copy_job.result()  # Wait for the job to complete
            print(f"    ...Success.")
        except Exception as e:
            print(f"    ...FAILED to copy table '{table_id}'. Reason: {e}")
            # Continue to the next table even if one fails
            continue

    print("\nBackup process completed.")


if __name__ == "__main__":
    backup_bq_tables()