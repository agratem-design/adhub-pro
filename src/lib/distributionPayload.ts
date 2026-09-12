import type { DistributableItem } from '@/components/billing/distribute-payment/types';
import { money } from './distributionValidation';

const targetFields = { contract: 'contract_number', printed_invoice: 'printed_invoice_id', sales_invoice: 'sales_invoice_id', composite_task: 'composite_task_id' } as const;

export function savedAllocationAmount(payments: Record<string, any>[], type: DistributableItem['type'], id: string | number | string[]): number {
  const field = targetFields[type];
  const ids = Array.isArray(id) ? new Set(id.map(String)) : new Set([String(id)]);
  return money(payments.reduce((total, payment) => {
    const target = payment[field];
    return target != null && ids.has(String(target)) ? total + (Number(payment.amount) || 0) : total;
  }, 0));
}

export function buildReceiptAllocations({ items, amount, saveCredit, common, commission, transferFee }: {
  items: DistributableItem[]; amount: number; saveCredit: boolean; common: Record<string, unknown>; commission: number; transferFee: number;
}) {
  const receipts: Record<string, unknown>[] = items.filter(item => item.selected && item.allocatedAmount > 0).flatMap(item => {
    if (item.type === 'composite_task' && item.subTasks && item.subTasks.length > 0) {
      if (item.subTasks.length === 1) {
        return [{
          ...common,
          amount: money(item.allocatedAmount),
          composite_task_id: item.subTasks[0].id,
        }];
      }

      let toAllocate = item.allocatedAmount;
      const subAllocations: Record<string, unknown>[] = [];
      for (let i = 0; i < item.subTasks.length; i++) {
        if (toAllocate <= 0) break;
        const sub = item.subTasks[i];
        const subMax = sub.remaining > 0 ? sub.remaining : (i === item.subTasks.length - 1 ? toAllocate : 0);
        const subAmount = money(Math.min(toAllocate, Math.max(0, subMax)));
        if (subAmount > 0) {
          subAllocations.push({
            ...common,
            amount: subAmount,
            composite_task_id: sub.id,
          });
          toAllocate = money(toAllocate - subAmount);
        }
      }

      if (toAllocate > 0 && subAllocations.length > 0) {
        const last = subAllocations[subAllocations.length - 1];
        last.amount = money(Number(last.amount) + toAllocate);
      }

      return subAllocations.length > 0 ? subAllocations : [{
        ...common,
        amount: money(item.allocatedAmount),
        composite_task_id: item.id,
      }];
    }

    return [{
      ...common,
      amount: money(item.allocatedAmount),
      [({ contract: 'contract_number', printed_invoice: 'printed_invoice_id', sales_invoice: 'sales_invoice_id', composite_task: 'composite_task_id' })[item.type]]: item.id,
    }];
  });
  const remainder = money(amount - receipts.reduce((sum, row) => sum + Number(row.amount), 0));
  if (saveCredit && remainder > 0) receipts.push({ ...common, amount: remainder, notes: [common.notes, 'رصيد حساب غير موزع'].filter(Boolean).join(' - ') });
  // Fees belong to the receipt as a whole and are stored once across its rows.
  return receipts.map((row, index) => ({ ...row, amount: Number(row.amount), intermediary_commission: index === 0 ? commission : 0, transfer_fee: index === 0 ? transferFee : 0, net_amount: Number(row.amount) }));
}
