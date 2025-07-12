// /app/hooks/useSensorData.ts

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, query, where, Timestamp, DocumentData } from 'firebase/firestore';
import { app } from '@/app/firebase';
import { DateTime } from 'luxon';

// Define the shape of the reading data
interface Reading {
  time: number;
  [key: string]: number | string;
}

// Define the return type of the hook for clarity
interface UseSensorDataReturn {
  readings: Reading[];
  sensorIds: string[] | null;
  hourlyTicks: number[];
  axisDomain: [number, number];
  loading: boolean;
  error: string | null;
}

export const useSensorLevelsData = (selectedDate: string, selectedSensorSet: string, timezone: string): UseSensorDataReturn => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [sensorIds, setSensorIds] = useState<string[] | null>(null);
  const [hourlyTicks, setHourlyTicks] = useState<number[]>([]);
  const [axisDomain, setAxisDomain] = useState<[number, number]>([0, 0]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard clause to prevent fetching if essential parameters are missing
    if (!selectedSensorSet || !selectedDate || !timezone) {
      setLoading(false);
      return;
    }

    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      setReadings([]);
      setSensorIds(null);

      try {
        const db = getFirestore(app);

        // 1. Fetch sensor IDs for the selected set
        const sensorsCollection = collection(db, 'sensor');
        const sensorQuery = query(sensorsCollection, where('sensor_set_id', '==', selectedSensorSet));
        const sensorSnapshot = await getDocs(sensorQuery);
        const fetchedSensorIds = sensorSnapshot.docs.map(doc => doc.data().sensor_id as string).filter(Boolean);

        setSensorIds(fetchedSensorIds);

        if (fetchedSensorIds.length === 0) {
          setError("No sensors found for this set.");
          setLoading(false);
          return;
        }

        // 2. Calculate time ranges and ticks using the provided timezone
        const startOfDayUTC = DateTime.fromISO(selectedDate, { zone: timezone }).startOf('day');
        const ticks = [];
        for (let i = 0; i < 24; i++) {
          ticks.push(startOfDayUTC.plus({ hours: i }).toMillis());
        }
        setHourlyTicks(ticks);

        const startDayTimestamp = startOfDayUTC.toMillis();
        const endDayTimestamp = startOfDayUTC.endOf('day').toMillis();
        setAxisDomain([startDayTimestamp, endDayTimestamp]);

        // 3. Fetch the sensor readings within the date range
        const readingsCollection = collection(db, 'sunlight_readings');
        const q = query(
          readingsCollection,
          where('observation_minute', '>=', Timestamp.fromMillis(startDayTimestamp)),
          where('observation_minute', '<=', Timestamp.fromMillis(endDayTimestamp)),
          where('sensor_set_id', '==', selectedSensorSet)
        );

        const querySnapshot = await getDocs(q);
        const dataByTimestamp: Map<number, Reading> = new Map();

        querySnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
          const timestamp = (data.observation_minute.toDate() as Date).getTime();

          if (!dataByTimestamp.has(timestamp)) {
            dataByTimestamp.set(timestamp, { time: timestamp });
          }

          const entry = dataByTimestamp.get(timestamp)!;
          entry[data.sensor_id] = data.smoothed_light_intensity;
        });

        const formattedData = Array.from(dataByTimestamp.values()).sort((a, b) => a.time - b.time);
        setReadings(formattedData);

      } catch (err) {
        console.error("Error fetching data:", err);
        setError('Failed to load sensor data. Check permissions and Firestore indexes.');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [selectedDate, selectedSensorSet, timezone]); // Dependency array ensures the effect re-runs when these change

  return { readings, sensorIds, hourlyTicks, axisDomain, loading, error };
};