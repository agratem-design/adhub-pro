// تحميل فواتير الزبائن غير المسددة (طباعة + مبيعات + أوامر عمل) مع ضبطها على رصيد الحساب الفعلي.
// مشترك بين صفحة «متأخرات الحسابات والفواتير» ورسالة تنبيه الزبائن الكاملة.
import { supabase } from "@/integrations/supabase/client";
import { calculateTotalRemainingDebt, filterCompositeRelatedPrintedInvoices } from "@/components/billing/BillingUtils";
import { getCurrentOperationInstallationCost } from "@/lib/compositeTaskOperation";

export interface UnpaidInvoice {
  invoiceId: string;
  contractNumber: string | null;
  customerName: string;
  customerId: string | null;
  amount: number;
  createdAt: string;
  daysOverdue: number;
  adType?: string;
  type: 'printed' | 'sales' | 'composite';
  invoiceNumber?: string;
  notes?: string;
  invoiceName?: string;
  invoiceTitle?: string;
  serviceLabel?: string;
}

export interface CustomerAccountOverdue {
  customerId: string | null;
  customerName: string;
  totalOverdue: number;
  invoicesCount: number;
  oldestDate: string;
  oldestDaysOverdue: number;
  invoices: UnpaidInvoice[];
  /** إجمالي المتبقي على حساب الزبون (عقود + فواتير − دفعات)، إن عُرف */
  accountRemaining?: number;
}

export async function loadCustomerOverdueInvoices(
  opts: { customerId?: string | null } = {},
): Promise<CustomerAccountOverdue[]> {
  const only = <Q extends { eq: (col: string, v: string) => Q }>(q: Q): Q =>
    opts.customerId ? q.eq('customer_id', opts.customerId) : q;
  const [initialPrintedRes, initialSalesRes, initialCompositeRes] = await Promise.all([
    only(supabase
      .from('printed_invoices')
      .select(`id, contract_number, customer_name, customer_id, total_amount, created_at, paid, notes`)
      .eq('paid', false) as any),
    // علامة paid قد تكون null في الفواتير القديمة؛ المتبقي الفعلي يُحسب أدناه
    only(supabase
      .from('sales_invoices')
      .select(`id, invoice_number, invoice_name, customer_name, customer_id, total_amount, remaining_amount, paid_amount, created_at, invoice_date, paid, notes`)
      .or('paid.is.null,paid.eq.false') as any),
    only(supabase
      .from('composite_tasks')
      .select(`id, task_number, task_type, customer_name, customer_id, customer_print_cost, customer_installation_cost, customer_cutout_cost, customer_total, paid_amount, discount_amount, created_at, status, contract_id, combined_invoice_id, installation_task_id, print_task_id, cutout_task_id`)
      .is('combined_invoice_id', null)
      .neq('status', 'cancelled') as any)
  ]) as any[];

  if (initialPrintedRes.error) {
    console.error('Error loading unpaid printed invoices:', initialPrintedRes.error);
    throw new Error('خطأ في تحميل فواتير الطباعة');
  }
  if (initialSalesRes.error) {
    console.error('Error loading unpaid sales invoices:', initialSalesRes.error);
    throw new Error('خطأ في تحميل فواتير المبيعات');
  }
  if (initialCompositeRes.error) {
    console.error('Error loading composite tasks:', initialCompositeRes.error);
    throw new Error('خطأ في تحميل أوامر العمل');
  }

  const invoices = initialPrintedRes.data || [];

  // ✅ جلب خصومات أوامر العمل المرتبطة بهذه الفواتير
  const invoiceIds = invoices.map((i: any) => i.id);
  const ctDiscountByInvoice = new Map<string, number>();
  const ctByInvoice = new Map<string, { customerTotal: number; paid: number; discount: number }>();
  // الدفعات الموزعة مباشرة على فاتورة الطباعة (لا تُحدّث علامة paid تلقائياً)
  const paidByPrintedInvoice = new Map<string, number>();
  if (invoiceIds.length) {
    const { data: printedPayRows } = await supabase
      .from('customer_payments')
      .select('printed_invoice_id, amount')
      .in('printed_invoice_id', invoiceIds)
      .in('entry_type', ['payment', 'receipt', 'account_payment']);
    (printedPayRows || []).forEach((p: any) => {
      const amt = Number(p.amount) || 0;
      if (!p.printed_invoice_id || amt <= 0) return;
      paidByPrintedInvoice.set(p.printed_invoice_id, (paidByPrintedInvoice.get(p.printed_invoice_id) || 0) + amt);
    });

    const { data: ctRows } = await supabase
      .from('composite_tasks')
      .select('combined_invoice_id, discount_amount')
      .in('combined_invoice_id', invoiceIds);
    (ctRows || []).forEach((r: any) => {
      if (r.combined_invoice_id) {
        ctDiscountByInvoice.set(
          r.combined_invoice_id,
          (ctDiscountByInvoice.get(r.combined_invoice_id) || 0) + (Number(r.discount_amount) || 0)
        );
      }
    });

    // اجلب print_tasks المرتبطة بهذه الفواتير
    const { data: ptRows } = await supabase
      .from('print_tasks')
      .select('id, invoice_id')
      .in('invoice_id', invoiceIds);
    const ptToInvoice = new Map<string, string>();
    (ptRows || []).forEach((pt: any) => {
      if (pt.invoice_id) ptToInvoice.set(pt.id, pt.invoice_id);
    });
    const ptIds = Array.from(ptToInvoice.keys());
    if (ptIds.length) {
      const { data: ctLinked } = await supabase
        .from('composite_tasks')
        .select('print_task_id, customer_total, paid_amount, discount_amount')
        .in('print_task_id', ptIds);
      (ctLinked || []).forEach((ct: any) => {
        const invId = ct.print_task_id ? ptToInvoice.get(ct.print_task_id) : null;
        if (!invId) return;
        const prev = ctByInvoice.get(invId) || { customerTotal: 0, paid: 0, discount: 0 };
        ctByInvoice.set(invId, {
          customerTotal: prev.customerTotal + (Number(ct.customer_total) || 0),
          paid: prev.paid + (Number(ct.paid_amount) || 0),
          discount: prev.discount + (Number(ct.discount_amount) || 0),
        });
      });
    }
  }

  // Fetch all contract IDs from sub-tasks (installation task items and tasks) for composite tasks
  const ctInstallTaskIds = (initialCompositeRes.data || [])
    .map((ct: any) => ct.installation_task_id)
    .filter(Boolean) as string[];

  const compositeTaskToContracts = new Map<string, number[]>();
  
  const realInstallMap = new Map<string, number>();
  /** آخر تاريخ تركيب فعلي لكل مهمة تركيب (يُعتمد تاريخاً لفاتورة أمر العمل إن وُجد) */
  const latestInstallDateMap = new Map<string, string>();

  if (ctInstallTaskIds.length > 0) {
    const [installItemsRes, installTasksRes] = await Promise.all([
      supabase
        .from('installation_task_items')
        .select('task_id, customer_installation_cost, reinstall_count, customer_original_install_cost, customer_reinstall_cost, installation_date, completed_at, billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)')
        .in('task_id', ctInstallTaskIds),
      supabase
        .from('installation_tasks')
        .select('id, contract_ids, contract_id')
        .in('id', ctInstallTaskIds)
    ]);

    const installItems = installItemsRes.data || [];
    const installTasksData = installTasksRes.data || [];

    // تكلفة التركيب من بنود المهمة (احتياطي فقط عند غياب customer_total).
    // إعادة التركيب تُفوتر بتكلفة إعادة التركيب وحدها؛ التركيب الأصلي فُوتر سابقاً.
    const taskTypeByInstallTaskId = new Map<string, string>();
    (initialCompositeRes.data || []).forEach((ct: any) => {
      if (ct.installation_task_id) taskTypeByInstallTaskId.set(ct.installation_task_id, ct.task_type);
    });
    installItems.forEach((row: any) => {
      const installed = String(row.installation_date || row.completed_at || '');
      const prevInstalled = latestInstallDateMap.get(row.task_id);
      if (installed && (!prevInstalled || installed > prevInstalled)) latestInstallDateMap.set(row.task_id, installed);
      const itemCost = getCurrentOperationInstallationCost(row, taskTypeByInstallTaskId.get(row.task_id));
      realInstallMap.set(row.task_id, (realInstallMap.get(row.task_id) || 0) + itemCost);
    });

    const installTaskToContracts = new Map<string, Set<number>>();
    installTasksData.forEach((it: any) => {
      const ids = it.contract_ids || (it.contract_id ? [it.contract_id] : []);
      if (ids && ids.length > 0) {
        installTaskToContracts.set(it.id, new Set(ids.map(Number)));
      }
    });

    installItems.forEach((row: any) => {
      const taskId = row.task_id as string;
      const contractNo = row.billboard?.Contract_Number;
      if (taskId && contractNo) {
        if (!installTaskToContracts.has(taskId)) {
          installTaskToContracts.set(taskId, new Set());
        }
        installTaskToContracts.get(taskId)!.add(Number(contractNo));
      }
    });

    (initialCompositeRes.data || []).forEach((ct: any) => {
      const set = ct.installation_task_id ? installTaskToContracts.get(ct.installation_task_id) : undefined;
      const derived = set ? Array.from(set) : [];
      const existing = ct.contract_id ? [ct.contract_id] : [];
      const combined = [...new Set([...existing, ...derived])].filter(Boolean);
      if (combined.length > 0) {
        compositeTaskToContracts.set(ct.id, combined);
      }
    });
  }

  // جلب أنواع الإعلانات من جدول العقود بشكل منفصل (تشمل عقود فواتير الطباعة وعقود أوامر العمل)
  const contractNumbers = Array.from(
    new Set([
      ...invoices.flatMap((i: any) => {
        const nums = [];
        if (i.contract_number != null) nums.push(Number(i.contract_number));
        if (i.contract_numbers) {
          String(i.contract_numbers).split(',').forEach(numStr => {
            const n = Number(numStr.trim());
            if (!isNaN(n)) nums.push(n);
          });
        }
        return nums;
      }),
      ...(initialCompositeRes.data || []).flatMap((ct: any) => {
        const ids = compositeTaskToContracts.get(ct.id) || (ct.contract_id ? [ct.contract_id] : []);
        return ids;
      })
    ].filter((n: any) => n != null))
  );
  const contractCustomerMap = new Map<number, { adType: string; customerId: string | null; customerName: string }>();
  if (contractNumbers.length) {
    const { data: contracts } = await supabase
      .from('Contract')
      .select('Contract_Number, "Ad Type", "Customer Name", customer_id')
      .in('Contract_Number', contractNumbers as any);
    (contracts || []).forEach((c: any) => {
      if (c.Contract_Number != null) {
        contractCustomerMap.set(Number(c.Contract_Number), {
          adType: c['Ad Type'] || '',
          customerId: c.customer_id || null,
          customerName: c['Customer Name'] || '',
        });
      }
    });
  }

  const getAdTypeDisplay = (contractNumberStr: string | null, targetCustomerId?: string | null, targetCustomerName?: string) => {
    if (!contractNumberStr) return undefined;
    const parts = contractNumberStr.split(',').map(s => s.trim());
    const adTypes = parts
      .map(p => {
        const num = Number(p);
        const cInfo = contractCustomerMap.get(num);
        if (!cInfo) return null;
        if (targetCustomerId || targetCustomerName) {
          const customerIdMatches = targetCustomerId && cInfo.customerId && targetCustomerId === cInfo.customerId;
          const customerNameMatches = targetCustomerName && cInfo.customerName && targetCustomerName === cInfo.customerName;
          if (!customerIdMatches && !customerNameMatches) return null;
        }
        return cInfo.adType;
      })
      .filter(Boolean);
    return adTypes.length ? Array.from(new Set(adTypes)).join(' - ') : undefined;
  };

  const today = new Date();
  const map = new Map<string, CustomerAccountOverdue>();

  // 1. إضافة فواتير الطباعة
  for (const inv of invoices) {
    const createdAt = inv.created_at as string;
    const diffDays = Math.ceil((today.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const rawAmount = Number(inv.total_amount) || 0;
    const ctDisc = ctDiscountByInvoice.get(inv.id) || 0;
    const ctInfo = ctByInvoice.get(inv.id);
    let effectiveAmount: number;
    if (ctInfo && ctInfo.customerTotal > 0) {
      effectiveAmount = Math.max(0, ctInfo.customerTotal - ctInfo.paid);
    } else {
      effectiveAmount = Math.max(0, rawAmount - ctDisc - (paidByPrintedInvoice.get(inv.id) || 0));
    }
    if (effectiveAmount <= 0.5) continue;
    
    const rawContracts = (inv as any).contract_numbers 
      ? String((inv as any).contract_numbers).split(',').map(s => s.trim()).filter(Boolean)
      : (inv.contract_number != null ? [String(inv.contract_number)] : []);
    
    // Filter contracts to only those belonging to this customer
    const filteredContracts = rawContracts.filter(cStr => {
      const num = Number(cStr);
      const cInfo = contractCustomerMap.get(num);
      if (!cInfo) return true;
      if (cInfo.customerId && inv.customer_id) {
        return cInfo.customerId === inv.customer_id;
      }
      return cInfo.customerName === inv.customer_name;
    });

    const cNumStr = filteredContracts.length > 0 ? filteredContracts.join(',') : null;
    const item: UnpaidInvoice = {
      invoiceId: inv.id,
      contractNumber: cNumStr,
      customerName: inv.customer_name || 'غير معروف',
      customerId: inv.customer_id,
      amount: effectiveAmount,
      createdAt,
      daysOverdue: diffDays,
      adType: getAdTypeDisplay(cNumStr, inv.customer_id, inv.customer_name),
      type: 'printed',
      notes: inv.notes || undefined,
    };

    const key = item.customerId || item.customerName;
    if (!map.has(key)) {
      map.set(key, {
        customerId: item.customerId,
        customerName: item.customerName,
        totalOverdue: 0,
        invoicesCount: 0,
        oldestDate: item.createdAt,
        oldestDaysOverdue: item.daysOverdue,
        invoices: [],
      });
    }
    const c = map.get(key)!;
    c.invoices.push(item);
    c.totalOverdue += item.amount;
    c.invoicesCount += 1;
    if (new Date(item.createdAt) < new Date(c.oldestDate)) {
      c.oldestDate = item.createdAt;
      c.oldestDaysOverdue = item.daysOverdue;
    }
  }

  // 2. إضافة فواتير المبيعات
  for (const sale of initialSalesRes.data || []) {
    const createdAt = sale.invoice_date || sale.created_at || new Date().toISOString();
    const diffDays = Math.ceil((today.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    // المتبقي = الإجمالي − المدفوع (نفس حساب قسم فواتير المبيعات)؛ remaining_amount احتياطي فقط
    const saleTotal = Number(sale.total_amount) || 0;
    const amount = saleTotal > 0
      ? Math.max(0, saleTotal - (Number(sale.paid_amount) || 0))
      : Number(sale.remaining_amount) || 0;
    if (amount <= 0.5) continue;

    const item: UnpaidInvoice = {
      invoiceId: sale.id,
      contractNumber: null,
      customerName: sale.customer_name || 'غير معروف',
      customerId: sale.customer_id,
      amount: amount,
      createdAt,
      daysOverdue: diffDays,
      type: 'sales',
      invoiceNumber: sale.invoice_number || undefined,
      notes: sale.notes || undefined,
      invoiceName: sale.invoice_name || undefined,
    };

    const key = item.customerId || item.customerName;
    if (!map.has(key)) {
      map.set(key, {
        customerId: item.customerId,
        customerName: item.customerName,
        totalOverdue: 0,
        invoicesCount: 0,
        oldestDate: item.createdAt,
        oldestDaysOverdue: item.daysOverdue,
        invoices: [],
      });
    }
    const c = map.get(key)!;
    c.invoices.push(item);
    c.totalOverdue += item.amount;
    c.invoicesCount += 1;
    if (new Date(item.createdAt) < new Date(c.oldestDate)) {
      c.oldestDate = item.createdAt;
      c.oldestDaysOverdue = item.daysOverdue;
    }
  }

  // 3. إضافة أوامر العمل غير المسددة بالكامل
  for (const ct of initialCompositeRes.data || []) {
    // تاريخ الفاتورة = آخر تركيب فعلي إن وُجد، وإلا تاريخ إنشاء أمر العمل
    const createdAt = (ct.installation_task_id && latestInstallDateMap.get(ct.installation_task_id)) || (ct.created_at as string);
    const diffDays = Math.ceil((today.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const realInstallTotal = ct.installation_task_id && realInstallMap.has(ct.installation_task_id)
      ? realInstallMap.get(ct.installation_task_id)!
      : null;
    // customer_total هو الإجمالي المعتمد (نفسه المستخدم في كشف حساب الزبون)
    const storedTotal = Number(ct.customer_total) || 0;
    const total = storedTotal > 0 || realInstallTotal === null
      ? storedTotal
      : (realInstallTotal + (Number(ct.customer_print_cost) || 0) + (Number(ct.customer_cutout_cost) || 0) - (Number(ct.discount_amount) || 0));
    const paid = Number(ct.paid_amount) || 0;
    const amount = Math.max(0, total - paid);
    if (amount <= 0.5) continue;

    const rawTaskContracts = compositeTaskToContracts.get(ct.id) || (ct.contract_id ? [ct.contract_id] : []);
    
    // Filter contracts to only keep those belonging to this customer
    const taskContracts = rawTaskContracts.filter(cNum => {
      const cInfo = contractCustomerMap.get(cNum);
      if (!cInfo) return true;
      if (cInfo.customerId && ct.customer_id) {
        return cInfo.customerId === ct.customer_id;
      }
      return cInfo.customerName === ct.customer_name;
    });

    const cNumStr = taskContracts.length > 0 ? taskContracts.join(',') : null;

    const printCost = Number(ct.customer_print_cost) || 0;
    const installCost = realInstallTotal !== null ? realInstallTotal : (Number(ct.customer_installation_cost) || 0);
    const cutoutCost = Number(ct.customer_cutout_cost) || 0;

    // مصفوفة التسمية الدقيقة بحسب التكاليف ونوع العمليات
    const hasPrint = printCost > 0 || !!ct.print_task_id || ct.task_type === 'print' || ct.task_type === 'installation_print' || ct.task_type === 'installation_print_cutout' || ct.task_type === 'print_cutout';
    // التركيب يُذكر في العنوان فقط إذا كان مفوتراً للزبون (تكلفة الزبون المخزنة)؛ التركيب المشمول في العقد يظهر 0 ولا يغيّر العنوان
    const hasInstall = (Number(ct.customer_installation_cost) || 0) > 0;
    const hasCutout = cutoutCost > 0 || !!ct.cutout_task_id || ct.task_type === 'cutout' || ct.task_type === 'installation_print_cutout' || ct.task_type === 'installation_cutout' || ct.task_type === 'print_cutout';
    const isReinstall = ct.task_type === 'reinstallation' || (Number((ct as any).reinstallation_number || 0) > 0);

    let invoiceTitle = 'فاتورة تركيب';
    let serviceLabel = 'تركيب';

    if (hasPrint && hasInstall) {
      if (hasCutout) {
        invoiceTitle = 'فاتورة طباعة وتركيب وقص';
        serviceLabel = 'طباعة وتركيب وقص';
      } else {
        invoiceTitle = 'فاتورة طباعة وتركيب';
        serviceLabel = 'طباعة وتركيب';
      }
    } else if (hasInstall && !hasPrint) {
      if (hasCutout) {
        invoiceTitle = isReinstall ? 'فاتورة إعادة تركيب وقص' : 'فاتورة تركيب وقص';
        serviceLabel = isReinstall ? 'إعادة تركيب وقص' : 'تركيب وقص';
      } else {
        invoiceTitle = isReinstall ? 'فاتورة إعادة تركيب' : 'فاتورة تركيب';
        serviceLabel = isReinstall ? 'إعادة تركيب' : 'تركيب';
      }
    } else if (hasPrint && !hasInstall) {
      if (hasCutout) {
        invoiceTitle = 'فاتورة طباعة وقص';
        serviceLabel = 'طباعة وقص';
      } else {
        invoiceTitle = 'فاتورة طباعة';
        serviceLabel = 'طباعة';
      }
    } else if (hasCutout) {
      invoiceTitle = 'فاتورة قص مجسمات';
      serviceLabel = 'قص مجسمات';
    } else {
      invoiceTitle = isReinstall ? 'فاتورة إعادة تركيب' : 'فاتورة تركيب';
      serviceLabel = isReinstall ? 'إعادة تركيب' : 'تركيب';
    }

    const item: UnpaidInvoice = {
      invoiceId: ct.id,
      contractNumber: cNumStr,
      customerName: ct.customer_name || 'غير معروف',
      customerId: ct.customer_id,
      amount: amount,
      createdAt,
      daysOverdue: diffDays,
      adType: getAdTypeDisplay(cNumStr, ct.customer_id, ct.customer_name),
      type: 'composite',
      invoiceNumber: ct.task_number ? `أمر عمل #${ct.task_number}` : undefined,
      invoiceTitle,
      serviceLabel,
    };

    const key = item.customerId || item.customerName;
    if (!map.has(key)) {
      map.set(key, {
        customerId: item.customerId,
        customerName: item.customerName,
        totalOverdue: 0,
        invoicesCount: 0,
        oldestDate: item.createdAt,
        oldestDaysOverdue: item.daysOverdue,
        invoices: [],
      });
    }
    const c = map.get(key)!;
    c.invoices.push(item);
    c.totalOverdue += item.amount;
    c.invoicesCount += 1;
    if (new Date(item.createdAt) < new Date(c.oldestDate)) {
      c.oldestDate = item.createdAt;
      c.oldestDaysOverdue = item.daysOverdue;
    }
  }

  const result = Array.from(map.values()).sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue);

  // ✅ استبعاد العملاء الذين رصيدهم الفعلي صفر
  const customerIds = result.map(r => r.customerId).filter((x): x is string => !!x);
  const remainingMap = new Map<string, number>();
  if (customerIds.length) {
    const [
      contractsRes,
      paymentsRes,
      salesRes,
      printedRes,
      purchasesRes,
      discountsRes,
      compositeRes,
      printTasksRes,
      cutoutTasksRes,
      customersRes,
      friendCompaniesRes,
      friendRentalsRes
    ] = await Promise.all([
      supabase.from('Contract').select('Total, customer_id, Contract_Number, friend_rental_data, "Contract Date"').in('customer_id', customerIds),
      supabase.from('customer_payments').select('customer_id, amount, entry_type, sales_invoice_id, printed_invoice_id, purchase_invoice_id, notes, distributed_payment_id').in('customer_id', customerIds),
      supabase.from('sales_invoices').select('customer_id, total_amount').in('customer_id', customerIds),
      supabase.from('printed_invoices').select('id, customer_id, total_amount, included_in_contract, invoice_type').in('customer_id', customerIds),
      supabase.from('purchase_invoices').select('customer_id, total_amount, used_as_payment').in('customer_id', customerIds),
      supabase.from('customer_general_discounts').select('customer_id, discount_value').eq('status', 'active').in('customer_id', customerIds),
      supabase.from('composite_tasks').select('id, customer_id, customer_total, combined_invoice_id, print_task_id, discount_amount').in('customer_id', customerIds),
      supabase.from('print_tasks').select('id, customer_id, invoice_id, is_composite, installation_task_id, composite_task_id').in('customer_id', customerIds),
      supabase.from('cutout_tasks').select('id, customer_id, invoice_id, is_composite, installation_task_id').in('customer_id', customerIds),
      supabase.from('customers').select('id, name, linked_friend_company_id').in('id', customerIds),
      supabase.from('friend_companies').select('id, name'),
      supabase.from('friend_billboard_rentals').select('*')
    ]);

    const byCustomer = <T extends { customer_id: string | null }>(rows: T[] | null) => {
      const m = new Map<string, T[]>();
      (rows || []).forEach((r) => {
        if (!r.customer_id) return;
        const arr = m.get(r.customer_id) || [];
        arr.push(r);
        m.set(r.customer_id, arr);
      });
      return m;
    };

    const cMap = byCustomer((contractsRes.data as any[]) || []);
    const pMap = byCustomer((paymentsRes.data as any[]) || []);
    const sMap = byCustomer((salesRes.data as any[]) || []);
    const piMap = byCustomer((printedRes.data as any[]) || []);
    const puMap = byCustomer((purchasesRes.data as any[]) || []);
    const dMap = byCustomer((discountsRes.data as any[]) || []);
    const ctMap = byCustomer((compositeRes.data as any[]) || []);
    const ptMap = byCustomer((printTasksRes.data as any[]) || []);
    const coMap = byCustomer((cutoutTasksRes.data as any[]) || []);

    const customersList = customersRes.data || [];
    const friendCompaniesList = friendCompaniesRes.data || [];
    const friendRentalsList = friendRentalsRes.data || [];

    for (const cid of customerIds) {
      const contracts = cMap.get(cid) || [];
      const payments = pMap.get(cid) || [];
      const sales = sMap.get(cid) || [];
      const printed = piMap.get(cid) || [];
      const purchases = puMap.get(cid) || [];
      const discounts = dMap.get(cid) || [];
      const composites = ctMap.get(cid) || [];
      const printTasks = ptMap.get(cid) || [];
      const cutoutTasks = coMap.get(cid) || [];

      // حساب إيجارات الشركات الصديقة
      let friendRentals = 0;
      const addedFriendBillboardRentals = new Set<string>();
      const addedFriendRentalGroups = new Set<string>();
      
      const customerObj = customersList.find((c: any) => c.id === cid);
      const linkedFriendCompanyId = customerObj?.linked_friend_company_id || null;
      const friendCompany = friendCompaniesList.find((fc: any) => fc.id === linkedFriendCompanyId);
      const linkedFriendCompanyName = friendCompany?.name || null;

      if (linkedFriendCompanyId) {
        // 1. إضافة من جدول friend_billboard_rentals
        const dbFriendRentals = friendRentalsList.filter((r: any) => r.friend_company_id === linkedFriendCompanyId);
        dbFriendRentals.forEach((rental: any) => {
          const rentalCost = Number(rental.friend_rental_cost) || Number(rental.customer_rental_price) || 0;
          const usedAsPayment = Number(rental.used_as_payment) || 0;
          const remainingAmount = Math.max(0, rentalCost - usedAsPayment);
          
          if (remainingAmount > 0) {
            friendRentals += remainingAmount;
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
        
        // 2. إضافة من JSON العقود (مع التصفية والدبلرة)
        if (linkedFriendCompanyName) {
          for (const contract of contracts) {
            const friendData = contract.friend_rental_data as any;
            if (friendData) {
              const items = typeof friendData === 'string' ? (() => { try { return JSON.parse(friendData); } catch { return []; } })() : friendData;
              
              const groupedByDate = new Map<string, number>();

              const processItem = (cost: number, name: string | null, startDate: string, billboardId: any) => {
                if (!name || name.trim() !== linkedFriendCompanyName.trim()) return;
                
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

              // إضافة التكاليف المجمعة لكل تاريخ بدء
              groupedByDate.forEach((totalCost, startDate) => {
                const groupKey = `${contract.Contract_Number}_${startDate}`;
                if (totalCost > 0 && !addedFriendRentalGroups.has(groupKey)) {
                  friendRentals += totalCost;
                  addedFriendRentalGroups.add(groupKey);
                }
              });
            }
          }
        }
      }

      // تصفية فواتير الطباعة التابعة للمهام المجمعة لتفادي الازدواجية
      const billablePrintedInvoices = filterCompositeRelatedPrintedInvoices(
        printed,
        composites,
        printTasks,
        cutoutTasks
      );

      // ✅ تصفية الفواتير في كائن العميل لتفادي عرض الفواتير المكررة
      const customerAcc = map.get(cid);
      if (customerAcc) {
        const billablePrintedIds = new Set(billablePrintedInvoices.map(inv => inv.id));
        customerAcc.invoices = customerAcc.invoices.filter(inv => {
          if (inv.type === 'printed') {
            return billablePrintedIds.has(inv.invoiceId);
          }
          return true;
        });
        customerAcc.invoicesCount = customerAcc.invoices.length;
        
        if (customerAcc.invoices.length > 0) {
          const oldestInvoice = customerAcc.invoices.reduce((oldest, current) => 
            current.daysOverdue > oldest.daysOverdue ? current : oldest
          , customerAcc.invoices[0]);
          customerAcc.oldestDate = oldestInvoice.createdAt;
          customerAcc.oldestDaysOverdue = oldestInvoice.daysOverdue;
        } else {
          customerAcc.oldestDaysOverdue = 0;
        }
      }

      const totalDiscounts = discounts.reduce((sum: number, d: any) => sum + (Number(d.discount_value) || 0), 0);

      // حساب المتبقي الإجمالي المعياري الصحيح
      const remaining = calculateTotalRemainingDebt(
        contracts,
        payments,
        sales,
        billablePrintedInvoices,
        purchases,
        totalDiscounts,
        composites,
        friendRentals
      );

      remainingMap.set(cid, remaining);
    }

    // الاسم الحالي من جدول الزبائن؛ الأسماء المخزنة في الفواتير قد تكون قديمة بعد تغيير اسم الزبون
    const currentNames = new Map<string, string>(customersList.map((c: any) => [c.id, c.name]));
    for (const r of result) {
      const name = r.customerId ? currentNames.get(r.customerId) : undefined;
      if (!name) continue;
      r.customerName = name;
      r.invoices.forEach(inv => { inv.customerName = name; });
    }
  }

  const filteredResult = result.filter((r) => {
    if (!r.customerId) return true;
    const rem = remainingMap.get(r.customerId);
    if (rem == null) return true;
    return rem > 0.5 && r.invoices.length > 0;
  }).map((r) => {
    if (!r.customerId) return r;
    const rem = remainingMap.get(r.customerId);
    if (rem == null) return r;
    const filteredSum = r.invoices.reduce((sum, inv) => sum + inv.amount, 0);
    return { 
      ...r, 
      totalOverdue: Math.min(filteredSum, Math.max(0, rem)),
      accountRemaining: rem,
    };
  }).filter(r => r.totalOverdue > 0.5);

  return filteredResult;
}
