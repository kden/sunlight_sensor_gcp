/*
 * useHourlyWeather.ts
 *
 * Source code description.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

"use client";

import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { app } from '@/app/firebase';
import { HourlyWeather } from '@/app/types/HourlyWeather';
import { DateTime } from 'luxon';

export const useHourlyWeather = (selectedDate: string, selectedSensorSet: string) => {
  const [hourlyWeatherData, setHourlyWeatherData] = useState<HourlyWeather[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate || !selectedSensorSet) {
      setLoading(false);
      setHourlyWeatherData([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setHourlyWeatherData([]);

      try {
        const db = getFirestore(app);

        // Parse the selected date to get start and end of day
        const startOfDay = DateTime.fromISO(selectedDate).startOf('day');
        const endOfDay = startOfDay.endOf('day');

        // Create Firestore timestamps for the query range
        const startTimestamp = Timestamp.fromMillis(startOfDay.toMillis());
        const endTimestamp = Timestamp.fromMillis(endOfDay.toMillis());

        // Query for all hourly weather data for the selected date and sensor set
        const q = query(
          collection(db, 'hourly_weather'),
          where('sensor_set_id', '==', selectedSensorSet),
          where('time', '>=', startTimestamp),
          where('time', '<=', endTimestamp)
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const hourlyData: HourlyWeather[] = [];

          querySnapshot.forEach((doc) => {
            const rawData = doc.data();

            // Helper to safely convert a Firestore Timestamp to a Luxon DateTime
            const toDateTime = (ts: unknown): DateTime | null => {
              if (ts instanceof Timestamp) {
                return DateTime.fromMillis(ts.toMillis());
              }
              return null;
            };

            const time = toDateTime(rawData.time);
            if (!time) {
              console.warn(`Skipping document ${doc.id}: invalid time field`);
              return;
            }

            // Transform the raw data into the application-facing HourlyWeather type
            const transformedData: HourlyWeather = {
              time: time,
              cloud_cover: rawData.cloud_cover ?? null,
              data_source: rawData.data_source ?? null,
              direct_radiation: rawData.direct_radiation ?? null,
              last_updated: toDateTime(rawData.last_updated),
              latitude: rawData.latitude ?? null,
              longitude: rawData.longitude ?? null,
              precipitation: rawData.precipitation ?? null,
              relative_humidity_2m: rawData.relative_humidity_2m ?? null,
              sensor_set_id: rawData.sensor_set_id ?? null,
              shortwave_radiation: rawData.shortwave_radiation ?? null,
              soil_moisture_1_to_3cm: rawData.soil_moisture_1_to_3cm ?? null,
              soil_temperature_0cm: rawData.soil_temperature_0cm ?? null,
              temperature_2m: rawData.temperature_2m ?? null,
              timezone: rawData.timezone ?? null,
              uv_index: rawData.uv_index ?? null,
              uv_index_clear_sky: rawData.uv_index_clear_sky ?? null,
              visibility: rawData.visibility ?? null,
              wind_speed_10m: rawData.wind_speed_10m ?? null,
            };

            hourlyData.push(transformedData);
          });

          // Sort by time
          hourlyData.sort((a, b) => a.time.toMillis() - b.time.toMillis());
          setHourlyWeatherData(hourlyData);
        } else {
          setHourlyWeatherData([]);
        }
      } catch (err) {
        console.error("Error fetching hourly weather data:", err);
        setError("Failed to load hourly weather data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate, selectedSensorSet]);

  return { hourlyWeatherData, loading, error };
};