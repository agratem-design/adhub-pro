// Overdue calculations check for Ali Ammar

const contracts = [
  {
    Contract_Number: 1170,
    Total: 24000,
    customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe",
    "Customer Name": "علي عمار",
    "Ad Type": "إعلانات",
    "Contract Date": "2025-09-01",
    installments_data: [
      { amount: 20000, dueDate: "2025-09-01" },
      { amount: 2000, dueDate: "2025-10-01" },
      { amount: 2000, dueDate: "2025-11-01" }
    ]
  },
  {
    Contract_Number: 1228,
    Total: 385900,
    customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe",
    "Customer Name": "علي عمار",
    "Ad Type": "إعلانات",
    "Contract Date": "2026-04-01",
    installments_data: [
      { amount: 192950, dueDate: "2026-04-01" },
      { amount: 192950, dueDate: "2026-05-01" }
    ]
  },
  {
    Contract_Number: 1196,
    Total: 37500,
    customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe",
    "Customer Name": "علي عمار",
    "Ad Type": "إعلانات",
    "Contract Date": "2025-08-10",
    installments_data: [
      { amount: 18750, dueDate: "2025-08-10" },
      { amount: 18750, dueDate: "2025-09-10" }
    ]
  },
  {
    Contract_Number: 1115,
    Total: 240000,
    customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe",
    "Customer Name": "علي عمار",
    "Ad Type": "إعلانات",
    "Contract Date": "2025-08-10",
    installments_data: [
      { amount: 120000, dueDate: "2025-08-10" },
      { amount: 120000, dueDate: "2025-09-10" }
    ]
  },
  {
    Contract_Number: 1098,
    Total: 300000,
    customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe",
    "Customer Name": "علي عمار",
    "Ad Type": "إعلانات",
    "Contract Date": "2025-06-01",
    installments_data: [
      { amount: 150000, dueDate: "2025-06-01" },
      { amount: 150000, dueDate: "2025-07-01" }
    ]
  },
  {
    Contract_Number: 1100,
    Total: 450000,
    customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe",
    "Customer Name": "علي عمار",
    "Ad Type": "إعلانات",
    "Contract Date": "2025-06-02",
    installments_data: [
      { amount: 225000, dueDate: "2025-06-02" },
      { amount: 225000, dueDate: "2025-06-09" }
    ]
  }
];

const payments = [
  { amount: 100000, entry_type: 'payment', contract_number: 1098, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 1000, entry_type: 'payment', contract_number: 1115, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 80000, entry_type: 'payment', contract_number: 1098, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 155000, entry_type: 'payment', contract_number: 1115, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 255000, entry_type: 'payment', contract_number: 1100, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 195000, entry_type: 'payment', contract_number: 1100, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 7650, entry_type: 'payment', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", notes: "توزيع على مهمة مجمعة #1115" },
  { amount: 20000, entry_type: 'payment', contract_number: 1098, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 24000, entry_type: 'payment', contract_number: 1170, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 37950, entry_type: 'payment', contract_number: 1228, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 84000, entry_type: 'payment', contract_number: 1115, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 37500, entry_type: 'payment', contract_number: 1196, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 4500, entry_type: 'payment', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", notes: "توزيع على مهمة مجمعة #1100" },
  { amount: 192950, entry_type: 'payment', contract_number: 1228, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 155000, entry_type: 'payment', contract_number: 1228, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", notes: "مقايضة" },
  { amount: 45000, entry_type: 'payment', contract_number: 1098, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: -153000, entry_type: 'purchase_invoice', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 55000, entry_type: 'payment', contract_number: 1098, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 1000, entry_type: 'payment', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe" },
  { amount: 30000, entry_type: 'payment', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", printed_invoice_id: "f714c33a-462e-441f-8327-9005a97c23c4" },
  { amount: 8000, entry_type: 'payment', contract_number: null, customer_id: "1ed051fc-abe7-4b85-a087-368eb31c59fe", notes: "توزيع على مهمة مجمعة #1228" }
];

function computeOverdueData(
  contracts,
  allPayments,
  accountPayments
) {
  const today = new Date();
  
  // 1. Group contract payments by contract number
  const paymentsByContract = new Map();
  allPayments.forEach((p) => {
    const amt = Number(p.amount) || 0;
    if (amt <= 0 || !p.contract_number) return;
    const contractNum = Number(p.contract_number);
    if (isNaN(contractNum)) return;
    
    if (!paymentsByContract.has(contractNum)) {
      paymentsByContract.set(contractNum, []);
    }
    paymentsByContract.get(contractNum).push({ amount: amt, paid_at: p.paid_at || '' });
  });

  // 2. Sum general account payments by customer_id
  const accountCreditByCustomer = new Map();
  accountPayments.forEach((p) => {
    const amt = Number(p.amount) || 0;
    if (amt <= 0 || !p.customer_id) return;
    accountCreditByCustomer.set(
      p.customer_id,
      (accountCreditByCustomer.get(p.customer_id) || 0) + amt
    );
  });

  const overdue = [];

  // 3. Process each contract's installments
  for (const contract of contracts) {
    try {
      const contractNumber = Number(contract.Contract_Number);
      if (isNaN(contractNumber)) continue;

      let installments = contract.installments_data || [];

      if (!installments || installments.length === 0) {
        const contractTotal = Number(contract.Total) || 0;
        const contractPayments = paymentsByContract.get(contractNumber) || [];
        const totalContractPaid = contractPayments.reduce((sum, p) => sum + p.amount, 0);
        const remainingTotal = contractTotal - totalContractPaid;

        if (remainingTotal > 0 && contract['Contract Date']) {
          const contractDate = new Date(contract['Contract Date']);
          const dueDate = new Date(contractDate);
          dueDate.setDate(dueDate.getDate() + 15);
          const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays > 0) {
            overdue.push({
              contractNumber,
              customerName: contract['Customer Name'] || 'غير معروف',
              customerId: contract.customer_id || null,
              installmentAmount: remainingTotal,
              dueDate: dueDate.toISOString().split('T')[0],
              description: 'إجمالي العقد',
              daysOverdue: diffDays,
              adType: contract['Ad Type'] || undefined,
              originalAmount: contractTotal,
              contractPaymentApplied: totalContractPaid,
              accountCreditApplied: 0
            });
          }
        }
        continue;
      }

      // Sort installments by due date
      const installmentsSorted = [...installments]
        .filter((i) => i.dueDate)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      // Get payments for this contract sorted by date
      const contractPayments = [...(paymentsByContract.get(contractNumber) || [])]
        .sort((a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime());

      const totalPaid = contractPayments.reduce((s, p) => s + p.amount, 0);
      let paymentsRemaining = totalPaid;

      for (const inst of installmentsSorted) {
        const dueDate = new Date(inst.dueDate);
        const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          const currentDue = Number(inst.amount) || 0;
          const allocated = Math.min(currentDue, Math.max(0, paymentsRemaining));
          const overdueAmount = Math.max(0, currentDue - allocated);
          paymentsRemaining = Math.max(0, paymentsRemaining - allocated);

          if (overdueAmount > 0) {
            overdue.push({
              contractNumber,
              customerName: contract['Customer Name'] || 'غير معروف',
              customerId: contract.customer_id || null,
              installmentAmount: overdueAmount,
              dueDate: inst.dueDate,
              description: inst.description || 'دفعة',
              daysOverdue: diffDays,
              adType: contract['Ad Type'] || undefined,
              originalAmount: currentDue,
              contractPaymentApplied: allocated,
              accountCreditApplied: 0
            });
          }
        }
      }
    } catch (e) {
      console.error('Error processing contract installments:', contract.Contract_Number, e);
    }
  }

  return {
    overdueInstallments: overdue,
    customerOverdues: [] // simplified for check
  };
}

const acctPaymentsForOverdue = payments.filter((p) => 
  !p.contract_number && 
  ['payment', 'receipt', 'account_payment'].includes(p.entry_type) &&
  p.sales_invoice_id === null && 
  p.printed_invoice_id === null && 
  p.composite_task_id === null
);
const contractPaymentsForOverdue = payments.filter((p) => 
  p.contract_number && 
  ['payment', 'receipt', 'account_payment'].includes(p.entry_type)
);

const result = computeOverdueData(contracts, contractPaymentsForOverdue, acctPaymentsForOverdue);
console.log("Resulting Overdue Installments:", result.overdueInstallments);
