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

import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import usePersistentState from '@/app/hooks/usePersistentState';
import { useSensorHeatmapData } from '@/app/hooks/useSensorHeatmapData';
import { useSensorSelection } from '@/app/hooks/useSensorSelection';
import { useDailyWeather } from '@/app/hooks/useDailyWeather';
import Toolbar from './Toolbar';
import StatusDisplay from './StatusDisplay';
import SensorHeatmapChart from './SensorHeatmapChart';
import WeatherDataTable from './WeatherDataTable';
import { ChartDataPoint } from "@/app/types/ChartDataPoint";

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
  const { sensorMetadata, readings, timestamps, loading, error } = useSensorHeatmapData(selectedDate, selectedSensorSet, timezone);
  const { weatherData, loading: weatherLoading, error: weatherError } = useDailyWeather(selectedDate, selectedSensorSet);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate the maximum intensity from all readings for the day.
  // This is used to scale the colors in the heatmap.
  useEffect(() => {
    if (readings && Object.keys(readings).length > 0) {
      // First, flatten all potential readings from the nested object into a single array.
      const allValues = Object.values(readings).flatMap(timestampReadings => Object.values(timestampReadings));
      // Next, filter this array to include only numbers, which also acts as a type guard for TypeScript.
      const allIntensities = allValues.filter((v): v is number => typeof v === 'number');
      const maxVal = Math.max(0, ...allIntensities);

      // Use the actual max value for accurate color scaling. Default to 10000 if no data.
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
        x: sensor.position_y_ft,  // x and y are intentionally reversed because the view of the yard is rotated
        y: sensor.position_x_ft,
        z: currentReadings[sensor.id],
        sensor_id: sensor.id,
    }));
    setChartData(newChartData);
  }, [currentTimeIndex, readings, sensorMetadata, timestamps]);

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
      <div className="mt-8">
        {weatherLoading && <p className="text-center mt-4">Loading daily weather...</p>}
        {weatherError && <p className="text-red-500 text-center mt-4">{weatherError}</p>}
        {weatherData && timezone && (
          <WeatherDataTable data={weatherData} timezone={timezone} />
        )}
        {/* Show a message if the weather data fetch is complete but no data was found */}
        {!weatherLoading && !weatherError && !weatherData && (
            <p className="text-center mt-4">No daily weather summary available for this date.</p>
        )}
      </div>
    </div>
  );
};

export default SensorHeatmap;