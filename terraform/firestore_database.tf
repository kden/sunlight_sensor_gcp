# terraform/firestore_database.tf
#
# Define some document formats for the firestore database.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# Create the Firestore database instance
# You can never delete a Firestore database once created.  You would have to delete
# the entire Google Cloud project.
resource "google_firestore_database" "database" {
  project     = var.gcp_project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # Depends on the API being enabled
  depends_on = [
    google_project_service.apis,
  ]

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      location_id,
      type,
    ]
  }
}

resource "google_firestore_index" "sunlight_readings_index" {
  project    = var.gcp_project_id
  collection = "sunlight_readings"

  # This index applies to queries against a single collection.
  # Use "COLLECTION_GROUP" for collection group queries.
  query_scope = "COLLECTION"

  # Define the fields and their order for the index.
  # The order of these blocks matters.
  fields {
    field_path = "sensor_set_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "observation_minute"
    order      = "ASCENDING"
  }
}

resource "google_firestore_index" "hourly_weather_index" {
  project    = var.gcp_project_id
  collection = "hourly_weather"

  # This index applies to queries against a single collection.
  # Use "COLLECTION_GROUP" for collection group queries.
  query_scope = "COLLECTION"

  # Define the fields and their order for the index.
  # The order of these blocks matters.
  fields {
    field_path = "sensor_set_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "time"
    order      = "ASCENDING"
  }
}

resource "google_firebaserules_ruleset" "default_firestore_rules" {
  project = var.gcp_project_id
  source {
    files {
      name    = "firestore.rules"
      content = <<-EOT
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            // By default, deny all reads and writes to ensure security
            match /{document=**} {
              allow read, write: if false;
            }
            // Allow public reads on the 'sensor' collection for your app.
            match /sensor/{sensorId} {
              allow read: if true;
              allow write: if false; // Disallow public writes
            }
            match /sunlight_readings/{readingId} {
              allow read: if true;
              allow write: if false; // Disallow public writes
            }
            match /sensor_set_metadata/{setId} {
              allow read: if true;
              allow write: if false; // Disallow public writes
            }
            match /daily_weather/{dailyId} {
              allow read: if true;
              allow write: if false; // Disallow public writes
            }
            match /hourly_weather/{hourlyId} {
              allow read: if true;
              allow write: if false; // Disallow public writes
            }
          }
        }
      EOT
    }
  }
  depends_on = [
    google_project_service.apis
  ]
}

# Create a "release" to apply the ruleset to Firestore
resource "google_firebaserules_release" "default_firestore_rules_release" {
  project      = var.gcp_project_id
  ruleset_name = google_firebaserules_ruleset.default_firestore_rules.name

  # This name tells Firebase which service these rules are for.
  # For Cloud Firestore, it is always "cloud.firestore".
  # For Cloud Storage, it would be "firebase.storage".
  name         = "cloud.firestore"

  # Ensure the database and ruleset exist before creating the release.
  depends_on = [
    google_firestore_database.database,
    google_firebaserules_ruleset.default_firestore_rules,
  ]
}
# Create Firestore documents for sensor metadata
resource "google_firestore_document" "sensor" {
  for_each = {
    for doc in local.metadata_processing.sensor.list : doc.sensor_id => doc
  }

  project     = var.gcp_project_id
  database    = google_firestore_database.database.name
  collection  = "sensor"
  document_id = each.key
  fields = jsonencode({
    "sensor_id"             = { "stringValue" = each.value.sensor_id },
    "position_x_ft"         = { "doubleValue" = each.value.position_x_ft },
    "position_y_ft"         = { "doubleValue" = each.value.position_y_ft },
    "board"                 = { "stringValue" = each.value.board },
    "has_display"           = { "booleanValue" = each.value.has_display },
    "sunlight_sensor_model" = { "stringValue" = each.value.sunlight_sensor_model },
    "display_model"         = { "stringValue" = each.value.display_model },
    "wifi_antenna"          = { "stringValue" = each.value.wifi_antenna },
    "sensor_set_id"            = try(each.value.sensor_set_id, null) == null ? { "nullValue" = null } : { "stringValue" = each.value.sensor_set_id }
  })
}

# Create Firestore documents for sensor set metadata
resource "google_firestore_document" "sensor_set_metadata" {
  for_each = {
    for doc in local.metadata_processing.sensor_set.list : doc.sensor_set_id => doc
  }

  project     = var.gcp_project_id
  database    = google_firestore_database.database.name
  collection  = "sensor_set_metadata"
  document_id = each.key
  fields = jsonencode({
    "sensor_set_id" = { "stringValue" = each.value.sensor_set_id },
    "timezone"      = { "stringValue" = each.value.timezone }
    "latitude"      = { "doubleValue" = each.value.latitude }
    "longitude"     = { "doubleValue" = each.value.longitude }
  })
}