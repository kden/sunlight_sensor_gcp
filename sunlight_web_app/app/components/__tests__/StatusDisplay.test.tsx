import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatusDisplay from '../StatusDisplay';

describe('StatusDisplay Component', () => {
  it('should render the default loading message when loading', () => {
    render(<StatusDisplay loading={true} error={null} data={null} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render a custom loading message when provided', () => {
    const customMessage = 'Fetching data, please wait...';
    render(<StatusDisplay loading={true} error={null} data={null} loadingMessage={customMessage} />);
    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should render an error message when an error is provided', () => {
    const errorMessage = 'Failed to fetch data.';
    render(<StatusDisplay loading={false} error={errorMessage} data={null} />);
    const errorElement = screen.getByText(errorMessage);
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveClass('text-red-500');
  });

  it('should render the default no data message when data is null', () => {
    render(<StatusDisplay loading={false} error={null} data={null} />);
    expect(screen.getByText('No data available.')).toBeInTheDocument();
  });

  it('should render the default no data message when data is an empty array', () => {
    render(<StatusDisplay loading={false} error={null} data={[]} />);
    expect(screen.getByText('No data available.')).toBeInTheDocument();
  });

  it('should render a custom no data message when provided', () => {
    const customMessage = 'No results found for your query.';
    render(<StatusDisplay loading={false} error={null} data={[]} noDataMessage={customMessage} />);
    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.queryByText('No data available.')).not.toBeInTheDocument();
  });

  it('should render nothing when data is available', () => {
    const { container } = render(<StatusDisplay loading={false} error={null} data={[{ id: 1, name: 'Test' }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should show the loading message even if an error is present', () => {
    const errorMessage = 'An old error';
    render(<StatusDisplay loading={true} error={errorMessage} data={null} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
  });

  it('should show the error message even if data is empty', () => {
    const errorMessage = 'A critical error occurred.';
    render(<StatusDisplay loading={false} error={errorMessage} data={[]} />);
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.queryByText('No data available.')).not.toBeInTheDocument();
  });
});