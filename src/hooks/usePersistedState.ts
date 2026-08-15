import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';

/**
 * Drop-in replacement for `useState` that persists the value to sessionStorage.
 * Useful for search bars, filters, current page numbers, etc. so the user's
 * input survives navigation within the same tab.
 *
 * Usage:
 *   const [search, setSearch] = usePersistedState('contracts.search', '');
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `pstate_${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {}
    return defaultValue;
  });

  // Avoid writing on first render (already loaded)
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  }, [storageKey, value]);

  return [value, setValue];
}
