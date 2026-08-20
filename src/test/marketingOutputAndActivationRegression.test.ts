import { describe, it, expect } from 'vitest';
import {
  resolveBillboardAvailability,
  resolveContractMarketingVisibility,
} from '../services/billboardAvailabilityService';
import { isAvailableForAvailableExports, isAvailableOrUpcomingForExport } from '../hooks/useBillboardExport';

describe('Comprehensive Availability & Marketing Activation Test Suite', () => {
  const REF_DATE = '2026-08-18';

  // 1. Current active contract shown + no blocker -> EXPLICIT_CONTRACT_SHOW (AVAILABLE NOW)
  it('Rule 1: Current active contract shown + no blocker -> EXPLICIT_CONTRACT_SHOW', () => {
    const bb = { ID: '71', Billboard_Name: 'TR-HA0071', Status: 'محجوز', Contract_Number: '1274' };
    const contracts = [{
      Contract_Number: 1274,
      'Customer Name': 'محمد البحباح',
      'Contract Date': '2026-07-20',
      'End Date': '2027-01-16',
      billboard_ids: '71',
      is_visible_in_available: true,
    }];
    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });
    expect(res.classification).toBe('EXPLICIT_CONTRACT_SHOW');
    expect(res.isAvailableNow).toBe(false); // Operationally rented
    expect(isAvailableForAvailableExports(bb, contracts, REF_DATE)).toBe(true);
  });

  // 2. Current active contract not shown -> NOT AVAILABLE NOW
  it('Rule 2: Current active contract not shown -> NOT AVAILABLE NOW', () => {
    const bb = { ID: '99', Billboard_Name: 'TR-99', Status: 'محجوز', Contract_Number: '555' };
    const contracts = [{
      Contract_Number: 555,
      'Customer Name': 'عميل عادي',
      'Contract Date': '2026-01-01',
      'End Date': '2027-12-31',
      billboard_ids: '99',
      is_visible_in_available: null,
    }];
    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });
    expect(res.classification).toBe('EXCLUDED');
    expect(isAvailableForAvailableExports(bb, contracts, REF_DATE)).toBe(false);
  });

  // 3. Expired shown contract + current non-shown contract -> NOT AVAILABLE NOW
  it('Rule 3: Expired shown contract + current non-shown contract -> NOT AVAILABLE NOW', () => {
    const bb = { ID: '100', Billboard_Name: 'TR-100', Status: 'محجوز', Contract_Number: '200' };
    const contracts = [
      {
        Contract_Number: 100,
        'Contract Date': '2025-01-01',
        'End Date': '2026-01-01', // Expired
        billboard_ids: '100',
        is_visible_in_available: true, // Old activated contract
      },
      {
        Contract_Number: 200,
        'Contract Date': '2026-02-01',
        'End Date': '2027-02-01', // Current active
        billboard_ids: '100',
        is_visible_in_available: null, // NOT activated
      }
    ];
    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });
    expect(res.classification).toBe('EXCLUDED');
    expect(isAvailableForAvailableExports(bb, contracts, REF_DATE)).toBe(false);
  });

  // 4. Future shown contract + current non-shown contract -> NOT AVAILABLE NOW
  it('Rule 4: Future shown contract + current non-shown contract -> NOT AVAILABLE NOW', () => {
    const bb = { ID: '101', Billboard_Name: 'TR-101', Status: 'محجوز', Contract_Number: '300' };
    const contracts = [
      {
        Contract_Number: 300,
        'Contract Date': '2026-01-01',
        'End Date': '2026-12-31', // Current active
        billboard_ids: '101',
        is_visible_in_available: null,
      },
      {
        Contract_Number: 400,
        'Contract Date': '2027-01-01', // Future
        'End Date': '2027-12-31',
        billboard_ids: '101',
        is_visible_in_available: true,
      }
    ];
    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });
    expect(isAvailableForAvailableExports(bb, contracts, REF_DATE)).toBe(false);
  });

  // 5. Current shown contract + other blocker -> EXCLUDED
  it('Rule 5: Current shown contract + other blocker -> EXCLUDED', () => {
    const bb = { ID: '374', Billboard_Name: 'TR-QB0374', Status: 'محجوز', Contract_Number: '1228' };
    const contracts = [
      {
        Contract_Number: 1228,
        'Contract Date': '2026-04-01',
        'End Date': '2026-09-28',
        billboard_ids: '374',
        is_visible_in_available: true,
      },
      {
        Contract_Number: 1185,
        'Contract Date': '2025-12-28',
        'End Date': '2026-12-23',
        billboard_ids: '374',
        is_visible_in_available: null, // Active blocker
      }
    ];
    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });
    expect(res.classification).toBe('EXCLUDED');
    expect(res.isBlockedByOtherContract).toBe(true);
    expect(isAvailableForAvailableExports(bb, contracts, REF_DATE)).toBe(false);
  });

  // 6. Current shown contract with end date after 2 years -> AVAILABLE NOW (Decoupled from upcoming window)
  it('Rule 6: Current shown contract with end date after 2 years -> AVAILABLE NOW', () => {
    const bb = { ID: '77', Billboard_Name: 'TR-77', Status: 'محجوز', Contract_Number: '999' };
    const contracts = [{
      Contract_Number: 999,
      'Contract Date': '2026-01-01',
      'End Date': '2028-12-31', // Far in future
      billboard_ids: '77',
      is_visible_in_available: true,
    }];
    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });
    expect(res.classification).toBe('EXPLICIT_CONTRACT_SHOW');
    expect(isAvailableForAvailableExports(bb, contracts, REF_DATE)).toBe(true);
  });

  // 7. Current non-shown contract ending soon -> UPCOMING, not AVAILABLE NOW
  it('Rule 7: Current non-shown contract ending soon -> UPCOMING, not AVAILABLE NOW', () => {
    const bb = { ID: '23', Billboard_Name: 'TR-TC0023', Status: 'محجوز', Contract_Number: '1161' };
    const contracts = [{
      Contract_Number: 1161,
      'Contract Date': '2025-11-01',
      'End Date': '2026-10-27', // Ends in ~2 months
      billboard_ids: '23',
      is_visible_in_available: null,
    }];
    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });
    expect(res.classification).toBe('UPCOMING');
    expect(res.isMarketingVisible).toBe(true);
    expect(isAvailableForAvailableExports(bb, contracts, REF_DATE)).toBe(false); // Excluded from Available Only!
    expect(isAvailableOrUpcomingForExport(bb, undefined, undefined, 4, contracts, REF_DATE)).toBe(true); // Included in Available+Upcoming!
  });

  // 8. operationalStatus RENTED + valid explicit show -> AVAILABLE NOW
  it('Rule 8: operationalStatus RENTED + valid explicit show -> AVAILABLE NOW', () => {
    const bb = { ID: '71', Billboard_Name: 'TR-HA0071', Status: 'محجوز', Contract_Number: '1274' };
    const contracts = [{
      Contract_Number: 1274,
      'Contract Date': '2026-07-20',
      'End Date': '2027-01-16',
      billboard_ids: '71',
      is_visible_in_available: true,
    }];
    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });
    expect(res.operationalStatus).toBe('RENTED');
    expect(res.classification).toBe('EXPLICIT_CONTRACT_SHOW');
    expect(isAvailableForAvailableExports(bb, contracts, REF_DATE)).toBe(true);
  });

  // 9-15. Specific Regression Cases
  describe('Regression Target Cases', () => {
    const contractsFixture = [
      {
        Contract_Number: 1274,
        'Customer Name': 'محمد البحباح',
        'Ad Type': 'نوار والتقدم',
        'Contract Date': '2026-07-20',
        'End Date': '2027-01-16',
        billboard_ids: '71,283',
        is_visible_in_available: true,
      },
      {
        Contract_Number: 1287,
        'Contract Date': '2026-08-01',
        'End Date': '2027-01-28',
        billboard_ids: '283',
        is_visible_in_available: null,
      },
      {
        Contract_Number: 1228,
        'Customer Name': 'علي عمار',
        'Ad Type': 'أسعد لإستيراد الشاحنات',
        'Contract Date': '2026-04-01',
        'End Date': '2026-09-28',
        billboard_ids: '374,101',
        is_visible_in_available: true,
      },
      {
        Contract_Number: 1185,
        'Customer Name': 'محمد علي الحولة',
        'Ad Type': 'جوتن',
        'Contract Date': '2025-12-28',
        'End Date': '2026-12-23',
        billboard_ids: '192,374',
        is_visible_in_available: null,
      },
      {
        Contract_Number: 1161,
        'Contract Date': '2025-11-01',
        'End Date': '2026-10-27',
        billboard_ids: '23,949',
        is_visible_in_available: null,
      },
      {
        Contract_Number: 1254,
        'Contract Date': '2026-06-10',
        'End Date': '2026-12-07',
        billboard_ids: '7',
        is_visible_in_available: null,
      },
    ];

    it('TR-HA0071 -> AVAILABLE NOW (Included)', () => {
      const bb = { ID: '71', Billboard_Name: 'TR-HA0071', Status: 'محجوز', Contract_Number: '1274' };
      expect(isAvailableForAvailableExports(bb, contractsFixture, REF_DATE)).toBe(true);
    });

    it('TR-QB0374 -> EXCLUDED (Blocked by 1185)', () => {
      const bb = { ID: '374', Billboard_Name: 'TR-QB0374', Status: 'محجوز', Contract_Number: '1228' };
      expect(isAvailableForAvailableExports(bb, contractsFixture, REF_DATE)).toBe(false);
    });

    it('TR-SJ0192 -> EXCLUDED from Available Only (Contract 1185 not activated)', () => {
      const bb = { ID: '192', Billboard_Name: 'TR-SJ0192', Status: 'محجوز', Contract_Number: '1185' };
      expect(isAvailableForAvailableExports(bb, contractsFixture, REF_DATE)).toBe(false);
    });

    it('TR-TC0283 -> EXCLUDED (Blocked by 1287)', () => {
      const bb = { ID: '283', Billboard_Name: 'TR-TC0283', Status: 'محجوز', Contract_Number: '1274' };
      expect(isAvailableForAvailableExports(bb, contractsFixture, REF_DATE)).toBe(false);
    });

    it('TR-TC0023 -> UPCOMING (Excluded from Available Only, Included in Available+Upcoming)', () => {
      const bb = { ID: '23', Billboard_Name: 'TR-TC0023', Status: 'محجوز', Contract_Number: '1161' };
      expect(isAvailableForAvailableExports(bb, contractsFixture, REF_DATE)).toBe(false);
      expect(isAvailableOrUpcomingForExport(bb, undefined, undefined, 4, contractsFixture, REF_DATE)).toBe(true);
    });

    it('TR-SJ0007 -> UPCOMING (Excluded from Available Only, Included in Available+Upcoming)', () => {
      const bb = { ID: '7', Billboard_Name: 'TR-SJ0007', Status: 'محجوز', Contract_Number: '1254' };
      expect(isAvailableForAvailableExports(bb, contractsFixture, REF_DATE)).toBe(false);
      expect(isAvailableOrUpcomingForExport(bb, undefined, undefined, 4, contractsFixture, REF_DATE)).toBe(true);
    });

    it('TR-SJ0949 -> UPCOMING (Excluded from Available Only, Included in Available+Upcoming)', () => {
      const bb = { ID: '949', Billboard_Name: 'TR-SJ0949', Status: 'محجوز', Contract_Number: '1161' };
      expect(isAvailableForAvailableExports(bb, contractsFixture, REF_DATE)).toBe(false);
      expect(isAvailableOrUpcomingForExport(bb, undefined, undefined, 4, contractsFixture, REF_DATE)).toBe(true);
    });

    it('MS01124 -> Friendly billboard with explicit board show=true & activated contract 1228 -> AVAILABLE NOW (EXPLICIT_BILLBOARD_SHOW)', () => {
      const bb = { ID: '1124', Billboard_Name: 'MS01124', Status: 'محجوز', Contract_Number: '1228', friend_company_id: 'friend-1', is_visible_in_available: true };
      const contracts = [{
        Contract_Number: 1228,
        'Contract Date': '2026-04-01',
        'End Date': '2026-09-28',
        billboard_ids: '1124',
        is_visible_in_available: true,
      }];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });
      expect(res.classification).toBe('EXPLICIT_BILLBOARD_SHOW');
      expect(isAvailableForAvailableExports(bb, contracts, REF_DATE)).toBe(true);
    });

    it('SBH01137 -> Friendly billboard with explicit board show=true & activated contract 1228 -> AVAILABLE NOW (EXPLICIT_BILLBOARD_SHOW)', () => {
      const bb = { ID: '1137', Billboard_Name: 'SBH01137', Status: 'محجوز', Contract_Number: '1228', friend_company_id: 'friend-2', is_visible_in_available: true };
      const contracts = [{
        Contract_Number: 1228,
        'Contract Date': '2026-04-01',
        'End Date': '2026-09-28',
        billboard_ids: '1137',
        is_visible_in_available: true,
      }];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });
      expect(res.classification).toBe('EXPLICIT_BILLBOARD_SHOW');
      expect(isAvailableForAvailableExports(bb, contracts, REF_DATE)).toBe(true);
    });

    it('Friendly billboard with board show=null & activated contract 1228 -> EXCLUDED (requires explicit board show)', () => {
      const bb = { ID: '9999', Billboard_Name: 'FR-9999', Status: 'محجوز', Contract_Number: '1228', friend_company_id: 'friend-3', is_visible_in_available: null };
      const contracts = [{
        Contract_Number: 1228,
        'Contract Date': '2026-04-01',
        'End Date': '2026-09-28',
        billboard_ids: '9999',
        is_visible_in_available: true,
      }];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });
      expect(res.classification).toBe('EXCLUDED');
      expect(isAvailableForAvailableExports(bb, contracts, REF_DATE)).toBe(false);
    });

    it('Contract 1296 (Future unactivated contract, starts 2026-08-23, ends 2027-02-19) -> FUTURE_RESERVED from Available Now and Available+Upcoming', () => {
      const bb = { ID: '26', Billboard_Name: 'TR-TC0026', Status: 'محجوز', Contract_Number: '1296', is_visible_in_available: null };
      const contracts = [{
        Contract_Number: 1296,
        'Customer Name': 'محمد البحباح',
        'Ad Type': 'مركز أسنان',
        'Contract Date': '2026-08-23',
        'End Date': '2027-02-19',
        billboard_ids: '26',
        is_visible_in_available: null,
      }];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: '2026-08-20', upcomingMonthsWindow: 4 });
      expect(res.classification).toBe('FUTURE_RESERVED');
      expect(res.isMarketingVisible).toBe(false);
      expect(res.isAvailableNow).toBe(false);
      expect(isAvailableForAvailableExports(bb, contracts, '2026-08-20')).toBe(false);
      expect(isAvailableOrUpcomingForExport(bb, undefined, undefined, 4, contracts, '2026-08-20')).toBe(false);
    });

    it('TR-HA0077 -> Current contract 1118 ending soon (2026-08-30) + chained future contract 1297 (2026-09-01 to 2027-08-27) -> EXCLUDED (NOT UPCOMING)', () => {
      const bb = { ID: '77', Billboard_Name: 'TR-HA0077', Status: 'محجوز', Contract_Number: '1297', is_visible_in_available: null };
      const contracts = [
        {
          Contract_Number: 1118,
          'Customer Name': 'محمد عبدالله بن نصر',
          'Contract Date': '2025-09-04',
          'End Date': '2026-08-30',
          billboard_ids: '77',
          is_visible_in_available: null,
        },
        {
          Contract_Number: 1297,
          'Customer Name': 'محمد عبدالله بن نصر',
          'Contract Date': '2026-09-01',
          'End Date': '2027-08-27',
          billboard_ids: '77',
          is_visible_in_available: null,
        },
      ];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: '2026-08-20', upcomingMonthsWindow: 4 });
      expect(res.classification).toBe('EXCLUDED');
      expect(res.isMarketingVisible).toBe(false);
      expect(res.isAvailableNow).toBe(false);
      expect(res.currentRentEndDate).toBe('2027-08-27');
      expect(isAvailableForAvailableExports(bb, contracts, '2026-08-20')).toBe(false);
      expect(isAvailableOrUpcomingForExport(bb, undefined, undefined, 4, contracts, '2026-08-20')).toBe(false);
    });

    it('Pure Future contract starting in 1 year -> FUTURE_RESERVED (NOT UPCOMING, NOT AVAILABLE_WITHOUT_CONTRACT)', () => {
      const bb = { ID: '888', Billboard_Name: 'TR-FUT01', Status: 'محجوز', is_visible_in_available: null };
      const contracts = [{
        Contract_Number: 2000,
        'Contract Date': '2027-08-20',
        'End Date': '2028-08-20',
        billboard_ids: '888',
        is_visible_in_available: null,
      }];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: '2026-08-20', upcomingMonthsWindow: 4 });
      expect(res.classification).toBe('FUTURE_RESERVED');
      expect(res.isMarketingVisible).toBe(false);
      expect(res.isAvailableNow).toBe(false);
    });

    it('Pure Future contract starting tomorrow -> FUTURE_RESERVED (NOT UPCOMING)', () => {
      const bb = { ID: '889', Billboard_Name: 'TR-FUT02', Status: 'محجوز', is_visible_in_available: null };
      const contracts = [{
        Contract_Number: 2001,
        'Contract Date': '2026-08-21',
        'End Date': '2026-10-21',
        billboard_ids: '889',
        is_visible_in_available: null,
      }];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: '2026-08-20', upcomingMonthsWindow: 4 });
      expect(res.classification).toBe('FUTURE_RESERVED');
      expect(res.isMarketingVisible).toBe(false);
      expect(res.isAvailableNow).toBe(false);
    });

    it('Current contract ending within 4 months with no future blocker -> UPCOMING (isMarketingVisible = true)', () => {
      const bb = { ID: '890', Billboard_Name: 'TR-UP01', Status: 'محجوز', is_visible_in_available: null };
      const contracts = [{
        Contract_Number: 2002,
        'Contract Date': '2026-01-01',
        'End Date': '2026-10-15',
        billboard_ids: '890',
        is_visible_in_available: null,
      }];
      const res = resolveBillboardAvailability(bb, contracts, { referenceDate: '2026-08-20', upcomingMonthsWindow: 4 });
      expect(res.classification).toBe('UPCOMING');
      expect(res.isMarketingVisible).toBe(true);
      expect(res.isAvailableNow).toBe(false);
      expect(isAvailableOrUpcomingForExport(bb, undefined, undefined, 4, contracts, '2026-08-20')).toBe(true);
    });
  });
});
