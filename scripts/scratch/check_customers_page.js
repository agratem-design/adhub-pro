import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://atqjaiebixuzomrfwilu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTkxOTcsImV4cCI6MjA3Mjc3NTE5N30.OGAQFsAl1Eo1tmPZ93VZoSL5tO2FYZa_szeRvUmoj-4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const customerId = "1ed051fc-abe7-4b85-a087-368eb31c59fe"; // Ali Ammar

async function run() {
  const [
    pRes, 
    cRes, 
    cuRes, 
    siRes, 
    piRes, 
    puRes, 
    dRes, 
    ctRes, 
    ptRes,
    fbrRes,
    fcRes,
    cutRes
  ] = await Promise.all([
    supabase.from('customer_payments').select('id, amount, contract_number, customer_id, customer_name, entry_type, paid_at, sales_invoice_id, printed_invoice_id, purchase_invoice_id, distributed_payment_id, notes, method, reference').order('paid_at', { ascending: false }).range(0, 9999),
    supabase.from('Contract').select('Contract_Number, "Customer Name", "Ad Type", Total, "Contract Date", "End Date", customer_id, friend_rental_data, base_rent, fee, installments_data, billboards_count, billboard_ids, print_cost, installation_cost').range(0, 9999),
    supabase.from('customers').select('id, name, phone, company, is_supplier, is_customer, supplier_type, linked_friend_company_id, pricing_category').order('name', { ascending: true }).range(0, 9999),
    supabase.from('sales_invoices').select('id, customer_id, total_amount').range(0, 9999),
    supabase.from('printed_invoices').select('id, customer_id, total_amount, print_cost, invoice_type, included_in_contract').range(0, 9999),
    supabase.from('purchase_invoices').select('id, customer_id, total_amount, used_as_payment').range(0, 9999),
    supabase.from('customer_general_discounts').select('id, customer_id, discount_value').eq('status', 'active'),
    supabase.from('composite_tasks').select('id, customer_id, combined_invoice_id, print_task_id, customer_total').range(0, 9999),
    supabase.from('print_tasks').select('id, invoice_id').range(0, 9999),
    supabase.from('friend_billboard_rentals').select('id, friend_company_id, friend_rental_cost, customer_rental_price, used_as_payment, contract_number, start_date, billboard_id').range(0, 9999),
    supabase.from('friend_companies').select('id, name'),
    supabase.from('cutout_tasks').select('id, invoice_id').range(0, 9999),
  ]);

  const payments = pRes.data || [];
  const contracts = cRes.data || [];
  const customers = cuRes.data || [];
  const salesInvoices = siRes.data || [];
  const printedInvoices = piRes.data || [];
  const purchaseInvoices = puRes.data || [];
  const discounts = dRes.data || [];
  const compositeTasks = ctRes.data || [];
  const printTasks = ptRes.data || [];
  const friendBillboardRentals = fbrRes.data || [];
  const friendCompanies = fcRes.data || [];
  const cutoutTasks = cutRes.data || [];

  // Exclude printed invoices related to composite tasks
  const filterCompositeRelatedPrintedInvoices = (
    printedInvoices = [],
    compositeTasks = [],
    printTasks = [],
    cutoutTasks = []
  ) => {
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

  const calculateTotalRemainingDebt = (
    contracts,
    payments,
    salesInvoices,
    printedInvoices,
    purchaseInvoices,
    discounts,
    compositeTasks = [],
    extraPurchases = 0
  ) => {
    const totalContracts = contracts.reduce(
      (sum, c) => sum + (Number(c['Total']) || 0),
      0
    );
    const totalSalesInvoices = salesInvoices.reduce(
      (sum, inv) => sum + (Number(inv.total_amount) || 0),
      0
    );
    const compositeTaskInvoiceIds = new Set(compositeTasks.map((t) => t.combined_invoice_id).filter(Boolean));
    const totalPrintedInvoices = printedInvoices.reduce((sum, inv) => {
      if (compositeTaskInvoiceIds.has(inv.id)) return sum;
      if (inv.included_in_contract === true) return sum;
      const val = Number(inv.total_amount ?? inv.print_cost) || 0;
      return sum + val;
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

    const totalDebits = totalContracts + totalSalesInvoices + totalPrintedInvoices + totalOtherDebts + totalCompositeTasks;

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

    const totalPurchasesFromInvoices = purchaseInvoices.reduce((sum, inv) => {
      const totalAmount = Number(inv.total_amount) || 0;
      const usedAmount = Number(inv.used_as_payment) || 0;
      return sum + Math.max(0, totalAmount - usedAmount);
    }, 0);

    const totalPurchases = totalPurchasesFromInvoices + (Number(extraPurchases) || 0);

    return totalDebits - totalCredits - discounts - totalPurchases;
  };

  const calculateCustomerFinancials = (
    contracts,
    payments,
    salesInvoices,
    printedInvoices,
    purchaseInvoices,
    discounts,
    compositeTasks,
    friendRentals = 0
  ) => {
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
      if (isDebt && !isLinked) {
        return sum + (Number(p.amount) || 0);
      }
      return sum;
    }, 0);
    const totalDebt = totalContracts + totalSalesInvoices + totalPrintedInvoices + totalCompositeTasks + totalOtherDebts;
    const totalPaid = payments.reduce((sum, p) => {
      const isCredit = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || 
                       p.entry_type === 'payment' || p.entry_type === 'general_credit';
      if (isCredit) {
        return sum + (Number(p.amount) || 0);
      }
      return sum;
    }, 0);
    const totalPurchases = purchaseInvoices.reduce((sum, inv) => {
      const totalAmount = Number(inv.total_amount) || 0;
      const usedAmount = Number(inv.used_as_payment) || 0;
      return sum + Math.max(0, totalAmount - usedAmount);
    }, 0) + friendRentals;
    const repaymentPercentage = totalDebt > 0 
      ? Math.round(((totalPaid + totalDiscounts + totalPurchases) / totalDebt) * 100) 
      : 100;
    return {
      totalDebt,
      totalPaid,
      remainingDebt,
      repaymentPercentage,
      totalPurchases,
      totalFriendRentals: friendRentals
    };
  };

  // Customers.tsx useMemo replication
  const contractsByCustomerId = new Map();
  for (const c of contracts) {
    const cid = c.customer_id;
    if (cid) {
      if (!contractsByCustomerId.has(cid)) contractsByCustomerId.set(cid, []);
      contractsByCustomerId.get(cid).push(c);
    }
  }

  const paymentsByCustomerId = new Map();
  for (const p of payments) {
    const cid = p.customer_id;
    if (cid) {
      if (!paymentsByCustomerId.has(cid)) paymentsByCustomerId.set(cid, []);
      paymentsByCustomerId.get(cid).push(p);
    }
  }

  const salesInvoicesByCustomerId = new Map();
  for (const inv of salesInvoices) {
    const cid = inv.customer_id;
    if (cid) {
      if (!salesInvoicesByCustomerId.has(cid)) salesInvoicesByCustomerId.set(cid, []);
      salesInvoicesByCustomerId.get(cid).push(inv);
    }
  }

  const printedInvoicesByCustomerId = new Map();
  for (const inv of printedInvoices) {
    const cid = inv.customer_id;
    if (cid) {
      if (!printedInvoicesByCustomerId.has(cid)) printedInvoicesByCustomerId.set(cid, []);
      printedInvoicesByCustomerId.get(cid).push(inv);
    }
  }

  const purchaseInvoicesByCustomerId = new Map();
  for (const inv of purchaseInvoices) {
    const cid = inv.customer_id;
    if (cid) {
      if (!purchaseInvoicesByCustomerId.has(cid)) purchaseInvoicesByCustomerId.set(cid, []);
      purchaseInvoicesByCustomerId.get(cid).push(inv);
    }
  }

  const discountsByCustomerId = new Map();
  for (const d of discounts) {
    const cid = d.customer_id;
    if (cid) {
      if (!discountsByCustomerId.has(cid)) discountsByCustomerId.set(cid, []);
      discountsByCustomerId.get(cid).push(d);
    }
  }

  const compositeTasksByCustomerId = new Map();
  for (const t of compositeTasks) {
    const cid = t.customer_id;
    if (cid) {
      if (!compositeTasksByCustomerId.has(cid)) compositeTasksByCustomerId.set(cid, []);
      compositeTasksByCustomerId.get(cid).push(t);
    }
  }

  const customerObj = customers.find(c => c.id === customerId);
  const name = customerObj?.name || '—';
  
  const customerContracts = contractsByCustomerId.get(customerId) || [];
  const customerPayments = paymentsByCustomerId.get(customerId) || [];
  const customerSalesInvoices = salesInvoicesByCustomerId.get(customerId) || [];
  const customerPurchaseInvoices = purchaseInvoicesByCustomerId.get(customerId) || [];
  const customerDiscounts = discountsByCustomerId.get(customerId) || [];
  const customerCompositeTasks = compositeTasksByCustomerId.get(customerId) || [];

  const customerPrintedInvoices = filterCompositeRelatedPrintedInvoices(
    printedInvoicesByCustomerId.get(customerId) || [],
    customerCompositeTasks,
    printTasks,
    cutoutTasks
  );

  const financials = calculateCustomerFinancials(
    customerContracts,
    customerPayments,
    customerSalesInvoices,
    customerPrintedInvoices,
    customerPurchaseInvoices,
    customerDiscounts,
    customerCompositeTasks,
    0
  );

  console.log("Customer name:", name);
  console.log("Financials on Customers page:");
  console.log("  totalDebt:", financials.totalDebt);
  console.log("  totalPaid:", financials.totalPaid);
  console.log("  remainingDebt:", financials.remainingDebt);
  console.log("  totalPurchases:", financials.totalPurchases);
}

run().catch(console.error);
