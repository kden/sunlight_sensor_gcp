/*
 * useSensorSelection.ts
 *
 * Manages the state for sensor set selection, including persistence and
 * synchronization of timezone and location data.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

"use client"; // Add this directive to the top of the file.

import { useEffect } from 'react';
import { useSensorSets } from './useSensorSets';
import usePersistentState from './usePersistentState';

export const useSensorSelection = () => {
  // 1. Fetch the raw data
  const { sensorSets, loading: sensorSetsLoading, error: sensorSetsError } = useSensorSets();

  // 2. Manage all related state using persistent storage
  // Note: We use a single set of keys for consistency across the app.
  const [selectedSensorSet, setSelectedSensorSet] = usePersistentState<string>('selectedSensorSet', '');
  const [timezone, setTimezone] = usePersistentState<string>('timezone', '');
  const [latitude, setLatitude] = usePersistentState<number | null>('latitude', null);
  const [longitude, setLongitude] = usePersistentState<number | null>('longitude', null);

  // 3. The synchronization logic, now in one central place
  useEffect(() => {
    if (sensorSets.length === 0) return;

    let currentSet = sensorSets.find(s => s.id === selectedSensorSet);

    // If no set is selected or the persisted one is invalid, default to the first.
    if (!currentSet && sensorSets.length > 0) {
      currentSet = sensorSets[0];
      setSelectedSensorSet(currentSet.id);
    }

    // Always synchronize details from the valid current set.
    if (currentSet) {
      setTimezone(currentSet.timezone);
      setLatitude(currentSet.latitude);
      setLongitude(currentSet.longitude);
    }
  }, [sensorSets, selectedSensorSet, setSelectedSensorSet, setTimezone, setLatitude, setLongitude]);

  // 4. Provide a single handler to update the state
  const handleSensorSetChange = (setId: string, newTimezone: string, newLat: number | null, newLon: number | null) => {
    setSelectedSensorSet(setId);
    setTimezone(newTimezone);
    setLatitude(newLat);
    setLongitude(newLon);
  };

  return {
    sensorSets,
    sensorSetsLoading,
    sensorSetsError,
    selectedSensorSet,
    timezone,
    latitude,
    longitude,
    handleSensorSetChange,
  };
};