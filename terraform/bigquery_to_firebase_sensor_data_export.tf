# terraform/bigquery_to_firebase_sensor_data_export.tf
#
# Define the resources to export sensor data from BigQuery to Firestore.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE



# 1. Service Account for the Cloud Function
# This gives the function a dedicated identity with specific permissions.
resource "google_service_account" "bq_to_firestore_sensors_sa" {
  project      = var.gcp_project_id
  account_id   = "bq-to-fs-sensors-exporter"
  display_name = "BigQuery to Firebase Sensor Data Exporter SA"
}

# 2. Permissions for the Service Account
# It needs to read from BigQuery and write to Firestore (which uses datastore permissions).
resource "google_project_iam_member" "bq_to_firestore_sensors_sa_bq_viewer" {
  project = var.gcp_project_id
  role    = "roles/bigquery.dataViewer"
  member  = google_service_account.bq_to_firestore_sensors_sa.member
}

resource "google_project_iam_member" "bq_to_firestore_sensors_sa_bq_job_user" {
  project = var.gcp_project_id
  role    = "roles/bigquery.jobUser"
  member  = google_service_account.bq_to_firestore_sensors_sa.member
}

resource "google_project_iam_member" "bq_to_firestore_sensors_sa_firestore_user" {
  project = var.gcp_project_id
  role    = "roles/datastore.user"
  member  = google_service_account.bq_to_firestore_sensors_sa.member
}

# 3. Pub/Sub Topic to trigger the function
resource "google_pubsub_topic" "bq_to_firestore_sensors_trigger" {
  project = var.gcp_project_id
  name    = "bq-to-firebase-trigger"
}

# 4. Cloud Scheduler to run the job
resource "google_cloud_scheduler_job" "bq_to_firestore_sensors_scheduler" {
  project   = var.gcp_project_id
  region    = var.region
  name      = "bq-to-firebase-job"
  schedule  = "* * * * *" # Runs every minute
  time_zone = "UTC"
  description = "Transfers sensor data from BigQuery to Firebase."


  pubsub_target {
    topic_name = google_pubsub_topic.bq_to_firestore_sensors_trigger.id
    data       = base64encode("Run")
  }

  depends_on = [
    google_project_service.apis
  ]
}

# 5. The Cloud Function
# This resource points to a local directory containing the Python code.
resource "google_cloudfunctions2_function" "bq_to_firestore_sensors_exporter" {
  project  = var.gcp_project_id
  name     = "bq-to-fs-sensor-data-exporter"
  location = var.region

  build_config {
    runtime     = "python311"
    entry_point = "export_sensors_to_firestore"
    source {
      storage_source {
        bucket = google_storage_bucket.bq_to_fb_function_source_bucket.name
        object = google_storage_bucket_object.bq_to_fb_function_source_object.name
      }
    }
  }

  service_config {
    max_instance_count = 1
    service_account_email = google_service_account.bq_to_firestore_sensors_sa.email
    ingress_settings    = "ALLOW_ALL" # For Pub/Sub triggers
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.bq_to_firestore_sensors_trigger.id
    retry_policy   = "RETRY_POLICY_RETRY"
  }

  depends_on = [
    google_project_iam_member.bq_to_firestore_sensors_sa_bq_viewer,
    google_project_iam_member.bq_to_firestore_sensors_sa_firestore_user,
    google_project_iam_member.bq_to_firestore_sensors_sa_bq_job_user,
    google_project_service.apis
  ]
}

# 6. Cloud Storage for the function's source code
# Terraform needs to upload the local code files to a bucket.
resource "google_storage_bucket" "bq_to_fb_function_source_bucket" {
  project      = var.gcp_project_id
  name         = "${var.gcp_project_id}-bq-to-firebase-source"
  location     = "US" # Or your multi-region of choice
  force_destroy = true
}

resource "google_storage_bucket_object" "bq_to_fb_function_source_object" {
  # Appending the MD5 hash of the archive to the object name.
  # This creates a new, unique object name whenever the source code changes,
  # which forces Terraform to redeploy the Cloud Function.
  name   = "firebase_export_source-${data.archive_file.firebase_export_function_source.output_md5}.zip"
  bucket = google_storage_bucket.bq_to_fb_function_source_bucket.name
  source = data.archive_file.firebase_export_function_source.output_path
}

data "archive_file" "firebase_export_function_source" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/bq_to_firestore_sensors/src"
  output_path = "${path.module}/../functions/bq_to_firestore_sensors/firebase_export_source.zip"
}
