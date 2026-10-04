/**
 * إعادة توزيع الدفعات الحالية على إجمالي جديد بنفس النِّسَب،
 * مع الإبقاء على عدد الدفعات وتواريخها وأوصافها. الفرق الناتج عن التقريب يُضاف للدفعة الأخيرة.
 */
export function rescaleInstallmentsToTotal<T extends { amount: number }>(
  installments: T[],
  newTotal: number,
  makeDefault?: (total: number) => T[],
): T[] {
  const total = Math.round((Number(newTotal) || 0) * 100) / 100;
  if (!Array.isArray(installments) || installments.length === 0) {
    return makeDefault ? makeDefault(total) : [];
  }
  const oldSum = installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const n = installments.length;
  const scaled = installments.map((inst) => {
    const share = oldSum > 0 ? (Number(inst.amount) || 0) / oldSum : 1 / n;
    return { ...inst, amount: Math.round(total * share) };
  });
  const diff = Math.round((total - scaled.reduce((s, i) => s + i.amount, 0)) * 100) / 100;
  scaled[n - 1] = { ...scaled[n - 1], amount: Math.round((scaled[n - 1].amount + diff) * 100) / 100 };
  return scaled;
}

/** هل مجموع الدفعات يطابق الإجمالي (بهامش دينار واحد)؟ */
export function installmentsMatchTotal(installments: { amount: number }[], total: number): boolean {
  const sum = (installments || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  return Math.abs(sum - (Number(total) || 0)) <= 1;
}
