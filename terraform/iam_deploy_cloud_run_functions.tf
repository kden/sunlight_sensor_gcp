# terraform/iam_deploy_cloud_run_functions.tf
#
# Defines roles and accounts for deployment of cloud run functions
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# --- Service Account for Cloud Function Deployment ---
resource "google_service_account" "function_deployer" {
  project      = var.gcp_project_id
  account_id   = "function-deployer"
  display_name = "GitHub Actions Function Deployer"
}

# --- Grant the Service Account permission to deploy Cloud Functions ---
resource "google_project_iam_member" "function_deployer_functions_developer" {
  project = var.gcp_project_id
  role    = "roles/cloudfunctions.admin"
  member  = "serviceAccount:${google_service_account.function_deployer.email}"
}

# --- Allow Function Deployer SA to act as the Function Runtime SA ---
resource "google_service_account_iam_member" "function_deployer_act_as_runtime" {
  service_account_id = google_service_account.function_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.function_deployer.email}"
}

resource "google_project_iam_member" "function_deployer_iam_viewer" {
  project = var.gcp_project_id
  role    = "roles/iam.serviceAccountViewer"
  member  = "serviceAccount:${google_service_account.function_deployer.email}"
}

# --- Allow GitHub Actions to impersonate the Function Deployer SA ---
resource "google_service_account_iam_member" "function_deployer_wif_user" {
  service_account_id = google_service_account.function_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_pool.workload_identity_pool_id}/attribute.repository/${var.github_org}/${var.github_repo}"
  depends_on         = [google_iam_workload_identity_pool_provider.github_provider]
}

# Additional permissions for Gen2 Cloud Functions deployment
resource "google_project_iam_member" "function_deployer_run_developer" {
  project = var.gcp_project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.function_deployer.email}"
}

resource "google_project_iam_member" "function_deployer_eventarc_admin" {
  project = var.gcp_project_id
  role    = "roles/eventarc.admin"
  member  = "serviceAccount:${google_service_account.function_deployer.email}"
}

resource "google_project_iam_member" "function_deployer_storage_admin" {
  project = var.gcp_project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.function_deployer.email}"
}


resource "google_project_iam_member" "function_deployer_pubsub_admin" {
  project = var.gcp_project_id
  role    = "roles/pubsub.admin"
  member  = "serviceAccount:${google_service_account.function_deployer.email}"
}

# --- Service Account for Cloud Function Runtime ---
resource "google_service_account" "function_runtime" {
  project      = var.gcp_project_id
  account_id   = "function-runtime"
  display_name = "Cloud Function Runtime Service Account"
}

resource "google_project_iam_member" "function_runtime_logging" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.function_runtime.email}"
}

resource "google_project_iam_member" "function_runtime_pubsub" {
  project = var.gcp_project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.function_runtime.email}"
}

# --- Outputs ---
output "function_deployer_email" {
  value       = google_service_account.function_deployer.email
  description = "The email of the service account for deploying Cloud Functions (GCP_SERVICE_ACCOUNT_EMAIL_FUNCTIONS)."
}

output "function_runtime_email" {
  value       = google_service_account.function_runtime.email
  description = "The email of the service account for deploying Cloud Functions (GCP_SERVICE_ACCOUNT_EMAIL_FUNCTIONS)."
}
