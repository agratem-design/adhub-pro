export interface PaymentSource {
  distributedPaymentId: string;
  customerId: string | null;
  customerName: string;
  amount: number;
  allocatedAmount: number;
  creditAmount: number;
  paidAt: string | null;
  contracts: string[];
  reference: string | null;
}

export function groupPaymentSources(payments: Record<string, any>[]): Record<string, PaymentSource> {
  const groups: Record<string, PaymentSource> = {};
  for (const payment of payments) {
    const id = payment.distributed_payment_id;
    if (!id) continue;
    const group = groups[id] ||= { distributedPaymentId: id, customerId: payment.customer_id || null, customerName: payment.customer_name || '', amount: 0, allocatedAmount: 0, creditAmount: 0, paidAt: payment.paid_at || null, contracts: [], reference: payment.reference || null };
    const amount = Number(payment.amount) || 0;
    group.amount += amount;
    const hasTarget = payment.contract_number != null || payment.printed_invoice_id != null || payment.sales_invoice_id != null || payment.composite_task_id != null;
    if (hasTarget) group.allocatedAmount += amount;
    else group.creditAmount += amount;
    const contract = payment.contract_number == null ? null : String(payment.contract_number);
    if (contract && !group.contracts.includes(contract)) group.contracts.push(contract);
  }
  return groups;
}

export function normalizeWithdrawal(row: Record<string, any>) {
  return { ...row, id: String(row.id), amount: Number(row.amount) || 0, date: String(row.date || row.created_at || '').slice(0, 10), note: row.note?.trim() || row.notes?.trim() || '', receiver_name: row.receiver_name || '', sender_name: row.sender_name || '', distributed_payment_id: row.distributed_payment_id || null };
}
