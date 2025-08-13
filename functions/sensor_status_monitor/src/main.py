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
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import functions_framework


# Global storage for pending status messages (keyed by sensor_id)
pending_status_messages = {}

class PendingStatusGroup:
    def __init__(self, sensor_id, sensor_set_id):
        self.sensor_id = sensor_id
        self.sensor_set_id = sensor_set_id
        self.crash_message = None
        self.wifi_message = None
        self.ntp_message = None
        self.creation_time = time.time()  # For timeout purposes

    def add_message(self, status_message):
        """Add a status message and return True if we should send the group"""
        if "CRASH detected" in status_message:
            self.crash_message = status_message
            return False  # Wait for more messages
        elif "wifi connected" in status_message:
            if self.crash_message:  # Only group if we have a crash
                self.wifi_message = status_message
                return False  # Wait for NTP
            else:
                return True  # Send immediately if no crash context
        elif "ntp set" in status_message:
            if self.crash_message and self.wifi_message:  # Complete group
                self.ntp_message = status_message
                return True  # Send the complete group
            elif self.crash_message:  # Just crash + ntp
                self.ntp_message = status_message
                return True  # Send crash + ntp
            else:
                return True  # Send immediately if no crash context
        else:
            return True  # Unknown message type, send immediately

    def is_expired(self, timeout_seconds=300):  # 5 minutes
        """Check if this group has been waiting too long"""
        return time.time() - self.creation_time > timeout_seconds

    def create_grouped_message(self):
        """Create a single message from all collected status updates"""
        messages = []
        title_parts = []

        if self.crash_message:
            messages.append(f"🚨 CRASH: {self.crash_message}")
            # Extract crash cause for title
            if "(" in self.crash_message:
                crash_cause = self.crash_message.split("(")[1].split(")")[0]
                title_parts.append(f"Crash: {crash_cause}")

        if self.wifi_message:
            messages.append(f"📶 WIFI: {self.wifi_message}")
            # Extract AP name for title
            if "connected to" in self.wifi_message:
                ap_name = self.wifi_message.split("connected to")[1].strip().strip("()")
                title_parts.append(f"WiFi: {ap_name}")

        if self.ntp_message:
            # Extract the timestamp part after "ntp set" if it exists
            if "ntp set " in self.ntp_message:
                parts = self.ntp_message.split("ntp set ", 1)
                if len(parts) > 1 and parts[1].strip():
                    # New firmware with timestamp
                    ntp_time_part = parts[1]
                    messages.append(f"🕐 NTP: ntp set {ntp_time_part}")

                    # Extract just the Chicago time for the title (the part after the slash)
                    if "/" in ntp_time_part and "(America/Chicago)" in ntp_time_part:
                        try:
                            # Look for pattern like "/ 8:30:45 (America/Chicago)"
                            chicago_part = ntp_time_part.split("/")[1].strip()
                            if chicago_part.startswith(" "):
                                chicago_part = chicago_part[1:]  # Remove leading space
                            chicago_time = chicago_part.split(" (America/Chicago)")[0]
                            title_parts.append(f"Time: {chicago_time}")
                        except:
                            # If parsing fails, don't add time to title
                            pass
                else:
                    # Old firmware - just "ntp set"
                    messages.append(f"🕐 NTP: {self.ntp_message}")
            else:
                # Fallback if message doesn't contain "ntp set " at all
                messages.append(f"🕐 NTP: {self.ntp_message}")

        # Create title
        if title_parts:
            title = f"{self.sensor_id} - {' | '.join(title_parts)}"
        else:
            title = f"{self.sensor_id} - Status Update"

        # Create message body
        body = f"""
Sensor Status Update Group

Sensor: {self.sensor_id}
Sensor Set: {self.sensor_set_id}

Status Updates:
{chr(10).join(messages)}

This appears to be a sensor restart sequence.
        """

        return title, body.strip()


def send_pushover_notification(title, message):
    """
    Send a push notification via Pushover API.
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
            'title': title,
            'message': message,
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
            print(f"INFO: Pushover notification sent successfully: {title}")
        else:
            print(f"ERROR: Pushover API returned error: {result}")

    except Exception as e:
        print(f"ERROR: Failed to send Pushover notification: {e}")


def send_email_notification(title, message):
    """
    Send email notification via Gmail SMTP.
    """
    email_address = os.environ.get('ALERT_EMAIL_ADDRESS')
    gmail_user = os.environ.get('GMAIL_USER')
    gmail_app_password = os.environ.get('GMAIL_APP_PASSWORD')

    if not all([email_address, gmail_user, gmail_app_password]):
        print("ERROR: Missing email configuration environment variables")
        return

    try:
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = email_address
        msg['Subject'] = f"ℹ️ {title}"

        msg.attach(MIMEText(message, 'plain'))

        # Connect to Gmail SMTP
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(gmail_user, gmail_app_password)

        # Send email
        server.send_message(msg)
        server.quit()

        print(f"INFO: Email notification sent: {title}")

    except Exception as e:
        print(f"ERROR: Failed to send email notification: {e}")


def process_status_message(sensor_id, sensor_set_id, status_message):
    """
    Process a status message, potentially grouping it with others.
    Returns True if a notification was sent.
    """
    global pending_status_messages

    # Clean up expired pending messages first
    current_time = time.time()
    expired_sensors = [
        sid for sid, group in pending_status_messages.items()
        if group.is_expired()
    ]

    for expired_sensor in expired_sensors:
        print(f"INFO: Sending expired status group for {expired_sensor}")
        group = pending_status_messages.pop(expired_sensor)
        title, body = group.create_grouped_message()
        send_email_notification(title, body)
        send_pushover_notification(title, body)

    # Check if this message should be grouped
    should_group = ("CRASH detected" in status_message or
                   "wifi connected" in status_message or
                   "ntp set" in status_message)

    if not should_group:
        # Send immediately for non-groupable messages
        title = f"{sensor_id} - {status_message}"
        body = f"""
Sensor Status Update

Sensor: {sensor_id}
Sensor Set: {sensor_set_id}
Status: {status_message}

This is informational only - no action required.
        """
        send_email_notification(title, body)
        send_pushover_notification(title, body)
        return True

    # Handle groupable messages
    if sensor_id not in pending_status_messages:
        pending_status_messages[sensor_id] = PendingStatusGroup(sensor_id, sensor_set_id)

    group = pending_status_messages[sensor_id]
    should_send = group.add_message(status_message)

    if should_send:
        # Send the grouped message
        title, body = group.create_grouped_message()
        send_email_notification(title, body)
        send_pushover_notification(title, body)

        # Remove from pending
        del pending_status_messages[sensor_id]
        return True
    else:
        print(f"INFO: Status message queued for grouping: {sensor_id} - {status_message}")
        return False


def send_status_notification(sensor_id, sensor_set_id, status_message):
    """
    Send email and Pushover notifications for status messages using free tier services.
    Uses intelligent grouping for related status messages.
    """
    process_status_message(sensor_id, sensor_set_id, status_message)


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

    # Log a single summary message for each group of pings
    for (sensor_set_id, sensor_id), readings in pings_by_sensor.items():
        num_points = len(readings)

        # Log the regular ping summary (for absence detection)
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

        # Create multiple log entries for the data point metric
        # Each log entry represents one data point for proper counting
        for i in range(num_points):
            data_point_metric_entry = {
                "severity": "INFO",
                "message": f"Data point {i+1}/{num_points} from {sensor_id}",
                "sensor_id": sensor_id,
                "sensor_set_id": sensor_set_id,
                "log_name": "sensor_data_point_metric",
                "point_index": i + 1,
                "total_points": num_points
            }
            print(json.dumps(data_point_metric_entry))