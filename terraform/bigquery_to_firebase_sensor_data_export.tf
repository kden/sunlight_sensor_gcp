# terraform/bigquery_to_firebase_sensor_data_export.tf
#
# Define the resources to export sensor data from BigQuery to Firestore.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# 1. Service Account for the Cloud Function
# This gives the function a dedicated identity with specific permissions.
resource "google_service_account" "bq_to_firestore_sensors_sa" {
  project      = var.gcp_project_id
  account_id   = "bq-to-fs-sensors-exporter"
  display_name = "BigQuery to Firebase Sensor Data Exporter SA"
}

# 2. Permissions for the Service Account
# It needs to read from BigQuery and write to Firestore (which uses datastore permissions).
resource "google_project_iam_member" "bq_to_firestore_sensors_sa_bq_viewer" {
  project = var.gcp_project_id
  role    = "roles/bigquery.dataViewer"
  member  = google_service_account.bq_to_firestore_sensors_sa.member
}

resource "google_project_iam_member" "bq_to_firestore_sensors_sa_bq_job_user" {
  project = var.gcp_project_id
  role    = "roles/bigquery.jobUser"
  member  = google_service_account.bq_to_firestore_sensors_sa.member
}

resource "google_project_iam_member" "bq_to_firestore_sensors_sa_firestore_user" {
  project = var.gcp_project_id
  role    = "roles/datastore.user"
  member  = google_service_account.bq_to_firestore_sensors_sa.member
}

# 3. Allow the main function deployer to act as this new runtime SA
# This allows the GitHub Action to assign this service account during deployment.
resource "google_service_account_iam_member" "deployer_act_as_bq_to_fs_sensors" {
  service_account_id = google_service_account.bq_to_firestore_sensors_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.function_deployer.email}"
}

# 4. Pub/Sub Topic to trigger the function
resource "google_pubsub_topic" "bq_to_firestore_sensors_trigger" {
  project = var.gcp_project_id
  name    = "bq-to-firebase-trigger"
}

# 5. Cloud Scheduler to run the job
resource "google_cloud_scheduler_job" "bq_to_firestore_sensors_scheduler" {
  project     = var.gcp_project_id
  region      = var.region
  name        = "bq-to-firebase-job"
  schedule    = "*/15 * * * *" # Runs every 15 minutes
  time_zone   = "UTC"
  description = "Transfers sensor data from BigQuery to Firebase."


  pubsub_target {
    topic_name = google_pubsub_topic.bq_to_firestore_sensors_trigger.id
    data       = base64encode("Run")
  }

  depends_on = [
    google_project_service.apis
  ]
}

# --- Outputs ---
output "bq_to_firestore_sensors_sa_email" {
  value       = google_service_account.bq_to_firestore_sensors_sa.email
  description = "The email of the runtime service account for the bq-to-fs-sensors-exporter function."
}