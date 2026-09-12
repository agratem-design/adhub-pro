import { describe, expect, it } from 'vitest';
import { buildCanonicalCustomerLedger } from '@/lib/canonicalCustomerLedger';
import { groupReceiptTasks } from '@/components/billing/UnifiedReceiptPrint';
import { compositeTaskLabel, compositeTaskGroupKey } from '@/lib/compositeTaskLabel';
import { buildReceiptAllocations, savedAllocationAmount } from '@/lib/distributionPayload';
import type { DistributableItem } from '@/components/billing/distribute-payment/types';

// مهام من فرقتين لنفس المهمة (مثل فرقة عبدالرزاق وفرقة عيسى على عقد 1158 إعادة تركيب رقم 1)
const multiTeamTasks = [
  { id: 'task-abdulrazzaq', task_number: 1, installation_task_id: 'inst-72ce70', contract_id: 1158, task_type: 'reinstallation', reinstallation_number: 1, customer_total: 1440, team_name: 'فرقة عبدالرزاق العاتي' },
  { id: 'task-issa', task_number: 2, installation_task_id: 'inst-f84e4c', contract_id: 1158, task_type: 'reinstallation', reinstallation_number: 1, customer_total: 1920, team_name: 'فرقة عيسى' },
  { id: 'task-new-install', task_number: 3, installation_task_id: 'inst-a35738', contract_id: 1263, task_type: 'installation', customer_total: 2210, team_name: 'فرقة عبدالرزاق العاتي' },
];

const payments = [
  { id: 1, composite_task_id: 'task-abdulrazzaq', contract_number: 1158, amount: 1440, entry_type: 'payment', paid_at: '2026-09-12', distributed_payment_id: 'receipt-1' },
  { id: 2, composite_task_id: 'task-issa', contract_number: 1158, amount: 1920, entry_type: 'payment', paid_at: '2026-09-12', distributed_payment_id: 'receipt-1' },
  { id: 3, composite_task_id: 'task-new-install', contract_number: 1263, amount: 2210, entry_type: 'payment', paid_at: '2026-09-12', distributed_payment_id: 'receipt-1' },
];

describe('composite task payment presentation and receipt grouping', () => {
  it('consolidates in-house crew allocations (Abdulrazzaq & Issa) for the same mission into 1 invoice row', () => {
    const result = buildCanonicalCustomerLedger({ compositeTasks: multiTeamTasks, payments });
    const rows = result.displayedEntries.filter(row => row.type === 'cash_payment');
    
    // فرقة عبدالرزاق وعيسى لنفس المهمة (عقد 1158 إعادة تركيب 1) تندمج في بند واحد بقيمة 3360
    // ومهمة العقد 1263 تركيب جديد في بند منفصل بقيمة 2210
    expect(rows).toHaveLength(2);
    expect(rows[0].displayReduction).toBe(3360);
    expect(rows[1].displayReduction).toBe(2210);

    // التحقق من خلو المرجع والوصف من أكواد hex العشوائية
    expect(rows[0].description).not.toContain('re72ce70');
    expect(rows[0].description).not.toContain('ref84e4c');
    expect(rows[0].description).toContain('مهمة إعادة تركيب رقم 1');
    expect(rows[0].description).toContain('عقد #1158');

    expect(rows[1].description).not.toContain('rea35738');
    expect(rows[1].description).toContain('مهمة تركيب جديد');
    expect(rows[1].description).toContain('عقد #1263');
  });

  it('generates clean labels with reinstallation number or new installation, status, and ad type', () => {
    const reinstallLabel = compositeTaskLabel({
      id: 't-1',
      contract_id: 1158,
      task_type: 'reinstallation',
      reinstallation_number: 1,
    }, 'مشروب الطاقة');
    expect(reinstallLabel).toBe('مهمة إعادة تركيب رقم 1 — عقد #1158 — مشروب الطاقة');

    const fullyPaidLabel = compositeTaskLabel({
      id: 't-paid',
      contract_id: 1158,
      task_type: 'reinstallation',
      reinstallation_number: 1,
      is_fully_paid: true,
    }, 'مواد غذائية');
    expect(fullyPaidLabel).toBe('مهمة إعادة تركيب رقم 1 — عقد #1158 (مسددة بالكامل) — مواد غذائية');

    const newInstallLabel = compositeTaskLabel({
      id: 't-2',
      contract_id: 1263,
      task_type: 'installation',
    }, 'سيارات لوتشي');
    expect(newInstallLabel).toBe('مهمة تركيب جديد — عقد #1263 — سيارات لوتشي');
  });

  it('groups receipt tasks for the same in-house mission into 1 row summing amounts and preserving balances', () => {
    const receiptItems = [
      {
        compositeTaskId: 'task-abdulrazzaq',
        installationTaskId: 'inst-72ce70',
        groupKey: compositeTaskGroupKey(multiTeamTasks[0]),
        entityType: 'composite_task' as const,
        contractNumber: 'مهمة إعادة تركيب رقم 1 — عقد #1158',
        adType: 'مشروب الطاقة (طباعة + تركيب)',
        amount: 1440,
        remaining: 0,
        total: 1440,
      },
      {
        compositeTaskId: 'task-issa',
        installationTaskId: 'inst-f84e4c',
        groupKey: compositeTaskGroupKey(multiTeamTasks[1]),
        entityType: 'composite_task' as const,
        contractNumber: 'مهمة إعادة تركيب رقم 1 — عقد #1158',
        adType: 'مشروب الطاقة (طباعة + تركيب)',
        amount: 1920,
        remaining: 0,
        total: 1920,
      },
      {
        compositeTaskId: 'task-new-install',
        installationTaskId: 'inst-a35738',
        groupKey: compositeTaskGroupKey(multiTeamTasks[2]),
        entityType: 'composite_task' as const,
        contractNumber: 'مهمة تركيب جديد — عقد #1263',
        adType: 'سيارات لوتشي (طباعة + تركيب)',
        amount: 2210,
        remaining: 0,
        total: 2210,
      }
    ];

    const grouped = groupReceiptTasks(receiptItems);
    expect(grouped).toHaveLength(2);
    // دمج عبدالرزاق وعيسى في سطر واحد
    expect(grouped[0].amount).toBe(3360);
    expect(grouped[0].contractNumber).toContain('مهمة إعادة تركيب رقم 1 — عقد #1158');
    expect(grouped[0].adType).toBe('مشروب الطاقة (طباعة + تركيب)');

    // مهمة العقد الثاني
    expect(grouped[1].amount).toBe(2210);
    expect(grouped[1].contractNumber).toBe('مهمة تركيب جديد — عقد #1263');
  });

  it('keeps distinct missions on the same contract separate (e.g. new installation vs reinstallation)', () => {
    const distinctMissions = [
      { id: 't-new', contract_id: 500, task_type: 'installation', customer_total: 1000 },
      { id: 't-re-1', contract_id: 500, task_type: 'reinstallation', reinstallation_number: 1, customer_total: 800 },
    ];
    const key1 = compositeTaskGroupKey(distinctMissions[0]);
    const key2 = compositeTaskGroupKey(distinctMissions[1]);
    expect(key1).not.toBe(key2);
  });

  it('consolidates multi-team tasks (Abdulrazzaq + Danat Misurata) for the same mission into 1 row', () => {
    const abdulrazzaqTask = {
      id: 't-178',
      contract_id: 1158,
      task_type: 'reinstallation',
      reinstallation_number: 1,
      team_name: 'فرقة عبدالرزاق العاتي',
      customer_total: 23520,
      remaining: 3140,
    };
    const danaTask = {
      id: 't-179',
      contract_id: 1158,
      task_type: 'reinstallation',
      reinstallation_number: 1,
      team_name: 'دانة مصراتة',
      customer_total: 1920,
      remaining: 0,
      is_fully_paid: true,
    };

    const keyAbdulrazzaq = compositeTaskGroupKey(abdulrazzaqTask);
    const keyDana = compositeTaskGroupKey(danaTask);

    // نفس المهمة لنفس العقد ونفس رقم إعادة التركيب تتشارك نفس المفتاح التجميعي
    expect(keyAbdulrazzaq).toBe(keyDana);

    const items = [
      {
        compositeTaskId: abdulrazzaqTask.id,
        groupKey: keyAbdulrazzaq,
        entityType: 'composite_task' as const,
        contractNumber: compositeTaskLabel(abdulrazzaqTask),
        adType: 'مواد غذائية (طباعة + تركيب) — فرقة عبدالرزاق العاتي',
        rawAdType: 'مواد غذائية',
        taskComponents: 'طباعة + تركيب',
        teamName: 'فرقة عبدالرزاق العاتي',
        amount: 20380,
        total: 23520,
        remaining: 3140,
      },
      {
        compositeTaskId: danaTask.id,
        groupKey: keyDana,
        entityType: 'composite_task' as const,
        contractNumber: compositeTaskLabel(danaTask),
        adType: 'مواد غذائية (طباعة + تركيب) — دانة مصراتة',
        rawAdType: 'مواد غذائية',
        taskComponents: 'طباعة + تركيب',
        teamName: 'دانة مصراتة',
        amount: 1920,
        total: 1920,
        remaining: 0,
      },
      {
        compositeTaskId: 't-248',
        groupKey: compositeTaskGroupKey({ id: 't-248', contract_id: 1158, task_type: 'reinstallation', reinstallation_number: 2, team_name: 'فرقة عبدالرزاق العاتي' }),
        entityType: 'composite_task' as const,
        contractNumber: compositeTaskLabel({ id: 't-248', contract_id: 1158, task_type: 'reinstallation', reinstallation_number: 2, remaining: 0, total: 1440 }),
        adType: 'مواد غذائية (طباعة + تركيب) — فرقة عبدالرزاق العاتي',
        rawAdType: 'مواد غذائية',
        taskComponents: 'طباعة + تركيب',
        teamName: 'فرقة عبدالرزاق العاتي',
        amount: 1440,
        total: 1440,
        remaining: 0,
      },
      {
        compositeTaskId: 't-333',
        groupKey: compositeTaskGroupKey({ id: 't-333', contract_id: 1158, task_type: 'reinstallation', reinstallation_number: 3, team_name: 'فرقة عبدالرزاق العاتي' }),
        entityType: 'composite_task' as const,
        contractNumber: compositeTaskLabel({ id: 't-333', contract_id: 1158, task_type: 'reinstallation', reinstallation_number: 3, remaining: 0, total: 2880 }),
        adType: 'مواد غذائية (طباعة + تركيب) — فرقة عبدالرزاق العاتي',
        rawAdType: 'مواد غذائية',
        taskComponents: 'طباعة + تركيب',
        teamName: 'فرقة عبدالرزاق العاتي',
        amount: 2880,
        total: 2880,
        remaining: 0,
      },
    ];

    const grouped = groupReceiptTasks(items);
    // 3 أسطر فقط لعقد 1158 (المهمة 1 مجمعة للفريقين، والمهمة 2، والمهمة 3)
    expect(grouped).toHaveLength(3);

    // سطر المهمة 1 يجمع بين فرقة عبدالرزاق العاتي + دانة مصراتة
    const reinstall1Row = grouped[0];
    expect(reinstall1Row).toBeDefined();
    expect(reinstall1Row.contractNumber).toBe('مهمة إعادة تركيب رقم 1 — عقد #1158');
    // لا يظهر مسددة بالكامل لأن المتبقي 3140 د.ل
    // لا يذكر الفرق في الفاتورة للزبون
    expect(reinstall1Row.adType).toBe('مواد غذائية (طباعة + تركيب)');
    expect(reinstall1Row.adType).not.toContain('فرقة عبدالرزاق العاتي');
    expect(reinstall1Row.adType).not.toContain('دانة مصراتة');
    // الإجمالي: 23,520 + 1,920 = 25,440 د.ل
    expect(reinstall1Row.total).toBe(25440);
    // المدفوع: 20,380 + 1,920 = 22,300 د.ل
    expect(reinstall1Row.amount).toBe(22300);
    // المتبقي: 3,140 د.ل
    expect(reinstall1Row.remaining).toBe(3140);

    // سطر المهمة 2 مسددة بالكامل
    const reinstall2Row = grouped[1];
    expect(reinstall2Row.contractNumber).toContain('(مسددة بالكامل)');
    expect(reinstall2Row.total).toBe(1440);
    expect(reinstall2Row.amount).toBe(1440);
    expect(reinstall2Row.remaining).toBe(0);

    // سطر المهمة 3 مسددة بالكامل
    const reinstall3Row = grouped[2];
    expect(reinstall3Row.contractNumber).toContain('(مسددة بالكامل)');
    expect(reinstall3Row.total).toBe(2880);
    expect(reinstall3Row.amount).toBe(2880);
    expect(reinstall3Row.remaining).toBe(0);
  });

  it('splits payment allocations correctly across subTasks when saving a consolidated composite task', () => {
    const consolidatedItem: DistributableItem = {
      id: 't-178',
      type: 'composite_task',
      displayName: 'مهمة إعادة تركيب رقم 1 — عقد #1158',
      adType: 'مواد غذائية',
      serviceType: 'طباعة + تركيب',
      teamName: 'فرقة عبدالرزاق العاتي + دانة مصراتة',
      totalAmount: 25440,
      paidAmount: 0,
      remainingAmount: 25440,
      selected: true,
      allocatedAmount: 24000,
      subTasks: [
        {
          id: 't-178',
          total: 23520,
          paid: 0,
          remaining: 23520,
        },
        {
          id: 't-179',
          total: 1920,
          paid: 0,
          remaining: 1920,
        },
      ],
    };

    const common = {
      customer_name: 'حمزة رحومة',
      paid_at: '2026-09-12',
      method: 'نقدي',
    };

    const allocations = buildReceiptAllocations({
      items: [consolidatedItem],
      amount: 24000,
      saveCredit: false,
      common,
      commission: 0,
      transferFee: 0,
    });

    // يتم تقسيم المبلغ إلى دفعتين للمهمتين الفرعيتين دون تجاوز سقف أي منهما
    expect(allocations).toHaveLength(2);
    expect(allocations[0].composite_task_id).toBe('t-178');
    expect(allocations[0].amount).toBe(23520);

    expect(allocations[1].composite_task_id).toBe('t-179');
    expect(allocations[1].amount).toBe(480);

    // التحقق من أن المجموع يساوي المبلغ المخصص بالكامل
    const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    expect(totalAllocated).toBe(24000);

    // التحقق من حساب التخصيص المحفوظ للمهام الفرعية
    const editingPayments = [
      { id: 'p1', composite_task_id: 't-178', amount: 20380 },
      { id: 'p2', composite_task_id: 't-179', amount: 1920 },
    ];
    const saved = savedAllocationAmount(editingPayments, 'composite_task', ['t-178', 't-179']);
    expect(saved).toBe(22300);
  });

  it('orders receipt items logically (contracts -> composite tasks -> sales invoices -> printed invoices -> surplus credit) and excludes surplus from contract count', () => {
    const rawItems = [
      {
        contractNumber: 'رصيد فائض (غير موزع)',
        adType: 'فائض سداد متبقي في حساب العميل',
        amount: 1920,
        entityType: 'general_credit' as const,
      },
      {
        contractNumber: 'عقد #1158',
        adType: 'مواد غذائية',
        amount: 5000,
        entityType: 'contract' as const,
      },
      {
        contractNumber: 'فاتورة مبيعات #SALE-1783351416668',
        adType: 'طباعة وتغليف سيارات لوتشي',
        amount: 7800,
        entityType: 'sales_invoice' as const,
      },
      {
        compositeTaskId: 'c-2',
        contractNumber: 'مهمة إعادة تركيب رقم 2 — عقد #1158',
        contractId: 1158,
        reinstallationNumber: 2,
        adType: 'مواد غذائية (طباعة + تركيب)',
        amount: 1440,
        entityType: 'composite_task' as const,
      },
      {
        compositeTaskId: 'c-1',
        contractNumber: 'مهمة إعادة تركيب رقم 1 — عقد #1158',
        contractId: 1158,
        reinstallationNumber: 1,
        adType: 'مواد غذائية (طباعة + تركيب)',
        amount: 25440,
        entityType: 'composite_task' as const,
      },
    ];

    const ordered = groupReceiptTasks(rawItems);
    expect(ordered).toHaveLength(5);
    // 1. العقد أولاً
    expect(ordered[0].entityType).toBe('contract');
    expect(ordered[0].contractNumber).toBe('عقد #1158');

    // 2. المهام المجمعة مرتبة حسب رقم إعادة التركيب (1 ثم 2)
    expect(ordered[1].entityType).toBe('composite_task');
    expect(ordered[1].contractNumber).toContain('إعادة تركيب رقم 1');
    expect(ordered[2].entityType).toBe('composite_task');
    expect(ordered[2].contractNumber).toContain('إعادة تركيب رقم 2');

    // 3. فاتورة المبيعات
    expect(ordered[3].entityType).toBe('sales_invoice');
    expect(ordered[3].contractNumber).toContain('SALE-1783351416668');

    // 4. الفائض في الأخير
    expect(ordered[4].entityType).toBe('general_credit');
    expect(ordered[4].contractNumber).toBe('رصيد فائض (غير موزع)');
  });
});



