"""
main.py

Receives sensor data from Pub/Sub, checks for status messages,
and writes a structured log to trigger a GCP alert.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
import os
import json
import base64
import collections
import functions_framework


@functions_framework.cloud_event
def process_sensor_status(cloud_event):
    """
    Triggered by a message on a Pub/Sub topic. Parses the message,
    logs status alerts individually, and aggregates regular data points (pings)
    into a summary log to reduce noise.
    """
    # The message data is base64-encoded in the CloudEvent payload.
    try:
        b64_data = cloud_event.data["message"]["data"]
        decoded_data = base64.b64decode(b64_data).decode("utf-8")
        payload = json.loads(decoded_data)
    except (KeyError, TypeError, json.JSONDecodeError) as e:
        print(f"ERROR: Could not decode or parse Pub/Sub message. Error: {e}")
        return

    # The payload is expected to be a list of sensor readings.
    if not isinstance(payload, list):
        print(f"WARN: Received non-list payload, skipping. Payload: {payload}")
        return

    # Separate status alerts from regular pings
    status_readings = []
    ping_readings = []
    for reading in payload:
        if isinstance(reading, dict):
            if "status" in reading:
                status_readings.append(reading)
            else:
                ping_readings.append(reading)

    # Process and log each status alert individually
    for reading in status_readings:
        sensor_id = reading.get("sensor_id", "Unknown Sensor")
        sensor_set_id = reading.get("sensor_set_id", "Unknown Sensor Set")
        status_message = reading["status"]
        alert_log_entry = {
            "severity": "ALERT",
            "message": f"Status update from {sensor_id}: {status_message}",
            "sensor_id": sensor_id,
            "sensor_set_id": sensor_set_id,
            "status": status_message,
            "log_name": "sensor_status_alert",
            "data_payload": reading  # Include the original data for context
        }
        print(json.dumps(alert_log_entry))

    # Group pings by sensor_set and sensor_id to aggregate them
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
            "data_payload": readings  # Include all original data points for context
        }
        print(json.dumps(ping_log_entry))
