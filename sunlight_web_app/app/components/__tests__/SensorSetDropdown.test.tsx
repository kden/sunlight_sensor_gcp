/*
 * SensorSetDropdown.test.tsx
 *
 * Unit tests for the SensorSetDropdown component.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SensorSetDropdown from '../SensorSetDropdown';
import { SensorSet } from '@/app/types/SensorSet';

describe('SensorSetDropdown Component', () => {
  // Mock data representing a list of sensor sets from the API
  const mockSensorSets: SensorSet[] = [
    { id: 'set-1', name: 'Garden Sensors', timezone: 'America/New_York' },
    { id: 'set-2', name: 'Rooftop Array', timezone: 'America/Chicago' },
    { id: 'set-3', name: 'Basement Lab', timezone: 'UTC' },
  ];

  // Create a mock function to simulate the onChange handler prop
  const mockOnChange = jest.fn();

  // Before each test, clear the mock function's call history
  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('should render the dropdown with options and select the correct initial value', () => {
    render(
      <SensorSetDropdown
        selectedSensorSet="set-1"
        sensorSets={mockSensorSets}
        onChange={mockOnChange}
      />
    );

    // Check that the dropdown (combobox role) is in the document
    const dropdown = screen.getByRole('combobox');
    expect(dropdown).toBeInTheDocument();

    // Check that all options are rendered
    expect(screen.getByRole('option', { name: 'Garden Sensors' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Rooftop Array' })).toBeInTheDocument();

    // Verify that the correct option is selected based on the `selectedSensorSet` prop
    expect(screen.getByRole<HTMLOptionElement>('option', { name: 'Garden Sensors' }).selected).toBe(true);
    expect(screen.getByRole<HTMLOptionElement>('option', { name: 'Rooftop Array' }).selected).toBe(false);
  });

  it('should call the onChange handler with the correct id and timezone when a new option is selected', async () => {
    const user = userEvent.setup();
    render(
      <SensorSetDropdown
        selectedSensorSet="set-1"
        sensorSets={mockSensorSets}
        onChange={mockOnChange}
      />
    );

    const dropdown = screen.getByRole('combobox');

    // Simulate the user selecting the "Rooftop Array" option
    await user.selectOptions(dropdown, 'set-2');

    // Assert that our mock handler was called exactly once
    expect(mockOnChange).toHaveBeenCalledTimes(1);

    // Assert that it was called with the correct ID and timezone for the selected set
    expect(mockOnChange).toHaveBeenCalledWith('set-2', 'America/Chicago');
  });

  it('should be disabled when the sensorSets array is empty', () => {
    render(
      <SensorSetDropdown
        selectedSensorSet=""
        sensorSets={[]} // Pass an empty array
        onChange={mockOnChange}
      />
    );

    // The dropdown should be disabled to prevent user interaction
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('should apply the id prop to the select element when provided', () => {
    const customId = 'my-custom-dropdown-id';
    render(
      <SensorSetDropdown
        id={customId}
        selectedSensorSet="set-1"
        sensorSets={mockSensorSets}
        onChange={mockOnChange}
      />
    );

    // Verify the element has the correct ID attribute
    expect(screen.getByRole('combobox')).toHaveAttribute('id', customId);
  });
});