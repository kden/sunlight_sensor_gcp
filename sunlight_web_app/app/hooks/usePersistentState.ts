/*
 * usePersistentState.ts
 *
 * Use local storage to save dropdown values.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function usePersistentState<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    // This function only runs on the initial render.
    // We check for `window` to prevent errors during server-side rendering with Next.js.
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const storedValue = window.localStorage.getItem(key);
      // If a value exists in storage, parse it. Otherwise, use the default.
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return defaultValue;
    }
  });

  // This effect runs whenever the state or key changes.
  useEffect(() => {
    try {
      // Save the current state to localStorage.
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, state]);

  return [state, setState];
}

export default usePersistentState;