// /app/components/__tests__/Toolbar.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react'; // Import fireEvent
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Toolbar from '../Toolbar';
import { SensorSet } from '@/app/types/SensorSet';

describe('Toolbar Component', () => {
  // --- Mock Data and Functions ---
  const mockSensorSets: SensorSet[] = [
    { id: 'set-1', name: 'Garden Sensors', timezone: 'America/New_York' },
    { id: 'set-2', name: 'Rooftop Array', timezone: 'America/Chicago' },
  ];

  const mockOnDateChange = jest.fn();
  const mockOnSensorSetChange = jest.fn();

  // A helper function to render the component with default props
  const renderToolbar = (props = {}) => {
    const defaultProps = {
      selectedDate: '2024-01-15',
      onDateChange: mockOnDateChange,
      selectedSensorSet: 'set-1',
      onSensorSetChange: mockOnSensorSetChange,
      sensorSets: mockSensorSets,
      sensorSetsLoading: false,
      sensorSetsError: null,
      timezone: 'America/New_York',
    };
    return render(<Toolbar {...defaultProps} {...props} />);
  };

  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Test Cases ---

  it('should render all elements correctly in the default state', () => {
    renderToolbar();

    // Check for the date picker and its value
    expect(screen.getByLabelText('Select Date:')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Date:')).toHaveValue('2024-01-15');

    // Check for the sensor set dropdown
    expect(screen.getByLabelText('Sensor Set:')).toBeInTheDocument();
    const dropdown = screen.getByRole('combobox', { name: 'Sensor Set:' });
    expect(dropdown).toBeInTheDocument();
    // Check that the correct option is selected
    expect(screen.getByRole<HTMLOptionElement>('option', { name: 'Garden Sensors' }).selected).toBe(true);

    // Check for the timezone display
    expect(screen.getByText('Timezone: America/New_York')).toBeInTheDocument();

    // Ensure loading/error states are not shown
    expect(screen.queryByText('Loading sets...')).not.toBeInTheDocument();
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it('should call onDateChange when the date is changed', async () => {
    renderToolbar();
    const datePicker = screen.getByLabelText('Select Date:');

    // Use fireEvent.change for date inputs for better reliability
    fireEvent.change(datePicker, { target: { value: '2024-02-20' } });

    expect(mockOnDateChange).toHaveBeenCalledWith('2024-02-20');
  });

  it('should call onSensorSetChange when a new sensor set is selected', async () => {
    const user = userEvent.setup();
    renderToolbar();

    const dropdown = screen.getByLabelText('Sensor Set:');
    await user.selectOptions(dropdown, 'set-2');

    expect(mockOnSensorSetChange).toHaveBeenCalledTimes(1);
    expect(mockOnSensorSetChange).toHaveBeenCalledWith('set-2', 'America/Chicago');
  });

  it('should display a loading message when sensor sets are loading', () => {
    renderToolbar({ sensorSetsLoading: true, sensorSets: [] });

    expect(screen.getByText('Loading sets...')).toBeInTheDocument();
    // The dropdown should not be rendered while loading
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('should display an error message when there is an error fetching sensor sets', () => {
    const errorMessage = 'Failed to connect.';
    renderToolbar({ sensorSetsError: errorMessage, sensorSets: [] });

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toHaveClass('text-red-500');
    // The dropdown should not be rendered on error
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('should not render the dropdown if there are no sensor sets, loading, or errors', () => {
    renderToolbar({ sensorSets: [] });

    // Use getByText to find the label text without needing the associated control.
    expect(screen.getByText('Sensor Set:')).toBeInTheDocument();

    // The dropdown, loading, and error states are not present
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading sets...')).not.toBeInTheDocument();
  });
});