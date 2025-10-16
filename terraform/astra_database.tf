# terraform/astra_database.tf
#
# Define Astra database and keyspace for sunlight sensor data
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# Create or reference existing Astra database
resource "astra_database" "sunlight_db" {
  name           = "sunlight-sensors"
  keyspace       = "sunlight_data"
  cloud_provider = "gcp"
  regions        = ["us-east1"]  # Free tier region for GCP
}

# Output database information
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