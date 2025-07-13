// /home/caden/code/sunlight_sensor_gcp/sunlight_web_app/app/hooks/__tests__/useSensorLevelsData.test.ts

import { renderHook, waitFor } from '@testing-library/react';
import { useSensorLevelsData } from '../useSensorLevelsData';
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

// Define a generic type for the mock document that getDocs returns.
// It has a `data` method that returns the document's fields.
type MockDocument<T = Record<string, unknown>> = {
  data: () => T;
};

// Define a generic type for the mock QuerySnapshot.
// It has a `docs` array and a `forEach` method.
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


describe('useSensorLevelsData Hook', () => {
  // Define common inputs for the tests
  const selectedDate = '2023-10-27';
  const selectedSensorSet = 'garden-set';
  const timezone = 'America/New_York';

  // Clear all mocks before each test to ensure a clean slate
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle the successful data fetching path correctly', async () => {
    // --- 1. MOCK DATA ---
    const startOfDay = DateTime.fromISO(selectedDate, { zone: timezone }).startOf('day');

    // Mock the response for the sensor ID query
    const mockSensorDocs = createMockQuerySnapshot([
      { data: () => ({ sensor_id: 'sensor-A' }) },
      { data: () => ({ sensor_id: 'sensor-B' }) },
    ]);

    // Mock the response for the sunlight readings query
    const mockReadingsDocs = createMockQuerySnapshot([
      // Timestamp 1: 8:00 AM
      { data: () => ({ sensor_id: 'sensor-A', smoothed_light_intensity: 100, observation_minute: { toDate: () => startOfDay.plus({ hours: 8 }).toJSDate() } }) },
      { data: () => ({ sensor_id: 'sensor-B', smoothed_light_intensity: 110, observation_minute: { toDate: () => startOfDay.plus({ hours: 8 }).toJSDate() } }) },
      // Timestamp 2: 9:00 AM
      { data: () => ({ sensor_id: 'sensor-A', smoothed_light_intensity: 200, observation_minute: { toDate: () => startOfDay.plus({ hours: 9 }).toJSDate() } }) },
      { data: () => ({ sensor_id: 'sensor-B', smoothed_light_intensity: 220, observation_minute: { toDate: () => startOfDay.plus({ hours: 9 }).toJSDate() } }) },
    ]);

    // Configure getDocs to return the sensor data first, then the readings data
    mockedGetDocs
      .mockResolvedValueOnce(mockSensorDocs)
      .mockResolvedValueOnce(mockReadingsDocs);

    // --- 2. RENDER HOOK ---
    const { result } = renderHook(() => useSensorLevelsData(selectedDate, selectedSensorSet, timezone));

    // --- 3. ASSERTIONS ---
    // Wait for the hook to finish its async operations
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Check sensor IDs
    expect(result.current.sensorIds).toEqual(['sensor-A', 'sensor-B']);

    // Check that the readings data was correctly pivoted and formatted
    expect(result.current.readings).toHaveLength(2);
    expect(result.current.readings).toEqual([
      { time: startOfDay.plus({ hours: 8 }).toMillis(), 'sensor-A': 100, 'sensor-B': 110 },
      { time: startOfDay.plus({ hours: 9 }).toMillis(), 'sensor-A': 200, 'sensor-B': 220 },
    ]);

    // Check time calculations
    expect(result.current.hourlyTicks).toHaveLength(24);
    expect(result.current.axisDomain).toEqual([
      startOfDay.toMillis(),
      startOfDay.endOf('day').toMillis(),
    ]);

    // Ensure no error was set
    expect(result.current.error).toBeNull();
  });

  it('should set an error if no sensors are found for the selected set', async () => {
    // Mock an empty response for the sensor query
    mockedGetDocs.mockResolvedValueOnce(createMockQuerySnapshot([]));

    const { result } = renderHook(() => useSensorLevelsData(selectedDate, selectedSensorSet, timezone));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Assert the specific error message is set
    expect(result.current.error).toBe('No sensors found for this set.');
    // Ensure the readings fetch was never attempted
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
    // Data arrays should be empty
    expect(result.current.readings).toEqual([]);
    expect(result.current.sensorIds).toEqual([]);
  });

  it('should set a generic error on a Firestore query failure', async () => {
    const mockError = new Error('Firestore permission denied');
    // Mock a rejected promise for the first getDocs call
    mockedGetDocs.mockRejectedValue(mockError);

    // Spy on console.error to prevent logging during tests and to verify it was called
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useSensorLevelsData(selectedDate, selectedSensorSet, timezone));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Assert the correct error state
    expect(result.current.error).toBe('Failed to load sensor data. Check permissions and Firestore indexes.');
    expect(result.current.readings).toEqual([]);
    expect(result.current.sensorIds).toBeNull();

    // Verify that the error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching data:", mockError);

    // Clean up the spy
    consoleErrorSpy.mockRestore();
  });

  it('should not fetch data if required parameters are missing', () => {
    // Render the hook with an empty string for a required prop
    const { result } = renderHook(() => useSensorLevelsData(selectedDate, '', timezone));

    // The hook should immediately set loading to false without fetching
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.readings).toEqual([]);

    // Verify that no calls to Firestore were made
    expect(mockedGetDocs).not.toHaveBeenCalled();
  });
});