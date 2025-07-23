# terraform/monitoring.tf
#
# Defines Log-based Alerting to monitor sensor status messages and send
# email/SMS notifications. The function itself is deployed via CI/CD.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# --- Variable for your notification email ---
variable "alert_email_address" {
  type        = string
  description = "The destination email address for alerts."
}

variable "alert_phone_number" {
  type        = string
  description = "The destination E.164 phone number for SMS alerts (e.g., +15551234567)."
  sensitive   = true
}

# --- 1. Create a Notification Channel ---
# This defines where the alert notifications will be sent.
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

# --- 2. Create a Log-based Metric ---
# This counts the number of log entries that match our specific alert filter.
resource "google_logging_metric" "sensor_status_alerts" {
  project = var.gcp_project_id
  name    = "sensor_status_alert_count"
  filter  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"sensor-status-monitor-function\" AND jsonPayload.log_name=\"sensor_status_alert\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    # A label to track which sensor sent the alert
    labels {
      key         = "sensor_id"
      value_type  = "STRING"
      description = "The ID of the sensor sending a status alert"
    }
    labels {
      key         = "sensor_set_id"
      value_type  = "STRING"
      description = "The ID of the sensor set sending a status alert"
    }
    # A label to hold the actual status message
    labels {
      key         = "status" # Renamed for consistency
      value_type  = "STRING"
      description = "The status message content from the log"
    }
  }

  # The extractor to populate the new labels from the log payload
  label_extractors = {
    "sensor_id"     = "EXTRACT(jsonPayload.sensor_id)"
    "sensor_set_id" = "EXTRACT(jsonPayload.sensor_set_id)"
    "status"        = "EXTRACT(jsonPayload.status)"
  }
}

# --- 3. Create the Alerting Policy ---
# This watches the metric and triggers an alert if it sees any matching logs.
resource "google_monitoring_alert_policy" "status_alert_policy" {
  project      = var.gcp_project_id
  display_name = "Sensor Status Alert"
  combiner     = "OR"

  # The conditions for triggering the alert
  conditions {
    display_name = "A sensor has reported a status update"
    condition_threshold {
      # This filter points to the log-based metric we just created.
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.sensor_status_alerts.name}\" AND resource.type=\"cloud_run_revision\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      trigger {
        count = 1
      }
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_COUNT"
      }
    }
  }

  documentation {
    # Use Markdown for rich formatting in emails.
    mime_type = "text/markdown"

    # This subject is used for the email subject and the body of SMS messages.
    subject = "SENSOR ALERT: Sensor $${metric.label.sensor_id} reports: $${metric.label.status}"

    # HEREDOC for a clean, multi-line Markdown message body.
    # Note: $${...} is used to escape the variables for Terraform, so Google Cloud can substitute them.
    content = <<-EOT
      ## 🚨 Sensor Status Alert

      A sensor has reported a new status.

      **Details:**
      - **Project ID:** `$${project.id}`
      - **Sensor ID:** `$${metric.label.sensor_id}`
      - **Sensor Set:** `$${metric.label.sensor_set_id}`
      - **Reported Status:** `$${metric.label.status}`

      **Next Steps:**
      - View Logs for this Sensor
      - View Alert Policy
    EOT
  }

  # Link the policy to our notification channels.
  notification_channels = [
    google_monitoring_notification_channel.email_channel.id,
    google_monitoring_notification_channel.sms_channel.id,
  ]
}

# --- 5. Create a generalized Log-based Metric for All Sensor Pings ---
# This counts "ping" log entries and extracts the sensor_id as a label,
# creating a separate time series for each sensor automatically.
resource "google_logging_metric" "sensor_ping_count" {
  project = var.gcp_project_id
  name    = "sensor_ping_count"

  # The filter now pings from ANY sensor, EXCLUDING the 'test' set.
  filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"sensor-status-monitor-function\" AND jsonPayload.log_name=\"sensor_status_ping\" AND jsonPayload.sensor_set_id != \"test\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    labels {
      key         = "sensor_id"
      value_type  = "STRING"
      description = "The ID of the sensor sending a ping"
    }
    # A label for the sensor set ID.
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
# --- 6. Create a generalized Alerting Policy for Ping Absence ---
# This watches all sensor ping streams and triggers if any one of them is
# absent for 15 minutes.
resource "google_monitoring_alert_policy" "ping_absence_alert_policy" {
  project      = var.gcp_project_id
  display_name = "Sensor Ping Absence Alert" # Generic display name
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
    subject = "SENSOR OFFLINE: Sensor $${metric.label.sensor_id} has stopped sending pings."

    # Use a HEREDOC for a clean, multi-line Markdown message body.
    content = <<-EOT
      ## 🔕 Sensor Ping Absence Alert

      A sensor has not sent a ping for over 15 minutes and may be offline.

      **Details:**
      - **Project ID:** `$${project.id}`
      - **Sensor ID:** `$${metric.label.sensor_id}`
      - **Sensor Set:** `$${metric.label.sensor_set_id}`
      - **Last Seen:** More than 15 minutes ago.

      **Next Steps:**
      - View Pings for this Sensor
      - View Alert Policy
    EOT
  }

  # Link the policy to our existing email notification channel.
  notification_channels = [
    google_monitoring_notification_channel.email_channel.id,
    google_monitoring_notification_channel.sms_channel.id,
  ]
}