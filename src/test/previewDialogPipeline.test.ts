import { describe, it, expect } from 'vitest';
import { 
  resolveBillboardAvailability, 
  resolveContractMarketingVisibility,
  normalizeDateOnly,
  addCalendarMonths
} from '../services/billboardAvailabilityService';

describe('Preview Dialog Contract Grouping Pipeline Tests with Scope C Contract Activation', () => {
  const REF_DATE = '2026-08-18';
  const MONTHS_AHEAD = 4;
  const FUTURE_LIMIT = addCalendarMonths(REF_DATE, MONTHS_AHEAD);

  // Exact pipeline mirroring UploadAvailablePreviewDialog
  function runPreviewPipeline(billboards: any[], contracts: any[]) {
    const bbMap = new Map<string, any>();
    billboards.forEach((b) => bbMap.set(String(b.ID), b));

    let totalCount = 0;
    let availNoContractCount = 0;
    let forcedCount = 0;
    let expiringCount = 0;

    const eligibleBillboardIds = new Set<string>();

    billboards.forEach((b) => {
      const res = resolveBillboardAvailability(b, contracts, {
        referenceDate: REF_DATE,
        upcomingMonthsWindow: MONTHS_AHEAD,
      });

      if (res.isMarketingVisible) {
        totalCount++;
        eligibleBillboardIds.add(res.billboardId);

        if (res.marketingVisibility === 'FORCE_SHOW') {
          forcedCount++;
        } else if (res.operationalStatus === 'AVAILABLE') {
          availNoContractCount++;
        } else if (res.isUpcomingWithinWindow) {
          expiringCount++;
        }
      }
    });

    const activeGroups: any[] = [];

    contracts.forEach((c: any) => {
      const contractNum = c.Contract_Number;
      const cIds = String(c.billboard_ids || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (cIds.length === 0) return;

      const endDateStr = c['End Date'] || '';
      const normEnd = normalizeDateOnly(endDateStr);
      const isExpired = normEnd ? normEnd < REF_DATE : false;

      const contractBbRows = cIds.map((id) => {
        const bb = bbMap.get(id);
        return {
          ID: id,
          Billboard_Name: bb?.Billboard_Name,
          Status: bb?.Status,
          Contract_Number: bb?.Contract_Number,
          Rent_End_Date: bb?.Rent_End_Date,
          is_visible_in_available: bb ? bb.is_visible_in_available : null,
          friend_company_id: bb ? bb.friend_company_id : null,
        };
      });

      const visInfo = resolveContractMarketingVisibility(contractBbRows, contracts, { referenceDate: REF_DATE });
      const eligibleCount = cIds.filter((id) => eligibleBillboardIds.has(id)).length;

      let isExpiringSoon = false;
      let daysRemaining: number | undefined = undefined;

      if (normEnd && !isExpired) {
        try {
          const ed = new Date(endDateStr);
          daysRemaining = Math.ceil((ed.getTime() - new Date(REF_DATE).getTime()) / (1000 * 60 * 60 * 24));
          if (normEnd >= REF_DATE && normEnd <= FUTURE_LIMIT) {
            isExpiringSoon = true;
          }
        } catch {}
      }

      // STRICT CRITERIA:
      const hasExplicitContractActivation = !isExpired && c.is_visible_in_available === true;
      const isExplicitlyShown = hasExplicitContractActivation;
      const isUpcomingContract = !isExpired && isExpiringSoon && eligibleCount > 0;

      if (isExplicitlyShown || isUpcomingContract) {
        activeGroups.push({
          contractNumber: contractNum,
          customerName: c['Customer Name'] || 'غير محدد',
          adType: c['Ad Type'] || '',
          startDate: normalizeDateOnly(c['Contract Date']),
          endDate: normEnd,
          isExpired,
          marketingState: isExplicitlyShown ? visInfo.state : 'OFF',
          requestedForceShowCount: isExplicitlyShown ? visInfo.requestedForceShowCount : 0,
          blockedByOtherContractsCount: isExplicitlyShown ? visInfo.blockedByOtherContractsCount : 0,
          effectiveForceShowCount: isExplicitlyShown ? visInfo.effectiveForceShowCount : 0,
          totalBillboards: cIds.length,
          eligibleBillboardsCount: eligibleCount,
          isExplicitlyShown,
          isUpcomingContract,
          daysRemaining: daysRemaining && daysRemaining > 0 ? daysRemaining : undefined,
        });
      }
    });

    const explicitlyShownContracts = activeGroups.filter((c) => c.isExplicitlyShown);
    const upcomingContracts = activeGroups.filter((c) => c.isUpcomingContract && !c.isExplicitlyShown);
    const allPreviewContracts = activeGroups;

    return {
      stats: {
        totalBillboards: totalCount,
        availableWithoutContractBillboards: availNoContractCount,
        marketingVisibleBillboards: forcedCount,
        upcomingBillboards: expiringCount,
      },
      contractGroups: {
        explicitlyShownContracts,
        upcomingContracts,
        allPreviewContracts,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: Contract 1185 (Untoggled Contract with 1 shared/global true board) -> Shown = NO
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 1: Contract 1185 without contract-level activation -> NOT in explicitly shown tab', () => {
    const c1185 = {
      Contract_Number: 1185,
      'Customer Name': 'محمد علي الحولة',
      'Ad Type': 'جوتن',
      'Contract Date': '2025-12-28',
      'End Date': '2026-12-23',
      is_visible_in_available: null, // NOT explicitly activated!
      billboard_ids: '192,374,10,20',
    };
    const c1228 = {
      Contract_Number: 1228,
      'Customer Name': 'علي عمار',
      'Ad Type': 'أسعد',
      'Contract Date': '2026-04-01',
      'End Date': '2026-09-28',
      is_visible_in_available: true, // Explicitly activated
      billboard_ids: '374,101,102',
    };

    const boards = [
      { ID: '192', is_visible_in_available: true }, // Legacy true flag on board
      { ID: '374', is_visible_in_available: null },
      { ID: '10',  is_visible_in_available: null },
      { ID: '20',  is_visible_in_available: null },
      { ID: '101', is_visible_in_available: true },
      { ID: '102', is_visible_in_available: true },
    ];

    const res = runPreviewPipeline(boards, [c1185, c1228]);

    // Contract 1185 MUST NOT be in explicitlyShownContracts!
    expect(res.contractGroups.explicitlyShownContracts.some(c => c.contractNumber === 1185)).toBe(false);

    // Contract 1228 MUST be in explicitlyShownContracts!
    expect(res.contractGroups.explicitlyShownContracts.some(c => c.contractNumber === 1228)).toBe(true);
    expect(res.contractGroups.explicitlyShownContracts).toHaveLength(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: Contract 1274 (Nawar) with contract-level activation
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 2: Contract 1274 with is_visible_in_available = true -> Shown = YES (PARTIAL 5/6)', () => {
    const cNawar = {
      Contract_Number: 1274,
      'Customer Name': 'محمد البحباح',
      'Ad Type': 'نوار والتقدم',
      'Contract Date': '2026-07-19',
      'End Date': '2027-01-15',
      is_visible_in_available: true,
      billboard_ids: '937,201,283,540,71,260',
    };
    const boards = [
      { ID: '937', is_visible_in_available: true },
      { ID: '201', is_visible_in_available: true },
      { ID: '283', is_visible_in_available: false },
      { ID: '540', is_visible_in_available: true },
      { ID: '71',  is_visible_in_available: true },
      { ID: '260', is_visible_in_available: true },
    ];

    const res = runPreviewPipeline(boards, [cNawar]);

    expect(res.contractGroups.explicitlyShownContracts).toHaveLength(1);
    expect(res.contractGroups.explicitlyShownContracts[0].contractNumber).toBe(1274);
    expect(res.contractGroups.explicitlyShownContracts[0].effectiveForceShowCount).toBe(5);
    expect(res.contractGroups.explicitlyShownContracts[0].totalBillboards).toBe(6);
    expect(res.contractGroups.explicitlyShownContracts[0].marketingState).toBe('PARTIAL');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: Billboard Card manual show does NOT activate contract
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 3: Billboard Card manual show does not mark untoggled contract as explicitly shown', () => {
    const cUntoggled = {
      Contract_Number: 555,
      'Customer Name': 'Untoggled Customer',
      'Contract Date': '2026-01-01',
      'End Date': '2027-01-01',
      is_visible_in_available: null, // Untoggled contract
      billboard_ids: '55',
    };
    const boards = [
      { ID: '55', is_visible_in_available: true }, // Toggled from billboard card
    ];

    const res = runPreviewPipeline(boards, [cUntoggled]);

    expect(res.contractGroups.explicitlyShownContracts).toHaveLength(0);
  });
});
