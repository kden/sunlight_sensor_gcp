#
# Create a table for historical weather information in BigQuery
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE

resource "google_bigquery_table" "daily_historical_weather" {
  dataset_id = var.sunlight_dataset_id
  table_id   = "daily_historical_weather"
  project    = var.gcp_project_id

  time_partitioning {
    type  = "DAY"
    field = "date"
  }

  schema = <<EOF
[
  {
    "name": "date",
    "type": "DATE",
    "mode": "REQUIRED",
    "description": "The date of the weather record."
  },
  {
    "name": "sunrise",
    "type": "TIMESTAMP",
    "mode": "NULLABLE",
    "description": "The sunrise time in ISO 8601 format."
  },
  {
    "name": "sunset",
    "type": "TIMESTAMP",
    "mode": "NULLABLE",
    "description": "The sunset time in ISO 8601 format."
  },
  {
    "name": "daylight_duration",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "The duration of daylight in seconds."
  },
  {
    "name": "sunshine_duration",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "The duration of sunshine in seconds."
  },
  {
    "name": "temperature_2m_max",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Maximum daily temperature at 2 meters above ground in Celsius."
  },
  {
    "name": "temperature_2m_min",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Minimum daily temperature at 2 meters above ground in Celsius."
  },
  {
    "name": "uv_index_max",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Maximum daily UV index."
  },
  {
    "name": "uv_index_clear_sky_max",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Maximum daily UV index on a clear sky day."
  },
  {
    "name": "rain_sum",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Sum of daily rain in millimeters."
  },
  {
    "name": "showers_sum",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Sum of daily showers in millimeters."
  },
  {
    "name": "precipitation_sum",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Sum of daily precipitation in millimeters."
  },
  {
    "name": "snowfall_sum",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Sum of daily snowfall in centimeters."
  },
  {
    "name": "precipitation_hours",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "The number of hours with precipitation."
  },
  {
    "name": "sensor_set_id",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "Sensor set ID of the weather location."
  },
  {
    "name": "timezone",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "Timezone of the weather location."
  },
  {
    "name": "latitude",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Latitude of weather location."
  },
  {
    "name": "longitude",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "Longitude of weather location."
  },
  {
    "name": "data_source",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The source of the weather data."
  },
  {
    "name": "last_updated",
    "type": "TIMESTAMP",
    "mode": "NULLABLE",
    "description": "The UTC timestamp when the record was last inserted or updated."
  }
]
EOF

  deletion_protection = false # Set to true in production
}

# This table will store the more granular, hourly data points from Open-Meteo.
resource "google_bigquery_table" "hourly_historical_weather" {
  dataset_id = var.sunlight_dataset_id
  table_id   = "hourly_historical_weather"
  project    = var.gcp_project_id

  time_partitioning {
    type  = "DAY"
    field = "time" # Partition by the timestamp of the reading
  }

  schema = <<EOF
[
  { "name": "time", "type": "TIMESTAMP", "mode": "REQUIRED", "description": "The timestamp of the hourly weather record." },
  { "name": "sensor_set_id", "type": "STRING", "mode": "REQUIRED", "description": "The sensor set ID for the weather location." },
  { "name": "temperature_2m", "type": "FLOAT", "mode": "NULLABLE", "description": "Temperature at 2 meters above ground in Celsius." },
  { "name": "precipitation", "type": "FLOAT", "mode": "NULLABLE", "description": "Sum of precipitation in millimeters for the hour." },
  { "name": "relative_humidity_2m", "type": "FLOAT", "mode": "NULLABLE", "description": "Relative humidity at 2 meters in percent." },
  { "name": "cloud_cover", "type": "FLOAT", "mode": "NULLABLE", "description": "Fraction of the sky obscured by clouds in percent." },
  { "name": "visibility", "type": "FLOAT", "mode": "NULLABLE", "description": "Horizontal visibility in meters." },
  { "name": "soil_temperature_0cm", "type": "FLOAT", "mode": "NULLABLE", "description": "Soil temperature at the surface in Celsius." },
  { "name": "soil_moisture_1_to_3cm", "type": "FLOAT", "mode": "NULLABLE", "description": "Soil moisture at 1-3cm depth in m³/m³." },
  { "name": "uv_index", "type": "FLOAT", "mode": "NULLABLE", "description": "UV index." },
  { "name": "uv_index_clear_sky", "type": "FLOAT", "mode": "NULLABLE", "description": "UV index on a clear sky day." },
  { "name": "shortwave_radiation", "type": "FLOAT", "mode": "NULLABLE", "description": "Shortwave solar radiation in W/m²." },
  { "name": "direct_radiation", "type": "FLOAT", "mode": "NULLABLE", "description": "Direct solar radiation in W/m²." },
  { "name": "wind_speed_10m", "type": "FLOAT", "mode": "NULLABLE", "description": "Wind speed at 10 meters above ground in km/h." },
  { "name": "timezone", "type": "STRING", "mode": "NULLABLE", "description": "Timezone of the weather location." },
  { "name": "latitude", "type": "FLOAT", "mode": "NULLABLE", "description": "Latitude of weather location." },
  { "name": "longitude", "type": "FLOAT", "mode": "NULLABLE", "description": "Longitude of weather location." },
  { "name": "data_source", "type": "STRING", "mode": "NULLABLE", "description": "The source of the weather data." },
  { "name": "last_updated", "type": "TIMESTAMP", "mode": "NULLABLE", "description": "The UTC timestamp when the record was last updated." }
]
EOF

  deletion_protection = false # Set to true in production
}

