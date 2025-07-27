/*
 * SensorHeatmapChart.tsx
 *
 * Renders the sensor heat map, showing light intensity on a land map at a point in time.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Label,
  TooltipProps
} from 'recharts';
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { ChartDataPoint } from "@/app/types/ChartDataPoint";



interface SensorHeatmapChartProps {
    chartData: ChartDataPoint[];
    yardLength: number;
    yardWidth: number;
    maxIntensity: number;
}

const CustomTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload as ChartDataPoint;
        return (
            <div className="bg-gray-800 text-white p-2 border border-gray-600 rounded">
                <p>{`Sensor ID: ${data.sensor_id}`}</p>
                <p>{`Position: (${data.y}, ${data.x})`}</p>
                <p>{`Intensity: ${data.z ?? 'N/A'}`}</p>
            </div>
        );
    }
    return null;
};

const SensorHeatmapChart: React.FC<SensorHeatmapChartProps> = ({ chartData, yardLength, yardWidth, maxIntensity }) => {
    // --- Helper Functions for Chart Rendering ---

    // This function calculates the fill color based on light intensity.
    // It's defined inside the component to access the `maxIntensity` prop.
    const calculateFillColor = (intensity: number | undefined) => {
        if (intensity === undefined) {
          return 'hsl(0, 0%, 20%)'; // Dim gray for sensors with no data
        }
        // HSL: Hue=60 (yellow), Saturation=100%, Lightness varies from 20% to 80%
        // Use maxIntensity for the scale, ensuring we don't divide by zero.
        const effectiveMaxIntensity = maxIntensity > 0 ? maxIntensity : 1;
        const lightness = 20 + (intensity / effectiveMaxIntensity) * 60;
        return `hsl(60, 100%, ${lightness}%)`;
    };

    // This function renders the custom circle for each data point.
    // It's also defined inside to use the `calculateFillColor` function from the component's scope.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderCircle = (props: any) => {
        const { cx, cy, payload } = props;
        const fillColor = calculateFillColor(payload.z);
        return <circle cx={cx} cy={cy} r={10} fill={fillColor} />;
    };

    return (
        <div className="w-full relative" style={{aspectRatio: `${yardLength}/${yardWidth}`, minHeight: '300px'}}>
            <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                <XAxis
                    type="number"
                    dataKey="x"
                    name="Yard Length"
                    domain={[0, yardLength]}
                    ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 133].filter(t => t <= yardLength)}
                >
                    <Label value="Yard Length (feet)" offset={-30} position="insideBottom" />
                </XAxis>
                <YAxis
                    type="number"
                    dataKey="y"
                    name="Yard Width"
                    domain={[0, yardWidth]}
                    reversed={true}
                    ticks={[0, 10, 20, 33].filter(t => t <= yardWidth)}
                >
                    <Label value="Yard Width (feet)" angle={-90} offset={-25} position="insideLeft" />
                </YAxis>
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />}/>
                <Scatter name="Sensors" data={chartData} shape={renderCircle} />
            </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SensorHeatmapChart;
