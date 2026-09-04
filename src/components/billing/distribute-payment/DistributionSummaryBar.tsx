import { DollarSign, CheckCircle, AlertCircle, Users, Wallet, Receipt, UserCheck } from 'lucide-react';

interface DistributionSummaryBarProps {
  inputAmountNum: number;
  totalAllocated: number;
  remainingToAllocate: number;
  breakdown?: {
    customer: number;
    employees: number;
    custody: number;
    expenses: number;
  };
}

export function DistributionSummaryBar({ inputAmountNum, totalAllocated, remainingToAllocate, breakdown }: DistributionSummaryBarProps) {
  const isBalanced = Math.abs(remainingToAllocate) < 0.01;
  const isOver = remainingToAllocate < 0;

  return (
    <div className="space-y-4">
      {/* ── الأرقام الثلاثة الرئيسية ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
        {/* الكلي */}
        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground font-medium">إجمالي الدفعة</span>
          </div>
          <div className="flex items-end gap-1 mt-1">
            <span className="text-2xl font-black text-primary leading-none">
              {inputAmountNum.toLocaleString('ar-LY')}
            </span>
            <span className="text-xs text-muted-foreground mb-0.5">د.ل</span>
          </div>
        </div>

        {/* المقيد على العقود والفواتير */}
        <div className={`flex flex-col gap-1 p-4 rounded-2xl border ${
          totalAllocated > 0
            ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/30'
            : 'bg-gradient-to-br from-accent/30 to-accent/10 border-border/50'
        }`}>
          <div className="flex items-center gap-1.5">
            <CheckCircle className={`h-4 w-4 shrink-0 ${totalAllocated > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`} />
            <span className="text-xs text-muted-foreground font-medium">موزّع للعميل</span>
          </div>
          <div className="flex items-end gap-1 mt-1">
            <span className={`text-2xl font-black leading-none ${totalAllocated > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              {totalAllocated.toLocaleString('ar-LY')}
            </span>
            <span className="text-xs text-muted-foreground mb-0.5">د.ل</span>
          </div>
        </div>

        {/* المتبقي */}
        <div className={`flex flex-col gap-1 p-4 rounded-2xl border ${
          isBalanced
            ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/30'
            : isOver
              ? 'bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/30'
              : 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30'
        }`}>
          <div className="flex items-center gap-1.5">
            {isBalanced ? (
              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className={`h-4 w-4 shrink-0 ${isOver ? 'text-red-500' : 'text-amber-500'}`} />
            )}
            <span className="text-xs text-muted-foreground font-medium">
              {isBalanced ? 'موزّع بالكامل' : isOver ? 'تجاوز المبلغ' : 'رصيد العميل غير الموزع'}
            </span>
          </div>
          <div className="flex items-end gap-1 mt-1">
            <span className={`text-2xl font-black leading-none ${
              isBalanced ? 'text-emerald-500' : isOver ? 'text-red-500' : 'text-amber-500'
            }`}>
              {Math.abs(remainingToAllocate).toLocaleString('ar-LY')}
            </span>
            <span className="text-xs text-muted-foreground mb-0.5">د.ل</span>
          </div>
        </div>
      </div>

      {/* ── التفصيل حسب الوجهة ── */}
      {breakdown && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Receipt className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-semibold">عميل</span>
            </div>
            <span className="text-base font-black text-blue-700 dark:text-blue-300 leading-none">
              {breakdown.customer.toLocaleString('ar-LY')}
            </span>
            <span className="text-[10px] text-muted-foreground">د.ل</span>
          </div>

          <div className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-semibold">موظفين</span>
            </div>
            <span className="text-base font-black text-emerald-700 dark:text-emerald-300 leading-none">
              {breakdown.employees.toLocaleString('ar-LY')}
            </span>
            <span className="text-[10px] text-muted-foreground">د.ل</span>
          </div>

          <div className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-semibold">عهدة</span>
            </div>
            <span className="text-base font-black text-amber-700 dark:text-amber-300 leading-none">
              {breakdown.custody.toLocaleString('ar-LY')}
            </span>
            <span className="text-[10px] text-muted-foreground">د.ل</span>
          </div>

          <div className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-semibold">مصاريف</span>
            </div>
            <span className="text-base font-black text-rose-700 dark:text-rose-300 leading-none">
              {breakdown.expenses.toLocaleString('ar-LY')}
            </span>
            <span className="text-[10px] text-muted-foreground">د.ل</span>
          </div>
        </div>
      )}

      {/* ── شريط التقدم ── */}
      {inputAmountNum > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-medium">نسبة توزيع دفعة العميل</span>
            <span className={`text-sm font-bold ${totalAllocated >= inputAmountNum ? 'text-emerald-500' : 'text-primary'}`}>
              {((totalAllocated / inputAmountNum) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-3 bg-accent/50 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                totalAllocated >= inputAmountNum
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                  : 'bg-gradient-to-r from-primary to-primary/70'
              }`}
              style={{ width: `${Math.min((totalAllocated / inputAmountNum) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
