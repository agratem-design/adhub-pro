const contracts = [
  { Contract_Number: 1170, Total: 24000 },
  { Contract_Number: 1228, Total: 385900 },
  { Contract_Number: 1196, Total: 37500 },
  { Contract_Number: 1115, Total: 240000 },
  { Contract_Number: 1098, Total: 300000 },
  { Contract_Number: 1100, Total: 450000 }
];

const payments = [
  { amount: 100000, entry_type: 'payment', contract_number: 1098 },
  { amount: 1000, entry_type: 'payment', contract_number: 1115 },
  { amount: 80000, entry_type: 'payment', contract_number: 1098 },
  { amount: 155000, entry_type: 'payment', contract_number: 1115 },
  { amount: 255000, entry_type: 'payment', contract_number: 1100 },
  { amount: 195000, entry_type: 'payment', contract_number: 1100 },
  { amount: 7650, entry_type: 'payment', contract_number: null, notes: "توزيع على مهمة مجمعة #1115 (إعادة تركيب)" },
  { amount: 20000, entry_type: 'payment', contract_number: 1098 },
  { amount: 24000, entry_type: 'payment', contract_number: 1170 },
  { amount: 37950, entry_type: 'payment', contract_number: 1228 },
  { amount: 84000, entry_type: 'payment', contract_number: 1115 },
  { amount: 37500, entry_type: 'payment', contract_number: 1196 },
  { amount: 4500, entry_type: 'payment', contract_number: null, notes: "توزيع على مهمة مجمعة #1100 (إعادة تركيب)" },
  { amount: 192950, entry_type: 'payment', contract_number: 1228 },
  { amount: 155000, entry_type: 'payment', contract_number: 1228, notes: "مقايضة من فاتورة مشتريات" },
  { amount: 45000, entry_type: 'payment', contract_number: 1098 },
  { amount: -153000, entry_type: 'purchase_invoice', contract_number: null },
  { amount: 55000, entry_type: 'payment', contract_number: 1098 },
  { amount: 1000, entry_type: 'payment', contract_number: null },
  { amount: 30000, entry_type: 'payment', contract_number: null, printed_invoice_id: "f714c33a-462e-441f-8327-9005a97c23c4" },
  { amount: 8000, entry_type: 'payment', contract_number: null, notes: "توزيع على مهمة مجمعة #1228 (تركيب جديد)" }
];

const printedInvoices = [
  { id: "e843b018-0df0-4c28-a6e4-a4fd661b2d4a", invoice_number: "PT-1775329462393", total_amount: 3472.70, created_at: "2026-07-15", paid: false },
  { id: "60388c0b-35cb-418d-b519-fd2cbb1eec77", invoice_number: "INV-1765311369419326", total_amount: 13950, created_at: "2026-07-15", paid: false },
  { id: "b3ae4bac-5b9e-4b97-91b0-cb2eeca65147", invoice_number: "INV-1765309749126719", total_amount: 2400, created_at: "2026-07-15", paid: false },
  { id: "19331b40-9bd4-41da-87d5-c9c7a07decae", invoice_number: "INV-1765311316171818", total_amount: 8600, created_at: "2026-07-15", paid: false },
  { id: "e55aecbf-4fa1-4c46-ae17-6c486623cffe", invoice_number: "INV-1765311255371508", total_amount: 48800, created_at: "2026-07-15", paid: false },
  { id: "f714c33a-462e-441f-8327-9005a97c23c4", invoice_number: "INV-1783323170439049", total_amount: 78940, created_at: "2026-07-15", paid: false }
];

const salesInvoices = [
  { id: "s1", invoice_number: "SALE-1772880802188", total_amount: 6200, remaining_amount: 6200, paid_amount: 0, created_at: "2026-07-15", paid: false },
  { id: "s2", invoice_number: "SALE-1765309539676", total_amount: 26500, remaining_amount: 26500, paid_amount: 0, created_at: "2026-07-15", paid: false }
];

const purchaseInvoices = [
  { id: "p1", total_amount: 155000, used_as_payment: 153000 }
];

const compositeTasks = [
  { id: "ct1", customer_total: 60100, combined_invoice_id: null, print_task_id: "55dbd1c0-91eb-4134-9a65-3387fb491add", created_at: "2026-07-15", paid_amount: 0, discount_amount: 0 },
  { id: "ct2", customer_total: 7650, combined_invoice_id: null, print_task_id: "00e45252-17a5-45fd-9fe3-503f700fdce1", created_at: "2026-07-15", paid_amount: 7650, discount_amount: 0 },
  { id: "ct3", customer_total: 8000, combined_invoice_id: null, print_task_id: null, created_at: "2026-07-15", paid_amount: 8000, discount_amount: 0 }
];

const printTasks = [
  { id: "ffda6c82-0e3d-4d97-9d74-0043a8241374", invoice_id: "60388c0b-35cb-418d-b519-fd2cbb1eec77", composite_task_id: null, is_composite: false },
  { id: "00e45252-17a5-45fd-9fe3-503f700fdce1", invoice_id: "e843b018-0df0-4c28-a6e4-a4fd661b2d4a", composite_task_id: null, is_composite: true },
  { id: "55dbd1c0-91eb-4134-9a65-3387fb491add", invoice_id: null, composite_task_id: null, is_composite: true }
];

const cutoutTasks = [];

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

const billablePrintedInvoices = filterCompositeRelatedPrintedInvoices(
  printedInvoices,
  compositeTasks,
  printTasks,
  cutoutTasks
);

// AccountOverduePayments loadData logic replica
const runCalculation = () => {
  const map = new Map();
  const customerId = "1ed051fc-abe7-4b85-a087-368eb31c59fe";
  const customerName = "علي عمار";

  const key = customerId;
  map.set(key, {
    customerId: customerId,
    customerName: customerName,
    totalOverdue: 0,
    invoicesCount: 0,
    invoices: []
  });

  // 1. printed_invoices loop
  for (const inv of printedInvoices) {
    if (inv.paid) continue;
    const item = {
      invoiceId: inv.id,
      amount: inv.total_amount,
      type: 'printed',
      invoiceNumber: inv.invoice_number
    };
    map.get(key).invoices.push(item);
  }

  // 2. sales_invoices loop
  for (const sale of salesInvoices) {
    if (sale.paid) continue;
    const item = {
      invoiceId: sale.id,
      amount: sale.remaining_amount,
      type: 'sales',
      invoiceNumber: sale.invoice_number
    };
    map.get(key).invoices.push(item);
  }

  // 3. composite_tasks loop
  for (const ct of compositeTasks) {
    const total = Number(ct.customer_total) || 0;
    const paid = Number(ct.paid_amount) || 0;
    const discount = Number(ct.discount_amount) || 0;
    const amount = Math.max(0, total - paid - discount);
    if (amount <= 0.5) continue;
    const item = {
      invoiceId: ct.id,
      amount: amount,
      type: 'composite',
      invoiceNumber: `مهمة #${ct.task_number || ct.id}`
    };
    map.get(key).invoices.push(item);
  }

  // filter composite-related printed invoices inside customer invoices list
  const customerAcc = map.get(key);
  const billablePrintedIds = new Set(billablePrintedInvoices.map(inv => inv.id));
  
  console.log("Invoices before filtering duplicate print tasks:");
  customerAcc.invoices.forEach(inv => console.log(`- ${inv.type} ${inv.invoiceNumber}: ${inv.amount}`));

  customerAcc.invoices = customerAcc.invoices.filter(inv => {
    if (inv.type === 'printed') {
      return billablePrintedIds.has(inv.invoiceId);
    }
    return true;
  });

  console.log("\nInvoices after filtering duplicate print tasks:");
  customerAcc.invoices.forEach(inv => console.log(`- ${inv.type} ${inv.invoiceNumber}: ${inv.amount}`));

  const filteredSum = customerAcc.invoices.reduce((sum, inv) => sum + inv.amount, 0);
  console.log("\nFiltered Sum (unpaid items):", filteredSum);

  const rem = 207990; // calculated remaining debt
  const totalOverdue = Math.min(filteredSum, Math.max(0, rem));
  console.log("totalOverdue:", totalOverdue);
};

runCalculation();
