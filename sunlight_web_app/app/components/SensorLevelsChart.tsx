/*
 * SensorLevelsChart.tsx
 *
 * Renders a line graph of the sensor levels over time for a particular day,
 * with vertical lines indicating sunrise and sunset.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
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
  Legend,
  ResponsiveContainer,
  ReferenceLine, // 1. Import ReferenceLine
} from 'recharts';
import { DateTime } from 'luxon';

interface Reading {
  time: number;
  [key: string]: number | string;
}

interface SensorLevelsChartProps {
  readings: Reading[];
  sensorIds: string[];
  hourlyTicks: number[];
  axisDomain: [number, number];
  timezone: string;
  highlightedSensor: string | null;
  onLegendClick: (dataKey: string) => void;
  // 2. Add sunrise and sunset to the props
  sunrise: DateTime | null;
  sunset: DateTime | null;
  maxIntensity: number;
}

const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#387908', '#d0ed57'];

const SensorLevelsChart: React.FC<SensorLevelsChartProps> = ({
  readings,
  sensorIds,
  hourlyTicks,
  axisDomain,
  timezone,
  highlightedSensor,
  onLegendClick,
  sunrise, // 3. Destructure the new props
  sunset,
  maxIntensity,
}) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={readings}>
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
        <YAxis stroke="#ccc" domain={[0, maxIntensity]} allowDataOverflow={true} />
        <Tooltip
          contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
          labelStyle={{ color: '#fff' }}
          labelFormatter={(value) =>
            DateTime.fromMillis(Number(value), { zone: timezone }).toFormat('ff')
          }
        />
        <Legend
          wrapperStyle={{ color: '#fff' }}
          onClick={(data) => {
            if (typeof data.dataKey === 'string') {
              onLegendClick(data.dataKey);
            }
          }}
        />

        {/* 4. Add the ReferenceLine components for sunrise and sunset */}
        {sunrise && (
          <ReferenceLine
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

        {sensorIds.map((id, index) => (
          <Line
            key={id}
            type="monotone"
            dataKey={id}
            stroke={colors[index % colors.length]}
            dot={false}
            connectNulls
            opacity={highlightedSensor === null || highlightedSensor === id ? 1 : 0.2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default SensorLevelsChart;