/*
 * Toolbar.test.tsx
 *
 * Unit tests for the toolbar component.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Toolbar from '../Toolbar';
import { SensorSet } from '@/app/types/SensorSet';

describe('Toolbar Component', () => {
  // --- Mock Data and Functions ---
  const mockSensorSets: SensorSet[] = [
    { id: 'set-1', name: 'Garden Sensors', timezone: 'America/New_York', latitude: 40.7128, longitude: -74.0060 },
    { id: 'set-2', name: 'Rooftop Array', timezone: 'America/Chicago', latitude: 41.8781, longitude: -87.6298 },
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
      latitude: 40.7128,
      longitude: -74.0060,
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
    fireEvent.change(datePicker, { target: { value: '2024-02-20' } });
    expect(mockOnDateChange).toHaveBeenCalledWith('2024-02-20');
  });

  it('should call onSensorSetChange when a new sensor set is selected', async () => {
    const user = userEvent.setup();
    renderToolbar();

    const dropdown = screen.getByLabelText('Sensor Set:');
    await user.selectOptions(dropdown, 'set-2');

    expect(mockOnSensorSetChange).toHaveBeenCalledTimes(1);
    expect(mockOnSensorSetChange).toHaveBeenCalledWith('set-2', 'America/Chicago', 41.8781, -87.6298);
  });

  it('should display latitude and longitude when provided', () => {
    renderToolbar({ latitude: 40.7128, longitude: -74.0060 });
    expect(screen.getByText('Lat: 40.713, Lon: -74.006')).toBeInTheDocument();
  });

  it('should not display latitude and longitude when they are null', () => {
    renderToolbar({ latitude: null, longitude: null });
    expect(screen.queryByText(/Lat:/)).not.toBeInTheDocument();
  });

  it('should display a loading message when sensor sets are loading', () => {
    renderToolbar({ sensorSetsLoading: true, sensorSets: [] });
    expect(screen.getByText('Loading sets...')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('should display an error message when there is an error fetching sensor sets', () => {
    const errorMessage = 'Failed to connect.';
    renderToolbar({ sensorSetsError: errorMessage, sensorSets: [] });
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toHaveClass('text-red-500');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('should not render the dropdown if there are no sensor sets, loading, or errors', () => {
    renderToolbar({ sensorSets: [] });
    expect(screen.getByText('Sensor Set:')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading sets...')).not.toBeInTheDocument();
  });
});