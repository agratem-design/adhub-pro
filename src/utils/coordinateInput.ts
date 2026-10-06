export function parseCoordinateInput(value: string): { latitude: number | null; longitude: number | null } | null {
  const normalized = value.trim().replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/٫/g, '.').replace(/،/g, ',');
  if (!normalized) return { latitude: null, longitude: null };
  const parts = normalized.split(',').map(part => part.trim());
  if (parts.length !== 2 || parts.some(part => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(part))) return null;
  const [latitude, longitude] = parts.map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function formatCoordinateInput(latitude?: number | null, longitude?: number | null): string {
  return latitude != null && longitude != null ? `${latitude}, ${longitude}` : '';
}

/** Short display only; keep original coordinates in map links and stored data. */
export function formatPrintCoordinates(latitude?: number | null, longitude?: number | null): string {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  return `${Number(latitude.toFixed(6))}, ${Number(longitude.toFixed(6))}`;
}
