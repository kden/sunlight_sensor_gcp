/*
 * SensorHeatmap.tsx
 *
 * Contains the sensor heatmap and associated components.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025), and Claude Sonnet 4 (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

"use client";

import {useState, useEffect, useRef, useCallback} from 'react';
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
    const [isPlaying, setIsPlaying] = useState(false);
    const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        setIsPlaying(false); // Stop playing when data changes
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

    // Find the index closest to sunrise time
    const findSunriseIndex = useCallback((): number => {
        if (!weatherData?.sunrise || timestamps.length === 0 || !timezone) {
            return 0;
        }

        const sunriseTime = weatherData.sunrise.setZone(timezone);
        let closestIndex = 0;
        let minDiff = Math.abs(timestamps[0] - sunriseTime.toMillis());

        for (let i = 1; i < timestamps.length; i++) {
            const diff = Math.abs(timestamps[i] - sunriseTime.toMillis());
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }

        return closestIndex;
    }, [weatherData?.sunrise, timestamps, timezone]);

    // Find the index closest to sunset time
    const findSunsetIndex = useCallback((): number => {
        if (!weatherData?.sunset || timestamps.length === 0 || !timezone) {
            return timestamps.length - 1;
        }

        const sunsetTime = weatherData.sunset.setZone(timezone);
        let closestIndex = timestamps.length - 1;
        let minDiff = Math.abs(timestamps[timestamps.length - 1] - sunsetTime.toMillis());

        for (let i = 0; i < timestamps.length; i++) {
            const diff = Math.abs(timestamps[i] - sunsetTime.toMillis());
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }

        return closestIndex;
    }, [weatherData?.sunset, timestamps, timezone]);

    // Effect to manage the animation interval.
    // This is the single source of truth for starting/stopping the animation.
    useEffect(() => {
        if (isPlaying) {
            // If playing, set up an interval to advance the time index.
            playIntervalRef.current = setInterval(() => {
                setCurrentTimeIndex(prevIndex => {
                    const sunsetIndex = findSunsetIndex();
                    const nextIndex = prevIndex + 1;

                    // Stop if we reach the end of the data or the sunset index.
                    if (nextIndex >= timestamps.length || nextIndex > sunsetIndex) {
                        setIsPlaying(false); // This will trigger the cleanup in this effect.
                        return sunsetIndex; // Settle on the sunset frame.
                    }
                    return nextIndex;
                });
            }, 250); // Animation speed
        }

        // Cleanup function: This runs when isPlaying becomes false or the component unmounts.
        return () => {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
                playIntervalRef.current = null;
            }
        };
    }, [isPlaying, findSunsetIndex, timestamps.length]);

    const handlePlayPause = () => {
        const sunriseIndex = findSunriseIndex();
        const sunsetIndex = findSunsetIndex();

        // Condition to restart from sunrise:
        // 1. It's not currently playing.
        // 2. The current time is either before sunrise or at/after sunset.
        const shouldRestart = !isPlaying && (currentTimeIndex < sunriseIndex || currentTimeIndex >= sunsetIndex);

        if (shouldRestart) {
            setCurrentTimeIndex(sunriseIndex);
            setIsPlaying(true);
        } else {
            // Otherwise, just toggle the play/pause state.
            // This handles pausing if it's playing, and resuming if it's paused mid-day.
            setIsPlaying(prevIsPlaying => !prevIsPlaying);
        }
    };

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
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handlePlayPause}
                                className={`p-2 rounded-md transition-colors ${
                                    isPlaying
                                        ? 'bg-gray-200 hover:bg-gray-300 text-black'
                                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                                }`}
                                disabled={timestamps.length === 0}
                                title={timestamps.length === 0 ? "No data available" : (isPlaying ? "Pause" : "Play from sunrise")}
                            >
                                {isPlaying ? (
                                    <div className="flex gap-1">
                                        <div className="w-1 h-4 bg-black"></div>
                                        <div className="w-1 h-4 bg-black"></div>
                                    </div>
                                ) : (
                                    <div className="w-0 h-0 border-l-[8px] border-l-white border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent"></div>
                                )}
                            </button>

                            <input
                                id="time-slider"
                                type="range"
                                min="0"
                                max={timestamps.length > 0 ? timestamps.length - 1 : 0}
                                value={currentTimeIndex}
                                onChange={(e) => {
                                    const newIndex = Number(e.target.value);
                                    setCurrentTimeIndex(newIndex);
                                    // Pause if user manually moves slider while playing.
                                    // The useEffect hook will handle clearing the interval.
                                    if (isPlaying) {
                                        setIsPlaying(false);
                                    }
                                }}
                                className="flex-1"
                                disabled={timestamps.length === 0}
                            />
                        </div>
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