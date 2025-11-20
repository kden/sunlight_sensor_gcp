# terraform/astra_database.tf
#
# Define Astra database and keyspace for sunlight sensor data
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from Claude Sonnet 4.5 (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# Create or reference existing Astra database
resource "astra_database" "sunlight_db" {
  name           = "sunlight-sensors"
  keyspace       = "sunlight_data"
  cloud_provider = "gcp"
  regions        = ["us-east1"]  # Free tier region for GCP
}

# Output database information





