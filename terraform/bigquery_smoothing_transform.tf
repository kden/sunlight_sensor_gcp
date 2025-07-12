resource "google_bigquery_table" "downsampled_sunlight_table" {
  dataset_id = google_bigquery_dataset.sunlight_dataset.dataset_id
  table_id   = "downsampled_sunlight_data"
  project    = var.gcp_project_id

  time_partitioning {
    type  = "DAY"
    field = "observation_minute"
  }
  clustering = ["sensor_id", "sensor_set_id"]

  # UPDATED: Schema is now defined using a heredoc for consistency.
  schema = <<EOF
[
  {
    "name": "observation_minute",
    "type": "TIMESTAMP",
    "mode": "REQUIRED"
  },
  {
    "name": "sensor_id",
    "type": "STRING",
    "mode": "REQUIRED"
  },
  {
    "name": "smoothed_light_intensity",
    "type": "FLOAT",
    "mode": "NULLABLE"
  },
  {
    "name": "sensor_set_id",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The set of sensors this metadata belongs to"
  }
]
EOF

  deletion_protection = false # Set to true in production
}

resource "google_bigquery_data_transfer_config" "downsample_sunlight_transfer" {
  project                = var.gcp_project_id
  display_name           = "downsample_sunlight_transfer: Incremental Downsample Sunlight Data (LOCF)"
  location               = "US" # Or your preferred location
  data_source_id         = "scheduled_query"
  schedule               = "every hour"
  destination_dataset_id = google_bigquery_dataset.sunlight_dataset.dataset_id
  service_account_name   = google_service_account.bq_transfer_sa.email

  params = {
    # UPDATED: The query now joins with metadata to include the sensor_set_idcolumn.
    query = <<-EOT
    MERGE INTO `${var.gcp_project_id}.${var.dataset_id}.${google_bigquery_table.downsampled_sunlight_table.table_id}` AS T
    USING (
      WITH
      -- Step 1: Get the last known state for EACH sensor.
      sensor_state AS (
        SELECT
          sensor_id,
          -- Get the last known data point and its timestamp at the same time.
          ARRAY_AGG(
            STRUCT(observation_minute, smoothed_light_intensity, sensor_set)
            ORDER BY
              observation_minute DESC
            LIMIT 1
          ) [OFFSET(0)] AS last_data
        FROM
          `${var.gcp_project_id}.${var.dataset_id}.${google_bigquery_table.downsampled_sunlight_table.table_id}`
        GROUP BY
          sensor_id
      ),

      -- Step 2: Get only the raw data that has arrived since each sensor's last run.
      new_raw_data AS (
        SELECT
          raw.timestamp,
          raw.sensor_id,
          raw.light_intensity,
          raw.sensor_set_id-- Include sensor_set_idfrom the transformed table
        FROM
          `${var.gcp_project_id}.${var.dataset_id}.${google_bigquery_table.transformed_sunlight_table.table_id}` AS raw
        LEFT JOIN
          sensor_state
          ON raw.sensor_id = sensor_state.sensor_id
        WHERE
          raw.timestamp >= COALESCE(sensor_state.last_data.observation_minute, TIMESTAMP('1970-01-01 00:00:00+00:00'))
      ),

      -- Step 3: Combine new and old data, which may create duplicates at the boundary.
      combined_data_with_dupes AS (
        SELECT
          TIMESTAMP_TRUNC(timestamp, MINUTE) as observation_minute,
          sensor_id,
          sensor_set,
          AVG(light_intensity) as light_intensity,
          1 as priority -- new data gets higher priority
        FROM
          new_raw_data
        GROUP BY
          observation_minute,
          sensor_id,
          sensor_set_id
        UNION ALL
        SELECT
          s.last_data.observation_minute,
          s.sensor_id,
          s.last_data.sensor_set,
          s.last_data.smoothed_light_intensity as light_intensity,
          2 as priority -- old data gets lower priority
        FROM
          sensor_state s
        WHERE s.last_data.observation_minute IS NOT NULL
      ),
      combined_data AS (
        SELECT observation_minute, sensor_id, sensor_set, light_intensity FROM (
            SELECT *, ROW_NUMBER() OVER(PARTITION BY observation_minute, sensor_id ORDER BY priority ASC) as rn
            FROM combined_data_with_dupes
        ) WHERE rn = 1
      ),

      -- Step 4: Create a complete timeline of minutes to fill the gaps.
      minute_series AS (
        SELECT minute_from_array AS observation_minute
        FROM
          (
            SELECT MIN(observation_minute) as min_ts, MAX(observation_minute) as max_ts
            FROM combined_data WHERE observation_minute IS NOT NULL
          ),
          UNNEST(GENERATE_TIMESTAMP_ARRAY(TIMESTAMP_TRUNC(min_ts, MINUTE), TIMESTAMP_TRUNC(max_ts, MINUTE), INTERVAL 1 MINUTE)) AS minute_from_array
      ),
      scaffold AS (
        SELECT
          m.observation_minute,
          s.sensor_id,
          s.sensor_set_id        FROM
          minute_series m
          CROSS JOIN (SELECT DISTINCT sensor_id, sensor_set_idFROM new_raw_data) s
      ),
      data_gapped AS (
        SELECT
          s.observation_minute,
          s.sensor_id,
          s.sensor_set,
          c.light_intensity
        FROM
          scaffold s
          LEFT JOIN combined_data c ON s.sensor_id = c.sensor_id AND s.observation_minute = c.observation_minute
      ),

      -- Step 5: Find the last known data point for each gap.
      gaps_with_boundaries AS (
        SELECT
          observation_minute,
          sensor_id,
          sensor_set,
          light_intensity,
          LAST_VALUE(IF(light_intensity IS NOT NULL, STRUCT(light_intensity, sensor_set), NULL) IGNORE NULLS) OVER (PARTITION BY sensor_id ORDER BY observation_minute) as last_point
        FROM
          data_gapped
      )

      -- Final Subquery Step: Select the original value or carry the last known value forward (LOCF).
      SELECT
        observation_minute,
        sensor_id,
        COALESCE(light_intensity, last_point.light_intensity) AS smoothed_light_intensity,
        COALESCE(sensor_set, last_point.sensor_set) AS sensor_set_id      FROM
        gaps_with_boundaries
      WHERE last_point.light_intensity IS NOT NULL

    ) AS S
    ON T.observation_minute = S.observation_minute AND T.sensor_id = S.sensor_id
    WHEN MATCHED THEN
      UPDATE SET T.smoothed_light_intensity = S.smoothed_light_intensity, T.sensor_set_id= S.sensor_set_id
    WHEN NOT MATCHED BY TARGET THEN
      INSERT (observation_minute, sensor_id, smoothed_light_intensity, sensor_set)
      VALUES (observation_minute, sensor_id, smoothed_light_intensity, sensor_set);
    EOT
  }

  depends_on = [
    # Ensure permissions are granted before creating the transfer
    google_project_iam_member.bq_transfer_sa_data_editor,
    google_project_iam_member.bq_transfer_sa_job_user,
  ]
}