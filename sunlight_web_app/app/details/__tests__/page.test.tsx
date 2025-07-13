/*
 * page.test.tsx
 *
 * Unit tests for the Sensor Details page.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DetailsPage from '../page';
import { getDocs } from 'firebase/firestore';

// FIX: Mock all the firestore functions used by the component to completely
// isolate it from the actual Firebase SDK during tests.
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(), // This is the only function we need to control for these tests.
}));

// Mock the custom hook for fetching sensor sets
jest.mock('@/app/hooks/useSensorSets', () => ({
  useSensorSets: () => ({
    sensorSets: [{ id: 'set1', name: 'Test Set 1', timezone: 'UTC' }],
    loading: false,
    error: null,
  }),
}));

// Mock the custom hook for persistent state to provide a stable value
jest.mock('@/app/hooks/usePersistentState', () => (key: string, defaultValue: any) => {
  // When the component asks for the selected set, give it 'set1' to trigger the data fetch
  const value = key === 'sensor-details-set' ? 'set1' : defaultValue;
  // We only need to return the value and a dummy function for setState
  return [value, jest.fn()];
});

describe('DetailsPage', () => {
  // Cast the mock for TypeScript to recognize it as a Jest mock function
  const mockGetDocs = getDocs as jest.Mock;

  beforeEach(() => {
    // Clear any previous mock implementations and calls before each test
    mockGetDocs.mockClear();
  });

  it('should render the main heading and show a loading message initially', () => {
    // Mock getDocs to be a promise that never resolves to simulate a loading state
    mockGetDocs.mockImplementation(() => new Promise(() => {}));

    render(<DetailsPage />);

    expect(screen.getByRole('heading', { name: /sensor details/i })).toBeInTheDocument();
    expect(screen.getByText('Loading sensor data...')).toBeInTheDocument();
  });

  it('should display sensor data in a table after a successful fetch', async () => {
    const mockSensors = [
      {
        id: 'sensor-A',
        data: () => ({
          sensor_id: 'Sensor A',
          position_x_ft: 10,
          position_y_ft: 20,
          board: 'Board 1',
          sunlight_sensor_model: 'TCS34725',
        }),
      },
    ];

    // Mock a successful response from getDocs
    mockGetDocs.mockResolvedValue({ docs: mockSensors });

    render(<DetailsPage />);

    // Wait for the table to appear in the document
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Check for specific content in the table
    expect(screen.getByText('Sensor A')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('should display an error message if the data fetch fails', async () => {
    // Mock a failed response from getDocs
    mockGetDocs.mockRejectedValue(new Error('Firestore query failed'));

    render(<DetailsPage />);

    // Wait for the error message to be displayed
    await waitFor(() => {
      expect(screen.getByText('Failed to load sensor data.')).toBeInTheDocument();
    });
  });

  it('should display a "no sensors" message if the fetch returns no data', async () => {
    // Mock an empty response
    mockGetDocs.mockResolvedValue({ docs: [] });

    render(<DetailsPage />);

    // Wait for the "no data" message to be displayed
    await waitFor(() => {
      expect(screen.getByText('No sensors found for the selected set.')).toBeInTheDocument();
    });
  });
});