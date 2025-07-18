# terraform/bigquery_smoothing_transform.tf
#
# Define a transformation that runs as a scheduled query that
# smooths incoming data so that exactly one entry per minute is
# produced.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

resource "google_bigquery_table" "downsampled_sunlight_table" {
  dataset_id = google_bigquery_dataset.sunlight_dataset.dataset_id
  table_id   = "downsampled_sunlight_data"
  project    = var.gcp_project_id

  time_partitioning {
    type  = "DAY"
    field = "observation_minute"
  }
  clustering = ["sensor_id", "sensor_set_id"]

  schema = <<EOF
[
  {
    "name": "observation_minute",
    "type": "TIMESTAMP",
    "mode": "REQUIRED"
  },
  {
    "name": "sensor_id",
    "type": "STRING",
    "mode": "REQUIRED"
  },
  {
    "name": "smoothed_light_intensity",
    "type": "FLOAT",
    "mode": "NULLABLE"
  },
  {
    "name": "sensor_set_id",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The set of sensors this metadata belongs to"
  },
  {
    "name": "last_updated",
    "type": "TIMESTAMP",
    "mode": "NULLABLE",
    "description": "Timestamp of when the row was last updated."
  }
]
EOF

  deletion_protection = false # Set to true in production
}

resource "google_bigquery_data_transfer_config" "downsample_sunlight_transfer" {
  project                = var.gcp_project_id
  display_name           = "downsample_sunlight_transfer: Incremental Downsample Sunlight Data (LOCF)"
  location               = "US"
  data_source_id         = "scheduled_query"
  schedule               = "every 15 minutes"
  destination_dataset_id = google_bigquery_dataset.sunlight_dataset.dataset_id
  service_account_name   = google_service_account.bq_transfer_sa.email

  params = {
    query = templatefile("${path.module}/queries/downsample_sunlight.sql.tpl", {
      project_id        = var.gcp_project_id
      dataset_id        = var.dataset_id
      destination_table = google_bigquery_table.downsampled_sunlight_table.table_id
      source_table      = google_bigquery_table.transformed_sunlight_table.table_id
    })
  }

  depends_on = [
    # Ensure permissions are granted before creating the transfer
    google_project_iam_member.bq_transfer_sa_data_editor,
    google_project_iam_member.bq_transfer_sa_job_user,
  ]
}
