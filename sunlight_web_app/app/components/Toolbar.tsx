// /app/components/Toolbar.tsx

import React from 'react';
import SensorSetDropdown from "@/app/components/SensorSetDropdown";
import { SensorSet } from '@/app/types/SensorSet';

interface ToolbarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedSensorSet: string;
  onSensorSetChange: (setId: string, timezone: string) => void;
  sensorSets: SensorSet[];
  sensorSetsLoading: boolean;
  sensorSetsError: string | null;
  timezone: string;
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
}) => {
  return (
    <div className="mb-4 flex items-center flex-wrap gap-4">
      {/* Date Picker */}
      <div className="flex items-center">
        <label htmlFor="date-picker" className="mr-2">Select Date:</label>
        <input
          type="date"
          id="date-picker"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
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
    </div>
  );
};

export default Toolbar;
