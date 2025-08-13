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
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import functions_framework


def send_status_notification(sensor_id, sensor_set_id, status_message):
    """
    Send email and SMS notifications for status messages using free tier services.
    Uses Gmail SMTP for email and email-to-SMS gateway for SMS.
    """
    email_address = os.environ.get('ALERT_EMAIL_ADDRESS')
    phone_number = os.environ.get('ALERT_PHONE_NUMBER')
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

    # SMS notification using email-to-SMS gateway
    if phone_number:
        try:
            # Detect carrier and use appropriate SMS gateway
            # You'll need to set CARRIER environment variable or detect it
            carrier = os.environ.get('CARRIER', 'verizon').lower()

            # Common email-to-SMS gateways (all free)
            sms_gateways = {
                'verizon': 'vtext.com',
                'att': 'txt.att.net',
                'tmobile': 'tmomail.net',
                'sprint': 'messaging.sprintpcs.com',
                'cricket': 'sms.cricketwireless.net',
                'boost': 'smsmyboostmobile.com',
                'metro': 'mymetropcs.com'
            }

            gateway = sms_gateways.get(carrier)
            if not gateway:
                print(f"WARN: Unknown carrier {carrier}, using Verizon gateway")
                gateway = 'vtext.com'

            # Clean phone number (remove non-digits)
            clean_phone = ''.join(filter(str.isdigit, phone_number))
            sms_email = f"{clean_phone}@{gateway}"

            # Create SMS message (keep it short due to SMS limits)
            sms_msg = MIMEText(f"Sensor {sensor_id}: {status_message}")
            sms_msg['From'] = gmail_user
            sms_msg['To'] = sms_email
            sms_msg['Subject'] = ""  # Some carriers ignore subject for SMS

            # Send SMS via email gateway
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(gmail_user, gmail_app_password)
            server.send_message(sms_msg)
            server.quit()

            print(f"INFO: SMS notification sent to {clean_phone} via {gateway}")

        except Exception as e:
            print(f"ERROR: Failed to send SMS notification: {e}")


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