/*
 * DailyWeather.tsx
 *
 * Type which represents information about weather for a specific day,
 * using Luxon's DateTime for time-based fields.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import { DateTime } from 'luxon';

export interface DailyWeather {
  date: DateTime;
  sunrise: DateTime | null;
  sunset: DateTime | null;
  daylight_duration: number | null;
  sunshine_duration: number | null;
  temperature_2m_max: number | null;
  temperature_2m_min: number | null;
  uv_index_max: number | null;
  uv_index_clear_sky_max: number | null;
  rain_sum: number | null;
  showers_sum: number | null;
  precipitation_sum: number | null;
  snowfall_sum: number | null;
  precipitation_hours: number | null;
  data_source: string | null;
  sensor_set_id: string | null;
  timezone: string | null;
}