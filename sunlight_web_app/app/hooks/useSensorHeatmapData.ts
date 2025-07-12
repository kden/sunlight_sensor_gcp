// /app/hooks/useSensorHeatmapData.ts

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { app } from '@/app/firebase';
import { DateTime } from 'luxon';

// --- Interfaces for the hook's return data ---

export interface SensorMetadata {
  id: string;
  position_x_ft: number;
  position_y_ft: number;
}

export interface ReadingsForDay {
  [timestamp: number]: {
    [sensorId: string]: number; // light intensity
  };
}

interface UseSensorHeatmapDataReturn {
  sensorMetadata: SensorMetadata[];
  readings: ReadingsForDay;
  timestamps: number[];
  loading: boolean;
  error: string | null;
}

export const useSensorHeatmapData = (selectedDate: string, selectedSensorSet: string, timezone: string): UseSensorHeatmapDataReturn => {
  const [sensorMetadata, setSensorMetadata] = useState<SensorMetadata[]>([]);
  const [readings, setReadings] = useState<ReadingsForDay>({});
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard clause to prevent fetching if essential parameters are missing
    if (!selectedSensorSet || !selectedDate || !timezone) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      // Reset state for new fetch
      setReadings({});
      setTimestamps([]);
      setSensorMetadata([]);

      try {
        const db = getFirestore(app);

        // 1. Fetch sensor metadata (locations) for the selected set
        const metaCollection = collection(db, 'sensor');
        const metaQuery = query(metaCollection, where('sensor_set', '==', selectedSensorSet));
        const metaSnapshot = await getDocs(metaQuery);

        const metadata = metaSnapshot.docs.map(doc => ({
          id: doc.data().sensor_id,
          position_x_ft: doc.data().position_x_ft,
          position_y_ft: doc.data().position_y_ft,
        }));
        setSensorMetadata(metadata);

        if (metadata.length === 0) {
          setError("No sensor metadata found for this set.");
          setLoading(false);
          return;
        }

        // 2. Calculate time range for the query
        const startOfDayUTC = DateTime.fromISO(selectedDate, { zone: timezone }).startOf('day');
        const startTimestamp = Timestamp.fromMillis(startOfDayUTC.toMillis());
        const endTimestamp = Timestamp.fromMillis(startOfDayUTC.endOf('day').toMillis());

        // 3. Fetch all readings for the given day and sensor set
        const readingsCollection = collection(db, 'sunlight_readings');
        const q = query(
          readingsCollection,
          where('observation_minute', '>=', startTimestamp),
          where('observation_minute', '<=', endTimestamp),
          where('sensor_set', '==', selectedSensorSet)
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
  }, [selectedDate, selectedSensorSet, timezone]); // Re-run effect if these change

  return { sensorMetadata, readings, timestamps, loading, error };
};
