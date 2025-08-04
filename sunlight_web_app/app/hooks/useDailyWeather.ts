/*
 * useDailyWeather.ts
 *
 * Get daily weather information from Firestore and transforms it into a
 * usable format with Luxon DateTime objects.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

"use client";

import { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, Timestamp } from 'firebase/firestore';
import { app } from '@/app/firebase';
import { DailyWeather } from '@/app/types/DailyWeather';
import { DateTime } from 'luxon';

export const useDailyWeather = (selectedDate: string, selectedSensorSet: string) => {
  const [weatherData, setWeatherData] = useState<DailyWeather | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate || !selectedSensorSet) {
      setLoading(false);
      setWeatherData(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setWeatherData(null);

      try {
        const db = getFirestore(app);
        const docId = `${selectedSensorSet}_${selectedDate}`;
        const docRef = doc(db, 'daily_weather', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const rawData = docSnap.data();

          // Helper to safely convert a Firestore Timestamp to a Luxon DateTime
          const toDateTime = (ts: unknown): DateTime | null => {
            if (ts instanceof Timestamp) {
              return DateTime.fromMillis(ts.toMillis());
            }
            return null;
          };

          const date = toDateTime(rawData.date);
          if (!date) {
            throw new Error("Date field is missing or invalid in the fetched weather data.");
          }

          // Transform the raw data into the application-facing DailyWeather type
          const transformedData: DailyWeather = {
            date: date,
            sunrise: toDateTime(rawData.sunrise),
            sunset: toDateTime(rawData.sunset),
            daylight_duration: rawData.daylight_duration ?? null,
            sunshine_duration: rawData.sunshine_duration ?? null,
            temperature_2m_max: rawData.temperature_2m_max ?? null,
            temperature_2m_min: rawData.temperature_2m_min ?? null,
            uv_index_max: rawData.uv_index_max ?? null,
            uv_index_clear_sky_max: rawData.uv_index_clear_sky_max ?? null,
            rain_sum: rawData.rain_sum ?? null,
            showers_sum: rawData.showers_sum ?? null,
            precipitation_sum: rawData.precipitation_sum ?? null,
            snowfall_sum: rawData.snowfall_sum ?? null,
            precipitation_hours rawData.precipitation_hours ?? null,
            data_source: rawData.data_source ?? null,
            sensor_set_id: rawData.sensor_set_id ?? null,
            timezone: rawData.timezone ?? null,
          };

          setWeatherData(transformedData);
        } else {
          setWeatherData(null);
        }
      } catch (err) {
        console.error("Error fetching daily weather data:", err);
        setError("Failed to load daily weather data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate, selectedSensorSet]);

  return { weatherData, loading, error };
};