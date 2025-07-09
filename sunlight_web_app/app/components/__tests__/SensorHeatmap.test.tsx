import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SensorHeatmap from '../SensorHeatmap';

// --- MOCKS ---

// Mock the firebase module
jest.mock('@/app/firebase', () => ({
  app: {},
}));

// Mock Firestore functions
const mockGetDocs = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();

jest.mock('firebase/firestore', () => {
  const mockTimestamp = {
    fromDate: (date: Date) => ({
      toDate: () => date,
    }),
  };
  return {
    getFirestore: jest.fn(),
    collection: () => mockCollection(),
    getDocs: (q: unknown) => mockGetDocs(q),
    query: () => mockQuery(),
    where: () => mockWhere(),
    Timestamp: mockTimestamp,
  };
});

describe('SensorHeatmap', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockGetDocs.mockClear();
  });

  const mockSensorMetadata = {
    docs: [
      { data: () => ({ sensor_id: 'sensor-1', position_x_ft: 10, position_y_ft: 15 }) },
      { data: () => ({ sensor_id: 'sensor-2', position_x_ft: 20, position_y_ft: 25 }) },
    ],
  };

  const mockReadingsData = {
    docs: [
      {
        data: () => ({
          sensor_id: 'sensor-1',
          smoothed_light_intensity: 5000,
          observation_minute: { toDate: () => new Date('2025-07-01T12:00:00Z') },
        }),
      },
      {
        data: () => ({
          sensor_id: 'sensor-2',
          smoothed_light_intensity: 8000,
          observation_minute: { toDate: () => new Date('2025-07-01T12:00:00Z') },
        }),
      },
      {
        data: () => ({
          sensor_id: 'sensor-1',
          smoothed_light_intensity: 5500,
          observation_minute: { toDate: () => new Date('2025-07-01T12:01:00Z') },
        }),
      },
    ],
    forEach: function (callback: (doc: { data: () => void; }) => void) {
      this.docs.forEach(callback);
    },
  };

  test('renders loading state initially, then the heatmap and slider', async () => {
    mockGetDocs
      .mockResolvedValueOnce(mockSensorMetadata)
      .mockResolvedValueOnce(mockReadingsData);

    const { container } = render(<SensorHeatmap />);

    expect(screen.getByText(/Loading heatmap data/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText(/Time:/i)).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      const circles = svg?.querySelectorAll('circle');
      expect(circles).toHaveLength(2);
    });
  });

  test('displays an error message if fetching metadata fails', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Failed to fetch metadata'));

    render(<SensorHeatmap />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load heatmap data.')).toBeInTheDocument();
    });
  });

  test('displays "no data" message if no readings are found', async () => {
    mockGetDocs
      .mockResolvedValueOnce(mockSensorMetadata)
      .mockResolvedValueOnce({ docs: [], forEach: () => {} });

    render(<SensorHeatmap />);

    await waitFor(() => {
      expect(screen.getByText('No data found for the selected date.')).toBeInTheDocument();
    });
  });

  test('updates the displayed time when the slider is moved', async () => {
    mockGetDocs
      .mockResolvedValueOnce(mockSensorMetadata)
      .mockResolvedValueOnce(mockReadingsData);

    render(<SensorHeatmap />);

    // Use the default locale and timezone to match the component's behavior
    const initialTime = new Date('2025-07-01T12:00:00Z').toLocaleTimeString();

    const timeLabel = await screen.findByText(`Time: ${initialTime}`);
    expect(timeLabel).toBeInTheDocument();

    // Move the slider
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '1' } });

    // Check that the text content of the label updates
    const updatedTime = new Date('2025-07-01T12:01:00Z').toLocaleTimeString();

    await waitFor(() => {
        expect(timeLabel).toHaveTextContent(`Time: ${updatedTime}`);
    });
  });
});
