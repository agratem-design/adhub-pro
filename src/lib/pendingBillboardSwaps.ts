/**
 * تبديل لوحة معلّق: يُختار في صفحة العقد ولا يُنفَّذ على قاعدة البيانات
 * إلا بعد نجاح «حفظ العقد». حتى ذلك الحين يمكن إلغاؤه أو التراجع عنه.
 */
export interface PendingBillboardSwap {
  originalBillboardId: string;
  originalBillboardName: string;
  replacementBillboardId: string;
  replacementBillboardName: string;
  reason: string;
  /** معرّف ثابت يمنع تنفيذ نفس التبديل مرتين عند إعادة المحاولة */
  requestId: string;
}

/** يضيف تبديلاً أو يستبدل تبديلاً سابقاً لنفس اللوحة الأصلية */
export function upsertPendingSwap(list: PendingBillboardSwap[], swap: PendingBillboardSwap): PendingBillboardSwap[] {
  return [...list.filter((s) => s.originalBillboardId !== swap.originalBillboardId), swap];
}

/**
 * يتحقق قبل الحفظ: اللوحة الأصلية ما زالت في العقد، والبديلة ليست في العقد،
 * ولا تُستخدم بديلة واحدة لأكثر من لوحة. يعيد رسالة الخطأ أو null.
 */
export function validatePendingSwaps(list: PendingBillboardSwap[], selectedIds: string[]): string | null {
  const selected = new Set(selectedIds.map(String));
  const used = new Set<string>();
  for (const s of list) {
    if (!selected.has(String(s.originalBillboardId))) {
      return `اللوحة "${s.originalBillboardName}" لم تعد في العقد؛ ألغِ تبديلها المعلّق أولاً`;
    }
    if (selected.has(String(s.replacementBillboardId))) {
      return `اللوحة البديلة "${s.replacementBillboardName}" مضافة للعقد بالفعل؛ ألغِ تبديل "${s.originalBillboardName}" أو اختر بديلة أخرى`;
    }
    if (used.has(String(s.replacementBillboardId))) {
      return `اللوحة "${s.replacementBillboardName}" مختارة بديلةً لأكثر من لوحة`;
    }
    used.add(String(s.replacementBillboardId));
  }
  return null;
}
