/*
 * page.test.tsx
 *
 * Smoke test for the root page, which displays the sensor levels.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LevelsPage from '../page';

// Mock the SensorLevels component to isolate the page test
jest.mock('@/app/components/SensorLevels', () => {
  return function DummySensorLevels() {
    return <div data-testid="sensor-levels-component"></div>;
  };
});

describe('Root Page (Levels)', () => {
  it('renders the heading and the SensorLevels component', () => {
    render(<LevelsPage />);

    // Check for the main heading of the page
    const heading = screen.getByRole('heading', {
      name: /sensor levels over time/i,
    });
    expect(heading).toBeInTheDocument();

    // Check that our mock SensorLevels component is rendered
    expect(screen.getByTestId('sensor-levels-component')).toBeInTheDocument();
  });
});