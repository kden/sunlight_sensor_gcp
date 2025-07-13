# terraform/apis.tf
#
# Install all of the Google Cloud Platform APIs we need.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# A list of all APIs our project needs to function
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
  ]
}

# This resource loops through the list above and enables each API
resource "google_project_service" "apis" {
  for_each = toset(var.gcp_service_list)

  project                    = var.gcp_project_id
  service                    = each.key
  disable_on_destroy         = false # Keep APIs enabled even if the project is destroyed
}
