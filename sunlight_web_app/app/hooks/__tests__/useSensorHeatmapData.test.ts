/*
 * useSensorHeatmapData.test.ts
 *
 * Unit tests for sensor heatmap data retrieval hook.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useSensorHeatmapData } from '../useSensorHeatmapData';
import { getDocs } from 'firebase/firestore';
import { DateTime } from 'luxon';

// Mock the entire 'firebase/firestore' module
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  // Mock the Timestamp class and its fromMillis method
  Timestamp: {
    fromMillis: jest.fn(ms => ({
      toDate: () => new Date(ms),
    })),
  },
}));

// Type-safe casting for our mocked functions
const mockedGetDocs = getDocs as jest.Mock;

// --- Reusable Mocking Utilities ---

// Define a generic type for the mock document that getDocs returns.
type MockDocument<T = Record<string, unknown>> = {
  data: () => T;
};

// Define a generic type for the mock QuerySnapshot.
type MockQuerySnapshot<T = Record<string, unknown>> = {
  docs: MockDocument<T>[];
  forEach: (callback: (doc: MockDocument<T>) => void) => void;
};

// Helper to create a more realistic and strongly-typed QuerySnapshot mock.
const createMockQuerySnapshot = <T>(docs: MockDocument<T>[]): MockQuerySnapshot<T> => ({
  docs,
  forEach: (callback: (doc: MockDocument<T>) => void) => {
    docs.forEach(callback);
  },
});


describe('useSensorHeatmapData Hook', () => {
  // Define common inputs for the tests
  const selectedDate = '2024-03-10';
  const selectedSensorSet = 'rooftop-array';
  const timezone = 'America/Chicago';

  // Clear all mocks before each test to ensure a clean slate
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle the successful data fetching path correctly', async () => {
    // --- 1. MOCK DATA ---
    const startOfDay = DateTime.fromISO(selectedDate, { zone: timezone }).startOf('day');

    // Mock the response for the sensor metadata query
    const mockMetadataDocs = createMockQuerySnapshot([
      { data: () => ({ sensor_id: 'sensor-1', position_x_ft: 5, position_y_ft: 10 }) },
      { data: () => ({ sensor_id: 'sensor-2', position_x_ft: 15, position_y_ft: 20 }) },
    ]);

    // Mock the response for the sunlight readings query (intentionally unsorted by time)
    const mockReadingsDocs = createMockQuerySnapshot([
      { data: () => ({ sensor_id: 'sensor-1', smoothed_light_intensity: 250, observation_minute: { toDate: () => startOfDay.plus({ hours: 10 }).toJSDate() } }) },
      { data: () => ({ sensor_id: 'sensor-2', smoothed_light_intensity: 260, observation_minute: { toDate: () => startOfDay.plus({ hours: 10 }).toJSDate() } }) },
      { data: () => ({ sensor_id: 'sensor-1', smoothed_light_intensity: 150, observation_minute: { toDate: () => startOfDay.plus({ hours: 9 }).toJSDate() } }) },
    ]);

    // Configure getDocs to return metadata first, then readings
    mockedGetDocs
      .mockResolvedValueOnce(mockMetadataDocs)
      .mockResolvedValueOnce(mockReadingsDocs);

    // --- 2. RENDER HOOK ---
    const { result } = renderHook(() => useSensorHeatmapData(selectedDate, selectedSensorSet, timezone));

    // --- 3. ASSERTIONS ---
    // Wait for the hook to finish its async operations
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Check final state
    expect(result.current.error).toBeNull();
    expect(result.current.sensorMetadata).toEqual([
      { id: 'sensor-1', position_x_ft: 5, position_y_ft: 10 },
      { id: 'sensor-2', position_x_ft: 15, position_y_ft: 20 },
    ]);

    const time1 = startOfDay.plus({ hours: 9 }).toMillis();
    const time2 = startOfDay.plus({ hours: 10 }).toMillis();

    // Verify timestamps were collected and sorted correctly
    expect(result.current.timestamps).toEqual([time1, time2]);

    // Verify readings were grouped correctly by timestamp
    expect(result.current.readings).toEqual({
      [time1]: { 'sensor-1': 150 },
      [time2]: { 'sensor-1': 250, 'sensor-2': 260 },
    });
  });

  it('should set an error if no sensor metadata is found', async () => {
    // Mock an empty response for the metadata query
    mockedGetDocs.mockResolvedValueOnce(createMockQuerySnapshot([]));

    const { result } = renderHook(() => useSensorHeatmapData(selectedDate, selectedSensorSet, timezone));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Assert the specific error message is set
    expect(result.current.error).toBe('No sensor data found for this set.');
    // Ensure the readings fetch was never attempted
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
    // Data states should be empty
    expect(result.current.sensorMetadata).toEqual([]);
    expect(result.current.readings).toEqual({});
    expect(result.current.timestamps).toEqual([]);
  });

  it('should set a generic error on a Firestore query failure', async () => {
    const mockError = new Error('Firestore permission denied');
    // Mock a rejected promise for the first getDocs call
    mockedGetDocs.mockRejectedValue(mockError);

    // Spy on console.error to prevent logging during tests and to verify it was called
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useSensorHeatmapData(selectedDate, selectedSensorSet, timezone));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Assert the correct error state
    expect(result.current.error).toBe('Failed to load heatmap data.');
    expect(result.current.sensorMetadata).toEqual([]);
    expect(result.current.readings).toEqual({});

    // Verify that the error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching heatmap data:", mockError);

    // Clean up the spy
    consoleErrorSpy.mockRestore();
  });

  it('should not fetch data if required parameters are missing', () => {
    // Render the hook with an empty string for a required prop
    const { result } = renderHook(() => useSensorHeatmapData(selectedDate, '', timezone));

    // The hook should immediately set loading to false without fetching
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.readings).toEqual({});

    // Verify that no calls to Firestore were made
    expect(mockedGetDocs).not.toHaveBeenCalled();
  });
});