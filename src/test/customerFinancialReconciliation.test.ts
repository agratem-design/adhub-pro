import { describe, it, expect } from 'vitest';
import {
  buildCanonicalCustomerLedger,
  RawCustomerFinancialSources,
  formatStatementContractLabel,
} from '../lib/canonicalCustomerLedger';

describe('Canonical Customer Financial Engine & Complete Reconciliation Suite', () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. حالة الزبير اصليل المرجعية الحقيقية (Zubair Asleel Exact Fixture)
  // ─────────────────────────────────────────────────────────────────────────────
  const zubairFixture: RawCustomerFinancialSources = {
    contracts: [
      {
        Contract_Number: 1209,
        'Contract Date': '2026-03-17',
        Total: 315000,
        'Total Rent': 302880,
        Discount: 10000,
        'Ad Type': 'بولبو',
      },
      {
        Contract_Number: 1243,
        'Contract Date': '2026-05-08',
        Total: 22000,
        'Total Rent': 21380,
        Discount: 0,
        'Ad Type': 'حملة بولبو مصراتة',
      },
      {
        Contract_Number: 1256,
        'Contract Date': '2026-05-20',
        Total: 24000,
        'Total Rent': 23360,
        Discount: 0,
        'Ad Type': 'بولبو الغربية',
      },
      {
        Contract_Number: 1252,
        'Contract Date': '2026-06-04',
        Total: 65000,
        'Total Rent': 62400,
        Discount: 0,
        'Ad Type': 'بولبو تاجوراء وعين زارة',
      },
      {
        Contract_Number: 1291,
        'Contract Date': '2026-08-05',
        Total: 10000,
        'Total Rent': 9700,
        Discount: 300,
        'Ad Type': 'بولبو',
      },
      {
        Contract_Number: 1289,
        'Contract Date': '2026-08-10',
        Total: 48300,
        'Total Rent': 43300,
        Discount: 0,
        'Ad Type': 'فولكانو',
      },
    ],
    payments: [
      {
        id: 'pay-1',
        paid_at: '2026-02-21',
        amount: 70000,
        entry_type: 'payment',
        contract_number: 1209,
        notes: 'توزيع على عقد #1209',
      },
      {
        id: 'pay-2',
        paid_at: '2026-06-21',
        amount: 75000,
        entry_type: 'payment',
        contract_number: 1209,
        notes: 'استلمها جمال الهاشمي زحيلق',
      },
      {
        id: 'pay-3',
        paid_at: '2026-07-27',
        amount: 60000,
        entry_type: 'payment',
        contract_number: 1209,
        notes: 'استلمها الحاج جمال',
      },
      {
        id: 'pay-4a',
        paid_at: '2026-08-06',
        amount: 110000,
        entry_type: 'payment',
        contract_number: 1209,
        distributed_payment_id: 'dist-1786023227188',
        notes: 'توزيع على عقد #1209 من دفعة بمبلغ 156650.00 د.ل',
      },
      {
        id: 'pay-4b',
        paid_at: '2026-08-06',
        amount: 22000,
        entry_type: 'payment',
        contract_number: 1243,
        distributed_payment_id: 'dist-1786023227188',
        notes: 'توزيع على عقد #1243 من دفعة بمبلغ 156650.00 د.ل',
      },
      {
        id: 'pay-4c',
        paid_at: '2026-08-06',
        amount: 24650,
        entry_type: 'payment',
        contract_number: 1252,
        distributed_payment_id: 'dist-1786023227188',
        notes: 'توزيع على عقد #1252 من دفعة بمبلغ 156650.00 د.ل',
      },
    ],
    pausedBillboards: [
      {
        id: 'pause-1',
        contract_number: 1209,
        billboard_id: 375,
        billboard_name: 'TR-QB0375',
        refund_amount: 6000,
        deducted_from_contract: true,
      },
    ],
    compositeTasks: [
      { id: 'task-66', task_number: 66, task_type: 'new_installation', customer_print_cost: 16000, customer_installation_cost: 0, customer_total: 16000, combined_invoice_id: null },
      { id: 'task-65', task_number: 65, task_type: 'new_installation', customer_print_cost: 6900, customer_installation_cost: 0, customer_total: 6900, combined_invoice_id: null },
      { id: 'task-104', task_number: 104, task_type: 'new_installation', customer_print_cost: 2000, customer_installation_cost: 0, customer_total: 2000, combined_invoice_id: null },
      { id: 'task-155', task_number: 155, task_type: 'new_installation', customer_print_cost: 2400, customer_installation_cost: 0, customer_total: 2400, combined_invoice_id: null },
      { id: 'task-191', task_number: 191, task_type: 'new_installation', customer_print_cost: 4400, customer_installation_cost: 0, customer_total: 4400, combined_invoice_id: null },
      { id: 'task-199', task_number: 199, task_type: 'new_installation', customer_print_cost: 2400, customer_installation_cost: 0, customer_total: 2400, combined_invoice_id: null },
      { id: 'task-285', task_number: 285, task_type: 'new_installation', customer_print_cost: 0, customer_installation_cost: 1200, customer_total: 1200, combined_invoice_id: null },
      { id: 'task-281', task_number: 281, task_type: 'new_installation', customer_print_cost: 0, customer_installation_cost: 0, customer_total: 0, combined_invoice_id: null },
      { id: 'task-292', task_number: 292, task_type: 'new_installation', customer_print_cost: 0, customer_installation_cost: 0, customer_total: 0, combined_invoice_id: null },
    ],
    printedInvoices: [
      { id: 'pt-inv-1', invoice_number: 'PT-1', total_amount: 2400 },
      { id: 'pt-inv-2', invoice_number: 'PT-2', total_amount: 4400 },
      { id: 'pt-inv-3', invoice_number: 'PT-3', total_amount: 16000 },
      { id: 'pt-inv-4', invoice_number: 'PT-4', total_amount: 2000 },
      { id: 'pt-inv-5', invoice_number: 'PT-5', total_amount: 2400 },
      { id: 'pt-inv-6', invoice_number: 'PT-6', total_amount: 6900 },
    ],
    printTasks: [
      { id: 'pt-1', invoice_id: 'pt-inv-1', is_composite: true },
      { id: 'pt-2', invoice_id: 'pt-inv-2', is_composite: true },
      { id: 'pt-3', invoice_id: 'pt-inv-3', is_composite: true },
      { id: 'pt-4', invoice_id: 'pt-inv-4', is_composite: true },
      { id: 'pt-5', invoice_id: 'pt-inv-5', is_composite: true },
      { id: 'pt-6', invoice_id: 'pt-inv-6', is_composite: true },
    ],
    salesInvoices: [],
    purchaseInvoices: [],
    generalDiscounts: [],
  };

  it('Section 39: produces exact canonical totals for Zubair Asleel (519,600 debt, 361,650 cash paid, 157,950 balance)', () => {
    const result = buildCanonicalCustomerLedger(zubairFixture);

    expect(result.totals.debtBreakdown.contracts).toBe(484300);
    expect(result.totals.debtBreakdown.compositeTasks).toBe(35300);
    expect(result.totals.debtBreakdown.printedInvoices).toBe(0);
    expect(result.totals.totalCustomerCharges).toBe(519600);

    expect(result.totals.cashPayments).toBe(361650);

    expect(result.totals.finalBalance).toBe(157950);
    expect(result.endingBalance).toBe(157950);

    expect(result.totals.informationalContractDiscounts).toBe(10300);
    expect(result.totals.informationalStopAdjustments).toBe(6000);
  });

  it('Section 23: Composite Task Naming Matrix (Cases A, B, C, D)', () => {
    // Case A: Print > 0 && Install > 0
    const fixtureA: RawCustomerFinancialSources = {
      contracts: [],
      payments: [],
      compositeTasks: [
        { id: 'c-a', task_number: 501, customer_print_cost: 1000, customer_installation_cost: 500, customer_total: 1500 },
      ],
    };
    const resultA = buildCanonicalCustomerLedger(fixtureA);
    expect(resultA.displayedEntries[0].description).toBe('فاتورة طباعة وتركيب #501');
    expect(resultA.displayedEntries[0].displayCharge).toBe(1500);

    // Case B: Print > 0 && Install == 0
    const fixtureB: RawCustomerFinancialSources = {
      contracts: [],
      payments: [],
      compositeTasks: [
        { id: 'c-b', task_number: 502, customer_print_cost: 1000, customer_installation_cost: 0, customer_total: 1000 },
      ],
    };
    const resultB = buildCanonicalCustomerLedger(fixtureB);
    expect(resultB.displayedEntries[0].description).toBe('فاتورة طباعة #502');
    expect(resultB.displayedEntries[0].displayCharge).toBe(1000);

    // Case C: Print == 0 && Install > 0
    const fixtureC: RawCustomerFinancialSources = {
      contracts: [],
      payments: [],
      compositeTasks: [
        { id: 'c-c', task_number: 503, customer_print_cost: 0, customer_installation_cost: 500, customer_total: 500 },
      ],
    };
    const resultC = buildCanonicalCustomerLedger(fixtureC);
    expect(resultC.displayedEntries[0].description).toBe('فاتورة تركيب #503');
    expect(resultC.displayedEntries[0].displayCharge).toBe(500);

    // Case D: Print == 0 && Install == 0 && total == 0 -> Omitted!
    const fixtureD: RawCustomerFinancialSources = {
      contracts: [],
      payments: [],
      compositeTasks: [
        { id: 'c-d', task_number: 504, customer_print_cost: 0, customer_installation_cost: 0, customer_total: 0 },
      ],
    };
    const resultD = buildCanonicalCustomerLedger(fixtureD);
    expect(resultD.displayedEntries.length).toBe(0);
    expect(resultD.allEntries.length).toBe(0);
  });

  it('Section 24: asserts zero tasks (#281, #292) do NOT appear in simple or detailed statement rows', () => {
    const simple = buildCanonicalCustomerLedger(zubairFixture, { hidePaymentDistribution: true });
    const detailed = buildCanonicalCustomerLedger(zubairFixture, { hidePaymentDistribution: false });

    const simpleHas281 = simple.displayedEntries.some(e => e.description.includes('#281') || e.reference.includes('#281'));
    const simpleHas292 = simple.displayedEntries.some(e => e.description.includes('#292') || e.reference.includes('#292'));
    const detailedHas281 = detailed.displayedEntries.some(e => e.description.includes('#281') || e.reference.includes('#281'));
    const detailedHas292 = detailed.displayedEntries.some(e => e.description.includes('#292') || e.reference.includes('#292'));

    expect(simpleHas281).toBe(false);
    expect(simpleHas292).toBe(false);
    expect(detailedHas281).toBe(false);
    expect(detailedHas292).toBe(false);
  });

  it('Section 25 & 26: hideStopAdjustments toggle controls subtitle display without affecting financial balance', () => {
    // 1. Default (hideStopAdjustments: true)
    const hiddenResult = buildCanonicalCustomerLedger(zubairFixture, { hideStopAdjustments: true });
    const contract1209Hidden = hiddenResult.displayedEntries.find(e => e.type === 'contract' && e.contractNumber === 1209);
    expect(contract1209Hidden?.description).toBe('عقد إيجار لوحات طرقية #1209 — بولبو');
    expect(contract1209Hidden?.subtitle).toBe('(خصم تعاقدي مضمن: 10,000 د.ل)');
    expect(hiddenResult.endingBalance).toBe(157950);

    // 2. Toggled OFF (hideStopAdjustments: false)
    const shownResult = buildCanonicalCustomerLedger(zubairFixture, { hideStopAdjustments: false });
    const contract1209Shown = shownResult.displayedEntries.find(e => e.type === 'contract' && e.contractNumber === 1209);
    expect(contract1209Shown?.description).toBe('عقد إيجار لوحات طرقية #1209 — بولبو');
    expect(contract1209Shown?.subtitle).toBe('(خصم تعاقدي مضمن: 10,000 د.ل | تسوية إيقاف مضمنة: 6,000 د.ل)');
    expect(shownResult.endingBalance).toBe(157950);

    // 3. Contract 1291 discount always visible in both
    const contract1291Hidden = hiddenResult.displayedEntries.find(e => e.type === 'contract' && e.contractNumber === 1291);
    const contract1291Shown = shownResult.displayedEntries.find(e => e.type === 'contract' && e.contractNumber === 1291);
    expect(contract1291Hidden?.description).toBe('عقد إيجار لوحات طرقية #1291 — بولبو');
    expect(contract1291Hidden?.subtitle).toBe('(خصم تعاقدي مضمن: 300 د.ل)');
    expect(contract1291Shown?.subtitle).toBe('(خصم تعاقدي مضمن: 300 د.ل)');
  });

  it('Section 27: asserts absolute financial safety (Toggle NEVER alters finalBalance, charges, or running balances)', () => {
    const hiddenResult = buildCanonicalCustomerLedger(zubairFixture, { hideStopAdjustments: true });
    const shownResult = buildCanonicalCustomerLedger(zubairFixture, { hideStopAdjustments: false });

    expect(hiddenResult.totals.totalCustomerCharges).toBe(shownResult.totals.totalCustomerCharges);
    expect(hiddenResult.totals.cashPayments).toBe(shownResult.totals.cashPayments);
    expect(hiddenResult.totals.finalBalance).toBe(shownResult.totals.finalBalance);
    expect(hiddenResult.endingBalance).toBe(shownResult.endingBalance);

    expect(hiddenResult.displayedEntries.length).toBe(shownResult.displayedEntries.length);
    for (let i = 0; i < hiddenResult.displayedEntries.length; i++) {
      expect(hiddenResult.displayedEntries[i].runningBalance).toBe(shownResult.displayedEntries[i].runningBalance);
      expect(hiddenResult.displayedEntries[i].balanceEffect).toBe(shownResult.displayedEntries[i].balanceEffect);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. اختبارات تجميع مقاصات الشركات الصديقة (FRIEND-GROUP-01 .. 04)
  // ─────────────────────────────────────────────────────────────────────────────
  it('FRIEND-GROUP-01: groups multiple friend rentals of the same contract and date into 1 consolidated row', () => {
    const fixture: RawCustomerFinancialSources = {
      contracts: [{ Contract_Number: 1185, 'Contract Date': '2025-12-28', Total: 200000, 'Ad Type': 'جوتن' }],
      payments: [],
      friendBillboardRentals: [
        { id: 'fr-1', contract_number: 1185, billboard_id: 820, billboard_name: 'MSMS-820', friend_rental_cost: 8000, start_date: '2025-12-28' },
        { id: 'fr-2', contract_number: 1185, billboard_id: 1143, billboard_name: 'MS01143', friend_rental_cost: 10000, start_date: '2025-12-28' },
        { id: 'fr-3', contract_number: 1185, billboard_id: 1146, billboard_name: 'MS01146', friend_rental_cost: 12000, start_date: '2025-12-28' },
      ],
    };

    const result = buildCanonicalCustomerLedger(fixture);

    const friendRows = result.displayedEntries.filter(e => e.type === 'friend_company_offset');
    expect(friendRows.length).toBe(1);
    expect(friendRows[0].displayReduction).toBe(30000);
    expect(friendRows[0].description).toBe('مقاصة إيجار لوحات شركة صديقة — عقد #1185 — جوتن');
    expect(friendRows[0].subtitle).toContain('3 لوحات');
    expect(result.totals.friendCompanyOffsets).toBe(30000);
    expect(result.endingBalance).toBe(170000);
  });

  it('FRIEND-GROUP-02: keeps different friend contracts as separate display groups on the same date', () => {
    const fixture: RawCustomerFinancialSources = {
      contracts: [],
      payments: [],
      friendBillboardRentals: [
        { id: 'fr-a', contract_number: 100, billboard_id: 1, friend_rental_cost: 8000, start_date: '2026-01-01' },
        { id: 'fr-b', contract_number: 200, billboard_id: 2, friend_rental_cost: 12000, start_date: '2026-01-01' },
      ],
    };

    const result = buildCanonicalCustomerLedger(fixture);
    const friendRows = result.displayedEntries.filter(e => e.type === 'friend_company_offset');
    expect(friendRows.length).toBe(2);
    expect(friendRows[0].contractNumber).toBe(100);
    expect(friendRows[1].contractNumber).toBe(200);
  });

  it('FRIEND-GROUP-03: preserves chronological running balance when friend rentals occur on different dates', () => {
    const fixture: RawCustomerFinancialSources = {
      contracts: [{ Contract_Number: 999, 'Contract Date': '2026-01-01', Total: 50000 }],
      payments: [],
      friendBillboardRentals: [
        { id: 'fr-d1', contract_number: 999, billboard_id: 1, friend_rental_cost: 10000, start_date: '2026-01-10' },
        { id: 'fr-d2', contract_number: 999, billboard_id: 2, friend_rental_cost: 15000, start_date: '2026-02-10' },
      ],
    };

    const result = buildCanonicalCustomerLedger(fixture);
    expect(result.displayedEntries.length).toBe(3);
    expect(result.displayedEntries[0].runningBalance).toBe(50000);
    expect(result.displayedEntries[1].runningBalance).toBe(40000);
    expect(result.displayedEntries[2].runningBalance).toBe(25000);
  });

  it('FRIEND-GROUP-04: asserts source total === grouped total', () => {
    const fixture: RawCustomerFinancialSources = {
      contracts: [],
      payments: [],
      friendBillboardRentals: [
        { id: 'fr-1', contract_number: 1185, billboard_id: 820, friend_rental_cost: 8000, start_date: '2025-12-28' },
        { id: 'fr-2', contract_number: 1185, billboard_id: 1143, friend_rental_cost: 10000, start_date: '2025-12-28' },
        { id: 'fr-3', contract_number: 1185, billboard_id: 1146, friend_rental_cost: 12000, start_date: '2025-12-28' },
        { id: 'fr-4', contract_number: 1185, billboard_id: 818, friend_rental_cost: 10000, start_date: '2025-12-28' },
        { id: 'fr-5', contract_number: 1185, billboard_id: 1198, friend_rental_cost: 12000, start_date: '2025-12-28' },
        { id: 'fr-6', contract_number: 1185, billboard_id: 1144, friend_rental_cost: 12000, start_date: '2025-12-28' },
        { id: 'fr-7', contract_number: 1185, billboard_id: 1145, friend_rental_cost: 10000, start_date: '2025-12-28' },
        { id: 'fr-8', contract_number: 1185, billboard_id: 1141, friend_rental_cost: 10000, start_date: '2025-12-28' },
        { id: 'fr-9', contract_number: 1185, billboard_id: 1148, friend_rental_cost: 12000, start_date: '2025-12-28' },
        { id: 'fr-10', contract_number: 1185, billboard_id: 1147, friend_rental_cost: 10000, start_date: '2025-12-28' },
      ],
    };

    const result = buildCanonicalCustomerLedger(fixture);
    const sumDisplayed = result.displayedEntries.reduce((sum, e) => sum + e.displayReduction, 0);
    expect(sumDisplayed).toBe(106000);
    expect(result.totals.friendCompanyOffsets).toBe(106000);
    expect(result.totals.totalNonCashAdjustments).toBe(106000);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. اختبارات نوع الإعلان الجديدة (CONTRACT-ADTYPE-01 .. 04)
  // ─────────────────────────────────────────────────────────────────────────────
  it('CONTRACT-ADTYPE-01: displays Ad Type beside contract number and ensures it appears exactly once without duplication', () => {
    const fixture: RawCustomerFinancialSources = {
      contracts: [{ Contract_Number: 1016, Total: 20000, 'Ad Type': 'دعاية الفراشة' }],
      payments: [],
    };
    const result = buildCanonicalCustomerLedger(fixture);
    const entry = result.displayedEntries[0];

    // Primary title has contract number + Ad Type
    expect(entry.description).toBe('عقد إيجار لوحات طرقية #1016 — دعاية الفراشة');
    // Subtitle is undefined because there are no discounts
    expect(entry.subtitle).toBeUndefined();

    // Check that 'دعاية الفراشة' is not duplicated in subtitle
    expect(entry.subtitle?.includes('نوع الإعلان')).toBeFalsy();
  });

  it('CONTRACT-ADTYPE-02: displays Ad Type beside contract number with discount in subtitle', () => {
    const fixture: RawCustomerFinancialSources = {
      contracts: [{ Contract_Number: 1023, Total: 152000, Discount: 2000, 'Ad Type': 'الثقة للغذائية' }],
      payments: [],
    };
    const result = buildCanonicalCustomerLedger(fixture);
    const entry = result.displayedEntries[0];

    expect(entry.description).toBe('عقد إيجار لوحات طرقية #1023 — الثقة للغذائية');
    expect(entry.subtitle).toBe('(خصم تعاقدي مضمن: 2,000 د.ل)');
    expect(entry.subtitle?.includes('نوع الإعلان')).toBeFalsy();
  });

  it('CONTRACT-ADTYPE-03: Contract without Ad Type cleanly omits separator and empty text', () => {
    const fixture: RawCustomerFinancialSources = {
      contracts: [{ Contract_Number: 1094, Total: 4000, 'Ad Type': null }],
      payments: [],
    };
    const result = buildCanonicalCustomerLedger(fixture);
    const entry = result.displayedEntries[0];

    expect(entry.description).toBe('عقد إيجار لوحات طرقية #1094');
    expect(entry.subtitle).toBeUndefined();
  });

  it('CONTRACT-ADTYPE-04: formatStatementContractLabel helper is universally idempotent', () => {
    expect(formatStatementContractLabel(1016, 'دعاية الفراشة')).toBe('عقد إيجار لوحات طرقية #1016 — دعاية الفراشة');
    expect(formatStatementContractLabel(1094, '')).toBe('عقد إيجار لوحات طرقية #1094');
    expect(formatStatementContractLabel(1094, null)).toBe('عقد إيجار لوحات طرقية #1094');
    expect(formatStatementContractLabel(1209, 'بولبو')).toBe('عقد إيجار لوحات طرقية #1209 — بولبو');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. اختبار المطابقة الكاملة لحالة محمد البهلول (Muhammad Al-Bahloul Fixture)
  // ─────────────────────────────────────────────────────────────────────────────
  it('Section 41: Full Reconciliation for Muhammad Al-Bahloul (906,050 Charges | 760,300 Cash | 131,000 Offsets | 14,750 Balance)', () => {
    const bahloulFixture: RawCustomerFinancialSources = {
      contracts: [
        { Contract_Number: 1016, Total: 20000, 'Ad Type': 'دعاية الفراشة' },
        { Contract_Number: 1025, Total: 40000, 'Ad Type': 'اثر الربيع' },
        { Contract_Number: 1028, Total: 13500, 'Ad Type': 'دعاية شنفير' },
        { Contract_Number: 1026, Total: 40000, 'Ad Type': 'دهانات GLC' },
        { Contract_Number: 1023, Total: 152000, 'Ad Type': 'الثقة للغذائية' },
        { Contract_Number: 1043, Total: 34000, 'Ad Type': 'دعاية رخام' },
        { Contract_Number: 1045, Total: 9000, 'Ad Type': 'رخام قرارة' },
        { Contract_Number: 1085, Total: 35000, 'Ad Type': 'دعاية ليبيانا' },
        { Contract_Number: 1092, Total: 12000, 'Ad Type': 'ثريا كولا' },
        { Contract_Number: 1094, Total: 4000, 'Ad Type': 'يورك' },
        { Contract_Number: 1126, Total: 25000, 'Ad Type': 'أثر الربيع 2' },
        { Contract_Number: 1127, Total: 30600, 'Ad Type': 'جبنة شرائح' },
        { Contract_Number: 1132, Total: 32000, 'Ad Type': 'زيوت سيارات' },
        { Contract_Number: 1141, Total: 33300, 'Ad Type': 'رخام قرارة' },
        { Contract_Number: 1147, Total: 12000, 'Ad Type': 'صابون دوف' },
        { Contract_Number: 1151, Total: 35600, 'Ad Type': 'سوق ليبيا المفتوح ومعجون أسنان' },
        { Contract_Number: 1157, Total: 15000, 'Ad Type': 'صابون ومزيل عرق-  الخمس' },
        { Contract_Number: 1163, Total: 2600, 'Ad Type': 'صابون دوف -وسط زليتن' },
        { Contract_Number: 1182, Total: 58000, 'Ad Type': 'دعاية الفراشة' },
        { Contract_Number: 1183, Total: 30000, 'Ad Type': 'الصفوة شنفير' },
        { Contract_Number: 1200, Total: 80000, 'Ad Type': 'الربيع و  الثريا واسكي للرخام' },
        { Contract_Number: 1210, Total: 40000, 'Ad Type': 'دهانات GLC' },
        { Contract_Number: 1213, Total: 4000, 'Ad Type': 'المعرض الافريقي السادس للبناء والتجهيز' },
        { Contract_Number: 1236, Total: 14000, 'Ad Type': 'حليب مامي لاك' },
        { Contract_Number: 1249, Total: 6000, 'Ad Type': 'دوف وركسونا' },
        { Contract_Number: 1288, Total: 7000, 'Ad Type': 'يورك و هيتاشي' },
      ],
      salesInvoices: [
        { id: 'sale-1', invoice_number: 'SALE-1767082281897', total_amount: 112950 },
      ],
      compositeTasks: [
        { id: 'ct-5', task_number: 5, customer_installation_cost: 1500, customer_total: 1500 },
        { id: 'ct-184', task_number: 184, customer_installation_cost: 1000, customer_total: 1000 },
        { id: 'ct-224', task_number: 224, customer_installation_cost: 4000, customer_total: 4000 },
        { id: 'ct-183', task_number: 183, customer_installation_cost: 2000, customer_total: 2000 },
      ],
      payments: [
        { id: 'p-total', amount: 760300, entry_type: 'payment' },
      ],
      friendBillboardRentals: [
        { id: 'fr-1', contract_number: 1130, billboard_id: 908, friend_rental_cost: 2000, start_date: '2025-10-09' },
        { id: 'fr-2', contract_number: 1185, billboard_id: 820, friend_rental_cost: 8000, start_date: '2025-12-28' },
        { id: 'fr-3', contract_number: 1185, billboard_id: 1143, friend_rental_cost: 10000, start_date: '2025-12-28' },
        { id: 'fr-4', contract_number: 1185, billboard_id: 1146, friend_rental_cost: 12000, start_date: '2025-12-28' },
        { id: 'fr-5', contract_number: 1185, billboard_id: 818, friend_rental_cost: 10000, start_date: '2025-12-28' },
        { id: 'fr-6', contract_number: 1185, billboard_id: 1198, friend_rental_cost: 12000, start_date: '2025-12-28' },
        { id: 'fr-7', contract_number: 1185, billboard_id: 1144, friend_rental_cost: 12000, start_date: '2025-12-28' },
        { id: 'fr-8', contract_number: 1185, billboard_id: 1145, friend_rental_cost: 10000, start_date: '2025-12-28' },
        { id: 'fr-9', contract_number: 1185, billboard_id: 1141, friend_rental_cost: 10000, start_date: '2025-12-28' },
        { id: 'fr-10', contract_number: 1185, billboard_id: 1148, friend_rental_cost: 12000, start_date: '2025-12-28' },
        { id: 'fr-11', contract_number: 1185, billboard_id: 1147, friend_rental_cost: 10000, start_date: '2025-12-28' },
        { id: 'fr-12', contract_number: 1243, billboard_id: 1160, friend_rental_cost: 3000, start_date: '2026-05-08' },
        { id: 'fr-13', contract_number: 1243, billboard_id: 1158, friend_rental_cost: 6000, start_date: '2026-05-08' },
        { id: 'fr-14', contract_number: 1243, billboard_id: 1161, friend_rental_cost: 3000, start_date: '2026-05-08' },
        { id: 'fr-15', contract_number: 1291, billboard_id: 1159, friend_rental_cost: 6000, start_date: '2026-08-05' },
        { id: 'fr-16', contract_number: 1293, billboard_id: 839, friend_rental_cost: 5000, start_date: '2026-08-12' },
      ],
    };

    const result = buildCanonicalCustomerLedger(bahloulFixture);

    expect(result.totals.debtBreakdown.contracts).toBe(784600);
    expect(result.totals.debtBreakdown.salesInvoices).toBe(112950);
    expect(result.totals.debtBreakdown.compositeTasks).toBe(8500);
    expect(result.totals.totalCustomerCharges).toBe(906050);

    expect(result.totals.cashPayments).toBe(760300);

    expect(result.totals.friendCompanyOffsets).toBe(131000);
    expect(result.totals.totalNonCashAdjustments).toBe(131000);

    expect(result.totals.finalBalance).toBe(14750);
    expect(result.endingBalance).toBe(14750);

    const displayedFriendRows = result.displayedEntries.filter(e => e.type === 'friend_company_offset');
    expect(displayedFriendRows.length).toBe(5);
    const sumDisplayedOffsets = displayedFriendRows.reduce((sum, e) => sum + e.displayReduction, 0);
    expect(sumDisplayedOffsets).toBe(131000);
  });
});
