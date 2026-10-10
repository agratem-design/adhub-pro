import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

/**
 * عناصر البناء الموحدة لمكونات صفحات التحرير (العقد، العرض، عقد المناسبة).
 * كل قسم = EditSection: رأس (أيقونة + عنوان + وصف + إجراءات) ثم جسم بمسافات ثابتة.
 */

type IconType = ComponentType<{ className?: string }>;

export function EditSection({
  icon: Icon, title, description, actions, children, className, bodyClassName, flush, id,
}: {
  icon?: IconType;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** بدون حشوة داخلية (للجداول) */
  flush?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={cn('scroll-mt-28 overflow-hidden rounded-xl border border-border bg-card', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className={cn(flush ? '' : 'space-y-4 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Field({ label, icon: Icon, hint, children, className }: {
  label: ReactNode; icon?: IconType; hint?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}{label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Segmented<V extends string>({ value, onChange, options, size = 'md', className }: {
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: ReactNode; icon?: IconType; disabled?: boolean }[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn('grid gap-1 rounded-lg border border-border bg-muted/40 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn('inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-9 px-3 text-xs',
              on ? 'bg-card text-foreground shadow-sm ring-1 ring-primary/40' : 'text-muted-foreground hover:text-foreground')}>
            {o.icon && <o.icon className={cn('h-3.5 w-3.5', on && 'text-primary')} />}{o.label}
          </button>
        );
      })}
    </div>
  );
}

export interface SummaryRow {
  label: ReactNode;
  value: ReactNode;
  tone?: 'default' | 'muted' | 'good' | 'bad' | 'primary';
  strong?: boolean;
  hint?: ReactNode;
}

export function SummaryRows({ rows, className }: { rows: SummaryRow[]; className?: string }) {
  const tones = { default: 'text-foreground', muted: 'text-muted-foreground', good: 'text-emerald-500', bad: 'text-rose-500', primary: 'text-primary' };
  return (
    <dl className={cn('divide-y divide-border overflow-hidden rounded-lg border border-border text-sm', className)}>
      {rows.map((r, i) => (
        <div key={i} className={cn('flex items-center justify-between gap-3 px-3 py-2', r.strong && 'bg-primary/5')}>
          <dt className={cn('min-w-0', r.strong ? 'font-semibold' : 'text-muted-foreground')}>
            {r.label}{r.hint && <span className="block text-xs font-normal text-muted-foreground">{r.hint}</span>}
          </dt>
          <dd className={cn('shrink-0 tabular-nums', r.strong ? 'text-base font-bold' : 'font-semibold', tones[r.tone || 'default'])}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ToggleRow({ title, description, checked, onChange, disabled, children }: {
  title: ReactNode; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children?: ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border border-border', checked && 'border-primary/40')}>
      <div className={cn('flex items-center justify-between gap-3 px-3 py-2.5', disabled && 'opacity-60')}>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          {description && <span className="block text-xs text-muted-foreground">{description}</span>}
        </span>
        <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      </div>
      {checked && children && <div className="border-t border-border px-3 py-3">{children}</div>}
    </div>
  );
}

/** مجموعة داخل قسم: عنوان + وصف + محتوى، مع مرساة للتنقل */
export function EditGroup({ id, title, description, children, className }: {
  id?: string; title: ReactNode; description?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section id={id} className={cn('scroll-mt-28 space-y-3', className)}>
      <div className="flex items-end justify-between gap-2 border-b border-border pb-2">
        <div>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** شريط تنقل داخل القسم بين المجموعات */
export function EditGroupNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="أجزاء القسم" className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
      {items.map(i => (
        <a key={i.id} href={`#${i.id}`}
          onClick={e => { e.preventDefault(); document.getElementById(i.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
          className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
          {i.label}
        </a>
      ))}
    </nav>
  );
}
