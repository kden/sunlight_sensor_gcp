/*
 * page.test.tsx
 *
 * Unit tests for the Sensor Details page.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4.5 (2025).
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

// Mock the global fetch function
global.fetch = jest.fn();

// Cast the mocks for TypeScript to recognize them as Jest mock functions
const mockUseSensorSelection = useSensorSelection as jest.Mock;
const mockGetDocs = getDocs as jest.Mock;
const mockFetch = global.fetch as jest.Mock;

describe('DetailsPage', () => {
    beforeEach(() => {
        // Clear all mocks before each test to ensure isolation
        mockGetDocs.mockClear();
        mockUseSensorSelection.mockClear();
        mockFetch.mockClear();
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

        // Mock the Cassandra fetch to return live data
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => [{
                sensor_id: 'Sensor A',
                light_intensity: 5432.1,
                battery_percent: 85,
                wifi_dbm: -45,
                chip_temp_f: 72.3,
                last_seen: '2025-01-15T10:30:00Z',
            }],
        });

        render(<DetailsPage />);

        // Wait for the table to appear in the document
        await waitFor(() => {
            expect(screen.getByRole('table')).toBeInTheDocument();
        });

        // Check for specific content in the table
        expect(screen.getByText('Sensor A')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('20')).toBeInTheDocument();

        // Check for the new Cassandra data columns
        expect(screen.getByText('5432.1')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
        expect(screen.getByText('-45')).toBeInTheDocument();
        expect(screen.getByText('72.3')).toBeInTheDocument();
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

    it('should gracefully handle Cassandra fetch failures and show N/A', async () => {
        // Setup: Firebase succeeds but Cassandra fails
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
                id: 'sensor-B',
                data: () => ({
                    sensor_id: 'Sensor B',
                    position_x_ft: 15,
                    position_y_ft: 25,
                    board: 'Board 2',
                    sunlight_sensor_model: 'BH1750',
                }),
            },
        ];
        mockGetDocs.mockResolvedValue({ docs: mockSensors });

        // Mock the Cassandra fetch to fail
        mockFetch.mockRejectedValue(new Error('Network error'));

        render(<DetailsPage />);

        // Wait for the table to appear
        await waitFor(() => {
            expect(screen.getByRole('table')).toBeInTheDocument();
        });

        // Firebase data should still be shown
        expect(screen.getByText('Sensor B')).toBeInTheDocument();

        // Cassandra data should show N/A
        const naCells = screen.getAllByText('N/A');
        expect(naCells.length).toBeGreaterThanOrEqual(5); // Should have N/A for all Cassandra columns
    });
});