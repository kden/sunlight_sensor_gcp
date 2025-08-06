/*
 * HourlyWeatherDataTable.tsx
 *
 * Source code description.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';
import { HourlyWeather } from '@/app/types/HourlyWeather';
import { DateTime } from 'luxon';

interface HourlyWeatherDataTableProps {
  data: HourlyWeather;
  timezone: string;
}

const formatTemperature = (celsius: number | null): string => {
  if (celsius === null) return 'N/A';
  const fahrenheit = celsius * 1.8 + 32;
  return `${fahrenheit.toFixed(1)} °F (${celsius.toFixed(1)} °C)`;
};

const formatDateTime = (dt: DateTime | null, timezone: string): string => {
  if (!dt) return 'N/A';
  return dt.setZone(timezone).toFormat('ff');
};

const HourlyWeatherDataTable: React.FC<HourlyWeatherDataTableProps> = ({ data, timezone }) => {
  const weatherDetails = [
    { label: 'Time', value: formatDateTime(data.time, timezone) },
    { label: 'Temperature', value: formatTemperature(data.temperature_2m) },
    { label: 'Humidity', value: data.relative_humidity_2m !== null ? `${data.relative_humidity_2m}%` : 'N/A' },
    { label: 'UV Index', value: data.uv_index !== null ? data.uv_index.toFixed(1) : 'N/A' },
    { label: 'Direct Radiation', value: data.direct_radiation !== null ? `${data.direct_radiation} W/m²` : 'N/A' },
    { label: 'Shortwave Radiation', value: data.shortwave_radiation !== null ? `${data.shortwave_radiation} W/m²` : 'N/A' },
    { label: 'Precipitation', value: data.precipitation !== null ? `${data.precipitation.toFixed(1)} mm` : 'N/A' },
    { label: 'Cloud Cover', value: data.cloud_cover !== null ? `${data.cloud_cover}%` : 'N/A' },
    { label: 'Visibility', value: data.visibility !== null ? `${data.visibility} m` : 'N/A' },
    { label: 'Wind Speed', value: data.wind_speed_10m !== null ? `${data.wind_speed_10m} m/s` : 'N/A' },
    { label: 'Soil Temp (0cm)', value: data.soil_temperature_0cm !== null ? `${data.soil_temperature_0cm} °C` : 'N/A' },
    { label: 'Soil Moisture (1–3cm)', value: data.soil_moisture_1_to_3cm !== null ? `${data.soil_moisture_1_to_3cm}` : 'N/A' },
    { label: 'Data Source', value: data.data_source ?? 'N/A' },
  ];

  return (
    <>
      <h2 className="text-xl font-semibold mb-4 text-amber-400">Hourly Weather Summary</h2>
      <div className="overflow-x-auto bg-gray-800 rounded-lg shadow p-4">
        <table className="min-w-full">
          <tbody>
            {weatherDetails.map(({ label, value }) => (
              <tr key={label} className="border-b border-gray-700 last:border-b-0">
                <td className="py-1.5 px-3 font-medium text-gray-300 whitespace-nowrap">{label}</td>
                <td className="py-1.5 px-3 text-gray-100 w-full">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default HourlyWeatherDataTable;
