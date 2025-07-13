/*
 * useSensorSets.test.ts
 *
 * Unit tests for sensor set list retrieval hook.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useSensorSets } from '../useSensorSets';
import { getDocs } from 'firebase/firestore';
import { SensorSet } from '@/app/types/SensorSet';

// Mock the entire 'firebase/firestore' module
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
}));

// Type-safe casting for our mocked functions
const mockedGetDocs = getDocs as jest.Mock;

describe('useSensorSets Hook', () => {
  // Reset mocks before each test to ensure isolation
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the initial state correctly', () => {
    mockedGetDocs.mockResolvedValue({ docs: [] });

    const { result } = renderHook(() => useSensorSets());

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.sensorSets).toEqual([]);
  });

  it('should fetch and set sensor sets on successful API call', async () => {
    const mockSensorSetsData = [
      {
        id: 'set1',
        data: () => ({
          sensor_set_id: 'My First Sensor Set',
          timezone: 'America/New_York',
          latitude: 40.7128,
          longitude: -74.0060,
        }),
      },
      {
        id: 'set2',
        data: () => ({ sensor_set_id: 'My Second Sensor Set', timezone: 'Europe/London' }),
      },
      // Test fallback logic
      {
        id: 'set3-fallback',
        data: () => ({}), // No sensor_set_id or timezone
      },
    ];

    const expectedSensorSets: SensorSet[] = [
      { id: 'set1', name: 'My First Sensor Set', timezone: 'America/New_York', latitude: 40.7128, longitude: -74.0060 },
      { id: 'set2', name: 'My Second Sensor Set', timezone: 'Europe/London', latitude: null, longitude: null },
      { id: 'set3-fallback', name: 'set3-fallback', timezone: 'UTC', latitude: null, longitude: null },
    ];

    // Mock the resolved value of getDocs
    mockedGetDocs.mockResolvedValue({ docs: mockSensorSetsData });

    const { result } = renderHook(() => useSensorSets());

    // Wait for the async effect to complete and loading to be false
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Assert the final state
    expect(result.current.error).toBeNull();
    expect(result.current.sensorSets).toEqual(expectedSensorSets);
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
  });

  it('should set an error message on a failed API call', async () => {
    const mockError = new Error('Firestore permission denied');
    // Mock the rejected value of getDocs
    mockedGetDocs.mockRejectedValue(mockError);

    // Suppress the expected console.error from appearing in the test output
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useSensorSets());

    // Wait for the async effect to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Assert the final state
    expect(result.current.error).toBe('Failed to load sensor set metadata.');
    expect(result.current.sensorSets).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching sensor sets:", mockError);

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });
});