export function relativeCompanyPrice(base: number | null, mode: 'discount' | 'increase' | 'zero', percent: number): number | null {
  if (mode === 'zero') return 0;
  if (base == null || !Number.isFinite(base) || base <= 0 || !Number.isFinite(percent) || percent < 0 || (mode === 'discount' && percent > 100)) return null;
  const result = Math.round(base * (1 + (mode === 'discount' ? -percent : percent) / 100));
  return Number.isSafeInteger(result) ? result : null;
}
