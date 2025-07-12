"""
main.py

Exports daily historical weather data from BigQuery to Firestore.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
from google.cloud import bigquery, firestore

# --- Configuration ---
# The BigQuery dataset and table to read from.
DATASET_ID = "sunlight_data"
SOURCE_TABLE_ID = "daily_historical_weather"

# The Firestore collection to write to.
DESTINATION_COLLECTION = "daily_weather"

# The Firestore document used to track the last run.
METADATA_DOC_ID = "bq_to_fs_weather_last_run"


def export_weather_to_firestore(event, context):
    """
    Triggered by a Pub/Sub message. Fetches new historical weather data
    from BigQuery and writes it to Firestore.
    """
    firestore_client = firestore.Client()
    bigquery_client = bigquery.Client()
    project_id = bigquery_client.project

    print(f"Cloud Function triggered for project: {project_id}")

    # --- 1. Get the last processed date from Firestore ---
    metadata_ref = firestore_client.collection("bq_export_metadata").document(METADATA_DOC_ID)
    metadata_doc = metadata_ref.get()

    # Default to a very early date if no metadata is found.
    last_processed_date = "1970-01-01"
    if metadata_doc.exists:
        last_processed_date = metadata_doc.to_dict().get("last_processed_date", last_processed_date)

    print(f"Last processed date: {last_processed_date}")

    # --- 2. Query BigQuery for new rows ---
    # This query selects all fields from the historical weather table for dates
    # that have not yet been processed.
    query = f"""
        SELECT
            *
        FROM
            `{project_id}.{DATASET_ID}.{SOURCE_TABLE_ID}`
        WHERE
            date > DATE("{last_processed_date}")
        ORDER BY
            date
        LIMIT 500
    """

    print("Executing BigQuery query for new weather data...")
    query_job = bigquery_client.query(query)
    rows = list(query_job)

    if not rows:
        print("No new weather data found in BigQuery. Exiting.")
        return "SUCCESS"

    print(f"Found {len(rows)} new rows to process.")

    # --- 3. Write new data to Firestore in batches ---
    batch = firestore_client.batch()
    max_processed_date = None

    for row in rows:
        # Convert the BigQuery Row object to a dictionary.
        row_dict = dict(row.items())

        # Ensure sensor_set and date are present to create a robust document ID.
        sensor_set_id= row_dict.get("sensor_set_id")
        record_date = row_dict.get("date")

        if not sensor_set_id or not record_date:
            print(f"Skipping row due to missing sensor_set_idor date: {row_dict}")
            continue

        # Create a unique document ID, e.g., "test_set_1_2025-07-12"
        # The date is converted to string to be part of the ID.
        doc_id = f"{sensor_set_id}_{record_date.strftime('%Y-%m-%d')}"
        doc_ref = firestore_client.collection(DESTINATION_COLLECTION).document(doc_id)

        # The entire row, including the new fields, is written to Firestore.
        batch.set(doc_ref, row_dict)

        # Keep track of the latest date processed in this run.
        if max_processed_date is None or record_date > max_processed_date:
            max_processed_date = record_date

    print(f"Committing batch of {len(rows)} documents to Firestore...")
    batch.commit()

    # --- 4. Update the last processed date in Firestore for the next run ---
    if max_processed_date:
        new_date_str = max_processed_date.strftime('%Y-%m-%d')
        metadata_ref.set({
            "last_processed_date": new_date_str,
            "rows_processed_in_last_run": len(rows)
        })
        print(f"Updated last processed date to: {new_date_str}")

    return "SUCCESS"

