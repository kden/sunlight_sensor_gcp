import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import GraphPage from '../page';

// Mock the SensorGraph component to isolate the GraphPage test
jest.mock('@/app/components/SensorGraph', () => {
  return function DummySensorGraph() {
    return <div data-testid="sensor-graph"></div>;
  };
});

describe('GraphPage', () => {
  test('renders the heading and the SensorGraph component', () => {
    render(<GraphPage />);

    // Check for the main heading of the page
    const heading = screen.getByRole('heading', {
      name: /sensor levels/i,
    });
    expect(heading).toBeInTheDocument();

    // Check that our mock SensorGraph component is rendered
    expect(screen.getByTestId('sensor-graph')).toBeInTheDocument();
  });
});