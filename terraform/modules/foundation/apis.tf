# terraform/apis.tf
#
# Install all of the Google Cloud Platform APIs we need.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# This resource loops through the list above and enables each API
resource "google_project_service" "apis" {
  for_each = toset(var.gcp_service_list)

  project                    = var.gcp_project_id
  service                    = each.key
  disable_on_destroy         = false # Keep APIs enabled even if the project is destroyed
}
