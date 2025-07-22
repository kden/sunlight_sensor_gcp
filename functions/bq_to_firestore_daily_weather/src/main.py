"""
main.py

Exports daily historical weather data from BigQuery to Firestore.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
from google.cloud import bigquery, firestore
from datetime import date, datetime, time

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
    from BigQuery and writes it to Firestore, ensuring correct timestamp handling.
    """
    firestore_client = firestore.Client()
    bigquery_client = bigquery.Client()
    project_id = bigquery_client.project

    print(f"Cloud Function triggered for project: {project_id}")

    # Get the last processed date from Firestore
    metadata_ref = firestore_client.collection("bq_export_metadata").document(METADATA_DOC_ID)
    metadata_doc = metadata_ref.get()

    last_processed_date = "1970-01-01"
    if metadata_doc.exists:
        last_processed_date = metadata_doc.to_dict().get("last_processed_date", last_processed_date)

    print(f"Last processed date: {last_processed_date}")

    # Query BigQuery for new rows
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

    batch = firestore_client.batch()
    max_processed_date_in_run = None

    for row in rows:
        # --- Explicitly build the dictionary for Firestore ---
        # This prevents implicit type conversion errors and adds robustness.

        record_date = row.get("date")
        sensor_set_id = row.get("sensor_set_id")

        if not sensor_set_id or not record_date:
            print(f"Skipping row due to missing sensor_set_id or date: {dict(row.items())}")
            continue

        # Manually construct the document to ensure all types are correct.
        # The BigQuery client correctly returns datetime objects for TIMESTAMP fields.
        # We pass these directly to Firestore, which knows how to handle them.
        firestore_doc_data = {
            # Convert the date field to a timestamp at midnight UTC for consistency.
            "date": datetime.combine(record_date, time.min),
            "sunrise": row.get("sunrise"),
            "sunset": row.get("sunset"),
            "daylight_duration": row.get("daylight_duration"),
            "sunshine_duration": row.get("sunshine_duration"),
            "temperature_2m_max": row.get("temperature_2m_max"),
            "temperature_2m_min": row.get("temperature_2m_min"),
            "uv_index_max": row.get("uv_index_max"),
            "uv_index_clear_sky_max": row.get("uv_index_clear_sky_max"),
            "rain_sum": row.get("rain_sum"),
            "showers_sum": row.get("showers_sum"),
            "precipitation_sum": row.get("precipitation_sum"),
            "snowfall_sum": row.get("snowfall_sum"),
            "precipitation_hour": row.get("precipitation_hour"),
            "data_source": row.get("data_source"),
            "sensor_set_id": sensor_set_id,
            "timezone": row.get("timezone"),
        }

        # Add crucial logging to see exactly what is being sent to Firestore.
        # This will appear in your Cloud Function logs.
        print(f"Processing row for {record_date}: Sunrise={firestore_doc_data['sunrise']}, Sunset={firestore_doc_data['sunset']}")

        # Create a unique document ID for Firestore.
        doc_id = f"{sensor_set_id}_{record_date.strftime('%Y-%m-%d')}"
        doc_ref = firestore_client.collection(DESTINATION_COLLECTION).document(doc_id)

        batch.set(doc_ref, firestore_doc_data)

        # Keep track of the latest date processed in this run.
        if max_processed_date_in_run is None or record_date > max_processed_date_in_run:
            max_processed_date_in_run = record_date

    print(f"Committing batch of {len(rows)} documents to Firestore...")
    batch.commit()

    # Update the last processed date in Firestore for the next run
    if max_processed_date_in_run:
        new_date_str = max_processed_date_in_run.strftime('%Y-%m-%d')
        metadata_ref.set({
            "last_processed_date": new_date_str,
            "rows_processed_in_last_run": len(rows),
            "last_run_timestamp": firestore.SERVER_TIMESTAMP
        })
        print(f"Updated last processed date to: {new_date_str}")

    return "SUCCESS"
