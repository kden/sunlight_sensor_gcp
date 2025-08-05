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

# 4. Create a dedicated Service Account for the Scheduler Job
resource "google_service_account" "bq_to_fs_weather_invoker_sa" {
  project      = var.gcp_project_id
  account_id   = "bq-fs-weather-invoker-sa"
  display_name = "Service Account for BQ to FS Weather Scheduler"
}

# 5. Grant the Scheduler's Service Account permission to invoke the Cloud Function
resource "google_cloud_run_service_iam_member" "allow_weather_invoker" {
  project  = var.gcp_project_id
  location = var.region
  service  = "bq-to-fs-weather-exporter" # The name of the function deployed by the GitHub Action
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.bq_to_fs_weather_invoker_sa.email}"
}

# 6. Cloud Scheduler Job
# Runs daily to trigger the export process.
resource "google_cloud_scheduler_job" "bq_to_fs_weather_scheduler" {
  project     = var.gcp_project_id
  region      = var.region
  name        = "bq-to-fs-weather-job"
  schedule    = "0 2 * * *"
  time_zone   = "America/Chicago"
  description = "Transfers daily historical weather data from BigQuery to Firestore."

  http_target {
    uri         = "https://${var.region}-${var.gcp_project_id}.cloudfunctions.net/bq-to-fs-weather-exporter"
    http_method = "POST"
    body        = base64encode("{\"export_type\": \"both\"}") # Send a JSON body

    oidc_token {
      service_account_email = google_service_account.bq_to_fs_weather_invoker_sa.email
      audience              = "https://${var.region}-${var.gcp_project_id}.cloudfunctions.net/bq-to-fs-weather-exporter"
    }
  }

  depends_on = [
    google_cloud_run_service_iam_member.allow_weather_invoker
  ]
}

# --- Outputs ---
output "bq_to_fs_weather_sa_email" {
  value       = google_service_account.bq_to_fs_weather_sa.email
  description = "The email of the runtime service account for the bq-to-fs-weather-exporter function."
}