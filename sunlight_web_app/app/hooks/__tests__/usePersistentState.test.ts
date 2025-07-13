// /home/caden/code/sunlight_sensor_gcp/sunlight_web_app/app/hooks/__tests__/usePersistentState.test.ts

import { renderHook, act } from '@testing-library/react';
import usePersistentState from '../usePersistentState';

// We create a mock of the localStorage API for our Jest/JSDOM environment.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

// Assign the mock to the window object provided by JSDOM
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true, // Make it writable so we can change it in tests
});

describe('usePersistentState Hook (Browser Environment)', () => {
  const TEST_KEY = 'test-key';

  // Spies to track calls to localStorage
  let getItemSpy: jest.SpyInstance;
  let setItemSpy: jest.SpyInstance;

  // Before each test, clear the mock storage and reset spies
  beforeEach(() => {
    localStorageMock.clear();
    getItemSpy = jest.spyOn(window.localStorage, 'getItem');
    setItemSpy = jest.spyOn(window.localStorage, 'setItem');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return the default value if nothing is in localStorage', () => {
    const defaultValue = 'default-value';
    const { result } = renderHook(() => usePersistentState(TEST_KEY, defaultValue));

    expect(result.current[0]).toBe(defaultValue);
    expect(getItemSpy).toHaveBeenCalledWith(TEST_KEY);
  });

  it('should initialize with the value from localStorage if it exists', () => {
    const storedValue = { id: 1, name: 'Stored Item' };
    localStorageMock.setItem(TEST_KEY, JSON.stringify(storedValue));

    const { result } = renderHook(() => usePersistentState(TEST_KEY, {}));

    expect(result.current[0]).toEqual(storedValue);
    expect(getItemSpy).toHaveBeenCalledWith(TEST_KEY);
  });

  it('should update localStorage when the state changes', () => {
    const defaultValue = 'initial';
    const { result } = renderHook(() => usePersistentState(TEST_KEY, defaultValue));

    const newValue = 'updated';
    act(() => {
      const setState = result.current[1];
      setState(newValue);
    });

    expect(result.current[0]).toBe(newValue);
    expect(setItemSpy).toHaveBeenLastCalledWith(TEST_KEY, JSON.stringify(newValue));
  });

  it('should return the default value if localStorage contains malformed JSON', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    localStorageMock.setItem(TEST_KEY, 'not-a-valid-json-string');

    const defaultValue = { status: 'default' };
    const { result } = renderHook(() => usePersistentState(TEST_KEY, defaultValue));

    expect(result.current[0]).toEqual(defaultValue);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Error reading localStorage key “${TEST_KEY}”:`,
      expect.any(SyntaxError)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should handle an environment where localStorage is not available', () => {
    const originalLocalStorage = window.localStorage;
    // Simulate an environment where localStorage is disabled (e.g., private browsing)
    // This forces the hook's `try/catch` block to fire, which is the desired behavior.
    // Use @ts-expect-error as it's more descriptive and safer.
    // @ts-expect-error assigning to localStorage
    window.localStorage = undefined;

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { result } = renderHook(() => usePersistentState('no-storage-key', 'no-storage-value'));

      // The hook should not crash and should fall back to the default value.
      expect(result.current[0]).toBe('no-storage-value');
      // It should log the error from the `try/catch` block.
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error reading localStorage key “no-storage-key”:',
        expect.any(TypeError)
      );
    } finally {
      // Restore localStorage for other tests
      window.localStorage = originalLocalStorage;
      consoleErrorSpy.mockRestore();
    }
  });
});