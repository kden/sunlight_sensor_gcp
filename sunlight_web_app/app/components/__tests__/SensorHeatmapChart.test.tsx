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

// --- Canvas Mocking ---
// JSDOM does not implement the canvas API. We need to provide a mock
// to prevent errors when the component tries to generate the heatmap image.
beforeAll(() => {
  // Mock getContext to return a dummy context object
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
    writable: true,
    value: (contextId: string) => {
      if (contextId === '2d') {
        return {
          createImageData: (width: number, height: number) => ({
            data: new Uint8ClampedArray(width * height * 4),
          }),
          putImageData: jest.fn(),
        };
      }
      return null;
    },
  });

  // Mock toDataURL to return a dummy image string
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'toDataURL', {
    writable: true,
    value: () => 'data:image/png;base64,dummy-image-data',
  });
});

describe('SensorHeatmapChart Component', () => {
  // --- Mock Data ---
  const mockChartData: ChartDataPoint[] = [
    { x: 10, y: 20, z: 5000, sensor_id: "sensor_A" },
    { x: 30, y: 40, z: 0, sensor_id: "sensor_B" },
    { x: 50, y: 60, z: undefined, sensor_id: "sensor_C" }, // This sensor should not be rendered as a circle
  ];
  const yardLength = 133;
  const yardWidth = 33;
  const maxIntensity = 10000;

  // --- Chart Layout Constants (from component) ---
  // These must match the constants in SensorHeatmapChart.tsx for tests to be accurate.
  const marginLeft = 15;
  const marginRight = 5;
  const marginTop = 5;
  const marginBottom = 8;

  it('should render the chart container and axis titles', () => {
    render(
      <SensorHeatmapChart
        chartData={mockChartData}
        yardLength={yardLength}
        yardWidth={yardWidth}
        maxIntensity={maxIntensity}
      />
    );
    expect(screen.getByText('Yard Length (feet)')).toBeInTheDocument();
    expect(screen.getByText('Yard Width (feet)')).toBeInTheDocument();
  });

  it('should render the SVG container with correct viewBox', () => {
    const { container } = render(
      <SensorHeatmapChart
        chartData={mockChartData}
        yardLength={yardLength}
        yardWidth={yardWidth}
        maxIntensity={maxIntensity}
      />
    );
    const svg = container.querySelector('svg');
    const totalWidth = yardLength + marginLeft + marginRight;
    const totalHeight = yardWidth + marginTop + marginBottom;
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
  });

  it('should render the heatmap as a single image when data is present', () => {
    const { container } = render(
      <SensorHeatmapChart
        chartData={mockChartData}
        yardLength={yardLength}
        yardWidth={yardWidth}
        maxIntensity={maxIntensity}
      />
    );
    const image = container.querySelector('image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('href', 'data:image/png;base64,dummy-image-data');
    expect(image).toHaveAttribute('width', String(yardLength));
    expect(image).toHaveAttribute('height', String(yardWidth));
    expect(image).toHaveStyle('image-rendering: pixelated');
  });

  it('should render sensor circles correctly', () => {
    const { container } = render(
      <SensorHeatmapChart
        chartData={mockChartData}
        yardLength={yardLength}
        yardWidth={yardWidth}
        maxIntensity={maxIntensity}
      />
    );
    const sensorCircles = container.querySelectorAll('circle');
    const sensorsWithData = mockChartData.filter(d => d.z !== undefined);
    expect(sensorCircles).toHaveLength(sensorsWithData.length);

    sensorCircles.forEach((circle, index) => {
      const sensor = sensorsWithData[index];
      expect(circle).toHaveAttribute('stroke', '#ec4899');
      // The fill is 'transparent' to make the entire area hoverable, not 'none'.
      expect(circle).toHaveAttribute('fill', 'transparent');
      // Positions should be offset by the margins.
      expect(circle).toHaveAttribute('cx', String(marginLeft + sensor.x));
      expect(circle).toHaveAttribute('cy', String(marginTop + sensor.y));
    });
  });

  it('should render grid lines with correct styling', () => {
    const { container } = render(
      <SensorHeatmapChart
        chartData={mockChartData}
        yardLength={yardLength}
        yardWidth={yardWidth}
        maxIntensity={maxIntensity}
      />
    );
    const lines = container.querySelectorAll('g[clip-path="url(#heatmapClip)"] > line');
    const expectedVerticalLines = Math.floor(yardLength / 10) + 1;
    const expectedHorizontalLines = Math.floor(yardWidth / 10) + 1;
    expect(lines.length).toBe(expectedVerticalLines + expectedHorizontalLines);

    lines.forEach(line => {
      expect(line).toHaveAttribute('stroke', 'rgb(100, 116, 139)');
      expect(line).toHaveAttribute('stroke-dasharray', '1 1');
    });
  });

  it('should render axis tick labels', () => {
    render(
      <SensorHeatmapChart
        chartData={mockChartData}
        yardLength={yardLength}
        yardWidth={yardWidth}
        maxIntensity={maxIntensity}
      />
    );
    // Check for some expected labels. Use getAllByText for labels that might appear on both axes.
    expect(screen.getAllByText('0')[0]).toBeInTheDocument();
    expect(screen.getAllByText('10')[0]).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument(); // '100' is unique to X-axis
    expect(screen.getByText('33')).toBeInTheDocument(); // '33' is unique to Y-axis
  });

  it('should render the legend correctly', () => {
    render(
      <SensorHeatmapChart
        chartData={mockChartData}
        yardLength={yardLength}
        yardWidth={yardWidth}
        maxIntensity={maxIntensity}
      />
    );
    expect(screen.getByText('Sensor Locations')).toBeInTheDocument();
    expect(screen.getByText('Low Intensity')).toBeInTheDocument();
    expect(screen.getByText('High Intensity')).toBeInTheDocument();
  });

  it('should handle empty chart data gracefully', () => {
    const { container } = render(
      <SensorHeatmapChart
        chartData={[]}
        yardLength={yardLength}
        yardWidth={yardWidth}
        maxIntensity={maxIntensity}
      />
    );
    // Should still render the basic structure
    expect(container.querySelector('svg')).toBeInTheDocument();
    // Should NOT render the heatmap image or sensor circles
    expect(container.querySelector('image')).not.toBeInTheDocument();
    expect(container.querySelectorAll('circle').length).toBe(0);
  });

  it('should handle sensors with null or undefined intensity data', () => {
    const dataWithInvalidZ: ChartDataPoint[] = [
      { x: 10, y: 20, z: undefined, sensor_id: "sensor_undefined" },
      { x: 30, y: 40, z: null as any, sensor_id: "sensor_null" },
    ];

    const { container } = render(
      <SensorHeatmapChart
        chartData={dataWithInvalidZ}
        yardLength={50}
        yardWidth={50}
        maxIntensity={maxIntensity}
      />
    );

    // The heatmap generation filters out both `null` and `undefined` `z` values.
    // If no valid sensors remain, no image should be rendered.
    expect(container.querySelector('image')).not.toBeInTheDocument();

    // The sensor circle rendering filters out only `undefined` `z` values.
    // So, the sensor with `z: null` should still be rendered as a circle.
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(1);
    expect(circles[0]).toHaveAttribute('cx', String(marginLeft + 30));
  });
});