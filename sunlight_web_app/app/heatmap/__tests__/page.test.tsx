/*
 * page.test.tsx
 *
 * Sensor heatmap page smoke tests.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HeatmapPage from '../page';

// Mock the SensorHeatmap component to isolate the page test
jest.mock('@/app/components/SensorHeatmap', () => {
  return function DummySensorHeatmap() {
    return <div data-testid="sensor-heatmap"></div>;
  };
});

describe('HeatmapPage', () => {
  test('renders the heading and the SensorHeatmap component', () => {
    render(<HeatmapPage />);

    // Check for the page heading
    const heading = screen.getByRole('heading', {
      name: /sensor heatmap/i,
    });
    expect(heading).toBeInTheDocument();

    // Check that our mock SensorHeatmap component is rendered
    expect(screen.getByTestId('sensor-heatmap')).toBeInTheDocument();
  });
});
