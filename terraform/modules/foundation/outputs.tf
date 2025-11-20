/**
 * @file outputs.tf
 *
 * Foundation module outputs
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

data "google_project" "project" {
  project_id = var.gcp_project_id
}

output "project_number" {
  value       = data.google_project.project.number
  description = "The GCP project number"
}
