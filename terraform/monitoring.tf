# terraform/monitoring.tf
#
# Defines Log-based Alerting to monitor sensor ping absence only.
# Status notifications are now sent directly by the Cloud Function.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
# Apache 2.0 Licensed as described in the file LICENSE


# --- 1. Create Notification Channels for CRITICAL alerts only ---
# (Status notifications are now handled directly by the Cloud Function)
resource "google_monitoring_notification_channel" "email_channel" {
  project      = var.gcp_project_id
  display_name = "Sensor Alert Email"
  type         = "email"
  labels = {
    email_address = var.alert_email_address
  }
}

resource "google_monitoring_notification_channel" "sms_channel" {
  project      = var.gcp_project_id
  display_name = "Sensor Alert SMS"
  type         = "sms"
  labels = {
    number = var.alert_phone_number
  }
}

# --- 2. Create Log-based Metrics for Sensor Data ---

# Metric 1: Count of ping events (for absence detection)
resource "google_logging_metric" "sensor_ping_count" {
  project = var.gcp_project_id
  name    = "sensor_ping_count"

  # The filter for pings from ANY sensor, EXCLUDING the 'test' set.
  filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"sensor-status-monitor-function\" AND jsonPayload.log_name=\"sensor_status_ping\" AND jsonPayload.sensor_set_id != \"test\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    labels {
      key         = "sensor_id"
      value_type  = "STRING"
      description = "The ID of the sensor sending a ping"
    }
    labels {
      key         = "sensor_set_id"
      value_type  = "STRING"
      description = "The set ID of the sensor sending a ping"
    }
  }

  # This block tells the metric how to populate the labels.
  label_extractors = {
    "sensor_id"     = "EXTRACT(jsonPayload.sensor_id)"
    "sensor_set_id" = "EXTRACT(jsonPayload.sensor_set_id)"
  }
}

# Metric 2: Count data point events, weighted by the number of points (alternative approach)
# This creates a custom metric that we can populate from the Cloud Function
resource "google_logging_metric" "sensor_data_points" {
  project = var.gcp_project_id
  name    = "sensor_data_points_received"

  # Filter for a special log entry that the function will create for data points
  filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"sensor-status-monitor-function\" AND jsonPayload.log_name=\"sensor_data_point_metric\" AND jsonPayload.sensor_set_id != \"test\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    labels {
      key         = "sensor_id"
      value_type  = "STRING"
      description = "The ID of the sensor sending data points"
    }
    labels {
      key         = "sensor_set_id"
      value_type  = "STRING"
      description = "The set ID of the sensor sending data points"
    }
  }

  # Extract the data_point_count from the log message
  label_extractors = {
    "sensor_id"     = "EXTRACT(jsonPayload.sensor_id)"
    "sensor_set_id" = "EXTRACT(jsonPayload.sensor_set_id)"
  }
}

# --- 3. Create Alerting Policy for Ping Absence ONLY ---
# This watches all sensor ping streams and triggers if any one of them is
# absent for 15 minutes. This IS treated as a critical incident.
resource "google_monitoring_alert_policy" "ping_absence_alert_policy" {
  project      = var.gcp_project_id
  display_name = "Sensor Ping Absence Alert"
  combiner     = "OR"

  # The conditions for triggering the alert
  conditions {
    display_name = "A sensor has not sent a data point in 15 minutes"
    # This block defines an "absence" alert.
    condition_absent {
      filter   = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.sensor_ping_count.name}\" AND resource.type=\"cloud_run_revision\" AND metric.label.sensor_set_id != \"test\""
      duration = "900s" # 15 minutes
      trigger {
        count = 1
      }
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_COUNT"
      }
    }
  }

  # Use a structured documentation block for rich, actionable notifications.
  documentation {
    # Use Markdown for rich formatting in emails.
    mime_type = "text/markdown"

    # This subject is used for the email subject and the body of SMS messages.
    subject = "🚨 SENSOR OFFLINE: Sensor $${metric.label.sensor_id} has stopped sending pings."

    # Use a HEREDOC for a clean, multi-line Markdown message body.
    content = <<-EOT
      ## 🔕 Sensor Ping Absence Alert

      A sensor has not sent a ping for over 15 minutes and may be offline.

      **Details:**
      - **Project ID:** `$${resource.label.project_id}`
      - **Sensor ID:** `$${metric.label.sensor_id}`
      - **Sensor Set:** `$${metric.label.sensor_set_id}`
      - **Last Seen:** More than 15 minutes ago.

      **Next Steps:**
      - View Pings for this Sensor
      - View Alert Policy
    EOT
  }

  # Link the policy to both critical notification channels (email + SMS)
  notification_channels = [
    google_monitoring_notification_channel.email_channel.id,
    google_monitoring_notification_channel.sms_channel.id,
  ]
}
