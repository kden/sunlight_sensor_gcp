/**
 * @file storage.tf
 *
 * Cloud Storage for sensor metadata
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

# Cloud Storage bucket for sensor metadata
resource "google_storage_bucket" "sensor_metadata_bucket" {
  project       = var.gcp_project_id
  name          = "${var.gcp_project_id}-sensor-metadata"
  location      = var.region
  force_destroy = true
}

# Upload sensor metadata to GCS
resource "google_storage_bucket_object" "sensor_metadata_file" {
  name    = var.sensor_metadata_filename
  bucket  = google_storage_bucket.sensor_metadata_bucket.name
  content = local.metadata_processing["sensor"].exists ? local.metadata_processing["sensor"].ndjson : ""
}

# Upload sensor set metadata to GCS
resource "google_storage_bucket_object" "sensor_set_metadata_file" {
  name    = var.sensor_set_metadata_filename
  bucket  = google_storage_bucket.sensor_metadata_bucket.name
  content = local.metadata_processing["sensor_set"].exists ? local.metadata_processing["sensor_set"].ndjson : ""
}
