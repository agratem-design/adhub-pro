// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Wallet, Loader2, CheckSquare, Square, Zap, AlertCircle, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface ExpensePaymentRow {
  expense_id: string;
  amount: number;
}

interface UnpaidExpense {
  id: string;
  description: string;
  amount: number;
  paid_amount: number;
  remaining: number;
  employee_id?: string;
  employee_name?: string;
  category?: string;
  expense_date?: string;
}

interface Employee { id: string; name: string; }

interface Props {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  expensePayments: ExpensePaymentRow[];
  setExpensePayments: (v: ExpensePaymentRow[]) => void;
  refreshKey?: number;
  // ✅ معرّفات مصروفات يجب تضمينها حتى لو كانت مسددة (وضع التعديل)
  includeExpenseIds?: string[];
  // ✅ اختيار الموظف مُتحكَّم به من الخارج للترابط بين الأقسام
  selectedEmployeeId?: string;
  onSelectedEmployeeIdChange?: (id: string) => void;
  remainingToAllocate?: number;
  sectionPool?: number;
}

export function ExpensePaymentSection({
  enabled, setEnabled, expensePayments, setExpensePayments, refreshKey,
  includeExpenseIds = [],
  selectedEmployeeId: controlledEmployeeId,
  onSelectedEmployeeIdChange,
  remainingToAllocate = Infinity,
  sectionPool = Infinity,
}: Props) {
  const [isOpen, setIsOpen] = useState(enabled);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [allExpenses, setAllExpenses] = useState<UnpaidExpense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [internalEmployeeId, setInternalEmployeeId] = useState<string>('');
  const selectedEmployeeId = controlledEmployeeId !== undefined ? controlledEmployeeId : internalEmployeeId;
  const setSelectedEmployeeId = (id: string) => {
    if (onSelectedEmployeeIdChange) onSelectedEmployeeIdChange(id);
    if (controlledEmployeeId === undefined) setInternalEmployeeId(id);
  };
  const [availableAmount, setAvailableAmount] = useState<string>('');

  useEffect(() => {
    if (!enabled) return;
    setIsOpen(true);
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { data: unpaidExps, error: loadError } = await supabase
          .from('expenses')
          .select('id, description, amount, paid_amount, payment_status, employee_id, category, expense_date')
          .neq('payment_status', 'paid')
          .order('expense_date', { ascending: false });

        if (loadError) throw loadError;
        // ✅ ضمّن مصروفات وضع التعديل حتى لو كانت مسددة
        let extraExps: any[] = [];
        const haveIds = new Set((unpaidExps || []).map((e: any) => e.id));
        const missingIds = includeExpenseIds.filter((id) => !haveIds.has(id));
        if (missingIds.length > 0) {
          const { data: editExps } = await supabase
            .from('expenses')
            .select('id, description, amount, paid_amount, payment_status, employee_id, category, expense_date')
            .in('id', missingIds);
          extraExps = editExps || [];
        }
        const exps = [...(unpaidExps || []), ...extraExps];

        const empIds = Array.from(new Set((exps || []).map((e: any) => e.employee_id).filter(Boolean)));
        let empList: Employee[] = [];
        let empMap: Record<string, string> = {};
        if (empIds.length) {
          const { data: emps } = await supabase.from('employees').select('id, name').in('id', empIds).order('name');
          empList = (emps || []) as Employee[];
          empMap = Object.fromEntries(empList.map((e) => [e.id, e.name]));
        }
        setEmployees(empList);

        const includeSet = new Set(includeExpenseIds);
        setAllExpenses((exps || []).map((e: any) => {
          const baseRemaining = Math.max(0, Number(e.amount) - Number(e.paid_amount || 0));
          // ✅ للعنصر المُحرَّر: أضف المبلغ السابق إلى المتبقي حتى يظهر قابلاً للتعديل
          const editingAmt = includeSet.has(e.id)
            ? Number(expensePayments.find(p => p.expense_id === e.id)?.amount || 0)
            : 0;
          return {
            id: e.id,
            description: e.description,
            amount: Number(e.amount),
            paid_amount: Number(e.paid_amount || 0),
            remaining: baseRemaining + editingAmt,
            employee_id: e.employee_id,
            employee_name: e.employee_id ? empMap[e.employee_id] : undefined,
            category: e.category,
            expense_date: e.expense_date,
          };
        }).filter(e => e.remaining > 0 || includeSet.has(e.id)));
      } catch {
        setLoadError('تعذر تحميل المصروفات؛ أعد فتح القسم للمحاولة مجددًا');
      } finally {
        setLoading(false);
      }
    })();
  }, [enabled, refreshKey, includeExpenseIds.join(',')]);

  // Filter by selected employee
  const visibleExpenses = useMemo(
    () => selectedEmployeeId ? allExpenses.filter(e => e.employee_id === selectedEmployeeId) : allExpenses,
    [allExpenses, selectedEmployeeId]
  );

  // Filtering changes the visible list, never previously selected settlements.

  const toggle = (exp: UnpaidExpense, checked: boolean) => {
    if (checked) {
      const others = expensePayments.filter(p => p.expense_id !== exp.id);
      const otherSum = others.reduce((s, p) => s + Number(p.amount || 0), 0);
      const poolCap = Math.max(0, sectionPool - otherSum);
      const amt = Math.min(exp.remaining, poolCap);
      setExpensePayments([...others, { expense_id: exp.id, amount: amt }]);
    } else {
      setExpensePayments(expensePayments.filter(p => p.expense_id !== exp.id));
    }
  };

  const updateAmount = (id: string, val: string, max: number) => {
    const sel = expensePayments.find(p => p.expense_id === id);
    const current = Number(sel?.amount || 0);
    const poolCap = Math.max(0, sectionPool - (totalSelected - current));
    const dynamicCap = Math.min(
      availableNum > 0 ? Math.min(max, remainingFromAvailable + current) : max,
      poolCap,
    );
    const n = Math.max(0, Math.min(parseFloat(val) || 0, dynamicCap));
    setExpensePayments(expensePayments.map(p => p.expense_id === id ? { ...p, amount: n } : p));
  };

  const allSelected = visibleExpenses.length > 0 && visibleExpenses.every(e => expensePayments.some(p => p.expense_id === e.id));

  const selectAll = () => {
    if (allSelected) {
      const visibleIds = new Set(visibleExpenses.map(e => e.id));
      setExpensePayments(expensePayments.filter(p => !visibleIds.has(p.expense_id)));
    } else {
      const others = expensePayments.filter(p => !visibleExpenses.some(e => e.id === p.expense_id));
      const otherSum = others.reduce((s, p) => s + Number(p.amount || 0), 0);
      let budget = Math.max(0, sectionPool - otherSum);
      const additions: ExpensePaymentRow[] = [];
      for (const e of visibleExpenses) {
        if (budget <= 0) break;
        const amt = Math.min(e.remaining, budget);
        if (amt > 0) {
          additions.push({ expense_id: e.id, amount: amt });
          budget -= amt;
        }
      }
      setExpensePayments([...others, ...additions]);
    }
  };

  const totalSelected = expensePayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const employeeTotalRemaining = visibleExpenses.reduce((s, e) => s + e.remaining, 0);
  const availableNum = parseFloat(availableAmount) || 0;
  const remainingFromAvailable = Math.max(0, availableNum - totalSelected);
  const availableMaxCap = Math.max(0, Math.min(sectionPool, employeeTotalRemaining));

  const rowMax = (e: UnpaidExpense) => {
    const sel = expensePayments.find(p => p.expense_id === e.id);
    const current = Number(sel?.amount || 0);
    const poolCap = Math.max(0, sectionPool - (totalSelected - current));
    const fromAvailable = availableNum > 0
      ? Math.min(e.remaining, remainingFromAvailable + current)
      : e.remaining;
    return Math.min(fromAvailable, poolCap);
  };

  const autoDistribute = () => {
    if (availableNum <= 0 || visibleExpenses.length === 0) return;
    const sorted = [...visibleExpenses].sort((a, b) => a.remaining - b.remaining);
    const others = expensePayments.filter(p => !visibleExpenses.some(e => e.id === p.expense_id));
    const otherSum = others.reduce((s, p) => s + Number(p.amount || 0), 0);
    let budget = Math.min(availableNum, Math.max(0, sectionPool - otherSum));
    const newPayments: ExpensePaymentRow[] = [];
    for (const e of sorted) {
      if (budget <= 0) break;
      const pay = Math.min(e.remaining, budget);
      if (pay > 0) {
        newPayments.push({ expense_id: e.id, amount: pay });
        budget -= pay;
      }
    }
    setExpensePayments([...others, ...newPayments]);
  };

  // نسبة التسديد من مستحقات الموظف
  const payRatio = employeeTotalRemaining > 0 ? Math.min(1, totalSelected / employeeTotalRemaining) : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {/* ── رأس القسم ── */}
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl border border-border/50 hover:bg-accent/30 transition-all duration-200 cursor-pointer">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(!!v);
              if (v) setIsOpen(true);
              else { setExpensePayments([]); setSelectedEmployeeId(''); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5"
          />
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-bold">سداد مصروفات موظفين</span>
            {enabled && totalSelected > 0 && (
              <span className="text-xs text-muted-foreground">
                {expensePayments.length} مصروف
              </span>
            )}
          </div>
          {enabled && totalSelected > 0 && (
            <Badge className="bg-primary/15 text-primary border-primary/30 text-sm font-bold px-3 py-1">
              {totalSelected.toLocaleString('ar-LY')} د.ل
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>

      <CollapsibleContent>
        {enabled && (
          <div className="space-y-4 p-4 mt-2 bg-primary/5 rounded-xl border border-primary/20">

            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">جاري تحميل المصروفات...</span>
              </div>
            ) : loadError ? (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</p>
            ) : allExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">لا توجد مصروفات غير مسددة</p>
              </div>
            ) : (
              <>
                {/* ── اختيار الموظف ── */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    المصروفات المستحقة
                  </label>
                  <Select value={selectedEmployeeId || 'all'} onValueChange={value => setSelectedEmployeeId(value === 'all' ? '' : value)}>
                    <SelectTrigger className="h-11 text-sm bg-background border-primary/30 focus:ring-primary/20">
                      <SelectValue placeholder="جميع المصروفات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المصروفات والموظفين</SelectItem>
                      {employees.map(emp => {
                        const cnt = allExpenses.filter(e => e.employee_id === emp.id).length;
                        const total = allExpenses.filter(e => e.employee_id === emp.id).reduce((s, e) => s + e.remaining, 0);
                        return (
                          <SelectItem key={emp.id} value={emp.id} className="text-sm py-2">
                            {emp.name} ({cnt} مصروف · {total.toLocaleString('ar-LY')} د.ل)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {visibleExpenses.length > 0 && (
                  <>
                    {/* ── حقل المبلغ المتاح + توزيع تلقائي ── */}
                    <div className="p-4 rounded-xl border border-primary/25 bg-background space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">
                          المبلغ المتاح للمصروفات المعروضة
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={availableAmount}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^\d.]/g, '');
                              if (v === '') { setAvailableAmount(''); return; }
                              const raw = parseFloat(v) || 0;
                              const clamped = Math.max(0, Math.min(raw, availableMaxCap));
                              setAvailableAmount(String(clamped));
                            }}
                            placeholder="0.00"
                            className="h-10 text-sm flex-1 text-right font-bold"
                            dir="rtl"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setAvailableAmount(String(availableMaxCap))}
                            className="h-10 px-3 text-xs border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                            disabled={availableMaxCap <= 0}
                          >
                            كامل
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={autoDistribute}
                            disabled={availableNum <= 0}
                            className="h-10 px-3 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                          >
                            <Zap className="h-3.5 w-3.5" />
                            تلقائي
                          </Button>
                        </div>
                      </div>

                      {/* ── بطاقات الحالة الثلاث ── */}
                      {availableNum > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-primary/10 border border-primary/20">
                            <span className="text-[10px] text-muted-foreground">المُختار</span>
                            <span className="text-sm font-black text-primary leading-none">
                              {totalSelected.toLocaleString('ar-LY')}
                            </span>
                            <span className="text-[9px] text-muted-foreground">د.ل</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <span className="text-[10px] text-muted-foreground">متبقي من المبلغ</span>
                            <span className="text-sm font-black text-amber-600 dark:text-amber-400 leading-none">
                              {remainingFromAvailable.toLocaleString('ar-LY')}
                            </span>
                            <span className="text-[9px] text-muted-foreground">د.ل</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                            <span className="text-[10px] text-muted-foreground">مستحقات الموظف</span>
                            <span className="text-sm font-black text-rose-600 dark:text-rose-400 leading-none">
                              {employeeTotalRemaining.toLocaleString('ar-LY')}
                            </span>
                            <span className="text-[9px] text-muted-foreground">د.ل</span>
                          </div>
                        </div>
                      )}

                      {/* شريط تقدم الموظف */}
                      {totalSelected > 0 && employeeTotalRemaining > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>نسبة تسديد مستحقات الموظف</span>
                            <span className="font-bold text-primary">{(payRatio * 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-2.5 bg-primary/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                              style={{ width: `${payRatio * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── شريط تحديد الكل ── */}
                    <div className="flex items-center justify-between">
                      <Button type="button" size="sm" variant="ghost" onClick={selectAll}
                        className="h-9 text-sm gap-2 hover:bg-primary/10">
                        {allSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                        {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        إجمالي مستحقات: <strong className="text-foreground">{employeeTotalRemaining.toLocaleString('ar-LY')} د.ل</strong>
                      </span>
                    </div>

                    {/* ── قائمة المصروفات ── */}
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {visibleExpenses.map(e => {
                        const sel = expensePayments.find(p => p.expense_id === e.id);
                        const max = rowMax(e);
                        const poolFull = !sel && Math.max(0, sectionPool - totalSelected) <= 0;
                        return (
                          <div
                            key={e.id}
                            className={`flex flex-col gap-2.5 p-3 rounded-xl border transition-all duration-150 ${
                              sel
                                ? 'bg-primary/8 border-primary/30 shadow-sm'
                                : poolFull
                                  ? 'bg-muted/30 border-border/30 opacity-60'
                                  : 'bg-background border-border/50 hover:border-primary/30 hover:bg-primary/5'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={!!sel}
                                onCheckedChange={(v) => toggle(e, !!v)}
                                disabled={poolFull}
                                className="h-5 w-5 mt-0.5 shrink-0"
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="text-sm font-semibold leading-tight break-words">{e.description}</div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                  <span className="font-bold text-rose-600 dark:text-rose-400">
                                    متبقي: {e.remaining.toLocaleString('ar-LY')} د.ل
                                  </span>
                                  {e.expense_date && (
                                    <span>{new Date(e.expense_date).toLocaleDateString('ar-LY')}</span>
                                  )}
                                  {e.category && <Badge variant="outline" className="text-[10px] h-4 px-1">{e.category}</Badge>}
                                  {poolFull && (
                                    <span className="text-red-600 font-semibold flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" /> السقف ممتلئ
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {sel && (
                              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border/30">
                                <span className="text-xs text-muted-foreground font-semibold">مبلغ السداد:</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={sel.amount || ''}
                                    onChange={(ev) => {
                                      const val = ev.target.value.replace(/[^\d.]/g, '');
                                      updateAmount(e.id, val, e.remaining);
                                    }}
                                    className="h-8.5 w-24 text-xs text-right font-bold"
                                    dir="rtl"
                                    disabled={max <= 0 && Number(sel.amount || 0) === 0}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateAmount(e.id, String(max), e.remaining)}
                                    className="h-8.5 px-2.5 text-xs border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                                    disabled={max <= 0}
                                  >
                                    كامل
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {visibleExpenses.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">لا توجد مصروفات غير مسددة لهذا الموظف</p>
                  </div>
                )}
              </>
            )}

            {/* ── شريط الإجمالي ── */}
            <div className="flex items-center justify-between pt-3 border-t border-primary/20">
              <span className="text-sm font-semibold text-primary">إجمالي السداد</span>
              <span className="text-lg font-black text-primary">{totalSelected.toLocaleString('ar-LY')} <span className="text-sm font-normal">د.ل</span></span>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
