# terraform/shared.tf

# Variable for your Google Cloud project ID
variable "project_id" {
  type        = string
  description = "The Google Cloud project ID to deploy resources into."
}

# Variable for the region
variable "region" {
  type        = string
  description = "The region to deploy resources into."
  default     = "us-central1"
}

variable "sensor_metadata_filename" {
  type        = string
  description = "Name of the JSON file containing sensor metadata."
}

# Load initial data from the JSON file
locals {
  sensor_metadata_path   = "${path.module}/${var.sensor_metadata_filename}"
  sensor_metadata_list   = fileexists(local.sensor_metadata_path) ? jsondecode(file(local.sensor_metadata_path)) : []
  sensor_metadata_exists = length(local.sensor_metadata_list) > 0

  # Convert the list of JSON objects into a single string of newline-delimited JSON,
  # which is the format required for BigQuery load jobs.
  sensor_metadata_ndjson = join("\n", [
    for obj in local.sensor_metadata_list : jsonencode(obj)
  ])
}