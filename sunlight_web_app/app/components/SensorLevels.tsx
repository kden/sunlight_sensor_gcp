// sunlight_web_app/app/components/SensorGraph.tsx

"use client";

import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import { useSensorSets } from '@/app/hooks/useSensorSets';
import usePersistentState from '@/app/hooks/usePersistentState';
import { useSensorLevelsData } from '@/app/hooks/useSensorLevelsData';
import Toolbar from './Toolbar';
import SensorLevelsGraph from './SensorLevelsGraph';
import StatusDisplay from './StatusDisplay'; // Import the new component

const getTodayString = () => {
  return DateTime.local().toISODate();
};

const SensorLevels = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [highlightedSensor, setHighlightedSensor] = useState<string | null>(null);

  // State for user selections
  const [selectedDate, setSelectedDate] = usePersistentState('selectedDate', getTodayString());
  const [selectedSensorSet, setSelectedSensorSet] = usePersistentState<string>('selectedSensorSet', '');
  const [timezone, setTimezone] = useState('');

  // Hooks for fetching metadata and data
  // FIX: Removed the trailing underscore that was causing a syntax error.
  const { sensorSets, loading: sensorSetsLoading, error: sensorSetsError } = useSensorSets();
  const { readings, sensorIds, hourlyTicks, axisDomain, loading, error } = useSensorLevelsData(selectedDate, selectedSensorSet, timezone);

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

  const handleLegendClick = (dataKey: string) => {
    setHighlightedSensor(current => (current === dataKey ? null : dataKey));
  };

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
        data={readings}
        loadingMessage={`Loading sensor data for ${selectedDate}...`}
        noDataMessage="No data found for the selected date."
      />

      {/* The graph only renders when all conditions are met */}
      {!loading && !error && readings && readings.length > 0 && sensorIds && (
        <SensorLevelsGraph
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
