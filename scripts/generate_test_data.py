"""
generate_test_data.py

Generates a day's worth of per-minute light intensity data
and sends it to a sensor API.
The levels are based on a sine wave pattern to make an easily-recognizable
continuous pattern.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Apache 2.0 Licensed as described in the file LICENSE

Developed with ChatGPT-4o, using this prompt (for the initial code generation):

    Write a simple Python program to generate test data that does the following:

    Set two constants, SENSOR_ID and SENSOR_API_URL which will be initially set to "test_sensor" and "https://sensors.example.com"
    Set one more constant, BEARER_TOKEN with the initial value xxx
    Each of these should be read from environment variables but fall back to these default values.
    Starting with the first second of yesterday's date for the timestamp, create a JSON record that looks like the following:

    {
            "light_intensity":      28.333333969116211,
            "sensor_id":    SENSOR_ID,
            "timestamp":    "2025-07-01T15:35:07Z"
    }

    Note that the timestamp meets the ISO-8601 standard.

    Create one day's worth of JSON records, where the light intensity varies between 10 and 10000 in a sine wave pattern and the period of the pattern is 2 hours.
    One record should be created for each minute in the day.
    After each record is created, send it via POST to the url in SENSOR_API_URL with BEARER_TOKEN passed in an Authentication Bearer header.
    Wait one half second between sends.  There should be 1440 sends in total.
"""

import math
import os
import random
import requests
from datetime import datetime, timedelta, timezone


# Constants with environment variable fallback
SENSOR_ID = os.getenv('SENSOR_ID', 'test_sensor')
SENSOR_API_URL = os.getenv('SENSOR_API_URL', 'https://sensors.example.com')
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
    period_minutes = 120  # 2 hours
    radians = (2 * math.pi * minute) / period_minutes + phase_shift
    sine_value = (math.sin(radians) + 1) / 2  # Normalize sine to [0,1]
    light = sine_value * (10000 - 10) + 10
    return light


def main():
    # Start timestamp: first second of yesterday in UTC
    start_time = datetime.now(timezone.utc).replace(hour=0, minute=0, second=1, microsecond=0) - timedelta(days=1)

    headers = {
        'Authorization': f'Bearer {BEARER_TOKEN}',
        'Content-Type': 'application/json'
    }

    # For 4 sensors, each with a phase shift of 0, π/2, π, and 3π/2
    # create a day's worth of data in a sine wave pattern (arbitrary continuous changing function)
    # Introduce some randomness to the minute intervals to simulate real-world delays and uncertainty
    for sensor_number in range(4):
        sensor_id = SENSOR_ID + str(sensor_number)
        phase_shift = (sensor_number * math.pi) / 2
        for minute in range(1440):
            # Add randomness to the interval (up to ±5 seconds)
            random_offset = random.randint(-5, 5)
            timestamp = start_time + timedelta(minutes=minute, seconds=random_offset)
            iso_timestamp = timestamp.isoformat().replace('+00:00', 'Z')

            light_intensity = generate_light_intensity(minute, phase_shift)

            data = {
                "light_intensity": light_intensity,
                "sensor_id": sensor_id,
                "timestamp": iso_timestamp
            }

            try:
                response = requests.post(SENSOR_API_URL, headers=headers, json=data)
                print(f"Sent {data} -> Status {response.status_code}")
                if not response.ok:
                    print(f"Error response: {response.text}")
            except Exception as e:
                print(f"Failed to send data: {e}")

            # time.sleep(0.5)  # wait half a second


if __name__ == '__main__':
    main()