# terraform/pubsub.tf

# Create the Pub/Sub topic
resource "google_pubsub_topic" "sun_sensor_ingest" {
  project = var.gcp_project_id
  name    = "sun-sensor-ingest-topic"
}

# Output the topic name for reference
output "pubsub_topic_name" {
  value       = google_pubsub_topic.sun_sensor_ingest.name
  description = "The name of the created Pub/Sub topic."
}
