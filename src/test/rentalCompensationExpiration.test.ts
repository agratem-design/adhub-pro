import { describe, it, expect } from 'vitest';
import {
  isContractDateExpired,
  getEligibleCompensationRows,
  withCompensation,
  readPrices,
  getTodayString,
} from '@/components/contracts/RentalCompensationAlert';

describe('Rental Compensation Expiration and Visibility Suite', () => {
  const today = getTodayString();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);

  describe('isContractDateExpired', () => {
    it('returns true when explicit isExpired flag is true', () => {
      expect(isContractDateExpired(tomorrow, 'ساري', true)).toBe(true);
    });

    it('returns true when contractStatus indicates completion or cancellation', () => {
      expect(isContractDateExpired(tomorrow, 'منتهي')).toBe(true);
      expect(isContractDateExpired(tomorrow, 'ملغي')).toBe(true);
      expect(isContractDateExpired(tomorrow, 'expired')).toBe(true);
      expect(isContractDateExpired(tomorrow, 'cancelled')).toBe(true);
    });

    it('returns true when endDate is in the past', () => {
      expect(isContractDateExpired(yesterday, 'ساري')).toBe(true);
      expect(isContractDateExpired('2024-01-01', null)).toBe(true);
    });

    it('returns false when contract is active and ends in the future', () => {
      expect(isContractDateExpired(tomorrow, 'ساري')).toBe(false);
      expect(isContractDateExpired(tomorrow, null)).toBe(false);
    });

    it('returns false when endDate is today', () => {
      expect(isContractDateExpired(today, 'ساري')).toBe(false);
    });
  });

  describe('getEligibleCompensationRows on expired vs active contracts', () => {
    const billboards = [
      {
        ID: 101,
        Billboard_Name: 'لوحة طريق المطار',
        Contract_Number: 999, // borrowed from another contract
        Rent_Start_Date: '2026-01-01',
        Rent_End_Date: tomorrow, // source rental is currently active
      },
      {
        ID: 102,
        Billboard_Name: 'لوحة الجامعة',
        Contract_Number: 888,
        Rent_Start_Date: '2024-01-01',
        Rent_End_Date: '2024-12-31', // source rental expired long ago
      },
    ];

    it('NEVER returns eligible rows when the current contract is expired', () => {
      const rows = getEligibleCompensationRows({
        billboards,
        startDate: '2024-01-01',
        endDate: yesterday, // Expired contract
        contractNumber: 1313,
        contractStatus: 'منتهي',
      });

      expect(rows).toHaveLength(0);
    });

    it('NEVER returns eligible rows when contract has status "منتهي" even if dates are future', () => {
      const rows = getEligibleCompensationRows({
        billboards,
        startDate: today,
        endDate: tomorrow,
        contractNumber: 1313,
        contractStatus: 'منتهي',
      });

      expect(rows).toHaveLength(0);
    });

    it('returns eligible rows only for currently active borrowed rentals when current contract is active', () => {
      const rows = getEligibleCompensationRows({
        billboards,
        startDate: today,
        endDate: tomorrow,
        contractNumber: 1313,
        contractStatus: 'ساري',
      });

      // Board 101 is borrowed from contract 999 and its rental is active (ends tomorrow)
      // Board 102 is from an ancient rental in 2024, so it must NOT be eligible
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('101');
      expect(rows[0].source).toBe(999);
    });

    it('preserves compensation if already saved as true in an active contract', () => {
      const savedPrices = JSON.stringify([
        {
          billboardId: '102',
          compensateOriginal: true,
          originalContractNumber: 888,
        },
      ]);

      const rows = getEligibleCompensationRows({
        billboards,
        startDate: today,
        endDate: tomorrow,
        contractNumber: 1313,
        contractStatus: 'ساري',
        savedPrices,
      });

      // Both 101 (new active borrow) and 102 (explicitly saved compensation)
      expect(rows.map(r => r.id)).toEqual(['101', '102']);
    });
  });

  describe('withCompensation and readPrices', () => {
    it('safely parses saved prices', () => {
      expect(readPrices(null)).toEqual([]);
      expect(readPrices('invalid-json')).toEqual([]);
      expect(readPrices([{ billboardId: 101 }])).toHaveLength(1);
    });

    it('applies user choices on top of pricing array', () => {
      const initialPrices = [
        { billboardId: '101', finalPrice: 5000 },
        { billboardId: '102', finalPrice: 3000 },
      ];

      const choices = {
        '101': { enabled: true, contractNumber: 999 },
        '102': { enabled: false, contractNumber: 888 },
      };

      const result = withCompensation(initialPrices, choices);
      expect(result[0].compensateOriginal).toBe(true);
      expect(result[0].originalContractNumber).toBe(999);
      expect(result[1].compensateOriginal).toBe(false);
      expect(result[1].originalContractNumber).toBe(888);
    });
  });
});
