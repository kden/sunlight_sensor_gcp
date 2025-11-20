/**
 * @file variables.tf
 *
 * Root module variable definitions
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

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

variable "region" {
  type        = string
  description = "The region to deploy resources into."
  default     = "us-central1"
}

variable "sunlight_app_domain_name" {
  type        = string
  description = "Web app domain name"
}

variable "sensor_target_api_domain_name" {
  type        = string
  description = "API for sensors to send data"
}

variable "sensor_metadata_filename" {
  type        = string
  description = "Name of the JSON file containing sensor metadata."
}

variable "sensor_set_metadata_filename" {
  type        = string
  description = "The path to the JSON file containing sensor set metadata."
}

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

variable "gcp_service_list" {
  description = "The list of apis to enable on the project."
  type        = list(string)
  default = [
    "cloudfunctions.googleapis.com",
    "pubsub.googleapis.com",
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "iam.googleapis.com",
    "storage.googleapis.com",
    "artifactregistry.googleapis.com",
    "bigquery.googleapis.com",
    "bigquerydatatransfer.googleapis.com",
    "firestore.googleapis.com",
    "firebase.googleapis.com",
    "firebaserules.googleapis.com",
    "firebasehosting.googleapis.com",
    "cloudscheduler.googleapis.com",
    "eventarc.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ]
}
