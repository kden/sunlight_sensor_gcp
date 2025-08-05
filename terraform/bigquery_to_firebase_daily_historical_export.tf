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

# 3. Allow the main function deployer to act as this new runtime SA
# This allows the GitHub Action to assign this service account during deployment.
resource "google_service_account_iam_member" "deployer_act_as_bq_to_fs_weather" {
  service_account_id = google_service_account.bq_to_fs_weather_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.function_deployer.email}"
}

# 4. Pub/Sub Topic to Trigger the Function
resource "google_pubsub_topic" "bq_to_fs_weather_trigger" {
  project = var.gcp_project_id
  name    = "bq-to-fs-weather-trigger"
}

# 5. Cloud Scheduler Job
# Runs daily to trigger the export process.
resource "google_cloud_scheduler_job" "bq_to_fs_weather_scheduler" {
  project     = var.gcp_project_id
  region      = var.region
  name        = "bq-to-fs-weather-job"
  schedule    = "0 2 * * *"
  time_zone   = "America/Chicago"
  description = "Transfers daily historical weather data from BigQuery to Firestore."

  pubsub_target {
    topic_name = google_pubsub_topic.bq_to_fs_weather_trigger.id
    data       = base64encode("Run Weather Export")
  }

  depends_on = [
    google_project_service.apis
  ]
}

# --- Outputs ---
output "bq_to_fs_weather_sa_email" {
  value       = google_service_account.bq_to_fs_weather_sa.email
  description = "The email of the runtime service account for the bq-to-fs-weather-exporter function."
}