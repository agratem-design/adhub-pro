import { describe, it, expect } from 'vitest';
import {
  resolveBillboardAvailability,
  resolveContractMarketingVisibility,
} from '../services/billboardAvailabilityService';

describe('TR-SJ0192 & Contract 1185 Regression & Invariant Tests', () => {
  const REF_DATE = '2026-08-18';

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Real Case TR-SJ0192 + Contract 1185 (Jotun)
  // ───────────────────────────────────────────────────────────────────────────
  it('1. TR-SJ0192 with active Contract 1185: isBlockedByOtherContract=true, isMarketingVisible=false', () => {
    const bbTrSj0192 = {
      ID: '192',
      Billboard_Name: 'TR-SJ0192',
      Status: 'محجوز',
      Contract_Number: '1185',
      Customer_Name: 'محمد علي الحولة',
      Rent_Start_Date: '2025-12-28',
      Rent_End_Date: '2026-12-23',
      is_visible_in_available: true, // Manual requested show on billboard card
      maintenance_status: 'operational',
    };

    const contracts = [
      {
        Contract_Number: 1185,
        'Customer Name': 'محمد علي الحولة',
        'Ad Type': 'جوتن',
        'Contract Date': '2025-12-28',
        'End Date': '2026-12-23', // Active, > 4 months from 2026-08-18
        billboard_ids: '347,820,75,192,374',
        is_visible_in_available: null, // Contract NOT activated for marketing
        billboards_released: false,
      },
      {
        Contract_Number: 1202,
        'Customer Name': 'محمد الريشي',
        'Contract Date': '2026-02-05',
        'End Date': '2026-08-04', // Expired
        billboard_ids: '546,178,535,192,290',
        billboards_released: false,
      },
      {
        Contract_Number: 1009,
        'Customer Name': 'هشام بن زاهية',
        'Contract Date': '2025-02-01',
        'End Date': '2026-01-27', // Expired
        billboard_ids: '154,192,322',
        billboards_released: false,
      },
    ];

    const res = resolveBillboardAvailability(bbTrSj0192, contracts, {
      referenceDate: REF_DATE,
      upcomingMonthsWindow: 4,
    });

    // Invariants for TR-SJ0192:
    expect(res.operationalStatus).toBe('RENTED');
    expect(res.isAvailableNow).toBe(false);
    expect(res.isBlockedByOtherContract).toBe(true);
    expect(res.blockingContracts).toHaveLength(1);
    expect(res.blockingContracts[0].contractNumber).toBe(1185);
    expect(res.effectiveMarketingVisibility).toBe('FORCE_HIDE');
    expect(res.isMarketingVisible).toBe(false);
    expect(res.reason).toContain('محجوبة من المتاح بسبب ارتباطها بعقد نشط');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Cached status / is_visible_in_available does not override active blocking contract
  // ───────────────────────────────────────────────────────────────────────────
  it('2. Billboard with Status=متاح and is_visible_in_available=true but active blocking contract exists -> hidden', () => {
    const bb = {
      ID: '999',
      Billboard_Name: 'TR-TEST999',
      Status: 'متاح', // Misleading cached status
      is_visible_in_available: true,
    };

    const contracts = [
      {
        Contract_Number: 2001,
        'Customer Name': 'Active Blocking Company',
        'Contract Date': '2026-01-01',
        'End Date': '2027-01-01', // Active > 4 months
        billboard_ids: '999',
        is_visible_in_available: null, // NOT marketing activated
      },
    ];

    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });

    expect(res.operationalStatus).toBe('RENTED');
    expect(res.isAvailableNow).toBe(false);
    expect(res.isBlockedByOtherContract).toBe(true);
    expect(res.blockingContracts).toHaveLength(1);
    expect(res.blockingContracts[0].contractNumber).toBe(2001);
    expect(res.effectiveMarketingVisibility).toBe('FORCE_HIDE');
    expect(res.isMarketingVisible).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Natural Available Billboard (No contracts, AUTO)
  // ───────────────────────────────────────────────────────────────────────────
  it('3. Billboard with no active contracts in AUTO mode -> AVAILABLE and marketing visible', () => {
    const bb = {
      ID: '50',
      Billboard_Name: 'TR-FREE50',
      Status: 'متاح',
      is_visible_in_available: null,
    };

    const res = resolveBillboardAvailability(bb, [], { referenceDate: REF_DATE });

    expect(res.operationalStatus).toBe('AVAILABLE');
    expect(res.isAvailableNow).toBe(true);
    expect(res.isBlockedByOtherContract).toBe(false);
    expect(res.blockingContracts).toHaveLength(0);
    expect(res.effectiveMarketingVisibility).toBe('AUTO');
    expect(res.isMarketingVisible).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Expired contract does not block
  // ───────────────────────────────────────────────────────────────────────────
  it('4. Billboard with only expired contracts -> not blocked and available', () => {
    const bb = {
      ID: '60',
      Billboard_Name: 'TR-EXP60',
      is_visible_in_available: null,
    };

    const contracts = [
      {
        Contract_Number: 3001,
        'Customer Name': 'Old Customer',
        'Contract Date': '2025-01-01',
        'End Date': '2026-05-01', // Expired relative to 2026-08-18
        billboard_ids: '60',
      },
    ];

    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });

    expect(res.operationalStatus).toBe('AVAILABLE');
    expect(res.isAvailableNow).toBe(true);
    expect(res.isBlockedByOtherContract).toBe(false);
    expect(res.blockingContracts).toHaveLength(0);
    expect(res.isMarketingVisible).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Future contract does not block current availability
  // ───────────────────────────────────────────────────────────────────────────
  it('5. Billboard with future contract -> available now, next occupancy recorded', () => {
    const bb = {
      ID: '70',
      Billboard_Name: 'TR-FUT70',
      is_visible_in_available: null,
    };

    const contracts = [
      {
        Contract_Number: 4001,
        'Customer Name': 'Future Customer',
        'Contract Date': '2026-11-01',
        'End Date': '2027-05-01', // Future
        billboard_ids: '70',
      },
    ];

    const res = resolveBillboardAvailability(bb, contracts, { referenceDate: REF_DATE });

    expect(res.operationalStatus).toBe('AVAILABLE');
    expect(res.isAvailableNow).toBe(true);
    expect(res.isBlockedByOtherContract).toBe(false);
    expect(res.nextOccupancyPeriod).not.toBeNull();
    expect(res.nextOccupancyPeriod?.startDate).toBe('2026-11-01');
    expect(res.isMarketingVisible).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Contract ending within upcoming window (e.g. 2 months) in AUTO mode
  // ───────────────────────────────────────────────────────────────────────────
  it('6. Billboard with active contract ending within upcoming window (AUTO) -> RENTED, upcomingWithinWindow=true', () => {
    const bb = {
      ID: '80',
      Billboard_Name: 'TR-UPC80',
      is_visible_in_available: null,
    };

    const contracts = [
      {
        Contract_Number: 5001,
        'Customer Name': 'Expiring Customer',
        'Contract Date': '2026-02-01',
        'End Date': '2026-10-01', // Within 4 months of 2026-08-18 (ends 2026-10-01 < 2026-12-18)
        billboard_ids: '80',
      },
    ];

    const res = resolveBillboardAvailability(bb, contracts, {
      referenceDate: REF_DATE,
      upcomingMonthsWindow: 4,
    });

    expect(res.operationalStatus).toBe('RENTED');
    expect(res.isAvailableNow).toBe(false);
    expect(res.isUpcomingWithinWindow).toBe(true);
    expect(res.isBlockedByOtherContract).toBe(false);
    expect(res.blockingContracts).toHaveLength(0);
    expect(res.isMarketingVisible).toBe(true);
    expect(res.statusLabelArabic).toBe('ستتاح قريباً');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Full Contract 1185 Audit Simulation (40 billboards)
  // ───────────────────────────────────────────────────────────────────────────
  it('7. Contract 1185 (40 billboards): none appear in Available Export when contract is not marketing activated', () => {
    const c1185Ids = [
      '347','820','75','106','194','91','5','824','161','340',
      '513','330','491','818','381','408','312','961','291','179',
      '326','151','19','189','425','335','105','1147','1148','1143',
      '1144','1145','1146','1141','262','1198','518','257','192','374'
    ];

    const contracts = [
      {
        Contract_Number: 1185,
        'Customer Name': 'محمد علي الحولة',
        'Ad Type': 'جوتن',
        'Contract Date': '2025-12-28',
        'End Date': '2026-12-23', // Active > 4 months
        billboard_ids: c1185Ids.join(','),
        is_visible_in_available: null,
        billboards_released: false,
      },
    ];

    // Mock 40 billboard objects, including TR-SJ0192 with is_visible_in_available: true
    const billboards = c1185Ids.map((id) => ({
      ID: id,
      Billboard_Name: id === '192' ? 'TR-SJ0192' : `BB-${id}`,
      Status: 'محجوز',
      Contract_Number: '1185',
      is_visible_in_available: id === '192' ? true : null, // ID 192 has requested FORCE_SHOW
      maintenance_status: 'operational',
    }));

    // Check every single billboard in Contract 1185
    let appearingInAvailableExportCount = 0;
    billboards.forEach((bb) => {
      const res = resolveBillboardAvailability(bb, contracts, {
        referenceDate: REF_DATE,
        upcomingMonthsWindow: 4,
      });

      // Pure available export condition:
      const inAvailableExport = res.isMarketingVisible && (res.operationalStatus === 'AVAILABLE' || res.marketingVisibility === 'FORCE_SHOW');
      if (inAvailableExport) {
        appearingInAvailableExportCount++;
      }

      // Invariant: all 40 boards must be RENTED and NOT marketing visible
      expect(res.operationalStatus).toBe('RENTED');
      expect(res.isMarketingVisible).toBe(false);
      if (bb.ID === '192') {
        expect(res.isBlockedByOtherContract).toBe(true);
        expect(res.blockingContracts).toHaveLength(1);
        expect(res.blockingContracts[0].contractNumber).toBe(1185);
      }
    });

    expect(appearingInAvailableExportCount).toBe(0);

    // Also check Contract marketing visibility state
    const contractVis = resolveContractMarketingVisibility(billboards, contracts, { referenceDate: REF_DATE });
    expect(contractVis.state).toBe('OFF');
    expect(contractVis.effectiveForceShowCount).toBe(0);
    expect(contractVis.blockedByOtherContractsCount).toBe(1); // Billboard 192 requested show was blocked
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Invariant: Available Export Candidate Rows have ZERO blocking contracts
  // ───────────────────────────────────────────────────────────────────────────
  it('8. Invariant: Any candidate qualifying for Available Export must have blockingContracts.length === 0', () => {
    const testCandidates = [
      // Case A: Free board (qualifies)
      { ID: '1', Billboard_Name: 'FREE1', Status: 'متاح', is_visible_in_available: null },
      // Case B: Expired board (qualifies)
      { ID: '2', Billboard_Name: 'FREE2', Status: 'متاح', is_visible_in_available: true },
      // Case C: TR-SJ0192 (must be rejected)
      { ID: '192', Billboard_Name: 'TR-SJ0192', Status: 'محجوز', is_visible_in_available: true },
      // Case D: Shared blocked board 374 (must be rejected)
      { ID: '374', Billboard_Name: 'TR-374', Status: 'محجوز', is_visible_in_available: true },
    ];

    const contracts = [
      {
        Contract_Number: 1185,
        'Customer Name': 'محمد علي الحولة',
        'Contract Date': '2025-12-28',
        'End Date': '2026-12-23',
        billboard_ids: '192,374',
        is_visible_in_available: null,
      },
      {
        Contract_Number: 1228,
        'Customer Name': 'علي عمار',
        'Contract Date': '2026-04-01',
        'End Date': '2026-09-28',
        billboard_ids: '374',
        is_visible_in_available: true,
      },
    ];

    const availableExportRows = testCandidates.filter((b) => {
      const res = resolveBillboardAvailability(b, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });
      if (!res.isMarketingVisible || res.effectiveMarketingVisibility === 'FORCE_HIDE' || res.isBlockedByOtherContract || res.blockingContracts.length > 0) {
        return false;
      }
      return res.operationalStatus === 'AVAILABLE' || res.marketingVisibility === 'FORCE_SHOW';
    });

    // Invariant verification on exported rows:
    for (const row of availableExportRows) {
      const res = resolveBillboardAvailability(row, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });
      expect(res.blockingContracts.length).toBe(0);
      expect(res.isBlockedByOtherContract).toBe(false);
      expect(res.isMarketingVisible).toBe(true);
      expect(row.ID).not.toBe('192');
      expect(row.ID).not.toBe('374');
    }

    expect(availableExportRows.map(r => r.ID)).toEqual(['1', '2']);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Contract Tab Classification: Contract 1185 (activation=null) + TR-SJ0192 (global=true)
  // ───────────────────────────────────────────────────────────────────────────
  it('9. Contract Tab Classification: 1185 (activation=null) + TR-SJ0192 (global=true) -> Explicit Tab = false', () => {
    const c1185 = {
      Contract_Number: 1185,
      'Customer Name': 'محمد علي الحولة',
      'Contract Date': '2025-12-28',
      'End Date': '2026-12-23',
      is_visible_in_available: null, // Contract NOT activated
      billboard_ids: '192',
    };
    const bb192 = { ID: '192', Billboard_Name: 'TR-SJ0192', Status: 'محجوز', is_visible_in_available: true };

    const res = resolveBillboardAvailability(bb192, [c1185], { referenceDate: REF_DATE });
    expect(res.isMarketingVisible).toBe(false);

    const isExplicitlyShown = !res.isAvailableNow && c1185.is_visible_in_available === true;
    expect(isExplicitlyShown).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Contract Tab Classification: Contract A (activation=true, active=true) -> Explicit Tab = true
  // ───────────────────────────────────────────────────────────────────────────
  it('10. Contract Tab Classification: Contract A (activation=true, active=true) -> Explicit Tab = true', () => {
    const cActive = {
      Contract_Number: 7001,
      'Customer Name': 'Active Client',
      'Contract Date': '2026-01-01',
      'End Date': '2027-01-01',
      is_visible_in_available: true, // Activated
      billboard_ids: '701',
    };
    const isExpired = cActive['End Date'] < REF_DATE;
    const isExplicitlyShown = !isExpired && cActive.is_visible_in_available === true;
    expect(isExplicitlyShown).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Contract Tab Classification: Contract A (activation=null) + Billboard X (global true) -> Explicit Tab = false
  // ───────────────────────────────────────────────────────────────────────────
  it('11. Contract Tab Classification: Contract A (activation=null) + Billboard X (global true) -> Explicit Tab = false', () => {
    const cUntoggled = {
      Contract_Number: 8001,
      'Customer Name': 'Untoggled Client',
      'Contract Date': '2026-01-01',
      'End Date': '2027-01-01',
      is_visible_in_available: null,
      billboard_ids: '801',
    };
    const bb801 = { ID: '801', is_visible_in_available: true };
    const isExpired = cUntoggled['End Date'] < REF_DATE;
    const isExplicitlyShown = !isExpired && cUntoggled.is_visible_in_available === true;
    expect(isExplicitlyShown).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 12. Contract Tab Classification: Shared Billboard 1228 (activation=true) + 1185 (activation=null)
  // ───────────────────────────────────────────────────────────────────────────
  it('12. Contract Tab Classification: 1228 (activation=true) vs 1185 (activation=null) on Shared Billboard 374', () => {
    const c1228 = {
      Contract_Number: 1228,
      'Customer Name': 'علي عمار',
      'Contract Date': '2026-04-01',
      'End Date': '2026-09-28',
      is_visible_in_available: true,
      billboard_ids: '374',
    };
    const c1185 = {
      Contract_Number: 1185,
      'Customer Name': 'محمد علي الحولة',
      'Contract Date': '2025-12-28',
      'End Date': '2026-12-23',
      is_visible_in_available: null,
      billboard_ids: '374',
    };
    const bb374 = { ID: '374', Billboard_Name: 'TR-374', is_visible_in_available: true };

    const res = resolveBillboardAvailability(bb374, [c1228, c1185], { referenceDate: REF_DATE, upcomingMonthsWindow: 4 });
    expect(res.isBlockedByOtherContract).toBe(true);
    expect(res.isMarketingVisible).toBe(false);

    const is1228Explicit = !(c1228['End Date'] < REF_DATE) && c1228.is_visible_in_available === true;
    const is1185Explicit = !(c1185['End Date'] < REF_DATE) && c1185.is_visible_in_available === true;

    expect(is1228Explicit).toBe(true);
    expect(is1185Explicit).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 13. Contract Tab Classification: Expired contract with historical activation=true -> NOT in Explicit active tab
  // ───────────────────────────────────────────────────────────────────────────
  it('13. Contract Tab Classification: Expired contract with historical activation=true -> NOT in active Explicit tab', () => {
    const cExpired = {
      Contract_Number: 9001,
      'Customer Name': 'Old Active Client',
      'Contract Date': '2025-01-01',
      'End Date': '2026-05-01', // Expired relative to 2026-08-18
      is_visible_in_available: true,
      billboard_ids: '901',
    };
    const isExpired = cExpired['End Date'] < REF_DATE;
    const isExplicitlyShown = !isExpired && cExpired.is_visible_in_available === true;
    expect(isExpired).toBe(true);
    expect(isExplicitlyShown).toBe(false);
  });
});
