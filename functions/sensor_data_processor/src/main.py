"""
main.py

Receives sensor data from Pub/Sub, writes to Cassandra, and sends status notifications.
Combines functionality of pubsub_to_cassandra and sensor_status_monitor.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from Claude Sonnet 4.5 (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
#  main.py
#
#  Source code description.
#
#  Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
#  Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
#  Apache 2.0 Licensed as described in the file LICENSE

import os
import json
import base64
import collections
import smtplib
import urllib.request
import urllib.parse
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
from cassandra import ConsistencyLevel
from google.cloud import storage
import functions_framework

# Global connection - initialized once and reused across function invocations
cassandra_session = None
astra_keyspace = None

# Enable/disable Pushover notifications
ENABLE_PUSHOVER = True


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
        prepared = session.prepare(update_query)
        session.execute(prepared, tuple(values))
    except Exception as e:
        print(f"ERROR: Failed to update latest reading for {sensor_id}: {e}")
        print(f"DEBUG: Query: {update_query}")
        print(f"DEBUG: Number of placeholders: {update_query.count('?')}")
        print(f"DEBUG: Number of values: {len(values)}")
        print(f"DEBUG: Values: {values}")


def send_pushover_notification(sensor_id, sensor_set_id, status_message, use_battery_token=False, battery_data=None):
    """
    Send a Pushover notification with enhanced battery data if applicable.
    """
    # Check global flag
    if not ENABLE_PUSHOVER:
        print("INFO: Pushover notifications disabled via ENABLE_PUSHOVER flag")
        return

    # Determine which token to use
    if use_battery_token:
        token = os.environ.get('PUSHOVER_BATTERY_APP_TOKEN')
        if not token:
            print("WARN: PUSHOVER_BATTERY_APP_TOKEN not configured, falling back to general token")
            token = os.environ.get('PUSHOVER_APP_TOKEN')
    else:
        token = os.environ.get('PUSHOVER_APP_TOKEN')

    pushover_user = os.environ.get('PUSHOVER_USER_KEY')

    if not all([token, pushover_user]):
        print("WARN: Pushover not configured, skipping notification")
        return

    try:
        url = "https://api.pushover.net/1/messages.json"

        # Build message based on type
        if use_battery_token and battery_data:
            voltage = battery_data.get('battery_voltage', 'N/A')
            percentage = battery_data.get('battery_percent', 'N/A')
            wifi_dbm = battery_data.get('wifi_dbm', 'N/A')
            pushover_sound = 'intermission'

            title = f'Battery {sensor_id}: {percentage}% ({voltage}V)'
            message = f'Sensor: {sensor_id}\nBattery: {voltage}V ({percentage}%)\nWiFi: {wifi_dbm}dBm\nSensor Set: {sensor_set_id}'
        else:
            title = f'Sensor {sensor_id}'
            message = f'{status_message}\n\nSensor Set: {sensor_set_id}'
            pushover_sound = 'pushover'

        # Create the message data
        data = {
            'token': token,
            'user': pushover_user,
            'title': title,
            'message': message,
            'priority': 0,
            'sound': pushover_sound
        }

        # Encode data for POST request
        encoded_data = urllib.parse.urlencode(data).encode('utf-8')

        # Create and send request
        req = urllib.request.Request(url, data=encoded_data)
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')

        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))

        if result.get('status') == 1:
            app_type = "battery" if use_battery_token else "general"
            print(f"INFO: Pushover {app_type} notification sent successfully for sensor {sensor_id}")
        else:
            print(f"ERROR: Pushover API returned error: {result}")

    except Exception as e:
        print(f"ERROR: Failed to send Pushover notification: {e}")


def send_status_notification(sensor_id, sensor_set_id, status_message):
    """
    Send email and Pushover notifications for status messages.
    Uses Gmail SMTP for email and Pushover API for push notifications.
    """
    email_address = os.environ.get('ALERT_EMAIL_ADDRESS')
    gmail_user = os.environ.get('GMAIL_USER')
    gmail_app_password = os.environ.get('GMAIL_APP_PASSWORD')

    if not all([email_address, gmail_user, gmail_app_password]):
        print("ERROR: Missing email configuration environment variables")
        return

    # Email notification
    try:
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = email_address
        msg['Subject'] = f"ℹ️ Sensor Status: {sensor_id} - {status_message}"

        body = f"""
Sensor Status Update

Sensor: {sensor_id}
Sensor Set: {sensor_set_id}
Status: {status_message}

This is informational only - no action required.
        """

        msg.attach(MIMEText(body, 'plain'))

        # Connect to Gmail SMTP
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(gmail_user, gmail_app_password)

        # Send email
        server.send_message(msg)
        server.quit()

        print(f"INFO: Email notification sent for sensor {sensor_id}")

    except Exception as e:
        print(f"ERROR: Failed to send email notification: {e}")

    # Pushover notification
    send_pushover_notification(sensor_id, sensor_set_id, status_message)


def process_status_messages(payload):
    """
    Process status messages and send notifications.
    Separated from Cassandra writes so write failures don't block notifications.
    """
    # Separate status alerts from regular pings
    status_readings = []
    ping_readings = []

    for reading in payload:
        if isinstance(reading, dict):
            if "status" in reading:
                status_readings.append(reading)
            else:
                ping_readings.append(reading)

    # Process each status alert
    for reading in status_readings:
        sensor_id = reading.get("sensor_id", "Unknown Sensor")
        sensor_set_id = reading.get("sensor_set_id", "Unknown Sensor Set")
        status_message = reading["status"]

        log_message = ""
        log_name = ""

        # Check if this is a battery status message
        if status_message == "battery" or status_message.startswith("[boot] battery") or status_message.startswith(
                "[wake] battery"):
            send_pushover_notification(
                sensor_id,
                sensor_set_id,
                status_message,
                use_battery_token=True,
                battery_data=reading
            )
            log_message = f"Battery-specific Pushover notification sent for {sensor_id}: V={reading.get('battery_voltage', 'N/A')} %={reading.get('battery_percent', 'N/A')} WiFi={reading.get('wifi_dbm', 'N/A')}dBm"
            log_name = "sensor_status_battery_notification_sent"
        elif status_message.startswith("[boot]"):
            send_status_notification(sensor_id, sensor_set_id, status_message)
            log_message = f"Boot status notification sent for {sensor_id}: {status_message}"
            log_name = "sensor_status_boot_notification_sent"
        else:
            log_message = f"Non-boot status message skipped for {sensor_id}: {status_message}"
            log_name = "sensor_status_message_skipped"

        # Log the action taken
        info_log_entry = {
            "severity": "INFO",
            "message": log_message,
            "sensor_id": sensor_id,
            "sensor_set_id": sensor_set_id,
            "status": status_message,
            "log_name": log_name,
            "data_payload": reading
        }
        print(json.dumps(info_log_entry))

    # Group pings by sensor_set and sensor_id for summary logging
    pings_by_sensor = collections.defaultdict(list)
    for reading in ping_readings:
        sensor_id = reading.get("sensor_id", "Unknown Sensor")
        sensor_set_id = reading.get("sensor_set_id", "Unknown Sensor Set")
        pings_by_sensor[(sensor_set_id, sensor_id)].append(reading)

    # Log a single summary message for each group of pings
    for (sensor_set_id, sensor_id), readings in pings_by_sensor.items():
        num_points = len(readings)
        ping_log_entry = {
            "severity": "INFO",
            "message": f"{num_points} data points received from {sensor_id}",
            "sensor_id": sensor_id,
            "sensor_set_id": sensor_set_id,
            "log_name": "sensor_status_ping",
            "data_point_count": num_points,
            "data_payload": readings
        }
        print(json.dumps(ping_log_entry))


def write_to_cassandra(session, payload):
    """
    Write sensor readings to Cassandra raw_sensor_data and sensor_latest_reading tables.
    Returns tuple of (success_count, error_count).
    """
    # Prepare the insert statement for raw data
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
    return success_count, error_count


@functions_framework.cloud_event
def process_sensor_data(cloud_event):
    """
    Triggered by Pub/Sub message. Writes sensor readings to Cassandra
    and processes status notifications. Combines functionality of
    pubsub_to_cassandra and sensor_status_monitor.
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

    # === PHASE 1: Write to Cassandra ===
    try:
        session = get_cassandra_session()
        write_to_cassandra(session, payload)
    except Exception as e:
        print(f"ERROR: Cassandra write failed: {e}")

    # === PHASE 2: Process Status Messages ===
    # This runs independently of Cassandra writes
    try:
        process_status_messages(payload)
    except Exception as e:
        print(f"ERROR: Failed to process status messages: {e}")