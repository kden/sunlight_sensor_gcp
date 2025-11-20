/**
 * @file outputs.tf
 *
 * Centralized outputs for the sunlight sensor infrastructure
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

# Foundation outputs
output "project_number" {
  value       = module.foundation.project_number
  description = "The GCP project number"
}

# Messaging outputs
output "pubsub_topic_id" {
  value       = module.messaging.pubsub_topic_id
  description = "The Pub/Sub topic ID for sensor data"
}

output "pubsub_topic_name" {
  value       = module.messaging.pubsub_topic_name
  description = "The Pub/Sub topic name for sensor data"
}

# Database outputs
output "astra_database_id" {
  value       = module.database.astra_database_id
  description = "The Astra database ID"
}

output "astra_database_status" {
  value       = module.database.astra_database_status
  description = "The Astra database status"
}

output "astra_grafana_url" {
  value       = module.database.astra_grafana_url
  description = "The Astra Grafana monitoring URL"
}

output "bigquery_dataset_id" {
  value       = module.database.sunlight_dataset_id
  description = "The BigQuery dataset ID"
}

# Data pipeline outputs
output "metadata_bucket_name" {
  value       = module.data_pipeline.metadata_bucket_name
  description = "The GCS bucket containing sensor metadata"
}

# IAM outputs
output "cloud_run_deployer_sa_email" {
  value       = module.iam.cloud_run_deployer_sa_email
  description = "Service account email for Cloud Run deployment"
}

output "firebase_deployer_sa_email" {
  value       = module.iam.firebase_deployer_sa_email
  description = "Service account email for Firebase deployment"
}

output "workload_identity_provider" {
  value       = module.iam.workload_identity_provider
  description = "The workload identity provider name"
}
