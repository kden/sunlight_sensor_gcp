# Create a dedicated service account for GitHub Actions to use for deployments.
resource "google_service_account" "github_actions_deployer" {
  project      = var.gcp_project_id
  account_id   = "github-actions-deployer"
  display_name = "GitHub Actions Deployer"
}

# Grant the service account the "Firebase Hosting Admin" role on the project.
# This gives it just enough permission to deploy new versions to Firebase Hosting.
resource "google_project_iam_member" "hosting_admin_binding" {
  project = var.gcp_project_id
  role    = "roles/firebasehosting.admin"
  member  = "serviceAccount:${google_service_account.github_actions_deployer.email}"
}

# Generate a JSON key for the service account.
# This key will be used to authenticate from the GitHub Actions workflow.
resource "google_service_account_key" "deployer_key" {
  service_account_id = google_service_account.github_actions_deployer.name
}

# --- IMPORTANT ---
# This output will display the generated service account key after you run 'terraform apply'.
# You must copy this value and save it as a secret in your GitHub repository.
# The key is sensitive and should be handled with care.
output "github_actions_service_account_key" {
  value = base64decode(google_service_account_key.deployer_key.private_key)
  # Mark the output as sensitive to prevent it from being shown in logs.
  sensitive = true
}
