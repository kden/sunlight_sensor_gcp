/*
 * page.tsx
 *
 * Sensor heatmap page.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import SensorHeatmap from '@/app/components/SensorHeatmap';

export default function HeatmapPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-amber-400">Sensor Heatmap</h2>
      <SensorHeatmap />
    </div>
  );
}
