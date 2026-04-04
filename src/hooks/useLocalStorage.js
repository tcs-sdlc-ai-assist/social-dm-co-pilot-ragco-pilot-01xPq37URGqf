'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { encrypt, decrypt } from '@/utils/encryption';

/**
 * Custom hook for localStorage with automatic encryption/decryption
 * Provides a useState-like API backed by encrypted localStorage persistence
 *
 * Implements encrypted localStorage pattern for SCRUM-6542
 *
 * Values are encrypted before storage and decrypted on retrieval using
 * the application's AES-GCM encryption utility (Web Crypto API + PBKDF2)
 *
 * Handles:
 * - Automatic encryption on write
 * - Automatic decryption on read
 * - Graceful fallback to initialValue on decryption failure
 * - SSR safety (no localStorage access during server rendering)
 * - Cross-tab synchronization via storage events
 * - JSON serialization/deserialization for non-string values
 *
 * @param {string} key - localStorage key
 * @param {*} initialValue - Default value if key is not found or decryption fails
 * @returns {[*, Function]} Tuple of [currentValue, setValue]
 *
 * @example
 * const [preferences, setPreferences] = useLocalStorage('sdmc_user_prefs', { theme: 'light' });
 *
 * // Update value (automatically encrypted and persisted)
 * setPreferences({ theme: 'dark' });
 *
 * // Functional update
 * setPreferences((prev) => ({ ...prev, fontSize: 14 }));
 */
export function useLocalStorage(key, initialValue) {
  const initialValueRef = useRef(initialValue);

  // Track whether we've completed the initial load from localStorage
  const [isLoaded, setIsLoaded] = useState(false);

  // State holds the current decrypted value
  const [storedValue, setStoredValue] = useState(initialValue);

  // Ref to track mounted state for async operations
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Load and decrypt the value from localStorage on mount
   * Runs once per key change
   */
  useEffect(() => {
    let cancelled = false;

    async function loadStoredValue() {
      // SSR safety check
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        if (!cancelled && mountedRef.current) {
          setIsLoaded(true);
        }
        return;
      }

      try {
        const item = localStorage.getItem(key);

        if (item === null || item === undefined) {
          if (!cancelled && mountedRef.current) {
            setStoredValue(initialValueRef.current);
            setIsLoaded(true);
          }
          return;
        }

        // Attempt to decrypt the stored value
        const decrypted = await decrypt(item);

        // Attempt to parse as JSON; fall back to raw string
        let parsed;
        try {
          parsed = JSON.parse(decrypted);
        } catch {
          parsed = decrypted;
        }

        if (!cancelled && mountedRef.current) {
          setStoredValue(parsed);
          setIsLoaded(true);
        }
      } catch {
        // Decryption or parsing failed — use initial value and clear corrupted data
        console.warn(`[useLocalStorage] Failed to load/decrypt key "${key}", using initial value`);
        try {
          localStorage.removeItem(key);
        } catch {
          // localStorage may be unavailable
        }

        if (!cancelled && mountedRef.current) {
          setStoredValue(initialValueRef.current);
          setIsLoaded(true);
        }
      }
    }

    loadStoredValue();

    return () => {
      cancelled = true;
    };
  }, [key]);

  /**
   * Sets a new value, encrypts it, and persists to localStorage
   * Supports both direct values and functional updates (like useState)
   *
   * @param {*|Function} value - New value or updater function
   */
  const setValue = useCallback(
    async (value) => {
      try {
        // Support functional updates like useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;

        // Update React state immediately
        if (mountedRef.current) {
          setStoredValue(valueToStore);
        }

        // SSR safety check
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
          return;
        }

        // Handle null/undefined — remove the key
        if (valueToStore === null || valueToStore === undefined) {
          try {
            localStorage.removeItem(key);
          } catch {
            // localStorage may be unavailable
          }
          return;
        }

        // Serialize the value
        const serialized = typeof valueToStore === 'string'
          ? valueToStore
          : JSON.stringify(valueToStore);

        // Encrypt and persist
        const encrypted = await encrypt(serialized);
        localStorage.setItem(key, encrypted);
      } catch {
        console.warn(`[useLocalStorage] Failed to encrypt/persist key "${key}"`);
      }
    },
    [key, storedValue]
  );

  /**
   * Listen for storage events from other tabs/windows
   * Synchronizes state when the same key is modified in another tab
   */
  useEffect(() => {
    // SSR safety check
    if (typeof window === 'undefined') return;

    async function handleStorageChange(event) {
      if (event.key !== key) return;

      if (!mountedRef.current) return;

      // Key was removed in another tab
      if (event.newValue === null) {
        setStoredValue(initialValueRef.current);
        return;
      }

      // Attempt to decrypt the new value from the other tab
      try {
        const decrypted = await decrypt(event.newValue);

        let parsed;
        try {
          parsed = JSON.parse(decrypted);
        } catch {
          parsed = decrypted;
        }

        if (mountedRef.current) {
          setStoredValue(parsed);
        }
      } catch {
        console.warn(`[useLocalStorage] Failed to decrypt cross-tab update for key "${key}"`);
      }
    }

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  return [storedValue, setValue];
}

export default useLocalStorage;