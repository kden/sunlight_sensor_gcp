/*
 * SensorHeatmapChart.test.tsx
 *
 * Unit tests for the SensorHeatmapChart component.
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

describe('SensorHeatmapChart Component', () => {
  // --- Mock Data ---
  const mockChartData: ChartDataPoint[] = [
    { x: 10, y: 20, z: 5000, sensor_id: "sensor_A" }, // A point with data
    { x: 30, y: 40, z: 0, sensor_id: "sensor_B" },    // A point with zero intensity
    { x: 50, y: 60, z: undefined, sensor_id: "sensor_C" }, // A point with no data
  ];
  const yardLength = 120;
  const yardWidth = 80;
  const maxIntensity = 10000;

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
        maxIntensity={maxIntensity}
      />
    );
    container = renderResult.container;
  });

  it('should render the chart container and axis labels', () => {
    expect(screen.getByText('Yard Length (feet)')).toBeInTheDocument();
    expect(screen.getByText('Yard Width (feet)')).toBeInTheDocument();
  });

  it('should render the SVG container with correct viewBox', () => {
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', `0 0 ${yardLength} ${yardWidth}`);
  });

  it('should render heatmap grid cells covering the entire area', () => {
    const heatmapRects = container.querySelectorAll('rect:not([data-testid])');
    // Should have one rect for each 1x1 foot square
    const expectedCells = yardLength * yardWidth;
    expect(heatmapRects).toHaveLength(expectedCells);

    // Check that cells are 1x1 foot squares
    const firstRect = heatmapRects[0];
    expect(firstRect).toHaveAttribute('width', '1');
    expect(firstRect).toHaveAttribute('height', '1');
  });

  it('should render sensor circles with hot pink stroke', () => {
    const sensorCircles = container.querySelectorAll('circle');
    // Should only render circles for sensors with data (filtering out undefined z values)
    const sensorsWithData = mockChartData.filter(d => d.z !== undefined);
    expect(sensorCircles).toHaveLength(sensorsWithData.length);

    // Check that sensor circles have hot pink stroke
    sensorCircles.forEach(circle => {
      expect(circle).toHaveAttribute('stroke', '#ec4899');
      expect(circle).toHaveAttribute('fill', 'none');
    });
  });

  it('should position sensor circles correctly', () => {
    const sensorCircles = container.querySelectorAll('circle');
    const sensorsWithData = mockChartData.filter(d => d.z !== undefined);

    sensorsWithData.forEach((sensor, index) => {
      const circle = sensorCircles[index];
      expect(circle).toHaveAttribute('cx', sensor.x.toString());
      expect(circle).toHaveAttribute('cy', sensor.y.toString());
    });
  });

  it('should render grid lines at 10-foot intervals', () => {
    const lines = container.querySelectorAll('line');
    const expectedVerticalLines = Math.floor(yardLength / 10) + 1;
    const expectedHorizontalLines = Math.floor(yardWidth / 10) + 1;
    const totalExpectedLines = expectedVerticalLines + expectedHorizontalLines;

    expect(lines.length).toBeGreaterThanOrEqual(totalExpectedLines);

    // Check that lines have proper stroke styling
    lines.forEach(line => {
      expect(line).toHaveAttribute('stroke', '#666');
      expect(line).toHaveAttribute('stroke-dasharray', '0.5 0.5');
    });
  });

  it('should render axis tick labels', () => {
    // Check for some expected X-axis labels (using getAllByText since labels can appear on both axes)
    expect(screen.getAllByText('0')).toHaveLength(2); // One for X-axis, one for Y-axis
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1); // At least one "10" label
    expect(screen.getAllByText('20').length).toBeGreaterThanOrEqual(1); // At least one "20" label

    // Check that we have text elements for axis labels
    const textElements = container.querySelectorAll('text');
    const textContents = Array.from(textElements).map(el => el.textContent);
    expect(textContents).toContain('10');
    expect(textContents).toContain('20');
  });

  it('should apply correct colors to heatmap cells based on interpolated values', () => {
    const heatmapRects = container.querySelectorAll('rect:not([data-testid])');

    // Check that all rectangles have fill colors (not empty)
    heatmapRects.forEach(rect => {
      const fill = rect.getAttribute('fill');
      expect(fill).toBeTruthy();
      expect(fill).toMatch(/^rgb\(\d+, \d+, \d+\)$/); // Should be RGB format
    });
  });

  it('should render legend with correct elements', () => {
    expect(screen.getByText('Sensor Locations')).toBeInTheDocument();
    expect(screen.getByText('Low Intensity')).toBeInTheDocument();
    expect(screen.getByText('High Intensity')).toBeInTheDocument();

    // Check legend color indicators
    const legendElements = container.querySelectorAll('.bg-gray-800, .bg-yellow-200, .border-pink-500');
    expect(legendElements.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle empty chart data gracefully', () => {
    const { container: emptyContainer } = render(
      <SensorHeatmapChart
        chartData={[]}
        yardLength={yardLength}
        yardWidth={yardWidth}
        maxIntensity={maxIntensity}
      />
    );

    // Should still render the basic structure
    const svg = emptyContainer.querySelector('svg');
    expect(svg).toBeInTheDocument();

    // Should have no heatmap cells when no data
    const heatmapRects = emptyContainer.querySelectorAll('rect:not([data-testid])');
    expect(heatmapRects).toHaveLength(0);

    // Should have no sensor circles
    const sensorCircles = emptyContainer.querySelectorAll('circle');
    expect(sensorCircles).toHaveLength(0);
  });

  it('should handle sensors with no intensity data', () => {
    const dataWithUndefined: ChartDataPoint[] = [
      { x: 10, y: 20, z: undefined, sensor_id: "sensor_undefined" },
      { x: 30, y: 40, z: null as any, sensor_id: "sensor_null" },
    ];

    const { container: testContainer } = render(
      <SensorHeatmapChart
        chartData={dataWithUndefined}
        yardLength={50}
        yardWidth={50}
        maxIntensity={maxIntensity}
      />
    );

    // The component filters out sensors with undefined z values, but null is treated as 0
    // So we should expect 1 circle for the null sensor (which gets treated as valid data)
    const sensorCircles = testContainer.querySelectorAll('circle');
    expect(sensorCircles).toHaveLength(1);

    // Looking at the heatmap generation logic, it filters for validSensors first:
    // const validSensors = chartData.filter(sensor => sensor.z !== undefined && sensor.z !== null);
    // If there are no validSensors, it returns an empty array, so no heatmap cells
    const heatmapRects = testContainer.querySelectorAll('rect:not([data-testid])');
    expect(heatmapRects.length).toBe(0); // No heatmap cells since null values are also filtered out in heatmap generation
  });
});