const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://atqjaiebixuzomrfwilu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTkxOTcsImV4cCI6MjA3Mjc3NTE5N30.OGAQFsAl1Eo1tmPZ93VZoSL5tO2FYZa_szeRvUmoj-4";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function calculateTotalRemainingDebt(
  contracts,
  payments,
  salesInvoices,
  printedInvoices,
  purchaseInvoices,
  discounts,
  compositeTasks = [],
  extraPurchases = 0
) {
  const totalContracts = contracts.reduce((sum, c) => sum + (Number(c.Total) || 0), 0);
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
}

function calculateCustomerFinancials(
  contracts,
  payments,
  salesInvoices,
  printedInvoices,
  purchaseInvoices,
  discounts,
  compositeTasks,
  friendRentals = 0
) {
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

  return remainingDebt;
}

async function run() {
  console.log("Fetching data...");
  const [
    { data: paymentsRes },
    { data: contractsRes },
    { data: customersRes },
    { data: salesInvoicesRes },
    { data: printedInvoicesRes },
    { data: purchaseInvoicesRes },
    { data: discountsRes },
    { data: compositeTasksRes },
    { data: printTasksRes },
    { data: friendBillboardRentalsRes },
    { data: friendCompaniesRes }
  ] = await Promise.all([
    supabase.from('customer_payments').select('*'),
    supabase.from('Contract').select('*'),
    supabase.from('customers').select('*'),
    supabase.from('sales_invoices').select('*'),
    supabase.from('printed_invoices').select('*'),
    supabase.from('purchase_invoices').select('*'),
    supabase.from('customer_general_discounts').select('*').eq('status', 'active'),
    supabase.from('composite_tasks').select('*'),
    supabase.from('print_tasks').select('*'),
    supabase.from('friend_billboard_rentals').select('*'),
    supabase.from('friend_companies').select('*')
  ]);

  const payments = paymentsRes || [];
  const contracts = contractsRes || [];
  const customers = customersRes || [];
  const salesInvoices = salesInvoicesRes || [];
  const printedInvoices = printedInvoicesRes || [];
  const purchaseInvoices = purchaseInvoicesRes || [];
  const discounts = discountsRes || [];
  const compositeTasks = compositeTasksRes || [];
  const printTasks = printTasksRes || [];
  const friendBillboardRentals = friendBillboardRentalsRes || [];
  const friendCompanies = friendCompaniesRes || [];

  console.log(`Loaded ${customers.length} customers, ${contracts.length} contracts, ${payments.length} payments.`);

  const contractsByCustomerId = new Map();
  contracts.forEach(c => {
    if (c.customer_id) {
      if (!contractsByCustomerId.has(c.customer_id)) contractsByCustomerId.set(c.customer_id, []);
      contractsByCustomerId.get(c.customer_id).push(c);
    }
  });

  const paymentsByCustomerId = new Map();
  payments.forEach(p => {
    if (p.customer_id) {
      if (!paymentsByCustomerId.has(p.customer_id)) paymentsByCustomerId.set(p.customer_id, []);
      paymentsByCustomerId.get(p.customer_id).push(p);
    }
  });

  const salesInvoicesByCustomerId = new Map();
  salesInvoices.forEach(inv => {
    if (inv.customer_id) {
      if (!salesInvoicesByCustomerId.has(inv.customer_id)) salesInvoicesByCustomerId.set(inv.customer_id, []);
      salesInvoicesByCustomerId.get(inv.customer_id).push(inv);
    }
  });

  const printedInvoicesByCustomerId = new Map();
  printedInvoices.forEach(inv => {
    if (inv.customer_id) {
      if (!printedInvoicesByCustomerId.has(inv.customer_id)) printedInvoicesByCustomerId.set(inv.customer_id, []);
      printedInvoicesByCustomerId.get(inv.customer_id).push(inv);
    }
  });

  const purchaseInvoicesByCustomerId = new Map();
  purchaseInvoices.forEach(inv => {
    if (inv.customer_id) {
      if (!purchaseInvoicesByCustomerId.has(inv.customer_id)) purchaseInvoicesByCustomerId.set(inv.customer_id, []);
      purchaseInvoicesByCustomerId.get(inv.customer_id).push(inv);
    }
  });

  const discountsByCustomerId = new Map();
  discounts.forEach(d => {
    if (d.customer_id) {
      if (!discountsByCustomerId.has(d.customer_id)) discountsByCustomerId.set(d.customer_id, []);
      discountsByCustomerId.get(d.customer_id).push(d);
    }
  });

  const compositeTasksByCustomerId = new Map();
  compositeTasks.forEach(t => {
    if (t.customer_id) {
      if (!compositeTasksByCustomerId.has(t.customer_id)) compositeTasksByCustomerId.set(t.customer_id, []);
      compositeTasksByCustomerId.get(t.customer_id).push(t);
    }
  });

  const friendBillboardRentalsByCompanyId = new Map();
  friendBillboardRentals.forEach(r => {
    if (r.friend_company_id) {
      if (!friendBillboardRentalsByCompanyId.has(r.friend_company_id)) friendBillboardRentalsByCompanyId.set(r.friend_company_id, []);
      friendBillboardRentalsByCompanyId.get(r.friend_company_id).push(r);
    }
  });

  customers.forEach(customer => {
    const customerId = customer.id;
    const name = customer.name;

    const customerContracts = contractsByCustomerId.get(customerId) || [];
    const customerPayments = paymentsByCustomerId.get(customerId) || [];
    const customerSalesInvoices = salesInvoicesByCustomerId.get(customerId) || [];
    const customerPurchaseInvoices = purchaseInvoicesByCustomerId.get(customerId) || [];
    const customerDiscounts = discountsByCustomerId.get(customerId) || [];
    const customerCompositeTasks = compositeTasksByCustomerId.get(customerId) || [];

    // --- 1. Customers.tsx Logic ---
    const compositeTaskInvoiceIds = new Set(
      customerCompositeTasks.map((t) => String(t.combined_invoice_id || '')).filter(Boolean)
    );
    const compositePrintTaskIds = new Set(
      customerCompositeTasks.map((t) => String(t.print_task_id || '')).filter(Boolean)
    );
    const compositePrintInvoiceIds = new Set(
      printTasks
        .filter((pt) => compositePrintTaskIds.has(String(pt.id || '')))
        .map((pt) => String(pt.invoice_id || ''))
        .filter(Boolean)
    );
    const customerPrintedInvoices_CustomersPage = (printedInvoicesByCustomerId.get(customerId) || []).filter((inv) => {
      if (inv.invoice_type === 'composite_task') return false;
      if (compositeTaskInvoiceIds.has(String(inv.id || ''))) return false;
      if (compositePrintInvoiceIds.has(String(inv.id || ''))) return false;
      return true;
    });

    let friendRentals_CustomersPage = 0;
    const addedFriendBillboardRentals = new Set();
    const addedFriendRentalGroups = new Set();
    const linkedFriendCompanyId = customer.linked_friend_company_id || null;
    const friendCompany = friendCompanies.find(fc => fc.id === linkedFriendCompanyId);
    const linkedFriendCompanyName = friendCompany ? friendCompany.name : null;

    if (linkedFriendCompanyId) {
      const dbFriendRentals = friendBillboardRentalsByCompanyId.get(linkedFriendCompanyId) || [];
      dbFriendRentals.forEach(rental => {
        const rentalCost = Number(rental.friend_rental_cost) || Number(rental.customer_rental_price) || 0;
        const usedAsPayment = Number(rental.used_as_payment) || 0;
        const remainingAmount = Math.max(0, rentalCost - usedAsPayment);
        
        if (remainingAmount > 0) {
          friendRentals_CustomersPage += remainingAmount;
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
      
      if (linkedFriendCompanyName) {
        for (const contract of customerContracts) {
          const friendData = contract.friend_rental_data;
          if (friendData) {
            const items = typeof friendData === 'string' ? (() => { try { return JSON.parse(friendData); } catch { return []; } })() : friendData;
            const groupedByDate = new Map();

            const processItem = (cost, name, startDate, billboardId) => {
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
              const entries = Object.entries(items);
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
                friendRentals_CustomersPage += totalCost;
                addedFriendRentalGroups.add(groupKey);
              }
            });
          }
        }
      }
    }

    const balance_CustomersPage = calculateCustomerFinancials(
      customerContracts,
      customerPayments,
      customerSalesInvoices,
      customerPrintedInvoices_CustomersPage,
      customerPurchaseInvoices,
      customerDiscounts,
      customerCompositeTasks,
      friendRentals_CustomersPage
    );

    // --- 2. CustomerBilling.tsx Logic ---
    const discountSum_BillingPage = customerDiscounts
      .filter((d) => d.discount_type === 'fixed')
      .reduce((sum, d) => sum + (Number(d.discount_value) || 0), 0);

    let friendRentalsData_BillingPage = [];
    if (linkedFriendCompanyId) {
      friendRentalsData_BillingPage = friendBillboardRentals.filter(r => r.friend_company_id === linkedFriendCompanyId);
    }
    const totalFriendRentals_BillingPage = friendRentalsData_BillingPage.reduce((sum, rental) => {
      return sum + Math.max(0, (Number(rental.friend_rental_cost) || 0) - (Number(rental.used_as_payment) || 0));
    }, 0);

    const excludedInvoiceIds = new Set();
    (customerCompositeTasks || [])
      .map((t) => t.combined_invoice_id)
      .filter(Boolean)
      .forEach((id) => excludedInvoiceIds.add(id));

    if (customerId) {
      const compositePrintTaskIds = new Set(
        (customerCompositeTasks || []).map((task) => String(task.print_task_id || '')).filter(Boolean)
      );
      const userPrintTasks = printTasks.filter(pt => pt.customer_id === customerId);
      userPrintTasks
        .filter((t) => compositePrintTaskIds.has(String(t.id)) || t.composite_task_id)
        .map((t) => t.invoice_id)
        .filter(Boolean)
        .forEach((id) => excludedInvoiceIds.add(id));
    }

    const customerPrintedInvoices_BillingPage = (printedInvoicesByCustomerId.get(customerId) || []).filter((inv) => {
      if (inv.invoice_type === 'composite_task') return false;
      if (excludedInvoiceIds.has(inv.id)) return false;
      return true;
    });

    const balance_BillingPage = calculateTotalRemainingDebt(
      customerContracts,
      customerPayments,
      customerSalesInvoices,
      customerPrintedInvoices_BillingPage,
      customerPurchaseInvoices,
      discountSum_BillingPage,
      customerCompositeTasks,
      totalFriendRentals_BillingPage
    );

    if (Math.abs(balance_CustomersPage - balance_BillingPage) > 1) {
      console.log(`Discrepancy for customer: ${name} (ID: ${customerId})`);
      console.log(`  Customers.tsx Balance:     ${balance_CustomersPage}`);
      console.log(`  CustomerBilling.tsx Balance:${balance_BillingPage}`);
      console.log(`  Diff:                       ${balance_CustomersPage - balance_BillingPage}`);
      console.log(`  Details:`);
      console.log(`    Customers.tsx printed invoices:      ${customerPrintedInvoices_CustomersPage.length} invoices (sum = ${customerPrintedInvoices_CustomersPage.reduce((s,i)=>s+(Number(i.total_amount)||0), 0)})`);
      console.log(`    CustomerBilling.tsx printed invoices:${customerPrintedInvoices_BillingPage.length} invoices (sum = ${customerPrintedInvoices_BillingPage.reduce((s,i)=>s+(Number(i.total_amount)||0), 0)})`);
      console.log(`    Customers.tsx friend rentals:        ${friendRentals_CustomersPage}`);
      console.log(`    CustomerBilling.tsx friend rentals:  ${totalFriendRentals_BillingPage}`);
    }
  });

  console.log("Done.");
}

run().catch(console.error);
