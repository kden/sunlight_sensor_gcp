"""
test_process_sensor_status.py

Tests for the HTTP to Pub/Sub proxy Cloud Function.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""

import unittest
from unittest.mock import patch, MagicMock
import json

# Add the source directory to the Python path to allow for absolute imports
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from functions.sensor_status_monitor.src.main import forward_status_message

# TODO Unit Tests
