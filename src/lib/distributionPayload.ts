import type { DistributableItem } from '@/components/billing/distribute-payment/types';
import { money } from './distributionValidation';

const targetFields = { contract: 'contract_number', printed_invoice: 'printed_invoice_id', sales_invoice: 'sales_invoice_id', composite_task: 'composite_task_id' } as const;

export function savedAllocationAmount(payments: Record<string, any>[], type: DistributableItem['type'], id: string | number): number {
  const field = targetFields[type];
  return money(payments.reduce((total, payment) => {
    const target = payment[field];
    return target != null && String(target) === String(id) ? total + (Number(payment.amount) || 0) : total;
  }, 0));
}

export function buildReceiptAllocations({ items, amount, saveCredit, common, commission, transferFee }: {
  items: DistributableItem[]; amount: number; saveCredit: boolean; common: Record<string, unknown>; commission: number; transferFee: number;
}) {
  const receipts: Record<string, unknown>[] = items.filter(item => item.selected && item.allocatedAmount > 0).map(item => ({
    ...common, amount: money(item.allocatedAmount),
    [({ contract: 'contract_number', printed_invoice: 'printed_invoice_id', sales_invoice: 'sales_invoice_id', composite_task: 'composite_task_id' })[item.type]]: item.id,
  }));
  const remainder = money(amount - receipts.reduce((sum, row) => sum + Number(row.amount), 0));
  if (saveCredit && remainder > 0) receipts.push({ ...common, amount: remainder, notes: [common.notes, 'رصيد حساب غير موزع'].filter(Boolean).join(' - ') });
  // Fees belong to the receipt as a whole and are stored once across its rows.
  return receipts.map((row, index) => ({ ...row, amount: Number(row.amount), intermediary_commission: index === 0 ? commission : 0, transfer_fee: index === 0 ? transferFee : 0, net_amount: Number(row.amount) }));
}
