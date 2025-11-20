#
# Defines roles and accounts for deployment of cloud run functions
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4.5 (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# Get project information
data "google_project" "project" {
  project_id = var.gcp_project_id
}

# --- Service Account for Cloud Function Deployment ---
resource "google_service_account" "function_deployer" {
  project      = var.gcp_project_id
  account_id   = "function-deployer"
  display_name = "GitHub Actions Function Deployer"
}

# It looks like Cloud Build impersonates the default service account during build phase, so it's currently
# going to cause an error if we revoke this permission.  We can look into creating (yet another) service account
# to isolate this, but I'm leaving it for now.
resource "google_service_account_iam_member" "function_deployer_act_as_compute_default" {
  service_account_id = "projects/${var.gcp_project_id}/serviceAccounts/${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.function_deployer.email}"
}

# --- Grant the Service Account permission to deploy Cloud Functions ---
resource "google_project_iam_member" "function_deployer_functions_admin" {
  project = var.gcp_project_id
  role    = "roles/cloudfunctions.admin"
  member  = "serviceAccount:${google_service_account.function_deployer.email}"
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
