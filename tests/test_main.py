# tests/test_main.py

import unittest
from unittest.mock import patch, MagicMock

# The 'src.main' import will happen after the mocks are set up by the test runner
from src import main


class MockRequest:
    def __init__(self, headers, json_data, content_type='application/json'):
        self.headers = headers
        self.json_data = json_data
        self.content_type = content_type

    def get_json(self, silent=False):
        if self.json_data is None and not silent:
            raise Exception("No JSON data")
        return self.json_data


class TestProxyToPubSub(unittest.TestCase):

    @patch('src.main.publisher', new_callable=MagicMock)
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
        # Configure the mock to return a specific string when topic_path() is called.
        mock_publisher.topic_path.return_value = 'projects/test-project/topics/test-topic'

        mock_future = MagicMock()
        mock_future.result.return_value = "mock-message-id-12345"
        mock_publisher.publish.return_value = mock_future

        # --- Prepare the mock request ---
        headers = {
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
        }
        payload = {'user': 'test-user', 'value': 42}
        request = MockRequest(headers=headers, json_data=payload)

        # --- Call the function ---
        response, status_code = main.proxy_to_pubsub(request)

        # --- Assertions ---
        self.assertEqual(status_code, 200)
        self.assertIn("mock-message-id-12345", response)

        # Verify that publisher.publish was called correctly
        mock_publisher.publish.assert_called_once()
        call_args = mock_publisher.publish.call_args
        self.assertEqual(call_args.args[0], 'projects/test-project/topics/test-topic')
        self.assertEqual(call_args.kwargs['data'], b'{"user": "test-user", "value": 42}')

    @patch.dict('os.environ', {
        'GCP_PROJECT': 'test-project',
        'TOPIC_ID': 'test-topic',
        'SECRET_BEARER_TOKEN': 'test-token-123',
    })
    def test_unauthorized_request(self):
        """
        Tests that a request with a bad token is rejected.
        """
        # --- Prepare the mock request ---
        headers = {'Authorization': 'Bearer wrong-token'}
        request = MockRequest(headers=headers, json_data={'user': 'test-user'})

        # --- Call the function ---
        response, status_code = main.proxy_to_pubsub(request)

        # --- Assertions ---
        self.assertEqual(status_code, 401)
        self.assertIn("Unauthorized", response)

