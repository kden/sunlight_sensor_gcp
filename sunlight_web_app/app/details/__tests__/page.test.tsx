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
import { useSensorSelection } from '@/app/hooks/useSensorSelection';

// Mock the firestore module, which is still a dependency for the data fetch
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

// Mock the component's new direct dependency, the useSensorSelection hook.
jest.mock('@/app/hooks/useSensorSelection');

// Cast the mocks for TypeScript to recognize them as Jest mock functions
const mockUseSensorSelection = useSensorSelection as jest.Mock;
const mockGetDocs = getDocs as jest.Mock;

describe('DetailsPage', () => {
  beforeEach(() => {
    // Clear all mocks before each test to ensure isolation
    mockGetDocs.mockClear();
    mockUseSensorSelection.mockClear();
  });

  it('should render the main heading and show a loading message initially', () => {
    // Setup: The sensor selection is complete, but the sensor data is still loading.
    mockUseSensorSelection.mockReturnValue({
      selectedSensorSet: 'set1',
      sensorSets: [{ id: 'set1', name: 'Test Set 1', timezone: 'UTC', latitude: 40.1, longitude: -80.2 }],
      sensorSetsLoading: false,
      sensorSetsError: null,
      timezone: 'UTC',
      latitude: 40.1,
      longitude: -80.2,
      handleSensorSetChange: jest.fn(),
    });
    // Mock getDocs to be a promise that never resolves to simulate a loading state
    mockGetDocs.mockImplementation(() => new Promise(() => {}));

    render(<DetailsPage />);

    expect(screen.getByRole('heading', { name: /sensor details/i })).toBeInTheDocument();
    expect(screen.getByText('Loading sensor data...')).toBeInTheDocument();
  });

  it('should display sensor data in a table after a successful fetch', async () => {
    // Setup: The selection is complete and the data fetch will succeed.
    mockUseSensorSelection.mockReturnValue({
      selectedSensorSet: 'set1',
      sensorSets: [{ id: 'set1', name: 'Test Set 1', timezone: 'UTC', latitude: 40.1, longitude: -80.2 }],
      sensorSetsLoading: false,
      sensorSetsError: null,
      timezone: 'UTC',
      latitude: 40.1,
      longitude: -80.2,
      handleSensorSetChange: jest.fn(),
    });
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
    // Setup: The selection is complete and the data fetch will fail.
    mockUseSensorSelection.mockReturnValue({
      selectedSensorSet: 'set1',
      sensorSets: [{ id: 'set1', name: 'Test Set 1', timezone: 'UTC', latitude: 40.1, longitude: -80.2 }],
      sensorSetsLoading: false,
      sensorSetsError: null,
      timezone: 'UTC',
      latitude: 40.1,
      longitude: -80.2,
      handleSensorSetChange: jest.fn(),
    });
    mockGetDocs.mockRejectedValue(new Error('Firestore query failed'));

    render(<DetailsPage />);

    // Wait for the error message to be displayed
    await waitFor(() => {
      expect(screen.getByText('Failed to load sensor data.')).toBeInTheDocument();
    });
  });

  it('should display a "no sensors" message if the fetch returns no data', async () => {
    // Setup: The selection is complete and the fetch returns an empty array.
    mockUseSensorSelection.mockReturnValue({
      selectedSensorSet: 'set1',
      sensorSets: [{ id: 'set1', name: 'Test Set 1', timezone: 'UTC', latitude: 40.1, longitude: -80.2 }],
      sensorSetsLoading: false,
      sensorSetsError: null,
      timezone: 'UTC',
      latitude: 40.1,
      longitude: -80.2,
      handleSensorSetChange: jest.fn(),
    });
    mockGetDocs.mockResolvedValue({ docs: [] });

    render(<DetailsPage />);

    // Wait for the "no data" message to be displayed
    await waitFor(() => {
      expect(screen.getByText('No sensors found for the selected set.')).toBeInTheDocument();
    });
  });

  it('should show a loading message for sensor sets', () => {
    // Setup: The selection hook itself is in a loading state.
    mockUseSensorSelection.mockReturnValue({
      selectedSensorSet: '',
      sensorSets: [],
      sensorSetsLoading: true,
      sensorSetsError: null,
      timezone: '',
      latitude: null,
      longitude: null,
      handleSensorSetChange: jest.fn(),
    });

    render(<DetailsPage />);

    expect(screen.getByText('Loading sets...')).toBeInTheDocument();
    // The sensor data fetch should not have started yet
    expect(screen.queryByText('Loading sensor data...')).not.toBeInTheDocument();
  });
});