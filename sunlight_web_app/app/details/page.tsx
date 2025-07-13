/*
 * page.tsx
 *
 * Displays a filterable list of all sensors in a given set.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

"use client";

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, query, where, DocumentData } from 'firebase/firestore';
import { app } from '@/app/firebase';
import { useSensorSets } from '@/app/hooks/useSensorSets';
import usePersistentState from '@/app/hooks/usePersistentState';
import SensorSetDropdown from '@/app/components/SensorSetDropdown';
import StatusDisplay from '@/app/components/StatusDisplay';

// --- Define the Sensor data structure ---
interface Sensor {
  id: string;
  sensor_id: string;
  position_x_ft: number;
  position_y_ft: number;
  board: string;
  sunlight_sensor_model: string;
}

export default function DetailsPage() {
  // State for the filtered list of sensors displayed in the table
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- State for the dropdown filter ---
  const { sensorSets, loading: sensorSetsLoading, error: sensorSetsError } = useSensorSets();
  const [selectedSensorSet, setSelectedSensorSet] = usePersistentState<string>('sensor-details-set', '');
  const [timezone, setTimezone] = usePersistentState<string>('sensor-details-timezone', '');

  // This effect now robustly synchronizes the timezone with the selected sensor set.
  useEffect(() => {
    if (sensorSets.length === 0) return;

    let currentSet = sensorSets.find(s => s.id === selectedSensorSet);

    if (!currentSet) {
      currentSet = sensorSets[0];
      setSelectedSensorSet(currentSet.id);
    }

    if (currentSet && timezone !== currentSet.timezone) {
      setTimezone(currentSet.timezone);
    }
  }, [sensorSets, selectedSensorSet, timezone, setSelectedSensorSet, setTimezone]);

  // This effect re-fetches the sensor list whenever the selected set changes.
  useEffect(() => {
    if (!selectedSensorSet) {
      setLoading(false);
      setSensors([]);
      return;
    }

    const fetchSensors = async () => {
      setLoading(true);
      setError(null);

      try {
        const db = getFirestore(app);
        const sensorsCollection = collection(db, 'sensor');
        const q = query(sensorsCollection, where('sensor_set_id', '==', selectedSensorSet));
        const sensorSnapshot = await getDocs(q);

        const sensorList: Sensor[] = sensorSnapshot.docs.map(doc => {
            const data = doc.data() as DocumentData;
            return {
                id: doc.id,
                sensor_id: data.sensor_id,
                position_x_ft: data.position_x_ft,
                position_y_ft: data.position_y_ft,
                board: data.board,
                sunlight_sensor_model: data.sunlight_sensor_model,
            };
        });

        setSensors(sensorList);
      } catch (err) {
        console.error(`Error fetching sensors for set ${selectedSensorSet}:`, err);
        setError('Failed to load sensor data.');
      } finally {
        setLoading(false);
      }
    };

    fetchSensors();
  }, [selectedSensorSet]);

  return (
    <div className="font-sans">
        <div>
            <h2 className="text-2xl font-semibold mb-4 text-amber-400">Sensor Details</h2>
            <div className="mb-4 flex items-center flex-wrap gap-4">
                <div className="flex items-center">
                    <label htmlFor="sensor-set-picker" className="mr-2">Sensor Set:</label>
                    {sensorSetsLoading && <p>Loading sets...</p>}
                    {sensorSetsError && <p className="text-red-500">{sensorSetsError}</p>}
                    {sensorSets.length > 0 && (
                        <SensorSetDropdown
                            id="sensor-set-picker"
                            sensorSets={sensorSets}
                            selectedSensorSet={selectedSensorSet}
                            onChange={(setId, newTimezone) => {
                                setSelectedSensorSet(setId);
                                setTimezone(newTimezone);
                            }}
                        />
                    )}
                </div>
                {/* Timezone Display */}
                {timezone && <span className="text-gray-400">Timezone: {timezone}</span>}
            </div>

            <StatusDisplay
                loading={loading}
                error={error}
                data={sensors}
                loadingMessage="Loading sensor data..."
                noDataMessage="No sensors found for the selected set."
            />

            {/* --- Sensor Details Table --- */}
            {!loading && !error && sensors.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-gray-800 rounded-lg shadow">
                        <thead>
                        <tr className="bg-gray-700">
                            <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Sensor ID</th>
                            <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Position X (ft)</th>
                            <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Position Y (ft)</th>
                            <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Board</th>
                            <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Sunlight Sensor</th>
                        </tr>
                        </thead>
                        <tbody>
                        {sensors.map((sensor) => (
                            <tr key={sensor.id} className="border-b border-gray-700 hover:bg-gray-600 transition-colors duration-200">
                                <td className="p-3 whitespace-nowrap">{sensor.sensor_id}</td>
                                <td className="p-3 whitespace-nowrap">{sensor.position_x_ft}</td>
                                <td className="p-3 whitespace-nowrap">{sensor.position_y_ft}</td>
                                <td className="p-3 whitespace-nowrap">{sensor.board}</td>
                                <td className="p-3 whitespace-nowrap">{sensor.sunlight_sensor_model}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
  );
}