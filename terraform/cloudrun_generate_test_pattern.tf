# terraform/cloudrun_generate_test_pattern.tf
#
# Cloud function to generate and send a daily test data pattern.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Apache 2.0 Licensed as described in the file LICENSE

# --- Archive the Python Source Code for the Test Pattern Function ---
data "archive_file" "generate_test_pattern_source_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/generate_test_pattern/src"
  output_path = "${path.module}/../.tmp/generate_test_pattern_source.zip"
  excludes = [
    "__pycache__/**"
  ]
}

variable "secret_bearer_token" {
  type        = string
  description = "The secret bearer token for authenticating requests."
  sensitive   = true # Marks the variable as sensitive to hide it in logs
}

# --- Upload the Zipped Python Source Code to the GCS Bucket ---
resource "google_storage_bucket_object" "generate_test_pattern_source_archive" {
  name   = "generate_test_pattern_source.zip#${data.archive_file.generate_test_pattern_source_zip.output_md5}"
  bucket = google_storage_bucket.cloudrun_function_source_shared_bucket.name
  source = data.archive_file.generate_test_pattern_source_zip.output_path
}

# --- 1. Define the Test Pattern Generator Cloud Function (2nd Gen) ---
resource "google_cloudfunctions2_function" "generate_test_pattern_function" {
  project  = var.gcp_project_id
  name     = "daily-test-pattern-generator"
  location = var.region

  build_config {
    runtime     = "python312"
    entry_point = "generate_and_send_data" # The name of the function in main.py
    source {
      storage_source {
        bucket = google_storage_bucket.cloudrun_function_source_shared_bucket.name
        object = google_storage_bucket_object.generate_test_pattern_source_archive.name
      }
    }
  }

  service_config {
    max_instance_count = 2
    min_instance_count = 0
    available_memory   = "512Mi" # Increased slightly for generating/holding records in memory
    timeout_seconds    = 300     # Increased timeout for requests
    environment_variables = {
      # Correctly builds the URL and uses your existing secret variable
      "SENSOR_API_URL" = "https://${var.sensor_target_api_domain_name}"
      "BEARER_TOKEN"   = var.secret_bearer_token
      "SENSOR_ID"      = "test_sensor"
    }
  }

  depends_on = [
    google_storage_bucket_object.generate_test_pattern_source_archive
  ]
}

# --- 2. Create a dedicated Service Account for the Scheduler Job ---
resource "google_service_account" "daily_test_pattern_invoker_sa" {
  project      = var.gcp_project_id
  account_id   = "daily-test-pattern-invoker-sa"
  display_name = "Service Account for Daily Test Pattern Scheduler"
}

# --- 3. Grant the Service Account permission to invoke the Cloud Function ---
resource "google_cloud_run_service_iam_member" "allow_test_pattern_invoker" {
  project  = google_cloudfunctions2_function.generate_test_pattern_function.project
  location = google_cloudfunctions2_function.generate_test_pattern_function.location
  service  = google_cloudfunctions2_function.generate_test_pattern_function.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.daily_test_pattern_invoker_sa.email}"
}

# --- 4. Define the Cloud Scheduler Job ---
resource "google_cloud_scheduler_job" "invoke_daily_test_pattern_generator" {
  project     = var.gcp_project_id
  name        = "daily-test-pattern-generator-trigger"
  region      = var.region
  schedule    = "0 2 * * *" # Runs every day at 2:00 AM
  time_zone   = "America/Chicago"
  description = "Triggers the daily test pattern data generator."

  http_target {
    uri         = google_cloudfunctions2_function.generate_test_pattern_function.service_config[0].uri
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.daily_test_pattern_invoker_sa.email
      audience              = google_cloudfunctions2_function.generate_test_pattern_function.service_config[0].uri
    }
  }

  depends_on = [
    google_cloud_run_service_iam_member.allow_test_pattern_invoker
  ]
}