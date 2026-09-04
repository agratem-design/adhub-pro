import { AlertCircle, CheckCircle2, FileText, Wallet } from 'lucide-react';
import type { DistributableItem } from './types';

const format = (amount: number) => `${amount.toLocaleString('ar-LY', { maximumFractionDigits: 2 })} د.ل`;

export function DistributionReview({ amount, fees, items, employees, custody, expenses, errors, customerName, date, method }: {
  amount: number; fees: number; items: DistributableItem[]; employees: number; custody: number; expenses: number;
  errors: string[]; customerName: string; date: string; method: string;
}) {
  const selected = items.filter(item => item.selected && item.allocatedAmount > 0);
  const credit = amount - selected.reduce((sum, item) => sum + item.allocatedAmount, 0);
  const retained = amount - fees - employees - custody - expenses;
  return <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5" dir="rtl">
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
      <p className="text-sm text-muted-foreground">مراجعة قبل الحفظ · {customerName}</p>
      <div className="flex flex-wrap justify-between items-end gap-3 mt-2"><strong className="text-[28px] sm:text-3xl font-manrope tabular-nums">{format(amount)}</strong><span className="text-sm text-muted-foreground">{date} · {method}</span></div>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />تسوية حساب العميل</h3>
        <p className="text-sm text-muted-foreground">تُخصم هذه القيم من مديونية العميل.</p>
        {selected.map(item => <div key={`${item.type}:${item.id}`} className="flex justify-between gap-4 text-sm border-b py-2"><span>{item.displayName}</span><strong className="shrink-0 tabular-nums">{format(item.allocatedAmount)}</strong></div>)}
        {credit > 0 && <div className="flex justify-between text-sm py-2"><span>رصيد حساب غير موزع</span><strong>{format(credit)}</strong></div>}
      </section>
      <section className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" />أوجه صرف الأموال المستلمة</h3>
        <p className="text-sm text-muted-foreground">صرف الدفعة لا يغيّر المبلغ المقيد للعميل.</p>
        {[['مستحقات وسلف الموظفين', employees], ['عهد مسلّمة', custody], ['سداد مصروفات', expenses], ['عمولات ورسوم', fees]].map(([label, value]) => <div key={label} className="flex justify-between text-sm border-b py-2"><span>{label}</span><strong className="tabular-nums">{format(Number(value))}</strong></div>)}
        <div className={`flex justify-between font-bold rounded-lg p-3 ${retained < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}><span>المتبقي لدى الشركة</span><span>{format(retained)}</span></div>
      </section>
    </div>
    <div role="status" className={`rounded-xl border p-4 ${errors.length ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400'}`}>
      <div className="flex items-center gap-2 font-semibold">{errors.length ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}{errors.length ? 'راجع البنود التالية قبل الحفظ' : 'التوزيع متوازن وجاهز للحفظ'}</div>
      {errors.length > 0 && <ul className="list-disc pr-5 text-sm space-y-1 mt-2">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
    </div>
  </div>;
}
