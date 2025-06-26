# terraform/cloudrun.tf

# --- Variables ---
variable "custom_domain_name" {
  type        = string
  description = "The custom domain to use, e.g., 'api.yourdomain.com'."
}

variable "secret_bearer_token" {
  type        = string
  description = "The secret bearer token for authenticating requests."
  sensitive   = true # Marks the variable as sensitive to hide it in logs
}


# --- Create a GCS Bucket to Store the Service's Source Code ---
resource "google_storage_bucket" "source_bucket" {
  project      = var.project_id
  name         = "${var.project_id}-cloudrun-source"
  location     = var.region
  force_destroy = true
  uniform_bucket_level_access = true
}

# --- Create a Zip Archive of the Source Code ---
data "archive_file" "source_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../src"
  output_path = "${path.module}/../.tmp/source.zip"
}

# --- Upload the Zipped Source Code to the GCS Bucket ---
resource "google_storage_bucket_object" "source_archive" {
  name   = "source.zip#${data.archive_file.source_zip.output_md5}"
  bucket = google_storage_bucket.source_bucket.name
  source = data.archive_file.source_zip.output_path
}

# --- 1. Define the Cloud Function (2nd Gen) ---
# We revert to this resource as it correctly handles building from source.
resource "google_cloudfunctions2_function" "proxy_function" {
  project  = var.project_id
  name     = "rest-to-pubsub-proxy-function"
  location = var.region

  # Configuration for building the function from source
  build_config {
    runtime     = "python311"
    entry_point = "proxy_to_pubsub"
    source {
      storage_source {
        bucket = google_storage_bucket.source_bucket.name
        object = google_storage_bucket_object.source_archive.name
      }
    }
  }

  # Configuration for the running service
  service_config {
    max_instance_count = 1
    available_memory   = "256Mi"
    timeout_seconds    = 60
    # Set environment variables for the function
    environment_variables = {
      "GCP_PROJECT"         = var.project_id # <-- ADDED THIS LINE
      "TOPIC_ID"            = google_pubsub_topic.sun_sensor_ingest.name
      "SECRET_BEARER_TOKEN" = var.secret_bearer_token
    }
  }
}


# --- 2. Allow Public (Unauthenticated) Access to the Cloud Function ---
# This makes the function's default URL publicly accessible by targeting the underlying Cloud Run service.
resource "google_cloud_run_service_iam_member" "allow_public" {
  project  = google_cloudfunctions2_function.proxy_function.project
  location = google_cloudfunctions2_function.proxy_function.location
  service  = google_cloudfunctions2_function.proxy_function.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}


# --- 3. Map Your Custom Domain to the underlying Cloud Run service ---
# This resource handles the domain mapping and SSL certificate provisioning for free.
resource "google_cloud_run_domain_mapping" "custom_domain_map" {
  project  = var.project_id
  location = var.region
  name     = var.custom_domain_name

  metadata {
    namespace = var.project_id
  }

  spec {
    # Point the domain to the Cloud Function's underlying service name
    route_name = google_cloudfunctions2_function.proxy_function.name
  }
}

# --- Outputs ---
output "dns_records_for_domain_mapping" {
  value       = google_cloud_run_domain_mapping.custom_domain_map.status[0].resource_records
  description = "The DNS records you need to add to your domain registrar to verify ownership and point the domain to Cloud Run."
}

output "function_default_url" {
  value       = google_cloudfunctions2_function.proxy_function.service_config[0].uri
  description = "The default URL of the deployed Cloud Function."
}
