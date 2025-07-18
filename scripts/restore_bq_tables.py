"""
restore_bq_tables.py

Restores BigQuery tables from a previously created backup dataset.

This script performs the following actions:
1. Finds all available backup datasets (named with a 'backup_' prefix).
2. Prompts the user to select which backup dataset to restore from.
3. Asks for explicit confirmation, as this is a destructive operation.
4. Copies all tables from the selected backup dataset to the live
   'sunlight_data', overwriting any existing data.

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
from google.cloud import bigquery

# --- Configuration ---
PROJECT_ID = os.getenv("GCP_PROJECT_ID")
LIVE_DATASET_ID = "sunlight_data"
BACKUP_PREFIX = "backup_"


def restore_bq_from_backup():
    """Finds a backup and restores it to the live dataset."""
    if not PROJECT_ID:
        raise ValueError("The GCP_PROJECT_ID environment variable is not set.")

    client = bigquery.Client(project=PROJECT_ID)

    # 1. Find and list all available backup datasets
    print("Searching for available backups...")
    all_datasets = list(client.list_datasets())
    backup_datasets = sorted(
        [ds for ds in all_datasets if ds.dataset_id.startswith(BACKUP_PREFIX)],
        key=lambda ds: ds.dataset_id,
        reverse=True,  # Show the newest backups first
    )

    if not backup_datasets:
        print("No backup datasets found to restore from.")
        return

    print("\nPlease select a backup to restore:")
    for i, dataset in enumerate(backup_datasets):
        print(f"  [{i + 1}] {dataset.dataset_id}")

    # 2. Get user's choice
    try:
        choice_idx = int(input("\nEnter the number of the backup to restore: ")) - 1
        if not 0 <= choice_idx < len(backup_datasets):
            raise ValueError("Index out of range")
        selected_backup = backup_datasets[choice_idx]
    except (ValueError, IndexError):
        print("Invalid selection. Aborting restore.")
        return

    source_dataset_ref = selected_backup.reference
    print(f"\nYou have selected to restore from: '{source_dataset_ref.dataset_id}'")

    # 3. Get explicit confirmation to prevent accidental data loss
    print("\n" + "=" * 60)
    print("WARNING: THIS IS A DESTRUCTIVE OPERATION.")
    print(f"This will overwrite all tables in the live dataset '{LIVE_DATASET_ID}'")
    print("with the data from the selected backup.")
    print("This action cannot be undone.")
    print("=" * 60 + "\n")

    confirm = input(
        f"To proceed, please type the name of the live dataset ('{LIVE_DATASET_ID}'): "
    )

    if confirm != LIVE_DATASET_ID:
        print("\nConfirmation did not match. Restore aborted.")
        return

    # 4. Proceed with the restore process
    print("\nConfirmation received. Starting restore process...")

    try:
        tables_to_restore = list(client.list_tables(source_dataset_ref))
        if not tables_to_restore:
            print(f"The backup dataset '{source_dataset_ref.dataset_id}' is empty. Nothing to restore.")
            return

        for table in tables_to_restore:
            source_table_ref = f"{source_dataset_ref.project}.{source_dataset_ref.dataset_id}.{table.table_id}"
            dest_table_ref = f"{PROJECT_ID}.{LIVE_DATASET_ID}.{table.table_id}"

            print(f"  - Restoring '{table.table_id}'...")

            # Configure the copy job to overwrite the destination table
            job_config = bigquery.CopyJobConfig(
                write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE
            )

            copy_job = client.copy_table(
                source_table_ref, dest_table_ref, job_config=job_config
            )
            copy_job.result()  # Wait for the job to complete
            print("    ...Success.")

    except Exception as e:
        print(f"\nAn unexpected error occurred during the restore process: {e}")
        print("Restore may be incomplete.")
        return

    print("\nRestore process completed successfully.")


if __name__ == "__main__":
    restore_bq_from_backup()