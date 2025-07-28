/*
 * ErrorBoundary.tsx
 *
 * Be more defensive towards errors, even if they are caused by your browser extensions.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorSource?: string;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can log the error to an error reporting service here
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Defensively check if the error is from a browser extension
    if (error.stack && error.stack.includes("chrome-extension://")) {
      console.warn("The error appears to originate from a browser extension. The UI will attempt to recover.");
      // For extension errors, we can choose to not show a scary fallback UI
      // and just let the app continue, since the error is external.
      // To do this, we could reset the state, but for now, we'll treat all errors the same.
    }
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg text-center">
          <h2 className="text-xl font-bold text-red-400">Something went wrong.</h2>
          <p className="mt-2">An unexpected error occurred. Please try refreshing the page.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;