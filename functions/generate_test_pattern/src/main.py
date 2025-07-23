"""
main.py for generate_test_pattern Cloud Function

Generates a day's worth of per-minute light intensity data
and sends it to a sensor API. This is designed to be run as an
HTTP-triggered Google Cloud Function, invoked daily by Cloud Scheduler.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Apache 2.0 Licensed as described in the file LICENSE
"""

import math
import os
import random
import requests
from datetime import datetime, timedelta
from pytz import timezone

# Constants from environment variables, set in Terraform
SENSOR_ID = os.getenv('SENSOR_ID', 'test_sensor')
SENSOR_API_URL = os.getenv('SENSOR_API_URL')
BEARER_TOKEN = os.getenv('BEARER_TOKEN')
MAX_LUX = 10000

def generate_light_intensity(minute, phase_shift=0):
    """
    Generate light intensity based on a sine wave and bell curve.
    """
    # Sine wave component
    period_minutes = 120  # 2 hours
    radians = (2 * math.pi * minute) / period_minutes + phase_shift
    sine_value = (math.sin(radians) + 1) / 2  # Normalize sine to [0,1]

    # Bell curve (Gaussian) component
    peak_minute = 720  # Midday
    std_dev = 300  # Controls the width of the bell curve
    bell_curve = math.exp(-((minute - peak_minute) ** 2) / (2 * std_dev ** 2))

    # Combine sine wave and bell curve
    max_intensity = bell_curve * (MAX_LUX - 10)
    light = sine_value * max_intensity + 10
    return light

def generate_and_send_data(request):
    """
    HTTP-triggered Cloud Function entry point.
    Generates and sends one day of test data for the current day.
    """
    if not SENSOR_API_URL or not BEARER_TOKEN:
        error_msg = "Error: SENSOR_API_URL and BEARER_TOKEN environment variables must be set."
        print(error_msg)
        return error_msg, 500

    cst = timezone('America/Chicago')
    headers = {
        'Authorization': f'Bearer {BEARER_TOKEN}',
        'Content-Type': 'application/json'
    }

    # Generate data for the current day, starting at midnight CST
    start_time_cst = datetime.now(cst).replace(hour=0, minute=0, second=0, microsecond=0)
    start_time_utc = start_time_cst.astimezone(timezone('UTC'))

    print(f"Generating data for date: {start_time_cst.date()}")

    for sensor_number in range(4):
        sensor_id = f"{SENSOR_ID}_{sensor_number}"
        phase_shift = (sensor_number * math.pi) / 2

        records = []
        for minute in range(1440):  # 1440 minutes in a day
            random_offset = random.randint(-5, 5)
            timestamp = start_time_utc + timedelta(minutes=minute, seconds=random_offset)
            iso_timestamp = timestamp.isoformat().replace('+00:00', 'Z')
            light_intensity = generate_light_intensity(minute, phase_shift)

            record = {
                "light_intensity": light_intensity,
                "sensor_id": sensor_id,
                "timestamp": iso_timestamp,
                "sensor_set_id": "test"
            }
            records.append(record)

        try:
            response = requests.post(SENSOR_API_URL, headers=headers, json=records)
            print(f"Sent {len(records)} records for sensor {sensor_id} -> Status {response.status_code}")
            if not response.ok:
                print(f"Error response: {response.text}")
        except Exception as e:
            print(f"Failed to send data for sensor {sensor_id}: {e}")

    return "Successfully generated and sent data.", 200
