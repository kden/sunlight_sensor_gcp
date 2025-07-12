"use client";

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, DocumentData } from 'firebase/firestore';
import { app } from '@/app/firebase';

// --- Define the Sensor data structure ---
interface Sensor {
  id: string;
  sensor_id: string;
  position_x_ft: number;
  position_y_ft: number;
  board: string;
  sunlight_sensor_model: string;
}

// --- Mock Data for Local Development ---
const mockSensorData: Sensor[] = [
  { id: '1', sensor_id: 'mock_sensor_1', position_x_ft: 10, position_y_ft: 20, board: 'esp32-mock', sunlight_sensor_model: 'mock-bh1750' },
  { id: '2', sensor_id: 'mock_sensor_2', position_x_ft: 30, position_y_ft: 40, board: 'esp32-mock', sunlight_sensor_model: 'mock-bh1750' },
  { id: '3', sensor_id: 'mock_sensor_3', position_x_ft: 50, position_y_ft: 60, board: 'esp32-mock', sunlight_sensor_model: 'mock-bh1750' },
];

export default function Home() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSensors = async () => {
      const useMockDataRuntime = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

      if (useMockDataRuntime) {
        setSensors(mockSensorData);
        setLoading(false);
        return;
      }

      try {
        const db = getFirestore(app);
        const sensorsCollection = collection(db, 'sensor');
        const sensorSnapshot = await getDocs(sensorsCollection);

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
        console.error("Error fetching sensor data:", err);
        setError('Failed to load sensor data.');
      } finally {
        setLoading(false);
      }
    };

    fetchSensors();
  }, []);

  return (
    <div className="font-sans">
        {/* Removed max-w-4xl and mx-auto for consistent alignment */}
        <div>
          {/* Changed "Sensor Metadata" to "Sensor Details" */}
          <h2 className="text-2xl font-semibold mb-4 text-amber-400">Sensor Details</h2>
          {loading && <p className="text-center text-lg">Loading sensor data...</p>}
          {error && <p className="text-center text-red-400 bg-gray-800 p-4 rounded-lg shadow-lg">{error}</p>}
          {!loading && !error && (
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
