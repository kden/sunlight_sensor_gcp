# terraform/cloudrun_open_meteo_functions.tf
#
# Cloud function to grab daily data from Open Meteo.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# --- Archive the Go Source Code for the Open-Meteo Function ---
data "archive_file" "open_meteo_source_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/daily_open_meteo"
  output_path = "${path.module}/../.tmp/daily_open_meteo_source.zip"
  excludes = [
    ".idea/**"
  ]
}

# --- Upload the Zipped Go Source Code to the GCS Bucket ---
# This reuses the bucket defined in 'cloudrun_sensor_rest_proxy.tf'
resource "google_storage_bucket_object" "daily_open_meteo_source_archive" {
  # The name includes the MD5 hash to ensure a new object is created when the source changes.
  name   = "daily_open_meteo_source.zip#${data.archive_file.open_meteo_source_zip.output_md5}"
  bucket = google_storage_bucket.cloudrun_function_source_shared_bucket.name
  source = data.archive_file.open_meteo_source_zip.output_path
}

# --- 1. Define the Open-Meteo Cloud Function (2nd Gen) ---
resource "google_cloudfunctions2_function" "open_meteo_daily_importer_function" {
  project  = var.gcp_project_id
  name     = "daily-open-meteo-importer"
  location = var.region

  # Configuration for building the function from the Go source
  build_config {
    runtime     = "go123" # As specified for your Go function
    entry_point = "DailyWeatherer" # The name of the exported function in your Go code
    source {
      storage_source {
        bucket = google_storage_bucket.cloudrun_function_source_shared_bucket.name
        object = google_storage_bucket_object.daily_open_meteo_source_archive.name
      }
    }
  }

  # Configuration for the running service
  service_config {
    max_instance_count = 2 # Can be adjusted based on expected load
    min_instance_count = 0 # Set to 0 to scale to zero and save costs
    available_memory   = "256Mi"
    timeout_seconds    = 120 # Increased timeout for API calls and BigQuery writes
    # Set environment variables required by the function
    environment_variables = {
      "GCP_PROJECT" = var.gcp_project_id
    }
    # The service account needs roles/bigquery.user and roles/bigquery.dataEditor
    # Ensure the default service account has these permissions or specify a different one.
  }

  depends_on = [
    google_storage_bucket_object.daily_open_meteo_source_archive
  ]
}

# --- Outputs ---
output "open_meteo_importer_url" {
  value       = google_cloudfunctions2_function.open_meteo_daily_importer_function.service_config[0].uri
  description = "The default URL of the deployed Open-Meteo daily importer function."
}

# --- 1. Create a dedicated Service Account for the Scheduler Job ---
# This is a best practice for security, ensuring the scheduler has only the
# permissions it needs to invoke the function.
resource "google_service_account" "daily_weather_invoker_sa" {
  project      = var.gcp_project_id
  account_id   = "daily-weather-invoker-sa"
  display_name = "Service Account for Daily Weather Importer Scheduler"
}

# --- 2. Grant the Service Account permission to invoke the Cloud Function ---
# The "roles/run.invoker" role allows this service account to call the private
# Cloud Function.
resource "google_cloud_run_service_iam_member" "allow_weather_invoker" {
  project  = google_cloudfunctions2_function.open_meteo_daily_importer_function.project
  location = google_cloudfunctions2_function.open_meteo_daily_importer_function.location
  service  = google_cloudfunctions2_function.open_meteo_daily_importer_function.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.daily_weather_invoker_sa.email}"
}

# --- 3. Define the Cloud Scheduler Job ---
resource "google_cloud_scheduler_job" "invoke_daily_weather_importer" {
  project  = var.gcp_project_id
  name     = "daily-open-meteo-importer-trigger"
  region   = var.region
  schedule = "0 1 * * *" # Runs every day at 1:00 AM
  time_zone = "America/Chicago" # Timezone for the schedule
  description = "Triggers the daily Open-Meteo weather data import for the 'test' sensor set."

  # Configure the job to target an HTTP endpoint (our Cloud Function)
  http_target {
    # The URI of the Cloud Function to invoke.
    # We append the sensor_set_id parameter here. The function will handle the date range.
    uri = "${google_cloudfunctions2_function.open_meteo_daily_importer_function.service_config[0].uri}?sensor_set_id=test"
    http_method = "POST" # POST is standard for scheduler-triggered functions

    # This block configures authentication. The scheduler will use the service
    # account's identity to securely call the private function.
    oidc_token {
      service_account_email = google_service_account.daily_weather_invoker_sa.email
      # The 'audience' should be the URI of the function being called.
      audience = google_cloudfunctions2_function.open_meteo_daily_importer_function.service_config[0].uri
    }
  }

  depends_on = [
    google_cloud_run_service_iam_member.allow_weather_invoker
  ]
}
