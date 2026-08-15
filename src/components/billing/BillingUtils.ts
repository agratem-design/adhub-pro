import { PaymentRow, ContractRow, InstallationPrintPricing } from './BillingTypes';

export const filterCompositeRelatedPrintedInvoices = (
  printedInvoices: any[] = [],
  compositeTasks: any[] = [],
  printTasks: any[] = [],
  cutoutTasks: any[] = []
): any[] => {
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
        task?.composite_task_id
      )
      .map((task) => String(task?.invoice_id || ''))
      .filter(Boolean)
  );

  // Add cutout task invoice IDs to exclude
  cutoutTasks
    .filter((task) => 
      compositeCutoutTaskIds.has(String(task?.id || ''))
    )
    .map((task) => String(task?.invoice_id || ''))
    .filter(Boolean)
    .forEach(id => compositePrintInvoiceIds.add(id));

  return printedInvoices.filter((invoice) => {
    const invoiceId = String(invoice?.id || '');
    if (invoice?.invoice_type === 'composite_task') return false;
    if (compositeInvoiceIds.has(invoiceId)) return false;
    if (compositePrintInvoiceIds.has(invoiceId)) return false;
    return true;
  });
};

export interface ContractDetails {
  total: number;
  paid: number;
  remaining: number;
}

export const calculateRemainingBalanceAfterPayment = (
  paymentId: string,
  payments: PaymentRow[],
  totalDebits: number
): number => {
  // Sort payments chronologically
  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = new Date(a.paid_at || a.created_at).getTime();
    const dateB = new Date(b.paid_at || b.created_at).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  
  // Find the current payment
  const currentPayment = sortedPayments.find(p => p.id === paymentId);
  if (!currentPayment) return totalDebits;
  
  // ✅ FIXED: إذا كانت الدفعة موزعة، نحسب حتى آخر دفعة في المجموعة
  const isDistributed = currentPayment.distributed_payment_id;
  let lastPaymentIndex = sortedPayments.findIndex(p => p.id === paymentId);
  
  if (isDistributed) {
    // جلب جميع الدفعات الموزعة في نفس المجموعة
    const distributedGroup = sortedPayments.filter(p => 
      p.distributed_payment_id === currentPayment.distributed_payment_id
    );
    
    // آخر دفعة في المجموعة
    if (distributedGroup.length > 0) {
      const lastDistributed = distributedGroup[distributedGroup.length - 1];
      lastPaymentIndex = sortedPayments.findIndex(p => p.id === lastDistributed.id);
    }
  }
  
  // Calculate total credits up to and including this payment (or last distributed payment)
  let totalCredits = 0;
  for (let i = 0; i <= lastPaymentIndex; i++) {
    const payment = sortedPayments[i];
    if (payment.entry_type === 'receipt' || payment.entry_type === 'account_payment' || payment.entry_type === 'payment') {
      totalCredits += Number(payment.amount) || 0;
    }
  }
  
  return Math.max(0, totalDebits - totalCredits);
};

export const getContractDetails = (
  contractNumber: string,
  contracts: ContractRow[],
  payments: PaymentRow[]
): ContractDetails | null => {
  const contract = contracts.find(c => String(c.Contract_Number) === String(contractNumber));
  if (!contract) return null;
  
  const total = Number((contract as any)['Total'] ?? contract['Total Rent'] ?? 0) || 0;
  const paid = payments
    .filter(p => String(p.contract_number) === String(contractNumber))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  
  return {
    total,
    paid,
    remaining: Math.max(0, total - paid)
  };
};

// ✅ حساب موحد للمتبقي من إجمالي الديون
export const calculateTotalRemainingDebt = (
  contracts: ContractRow[],
  payments: PaymentRow[],
  salesInvoices: any[],
  printedInvoices: any[],
  purchaseInvoices: any[],
  discounts: number,
  compositeTasks: any[] = [],
  extraPurchases: number = 0
): number => {
  // إجمالي العقود (Total هو المبلغ الفعلي المطلوب - Discount مرجعي فقط ومحسوب ضمنياً)
  const totalContracts = contracts.reduce(
    (sum, c) => sum + (Number((c as any)['Total']) || 0),
    0
  );

  // إجمالي فواتير المبيعات (total_amount هو المبلغ الفعلي المطلوب)
  const totalSalesInvoices = salesInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total_amount) || 0),
    0
  );

  // إجمالي فواتير الطباعة (استثناء الفواتير المرتبطة بمهام مجمعة والمضمنة في العقود)
  const compositeTaskInvoiceIds = new Set(compositeTasks.map((t) => t.combined_invoice_id).filter(Boolean));
  const totalPrintedInvoices = printedInvoices.reduce((sum, inv) => {
    // استثناء فواتير المهام المجمعة
    if (compositeTaskInvoiceIds.has(inv.id)) return sum;
    // ✅ استثناء الفواتير المضمنة في العقود
    if (inv.included_in_contract === true) return sum;
    const val = Number(inv.total_amount ?? inv.print_cost) || 0;
    return sum + val;
  }, 0);

  // ✅ إجمالي المهام المجمعة (غير المنشأ لها فواتير)
  const totalCompositeTasks = compositeTasks.reduce((sum, task) => {
    // إذا تم إنشاء فاتورة، يتم احتسابها من printed_invoices
    if (task.combined_invoice_id) return sum;
    return sum + (Number(task.customer_total) || 0);
  }, 0);

  // الديون الأخرى (من جدول الدفعات - غير المرتبطة بفواتير)
  const totalOtherDebts = payments.reduce((sum, p) => {
    const isDebt = p.entry_type === 'invoice' || p.entry_type === 'debt' || p.entry_type === 'general_debit';
    const isLinked = p.sales_invoice_id || p.printed_invoice_id || p.purchase_invoice_id;
    if (isDebt && !isLinked) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  // إجمالي الديون
  const totalDebits = totalContracts + totalSalesInvoices + totalPrintedInvoices + totalOtherDebts + totalCompositeTasks;

  // إجمالي المدفوعات
  const totalCredits = payments.reduce((sum, p) => {
    const isCredit =
      p.entry_type === 'receipt' ||
      p.entry_type === 'account_payment' ||
      p.entry_type === 'payment' ||
      p.entry_type === 'general_credit';
    if (isCredit) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  // إجمالي المشتريات من الزبون (غير المستخدمة كدفعات) + مشتريات إضافية (مثل إيجارات الشركات الصديقة)
  const totalPurchasesFromInvoices = purchaseInvoices.reduce((sum, inv) => {
    const totalAmount = Number(inv.total_amount) || 0;
    const usedAmount = Number(inv.used_as_payment) || 0;
    return sum + Math.max(0, totalAmount - usedAmount);
  }, 0);

  const totalPurchases = totalPurchasesFromInvoices + (Number(extraPurchases) || 0);

  // المتبقي = الديون - المدفوعات - الخصومات العامة - المشتريات
  return totalDebits - totalCredits - discounts - totalPurchases;
};

// ✅ حساب تفصيل الديون حسب المصدر
export const calculateDebtBreakdown = (
  contracts: ContractRow[],
  payments: PaymentRow[],
  salesInvoices: any[],
  printedInvoices: any[],
  purchaseInvoices: any[],
  compositeTasks: any[] = [],
  extraPurchases: number = 0
): {
  contractsDebt: number;
  salesInvoicesDebt: number;
  printedInvoicesDebt: number;
  compositeTasksDebt: number;
  purchaseInvoicesCredit: number;
  otherDebts: number;
} => {
  const totalContracts = contracts.reduce(
    (sum, c) => sum + (Number((c as any)['Total']) || 0), 0
  );

  const totalSalesInvoices = salesInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total_amount) || 0), 0
  );

  const compositeTaskInvoiceIds = new Set(compositeTasks.map((t) => t.combined_invoice_id).filter(Boolean));
  const totalPrintedInvoices = printedInvoices.reduce((sum, inv) => {
    if (compositeTaskInvoiceIds.has(inv.id)) return sum;
    if (inv.included_in_contract === true) return sum;
    return sum + (Number(inv.total_amount ?? inv.print_cost) || 0);
  }, 0);

  const totalCompositeTasks = compositeTasks.reduce((sum, task) => {
    if (task.combined_invoice_id) return sum;
    return sum + (Number(task.customer_total) || 0);
  }, 0);

  const totalOtherDebts = payments.reduce((sum, p) => {
    const isDebt = p.entry_type === 'invoice' || p.entry_type === 'debt' || p.entry_type === 'general_debit';
    const isLinked = p.sales_invoice_id || p.printed_invoice_id || p.purchase_invoice_id;
    if (isDebt && !isLinked) return sum + (Number(p.amount) || 0);
    return sum;
  }, 0);

  const totalPurchasesFromInvoices = purchaseInvoices.reduce((sum, inv) => {
    const totalAmount = Number(inv.total_amount) || 0;
    const usedAmount = Number(inv.used_as_payment) || 0;
    return sum + Math.max(0, totalAmount - usedAmount);
  }, 0);

  const totalPurchases = totalPurchasesFromInvoices + (Number(extraPurchases) || 0);

  return {
    contractsDebt: totalContracts,
    salesInvoicesDebt: totalSalesInvoices,
    printedInvoicesDebt: totalPrintedInvoices,
    compositeTasksDebt: totalCompositeTasks,
    purchaseInvoicesCredit: totalPurchases,
    otherDebts: totalOtherDebts,
  };
}

// ✅ حساب المتبقي مع استبعاد إيجارات الشركات الصديقة من الديون
export const calculateTotalRemainingDebtExcludingFriendRentals = (
  contracts: ContractRow[],
  payments: PaymentRow[],
  salesInvoices: any[],
  printedInvoices: any[],
  purchaseInvoices: any[],
  discounts: number,
  compositeTasks: any[] = [],
  friendRentalsToExclude: number = 0
): number => {
  // إجمالي العقود (مطروح منه إيجارات الصديقة والتخفيضات الخاصة بكل عقد)
  const totalContracts = contracts.reduce(
    (sum, c) => sum + (Number((c as any)['Total']) || 0) - (Number((c as any)['Discount']) || 0),
    0
  ) - friendRentalsToExclude;

  // إجمالي فواتير المبيعات (مطروحاً منها الخصومات)
  const totalSalesInvoices = salesInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total_amount) || 0) - (Number(inv.discount) || 0),
    0
  );

  // إجمالي فواتير الطباعة (استثناء الفواتير المرتبطة بمهام مجمعة والمضمنة في العقود)
  const compositeTaskInvoiceIds = new Set(compositeTasks.map((t) => t.combined_invoice_id).filter(Boolean));
  const totalPrintedInvoices = printedInvoices.reduce((sum, inv: any) => {
    if (compositeTaskInvoiceIds.has(inv.id)) return sum;
    // ✅ استثناء الفواتير المضمنة في العقود
    if (inv.included_in_contract === true) return sum;
    const val = Number(inv.total_amount ?? inv.print_cost) || 0;
    return sum + val;
  }, 0);

  // إجمالي المهام المجمعة (غير المنشأ لها فواتير)
  const totalCompositeTasks = compositeTasks.reduce((sum, task) => {
    if (task.combined_invoice_id) return sum;
    return sum + (Number(task.customer_total) || 0);
  }, 0);

  // الديون الأخرى (من جدول الدفعات - غير المرتبطة بفواتير)
  const totalOtherDebts = payments.reduce((sum, p) => {
    const isDebt = p.entry_type === 'invoice' || p.entry_type === 'debt' || p.entry_type === 'general_debit';
    const isLinked = p.sales_invoice_id || p.printed_invoice_id || p.purchase_invoice_id;
    if (isDebt && !isLinked) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  // إجمالي الديون (بدون إيجارات الصديقة)
  const totalDebits = totalContracts + totalSalesInvoices + totalPrintedInvoices + totalOtherDebts + totalCompositeTasks;

  // إجمالي المدفوعات
  const totalCredits = payments.reduce((sum, p) => {
    const isCredit =
      p.entry_type === 'receipt' ||
      p.entry_type === 'account_payment' ||
      p.entry_type === 'payment' ||
      p.entry_type === 'general_credit';
    if (isCredit) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  // إجمالي المشتريات من الزبون (بدون إضافة إيجارات الصديقة هنا)
  const totalPurchases = purchaseInvoices.reduce((sum, inv) => {
    const totalAmount = Number(inv.total_amount) || 0;
    const usedAmount = Number(inv.used_as_payment) || 0;
    return sum + Math.max(0, totalAmount - usedAmount);
  }, 0);

  // المتبقي = الديون - المدفوعات - الخصومات - المشتريات
  return totalDebits - totalCredits - discounts - totalPurchases;
};

export interface BillboardSize {
  size: string;
  level: string;
  quantity: number;
  print_price?: number;
  install_price?: number;
}

export const parseBillboardSizes = (
  contractNumber: string,
  billboardsData: string | Record<string, unknown> | null,
  billboardsCount: number,
  customerCategory: string,
  pricingData: InstallationPrintPricing[],
  contractBillboards: any[]
): BillboardSize[] => {
  console.log('Parsing billboard sizes:', { 
    contractNumber,
    billboardsData, 
    billboardsCount, 
    customerCategory, 
    pricingDataLength: pricingData.length,
    contractBillboardsLength: contractBillboards?.length ?? 0
  });
  
  const sizes: BillboardSize[] = [];
  
  try {
    let billboards: any[] = [];
    
    // First, try to use the billboards from the database query
    if (contractBillboards?.length > 0) {
      billboards = contractBillboards;
      console.log('Using billboards from database query:', billboards.length);
    }
    // Fallback: try to parse billboards_data
    else if (billboardsData && typeof billboardsData === 'string' && billboardsData.trim()) {
      try {
        const parsed = JSON.parse(billboardsData);
        if (Array.isArray(parsed)) {
          billboards = parsed;
        } else if (parsed && typeof parsed === 'object') {
          billboards = [parsed];
        }
        console.log('Using billboards from billboards_data:', billboards.length);
      } catch (e) {
        console.warn('Failed to parse billboards_data:', e);
      }
    }
    // Last resort: use billboards_count to create default entries
    else if (billboardsCount > 0) {
      console.log('Creating default billboards based on count:', billboardsCount);
      for (let i = 0; i < billboardsCount; i++) {
        billboards.push({
          size: '3x4',
          level: 'أرضي'
        });
      }
    }
    
    // Process each billboard
    if (billboards.length > 0) {
      billboards.forEach((billboard: any, index: number) => {
        let size = '3x4'; // default
        let level = 'أرضي'; // default
        
        // Extract size from various possible field names
        if (billboard.Size) {
          size = String(billboard.Size);
        } else if (billboard.size) {
          size = String(billboard.size);
        }
        
        // Extract level from various possible field names
        if (billboard.Level) {
          level = String(billboard.Level);
        } else if (billboard.level) {
          level = String(billboard.level);
        } else if (billboard.billboard_level) {
          level = String(billboard.billboard_level);
        }
        
        // Normalize size format (replace × or * with x)
        size = size.replace(/×|\*/g, 'x');
        
        // Find pricing for this size, level, and category
        const pricing = pricingData.find(p => 
          p.size === size && 
          p.level === level && 
          p.category === customerCategory
        );
        
        console.log(`Billboard ${index + 1}: size=${size}, level=${level}, category=${customerCategory}`, pricing ? 'Found pricing' : 'No pricing found');
        
        sizes.push({
          size,
          level,
          quantity: 1,
          print_price: pricing?.print_price || 50, // Default fallback
          install_price: pricing?.installation_price || 30, // Default fallback
          cut_price: 0,
        });
      });
    }
    
    // If still no sizes, create at least one default
    if (sizes.length === 0) {
      console.log('Creating single default size entry');
      
      const defaultPricing = pricingData.find(p => 
        p.size === '3x4' && 
        p.level === 'أرضي' && 
        p.category === customerCategory
      ) || pricingData.find(p => p.category === customerCategory) || pricingData[0];
      
      sizes.push({
        size: '3x4',
        level: 'أرضي',
        quantity: 1,
        print_price: defaultPricing?.print_price || 50,
        install_price: defaultPricing?.installation_price || 30,
        cut_price: 0,
      });
    }
    
  } catch (error) {
    console.error('Error parsing billboard sizes:', error);
    
    // Emergency fallback: create default sizes
    const count = Math.max(1, billboardsCount || 1);
    for (let i = 0; i < count; i++) {
      const defaultPricing = pricingData.find(p => p.category === customerCategory);
      
      sizes.push({
        size: '3x4',
        level: 'أرضي',
        quantity: 1,
        print_price: defaultPricing?.print_price || 50,
        install_price: defaultPricing?.installation_price || 30,
        cut_price: 0,
      });
    }
  }
  
  console.log('Final parsed sizes:', sizes);
  return sizes;
};

export const translateInvoiceType = (type: string | null | undefined): string => {
  if (!type) return 'طباعة';
  switch (type.trim().toLowerCase()) {
    case 'print':
    case 'print_only':
      return 'طباعة فقط';
    case 'print_install':
      return 'طباعة وتركيب';
    case 'install':
    case 'install_only':
      return 'تركيب فقط';
    case 'cutout':
      return 'قص مجسمات';
    case 'composite_task':
      return 'مهمة مجمعة';
    default:
      return type;
  }
};