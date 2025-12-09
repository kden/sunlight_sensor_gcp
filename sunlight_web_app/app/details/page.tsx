/*
 * page.tsx
 *
 * Displays a filterable list of all sensors in a given set with live data from Cassandra via SSE.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4.5 (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

"use client";

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, query, where, DocumentData } from 'firebase/firestore';
import { app } from '@/app/firebase';
import { useSensorSelection } from '@/app/hooks/useSensorSelection';
import { useLatestReadingsSSE } from '@/app/hooks/useLatestReadingsSSE';
import SensorSetDropdown from '@/app/components/SensorSetDropdown';
import StatusDisplay from '@/app/components/StatusDisplay';
import { DateTime } from 'luxon';

// --- Define the Sensor data structure ---
interface SensorMetadata {
    id: string;
    sensor_id: string;
    position_x_ft: number;
    position_y_ft: number;
    board: string;
    sunlight_sensor_model: string;
}

interface CombinedSensorData extends SensorMetadata {
    light_intensity: number | null;
    battery_percent: number | null;
    wifi_dbm: number | null;
    chip_temp_f: number | null;
    last_seen: string | null;
}

export default function DetailsPage() {
    // State for client-side mounting
    const [mounted, setMounted] = useState(false);

    // State for the sensor metadata (from Firestore)
    const [sensorMetadata, setSensorMetadata] = useState<SensorMetadata[]>([]);
    const [metadataLoading, setMetadataLoading] = useState<boolean>(true);
    const [metadataError, setMetadataError] = useState<string | null>(null);

    // --- Sensor Selection ---
    const {
        sensorSets,
        sensorSetsLoading,
        sensorSetsError,
        selectedSensorSet,
        timezone,
        latitude,
        longitude,
        handleSensorSetChange,
    } = useSensorSelection();

    // --- SSE Hook for Latest Readings ---
    const {
        readings: latestReadings,
        status: sseStatus,
        error: sseError,
        lastUpdate,
    } = useLatestReadingsSSE(selectedSensorSet);

    // Set mounted after first render
    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch sensor metadata when selected set changes
    useEffect(() => {
        if (!selectedSensorSet) {
            setMetadataLoading(false);
            setSensorMetadata([]);
            return;
        }

        const fetchMetadata = async () => {
            setMetadataLoading(true);
            setMetadataError(null);

            try {
                const db = getFirestore(app);
                const sensorsCollection = collection(db, 'sensor');
                const q = query(sensorsCollection, where('sensor_set_id', '==', selectedSensorSet));
                const sensorSnapshot = await getDocs(q);

                const metadata: SensorMetadata[] = sensorSnapshot.docs.map(doc => {
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

                setSensorMetadata(metadata);
            } catch (err) {
                console.error(`Error fetching sensors for set ${selectedSensorSet}:`, err);
                setMetadataError('Failed to load sensor metadata.');
            } finally {
                setMetadataLoading(false);
            }
        };

        fetchMetadata();
    }, [selectedSensorSet]);

    // Combine metadata with latest readings
    const combinedSensors: CombinedSensorData[] = sensorMetadata.map(sensor => {
        const reading = latestReadings.find(r => r.sensor_id === sensor.sensor_id);
        return {
            ...sensor,
            light_intensity: reading?.light_intensity ?? null,
            battery_percent: reading?.battery_percent ?? null,
            wifi_dbm: reading?.wifi_dbm ?? null,
            chip_temp_f: reading?.chip_temp_f ?? null,
            last_seen: reading?.last_seen ?? null,
        };
    });

    // Helper function to format last_seen in local timezone
    const formatLastSeen = (lastSeenUtc: string | null): string => {
        if (!lastSeenUtc || !timezone) {
            return 'N/A';
        }
        try {
            const dt = DateTime.fromISO(lastSeenUtc, { zone: 'utc' }).setZone(timezone);
            return dt.toLocaleString(DateTime.DATETIME_SHORT);
        } catch (e) {
            console.error('Error formatting last_seen:', e);
            return 'N/A';
        }
    };

    // Format last update timestamp
    const formatLastUpdate = (): string => {
        if (!lastUpdate) return '';
        return DateTime.fromJSDate(lastUpdate).toLocaleString(DateTime.TIME_WITH_SECONDS);
    };

    // Determine status indicator
    const getStatusIndicator = () => {
        switch (sseStatus) {
            case 'connected':
                return <span className="text-green-400">● Live</span>;
            case 'connecting':
                return <span className="text-yellow-400">● Connecting...</span>;
            case 'error':
                return <span className="text-red-400">● Error</span>;
            case 'disconnected':
                return <span className="text-gray-400">○ Disconnected</span>;
        }
    };

    const loading = metadataLoading;
    const error = metadataError || sseError;

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
                                onChange={handleSensorSetChange}
                            />
                        )}
                    </div>
                    {/* Connection Status - only show after mount */}
                    {mounted && (
                        <div className="flex items-center gap-2">
                            {getStatusIndicator()}
                            {lastUpdate && (
                                <span className="text-gray-400 text-sm">
                                    Last update: {formatLastUpdate()}
                                </span>
                            )}
                        </div>
                    )}
                    {/* Timezone Display */}
                    {timezone && <span className="text-gray-400">Timezone: {timezone}</span>}
                    {/* Lat/Lon Display */}
                    {latitude !== null && longitude !== null && (
                        <span className="text-gray-400">
              Lat: {latitude.toFixed(3)}, Lon: {longitude.toFixed(3)}
            </span>
                    )}
                </div>

                <StatusDisplay
                    loading={loading}
                    error={error}
                    data={combinedSensors}
                    loadingMessage="Loading sensor data..."
                    noDataMessage="No sensors found for the selected set."
                />

                {/* --- Sensor Details Table --- */}
                {!loading && !error && combinedSensors.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-gray-800 rounded-lg shadow">
                            <thead>
                            <tr className="bg-gray-700">
                                <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Sensor ID</th>
                                <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Position X (ft)</th>
                                <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Position Y (ft)</th>
                                <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Board</th>
                                <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Light (lux)</th>
                                <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Battery %</th>
                                <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">WiFi (dBm)</th>
                                <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Temp (°F)</th>
                                <th className="p-3 text-left text-sm font-semibold text-amber-300 uppercase tracking-wider">Last Seen (Local Time)</th>
                            </tr>
                            </thead>
                            <tbody>
                            {combinedSensors.map((sensor) => (
                                <tr key={sensor.id} className="border-b border-gray-700 hover:bg-gray-600 transition-colors duration-200">
                                    <td className="p-3 whitespace-nowrap">{sensor.sensor_id}</td>
                                    <td className="p-3 whitespace-nowrap">{sensor.position_x_ft}</td>
                                    <td className="p-3 whitespace-nowrap">{sensor.position_y_ft}</td>
                                    <td className="p-3 whitespace-nowrap">{sensor.board}</td>
                                    <td className="p-3 whitespace-nowrap text-right">
                                        {sensor.light_intensity !== null ? sensor.light_intensity.toFixed(1) : 'N/A'}
                                    </td>
                                    <td className="p-3 whitespace-nowrap text-right">
                                        {sensor.battery_percent !== null ? `${sensor.battery_percent}%` : 'N/A'}
                                    </td>
                                    <td className="p-3 whitespace-nowrap text-right">
                                        {sensor.wifi_dbm !== null ? sensor.wifi_dbm : 'N/A'}
                                    </td>
                                    <td className="p-3 whitespace-nowrap text-right">
                                        {sensor.chip_temp_f !== null ? sensor.chip_temp_f.toFixed(1) : 'N/A'}
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                        {formatLastSeen(sensor.last_seen)}
                                    </td>
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