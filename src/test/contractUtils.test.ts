import { describe, it, expect } from 'vitest';
import {
  isContractExpired,
  isContractActive,
  getDaysUntilExpiry,
  isBillboardAvailable,
  isBillboardBlockedFromAvailability,
  generateMunicipalityCode,
} from '@/utils/contractUtils';

describe('contractUtils', () => {
  describe('isContractExpired & isContractActive', () => {
    it('should return true for past dates in isContractExpired', () => {
      expect(isContractExpired('2020-01-01')).toBe(true);
    });

    it('should return false for future dates in isContractExpired', () => {
      expect(isContractExpired('2099-12-31')).toBe(false);
    });

    it('should return false for null date', () => {
      expect(isContractExpired(null)).toBe(false);
    });

    it('should correctly calculate active contract spanning today', () => {
      expect(isContractActive('2020-01-01', '2099-12-31')).toBe(true);
      expect(isContractActive('2090-01-01', '2099-12-31')).toBe(false);
    });
  });

  describe('getDaysUntilExpiry', () => {
    it('should return null for empty date', () => {
      expect(getDaysUntilExpiry(null)).toBeNull();
    });

    it('should return negative days for past dates', () => {
      const days = getDaysUntilExpiry('2020-01-01');
      expect(days).not.toBeNull();
      expect(days!).toBeLessThan(0);
    });
  });

  describe('isBillboardAvailable & isBillboardBlockedFromAvailability', () => {
    it('should mark removed or maintenance-removed billboards as blocked', () => {
      expect(isBillboardBlockedFromAvailability({ Status: 'إزالة' })).toBe(true);
      expect(isBillboardBlockedFromAvailability({ maintenance_status: 'تمت الإزالة' })).toBe(true);
      expect(isBillboardBlockedFromAvailability({ Status: 'متاح' })).toBe(false);
    });

    it('should return true for available billboard with no contract', () => {
      expect(isBillboardAvailable({ Status: 'متاح' })).toBe(true);
    });

    it('should return false for billboard with active contract', () => {
      const billboard = {
        Status: 'متاح',
        Contract_Number: 501,
        Rent_End_Date: '2099-12-31'
      };
      expect(isBillboardAvailable(billboard)).toBe(false);
    });

    it('should return true for rented billboard whose contract expired', () => {
      const billboard = {
        Status: 'مؤجر',
        Contract_Number: 502,
        Rent_End_Date: '2020-01-01'
      };
      expect(isBillboardAvailable(billboard)).toBe(true);
    });
  });

  describe('generateMunicipalityCode', () => {
    it('should generate consistent uppercase 3-letter romanized code for Arabic municipality names', () => {
      expect(generateMunicipalityCode('طرابلس')).toBe('TRA');
      expect(generateMunicipalityCode('بنغازي')).toBe('BNG');
      expect(generateMunicipalityCode('مصراتة')).toBe('MSR');
    });
  });
});
