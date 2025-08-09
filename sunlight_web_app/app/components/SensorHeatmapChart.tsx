/*
 * SensorHeatmapChart.tsx
 *
 * Renders the sensor heat map with interpolated values, showing light intensity on a land map at a point in time.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025), and Claude Sonnet 4 (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React, { useMemo, useState, useCallback } from 'react';
import { ChartDataPoint } from "@/app/types/ChartDataPoint";

interface SensorHeatmapChartProps {
    chartData: ChartDataPoint[];
    yardLength: number;
    yardWidth: number;
    maxIntensity: number;
}

const SensorHeatmapChart: React.FC<SensorHeatmapChartProps> = ({ chartData, yardLength, yardWidth, maxIntensity }) => {
    const [hoveredSensor, setHoveredSensor] = useState<ChartDataPoint | null>(null);

    // Inverse Distance Weighting interpolation, memoized for performance.
    const interpolateValue = useCallback((x: number, y: number, sensors: ChartDataPoint[]): number => {
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
    }, []);

    // Calculate fill color based on intensity, returns an array for efficiency.
    const calculateFillColor = (intensity: number): [number, number, number] => {
        const effectiveMaxIntensity = maxIntensity > 0 ? maxIntensity : 1;
        const ratio = Math.min(intensity / effectiveMaxIntensity, 1);

        // Interpolate from almost black (rgb(31, 41, 55)) to bg-yellow-200 (rgb(254, 240, 138))
        const startColor = [31, 41, 55];    // Almost black
        const endColor = [254, 240, 138];   // bg-yellow-200

        const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * ratio);
        const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * ratio);
        const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * ratio);

        return [r, g, b];
    };

    // Generate the heatmap as a single image data URL for high-performance rendering.
    const heatmapDataUrl = useMemo(() => {
        // Guard against running on the server or with no data.
        if (typeof window === 'undefined' || !chartData || chartData.length === 0) {
            return '';
        }

        const validSensors = chartData.filter(sensor => sensor.z !== undefined && sensor.z !== null);
        if (validSensors.length === 0) return '';

        const canvas = document.createElement('canvas');
        canvas.width = yardLength;
        canvas.height = yardWidth;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return '';

        const imageData = ctx.createImageData(yardLength, yardWidth);
        const data = imageData.data;

        for (let y = 0; y < yardWidth; y++) {
            for (let x = 0; x < yardLength; x++) {
                const value = interpolateValue(x + 0.5, y + 0.5, validSensors);
                const [r, g, b] = calculateFillColor(value);
                const index = (y * yardLength + x) * 4;
                data[index] = r;
                data[index + 1] = g;
                data[index + 2] = b;
                data[index + 3] = 255; // Alpha channel (fully opaque)
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    }, [chartData, yardLength, yardWidth, maxIntensity, interpolateValue]);

    // Chart layout constants
    const marginLeft = 15;
    const marginBottom = 8;
    const marginTop = 5;
    const marginRight = 5;
    const totalWidth = yardLength + marginLeft + marginRight;
    const totalHeight = yardWidth + marginTop + marginBottom;

    // Constants for axis styling
    const AXIS_TICK_LENGTH = 1;
    const AXIS_LABEL_OFFSET = 0.5; // Adjust this to change space between tick and label
    const AXIS_TICK_WIDTH = 0.2; // Adjust this to change tick thickness

    // Constants for font styling
    const AXIS_LABEL_FONT_SIZE = 2; // Adjust for axis number label size
    const AXIS_TITLE_FONT_SIZE = 2; // Adjust for axis title size

    return (
        <div className="w-full">
            <div className="w-full relative bg-slate-800 overflow-hidden"
                 style={{aspectRatio: `${totalWidth}/${totalHeight}`, minHeight: '300px'}}>
                <svg width="100%" height="100%" viewBox={`0 0 ${totalWidth} ${totalHeight}`} className="bg-slate-900">
                    <defs>
                        {/* Define a clipping path for the heatmap area */}
                        <clipPath id="heatmapClip">
                            <rect x={marginLeft} y={marginTop} width={yardLength} height={yardWidth} />
                        </clipPath>
                    </defs>

                    {/* Background for the chart area */}
                    <rect
                        x={marginLeft}
                        y={marginTop}
                        width={yardLength}
                        height={yardWidth}
                        fill="rgb(30, 41, 59)"
                        stroke="rgb(71, 85, 105)"
                        strokeWidth="0.5"
                    />

                    {/* Render heatmap as a single, high-performance image */}
                    {heatmapDataUrl && (
                        <image
                            href={heatmapDataUrl}
                            x={marginLeft}
                            y={marginTop}
                            width={yardLength}
                            height={yardWidth}
                            clipPath="url(#heatmapClip)"
                            style={{ imageRendering: 'pixelated' }}
                        />
                    )}

                    {/* Group for grid lines and sensor circles, which appear above the heatmap */}
                    <g clipPath="url(#heatmapClip)">
                        {/* Render grid lines */}
                        {/* Vertical lines */}
                        {Array.from({length: Math.floor(yardLength/10) + 1}, (_, i) => i * 10)
                            .filter(x => x <= yardLength)
                            .map(x => (
                                <line
                                    key={`v-${x}`}
                                    x1={marginLeft + x}
                                    y1={marginTop}
                                    x2={marginLeft + x}
                                    y2={marginTop + yardWidth}
                                    stroke="rgb(100, 116, 139)"
                                    strokeWidth={0.3}
                                    strokeDasharray="1 1"
                                />
                            ))}

                        {/* Horizontal lines */}
                        {Array.from({length: Math.floor(yardWidth/10) + 1}, (_, i) => i * 10)
                            .filter(y => y <= yardWidth)
                            .map(y => (
                                <line
                                    key={`h-${y}`}
                                    x1={marginLeft}
                                    y1={marginTop + y}
                                    x2={marginLeft + yardLength}
                                    y2={marginTop + y}
                                    stroke="rgb(100, 116, 139)"
                                    strokeWidth={0.3}
                                    strokeDasharray="1 1"
                                />
                            ))}

                        {/* Render sensor locations */}
                        {chartData.filter(d => d.z !== undefined).map((sensor, index) => (
                            <circle
                                key={index}
                                cx={marginLeft + sensor.x}
                                cy={marginTop + sensor.y}
                                r={2}
                                fill="transparent"
                                stroke="#ec4899"
                                strokeWidth={0.8}
                                onMouseEnter={() => setHoveredSensor(sensor)}
                                onMouseLeave={() => setHoveredSensor(null)}
                                style={{cursor: 'pointer'}}
                            />
                        ))}
                    </g>

                    {/* Axis labels and ticks */}
                    <g fontSize={AXIS_LABEL_FONT_SIZE} fill="rgb(203, 213, 225)">
                        {/* X-axis labels */}
                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 133]
                            .filter(x => x <= yardLength)
                            .map(x => (
                                <g key={`x-label-${x}`}>
                                    {/* Tick mark */}
                                    <line
                                        x1={marginLeft + x}
                                        y1={marginTop + yardWidth}
                                        x2={marginLeft + x}
                                        y2={marginTop + yardWidth + AXIS_TICK_LENGTH}
                                        stroke="rgb(203, 213, 225)"
                                        strokeWidth={AXIS_TICK_WIDTH}
                                    />
                                    {/* Label */}
                                    <text
                                        x={marginLeft + x}
                                        y={marginTop + yardWidth + AXIS_TICK_LENGTH + AXIS_LABEL_OFFSET}
                                        textAnchor="middle"
                                        dominantBaseline="hanging"
                                    >
                                        {x}
                                    </text>
                                </g>
                            ))}

                        {/* Y-axis labels */}
                        {[0, 10, 20, 33]
                            .filter(y => y <= yardWidth)
                            .map(y => (
                                <g key={`y-label-${y}`}>
                                    {/* Tick mark */}
                                    <line
                                        x1={marginLeft - AXIS_TICK_LENGTH}
                                        y1={marginTop + yardWidth - y}
                                        x2={marginLeft}
                                        y2={marginTop + yardWidth - y}
                                        stroke="rgb(203, 213, 225)"
                                        strokeWidth={AXIS_TICK_WIDTH}
                                    />
                                    {/* Label */}
                                    <text
                                        x={marginLeft - AXIS_TICK_LENGTH - AXIS_LABEL_OFFSET}
                                        y={marginTop + yardWidth - y}
                                        textAnchor="end"
                                        dominantBaseline="middle"
                                    >
                                        {y}
                                    </text>
                                </g>
                            ))}
                    </g>

                    {/* Axis titles */}
                    <g fontSize={AXIS_TITLE_FONT_SIZE} fill="rgb(226, 232, 240)" fontWeight="normal">
                        <text
                            x={marginLeft + yardLength / 2}
                            y={totalHeight - 3}
                            textAnchor="middle"
                            dominantBaseline="hanging"
                        >
                            Yard Length (feet)
                        </text>

                        <text
                            x={8}
                            y={marginTop + yardWidth / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(-90 8 ${marginTop + yardWidth / 2})`}
                        >
                            Yard Width (feet)
                        </text>
                    </g>
                </svg>

                {/* Tooltip */}
                {hoveredSensor && (
                    <div className="absolute bg-slate-900 text-slate-100 p-3 border border-slate-600 rounded-lg pointer-events-none z-10 shadow-lg"
                         style={{
                             left: `${((marginLeft + hoveredSensor.x) / totalWidth) * 100}%`,
                             top: `${((marginTop + hoveredSensor.y) / totalHeight) * 100}%`,
                             transform: 'translate(-50%, -100%)'
                         }}>
                        <p className="text-sm font-medium">{`Sensor ID: ${hoveredSensor.sensor_id}`}</p>
                        <p className="text-sm">{`Position: (${hoveredSensor.y}, ${hoveredSensor.x})`}</p>
                        <p className="text-sm">{`Intensity: ${hoveredSensor.z ?? 'N/A'}`}</p>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center space-x-6 text-sm text-slate-300">
                <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-pink-500 rounded-full bg-transparent"></div>
                    <span>Sensor Locations</span>
                </div>
                <div className="flex items-center space-x-6 ml-8">
                    <div className="flex items-center space-x-1">
                        <div className="w-4 h-4 bg-slate-800 border border-slate-600"></div>
                        <span>Low Intensity</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <div className="w-4 h-4 bg-yellow-200 border border-slate-600"></div>
                        <span>High Intensity</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SensorHeatmapChart;