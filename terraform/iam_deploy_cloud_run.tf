# terraform/iam_workload_identity_pool.tf
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

# Would rather not use this since we have a custom service account
resource "google_service_account_iam_member" "webapp_deployer_act_as_compute_default" {
  service_account_id = "projects/${var.gcp_project_id}/serviceAccounts/${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.webapp_deployer.email}"
}

# --- Grant the Service Account permission to deploy to Firebase Hosting ---
resource "google_project_iam_member" "webapp_deployer_firebase_admin" {
  project = var.gcp_project_id
  role    = "roles/firebasehosting.admin"
  member  = "serviceAccount:${google_service_account.webapp_deployer.email}"
}


# --- Allow GitHub Actions to impersonate the Web App Deployer SA ---
resource "google_service_account_iam_member" "webapp_deployer_wif_user" {
  service_account_id = google_service_account.webapp_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_pool.workload_identity_pool_id}/attribute.subject/repo:${var.github_org}/${var.github_repo}:*"
  depends_on         = [google_iam_workload_identity_pool_provider.github_provider]
}

resource "google_service_account_iam_member" "webapp_deployer_token_creator" {
  service_account_id = google_service_account.webapp_deployer.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_pool.workload_identity_pool_id}/attribute.subject/repo:${var.github_org}/${var.github_repo}:*"
  depends_on         = [google_iam_workload_identity_pool_provider.github_provider]
}

output "webapp_deployer_email" {
  value       = google_service_account.webapp_deployer.email
  description = "The email of the service account for deploying the web app (GCP_SERVICE_ACCOUNT_EMAIL_WEBAPP)."
}

