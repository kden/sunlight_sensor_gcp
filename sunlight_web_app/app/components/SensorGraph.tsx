// sunlight_web_app/app/components/SensorGraph.tsx

"use client";

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, query, where, Timestamp, DocumentData } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { app } from '@/app/firebase';
import { DateTime } from "luxon";


interface Reading {
  time: number;
  [key: string]: number | string;
}

interface SensorSet {
  id: string;
  name: string;
  timezone: string;
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
  const [highlightedSensor, setHighlightedSensor] = useState<string | null>(null);
  const [sensorSets, setSensorSets] = useState<SensorSet[]>([]);
  const [selectedSensorSet, setSelectedSensorSet] = useState<string>('');

  useEffect(() => {
    const fetchSensorSets = async () => {
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
        console.log("Sensor sets fetched: ", sets);
        if (sets.length > 0 && !selectedSensorSet) {
          setSelectedSensorSet(sets[0].id);
          setTimezone(sets[0].timezone);
        }
      } catch (err) {
        console.error("Error fetching sensor sets:", err);
        setError("Failed to load sensor set metadata.");
      }
    };
    fetchSensorSets();
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      const selectedSetInfo = sensorSets.find(s => s.id === selectedSensorSet);
      if (!selectedSetInfo) {
        setLoading(false);
        return;
      }

      setTimezone(selectedSetInfo.timezone);
      console.log("sensor set timezone "+ selectedSetInfo.timezone)
      setLoading(true);
      setError(null);
      setReadings([]);
      setHighlightedSensor(null);

      try {
        const db = getFirestore(app);
        const sensorsCollection = collection(db, 'sensor_metadata');
        const sensorQuery = query(sensorsCollection, where('sensor_set', '==', selectedSensorSet));
        const sensorSnapshot = await getDocs(sensorQuery);
        const fetchedSensorIds = sensorSnapshot.docs.map(doc => doc.data().sensor_id as string).filter(Boolean);

        setSensorIds(fetchedSensorIds);

        if (fetchedSensorIds.length === 0) {
          setError("No sensors found for this set.");
          setLoading(false);
          return;
        }

        const [year, month, day] = selectedDate.split('-').map(Number);

        const startOfDayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;
        const endOfDayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999`;
        console.log("Start of day string" + startOfDayStr);
        console.log("End of day string" + endOfDayStr);

        // We'll need UTC to get the correct data from Firestore
        const startOfDayUTC = DateTime.fromISO(startOfDayStr, { zone: selectedSetInfo.timezone }).toUTC();
        const endOfDayUTC = DateTime.fromISO(endOfDayStr, { zone: selectedSetInfo.timezone }).toUTC();

        const ticks = [];
        const tickCounter = DateTime.fromISO(startOfDayStr, { zone: selectedSetInfo.timezone })

        // Create the ticks for the x-axis
        for (let i = 0; i < 24; i++) {
          const current = tickCounter.plus({ hours: i });
          ticks.push(current.toMillis());
          console.log("Tick " + tickCounter.toString());
        }
        setHourlyTicks(ticks);

        const startDayTimestamp = tickCounter.toMillis();
        const endDayTimestamp = tickCounter.plus({ days: 1 }).toMillis();

        setAxisDomain([startDayTimestamp, endDayTimestamp]);
        console.log("Start of day to JSDate" + startOfDayUTC.toJSDate());
        console.log("End of day to JSDate" + endOfDayUTC.toJSDate());

        const readingsCollection = collection(db, 'sunlight_readings');
        const q = query(
          readingsCollection,
          where('observation_minute', '>=', Timestamp.fromMillis(startDayTimestamp)),
          where('observation_minute', '<=', Timestamp.fromMillis(endDayTimestamp)),
          where('sensor_set', '==', selectedSensorSet)
        );

        const querySnapshot = await getDocs(q);
        const dataByTimestamp: Map<number, Reading> = new Map();

        querySnapshot.forEach((doc: DocumentData) => {
          const data = doc.data();
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

    if (selectedSensorSet && sensorSets.length > 0) {
      fetchAllData();
    }
  }, [selectedDate, selectedSensorSet, sensorSets]);

  const handleSensorSetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const setId = e.target.value;
    setSelectedSensorSet(setId);
    const selectedSet = sensorSets.find(s => s.id === setId);
    if (selectedSet) {
      setTimezone(selectedSet.timezone);
      console.log("handleSensorSetChange sensor set timezone "+ selectedSet.timezone)
    }
  };

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#387908', '#d0ed57'];

  const handleLegendClick = (data: { dataKey: string }) => {
    if (highlightedSensor === data.dataKey) {
      setHighlightedSensor(null);
    } else {
      setHighlightedSensor(data.dataKey);
    }
  };

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
        <label htmlFor="sensor-set-picker" className="ml-4 mr-2">Sensor Set:</label>
        <select
          id="sensor-set-picker"
          value={selectedSensorSet}
          onChange={handleSensorSetChange}
          className="bg-gray-700 text-white p-2 rounded"
          disabled={sensorSets.length === 0}
        >
          {sensorSets.map(set => (
            <option key={set.id} value={set.id}>{set.name}</option>
          ))}
        </select>
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
              tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: 'numeric', hour12: true, timeZone: timezone })}
              stroke="#ccc"
            />
            <YAxis stroke="#ccc" domain={[0, 10000]} allowDataOverflow={true} />
            <Tooltip
              contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
              labelStyle={{ color: '#fff' }}
              labelFormatter={(value) => new Date(value).toLocaleString([], { timeZone: timezone, hour12: true, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            />
            <Legend wrapperStyle={{ color: '#fff' }} onClick={(data) => handleLegendClick(data as { dataKey: string })} />
            {sensorIds.map((id, index) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={colors[index % colors.length]}
                dot={false}
                connectNulls
                opacity={highlightedSensor === null || highlightedSensor === id ? 1 : 0.2}
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