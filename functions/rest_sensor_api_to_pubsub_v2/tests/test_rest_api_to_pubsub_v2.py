"""
test_rest_api_to_pubsub_v2.py

Tests for the HTTP to Pub/Sub proxy Cloud Function v2.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""

import unittest
from unittest.mock import patch, MagicMock
import json

# Add the source directory to the Python path to allow for absolute imports
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from functions.rest_sensor_api_to_pubsub_v2.src.main import proxy_to_pubsub_v2

# Mock the Flask request object to simulate HTTP requests
class MockRequest:
    def __init__(self, headers=None, json_data=None, content_type='application/json'):
        self.headers = headers if headers is not None else {}
        self.json_data = json_data
        self.content_type = content_type

    def get_json(self, silent=False):
        if self.json_data is None and not silent:
            raise ValueError("No JSON data provided")
        return self.json_data

class TestProxyToPubSubV2(unittest.TestCase):
    @patch('functions.rest_sensor_api_to_pubsub_v2.src.main.publisher', new_callable=MagicMock)
    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_successful_publish(self, mock_publisher):
        """
        Tests the successful path where the token is valid and a message is published.
        """
        # --- Setup Mocking ---
        mock_publisher.topic_path.return_value = 'projects/test-project/topics/test-topic'

        mock_future = MagicMock()
        mock_future.result.return_value = "mock-message-id-12345"
        mock_publisher.publish.return_value = mock_future

        # --- Prepare the mock request ---
        headers = {
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
        }

        payload = [{'user': 'test-user', 'value': 42}]
        request = MockRequest(headers=headers, json_data=payload)

        # --- Call the v2 function ---
        response, status_code = proxy_to_pubsub_v2(request)

        # --- Assertions ---
        self.assertEqual(status_code, 200)
        self.assertIn("mock-message-id-12345", response)

        # Verify that publisher.publish was called correctly
        expected_data = json.dumps(payload).encode("utf-8")
        mock_publisher.publish.assert_called_once_with('projects/test-project/topics/test-topic', data=expected_data)

    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_unauthorized_access(self):
        """
        Tests that an invalid or missing bearer token results in a 401 Unauthorized error.
        """
        headers = {'Authorization': 'Bearer wrong-token'}
        request = MockRequest(headers=headers, json_data=[{'data': 'test'}])
        response, status_code = proxy_to_pubsub_v2(request)
        self.assertEqual(status_code, 401)
        self.assertIn("Unauthorized", response)

    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_missing_authorization_header(self):
        """
        Tests that a missing authorization header results in a 401 Unauthorized error.
        """
        headers = {}
        request = MockRequest(headers=headers, json_data=[{'data': 'test'}])
        response, status_code = proxy_to_pubsub_v2(request)
        self.assertEqual(status_code, 401)
        self.assertIn("Unauthorized", response)

    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_invalid_content_type(self):
        """
        Tests that non-JSON content type results in a 400 Bad Request error.
        """
        headers = {'Authorization': 'Bearer test-token-123'}
        request = MockRequest(headers=headers, json_data=[{'data': 'test'}], content_type='text/plain')
        response, status_code = proxy_to_pubsub_v2(request)
        self.assertEqual(status_code, 400)
        self.assertIn("Content-Type must be application/json", response)

    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_invalid_json_format(self):
        """
        Tests that invalid JSON data (not a list) results in a 400 Bad Request error.
        """
        headers = {
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
        }
        # JSON object instead of list
        request = MockRequest(headers=headers, json_data={'data': 'test'})
        response, status_code = proxy_to_pubsub_v2(request)
        self.assertEqual(status_code, 400)
        self.assertIn("JSON body must be a list", response)

    @patch('functions.rest_sensor_api_to_pubsub_v2.src.main.publisher', new_callable=MagicMock)
    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_pubsub_publish_failure(self, mock_publisher):
        """
        Tests that a Pub/Sub publish failure results in a 500 Internal Server Error.
        """
        # --- Setup Mocking for failure ---
        mock_publisher.topic_path.return_value = 'projects/test-project/topics/test-topic'
        mock_publisher.publish.side_effect = Exception("Pub/Sub connection failed")

        # --- Prepare the mock request ---
        headers = {
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
        }
        payload = [{'sensor_id': 'esp32_001', 'light_level': 150}]
        request = MockRequest(headers=headers, json_data=payload)

        # --- Call the v2 function ---
        response, status_code = proxy_to_pubsub_v2(request)

        # --- Assertions ---
        self.assertEqual(status_code, 500)
        self.assertIn("Internal Server Error", response)

    @patch.dict('os.environ', {
        'GCP_PROJECT': '',  # Missing project ID
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_missing_environment_variables(self):
        """
        Tests that missing environment variables result in a 500 Internal Server Error.
        """
        headers = {
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
        }
        request = MockRequest(headers=headers, json_data=[{'data': 'test'}])
        response, status_code = proxy_to_pubsub_v2(request)
        self.assertEqual(status_code, 500)
        self.assertIn("Service is not configured", response)

    @patch('functions.rest_sensor_api_to_pubsub_v2.src.main.publisher', new_callable=MagicMock)
    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_esp32_sensor_data_format(self, mock_publisher):
        """
        Tests the function with realistic ESP32-C3 sensor data format.
        """
        # --- Setup Mocking ---
        mock_publisher.topic_path.return_value = 'projects/test-project/topics/test-topic'

        mock_future = MagicMock()
        mock_future.result.return_value = "esp32-message-id-67890"
        mock_publisher.publish.return_value = mock_future

        # --- Prepare realistic ESP32 sensor payload ---
        headers = {
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
        }

        payload = [
            {
                'sensor_id': 'esp32_c3_001',
                'timestamp': '2025-01-15T10:30:00Z',
                'light_level': 245.5,
                'battery_voltage': 3.7,
                'wifi_rssi': -65
            }
        ]
        request = MockRequest(headers=headers, json_data=payload)

        # --- Call the v2 function ---
        response, status_code = proxy_to_pubsub_v2(request)

        # --- Assertions ---
        self.assertEqual(status_code, 200)
        self.assertIn("esp32-message-id-67890", response)

        # Verify the payload was correctly serialized and published
        expected_data = json.dumps(payload).encode("utf-8")
        mock_publisher.publish.assert_called_once_with('projects/test-project/topics/test-topic', data=expected_data)


if __name__ == '__main__':
    unittest.main()