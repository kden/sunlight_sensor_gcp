/*
 * Toolbar.tsx
 *
 * Contains filtering components for a chart display.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React, { useEffect } from 'react';
import SensorSetDropdown from "@/app/components/SensorSetDropdown";
import { SensorSet } from '@/app/types/SensorSet';

const MIN_DATE = '2025-08-01';
const MAX_DATE = '2025-11-30';
const clampDate = (d: string) => (d < MIN_DATE ? MIN_DATE : d > MAX_DATE ? MAX_DATE : d);

interface ToolbarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedSensorSet: string;
  onSensorSetChange: (setId: string, timezone: string, latitude: number | null, longitude: number | null) => void;
  sensorSets: SensorSet[];
  sensorSetsLoading: boolean;
  sensorSetsError: string | null;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
}

const Toolbar: React.FC<ToolbarProps> = ({
  selectedDate,
  onDateChange,
  selectedSensorSet,
  onSensorSetChange,
  sensorSets,
  sensorSetsLoading,
  sensorSetsError,
  timezone,
  latitude,
  longitude,
}) => {
  // Snap any out-of-range date (e.g. today's default or persisted state) into the allowed window.
  useEffect(() => {
    if (selectedDate && clampDate(selectedDate) !== selectedDate) {
      onDateChange(clampDate(selectedDate));
    }
  }, [selectedDate, onDateChange]);

  return (
    <div className="mb-4 flex items-center flex-wrap gap-4">
      {/* Date Picker */}
      <div className="flex items-center">
        <label htmlFor="date-picker" className="mr-2">Select Date:</label>
        <input
          type="date"
          id="date-picker"
          value={selectedDate}
          min={MIN_DATE}
          max={MAX_DATE}
          onChange={(e) => e.target.value && onDateChange(clampDate(e.target.value))}
          className="bg-gray-700 text-white p-2 rounded"
        />
      </div>

      {/* Sensor Set Dropdown */}
      <div className="flex items-center">
        <label htmlFor="sensor-set-picker" className="mr-2">Sensor Set:</label>
        {sensorSetsLoading && <p>Loading sets...</p>}
        {sensorSetsError && <p className="text-red-500">{sensorSetsError}</p>}
        {sensorSets.length > 0 && (
          <SensorSetDropdown
            id="sensor-set-picker"
            sensorSets={sensorSets}
            selectedSensorSet={selectedSensorSet}
            onChange={onSensorSetChange}
          />
        )}
      </div>

      {/* Timezone Display */}
      {timezone && <span className="text-gray-400">Timezone: {timezone}</span>}

      {/* Lat/Lon Display */}
      {latitude !== null && longitude !== null && (
        <span className="text-gray-400">
          Lat: {latitude.toFixed(3)}, Lon: {longitude.toFixed(3)}
        </span>
      )}
    </div>
  );
};

export default Toolbar;