import { describe, expect, it } from 'vitest';
import { formatCoordinateInput, parseCoordinateInput } from '../utils/coordinateInput';

describe('coordinate input', () => {
  it('retains the seven decimal places from the supplied example', () => {
    expect(parseCoordinateInput('32.8688117,13.2556506')).toEqual({ latitude: 32.8688117, longitude: 13.2556506 });
  });
  it('accepts and displays zeros', () => {
    expect(parseCoordinateInput('0,0')).toEqual({ latitude: 0, longitude: 0 });
    expect(formatCoordinateInput(0, 13.02)).toBe('0, 13.02');
  });
  it('rejects incomplete or invalid input instead of silently truncating it', () => {
    for (const input of ['0', '32.', '32,', '32,13foo', '91,0', '0,181', '1,2,3']) expect(parseCoordinateInput(input)).toBeNull();
  });
  it('accepts signed numbers and Arabic numerals', () => {
    expect(parseCoordinateInput('-0.05, +13.20')).toEqual({ latitude: -0.05, longitude: 13.2 });
    expect(parseCoordinateInput('٣٢٫٨٦٨٨١١٧،١٣٫٢٥٥٦٥٠٦')).toEqual({ latitude: 32.8688117, longitude: 13.2556506 });
  });
  it('allows clearing optional coordinates', () => {
    expect(parseCoordinateInput('')).toEqual({ latitude: null, longitude: null });
    expect(formatCoordinateInput(null, null)).toBe('');
  });
});
