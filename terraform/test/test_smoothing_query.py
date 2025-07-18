#  test_smoothing_query.py
#
#  Break down the complex downsample_sunlight query into CTEs and test.
#
#  Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
#  Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
#  Apache 2.0 Licensed as described in the file LICENSE

import pytest
import os
from google.cloud import bigquery
from pathlib import Path
import re

# --- Test Configuration ---

# Use a real GCP project for testing. Read from environment variable.
# If not set, skip these integration tests to prevent failures in CI/CD.
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
if not GCP_PROJECT_ID:
    pytest.skip("GCP_PROJECT_ID environment variable not set, skipping integration tests.", allow_module_level=True)

# Path to your SQL template
QUERY_TEMPLATE_PATH = Path(__file__).parent.parent / "queries/downsample_sunlight.sql.tpl"

# Define the logical order of CTEs for sequential execution and debugging.
# This order now matches the structure of the updated SQL query.
CTE_EXECUTION_ORDER = [
    "processing_window",
    "capped_window",
    "last_known_state",
    "new_raw_data",
    "combined_data",
    "minute_series",
    "scaffold",
    "data_gapped",
    "gaps_filled",
    "sensor_boundaries",  # The new CTE to test the LOCF boundary logic
]


# --- Pytest Fixtures for BQ Setup/Teardown ---

@pytest.fixture(scope="session")
def bq_client():
    """Yields a BigQuery client."""
    return bigquery.Client(project=GCP_PROJECT_ID)


@pytest.fixture(scope="module")
def test_dataset(bq_client):
    """
    Creates a BQ dataset with a predictable name for inspection.
    NOTE: This fixture does NOT clean up the dataset, allowing you to
    inspect the tables in the BigQuery UI after the test run.
    """
    dataset_id = "smoothing_test_data_inspection"  # Predictable name for easy access
    dataset_ref = bq_client.dataset(dataset_id)
    bq_client.create_dataset(dataset_ref, exists_ok=True)
    print(f"\nUsing test dataset for inspection: {GCP_PROJECT_ID}.{dataset_id}")
    yield dataset_id
    # Teardown is intentionally disabled for manual inspection of results.


@pytest.fixture
def sample_data_tables(bq_client, test_dataset):
    """
    Deletes and recreates source/destination tables and all intermediate
    debug tables at the start of a test. This ensures a clean slate for each run.
    """
    source_table_id = "source_raw_data"
    dest_table_id = "dest_downsampled_data"

    # --- Cleanup First ---
    print("\n--- Clearing all tables from previous test runs ---")
    # Clean up source and destination tables
    bq_client.delete_table(bq_client.dataset(test_dataset).table(source_table_id), not_found_ok=True)
    bq_client.delete_table(bq_client.dataset(test_dataset).table(dest_table_id), not_found_ok=True)

    # Clean up all intermediate CTE debug tables
    for index, cte_name in enumerate(CTE_EXECUTION_ORDER):
        debug_table_id = f"{index:02d}_debug_cte_{cte_name}"
        bq_client.delete_table(bq_client.dataset(test_dataset).table(debug_table_id), not_found_ok=True)
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
    print(f"--- Recreating source and destination tables ---")
    bq_client.create_table(bigquery.Table(bq_client.dataset(test_dataset).table(source_table_id), schema=source_schema))
    bq_client.create_table(bigquery.Table(bq_client.dataset(test_dataset).table(dest_table_id), schema=dest_schema))

    # --- Define and Load Sample Data ---
    dest_initial_data = [
        ("2025-01-15T10:00:00Z", "sensor-A", 100.0, "set-1", "2025-01-15T10:01:00Z"),
    ]
    source_new_data = [
        ("2025-01-15T10:00:55Z", "sensor-A", 999.0, "set-1"),
        ("2025-01-15T10:01:15Z", "sensor-A", 105.0, "set-1"),
        ("2025-01-15T10:01:45Z", "sensor-A", 115.0, "set-1"),  # Avg should be 110
        ("2025-01-15T10:03:30Z", "sensor-A", 120.0, "set-1"),  # Gap at 10:02
        ("2025-01-15T10:00:30Z", "sensor-B", 50.0, "set-2"),   # New sensor, last data point at 10:00
    ]

    bq_client.load_table_from_json([dict(zip([f.name for f in dest_schema], row)) for row in dest_initial_data],
                                   bq_client.dataset(test_dataset).table(dest_table_id)).result()
    bq_client.load_table_from_json([dict(zip([f.name for f in source_schema], row)) for row in source_new_data],
                                   bq_client.dataset(test_dataset).table(source_table_id)).result()

    return {
        "project_id": GCP_PROJECT_ID,
        "dataset_id": test_dataset,
        "source_table": source_table_id,
        "destination_table": dest_table_id,
    }


# --- Helper Functions ---

def substitute_sql_variables(sql_template: str, variables: dict) -> str:
    """
    Replaces Terraform-style `${var}` variables in a SQL string.
    This is used because Python's .format() conflicts with the template syntax.
    """
    query = sql_template
    for key, value in variables.items():
        query = query.replace(f'${{{key}}}', str(value))
    return query


def get_cte_as_query(full_query_text, cte_name):
    """
    Extracts the subquery from the MERGE's USING clause, then isolates
    the WITH block to robustly build a test for a specific CTE. This version
    finds the end of the last CTE definition, which is more reliable.
    """
    # Find the subquery within the `USING (...)` clause
    using_start_match = re.search(r'USING\s*\(', full_query_text, re.IGNORECASE)
    if not using_start_match:
        raise ValueError("Could not find 'USING (' clause for the MERGE statement.")

    # Start searching for the subquery content from after 'USING ('
    subquery_search_start = using_start_match.end()
    search_text = full_query_text[subquery_search_start:]

    open_paren_count = 1
    subquery_end_index = -1
    for i, char in enumerate(search_text):
        if char == '(':
            open_paren_count += 1
        elif char == ')':
            open_paren_count -= 1
            if open_paren_count == 0:
                subquery_end_index = i
                break

    if subquery_end_index == -1:
        raise ValueError("Could not find the closing parenthesis for the MERGE's USING clause.")

    # This is the text of the entire subquery, e.g., "WITH ... SELECT ..."
    subquery_text = search_text[:subquery_end_index]

    # To isolate the CTE definitions, we find the end of the *last* CTE.
    # A CTE definition looks like `cte_name AS (...)`.
    last_as_match = None
    for match in re.finditer(r'\bAS\s*\(', subquery_text, re.IGNORECASE):
        last_as_match = match

    if not last_as_match:
        raise ValueError("Could not find any 'AS (' construct for CTEs in the subquery.")

    # Start searching for the closing paren from the start of the last CTE's body
    search_start_index_for_last_cte = last_as_match.end()
    search_text_for_paren = subquery_text[search_start_index_for_last_cte:]

    open_paren_count = 1
    last_cte_body_end_index = -1
    for i, char in enumerate(search_text_for_paren):
        if char == '(':
            open_paren_count += 1
        elif char == ')':
            open_paren_count -= 1
            if open_paren_count == 0:
                last_cte_body_end_index = search_start_index_for_last_cte + i
                break

    if last_cte_body_end_index == -1:
        raise ValueError("Could not find the closing parenthesis for the last CTE.")

    # The text of all CTEs is the subquery text up to and including the end of the last CTE's body.
    all_ctes_text = subquery_text[:last_cte_body_end_index + 1]

    # The final query is the block of all CTEs, followed by a select from the target.
    return f"{all_ctes_text.strip()} SELECT * FROM {cte_name}"


# --- The Actual Test ---

def test_data_flow_and_final_merge(bq_client, sample_data_tables):
    """
    Materializes each CTE into a debug table for inspection, then runs the
    full MERGE query and asserts the final state.
    """
    full_query_text = QUERY_TEMPLATE_PATH.read_text()

    print("\n--- Materializing each CTE into a debug table ---")
    for index, cte_name in enumerate(CTE_EXECUTION_ORDER):
        debug_table_id = f"{index:02d}_debug_cte_{cte_name}"
        full_debug_table_ref = f"`{sample_data_tables['project_id']}.{sample_data_tables['dataset_id']}.{debug_table_id}`"

        print(f"  -> Generating and running query for: {debug_table_id}")

        # Get the `WITH ... SELECT * FROM {cte}` query
        select_query = get_cte_as_query(full_query_text, cte_name)

        # Build the CREATE OR REPLACE TABLE statement
        create_table_query = f"CREATE OR REPLACE TABLE {full_debug_table_ref} AS\n{select_query}"

        # Substitute variables and execute
        final_query = substitute_sql_variables(create_table_query, sample_data_tables)
        bq_client.query(final_query).result()

    print("CTE materialization complete.")

    # --- Final Verification: Run the full MERGE statement ---
    print("\n--- Running the final MERGE statement to verify end-to-end logic ---")
    final_merge_query = substitute_sql_variables(full_query_text, sample_data_tables)
    bq_client.query(final_merge_query).result()
    print("Final MERGE complete.")

    # Verify the final state of the destination table
    final_table_ref = f"`{GCP_PROJECT_ID}.{sample_data_tables['dataset_id']}.{sample_data_tables['destination_table']}`"
    results = bq_client.query(f"SELECT * FROM {final_table_ref} ORDER BY sensor_id, observation_minute").result()

    rows = [dict(row) for row in results]

    # --- UPDATED ASSERTIONS to validate the new bounded LOCF logic ---
    expected_data = {
        # (sensor_id, observation_minute_iso): smoothed_light_intensity
        ('sensor-A', '2025-01-15T10:00:00+00:00'): 999.0,
        ('sensor-A', '2025-01-15T10:01:00+00:00'): 110.0,  # The average
        ('sensor-A', '2025-01-15T10:02:00+00:00'): 110.0,  # LOCF is correct
        ('sensor-A', '2025-01-15T10:03:00+00:00'): 120.0,  # Last real data point for A
        ('sensor-B', '2025-01-15T10:00:00+00:00'): 50.0,   # Last real data point for B
        # NOTE: Sensor-B is no longer carried forward to 10:01, 10:02, and 10:03,
        # which is the correct, intended behavior of the updated query.
    }

    # First, check that the number of rows is what we expect.
    assert len(rows) == len(expected_data), f"Expected {len(expected_data)} rows but got {len(rows)}"

    # Then, check the content of each row against our expected data map.
    actual_data = {
        (row['sensor_id'], row['observation_minute'].isoformat()): row['smoothed_light_intensity']
        for row in rows
    }

    assert actual_data == expected_data, "The actual data in the table does not match the expected data."
    print("\nFinal assertions passed successfully!")