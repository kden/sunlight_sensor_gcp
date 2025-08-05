/*
 * HourlyWeather.tsx
 *
 * Contains information about hourly weather from Open-Meteo.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import { DateTime } from 'luxon';

export interface HourlyWeather {
  time: DateTime;
  cloud_cover: number | null;
  data_source: string | null;
  direct_radiation: number | null;
  last_updated: DateTime | null;
  latitude: number | null;
  longitude: number | null;
  precipitation: number | null;
  relative_humidity_2m: number | null;
  sensor_set_id: string | null;
  shortwave_radiation: number | null;
  soil_moisture_1_to_3cm: number | null;
  soil_temperature_0cm: number | null;
  temperature_2m: number | null;
  timezone: string | null;
  uv_index: number | null;
  uv_index_clear_sky: number | null;
  visibility: number | null;
  wind_speed_10m: number | null;
}