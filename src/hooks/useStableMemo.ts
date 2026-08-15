import { useRef } from 'react';

/**
 * Shallow compare for arrays, objects, Maps, and Sets.
 * Returns true when contents are structurally equal at one level.
 */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  // Map
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k)) return false;
      const bv = b.get(k);
      if (v === bv) continue;
      if (typeof v === 'object' && typeof bv === 'object') {
        if (!shallowEqual(v, bv)) return false;
      } else {
        return false;
      }
    }
    return true;
  }

  // Set
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  // Array
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i] as any;
      const y = b[i] as any;
      if (x === y) continue;
      if (typeof x === 'object' && typeof y === 'object' && x && y) {
        if (!shallowEqual(x, y)) return false;
      } else {
        return false;
      }
    }
    return true;
  }

  // Plain object (one level deep)
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if ((a as any)[k] !== (b as any)[k]) return false;
  }
  return true;
}

/**
 * Returns the previous reference when the new value is structurally equal
 * (shallow). Use to prevent identity-only re-renders for memoized values
 * that get rebuilt every render (arrays/maps/objects from `useMemo`).
 */
export function useStableReference<T>(value: T): T {
  const ref = useRef<T>(value);
  if (!shallowEqual(ref.current as unknown, value as unknown)) {
    ref.current = value;
  }
  return ref.current;
}

export { shallowEqual };