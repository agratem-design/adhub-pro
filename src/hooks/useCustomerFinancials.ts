/**
 * useCustomerFinancials - Hook مركزي ومحسن لحساب البيانات المالية للعميل
 * يعتمد على TanStack React Query لضمان:
 * 1. منع تكرار الطلبات (Request Deduplication)
 * 2. كاش ذكي ومحدث تلقائياً (Smart Invalidation)
 * 3. توحيد حسابات الديون والمتبقي ونسب السداد في مكان واحد
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateTotalRemainingDebt, filterCompositeRelatedPrintedInvoices } from '@/components/billing/BillingUtils';

export interface CustomerFinancialData {
  // إجمالي الديون (العقود + الفواتير + المهام المجمعة + الديون السابقة)
  totalDebt: number;
  // إجمالي المدفوعات
  totalPaid: number;
  // المتبقي (باستخدام المنطق الصحيح)
  remainingDebt: number;
  // نسبة السداد
  repaymentPercentage: number;
  // إجمالي الخصومات
  totalDiscounts: number;
  // إجمالي المشتريات من العميل
  totalPurchases: number;
  // إجمالي إيجارات الأصدقاء المتاحة
  totalFriendRentals: number;
  // الرصيد غير الموزع
  unallocatedBalance: number;
  // حالة التحميل
  isLoading: boolean;
  // خطأ
  error: string | null;
  // دالة إعادة الجلب اليدوي
  refetch?: () => void;
  // تفاصيل الديون
  debtBreakdown: {
    contracts: number;
    salesInvoices: number;
    printedInvoices: number;
    compositeTasks: number;
    otherDebts: number;
  };
}

const DEFAULT_FINANCIALS: Omit<CustomerFinancialData, 'isLoading' | 'error'> = {
  totalDebt: 0,
  totalPaid: 0,
  remainingDebt: 0,
  repaymentPercentage: 100,
  totalDiscounts: 0,
  totalPurchases: 0,
  totalFriendRentals: 0,
  unallocatedBalance: 0,
  debtBreakdown: {
    contracts: 0,
    salesInvoices: 0,
    printedInvoices: 0,
    compositeTasks: 0,
    otherDebts: 0,
  },
};

/**
 * دالة جلب وحساب البيانات المالية لعميل من Supabase
 */
async function fetchCustomerFinancials(customerId: string): Promise<Omit<CustomerFinancialData, 'isLoading' | 'error'>> {
  // جلب جميع البيانات الأساسية بالتوازي
  const [
    contractsRes,
    paymentsRes,
    salesInvoicesRes,
    printedInvoicesRes,
    purchaseInvoicesRes,
    discountsRes,
    compositeTasksRes,
    printTasksRes,
    cutoutTasksRes,
    customerRes,
  ] = await Promise.all([
    supabase.from('Contract').select('*').eq('customer_id', customerId),
    supabase.from('customer_payments').select('*').eq('customer_id', customerId),
    supabase.from('sales_invoices').select('*').eq('customer_id', customerId),
    supabase.from('printed_invoices').select('*').eq('customer_id', customerId),
    supabase.from('purchase_invoices').select('*').eq('customer_id', customerId),
    supabase.from('customer_general_discounts').select('*').eq('customer_id', customerId).eq('status', 'active'),
    supabase.from('composite_tasks').select('*').eq('customer_id', customerId),
    supabase.from('print_tasks').select('id, invoice_id, is_composite, installation_task_id, composite_task_id').eq('customer_id', customerId),
    supabase.from('cutout_tasks').select('id, invoice_id, is_composite, installation_task_id').eq('customer_id', customerId),
    supabase.from('customers').select('linked_friend_company_id').eq('id', customerId).maybeSingle(),
  ]);

  if (contractsRes.error) throw contractsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const contracts = contractsRes.data || [];
  const payments = paymentsRes.data || [];
  const salesInvoices = salesInvoicesRes.data || [];
  const printedInvoices = printedInvoicesRes.data || [];
  const purchaseInvoices = purchaseInvoicesRes.data || [];
  const discounts = discountsRes.data || [];
  const compositeTasks = compositeTasksRes.data || [];
  const printTasks = printTasksRes.data || [];
  const cutoutTasks = cutoutTasksRes.data || [];

  // حساب إيجارات الشركات الصديقة
  let dbFriendRentals: any[] = [];
  let linkedFriendCompanyName: string | null = null;

  if (customerRes.data?.linked_friend_company_id) {
    const [friendCompanyRes, rentalsRes] = await Promise.all([
      supabase.from('friend_companies').select('name').eq('id', customerRes.data.linked_friend_company_id).maybeSingle(),
      supabase.from('friend_billboard_rentals').select('*').eq('friend_company_id', customerRes.data.linked_friend_company_id),
    ]);

    if (friendCompanyRes.data) {
      linkedFriendCompanyName = friendCompanyRes.data.name;
    }
    if (rentalsRes.data) {
      dbFriendRentals = rentalsRes.data;
    }
  }

  const addedFriendBillboardRentals = new Set<string>();
  const addedFriendRentalGroups = new Set<string>();
  let friendRentalTotal = 0;

  // 1. إضافة من جدول friend_billboard_rentals
  dbFriendRentals.forEach((rental) => {
    const rentalCost = Number(rental.friend_rental_cost) || Number(rental.customer_rental_price) || 0;
    const usedAsPayment = Number(rental.used_as_payment) || 0;
    const remainingAmount = Math.max(0, rentalCost - usedAsPayment);

    if (remainingAmount > 0) {
      friendRentalTotal += remainingAmount;
      const contractNum = Number(rental.contract_number);
      const startDate = rental.start_date || '';
      const billboardId = rental.billboard_id;

      if (contractNum && billboardId) {
        addedFriendBillboardRentals.add(`${Number(contractNum)}_${String(billboardId).trim()}`);
      }
      if (contractNum && !isNaN(contractNum)) {
        addedFriendRentalGroups.add(`${contractNum}_${startDate}`);
      }
    }
  });

  // 2. إضافة من JSON العقود (مع التصفية ومنع التكرار)
  if (linkedFriendCompanyName) {
    for (const contract of contracts) {
      const friendData = contract.friend_rental_data as any;
      if (friendData) {
        const items = typeof friendData === 'string'
          ? (() => { try { return JSON.parse(friendData); } catch { return []; } })()
          : friendData;

        const groupedByDate = new Map<string, number>();

        const processItem = (cost: number, name: string | null, startDate: string, billboardId: any) => {
          if (!name || name.trim() !== linkedFriendCompanyName!.trim()) return;

          const isAlreadyAdded = billboardId && addedFriendBillboardRentals.has(`${Number(contract.Contract_Number)}_${String(billboardId).trim()}`);
          if (isAlreadyAdded) return;

          const currentSum = groupedByDate.get(startDate) || 0;
          groupedByDate.set(startDate, currentSum + cost);
        };

        if (Array.isArray(items)) {
          for (const item of items) {
            const cost = Number(item.friendRentalCost || item.friend_rental_cost || 0);
            if (cost > 0) {
              const name = item.friendCompanyName || item.friend_company_name || null;
              const startDate = item.startDate || item.start_date || contract['Contract Date'] || '';
              const bId = item.billboardId || item.billboard_id || null;
              processItem(cost, name, startDate, bId);
            }
          }
        } else if (typeof items === 'object') {
          const entries = Object.entries(items) as [string, any][];
          for (const [bId, entry] of entries) {
            if (entry && typeof entry.rental_cost === 'number' && entry.rental_cost > 0) {
              const name = entry.company_name || null;
              const startDate = entry.startDate || entry.start_date || contract['Contract Date'] || '';
              processItem(entry.rental_cost, name, startDate, bId);
            }
          }
        }

        groupedByDate.forEach((totalCost, startDate) => {
          const groupKey = `${contract.Contract_Number}_${startDate}`;
          if (totalCost > 0 && !addedFriendRentalGroups.has(groupKey)) {
            friendRentalTotal += totalCost;
            addedFriendRentalGroups.add(groupKey);
          }
        });
      }
    }
  }

  // حساب الأرقام باستخدام الدالة الموحدة
  const totalDiscounts = discounts.reduce((sum, d) => sum + (Number(d.discount_value) || 0), 0);
  const billablePrintedInvoices = filterCompositeRelatedPrintedInvoices(printedInvoices, compositeTasks, printTasks, cutoutTasks);

  const remainingDebt = calculateTotalRemainingDebt(
    contracts as any[],
    payments as any[],
    salesInvoices,
    billablePrintedInvoices,
    purchaseInvoices,
    totalDiscounts,
    compositeTasks,
    friendRentalTotal
  );

  const totalContracts = contracts.reduce((sum, c) => sum + (Number(c.Total || c['Total']) || 0), 0);
  const totalSalesInvoices = salesInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

  const totalPrintedInvoices = billablePrintedInvoices.reduce((sum, inv: any) => {
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
    if (isDebt && !isLinked) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  const totalDebt = totalContracts + totalSalesInvoices + totalPrintedInvoices + totalCompositeTasks + totalOtherDebts;

  const totalPaid = payments.reduce((sum, p) => {
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

  const totalPurchases =
    purchaseInvoices.reduce((sum, inv) => {
      const totalAmount = Number(inv.total_amount) || 0;
      const usedAmount = Number(inv.used_as_payment) || 0;
      return sum + Math.max(0, totalAmount - usedAmount);
    }, 0) + friendRentalTotal;

  const repaymentPercentage =
    totalDebt > 0
      ? Math.round(((totalPaid + totalDiscounts + totalPurchases) / totalDebt) * 100)
      : 100;

  const unallocatedBalance = payments.reduce((sum, p) => {
    const isUnallocated =
      (p.entry_type === 'payment' || p.entry_type === 'receipt' || p.entry_type === 'account_payment') &&
      !p.contract_number &&
      !p.sales_invoice_id &&
      !p.printed_invoice_id &&
      !p.purchase_invoice_id &&
      !p.composite_task_id;
    return isUnallocated ? sum + (Number(p.amount) || 0) : sum;
  }, 0);

  return {
    totalDebt,
    totalPaid,
    remainingDebt,
    repaymentPercentage: Math.min(100, Math.max(0, repaymentPercentage)),
    totalDiscounts,
    totalPurchases,
    totalFriendRentals: friendRentalTotal,
    unallocatedBalance,
    debtBreakdown: {
      contracts: totalContracts,
      salesInvoices: totalSalesInvoices,
      printedInvoices: totalPrintedInvoices,
      compositeTasks: totalCompositeTasks,
      otherDebts: totalOtherDebts,
    },
  };
}

/**
 * Hook لحساب البيانات المالية لعميل معين مع الكاش والتحديث التلقائي
 */
export function useCustomerFinancials(customerId: string | null): CustomerFinancialData {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-financials', customerId],
    queryFn: () => fetchCustomerFinancials(customerId!),
    enabled: Boolean(customerId),
    staleTime: 2 * 60 * 1000, // 2 دقيقة كاش قبل إعادة الجلب
    gcTime: 10 * 60 * 1000, // 10 دقائق في الذاكرة
    refetchOnWindowFocus: false,
  });

  if (!customerId) {
    return {
      ...DEFAULT_FINANCIALS,
      isLoading: false,
      error: null,
      refetch: () => {},
    };
  }

  return {
    ...(data || DEFAULT_FINANCIALS),
    isLoading,
    error: error ? (error as Error).message || 'خطأ في تحميل البيانات المالية' : null,
    refetch,
  };
}

/**
 * Hook مساعد لإعادة تعيين كاش الحسابات المالية عند إضافة دفعة أو فاتورة جديدة
 */
export function useInvalidateCustomerFinancials() {
  const queryClient = useQueryClient();

  return (customerId?: string) => {
    if (customerId) {
      queryClient.invalidateQueries({ queryKey: ['customer-financials', customerId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['customer-financials'] });
    }
  };
}

/**
 * دالة مساعدة لحساب البيانات المالية مباشرة (بدون Hook)
 * تستخدم عندما تكون البيانات محملة مسبقاً في الذاكرة
 */
export function calculateCustomerFinancials(
  contracts: any[],
  payments: any[],
  salesInvoices: any[],
  printedInvoices: any[],
  purchaseInvoices: any[],
  discounts: any[],
  compositeTasks: any[],
  friendRentals: number = 0
): Omit<CustomerFinancialData, 'isLoading' | 'error'> {
  const totalDiscounts = discounts.reduce((sum, d) => sum + (Number(d.discount_value) || 0), 0);

  const remainingDebt = calculateTotalRemainingDebt(
    contracts,
    payments,
    salesInvoices,
    printedInvoices,
    purchaseInvoices,
    totalDiscounts,
    compositeTasks,
    friendRentals
  );

  const totalContracts = contracts.reduce((sum, c) => sum + (Number(c.Total || c['Total']) || 0), 0);
  const totalSalesInvoices = salesInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

  const compositeTaskInvoiceIds = new Set(compositeTasks.map((t) => t.combined_invoice_id).filter(Boolean));
  const totalPrintedInvoices = printedInvoices.reduce((sum, inv: any) => {
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
    if (isDebt && !isLinked) {
      return sum + (Number(p.amount) || 0);
    }
    return sum;
  }, 0);

  const totalDebt = totalContracts + totalSalesInvoices + totalPrintedInvoices + totalCompositeTasks + totalOtherDebts;

  const totalPaid = payments.reduce((sum, p) => {
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

  const totalPurchases =
    purchaseInvoices.reduce((sum, inv) => {
      const totalAmount = Number(inv.total_amount) || 0;
      const usedAmount = Number(inv.used_as_payment) || 0;
      return sum + Math.max(0, totalAmount - usedAmount);
    }, 0) + friendRentals;

  const repaymentPercentage =
    totalDebt > 0
      ? Math.round(((totalPaid + totalDiscounts + totalPurchases) / totalDebt) * 100)
      : 100;

  const unallocatedBalance = payments.reduce((sum, p) => {
    const isUnallocated =
      (p.entry_type === 'payment' || p.entry_type === 'receipt' || p.entry_type === 'account_payment') &&
      !p.contract_number &&
      !p.sales_invoice_id &&
      !p.printed_invoice_id &&
      !p.purchase_invoice_id &&
      !p.composite_task_id;
    return isUnallocated ? sum + (Number(p.amount) || 0) : sum;
  }, 0);

  return {
    totalDebt,
    totalPaid,
    remainingDebt,
    repaymentPercentage: Math.min(100, Math.max(0, repaymentPercentage)),
    totalDiscounts,
    totalPurchases,
    totalFriendRentals: friendRentals,
    unallocatedBalance,
    debtBreakdown: {
      contracts: totalContracts,
      salesInvoices: totalSalesInvoices,
      printedInvoices: totalPrintedInvoices,
      compositeTasks: totalCompositeTasks,
      otherDebts: totalOtherDebts,
    },
  };
}
