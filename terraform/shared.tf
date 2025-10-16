# terraform/shared.tf

# Variable for your Google Cloud project ID
variable "gcp_project_id" {
  type        = string
  description = "The Google Cloud project ID to deploy resources into."
}

variable "github_org" {
  type        = string
  description = "Your GitHub organization or username."
}

variable "github_repo" {
  type        = string
  description = "The name of your GitHub repository."
}

variable "dataset_id" {
  type        = string
  description = "The BigQuery dataset ID to store data in."
  default     = "sunlight_data"
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

variable "sensor_set_metadata_filename" {
  type        = string
  description = "The path to the JSON file containing sensor set metadata."
}

# Define a map of all metadata filenames. This makes it easy to add more in the future.
locals {
  metadata_filenames = {
    sensor     = { filename = var.sensor_metadata_filename },
    sensor_set = { filename = var.sensor_set_metadata_filename }
  }

  # Use a for_each loop to dynamically generate locals for each metadata type.
  # This avoids duplicating the file loading and processing logic.
  metadata_processing = {
    for key, config in local.metadata_filenames : key => {
      path   = "${path.module}/${config.filename}"
      list   = fileexists("${path.module}/${config.filename}") ? jsondecode(file("${path.module}/${config.filename}")) : []
      exists = length(fileexists("${path.module}/${config.filename}") ? jsondecode(file("${path.module}/${config.filename}")) : []) > 0
      ndjson = join("\n", [
        for obj in (fileexists("${path.module}/${config.filename}") ? jsondecode(file("${path.module}/${config.filename}")) : []) : jsonencode(obj)
      ])
    }
  }
}

# --- Data source to get the current project's number ---
data "google_project" "project" {
  project_id = var.gcp_project_id
}

# --- Variable for your notification email ---
variable "alert_email_address" {
  type        = string
  description = "The destination email address for alerts."
}

variable "alert_phone_number" {
  type        = string
  description = "The destination E.164 phone number for SMS alerts (e.g., +15551234567)."
  sensitive   = true
}

variable "astra_token" {
  type        = string
  description = "Datastax Astra authentication token"
  sensitive   = true
}