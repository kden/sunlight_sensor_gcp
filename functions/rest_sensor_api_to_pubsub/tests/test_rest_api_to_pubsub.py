"""
test_rest_api_to_pubsub.py

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

from functions.rest_sensor_api_to_pubsub.src.main import proxy_to_pubsub

# Mock the Flask request object to simulate HTTP requests
class MockRequest:
    def __init__(self, headers=None, json_data=None, content_type='application/json'):
        self.headers = headers if headers is not None else {}
        self.json_data = json_data
        self.content_type = content_type
        # Store the raw body as JSON string for get_data() method
        self._raw_body = json.dumps(json_data) if json_data is not None else ""

    def get_json(self, silent=False):
        if self.json_data is None and not silent:
            raise ValueError("No JSON data provided")
        return self.json_data

    def get_data(self, as_text=False):
        """Mock the get_data method that returns raw request body"""
        if as_text:
            return self._raw_body
        return self._raw_body.encode('utf-8')

class TestProxyToPubSub(unittest.TestCase):
    @patch('functions.rest_sensor_api_to_pubsub.src.main.publisher', new_callable=MagicMock)
    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_successful_publish_array(self, mock_publisher):
        """
        Tests the successful path where the token is valid and an array message is published.
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

        # --- Call the function ---
        response, status_code = proxy_to_pubsub(request)

        # --- Assertions ---
        self.assertEqual(status_code, 200)
        self.assertIn("mock-message-id-12345", response)

        # Verify that publisher.publish was called correctly
        expected_data = json.dumps(payload).encode("utf-8")
        mock_publisher.publish.assert_called_once_with('projects/test-project/topics/test-topic', data=expected_data)

    @patch('functions.rest_sensor_api_to_pubsub.src.main.publisher', new_callable=MagicMock)
    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_successful_publish_single_object(self, mock_publisher):
        """
        Tests the successful path where a single object is converted to an array and published.
        """
        # --- Setup Mocking ---
        mock_publisher.topic_path.return_value = 'projects/test-project/topics/test-topic'

        mock_future = MagicMock()
        mock_future.result.return_value = "mock-message-id-67890"
        mock_publisher.publish.return_value = mock_future

        # --- Prepare the mock request with single object ---
        headers = {
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
        }

        # Single status object (like crash reports)
        payload = {
            'sensor_id': 'sensor_1',
            'timestamp': '2025-09-17T12:30:00Z',
            'sensor_set_id': 'backyard',
            'status': '[boot] MANUAL RESET: External pin\nPrevious session logs:\n12:29:30 I SENSOR_TASK: Reading saved'
        }
        request = MockRequest(headers=headers, json_data=payload)

        # --- Call the function ---
        response, status_code = proxy_to_pubsub(request)

        # --- Assertions ---
        self.assertEqual(status_code, 200)
        self.assertIn("mock-message-id-67890", response)

        # Verify that publisher.publish was called with the object wrapped in an array
        expected_data = json.dumps([payload]).encode("utf-8")
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
        response, status_code = proxy_to_pubsub(request)
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
        request = MockRequest(headers=headers, json_data={'data': 'test'}, content_type='text/plain')
        response, status_code = proxy_to_pubsub(request)
        self.assertEqual(status_code, 400)
        self.assertIn("Content-Type must be application/json", response)

    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_empty_array(self):
        """
        Tests that an empty array results in a 400 Bad Request error.
        """
        headers = {
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
        }
        request = MockRequest(headers=headers, json_data=[])
        response, status_code = proxy_to_pubsub(request)
        self.assertEqual(status_code, 400)
        self.assertIn("Empty array not allowed", response)

    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_invalid_json_type(self):
        """
        Tests that non-object/array JSON results in a 400 Bad Request error.
        """
        headers = {
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
        }
        request = MockRequest(headers=headers, json_data="invalid_string")
        response, status_code = proxy_to_pubsub(request)
        self.assertEqual(status_code, 400)
        self.assertIn("JSON body must be a list of sensor readings or a single object", response)


if __name__ == '__main__':
    unittest.main()