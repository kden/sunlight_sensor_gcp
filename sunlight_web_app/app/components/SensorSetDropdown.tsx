/*
 * SensorSetDropdown.tsx
 *
 * Renders the dropdown list of sensor sets.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import { SensorSet } from '@/app/types/SensorSet';

interface SensorSetDropdownProps {
  id?: string;
  selectedSensorSet: string;
  sensorSets: SensorSet[]; // <-- Accept the array as a prop
  onChange: (setId: string, timezone: string, latitude: number | null, longitude: number | null) => void;
}

const SensorSetDropdown = ({ id, selectedSensorSet, sensorSets, onChange }: SensorSetDropdownProps) => {
  return (
    <select
      id={id}
      value={selectedSensorSet}
      onChange={(e) => {
        const setId = e.target.value;
        const selectedSet = sensorSets.find(s => s.id === setId);
        if (selectedSet) {
          // Pass all relevant details from the selected set
          onChange(setId, selectedSet.timezone, selectedSet.latitude, selectedSet.longitude);
        }
      }}
      className="bg-gray-700 text-white p-2 rounded"
      disabled={sensorSets.length === 0}
    >
      {sensorSets.map(set => (
        <option key={set.id} value={set.id}>{set.name}</option>
      ))}
    </select>
  );
};

export default SensorSetDropdown;