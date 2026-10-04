import React from 'react';
import { AlertTriangle, CheckCircle2, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PendingChangesBannerProps {
  added: number;
  removed: number;
  previousTotal: number;
  newTotal: number;
  installmentsMatch: boolean;
  currencySymbol?: string;
  entityLabel?: string; // "العقد" أو "العرض"
  /** لوحات مضافة بسعر صفر (لا يوجد لها سعر في جدول الأسعار ولا سعر أساسي) */
  zeroPricedNames?: string[];
  onProcess: () => void;
  onReview: () => void;
}

/**
 * يظهر عند إضافة/إزالة لوحات: الأسعار أُعيد حسابها، والحفظ ممنوع حتى تتم معالجة الدفعات.
 */
export function PendingChangesBanner({
  added, removed, previousTotal, newTotal, installmentsMatch,
  currencySymbol = 'د.ل', entityLabel = 'العقد', zeroPricedNames = [], onProcess, onReview,
}: PendingChangesBannerProps) {
  const fmt = (n: number) => `${Number(n || 0).toLocaleString('ar-LY')} ${currencySymbol}`;
  const parts = [
    added > 0 ? `أضيفت ${added} ${added === 1 ? 'لوحة' : 'لوحات'}` : null,
    removed > 0 ? `أزيلت ${removed} ${removed === 1 ? 'لوحة' : 'لوحات'}` : null,
  ].filter(Boolean).join(' و');
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-bold text-foreground">{parts} — أُعيد حساب الأسعار</p>
          <p className="text-muted-foreground">
            الإجمالي <span className="tabular-nums text-foreground">{fmt(previousTotal)}</span>
            {' '}←{' '}
            <span className="font-bold tabular-nums text-foreground">{fmt(newTotal)}</span>.
            {' '}لا يمكن حفظ {entityLabel} قبل معالجة التعديلات
            {installmentsMatch ? '.' : ' وإعادة توزيع الدفعات على الإجمالي الجديد.'}
          </p>
          {zeroPricedNames.length > 0 && (
            <p className="font-semibold text-rose-400">
              بدون سعر: {zeroPricedNames.join('، ')} — لا يوجد لها سعر في جدول الأسعار؛ حدّد سعرها قبل المعالجة.
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onReview}>
          <ListChecks className="h-4 w-4" />
          مراجعة الأسعار
        </Button>
        <Button size="sm" onClick={onProcess}>
          <CheckCircle2 className="h-4 w-4" />
          معالجة التعديلات
        </Button>
      </div>
    </div>
  );
}
