/*
 * page.tsx
 *
 * The root page of the application, displaying the sensor levels chart.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

"use client";

import SensorLevels from '@/app/components/SensorLevels';

export default function LevelsPage() {
  return (
    <div className="font-sans">
      <h1 className="text-2xl font-semibold mb-4 text-amber-400">Sensor Levels Over Time</h1>
      <SensorLevels />
    </div>
  );
}