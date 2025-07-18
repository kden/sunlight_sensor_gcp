/*
 * SensorLevels.tsx
 *
 * Contains the sensor levels line graph and associated components.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

"use client";

import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import usePersistentState from '@/app/hooks/usePersistentState';
import { useSensorLevelsData } from '@/app/hooks/useSensorLevelsData';
import { useSensorSelection } from '@/app/hooks/useSensorSelection';
import { useDailyWeather } from '@/app/hooks/useDailyWeather';
import Toolbar from './Toolbar';
import SensorLevelsChart from './SensorLevelsChart';
import StatusDisplay from './StatusDisplay';
import WeatherDataTable from './WeatherDataTable';

const getTodayString = () => {
  return DateTime.local().toISODate();
};

const SensorLevels = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [highlightedSensor, setHighlightedSensor] = useState<string | null>(null);
  const [maxIntensity, setMaxIntensity] = useState(10000);

  // State for user selections
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

  // Hooks for fetching chart-specific data
  const { readings, sensorIds, hourlyTicks, axisDomain, loading, error } = useSensorLevelsData(selectedDate, selectedSensorSet, timezone);
  // Fetch weather data
  const { weatherData, loading: weatherLoading, error: weatherError } = useDailyWeather(selectedDate, selectedSensorSet);


  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate the maximum intensity from the day's readings to set the Y-axis domain.
  useEffect(() => {
    if (readings && readings.length > 0 && sensorIds && sensorIds.length > 0) {
      const maxVal = readings.reduce((max, current) => {
        const readingMax = Math.max(...sensorIds.map(id => (current[id] as number) || 0));
        return Math.max(max, readingMax);
      }, 0);
      // If we found a max value, round it up to the nearest 1000 for a cleaner axis.
      // Otherwise, keep the default.
      if (maxVal > 0) {
        setMaxIntensity(Math.ceil(maxVal / 1000) * 1000);
      } else {
        setMaxIntensity(10000); // Default if no data
      }
    }
  }, [readings, sensorIds]);

  const handleLegendClick = (dataKey: string) => {
    setHighlightedSensor(prev => (prev === dataKey ? null : dataKey));
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
        data={readings}
        loadingMessage={`Loading sensor data for ${selectedDate}...`}
        noDataMessage="No data found for the selected date."
      />

      {/* The graph only renders when all conditions are met */}
      {!loading && !error && readings && readings.length > 0 && sensorIds && (
        <SensorLevelsChart
          readings={readings}
          sensorIds={sensorIds}
          hourlyTicks={hourlyTicks}
          axisDomain={axisDomain}
          timezone={timezone}
          highlightedSensor={highlightedSensor}
          onLegendClick={handleLegendClick}
          // Pass the sunrise and sunset data down to the chart.
          // We use optional chaining `?.` in case weatherData is still loading.
          sunrise={weatherData?.sunrise ?? null}
          sunset={weatherData?.sunset ?? null}
          maxIntensity={maxIntensity}
        />
      )}

      {/* Render the Daily Weather Summary Section */}
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

export default SensorLevels;