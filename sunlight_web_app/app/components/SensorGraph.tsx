"use client";

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, query, where, Timestamp, DocumentData } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { app } from '@/app/firebase';

interface Reading {
  time: number;
  [key: string]: number | string;
}

const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const SensorGraph = () => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [sensorIds, setSensorIds] = useState<string[] | null>(null);
  const [timezone, setTimezone] = useState('');
  const [hourlyTicks, setHourlyTicks] = useState<number[]>([]);
  const [axisDomain, setAxisDomain] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      setReadings([]);

      try {
        const db = getFirestore(app);

        // Step 1: Fetch Sensor IDs.
        const sensorsCollection = collection(db, 'sensor_metadata');
        const sensorSnapshot = await getDocs(sensorsCollection);
        const fetchedSensorIds = sensorSnapshot.docs.map(doc => doc.data().sensor_id as string).filter(Boolean);

        setSensorIds(fetchedSensorIds);

        if (fetchedSensorIds.length === 0) {
            setError("No sensor metadata found in the database.");
            return;
        }

        // Step 2: Create date range correctly in the user's local timezone
        const [year, month, day] = selectedDate.split('-').map(Number);
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

        const ticks = [];
        for (let i = 0; i < 24; i++) {
          ticks.push(new Date(year, month - 1, day, i).getTime());
        }
        setHourlyTicks(ticks);
        setAxisDomain([startOfDay.getTime(), endOfDay.getTime()]);

        // Step 3: Fetch Readings
        const readingsCollection = collection(db, 'sunlight_readings');
        const q = query(
          readingsCollection,
          where('observation_minute', '>=', Timestamp.fromDate(startOfDay)),
          where('observation_minute', '<=', Timestamp.fromDate(endOfDay))
        );

        const querySnapshot = await getDocs(q);

        const dataByTimestamp: Map<number, Reading> = new Map();
        querySnapshot.forEach((doc) => {
            const data = doc.data() as DocumentData;
            const date = data.observation_minute.toDate() as Date;
            const timestamp = date.getTime();

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
  }, [selectedDate]);

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#387908', '#d0ed57'];

  return (
    <div>
      <div className="mb-4 flex items-center">
        <label htmlFor="date-picker" className="mr-2">Select Date:</label>
        <input
          type="date"
          id="date-picker"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-gray-700 text-white p-2 rounded"
        />
        {timezone && <span className="ml-4 text-gray-400">Timezone: {timezone}</span>}
      </div>

      {loading && <p>Loading sensor data for {selectedDate}...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && readings.length > 0 && sensorIds && (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={readings}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis
              dataKey="time"
              type="number"
              domain={axisDomain}
              ticks={hourlyTicks}
              tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: 'numeric', hour12: true })}
              stroke="#ccc"
              allowDataOverflow={true}
            />
            <YAxis stroke="#ccc" domain={[0, 10000]} allowDataOverflow={true} />
            <Tooltip
              contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
              labelStyle={{ color: '#fff' }}
              labelFormatter={(value) => new Date(value).toLocaleString()}
            />
            <Legend wrapperStyle={{ color: '#fff' }} />
            {sensorIds.map((id, index) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={colors[index % colors.length]}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {!loading && !error && readings.length === 0 && (
          <p className="text-center mt-4">No data found for the selected date.</p>
      )}
    </div>
  );
};

export default SensorGraph;
