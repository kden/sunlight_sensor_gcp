resource "google_bigquery_table" "daily_historical_weather" {
  dataset_id = google_bigquery_dataset.sunlight_dataset.dataset_id
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
    "name": "precipitation_hour",
    "type": "FLOAT",
    "mode": "NULLABLE",
    "description": "The number of hours with precipitation."
  },
  {
    "name": "data_source",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The source of the weather data."
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
  }
]
EOF

  deletion_protection = false # Set to true in production
}