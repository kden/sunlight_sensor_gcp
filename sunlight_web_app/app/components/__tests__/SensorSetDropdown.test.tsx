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
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SensorSetDropdown from '../SensorSetDropdown';
import { SensorSet } from '@/app/types/SensorSet';

const mockSensorSets: SensorSet[] = [
  { id: 'set-1', name: 'Set 1', timezone: 'UTC', latitude: null, longitude: null },
  { id: 'set-2', name: 'Set 2', timezone: 'America/Chicago', latitude: 41.878, longitude: -87.629 },
];

describe('SensorSetDropdown Component', () => {
  it('should render the correct number of options', () => {
    render(
      <SensorSetDropdown
        sensorSets={mockSensorSets}
        selectedSensorSet="set-1"
        onChange={jest.fn()}
      />
    );
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(mockSensorSets.length);
  });

  it('should call the onChange handler with the correct id, timezone, and location when a new option is selected', () => {
    const mockOnChange = jest.fn();
    render(
      <SensorSetDropdown
        sensorSets={mockSensorSets}
        selectedSensorSet="set-1"
        onChange={mockOnChange}
      />
    );

    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'set-2' } });

    // FIX: Update the assertion to expect all four arguments.
    expect(mockOnChange).toHaveBeenCalledWith('set-2', 'America/Chicago', 41.878, -87.629);
  });

  it('should be disabled when the sensorSets array is empty', () => {
    render(
      <SensorSetDropdown
        sensorSets={[]}
        selectedSensorSet=""
        onChange={jest.fn()}
      />
    );
    const dropdown = screen.getByRole('combobox');
    expect(dropdown).toBeDisabled();
  });

  it('should display the correct selected option', () => {
    render(
      <SensorSetDropdown
        sensorSets={mockSensorSets}
        selectedSensorSet="set-2"
        onChange={jest.fn()}
      />
    );
    const dropdown = screen.getByRole('combobox') as HTMLSelectElement;
    expect(dropdown.value).toBe('set-2');
  });
});