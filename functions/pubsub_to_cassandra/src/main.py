"""
main.py

Receives sensor data from Pub/Sub and writes to Datastax Astra Cassandra.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from Claude Sonnet 4.5 (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
import os
import json
import base64
from datetime import datetime
from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
from cassandra import ConsistencyLevel
from cassandra.query import SimpleStatement
from google.cloud import storage
import functions_framework

# Global connection - initialized once and reused across function invocations
cassandra_session = None
astra_keyspace = None


def get_cassandra_session():
    """
    Initialize Cassandra connection on first use (lazy initialization).
    Reuses the connection across function invocations.
    """
    global cassandra_session
    global astra_keyspace

    if cassandra_session is not None:
        return cassandra_session

    # Read Astra configuration from environment
    astra_client_id = os.environ.get('ASTRA_CLIENT_ID')
    astra_client_secret = os.environ.get('ASTRA_CLIENT_SECRET')
    astra_secure_bundle_bucket = os.environ.get('ASTRA_SECURE_BUNDLE_BUCKET')
    astra_keyspace = os.environ.get('ASTRA_KEYSPACE', 'sunlight_data')

    if not all([astra_client_id, astra_client_secret, astra_secure_bundle_bucket]):
        raise ValueError("Missing Astra configuration environment variables")

    # Download secure connect bundle from GCS
    bundle_path = '/tmp/secure-connect-bundle.zip'

    try:
        print(f"INFO: Downloading secure bundle from gs://{astra_secure_bundle_bucket}/secure-connect-bundle.zip")
        storage_client = storage.Client()
        bucket = storage_client.bucket(astra_secure_bundle_bucket)
        blob = bucket.blob('secure-connect-bundle.zip')
        blob.download_to_filename(bundle_path)
        print(f"INFO: Secure bundle downloaded successfully to {bundle_path}")
    except Exception as e:
        print(f"ERROR: Failed to download secure bundle from GCS: {e}")
        raise

    # Create Cassandra cluster connection
    cloud_config = {'secure_connect_bundle': bundle_path}
    auth_provider = PlainTextAuthProvider(astra_client_id, astra_client_secret)

    try:
        cluster = Cluster(cloud=cloud_config, auth_provider=auth_provider, protocol_version=4)
        # Connect without specifying keyspace to avoid the warning
        cassandra_session = cluster.connect()
        print(f"INFO: Connected to Astra")
    except Exception as e:
        print(f"ERROR: Failed to connect to Cassandra: {e}")
        raise

    return cassandra_session


def update_latest_reading(session, reading, timestamp, ingestion_time):
    """
    Update the latest reading cache table.
    Only updates fields that are present in the reading, preserving other fields.
    Uses Cassandra's UPSERT semantics to merge updates.
    """
    sensor_id = reading.get('sensor_id')
    sensor_set_id = reading.get('sensor_set_id')

    if not sensor_id:
        return

    # Build the UPDATE statement dynamically based on what fields are present
    set_clauses = []
    values = []

    # Always update these fields
    set_clauses.append("last_seen = ?")
    values.append(ingestion_time)

    set_clauses.append("timestamp = ?")
    values.append(timestamp)

    # Always update sensor_set_id if present
    if sensor_set_id:
        set_clauses.append("sensor_set_id = ?")
        values.append(sensor_set_id)

    # Update each field only if it's present in the reading
    if 'light_intensity' in reading and reading['light_intensity'] is not None:
        set_clauses.append("light_intensity = ?")
        set_clauses.append("light_intensity_timestamp = ?")
        values.extend([reading['light_intensity'], timestamp])

    if 'status' in reading and reading['status'] is not None:
        set_clauses.append("status = ?")
        set_clauses.append("status_timestamp = ?")
        values.extend([reading['status'], timestamp])

    if 'battery_voltage' in reading and reading['battery_voltage'] is not None:
        set_clauses.append("battery_voltage = ?")
        set_clauses.append("battery_voltage_timestamp = ?")
        values.extend([reading['battery_voltage'], timestamp])

    if 'battery_percent' in reading and reading['battery_percent'] is not None:
        set_clauses.append("battery_percent = ?")
        set_clauses.append("battery_percent_timestamp = ?")
        values.extend([reading['battery_percent'], timestamp])

    if 'wifi_dbm' in reading and reading['wifi_dbm'] is not None:
        set_clauses.append("wifi_dbm = ?")
        set_clauses.append("wifi_dbm_timestamp = ?")
        values.extend([reading['wifi_dbm'], timestamp])

    if 'chip_temp_c' in reading and reading['chip_temp_c'] is not None:
        set_clauses.append("chip_temp_c = ?")
        set_clauses.append("chip_temp_c_timestamp = ?")
        values.extend([reading['chip_temp_c'], timestamp])

    if 'chip_temp_f' in reading and reading['chip_temp_f'] is not None:
        set_clauses.append("chip_temp_f = ?")
        set_clauses.append("chip_temp_f_timestamp = ?")
        values.extend([reading['chip_temp_f'], timestamp])

    if 'commit_sha' in reading and reading['commit_sha'] is not None:
        set_clauses.append("commit_sha = ?")
        set_clauses.append("commit_sha_timestamp = ?")
        values.extend([reading['commit_sha'], timestamp])

    if 'commit_timestamp' in reading and reading['commit_timestamp'] is not None:
        set_clauses.append("commit_timestamp = ?")
        set_clauses.append("commit_timestamp_timestamp = ?")
        values.extend([reading['commit_timestamp'], timestamp])

    # Add sensor_id as the last value for the WHERE clause
    values.append(sensor_id)

    # Construct the UPDATE query with fully qualified table name
    update_query = f"""
        UPDATE {astra_keyspace}.sensor_latest_reading
        SET {', '.join(set_clauses)}
        WHERE sensor_id = ?
    """

    try:
        # Prepare the statement to avoid string formatting issues
        prepared = session.prepare(update_query)
        session.execute(prepared, tuple(values))
    except Exception as e:
        print(f"ERROR: Failed to update latest reading for {sensor_id}: {e}")
        print(f"DEBUG: Query: {update_query}")
        print(f"DEBUG: Number of placeholders: {update_query.count('?')}")
        print(f"DEBUG: Number of values: {len(values)}")
        print(f"DEBUG: Values: {values}")


@functions_framework.cloud_event
def write_to_cassandra(cloud_event):
    """
    Triggered by Pub/Sub message. Writes sensor readings to Astra Cassandra.
    """
    # Decode the Pub/Sub message
    try:
        b64_data = cloud_event.data["message"]["data"]
        decoded_data = base64.b64decode(b64_data).decode("utf-8")
        payload = json.loads(decoded_data)
    except (KeyError, TypeError, json.JSONDecodeError) as e:
        print(f"ERROR: Could not decode or parse Pub/Sub message. Error: {e}")
        return

    # Expect a list of sensor readings
    if not isinstance(payload, list):
        print(f"WARN: Received non-list payload, converting to list. Payload: {payload}")
        payload = [payload]

    # Get Cassandra session
    try:
        session = get_cassandra_session()
    except Exception as e:
        print(f"ERROR: Failed to initialize Cassandra connection: {e}")
        return

    # Prepare the insert statement for raw data with fully qualified table name
    insert_query = f"""
        INSERT INTO {astra_keyspace}.raw_sensor_data (
            sensor_id,
            sensor_set_id,
            timestamp,
            light_intensity,
            ingestion_time,
            status,
            battery_voltage,
            battery_percent,
            wifi_dbm,
            chip_temp_c,
            chip_temp_f,
            commit_sha,
            commit_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    prepared = session.prepare(insert_query)
    prepared.consistency_level = ConsistencyLevel.LOCAL_QUORUM

    # Process each reading
    success_count = 0
    error_count = 0

    for reading in payload:
        if not isinstance(reading, dict):
            print(f"WARN: Skipping non-dict reading: {reading}")
            continue

        try:
            sensor_id = reading.get('sensor_id')
            sensor_set_id = reading.get('sensor_set_id')
            timestamp = reading.get('timestamp')
            light_intensity = reading.get('light_intensity')
            status = reading.get('status')
            battery_voltage = reading.get('battery_voltage')
            battery_percent = reading.get('battery_percent')
            wifi_dbm = reading.get('wifi_dbm')
            chip_temp_c = reading.get('chip_temp_c')
            chip_temp_f = reading.get('chip_temp_f')
            commit_sha = reading.get('commit_sha')
            commit_timestamp = reading.get('commit_timestamp')

            # Skip if missing required fields
            if not sensor_id or not timestamp:
                print(f"WARN: Skipping reading with missing sensor_id or timestamp: {reading}")
                continue

            # Parse timestamp if it's a string
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

            # Current time for ingestion_time
            ingestion_time = datetime.utcnow()

            # Execute insert to raw data table
            session.execute(
                prepared,
                (
                    sensor_id,
                    sensor_set_id,
                    timestamp,
                    light_intensity,
                    ingestion_time,
                    status,
                    battery_voltage,
                    battery_percent,
                    wifi_dbm,
                    chip_temp_c,
                    chip_temp_f,
                    commit_sha,
                    commit_timestamp
                )
            )

            # Update latest reading cache
            update_latest_reading(session, reading, timestamp, ingestion_time)

            success_count += 1

        except Exception as e:
            print(f"ERROR: Failed to insert reading: {e}. Reading: {reading}")
            error_count += 1

    print(f"INFO: Cassandra write complete. Success: {success_count}, Errors: {error_count}")