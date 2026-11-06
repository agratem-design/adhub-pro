// أجزاء مشتركة لقوائم فواتير المبيعات والمشتريات في صفحة الزبون
import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const fmtMoney = (n: number) =>
  (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export type InvoiceFilter = 'all' | 'open' | 'settled';

interface SummaryProps {
  total: number;
  paid: number;
  paidLabel?: string;
  remaining: number;
  extra?: { label: string; value: number; tone?: 'credit' | 'muted' };
}

/** شريط ملخص: الإجمالي / المحصّل / المتبقي + نسبة التحصيل */
export function InvoiceSummary({ total, paid, paidLabel = 'المدفوع', remaining, extra }: SummaryProps) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const cells: { label: string; value: number; cls: string }[] = [
    { label: 'إجمالي الفواتير', value: total, cls: 'text-foreground' },
    { label: paidLabel, value: paid, cls: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'المتبقي', value: remaining, cls: remaining > 0.01 ? 'text-destructive' : 'text-muted-foreground' },
  ];
  if (extra) cells.push({ label: extra.label, value: extra.value, cls: extra.tone === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground' });
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className={cn('grid grid-cols-2 gap-3', cells.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
        {cells.map(c => (
          <div key={c.label} className="min-w-0">
            <div className="text-[11px] font-medium text-muted-foreground">{c.label}</div>
            <div className={cn('truncate text-lg font-bold tabular-nums', c.cls)}>
              {fmtMoney(c.value)} <span className="text-xs font-normal text-muted-foreground">د.ل</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{pct}% محصّل</span>
      </div>
    </div>
  );
}

interface ToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  filter: InvoiceFilter;
  onFilter: (f: InvoiceFilter) => void;
  counts: Record<InvoiceFilter, number>;
  settledLabel?: string;
  action?: ReactNode;
}

export function InvoiceToolbar({ search, onSearch, filter, onFilter, counts, settledLabel = 'المسددة', action }: ToolbarProps) {
  const opts: [InvoiceFilter, string][] = [['all', 'الكل'], ['open', 'غير المسددة'], ['settled', settledLabel]];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="تصفية الفواتير" className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {opts.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => onFilter(k)}
            className={cn('h-7 rounded-md px-2.5 text-xs font-semibold transition-colors',
              filter === k ? 'bg-card shadow-sm ring-1 ring-primary/40' : 'text-muted-foreground hover:text-foreground')}>
            {l} <span className="tabular-nums opacity-70">({counts[k]})</span>
          </button>
        ))}
      </div>
      <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => onSearch(e.target.value)} placeholder="بحث برقم أو عنوان الفاتورة…" className="h-8 pr-8 text-xs" />
      </div>
      {action && <div className="ms-auto">{action}</div>}
    </div>
  );
}

/** شارة الحالة مع شريط نسبة السداد */
export function PaidStatus({ total, settled, settledText = 'مسددة' }: { total: number; settled: number; settledText?: string }) {
  const remaining = total - settled;
  const isPaid = remaining <= 0.01;
  const pct = total > 0 ? Math.min(100, Math.round((settled / total) * 100)) : 0;
  if (isPaid) {
    return <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">{settledText}</span>;
  }
  return (
    <div className="w-24">
      <div className="mb-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">{pct === 0 ? 'غير مسددة' : `${pct}% مدفوع`}</div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', pct === 0 ? 'bg-destructive/60' : 'bg-amber-500')} style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
    </div>
  );
}

export function InvoiceItemsTable({ items }: { items: { name: string; quantity: number; unit?: string; unitPrice: number; total: number }[] }) {
  if (!items.length) return <p className="py-3 text-center text-xs text-muted-foreground">لا توجد بنود مسجلة لهذه الفاتورة</p>;
  return (
    <table className="w-full text-xs">
      <thead className="text-muted-foreground">
        <tr>
          <th className="px-2 py-1.5 text-right font-medium">البند</th>
          <th className="px-2 py-1.5 text-center font-medium">الكمية</th>
          <th className="px-2 py-1.5 text-left font-medium">سعر الوحدة</th>
          <th className="px-2 py-1.5 text-left font-medium">الإجمالي</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {items.map((it, i) => (
          <tr key={i}>
            <td className="px-2 py-1.5">{it.name || '—'}</td>
            <td className="px-2 py-1.5 text-center tabular-nums">{it.quantity}{it.unit ? ` ${it.unit}` : ''}</td>
            <td className="px-2 py-1.5 text-left tabular-nums">{fmtMoney(it.unitPrice)}</td>
            <td className="px-2 py-1.5 text-left font-semibold tabular-nums">{fmtMoney(it.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
