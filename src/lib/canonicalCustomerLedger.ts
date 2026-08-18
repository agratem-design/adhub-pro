/**
 * تنسيق موحد لوصف العقد في كشف الحساب:
 * رقم العقد + نوع الإعلان (إن وجد)
 * مثال: "عقد إيجار لوحات طرقية #1016 — دعاية الفراشة"
 * أو "عقد إيجار لوحات طرقية #1016" (إذا لم يتوفر نوع إعلان)
 */
export function formatStatementContractLabel(
  contractNumber: number | string,
  adType?: string | null
): string {
  const cleanAdType = adType ? String(adType).trim() : '';
  if (cleanAdType) {
    return `عقد إيجار لوحات طرقية #${contractNumber} — ${cleanAdType}`;
  }
  return `عقد إيجار لوحات طرقية #${contractNumber}`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📁 Canonical Customer Financial Engine & Ledger Builder
 * ═══════════════════════════════════════════════════════════════════════════
 * المصدر المالي الموحد لحساب ديون ومدفوعات ورصيد العميل عبر النظام:
 * 1. شاشة ملخص العميل (Customer Summary)
 * 2. كشف الحساب المبسط (Simple Statement)
 * 3. كشف الحساب التفصيلي (Detailed Statement)
 * 
 * القواعد المحاسبية المركزية:
 * - Contract.Total يمثل صافي المستحق المطلوب من العميل.
 * - خصومات العقود (Contract.Discount) وتسويات الإيقاف المخصومة (deducted_from_contract)
 *   تعتبر معلومات وصفية فقط (Informational Only) ولا تُطرح مرة ثانية من الرصيد.
 * - المدفوعات النقدية مفصولة تماماً عن التسويات والخصومات غير النقدية (Non-Cash Adjustments).
 * - استبعاد فواتير المهام المجمعة المكررة في فواتير الطباعة.
 */

export type LedgerEntryType =
  | 'contract'
  | 'composite_task'
  | 'sales_invoice'
  | 'printed_invoice'
  | 'other_debit'
  | 'cash_payment'
  | 'general_credit'
  | 'general_discount'
  | 'purchase_offset'
  | 'friend_company_offset'
  | 'opening_balance'
  | 'group_header';

export type LedgerEntryCategory =
  | 'charge'                  // مستحق / مدين على العميل
  | 'cash_payment'            // سداد نقدي فعلي من العميل
  | 'non_cash_adjustment'     // تسوية / مقاصة / خصم عام
  | 'informational'           // معلومة توضيحية لا تؤثر في الرصيد
  | 'opening_balance';        // رصيد افتتاحي مُرحّل

export interface CanonicalLedgerEntry {
  id: string;
  date: string;
  createdAt?: string;
  type: LedgerEntryType;
  category: LedgerEntryCategory;
  sourceTable: string;
  sourceId: string;
  contractNumber?: number | string | null;
  reference: string;
  description: string;
  subtitle?: string;
  notes?: string;
  adType?: string | null;

  // Financial Effects (الأثر المالي الصافي)
  debitEffect: number;             // زيادة على الحساب (مستحق)
  cashPaymentEffect: number;       // سداد نقدي
  nonCashAdjustmentEffect: number; // تسوية غير نقدية / مقاصة / خصم عام
  balanceEffect: number;           // debitEffect - (cashPaymentEffect + nonCashAdjustmentEffect)
  runningBalance: number;          // الرصيد التراكمي بعد هذه الحركة

  // Display fields for UI & Print
  displayCharge: number;           // المستحق (+)
  displayReduction: number;        // السداد / التسوية (-)

  // Informational Disclosures (للتوثيق دون تكرار الحساب)
  isInformationalOnly: boolean;
  informationalDiscount?: number;
  informationalStopAdjustment?: number;
  originalAmount?: number;

  // Distributed Payment Allocation Info
  distributedPaymentId?: string | null;
  isDistributedPaymentGroupHeader?: boolean;
  isDistributedPaymentChild?: boolean;
  distributedChildIndex?: number;
  distributedChildCount?: number;
  distributedGroupTotal?: number;
  distributedChildren?: CanonicalLedgerEntry[];
  friendRentalGroupId?: string;
  isFriendRentalGroupHeader?: boolean;
  friendRentalChildCount?: number;
  friendRentalGroupTotal?: number;
  friendRentalChildren?: CanonicalLedgerEntry[];

  // Extra Metadata
  metadata?: Record<string, any>;
}

export interface CanonicalCustomerTotals {
  // 1. الديون والمستحقات الأساسية
  totalCustomerCharges: number;       // إجمالي المستحقات (العقود + المهام + المبيعات + الطباعة المستقلة + ديون أخرى)
  
  // 2. المدفوعات النقدية
  cashPayments: number;               // إجمالي المدفوع نقداً فعلياً

  // 3. التسويات والخصومات غير النقدية
  generalDiscounts: number;           // الخصومات العامة المعتمدة
  purchaseOffsets: number;            // مقاصة فواتير المشتريات غير المستخدمة
  friendCompanyOffsets: number;       // مقاصة إيجارات الشركات الصديقة غير المستخدمة
  otherNonCashCredits: number;        // تسويات غير نقدية أخرى
  totalNonCashAdjustments: number;    // مجموع التسويات غير النقدية

  // 4. الرصيد النهائي
  finalBalance: number;               // totalCustomerCharges - cashPayments - totalNonCashAdjustments
  repaymentPercentage: number;        // نسبة السداد (0 - 100%)

  // 5. الإفصاحات التوضيحية (Informational Disclosures - مشمولة سلفاً ولا تؤثر مرتين)
  informationalContractDiscounts: number;
  informationalStopAdjustments: number;

  // 6. تفصيل الديون
  debtBreakdown: {
    contracts: number;
    salesInvoices: number;
    printedInvoices: number;
    compositeTasks: number;
    otherDebts: number;
  };
}

export interface CanonicalCustomerLedgerResult {
  allEntries: CanonicalLedgerEntry[];
  displayedEntries: CanonicalLedgerEntry[];
  totals: CanonicalCustomerTotals;
  openingBalance: number;
  endingBalance: number;
  startDate?: string;
  endDate?: string;
}

export interface RawCustomerFinancialSources {
  contracts?: any[];
  allContracts?: any[];
  payments?: any[];
  salesInvoices?: any[];
  printedInvoices?: any[];
  purchaseInvoices?: any[];
  generalDiscounts?: any[];
  compositeTasks?: any[];
  printTasks?: any[];
  cutoutTasks?: any[];
  pausedBillboards?: any[];
  friendBillboardRentals?: any[];
  linkedFriendCompanyName?: string | null;
}

/**
 * دالة مساعدة لتصفية فواتير الطباعة التابعة لمهام مجمعة لمنع التكرار
 */
export function filterCompositeRelatedPrintedInvoices(
  printedInvoices: any[] = [],
  compositeTasks: any[] = [],
  printTasks: any[] = [],
  cutoutTasks: any[] = []
): any[] {
  const compositeInvoiceIds = new Set(
    compositeTasks.map((task) => String(task?.combined_invoice_id || '')).filter(Boolean)
  );

  const compositePrintTaskIds = new Set(
    compositeTasks.map((task) => String(task?.print_task_id || '')).filter(Boolean)
  );

  const compositeCutoutTaskIds = new Set(
    compositeTasks.map((task) => String(task?.cutout_task_id || '')).filter(Boolean)
  );

  const compositePrintInvoiceIds = new Set(
    printTasks
      .filter((task) => 
        compositePrintTaskIds.has(String(task?.id || '')) || 
        Boolean(task?.composite_task_id) ||
        task?.is_composite === true ||
        Boolean(task?.installation_task_id)
      )
      .map((task) => String(task?.invoice_id || ''))
      .filter(Boolean)
  );

  cutoutTasks
    .filter((task) => 
      compositeCutoutTaskIds.has(String(task?.id || '')) ||
      task?.is_composite === true ||
      Boolean(task?.installation_task_id)
    )
    .map((task) => String(task?.invoice_id || ''))
    .filter(Boolean)
    .forEach((id) => compositePrintInvoiceIds.add(id));

  return printedInvoices.filter((invoice) => {
    const invoiceId = String(invoice?.id || '');
    if (invoice?.invoice_type === 'composite_task') return false;
    if (compositeInvoiceIds.has(invoiceId)) return false;
    if (compositePrintInvoiceIds.has(invoiceId)) return false;
    return true;
  });
}

/**
 * تنظيف نصوص الملاحظات
 */
function cleanNoteText(note?: string | null): string {
  if (!note) return '—';
  const trimmed = note.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '—';
  return trimmed;
}

/**
 * المحرك المالي المركزي: يبني دفتر الأستاذ الشامل ويحسب الإجماليات بدقة
 */
export function buildCanonicalCustomerLedger(
  sources: RawCustomerFinancialSources,
  options: {
    startDate?: string;
    endDate?: string;
    excludeFriendRentals?: boolean;
    hidePaymentDistribution?: boolean;
  } = {}
): CanonicalCustomerLedgerResult {
  const {
    contracts = [],
    allContracts = [],
    payments = [],
    salesInvoices = [],
    printedInvoices = [],
    purchaseInvoices = [],
    generalDiscounts = [],
    compositeTasks = [],
    printTasks = [],
    cutoutTasks = [],
    pausedBillboards = [],
    friendBillboardRentals = [],
    linkedFriendCompanyName = null,
  } = sources;

  // خريطة استعلام لجميع العقود المتاحة (لجلب نوع الإعلان بدقة حتى لو كان العقد لعميل آخر)
  const contractsMap = new Map<number, any>();
  const allAvailableContracts = [
    ...(allContracts || []),
    ...(contracts || []),
  ];
  allAvailableContracts.forEach((c) => {
    const num = Number(c?.Contract_Number || c?.contract_number || c?.id);
    if (num && !contractsMap.has(num)) {
      contractsMap.set(num, c);
    }
  });

  const {
    startDate = '',
    endDate = '',
    excludeFriendRentals = false,
    hidePaymentDistribution = false,
  } = options;

  // 1. تصفية فواتير الطباعة لمنع التكرار مع المهام المجمعة والعقود
  const billablePrintedInvoices = filterCompositeRelatedPrintedInvoices(
    printedInvoices,
    compositeTasks,
    printTasks,
    cutoutTasks
  );

  const rawEntries: CanonicalLedgerEntry[] = [];

  let totalContractDiscountsInfo = 0;
  let totalStopAdjustmentsInfo = 0;

  // 2. معالجة العقود (Contracts)
  // Contract.Total هو الصافي المطلوب من العميل
  contracts.forEach((contract) => {
    const cNum = contract.Contract_Number;
    const contractTotal = Number(contract.Total ?? contract['Total'] ?? contract['Total Rent'] ?? 0) || 0;
    const discountAmount = Number(contract.Discount ?? contract['Discount'] ?? 0) || 0;
    const adType = contract['Ad Type'] || contract.ad_type || null;
    const contractDate = contract['Contract Date'] || contract.start_date || contract.created_at || '';

    // البحث عن لوحات موقوفة لهذا العقد
    const contractPaused = pausedBillboards.filter(
      (pb) => Number(pb.contract_number) === Number(cNum)
    );
    const totalSuspensionRefund = contractPaused.reduce(
      (sum, pb) => sum + (Number(pb.refund_amount) || 0),
      0
    );

    totalContractDiscountsInfo += discountAmount;
    totalStopAdjustmentsInfo += totalSuspensionRefund;

    // بناء نص توضيحي للخصومات المضمنة دون تكرار نوع الإعلان المذكور في العنوان الرئيسي
    const subtitleParts: string[] = [];
    if (discountAmount > 0) {
      subtitleParts.push(`خصم تعاقدي مضمن: ${discountAmount.toLocaleString('en-US')} د.ل`);
    }
    // إخفاء تفاصيل الإيقافات إذا تم تفعيل خيار hideStopAdjustments
    if (totalSuspensionRefund > 0 && !options.hideStopAdjustments) {
      subtitleParts.push(`تسوية إيقاف مضمنة: ${totalSuspensionRefund.toLocaleString('en-US')} د.ل`);
    }
    const subtitle = subtitleParts.length > 0 ? `(${subtitleParts.join(' | ')})` : undefined;

    rawEntries.push({
      id: `contract-${cNum}`,
      date: contractDate ? String(contractDate).slice(0, 10) : '',
      createdAt: contract.created_at,
      type: 'contract',
      category: 'charge',
      sourceTable: 'Contract',
      sourceId: String(contract.id || cNum),
      contractNumber: cNum,
      reference: `عقد #${cNum}`,
      description: formatStatementContractLabel(cNum, adType),
      subtitle,
      notes: cleanNoteText(contract.notes),
      adType,
      debitEffect: contractTotal,
      cashPaymentEffect: 0,
      nonCashAdjustmentEffect: 0,
      balanceEffect: contractTotal,
      runningBalance: 0, // سيتم حسابها بعد الترتيب
      displayCharge: contractTotal,
      displayReduction: 0,
      isInformationalOnly: false,
      informationalDiscount: discountAmount,
      informationalStopAdjustment: totalSuspensionRefund,
      originalAmount: contractTotal + totalSuspensionRefund,
      metadata: { contract },
    });
  });

  // 3. معالجة المهام المجمعة (Composite Tasks)
  compositeTasks.forEach((task) => {
    if (task.combined_invoice_id) return; // تم احتسابها من الفواتير
    
    // المبالغ المالية الفعلية للمكونات من الحقول الرسمية في Schema
    const printAmount = Number(task.customer_print_cost ?? task.print_cost ?? 0) || 0;
    const installAmount = Number(task.customer_installation_cost ?? task.installation_cost ?? 0) || 0;
    const cutoutAmount = Number(task.customer_cutout_cost ?? task.cutout_cost ?? 0) || 0;
    
    const taskTotal = Number(task.customer_total ?? task.total_cost ?? (printAmount + installAmount + cutoutAmount)) || 0;
    
    // الحالة D: إذا كانت المهمة صفرية بالكامل أو ليس لها أي أثر مالي مطلوب، لا تظهر نهائياً في الكشف
    if (taskTotal <= 0 && printAmount <= 0 && installAmount <= 0 && cutoutAmount <= 0) {
      return;
    }

    const taskDate = task.invoice_date || task.created_at || '';
    const taskNum = task.task_number || task.id?.slice(0, 8) || '—';
    
    // مصفوفة التسمية المحاسبية المعتمدة (Composite Task Naming Matrix):
    let invoiceTitle = 'فاتورة طباعة';
    let badgeTitle = 'فاتورة طباعة';

    // الحالة A: طباعة + تركيب (print > 0 && install > 0)
    if (printAmount > 0 && installAmount > 0) {
      invoiceTitle = 'فاتورة طباعة وتركيب';
      badgeTitle = 'فاتورة طباعة وتركيب';
    }
    // الحالة B: طباعة فقط (print > 0 && install == 0)
    else if (printAmount > 0 && installAmount <= 0) {
      invoiceTitle = 'فاتورة طباعة';
      badgeTitle = 'فاتورة طباعة';
    }
    // الحالة C: تركيب فقط (print == 0 && install > 0)
    else if (printAmount <= 0 && installAmount > 0) {
      const isReinstall = task.task_type === 'reinstallation';
      invoiceTitle = isReinstall ? 'فاتورة إعادة تركيب' : 'فاتورة تركيب';
      badgeTitle = isReinstall ? 'فاتورة إعادة تركيب' : 'فاتورة تركيب';
    }
    // حالة قص مجسمات فقط
    else if (cutoutAmount > 0 && printAmount <= 0 && installAmount <= 0) {
      invoiceTitle = 'فاتورة قص مجسمات';
      badgeTitle = 'فاتورة قص مجسمات';
    }
    // حالة احتياطية
    else if (task.task_type === 'reinstallation') {
      invoiceTitle = 'فاتورة إعادة تركيب';
      badgeTitle = 'فاتورة إعادة تركيب';
    }

    const taskContractNum = task.contract_id ? Number(task.contract_id) : null;
    const linkedContract = taskContractNum ? (contractsMap.get(taskContractNum) || contractsMap.get(Number(taskContractNum))) : null;
    const taskAdType = linkedContract
      ? (linkedContract['Ad Type'] || linkedContract['Ad_Type'] || linkedContract.ad_type || '')
      : (task.ad_type || '');
    const cleanTaskAdType = taskAdType ? String(taskAdType).trim() : '';

    let taskSubtitle: string | undefined = undefined;
    if (taskContractNum) {
      taskSubtitle = cleanTaskAdType
        ? `(عقد #${taskContractNum} — ${cleanTaskAdType})`
        : `(عقد #${taskContractNum})`;
    }

    rawEntries.push({
      id: `composite-task-${task.id}`,
      date: taskDate ? String(taskDate).slice(0, 10) : '',
      createdAt: task.created_at,
      type: 'composite_task',
      category: 'charge',
      sourceTable: 'composite_tasks',
      sourceId: String(task.id),
      contractNumber: taskContractNum,
      reference: `مهمة #${taskNum}`,
      description: `${invoiceTitle} #${taskNum}`,
      subtitle: taskSubtitle,
      notes: cleanNoteText(task.notes),
      adType: cleanTaskAdType || undefined,
      debitEffect: taskTotal,
      cashPaymentEffect: 0,
      nonCashAdjustmentEffect: 0,
      balanceEffect: taskTotal,
      runningBalance: 0,
      displayCharge: taskTotal,
      displayReduction: 0,
      isInformationalOnly: false,
      metadata: { 
        task, 
        invoiceTitle, 
        badgeTitle,
        printAmount,
        installAmount,
        cutoutAmount,
        taskTotal
      },
    });
  });

  // 4. معالجة فواتير الطباعة المستقلة (Printed Invoices)
  billablePrintedInvoices.forEach((inv) => {
    if (inv.included_in_contract === true) return;
    const totalAmount = Number(inv.total_amount ?? inv.print_cost) || 0;
    const invDate = inv.invoice_date || inv.created_at || '';
    const invNum = inv.invoice_number || inv.id?.slice(0, 8) || '—';

    let typeLabel = 'طباعة';
    if (inv.invoice_type === 'print_install') typeLabel = 'طباعة وتركيب';
    else if (inv.invoice_type === 'install_only' || inv.invoice_type === 'install') typeLabel = 'تركيب فقط';
    else if (inv.invoice_type === 'cutout') typeLabel = 'قص مجسمات';

    rawEntries.push({
      id: `printed-invoice-${inv.id}`,
      date: invDate ? String(invDate).slice(0, 10) : '',
      createdAt: inv.created_at,
      type: 'printed_invoice',
      category: 'charge',
      sourceTable: 'printed_invoices',
      sourceId: String(inv.id),
      contractNumber: inv.contract_id || null,
      reference: `فاتورة #${invNum}`,
      description: `فاتورة ${typeLabel} #${invNum}`,
      notes: cleanNoteText(inv.notes),
      debitEffect: totalAmount,
      cashPaymentEffect: 0,
      nonCashAdjustmentEffect: 0,
      balanceEffect: totalAmount,
      runningBalance: 0,
      displayCharge: totalAmount,
      displayReduction: 0,
      isInformationalOnly: false,
      metadata: { invoice: inv },
    });
  });

  // 5. معالجة فواتير المبيعات (Sales Invoices)
  salesInvoices.forEach((inv) => {
    const totalAmount = Number(inv.total_amount) || 0;
    const discount = Number(inv.discount) || 0;
    const netAmount = Math.max(0, totalAmount - discount);
    const invDate = inv.invoice_date || inv.created_at || '';
    const invNum = inv.invoice_number || inv.id?.slice(0, 8) || '—';
    const invTitle = inv.invoice_name?.trim() || `فاتورة مبيعات #${invNum}`;

    rawEntries.push({
      id: `sales-invoice-${inv.id}`,
      date: invDate ? String(invDate).slice(0, 10) : '',
      createdAt: inv.created_at,
      type: 'sales_invoice',
      category: 'charge',
      sourceTable: 'sales_invoices',
      sourceId: String(inv.id),
      reference: `مبيعات #${invNum}`,
      description: invTitle,
      subtitle: discount > 0 ? `(خصم مبيعات: ${discount.toLocaleString('en-US')} د.ل)` : undefined,
      notes: cleanNoteText(inv.notes),
      debitEffect: netAmount,
      cashPaymentEffect: 0,
      nonCashAdjustmentEffect: 0,
      balanceEffect: netAmount,
      runningBalance: 0,
      displayCharge: netAmount,
      displayReduction: 0,
      isInformationalOnly: false,
      metadata: { invoice: inv },
    });
  });

  // 6. معالجة الدفعات والديون المسجلة بجدول customer_payments
  payments.forEach((payment) => {
    const amount = Number(payment.amount) || 0;
    const payDate = payment.paid_at || payment.created_at || '';
    const entryType = String(payment.entry_type || 'payment').toLowerCase();
    const isLinkedToInvoice = Boolean(
      payment.sales_invoice_id || payment.printed_invoice_id || payment.purchase_invoice_id
    );

    // حالة: ديون أو فواتير مسجلة في جدول الدفعات
    if (entryType === 'invoice' || entryType === 'debt' || entryType === 'general_debit') {
      if (!isLinkedToInvoice && amount > 0) {
        rawEntries.push({
          id: `payment-debt-${payment.id}`,
          date: payDate ? String(payDate).slice(0, 10) : '',
          createdAt: payment.created_at,
          type: 'other_debit',
          category: 'charge',
          sourceTable: 'customer_payments',
          sourceId: String(payment.id),
          contractNumber: payment.contract_number || null,
          reference: payment.reference ? String(payment.reference) : 'دين سابق',
          description: payment.notes?.trim() || 'دين سابق / حركة مدينة',
          notes: cleanNoteText(payment.notes),
          debitEffect: amount,
          cashPaymentEffect: 0,
          nonCashAdjustmentEffect: 0,
          balanceEffect: amount,
          runningBalance: 0,
          displayCharge: amount,
          displayReduction: 0,
          isInformationalOnly: false,
          metadata: { payment },
        });
      }
      return;
    }

    // حالة: دفعات وسندات قبض
    const isCreditType =
      entryType === 'receipt' ||
      entryType === 'payment' ||
      entryType === 'account_payment' ||
      entryType === 'general_credit';

    if (isCreditType && amount > 0) {
      // تحديد المرجع ووصف السند
      let targetRef = 'على الحساب';
      let cleanPayAdType = '';
      const payContractNum = payment.contract_number ? Number(payment.contract_number) : null;

      if (payContractNum) {
        const linkedContract = contractsMap.get(payContractNum) || contractsMap.get(Number(payContractNum));
        const cAdType = linkedContract
          ? (linkedContract['Ad Type'] || linkedContract['Ad_Type'] || linkedContract.ad_type || '')
          : '';
        cleanPayAdType = cAdType ? String(cAdType).trim() : '';
        targetRef = cleanPayAdType ? `عقد #${payContractNum} — ${cleanPayAdType}` : `عقد #${payContractNum}`;
      } else if (payment.sales_invoice_id) {
        targetRef = `فاتورة مبيعات`;
      } else if (payment.printed_invoice_id) {
        targetRef = `فاتورة طباعة`;
      } else if (payment.composite_task_id) {
        targetRef = `مهمة مجمعة`;
      }

      const isDistributed = Boolean(payment.distributed_payment_id);
      const isGeneralCredit = entryType === 'general_credit';

      let payDescription = `دفعة من العميل`;
      if (isGeneralCredit) {
        payDescription = `تسوية / رصيد دائن: ${payment.notes || targetRef}`;
      } else if (payContractNum) {
        payDescription = `دفعة من العميل (موزعة على عقد: #${payContractNum}${cleanPayAdType ? ` — ${cleanPayAdType}` : ''})`;
      } else if (targetRef && targetRef !== 'على الحساب') {
        payDescription = `دفعة من العميل (${targetRef})`;
      }

      rawEntries.push({
        id: `payment-${payment.id}`,
        date: payDate ? String(payDate).slice(0, 10) : '',
        createdAt: payment.created_at,
        type: isGeneralCredit ? 'general_credit' : 'cash_payment',
        category: isGeneralCredit ? 'non_cash_adjustment' : 'cash_payment',
        sourceTable: 'customer_payments',
        sourceId: String(payment.id),
        contractNumber: payContractNum,
        reference: payment.reference ? String(payment.reference) : targetRef,
        description: payDescription,
        notes: cleanNoteText(payment.notes),
        adType: cleanPayAdType || undefined,
        debitEffect: 0,
        cashPaymentEffect: isGeneralCredit ? 0 : amount,
        nonCashAdjustmentEffect: isGeneralCredit ? amount : 0,
        balanceEffect: -amount,
        runningBalance: 0,
        displayCharge: 0,
        displayReduction: amount,
        isInformationalOnly: false,
        distributedPaymentId: payment.distributed_payment_id || null,
        metadata: { payment },
      });
    }
  });

  // 7. معالجة الخصومات العامة المستقلة (General Discounts)
  generalDiscounts.forEach((disc) => {
    if (disc.status !== 'active') return;
    const discAmount = Number(disc.discount_value) || 0;
    if (discAmount <= 0) return;
    const discDate = disc.applied_date || disc.created_at || '';

    rawEntries.push({
      id: `general-discount-${disc.id}`,
      date: discDate ? String(discDate).slice(0, 10) : '',
      createdAt: disc.created_at,
      type: 'general_discount',
      category: 'non_cash_adjustment',
      sourceTable: 'customer_general_discounts',
      sourceId: String(disc.id),
      reference: 'خصم عام',
      description: `خصم عام: ${disc.reason || 'خصم ممنوح على الحساب'}`,
      notes: cleanNoteText(disc.reason),
      debitEffect: 0,
      cashPaymentEffect: 0,
      nonCashAdjustmentEffect: discAmount,
      balanceEffect: -discAmount,
      runningBalance: 0,
      displayCharge: 0,
      displayReduction: discAmount,
      isInformationalOnly: false,
      metadata: { discount: disc },
    });
  });

  // 8. معالجة فواتير المشتريات من العميل (Purchase Invoices - مقايضة غير مستخدمة كدفعات)
  purchaseInvoices.forEach((inv) => {
    const invAny = inv as any;
    if (invAny.is_deleted || invAny.status === 'deleted' || invAny.status === 'cancelled') return;
    const totalAmount = Number(inv.total_amount) || 0;
    const usedAsPayment = Number(inv.used_as_payment) || 0;
    const remainingOffset = Math.max(0, totalAmount - usedAsPayment);
    if (remainingOffset <= 0) return;

    const invDate = inv.invoice_date || inv.created_at || '';
    const invNum = inv.invoice_number || inv.id?.slice(0, 8) || '—';
    const invTitle = inv.invoice_name?.trim() || `فاتورة مشتريات #${invNum}`;

    rawEntries.push({
      id: `purchase-offset-${inv.id}`,
      date: invDate ? String(invDate).slice(0, 10) : '',
      createdAt: inv.created_at,
      type: 'purchase_offset',
      category: 'non_cash_adjustment',
      sourceTable: 'purchase_invoices',
      sourceId: String(inv.id),
      reference: `مشتريات #${invNum}`,
      description: `مقايضة مشتريات: ${invTitle}${usedAsPayment > 0 ? ' (المتبقي)' : ''}`,
      subtitle: `(إجمالي الفاتورة: ${totalAmount.toLocaleString('en-US')} د.ل - سدد منها: ${usedAsPayment.toLocaleString('en-US')} د.ل)`,
      notes: cleanNoteText(inv.notes),
      debitEffect: 0,
      cashPaymentEffect: 0,
      nonCashAdjustmentEffect: remainingOffset,
      balanceEffect: -remainingOffset,
      runningBalance: 0,
      displayCharge: 0,
      displayReduction: remainingOffset,
      isInformationalOnly: false,
      metadata: { invoice: inv },
    });
  });

  // 9. معالجة إيجارات الشركات الصديقة (Friend Company Rentals)
  if (!excludeFriendRentals) {
    let friendRentalsTotal = 0;
    const addedFriendBillboardRentals = new Set<string>();
    const addedFriendRentalGroups = new Set<string>();

    friendBillboardRentals.forEach((rental) => {
      const rentalCost = Number(rental.friend_rental_cost) || Number(rental.customer_rental_price) || 0;
      const usedAsPayment = Number(rental.used_as_payment) || 0;
      const remainingAmount = Math.max(0, rentalCost - usedAsPayment);
      if (remainingAmount <= 0) return;

      const contractNum = Number(rental.contract_number);
      const startDateStr = rental.start_date || '';
      const billboardId = rental.billboard_id;

      if (contractNum && billboardId) {
        addedFriendBillboardRentals.add(`${contractNum}_${String(billboardId).trim()}`);
      }
      if (contractNum && !isNaN(contractNum)) {
        addedFriendRentalGroups.add(`${contractNum}_${startDateStr}`);
      }

      friendRentalsTotal += remainingAmount;
      const rDate = rental.start_date || rental.created_at || '';
      const dateKey = rDate ? String(rDate).slice(0, 10) : '';
      const friendGroupId = `${rental.friend_company_id || 'fc'}_${contractNum || 'noc'}_${dateKey}`;
      const bbLabel = rental.billboard_name || (rental.billboard_id ? `#${rental.billboard_id}` : '');

      const linkedContract = contractNum ? (contractsMap.get(contractNum) || contractsMap.get(Number(contractNum))) : null;
      const contractAdType = linkedContract
        ? (linkedContract['Ad Type'] || linkedContract['Ad_Type'] || linkedContract.ad_type || linkedContract.notes || '')
        : (rental.ad_type || rental.campaign_name || '');
      const cleanAdType = contractAdType ? String(contractAdType).trim() : '';

      const singleDescription = contractNum
        ? `مقاصة إيجار لوحة صديقة ${bbLabel ? `(${bbLabel})` : ''} — عقد #${contractNum}${cleanAdType ? ` — ${cleanAdType}` : ''}`
        : `مقاصة إيجار لوحة صديقة ${bbLabel ? `(${bbLabel})` : ''}`;

      rawEntries.push({
        id: `friend-rental-${rental.id}`,
        date: dateKey,
        createdAt: rental.created_at,
        type: 'friend_company_offset',
        category: 'non_cash_adjustment',
        sourceTable: 'friend_billboard_rentals',
        sourceId: String(rental.id),
        contractNumber: contractNum || null,
        reference: contractNum ? `عقد #${contractNum}` : `إيجار صديق`,
        description: singleDescription,
        notes: cleanNoteText(rental.notes),
        adType: cleanAdType || undefined,
        debitEffect: 0,
        cashPaymentEffect: 0,
        nonCashAdjustmentEffect: remainingAmount,
        balanceEffect: -remainingAmount,
        runningBalance: 0,
        displayCharge: 0,
        displayReduction: remainingAmount,
        isInformationalOnly: false,
        friendRentalGroupId: friendGroupId,
        metadata: { 
          rental,
          billboardId: rental.billboard_id,
          billboardName: rental.billboard_name,
          cost: remainingAmount,
          adType: cleanAdType || undefined,
        },
      });
    });

    // إضافة من friend_rental_data في العقود عند تطابق اسم الشركة الصديقة
    if (linkedFriendCompanyName) {
      contracts.forEach((contract) => {
        const friendData = contract.friend_rental_data;
        if (!friendData) return;
        const items = typeof friendData === 'string'
          ? (() => { try { return JSON.parse(friendData); } catch { return []; } })()
          : friendData;

        const processContractFriendItem = (cost: number, name: string | null, sDate: string, bId: any) => {
          if (!name || name.trim() !== linkedFriendCompanyName.trim()) return;
          const groupKey = `${Number(contract.Contract_Number)}_${sDate}`;
          if (bId && addedFriendBillboardRentals.has(`${Number(contract.Contract_Number)}_${String(bId).trim()}`)) return;
          if (addedFriendRentalGroups.has(groupKey)) return;

          addedFriendRentalGroups.add(groupKey);
          rawEntries.push({
            id: `friend-contract-${contract.Contract_Number}-${sDate}`,
            date: sDate ? String(sDate).slice(0, 10) : '',
            createdAt: contract.created_at,
            type: 'friend_company_offset',
            category: 'non_cash_adjustment',
            sourceTable: 'Contract',
            sourceId: String(contract.Contract_Number),
            contractNumber: contract.Contract_Number,
            reference: `عقد #${contract.Contract_Number}`,
            description: `مقاصة إيجار لوحة صديقة - عقد #${contract.Contract_Number}`,
            notes: `شركة: ${name}`,
            debitEffect: 0,
            cashPaymentEffect: 0,
            nonCashAdjustmentEffect: cost,
            balanceEffect: -cost,
            runningBalance: 0,
            displayCharge: 0,
            displayReduction: cost,
            isInformationalOnly: false,
          });
        };

        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const cost = Number(item.friendRentalCost || item.friend_rental_cost || 0);
            if (cost > 0) {
              const name = item.friendCompanyName || item.friend_company_name || null;
              const sDate = item.startDate || item.start_date || contract['Contract Date'] || '';
              const bId = item.billboardId || item.billboard_id || null;
              processContractFriendItem(cost, name, sDate, bId);
            }
          });
        }
      });
    }
  }

  // 10. الترتيب الزمني المحكم (Deterministic Chronological Sorting)
  rawEntries.sort((a, b) => {
    const dateA = a.date || '1970-01-01';
    const dateB = b.date || '1970-01-01';
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    // في نفس اليوم: المستحقات والديون أولاً ثم المدفوعات والتسويات
    const catOrder: Record<LedgerEntryCategory, number> = {
      opening_balance: 0,
      charge: 1,
      cash_payment: 2,
      non_cash_adjustment: 3,
      informational: 4,
    };
    if (catOrder[a.category] !== catOrder[b.category]) {
      return catOrder[a.category] - catOrder[b.category];
    }

    const createdA = a.createdAt || '';
    const createdB = b.createdAt || '';
    if (createdA && createdB && createdA !== createdB) {
      return createdA.localeCompare(createdB);
    }

    return a.id.localeCompare(b.id);
  });

  // 11. حساب الرصيد التراكمي الشامل (All-Time Running Balance)
  let allTimeRunning = 0;
  rawEntries.forEach((entry) => {
    allTimeRunning += entry.balanceEffect;
    entry.runningBalance = allTimeRunning;
  });

  // 12. تجميع إحصائيات الحساب الشاملة (Canonical Totals)
  let totalContractsDebt = 0;
  let totalSalesDebt = 0;
  let totalPrintedDebt = 0;
  let totalCompositeDebt = 0;
  let totalOtherDebts = 0;

  let totalCashPaid = 0;
  let totalGenDiscounts = 0;
  let totalPurchOffsets = 0;
  let totalFriendOffsets = 0;
  let totalOtherNonCash = 0;

  rawEntries.forEach((entry) => {
    // تصنيف الديون
    if (entry.type === 'contract') totalContractsDebt += entry.debitEffect;
    else if (entry.type === 'sales_invoice') totalSalesDebt += entry.debitEffect;
    else if (entry.type === 'printed_invoice') totalPrintedDebt += entry.debitEffect;
    else if (entry.type === 'composite_task') totalCompositeDebt += entry.debitEffect;
    else if (entry.type === 'other_debit') totalOtherDebts += entry.debitEffect;

    // تصنيف الدفعات والتسويات
    if (entry.category === 'cash_payment') {
      totalCashPaid += entry.cashPaymentEffect;
    } else if (entry.type === 'general_discount') {
      totalGenDiscounts += entry.nonCashAdjustmentEffect;
    } else if (entry.type === 'purchase_offset') {
      totalPurchOffsets += entry.nonCashAdjustmentEffect;
    } else if (entry.type === 'friend_company_offset') {
      totalFriendOffsets += entry.nonCashAdjustmentEffect;
    } else if (entry.category === 'non_cash_adjustment') {
      totalOtherNonCash += entry.nonCashAdjustmentEffect;
    }
  });

  const totalCustomerCharges =
    totalContractsDebt + totalSalesDebt + totalPrintedDebt + totalCompositeDebt + totalOtherDebts;

  const totalNonCashAdjustments =
    totalGenDiscounts + totalPurchOffsets + totalFriendOffsets + totalOtherNonCash;

  const finalBalance = totalCustomerCharges - totalCashPaid - totalNonCashAdjustments;

  const repaymentPercentage = totalCustomerCharges > 0
    ? Math.round(((totalCashPaid + totalNonCashAdjustments) / totalCustomerCharges) * 100)
    : 100;

  const allTimeTotals: CanonicalCustomerTotals = {
    totalCustomerCharges,
    cashPayments: totalCashPaid,
    generalDiscounts: totalGenDiscounts,
    purchaseOffsets: totalPurchOffsets,
    friendCompanyOffsets: totalFriendOffsets,
    otherNonCashCredits: totalOtherNonCash,
    totalNonCashAdjustments,
    finalBalance,
    repaymentPercentage: Math.min(100, Math.max(0, repaymentPercentage)),
    informationalContractDiscounts: totalContractDiscountsInfo,
    informationalStopAdjustments: totalStopAdjustmentsInfo,
    debtBreakdown: {
      contracts: totalContractsDebt,
      salesInvoices: totalSalesDebt,
      printedInvoices: totalPrintedDebt,
      compositeTasks: totalCompositeDebt,
      otherDebts: totalOtherDebts,
    },
  };

  // 13. الفلترة حسب الفترة الزمنية وحساب الرصيد الافتتاحي (Date Range Filtering & Opening Balance)
  let openingBalance = 0;
  const filteredEntries: CanonicalLedgerEntry[] = [];

  rawEntries.forEach((entry) => {
    const entryDate = entry.date || '';

    if (startDate && entryDate && entryDate < startDate) {
      openingBalance += entry.balanceEffect;
    } else if (endDate && entryDate && entryDate > endDate) {
      // حركات بعد نهاية الفترة
    } else {
      filteredEntries.push(entry);
    }
  });

  // 14. بناء الحركات المعروضة مع الرصيد الافتتاحي وتجميع الدفعات الموزعة
  const displayedEntries: CanonicalLedgerEntry[] = [];

  if (startDate && openingBalance !== 0) {
    displayedEntries.push({
      id: 'opening-balance-entry',
      date: startDate,
      type: 'opening_balance',
      category: 'opening_balance',
      sourceTable: 'system',
      sourceId: 'opening_balance',
      reference: 'رصيد سابق',
      description: `رصيد سابق مرحّل حتى ${startDate}`,
      debitEffect: openingBalance > 0 ? openingBalance : 0,
      cashPaymentEffect: 0,
      nonCashAdjustmentEffect: openingBalance < 0 ? Math.abs(openingBalance) : 0,
      balanceEffect: openingBalance,
      runningBalance: openingBalance,
      displayCharge: openingBalance > 0 ? openingBalance : 0,
      displayReduction: openingBalance < 0 ? Math.abs(openingBalance) : 0,
      isInformationalOnly: false,
    });
  }

  // 1. تجميع الدفعات الموزعة
  const distributedGroups = new Map<string, CanonicalLedgerEntry[]>();
  // 2. تجميع مقاصات اللوحات الصديقة التابعة لنفس العقد والتاريخ
  const friendRentalGroups = new Map<string, CanonicalLedgerEntry[]>();

  filteredEntries.forEach((t) => {
    if (t.distributedPaymentId) {
      const group = distributedGroups.get(t.distributedPaymentId) || [];
      group.push(t);
      distributedGroups.set(t.distributedPaymentId, group);
    }
    if (t.type === 'friend_company_offset' && t.friendRentalGroupId) {
      const frGroup = friendRentalGroups.get(t.friendRentalGroupId) || [];
      frGroup.push(t);
      friendRentalGroups.set(t.friendRentalGroupId, frGroup);
    }
  });

  let periodRunningBalance = openingBalance;
  const processedDistIds = new Set<string>();
  const processedFriendGroupIds = new Set<string>();

  for (let i = 0; i < filteredEntries.length; i++) {
    const entry = filteredEntries[i];
    const distId = entry.distributedPaymentId;
    const frGroupId = entry.friendRentalGroupId;

    // أ) معالجة الدفعات الموزعة
    if (distId) {
      if (processedDistIds.has(distId)) continue;
      processedDistIds.add(distId);

      const group = distributedGroups.get(distId) || [entry];
      const groupTotalReduction = group.reduce((sum, g) => sum + g.displayReduction, 0);
      const groupTotalCharge = group.reduce((sum, g) => sum + g.displayCharge, 0);
      const groupBalanceEffect = group.reduce((sum, g) => sum + g.balanceEffect, 0);

      periodRunningBalance += groupBalanceEffect;

      if (hidePaymentDistribution) {
        // عرض كحركة واحدة مجمعة في كشف الحساب العادي
        const first = group[0];
        const contractRefs = Array.from(
          new Set(
            group
              .map((g) => {
                if (!g.contractNumber) return null;
                const cNum = Number(g.contractNumber);
                const linkedContract = contractsMap.get(cNum) || contractsMap.get(Number(cNum));
                const cAdType = linkedContract
                  ? (linkedContract['Ad Type'] || linkedContract['Ad_Type'] || linkedContract.ad_type || '')
                  : (g.adType || '');
                const cleanAdType = cAdType ? String(cAdType).trim() : '';
                return cleanAdType ? `#${cNum} — ${cleanAdType}` : `#${cNum}`;
              })
              .filter(Boolean)
          )
        );

        const isSingle = contractRefs.length === 1;
        const distDescription = contractRefs.length > 0
          ? `دفعة من العميل (${isSingle ? 'موزعة على عقد: ' : 'موزعة على العقود: '}${contractRefs.join('، ')})`
          : `دفعة من العميل`;

        displayedEntries.push({
          ...first,
          id: `dist-group-${distId}`,
          description: distDescription,
          displayCharge: groupTotalCharge,
          displayReduction: groupTotalReduction,
          balanceEffect: groupBalanceEffect,
          runningBalance: periodRunningBalance,
          isDistributedPaymentGroupHeader: true,
          distributedChildCount: group.length,
          distributedGroupTotal: groupTotalReduction,
          distributedChildren: group,
        });
      } else {
        // في الكشف التفصيلي: عرض السطور التفصيلية
        group.forEach((child, index) => {
          periodRunningBalance = (index === 0 ? periodRunningBalance - groupBalanceEffect : periodRunningBalance) + child.balanceEffect;
          displayedEntries.push({
            ...child,
            runningBalance: periodRunningBalance,
            isDistributedPaymentChild: true,
            distributedChildIndex: index + 1,
            distributedChildCount: group.length,
            distributedGroupTotal: groupTotalReduction,
          });
        });
      }
    }
    // ب) معالجة مقاصات إيجار اللوحات الصديقة المجمعة
    else if (frGroupId && friendRentalGroups.has(frGroupId) && (friendRentalGroups.get(frGroupId)?.length || 0) > 1) {
      if (processedFriendGroupIds.has(frGroupId)) continue;
      processedFriendGroupIds.add(frGroupId);

      const frGroup = friendRentalGroups.get(frGroupId) || [entry];
      const groupTotalReduction = frGroup.reduce((sum, g) => sum + g.displayReduction, 0);
      const groupBalanceEffect = frGroup.reduce((sum, g) => sum + g.balanceEffect, 0);

      periodRunningBalance += groupBalanceEffect;

      const first = frGroup[0];
      const cNum = first.contractNumber;
      const linkedContract = cNum ? (contractsMap.get(cNum) || contractsMap.get(Number(cNum))) : null;
      const contractAdType = linkedContract
        ? (linkedContract['Ad Type'] || linkedContract['Ad_Type'] || linkedContract.ad_type || linkedContract.notes || '')
        : (first.adType || first.metadata?.adType || '');
      const cleanAdType = contractAdType ? String(contractAdType).trim() : '';

      const bbLabels = frGroup
        .map((g) => g.metadata?.billboardName || (g.metadata?.billboardId ? `#${g.metadata.billboardId}` : null))
        .filter(Boolean);

      const groupDescription = cNum
        ? `مقاصة إيجار لوحات شركة صديقة — عقد #${cNum}${cleanAdType ? ` — ${cleanAdType}` : ''}`
        : `مقاصة إيجار لوحات شركة صديقة`;

      displayedEntries.push({
        ...first,
        id: `friend-group-${frGroupId}`,
        reference: cNum ? `عقد #${cNum}` : first.reference,
        description: groupDescription,
        subtitle: bbLabels.length > 0 ? `(${frGroup.length} لوحات: ${bbLabels.join('، ')})` : `(${frGroup.length} لوحات)`,
        displayCharge: 0,
        displayReduction: groupTotalReduction,
        balanceEffect: groupBalanceEffect,
        runningBalance: periodRunningBalance,
        isFriendRentalGroupHeader: true,
        friendRentalChildCount: frGroup.length,
        friendRentalGroupTotal: groupTotalReduction,
        friendRentalChildren: frGroup,
      });
    }
    // ج) الحركات الفردية الاعتيادية
    else {
      periodRunningBalance += entry.balanceEffect;
      displayedEntries.push({
        ...entry,
        runningBalance: periodRunningBalance,
      });
    }
  }

  const endingBalance = displayedEntries.length > 0
    ? displayedEntries[displayedEntries.length - 1].runningBalance
    : openingBalance;

  return {
    allEntries: rawEntries,
    displayedEntries,
    totals: allTimeTotals,
    openingBalance,
    endingBalance,
    startDate,
    endDate,
  };
}
