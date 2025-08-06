/*
 * SensorHeatmap.tsx
 *
 * Contains the sensor heatmap and associated components.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

"use client";

import {useState, useEffect} from 'react';
import {DateTime} from 'luxon';
import usePersistentState from '@/app/hooks/usePersistentState';
import {useSensorHeatmapData} from '@/app/hooks/useSensorHeatmapData';
import {useSensorSelection} from '@/app/hooks/useSensorSelection';
import {useDailyWeather} from '@/app/hooks/useDailyWeather';
import {useHourlyWeather} from '@/app/hooks/useHourlyWeather';
import Toolbar from './Toolbar';
import StatusDisplay from './StatusDisplay';
import SensorHeatmapChart from './SensorHeatmapChart';
import WeatherDataTable from './WeatherDataTable';
import HourlyWeatherDataTable from './HourlyWeatherDataTable';
import {ChartDataPoint} from "@/app/types/ChartDataPoint";

const YARD_LENGTH = 133;
const YARD_WIDTH = 33;

const getTodayString = () => {
    return DateTime.local().toISODate();
};

const SensorHeatmap = () => {
    const [isMounted, setIsMounted] = useState(false);
    const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [maxIntensity, setMaxIntensity] = useState(10000);

    // --- State for user selections ---
    const [selectedDate, setSelectedDate] = usePersistentState('selectedDate', getTodayString());

    // --- Refactored State Management ---
    const {
        sensorSets,
        sensorSetsLoading,
        sensorSetsError,
        selectedSensorSet,
        timezone,
        latitude,
        longitude,
        handleSensorSetChange,
    } = useSensorSelection();

    // --- Custom hooks for data fetching ---
    const {
        sensorMetadata,
        readings,
        timestamps,
        loading,
        error
    } = useSensorHeatmapData(selectedDate, selectedSensorSet, timezone);
    const {
        weatherData,
        loading: weatherLoading,
        error: weatherError
    } = useDailyWeather(selectedDate, selectedSensorSet);
    const {
        hourlyWeatherData,
        loading: hourlyWeatherLoading,
        error: hourlyWeatherError
    } = useHourlyWeather(selectedDate, selectedSensorSet);

    // --- Track the hovered hour for weather data table ---
    const [hoveredHour, setHoveredHour] = useState<number | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Calculate the maximum intensity from all readings for the day.
    useEffect(() => {
        if (readings && Object.keys(readings).length > 0) {
            const allValues = Object.values(readings).flatMap(timestampReadings => Object.values(timestampReadings));
            const allIntensities = allValues.filter((v): v is number => typeof v === 'number');
            const maxVal = Math.max(0, ...allIntensities);
            setMaxIntensity(maxVal > 0 ? maxVal : 10000);
        } else {
            setMaxIntensity(10000);
        }
    }, [readings]);

    // Effect to reset the time slider when the data changes
    useEffect(() => {
        setCurrentTimeIndex(0);
    }, [timestamps]);

    // Effect to transform data for the chart when the time slider or data changes
    useEffect(() => {
        if (timestamps.length === 0 || sensorMetadata.length === 0) {
            setChartData([]);
            return;
        }
        if (currentTimeIndex >= timestamps.length) {
            return;
        }
        const currentTimestamp = timestamps[currentTimeIndex];
        const currentReadings = readings[currentTimestamp] || {};
        const newChartData: ChartDataPoint[] = sensorMetadata.map(sensor => ({
            x: sensor.position_y_ft,
            y: sensor.position_x_ft,
            z: currentReadings[sensor.id],
            sensor_id: sensor.id,
        }));
        setChartData(newChartData);
    }, [currentTimeIndex, readings, sensorMetadata, timestamps]);

    // --- Update hoveredHour when slider moves ---
    useEffect(() => {
        if (timestamps.length > 0) {
            setHoveredHour(timestamps[currentTimeIndex]);
        } else {
            setHoveredHour(null);
        }
    }, [currentTimeIndex, timestamps]);

    if (!isMounted) {
        return null;
    }

    return (
        <div>
            <Toolbar
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                selectedSensorSet={selectedSensorSet}
                onSensorSetChange={handleSensorSetChange}
                sensorSets={sensorSets}
                sensorSetsLoading={sensorSetsLoading}
                sensorSetsError={sensorSetsError}
                timezone={timezone}
                latitude={latitude}
                longitude={longitude}
            />

            <StatusDisplay
                loading={loading}
                error={error}
                data={timestamps}
                loadingMessage={`Loading heatmap data for ${selectedDate}...`}
                noDataMessage="No data found for the selected date."
            />

            {!loading && !error && timestamps.length > 0 && (
                <div className="w-full">
                    <SensorHeatmapChart
                        chartData={chartData}
                        yardLength={YARD_LENGTH}
                        yardWidth={YARD_WIDTH}
                        maxIntensity={maxIntensity}
                    />

                    <div className="mt-4">
                        <label htmlFor="time-slider" className="block mb-2">
                            Time: {timestamps[currentTimeIndex]
                            ? DateTime.fromMillis(timestamps[currentTimeIndex]).setZone(timezone).toFormat('h:mm a')
                            : 'N/A'}
                        </label>
                        <input
                            id="time-slider"
                            type="range"
                            min="0"
                            max={timestamps.length > 0 ? timestamps.length - 1 : 0}
                            value={currentTimeIndex}
                            onChange={(e) => setCurrentTimeIndex(Number(e.target.value))}
                            className="w-full"
                            disabled={timestamps.length === 0}
                        />
                    </div>
                </div>
            )}

            {/* --- Daily Weather Summary Section --- */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    {weatherLoading && <p className="text-center mt-4">Loading daily weather...</p>}
                    {weatherError && <p className="text-red-500 text-center mt-4">{weatherError}</p>}
                    {weatherData && timezone && (
                        <WeatherDataTable data={weatherData} timezone={timezone}/>
                    )}
                    {!weatherLoading && !weatherError && !weatherData && (
                        <p className="text-center mt-4">No daily weather summary available for this date.</p>
                    )}
                </div>
                <div className="border-l border-gray-700 pl-4">
                    {hourlyWeatherLoading && <p className="text-center mt-4">Loading hourly weather...</p>}
                    {hourlyWeatherError && <p className="text-red-500 text-center mt-4">{hourlyWeatherError}</p>}
                    {hoveredHour && timezone && (
                        (() => {
                            const sortedHourlyWeather = [...hourlyWeatherData].sort((a, b) => a.time.toMillis() - b.time.toMillis());
                            const hourData =
                                sortedHourlyWeather.find(w => w.time.toMillis() === hoveredHour) ||
                                sortedHourlyWeather.filter(w => w.time.toMillis() < hoveredHour).slice(-1)[0];

                            if (!hourData) {
                                return <p className="text-gray-400 mt-4">No hourly weather data available for this
                                    hour.</p>;
                            }
                            return (
                                <HourlyWeatherDataTable data={hourData} timezone={timezone}/>
                            );
                        })()
                    )}
                    {!hoveredHour && (
                        <p className="text-gray-400 mt-4">Slide the time bar to see hourly weather details.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SensorHeatmap;