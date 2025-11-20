/**
 * @file outputs.tf
 *
 * Compute module outputs
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

output "sensor_rest_proxy_function_default_url" {
  value       = "https://${var.region}-${var.gcp_project_id}.cloudfunctions.net/rest-to-pubsub-proxy-function"
  description = "The default URL of the deployed REST to Pub/Sub Proxy Function."
}

