/**
 * @file variables.tf
 *
 * Foundation module variables
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

variable "gcp_project_id" {
  type        = string
  description = "The Google Cloud project ID"
}

variable "gcp_service_list" {
  type        = list(string)
  description = "List of GCP APIs to enable"
}
