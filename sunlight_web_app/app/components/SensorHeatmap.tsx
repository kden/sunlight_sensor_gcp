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
import { useSensorSets } from '@/app/hooks/useSensorSets';
import { DateTime } from 'luxon';
import usePersistentState from '@/app/hooks/usePersistentState';
import Toolbar from './Toolbar';
import StatusDisplay from './StatusDisplay';
import SensorHeatmapChart from './SensorHeatmapChart';
import { useSensorHeatmapData } from '@/app/hooks/useSensorHeatmapData'; // Import the new hook

// --- Interfaces and Constants ---
interface ChartDataPoint {
    x: number;
    y: number;
    z: number | undefined; // Light Intensity
}

const YARD_LENGTH = 133;
const YARD_WIDTH = 33;

const getTodayString = () => {
  return DateTime.local().toISODate();
};

const SensorHeatmap = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  // --- State for user selections ---
  const [selectedDate, setSelectedDate] = usePersistentState('selectedDate', getTodayString());
  const [selectedSensorSet, setSelectedSensorSet] = usePersistentState<string>('selectedSensorSet', '');
  const [timezone, setTimezone] = useState('');

  // --- Custom hooks for data fetching ---
  const { sensorSets, loading: sensorSetsLoading, error: sensorSetsError } = useSensorSets();
  const { sensorMetadata, readings, timestamps, loading, error } = useSensorHeatmapData(selectedDate, selectedSensorSet, timezone);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Effect to set a default sensor set if none is selected
  useEffect(() => {
    if (sensorSets.length > 0 && !selectedSensorSet) {
      const defaultSet = sensorSets[0];
      setSelectedSensorSet(defaultSet.id);
      setTimezone(defaultSet.timezone);
    }
  }, [sensorSets, selectedSensorSet, setSelectedSensorSet]);

  // Effect to update the timezone when the selected set changes
  useEffect(() => {
    if (selectedSensorSet && sensorSets.length > 0) {
      const currentSet = sensorSets.find(s => s.id === selectedSensorSet);
      if (currentSet) {
        setTimezone(currentSet.timezone);
      }
    }
  }, [selectedSensorSet, sensorSets]);

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
    const currentTimestamp = timestamps[currentTimeIndex];
    const currentReadings = readings[currentTimestamp] || {};
    const newChartData = sensorMetadata.map(sensor => ({
        x: sensor.position_y_ft,
        y: sensor.position_x_ft,
        z: currentReadings[sensor.id]
    }));
    setChartData(newChartData);
  }, [currentTimeIndex, readings, sensorMetadata, timestamps]);

  const handleSensorSetChange = (setId: string, newTimezone: string) => {
    setSelectedSensorSet(setId);
    setTimezone(newTimezone);
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
    </div>
  );
};

export default SensorHeatmap;
