/*
 * SensorLevelsChart.tsx
 *
 * Renders a line graph of the sensor levels over time for a particular day,
 * with vertical lines indicating sunrise and sunset, and weather data overlay.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025), and Claude Sonnet 4 (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { DateTime } from 'luxon';
import { HourlyWeather } from '@/app/types/HourlyWeather';

interface Reading {
  time: number;
  [key: string]: number | string;
}

interface CombinedDataPoint {
  time: number;
  direct_radiation?: number;
  shortwave_radiation?: number;
  [key: string]: number | string | undefined;
}

interface SensorLevelsChartProps {
  readings: Reading[];
  sensorIds: string[];
  hourlyTicks: number[];
  axisDomain: [number, number];
  timezone: string;
  highlightedSensor: string | null;
  hiddenRadiationLines: Set<string>;
  onLegendClick: (dataKey: string) => void;
  sunrise: DateTime | null;
  sunset: DateTime | null;
  maxIntensity: number;
  hourlyWeatherData: HourlyWeather[];
}

// Colors for sensor data - red to teal range, ordered for maximum contrast
const sensorColors = ['#dc2626', '#22c55e', '#f97316', '#84cc16', '#eab308', '#059669'];
// Colors for weather data - blue to purple range
const weatherColors = {
  direct_radiation: '#3b82f6',
  shortwave_radiation: '#8b5cf6'
};

const SensorLevelsChart: React.FC<SensorLevelsChartProps> = ({
  readings,
  sensorIds,
  hourlyTicks,
  axisDomain,
  timezone,
  highlightedSensor,
  hiddenRadiationLines,
  onLegendClick,
  sunrise,
  sunset,
  maxIntensity,
  hourlyWeatherData,
}) => {
  // Calculate max radiation values for the secondary Y-axis
  const maxRadiation = React.useMemo(() => {
    if (hourlyWeatherData.length === 0) return 1000;

    const maxDirect = Math.max(...hourlyWeatherData.map(w => w.direct_radiation || 0));
    const maxShortwave = Math.max(...hourlyWeatherData.map(w => w.shortwave_radiation || 0));
    const overallMax = Math.max(maxDirect, maxShortwave);

    // Round up to nearest 100 for cleaner axis
    return overallMax > 0 ? Math.ceil(overallMax / 100) * 100 : 1000;
  }, [hourlyWeatherData]);

  // Combine sensor readings with weather data
  const combinedData: CombinedDataPoint[] = React.useMemo(() => {
    // Create a map of weather data by timestamp for quick lookup
    const weatherMap = new Map<number, HourlyWeather>();
    hourlyWeatherData.forEach(weather => {
      weatherMap.set(weather.time.toMillis(), weather);
    });

    // Sort hourly weather data by time for interpolation
    const sortedWeatherData = [...hourlyWeatherData].sort((a, b) => a.time.toMillis() - b.time.toMillis());

    // Function to find the most recent radiation data for a given timestamp
    const findMostRecentRadiation = (timestamp: number) => {
      // First check if we have exact match
      const exactMatch = weatherMap.get(timestamp);
      if (exactMatch) {
        return {
          direct_radiation: exactMatch.direct_radiation ?? undefined,
          shortwave_radiation: exactMatch.shortwave_radiation ?? undefined
        };
      }

      // Find the most recent previous reading
      let mostRecent = null;
      for (let i = sortedWeatherData.length - 1; i >= 0; i--) {
        const weather = sortedWeatherData[i];
        if (weather.time.toMillis() <= timestamp) {
          mostRecent = weather;
          break;
        }
      }

      if (mostRecent) {
        return {
          direct_radiation: mostRecent.direct_radiation ?? undefined,
          shortwave_radiation: mostRecent.shortwave_radiation ?? undefined
        };
      }

      return {
        direct_radiation: undefined,
        shortwave_radiation: undefined
      };
    };

    // Combine the data - each sensor reading gets the most recent radiation data
    const combined = readings.map(reading => {
      const radiationData = findMostRecentRadiation(reading.time as number);
      return {
        ...reading,
        direct_radiation: radiationData.direct_radiation,
        shortwave_radiation: radiationData.shortwave_radiation,
      };
    });

    // Add any weather data points that don't have corresponding sensor readings
    // (this handles cases where we have weather data but no sensor data)
    hourlyWeatherData.forEach(weather => {
      const timestamp = weather.time.toMillis();
      const existingReading = combined.find(r => r.time === timestamp);
      if (!existingReading) {
        combined.push({
          time: timestamp,
          direct_radiation: weather.direct_radiation ?? undefined,
          shortwave_radiation: weather.shortwave_radiation ?? undefined,
        });
      }
    });

    // Sort by time
    return combined.sort((a, b) => (a.time as number) - (b.time as number));
  }, [readings, hourlyWeatherData]);

  // Custom Legend Component
  const CustomLegend = () => {
    return (
      <div className="mt-4">
        {/* Sensor Legend */}
        <div className="flex flex-wrap gap-4 mb-2">
          {sensorIds.map((id, index) => (
            <div
              key={id}
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => onLegendClick(id)}
              style={{
                opacity: highlightedSensor === null || highlightedSensor === id ? 1 : 0.4
              }}
            >
              <div
                className="w-3 h-0.5"
                style={{ backgroundColor: sensorColors[index % sensorColors.length] }}
              />
              <span className="text-white text-sm">{id}</span>
            </div>
          ))}
        </div>

        {/* Weather Legend */}
        <div className="flex flex-wrap gap-4">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onLegendClick('direct_radiation')}
            style={{
              opacity: hiddenRadiationLines.has('direct_radiation') ? 0.4 : 1
            }}
          >
            <div
              className="w-3 h-0.5"
              style={{ backgroundColor: weatherColors.direct_radiation }}
            />
            <span className="text-white text-sm">Direct Radiation (W/m²)</span>
          </div>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onLegendClick('shortwave_radiation')}
            style={{
              opacity: hiddenRadiationLines.has('shortwave_radiation') ? 0.4 : 1
            }}
          >
            <div
              className="w-3 h-0.5"
              style={{ backgroundColor: weatherColors.shortwave_radiation }}
            />
            <span className="text-white text-sm">Shortwave Radiation (W/m²)</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            dataKey="time"
            type="number"
            domain={axisDomain}
            ticks={hourlyTicks}
            tickFormatter={(unixTime) =>
              DateTime.fromMillis(unixTime, { zone: timezone }).toFormat('h a')
            }
            stroke="#ccc"
          />
          <YAxis
            yAxisId="sensors"
            stroke="#ccc"
            domain={[0, maxIntensity]}
            allowDataOverflow={true}
            label={{ value: 'Sensor Intensity', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#ccc' } }}
          />
          <YAxis
            yAxisId="radiation"
            orientation="right"
            stroke="#ccc"
            domain={[0, maxRadiation]}
            allowDataOverflow={true}
            label={{ value: 'Radiation (W/m²)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#ccc' } }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
            labelStyle={{ color: '#fff' }}
            labelFormatter={(value) =>
              DateTime.fromMillis(Number(value), { zone: timezone }).toFormat('ff')
            }
            formatter={(value, name) => {
              if (name === 'direct_radiation') return [`${value} W/m²`, 'Direct Radiation'];
              if (name === 'shortwave_radiation') return [`${value} W/m²`, 'Shortwave Radiation'];
              return [value, name];
            }}
          />

          {/* Sunrise and Sunset Reference Lines */}
          {sunrise && (
            <ReferenceLine
              yAxisId="sensors"
              x={sunrise.toMillis()}
              stroke="yellow"
              strokeDasharray="3 3"
              label={{
                value: 'Sunrise',
                position: 'insideTopRight',
                fill: 'yellow',
                fontSize: 12,
              }}
            />
          )}
          {sunset && (
            <ReferenceLine
              yAxisId="sensors"
              x={sunset.toMillis()}
              stroke="orange"
              strokeDasharray="3 3"
              label={{
                value: 'Sunset',
                position: 'insideTopRight',
                fill: 'orange',
                fontSize: 12,
              }}
            />
          )}

          {/* Sensor Lines */}
          {sensorIds.map((id, index) => (
            <Line
              key={id}
              yAxisId="sensors"
              type="monotone"
              dataKey={id}
              stroke={sensorColors[index % sensorColors.length]}
              dot={false}
              connectNulls
              opacity={highlightedSensor === null || highlightedSensor === id ? 1 : 0.2}
            />
          ))}

          {/* Weather Data Lines - using right Y-axis */}
          <Line
            key="direct_radiation"
            yAxisId="radiation"
            type="monotone"
            dataKey="direct_radiation"
            stroke={weatherColors.direct_radiation}
            dot={false}
            connectNulls
            opacity={hiddenRadiationLines.has('direct_radiation') ? 0 : 1}
            strokeWidth={2}
          />

          <Line
            key="shortwave_radiation"
            yAxisId="radiation"
            type="monotone"
            dataKey="shortwave_radiation"
            stroke={weatherColors.shortwave_radiation}
            dot={false}
            connectNulls
            opacity={hiddenRadiationLines.has('shortwave_radiation') ? 0 : 1}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Custom Legend */}
      <CustomLegend />
    </div>
  );
};

export default SensorLevelsChart;