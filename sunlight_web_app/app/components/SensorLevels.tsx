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
import { useSensorSelection } from '@/app/hooks/useSensorSelection'; // <-- Import the new hook
import Toolbar from './Toolbar';
import SensorLevelsChart from './SensorLevelsChart';
import StatusDisplay from './StatusDisplay';

const getTodayString = () => {
  return DateTime.local().toISODate();
};

const SensorLevels = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [highlightedSensor, setHighlightedSensor] = useState<string | null>(null);

  // State for user selections
  const [selectedDate, setSelectedDate] = usePersistentState('selectedDate', getTodayString());

  // --- Refactored State Management ---
  // All the complex sensor selection logic is now handled by this single hook.
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

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
        />
      )}
    </div>
  );
};

export default SensorLevels;