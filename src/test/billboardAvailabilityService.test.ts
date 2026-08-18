import { describe, it, expect } from 'vitest';
import {
  resolveBillboardAvailability,
  resolveContractMarketingVisibility,
  buildOccupancyTimeline,
  normalizeDateOnly,
  addCalendarDays,
  addCalendarMonths,
  isDateExpired,
} from '../services/billboardAvailabilityService';

describe('billboardAvailabilityService - Unified Engine Tests', () => {
  const REF_DATE = '2026-08-18';

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Date & Timeline Helpers
  // ───────────────────────────────────────────────────────────────────────────
  describe('Date Helpers', () => {
    it('normalizes UTC timestamps without off-by-one errors', () => {
      expect(normalizeDateOnly('2026-08-18')).toBe('2026-08-18');
      expect(normalizeDateOnly('2026-07-19T22:00:00.000Z')).toBe('2026-07-20');
      expect(normalizeDateOnly(null)).toBeNull();
    });

    it('calculates calendar day addition correctly', () => {
      expect(addCalendarDays('2026-08-18', 1)).toBe('2026-08-19');
      expect(addCalendarDays('2026-01-31', 1)).toBe('2026-02-01');
      expect(addCalendarDays('2027-01-27', 1)).toBe('2027-01-28');
    });

    it('calculates calendar month addition correctly', () => {
      expect(addCalendarMonths('2026-08-18', 4)).toBe('2026-12-18');
      expect(addCalendarMonths('2026-08-18', 6)).toBe('2027-02-18');
    });

    it('evaluates date expiration inclusively', () => {
      // If end date is today (2026-08-18), contract is ACTIVE until end of day (not expired)
      expect(isDateExpired('2026-08-18', '2026-08-18')).toBe(false);
      // If end date was yesterday (2026-08-17), it IS expired
      expect(isDateExpired('2026-08-17', '2026-08-18')).toBe(true);
      // If end date is tomorrow (2026-08-19), it is NOT expired
      expect(isDateExpired('2026-08-19', '2026-08-18')).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Timeline Merging & Continuous Overlaps
  // ───────────────────────────────────────────────────────────────────────────
  describe('Occupancy Timeline Merging', () => {
    it('merges overlapping and contiguous intervals into continuous periods', () => {
      const contracts = [
        {
          contractNumber: 1274,
          customerName: 'محمد البحباح',
          adType: 'نوار',
          startDate: '2026-07-19',
          endDate: '2027-01-15',
          isUpcoming: false,
          isExpired: false,
          isFuture: false,
        },
        {
          contractNumber: 1287,
          customerName: 'محمد البحباح',
          adType: 'الربيع',
          startDate: '2026-07-31',
          endDate: '2027-01-27',
          isUpcoming: false,
          isExpired: false,
          isFuture: false,
        },
      ];

      const periods = buildOccupancyTimeline(contracts);
      expect(periods).toHaveLength(1);
      expect(periods[0].startDate).toBe('2026-07-19');
      expect(periods[0].endDate).toBe('2027-01-27');
      expect(periods[0].contracts).toHaveLength(2);
    });

    it('keeps non-contiguous periods separate with gaps', () => {
      const contracts = [
        {
          contractNumber: 101,
          customerName: 'Customer A',
          adType: 'Ad A',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          isUpcoming: false,
          isExpired: true,
          isFuture: false,
        },
        {
          contractNumber: 102,
          customerName: 'Customer B',
          adType: 'Ad B',
          startDate: '2026-10-01',
          endDate: '2026-12-31',
          isUpcoming: true,
          isExpired: false,
          isFuture: true,
        },
      ];

      const periods = buildOccupancyTimeline(contracts);
      expect(periods).toHaveLength(2);
      expect(periods[0].startDate).toBe('2026-01-01');
      expect(periods[0].endDate).toBe('2026-03-31');
      expect(periods[1].startDate).toBe('2026-10-01');
      expect(periods[1].endDate).toBe('2026-12-31');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Test Matrix: (Contract States x Visibility Overrides)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test Matrix: Core Availability Resolution', () => {
    // Case 1: No contract, override = null -> AVAILABLE
    it('Case 1: No contract + override=null -> operational AVAILABLE, marketing visible', () => {
      const bb = { ID: '1', Billboard_Name: 'BB-01', is_visible_in_available: null };
      const res = resolveBillboardAvailability(bb, [], { referenceDate: REF_DATE });

      expect(res.operationalStatus).toBe('AVAILABLE');
      expect(res.isAvailableNow).toBe(true);
      expect(res.marketingVisibility).toBe('AUTO');
      expect(res.isMarketingVisible).toBe(true);
      expect(res.availableFrom).toBe(REF_DATE);
    });

    // Case 2: Active contract, override = null -> RENTED, not available now
    it('Case 2: Active contract + override=null -> operational RENTED, marketing auto', () => {
      const bb = { ID: '2', Billboard_Name: 'BB-02', is_visible_in_available: null };
      const contracts = [
        {
          Contract_Number: 200,
          'Customer Name': 'Company X',
          'Contract Date': '2026-05-01',
          'End Date': '2026-11-01',
          billboard_ids: '2',
        },
      ];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });

      expect(res.operationalStatus).toBe('RENTED');
      expect(res.isAvailableNow).toBe(false);
      expect(res.marketingVisibility).toBe('AUTO');
      // Ends 2026-11-01 <= window end 2026-12-18 -> isMarketingVisible = true (upcoming)
      expect(res.isMarketingVisible).toBe(true);
      expect(res.currentRentEndDate).toBe('2026-11-01');
      expect(res.availableFrom).toBe('2026-11-02');
    });

    // Case 3: Active contract, override = true -> operational RENTED, marketing FORCE_SHOW
    it('Case 3: Active contract + override=true -> operational RENTED (NOT available now), marketing FORCE_SHOW', () => {
      const bb = { ID: '3', Billboard_Name: 'BB-03', is_visible_in_available: true };
      const contracts = [
        {
          Contract_Number: 300,
          'Customer Name': 'Company Y',
          'Contract Date': '2026-01-01',
          'End Date': '2027-06-30',
          billboard_ids: '3',
        },
      ];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });

      // Operational status MUST NOT be overwritten to AVAILABLE
      expect(res.operationalStatus).toBe('RENTED');
      expect(res.isAvailableNow).toBe(false);
      // Marketing visibility IS FORCE_SHOW
      expect(res.marketingVisibility).toBe('FORCE_SHOW');
      expect(res.isMarketingVisible).toBe(true);
      // End date and availableFrom MUST NOT be wiped out
      expect(res.currentRentEndDate).toBe('2027-06-30');
      expect(res.availableFrom).toBe('2027-07-01');
      expect(res.statusLabelArabic).toContain('معروض للتسويق');
    });

    // Case 4: Active contract, override = false -> operational RENTED, marketing FORCE_HIDE
    it('Case 4: Active contract + override=false -> operational RENTED, marketing FORCE_HIDE (hidden from export)', () => {
      const bb = { ID: '4', Billboard_Name: 'BB-04', is_visible_in_available: false };
      const contracts = [
        {
          Contract_Number: 400,
          'Customer Name': 'Company Z',
          'Contract Date': '2026-01-01',
          'End Date': '2026-09-01',
          billboard_ids: '4',
        },
      ];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });

      expect(res.operationalStatus).toBe('RENTED');
      expect(res.marketingVisibility).toBe('FORCE_HIDE');
      expect(res.isMarketingVisible).toBe(false);
    });

    // Case 5: Expired contract, override = null -> AVAILABLE
    it('Case 5: Expired contract + override=null -> operational AVAILABLE', () => {
      const bb = { ID: '5', Billboard_Name: 'BB-05', is_visible_in_available: null };
      const contracts = [
        {
          Contract_Number: 500,
          'Customer Name': 'Old Company',
          'Contract Date': '2025-01-01',
          'End Date': '2026-06-30',
          billboard_ids: '5',
        },
      ];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });

      expect(res.operationalStatus).toBe('AVAILABLE');
      expect(res.isAvailableNow).toBe(true);
      expect(res.availableFrom).toBe(REF_DATE);
      expect(res.activeContracts).toHaveLength(0);
      expect(res.expiredContracts).toHaveLength(1);
    });

    // Case 6: Maintenance status
    it('Case 6: Maintenance/Removed status overrides operational availability', () => {
      const bbRemoved = { ID: '6', Billboard_Name: 'BB-06', maintenance_status: 'removed', is_visible_in_available: true };
      const resRemoved = resolveBillboardAvailability(bbRemoved, [], { referenceDate: REF_DATE });
      expect(resRemoved.operationalStatus).toBe('REMOVED');
      expect(resRemoved.isAvailableNow).toBe(false);
      expect(resRemoved.isMarketingVisible).toBe(false);

      const bbMaint = { ID: '7', Billboard_Name: 'BB-07', maintenance_status: 'repair_needed', is_visible_in_available: null };
      const resMaint = resolveBillboardAvailability(bbMaint, [], { referenceDate: REF_DATE });
      expect(resMaint.operationalStatus).toBe('MAINTENANCE');
      expect(resMaint.isAvailableNow).toBe(false);
      expect(resMaint.isMarketingVisible).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Specific Regression Tests: TR-TC0283, Nawar (1274), Asaad (1228)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Regression Cases: Real Data Verification', () => {
    it('TR-TC0283: Correctly merges Contracts 1274 and 1287 into continuous occupancy until 2027-01-27', () => {
      const bb283 = {
        ID: '283',
        Billboard_Name: 'TR-TC0283',
        Status: 'محجوز',
        is_visible_in_available: false,
      };

      const contracts = [
        {
          Contract_Number: 1274,
          'Customer Name': 'محمد البحباح',
          'Ad Type': 'نوار والتقدم',
          'Contract Date': '2026-07-19',
          'End Date': '2027-01-15',
          billboard_ids: '937,201,283,540,71,260',
        },
        {
          Contract_Number: 1287,
          'Customer Name': 'محمد البحباح',
          'Ad Type': 'الربيع',
          'Contract Date': '2026-07-31',
          'End Date': '2027-01-27',
          billboard_ids: '283,963,63,30,74,29,987',
        },
      ];

      const res = resolveBillboardAvailability(bb283, contracts, { referenceDate: REF_DATE });

      expect(res.operationalStatus).toBe('RENTED');
      expect(res.isAvailableNow).toBe(false);
      expect(res.currentRentEndDate).toBe('2027-01-27');
      expect(res.availableFrom).toBe('2027-01-28');
      expect(res.marketingVisibility).toBe('FORCE_HIDE');
      expect(res.isMarketingVisible).toBe(false);
      expect(res.activeContracts).toHaveLength(2);
      expect(res.occupancyPeriods).toHaveLength(1);
      expect(res.occupancyPeriods[0].endDate).toBe('2027-01-27');
    });

    it('Nawar (Contract 1274): Resolves marketing visibility as PARTIAL (5 FORCE_SHOW, 1 FORCE_HIDE)', () => {
      const billboardRows = [
        { ID: 201, is_visible_in_available: true },
        { ID: 540, is_visible_in_available: true },
        { ID: 260, is_visible_in_available: true },
        { ID: 283, is_visible_in_available: false }, // TR-TC0283
        { ID: 71, is_visible_in_available: true },
        { ID: 937, is_visible_in_available: true },
      ];

      const visInfo = resolveContractMarketingVisibility(billboardRows);

      expect(visInfo.state).toBe('PARTIAL');
      expect(visInfo.totalCount).toBe(6);
      expect(visInfo.forceShowCount).toBe(5);
      expect(visInfo.forceHideCount).toBe(1);
      expect(visInfo.autoCount).toBe(0);
      expect(visInfo.modifiableCount).toBe(5);
    });

    it('Asaad (Contract 1228): Resolves marketing visibility as PARTIAL (21 FORCE_SHOW, 2 AUTO)', () => {
      const billboardRows = [
        ...Array.from({ length: 21 }, (_, i) => ({ ID: i + 1, is_visible_in_available: true })),
        { ID: 374, is_visible_in_available: null },
        { ID: 907, is_visible_in_available: null },
      ];

      const visInfo = resolveContractMarketingVisibility(billboardRows);

      expect(visInfo.state).toBe('PARTIAL');
      expect(visInfo.totalCount).toBe(23);
      expect(visInfo.forceShowCount).toBe(21);
      expect(visInfo.forceHideCount).toBe(0);
      expect(visInfo.autoCount).toBe(2);
      expect(visInfo.modifiableCount).toBe(23);
    });
  });
});
