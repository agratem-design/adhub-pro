import { describe, it, expect } from 'vitest';
import {
  resolveBillboardAvailability,
  resolveContractMarketingVisibility,
  normalizeDateOnly,
} from '../services/billboardAvailabilityService';

describe('TR-HA0071 & Truth Table Regression Tests', () => {
  const REF_DATE = '2026-08-18';

  // ───────────────────────────────────────────────────────────────────────────
  // Case A: TR-HA0071 with Contract 1274 (Nawar) - SHOW + No other blocker -> VISIBLE
  // ───────────────────────────────────────────────────────────────────────────
  it('Case A: TR-HA0071 with Contract 1274 (is_visible_in_available=true) -> FORCE_SHOW & isMarketingVisible=true', () => {
    const bb71 = {
      ID: '71',
      Billboard_Name: 'TR-HA0071',
      Status: 'محجوز',
      Contract_Number: '1274',
      Customer_Name: 'محمد البحباح',
      Rent_Start_Date: '2026-07-19',
      Rent_End_Date: '2027-01-15',
      is_visible_in_available: true,
      maintenance_status: 'operational',
      friend_company_id: null,
    };

    const contracts = [
      {
        Contract_Number: 1274,
        'Customer Name': 'محمد البحباح',
        'Ad Type': 'نوار والتقدم',
        'Contract Date': '2026-07-19',
        'End Date': '2027-01-15',
        billboard_ids: '937,201,283,540,71,260',
        is_visible_in_available: true, // Marketing activated
        billboards_released: false,
      },
      {
        Contract_Number: 1020,
        'Customer Name': 'محمد البحباح',
        'Ad Type': 'هاير',
        'Contract Date': '2025-04-04',
        'End Date': '2026-03-30', // Expired
        billboard_ids: '71',
        billboards_released: false,
      },
    ];

    const res = resolveBillboardAvailability(bb71, contracts, {
      referenceDate: REF_DATE,
      upcomingMonthsWindow: 4,
    });

    expect(res.operationalStatus).toBe('RENTED');
    expect(res.isAvailableNow).toBe(false);
    expect(res.requestedMarketingVisibility).toBe('FORCE_SHOW');
    expect(res.isBlockedByOtherContract).toBe(false);
    expect(res.blockingContracts).toHaveLength(0);
    expect(res.effectiveMarketingVisibility).toBe('FORCE_SHOW');
    expect(res.isMarketingVisible).toBe(true);
    expect(res.reason).toContain('اللوحة معروضة للتسويق بقرار إداري');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Case B: TR-QB0374 - Contract 1228 (SHOW) + Contract 1185 (BLOCK) -> HIDDEN
  // ───────────────────────────────────────────────────────────────────────────
  it('Case B: TR-QB0374 with Contract 1228 (SHOW) + Contract 1185 (BLOCK) -> FORCE_HIDE & isMarketingVisible=false', () => {
    const bb374 = {
      ID: '374',
      Billboard_Name: 'TR-QB0374',
      Status: 'محجوز',
      Contract_Number: '1228',
      is_visible_in_available: true,
      maintenance_status: 'operational',
    };

    const contracts = [
      {
        Contract_Number: 1228,
        'Customer Name': 'علي عمار',
        'Ad Type': 'أسعد',
        'Contract Date': '2026-04-01',
        'End Date': '2026-09-28',
        billboard_ids: '374',
        is_visible_in_available: true, // SHOW
        billboards_released: false,
      },
      {
        Contract_Number: 1185,
        'Customer Name': 'محمد علي الحولة',
        'Ad Type': 'جوتن',
        'Contract Date': '2025-12-28',
        'End Date': '2026-12-23', // Active > 4 months
        billboard_ids: '374',
        is_visible_in_available: null, // BLOCKING
        billboards_released: false,
      },
    ];

    const res = resolveBillboardAvailability(bb374, contracts, {
      referenceDate: REF_DATE,
      upcomingMonthsWindow: 4,
    });

    expect(res.operationalStatus).toBe('RENTED');
    expect(res.isBlockedByOtherContract).toBe(true);
    expect(res.blockingContracts).toHaveLength(1);
    expect(res.blockingContracts[0].contractNumber).toBe(1185);
    expect(res.effectiveMarketingVisibility).toBe('FORCE_HIDE');
    expect(res.isMarketingVisible).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Case C: TR-SJ0192 - Active Contract 1185 (BLOCK) + No valid show -> HIDDEN
  // ───────────────────────────────────────────────────────────────────────────
  it('Case C: TR-SJ0192 with Contract 1185 (BLOCK) -> FORCE_HIDE & isMarketingVisible=false', () => {
    const bb192 = {
      ID: '192',
      Billboard_Name: 'TR-SJ0192',
      Status: 'محجوز',
      Contract_Number: '1185',
      is_visible_in_available: true, // Manual requested show without contract activation
      maintenance_status: 'operational',
    };

    const contracts = [
      {
        Contract_Number: 1185,
        'Customer Name': 'محمد علي الحولة',
        'Contract Date': '2025-12-28',
        'End Date': '2026-12-23',
        billboard_ids: '192',
        is_visible_in_available: null, // Untoggled contract
        billboards_released: false,
      },
    ];

    const res = resolveBillboardAvailability(bb192, contracts, {
      referenceDate: REF_DATE,
      upcomingMonthsWindow: 4,
    });

    expect(res.operationalStatus).toBe('RENTED');
    expect(res.isBlockedByOtherContract).toBe(true);
    expect(res.blockingContracts).toHaveLength(1);
    expect(res.blockingContracts[0].contractNumber).toBe(1185);
    expect(res.effectiveMarketingVisibility).toBe('FORCE_HIDE');
    expect(res.isMarketingVisible).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Complete Audit of Contract 1274 (Nawar) - 6 Billboards
  // ───────────────────────────────────────────────────────────────────────────
  it('Contract 1274 Audit: 5 boards shown, 1 board (283) blocked by Contract 1287', () => {
    const c1274Ids = ['937', '201', '283', '540', '71', '260'];
    const contracts = [
      {
        Contract_Number: 1274,
        'Customer Name': 'محمد البحباح',
        'Ad Type': 'نوار والتقدم',
        'Contract Date': '2026-07-19',
        'End Date': '2027-01-15',
        billboard_ids: c1274Ids.join(','),
        is_visible_in_available: true,
        billboards_released: false,
      },
      {
        Contract_Number: 1287,
        'Customer Name': 'محمد البحباح',
        'Ad Type': 'تجديد نوار',
        'Contract Date': '2026-07-28',
        'End Date': '2027-01-27',
        billboard_ids: '283',
        is_visible_in_available: null, // Untoggled continuous occupancy contract
        billboards_released: false,
      },
    ];

    const billboards = c1274Ids.map((id) => ({
      ID: id,
      Billboard_Name: id === '71' ? 'TR-HA0071' : `BB-${id}`,
      Status: 'محجوز',
      Contract_Number: '1274',
      is_visible_in_available: true, // All 6 requested show, but board 283 is blocked by Contract 1287
      maintenance_status: 'operational',
    }));

    const resolutions = billboards.map((b) =>
      resolveBillboardAvailability(b, contracts, {
        referenceDate: REF_DATE,
        upcomingMonthsWindow: 4,
      })
    );

    const shownBoards = resolutions.filter((r) => r.isMarketingVisible);
    const hiddenBoards = resolutions.filter((r) => !r.isMarketingVisible);

    expect(shownBoards).toHaveLength(5);
    expect(hiddenBoards).toHaveLength(1);
    expect(hiddenBoards[0].billboardId).toBe('283');

    // TR-HA0071 is in shownBoards!
    const trHa0071Res = shownBoards.find((r) => r.billboardId === '71');
    expect(trHa0071Res).toBeDefined();
    expect(trHa0071Res?.effectiveMarketingVisibility).toBe('FORCE_SHOW');
    expect(trHa0071Res?.isMarketingVisible).toBe(true);

    const visInfo = resolveContractMarketingVisibility(billboards, contracts, { referenceDate: REF_DATE });
    expect(visInfo.state).toBe('PARTIAL');
    expect(visInfo.totalCount).toBe(6);
    expect(visInfo.effectiveForceShowCount).toBe(5);
    expect(visInfo.blockedByOtherContractsCount).toBe(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Window Decoupling: TR-QB0374 blocked in both 4-month and 6-month windows
  // ───────────────────────────────────────────────────────────────────────────
  it('Window Decoupling: TR-QB0374 is blocked by Contract 1185 under both 4-month and 6-month windows', () => {
    const bb374 = {
      ID: '374',
      Billboard_Name: 'TR-QB0374',
      Status: 'محجوز',
      Contract_Number: '1228',
      is_visible_in_available: true,
      maintenance_status: 'operational',
    };

    const contracts = [
      {
        Contract_Number: 1228,
        'Customer Name': 'علي عمار',
        'Contract Date': '2026-04-01',
        'End Date': '2026-09-28',
        billboard_ids: '374',
        is_visible_in_available: true, // SHOW
      },
      {
        Contract_Number: 1185,
        'Customer Name': 'محمد علي الحولة',
        'Contract Date': '2025-12-28',
        'End Date': '2026-12-23', // Active, ends within 6 months
        billboard_ids: '374',
        is_visible_in_available: null, // BLOCKING
      },
    ];

    // Under 4 months
    const res4 = resolveBillboardAvailability(bb374, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });
    expect(res4.isBlockedByOtherContract).toBe(true);
    expect(res4.blockingContracts).toHaveLength(1);
    expect(res4.blockingContracts[0].contractNumber).toBe(1185);
    expect(res4.isMarketingVisible).toBe(false);

    // Under 6 months (even though 1185 ends within 6 months, it STILL blocks the FORCE_SHOW now!)
    const res6 = resolveBillboardAvailability(bb374, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 6 });
    expect(res6.isBlockedByOtherContract).toBe(true);
    expect(res6.blockingContracts).toHaveLength(1);
    expect(res6.blockingContracts[0].contractNumber).toBe(1185);
    expect(res6.isMarketingVisible).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Window Decoupling: TR-HA0071 is visible under both 4-month and 6-month windows
  // ───────────────────────────────────────────────────────────────────────────
  it('Window Decoupling: TR-HA0071 is visible under both 4-month and 6-month windows', () => {
    const bb71 = {
      ID: '71',
      Billboard_Name: 'TR-HA0071',
      Status: 'محجوز',
      Contract_Number: '1274',
      is_visible_in_available: true,
      maintenance_status: 'operational',
    };

    const contracts = [
      {
        Contract_Number: 1274,
        'Customer Name': 'محمد البحباح',
        'Contract Date': '2026-07-19',
        'End Date': '2027-01-15',
        billboard_ids: '71',
        is_visible_in_available: true,
      },
    ];

    const res4 = resolveBillboardAvailability(bb71, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });
    expect(res4.isBlockedByOtherContract).toBe(false);
    expect(res4.effectiveMarketingVisibility).toBe('FORCE_SHOW');
    expect(res4.isMarketingVisible).toBe(true);
    expect(res4.currentRentEndDate).toBe('2027-01-15');
    expect(res4.availableFrom).toBe('2027-01-16');

    const res6 = resolveBillboardAvailability(bb71, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 6 });
    expect(res6.isBlockedByOtherContract).toBe(false);
    expect(res6.effectiveMarketingVisibility).toBe('FORCE_SHOW');
    expect(res6.isMarketingVisible).toBe(true);
    expect(res6.currentRentEndDate).toBe('2027-01-15');
    expect(res6.availableFrom).toBe('2027-01-16');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Strict Calendar Date Invariant Tests
  // ───────────────────────────────────────────────────────────────────────────
  it('Strict Calendar Date Invariant: Key business dates are preserved without timezone shift', () => {
    const keyDates = [
      { input: '2026-07-19', expected: '2026-07-19' },
      { input: '2026-07-19T22:00:00.000Z', expected: '2026-07-19' },
      { input: '2027-01-15', expected: '2027-01-15' },
      { input: '2027-01-15T22:00:00.000Z', expected: '2027-01-15' },
      { input: '2026-07-31T22:00:00.000Z', expected: '2026-07-31' },
      { input: '2027-01-27T22:00:00.000Z', expected: '2027-01-27' },
      { input: '2026-12-23', expected: '2026-12-23' },
      { input: '2026-12-22T22:00:00.000Z', expected: '2026-12-22' },
    ];

    keyDates.forEach(({ input, expected }) => {
      expect(normalizeDateOnly(input)).toBe(expected);
    });
  });
});
