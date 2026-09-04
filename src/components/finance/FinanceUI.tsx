import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { Calculator, ChevronLeft, Receipt, Users, type LucideIcon } from 'lucide-react';
import { DialogContent, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import './finance.css';

export function FinancePageHeader({ title, description, icon: Icon, actions }: {
  title: string; description: string; icon: LucideIcon; actions?: React.ReactNode;
}) {
  return <header className="finance-page-header rounded-2xl border border-border bg-card overflow-hidden">
    <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4 min-w-0">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Icon className="h-6 w-6" aria-hidden="true" /></span>
        <div className="min-w-0 space-y-1">
          <p className="text-[12px] font-semibold text-primary flex items-center gap-1">الإدارة المالية <ChevronLeft className="h-3 w-3" /></p>
          <h1 className="text-[25px] sm:text-[28px] font-bold leading-tight text-foreground">{title}</h1>
          <p className="text-[14px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none">{actions}</div>}
    </div>
    <nav aria-label="أقسام الإدارة المالية" className="grid grid-cols-3 border-t bg-muted/25 p-2 gap-1 sm:flex sm:gap-2">
      {[
        { to: '/admin/expense-management', label: 'المصروفات', icon: Receipt },
        { to: '/admin/salaries', label: 'الرواتب والموظفون', icon: Users },
        { to: '/admin/expenses', label: 'مصروفات التشغيل', icon: Calculator },
      ].map(({ to, label, icon: NavIcon }) => <NavLink key={to} to={to} end className={({ isActive }) => cn('flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 sm:px-4 text-center text-[13px] font-semibold cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', isActive ? 'bg-card text-primary shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:bg-card hover:text-foreground')}><NavIcon className="h-4 w-4 shrink-0 hidden sm:block" aria-hidden="true" />{label}</NavLink>)}
    </nav>
  </header>;
}

export function FinanceStatCard({ label, value, note, icon: Icon, tone = 'default', currency = true }: {
  label: string; value: number; note?: string; icon: LucideIcon; tone?: 'default' | 'primary' | 'success' | 'danger'; currency?: boolean;
}) {
  const colors = { default: 'bg-muted text-muted-foreground', primary: 'bg-primary/10 text-primary', success: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400', danger: 'bg-destructive/10 text-destructive' };
  return <article className={cn('min-w-0 rounded-2xl border bg-card p-4 sm:p-5 space-y-3', tone === 'primary' ? 'border-primary/35 shadow-sm' : 'border-border')}>
    <div className="flex items-start justify-between gap-2"><p className="text-[13px] font-semibold text-muted-foreground leading-relaxed">{label}</p><span className={cn('rounded-lg p-2 shrink-0', colors[tone])}><Icon className="h-4 w-4" aria-hidden="true" /></span></div>
    <div className="flex flex-wrap items-baseline gap-1.5"><strong dir="ltr" className={cn('font-manrope text-[25px] sm:text-[28px] leading-tight tabular-nums tracking-tight', tone === 'primary' && 'text-primary', tone === 'danger' && 'text-destructive')}>{Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>{currency && <span className="text-[12px] text-muted-foreground">د.ل</span>}</div>
    {note && <p className="text-[12px] leading-relaxed text-muted-foreground">{note}</p>}
  </article>;
}

export const FinanceDialogContent = React.forwardRef<React.ElementRef<typeof DialogContent>, React.ComponentPropsWithoutRef<typeof DialogContent>>(({ className, ...props }, ref) => <DialogContent ref={ref} dir="rtl" className={cn('finance-dialog max-h-[92dvh] overflow-y-auto overscroll-contain bg-card p-5 sm:p-6', className)} {...props} />);
FinanceDialogContent.displayName = 'FinanceDialogContent';
export function FinanceDialogHeader({ className, ...props }: React.ComponentProps<typeof DialogHeader>) {
  return <DialogHeader className={cn('finance-dialog-heading border-b border-border pb-4 mb-4 pl-10 space-y-2 text-right', className)} {...props} />;
}
export function FinanceDialogFooter({ className, ...props }: React.ComponentProps<typeof DialogFooter>) {
  return <DialogFooter className={cn('finance-dialog-footer sticky -bottom-6 z-10 border-t bg-card py-4 mt-4 gap-2', className)} {...props} />;
}
