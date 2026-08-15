import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Calculator, Plus as PlusIcon, Trash2, Info, Pen, CheckCircle2, AlertCircle, Sparkles, Check, ChevronsUpDown, CalendarIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { UnequalDistributionManager } from './UnequalDistributionManager';
import { cn } from '@/lib/utils';
import { format, parse } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// أنواع مواعيد الدفع الافتراضية
const DEFAULT_PAYMENT_TYPES = [
  '', // خيار فارغ افتراضي
  'عند التوقيع',
  'عند التركيب',
  'بعد 20% من العقد',
  'شهري',
  'مقدم',
  'ربع سنوي',
  'نصف سنوي',
  'نهاية العقد',
];

// ✅ تقريب للأسفل لأقرب رقم مغلق
const roundToCleanValue = (value: number): number => {
  if (value <= 0) return 0;
  if (value < 100) return Math.floor(value);
  if (value < 1000) return Math.floor(value / 10) * 10;
  if (value < 10000) return Math.floor(value / 100) * 100;
  return Math.floor(value / 500) * 500;
};

// ✅ تقريب للأعلى لأقرب رقم مغلق
const roundUpToCleanValue = (value: number): number => {
  if (value <= 0) return 0;
  if (value < 100) return Math.ceil(value);
  if (value < 1000) return Math.ceil(value / 10) * 10;
  if (value < 10000) return Math.ceil(value / 100) * 100;
  return Math.ceil(value / 500) * 500;
};

interface Installment {
  amount: number;
  paymentType: string;
  description: string;
  dueDate: string;
}

export interface UnequalPayment {
  amount: number;
  dueDate: string;
  description: string;
  paymentType: string;
}

interface InstallmentsManagerProps {
  installments: Installment[];
  finalTotal: number;
  startDate: string;
  /**
   * When true, prevents the component from re-distributing installments automatically
   * when the total changes (e.g., when installments are loaded from DB).
   */
  disableAutoRedistribute?: boolean;
  onDistributeEvenly: (count: number) => void;
  onDistributeWithInterval?: (config: {
    firstPayment: number;
    firstPaymentType: 'amount' | 'percent';
    interval: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months';
    numPayments?: number;
    lastPaymentDate?: string;
    firstPaymentDate?: string;
    firstAtSigning?: boolean;
  }) => void;
  onCreateManualInstallments?: (count: number) => void;
  onApplyUnequalDistribution?: (payments: UnequalPayment[]) => void;
  onAddInstallment: () => void;
  onRemoveInstallment: (index: number) => void;
  onUpdateInstallment: (index: number, field: string, value: any) => void;
  onClearAll: () => void;
  installmentSummary?: string | null;
  endDate?: string;
  savedDistributionType?: 'single' | 'multiple' | 'periods';
  savedFirstPaymentAmount?: number;
  savedFirstPaymentType?: 'amount' | 'percent';
  savedInterval?: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months';
  savedCount?: number;
  savedHasDifferentFirstPayment?: boolean;
  savedFirstAtSigning?: boolean;
  onDistributionTypeChange?: (type: 'single' | 'multiple' | 'periods') => void;
  onFirstPaymentAmountChange?: (amount: number) => void;
  onFirstPaymentTypeChange?: (type: 'amount' | 'percent') => void;
  onIntervalChange?: (interval: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months') => void;
  onCountChange?: (count: number) => void;
  onHasDifferentFirstPaymentChange?: (has: boolean) => void;
  onFirstAtSigningChange?: (value: boolean) => void;
  onDistributeByDurationPeriods?: (count: number) => void;
}

export function InstallmentsManager({
  installments,
  finalTotal,
  startDate,
  endDate,
  disableAutoRedistribute,
  onDistributeEvenly,
  onDistributeWithInterval,
  onCreateManualInstallments,
  onApplyUnequalDistribution,
  onAddInstallment,
  onRemoveInstallment,
  onUpdateInstallment,
  onClearAll,
  installmentSummary,
  savedDistributionType,
  savedFirstPaymentAmount,
  savedFirstPaymentType,
  savedInterval,
  savedCount,
  savedHasDifferentFirstPayment,
  savedFirstAtSigning,
  onDistributionTypeChange,
  onFirstPaymentAmountChange,
  onFirstPaymentTypeChange,
  onIntervalChange,
  onCountChange,
  onHasDifferentFirstPaymentChange,
  onFirstAtSigningChange,
  onDistributeByDurationPeriods
}: InstallmentsManagerProps) {
  const [hasDifferentFirstPayment, setHasDifferentFirstPayment] = React.useState<boolean>(savedHasDifferentFirstPayment ?? false);
  const [firstPayment, setFirstPayment] = React.useState<number>(savedFirstPaymentAmount ?? 0);
  const [firstPaymentType, setFirstPaymentType] = React.useState<'amount' | 'percent'>(savedFirstPaymentType ?? 'amount');
  const [firstPaymentDate, setFirstPaymentDate] = React.useState<string>('');
  const [useCustomFirstDate, setUseCustomFirstDate] = React.useState(false);

  const [paymentMode, setPaymentMode] = React.useState<'single' | 'multiple' | 'periods'>(savedDistributionType ?? 'multiple');
  const [periodsCount, setPeriodsCount] = React.useState<string>('3');
  const [interval, setInterval] = React.useState<'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months'>(savedInterval ?? 'month');
  const [numPayments, setNumPayments] = React.useState<number>(savedCount ?? 2);
  const [useCustomLastDate, setUseCustomLastDate] = React.useState(false);
  const [firstAtSigning, setFirstAtSigning] = React.useState<boolean>(savedFirstAtSigning ?? true);
  const [lastPaymentDate, setLastPaymentDate] = React.useState<string>('');

  const [unequalDistributionOpen, setUnequalDistributionOpen] = React.useState(false);
  const [unequalCount, setUnequalCount] = React.useState<number>(2);
  
  // أنواع مواعيد الدفع المخصصة (يتم جمعها من الدفعات الحالية)
  const [customPaymentTypes, setCustomPaymentTypes] = React.useState<string[]>([]);
  const [openPaymentTypeIndex, setOpenPaymentTypeIndex] = React.useState<number | null>(null);
  
  // جمع كل أنواع مواعيد الدفع المتاحة
  const allPaymentTypes = React.useMemo(() => {
    const fromInstallments = installments.map(i => i.paymentType).filter(Boolean);
    const combined = [...DEFAULT_PAYMENT_TYPES, ...customPaymentTypes, ...fromInstallments];
    return [...new Set(combined)];
  }, [installments, customPaymentTypes]);

  const prevFinalTotalRef = React.useRef<number>(finalTotal);
  const isInitialMount = React.useRef(true);

  // Sync state with parent
  React.useEffect(() => {
    if (savedHasDifferentFirstPayment !== undefined) setHasDifferentFirstPayment(savedHasDifferentFirstPayment);
  }, [savedHasDifferentFirstPayment]);
  
  React.useEffect(() => {
    if (savedFirstPaymentAmount !== undefined) setFirstPayment(savedFirstPaymentAmount);
  }, [savedFirstPaymentAmount]);
  
  React.useEffect(() => {
    if (savedFirstPaymentType !== undefined) setFirstPaymentType(savedFirstPaymentType);
  }, [savedFirstPaymentType]);
  
  React.useEffect(() => {
    if (savedDistributionType !== undefined) setPaymentMode(savedDistributionType);
  }, [savedDistributionType]);
  
  React.useEffect(() => {
    if (savedInterval !== undefined) setInterval(savedInterval);
  }, [savedInterval]);
  
  React.useEffect(() => {
    if (savedCount !== undefined) setNumPayments(savedCount);
  }, [savedCount]);

  // Auto-redistribute when finalTotal changes
  React.useEffect(() => {
    if (disableAutoRedistribute) {
      prevFinalTotalRef.current = finalTotal;
      return;
    }

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevFinalTotalRef.current = finalTotal;
      return;
    }

    const prevTotal = prevFinalTotalRef.current;
    const difference = Math.abs(finalTotal - prevTotal);
    
    if (difference > 1 && installments.length > 0 && startDate && onDistributeWithInterval) {
      onDistributeWithInterval({
        firstPayment: hasDifferentFirstPayment ? firstPayment : 0,
        firstPaymentType,
        interval,
        numPayments: useCustomLastDate ? undefined : numPayments,
        lastPaymentDate: useCustomLastDate && lastPaymentDate ? lastPaymentDate : undefined,
        firstPaymentDate: useCustomFirstDate && firstPaymentDate ? firstPaymentDate : undefined
      });
    }
    
    prevFinalTotalRef.current = finalTotal;
  }, [finalTotal, disableAutoRedistribute]);

  // Handlers
  const handleHasDifferentFirstPaymentChange = (value: boolean) => {
    setHasDifferentFirstPayment(value);
    onHasDifferentFirstPaymentChange?.(value);
  };

  const handleFirstPaymentChange = (value: number) => {
    setFirstPayment(value);
    onFirstPaymentAmountChange?.(value);
  };

  const handleFirstPaymentTypeChange = (value: 'amount' | 'percent') => {
    setFirstPaymentType(value);
    onFirstPaymentTypeChange?.(value);
  };

  const handlePaymentModeChange = (value: 'single' | 'multiple') => {
    setPaymentMode(value);
    onDistributionTypeChange?.(value);
  };

  const handleIntervalChange = (value: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months') => {
    setInterval(value);
    onIntervalChange?.(value);
  };

  const handleNumPaymentsChange = (value: number) => {
    setNumPayments(value);
    onCountChange?.(value);
  };

  const handleFirstAtSigningChange = (value: boolean) => {
    setFirstAtSigning(value);
    onFirstAtSigningChange?.(value);
  };

  // إعادة توزيع الدفعات المتبقية بعد حذف دفعة
  const handleRemoveAndRedistribute = (index: number) => {
    const remainingInstallments = installments.filter((_, i) => i !== index);
    
    // إذا تبقت دفعات، أعد توزيع المبلغ عليها
    if (remainingInstallments.length > 0) {
      const totalRemaining = remainingInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
      const diff = finalTotal - totalRemaining;
      
      // إذا كان هناك فرق كبير، وزع الفرق على الدفعات المتبقية
      if (Math.abs(diff) > 1 && remainingInstallments.length > 0) {
        const addPerInstallment = Math.round(diff / remainingInstallments.length);
        remainingInstallments.forEach((inst, i) => {
          if (i === remainingInstallments.length - 1) {
            // آخر دفعة تأخذ الباقي لتجنب أخطاء التقريب
            const currentTotal = remainingInstallments.slice(0, -1).reduce((sum, x) => sum + (x.amount || 0), 0);
            inst.amount = finalTotal - currentTotal;
          } else {
            inst.amount = (inst.amount || 0) + addPerInstallment;
          }
        });
        
        // تحديث الدفعات من خلال onUpdateInstallment
        remainingInstallments.forEach((inst, i) => {
          onUpdateInstallment(i > index ? i - 1 : i, 'amount', inst.amount);
        });
      }
    }
    
    onRemoveInstallment(index);
  };

  const totalInstallments = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
  const difference = finalTotal - totalInstallments;
  const isBalanced = Math.abs(difference) < 1;

  const actualFirstPayment = React.useMemo(() => {
    if (!hasDifferentFirstPayment) return 0;
    if (firstPaymentType === 'percent') {
      return Math.round((finalTotal * Math.min(100, Math.max(0, firstPayment)) / 100) * 100) / 100;
    }
    return firstPayment;
  }, [hasDifferentFirstPayment, firstPayment, firstPaymentType, finalTotal]);

  const remainingAfterFirst = finalTotal - actualFirstPayment;

  const intervalMonths = React.useMemo(() => {
    switch (interval) {
      case 'month': return 1;
      case '2months': return 2;
      case '3months': return 3;
      case '4months': return 4;
      case '5months': return 5;
      case '6months': return 6;
      case '7months': return 7;
      default: return 1;
    }
  }, [interval]);

  const intervalLabel = React.useMemo(() => {
    switch (interval) {
      case 'month': return 'شهر';
      case '2months': return 'شهرين';
      case '3months': return '3 أشهر';
      case '4months': return '4 أشهر';
      case '5months': return '5 أشهر';
      case '6months': return '6 أشهر';
      case '7months': return '7 أشهر';
      default: return 'شهر';
    }
  }, [interval]);

  const handleDistribute = () => {
    if (!onDistributeWithInterval || !startDate) return;

    if (paymentMode === 'single') {
      // وضع الدفعة الواحدة
      if (hasDifferentFirstPayment && actualFirstPayment > 0) {
        // دفعة أولى مختلفة + دفعة واحدة متبقية
        onDistributeWithInterval({
          firstPayment: firstPayment,
          firstPaymentType,
          interval,
          numPayments: 1,
          firstPaymentDate: useCustomFirstDate && firstPaymentDate ? firstPaymentDate : undefined,
          firstAtSigning
        });
      } else {
        // دفعة واحدة بكامل المبلغ
        onDistributeWithInterval({
          firstPayment: 0,
          firstPaymentType,
          interval,
          numPayments: 1,
          firstPaymentDate: useCustomFirstDate && firstPaymentDate ? firstPaymentDate : undefined,
          firstAtSigning
        });
      }
    } else {
      // وضع الدفعات المتعددة
      onDistributeWithInterval({
        firstPayment: hasDifferentFirstPayment ? firstPayment : 0,
        firstPaymentType,
        interval,
        numPayments: useCustomLastDate ? undefined : numPayments,
        lastPaymentDate: useCustomLastDate && lastPaymentDate ? lastPaymentDate : undefined,
        firstPaymentDate: useCustomFirstDate && firstPaymentDate ? firstPaymentDate : undefined,
        firstAtSigning
      });
    }
  };

  // Quick two-payment mode (first + remainder)
  const handleTwoPaymentMode = () => {
    if (!onDistributeWithInterval || !startDate || actualFirstPayment <= 0) return;
    
    onDistributeWithInterval({
      firstPayment: actualFirstPayment,
      firstPaymentType,
      interval: 'month',
      numPayments: 1, // Only 1 remaining payment
      firstPaymentDate: useCustomFirstDate && firstPaymentDate ? firstPaymentDate : undefined,
      firstAtSigning
    });
  };

  const applyTemplate403030 = () => {
    if (finalTotal <= 0) {
      toast.info('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 60 * 24 * 60 * 60 * 1000);
    const totalDuration = end.getTime() - start.getTime();

    // ✅ 40% - 30% - 30% بأرقام مغلقة مع ترحيل الفرق للأمام (تقريب للأعلى)
    let remaining = finalTotal;
    const p1Amount = roundUpToCleanValue(remaining * 0.40);
    remaining -= p1Amount;
    const p2Amount = roundUpToCleanValue(remaining / 2);
    remaining -= p2Amount;
    const p3Amount = Math.round(remaining * 100) / 100; // المتبقي بالضبط

    const p1DateStr = start.toISOString().split('T')[0];
    const p2DateStr = new Date(start.getTime() + totalDuration * 0.40).toISOString().split('T')[0];
    const p3DateStr = new Date(start.getTime() + totalDuration * 0.70).toISOString().split('T')[0];

    const payments = [
      {
        amount: p1Amount,
        paymentType: 'عند التوقيع',
        description: 'دفعة أولى عند التوقيع (40%)',
        dueDate: p1DateStr
      },
      {
        amount: p2Amount,
        paymentType: 'شهري',
        description: 'دفعة ثانية (30%)',
        dueDate: p2DateStr
      },
      {
        amount: p3Amount,
        paymentType: 'شهري',
        description: 'دفعة ثالثة (30%)',
        dueDate: p3DateStr
      }
    ];

    if (onApplyUnequalDistribution) {
      onApplyUnequalDistribution(payments);
    } else {
      toast.error('ميزة التوزيع غير متوفرة في هذه الصفحة حالياً');
    }
  };

  const applyTemplate5050 = () => {
    if (finalTotal <= 0) {
      toast.info('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const totalDuration = end.getTime() - start.getTime();
    
    // ✅ 50% - 50% بأرقام مغلقة مع ترحيل الفرق للدفعة الثانية (تقريب للأعلى)
    const p1Amount = roundUpToCleanValue(finalTotal / 2);
    const p2Amount = Math.round((finalTotal - p1Amount) * 100) / 100;

    const p1DateStr = start.toISOString().split('T')[0];
    const p2DateStr = new Date(start.getTime() + totalDuration * 0.50).toISOString().split('T')[0];

    const payments = [
      {
        amount: p1Amount,
        paymentType: 'عند التوقيع',
        description: 'دفعة أولى عند التوقيع (50%)',
        dueDate: p1DateStr
      },
      {
        amount: p2Amount,
        paymentType: 'نهاية العقد',
        description: 'دفعة ثانية (50%)',
        dueDate: p2DateStr
      }
    ];

    if (onApplyUnequalDistribution) {
      onApplyUnequalDistribution(payments);
    } else {
      toast.error('ميزة التوزيع غير متوفرة في هذه الصفحة حالياً');
    }
  };

  const applyTemplate333333 = () => {
    if (finalTotal <= 0) {
      toast.info('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
    const totalDuration = end.getTime() - start.getTime();

    // ✅ 33.33% لكل فترة بأرقام مغلقة مع ترحيل الفرق للأمام (تقريب للأعلى)
    let remaining = finalTotal;
    const p1Amount = roundUpToCleanValue(remaining / 3);
    remaining -= p1Amount;
    const p2Amount = roundUpToCleanValue(remaining / 2);
    remaining -= p2Amount;
    const p3Amount = Math.round(remaining * 100) / 100; // المتبقي بالضبط

    const p1DateStr = start.toISOString().split('T')[0];
    const p2DateStr = new Date(start.getTime() + totalDuration * 0.3333).toISOString().split('T')[0];
    const p3DateStr = new Date(start.getTime() + totalDuration * 0.6666).toISOString().split('T')[0];

    const payments = [
      {
        amount: p1Amount,
        paymentType: 'عند التوقيع',
        description: 'دفعة أولى (33.33%)',
        dueDate: p1DateStr
      },
      {
        amount: p2Amount,
        paymentType: 'شهري',
        description: 'دفعة ثانية (33.33%)',
        dueDate: p2DateStr
      },
      {
        amount: p3Amount,
        paymentType: 'شهري',
        description: 'دفعة ثالثة (33.34%)',
        dueDate: p3DateStr
      }
    ];

    if (onApplyUnequalDistribution) {
      onApplyUnequalDistribution(payments);
    } else {
      toast.error('ميزة التوزيع غير متوفرة في هذه الصفحة حالياً');
    }
  };

  const handleApplyPeriods = () => {
    if (periodsCount === '40-30-30') {
      applyTemplate403030();
    } else if (periodsCount === '50-50') {
      applyTemplate5050();
    } else if (periodsCount === '33-33-33') {
      applyTemplate333333();
    } else {
      onDistributeByDurationPeriods?.(Number(periodsCount) || 3);
    }
  };


  return (
    <Card className="bg-card border-border shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 rounded-lg bg-primary/20">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <span>نظام الدفعات</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        
        {/* التوزيع الذكي */}
        {onDistributeWithInterval && (
          <div className="space-y-4 animate-in fade-in duration-300">
            
            {/* نوع التوزيع */}
            <div className="space-y-3">
              <Label className="text-sm font-bold">طريقة السداد</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handlePaymentModeChange('single')}
                  className={cn(
                    "p-2.5 rounded-xl border-2 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[90px]",
                    paymentMode === 'single' 
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <DollarSign className="h-5 w-5 mb-1 text-primary" />
                  <div className="text-[11px] font-bold">دفعة واحدة</div>
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentModeChange('multiple')}
                  className={cn(
                    "p-2.5 rounded-xl border-2 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[90px]",
                    paymentMode === 'multiple' 
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Calculator className="h-5 w-5 mb-1 text-primary" />
                  <div className="text-[11px] font-bold">تقسيط شهري</div>
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentModeChange('periods')}
                  className={cn(
                    "p-2.5 rounded-xl border-2 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[90px]",
                    paymentMode === 'periods' 
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Sparkles className="h-5 w-5 mb-1 text-primary" />
                  <div className="text-[11px] font-bold">تقسيم مدة العقد</div>
                </button>
              </div>
            </div>

            {/* قوالب التوزيع الجاهزة */}
            <div className="space-y-2 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <Label className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                قوالب التوزيع الخاصة (دفعة أولى وتوزيع المدد)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyTemplate403030}
                  className="text-xs font-bold border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-800 dark:hover:text-amber-200 cursor-pointer h-9 bg-background/50"
                  disabled={!startDate}
                >
                  40% / 30% / 30% (3 أقساط)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyTemplate5050}
                  className="text-xs font-bold border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-800 dark:hover:text-amber-200 cursor-pointer h-9 bg-background/50"
                  disabled={!startDate}
                >
                  50% / 50% (قسطين)
                </Button>
              </div>
              <p className="text-[10px] text-amber-600/80 leading-normal text-right">
                * يتم توزيع النسب على قيمة العقد، وتقسيم فترات الدفعات بالتساوي على مدار مدة العقد.
              </p>
            </div>

            {/* إعدادات وطرق السداد بناءً على الاختيار */}
            {paymentMode === 'single' && (
              <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>سيتم سداد كامل قيمة العقد دفعة واحدة.</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  سيتم إنشاء دفعة واحدة بكامل قيمة العقد بقيمة <span className="font-bold text-foreground font-manrope">{(finalTotal || 0).toLocaleString('ar-LY')} د.ل</span> تستحق افتراضياً عند بداية العقد.
                </p>

                <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40">
                  <Label className="text-xs font-semibold cursor-pointer">تاريخ استحقاق مخصص</Label>
                  <Switch checked={useCustomFirstDate} onCheckedChange={setUseCustomFirstDate} />
                </div>

                {useCustomFirstDate && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                    <Label className="text-xs text-muted-foreground">تاريخ الاستحقاق</Label>
                    <Input
                      type="date"
                      value={firstPaymentDate}
                      onChange={(e) => setFirstPaymentDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleDistribute}
                  className="w-full h-11 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-transform hover:scale-[1.01]"
                  disabled={!startDate}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  تطبيق دفعة واحدة
                </Button>
              </div>
            )}

            {paymentMode === 'multiple' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* الدفعة الأولى الاختيارية */}
                <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-bold">دفعة أولى مختلفة</Label>
                    </div>
                    <Switch
                      checked={hasDifferentFirstPayment}
                      onCheckedChange={handleHasDifferentFirstPaymentChange}
                    />
                  </div>

                  {hasDifferentFirstPayment && (
                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">القيمة</Label>
                          <Input
                            type="number"
                            min={0}
                            max={firstPaymentType === 'percent' ? 100 : finalTotal}
                            value={firstPayment}
                            onChange={(e) => handleFirstPaymentChange(Number(e.target.value) || 0)}
                            placeholder={firstPaymentType === 'percent' ? '%' : 'د.ل'}
                            className="h-10 font-bold text-base"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">النوع</Label>
                          <Select value={firstPaymentType} onValueChange={(v: any) => handleFirstPaymentTypeChange(v)}>
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[10000]">
                              <SelectItem value="amount">مبلغ ثابت</SelectItem>
                              <SelectItem value="percent">نسبة %</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* عرض القيمة المحسوبة */}
                      {actualFirstPayment > 0 && actualFirstPayment <= finalTotal && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <div className="space-y-0.5 text-right">
                            <p className="text-xs text-muted-foreground">الدفعة الأولى</p>
                            <p className="text-lg font-bold text-primary font-manrope">{actualFirstPayment.toLocaleString('ar-LY')} د.ل</p>
                          </div>
                          <div className="text-left space-y-0.5">
                            <p className="text-xs text-muted-foreground">المتبقي للأقساط</p>
                            <p className="text-lg font-bold text-foreground font-manrope">{remainingAfterFirst.toLocaleString('ar-LY')} د.ل</p>
                          </div>
                        </div>
                      )}

                      {/* تاريخ الدفعة الأولى */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40">
                        <Label className="text-xs font-semibold cursor-pointer">تاريخ مخصص للدفعة الأولى</Label>
                        <Switch checked={useCustomFirstDate} onCheckedChange={setUseCustomFirstDate} />
                      </div>

                      {useCustomFirstDate && (
                        <Input
                          type="date"
                          value={firstPaymentDate}
                          onChange={(e) => setFirstPaymentDate(e.target.value)}
                          className="h-10"
                        />
                      )}
                      
                      {/* زر سريع: دفعتان فقط */}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTwoPaymentMode}
                        className="w-full border-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10 font-bold"
                        disabled={actualFirstPayment <= 0 || !startDate}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        دفعتان فقط (الأولى + الباقي)
                      </Button>
                    </div>
                  )}
                </div>

                {/* إعدادات الأقساط */}
                <div className="space-y-3 p-4 rounded-xl bg-card border border-border shadow-sm">
                  {/* دفعة عند التوقيع */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">دفعة عند التوقيع</Label>
                    </div>
                    <Switch
                      checked={firstAtSigning}
                      onCheckedChange={handleFirstAtSigningChange}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">الفترة بين الدفعات</Label>
                      <Select value={interval} onValueChange={(v: any) => handleIntervalChange(v)}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[10000]">
                          <SelectItem value="month">كل شهر</SelectItem>
                          <SelectItem value="2months">كل شهرين</SelectItem>
                          <SelectItem value="3months">كل 3 أشهر</SelectItem>
                          <SelectItem value="4months">كل 4 أشهر</SelectItem>
                          <SelectItem value="5months">كل 5 أشهر</SelectItem>
                          <SelectItem value="6months">كل 6 أشهر</SelectItem>
                          <SelectItem value="7months">كل 7 أشهر</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{hasDifferentFirstPayment ? 'عدد الدفعات المتبقية' : 'عدد الدفعات'}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={numPayments}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1 && val <= 24) {
                            handleNumPaymentsChange(val);
                          }
                        }}
                        className="h-10 font-bold text-center"
                        placeholder="2"
                      />
                    </div>
                  </div>
                </div>

                {/* زر التطبيق الرئيسي للأقساط */}
                <Button
                  type="button"
                  onClick={handleDistribute}
                  className="w-full h-11 text-sm font-bold bg-primary hover:bg-primary/95 text-primary-foreground shadow-md transition-transform hover:scale-[1.01]"
                  disabled={!startDate}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  توزيع الأقساط تلقائياً
                </Button>
              </div>
            )}

            {paymentMode === 'periods' && (
              <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>تقسيم مدة العقد الإجمالية إلى فترات متساوية.</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تستحق الدفعات عند بداية كل فترة (آخر دفعة تكون قبل نهاية العقد بفترة كاملة، وليس في نهاية العقد). يعتمد على نسبة مئوية دقيقة من مدة العقد.
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">عدد فترات التقسيم</Label>
                  <Select 
                    value={periodsCount} 
                    onValueChange={(v) => setPeriodsCount(v)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="40-30-30">نظام 40% - 30% - 30% (3 أقساط)</SelectItem>
                      <SelectItem value="50-50">نظام 50% - 50% (قسطين)</SelectItem>
                      <SelectItem value="33-33-33">نظام 33.33% لكل الفترات (3 أقساط)</SelectItem>
                      <SelectItem value="2">فترتين متساويتين (50% عند التوقيع و 50% بمنتصف العقد)</SelectItem>
                      <SelectItem value="3">3 فترات متساوية (33.33% لكل فترة)</SelectItem>
                      <SelectItem value="4">4 فترات متساوية (كل ربع من مدة العقد)</SelectItem>
                      <SelectItem value="5">5 فترات من مدة العقد</SelectItem>
                      <SelectItem value="6">6 فترات من مدة العقد</SelectItem>
                      <SelectItem value="7">7 فترات من مدة العقد</SelectItem>
                      <SelectItem value="8">8 فترات من مدة العقد</SelectItem>
                      <SelectItem value="9">9 فترات من مدة العقد</SelectItem>
                      <SelectItem value="10">10 فترات من مدة العقد</SelectItem>
                      <SelectItem value="11">11 فترة من مدة العقد</SelectItem>
                      <SelectItem value="12">12 فترة من مدة العقد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  onClick={handleApplyPeriods}
                  className="w-full h-11 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-transform hover:scale-[1.01]"
                  disabled={!startDate || !endDate}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  تطبيق تقسيم المدة
                </Button>
              </div>
            )}
            
            {!startDate && (
              <p className="text-xs text-destructive text-center flex items-center justify-center gap-1 bg-destructive/10 p-2 rounded-lg border border-destructive/20 animate-pulse">
                <AlertCircle className="h-4 w-4" />
                يرجى تحديد تاريخ بداية العقد أولاً لتفعيل التوزيع
              </p>
            )}
          </div>
        )}

        {/* الأدوات السريعة */}
        <div className="pt-3 border-t border-border space-y-3">
          <Label className="text-xs text-muted-foreground">أدوات سريعة</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onAddInstallment}
              size="sm"
              className="text-xs"
            >
              <PlusIcon className="h-3 w-3 mr-1" />
              إضافة دفعة
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUnequalCount(3);
                setUnequalDistributionOpen(true);
              }}
              size="sm"
              className="text-xs border-purple-500/50 text-purple-600 hover:bg-purple-500/10"
            >
              <Pen className="h-3 w-3 mr-1" />
              توزيع يدوي
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClearAll}
              size="sm"
              className="text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              مسح الكل
            </Button>
          </div>
        </div>

        {/* Unequal Distribution Dialog */}
        {onApplyUnequalDistribution && (
          <UnequalDistributionManager
            open={unequalDistributionOpen}
            onOpenChange={setUnequalDistributionOpen}
            finalTotal={finalTotal}
            startDate={startDate}
            count={unequalCount}
            onApply={(payments) => {
              onApplyUnequalDistribution(payments);
              setUnequalDistributionOpen(false);
            }}
          />
        )}

        {/* قائمة الدفعات */}
        {installments.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-border">
            <Label className="text-sm font-bold flex items-center gap-2">
              <Info className="h-4 w-4" /> الدفعات ({installments.length})
            </Label>
            
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {installments.map((installment, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all",
                    index === 0 
                      ? "bg-primary/5 border-primary/30" 
                      : "bg-card border-border hover:border-primary/20"
                  )}
                >
                  <div className="flex flex-col gap-3">
                    {/* الصف الأول: رقم الدفعة والمبلغ وزر الحذف */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                          index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">المبلغ</span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              value={installment.amount}
                              onChange={(e) => onUpdateInstallment(index, 'amount', parseFloat(e.target.value) || 0)}
                              className="w-32 h-8 text-sm font-bold"
                            />
                            <span className="text-xs text-muted-foreground">د.ل</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAndRedistribute(index)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        title="حذف الدفعة وإعادة توزيع المبلغ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* الصف الثاني: نوع الدفعة وتاريخ الاستحقاق */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">موعد الدفع</span>
                        <Popover 
                          open={openPaymentTypeIndex === index} 
                          onOpenChange={(open) => setOpenPaymentTypeIndex(open ? index : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openPaymentTypeIndex === index}
                              className="h-9 justify-between font-normal"
                            >
                              {installment.paymentType || "غير محدد"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[200px] p-0 z-[10000]" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="ابحث أو اكتب موعد جديد..." 
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const input = (e.target as HTMLInputElement).value.trim();
                                    if (input && !allPaymentTypes.includes(input)) {
                                      setCustomPaymentTypes(prev => [...prev, input]);
                                    }
                                    if (input) {
                                      onUpdateInstallment(index, 'paymentType', input);
                                      setOpenPaymentTypeIndex(null);
                                    }
                                  }
                                }}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  <div className="text-sm text-muted-foreground p-2">
                                    اضغط Enter لإضافة موعد جديد
                                  </div>
                                </CommandEmpty>
                                <CommandGroup>
                                  {allPaymentTypes.map((type) => (
                                    <CommandItem
                                      key={type || 'empty'}
                                      value={type || 'غير محدد'}
                                      onSelect={() => {
                                        onUpdateInstallment(index, 'paymentType', type);
                                        setOpenPaymentTypeIndex(null);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          installment.paymentType === type ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {type || 'غير محدد'}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">تاريخ الاستحقاق</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "h-9 w-full justify-start text-right font-normal",
                                !installment.dueDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="ml-2 h-4 w-4 text-muted-foreground dark:text-white" />
                              {installment.dueDate
                                ? format(new Date(installment.dueDate), 'yyyy/MM/dd', { locale: ar })
                                : 'اختر التاريخ'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={installment.dueDate ? new Date(installment.dueDate) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  onUpdateInstallment(index, 'dueDate', date.toISOString().split('T')[0]);
                                }
                              }}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    
                    {/* الصف الثالث: الوصف */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">وصف الدفعة (اختياري)</span>
                      <Input
                        type="text"
                        value={installment.description}
                        onChange={(e) => onUpdateInstallment(index, 'description', e.target.value)}
                        placeholder={index === 0 ? 'مثال: دفعة مقدمة' : `مثال: القسط ${index + 1}`}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* الملخص */}
        <div className={cn(
          "p-4 rounded-xl border-2 space-y-2",
          isBalanced 
            ? "bg-green-500/5 border-green-500/30" 
            : "bg-amber-500/5 border-amber-500/30"
        )}>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">إجمالي العقد</span>
            <span className="font-bold text-lg font-manrope">{finalTotal.toLocaleString('ar-LY')} د.ل</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">مجموع الدفعات</span>
            <span className="font-bold text-lg font-manrope">{totalInstallments.toLocaleString('ar-LY')} د.ل</span>
          </div>
          <div className="border-t border-border/50 pt-2 flex justify-between items-center">
            <span className="text-sm font-medium">الفرق</span>
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <span className={cn(
                "font-bold text-lg font-manrope",
                isBalanced ? "text-green-500" : "text-amber-500"
              )}>
                {difference.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          </div>
          
          {!isBalanced && installments.length > 0 && (
            <div className="space-y-2 mt-2">
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>تحذير: لن يتم حفظ العقد حتى تتساوى الدفعات مع الإجمالي!</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDistribute}
                className="w-full border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
              >
                <Calculator className="h-4 w-4 mr-2" />
                إعادة التوزيع تلقائياً
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
