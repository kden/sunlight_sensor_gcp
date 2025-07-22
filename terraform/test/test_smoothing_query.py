#  test_smoothing_query.py
#
#  Tests the simplified downsample_sunlight query.
#
#  Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
#  Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
#  Apache 2.0 Licensed as described in the file LICENSE

import pytest
import os
from google.cloud import bigquery
from pathlib import Path

# --- Test Configuration ---

# Use a real GCP project for testing. Read from environment variable.
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
if not GCP_PROJECT_ID:
    pytest.skip("GCP_PROJECT_ID environment variable not set, skipping integration tests.", allow_module_level=True)

# Path to your SQL template
QUERY_TEMPLATE_PATH = Path(__file__).parent.parent / "queries/downsample_sunlight.sql.tpl"


# --- Pytest Fixtures for BQ Setup/Teardown ---

@pytest.fixture(scope="session")
def bq_client():
    """Yields a BigQuery client."""
    return bigquery.Client(project=GCP_PROJECT_ID)


@pytest.fixture(scope="module")
def test_dataset(bq_client):
    """
    Creates a BQ dataset for inspection. It is not cleaned up afterwards
    to allow for manual inspection of the final table states.
    """
    dataset_id = "smoothing_test_data_inspection"
    dataset_ref = bq_client.dataset(dataset_id)
    bq_client.create_dataset(dataset_ref, exists_ok=True)
    print(f"\nUsing test dataset for inspection: {GCP_PROJECT_ID}.{dataset_id}")
    yield dataset_id


@pytest.fixture
def sample_data_tables(bq_client, test_dataset):
    """
    Deletes and recreates source/destination tables at the start of a test
    to ensure a clean slate for each run.
    """
    source_table_name = "source_raw_data"
    dest_table_name = "dest_downsampled_data"

    # --- Construct fully-qualified table IDs for all client operations ---
    full_source_table_id = f"{GCP_PROJECT_ID}.{test_dataset}.{source_table_name}"
    full_dest_table_id = f"{GCP_PROJECT_ID}.{test_dataset}.{dest_table_name}"

    # --- Cleanup First ---
    print("\n--- Clearing tables from previous test run ---")
    bq_client.delete_table(full_source_table_id, not_found_ok=True)
    bq_client.delete_table(full_dest_table_id, not_found_ok=True)
    print("Cleanup complete.")

    # Define schemas
    source_schema = [
        bigquery.SchemaField("timestamp", "TIMESTAMP"),
        bigquery.SchemaField("sensor_id", "STRING"),
        bigquery.SchemaField("light_intensity", "FLOAT"),
        bigquery.SchemaField("sensor_set_id", "STRING"),
    ]
    dest_schema = [
        bigquery.SchemaField("observation_minute", "TIMESTAMP"),
        bigquery.SchemaField("sensor_id", "STRING"),
        bigquery.SchemaField("smoothed_light_intensity", "FLOAT"),
        bigquery.SchemaField("sensor_set_id", "STRING"),
        bigquery.SchemaField("last_updated", "TIMESTAMP"),
    ]

    # --- Recreate Tables ---
    print("--- Recreating source and destination tables ---")
    bq_client.create_table(bigquery.Table(full_source_table_id, schema=source_schema))
    bq_client.create_table(bigquery.Table(full_dest_table_id, schema=dest_schema))

    # --- Define and Load Sample Data ---
    dest_initial_data = [
        ("2025-01-15T10:00:00Z", "sensor-A", 100.0, "set-1", "2025-01-15T10:01:00Z"),
    ]
    source_new_data = [
        ("2025-01-15T10:00:55Z", "sensor-A", 999.0, "set-1"),   # Should update the 10:00 record
        ("2025-01-15T10:01:15Z", "sensor-A", 105.0, "set-1"),
        ("2025-01-15T10:01:45Z", "sensor-A", 115.0, "set-1"),  # Avg for 10:01 should be 110
        ("2025-01-15T10:03:30Z", "sensor-A", 120.0, "set-1"),  # Creates a record for 10:03, leaving a gap at 10:02
        ("2025-01-15T10:00:30Z", "sensor-B", 50.0, "set-2"),    # New sensor, creates a record at 10:00
    ]

    bq_client.load_table_from_json([dict(zip([f.name for f in dest_schema], row)) for row in dest_initial_data],
                                   full_dest_table_id).result()
    bq_client.load_table_from_json([dict(zip([f.name for f in source_schema], row)) for row in source_new_data],
                                   full_source_table_id).result()

    # The return dictionary is for the SQL template, so it uses the short names. This is correct.
    return {
        "project_id": GCP_PROJECT_ID,
        "dataset_id": test_dataset,
        "source_table": source_table_name,
        "destination_table": dest_table_name,
    }


# --- Helper Function ---

def substitute_sql_variables(sql_template: str, variables: dict) -> str:
    """Replaces Terraform-style `${var}` variables in a SQL string."""
    query = sql_template
    for key, value in variables.items():
        query = query.replace(f'${{{key}}}', str(value))
    return query


# --- The Actual Test ---

def test_simplified_downsample_and_merge(bq_client, sample_data_tables):
    """
    Runs the simplified MERGE query and asserts the final state of the
    destination table, ensuring no gap-filling (LOCF) occurs.
    """
    full_query_text = QUERY_TEMPLATE_PATH.read_text()

    # --- Run the final MERGE statement ---
    print("\n--- Running the simplified MERGE statement ---")
    final_merge_query = substitute_sql_variables(full_query_text, sample_data_tables)
    bq_client.query(final_merge_query).result()
    print("Final MERGE complete.")

    # --- Verify the final state of the destination table ---
    final_table_ref = f"`{GCP_PROJECT_ID}.{sample_data_tables['dataset_id']}.{sample_data_tables['destination_table']}`"
    results = bq_client.query(f"SELECT * FROM {final_table_ref} ORDER BY sensor_id, observation_minute").result()

    rows = [dict(row) for row in results]

    # --- Assertions for the new, simplified logic ---
    # Note: There should be no row for sensor-A at 10:02, as gap-filling is disabled.
    expected_data = {
        # (sensor_id, observation_minute_iso): smoothed_light_intensity
        ('sensor-A', '2025-01-15T10:00:00+00:00'): 999.0,  # Updated from 100.0
        ('sensor-A', '2025-01-15T10:01:00+00:00'): 110.0,  # The new average
        ('sensor-A', '2025-01-15T10:03:00+00:00'): 120.0,  # The new single point
        ('sensor-B', '2025-01-15T10:00:00+00:00'): 50.0,   # The new sensor's first point
    }

    # First, check that the number of rows is what we expect.
    assert len(rows) == len(expected_data), f"Expected {len(expected_data)} rows but got {len(rows)}"

    # Then, check the content of each row against our expected data map.
    actual_data = {
        (row['sensor_id'], row['observation_minute'].isoformat()): round(row['smoothed_light_intensity'], 2)
        for row in rows
    }

    assert actual_data == expected_data, "The actual data in the table does not match the expected data."
    print("\nFinal assertions passed successfully!")