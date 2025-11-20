#
# Cloud function to grab daily data from Open Meteo.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# --- Create a dedicated Service Account for the Open-Meteo Function Runtime ---
resource "google_service_account" "open_meteo_runtime_sa" {
  project      = var.gcp_project_id
  account_id   = "open-meteo-runtime-sa"
  display_name = "Runtime Service Account for Open-Meteo Importer"
}

# --- Grant the new runtime SA the necessary BigQuery permissions ---
resource "google_project_iam_member" "open_meteo_runtime_bq_user" {
  project = var.gcp_project_id
  role = "roles/bigquery.user" # Allows running queries
  member  = "serviceAccount:${google_service_account.open_meteo_runtime_sa.email}"
}

resource "google_project_iam_member" "open_meteo_runtime_bq_editor" {
  project = var.gcp_project_id
  role = "roles/bigquery.dataEditor" # Allows writing data
  member  = "serviceAccount:${google_service_account.open_meteo_runtime_sa.email}"
}

# --- Allow the main function deployer to act as this new runtime SA ---
# This is the key permission that allows the GitHub Action to assign this
# service account when it deploys the function.
resource "google_service_account_iam_member" "deployer_act_as_open_meteo_runtime" {
  service_account_id = google_service_account.open_meteo_runtime_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.function_deployer_email}"
}

# --- Create a dedicated Service Account for the Scheduler Job ---
# This is a best practice for security, ensuring the scheduler has only the
# permissions it needs to invoke the function.
resource "google_service_account" "daily_weather_invoker_sa" {
  project      = var.gcp_project_id
  account_id   = "daily-weather-invoker-sa"
  display_name = "Service Account for Daily Weather Importer Scheduler"
}

# --- Grant the Service Account permission to invoke the Cloud Function ---
# The "roles/run.invoker" role allows this service account to call the private
# Cloud Function.
resource "google_cloud_run_service_iam_member" "allow_open_meteo_weather_invoker" {
  project  = var.gcp_project_id
  location = var.region
  service = "daily-open-meteo-importer" # Use the hardcoded function name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.daily_weather_invoker_sa.email}"
}

# --- Define Scheduler Configurations in a Local Variable ---
# This map defines the unique properties for each scheduler job.
# The key of the map ('test', 'backyard') will be used for the sensor_set_id
# and to create a unique job name.
locals {
  weather_scheduler_configs = {
    test = {
      schedule = "0 1 * * *" # Runs at 1:00 AM
      description = "Triggers the daily Open-Meteo weather data import for the 'test' sensor set."
    },
    backyard = {
      schedule = "5 1 * * *" # Runs at 1:05 AM
      description = "Triggers the daily Open-Meteo weather data import for the 'backyard' sensor set."
    }
  }
}

# --- Define the Cloud Scheduler Jobs using for_each ---
# This single resource block will create a scheduler job for each entry in the
# local.weather_scheduler_configs map.
resource "google_cloud_scheduler_job" "invoke_daily_weather_importer" {
  for_each = local.weather_scheduler_configs

  project = var.gcp_project_id
  # Use each.key to create a unique name, e.g., "daily-open-meteo-importer-test"
  name        = "daily-open-meteo-importer-${each.key}"
  region      = var.region
  schedule    = each.value.schedule
  time_zone   = "America/Chicago"
  description = each.value.description

  # Configure the job to target an HTTP endpoint (our Cloud Function)
  http_target {
    # We construct the URI manually and append the sensor_set_id parameter.
    uri         = "https://${var.region}-${var.gcp_project_id}.cloudfunctions.net/daily-open-meteo-importer?sensor_set_id=${each.key}"
    http_method = "POST" # POST is standard for scheduler-triggered functions

    # This block configures authentication. The scheduler will use the service
    # account's identity to securely call the private function.
    oidc_token {
      service_account_email = google_service_account.daily_weather_invoker_sa.email
      # The 'audience' should be the URI of the function being called.
      audience = "https://${var.region}-${var.gcp_project_id}.cloudfunctions.net/daily-open-meteo-importer"
    }
  }

  depends_on = [
    google_cloud_run_service_iam_member.allow_open_meteo_weather_invoker
  ]
}

# --- Outputs ---
output "open_meteo_runtime_sa_email" {
  value       = google_service_account.open_meteo_runtime_sa.email
  description = "The email of the runtime service account for the Open-Meteo function."
}

