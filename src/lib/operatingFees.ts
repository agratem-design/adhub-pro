/** Shared calculation for the operating ledger, employee balance and disbursements. */
export const financialNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const rows = (value: unknown): Record<string, unknown>[] => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

export function calculateOperatingFees(record: Record<string, any>, paid = financialNumber(record['Total Paid'])) {
  const rent = financialNumber(record['Total Rent'] ?? record.rent_cost);
  const installation = financialNumber(record.installation_cost);
  const print = financialNumber(record.print_cost);
  const total = financialNumber(record.Total ?? rent + installation + print);
  const rate = financialNumber(record.operating_fee_rate);
  // An explicit zero disables this fee; it must not fall back to the rent rate.
  const installationRate = financialNumber(record.operating_fee_rate_installation ?? rate);
  const printRate = financialNumber(record.operating_fee_rate_print ?? rate);
  const friendCosts = rows(record.friend_rental_data).reduce((sum, row) => sum + financialNumber(row.friendRentalCost ?? row.friend_rental_cost), 0);
  const friendFee = record.friend_rental_operating_fee_enabled === true
    ? Math.round(friendCosts * financialNumber(record.friend_rental_operating_fee_rate) / 100) : 0;
  const partnershipFee = rows(record.partnership_operating_data).reduce((sum, row) => sum + financialNumber(row.operating_fee_amount), 0);
  const rentalBase = Math.max(0, rent - friendCosts);
  const calculate = (ratio: number) => Math.round(rentalBase * ratio * rate / 100)
    + (record.include_operating_in_installation === true ? Math.round(installation * ratio * installationRate / 100) : 0)
    + (record.include_operating_in_print === true ? Math.round(print * ratio * printRate / 100) : 0)
    + Math.round((friendFee + partnershipFee) * ratio);
  return { fullFeeAmount: calculate(1), collectedFeeAmount: calculate(total > 0 ? Math.max(0, Math.min(1, paid / total)) : 0), friendCosts, friendFee, partnershipFee };
}

export function sumContractPayments(payments: Record<string, any>[]) {
  const result: Record<string, number> = {};
  for (const payment of payments) {
    if (payment.contract_number == null || !['receipt', 'account_payment', 'payment'].includes(payment.entry_type)) continue;
    const key = String(payment.contract_number);
    result[key] = (result[key] || 0) + financialNumber(payment.amount);
  }
  return result;
}

/** Attribute each receipt only the increase it caused in the accrued operating fee. */
export function operatingFeeAccruals(contracts: Record<string, any>[], payments: Record<string, any>[]): Array<Record<string, any> & { fee_amount: number; fee_rate: number }> {
  const contractMap = new Map(contracts.filter(c => Number(c.Contract_Number) >= 1086).map(c => [String(c.Contract_Number), c]));
  const collected: Record<string, number> = {};
  const ordered = payments.filter(p => contractMap.has(String(p.contract_number)) && ['receipt', 'account_payment', 'payment'].includes(p.entry_type))
    .slice().sort((a, b) => String(a.paid_at || '').localeCompare(String(b.paid_at || '')) || String(a.id).localeCompare(String(b.id)));
  return ordered.map(payment => {
    const key = String(payment.contract_number);
    const contract = contractMap.get(key)!;
    const before = collected[key] || 0;
    collected[key] = before + financialNumber(payment.amount);
    return { ...payment, fee_amount: calculateOperatingFees(contract, collected[key]).collectedFeeAmount - calculateOperatingFees(contract, before).collectedFeeAmount, fee_rate: financialNumber(contract.operating_fee_rate) };
  }).reverse();
}

export function operatingPool(contracts: Record<string, any>[], payments: Record<string, any>[], withdrawals: Record<string, any>[], closures: Record<string, any>[], excluded: Set<string>) {
  const paid = sumContractPayments(payments);
  let unallocatedWithdrawals = withdrawals.reduce((sum, row) => sum + financialNumber(row.amount), 0);
  let openFees = 0;
  let openWithdrawals = 0;
  let closedWithdrawals = 0;
  const eligible = contracts.filter(c => Number(c.Contract_Number) >= 1086 && !excluded.has(String(c.Contract_Number)))
    .sort((a, b) => Number(a.Contract_Number) - Number(b.Contract_Number));
  for (const contract of eligible) {
    const fee = calculateOperatingFees(contract, paid[String(contract.Contract_Number)] || 0).collectedFeeAmount;
    const date = String(contract['Contract Date'] || contract.start_date || '').slice(0, 10);
    const closed = closures.some(c => c.closure_type === 'contract_range'
      ? Number(contract.Contract_Number) >= Number(c.contract_start) && Number(contract.Contract_Number) <= Number(c.contract_end)
      : !!date && !!c.period_start && !!c.period_end && date >= c.period_start.slice(0, 10) && date <= c.period_end.slice(0, 10));
    const withdrawn = Math.min(Math.max(0, unallocatedWithdrawals), fee);
    unallocatedWithdrawals -= withdrawn;
    if (closed) closedWithdrawals += withdrawn;
    else { openFees += fee; openWithdrawals += withdrawn; }
  }
  // Preserve a deficit instead of hiding it behind a zero balance.
  return { openFees, openWithdrawals, closedWithdrawals, remaining: openFees - openWithdrawals - unallocatedWithdrawals };
}

export function expenseRemaining(expense: { amount: unknown; paid_amount?: unknown; payment_status?: string }) {
  const paid = expense.paid_amount == null && expense.payment_status === 'paid' ? financialNumber(expense.amount) : financialNumber(expense.paid_amount);
  return Math.max(0, financialNumber(expense.amount) - paid);
}
