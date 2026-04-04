'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook for debouncing values
 * Returns a debounced version of the provided value that only updates
 * after the specified delay has elapsed since the last change
 *
 * Useful for search/filter inputs to avoid excessive re-renders
 * and service calls while the user is still typing
 *
 * Implements debounce pattern for DMInboxService search (SCRUM-6529)
 *
 * @param {*} value - The value to debounce
 * @param {number} [delay=300] - Debounce delay in milliseconds
 * @returns {*} The debounced value
 *
 * @example
 * const [query, setQuery] = useState('');
 * const debouncedQuery = useDebounce(query, 300);
 *
 * useEffect(() => {
 *   if (debouncedQuery) {
 *     searchDMs(debouncedQuery);
 *   }
 * }, [debouncedQuery]);
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Clamp delay to a minimum of 0
    const clampedDelay = Math.max(0, delay);

    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, clampedDelay);

    // Cleanup: cancel the timeout if value or delay changes before it fires
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;