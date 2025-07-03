// sunlight_web_app/app/__tests__/page.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../page'; // Adjust the import path to your Home component

describe('Home Page', () => {
  // Store the original environment variable
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset the modules to ensure a fresh state for each test
    jest.resetModules();
    // Mock the environment variable for all tests in this describe block
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_USE_MOCK_DATA: 'true',
    };
  });

  afterEach(() => {
    // Restore the original environment variables after all tests in this block
    process.env = originalEnv;
  });
  /**
   * Test 1: A simple "smoke test" to ensure the component renders without errors
   * and that static elements like the main heading are present.
   */
  test('renders the main heading', () => {
    // Render the component in a virtual DOM
    render(<Home />);

    // Use `screen.getByRole` to find the main heading element.
    const heading = screen.getByRole('heading', {
      name: /sunlight sensor dashboard/i,
    });

    // Assert that the heading is in the document.
    expect(heading).toBeInTheDocument();
  });


  /**
   * Test 2: An asynchronous test to verify that our mock data is correctly
   * rendered in the table after the component's initial loading state.
   */
  test('loads and displays sensor data from mock source', async () => {
    render(<Home />);

    // Wait for the "Loading..." message to disappear
    await waitFor(() => {
      expect(screen.queryByText(/loading sensor data/i)).not.toBeInTheDocument();
    });

    // The component's useEffect will run, and since we removed the timer,
    // the state update will happen quickly. We use `findByText` which gracefully
    // waits for the element to appear.
    const firstSensorId = await screen.findByText('mock_sensor_1');

    // Once the first sensor ID is found, we know the data has loaded.
    expect(firstSensorId).toBeInTheDocument();

    // Now we can synchronously check for other data and states.
    // Use getAllByText since "esp32-mock" appears multiple times
    const boardElements = screen.getAllByText('esp32-mock');
    expect(boardElements.length).toBeGreaterThan(0);  });
});