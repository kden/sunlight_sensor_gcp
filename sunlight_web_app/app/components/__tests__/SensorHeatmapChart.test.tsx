/*
 * SensorHeatmapChart.test.tsx
 *
 * Tests for the SensorHeatmapChart component.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SensorHeatmapChart from '../SensorHeatmapChart';
import { ChartDataPoint } from "@/app/types/ChartDataPoint";

// --- Mocking Recharts ---
// The mock now clones the child component and injects the width/height props,
// mimicking the real ResponsiveContainer's behavior and allowing the chart to render.
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    // The 'children' type is more specific to inform TypeScript
    // that the cloned element can accept width and height props.
    ResponsiveContainer: ({ children }: { children: React.ReactElement<{ width?: number; height?: number }> }) => (
      <div data-testid="responsive-container">
        {React.cloneElement(children, { width: 500, height: 500 })}
      </div>
    ),
  };
});

describe('SensorHeatmapChart Component', () => {
  // --- Mock Data ---
  const mockChartData: ChartDataPoint[] = [
    { x: 10, y: 20, z: 5000 }, // A point with data
    { x: 30, y: 40, z: 0 },    // A point with zero intensity
    { x: 50, y: 60, z: undefined }, // A point with no data
  ];
  const yardLength = 120;
  const yardWidth = 80;

  // This will hold the rendered component's container for tests that need it.
  let container: HTMLElement;

  // This block runs before each test, rendering the component once
  // and making its container available to all tests in this suite.
  beforeEach(() => {
    const renderResult = render(
      <SensorHeatmapChart
        chartData={mockChartData}
        yardLength={yardLength}
        yardWidth={yardWidth}
      />
    );
    container = renderResult.container;
  });

  it('should render the chart container and axis labels', () => {
    // This test can still use `screen` as it's globally available.
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByText('Yard Length (feet)')).toBeInTheDocument();
    expect(screen.getByText('Yard Width (feet)')).toBeInTheDocument();
  });

  it('should render a circle for each data point', () => {
    // This test now uses the `container` variable from the `beforeEach` block.
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(mockChartData.length);
  });

  it('should apply the correct fill color based on light intensity', () => {
    const circles = container.querySelectorAll('circle');

    // Test 1: Point with data (z: 5000)
    // HSL: lightness = 20 + (5000 / 10000) * 60 = 20 + 30 = 50
    expect(circles[0]).toHaveAttribute('fill', 'hsl(60, 100%, 50%)');

    // Test 2: Point with zero intensity (z: 0)
    // HSL: lightness = 20 + (0 / 10000) * 60 = 20
    expect(circles[1]).toHaveAttribute('fill', 'hsl(60, 100%, 20%)');

    // Test 3: Point with undefined intensity
    // Should be the 'no data' color
    expect(circles[2]).toHaveAttribute('fill', 'hsl(0, 0%, 20%)');
  });

  it('should pass the correct domain to the X and Y axes', () => {
    // A cleaner, more declarative way to check for tick values.
    const xAxisTickElements = container.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick-value');
    const xAxisTicks = Array.from(xAxisTickElements).map(t => t.textContent);
    expect(xAxisTicks).toContain('120');

    const yAxisTickElements = container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value');
    const yAxisTicks = Array.from(yAxisTickElements).map(t => t.textContent);
    expect(yAxisTicks).toContain('20');
  });
});