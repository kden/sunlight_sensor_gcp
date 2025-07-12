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
resource "google_bigquery_table" "sensor_table" {
  project    = var.gcp_project_id
  dataset_id = google_bigquery_dataset.sunlight_dataset.dataset_id
  table_id   = "sensor"

  schema = <<EOF
[
  {
    "name": "sensor_id",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The ID of the sensor"
  },
  {
    "name": "position_x_ft",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "The distance from the west side of the yard in feet"
  },
  {
    "name": "position_y_ft",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "The distance from the south side of the yard in feet"
  },
  {
    "name": "board",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "Description of the PCB board driving the sensor"
  },
  {
    "name": "has_display",
    "type": "BOOLEAN",
    "mode": "NULLABLE",
    "description": "Indicates if the sensor has a display"
  },
  {
    "name": "sunlight_sensor_model",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The model of the sunlight sensor"
  },
  {
    "name": "display_model",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The model of the display"
  },
  {
    "name": "wifi_antenna",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The type of WiFi antenna"
  },
  {
    "name": "sensor_set_id",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The set of sensors this metadata belongs to"
  }
]
EOF

  deletion_protection = false # Set to true in production
}

resource "google_bigquery_table" "sensor_set_table" {
  # Reuse the project and dataset from your other resources
  project = google_pubsub_topic.sun_sensor_ingest.project
  dataset_id = google_bigquery_table.sensor_table.dataset_id # Assuming the same dataset

  table_id = "sensor_set"

  # Define the schema for the new table
  schema = <<EOF
[
  {
    "name": "sensor_set_id",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "The unique identifier for the sensor set."
  },
  {
    "name": "timezone",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The IANA timezone name for the sensor set (e.g., 'America/Chicago')."
  },
  {
    "name": "latitude",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Latitude of the sensor set site."
  },
  {
    "name": "longitude",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Longitude of the sensor set site."
  }
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

# Upload metadata files as newline-delimited JSON to the staging bucket.
resource "google_storage_bucket_object" "metadata_ndjson" {
  for_each = local.metadata_processing
  name     = "${each.key}_metadata.ndjson"
  bucket   = google_storage_bucket.bq_load_staging.name
  content  = each.value.ndjson
}

data "archive_file" "sensor_set_metadata_archive" {
  type        = "zip"
  source_file = "${path.module}/sensor_set_metadata.json"
  output_path = "${path.module}/../.tmp/sensor_set_metadata.zip"
}

# Job to load data from GCS into the corresponding BigQuery tables.
resource "google_bigquery_job" "load_metadata" {
  for_each = {
    for key, value in local.metadata_processing : key => value
    if value.exists
  }
  project = var.gcp_project_id
  job_id  = "load_initial_${each.key}_metadata_${random_id.job_suffix.hex}"

  load {
    source_uris = [
      "gs://${google_storage_bucket.bq_load_staging.name}/${google_storage_bucket_object.metadata_ndjson[each.key].name}"
    ]
    destination_table {
      project_id = var.gcp_project_id
      dataset_id = google_bigquery_dataset.sunlight_dataset.dataset_id
      table_id   = "${each.key}_metadata" # Dynamically sets table to "sensor" or "sensor_set_metadata"
    }
    source_format     = "NEWLINE_DELIMITED_JSON"
    write_disposition = "WRITE_TRUNCATE"
    autodetect        = false
  }

  depends_on = [
    google_storage_bucket_object.metadata_ndjson,
  ]
}

# This resource ensures the load job re-runs when the source file content changes.
resource "random_id" "job_suffix" {
  byte_length = 8
  keepers = {
    sensor_hash     = local.metadata_processing.sensor.exists ? filemd5(local.metadata_processing.sensor.path) : ""
    sensor_set_hash = local.metadata_processing.sensor_set.exists ? filemd5(local.metadata_processing.sensor_set.path) : ""
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
