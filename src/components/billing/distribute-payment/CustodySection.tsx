import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus, X, Loader2, Wallet, AlertCircle, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { Employee, CustodyDistribution } from './types';

interface CustodySectionProps {
  enableCustodyOption: boolean;
  setEnableCustodyOption: (v: boolean) => void;
  convertToCustody: boolean;
  setConvertToCustody: (v: boolean) => void;
  custodyOptionAmount: string;
  setCustodyOptionAmount: (v: string) => void;
  custodyDistributions: CustodyDistribution[];
  addCustodyDistribution: () => void;
  removeCustodyDistribution: (index: number) => void;
  updateCustodyDistribution: (index: number, field: 'employeeId' | 'amount', value: string | number) => void;
  employees: Employee[];
  loadingEmployees: boolean;
  remainingToAllocate?: number;
  sectionPool?: number;
}

export function CustodySection({
  enableCustodyOption, setEnableCustodyOption,
  convertToCustody, setConvertToCustody,
  custodyOptionAmount, setCustodyOptionAmount,
  custodyDistributions,
  addCustodyDistribution,
  removeCustodyDistribution,
  updateCustodyDistribution,
  employees, loadingEmployees,
  remainingToAllocate = 0,
  sectionPool = Infinity,
}: CustodySectionProps) {
  const [isOpen, setIsOpen] = useState(enableCustodyOption);

  const clamp = (val: number, max: number) => Math.max(0, Math.min(val, Math.max(0, max)));
  const custodyPool = parseFloat(custodyOptionAmount) || 0;
  const otherSum = (idx: number) =>
    custodyDistributions.reduce((s, d, i) => (i === idx ? s : s + Number(d.amount || 0)), 0);

  const computeRowMax = (idx: number) => {
    return Math.max(0, custodyPool - otherSum(idx));
  };

  const custodyMaxAmount = () => Math.max(0, sectionPool);

  const totalCustody = custodyDistributions.reduce((s, d) => s + Number(d.amount || 0), 0);
  const custodyBalance = custodyPool - totalCustody;
  const custodyFillPct = custodyPool > 0 ? Math.min(1, totalCustody / custodyPool) : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {/* ── رأس القسم ── */}
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl border border-border/50 hover:bg-accent/30 transition-all duration-200 cursor-pointer">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={enableCustodyOption}
            onCheckedChange={(checked) => {
              setEnableCustodyOption(checked as boolean);
              if (!checked) setCustodyOptionAmount('');
              if (checked && !convertToCustody) setConvertToCustody(true);
              if (!checked) setConvertToCustody(false);
              if (checked) setIsOpen(true);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5"
          />
          <div className="p-1.5 rounded-lg bg-amber-500/10">
            <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-bold">عهدة / تسليم</span>
            {enableCustodyOption && custodyOptionAmount && (
              <span className="text-xs text-muted-foreground">
                {custodyDistributions.filter(d => d.employeeId).length} موظف
              </span>
            )}
          </div>
          {enableCustodyOption && custodyOptionAmount && (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-sm font-bold px-3 py-1">
              {parseFloat(custodyOptionAmount).toLocaleString('ar-LY')} د.ل
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>

      <CollapsibleContent>
        {enableCustodyOption && (
          <div className="space-y-4 p-4 mt-2 bg-amber-50/50 dark:bg-amber-950/10 rounded-xl border border-amber-200/50 dark:border-amber-800/30">

            {/* ── حقل مبلغ العهدة الإجمالي ── */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-amber-700 dark:text-amber-400">
                إجمالي مبلغ العهدة
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={custodyOptionAmount}
                  onChange={(e) => {
                    const rawVal = e.target.value.replace(/[^\d.]/g, '');
                    const raw = parseFloat(rawVal) || 0;
                    const max = custodyMaxAmount();
                    setCustodyOptionAmount(String(Number.isFinite(max) ? clamp(raw, max) : Math.max(0, raw)));
                  }}
                  placeholder="0.00"
                  className="h-11 text-sm text-right font-bold flex-1 border-amber-200 dark:border-amber-800 focus:ring-amber-500/20"
                  disabled={Number.isFinite(custodyMaxAmount()) && custodyMaxAmount() <= 0 && (parseFloat(custodyOptionAmount) || 0) === 0}
                  dir="rtl"
                />
                <span className="text-sm text-muted-foreground font-medium shrink-0">د.ل</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCustodyOptionAmount(String(custodyMaxAmount()))}
                  className="h-11 px-4 text-sm border-amber-300 text-amber-700 hover:bg-amber-50 font-semibold shrink-0"
                  disabled={!Number.isFinite(custodyMaxAmount()) || custodyMaxAmount() <= 0}
                  title={Number.isFinite(custodyMaxAmount()) ? `الحد الأقصى: ${custodyMaxAmount().toFixed(2)}` : undefined}
                >
                  كامل
                </Button>
              </div>
              {Number.isFinite(custodyMaxAmount()) && custodyMaxAmount() <= 0 && (parseFloat(custodyOptionAmount) || 0) === 0 && (
                <div className="flex items-center gap-2 text-sm text-red-600 font-semibold">
                  <AlertCircle className="h-4 w-4" />
                  تم بلوغ سقف الدفعة
                </div>
              )}
            </div>

            {/* ── توزيع العهدة على الموظفين ── */}
            {convertToCustody && (
              <div className="space-y-3">
                {/* شريط العنوان */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    توزيع على الموظفين
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustodyDistribution}
                    className="gap-2 h-9 text-sm border-amber-300 dark:border-amber-700 text-amber-700 hover:bg-amber-50"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة موظف
                  </Button>
                </div>

                {/* شريط تقدم توزيع العهدة */}
                {custodyPool > 0 && (
                  <div className="space-y-1.5 p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-amber-700 dark:text-amber-400 font-medium">موزّع</span>
                      <span className="font-bold text-amber-800 dark:text-amber-300">
                        {totalCustody.toLocaleString('ar-LY')} / {custodyPool.toLocaleString('ar-LY')} د.ل
                      </span>
                    </div>
                    <div className="h-2.5 bg-amber-200 dark:bg-amber-800/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${custodyFillPct * 100}%` }}
                      />
                    </div>
                    {custodyBalance > 0.01 && (
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        متبقي للتوزيع: <strong>{custodyBalance.toLocaleString('ar-LY')} د.ل</strong>
                      </div>
                    )}
                  </div>
                )}

                {loadingEmployees ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                    <span className="text-sm text-muted-foreground">جاري تحميل الموظفين...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {custodyDistributions.map((distribution, index) => {
                      const rowMax = computeRowMax(index);
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-background rounded-xl border border-amber-200 dark:border-amber-700 shadow-sm"
                        >
                          {/* مؤشر لون الموظف */}
                          <div className="w-1.5 h-10 rounded-full bg-amber-400 shrink-0" />

                          {/* اختيار الموظف */}
                          <div className="flex-1 min-w-0">
                            <Select
                              value={distribution.employeeId}
                              onValueChange={(value) => updateCustodyDistribution(index, 'employeeId', value)}
                            >
                              <SelectTrigger className="h-11 text-sm border-amber-200 dark:border-amber-800">
                                <SelectValue placeholder="اختر الموظف..." />
                              </SelectTrigger>
                              <SelectContent>
                                {employees.map((employee) => (
                                  <SelectItem key={employee.id} value={employee.id} className="py-2">
                                    <span className="font-medium">{employee.name}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* المبلغ */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={distribution.amount || ''}
                              onChange={(e) => {
                                const rawVal = e.target.value.replace(/[^\d.]/g, '');
                                const raw = parseFloat(rawVal) || 0;
                                updateCustodyDistribution(index, 'amount', clamp(raw, rowMax));
                              }}
                              placeholder="0"
                              className="h-11 w-28 text-sm text-right font-bold"
                              dir="rtl"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => updateCustodyDistribution(index, 'amount', rowMax)}
                              className="h-11 px-3 text-sm border-amber-300 text-amber-700 hover:bg-amber-50 font-semibold"
                              disabled={rowMax <= 0}
                              title={`الحد الأقصى: ${rowMax.toFixed(2)}`}
                            >
                              كامل
                            </Button>
                          </div>

                          {/* حذف */}
                          {custodyDistributions.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCustodyDistribution(index)}
                              className="h-9 w-9 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── شريط الإجمالي ── */}
                {custodyDistributions.some(d => d.amount > 0) && (
                  <div className="flex items-center justify-between pt-3 border-t border-amber-200 dark:border-amber-800">
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">إجمالي العهد</span>
                    <span className="text-lg font-black text-amber-700 dark:text-amber-400">
                      {totalCustody.toLocaleString('ar-LY')}
                      <span className="text-sm font-normal mr-1">د.ل</span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
