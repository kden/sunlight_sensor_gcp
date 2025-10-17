"""
main.py

Cloud Function to fetch latest sensor readings from Datastax Astra Cassandra.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from Claude Sonnet 4.5 (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
import os
import json
from datetime import datetime
from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
from google.cloud import storage
import functions_framework
from flask import jsonify

# Global connection - initialized once and reused
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
        cluster = Cluster(cloud=cloud_config, auth_provider=auth_provider)
        cassandra_session = cluster.connect()
        print(f"INFO: Connected to Astra")
    except Exception as e:
        print(f"ERROR: Failed to connect to Cassandra: {e}")
        raise

    return cassandra_session


@functions_framework.http
def get_latest_readings(request):
    """
    HTTP Cloud Function to retrieve latest readings for sensors.
    Accepts optional sensor_set_id query parameter to filter results.
    """
    # Enable CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*'
    }

    try:
        # Get sensor_set_id from query parameters if provided
        sensor_set_id = request.args.get('sensor_set_id')

        session = get_cassandra_session()

        # Query for latest readings
        if sensor_set_id:
            query = f"""
                SELECT sensor_id, sensor_set_id, light_intensity, light_intensity_timestamp,
                       battery_voltage, battery_percent, battery_percent_timestamp,
                       wifi_dbm, wifi_dbm_timestamp, chip_temp_f, chip_temp_f_timestamp,
                       last_seen
                FROM {astra_keyspace}.sensor_latest_reading
                WHERE sensor_set_id = ?
                ALLOW FILTERING
            """
            rows = session.execute(query, (sensor_set_id,))
        else:
            query = f"""
                SELECT sensor_id, sensor_set_id, light_intensity, light_intensity_timestamp,
                       battery_voltage, battery_percent, battery_percent_timestamp,
                       wifi_dbm, wifi_dbm_timestamp, chip_temp_f, chip_temp_f_timestamp,
                       last_seen
                FROM {astra_keyspace}.sensor_latest_reading
            """
            rows = session.execute(query)

        # Convert rows to list of dicts
        results = []
        for row in rows:
            results.append({
                'sensor_id': row.sensor_id,
                'sensor_set_id': row.sensor_set_id,
                'light_intensity': row.light_intensity,
                'light_intensity_timestamp': row.light_intensity_timestamp.isoformat() if row.light_intensity_timestamp else None,
                'battery_voltage': row.battery_voltage,
                'battery_percent': row.battery_percent,
                'battery_percent_timestamp': row.battery_percent_timestamp.isoformat() if row.battery_percent_timestamp else None,
                'wifi_dbm': row.wifi_dbm,
                'wifi_dbm_timestamp': row.wifi_dbm_timestamp.isoformat() if row.wifi_dbm_timestamp else None,
                'chip_temp_f': row.chip_temp_f,
                'chip_temp_f_timestamp': row.chip_temp_f_timestamp.isoformat() if row.chip_temp_f_timestamp else None,
                'last_seen': row.last_seen.isoformat() if row.last_seen else None
            })

        return (jsonify(results), 200, headers)

    except Exception as e:
        print(f"ERROR: Failed to fetch latest readings: {e}")
        return (jsonify({'error': str(e)}), 500, headers)
