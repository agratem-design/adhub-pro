import { describe, expect, it } from 'vitest';
import { calculateOperatingFees, expenseRemaining, operatingPool, operatingFeeAccruals } from '@/lib/operatingFees';
import { groupPaymentSources, normalizeWithdrawal } from '@/lib/paymentSources';
import { validateDistribution, type DistributionDraft } from '@/lib/distributionValidation';
import { buildReceiptAllocations, savedAllocationAmount } from '@/lib/distributionPayload';
import { createRequestId } from '@/lib/requestId';

const contract = { Contract_Number: 1086, 'Total Rent': 10000, Total: 12000, installation_cost: 2000, operating_fee_rate: 10, operating_fee_rate_installation: 0, include_operating_in_installation: true };
const draft: DistributionDraft = { amount: 100, fees: 0, items: [], saveCredit: true, employees: [], balances: [], custody: [], custodyAmount: 0, expenses: [] };
describe('operating balances', () => {
  it('respects an explicit zero rate and caps collection at the actual contract total', () => {
    expect(calculateOperatingFees(contract, 6000).collectedFeeAmount).toBe(500);
    expect(calculateOperatingFees(contract, 20000).collectedFeeAmount).toBe(1000);
    expect(calculateOperatingFees(contract, -100).collectedFeeAmount).toBe(0);
  });
  it('uses independent friend and partnership fees without charging friend rent twice', () => {
    expect(calculateOperatingFees({ ...contract, friend_rental_data: JSON.stringify([{ friendRentalCost: 2000 }]), friend_rental_operating_fee_enabled: true, friend_rental_operating_fee_rate: 5, partnership_operating_data: [{ operating_fee_amount: 50 }] }, 6000).collectedFeeAmount).toBe(475);
  });
  it('does not deduct withdrawals consumed by a closure again from open contracts', () => {
    const contracts = [contract, { ...contract, Contract_Number: 1087 }];
    const payments = contracts.map(c => ({ contract_number: c.Contract_Number, amount: 12000, entry_type: 'payment' }));
    const result = operatingPool(contracts, payments, [{ amount: 1200 }], [{ closure_type: 'contract_range', contract_start: '1086', contract_end: '1086' }], new Set());
    expect(result).toEqual({ openFees: 1000, openWithdrawals: 200, closedWithdrawals: 1000, remaining: 800 });
  });
  it('shows deficits and excludes contracts before operating fees began', () => {
    const result = operatingPool([{ ...contract, Contract_Number: 1000 }, contract], [{ contract_number: 1086, amount: 12000, entry_type: 'payment' }], [{ amount: 1200 }], [], new Set());
    expect(result.remaining).toBe(-200);
  });
  it('counts only the unpaid portion of a partially settled expense', () => {
    expect(expenseRemaining({ amount: 100, paid_amount: 60, payment_status: 'partial' })).toBe(40);
    expect(expenseRemaining({ amount: 100, payment_status: 'paid' })).toBe(0);
  });
  it('reconciles per-receipt additions with the total fee, including rounding and overpayments', () => {
    const c = { ...contract, 'Total Rent': 100, Total: 100, operating_fee_rate: 3 };
    const payments = [33.33, 33.33, 33.34, 50].map((amount, i) => ({ id: String(i), contract_number: 1086, amount, paid_at: `2026-01-0${i + 1}`, entry_type: 'payment' }));
    const additions = operatingFeeAccruals([c], payments);
    expect(additions.map(p => p.fee_amount)).toEqual([0, 1, 1, 1]);
    expect(additions.reduce((sum, p) => sum + p.fee_amount, 0)).toBe(calculateOperatingFees(c, 150).collectedFeeAmount);
    expect(operatingFeeAccruals([{ ...c, Total: 0 }], payments).every(p => p.fee_amount === 0)).toBe(true);
  });
});
describe('payment provenance', () => {
  it('creates valid UUIDs when randomUUID is unavailable', () => {
    expect(createRequestId(undefined)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(createRequestId({ getRandomValues: undefined, randomUUID: undefined })).not.toBe(createRequestId({ getRandomValues: undefined, randomUUID: undefined }));
  });
  it('retains the receiver and legacy notes for the two reported withdrawals', () => {
    for (const amount of [10850, 8180]) {
      const row = normalizeWithdrawal({ id: 1, amount, date: '2026-08-15', note: null, notes: 'سحب من دفعة العميل', receiver_name: 'مستلم التشغيل', distributed_payment_id: 'dist-source' });
      expect(row.note).toBe('سحب من دفعة العميل');
      expect(row.receiver_name).toBe('مستلم التشغيل');
      expect(row.distributed_payment_id).toBe('dist-source');
    }
  });
  it('shows the full receipt, its allocations, and the remaining customer credit separately', () => {
    const result = groupPaymentSources([{ distributed_payment_id: 'dist', amount: 3650, contract_number: 1244 }, { distributed_payment_id: 'dist', amount: 7200, contract_number: 1278 }, { distributed_payment_id: 'dist', amount: 2150 }]);
    expect(result.dist.amount).toBe(13000);
    expect(result.dist.allocatedAmount).toBe(10850);
    expect(result.dist.creditAmount).toBe(2150);
    expect(result.dist.contracts).toEqual(['1244', '1278']);
  });
});
describe('distribution validation and receipt conservation', () => {
  it('preserves the 13000 receipt and credit when reopening repeated contract allocations', () => {
    const saved = [
      { contract_number: '1244', amount: 1000 },
      { contract_number: 1244, amount: 2650 },
      { contract_number: 1278, amount: 7200 },
      { amount: 2150 },
    ];
    const items = [1244, 1278].map(id => ({ id, type: 'contract' as const, displayName: String(id), totalAmount: 20000, paidAmount: 0, remainingAmount: 20000, selected: true, allocatedAmount: savedAllocationAmount(saved, 'contract', id) }));
    expect(items.map(item => item.allocatedAmount)).toEqual([3650, 7200]);
    const receipts = buildReceiptAllocations({ items, amount: 13000, saveCredit: true, common: { distributed_payment_id: 'dist' }, commission: 0, transferFee: 0 });
    expect(receipts.map(row => row.amount)).toEqual([3650, 7200, 2150]);
    expect(groupPaymentSources(receipts).dist).toMatchObject({ amount: 13000, allocatedAmount: 10850, creditAmount: 2150 });
  });
  it('keeps invoice types distinct when restoring repeated allocations', () => {
    const saved = [{ printed_invoice_id: 'same', amount: 10 }, { printed_invoice_id: 'same', amount: 20 }, { sales_invoice_id: 'same', amount: 40 }, { composite_task_id: 'same', amount: 50 }, { amount: 60 }];
    expect(savedAllocationAmount(saved, 'printed_invoice', 'same')).toBe(30);
    expect(savedAllocationAmount(saved, 'sales_invoice', 'same')).toBe(40);
    expect(savedAllocationAmount(saved, 'composite_task', 'same')).toBe(50);
  });
  it('allows receipt allocation and spending to describe the same money', () => {
    expect(validateDistribution({ ...draft, expenses: [{ expense_id: 'expense', amount: 100 }] })).toEqual([]);
  });
  it('rejects spending beyond the net receipt and incomplete custody envelopes', () => {
    expect(validateDistribution({ ...draft, fees: 10, expenses: [{ expense_id: 'e', amount: 100 }] })).not.toEqual([]);
    expect(validateDistribution({ ...draft, custodyAmount: 50, custody: [{ employeeId: 'e', amount: 40 }] })).not.toEqual([]);
  });
  it('rejects duplicate expense rows, invalid values and repeated withdrawals exceeding a shared balance', () => {
    expect(validateDistribution({ ...draft, amount: Infinity })).not.toEqual([]);
    expect(validateDistribution({ ...draft, expenses: [{ expense_id: 'e', amount: 10 }, { expense_id: 'e', amount: 10 }] })).not.toEqual([]);
    expect(validateDistribution({ ...draft, employees: [{ employeeId: 'a', amount: 40, paymentType: 'from_balance' }, { employeeId: 'b', amount: 40, paymentType: 'from_balance' }], balances: [{ employeeId: 'a', teamId: null, teamName: 'مصروفات التشغيل', pendingAmount: 60 }, { employeeId: 'b', teamId: null, teamName: 'مصروفات التشغيل', pendingAmount: 60 }] })).not.toEqual([]);
  });
  it('stores fees once and preserves the remaining customer credit', () => {
    const receipts = buildReceiptAllocations({ amount: 100, saveCredit: true, commission: 5, transferFee: 2, common: { method: 'نقدي' }, items: [{ id: 1244, type: 'contract', selected: true, allocatedAmount: 60, remainingAmount: 100, totalAmount: 100, paidAmount: 0, displayName: 'عقد' }] });
    expect(receipts.map(r => r.amount)).toEqual([60, 40]);
    expect(receipts.reduce((sum, r) => sum + Number(r.intermediary_commission), 0)).toBe(5);
    expect(receipts.reduce((sum, r) => sum + Number(r.transfer_fee), 0)).toBe(2);
  });
});
