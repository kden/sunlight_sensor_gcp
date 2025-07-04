# terraform/apis.tf

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
    "firebasehosting.googleapis.com"
  ]
}

# This resource loops through the list above and enables each API
resource "google_project_service" "apis" {
  for_each = toset(var.gcp_service_list)

  project                    = var.project_id
  service                    = each.key
  disable_on_destroy         = false # Keep APIs enabled even if the project is destroyed
}
