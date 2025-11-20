#
# Resources for defining the React webapp on Firebase.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# Register the React web application with Firebase.
# This creates the "app" that you will see in the Firebase console
# and generates the client-side configuration.
resource "google_firebase_web_app" "default" {
  # This resource is also in the beta provider, which you already have configured.
  provider       = google-beta
  project        = var.gcp_project_id
  display_name   = "Sunlight Web App"

  depends_on = [
    # Ensure the project is configured for Firebase before creating an app.
    google_firebase_project.default
  ]
}

# Data source to fetch the configuration of the web app we just created.
data "google_firebase_web_app_config" "default" {
  provider   = google-beta
  project    = var.gcp_project_id
  web_app_id = google_firebase_web_app.default.app_id
}

# Output the client-side Firebase configuration as a JSON string.
# This is the value you will use for the REACT_APP_FIREBASE_CONFIG secret.
output "firebase_web_app_config" {
  value = jsonencode({
    apiKey            = data.google_firebase_web_app_config.default.api_key
    authDomain        = data.google_firebase_web_app_config.default.auth_domain
    projectId         = var.gcp_project_id
    storageBucket     = data.google_firebase_web_app_config.default.storage_bucket
    messagingSenderId = data.google_firebase_web_app_config.default.messaging_sender_id
    appId             = google_firebase_web_app.default.app_id
    measurementId     = data.google_firebase_web_app_config.default.measurement_id
  })
  sensitive = true
}


