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
import {DateTime} from 'luxon';
import {HourlyWeather} from '@/app/types/HourlyWeather';
import SensorLevelsChartLegend from './SensorLevelsChartLegend';


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
    onHoverHourChange?: (hoveredTime: number | null) => void;
}

const sensorColors = ['#dc2626', '#22c55e', '#f97316', '#84cc16', '#eab308', '#059669'];
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
                                                                 onHoverHourChange,
                                                             }) => {
    const maxRadiation = React.useMemo(() => {
        if (hourlyWeatherData.length === 0) return 1000;
        const maxDirect = Math.max(...hourlyWeatherData.map(w => w.direct_radiation || 0));
        const maxShortwave = Math.max(...hourlyWeatherData.map(w => w.shortwave_radiation || 0));
        const overallMax = Math.max(maxDirect, maxShortwave);
        return overallMax > 0 ? Math.ceil(overallMax / 100) * 100 : 1000;
    }, [hourlyWeatherData]);

    const weatherMap = new Map<number, HourlyWeather>();
    hourlyWeatherData.forEach(weather => {
        weatherMap.set(weather.time.toMillis(), weather);
    });

    const sortedWeatherData = [...hourlyWeatherData].sort((a, b) => a.time.toMillis() - b.time.toMillis());

    const findMostRecentRadiation = (timestamp: number) => {
        const exactMatch = weatherMap.get(timestamp);
        if (exactMatch) return {
            direct_radiation: exactMatch.direct_radiation ?? undefined,
            shortwave_radiation: exactMatch.shortwave_radiation ?? undefined
        };
        let mostRecent = null;
        for (let i = sortedWeatherData.length - 1; i >= 0; i--) {
            const weather = sortedWeatherData[i];
            if (weather.time.toMillis() <= timestamp) {
                mostRecent = weather;
                break;
            }
        }
        return mostRecent ? {
            direct_radiation: mostRecent.direct_radiation ?? undefined,
            shortwave_radiation: mostRecent.shortwave_radiation ?? undefined
        } : {
            direct_radiation: undefined,
            shortwave_radiation: undefined
        };
    };

    const combinedData: CombinedDataPoint[] = React.useMemo(() => {
        const combined = readings.map(reading => {
            const radiationData = findMostRecentRadiation(reading.time);
            return {
                ...reading,
                direct_radiation: radiationData.direct_radiation,
                shortwave_radiation: radiationData.shortwave_radiation,
            };
        });

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

        return combined.sort((a, b) => a.time - b.time);
    }, [readings, hourlyWeatherData]);


    return (
        <div>
            <ResponsiveContainer width="100%" height={400}>
                <LineChart
                    data={combinedData}
                    onMouseMove={(state) => {
                        if (
                            state &&
                            state.activePayload &&
                            state.activePayload.length > 0 &&
                            onHoverHourChange
                        ) {
                            const hoveredTimestamp = state.activePayload[0].payload.time;
                            const snappedHour = sortedWeatherData.reduce((latest, current) => {
                                const currentMillis = current.time.toMillis();
                                return currentMillis <= hoveredTimestamp && currentMillis > latest
                                    ? currentMillis
                                    : latest;
                            }, -Infinity);
                            onHoverHourChange(snappedHour === -Infinity ? null : snappedHour);
                        }
                    }}
                    onMouseLeave={() => onHoverHourChange?.(null)}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444"/>
                    <XAxis
                        dataKey="time"
                        type="number"
                        domain={axisDomain}
                        ticks={hourlyTicks}
                        tickFormatter={(unixTime) =>
                            DateTime.fromMillis(unixTime, {zone: timezone}).toFormat('h a')
                        }
                        stroke="#ccc"
                    />
                    <YAxis
                        yAxisId="sensors"
                        stroke="#ccc"
                        domain={[0, maxIntensity]}
                        allowDataOverflow={true}
                        label={{
                            value: 'Sensor Intensity',
                            angle: -90,
                            position: 'insideLeft',
                            style: {textAnchor: 'middle', fill: '#ccc'}
                        }}
                    />
                    <YAxis
                        yAxisId="radiation"
                        orientation="right"
                        stroke="#ccc"
                        domain={[0, maxRadiation]}
                        allowDataOverflow={true}
                        label={{
                            value: 'Radiation (W/m²)',
                            angle: 90,
                            position: 'insideRight',
                            style: {textAnchor: 'middle', fill: '#ccc'}
                        }}
                    />
                    <Tooltip
                        contentStyle={{backgroundColor: '#333', border: '1px solid #555'}}
                        labelStyle={{color: '#fff'}}
                        labelFormatter={(value) => DateTime.fromMillis(Number(value), {zone: timezone}).toFormat('ff')}
                        formatter={(value, name) => {
                            if (name === 'direct_radiation') return [`${value} W/m²`, 'Direct Radiation'];
                            if (name === 'shortwave_radiation') return [`${value} W/m²`, 'Shortwave Radiation'];
                            return [value, name];
                        }}
                        wrapperStyle={{zIndex: 50}}
                    />

                    {sunrise && (
                        <ReferenceLine
                            yAxisId="sensors"
                            x={sunrise.toMillis()}
                            stroke="yellow"
                            strokeDasharray="3 3"
                            label={{value: 'Sunrise', position: 'insideTopRight', fill: 'yellow', fontSize: 12}}
                        />
                    )}
                    {sunset && (
                        <ReferenceLine
                            yAxisId="sensors"
                            x={sunset.toMillis()}
                            stroke="orange"
                            strokeDasharray="3 3"
                            label={{value: 'Sunset', position: 'insideTopRight', fill: 'orange', fontSize: 12}}
                        />
                    )}

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
            <div className="flex justify-center mt-4">
                <SensorLevelsChartLegend
                    sensorIds={sensorIds}
                    highlightedSensor={highlightedSensor}
                    onLegendClick={onLegendClick}
                    hiddenRadiationLines={hiddenRadiationLines}
                />
            </div>
        </div>
    );
};

export default SensorLevelsChart;
