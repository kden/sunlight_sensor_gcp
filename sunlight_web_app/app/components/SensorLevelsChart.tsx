// /app/components/SensorLevelsGraph.tsx

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
        <YAxis stroke="#ccc" domain={[0, 10000]} allowDataOverflow={true} />
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
