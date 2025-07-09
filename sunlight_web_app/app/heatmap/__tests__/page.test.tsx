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
