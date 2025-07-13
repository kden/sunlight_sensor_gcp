# terraform/bigquery_to_firebase_daily_historical_export.tf
#
# Define the resources to export daily_historical_weather from BigQuery to Firestore.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# 1. Service Account for the Cloud Function
# A dedicated identity for the weather data export function.
resource "google_service_account" "bq_to_fs_weather_sa" {
  project      = var.gcp_project_id
  account_id   = "bq-to-fs-weather-exporter"
  display_name = "BigQuery to Firestore Weather Exporter SA"
}

# 2. IAM Permissions for the Service Account
# Grants read access to BigQuery and write access to Firestore.
resource "google_project_iam_member" "bq_to_fs_weather_sa_bq_viewer" {
  project = var.gcp_project_id
  role    = "roles/bigquery.dataViewer"
  member  = google_service_account.bq_to_fs_weather_sa.member
}

resource "google_project_iam_member" "bq_to_fs_weather_sa_bq_job_user" {
  project = var.gcp_project_id
  role    = "roles/bigquery.jobUser"
  member  = google_service_account.bq_to_fs_weather_sa.member
}

resource "google_project_iam_member" "bq_to_fs_weather_sa_firestore_user" {
  project = var.gcp_project_id
  role    = "roles/datastore.user"
  member  = google_service_account.bq_to_fs_weather_sa.member
}

# 3. Pub/Sub Topic to Trigger the Function
resource "google_pubsub_topic" "bq_to_fs_weather_trigger" {
  project = var.gcp_project_id
  name    = "bq-to-fs-weather-trigger"
}

# 4. Cloud Scheduler Job
# Runs daily to trigger the export process.
resource "google_cloud_scheduler_job" "bq_to_fs_weather_scheduler" {
  project     = var.gcp_project_id
  region      = var.region
  name        = "bq-to-fs-weather-job"
  schedule    = "0 2 * * *"
  time_zone   = "UTC"
  description = "Transfers daily historical weather data from BigQuery to Firestore."

  pubsub_target {
    topic_name = google_pubsub_topic.bq_to_fs_weather_trigger.id
    data       = base64encode("Run Weather Export")
  }

  depends_on = [
    google_project_service.apis
  ]
}

# 5. Cloud Function
# Deploys the Python code that performs the data transfer.
resource "google_cloudfunctions2_function" "bq_to_fs_weather_exporter" {
  project  = var.gcp_project_id
  name     = "bq-to-fs-weather-exporter"
  location = var.region

  build_config {
    runtime     = "python311"
    entry_point = "export_weather_to_firestore"
    source {
      storage_source {
        bucket = google_storage_bucket.bq_to_fs_weather_source_bucket.name
        object = google_storage_bucket_object.bq_to_fs_weather_source_object.name
      }
    }
  }

  service_config {
    max_instance_count    = 1
    service_account_email = google_service_account.bq_to_fs_weather_sa.email
    ingress_settings      = "ALLOW_ALL"
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.bq_to_fs_weather_trigger.id
    retry_policy   = "RETRY_POLICY_RETRY"
  }

  depends_on = [
    google_project_iam_member.bq_to_fs_weather_sa_bq_viewer,
    google_project_iam_member.bq_to_fs_weather_sa_firestore_user,
    google_project_iam_member.bq_to_fs_weather_sa_bq_job_user,
    google_project_service.apis
  ]
}

# 6. Cloud Storage for Function Source Code
resource "google_storage_bucket" "bq_to_fs_weather_source_bucket" {
  project       = var.gcp_project_id
  name          = "${var.gcp_project_id}-bq-to-fs-weather-source"
  location      = "US"
  force_destroy = true
}

resource "google_storage_bucket_object" "bq_to_fs_weather_source_object" {
  name   = "weather_export_source-${data.archive_file.weather_export_function_source.output_md5}.zip"
  bucket = google_storage_bucket.bq_to_fs_weather_source_bucket.name
  source = data.archive_file.weather_export_function_source.output_path
}

data "archive_file" "weather_export_function_source" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/bq_to_firestore_daily_weather/src"
  output_path = "${path.module}/../functions/bq_to_firestore_daily_weather/weather_export_source.zip"
}