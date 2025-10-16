# terraform/astra_tables.tf
#
# Define Cassandra tables for sunlight sensor data in Astra
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
# Apache 2.0 Licensed as described in the file LICENSE

# Raw sensor data table - optimized for time-series writes
resource "astra_table" "raw_sensor_data" {
  table       = "raw_sensor_data"
  keyspace    = astra_database.sunlight_db.keyspace
  database_id = astra_database.sunlight_db.id
  region      = "us-east1"

  clustering_columns = "timestamp:desc"
  partition_keys     = "sensor_id"

  column_definitions = [
    {
      name   = "sensor_id"
      type   = "text"
      static = "false"
    },
    {
      name   = "timestamp"
      type   = "timestamp"
      static = "false"
    },
    {
      name   = "sensor_set_id"
      type   = "text"
      static = "false"
    },
    {
      name   = "light_intensity"
      type   = "double"
      static = "false"
    },
    {
      name   = "ingestion_time"
      type   = "timestamp"
      static = "false"
    },
    {
      name   = "status"
      type   = "text"
      static = "false"
    },
    {
      name   = "battery_voltage"
      type   = "double"
      static = "false"
    },
    {
      name   = "battery_percent"
      type   = "int"
      static = "false"
    },
    {
      name   = "wifi_dbm"
      type   = "int"
      static = "false"
    }
  ]
}

# Sensor metadata table
resource "astra_table" "sensor_metadata" {
  table       = "sensor_metadata"
  keyspace    = astra_database.sunlight_db.keyspace
  database_id = astra_database.sunlight_db.id
  region      = "us-east1"

  clustering_columns = ""
  partition_keys     = "sensor_id"

  column_definitions = [
    {
      name   = "sensor_id"
      type   = "text"
      static = "false"
    },
    {
      name   = "sensor_set_id"
      type   = "text"
      static = "false"
    },
    {
      name   = "position_x_ft"
      type   = "double"
      static = "false"
    },
    {
      name   = "position_y_ft"
      type   = "double"
      static = "false"
    },
    {
      name   = "board"
      type   = "text"
      static = "false"
    },
    {
      name   = "has_display"
      type   = "boolean"
      static = "false"
    },
    {
      name   = "sunlight_sensor_model"
      type   = "text"
      static = "false"
    },
    {
      name   = "display_model"
      type   = "text"
      static = "false"
    },
    {
      name   = "wifi_antenna"
      type   = "text"
      static = "false"
    }
  ]
}

# Sensor set metadata table
resource "astra_table" "sensor_set_metadata" {
  table       = "sensor_set_metadata"
  keyspace    = astra_database.sunlight_db.keyspace
  database_id = astra_database.sunlight_db.id
  region      = "us-east1"

  clustering_columns = ""
  partition_keys     = "sensor_set_id"

  column_definitions = [
    {
      name   = "sensor_set_id"
      type   = "text"
      static = "false"
    },
    {
      name   = "timezone"
      type   = "text"
      static = "false"
    },
    {
      name   = "latitude"
      type   = "double"
      static = "false"
    },
    {
      name   = "longitude"
      type   = "double"
      static = "false"
    }
  ]
}