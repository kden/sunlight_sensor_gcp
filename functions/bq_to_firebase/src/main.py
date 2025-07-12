"""
main.py

Transforms and aggregates BigQuery data into Firestore documents.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
import base64
import os
from datetime import timezone
from google.cloud import bigquery, firestore

DATASET_ID = "sunlight_data"
SOURCE_TABLE_ID = "downsampled_sunlight_data"

def export_to_firestore(event, context):
    """
    Triggered by a Pub/Sub message. Fetches new data from BigQuery,
    aggregates it to 15-minute intervals, and writes it to Firestore.
    """
    firestore_client = firestore.Client()
    bigquery_client = bigquery.Client()
    project_id = bigquery_client.project

    print(f"Cloud Function triggered for project: {project_id}")

    # --- 1. Get the last processed timestamp from Firestore ---
    metadata_ref = firestore_client.collection("bq_export_metadata").document("last_run")
    metadata_doc = metadata_ref.get()
    last_processed_ts = "1970-01-01T00:00:00Z"
    if metadata_doc.exists:
        last_processed_ts = metadata_doc.to_dict().get("last_processed_timestamp_utc", last_processed_ts)

    print(f"Last processed timestamp: {last_processed_ts}")

    # --- 2. Query BigQuery for new rows, aggregating to 15-minute intervals ---
    # MODIFICATION: The query now uses timestamp arithmetic to correctly
    # bucket the data into 15-minute intervals.
    query = f"""
        SELECT
            -- Truncate the timestamp to the nearest 15-minute interval using integer division
            TIMESTAMP_SECONDS(900 * DIV(UNIX_SECONDS(observation_minute), 900)) as observation_minute,
            sensor_id,
            sensor_set,
            -- Calculate the average smoothed light intensity for the interval
            AVG(smoothed_light_intensity) as smoothed_light_intensity
        FROM
            `{project_id}.{DATASET_ID}.{SOURCE_TABLE_ID}`
        WHERE
            observation_minute > TIMESTAMP("{last_processed_ts}")
        GROUP BY
            1, 2, 3
        ORDER BY
            observation_minute
        LIMIT 500
    """

    print("Executing BigQuery aggregation query...")
    query_job = bigquery_client.query(query)
    rows = list(query_job)

    if not rows:
        print("No new rows found in BigQuery. Exiting.")
        return "SUCCESS"

    print(f"Found {len(rows)} new aggregated rows to process.")

    # --- 3. Write new aggregated data to Firestore in batches ---
    batch = firestore_client.batch()
    max_new_timestamp = None

    for row in rows:
        # Create a unique document ID from the sensor and the AGGREGATED timestamp
        doc_id = f"{row.sensor_id}_{row.observation_minute.isoformat()}"
        doc_ref = firestore_client.collection("sunlight_readings").document(doc_id)

        batch.set(doc_ref, {
            "sensor_id": row.sensor_id,
            "observation_minute": row.observation_minute,
            # The value is now an average, so we round it for cleanliness
            "smoothed_light_intensity": round(row.smoothed_light_intensity),
            "sensor_set": row.sensor_set
        })

        if max_new_timestamp is None or row.observation_minute > max_new_timestamp:
            max_new_timestamp = row.observation_minute

    print("Committing batch to Firestore...")
    batch.commit()

    # --- 4. Update the last processed timestamp in Firestore ---
    if max_new_timestamp:
        if max_new_timestamp.tzinfo is None:
            max_new_timestamp = max_new_timestamp.replace(tzinfo=timezone.utc)
        new_timestamp_str = max_new_timestamp.isoformat().replace('+00:00', 'Z')
        metadata_ref.set({
            "last_processed_timestamp_utc": new_timestamp_str,
            "rows_processed_in_last_run": len(rows)
        })
        print(f"Updated last processed timestamp to: {new_timestamp_str}")

    return "SUCCESS"
