import { describe, it, expect } from 'vitest';
import {
  filterTaskContractIdsByCustomer,
  normalizeContractId,
  resolveTaskContractAdTypes,
} from '@/lib/compositeTaskContractIdentity';

describe('Composite Tasks - normalizeContractId and Ad Type Logic', () => {
  describe('normalizeContractId', () => {
    it('should normalize numeric contract ID to positive integer', () => {
      expect(normalizeContractId(1289)).toBe(1289);
      expect(normalizeContractId(1)).toBe(1);
    });

    it('should normalize string contract ID to positive integer', () => {
      expect(normalizeContractId('1289')).toBe(1289);
      expect(normalizeContractId('001289')).toBe(1289);
      expect(normalizeContractId('  500  ')).toBe(500);
    });

    it('should return null for invalid, zero, negative or empty inputs', () => {
      expect(normalizeContractId(null)).toBeNull();
      expect(normalizeContractId(undefined)).toBeNull();
      expect(normalizeContractId('')).toBeNull();
      expect(normalizeContractId('   ')).toBeNull();
      expect(normalizeContractId(0)).toBeNull();
      expect(normalizeContractId('0')).toBeNull();
      expect(normalizeContractId(-5)).toBeNull();
      expect(normalizeContractId('abc')).toBeNull();
    });
  });

  describe('Contract ownership filtering', () => {
    it('removes unrelated contract numbers while retaining legitimate contracts for the same customer', () => {
      const contractIds = filterTaskContractIdsByCustomer({
        candidateContractIds: [1254, 1255, 1279, 1115, 1296, 1261, 1100],
        directContractId: 1254,
        taskCustomerId: 'customer-ali',
        taskCustomerName: 'علي عمار',
        contracts: [
          { contractNumber: 1254, customerId: 'customer-ali', customerName: 'علي عمار' },
          { contractNumber: 1255, customerId: 'customer-ali', customerName: 'علي عمار' },
          { contractNumber: 1279, customerId: 'customer-other-1', customerName: 'عميل آخر' },
          { contractNumber: 1115, customerId: 'customer-other-2', customerName: 'عميل مختلف' },
          { contractNumber: 1296, customerId: 'customer-other-3', customerName: 'شركة أخرى' },
          { contractNumber: 1261, customerId: 'customer-other-4', customerName: 'زبون آخر' },
          { contractNumber: 1100, customerId: 'customer-other-5', customerName: 'عميل خامس' },
        ],
      });

      expect(contractIds).toEqual([1254, 1255]);
    });
  });

  describe('Ad Type Deduplication and Resolution', () => {
    it('does not leak the ad type of another customer through a shared billboard', () => {
      const adTypes = resolveTaskContractAdTypes({
        candidateContractIds: [1228, 1185],
        directContractId: 1228,
        taskCustomerId: 'customer-ali',
        taskCustomerName: 'علي عمار',
        contracts: [
          {
            contractNumber: 1228,
            adType: 'أسعد لإستيراد الشاحنات والمعدات الثقيلة',
            customerId: 'customer-ali',
            customerName: 'علي عمار',
          },
          {
            contractNumber: 1185,
            adType: 'جوتن',
            customerId: 'customer-mohamed',
            customerName: 'محمد علي الحولة',
          },
        ],
      });

      expect(adTypes).toEqual(['أسعد لإستيراد الشاحنات والمعدات الثقيلة']);
      expect(adTypes).not.toContain('جوتن');
    });

    it('falls back to normalized customer names for legacy contracts without customer ids', () => {
      const adTypes = resolveTaskContractAdTypes({
        candidateContractIds: [1228, 1185],
        directContractId: 1228,
        taskCustomerName: 'علي  عمار',
        contracts: [
          { contractNumber: 1228, adType: 'أسعد', customerName: 'علي عمار' },
          { contractNumber: 1185, adType: 'جوتن', customerName: 'محمد علي الحولة' },
        ],
      });

      expect(adTypes).toEqual(['أسعد']);
    });

    it('should deduplicate identical ad types across multiple contracts', () => {
      const contractAdTypes = ['إعلان تجاري', 'إعلان تجاري'];
      const unique = Array.from(new Set(contractAdTypes.filter(Boolean)));
      expect(unique).toEqual(['إعلان تجاري']);
      expect(unique.join(' / ')).toBe('إعلان تجاري');
    });

    it('should join different ad types across multiple contracts', () => {
      const contractAdTypes = ['إعلان تجاري', 'إعلان خيري', 'إعلان تجاري'];
      const unique = Array.from(new Set(contractAdTypes.filter(Boolean)));
      expect(unique).toEqual(['إعلان تجاري', 'إعلان خيري']);
      expect(unique.join(' / ')).toBe('إعلان تجاري / إعلان خيري');
    });

    it('should filter out empty or invalid ad types', () => {
      const contractAdTypes = ['إعلان تجاري', '', 'غير محدد', 'null', undefined];
      const valid = Array.from(
        new Set(
          contractAdTypes
            .filter((a): a is string => Boolean(a && a.trim() !== '' && a !== 'غير محدد' && a !== 'null'))
        )
      );
      expect(valid).toEqual(['إعلان تجاري']);
    });
  });

  describe('Financial Calculations and Edge Cases', () => {
    it('should compute net profit and profit margin correctly', () => {
      const customerTotal = 1500;
      const companyTotal = 1000;
      const netProfit = customerTotal - companyTotal;
      const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

      expect(netProfit).toBe(500);
      expect(profitPercentage).toBeCloseTo(33.33, 1);
    });

    it('should avoid NaN or Infinity when customerTotal is 0', () => {
      const customerTotal = 0;
      const companyTotal = 200;
      const netProfit = customerTotal - companyTotal;
      const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

      expect(netProfit).toBe(-200);
      expect(profitPercentage).toBe(0);
      expect(Number.isFinite(profitPercentage)).toBe(true);
    });

    it('should clamp payment percentage to [0, 100]', () => {
      const totalPaid = 1200;
      const customerTotal = 1000;
      const rawPct = customerTotal > 0 ? Math.round((totalPaid / customerTotal) * 100) : 0;
      const clampedPct = Math.min(100, Math.max(0, rawPct));

      expect(clampedPct).toBe(100);
    });
  });
});
