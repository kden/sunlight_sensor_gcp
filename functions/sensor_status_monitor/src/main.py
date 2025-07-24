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
import functions_framework


@functions_framework.cloud_event
def process_sensor_status(cloud_event):
    """
    Triggered by a message on a Pub/Sub topic.
    Parses the message and checks for a 'status' field. If found,
    it writes a structured log to Cloud Logging.
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

    # Iterate through each reading to find any with a 'status' key.
    for reading in payload:
        # Ensure the reading is a dictionary before processing
        if isinstance(reading, dict):
            sensor_id = reading.get("sensor_id", "Unknown Sensor")
            sensor_set_id = reading.get("sensor_set_id", "Unknown Sensor Set")

            # Check if this is a status alert or a regular data point (ping)
            if "status" in reading:
                status_message = reading["status"]
                # This is the structured log payload that will trigger our alert.
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
            else:
                # This is a regular data point, which we log as a "ping".
                ping_log_entry = {
                    "severity": "INFO",
                    "message": f"Data point received from {sensor_id}",
                    "sensor_id": sensor_id,
                    "sensor_set_id": sensor_set_id,
                    "log_name": "sensor_status_ping",
                    "data_payload": reading # Include the original data for context
                }
                print(json.dumps(ping_log_entry))
