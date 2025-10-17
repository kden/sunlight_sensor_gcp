/*
 * app/sensors/page.tsx
 *
 * Sensor details page showing metadata and latest readings.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4.5 (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase';

interface SensorMetadata {
    sensor_id: string;
    sensor_set_id: string;
    position_x_ft: number;
    position_y_ft: number;
    board: string;
    sunlight_sensor_model: string;
    has_display: boolean;
    display_model: string;
    wifi_antenna: string;
}

interface SensorSetMetadata {
    sensor_set_id: string;
    timezone: string;
    latitude: number;
    longitude: number;
}

interface LatestReading {
    sensor_id: string;
    light_intensity: number | null;
    battery_percent: number | null;
    wifi_dbm: number | null;
    chip_temp_f: number | null;
    last_seen: string | null;
}

interface CombinedSensorData extends SensorMetadata {
    light_intensity: number | null;
    battery_percent: number | null;
    wifi_dbm: number | null;
    chip_temp_f: number | null;
    last_seen: string | null;
}

export default function SensorsPage() {
    const [sensorSetMetadata, setSensorSetMetadata] = useState<SensorSetMetadata | null>(null);
    const [combinedSensorData, setCombinedSensorData] = useState<CombinedSensorData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // For now, hardcode the sensor_set_id - you could make this dynamic later
    const sensorSetId = 'backyard';

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch sensor set metadata from Firebase
                const sensorSetQuery = query(
                    collection(db, 'sensor_set_metadata'),
                    where('sensor_set_id', '==', sensorSetId)
                );
                const sensorSetSnapshot = await getDocs(sensorSetQuery);

                if (!sensorSetSnapshot.empty) {
                    const sensorSetDoc = sensorSetSnapshot.docs[0].data() as SensorSetMetadata;
                    setSensorSetMetadata(sensorSetDoc);
                }

                // Fetch sensor metadata from Firebase
                const sensorQuery = query(
                    collection(db, 'sensor'),
                    where('sensor_set_id', '==', sensorSetId)
                );
                const sensorSnapshot = await getDocs(sensorQuery);
                const sensorMetadata: SensorMetadata[] = sensorSnapshot.docs.map(doc => doc.data() as SensorMetadata);

                // Fetch latest readings from Cassandra via Cloud Function
                const cassandraUrl = `https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/cassandra-latest-readings?sensor_set_id=${sensorSetId}`;
                const response = await fetch(cassandraUrl);

                if (!response.ok) {
                    throw new Error(`Failed to fetch latest readings: ${response.statusText}`);
                }

                const latestReadings: LatestReading[] = await response.json();

                // Create a map of latest readings by sensor_id for efficient lookup
                const readingsMap = new Map<string, LatestReading>();
                latestReadings.forEach(reading => {
                    readingsMap.set(reading.sensor_id, reading);
                });

                // Combine metadata with latest readings
                const combined: CombinedSensorData[] = sensorMetadata.map(sensor => {
                    const reading = readingsMap.get(sensor.sensor_id);
                    return {
                        ...sensor,
                        light_intensity: reading?.light_intensity ?? null,
                        battery_percent: reading?.battery_percent ?? null,
                        wifi_dbm: reading?.wifi_dbm ?? null,
                        chip_temp_f: reading?.chip_temp_f ?? null,
                        last_seen: reading?.last_seen ?? null,
                    };
                });

                // Sort by sensor_id for consistent display
                combined.sort((a, b) => a.sensor_id.localeCompare(b.sensor_id));

                setCombinedSensorData(combined);
            } catch (err) {
                console.error('Error fetching sensor data:', err);
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [sensorSetId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl">Loading sensor data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl text-red-600">Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8">
            <h1 className="text-3xl font-bold mb-6">Sensor Details</h1>

            {sensorSetMetadata && (
                <div className="mb-6 p-4 bg-gray-100 rounded">
                    <p><strong>Sensor Set:</strong> {sensorSetMetadata.sensor_set_id}</p>
                    <p><strong>Timezone:</strong> {sensorSetMetadata.timezone}</p>
                    <p><strong>Location:</strong> Lat: {sensorSetMetadata.latitude.toFixed(3)}, Lon: {sensorSetMetadata.longitude.toFixed(3)}</p>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="px-4 py-2 border">Sensor ID</th>
                        <th className="px-4 py-2 border">Position X (ft)</th>
                        <th className="px-4 py-2 border">Position Y (ft)</th>
                        <th className="px-4 py-2 border">Board</th>
                        <th className="px-4 py-2 border">Sunlight Sensor</th>
                        <th className="px-4 py-2 border">Light (lux)</th>
                        <th className="px-4 py-2 border">Battery %</th>
                        <th className="px-4 py-2 border">WiFi (dBm)</th>
                        <th className="px-4 py-2 border">Temp (°F)</th>
                        <th className="px-4 py-2 border">Last Seen</th>
                    </tr>
                    </thead>
                    <tbody>
                    {combinedSensorData.map((sensor) => (
                        <tr key={sensor.sensor_id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 border">{sensor.sensor_id}</td>
                            <td className="px-4 py-2 border text-right">{sensor.position_x_ft}</td>
                            <td className="px-4 py-2 border text-right">{sensor.position_y_ft}</td>
                            <td className="px-4 py-2 border">{sensor.board}</td>
                            <td className="px-4 py-2 border">{sensor.sunlight_sensor_model}</td>
                            <td className="px-4 py-2 border text-right">
                                {sensor.light_intensity !== null ? sensor.light_intensity.toFixed(1) : 'N/A'}
                            </td>
                            <td className="px-4 py-2 border text-right">
                                {sensor.battery_percent !== null ? `${sensor.battery_percent}%` : 'N/A'}
                            </td>
                            <td className="px-4 py-2 border text-right">
                                {sensor.wifi_dbm !== null ? sensor.wifi_dbm : 'N/A'}
                            </td>
                            <td className="px-4 py-2 border text-right">
                                {sensor.chip_temp_f !== null ? sensor.chip_temp_f.toFixed(1) : 'N/A'}
                            </td>
                            <td className="px-4 py-2 border">
                                {sensor.last_seen ? new Date(sensor.last_seen).toLocaleString() : 'N/A'}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}