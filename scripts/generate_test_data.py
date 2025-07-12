"""
generate_test_data.py

Generates a week's worth of per-minute light intensity data
and sends it to a sensor API.
The levels are based on a sine wave pattern to make an easily-recognizable
continuous pattern.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Apache 2.0 Licensed as described in the file LICENSE
"""

import math
import os
import random
import requests
from datetime import datetime, timedelta
from pytz import timezone

# Constants with environment variable fallback
SENSOR_ID = os.getenv('SENSOR_ID', 'test_sensor')
SENSOR_API_URL = os.getenv('SENSOR_API_URL', '')
BEARER_TOKEN = os.getenv('BEARER_TOKEN', 'xxx')

def generate_light_intensity(minute, phase_shift=0):
    """
    Generate light intensity based on sine wave with an optional phase shift.

    Args:
        minute (int): Minute of the day (0-1439)
        phase_shift (float): Phase shift in radians to offset the sine wave

    Returns:
        float: Light intensity between 10 and 10000
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
    max_intensity = bell_curve * (10000 - 10)  # Scale bell curve to max intensity
    light = sine_value * max_intensity + 10  # Add minimum intensity
    return light


def main():
    # Define CST timezone using pytz
    cst = timezone('America/Chicago')

    headers = {
        'Authorization': f'Bearer {BEARER_TOKEN}',
        'Content-Type': 'application/json'
    }

    # For 4 sensors, each with a phase shift of 0, π/2, π, and 3π/2
    # create a day's worth of data in a sine wave pattern (arbitrary continuous changing function)
    for day in range(7):
        start_time_cst = datetime.now(cst).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=7 - day)
        start_time_utc = start_time_cst.astimezone(timezone('UTC'))

        for sensor_number in range(4):
            sensor_id = SENSOR_ID + '_' + str(sensor_number)
            phase_shift = (sensor_number * math.pi) / 2

            records = []
            for minute in range(1440): # One day's worth of data
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
                print(f"Sent {len(records)} records for sensor {sensor_id} for day {day+1} -> Status {response.status_code}")
                if not response.ok:
                    print(f"Error response: {response.text}")
            except Exception as e:
                print(f"Failed to send data: {e}")


if __name__ == '__main__':
    main()