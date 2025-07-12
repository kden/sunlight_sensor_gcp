// /app/components/StatusDisplay.tsx

import React from 'react';

interface StatusDisplayProps {
  loading: boolean;
  error: string | null;
  /** The data array to check for content. */
  data: any[] | null;
  loadingMessage?: string;
  noDataMessage?: string;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({
  loading,
  error,
  data,
  loadingMessage = "Loading...",
  noDataMessage = "No data available."
}) => {
  if (loading) {
    return <p className="text-center mt-4">{loadingMessage}</p>;
  }

  if (error) {
    return <p className="text-red-500 text-center mt-4">{error}</p>;
  }

  // Check for data *after* loading and error states
  if (!data || data.length === 0) {
    return <p className="text-center mt-4">{noDataMessage}</p>;
  }

  // If none of the above conditions are met, render nothing.
  return null;
};

export default StatusDisplay;
