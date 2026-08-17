import { useState, useEffect, useCallback } from 'react';

// In-memory listeners for cross-component sync without reloading
const listeners: Record<string, Set<(value: any) => void>> = {};

export function useSessionState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Read from sessionStorage on mount
  const [state, setState] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      if (item !== null) {
        return JSON.parse(item);
      }
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error);
    }
    return initialValue;
  });

  useEffect(() => {
    if (!listeners[key]) {
      listeners[key] = new Set();
    }
    listeners[key].add(setState);

    return () => {
      listeners[key].delete(setState);
    };
  }, [key]);

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback((value) => {
    setState((prevState) => {
      const valueToStore = value instanceof Function ? (value as (val: T) => T)(prevState) : value;
      
      try {
        window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.warn(`Error setting sessionStorage key "${key}":`, error);
      }

      // Notify all listeners
      if (listeners[key]) {
        listeners[key].forEach(listener => {
          if (listener !== setState) {
            listener(valueToStore);
          }
        });
      }

      return valueToStore;
    });
  }, [key]);

  return [state, setValue];
}
