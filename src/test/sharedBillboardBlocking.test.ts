import { describe, it, expect } from 'vitest';
import { 
  resolveBillboardAvailability, 
  resolveContractMarketingVisibility 
} from '../services/billboardAvailabilityService';

describe('Shared Billboard Blocking Policy ("المنع يغلب الإظهار")', () => {
  const REF_DATE = '2026-08-18';

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: Real Case 1185 + 1228 (Billboard 374)
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 1: Billboard 374 shared between 1228 (FORCE_SHOW) and 1185 (active blocking)', () => {
    const bb374 = {
      ID: '374',
      Billboard_Name: 'TR-QB0374',
      Status: 'محجوز',
      Contract_Number: '1228',
      is_visible_in_available: true, // Requested FORCE_SHOW from 1228
      maintenance_status: 'operational',
    };

    const contracts = [
      {
        Contract_Number: 1228,
        'Customer Name': 'علي عمار',
        'Ad Type': 'أسعد لإستيراد الشاحنات',
        'Contract Date': '2026-04-01',
        'End Date': '2026-09-28', // Active
        billboard_ids: '374,101,102',
        is_visible_in_available: true,
      },
      {
        Contract_Number: 1185,
        'Customer Name': 'محمد علي الحولة',
        'Ad Type': 'جوتن',
        'Contract Date': '2025-12-28',
        'End Date': '2026-12-23', // Active & ends beyond 4 months (2026-12-18)
        billboard_ids: '374,201,202',
      },
    ];

    const res = resolveBillboardAvailability(bb374, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });

    // Expect Billboard 374 to be BLOCKED by Contract 1185
    expect(res.isBlockedByOtherContract).toBe(true);
    expect(res.blockingContracts).toHaveLength(1);
    expect(res.blockingContracts[0].contractNumber).toBe(1185);
    expect(res.isMarketingVisible).toBe(false);
    expect(res.effectiveMarketingVisibility).toBe('FORCE_HIDE');
    expect(res.reason).toContain('محجوبة من المتاح بسبب ارتباطها بعقد نشط آخر');

    // Contract 1228 evaluation
    const c1228Boards = [
      { ID: '374', is_visible_in_available: true }, // Blocked by 1185
      { ID: '101', is_visible_in_available: true }, // Not blocked
      { ID: '102', is_visible_in_available: true }, // Not blocked
    ];

    const visInfo1228 = resolveContractMarketingVisibility(c1228Boards, contracts, { referenceDate: REF_DATE });
    expect(visInfo1228.requestedForceShowCount).toBe(3);
    expect(visInfo1228.blockedByOtherContractsCount).toBe(1);
    expect(visInfo1228.effectiveForceShowCount).toBe(2);
    expect(visInfo1228.state).toBe('PARTIAL');

    // Contract 1185 evaluation (not explicitly shown)
    const c1185Boards = [
      { ID: '374', is_visible_in_available: null },
      { ID: '201', is_visible_in_available: null },
      { ID: '202', is_visible_in_available: null },
    ];
    const visInfo1185 = resolveContractMarketingVisibility(c1185Boards, contracts, { referenceDate: REF_DATE });
    expect(visInfo1185.state).toBe('OFF');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: No Blocking Contract
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 2: Single contract or all contracts agreeing to FORCE_SHOW -> isMarketingVisible = true', () => {
    const bb = {
      ID: '10',
      Billboard_Name: 'TR-10',
      is_visible_in_available: true,
    };
    const contracts = [
      {
        Contract_Number: 501,
        'Customer Name': 'Company A',
        'Contract Date': '2026-01-01',
        'End Date': '2027-01-01',
        billboard_ids: '10',
        is_visible_in_available: true,
      },
    ];

    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });
    expect(res.isBlockedByOtherContract).toBe(false);
    expect(res.isMarketingVisible).toBe(true);
    expect(res.effectiveMarketingVisibility).toBe('FORCE_SHOW');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: Expired Blocking Contract
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 3: Contract A FORCE_SHOW, Contract B expired -> Contract B does not block', () => {
    const bb = {
      ID: '20',
      Billboard_Name: 'TR-20',
      is_visible_in_available: true,
    };
    const contracts = [
      {
        Contract_Number: 601,
        'Customer Name': 'Active Contract',
        'Contract Date': '2026-01-01',
        'End Date': '2027-01-01', // Active
        billboard_ids: '20',
        is_visible_in_available: true,
      },
      {
        Contract_Number: 602,
        'Customer Name': 'Expired Contract',
        'Contract Date': '2025-01-01',
        'End Date': '2026-04-01', // Expired
        billboard_ids: '20',
      },
    ];

    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });
    expect(res.isBlockedByOtherContract).toBe(false);
    expect(res.isMarketingVisible).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 4: Two overlapping active contracts
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 4: Contract A FORCE_SHOW, Contract B active unavailable -> blocked', () => {
    const bb = {
      ID: '30',
      Billboard_Name: 'TR-30',
      Contract_Number: '701',
      is_visible_in_available: true,
    };
    const contracts = [
      {
        Contract_Number: 701,
        'Customer Name': 'Contract A',
        'Contract Date': '2026-06-01',
        'End Date': '2026-12-01',
        billboard_ids: '30',
        is_visible_in_available: true,
      },
      {
        Contract_Number: 702,
        'Customer Name': 'Contract B',
        'Contract Date': '2026-07-01',
        'End Date': '2027-07-01', // Active, far future, not force show
        billboard_ids: '30',
      },
    ];

    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });
    expect(res.isBlockedByOtherContract).toBe(true);
    expect(res.blockingContracts).toHaveLength(1);
    expect(res.blockingContracts[0].contractNumber).toBe(702);
    expect(res.isMarketingVisible).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 5: Three contracts (2 FORCE_SHOW + 1 active blocking)
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 5: A FORCE_SHOW, B FORCE_SHOW, C active blocking -> billboard is hidden', () => {
    const bb = {
      ID: '40',
      Billboard_Name: 'TR-40',
      Contract_Number: '801',
      is_visible_in_available: true,
    };
    const contracts = [
      { Contract_Number: 801, 'Customer Name': 'A', 'Contract Date': '2026-01-01', 'End Date': '2027-01-01', billboard_ids: '40' },
      { Contract_Number: 802, 'Customer Name': 'B', 'Contract Date': '2026-02-01', 'End Date': '2027-02-01', billboard_ids: '40' },
      { Contract_Number: 803, 'Customer Name': 'C', 'Contract Date': '2026-03-01', 'End Date': '2027-08-01', billboard_ids: '40' },
    ];

    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });
    expect(res.isBlockedByOtherContract).toBe(true);
    expect(res.isMarketingVisible).toBe(false);
  });
});
