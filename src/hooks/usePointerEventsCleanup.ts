/**
 * Workaround للتضارب الشائع بين Radix DropdownMenu/Dialog حيث يبقى
 * pointer-events: none مثبتاً على <body> ويتجمد الموقع.
 */
import { useEffect } from 'react';

export function cleanupBodyPointerEvents() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (body.style.pointerEvents === 'none') {
    body.style.removeProperty('pointer-events');
  }
  // أحياناً يبقى overflow:hidden معلقاً أيضاً
  if (body.style.overflow === 'hidden') {
    body.style.removeProperty('overflow');
  }
}

export function scheduleBodyPointerEventsCleanup() {
  cleanupBodyPointerEvents();
  setTimeout(cleanupBodyPointerEvents, 100);
  setTimeout(cleanupBodyPointerEvents, 300);
  setTimeout(cleanupBodyPointerEvents, 600);
}

/** Hook: ينظف pointer-events عند unmount لأي مكوّن. */
export function usePointerEventsCleanupOnUnmount() {
  useEffect(() => {
    return () => {
      scheduleBodyPointerEventsCleanup();
    };
  }, []);
}
