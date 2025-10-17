# terraform/cloudrun_pubsub_to_cassandra.tf
#
# Cloud Function to write sensor data from Pub/Sub to Datastax Astra Cassandra
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4.5 (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# GCS bucket to store the secure bundle
resource "google_storage_bucket" "cassandra_secure_bundle" {
  project                     = var.gcp_project_id
  name                        = "${var.gcp_project_id}-cassandra-bundle"
  location                    = "US"
  force_destroy               = false
  uniform_bucket_level_access = true

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 90 # Delete old bundles after 90 days
    }
  }
}

# Service Account for the Cassandra writer function
resource "google_service_account" "pubsub_to_cassandra_sa" {
  project      = var.gcp_project_id
  account_id   = "pubsub-to-cassandra-writer"
  display_name = "Pub/Sub to Cassandra Writer SA"
}

# Grant permission to read from the bundle bucket
resource "google_storage_bucket_iam_member" "cassandra_sa_bundle_reader" {
  bucket = google_storage_bucket.cassandra_secure_bundle.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.pubsub_to_cassandra_sa.email}"
}

# Allow the deployer to act as this service account
resource "google_service_account_iam_member" "deployer_act_as_cassandra_writer" {
  service_account_id = google_service_account.pubsub_to_cassandra_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.function_deployer.email}"
}

# Grant the deployer permission to write to the bundle bucket
resource "google_storage_bucket_iam_member" "deployer_bundle_writer" {
  bucket = google_storage_bucket.cassandra_secure_bundle.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.function_deployer.email}"
}

# Create a dedicated Service Account for manual invocation (testing)
resource "google_service_account" "cassandra_invoker_sa" {
  project      = var.gcp_project_id
  account_id   = "cassandra-writer-invoker-sa"
  display_name = "Service Account for Cassandra Writer Invoker"
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

output "cassandra_bundle_bucket" {
  value       = google_storage_bucket.cassandra_secure_bundle.name
  description = "The GCS bucket name for storing the Cassandra secure bundle."
}