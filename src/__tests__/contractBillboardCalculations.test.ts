import { describe, it, expect } from 'vitest';
import {
  calculateDaysBetween,
  calculateRemainingBillboardValue,
  calculateSwapFinancialDifference,
  scoreBillboardCandidate,
} from '../utils/contractBillboardCalculations';

describe('contractBillboardCalculations', () => {
  describe('calculateDaysBetween', () => {
    it('calculates days between dates accurately inclusive of start and end', () => {
      expect(calculateDaysBetween('2026-06-01', '2026-06-30')).toBe(30);
      expect(calculateDaysBetween('2026-01-01', '2026-01-01')).toBe(1);
      expect(calculateDaysBetween('2026-01-01', '2026-01-10')).toBe(10);
    });

    it('returns 0 for invalid inputs', () => {
      expect(calculateDaysBetween(null, '2026-06-30')).toBe(0);
      expect(calculateDaysBetween('invalid-date', '2026-06-30')).toBe(0);
    });
  });

  describe('calculateRemainingBillboardValue', () => {
    it('calculates remaining and consumed values correctly at mid-period', () => {
      // 30 days total, 10 days elapsed, 20 days remaining, price = 3000
      const res = calculateRemainingBillboardValue({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        effectiveDate: '2026-06-11', // 10 elapsed days (1st to 10th)
        contractedPrice: 3000,
      });

      expect(res.totalDays).toBe(30);
      expect(res.elapsedDays).toBe(10);
      expect(res.remainingDays).toBe(20);
      expect(res.dailyRate).toBe(100);
      expect(res.remainingValue).toBe(2000);
      expect(res.consumedValue).toBe(1000);
    });

    it('handles effective date at beginning of contract', () => {
      const res = calculateRemainingBillboardValue({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        effectiveDate: '2026-06-01',
        contractedPrice: 3000,
      });

      expect(res.elapsedDays).toBe(0);
      expect(res.remainingDays).toBe(30);
      expect(res.remainingValue).toBe(3000);
      expect(res.consumedValue).toBe(0);
    });

    it('preserves non-refundable print and install costs', () => {
      const res = calculateRemainingBillboardValue({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        effectiveDate: '2026-06-16', // 15 days elapsed, 15 days remaining
        contractedPrice: 3500, // 3000 rental + 300 print + 200 install
        printCost: 300,
        installCost: 200,
        includePrint: false,
        includeInstall: false,
      });

      expect(res.totalDays).toBe(30);
      expect(res.elapsedDays).toBe(15);
      expect(res.remainingDays).toBe(15);
      expect(res.nonRefundableCosts).toBe(500);
      // Daily rate based on 3000 rental = 100/day
      expect(res.remainingValue).toBe(1500);
      // Consumed = 1500 rental + 500 non-refundable = 2000
      expect(res.consumedValue).toBe(2000);
    });
  });

  describe('calculateSwapFinancialDifference', () => {
    it('identifies equivalent swap with 0 financial difference', () => {
      const res = calculateSwapFinancialDifference({
        originalRemainingValue: 2000,
        replacementMonthlyPrice: 3000, // 100/day * 20 days = 2000
        remainingDays: 20,
      });

      expect(res.isEquivalent).toBe(true);
      expect(res.difference).toBe(0);
      expect(res.statusText).toContain('استبدال متكافئ');
    });

    it('identifies upgrade swap with positive difference', () => {
      const res = calculateSwapFinancialDifference({
        originalRemainingValue: 2000,
        replacementMonthlyPrice: 4500, // 150/day * 20 days = 3000
        remainingDays: 20,
      });

      expect(res.isEquivalent).toBe(false);
      expect(res.difference).toBe(1000);
      expect(res.statusText).toContain('زيادة على العقد');
    });

    it('identifies downgrade swap with negative difference', () => {
      const res = calculateSwapFinancialDifference({
        originalRemainingValue: 2000,
        replacementMonthlyPrice: 1500, // 50/day * 20 days = 1000
        remainingDays: 20,
      });

      expect(res.isEquivalent).toBe(false);
      expect(res.difference).toBe(-1000);
      expect(res.statusText).toContain('خصم من العقد');
    });
  });

  describe('scoreBillboardCandidate', () => {
    it('scores perfect match for same size, city, district, and landmark', () => {
      const res = scoreBillboardCandidate({
        originalBillboard: {
          Size: '4x3',
          City: 'طرابلس',
          District: 'سياحية',
          Nearest_Landmark: 'برج الفاتح',
          Level: 'A',
        },
        candidate: {
          Size: '4x3',
          City: 'طرابلس',
          District: 'سياحية',
          Nearest_Landmark: 'برج الفاتح',
          Level: 'A',
        },
      });

      expect(res.score).toBe(100);
      expect(res.matchTier).toBe('perfect');
      expect(res.matchLabel).toBe('تطابق مثالي');
    });

    it('scores excellent match for same size and city with different district', () => {
      const res = scoreBillboardCandidate({
        originalBillboard: {
          Size: '4x3',
          City: 'طرابلس',
          District: 'سياحية',
        },
        candidate: {
          Size: '4x3',
          City: 'طرابلس',
          District: 'زاوية الدهماني',
        },
      });

      expect(res.score).toBe(70);
      expect(res.matchTier).toBe('excellent');
    });
  });
});
