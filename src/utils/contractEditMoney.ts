/** All values here are in the contract currency, never catalog currency. */
export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export type ContractPriceSnapshot = Record<string, unknown>;

export function parsePriceSnapshot(raw: unknown): ContractPriceSnapshot[] {
  try {
    const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

export const priceId = (row: ContractPriceSnapshot) => String(row.billboardId ?? row.billboard_id ?? row.ID ?? row.id ?? '');

export function storedRental(row?: ContractPriceSnapshot): number | null {
  if (!row) return null;
  const value = row.basePriceBeforeDiscount ?? row.baseRental ??
    (row.priceBeforeDiscount != null ? Number(row.priceBeforeDiscount) - Number(row.printCost || 0) : row.contractPrice);
  return value != null && Number.isFinite(Number(value)) ? Number(value) : null;
}

/** Largest-remainder allocation: the sum is exactly the requested amount in cents. */
export function allocateMoney(total: number, weights: number[]): number[] {
  if (!Number.isFinite(total) || total < 0 || weights.some(w => !Number.isFinite(w) || w < 0)) {
    throw new Error('قيمة التوزيع غير صالحة');
  }
  if (!weights.length) return [];
  const cents = Math.round(total * 100);
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map(w => cents * (sum ? w / sum : 1 / weights.length));
  const result = exact.map(Math.floor);
  const order = exact.map((v, i) => ({ i, fraction: v - result[i] }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  const remainder = cents - result.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remainder; i++) result[order[i % order.length].i]++;
  return result.map(v => v / 100);
}

export function validateContractInstallments(rows: Array<{ amount: number; dueDate: string }>, total: number): string | null {
  if (!rows.length) return 'يجب إضافة دفعة واحدة على الأقل';
  if (rows.some(r => !Number.isFinite(Number(r.amount)) || Number(r.amount) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate) || !Number.isFinite(Date.parse(r.dueDate)))) {
    return 'راجع مبالغ الدفعات وتواريخ استحقاقها';
  }
  if (Math.round(rows.reduce((s, r) => s + Number(r.amount), 0) * 100) !== Math.round(total * 100)) {
    return 'مجموع الدفعات لا يساوي إجمالي العقد؛ أعد توزيع الدفعات قبل الحفظ';
  }
  return null;
}
