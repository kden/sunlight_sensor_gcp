// sunlight_web_app/app/page.tsx
"use client"; // This directive is necessary for using hooks like useState and useEffect

import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, getDocs, DocumentData, Firestore } from 'firebase/firestore';

// --- Define the Sensor data structure ---
interface Sensor {
  id: string;
  sensor_id: string;
  position_x_ft: number;
  position_y_ft: number;
  board: string;
  sunlight_sensor_model: string;
  // Add other fields from your metadata as needed
}

// --- Mock Data for Local Development ---
const mockSensorData: Sensor[] = [
  { id: '1', sensor_id: 'mock_sensor_1', position_x_ft: 10, position_y_ft: 20, board: 'esp32-mock', sunlight_sensor_model: 'mock-bh1750' },
  { id: '2', sensor_id: 'mock_sensor_2', position_x_ft: 30, position_y_ft: 40, board: 'esp32-mock', sunlight_sensor_model: 'mock-bh1750' },
  { id: '3', sensor_id: 'mock_sensor_3', position_x_ft: 50, position_y_ft: 60, board: 'esp32-mock', sunlight_sensor_model: 'mock-bh1750' },
];

// --- Firebase Configuration ---
// IMPORTANT: In a real application, use environment variables for this.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// --- Safer Firebase Initialization ---
const useMockData = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

let app: FirebaseApp;
let db: Firestore | null = null;

// Conditionally initialize Firebase only if not using mock data
if (!useMockData) {
  // This check prevents re-initializing the app on every hot-reload
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
}


export default function Home() {
  // --- State Hooks with TypeScript types ---
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSensors = async () => {
      // If using mock data, just use the local array.
      if (useMockData) {
        console.log("Using mock data for development.");
        // Simulate a small network delay
        setTimeout(() => {
            setSensors(mockSensorData);
            setLoading(false);
        }, 500);
        return;
      }

      // Otherwise, fetch from Firebase.
      try {
        if (!db) {
          throw new Error("Firestore is not initialized. Make sure NEXT_PUBLIC_USE_MOCK_DATA is not 'true' and firebaseConfig is correct.");
        }
        const sensorsCollection = collection(db, 'sensor_metadata');
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
        setError('Failed to load sensor data. Ensure Firebase config is correct and check security rules.');
      } finally {
        setLoading(false);
      }
    };

    fetchSensors();
  }, []);

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <header className="bg-gray-800 p-4 shadow-md">
        <h1 className="text-3xl font-bold text-center text-teal-300">Sunlight Sensor Dashboard</h1>
      </header>
      <main className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4 text-teal-400">Sensor Metadata</h2>
          {loading && <p className="text-center text-lg">Loading sensor data...</p>}
          {error && <p className="text-center text-red-400 bg-gray-800 p-4 rounded-lg shadow-lg">{error}</p>}
          {!loading && !error && (
            <div className="overflow-x-auto">
                <table className="min-w-full bg-gray-800 rounded-lg shadow">
                    <thead>
                        <tr className="bg-gray-700">
                            <th className="p-3 text-left text-sm font-semibold text-teal-300 uppercase tracking-wider">Sensor ID</th>
                            <th className="p-3 text-left text-sm font-semibold text-teal-300 uppercase tracking-wider">Position X (ft)</th>
                            <th className="p-3 text-left text-sm font-semibold text-teal-300 uppercase tracking-wider">Position Y (ft)</th>
                            <th className="p-3 text-left text-sm font-semibold text-teal-300 uppercase tracking-wider">Board</th>
                            <th className="p-3 text-left text-sm font-semibold text-teal-300 uppercase tracking-wider">Sunlight Sensor</th>
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
      </main>
    </div>
  );
}
