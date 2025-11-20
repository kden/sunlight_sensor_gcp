#
# Defines Service Accounts and IAM policies for CI/CD and other services.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE


# --- Service Account for Web App Deployment ---
resource "google_service_account" "webapp_deployer" {
  project      = var.gcp_project_id
  account_id   = "webapp-deployer"
  display_name = "GitHub Actions Web App Deployer"
}

# --- Grant the Service Account permission to deploy to Firebase Hosting ---
resource "google_project_iam_member" "webapp_deployer_firebase_admin" {
  project = var.gcp_project_id
  role    = "roles/firebasehosting.admin"
  member  = "serviceAccount:${google_service_account.webapp_deployer.email}"
}

resource "google_project_iam_member" "webapp_deployer_storage_admin" {
  project = var.gcp_project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.webapp_deployer.email}"
}

# --- Allow GitHub Actions to impersonate the webapp deployer SA ---
resource "google_service_account_iam_member" "webapp_deployer_wif_user" {
  service_account_id = google_service_account.webapp_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_pool.workload_identity_pool_id}/attribute.repository/${var.github_org}/${var.github_repo}"
  depends_on         = [google_iam_workload_identity_pool_provider.github_provider]
}
