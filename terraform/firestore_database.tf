# terraform/firestore_database.tf

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

# Step 1: Define the ruleset using the new resource type
resource "google_firebaserules_ruleset" "default_firestore_rules" {
  project = var.gcp_project_id
  source {
    files {
      # The name is arbitrary but required.
      name    = "firestore.rules"
      # The content of your rules file.
      content = <<-EOT
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            // By default, deny all reads and writes to ensure security
            match /{document=**} {
              allow read, write: if false;
            }

            // Allow public reads on the 'sensor_metadata' collection for your app.
            // In a real app, you would likely restrict this further,
            // for example: 'if request.auth != null;' for authenticated users.
            match /sensor_metadata/{sensorId} {
              allow read: if true;
              allow write: if false; // Disallow public writes
            }
            match /sunlight_readings/{readingId} {
              allow read: if true;
              allow write: if false; // Disallow public writes
            }
          }
        }
      EOT
    }
  }

  # This resource needs the firebaserules API to be enabled.
  depends_on = [
    google_project_service.apis
  ]
}

# Step 2: Create a "release" to apply the ruleset to Firestore
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

# Create a Firestore document for each object in the sensor_metadata.json file.
resource "google_firestore_document" "sensor_metadata" {
  # Use for_each to loop through the list of sensor objects from the JSON file.
  # We convert the list to a map where the key is the index of the element.
  for_each = { for i, sensor in local.sensor_metadata_list : i => sensor }

  project    = var.gcp_project_id
  collection = "sensor_metadata"

  # NOTE: The document ID must be unique. Since 'sensor_id' can be duplicated
  # in the source file, we append the map key (the original array index)
  # to ensure a unique ID for each document.
  document_id = "${each.value.sensor_id}-${each.key}"

  # The 'fields' argument expects a JSON string where each value is wrapped
  # in an object specifying its type (e.g., {"stringValue": "some_text"}).
  # We explicitly define the structure for each field from the source JSON.
  fields = jsonencode({
    "sensor_id"             = { "stringValue" : each.value.sensor_id },
    "position_x_ft"         = { "doubleValue" : each.value.position_x_ft },
    "position_y_ft"         = { "doubleValue" : each.value.position_y_ft },
    "board"                 = { "stringValue" : each.value.board },
    "has_display"           = { "booleanValue" : each.value.has_display },
    "sunlight_sensor_model" = { "stringValue" : each.value.sunlight_sensor_model },
    "display_model"         = { "stringValue" : each.value.display_model },
    "wifi_antenna"          = { "stringValue" : each.value.wifi_antenna }
  })

  # Ensure the Firestore database is ready before we try to add documents.
  depends_on = [
    google_firestore_database.database,
  ]
}

