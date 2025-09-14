# terraform/cloudrun_sensor_rest_proxy_v2.tf
#
# HTTP-only proxy function for memory-constrained ESP32-C3 boards.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# --- Create a dedicated Service Account for the HTTP REST Proxy Function Runtime ---
resource "google_service_account" "rest_proxy_v2_runtime_sa" {
  project      = var.gcp_project_id
  account_id   = "rest-proxy-v2-runtime-sa"
  display_name = "Runtime Service Account for HTTP REST to Pub/Sub Proxy v2"
}

# --- Grant the new runtime SA permission to publish to Pub/Sub ---
resource "google_project_iam_member" "rest_proxy_v2_runtime_pubsub_publisher" {
  project = var.gcp_project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.rest_proxy_v2_runtime_sa.email}"
}

# --- Allow the main function deployer to act as this new runtime SA ---
resource "google_service_account_iam_member" "deployer_act_as_rest_proxy_v2_runtime" {
  service_account_id = google_service_account.rest_proxy_v2_runtime_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.function_deployer.email}"
}

# Note: The Cloud Run service IAM binding is commented out because the service
# doesn't exist until the function is deployed via GitHub Actions.
# After the first deployment, you can uncomment this if needed:
#
# resource "google_cloud_run_service_iam_member" "allow_public_v2" {
#   project  = var.gcp_project_id
#   location = var.region
#   service  = "rest-to-pubsub-proxy-v2-function"
#   role     = "roles/run.invoker"
#   member   = "allUsers"
# }

# Note: Domain mapping is removed because Cloud Run domain mappings don't support
# path-based routing. The v2 endpoint will be available at:
# http://your-region-your-project.cloudfunctions.net/rest-to-pubsub-proxy-v2-function
#
# If you need custom domain mapping for the v2 function, you would need to:
# 1. Create a separate subdomain (e.g., api-v2.yourdomain.com)
# 2. Use a load balancer with path-based routing
# 3. Or handle routing within your application

# --- Outputs ---
output "rest_proxy_v2_runtime_sa_email" {
  value       = google_service_account.rest_proxy_v2_runtime_sa.email
  description = "The email of the runtime service account for the REST Proxy v2 function."
}

output "sensor_rest_proxy_v2_function_default_url" {
  value       = "http://${var.region}-${var.gcp_project_id}.cloudfunctions.net/rest-to-pubsub-proxy-v2-function"
  description = "The default HTTP URL of the deployed REST to Pub/Sub Proxy v2 Function."
}