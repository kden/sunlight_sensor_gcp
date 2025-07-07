
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
  display_name           = "transform_sunlight_data: Transform Sunlight Data"
  location               = "US" # Or your desired location
  data_source_id         = "scheduled_query"
  schedule               = "every hour" # Or your desired schedule
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
        AND JSON_EXTRACT_SCALAR(data, '$.light_intensity') IS NOT NULL
        AND JSON_EXTRACT_SCALAR(data, '$.sensor_id') IS NOT NULL
        AND JSON_EXTRACT_SCALAR(data, '$.timestamp') IS NOT NULL
    EOF
  }

  depends_on = [
    # Ensure permissions are granted before creating the transfer
    google_project_iam_member.bq_transfer_sa_data_editor,
    google_project_iam_member.bq_transfer_sa_job_user,
  ]
}
