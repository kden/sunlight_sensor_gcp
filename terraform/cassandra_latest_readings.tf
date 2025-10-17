# terraform/cloudrun_cassandra_latest_readings.tf
#
# Cloud Function to read latest sensor readings from Datastax Astra Cassandra
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from Claude Sonnet 4.5 (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# Service Account for the Cassandra reader function
resource "google_service_account" "cassandra_reader_sa" {
  project      = var.gcp_project_id
  account_id   = "cassandra-reader"
  display_name = "Cassandra Latest Readings Reader SA"
}

# Grant permission to read from the bundle bucket
resource "google_storage_bucket_iam_member" "cassandra_reader_bundle_reader" {
  bucket = google_storage_bucket.cassandra_secure_bundle.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.cassandra_reader_sa.email}"
}

# Allow the deployer to act as this service account
resource "google_service_account_iam_member" "deployer_act_as_cassandra_reader" {
  service_account_id = google_service_account.cassandra_reader_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.function_deployer.email}"
}

# Allow public (unauthenticated) access to the function
resource "google_cloud_run_service_iam_member" "cassandra_reader_public_invoker" {
  location = var.region
  project  = var.gcp_project_id
  service  = "cassandra-latest-readings"

  role   = "roles/run.invoker"
  member = "allUsers"
}

# Output for GitHub Actions
output "cassandra_reader_sa_email" {
  value       = google_service_account.cassandra_reader_sa.email
  description = "The email of the runtime service account for the cassandra-latest-readings function."
}