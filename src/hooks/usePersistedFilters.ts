import { useState, useEffect, useCallback, useRef } from 'react';

interface FilterState {
  [key: string]: any;
}

/**
 * Hook to persist filter/search/page state in sessionStorage.
 * When a user navigates away (e.g. opens task detail) and returns,
 * their filters and scroll position are restored.
 */
export function usePersistedFilters<T extends FilterState>(
  storageKey: string,
  defaults: T
): {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  resetFilters: () => void;
} {
  const [filters, setFilters] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(`filters_${storageKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaults, ...parsed };
      }
    } catch {}
    return defaults;
  });

  // Save to sessionStorage on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(`filters_${storageKey}`, JSON.stringify(filters));
    } catch {}
  }, [filters, storageKey]);

  // Save scroll position on unmount, restore on mount
  const scrollRestoredRef = useRef(false);
  
  useEffect(() => {
    // Restore scroll position
    if (!scrollRestoredRef.current) {
      scrollRestoredRef.current = true;
      const savedScroll = sessionStorage.getItem(`scroll_${storageKey}`);
      if (savedScroll) {
        const scrollY = parseInt(savedScroll, 10);
        // Delay to let content render
        requestAnimationFrame(() => {
          setTimeout(() => window.scrollTo(0, scrollY), 100);
        });
      }
    }

    // Save scroll position periodically and on unmount
    const saveScroll = () => {
      sessionStorage.setItem(`scroll_${storageKey}`, String(window.scrollY));
    };

    // Throttled scroll save
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          saveScroll();
          ticking = false;
        });
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      saveScroll();
    };
  }, [storageKey]);

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaults);
    sessionStorage.removeItem(`filters_${storageKey}`);
    sessionStorage.removeItem(`scroll_${storageKey}`);
  }, [defaults, storageKey]);

  return { filters, setFilter, resetFilters };
}
