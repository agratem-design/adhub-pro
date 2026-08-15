import { describe, it, expect } from 'vitest';
import { parseCoords } from '@/utils/parseCoords';

describe('parseCoords', () => {
  it('should parse decimal comma-separated strings', () => {
    const res = parseCoords({ GPS_Coordinates: '32.8872, 13.1891' });
    expect(res).not.toBeNull();
    expect(res?.lat).toBeCloseTo(32.8872, 4);
    expect(res?.lng).toBeCloseTo(13.1891, 4);
  });

  it('should parse lat/lng coordinate objects', () => {
    const res = parseCoords({ coordinates: { lat: 32.5, lng: 13.2 } });
    expect(res).toEqual({ lat: 32.5, lng: 13.2 });
  });

  it('should parse DMS format strings correctly', () => {
    const res = parseCoords({ GPS_Coordinates: '32°54\'01.3"N 13°12\'22.3"E' });
    expect(res).not.toBeNull();
    expect(res?.lat).toBeGreaterThan(32.8);
    expect(res?.lng).toBeGreaterThan(13.1);
  });

  it('should return null for invalid or empty inputs', () => {
    expect(parseCoords(null)).toBeNull();
    expect(parseCoords({})).toBeNull();
    expect(parseCoords({ GPS_Coordinates: '0' })).toBeNull();
    expect(parseCoords({ GPS_Coordinates: 'invalid text' })).toBeNull();
  });
});
