import { useMemo, useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { readDurationPrice } from '@/utils/pricingDuration';
import { findCurrentRow, parsePricingSnapshot, snapshotColumns } from '@/utils/pricingSnapshot';

interface Props {
  snapshot: unknown;
  currentPricing?: any[];
  entityLabel?: string;
  currencySymbol?: string;
}

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

export function PricingSnapshotCard({ snapshot, currentPricing = [], entityLabel = 'العقد', currencySymbol = 'د.ل' }: Props) {
  const snap = useMemo(() => parsePricingSnapshot(snapshot), [snapshot]);
  const [open, setOpen] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  if (!snap) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground lg:col-span-2">
        <History className="ml-1 inline h-3.5 w-3.5" />
        لا توجد قائمة أسعار محفوظة مع هذا {entityLabel} بعد — ستُحفظ قائمة أسعار الفئة تلقائياً عند الحفظ القادم.
      </div>
    );
  }

  const cols = snapshotColumns(snap);
  const isMain = (r: any) => String(r.customer_category ?? '').trim() === String(snap.customer_category).trim();
  const rows = snap.rows
    .filter(r => showFallback || isMain(r))
    .sort((a, b) => String(a.size).localeCompare(String(b.size), 'ar') || String(a.billboard_level).localeCompare(String(b.billboard_level)));
  const hasFallbackRows = snap.rows.some(r => !isMain(r));
  const changedCount = snap.rows.filter(r => {
    const cur = findCurrentRow(currentPricing, r);
    return cur && cols.some(c => readDurationPrice(cur, c.key) !== readDurationPrice(r, c.key));
  }).length;

  return (
    <section className="rounded-lg border border-border bg-card lg:col-span-2">
      <button type="button" onClick={() => setOpen(v => !v)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-right" aria-expanded={open}>
        <History className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">قائمة الأسعار المحفوظة مع {entityLabel}</p>
          <p className="text-xs text-muted-foreground">
            فئة «{snap.customer_category}» · بتاريخ {fmtDate(snap.captured_at)}
            {currentPricing.length > 0 && (changedCount > 0
              ? <span className="text-amber-600 dark:text-amber-400"> · {changedCount} سعر تغيّر في الجدول الحالي</span>
              : <span> · مطابقة للجدول الحالي</span>)}
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3">
          {hasFallbackRows && snap.customer_category !== 'عادي' && (
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={showFallback} onChange={e => setShowFallback(e.target.checked)} />
              عرض أسعار فئة «عادي» المحفوظة أيضاً (تُستخدم عند غياب سعر الفئة)
            </label>
          )}
          <div className="max-h-96 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-right font-medium">المقاس</th>
                  <th className="px-2 py-2 text-right font-medium">المستوى</th>
                  {showFallback && <th className="px-2 py-2 text-right font-medium">الفئة</th>}
                  {cols.map(c => <th key={c.key} className="px-2 py-2 text-right font-medium">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const cur = findCurrentRow(currentPricing, r);
                  return (
                    <tr key={`${r.id ?? i}-${r.customer_category}`} className="border-t border-border">
                      <td className="px-2 py-1.5 font-medium">{r.size}</td>
                      <td className="px-2 py-1.5">{r.billboard_level}</td>
                      {showFallback && <td className="px-2 py-1.5">{r.customer_category}</td>}
                      {cols.map(c => {
                        const saved = readDurationPrice(r, c.key);
                        const now = cur ? readDurationPrice(cur, c.key) : null;
                        const changed = cur && now !== saved;
                        return (
                          <td key={c.key} className="px-2 py-1.5 tabular-nums">
                            {saved == null ? '—' : saved.toLocaleString('ar-LY')}
                            {changed && (
                              <span className="block text-[10px] text-amber-600 dark:text-amber-400" title="السعر الحالي في جدول الأسعار">
                                الآن: {now == null ? '—' : now.toLocaleString('ar-LY')}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">الأسعار كما كانت في جدول الأسعار لحظة الحفظ. تُحدَّث هذه النسخة فقط عند إعادة تسعير {entityLabel} من الجدول الحالي أو تغيير الفئة.</p>
        </div>
      )}
    </section>
  );
}
