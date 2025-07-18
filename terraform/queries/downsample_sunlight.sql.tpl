-- terraform/queries/downsample_sunlight.sql.tpl
--
-- This query downsamples raw sunlight data to one-minute intervals using
-- Last Observation Carried Forward (LOCF). It is designed to be run
-- incrementally and processes data in manageable, fixed-size chunks to
-- handle large backlogs without hitting resource limits.
--
-- Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
-- Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
-- Apache 2.0 Licensed as described in the file LICENSE

MERGE INTO `${project_id}.${dataset_id}.${destination_table}` AS T
USING (
  WITH
  -- Step 1: Define the time window for this processing run.
  -- This prevents the query from failing on large backlogs by processing data in chunks.
  processing_window AS (
    SELECT
      -- The start of the window is the latest minute we have successfully processed.
      -- If the destination is empty, we start from the earliest data in the source table.
      COALESCE(
        (SELECT TIMESTAMP_TRUNC(MAX(observation_minute), MINUTE) FROM `${project_id}.${dataset_id}.${destination_table}`),
        (SELECT TIMESTAMP_TRUNC(MIN(timestamp), MINUTE) FROM `${project_id}.${dataset_id}.${source_table}`)
      ) AS window_start
  ),
  -- The end of the window is 30 days after the start, or the latest data available, whichever is earlier.
  capped_window AS (
    SELECT
      p.window_start,
      LEAST(
        TIMESTAMP_ADD(p.window_start, INTERVAL 30 DAY),
        -- FIX: Add one second to the max timestamp to make the window inclusive
        -- of the very last data point when using a '<' comparison later.
        TIMESTAMP_ADD((SELECT MAX(timestamp) FROM `${project_id}.${dataset_id}.${source_table}`), INTERVAL 1 SECOND)
      ) AS window_end
    FROM processing_window p
  ),

  -- Step 2: Get the last known data point for each sensor *before* our current processing window starts.
  -- This is crucial for the LOCF logic to correctly fill gaps at the beginning of the window.
  last_known_state AS (
    SELECT
      sensor_id,
      ARRAY_AGG(
        STRUCT(observation_minute, smoothed_light_intensity, sensor_set_id)
        ORDER BY observation_minute DESC
        LIMIT 1
      )[OFFSET(0)] AS last_data
    FROM `${project_id}.${dataset_id}.${destination_table}`
    -- Look for the last record just before the window.
    WHERE observation_minute < (SELECT window_start FROM capped_window)
    GROUP BY sensor_id
  ),

  -- Step 3: Get the raw data that falls within our defined processing window.
  new_raw_data AS (
    SELECT
      raw.timestamp,
      raw.sensor_id,
      raw.light_intensity,
      raw.sensor_set_id
    FROM `${project_id}.${dataset_id}.${source_table}` AS raw
    WHERE raw.timestamp >= (SELECT window_start FROM capped_window)
      AND raw.timestamp < (SELECT window_end FROM capped_window)
  ),

  -- Step 4: Aggregate new data to the minute and combine it with the last known state from before the window.
  -- This creates a continuous dataset for the LOCF logic to work on.
  combined_data AS (
    -- Newly aggregated data from the current window
    SELECT
      TIMESTAMP_TRUNC(timestamp, MINUTE) as observation_minute,
      sensor_id,
      sensor_set_id,
      AVG(light_intensity) as light_intensity
    FROM new_raw_data
    GROUP BY 1, 2, 3
    UNION ALL
    -- The last known data point from before the window
    SELECT
      s.last_data.observation_minute,
      s.sensor_id,
      s.last_data.sensor_set_id,
      s.last_data.smoothed_light_intensity as light_intensity
    FROM last_known_state s
    WHERE s.last_data.observation_minute IS NOT NULL
  ),

  -- Step 5: Create a complete timeline of minutes for each sensor *within the processing window* to fill gaps.
  minute_series AS (
    SELECT minute_from_array AS observation_minute
    FROM capped_window,
      UNNEST(GENERATE_TIMESTAMP_ARRAY(
        TIMESTAMP_TRUNC(window_start, MINUTE),
        TIMESTAMP_TRUNC(window_end, MINUTE),
        INTERVAL 1 MINUTE)) AS minute_from_array
  ),
  -- Create a scaffold of every sensor for every minute in the new time range.
  scaffold AS (
    SELECT
      m.observation_minute,
      s.sensor_id,
      s.sensor_set_id
    FROM minute_series m
    -- Important: Use sensors present in the combined data, which includes historical ones for LOCF.
    CROSS JOIN (SELECT DISTINCT sensor_id, sensor_set_id FROM combined_data) s
  ),
  -- Join the scaffold with the combined data, creating gaps (NULLs) where no data exists.
  data_gapped AS (
    SELECT
      s.observation_minute,
      s.sensor_id,
      s.sensor_set_id,
      c.light_intensity
    FROM scaffold s
    LEFT JOIN combined_data c ON s.sensor_id = c.sensor_id AND s.observation_minute = c.observation_minute
  ),

  -- Step 6: Use a window function to find the last known value and carry it forward (LOCF).
  gaps_filled AS (
    SELECT
      observation_minute,
      sensor_id,
      sensor_set_id,
      light_intensity,
      -- This carries the last non-null value forward.
      LAST_VALUE(IF(light_intensity IS NOT NULL, STRUCT(light_intensity, sensor_set_id), NULL) IGNORE NULLS) OVER (
        PARTITION BY sensor_id ORDER BY observation_minute
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as last_point
    FROM data_gapped
  ),

  -- Step 7: Determine the last real data point for each sensor.
  -- This prevents LOCF from extrapolating data indefinitely into the future.
  sensor_boundaries AS (
    SELECT
      sensor_id,
      MAX(observation_minute) AS last_real_observation
    FROM combined_data
    -- This WHERE clause is important to only consider actual measurements.
    WHERE light_intensity IS NOT NULL
    GROUP BY sensor_id
  )

  -- Final Step: Select the filled data, but only up to the last real observation for each sensor.
  SELECT
    g.observation_minute,
    g.sensor_id,
    COALESCE(g.light_intensity, g.last_point.light_intensity) AS smoothed_light_intensity,
    COALESCE(g.sensor_set_id, g.last_point.sensor_set_id) AS sensor_set_id
  FROM gaps_filled AS g
  JOIN sensor_boundaries AS b ON g.sensor_id = b.sensor_id
  WHERE g.observation_minute >= (SELECT window_start FROM capped_window)
    AND g.last_point.light_intensity IS NOT NULL
    -- This new condition stops future extrapolation beyond the sensor's last known data point.
    AND g.observation_minute <= b.last_real_observation

) AS S
ON T.observation_minute = S.observation_minute AND T.sensor_id = S.sensor_id
WHEN MATCHED THEN
  UPDATE SET T.smoothed_light_intensity = S.smoothed_light_intensity, T.sensor_set_id = S.sensor_set_id, T.last_updated = CURRENT_TIMESTAMP()
WHEN NOT MATCHED BY TARGET THEN
  INSERT (observation_minute, sensor_id, smoothed_light_intensity, sensor_set_id, last_updated)
  VALUES (observation_minute, sensor_id, smoothed_light_intensity, sensor_set_id, CURRENT_TIMESTAMP());