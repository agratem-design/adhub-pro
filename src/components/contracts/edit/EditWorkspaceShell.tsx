import type { ComponentType, MouseEventHandler, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertCircle, ArrowRight, Loader2, Printer, Save, Undo2 } from 'lucide-react';

/**
 * الإطار الموحد لصفحات التحرير (تعديل العقد، العرض، عقد المناسبة):
 * رأس ثابت + شريط أقسام يميناً + المحتوى + لوحة ملخص يساراً.
 * الصفحات تختلف في المنطق فقط، والشكل واحد.
 */
export interface WorkspaceSection<K extends string = string> {
  key: K;
  label: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
}

export interface QuickAction {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  badge?: number | string;
  tone?: 'default' | 'warning';
}

export function EditWorkspaceShell<K extends string>({
  title, subtitle, status, badges, onBack, onPrint, printLabel = 'طباعة', hidePrint, onSave, saveLabel = 'حفظ',
  saving, saveDisabled, onUndo, extraActions, sections, active, onSectionChange, summary, mobileSummary, children,
  onClickCapture, navLabel = 'أقسام التحرير',
}: {
  title: string;
  subtitle?: string;
  status?: { label: string; tone: 'saved' | 'dirty' | 'loading' | 'info' };
  badges?: ReactNode;
  onBack: () => void;
  onPrint?: () => void;
  printLabel?: string;
  hidePrint?: boolean;
  onSave: () => void;
  saveLabel?: string;
  saving?: boolean;
  saveDisabled?: boolean;
  onUndo?: () => void;
  extraActions?: ReactNode;
  sections: readonly WorkspaceSection<K>[];
  active: K;
  onSectionChange: (key: K) => void;
  summary?: ReactNode;
  mobileSummary?: ReactNode;
  children: ReactNode;
  onClickCapture?: MouseEventHandler<HTMLDivElement>;
  navLabel?: string;
}) {
  const statusTone = {
    saved: 'bg-emerald-500/15 text-emerald-500',
    dirty: 'bg-amber-500/15 text-amber-500',
    loading: 'bg-muted text-muted-foreground',
    info: 'bg-primary/15 text-primary',
  };
  return (
    <div onClickCapture={onClickCapture} className="min-h-screen bg-muted/20 text-foreground" dir="rtl">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-3 px-3 py-2.5 md:px-4">
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onBack} aria-label="رجوع">
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold">{title}</h1>
              {status && <span className={cn('whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold', statusTone[status.tone])} aria-live="polite">{status.label}</span>}
              {badges}
            </div>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {onUndo && (
              <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={onUndo} title="التراجع عن التعديلات غير المحفوظة">
                <Undo2 className="h-4 w-4" />تراجع
              </Button>
            )}
            {extraActions}
            {onPrint && !hidePrint && (
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onPrint}>
                <Printer className="h-4 w-4" />{printLabel}
              </Button>
            )}
            <Button size="sm" className="h-9 gap-1.5 px-4" onClick={onSave} disabled={saving || saveDisabled}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saveLabel}
            </Button>
          </div>
        </div>
        <nav aria-label={navLabel} className="no-scrollbar mx-auto flex max-w-[1680px] gap-1 overflow-x-auto px-3 pb-2 md:px-4 xl:hidden">
          {sections.map(s => (
            <button key={s.key} type="button" aria-pressed={active === s.key} onClick={() => onSectionChange(s.key)}
              className={cn('inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
                active === s.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              <s.icon className="h-3.5 w-3.5" />{s.label}
            </button>
          ))}
        </nav>
      </header>

      <div className={cn('mx-auto grid max-w-[1680px] items-start gap-4 p-3 md:p-4', summary ? 'xl:grid-cols-[210px_minmax(0,1fr)_290px]' : 'xl:grid-cols-[210px_minmax(0,1fr)]')}>
        <nav aria-label={navLabel} className="sticky top-[76px] hidden flex-col gap-1 xl:flex">
          {sections.map(s => {
            const on = active === s.key;
            return (
              <button key={s.key} type="button" aria-pressed={on} onClick={() => onSectionChange(s.key)}
                className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  on ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted')}>
                <s.icon className={cn('h-4 w-4 shrink-0', !on && 'text-muted-foreground')} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{s.label}</span>
                  {s.hint && <span className={cn('block truncate text-xs', on ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{s.hint}</span>}
                </span>
              </button>
            );
          })}
        </nav>

        <main className="min-w-0 space-y-3">
          {mobileSummary && <div className="xl:hidden">{mobileSummary}</div>}
          {children}
        </main>

        {summary && <aside className="sticky top-[76px] hidden space-y-3 xl:block" aria-label="الملخص">{summary}</aside>}
      </div>
    </div>
  );
}

/** لوحة الملخص الموحدة: الإجماليات، الحقائق، وإجراءات سريعة */
export function EditSummaryPanel({
  currency, finalTotal, originalTotal, discount, installmentsSum, boardsCount, durationLabel, startDate, endDate,
  includeInstallation, includePrint, onReviewPayments, quickActions = [], note, totalLabel = 'الإجمالي بعد التعديل',
}: {
  currency: string;
  finalTotal: number;
  originalTotal?: number;
  discount?: number;
  installmentsSum?: number;
  boardsCount: number;
  durationLabel: string;
  startDate?: string;
  endDate?: string;
  includeInstallation?: boolean;
  includePrint?: boolean;
  onReviewPayments?: () => void;
  quickActions?: QuickAction[];
  note?: string;
  totalLabel?: string;
}) {
  const fmt = (n: number) => Number(n || 0).toLocaleString('ar-LY', { maximumFractionDigits: 2 });
  const delta = originalTotal !== undefined ? Math.round((finalTotal - originalTotal) * 100) / 100 : 0;
  const gap = installmentsSum !== undefined ? Math.round((installmentsSum - finalTotal) * 100) / 100 : 0;
  const gapBad = installmentsSum !== undefined && Math.abs(gap) > 0.5;
  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-primary/5 px-4 py-3">
          <p className="text-xs text-muted-foreground">{totalLabel}</p>
          <p className="text-2xl font-extrabold tabular-nums text-primary">{fmt(finalTotal)} <span className="text-sm font-semibold text-muted-foreground">{currency}</span></p>
          {originalTotal !== undefined && delta !== 0 && (
            <p className={cn('text-xs font-semibold tabular-nums', delta > 0 ? 'text-emerald-500' : 'text-rose-500')}>
              {delta > 0 ? '+' : ''}{fmt(delta)} عن المحفوظ
            </p>
          )}
        </div>
        <dl className="divide-y divide-border text-sm">
          {originalTotal !== undefined && <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">الإجمالي السابق</dt><dd className="tabular-nums">{fmt(originalTotal)}</dd></div>}
          {discount !== undefined && <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">الخصم</dt><dd className="tabular-nums">{fmt(discount)}</dd></div>}
          {installmentsSum !== undefined && (
            <>
              <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">مجموع الدفعات</dt><dd className="tabular-nums">{fmt(installmentsSum)}</dd></div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-muted-foreground">فرق الدفعات</dt>
                <dd className={cn('font-semibold tabular-nums', gapBad ? 'text-rose-500' : 'text-emerald-500')}>{gapBad ? fmt(gap) : 'مطابقة'}</dd>
              </div>
            </>
          )}
        </dl>
        {gapBad && onReviewPayments && (
          <button type="button" onClick={onReviewPayments} className="flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-border px-4 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/5">
            <AlertCircle className="h-3.5 w-3.5" />مراجعة جدول الدفعات
          </button>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div><dt className="text-xs text-muted-foreground">اللوحات</dt><dd className="font-semibold tabular-nums">{boardsCount}</dd></div>
          <div><dt className="text-xs text-muted-foreground">المدة</dt><dd className="font-semibold">{durationLabel}</dd></div>
          <div><dt className="text-xs text-muted-foreground">البداية</dt><dd className="tabular-nums">{startDate || '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">النهاية</dt><dd className="tabular-nums">{endDate || '—'}</dd></div>
        </dl>
        {(includeInstallation !== undefined || includePrint !== undefined) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {includeInstallation !== undefined && <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', includeInstallation ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground')}>{includeInstallation ? 'شامل التركيب' : 'بدون تركيب'}</span>}
            {includePrint !== undefined && <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', includePrint ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground')}>{includePrint ? 'شامل الطباعة' : 'بدون طباعة'}</span>}
          </div>
        )}
      </section>

      {quickActions.length > 0 && (
        <section className="space-y-0.5 rounded-xl border border-border bg-card p-2">
          <p className="px-2 pb-1 pt-1 text-xs font-semibold text-muted-foreground">إجراءات سريعة</p>
          {quickActions.map(a => (
            <button key={a.label} type="button" onClick={a.onClick}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-right text-sm hover:bg-muted">
              <a.icon className={cn('h-4 w-4', a.tone === 'warning' ? 'text-amber-500' : 'text-primary')} />{a.label}
              {a.badge !== undefined && <span className="mr-auto rounded-full bg-primary/15 px-2 text-xs font-semibold text-primary">{a.badge}</span>}
            </button>
          ))}
        </section>
      )}
      {note && <p className="px-1 text-xs leading-5 text-muted-foreground">{note}</p>}
    </>
  );
}

/** ملخص مختصر للشاشات الضيقة */
export function EditMobileSummary({ items }: { items: { label: string; value: string; tone?: 'primary' | 'good' | 'bad' }[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(i => (
        <div key={i.label} className="bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">{i.label}</p>
          <p className={cn('text-sm font-semibold tabular-nums', i.tone === 'primary' && 'font-bold text-primary', i.tone === 'good' && 'text-emerald-500', i.tone === 'bad' && 'text-rose-500')}>{i.value}</p>
        </div>
      ))}
    </div>
  );
}
