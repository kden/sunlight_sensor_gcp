import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SensorHeatmap from '@/app/components/SensorHeatmap';
// FIXED: Only import getDocs, as other functions are not directly called in the test.
import { getDocs } from 'firebase/firestore';

// --- Mock Recharts ---
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div className="recharts-responsive-container">{children}</div>
    ),
    ScatterChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="scatter-chart">{children}</div>
    ),
    Scatter: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="scatter-component">{children}</div>
    ),
    XAxis: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="x-axis">{children}</div>
    ),
    YAxis: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="y-axis">{children}</div>
    ),
    Label: ({ value }: { value: string }) => <div data-testid="label">{value}</div>,
    Tooltip: () => <div data-testid="tooltip" />,
    CartesianGrid: () => <div data-testid="grid" />,
    Cell: () => <div data-testid="cell" />,
  };
});


// --- Mock Firebase/Firestore ---
jest.mock('firebase/firestore', () => ({
  // Provide mocks for all functions used in the COMPONENT file
  getFirestore: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  Timestamp: {
    fromDate: (date: Date) => ({
      toDate: () => date,
    }),
  },
}));

// Mock data for sensor metadata
const mockSensorMetadata = {
  docs: [
    { data: () => ({ sensor_id: 'sensor-1', position_x_ft: 10, position_y_ft: 20 }) },
    { data: () => ({ sensor_id: 'sensor-2', position_x_ft: 15, position_y_ft: 25 }) },
  ],
};

// Mock data for sensor readings with a correct .forEach method
const mockSensorReadingsDocs = [
    {
      data: () => ({
        sensor_id: 'sensor-1',
        smoothed_light_intensity: 5000,
        observation_minute: { toDate: () => new Date('2023-10-27T10:00:00Z') },
      }),
    },
];
const mockSensorReadings = {
  forEach: (callback: (doc: unknown) => void) => {
    mockSensorReadingsDocs.forEach(callback);
  },
};


describe('SensorHeatmap with Recharts', () => {
  beforeEach(() => {
    (getDocs as jest.Mock).mockClear();
  });

  it('renders a loading state initially', () => {
    (getDocs as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<SensorHeatmap />);
    expect(screen.getByText(/Loading heatmap data/i)).toBeInTheDocument();
  });

  it('renders the chart with data after loading', async () => {
    (getDocs as jest.Mock)
      .mockResolvedValueOnce(mockSensorMetadata)
      .mockResolvedValueOnce(mockSensorReadings);

    render(<SensorHeatmap />);

    await waitFor(() => {
        expect(screen.getByText('Yard Length (feet)')).toBeInTheDocument();
        expect(screen.getByText('Yard Width (feet)')).toBeInTheDocument();
    });
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('displays an error message when fetching fails', async () => {
    (getDocs as jest.Mock).mockRejectedValue(new Error('Failed to fetch'));
    render(<SensorHeatmap />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load heatmap data/i)).toBeInTheDocument();
    });
  });

  it('displays a message when no data is available for a date', async () => {
    (getDocs as jest.Mock)
      .mockResolvedValueOnce(mockSensorMetadata)
      // FIXED: Correctly mock an empty Firestore response
      .mockResolvedValueOnce({ forEach: () => {} });

    render(<SensorHeatmap />);

    await waitFor(() => {
      expect(screen.getByText(/No data found for the selected date/i)).toBeInTheDocument();
    });
  });

  it('refetches data when the date is changed', async () => {
    (getDocs as jest.Mock)
      .mockResolvedValueOnce(mockSensorMetadata)
      .mockResolvedValueOnce(mockSensorReadings);

    render(<SensorHeatmap />);

    await waitFor(() => {
        expect(screen.getByText('Yard Length (feet)')).toBeInTheDocument();
    });
    expect(getDocs).toHaveBeenCalledTimes(2);
    
    (getDocs as jest.Mock)
      .mockResolvedValueOnce(mockSensorMetadata)
      .mockResolvedValueOnce(mockSensorReadings);

    fireEvent.change(screen.getByLabelText(/Select Date/i), { target: { value: '2023-10-28' } });

    await waitFor(() => {
        expect(getDocs).toHaveBeenCalledTimes(4);
    });
  });
});