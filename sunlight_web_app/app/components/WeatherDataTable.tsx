/*
 * WeatherDataTable.tsx
 *
 * Renders a table of daily historical weather data.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';
import { DailyWeather } from '@/app/types/DailyWeather';
import { DateTime } from 'luxon';

interface WeatherDataTableProps {
  data: DailyWeather;
  timezone: string;
}

// Helper to format a duration in seconds into HH:mm:ss format.
const formatDuration = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return 'N/A';
    // Durations are absolute and don't need timezone conversion.
    return DateTime.fromSeconds(seconds, { zone: 'utc' }).toFormat('HH:mm:ss');
};

// Helper function to format temperature, now with Fahrenheit first.
const formatTemperature = (celsius: number | null): string => {
    if (celsius === null) {
        return 'N/A';
    }
    const fahrenheit = celsius * 1.8 + 32;
    return `${fahrenheit.toFixed(1)} °F (${celsius.toFixed(1)} °C)`;
};

const WeatherDataTable: React.FC<WeatherDataTableProps> = ({ data, timezone }) => {
    // This helper now receives a Luxon DateTime object directly.
    const formatDateTime = (dt: DateTime | null): string => {
        if (!dt) return 'N/A';
        // Format the time part in the correct zone.
        const timePart = dt.setZone(timezone).toFormat('h:mm:ss a');
        // Append the full IANA timezone name for clarity.
        return `${timePart} (${timezone})`;
    };

    const weatherDetails = [
        { label: 'Sunrise', value: formatDateTime(data.sunrise) },
        { label: 'Sunset', value: formatDateTime(data.sunset) },
        { label: 'Daylight Duration', value: formatDuration(data.daylight_duration) },
        { label: 'Sunshine Duration', value: formatDuration(data.sunshine_duration) },
        // Use the updated temperature formatting function.
        { label: 'Max Temperature', value: formatTemperature(data.temperature_2m_max) },
        { label: 'Min Temperature', value: formatTemperature(data.temperature_2m_min) },
        { label: 'Max UV Index', value: data.uv_index_max !== null ? data.uv_index_max.toFixed(1) : 'N/A' },
        { label: 'Max Clear Sky UV Index', value: data.uv_index_clear_sky_max !== null ? data.uv_index_clear_sky_max.toFixed(1) : 'N/A' },
        { label: 'Total Rain', value: data.rain_sum !== null ? `${data.rain_sum.toFixed(1)} mm` : 'N/A' },
        { label: 'Total Showers', value: data.showers_sum !== null ? `${data.showers_sum.toFixed(1)} mm` : 'N/A' },
        { label: 'Total Precipitation', value: data.precipitation_sum !== null ? `${data.precipitation_sum.toFixed(1)} mm` : 'N/A' },
        { label: 'Total Snowfall', value: data.snowfall_sum !== null ? `${data.snowfall_sum.toFixed(1)} cm` : 'N/A' },
        { label: 'Hours with Precipitation', value: data.precipitation_hours ?? 'N/A' },
        { label: 'Data Source', value: data.data_source ?? 'N/A' },
    ];

    return (
        <>
            <h2 className="text-xl font-semibold mb-4 text-amber-400">Daily Weather Summary</h2>
            <div className="overflow-x-auto bg-gray-800 rounded-lg shadow p-4">
                <table className="min-w-full">
                    <tbody>
                        {weatherDetails.map(({ label, value }) => (
                            <tr key={label} className="border-b border-gray-700 last:border-b-0">
                                {/* FIX: Reduced vertical padding for a more compact layout */}
                                <td className="py-1.5 px-3 font-medium text-gray-300 whitespace-nowrap">{label}</td>
                                <td className="py-1.5 px-3 text-gray-100 w-full">{String(value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default WeatherDataTable;