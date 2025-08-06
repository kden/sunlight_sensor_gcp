/*
 * SensorLevelsChartLegend.tsx
 *
 * Source code description.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';

const sensorColors = ['#dc2626', '#22c55e', '#f97316', '#84cc16', '#eab308', '#059669'];
const weatherColors = {
  direct_radiation: '#3b82f6',
  shortwave_radiation: '#8b5cf6'
};

interface CustomLegendProps {
  sensorIds: string[];
  highlightedSensor: string | null;
  onLegendClick: (dataKey: string) => void;
  hiddenRadiationLines: Set<string>;
}

const SensorLevelsChartLegend: React.FC<CustomLegendProps> = ({
  sensorIds,
  highlightedSensor,
  onLegendClick,
  hiddenRadiationLines,
}) => (
  <div className="mt-4">
    <div className="flex flex-wrap gap-4 mb-2">
      {sensorIds.map((id, index) => (
        <div
          key={id}
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onLegendClick(id)}
          style={{ opacity: highlightedSensor === null || highlightedSensor === id ? 1 : 0.4 }}
        >
          <div className="w-3 h-0.5" style={{ backgroundColor: sensorColors[index % sensorColors.length] }} />
          <span className="text-white text-sm">{id}</span>
        </div>
      ))}
    </div>
    <div className="flex flex-wrap gap-4">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => onLegendClick('direct_radiation')}
        style={{ opacity: hiddenRadiationLines.has('direct_radiation') ? 0.4 : 1 }}
      >
        <div className="w-3 h-0.5" style={{ backgroundColor: weatherColors.direct_radiation }} />
        <span className="text-white text-sm">Direct Radiation (W/m²)</span>
      </div>
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => onLegendClick('shortwave_radiation')}
        style={{ opacity: hiddenRadiationLines.has('shortwave_radiation') ? 0.4 : 1 }}
      >
        <div className="w-3 h-0.5" style={{ backgroundColor: weatherColors.shortwave_radiation }} />
        <span className="text-white text-sm">Shortwave Radiation (W/m²)</span>
      </div>
    </div>
  </div>
);

export default SensorLevelsChartLegend;