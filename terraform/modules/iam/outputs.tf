/**
 * @file outputs.tf
 *
 * IAM module outputs
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

output "cloud_run_deployer_sa_email" {
  value       = google_service_account.function_deployer.email
  description = "Cloud Run deployer service account email"
}

output "firebase_deployer_sa_email" {
  value       = google_service_account.webapp_deployer.email
  description = "Firebase deployer service account email"
}

output "workload_identity_provider" {
  value       = google_iam_workload_identity_pool_provider.github_provider.name
  description = "Workload identity provider name"
}
