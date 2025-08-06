/*
 * SensorLevels.tsx
 *
 * Contains the sensor levels line graph and associated components.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025), and Claude Sonnet 4 (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */
/*
 * SensorLevels.tsx
 *
 * Contains the sensor levels line graph and associated components.
 */

"use client";

import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import usePersistentState from '@/app/hooks/usePersistentState';
import { useSensorLevelsData } from '@/app/hooks/useSensorLevelsData';
import { useSensorSelection } from '@/app/hooks/useSensorSelection';
import { useDailyWeather } from '@/app/hooks/useDailyWeather';
import { useHourlyWeather } from '@/app/hooks/useHourlyWeather';
import Toolbar from './Toolbar';
import SensorLevelsChart from './SensorLevelsChart';
import StatusDisplay from './StatusDisplay';
import WeatherDataTable from './WeatherDataTable';
import HourlyWeatherDataTable from './HourlyWeatherDataTable';

const getTodayString = () => DateTime.local().toISODate();

const SensorLevels = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [highlightedSensor, setHighlightedSensor] = useState<string | null>(null);
  const [hiddenRadiationLines, setHiddenRadiationLines] = useState<Set<string>>(new Set());
  const [maxIntensity, setMaxIntensity] = useState(10000);

  const [selectedDate, setSelectedDate] = usePersistentState('selectedDate', getTodayString());

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

  const { readings, sensorIds, hourlyTicks, axisDomain, loading, error } = useSensorLevelsData(selectedDate, selectedSensorSet, timezone);
  const { weatherData, loading: weatherLoading, error: weatherError } = useDailyWeather(selectedDate, selectedSensorSet);
  const { hourlyWeatherData, loading: hourlyWeatherLoading, error: hourlyWeatherError } = useHourlyWeather(selectedDate, selectedSensorSet);

  const sortedHourlyWeather = [...hourlyWeatherData].sort((a, b) => a.time.toMillis() - b.time.toMillis());
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  useEffect(() => {
    if (hourlyWeatherData.length > 0) {
      const sorted = [...hourlyWeatherData].sort((a, b) => a.time.toMillis() - b.time.toMillis());
      setHoveredHour(sorted[0].time.toMillis());
    }
  }, [hourlyWeatherData]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (readings && readings.length > 0 && sensorIds && sensorIds.length > 0) {
      const sensorMax = readings.reduce((max, current) => {
        const readingMax = Math.max(...sensorIds.map(id => (current[id] as number) || 0));
        return Math.max(max, readingMax);
      }, 0);
      setMaxIntensity(sensorMax > 0 ? Math.ceil(sensorMax / 1000) * 1000 : 10000);
    }
  }, [readings, sensorIds]);

  const handleLegendClick = (dataKey: string) => {
    if (dataKey === 'direct_radiation' || dataKey === 'shortwave_radiation') {
      setHiddenRadiationLines(prev => {
        const newSet = new Set(prev);
        if (newSet.has(dataKey)) newSet.delete(dataKey);
        else newSet.add(dataKey);
        return newSet;
      });
    } else {
      setHighlightedSensor(prev => (prev === dataKey ? null : dataKey));
    }
  };

  if (!isMounted) return null;

  const isLoading = loading || hourlyWeatherLoading;
  const hasError = error || hourlyWeatherError;
  const combinedError = hasError ? (error || hourlyWeatherError) : null;

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
        loading={isLoading}
        error={combinedError}
        data={readings}
        loadingMessage={`Loading sensor data for ${selectedDate}...`}
        noDataMessage="No data found for the selected date."
      />

      {!isLoading && !hasError && readings && readings.length > 0 && sensorIds && (
        <SensorLevelsChart
          readings={readings}
          sensorIds={sensorIds}
          hourlyTicks={hourlyTicks}
          axisDomain={axisDomain}
          timezone={timezone}
          highlightedSensor={highlightedSensor}
          hiddenRadiationLines={hiddenRadiationLines}
          onLegendClick={handleLegendClick}
          sunrise={weatherData?.sunrise ?? null}
          sunset={weatherData?.sunset ?? null}
          maxIntensity={maxIntensity}
          hourlyWeatherData={hourlyWeatherData}
          onHoverHourChange={(hour) => hour !== null && setHoveredHour(hour)}
        />
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          {weatherLoading && <p className="text-center mt-4">Loading daily weather...</p>}
          {weatherError && <p className="text-red-500 text-center mt-4">{weatherError}</p>}
          {weatherData && timezone && <WeatherDataTable data={weatherData} timezone={timezone} />}
          {!weatherLoading && !weatherError && !weatherData && (
            <p className="text-center mt-4">No daily weather summary available for this date.</p>
          )}
        </div>

        <div className="border-l border-gray-700 pl-4">
          {hoveredHour && timezone && (
            (() => {
              const hourData = hourlyWeatherData.find(w => w.time.toMillis() === hoveredHour);
              if (!hourData) {
                return <p className="text-gray-400">No hourly data available for this hour.</p>;
              }
              return <HourlyWeatherDataTable data={hourData} timezone={timezone} />;
            })()
          )}
          {!hoveredHour && (
            <p className="text-gray-400">Hover over the graph to see hourly weather details.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SensorLevels;
