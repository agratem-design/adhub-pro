import { describe, it, expect } from 'vitest';
import {
  normalizeArabic,
  normalizeSize,
  displaySize,
  formatFacesCountArabic,
  formatGregorianDate,
  queryTokens,
} from '@/lib/utils';

describe('src/lib/utils.ts', () => {
  describe('normalizeArabic', () => {
    it('should normalize alef variants and remove diacritics', () => {
      expect(normalizeArabic('أَحْمَد')).toBe('احمد');
      expect(normalizeArabic('إبراهيم')).toBe('ابراهيم');
      expect(normalizeArabic('آمال')).toBe('امال');
    });

    it('should normalize taa marbuta and yaa variants', () => {
      expect(normalizeArabic('مؤسسة')).toBe('مؤسسه');
      expect(normalizeArabic('علي')).toBe('علي');
      expect(normalizeArabic('مستشفى')).toBe('مستشفي');
    });

    it('should convert Arabic-Indic digits to Latin digits', () => {
      expect(normalizeArabic('عقد رقم ١٢٣٤٥')).toBe('عقد رقم 12345');
    });
  });

  describe('normalizeSize & displaySize', () => {
    it('should normalize size putting smaller dimension first for DB storage', () => {
      expect(normalizeSize('10x4')).toBe('4x10');
      expect(normalizeSize('3X8-T')).toBe('3x8-T');
      expect(normalizeSize('2.5X4')).toBe('2.5x4');
    });

    it('should format size putting larger dimension first for display', () => {
      expect(displaySize('4x10')).toBe('10x4');
      expect(displaySize('3x8-T')).toBe('8x3-T');
    });

    it('should handle non-dimension string names gracefully', () => {
      expect(normalizeSize('سوسيت')).toBe('سوسيت');
      expect(displaySize('سوسيت')).toBe('سوسيت');
    });
  });

  describe('formatFacesCountArabic', () => {
    it('should format Arabic face counts grammatically', () => {
      expect(formatFacesCountArabic(1)).toBe('وجه واحد');
      expect(formatFacesCountArabic(2)).toBe('وجهين');
      expect(formatFacesCountArabic(3)).toBe('ثلاثة أوجه');
      expect(formatFacesCountArabic(4)).toBe('أربعة أوجه');
      expect(formatFacesCountArabic(12)).toBe('12 أوجه');
    });
  });

  describe('formatGregorianDate', () => {
    it('should format date strings to DD/MM/YYYY', () => {
      expect(formatGregorianDate('2025-05-15')).toBe('15/05/2025');
      expect(formatGregorianDate('2025/12/01')).toBe('01/12/2025');
    });
  });

  describe('queryTokens', () => {
    it('should split search query into normalized tokens', () => {
      const tokens = queryTokens('طريق الشط لوحة ١٢');
      expect(tokens).toEqual(['طريق', 'الشط', 'لوحه', '12']);
    });
  });
});
