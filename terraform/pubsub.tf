# terraform/pubsub.tf

# Configure the Google Cloud provider
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.50.0"
    }
  }
}

# Variable for your Google Cloud project ID
variable "project_id" {
  type        = string
  description = "The Google Cloud project ID to deploy resources into."
}

# Variable for the region
variable "region" {
  type        = string
  description = "The region to deploy resources into."
  default     = "us-central1"
}

# Create the Pub/Sub topic
resource "google_pubsub_topic" "sun_sensor_ingest" {
  project = var.project_id
  name    = "sun-sensor-ingest-topic"
}

# Create a subscription for testing and verification
resource "google_pubsub_subscription" "sun_sensor_ingest_test_sub" {
  project = var.project_id
  name    = "sun-sensor-ingest-test-sub"
  topic   = google_pubsub_topic.sun_sensor_ingest.name

  # The message is kept for 1 day if not acknowledged
  message_retention_duration = "86400s"
  # After a message is pulled, it must be ack'd within 20 seconds
  ack_deadline_seconds = 20
}

# Output the topic name for reference
output "pubsub_topic_name" {
  value       = google_pubsub_topic.sun_sensor_ingest.name
  description = "The name of the created Pub/Sub topic."
}

# Output the subscription name for reference
output "pubsub_subscription_name" {
  value       = google_pubsub_subscription.sun_sensor_ingest_test_sub.name
  description = "The name of the created Pub/Sub subscription."
}
