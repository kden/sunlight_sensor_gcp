"""
main.py

Receives sensor data from Pub/Sub and writes to Datastax Astra Cassandra.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
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
import functions_framework

# Global connection - initialized once and reused across function invocations
cassandra_session = None


def get_cassandra_session():
    """
    Initialize Cassandra connection on first use (lazy initialization).
    Reuses the connection across function invocations.
    """
    global cassandra_session

    if cassandra_session is not None:
        return cassandra_session

    # Read Astra configuration from environment
    astra_client_id = os.environ.get('ASTRA_CLIENT_ID')
    astra_client_secret = os.environ.get('ASTRA_CLIENT_SECRET')
    astra_secure_bundle_url = os.environ.get('ASTRA_SECURE_BUNDLE_URL')
    astra_keyspace = os.environ.get('ASTRA_KEYSPACE', 'sunlight_data')

    if not all([astra_client_id, astra_client_secret, astra_secure_bundle_url]):
        raise ValueError("Missing Astra configuration environment variables")

    # Download secure connect bundle if needed (Cloud Functions have /tmp)
    import urllib.request
    bundle_path = '/tmp/secure-connect-bundle.zip'

    try:
        urllib.request.urlretrieve(astra_secure_bundle_url, bundle_path)
    except Exception as e:
        print(f"ERROR: Failed to download secure bundle: {e}")
        raise

    # Create Cassandra cluster connection
    cloud_config = {'secure_connect_bundle': bundle_path}
    auth_provider = PlainTextAuthProvider(astra_client_id, astra_client_secret)

    cluster = Cluster(cloud=cloud_config, auth_provider=auth_provider)
    cassandra_session = cluster.connect(astra_keyspace)

    print(f"INFO: Connected to Astra keyspace: {astra_keyspace}")
    return cassandra_session


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

    # Prepare the insert statement
    # Using a separate table for raw sensor data
    insert_query = """
        INSERT INTO raw_sensor_data (
            sensor_id,
            sensor_set_id,
            timestamp,
            light_intensity,
            ingestion_time,
            status,
            battery_voltage,
            battery_percent,
            wifi_dbm
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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

            # Skip if missing required fields
            if not sensor_id or not timestamp:
                print(f"WARN: Skipping reading with missing sensor_id or timestamp: {reading}")
                continue

            # Parse timestamp if it's a string
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

            # Current time for ingestion_time
            ingestion_time = datetime.utcnow()

            # Execute insert
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
                    wifi_dbm
                )
            )

            success_count += 1

        except Exception as e:
            print(f"ERROR: Failed to insert reading: {e}. Reading: {reading}")
            error_count += 1

    print(f"INFO: Cassandra write complete. Success: {success_count}, Errors: {error_count}")