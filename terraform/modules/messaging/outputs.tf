/**
 * @file outputs.tf
 *
 * Messaging module outputs
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

output "pubsub_topic_id" {
  value       = google_pubsub_topic.sun_sensor_ingest.id
  description = "The Pub/Sub topic ID"
}

output "pubsub_topic_name" {
  value       = google_pubsub_topic.sun_sensor_ingest.name
  description = "The Pub/Sub topic name"
}
