# terraform/cloudrun_generate_test_pattern.tf
#
# Cloud function to generate and send a daily test data pattern.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Apache 2.0 Licensed as described in the file LICENSE

# --- Create a dedicated Service Account for the Test Pattern Function Runtime ---
resource "google_service_account" "test_pattern_runtime_sa" {
  project      = var.gcp_project_id
  account_id   = "test-pattern-runtime-sa"
  display_name = "Runtime Service Account for Test Pattern Generator"
}

# --- Allow the main function deployer to act as this new runtime SA ---
# This allows the GitHub Action to assign this service account during deployment.
resource "google_service_account_iam_member" "deployer_act_as_test_pattern_runtime" {
  service_account_id = google_service_account.test_pattern_runtime_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.function_deployer.email}"
}

# --- Create a dedicated Service Account for the Scheduler Job ---
resource "google_service_account" "daily_test_pattern_invoker_sa" {
  project      = var.gcp_project_id
  account_id   = "daily-test-pattern-invoker-sa"
  display_name = "Service Account for Daily Test Pattern Scheduler"
}

# --- Grant the Service Account permission to invoke the Cloud Function ---
resource "google_cloud_run_service_iam_member" "allow_test_pattern_invoker" {
  project  = var.gcp_project_id
  location = var.region
  service  = "daily-test-pattern-generator" # The name of the function deployed by the GitHub Action
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.daily_test_pattern_invoker_sa.email}"
}

# --- Define the Cloud Scheduler Job ---
resource "google_cloud_scheduler_job" "invoke_daily_test_pattern_generator" {
  project     = var.gcp_project_id
  name        = "daily-test-pattern-generator-trigger"
  region      = var.region
  schedule    = "0 2 * * *" # Runs every day at 2:00 AM
  time_zone   = "America/Chicago"
  description = "Triggers the daily test pattern data generator."

  http_target {
    # Construct the URI for the function deployed by the GitHub Action
    uri         = "https://${var.region}-${var.gcp_project_id}.cloudfunctions.net/daily-test-pattern-generator"
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.daily_test_pattern_invoker_sa.email
      # The 'audience' must match the URI of the function being called
      audience              = "https://${var.region}-${var.gcp_project_id}.cloudfunctions.net/daily-test-pattern-generator"
    }
  }

  depends_on = [
    google_cloud_run_service_iam_member.allow_test_pattern_invoker
  ]
}

# --- Outputs ---
output "test_pattern_runtime_sa_email" {
  value       = google_service_account.test_pattern_runtime_sa.email
  description = "The email of the runtime service account for the test pattern generator function."
}