"""
main.py

Receives sensor data from Pub/Sub, checks for status messages,
sends direct notifications for status changes, and writes structured logs for pings.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
import os
import json
import base64
import collections
import smtplib
import urllib.request
import urllib.parse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import functions_framework


def send_pushover_notification(sensor_id, sensor_set_id, status_message):
    """
    Send a push notification via Pushover API.
    Free for up to 10,000 notifications per month.
    """
    pushover_token = os.environ.get('PUSHOVER_APP_TOKEN')
    pushover_user = os.environ.get('PUSHOVER_USER_KEY')

    if not pushover_token or not pushover_user:
        print("ERROR: Missing Pushover configuration (PUSHOVER_APP_TOKEN or PUSHOVER_USER_KEY)")
        return

    try:
        # Pushover API endpoint
        url = "https://api.pushover.net/1/messages.json"

        # Create the message data
        data = {
            'token': pushover_token,
            'user': pushover_user,
            'title': f'Sensor {sensor_id}',
            'message': f'{status_message}\n\nSensor Set: {sensor_set_id}',
            'priority': 0,  # Normal priority
            'sound': 'pushover'  # Default notification sound
        }

        # Encode data for POST request
        encoded_data = urllib.parse.urlencode(data).encode('utf-8')

        # Create and send request
        req = urllib.request.Request(url, data=encoded_data)
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')

        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))

        if result.get('status') == 1:
            print(f"INFO: Pushover notification sent successfully for sensor {sensor_id}")
        else:
            print(f"ERROR: Pushover API returned error: {result}")

    except Exception as e:
        print(f"ERROR: Failed to send Pushover notification: {e}")


def send_status_notification(sensor_id, sensor_set_id, status_message):
    """
    Send email and Pushover notifications for status messages using free tier services.
    Uses Gmail SMTP for email and Pushover API for push notifications.
    """
    email_address = os.environ.get('ALERT_EMAIL_ADDRESS')
    gmail_user = os.environ.get('GMAIL_USER')  # Your Gmail address
    gmail_app_password = os.environ.get('GMAIL_APP_PASSWORD')  # Gmail app password

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


@functions_framework.cloud_event
def process_sensor_status(cloud_event):
    """
    Triggered by a message on a Pub/Sub topic. Parses the message,
    sends direct notifications for status alerts, and logs regular data points (pings)
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

    # Process each status alert - send direct notifications instead of log alerts
    for reading in status_readings:
        sensor_id = reading.get("sensor_id", "Unknown Sensor")
        sensor_set_id = reading.get("sensor_set_id", "Unknown Sensor Set")
        status_message = reading["status"]

        # Send direct notification (no incident created)
        send_status_notification(sensor_id, sensor_set_id, status_message)

        # Still log for debugging/audit purposes, but don't trigger alerts
        info_log_entry = {
            "severity": "INFO",  # Changed from ALERT to INFO
            "message": f"Status notification sent for {sensor_id}: {status_message}",
            "sensor_id": sensor_id,
            "sensor_set_id": sensor_set_id,
            "status": status_message,
            "log_name": "sensor_status_notification_sent",  # Different log name
            "data_payload": reading
        }
        print(json.dumps(info_log_entry))

    # Group pings by sensor_set and sensor_id to aggregate them (unchanged)
    pings_by_sensor = collections.defaultdict(list)
    for reading in ping_readings:
        sensor_id = reading.get("sensor_id", "Unknown Sensor")
        sensor_set_id = reading.get("sensor_set_id", "Unknown Sensor Set")
        pings_by_sensor[(sensor_set_id, sensor_id)].append(reading)

    # Log a single summary message for each group of pings (unchanged)
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