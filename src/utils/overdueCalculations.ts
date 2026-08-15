export interface OverdueInstallment {
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  installmentAmount: number;
  dueDate: string;
  description: string;
  daysOverdue: number;
  adType?: string;
  originalAmount?: number;
  contractPaymentApplied?: number;
  accountCreditApplied?: number;
}

export interface CustomerOverdue {
  customerId: string | null;
  customerName: string;
  totalOverdue: number;
  overdueCount: number;
  oldestDueDate: string;
  oldestDaysOverdue: number;
  installments: OverdueInstallment[];
}

export function computeOverdueData(
  contracts: any[],
  allPayments: any[],
  accountPayments: any[]
): {
  overdueInstallments: OverdueInstallment[];
  customerOverdues: CustomerOverdue[];
} {
  const today = new Date();
  
  // 1. Group contract payments by contract number
  const paymentsByContract = new Map<number, { amount: number; paid_at: string }[]>();
  allPayments.forEach((p: any) => {
    const amt = Number(p.amount) || 0;
    if (amt <= 0 || !p.contract_number) return;
    const contractNum = Number(p.contract_number);
    if (isNaN(contractNum)) return;
    
    if (!paymentsByContract.has(contractNum)) {
      paymentsByContract.set(contractNum, []);
    }
    paymentsByContract.get(contractNum)!.push({ amount: amt, paid_at: p.paid_at || '' });
  });

  // 2. Sum general account payments by customer_id
  const accountCreditByCustomer = new Map<string, number>();
  accountPayments.forEach((p: any) => {
    const amt = Number(p.amount) || 0;
    if (amt <= 0 || !p.customer_id) return;
    accountCreditByCustomer.set(
      p.customer_id,
      (accountCreditByCustomer.get(p.customer_id) || 0) + amt
    );
  });

  const overdue: OverdueInstallment[] = [];

  // 3. Process each contract's installments
  for (const contract of contracts) {
    try {
      const contractNumber = Number(contract.Contract_Number);
      if (isNaN(contractNumber)) continue;

      let installments: any[] = [];
      if (typeof contract.installments_data === 'string') {
        installments = JSON.parse(contract.installments_data);
      } else if (Array.isArray(contract.installments_data)) {
        installments = contract.installments_data;
      }

      if (!installments || installments.length === 0) {
        // If contract has no installments but has a start date, handle it as a single installment after 15 days
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
        .filter((i: any) => i.dueDate)
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

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

  // 4. Distribute general customer credits (payments with contract_number = null)
  const customerOverduesMap = new Map<string, OverdueInstallment[]>();
  overdue.forEach(inst => {
    const key = inst.customerId || inst.customerName;
    if (!customerOverduesMap.has(key)) {
      customerOverduesMap.set(key, []);
    }
    customerOverduesMap.get(key)!.push(inst);
  });

  customerOverduesMap.forEach((customerInsts) => {
    const firstInst = customerInsts[0];
    if (!firstInst || !firstInst.customerId) return;
    
    let credit = accountCreditByCustomer.get(firstInst.customerId) || 0;
    if (credit <= 0) return;

    // Sort customer installments by due date ascending to pay oldest first
    const sorted = [...customerInsts].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

    for (const inst of sorted) {
      if (credit <= 0) break;
      const take = Math.min(credit, inst.installmentAmount);
      inst.installmentAmount -= take;
      inst.accountCreditApplied = (inst.accountCreditApplied || 0) + take;
      credit -= take;
    }
  });

  // Filter out fully paid installments after credit allocation
  const remainingOverdue = overdue.filter(inst => inst.installmentAmount > 0);

  // Group by customer again for CustomerOverdue summaries
  const customerMap = new Map<string, CustomerOverdue>();
  for (const item of remainingOverdue) {
    const key = item.customerId || item.customerName;
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        customerId: item.customerId,
        customerName: item.customerName,
        totalOverdue: 0,
        overdueCount: 0,
        oldestDueDate: item.dueDate,
        oldestDaysOverdue: item.daysOverdue,
        installments: []
      });
    }
    const customer = customerMap.get(key)!;
    customer.totalOverdue += item.installmentAmount;
    customer.overdueCount += 1;
    customer.installments.push(item);
    if (new Date(item.dueDate) < new Date(customer.oldestDueDate)) {
      customer.oldestDueDate = item.dueDate;
      customer.oldestDaysOverdue = item.daysOverdue;
    }
  }

  const customerOverdues = Array.from(customerMap.values()).sort(
    (a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue
  );

  return {
    overdueInstallments: remainingOverdue,
    customerOverdues
  };
}
