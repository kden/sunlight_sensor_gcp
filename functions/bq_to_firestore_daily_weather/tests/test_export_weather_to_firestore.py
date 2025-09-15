"""
test_export_weather_to_firestore.py

Unit tests for the export_weather_to_firestore function.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""

import unittest
from unittest import mock
from datetime import date, datetime, timezone
import os
import sys
import json

# Add the 'src' directory to the Python path to allow imports for local testing.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

# Now we can import the function to be tested directly.
from functions.bq_to_firestore_daily_weather.src.main import export_weather_to_firestore, DAILY_METADATA_DOC_ID, DAILY_DESTINATION_COLLECTION


# A helper class to simulate the row objects returned by the BigQuery client
class MockBigQueryRow:
    def __init__(self, data):
        self._data = data

    def get(self, key, default=None):
        return self._data.get(key, default)

    def items(self):
        return self._data.items()


class TestExportWeatherToFirestore(unittest.TestCase):

    @mock.patch("main.firestore.Client")
    @mock.patch("main.bigquery.Client")
    def test_export_with_new_data(self, mock_bigquery_client, mock_firestore_client):
        """Tests the main success path where new data is found and processed correctly."""
        # --- Setup Mocks ---
        mock_bigquery_client.return_value.project = "test-project"

        # --- Advanced Mocking for Firestore ---
        # Mock the two different collections that will be called
        mock_metadata_collection = mock.Mock()
        mock_data_collection = mock.Mock()

        # Use a side_effect to return the correct mock based on the collection name
        def collection_side_effect(collection_name):
            if collection_name == "bq_export_metadata":
                return mock_metadata_collection
            elif collection_name == DAILY_DESTINATION_COLLECTION:
                return mock_data_collection
            # Fallback for any other collection calls
            return mock.DEFAULT

        mock_firestore_client.return_value.collection.side_effect = collection_side_effect

        # Configure the metadata collection mock for the initial read
        mock_metadata_doc = mock.Mock()
        mock_metadata_doc.exists = True
        mock_metadata_doc.to_dict.return_value = {"last_processed_date": "2025-07-01"}
        mock_metadata_collection.document.return_value.get.return_value = mock_metadata_doc

        # Mock BigQuery query result with two new rows
        mock_rows = [
            MockBigQueryRow({
                "date": date(2025, 7, 2),
                "sensor_set_id": "set-1",
                "sunrise": datetime(2025, 7, 2, 10, 30, 0, tzinfo=timezone.utc),
                "sunset": datetime(2025, 7, 3, 1, 45, 0, tzinfo=timezone.utc),
                "timezone": "America/Chicago"
            }),
            MockBigQueryRow({
                "date": date(2025, 7, 3),
                "sensor_set_id": "set-1",
                "sunrise": datetime(2025, 7, 3, 10, 31, 0, tzinfo=timezone.utc),
                "sunset": datetime(2025, 7, 4, 1, 44, 0, tzinfo=timezone.utc),
                "timezone": "America/Chicago"
            })
        ]
        mock_bigquery_client.return_value.query.return_value = mock_rows

        # Mock Firestore batch object
        mock_batch = mock.Mock()
        mock_firestore_client.return_value.batch.return_value = mock_batch

        # --- Call the function ---
        mock_request = mock.Mock()
        mock_request.data = json.dumps({"export_type": "daily"}).encode('utf-8')
        result, status_code = export_weather_to_firestore(mock_request)

        # --- Assertions ---
        # 1. Assert BigQuery was queried with the correct date
        mock_bigquery_client.return_value.query.assert_called_once()
        query_text = mock_bigquery_client.return_value.query.call_args[0][0]
        self.assertIn('WHERE\n            date > DATE("2025-07-01")', query_text)

        # 2. Assert Firestore batch writes happened for each row
        self.assertEqual(mock_batch.set.call_count, 2)
        mock_batch.commit.assert_called_once()

        # 3. Assert the document IDs were created correctly on the DATA collection
        data_document_mock = mock_data_collection.document
        self.assertEqual(data_document_mock.call_args_list[0].args[0], "set-1_2025-07-02")
        self.assertEqual(data_document_mock.call_args_list[1].args[0], "set-1_2025-07-03")

        # Now, check the data passed to the first batch.set() call
        first_call_args = mock_batch.set.call_args_list[0][0]
        doc_data = first_call_args[1]
        self.assertEqual(doc_data["date"],
                         datetime(2025, 7, 2, 0, 0))  # Check date is converted to datetime at midnight
        self.assertEqual(doc_data["sunrise"], datetime(2025, 7, 2, 10, 30, 0, tzinfo=timezone.utc))

        # 4. Assert metadata was read and updated correctly on the METADATA collection
        mock_metadata_collection.document.assert_called_with(DAILY_METADATA_DOC_ID)
        mock_metadata_collection.document.return_value.set.assert_called_with({
            "last_processed_date": "2025-07-03",
            "rows_processed_in_last_run": 2,
            "last_run_timestamp": mock.ANY  # Use mock.ANY for server-generated timestamps
        })

        # 5. Assert the function returns a success message
        self.assertEqual(result, "SUCCESS: Daily: SUCCESS: Processed 2 rows.")

    @mock.patch("main.firestore.Client")
    @mock.patch("main.bigquery.Client")
    def test_handles_null_timestamps_gracefully(self, mock_bigquery_client, mock_firestore_client):
        """Tests that rows with NULL sunrise/sunset values are processed without errors."""
        # --- Setup Mocks ---
        mock_bigquery_client.return_value.project = "test-project"
        mock_metadata_doc = mock.Mock()
        mock_metadata_doc.exists = True
        mock_metadata_doc.to_dict.return_value = {"last_processed_date": "2025-07-01"}
        mock_firestore_client.return_value.collection.return_value.document.return_value.get.return_value = mock_metadata_doc

        # Mock a row where sunrise and sunset are None (NULL in BigQuery)
        mock_rows = [
            MockBigQueryRow({
                "date": date(2025, 7, 2),
                "sensor_set_id": "set-1",
                "sunrise": None,
                "sunset": None,
                "timezone": "America/Chicago"
            })
        ]
        mock_bigquery_client.return_value.query.return_value = mock_rows
        mock_batch = mock.Mock()
        mock_firestore_client.return_value.batch.return_value = mock_batch

        # --- Call the function ---
        mock_request = mock.Mock()
        mock_request.data = json.dumps({"export_type": "daily"}).encode('utf-8')
        result, status_code = export_weather_to_firestore(mock_request)

        # --- Assertions ---
        # Assert that the batch write was still called
        mock_batch.set.assert_called_once()

        # Assert that the data passed to Firestore contains None for the null fields
        doc_data = mock_batch.set.call_args[0][1]
        self.assertIsNone(doc_data["sunrise"])
        self.assertIsNone(doc_data["sunset"])
        print("Successfully tested handling of NULL timestamps.")

    @mock.patch("main.firestore.Client")
    @mock.patch("main.bigquery.Client")
    def test_export_with_no_new_data(self, mock_bigquery_client, mock_firestore_client):
        """Tests the scenario where no new data is found in BigQuery."""
        # --- Setup Mocks ---
        mock_bigquery_client.return_value.project = "test-project"
        mock_metadata_doc = mock.Mock()
        mock_metadata_doc.exists = True
        mock_metadata_doc.to_dict.return_value = {"last_processed_date": "2025-07-01"}
        mock_firestore_client.return_value.collection.return_value.document.return_value.get.return_value = mock_metadata_doc

        # Mock an empty result from BigQuery
        mock_bigquery_client.return_value.query.return_value = []
        mock_batch = mock.Mock()
        mock_firestore_client.return_value.batch.return_value = mock_batch

        # --- Call the function ---
        mock_request = mock.Mock()
        mock_request.data = json.dumps({"export_type": "daily"}).encode('utf-8')
        result, status_code = export_weather_to_firestore(mock_request)

        # --- Assertions ---
        # Assert that no Firestore writes were attempted
        mock_batch.set.assert_not_called()
        mock_batch.commit.assert_not_called()

        # Assert that the metadata was NOT updated
        mock_firestore_client.return_value.collection.return_value.document.return_value.set.assert_not_called()

        # Assert the function returns a success message
        self.assertEqual(result, "SUCCESS: Daily: SUCCESS: No new data.")


if __name__ == '__main__':
    unittest.main()