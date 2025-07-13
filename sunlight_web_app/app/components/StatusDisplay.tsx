/*
 * StatusDisplay.tsx
 *
 * Renders status and error messages for the end user.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import React from 'react';

// By using a generic <T>, this component can accept an array of any type
// without losing type information.
interface StatusDisplayProps<T> {
  loading: boolean;
  error: string | null;
  /** The data array to check for content. */
  data: T[] | null;
  loadingMessage?: string;
  noDataMessage?: string;
}

// The component function is now also generic.
function StatusDisplay<T>({
  loading,
  error,
  data,
  loadingMessage = "Loading...",
  noDataMessage = "No data available."
}: StatusDisplayProps<T>) {
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
}

export default StatusDisplay;