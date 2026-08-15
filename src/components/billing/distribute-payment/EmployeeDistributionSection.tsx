import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus, X, Loader2, UserCheck, AlertCircle, TrendingUp, ArrowDownCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Employee, EmployeeBalance, EmployeePaymentDistribution } from './types';

interface EmployeeDistributionSectionProps {
  enableEmployee: boolean;
  setEnableEmployee: (v: boolean) => void;
  employeePaymentDistributions: EmployeePaymentDistribution[];
  addEmployeePaymentDistribution: () => void;
  removeEmployeePaymentDistribution: (index: number) => void;
  updateEmployeePaymentDistribution: (index: number, field: 'employeeId' | 'amount' | 'paymentType', value: string | number) => void;
  getTotalEmployeePaymentAmount: () => number;
  employees: Employee[];
  employeeBalances: EmployeeBalance[];
  loadingEmployees: boolean;
  totalAmount: string;
  remainingToAllocate?: number;
  sectionPool?: number;
}

export function EmployeeDistributionSection({
  enableEmployee, setEnableEmployee,
  employeePaymentDistributions,
  addEmployeePaymentDistribution,
  removeEmployeePaymentDistribution,
  updateEmployeePaymentDistribution,
  getTotalEmployeePaymentAmount,
  employees, employeeBalances, loadingEmployees, totalAmount,
  remainingToAllocate = 0,
  sectionPool = Infinity,
}: EmployeeDistributionSectionProps) {
  const [isOpen, setIsOpen] = useState(enableEmployee);

  const clamp = (val: number, max: number) => Math.max(0, Math.min(val, Math.max(0, max)));
  const sectionAllocated = employeePaymentDistributions.reduce((s, d) => s + Number(d.amount || 0), 0);

  const computeMax = (distribution: EmployeePaymentDistribution) => {
    const current = Number(distribution.amount || 0);
    const balance = employeeBalances.find(b => b.employeeId === distribution.employeeId);
    const poolCap = Math.max(0, sectionPool - (sectionAllocated - current));
    if (distribution.paymentType === 'from_balance' && balance) {
      return Math.min(balance.pendingAmount, poolCap);
    }
    return poolCap;
  };

  const computeFillAmount = (distribution: EmployeePaymentDistribution) => {
    const current = Number(distribution.amount || 0);
    const balance = employeeBalances.find(b => b.employeeId === distribution.employeeId);
    const poolCap = Math.max(0, sectionPool - (sectionAllocated - current));
    let target = Math.max(0, remainingToAllocate + current);
    if (distribution.paymentType === 'from_balance' && balance) {
      target = Math.min(target, balance.pendingAmount);
    }
    return Math.min(target, poolCap);
  };

  const totalEmp = getTotalEmployeePaymentAmount();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {/* ── رأس القسم ── */}
      <CollapsibleTrigger asChild>
        <div
          className="flex items-center justify-between w-full p-3 rounded-xl border border-border/50 hover:bg-accent/30 transition-all duration-200 cursor-pointer select-none"
          role="button"
        >
          <div className="flex items-center gap-3">
            <Checkbox
              checked={enableEmployee}
              onCheckedChange={(checked) => {
                setEnableEmployee(checked as boolean);
                if (checked) setIsOpen(true);
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5"
            />
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold">دفع لموظفين</span>
              {enableEmployee && employeePaymentDistributions.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {employeePaymentDistributions.filter(d => d.employeeId).length} موظف
                </span>
              )}
            </div>
            {enableEmployee && totalEmp > 0 && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 text-sm font-bold px-3 py-1">
                {totalEmp.toLocaleString('ar-LY')} د.ل
              </Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {enableEmployee && (
          <div className="space-y-4 p-4 mt-2 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30">
            {/* ── شريط العنوان + زر إضافة ── */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                توزيع المدفوعات على الموظفين
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEmployeePaymentDistribution}
                className="gap-2 h-9 text-sm border-emerald-300 dark:border-emerald-700 text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="h-4 w-4" />
                إضافة موظف
              </Button>
            </div>

            {loadingEmployees ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                <span className="text-sm text-muted-foreground">جاري تحميل بيانات الموظفين...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {employeePaymentDistributions.map((distribution, index) => {
                  const balance = employeeBalances.find(b => b.employeeId === distribution.employeeId);
                  const maxAmt = computeMax(distribution);
                  const fillAmt = computeFillAmount(distribution);
                  const isOverBalance = distribution.paymentType === 'from_balance' && balance && distribution.amount > balance.pendingAmount;
                  const isPoolFull = Number.isFinite(maxAmt) && maxAmt <= 0 && Number(distribution.amount || 0) === 0;

                  return (
                    <div
                      key={index}
                      className="p-4 bg-background rounded-xl border border-emerald-200/50 dark:border-emerald-800/30 space-y-3 shadow-sm"
                    >
                      {/* اختيار الموظف */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select
                            value={distribution.employeeId}
                            onValueChange={(value) => updateEmployeePaymentDistribution(index, 'employeeId', value)}
                          >
                            <SelectTrigger className="h-11 text-sm border-emerald-200 dark:border-emerald-800 focus:ring-emerald-500/20">
                              <SelectValue placeholder="اختر موظف..." />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map((employee) => (
                                <SelectItem key={employee.id} value={employee.id} className="text-sm py-2">
                                  {employee.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {employeePaymentDistributions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEmployeePaymentDistribution(index)}
                            className="h-9 w-9 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {distribution.employeeId && (
                        <div className="space-y-3">
                          {/* ── رصيد الموظف أو لافتة السلفة ── */}
                          {balance && balance.pendingAmount > 0 ? (
                            <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-3">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <span className="text-xs text-muted-foreground font-medium block">
                                    رصيد الفريق ({balance.teamName})
                                  </span>
                                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                    {balance.pendingAmount.toLocaleString('ar-LY')} <span className="text-xs font-normal">د.ل</span>
                                  </span>
                                </div>
                                <div className="p-1.5 rounded-lg bg-emerald-500/20">
                                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                </div>
                              </div>

                              {/* أزرار التبديل بنظام Segment Control (تبويب مدمج) */}
                              <div className="grid grid-cols-2 gap-1 bg-background/50 dark:bg-background/20 p-1 rounded-lg border border-border/30">
                                <button
                                  type="button"
                                  onClick={() => updateEmployeePaymentDistribution(index, 'paymentType', 'from_balance')}
                                  className={cn(
                                    "h-9 text-xs font-bold rounded-md transition-all duration-200",
                                    distribution.paymentType === 'from_balance'
                                      ? "bg-emerald-600 text-white shadow-sm"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  سحب من الرصيد
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateEmployeePaymentDistribution(index, 'paymentType', 'advance')}
                                  className={cn(
                                    "h-9 text-xs font-bold rounded-md transition-all duration-200",
                                    distribution.paymentType === 'advance'
                                      ? "bg-blue-600 text-white shadow-sm"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  سلفة
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                              <div>
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">لا يوجد رصيد متاح</p>
                                <p className="text-xs text-amber-600 dark:text-amber-400">سيتم تسجيله كسلفة</p>
                              </div>
                            </div>
                          )}

                          {/* ── حقل المبلغ ── */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground">المبلغ</Label>
                            <div className="relative flex items-center">
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={distribution.amount || ''}
                                onChange={(e) => {
                                  const rawVal = e.target.value.replace(/[^\d.]/g, '');
                                  const raw = parseFloat(rawVal) || 0;
                                  const max = computeMax(distribution);
                                  updateEmployeePaymentDistribution(index, 'amount', Number.isFinite(max) ? clamp(raw, max) : Math.max(0, raw));
                                }}
                                placeholder="0.00"
                                className="h-10 text-sm text-right font-bold pl-16 pr-3 w-full"
                                dir="rtl"
                                disabled={isPoolFull}
                              />
                              <div className="absolute left-2 flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground font-bold">د.ل</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateEmployeePaymentDistribution(index, 'amount', fillAmt)}
                                  className="h-7 px-2 text-xs text-primary hover:bg-primary/10 font-bold border-r border-border/50 rounded-none"
                                  disabled={fillAmt <= 0}
                                  title={`المتبقي: ${fillAmt.toFixed(2)}`}
                                >
                                  كامل
                                </Button>
                              </div>
                            </div>

                            {/* تنبيهات */}
                            {isPoolFull && (
                              <div className="flex items-center gap-2 text-sm text-red-600 font-semibold">
                                <AlertCircle className="h-4 w-4" />
                                تم بلوغ سقف الدفعة
                              </div>
                            )}
                            {isOverBalance && (
                              <div className="flex items-center gap-2 text-sm text-red-600">
                                <AlertCircle className="h-4 w-4" />
                                المبلغ أكبر من الرصيد المتاح ({balance?.pendingAmount.toLocaleString('ar-LY')} د.ل)
                              </div>
                            )}
                            {Number.isFinite(maxAmt) && maxAmt > 0 && (
                              <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                                <span>الحد الأقصى المتاح:</span>
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                  {maxAmt.toLocaleString('ar-LY')} د.ل
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ── شريط الإجمالي ── */}
                <div className="flex items-center justify-between pt-3 border-t border-emerald-200 dark:border-emerald-800">
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">إجمالي الموظفين</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                    {getTotalEmployeePaymentAmount().toLocaleString('ar-LY')}
                    <span className="text-sm font-normal mr-1">د.ل</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
