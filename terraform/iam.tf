# terraform/iam.tf
#
# Defines Service Accounts and IAM policies for CI/CD and other services.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# --- Workload Identity Federation Pool ---
# This creates the pool to manage identities from external providers like GitHub.
# This single pool can be used by all workflows in your repository.
resource "google_iam_workload_identity_pool" "github_pool" {
  project                   = var.gcp_project_id
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Pool for GitHub Actions CI/CD"

  depends_on = [google_project_service.apis]
}

# --- Workload Identity Federation Provider ---
# This creates the provider that establishes the trust relationship with GitHub.
resource "google_iam_workload_identity_pool_provider" "github_provider" {
  project                            = var.gcp_project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Actions Provider"
  description                        = "OIDC provider for GitHub Actions"

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.repository_owner" = "assertion.repository_owner"
    "attribute.repository"       = "assertion.repository"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
  attribute_condition = "assertion.repository_owner=='${var.github_org}'"
  depends_on = [google_iam_workload_identity_pool.github_pool]
}


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

# --- Allow GitHub Actions to impersonate the Web App Deployer SA ---
resource "google_service_account_iam_member" "webapp_deployer_wif_user" {
  service_account_id = google_service_account.webapp_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_pool.workload_identity_pool_id}/attribute.subject/repo:${var.github_org}/${var.github_repo}:*"
  depends_on         = [google_iam_workload_identity_pool_provider.github_provider]
}

# --- Service Account for Cloud Function Deployment ---
resource "google_service_account" "function_deployer" {
  project      = var.gcp_project_id
  account_id   = "function-deployer"
  display_name = "GitHub Actions Function Deployer"
}

# --- Grant the Service Account permission to deploy Cloud Functions ---
resource "google_project_iam_member" "function_deployer_functions_developer" {
  project = var.gcp_project_id
  role    = "roles/cloudfunctions.developer"
  member  = "serviceAccount:${google_service_account.function_deployer.email}"
}

# --- Allow the Function Deployer SA to act as the runtime service account ---
# This is required for Cloud Functions (Gen 2) deployments. The permission
# must be granted on the service account resource itself for this API check.
resource "google_service_account_iam_member" "function_deployer_service_account_user" {
  service_account_id = google_service_account.function_deployer.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.function_deployer.email}"
}

# --- Grant the Function Deployer SA permission to create tokens for itself ---
# This is required by the deployment API when a runtime service account is specified.
# This role grants the 'iam.serviceAccounts.getAccessToken' permission.
resource "google_service_account_iam_member" "function_deployer_token_creator" {
  service_account_id = google_service_account.function_deployer.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.function_deployer.email}"
}

# --- Allow GitHub Actions to impersonate the Function Deployer SA ---
resource "google_service_account_iam_member" "function_deployer_wif_user" {
  service_account_id = google_service_account.function_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_pool.workload_identity_pool_id}/attribute.repository/${var.github_org}/${var.github_repo}"
  depends_on         = [google_iam_workload_identity_pool_provider.github_provider]
}


# --- Outputs ---

output "webapp_deployer_email" {
  value       = google_service_account.webapp_deployer.email
  description = "The email of the service account for deploying the web app (GCP_SERVICE_ACCOUNT_EMAIL_WEBAPP)."
}

output "function_deployer_email" {
  value       = google_service_account.function_deployer.email
  description = "The email of the service account for deploying Cloud Functions (GCP_SERVICE_ACCOUNT_EMAIL_FUNCTIONS)."
}

output "workload_identity_provider" {
  value       = google_iam_workload_identity_pool_provider.github_provider.name
  description = "The full name of the Workload Identity Provider for the GCP_WORKLOAD_IDENTITY_PROVIDER GitHub secret."
}