/**
 * @file variables.tf
 *
 * Database module variables
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

variable "sunlight_dataset_id" {
  type        = string
  description = "The BigQuery dataset ID"
}

variable "region" {
  type        = string
  description = "The GCP region"
}

variable "sensor_metadata_filename" {
  type        = string
  description = "Name of the JSON file containing sensor metadata"
}

variable "sensor_set_metadata_filename" {
  type        = string
  description = "Name of the JSON file containing sensor set metadata"
}

variable "pubsub_topic_name" {
  type        = string
  description = "The Pub/Sub topic name for incoming sensor messages"
}


# Define metadata processing locals
locals {
  metadata_filenames = {
    sensor     = { filename = var.sensor_metadata_filename },
    sensor_set = { filename = var.sensor_set_metadata_filename }
  }

  metadata_processing = {
    for key, config in local.metadata_filenames : key => {
      path   = "${path.root}/${config.filename}"
      list   = fileexists("${path.root}/${config.filename}") ? jsondecode(file("${path.root}/${config.filename}")) : []
      exists = length(fileexists("${path.root}/${config.filename}") ? jsondecode(file("${path.root}/${config.filename}")) : []) > 0
      ndjson = join("\n", [
        for obj in (fileexists("${path.root}/${config.filename}") ? jsondecode(file("${path.root}/${config.filename}")) : []) : jsonencode(obj)
      ])
    }
  }
}
