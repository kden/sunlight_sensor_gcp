# terraform/cloudrun_pubsub_to_cassandra.tf
#
# Cloud Function to write sensor data from Pub/Sub to Datastax Astra Cassandra
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4.5 (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# Service Account for the Cassandra writer function
resource "google_service_account" "pubsub_to_cassandra_sa" {
  project      = var.gcp_project_id
  account_id   = "pubsub-to-cassandra-writer"
  display_name = "Pub/Sub to Cassandra Writer SA"
}

# Grant permission to read from Pub/Sub (implicit through Cloud Functions)
# No additional IAM needed for the Pub/Sub trigger itself

# Allow the deployer to act as this service account
resource "google_service_account_iam_member" "deployer_act_as_cassandra_writer" {
  service_account_id = google_service_account.pubsub_to_cassandra_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.function_deployer.email}"
}

# Grant Pub/Sub the ability to invoke the Cloud Run service
# This is critical for Gen2 Cloud Functions triggered by Pub/Sub
resource "google_cloud_run_service_iam_member" "pubsub_invoker" {
  project  = var.gcp_project_id
  location = var.region
  service  = "pubsub-to-cassandra-writer"
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# Create a dedicated Service Account for manual invocation (testing)
resource "google_service_account" "cassandra_invoker_sa" {
  project      = var.gcp_project_id
  account_id   = "cassandra-writer-invoker-sa"
  display_name = "Service Account for Cassandra Writer Invoker"
}

# Grant the manual invoker SA permission to invoke the function
resource "google_cloud_run_service_iam_member" "manual_invoker" {
  project  = var.gcp_project_id
  location = var.region
  service  = "pubsub-to-cassandra-writer"
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.cassandra_invoker_sa.email}"
}

# Output for GitHub Actions
output "pubsub_to_cassandra_sa_email" {
  value       = google_service_account.pubsub_to_cassandra_sa.email
  description = "The email of the runtime service account for the pubsub-to-cassandra-writer function."
}

output "cassandra_invoker_sa_email" {
  value       = google_service_account.cassandra_invoker_sa.email
  description = "The email of the invoker service account (for manual testing)."
}