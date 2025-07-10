"use client";

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { app } from '@/app/firebase';

// --- Interfaces for our data structures ---
interface SensorMetadata {
  id: string;
  position_x_ft: number;
  position_y_ft: number;
}

interface ReadingsForDay {
  [timestamp: number]: {
    [sensorId: string]: number; // light intensity
  };
}

// --- Constants for the yard dimensions ---
const YARD_LENGTH = 133;
const YARD_WIDTH = 33;

const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

const SensorHeatmap = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [sensorMetadata, setSensorMetadata] = useState<SensorMetadata[]>([]);
  const [readings, setReadings] = useState<ReadingsForDay>({});
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setReadings({});
      setTimestamps([]);
      setCurrentTimeIndex(0);

      try {
        const db = getFirestore(app);

        // Fetch sensor metadata first
        const metaCollection = collection(db, 'sensor_metadata');
        const metaSnapshot = await getDocs(metaCollection);
        const metadata = metaSnapshot.docs.map(doc => ({
          id: doc.data().sensor_id,
          position_x_ft: doc.data().position_x_ft,
          position_y_ft: doc.data().position_y_ft,
        }));
        setSensorMetadata(metadata);

        if (metadata.length === 0) {
          setError("No sensor metadata found.");
          return;
        }

        // Fetch all readings for the selected day
        const [year, month, day] = selectedDate.split('-').map(Number);
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        const readingsCollection = collection(db, 'sunlight_readings');
        const q = query(
          readingsCollection,
          where('observation_minute', '>=', Timestamp.fromDate(startOfDay)),
          where('observation_minute', '<=', Timestamp.fromDate(endOfDay))
        );

        const querySnapshot = await getDocs(q);
        const processedReadings: ReadingsForDay = {};
        const uniqueTimestamps = new Set<number>();

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const timestamp = (data.observation_minute.toDate() as Date).getTime();
          uniqueTimestamps.add(timestamp);

          if (!processedReadings[timestamp]) {
            processedReadings[timestamp] = {};
          }
          processedReadings[timestamp][data.sensor_id] = data.smoothed_light_intensity;
        });

        const sortedTimestamps = Array.from(uniqueTimestamps).sort();
        setTimestamps(sortedTimestamps);
        setReadings(processedReadings);

      } catch (err) {
        console.error("Error fetching heatmap data:", err);
        setError("Failed to load heatmap data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  const calculateFillColor = (intensity: number | undefined) => {
    if (intensity === undefined) {
      return 'hsl(0, 0%, 20%)'; // Dim gray for sensors with no data
    }
    // HSL: Hue=60 (yellow), Saturation=100%, Lightness varies from 20% to 80%
    const lightness = 20 + (intensity / 10000) * 60;
    return `hsl(60, 100%, ${lightness}%)`;
  };

  const currentTimestamp = timestamps[currentTimeIndex];
  const currentReadings = readings[currentTimestamp] || {};

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <label htmlFor="date-picker">Select Date:</label>
        <input
          type="date"
          id="date-picker"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-gray-700 text-white p-2 rounded"
        />
      </div>

      {loading && <p>Loading heatmap data for {selectedDate}...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && timestamps.length > 0 && (
        <div className="w-full">
          {/* Heatmap Visualization */}
          <div className="relative w-full aspect-[133/33] bg-gray-800 border-2 border-gray-600 rounded-lg overflow-hidden">
             <svg
              viewBox={`0 0 ${YARD_LENGTH} ${YARD_WIDTH}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full"
            >
              {sensorMetadata.map(sensor => (
                <circle
                  key={sensor.id}
                  cx={sensor.position_y_ft}
                  cy={YARD_WIDTH - sensor.position_x_ft}
                  r="2" // Radius of the sensor mark
                  fill={calculateFillColor(currentReadings[sensor.id])}
                />
              ))}
            </svg>
          </div>

          {/* Time Slider Controls */}
          <div className="mt-4">
            <label htmlFor="time-slider" className="block mb-2">
              Time: {currentTimestamp ? new Date(currentTimestamp).toLocaleTimeString() : 'N/A'}
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

      {!loading && !error && timestamps.length === 0 && (
        <p>No data found for the selected date.</p>
      )}
    </div>
  );
};

export default SensorHeatmap;
