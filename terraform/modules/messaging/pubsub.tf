/**
 * @file pubsub.tf
 *
 * Pub/Sub topics for sensor data messaging
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

# Create the Pub/Sub topic
resource "google_pubsub_topic" "sun_sensor_ingest" {
  project = var.gcp_project_id
  name    = "sun-sensor-ingest-topic"
}
