#
# Proxy function so that sensors don't have to use Pub/Sub authentication.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# --- Create a dedicated Service Account for the REST Proxy Function Runtime ---
resource "google_service_account" "rest_proxy_runtime_sa" {
  project      = var.gcp_project_id
  account_id   = "rest-proxy-runtime-sa"
  display_name = "Runtime Service Account for REST to Pub/Sub Proxy"
}

# --- Grant the new runtime SA permission to publish to Pub/Sub ---
resource "google_project_iam_member" "rest_proxy_runtime_pubsub_publisher" {
  project = var.gcp_project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.rest_proxy_runtime_sa.email}"
}

# --- Allow the main function deployer to act as this new runtime SA ---
# This allows the GitHub Action to assign this service account during deployment.
resource "google_service_account_iam_member" "deployer_act_as_rest_proxy_runtime" {
  service_account_id = google_service_account.rest_proxy_runtime_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.function_deployer_email}"
}

# --- Allow Public (Unauthenticated) Access to the Cloud Function ---
# This makes the function's default URL publicly accessible by targeting the underlying Cloud Run service.
resource "google_cloud_run_service_iam_member" "allow_public" {
  project  = var.gcp_project_id
  location = var.region
  # The service name is determined by the function name deployed via the GitHub Action
  service  = "rest-to-pubsub-proxy-function"
  role     = "roles/run.invoker"
  member   = "allUsers"
}


# --- Map Your Custom Domain to the underlying Cloud Run service ---
# This resource handles the domain mapping and SSL certificate provisioning for free.
resource "google_cloud_run_domain_mapping" "custom_domain_map" {
  project  = var.gcp_project_id
  location = var.region
  name     = var.sensor_target_api_domain_name

  metadata {
    namespace = var.gcp_project_id
  }

  spec {
    # Point the domain to the Cloud Function's underlying service name
    route_name = "rest-to-pubsub-proxy-function"
  }
}

# --- Outputs ---
output "dns_records_for_domain_mapping" {
  value       = google_cloud_run_domain_mapping.custom_domain_map.status[0].resource_records
  description = "The DNS records you need to add to your domain registrar to verify ownership and point the domain to Cloud Run."
}

output "rest_proxy_runtime_sa_email" {
  value       = google_service_account.rest_proxy_runtime_sa.email
  description = "The email of the runtime service account for the REST Proxy function."
}



