"""
test_export_sensors_to_firestore.py

Unit tests for the export_to_firestore function.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
import unittest
from unittest import mock
from datetime import datetime, timezone # Import timezone
import os

# Add the 'src' directory to the Python path to allow imports for local testing.
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from functions.bq_to_firestore_sensors.src.main import export_sensors_to_firestore


# A helper class to simulate the objects returned by the BigQuery client
class MockBigQueryRow:
    def __init__(self, data):
        self._data = data

    def __getattr__(self, name):
        return self._data.get(name)


class TestExportToFirestore(unittest.TestCase):

    @mock.patch("main.firestore.Client")
    @mock.patch("main.bigquery.Client")
    def test_export_with_new_data(self, mock_bigquery_client, mock_firestore_client):
        """Tests the main success path where new data is found and processed."""
        # --- Setup Mocks ---
        # Configure the mock client to have a 'project' attribute.
        mock_bigquery_client.return_value.project = "test-project"
        # Mock Firestore get() for metadata
        mock_metadata_doc = mock.Mock()
        mock_metadata_doc.exists = True
        mock_metadata_doc.to_dict.return_value = {"last_processed_timestamp_utc": "2025-07-07T12:00:00Z"}
        mock_firestore_client.return_value.collection.return_value.document.return_value.get.return_value = mock_metadata_doc

        # Mock BigQuery query() result
        mock_rows = [
            MockBigQueryRow({
                "sensor_id": "test_sensor_1",
                # FIXED: Use timezone-aware datetime objects for mocks
                "observation_minute": datetime(2025, 7, 7, 13, 0, 0, tzinfo=timezone.utc),
                "smoothed_light_intensity": 100.0,
                "sensor_set_id: "test"
            }),
            MockBigQueryRow({
                "sensor_id": "test_sensor_1",
                # FIXED: Use timezone-aware datetime objects for mocks
                "observation_minute": datetime(2025, 7, 7, 13, 1, 0, tzinfo=timezone.utc),
                "smoothed_light_intensity": 101.5,
                "sensor_set_id: "test"
            })
        ]

        # This setup correctly mocks the iterable result from query_job
        mock_bigquery_client.return_value.query.return_value = mock_rows

        # Mock Firestore batch
        mock_batch = mock.Mock()
        mock_firestore_client.return_value.batch.return_value = mock_batch

        # --- Call the function ---
        result = export_sensors_to_firestore(event={}, context={})

        # --- Assertions ---
        # Assert BigQuery was called correctly
        mock_bigquery_client.return_value.query.assert_called_once()
        # Check that the query uses the correct last-processed timestamp
        self.assertIn("WHERE\n            observation_minute > TIMESTAMP(\"2025-07-07T12:00:00Z\")",
                      mock_bigquery_client.return_value.query.call_args[0][0])

        # Assert Firestore batch writes happened for each row
        self.assertEqual(mock_batch.set.call_count, 2)
        mock_batch.commit.assert_called_once()

        # Assert metadata was updated with the latest timestamp from the processed rows
        mock_firestore_client.return_value.collection.return_value.document.return_value.set.assert_called_with({
            "last_processed_timestamp_utc": "2025-07-07T13:01:00Z",
            "rows_processed_in_last_run": 2
        })

        # Assert the function returns a success message
        self.assertEqual(result, "SUCCESS")