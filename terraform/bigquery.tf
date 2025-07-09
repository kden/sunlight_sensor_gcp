# Grant Pub/Sub service account permission to write to BigQuery
resource "google_project_iam_member" "pubsub_bigquery_publisher" {
  project = var.gcp_project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# Get the project details
data "google_project" "project" {
  project_id = var.gcp_project_id
}

resource "google_bigquery_dataset" "sunlight_dataset" {
  project    = var.gcp_project_id
  dataset_id = var.dataset_id
  location   = "US" # Choose the appropriate location
}

# New table for sensor metadata
resource "google_bigquery_table" "sensor_metadata_table" {
  project    = var.gcp_project_id
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


# A temporary GCS bucket to stage the metadata file for BigQuery loading.
resource "google_storage_bucket" "bq_load_staging" {
  project                     = var.gcp_project_id
  name                        = "${var.gcp_project_id}-bq-load-staging"
  location                    = "US"
  force_destroy               = true # Allows deletion of the bucket even if it's not empty
  uniform_bucket_level_access = true

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 1 # Delete objects after 1 day
    }
  }
}

# Upload the sensor metadata as a newline-delimited JSON file to the staging bucket.
resource "google_storage_bucket_object" "sensor_metadata_json" {
  count   = local.sensor_metadata_exists ? 1 : 0
  name    = "sensor_metadata.ndjson"
  bucket  = google_storage_bucket.bq_load_staging.name
  content = local.sensor_metadata_ndjson
}

# Job to load the data from GCS into the sensor_metadata table.
resource "google_bigquery_job" "load_sensor_metadata" {
  count   = local.sensor_metadata_exists ? 1 : 0
  project = var.gcp_project_id
  job_id  = "load_initial_sensor_metadata_${random_id.job_suffix.hex}"

  load {
    source_uris = [
      "gs://${google_storage_bucket.bq_load_staging.name}/${google_storage_bucket_object.sensor_metadata_json[0].name}"
    ]

    destination_table {
      project_id = google_bigquery_table.sensor_metadata_table.project
      dataset_id = google_bigquery_table.sensor_metadata_table.dataset_id
      table_id   = google_bigquery_table.sensor_metadata_table.table_id
    }

    source_format     = "NEWLINE_DELIMITED_JSON"
    write_disposition = "WRITE_TRUNCATE"
    autodetect        = false
  }

  depends_on = [
    google_storage_bucket_object.sensor_metadata_json,
  ]
}

# This resource ensures the load job re-runs when the source file content changes.
resource "random_id" "job_suffix" {
  byte_length = 8
  keepers = {
    file_hash = local.sensor_metadata_exists ? filemd5(local.sensor_metadata_path) : ""
  }
}

# The raw data table that receives messages from Pub/Sub
resource "google_bigquery_table" "sunlight_table" {
  project    = var.gcp_project_id
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
  project = var.gcp_project_id
  name    = "sunlight-sensor-data-to-bq"
  topic   = google_pubsub_topic.sun_sensor_ingest.name  # Reference the existing topic

  bigquery_config {
    table = "${google_bigquery_table.sunlight_table.project}:${google_bigquery_table.sunlight_table.dataset_id}.${google_bigquery_table.sunlight_table.table_id}"
  }
}
