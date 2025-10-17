# terraform/astra_tables.tf
#
# Define Cassandra tables for sunlight sensor data in Astra
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
# Apache 2.0 Licensed as described in the file LICENSE

## DO NOT DELETE THE FOLLOWING COMMENT:
## PAY ATTENTION TO LIFECYCLE RULES, if you need to add a column you may need to disable and reenable them.
## Without the lifecycle rules the tables will be recreated on every terraform apply because of issues with the Astra provider.
## Or you'll need to add them manually via CQL or the Astra UI, and Terraform will ignore those changes.

# Raw sensor data table - optimized for time-series writes
resource "astra_table" "raw_sensor_data" {
  table              = "raw_sensor_data"
  keyspace           = astra_database.sunlight_db.keyspace
  database_id        = astra_database.sunlight_db.id
  region             = astra_database.sunlight_db.regions[0]
  clustering_columns = "timestamp:desc"
  partition_keys     = "sensor_id"

  column_definitions = [
    {
      Name : "sensor_id"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "timestamp"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "sensor_set_id"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "light_intensity"
      Static : false
      TypeDefinition : "double"
    },
    {
      Name : "ingestion_time"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "status"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "battery_voltage"
      Static : false
      TypeDefinition : "double"
    },
    {
      Name : "battery_percent"
      Static : false
      TypeDefinition : "int"
    },
    {
      Name : "wifi_dbm"
      Static : false
      TypeDefinition : "int"
    },
    {
      Name : "chip_temp_c"
      Static : false
      TypeDefinition : "double"
    },
    {
      Name : "chip_temp_f"
      Static : false
      TypeDefinition : "double"
    },
    {
      Name : "commit_sha"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "commit_timestamp"
      Static : false
      TypeDefinition : "text"
    }
  ]

  lifecycle {
    ignore_changes = all
  }
}

# Latest reading cache - one row per sensor with most recent data
resource "astra_table" "sensor_latest_reading" {
  table              = "sensor_latest_reading"
  keyspace           = astra_database.sunlight_db.keyspace
  database_id        = astra_database.sunlight_db.id
  region             = astra_database.sunlight_db.regions[0]
  clustering_columns = ""
  partition_keys     = "sensor_id"

  column_definitions = [
    {
      Name : "sensor_id"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "sensor_set_id"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "timestamp"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "light_intensity"
      Static : false
      TypeDefinition : "double"
    },
    {
      Name : "light_intensity_timestamp"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "status"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "status_timestamp"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "battery_voltage"
      Static : false
      TypeDefinition : "double"
    },
    {
      Name : "battery_voltage_timestamp"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "battery_percent"
      Static : false
      TypeDefinition : "int"
    },
    {
      Name : "battery_percent_timestamp"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "wifi_dbm"
      Static : false
      TypeDefinition : "int"
    },
    {
      Name : "wifi_dbm_timestamp"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "chip_temp_c"
      Static : false
      TypeDefinition : "double"
    },
    {
      Name : "chip_temp_c_timestamp"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "chip_temp_f"
      Static : false
      TypeDefinition : "double"
    },
    {
      Name : "chip_temp_f_timestamp"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "commit_sha"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "commit_sha_timestamp"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "commit_timestamp"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "commit_timestamp_timestamp"
      Static : false
      TypeDefinition : "timestamp"
    },
    {
      Name : "last_seen"
      Static : false
      TypeDefinition : "timestamp"
    }
  ]

  lifecycle {
    ignore_changes = all
  }
}

# Sensor metadata table
resource "astra_table" "sensor_metadata" {
  table              = "sensor_metadata"
  keyspace           = astra_database.sunlight_db.keyspace
  database_id        = astra_database.sunlight_db.id
  region             = astra_database.sunlight_db.regions[0]
  clustering_columns = ""
  partition_keys     = "sensor_id"

  column_definitions = [
    {
      Name : "sensor_id"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "sensor_set_id"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "position_x_ft"
      Static : false
      TypeDefinition : "double"
    },
    {
      Name : "position_y_ft"
      Static : false
      TypeDefinition : "double"
    },
    {
      Name : "board"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "has_display"
      Static : false
      TypeDefinition : "boolean"
    },
    {
      Name : "sunlight_sensor_model"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "display_model"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "wifi_antenna"
      Static : false
      TypeDefinition : "text"
    }
  ]

  lifecycle {
    ignore_changes = all
  }
}

# Sensor set metadata table
resource "astra_table" "sensor_set_metadata" {
  table              = "sensor_set_metadata"
  keyspace           = astra_database.sunlight_db.keyspace
  database_id        = astra_database.sunlight_db.id
  region             = astra_database.sunlight_db.regions[0]
  clustering_columns = ""
  partition_keys     = "sensor_set_id"

  column_definitions = [
    {
      Name : "sensor_set_id"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "timezone"
      Static : false
      TypeDefinition : "text"
    },
    {
      Name : "latitude"
      Static : false
      TypeDefinition : "double"
    },
    {
      Name : "longitude"
      Static : false
      TypeDefinition : "double"
    }
  ]

  lifecycle {
    ignore_changes = all
  }
}