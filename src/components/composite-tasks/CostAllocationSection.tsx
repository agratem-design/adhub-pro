/**
 * CostAllocationSection - نظام توزيع التكاليف بين الأطراف
 * يسمح بتوزيع تكلفة كل خدمة (طباعة/مجسمات/تركيب) على الزبون والشركة والمطبعة
 */

import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  Users, Printer, Scissors, Wrench, Percent, DollarSign, 
  AlertTriangle, ArrowLeftRight, Check 
} from 'lucide-react';

export interface ServiceAllocation {
  enabled: boolean;
  mode: 'percentage' | 'amount'; // نسبة أو مبلغ
  customer_pct: number;
  company_pct: number;
  printer_pct: number;
  customer_amount: number;
  company_amount: number;
  printer_amount: number;
  reason: string;
  discount: number;
  discount_reason: string;
}

export interface CostAllocationData {
  print: ServiceAllocation;
  cutout: ServiceAllocation;
  installation: ServiceAllocation;
}

const defaultServiceAllocation = (): ServiceAllocation => ({
  enabled: false,
  mode: 'percentage',
  customer_pct: 100,
  company_pct: 0,
  printer_pct: 0,
  customer_amount: 0,
  company_amount: 0,
  printer_amount: 0,
  reason: '',
  discount: 0,
  discount_reason: '',
});

export const createDefaultCostAllocation = (): CostAllocationData => ({
  print: defaultServiceAllocation(),
  cutout: defaultServiceAllocation(),
  installation: defaultServiceAllocation(),
});

interface CostAllocationSectionProps {
  allocation: CostAllocationData;
  onChange: (allocation: CostAllocationData) => void;
  hasPrint: boolean;
  hasCutout: boolean;
  hasInstallation: boolean;
  // التكاليف الأصلية لحساب المبالغ من النسب
  originalCosts: {
    customerPrint: number;
    companyPrint: number;
    customerCutout: number;
    companyCutout: number;
    customerInstallation: number;
    companyInstallation: number;
  };
}

interface ServiceAllocationCardProps {
  service: 'print' | 'cutout' | 'installation';
  label: string;
  icon: React.ReactNode;
  color: string;
  allocation: ServiceAllocation;
  onChange: (alloc: ServiceAllocation) => void;
  totalCost: number; // إجمالي تكلفة الزبون للخدمة
  showPrinter: boolean; // هل يوجد مطبعة (الطباعة والمجسمات فقط)
}

const NumberInputWithSuffix = ({ value, onChange, suffix, min = 0, max, step = '1', className }: {
  value: number;
  onChange: (value: number) => void;
  suffix: string;
  min?: number;
  max?: number;
  step?: string;
  className?: string;
}) => (
  <div dir="ltr" className={cn("flex items-center h-10 rounded-xl border border-border/20 bg-background px-2 min-w-0", className)}>
    <Input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="h-9 flex-1 min-w-0 border-0 bg-transparent text-center text-xs font-manrope rounded-xl font-semibold font-mono focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
      min={min}
      max={max}
      step={step}
    />
    <span className="text-xs font-semibold text-muted-foreground/60 shrink-0 px-1 whitespace-nowrap">{suffix}</span>
  </div>
);

function ServiceAllocationCard({
  service,
  label,
  icon,
  color,
  allocation,
  onChange,
  totalCost,
  showPrinter,
}: ServiceAllocationCardProps) {
  const handlePctChange = (field: 'customer_pct' | 'company_pct' | 'printer_pct', value: number) => {
    const newAlloc = { ...allocation, [field]: Math.max(0, Math.min(100, value)) };
    
    // حساب المبالغ من النسب
    const total = totalCost;
    newAlloc.customer_amount = Math.round((newAlloc.customer_pct / 100) * total * 100) / 100;
    newAlloc.company_amount = Math.round((newAlloc.company_pct / 100) * total * 100) / 100;
    newAlloc.printer_amount = Math.round((newAlloc.printer_pct / 100) * total * 100) / 100;
    
    onChange(newAlloc);
  };

  const handleAmountChange = (field: 'customer_amount' | 'company_amount' | 'printer_amount', value: number) => {
    const newAlloc = { ...allocation, [field]: Math.max(0, value) };
    
    // حساب النسب من المبالغ
    const total = totalCost;
    if (total > 0) {
      newAlloc.customer_pct = Math.round((newAlloc.customer_amount / total) * 100 * 10) / 10;
      newAlloc.company_pct = Math.round((newAlloc.company_amount / total) * 100 * 10) / 10;
      newAlloc.printer_pct = Math.round((newAlloc.printer_amount / total) * 100 * 10) / 10;
    }
    
    onChange(newAlloc);
  };

  const totalPct = allocation.customer_pct + allocation.company_pct + allocation.printer_pct;
  const totalAllocated = allocation.customer_amount + allocation.company_amount + allocation.printer_amount;
  const isBalanced = allocation.mode === 'percentage' 
    ? Math.abs(totalPct - 100) < 0.1 
    : Math.abs(totalAllocated - totalCost) < 0.1;

  // التحقق التلقائي عند تغيير الإجمالي
  useEffect(() => {
    if (allocation.enabled && allocation.mode === 'percentage') {
      const newAlloc = { ...allocation };
      newAlloc.customer_amount = Math.round((newAlloc.customer_pct / 100) * totalCost * 100) / 100;
      newAlloc.company_amount = Math.round((newAlloc.company_pct / 100) * totalCost * 100) / 100;
      newAlloc.printer_amount = Math.round((newAlloc.printer_pct / 100) * totalCost * 100) / 100;
      onChange(newAlloc);
    }
  }, [totalCost]);

  // خرائط الألوان لمخطط التصميم
  const colorSchemes: Record<string, { border: string; bg: string; text: string; lightBg: string }> = {
    blue: { border: 'border-blue-200/50 dark:border-blue-800/40', bg: 'bg-blue-500/[0.02]', text: 'text-blue-500', lightBg: 'bg-blue-500/10' },
    purple: { border: 'border-purple-200/50 dark:border-purple-800/40', bg: 'bg-purple-500/[0.02]', text: 'text-purple-500', lightBg: 'bg-purple-500/10' },
    orange: { border: 'border-orange-200/50 dark:border-orange-800/40', bg: 'bg-orange-500/[0.02]', text: 'text-orange-500', lightBg: 'bg-orange-500/10' },
  };

  const currentScheme = colorSchemes[color] || colorSchemes.blue;

  return (
    <Card dir="rtl" className={cn("border rounded-2xl overflow-hidden transition-all duration-300 shadow-sm text-right", 
      allocation.enabled 
        ? `${currentScheme.border} ${currentScheme.bg} shadow-md` 
        : "opacity-65 border-border/15 bg-card/10")}>
      <CardHeader className="py-4 px-6 border-b border-border/10 bg-muted/5">
        <div className="flex items-center justify-between gap-4 text-right">
          <CardTitle className="text-sm font-semibold flex items-center gap-3.5 leading-relaxed text-right">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner", 
              allocation.enabled ? currentScheme.lightBg : 'bg-muted')}>
              {icon}
            </div>
            <span className="text-foreground">{label}</span>
            {totalCost > 0 && (
              <Badge variant="outline" className="text-xs font-semibold font-manrope bg-background/50 py-0.5 rounded-lg px-2.5 border-border/10">
                {totalCost.toLocaleString('ar-LY')} د.ل
              </Badge>
            )}
          </CardTitle>
          <Switch
            checked={allocation.enabled}
            onCheckedChange={(checked) => onChange({ ...allocation, enabled: checked })}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </CardHeader>
      
      {allocation.enabled && (
        <CardContent className="py-6 px-6 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* اختيار الوضع */}
          <div className="flex items-center justify-between flex-wrap gap-3 text-right">
            <div className="flex items-center gap-2.5">
              <Select
                value={allocation.mode}
                onValueChange={(v: 'percentage' | 'amount') => onChange({ ...allocation, mode: v })}
              >
                <SelectTrigger className="h-10 w-36 text-xs rounded-xl bg-background border-border/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">
                    <span className="flex items-center gap-1.5 text-xs"><Percent className="h-3.5 w-3.5" /> <span>نسبة مئوية %</span></span>
                  </SelectItem>
                  <SelectItem value="amount">
                    <span className="flex items-center gap-1.5 text-xs"><DollarSign className="h-3.5 w-3.5" /> <span>مبلغ مباشر</span></span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {!isBalanced && (
              <Badge variant="destructive" className="text-xs gap-1.5 rounded-lg font-bold py-1 px-3 border-none">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {allocation.mode === 'percentage' 
                    ? `المجموع ${totalPct.toFixed(0)}% ≠ 100%`
                    : `الموزع ${totalAllocated.toLocaleString()} ≠ ${totalCost.toLocaleString()}`
                  }
                </span>
              </Badge>
            )}
            {isBalanced && (
              <Badge className="text-xs bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border-none font-bold py-1 px-3 rounded-lg gap-1.5">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>توزيع متوازن</span>
              </Badge>
            )}
          </div>

          {/* حقول التوزيع */}
          <div className={cn("grid gap-4 text-right", showPrinter ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
            {/* الزبون */}
            <div className="space-y-1.5">
              <Label className="text-xs text-emerald-650 font-semibold flex items-center gap-1.5 leading-relaxed">
                <Users className="h-3.5 w-3.5 shrink-0" /> <span>الزبون يتحمل</span>
              </Label>
              {allocation.mode === 'percentage' ? (
                <NumberInputWithSuffix value={allocation.customer_pct} onChange={(value) => handlePctChange('customer_pct', value)} suffix="%" max={100} step="5" />
              ) : (
                <NumberInputWithSuffix value={allocation.customer_amount} onChange={(value) => handleAmountChange('customer_amount', value)} suffix="د.ل" />
              )}
              {allocation.mode === 'percentage' && (
                <div className="text-xs text-emerald-650 font-manrope font-semibold text-center mt-1.5 leading-relaxed">
                  {allocation.customer_amount.toLocaleString('ar-LY')} د.ل
                </div>
              )}
            </div>

            {/* الشركة */}
            <div className="space-y-1.5">
              <Label className="text-xs text-blue-600 font-semibold flex items-center gap-1.5 leading-relaxed">
                <DollarSign className="h-3.5 w-3.5 shrink-0" /> <span>الشركة تتحمل</span>
              </Label>
              {allocation.mode === 'percentage' ? (
                <NumberInputWithSuffix value={allocation.company_pct} onChange={(value) => handlePctChange('company_pct', value)} suffix="%" max={100} step="5" />
              ) : (
                <NumberInputWithSuffix value={allocation.company_amount} onChange={(value) => handleAmountChange('company_amount', value)} suffix="د.ل" />
              )}
              {allocation.mode === 'percentage' && (
                <div className="text-xs text-blue-600 font-manrope font-semibold text-center mt-1.5 leading-relaxed">
                  {allocation.company_amount.toLocaleString('ar-LY')} د.ل
                </div>
              )}
            </div>

            {/* المطبعة */}
            {showPrinter && (
              <div className="space-y-1.5">
                <Label className="text-xs text-purple-650 font-semibold flex items-center gap-1.5 leading-relaxed">
                  <Printer className="h-3.5 w-3.5 shrink-0" /> <span>المطبعة تتحمل</span>
                </Label>
                {allocation.mode === 'percentage' ? (
                  <NumberInputWithSuffix value={allocation.printer_pct} onChange={(value) => handlePctChange('printer_pct', value)} suffix="%" max={100} step="5" />
                ) : (
                  <NumberInputWithSuffix value={allocation.printer_amount} onChange={(value) => handleAmountChange('printer_amount', value)} suffix="د.ل" />
                )}
                {allocation.mode === 'percentage' && (
                  <div className="text-xs text-purple-650 font-manrope font-semibold text-center mt-1.5 leading-relaxed">
                    {allocation.printer_amount.toLocaleString('ar-LY')} د.ل
                  </div>
                )}
              </div>
            )}
          </div>

          {/* سبب التوزيع */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground/80 font-semibold leading-relaxed">سبب وخلفية التوزيع المالي</Label>
            <Input
              dir="rtl"
              value={allocation.reason}
              onChange={(e) => onChange({ ...allocation, reason: e.target.value })}
              placeholder="مثال: خصم تسوية بقرار إدارة التشغيل..."
              className="h-10 text-xs rounded-xl bg-background text-right"
            />
          </div>

          {/* تخفيض خاص بالخدمة */}
          <div className="pt-3 border-t border-border/10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
            <div className="space-y-1.5">
              <Label className="text-xs text-rose-500 font-semibold flex items-center gap-1.5 leading-relaxed">
                <DollarSign className="h-3.5 w-3.5 shrink-0" /> <span>تخفيض للزبون على الخدمة</span>
              </Label>
              <NumberInputWithSuffix value={allocation.discount} onChange={(value) => onChange({ ...allocation, discount: value })} suffix="د.ل" className="border-rose-100 text-rose-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground/80 font-semibold leading-relaxed">سبب التخفيض للخدمة</Label>
              <Input
                dir="rtl"
                value={allocation.discount_reason}
                onChange={(e) => onChange({ ...allocation, discount_reason: e.target.value })}
                className="h-10 text-xs rounded-xl bg-background text-right"
                placeholder="مثال: لوحة معطوبة، عميل دائم..."
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function CostAllocationSection({
  allocation,
  onChange,
  hasPrint,
  hasCutout,
  hasInstallation,
  originalCosts,
}: CostAllocationSectionProps) {
  const updateService = (service: 'print' | 'cutout' | 'installation', alloc: ServiceAllocation) => {
    onChange({ ...allocation, [service]: alloc });
  };

  const hasAnyEnabled = allocation.print.enabled || allocation.cutout.enabled || allocation.installation.enabled;

  return (
    <Card dir="rtl" className="border-dashed border-amber-500/25 bg-amber-500/[0.01] rounded-2xl overflow-hidden shadow-sm text-right">
      <CardHeader className="py-4.5 px-6 bg-amber-500/[0.03] border-b border-dashed border-amber-500/15">
        <CardTitle className="text-sm font-bold flex items-center gap-2.5 text-foreground leading-relaxed text-right">
          <ArrowLeftRight className="h-5 w-5 text-amber-500 shrink-0" />
          <span>توزيع التكاليف وتخفيضات الخدمات الفردية</span>
          {hasAnyEnabled && (
            <Badge className="bg-amber-500/10 text-amber-600 border-none text-xs font-semibold py-0.5 rounded-lg px-2.5 mr-2">
              توزيع مفعّل
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        {hasPrint && (
          <ServiceAllocationCard
            service="print"
            label="توزيع تكاليف الطباعة"
            icon={<Printer className="h-4.5 w-4.5 text-blue-500" />}
            color="blue"
            allocation={allocation.print}
            onChange={(a) => updateService('print', a)}
            totalCost={originalCosts.customerPrint}
            showPrinter={true}
          />
        )}

        {hasCutout && (
          <ServiceAllocationCard
            service="cutout"
            label="توزيع تكاليف القص والمجسمات"
            icon={<Scissors className="h-4.5 w-4.5 text-purple-500" />}
            color="purple"
            allocation={allocation.cutout}
            onChange={(a) => updateService('cutout', a)}
            totalCost={originalCosts.customerCutout}
            showPrinter={true}
          />
        )}

        {hasInstallation && (
          <ServiceAllocationCard
            service="installation"
            label="توزيع تكاليف التركيب واللوحات"
            icon={<Wrench className="h-4.5 w-4.5 text-orange-500" />}
            color="orange"
            allocation={allocation.installation}
            onChange={(a) => updateService('installation', a)}
            totalCost={originalCosts.customerInstallation}
            showPrinter={false}
          />
        )}
      </CardContent>
    </Card>
  );
}
