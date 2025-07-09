import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SensorGraph from '../SensorGraph';

// --- MOCKS ---

// Explicitly mock the firebase module using the same alias the component uses
jest.mock('@/app/firebase', () => ({
  app: {}, // Provide a dummy app object for the test environment
}));

// Define mock implementations for Firestore functions
const mockGetDocs = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();

// Mock Firebase services using a factory function
jest.mock('firebase/firestore', () => {
  const mockTimestamp = {
    fromDate: (date: Date) => ({
      toDate: () => date,
    }),
  };
  return {
    getFirestore: jest.fn(),
    collection: () => mockCollection(),
    // Use 'unknown' type to satisfy the linter instead of 'any'
    getDocs: (q: unknown) => mockGetDocs(q),
    query: () => mockQuery(),
    where: () => mockWhere(),
    Timestamp: mockTimestamp,
  };
});

// Mock Recharts
jest.mock('recharts', () => {
    const OriginalRecharts = jest.requireActual('recharts');
    return {
      ...OriginalRecharts,
      ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="responsive-container">{children}</div>
      ),
      LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
      Line: () => <div data-testid="line"></div>,
      XAxis: () => <div data-testid="x-axis"></div>,
      YAxis: () => <div data-testid="y-axis"></div>,
      Tooltip: () => <div data-testid="tooltip"></div>,
      Legend: () => <div data-testid="legend"></div>,
      CartesianGrid: () => <div data-testid="cartesian-grid"></div>,
    };
  });


describe('SensorGraph', () => {
  beforeEach(() => {
    // Clear mock history before each test
    mockGetDocs.mockClear();
  });

  const mockSensorMetadata = {
    docs: [
      { data: () => ({ sensor_id: 'sensor_a' }) },
      { data: () => ({ sensor_id: 'sensor_b' }) },
    ],
  };

  // Define a type for the mock document to avoid using 'any'
  type MockDoc = { data: () => Record<string, unknown> };

  const mockSensorReadings = {
    docs: [
      {
        data: () => ({
          sensor_id: 'sensor_a',
          smoothed_light_intensity: 150,
          observation_minute: { toDate: () => new Date() },
        }),
      },
    ],
    // Use a specific type for the callback parameter to satisfy the linter
    forEach: function(callback: (doc: MockDoc) => void) {
      this.docs.forEach(callback);
    }
  };

  test('renders loading state initially and then displays the chart with data', async () => {
    mockGetDocs
      .mockResolvedValueOnce(mockSensorMetadata)
      .mockResolvedValueOnce(mockSensorReadings);

    render(<SensorGraph />);

    expect(screen.getByText(/Loading sensor data/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Loading sensor data/i)).not.toBeInTheDocument();
    const lines = screen.getAllByTestId('line');
    expect(lines).toHaveLength(2);
  });

  test('displays "no data" message when no readings are found', async () => {
    mockGetDocs
      .mockResolvedValueOnce(mockSensorMetadata)
      // Prefix unused variable with an underscore and provide a type for the callback
      .mockResolvedValueOnce({ docs: [], forEach: (_cb: (doc: MockDoc) => void) => [] });

    render(<SensorGraph />);

    await waitFor(() => {
      expect(screen.getByText('No data found for the selected date.')).toBeInTheDocument();
    });
  });

  test('displays an error message if fetching data fails', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Failed to fetch'));

    render(<SensorGraph />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load sensor data/i)).toBeInTheDocument();
    });
  });
});
