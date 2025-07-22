-- terraform/queries/downsample_sunlight.sql.tpl
--
-- This query downsamples raw sunlight data to one-minute intervals.
-- It processes data incrementally by finding the last processed minute for each sensor
-- and selecting the FIRST data point from each subsequent minute.
--
-- Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
-- Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
-- Apache 2.0 Licensed as described in the file LICENSE

MERGE INTO `${project_id}.${dataset_id}.${destination_table}` AS T
USING (
  WITH
    -- Step 1: Find the latest processed minute for each sensor individually.
    -- This makes the pipeline resilient, as a single bad sensor won't stall others.
    last_processed_per_sensor AS (
      SELECT
        sensor_id,
        MAX(observation_minute) as last_observation
      FROM `${project_id}.${dataset_id}.${destination_table}`
      -- This guard is still a best practice to prevent a sensor from stalling itself.
      WHERE observation_minute < CURRENT_TIMESTAMP()
      GROUP BY sensor_id
    ),

    -- Step 2: Select the FIRST raw data point for each minute, for each sensor,
    -- starting from that sensor's specific last processed time.
    new_downsampled_data AS (
      SELECT
        observation_minute,
        sensor_id,
        sensor_set_id,
        light_intensity AS smoothed_light_intensity
      FROM (
        SELECT
          TIMESTAMP_TRUNC(raw.timestamp, MINUTE) AS observation_minute,
          raw.sensor_id,
          raw.sensor_set_id,
          raw.light_intensity,
          -- Assign a row number to each record within a given minute for each sensor, ordered by time.
          ROW_NUMBER() OVER(
            PARTITION BY raw.sensor_id, TIMESTAMP_TRUNC(raw.timestamp, MINUTE)
            ORDER BY raw.timestamp ASC
          ) as rn
        FROM `${project_id}.${dataset_id}.${source_table}` AS raw
        LEFT JOIN last_processed_per_sensor lps ON raw.sensor_id = lps.sensor_id
        WHERE
          -- Process data for each sensor starting after its own last observation time.
          -- If the sensor is new (lps.last_observation is NULL), COALESCE provides a default
          -- start time to process all of its historical data.
          raw.timestamp > COALESCE(lps.last_observation, TIMESTAMP('1970-01-01 00:00:00 UTC'))
      )
      -- Keep only the very first record for each minute.
      WHERE rn = 1
    )

  -- Final Step: Select the newly aggregated data to be merged.
  SELECT * FROM new_downsampled_data

) AS S
ON T.observation_minute = S.observation_minute AND T.sensor_id = S.sensor_id
WHEN MATCHED THEN
  UPDATE SET
    T.smoothed_light_intensity = S.smoothed_light_intensity,
    T.sensor_set_id = S.sensor_set_id,
    T.last_updated = CURRENT_TIMESTAMP()
WHEN NOT MATCHED BY TARGET THEN
  INSERT (observation_minute, sensor_id, smoothed_light_intensity, sensor_set_id, last_updated)
  VALUES (observation_minute, sensor_id, smoothed_light_intensity, sensor_set_id, CURRENT_TIMESTAMP());