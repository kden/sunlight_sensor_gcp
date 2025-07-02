# Grant Pub/Sub service account permission to write to BigQuery
resource "google_project_iam_member" "pubsub_bigquery_publisher" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# Get the project details
data "google_project" "project" {
  project_id = var.project_id
}

resource "google_bigquery_dataset" "sunlight_dataset" {
  project    = var.project_id
  dataset_id = "sunlight_data"
  location   = "US" # Choose the appropriate location
}

# New table for sensor metadata
resource "google_bigquery_table" "sensor_metadata_table" {
  project    = var.project_id
  dataset_id = google_bigquery_dataset.sunlight_dataset.dataset_id
  table_id   = "sensor_metadata"

  schema = <<EOF
[
  {"name": "sensor_id", "type": "STRING", "mode": "REQUIRED"},
  {"name": "position_x_ft", "type": "FLOAT", "mode": "NULLABLE"},
  {"name": "position_y_ft", "type": "FLOAT", "mode": "NULLABLE"},
  {"name": "last_updated", "type": "TIMESTAMP", "mode": "NULLABLE"},
  {"name": "board", "type": "STRING", "mode": "NULLABLE"},
  {"name": "has_display", "type": "BOOLEAN", "mode": "NULLABLE"},
  {"name": "sunlight_sensor_model", "type": "STRING", "mode": "NULLABLE"},
  {"name": "display_model", "type": "STRING", "mode": "NULLABLE"},
  {"name": "wifi_antenna", "type": "STRING", "mode": "NULLABLE"}
]
EOF

  deletion_protection = false # Set to true in production
}

# Load initial data from the JSON file
locals {
  sensor_metadata_path = "${path.module}/sensor_metadata.json"
  sensor_metadata      = fileexists(local.sensor_metadata_path) ? jsondecode(file(local.sensor_metadata_path)) : []

  # Dynamically build the VALUES clause for the INSERT statement
  sensor_values = join(",\n", [
    for row in local.sensor_metadata :
    format("('%s', %f, %f, CURRENT_TIMESTAMP(), '%s', %t, '%s', '%s', '%s')",
      row["sensor_id"],
      row["position_x_ft"],
      row["position_y_ft"],
      row["board"],
      row["has_display"],
      row["sunlight_sensor_model"],
      row["display_model"],
      row["wifi_antenna"]
    )
  ])
}

# Job to insert the initial data into the sensor table
# Note: The principal (user or service account) running `terraform apply`
# needs the "BigQuery Data Editor" role on the project to run this job.
resource "google_bigquery_job" "insert_sensor_metadata" {
  # Only run this job if there is data to insert
  count   = length(local.sensor_metadata) > 0 ? 1 : 0
  project = var.project_id
  # A unique job_id is required for each run
  job_id  = "insert_initial_sensor_metadata_${random_id.job_suffix.hex}"

  query {
    query = <<-SQL
      INSERT INTO `${google_bigquery_table.sensor_metadata_table.project}.${google_bigquery_table.sensor_metadata_table.dataset_id}.${google_bigquery_table.sensor_metadata_table.table_id}`
      (sensor_id, position_x_ft, position_y_ft, last_updated, board, has_display, sunlight_sensor_model, display_model, wifi_antenna)
      VALUES
      ${local.sensor_values};
    SQL

    # Specify DML settings
    create_disposition = "CREATE_NEVER"
    write_disposition  = "WRITE_TRUNCATE" # Overwrite the table if it exists
  }

  # Add a random suffix to the job_id to ensure it's unique on each apply
  depends_on = [
    google_bigquery_table.sensor_metadata_table,
  ]
}

# This resource is required by the `google_bigquery_job` to ensure the job_id is unique
resource "random_id" "job_suffix" {
  byte_length = 8
  keepers = {
    # Re-generate the random ID, forcing the job to re-run, whenever the data file changes.
    file_hash = fileexists(local.sensor_metadata_path) ? filemd5(local.sensor_metadata_path) : ""
  }
}

# The raw data table that receives messages from Pub/Sub
resource "google_bigquery_table" "sunlight_table" {
  project    = var.project_id
  dataset_id = google_bigquery_dataset.sunlight_dataset.dataset_id
  table_id   = "sunlight_intensity"

  time_partitioning {
    type          = "DAY"
    expiration_ms = 157680000000  # Optional: expire data after 5 years
  }

  schema = <<EOF
[
  {
    "name": "data",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "The raw message data from Pub/Sub"
  },
  {
    "name": "ingestion_time",
    "type": "TIMESTAMP",
    "mode": "NULLABLE",
    "defaultValueExpression": "CURRENT_TIMESTAMP()"
  }
]
EOF

  deletion_protection = false  # Set to true in production
}

# The Pub/Sub subscription that writes to the raw BigQuery table
resource "google_pubsub_subscription" "sunlight_subscription_bq" {
  project = var.project_id
  name    = "sunlight-sensor-data-to-bq"
  topic   = google_pubsub_topic.sun_sensor_ingest.name  # Reference the existing topic

  bigquery_config {
    table = "${google_bigquery_table.sunlight_table.project}:${google_bigquery_table.sunlight_table.dataset_id}.${google_bigquery_table.sunlight_table.table_id}"
  }
}

# The first processing table that gets the transformed raw data
resource "google_bigquery_table" "transformed_sunlight_table" {
  project    = var.project_id
  dataset_id = google_bigquery_dataset.sunlight_dataset.dataset_id
  table_id   = "transformed_sunlight_data"

  time_partitioning {
    type          = "DAY"
    field         = "timestamp"  # Partition by the timestamp field
    expiration_ms = null         # Optional: no expiration
  }

  schema = <<EOF
[
  {
    "name": "light_intensity",
    "type": "FLOAT",
    "mode": "REQUIRED",
    "description": "The light intensity value"
  },
  {
    "name": "sensor_id",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "The sensor ID"
  },
  {
    "name": "timestamp",
    "type": "TIMESTAMP",
    "mode": "REQUIRED",
    "description": "The sensor capture timestamp"
  },
  {
    "name": "ingestion_time",
    "type": "TIMESTAMP",
    "mode": "NULLABLE",
    "description": "The Pub/Sub ingestion timestamp",
    "defaultValueExpression": "CURRENT_TIMESTAMP()"
  }
]
EOF

  deletion_protection = false  # Set to true in production
}

# Service account for the scheduled query
resource "google_service_account" "bq_transfer_sa" {
  project      = var.project_id
  account_id   = "bq-transfer-service-account"
  display_name = "BigQuery Transfer Service Account"
}

# Grant the transfer service account the necessary roles
resource "google_project_iam_member" "bq_transfer_sa_data_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.bq_transfer_sa.email}"
}

resource "google_project_iam_member" "bq_transfer_sa_job_user" {
  project = var.project_id
  role    = "roles/bigquery.user"
  member  = "serviceAccount:${google_service_account.bq_transfer_sa.email}"
}

# The scheduled query that processes the raw data into the transformed table
resource "google_bigquery_data_transfer_config" "transform_sunlight_data" {
  project                = var.project_id
  display_name           = "Transform Sunlight Data"
  location               = "US" # Or your desired location
  data_source_id         = "scheduled_query"
  schedule               = "every 5 minutes" # Or your desired schedule
  destination_dataset_id = google_bigquery_dataset.sunlight_dataset.dataset_id
  service_account_name   = google_service_account.bq_transfer_sa.email

  params = {
    destination_table_name_template = google_bigquery_table.transformed_sunlight_table.table_id
    write_disposition               = "WRITE_APPEND"
    query                           = <<-EOF
      SELECT
        CAST(JSON_EXTRACT_SCALAR(data, '$.light_intensity') AS FLOAT64) as light_intensity,
        JSON_EXTRACT_SCALAR(data, '$.sensor_id') as sensor_id,
        CAST(JSON_EXTRACT_SCALAR(data, '$.timestamp') AS TIMESTAMP) as timestamp,
        ingestion_time
      FROM
        `${google_bigquery_table.sunlight_table.project}.${google_bigquery_table.sunlight_table.dataset_id}.${google_bigquery_table.sunlight_table.table_id}`
      WHERE
        ingestion_time > IFNULL(
          (
            SELECT
              MAX(t.ingestion_time)
            FROM
              `${google_bigquery_table.transformed_sunlight_table.project}.${google_bigquery_table.transformed_sunlight_table.dataset_id}.${google_bigquery_table.transformed_sunlight_table.table_id}` AS t
          ),
          TIMESTAMP('1970-01-01 00:00:00 UTC')
        )
    EOF
  }

  depends_on = [
    # Ensure permissions are granted before creating the transfer
    google_project_iam_member.bq_transfer_sa_data_editor,
    google_project_iam_member.bq_transfer_sa_job_user,
  ]
}