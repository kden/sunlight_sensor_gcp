import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { app } from '@/app/firebase';
import { SensorSet } from '@/app/types/SensorSet';

export const useSensorSets = () => {
  const [sensorSets, setSensorSets] = useState<SensorSet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSensorSets = async () => {
      // Don't reset state here, just fetch
      try {
        const db = getFirestore(app);
        const sensorSetCollection = collection(db, 'sensor_set_metadata');
        const sensorSetSnapshot = await getDocs(sensorSetCollection);
        const sets: SensorSet[] = sensorSetSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().sensor_set_id || doc.id,
          timezone: doc.data().timezone || 'UTC',
        }));
        setSensorSets(sets);
      } catch (err) {
        console.error("Error fetching sensor sets:", err);
        setError("Failed to load sensor set metadata.");
      } finally {
        setLoading(false);
      }
    };

    fetchSensorSets();
  }, []); // Runs once when the hook is first used

  return { sensorSets, loading, error };
};