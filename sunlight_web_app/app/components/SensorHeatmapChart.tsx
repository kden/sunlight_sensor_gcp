/*
 * SensorHeatmapChart.tsx
 *
 * Renders the sensor heat map with interpolated values, showing light intensity on a land map at a point in time.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React, { useMemo, useState } from 'react';
import { ChartDataPoint } from "@/app/types/ChartDataPoint";

interface SensorHeatmapChartProps {
    chartData: ChartDataPoint[];
    yardLength: number;
    yardWidth: number;
    maxIntensity: number;
}

const SensorHeatmapChart: React.FC<SensorHeatmapChartProps> = ({ chartData, yardLength, yardWidth, maxIntensity }) => {
    const [hoveredSensor, setHoveredSensor] = useState<ChartDataPoint | null>(null);

    // Inverse Distance Weighting interpolation
    const interpolateValue = (x: number, y: number, sensors: ChartDataPoint[]): number => {
        let weightSum = 0;
        let valueSum = 0;
        const power = 2; // Power parameter for IDW
        const minDistance = 0.5; // Minimum distance to avoid division by zero

        for (const sensor of sensors) {
            const distance = Math.max(
                Math.sqrt(Math.pow(x - sensor.x, 2) + Math.pow(y - sensor.y, 2)),
                minDistance
            );

            const weight = 1 / Math.pow(distance, power);
            weightSum += weight;
            valueSum += (sensor.z as number) * weight;
        }

        return weightSum > 0 ? valueSum / weightSum : 0;
    };

    // Create interpolated heatmap grid
    const heatmapGrid = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];

        // Filter out sensors with no data
        const validSensors = chartData.filter(sensor => sensor.z !== undefined && sensor.z !== null);
        if (validSensors.length === 0) return [];

        const gridCells: Array<{x: number, y: number, value: number}> = [];

        // Create 1x1 foot grid cells
        for (let x = 0; x < yardLength; x += 1) {
            for (let y = 0; y < yardWidth; y += 1) {
                const centerX = x + 0.5;
                const centerY = y + 0.5;
                const interpolatedIntensity = interpolateValue(centerX, centerY, validSensors);
                gridCells.push({
                    x: x,
                    y: y,
                    value: interpolatedIntensity
                });
            }
        }

        return gridCells;
    }, [chartData, yardLength, yardWidth, interpolateValue]);

    // Calculate fill color based on intensity
    const calculateFillColor = (intensity: number): string => {
        const effectiveMaxIntensity = maxIntensity > 0 ? maxIntensity : 1;
        const ratio = Math.min(intensity / effectiveMaxIntensity, 1);

        // Interpolate from almost black (rgb(31, 41, 55)) to bg-yellow-200 (rgb(254, 240, 138))
        const startColor = [31, 41, 55];    // Almost black
        const endColor = [254, 240, 138];   // bg-yellow-200

        const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * ratio);
        const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * ratio);
        const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * ratio);

        return `rgb(${r}, ${g}, ${b})`;
    };

    return (
        <div className="w-full">
            <div className="w-full relative bg-gray-100 border border-gray-300"
                 style={{aspectRatio: `${yardLength}/${yardWidth}`, minHeight: '200px'}}>
                <svg width="100%" height="100%" viewBox={`0 0 ${yardLength} ${yardWidth}`}>
                    {/* Render heatmap grid */}
                    {heatmapGrid.map((cell, index) => (
                        <rect
                            key={index}
                            x={cell.x}
                            y={cell.y}
                            width={1}
                            height={1}
                            fill={calculateFillColor(cell.value)}
                            stroke="none"
                        />
                    ))}

                    {/* Render grid lines */}
                    {/* Vertical lines */}
                    {Array.from({length: Math.floor(yardLength/10) + 1}, (_, i) => i * 10)
                        .filter(x => x <= yardLength)
                        .map(x => (
                            <line
                                key={`v-${x}`}
                                x1={x}
                                y1={0}
                                x2={x}
                                y2={yardWidth}
                                stroke="#666"
                                strokeWidth={0.2}
                                strokeDasharray="0.5 0.5"
                            />
                        ))}

                    {/* Horizontal lines */}
                    {Array.from({length: Math.floor(yardWidth/10) + 1}, (_, i) => i * 10)
                        .filter(y => y <= yardWidth)
                        .map(y => (
                            <line
                                key={`h-${y}`}
                                x1={0}
                                y1={y}
                                x2={yardLength}
                                y2={y}
                                stroke="#666"
                                strokeWidth={0.2}
                                strokeDasharray="0.5 0.5"
                            />
                        ))}

                    {/* Render sensor locations */}
                    {chartData.filter(d => d.z !== undefined).map((sensor, index) => (
                        <circle
                            key={index}
                            cx={sensor.x}
                            cy={sensor.y}
                            r={2}
                            fill="none"
                            stroke="#ec4899"
                            strokeWidth={0.8}
                            onMouseEnter={() => setHoveredSensor(sensor)}
                            onMouseLeave={() => setHoveredSensor(null)}
                            style={{cursor: 'pointer'}}
                        />
                    ))}

                    {/* Axis labels */}
                    <g fontSize="3" fill="#666">
                        {/* X-axis labels */}
                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 133]
                            .filter(x => x <= yardLength)
                            .map(x => (
                                <text
                                    key={`x-label-${x}`}
                                    x={x}
                                    y={yardWidth + 2}
                                    textAnchor="middle"
                                    dominantBaseline="hanging"
                                >
                                    {x}
                                </text>
                            ))}

                        {/* Y-axis labels */}
                        {[0, 10, 20, 33]
                            .filter(y => y <= yardWidth)
                            .map(y => (
                                <text
                                    key={`y-label-${y}`}
                                    x={-1}
                                    y={yardWidth - y}
                                    textAnchor="end"
                                    dominantBaseline="middle"
                                >
                                    {y}
                                </text>
                            ))}
                    </g>

                    {/* Axis titles */}
                    <g fontSize="4" fill="#333" fontWeight="bold">
                        <text
                            x={yardLength / 2}
                            y={yardWidth + 8}
                            textAnchor="middle"
                            dominantBaseline="hanging"
                        >
                            Yard Length (feet)
                        </text>

                        <text
                            x={-8}
                            y={yardWidth / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(-90 -8 ${yardWidth / 2})`}
                        >
                            Yard Width (feet)
                        </text>
                    </g>
                </svg>

                {/* Tooltip */}
                {hoveredSensor && (
                    <div className="absolute bg-gray-800 text-white p-2 border border-gray-600 rounded pointer-events-none z-10"
                         style={{
                             left: `${(hoveredSensor.x / yardLength) * 100}%`,
                             top: `${(hoveredSensor.y / yardWidth) * 100}%`,
                             transform: 'translate(-50%, -100%)'
                         }}>
                        <p className="text-sm">{`Sensor ID: ${hoveredSensor.sensor_id}`}</p>
                        <p className="text-sm">{`Position: (${hoveredSensor.y}, ${hoveredSensor.x})`}</p>
                        <p className="text-sm">{`Intensity: ${hoveredSensor.z ?? 'N/A'}`}</p>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-pink-500 rounded-full bg-transparent"></div>
                    <span>Sensor Locations</span>
                </div>
                <div className="flex items-center space-x-6 ml-8">
                    <div className="flex items-center space-x-1">
                        <div className="w-4 h-4 bg-gray-800"></div>
                        <span>Low Intensity</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <div className="w-4 h-4 bg-yellow-200"></div>
                        <span>High Intensity</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SensorHeatmapChart;