import { describe, it, expect } from 'vitest';
import { 
  resolveBillboardAvailability, 
  resolveContractMarketingVisibility 
} from '../services/billboardAvailabilityService';

describe('Real Live Database Data Validation', () => {
  const REF_DATE = '2026-08-18';

  // 1. TR-TC0283
  it('TR-TC0283 Resolution with live contracts (1274 and 1287)', () => {
    const bb283 = {
      ID: '283',
      Billboard_Name: 'TR-TC0283',
      Status: 'محجوز',
      Contract_Number: '1274',
      Rent_Start_Date: '2026-07-19T22:00:00.000Z',
      Rent_End_Date: '2027-01-15T22:00:00.000Z',
      is_visible_in_available: false,
      maintenance_status: 'operational',
    };

    const contracts = [
      {
        Contract_Number: 1274,
        'Customer Name': 'محمد البحباح',
        'Ad Type': 'نوار والتقدم',
        'Contract Date': '2026-07-19T22:00:00.000Z',
        'End Date': '2027-01-15T22:00:00.000Z',
        billboard_ids: '937,201,283,540,71,260',
      },
      {
        Contract_Number: 1287,
        'Customer Name': 'محمد البحباح',
        'Ad Type': 'الربيع',
        'Contract Date': '2026-07-31T22:00:00.000Z',
        'End Date': '2027-01-27T22:00:00.000Z',
        billboard_ids: '283,963,63,30,74,29,987',
      },
    ];

    const res = resolveBillboardAvailability(bb283, contracts, { referenceDate: REF_DATE });

    console.log('=== TR-TC0283 OUTPUT ===', {
      operationalStatus: res.operationalStatus,
      marketingVisibility: res.marketingVisibility,
      isAvailableNow: res.isAvailableNow,
      isMarketingVisible: res.isMarketingVisible,
      activeContractsCount: res.activeContracts.length,
      occupancyPeriods: res.occupancyPeriods.map(p => `${p.startDate} -> ${p.endDate}`),
      availableFrom: res.availableFrom,
      currentRentEndDate: res.currentRentEndDate,
      reason: res.reason,
    });

    expect(res.operationalStatus).toBe('RENTED');
    expect(res.marketingVisibility).toBe('FORCE_HIDE');
    expect(res.isAvailableNow).toBe(false);
    expect(res.isMarketingVisible).toBe(false);
    expect(res.activeContracts).toHaveLength(2);
    expect(res.occupancyPeriods).toHaveLength(1);
    expect(res.occupancyPeriods[0].endDate).toBe('2027-01-28'); // parsed from 2027-01-27T22:00:00Z local
    expect(res.availableFrom).toBe('2027-01-29');
  });

  // 2. Contract 1274 (نوار والتقدم)
  it('Contract 1274 (نوار والتقدم) Marketing Visibility and Individual Boards Evaluation', () => {
    const c1274Boards = [
      { ID: 937, Billboard_Name: 'TR-JZ0937', is_visible_in_available: true },
      { ID: 201, Billboard_Name: 'TR-TC0201', is_visible_in_available: true },
      { ID: 283, Billboard_Name: 'TR-TC0283', is_visible_in_available: false },
      { ID: 540, Billboard_Name: 'TR-TC0540', is_visible_in_available: true },
      { ID: 71,  Billboard_Name: 'TR-HA0071', is_visible_in_available: true },
      { ID: 260, Billboard_Name: 'TR-BS0260', is_visible_in_available: true },
    ];

    const visInfo = resolveContractMarketingVisibility(c1274Boards);

    expect(visInfo.state).toBe('PARTIAL');
    expect(visInfo.totalCount).toBe(6);
    expect(visInfo.forceShowCount).toBe(5);
    expect(visInfo.forceHideCount).toBe(1);
    expect(visInfo.autoCount).toBe(0);

    const c1274Contract = {
      Contract_Number: 1274,
      'Customer Name': 'محمد البحباح',
      'Ad Type': 'نوار والتقدم',
      'Contract Date': '2026-07-19T22:00:00.000Z',
      'End Date': '2027-01-15T22:00:00.000Z',
      billboard_ids: '937,201,283,540,71,260',
    };

    const resolutions = c1274Boards.map(b => resolveBillboardAvailability(b, [c1274Contract], { referenceDate: REF_DATE }));
    const includedInExport = resolutions.filter(r => r.isMarketingVisible);
    const excludedFromExport = resolutions.filter(r => !r.isMarketingVisible);

    expect(includedInExport).toHaveLength(5);
    expect(excludedFromExport).toHaveLength(1);
    expect(excludedFromExport[0].billboardId).toBe('283');
  });

  // 3. Contract 1228 (أسعد)
  it('Contract 1228 (أسعد) Marketing Visibility and Individual Boards Evaluation', () => {
    const c1228Boards = [
      ...Array.from({ length: 21 }, (_, i) => ({ ID: i + 100, Billboard_Name: `BB-${i+100}`, is_visible_in_available: true })),
      { ID: 374, Billboard_Name: 'TR-QB0374', is_visible_in_available: null },
      { ID: 907, Billboard_Name: 'TRJZ-907', is_visible_in_available: null },
    ];

    const visInfo = resolveContractMarketingVisibility(c1228Boards);

    expect(visInfo.state).toBe('PARTIAL');
    expect(visInfo.totalCount).toBe(23);
    expect(visInfo.forceShowCount).toBe(21);
    expect(visInfo.forceHideCount).toBe(0);
    expect(visInfo.autoCount).toBe(2);

    const contracts = [
      {
        Contract_Number: 1228,
        'Customer Name': 'علي عمار',
        'Ad Type': 'أسعد لإستيراد الشاحنات والمعدات الثقيلة',
        'Contract Date': '2026-03-31T22:00:00.000Z',
        'End Date': '2026-09-27T22:00:00.000Z',
        billboard_ids: c1228Boards.map(b => b.ID).join(','),
      },
      {
        Contract_Number: 1185,
        'Customer Name': 'محمد علي الحولة',
        'Ad Type': 'جوتن',
        'Contract Date': '2026-06-23T22:00:00.000Z',
        'End Date': '2026-12-23T22:00:00.000Z',
        billboard_ids: '374',
      },
      {
        Contract_Number: 1295,
        'Customer Name': 'محمد فتحي البهلول',
        'Ad Type': 'اعلان',
        'Contract Date': '2026-08-18T22:00:00.000Z',
        'End Date': '2027-08-14T22:00:00.000Z',
        billboard_ids: '907',
      },
    ];

    const resolutions = c1228Boards.map(b => resolveBillboardAvailability(b, contracts, { referenceDate: REF_DATE, upcomingMonthsWindow: 4 }));
    const includedInExport = resolutions.filter(r => r.isMarketingVisible);

    // The 21 FORCE_SHOW boards are included
    // Billboard 374 ends 2026-12-24 (within 4 months window up to 2026-12-18 / ~4 mo)
    // All 21 FORCE_SHOW boards are definitely included
    expect(includedInExport.length).toBeGreaterThanOrEqual(21);
  });
});
