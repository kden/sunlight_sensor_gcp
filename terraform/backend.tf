#
# Configure remote state storage in Google Cloud Storage
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
# Apache 2.0 Licensed as described in the file LICENSE

terraform {
  backend "gcs" {
    bucket = "sunlight-sensor-terraform-state"  # Create this bucket first
    prefix = "terraform/state"
  }
}

