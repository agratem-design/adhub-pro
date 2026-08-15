const contracts = []; // Assume contracts are empty

const payments = [
  { amount: 100000, entry_type: 'payment', contract_number: 1098, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 1000, entry_type: 'payment', contract_number: 1115, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 80000, entry_type: 'payment', contract_number: 1098, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 155000, entry_type: 'payment', contract_number: 1115, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 255000, entry_type: 'payment', contract_number: 1100, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 195000, entry_type: 'payment', contract_number: 1100, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 7650, entry_type: 'payment', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", notes: "توزيع على مهمة مجمعة #1115", composite_task_id: "cc927d41-1a43-4543-a310-22003ec5a179" },
  { amount: 20000, entry_type: 'payment', contract_number: 1098, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 24000, entry_type: 'payment', contract_number: 1170, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 37950, entry_type: 'payment', contract_number: 1228, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 84000, entry_type: 'payment', contract_number: 1115, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 37500, entry_type: 'payment', contract_number: 1196, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 4500, entry_type: 'payment', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", notes: "توزيع على مهمة مجمعة #1100", composite_task_id: "754301a5-ad00-4b15-a17d-178bf28e13b6" },
  { amount: 192950, entry_type: 'payment', contract_number: 1228, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 155000, entry_type: 'payment', contract_number: 1228, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", notes: "مقايضة" },
  { amount: 45000, entry_type: 'payment', contract_number: 1098, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: -153000, entry_type: 'purchase_invoice', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 55000, entry_type: 'payment', contract_number: 1098, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 1000, entry_type: 'payment', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 30000, entry_type: 'payment', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", printed_invoice_id: "f714c33a-462e-441f-8327-9005a97c23c4" },
  { amount: 8000, entry_type: 'payment', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", notes: "توزيع على مهمة مجمعة #1228", composite_task_id: "4ced2b6f-adc3-4fa1-8098-d2ec541f3151" }
];

const salesInvoices = [
  { id: "s1", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", total_amount: 6200 },
  { id: "s2", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", total_amount: 26500 }
];

const printedInvoices = [
  { id: "e843b018-0df0-4c28-a6e4-a4fd661b2d4a", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", total_amount: 3472.70 },
  { id: "60388c0b-35cb-418d-b519-fd2cbb1eec77", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", total_amount: 13950 },
  { id: "b3ae4bac-5b9e-4b97-91b0-cb2eeca65147", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", total_amount: 2400 },
  { id: "19331b40-9bd4-41da-87d5-c9c7a07decae", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", total_amount: 8600 },
  { id: "e55aecbf-4fa1-4c46-ae17-6c486623cffe", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", total_amount: 48800 },
  { id: "f714c33a-462e-441f-8327-9005a97c23c4", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", total_amount: 78940 }
];

const purchaseInvoices = [
  { id: "p1", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", total_amount: 155000, used_as_payment: 153000 }
];

const compositeTasks = [
  { id: "754301a5-ad00-4b15-a17d-178bf28e13b6", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", customer_total: 60099.999999999998, combined_invoice_id: null, print_task_id: "55dbd1c0-91eb-4134-9a65-3387fb491add", discount_amount: 63.4, paid_amount: 4500 },
  { id: "cc927d41-1a43-4543-a310-22003ec5a179", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", customer_total: 7650.0, combined_invoice_id: null, print_task_id: "00e45252-17a5-45fd-9fe3-503f700fdce1", discount_amount: 314.9, paid_amount: 7650 },
  { id: "4ced2b6f-adc3-4fa1-8098-d2ec541f3151", customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", customer_total: 8000, combined_invoice_id: null, print_task_id: null, discount_amount: 0, paid_amount: 8000 }
];

const printTasks = [
  { id: "ffda6c82-0e3d-4d97-9d74-0043a8241374", invoice_id: "60388c0b-35cb-418d-b519-fd2cbb1eec77", composite_task_id: null, is_composite: false },
  { id: "00e45252-17a5-45fd-9fe3-503f700fdce1", invoice_id: "e843b018-0df0-4c28-a6e4-a4fd661b2d4a", composite_task_id: null, is_composite: true },
  { id: "55dbd1c0-91eb-4134-9a65-3387fb491add", invoice_id: null, composite_task_id: null, is_composite: true }
];

const cutoutTasks = [
  { id: "9047180a-b83a-4a83-bb37-d52503c8d62a", invoice_id: null, is_composite: true }
];

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

  console.log("totalContracts inside function:", totalContracts);
  console.log("totalDebits:", totalDebits);
  console.log("totalCredits:", totalCredits);
  return totalDebits - totalCredits - discounts - totalPurchases;
};

const customerPrintedInvoices = filterCompositeRelatedPrintedInvoices(
  printedInvoices,
  compositeTasks,
  printTasks,
  cutoutTasks
);

const rem = calculateTotalRemainingDebt(
  contracts,
  payments,
  salesInvoices,
  customerPrintedInvoices,
  purchaseInvoices,
  0,
  compositeTasks,
  0
);

console.log("rem with empty contracts:", rem);
