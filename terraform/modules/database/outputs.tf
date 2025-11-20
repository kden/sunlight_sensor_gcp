/**
 * @file outputs.tf
 *
 * Database module outputs
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

output "astra_database_id" {
  value       = astra_database.sunlight_db.id
  description = "The Astra database ID"
}

output "astra_database_status" {
  value       = astra_database.sunlight_db.status
  description = "The Astra database status"
}

output "astra_grafana_url" {
  value       = astra_database.sunlight_db.grafana_url
  description = "The Astra Grafana monitoring URL"
}

output "astra_keyspace" {
  value       = astra_database.sunlight_db.keyspace
  description = "The Astra keyspace name"
}

output "sunlight_dataset_id" {
  value       = google_bigquery_dataset.sunlight_dataset.dataset_id
  description = "The BigQuery dataset ID"
}

output "raw_sensor_data_table_id" {
  value       = "${google_bigquery_table.sunlight_table.project}.${google_bigquery_table.sunlight_table.dataset_id}.${google_bigquery_table.sunlight_table.table_id}"
  description = "Fully qualified BigQuery table for raw sensor data"
}
