/**
 * Centralized number formatting utilities
 * يستخدم فاصلة إنجليزية (,) للآلاف بدلاً من النقطة العربية (.)
 */

/**
 * تنسيق المبالغ المالية بفاصلة آلاف واضحة
 * مثال: 1298000 → "1,298,000"
 */
export function formatAmount(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(Number(num))) return '0';
  const n = Number(num);
  // Use maximumFractionDigits: 3 to handle dinars with milimes
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}
