/**
 * @file outputs.tf
 *
 * Data pipeline module outputs
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

output "metadata_bucket_name" {
  value       = google_storage_bucket.sensor_metadata_bucket.name
  description = "The GCS bucket name for metadata"
}

output "sensor_metadata_object" {
  value       = google_storage_bucket_object.sensor_metadata_file.name
  description = "The sensor metadata object name"
}

output "sensor_set_metadata_object" {
  value       = google_storage_bucket_object.sensor_set_metadata_file.name
  description = "The sensor set metadata object name"
}
