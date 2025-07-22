"""
main.py

Transforms and aggregates BigQuery data into Firestore documents.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""

from datetime import timezone
from google.cloud import bigquery, firestore

DATASET_ID = "sunlight_data"
SOURCE_TABLE_ID = "downsampled_sunlight_data"

def export_sensors_to_firestore(event, context):
    """
    Triggered by a Pub/Sub message. Fetches new data from BigQuery,
    aggregates it to 15-minute intervals, and writes it to Firestore.
    """
    firestore_client = firestore.Client()
    bigquery_client = bigquery.Client()
    project_id = bigquery_client.project

    print(f"Cloud Function triggered for project: {project_id}")

    # --- 1. Get the last processed timestamp from Firestore ---
    # This watermark now represents the last `last_updated` timestamp we processed.
    metadata_ref = firestore_client.collection("bq_export_metadata").document("last_run")
    metadata_doc = metadata_ref.get()
    last_processed_ts = "1970-01-01T00:00:00Z"
    if metadata_doc.exists:
        last_processed_ts = metadata_doc.to_dict().get("last_processed_timestamp_utc", last_processed_ts)

    print(f"Last processed timestamp (based on last_updated): {last_processed_ts}")

    # --- 2. Query BigQuery for new rows, aggregating to 15-minute intervals ---
    # The query now uses `last_updated` as the watermark to find new or
    # modified rows, making it robust against varying data cadences between sensors.
    query = f"""
        SELECT
            -- Truncate the timestamp to the nearest 15-minute interval using integer division
            TIMESTAMP_SECONDS(900 * DIV(UNIX_SECONDS(observation_minute), 900)) as observation_minute,
            sensor_id,
            sensor_set_id,
            -- Calculate the average smoothed light intensity for the interval
            AVG(smoothed_light_intensity) as smoothed_light_intensity,
            -- Get the latest update timestamp for the data processed in this group
            MAX(last_updated) as max_last_updated
        FROM
            `{project_id}.{DATASET_ID}.{SOURCE_TABLE_ID}`
        WHERE
            -- Filter by `last_updated` to get a true incremental view of changes.
            last_updated > TIMESTAMP("{last_processed_ts}")
        GROUP BY
            1, 2, 3
        ORDER BY
            max_last_updated -- Process records in the order they were updated
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
    # This will now track the latest `last_updated` timestamp from the processed batch.
    max_new_last_updated_ts = None

    for row in rows:
        # Create a unique document ID from the sensor and the AGGREGATED timestamp
        doc_id = f"{row.sensor_id}_{row.observation_minute.isoformat()}"
        doc_ref = firestore_client.collection("sunlight_readings").document(doc_id)

        batch.set(doc_ref, {
            "sensor_id": row.sensor_id,
            "observation_minute": row.observation_minute,
            # The value is now an average, so we round it for cleanliness
            "smoothed_light_intensity": round(row.smoothed_light_intensity),
            "sensor_set_id": row.sensor_set_id
        })

        # Track the maximum `last_updated` timestamp from the rows we are processing.
        if max_new_last_updated_ts is None or row.max_last_updated > max_new_last_updated_ts:
            max_new_last_updated_ts = row.max_last_updated

    print("Committing batch to Firestore...")
    batch.commit()

    # --- 4. Update the last processed timestamp in Firestore ---
    # The new watermark is the latest `last_updated` time we've seen.
    if max_new_last_updated_ts:
        if max_new_last_updated_ts.tzinfo is None:
            max_new_last_updated_ts = max_new_last_updated_ts.replace(tzinfo=timezone.utc)
        new_timestamp_str = max_new_last_updated_ts.isoformat().replace('+00:00', 'Z')
        metadata_ref.set({
            "last_processed_timestamp_utc": new_timestamp_str,
            "rows_processed_in_last_run": len(rows)
        })
        print(f"Updated last processed timestamp to: {new_timestamp_str}")

    return "SUCCESS"