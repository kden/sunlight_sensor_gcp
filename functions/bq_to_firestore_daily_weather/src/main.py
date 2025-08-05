"""
main.py

Exports daily and hourly historical weather data from BigQuery to Firestore.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025)
Apache 2.0 Licensed as described in the file LICENSE
"""
from google.cloud import bigquery, firestore
import functions_framework
from datetime import datetime, time
import json

# --- Configuration ---
# The BigQuery dataset and tables to read from.
DATASET_ID = "sunlight_data"
DAILY_SOURCE_TABLE_ID = "daily_historical_weather"
HOURLY_SOURCE_TABLE_ID = "hourly_historical_weather"

# The Firestore collections to write to.
DAILY_DESTINATION_COLLECTION = "daily_weather"
HOURLY_DESTINATION_COLLECTION = "hourly_weather"

# The Firestore documents used to track the last run.
DAILY_METADATA_DOC_ID = "bq_to_fs_daily_weather_last_run"
HOURLY_METADATA_DOC_ID = "bq_to_fs_hourly_weather_last_run"


@functions_framework.http
def export_weather_to_firestore(request):
    """
    Triggered by an HTTP request. Fetches new historical weather data
    from BigQuery and writes it to Firestore, handling both daily and hourly data.
    """
    # Parse the request body to determine what to export
    export_type = "both"  # default
    if request.data:
        try:
            # The body is sent as raw bytes, decode it.
            message_data = request.data.decode('utf-8')
            message_json = json.loads(message_data)
            export_type = message_json.get('export_type', 'both')
        except (json.JSONDecodeError, UnicodeDecodeError):
            print("Could not parse request body, defaulting to export both daily and hourly")

    firestore_client = firestore.Client()
    bigquery_client = bigquery.Client()
    project_id = bigquery_client.project

    print(f"Cloud Function triggered for project: {project_id}, export_type: {export_type}")

    success_count = 0
    results = []

    # Export daily data
    if export_type in ["both", "daily"]:
        try:
            result = export_daily_weather(firestore_client, bigquery_client, project_id)
            results.append(f"Daily: {result}")
            if "SUCCESS" in result:
                success_count += 1
        except Exception as e:
            print(f"Error exporting daily weather data: {e}")
            results.append(f"Daily: FAILED with {e}")

    # Export hourly data
    if export_type in ["both", "hourly"]:
        try:
            result = export_hourly_weather(firestore_client, bigquery_client, project_id)
            results.append(f"Hourly: {result}")
            if "SUCCESS" in result:
                success_count += 1
        except Exception as e:
            print(f"Error exporting hourly weather data: {e}")
            results.append(f"Hourly: FAILED with {e}")

    expected_exports = 1 if export_type in ["daily", "hourly"] else 2
    if success_count == expected_exports:
        return f"SUCCESS: {'; '.join(results)}", 200
    else:
        return f"PARTIAL_SUCCESS: {success_count}/{expected_exports} exports completed. Details: {'; '.join(results)}", 500


def export_daily_weather(firestore_client, bigquery_client, project_id):
    """
    Export daily weather data from BigQuery to Firestore.
    """
    print("Starting daily weather export...")

    # Get the last processed date from Firestore
    metadata_ref = firestore_client.collection("bq_export_metadata").document(DAILY_METADATA_DOC_ID)
    metadata_doc = metadata_ref.get()

    last_processed_date = "1970-01-01"
    if metadata_doc.exists:
        last_processed_date = metadata_doc.to_dict().get("last_processed_date", last_processed_date)

    print(f"Daily - Last processed date: {last_processed_date}")

    # Query BigQuery for new rows
    query = f"""
        SELECT
            *
        FROM
            `{project_id}.{DATASET_ID}.{DAILY_SOURCE_TABLE_ID}`
        WHERE
            date > DATE("{last_processed_date}")
        ORDER BY
            date, sensor_set_id
        LIMIT 500
    """

    print("Executing BigQuery query for new daily weather data...")
    query_job = bigquery_client.query(query)
    rows = list(query_job)

    if not rows:
        print("No new daily weather data found in BigQuery.")
        return "SUCCESS: No new data."

    print(f"Found {len(rows)} new daily rows to process.")

    batch = firestore_client.batch()
    max_processed_date_in_run = None

    for row in rows:
        record_date = row.get("date")
        sensor_set_id = row.get("sensor_set_id")

        if not sensor_set_id or not record_date:
            print(f"Skipping daily row due to missing sensor_set_id or date: {dict(row.items())}")
            continue

        # Manually construct the document to ensure all types are correct.
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
            "precipitation_hours": row.get("precipitation_hours"),
            "data_source": row.get("data_source"),
            "sensor_set_id": sensor_set_id,
            "timezone": row.get("timezone"),
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
            "last_updated": row.get("last_updated"),
        }

        print(f"Processing daily row for {record_date}: Sunrise={firestore_doc_data['sunrise']}, Sunset={firestore_doc_data['sunset']}")

        # Create a unique document ID for Firestore.
        doc_id = f"{sensor_set_id}_{record_date.strftime('%Y-%m-%d')}"
        doc_ref = firestore_client.collection(DAILY_DESTINATION_COLLECTION).document(doc_id)

        batch.set(doc_ref, firestore_doc_data)

        # Keep track of the latest date processed in this run.
        if max_processed_date_in_run is None or record_date > max_processed_date_in_run:
            max_processed_date_in_run = record_date

    print(f"Committing batch of {len(rows)} daily documents to Firestore...")
    batch.commit()

    # Update the last processed date in Firestore for the next run
    if max_processed_date_in_run:
        new_date_str = max_processed_date_in_run.strftime('%Y-%m-%d')
        metadata_ref.set({
            "last_processed_date": new_date_str,
            "rows_processed_in_last_run": len(rows),
            "last_run_timestamp": firestore.SERVER_TIMESTAMP
        })
        print(f"Updated daily last processed date to: {new_date_str}")

    return f"SUCCESS: Processed {len(rows)} rows."


def export_hourly_weather(firestore_client, bigquery_client, project_id):
    """
    Export hourly weather data from BigQuery to Firestore.
    """
    print("Starting hourly weather export...")

    # Get the last processed timestamp from Firestore
    metadata_ref = firestore_client.collection("bq_export_metadata").document(HOURLY_METADATA_DOC_ID)
    metadata_doc = metadata_ref.get()

    last_processed_timestamp = "1970-01-01 00:00:00"
    if metadata_doc.exists:
        last_processed_timestamp = metadata_doc.to_dict().get("last_processed_timestamp", last_processed_timestamp)

    print(f"Hourly - Last processed timestamp: {last_processed_timestamp}")

    # Query BigQuery for new hourly rows
    # Note: Using smaller batch size for hourly data due to volume
    query = f"""
        SELECT
            *
        FROM
            `{project_id}.{DATASET_ID}.{HOURLY_SOURCE_TABLE_ID}`
        WHERE
            time > TIMESTAMP("{last_processed_timestamp}")
        ORDER BY
            time, sensor_set_id
        LIMIT 200
    """

    print("Executing BigQuery query for new hourly weather data...")
    query_job = bigquery_client.query(query)
    rows = list(query_job)

    if not rows:
        print("No new hourly weather data found in BigQuery.")
        return "SUCCESS: No new data."

    print(f"Found {len(rows)} new hourly rows to process.")

    batch = firestore_client.batch()
    max_processed_timestamp_in_run = None
    batch_count = 0

    for row in rows:
        record_time = row.get("time")
        sensor_set_id = row.get("sensor_set_id")

        if not sensor_set_id or not record_time:
            print(f"Skipping hourly row due to missing sensor_set_id or time: {dict(row.items())}")
            continue

        # Manually construct the document to ensure all types are correct.
        firestore_doc_data = {
            "time": record_time,  # BigQuery TIMESTAMP is already a datetime object
            "sensor_set_id": sensor_set_id,
            "temperature_2m": row.get("temperature_2m"),
            "precipitation": row.get("precipitation"),
            "relative_humidity_2m": row.get("relative_humidity_2m"),
            "cloud_cover": row.get("cloud_cover"),
            "visibility": row.get("visibility"),
            "soil_temperature_0cm": row.get("soil_temperature_0cm"),
            "soil_moisture_1_to_3cm": row.get("soil_moisture_1_to_3cm"),
            "uv_index": row.get("uv_index"),
            "uv_index_clear_sky": row.get("uv_index_clear_sky"),
            "shortwave_radiation": row.get("shortwave_radiation"),
            "direct_radiation": row.get("direct_radiation"),
            "wind_speed_10m": row.get("wind_speed_10m"),
            "timezone": row.get("timezone"),
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
            "data_source": row.get("data_source"),
            "last_updated": row.get("last_updated"),
        }

        # Create a unique document ID for Firestore using timestamp
        # Format: sensorId_YYYY-MM-DD_HH
        doc_id = f"{sensor_set_id}_{record_time.strftime('%Y-%m-%d_%H')}"
        doc_ref = firestore_client.collection(HOURLY_DESTINATION_COLLECTION).document(doc_id)

        batch.set(doc_ref, firestore_doc_data)
        batch_count += 1

        # Keep track of the latest timestamp processed in this run.
        if max_processed_timestamp_in_run is None or record_time > max_processed_timestamp_in_run:
            max_processed_timestamp_in_run = record_time

        # Commit in smaller batches for hourly data to avoid timeout issues
        if batch_count >= 100:
            print(f"Committing intermediate batch of {batch_count} hourly documents...")
            batch.commit()
            batch = firestore_client.batch()
            batch_count = 0

    # Commit any remaining documents in the batch
    if batch_count > 0:
        print(f"Committing final batch of {batch_count} hourly documents to Firestore...")
        batch.commit()

    # Update the last processed timestamp in Firestore for the next run
    if max_processed_timestamp_in_run:
        new_timestamp_str = max_processed_timestamp_in_run.strftime('%Y-%m-%d %H:%M:%S')
        metadata_ref.set({
            "last_processed_timestamp": new_timestamp_str,
            "rows_processed_in_last_run": len(rows),
            "last_run_timestamp": firestore.SERVER_TIMESTAMP
        })
        print(f"Updated hourly last processed timestamp to: {new_timestamp_str}")

    return f"SUCCESS: Processed {len(rows)} rows."