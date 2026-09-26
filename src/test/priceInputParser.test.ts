import { describe, expect, it } from 'vitest';
import { parsePriceInput, formatPriceWithCommas, formatPriceInputWithCursor } from '@/utils/priceInputParser';

describe('parsePriceInput', () => {
  it('handles standard numbers and empty values', () => {
    expect(parsePriceInput(50000)).toEqual({ value: 50000, isValid: true });
    expect(parsePriceInput(0)).toEqual({ value: 0, isValid: true });
    expect(parsePriceInput('')).toEqual({ value: null, isValid: true });
    expect(parsePriceInput('   ')).toEqual({ value: null, isValid: true });
    expect(parsePriceInput(null)).toEqual({ value: null, isValid: true });
    expect(parsePriceInput(undefined)).toEqual({ value: null, isValid: true });
  });

  it('handles formatted numbers with commas and spaces', () => {
    expect(parsePriceInput('70,000')).toEqual({ value: 70000, isValid: true });
    expect(parsePriceInput('70،000')).toEqual({ value: 70000, isValid: true });
    expect(parsePriceInput('70٬000')).toEqual({ value: 70000, isValid: true });
    expect(parsePriceInput('50 000')).toEqual({ value: 50000, isValid: true });
    expect(parsePriceInput('1,000,000')).toEqual({ value: 1000000, isValid: true });
  });

  it('handles Arabic-Indic and Persian numerals', () => {
    expect(parsePriceInput('٧٠٠٠٠')).toEqual({ value: 70000, isValid: true });
    expect(parsePriceInput('٧٠،٠٠٠')).toEqual({ value: 70000, isValid: true });
    expect(parsePriceInput('٣٨٥٠٠')).toEqual({ value: 38500, isValid: true });
    expect(parsePriceInput('۳۸۵۰۰')).toEqual({ value: 38500, isValid: true });
  });

  it('handles dot thousand separators from Libyan locale', () => {
    expect(parsePriceInput('70.000')).toEqual({ value: 70000, isValid: true });
    expect(parsePriceInput('38.500')).toEqual({ value: 38500, isValid: true });
    expect(parsePriceInput('1.000.000')).toEqual({ value: 1000000, isValid: true });
  });

  it('handles currency notations gracefully', () => {
    expect(parsePriceInput('50000 د.ل')).toEqual({ value: 50000, isValid: true });
    expect(parsePriceInput('50000د.ل')).toEqual({ value: 50000, isValid: true });
    expect(parsePriceInput('50,000 دينار')).toEqual({ value: 50000, isValid: true });
    expect(parsePriceInput('50000 LYD')).toEqual({ value: 50000, isValid: true });
  });

  it('preserves valid decimals', () => {
    expect(parsePriceInput('15.5')).toEqual({ value: 15.5, isValid: true });
    expect(parsePriceInput('15.75')).toEqual({ value: 15.75, isValid: true });
    expect(parsePriceInput('15٫5')).toEqual({ value: 15.5, isValid: true });
  });

  it('rejects negative numbers and invalid text', () => {
    expect(parsePriceInput(-50)).toEqual({ value: null, isValid: false, error: 'أدخل سعراً صحيحاً غير سالب' });
    expect(parsePriceInput('-50')).toEqual({ value: null, isValid: false, error: 'أدخل سعراً صحيحاً غير سالب' });
    expect(parsePriceInput('−50')).toEqual({ value: null, isValid: false, error: 'أدخل سعراً صحيحاً غير سالب' });
    expect(parsePriceInput('abc')).toEqual({ value: null, isValid: false, error: 'أدخل سعراً صحيحاً غير سالب' });
    expect(parsePriceInput('50..000')).toEqual({ value: null, isValid: false, error: 'أدخل سعراً صحيحاً غير سالب' });
  });
});

describe('formatPriceWithCommas', () => {
  it('formats numbers with thousands commas', () => {
    expect(formatPriceWithCommas(50000)).toBe('50,000');
    expect(formatPriceWithCommas('70000')).toBe('70,000');
    expect(formatPriceWithCommas('38500')).toBe('38,500');
    expect(formatPriceWithCommas('1234567')).toBe('1,234,567');
    expect(formatPriceWithCommas('0')).toBe('0');
    expect(formatPriceWithCommas('')).toBe('');
    expect(formatPriceWithCommas(null)).toBe('');
  });

  it('formats Arabic-Indic numerals with thousands commas', () => {
    expect(formatPriceWithCommas('٥٠٠٠٠')).toBe('50,000');
    expect(formatPriceWithCommas('٣٨٥٠٠')).toBe('38,500');
  });

  it('preserves decimals in formatted numbers', () => {
    expect(formatPriceWithCommas('50000.5')).toBe('50,000.5');
    expect(formatPriceWithCommas('1500.25')).toBe('1,500.25');
  });
});

describe('formatPriceInputWithCursor', () => {
  it('preserves cursor at end of input when thousands commas are inserted', () => {
    // User types '1234' with cursor at 4 -> '1,234' with cursor at 5
    expect(formatPriceInputWithCursor('1234', 4)).toEqual({ formatted: '1,234', newCursor: 5 });
    // User types '12345' with cursor at 5 -> '12,345' with cursor at 6
    expect(formatPriceInputWithCursor('12345', 5)).toEqual({ formatted: '12,345', newCursor: 6 });
  });

  it('preserves cursor in middle of input during editing', () => {
    // User has '50,000' and edits digit at index 2
    expect(formatPriceInputWithCursor('510,000', 3)).toEqual({ formatted: '510,000', newCursor: 3 });
  });
});

