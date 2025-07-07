"""
main.py

Transforms BigQuery data into Firestore documents.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
import base64
import os
from google.cloud import bigquery, firestore

# Define constants that don't change
DATASET_ID = "sunlight_data"
SOURCE_TABLE_ID = "downsampled_sunlight_data"


def export_to_firestore(event, context):
    """
    Triggered by a Pub/Sub message. Fetches new data from BigQuery and
    writes it to Firestore.
    """
    # Initialize clients inside the function.
    # This ensures they are created only when the function runs, allowing
    # mocks to work correctly during testing.
    firestore_client = firestore.Client()
    bigquery_client = bigquery.Client()

    # Get Project ID at runtime to ensure it's correct in all environments
    project_id = os.environ.get("GCP_PROJECT")
    if not project_id:
        # In a real GCP environment, this is set automatically.
        # For local testing, it must be set manually.
        raise ValueError("GCP_PROJECT environment variable not set.")

    print(f"Cloud Function triggered for project: {project_id}")

    # --- 1. Get the last processed timestamp from Firestore ---
    metadata_ref = firestore_client.collection("bq_export_metadata").document("last_run")
    metadata_doc = metadata_ref.get()

    last_processed_ts = "1970-01-01T00:00:00Z"
    if metadata_doc.exists:
        last_processed_ts = metadata_doc.to_dict().get("last_processed_timestamp_utc", last_processed_ts)

    print(f"Last processed timestamp: {last_processed_ts}")

    # --- 2. Query BigQuery for new rows ---
    query = f"""
        SELECT
            observation_minute,
            sensor_id,
            smoothed_light_intensity
        FROM
            `{project_id}.{DATASET_ID}.{SOURCE_TABLE_ID}`
        WHERE
            observation_minute > TIMESTAMP("{last_processed_ts}")
        ORDER BY
            observation_minute
    """

    print("Executing BigQuery query...")
    query_job = bigquery_client.query(query)
    rows = list(query_job)  # Execute the query and get results

    if not rows:
        print("No new rows found in BigQuery. Exiting.")
        return "SUCCESS"

    print(f"Found {len(rows)} new rows to process.")

    # --- 3. Write new data to Firestore in batches ---
    batch = firestore_client.batch()
    max_new_timestamp = None

    for row in rows:
        # Create a unique document ID from the sensor and timestamp
        doc_id = f"{row.sensor_id}_{row.observation_minute.isoformat()}"
        doc_ref = firestore_client.collection("sunlight_readings").document(doc_id)

        batch.set(doc_ref, {
            "sensor_id": row.sensor_id,
            "observation_minute": row.observation_minute,
            "smoothed_light_intensity": row.smoothed_light_intensity
        })

        # Keep track of the latest timestamp processed in this run
        if max_new_timestamp is None or row.observation_minute > max_new_timestamp:
            max_new_timestamp = row.observation_minute

    print("Committing batch to Firestore...")
    batch.commit()

    # --- 4. Update the last processed timestamp in Firestore for the next run ---
    if max_new_timestamp:
        new_timestamp_str = max_new_timestamp.isoformat() + "Z"
        metadata_ref.set({
            "last_processed_timestamp_utc": new_timestamp_str,
            "rows_processed_in_last_run": len(rows)
        })
        print(f"Updated last processed timestamp to: {new_timestamp_str}")

    return "SUCCESS"
