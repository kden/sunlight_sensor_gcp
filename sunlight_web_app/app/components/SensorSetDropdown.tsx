// SensorSetDropdown.tsx

import { SensorSet } from '@/app/types/SensorSet';

interface SensorSetDropdownProps {
  id?: string;
  selectedSensorSet: string;
  sensorSets: SensorSet[]; // <-- Accept the array as a prop
  onChange: (setId: string, timezone: string) => void;
}

const SensorSetDropdown = ({ id, selectedSensorSet, sensorSets, onChange }: SensorSetDropdownProps) => {

  if (!sensorSets) {
    return <p className="text-red-500">Error: Sensor sets not provided.</p>;
  }

  return (
    <select
      id={id}
      value={selectedSensorSet}
      onChange={(e) => {
        const setId = e.target.value;
        const selectedSet = sensorSets.find(s => s.id === setId);
        if (selectedSet) {
          onChange(setId, selectedSet.timezone);
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