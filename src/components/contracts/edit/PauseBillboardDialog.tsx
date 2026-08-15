import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, AlertCircle, Check, X, PauseCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateBillboardPauseValue } from '@/services/billboardPauseService';
import { formatAmount } from '@/lib/formatUtils';
import { Switch } from '@/components/ui/switch';

interface PauseBillboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboard: any;
  contractNumber: number | null;
  rentStartDate: string | undefined;
  contractEndDate: string | undefined;
  billboardPrice: number;
  printCost?: number;
  installCost?: number;
  includePrint?: boolean;
  includeInstall?: boolean;
  onConfirm: (data: { pauseDate: string; notes: string; refundAmount: number; deductFromContract: boolean }) => Promise<void> | void;
}

export function PauseBillboardDialog({
  open,
  onOpenChange,
  billboard,
  contractNumber,
  rentStartDate,
  contractEndDate,
  billboardPrice,
  printCost = 0,
  installCost = 0,
  includePrint = false,
  includeInstall = false,
  onConfirm,
}: PauseBillboardDialogProps) {
  const [pauseDate, setPauseDate] = useState<Date>(() => {
    if (rentStartDate) {
      const d = new Date(rentStartDate);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const [notes, setNotes] = useState('');
  const [deductFromContract, setDeductFromContract] = useState(true);
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  // Reset state when opened — default to billboard rent start date (installation date in current contract)
  useEffect(() => {
    if (open) {
      const initial = rentStartDate ? new Date(rentStartDate) : new Date();
      setPauseDate(isNaN(initial.getTime()) ? new Date() : initial);
      setNotes('');
      setDeductFromContract(true);
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [open, rentStartDate]);

  if (!billboard || !rentStartDate || !contractEndDate) return null;

  const result = calculateBillboardPauseValue(
    pauseDate.toISOString().split('T')[0],
    rentStartDate,
    contractEndDate,
    billboardPrice,
    printCost,
    installCost,
    includePrint,
    includeInstall
  );

  const consumedPct = result.totalDays > 0
    ? Math.min(100, Math.round((result.elapsedDays / result.totalDays) * 100))
    : 0;

  const startDateObj = new Date(rentStartDate);
  const endDateObj = new Date(contractEndDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-[560px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <PauseCircle className="w-6 h-6 text-primary" />
            إيقاف لوحة من العقد
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Header alert */}
          <div className="bg-muted/60 border border-border p-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                سيتم إزالة اللوحة{' '}
                <span className="text-primary font-bold">
                  {billboard.Billboard_Name || billboard.name}
                </span>{' '}
                من العقد الحالي وإتاحتها للإيجار.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>بداية العقد: <span className="text-foreground font-semibold">{rentStartDate}</span></div>
                <div>نهاية العقد: <span className="text-foreground font-semibold">{contractEndDate}</span></div>
              </div>
            </div>
          </div>

          {/* Pause date picker */}
          <div className="space-y-2">
            <Label className="text-foreground">تاريخ الإيقاف</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-right font-normal bg-background border-border hover:bg-muted/60",
                    !pauseDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="ml-2 h-4 w-4 text-primary dark:text-white" />
                  {pauseDate ? format(pauseDate, 'yyyy-MM-dd') : <span>اختر تاريخاً</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                <Calendar
                  mode="single"
                  selected={pauseDate}
                  onSelect={(date) => date && setPauseDate(date)}
                  initialFocus
                  disabled={(d) => d < startDateObj || d > endDateObj}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">المدة المستهلكة</p>
              <p className="font-bold text-foreground" dir="ltr">
                {result.elapsedDays} / {result.totalDays} يوم
              </p>
              <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${consumedPct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1" dir="ltr">{consumedPct}%</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">القيمة الكلية للوحة (بالعقد)</p>
              <p className="font-bold text-foreground" dir="ltr">{formatAmount(result.billboardPrice)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">الإيجار المستهلك (صافي)</p>
              <p className="font-bold text-foreground" dir="ltr">{formatAmount(result.dueRent)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">الطباعة + التركيب</p>
              <p className="font-bold text-foreground" dir="ltr">
                {formatAmount(result.printShareTotal + result.installShareTotal)}
              </p>
            </div>
          </div>

          {/* Refund highlight */}
          <div className="flex justify-between items-center bg-primary/10 p-4 rounded-lg border border-primary/40">
            <div>
              <p className="text-sm font-bold text-foreground">القيمة غير المستهلكة (للاسترداد)</p>
              <p className="text-xs text-muted-foreground">
                سعر اللوحة - (الإيجار المستهلك + الطباعة والتركيب)
              </p>
            </div>
            <p className="text-2xl font-extrabold text-primary" dir="ltr">
              {formatAmount(result.unusedRefund)}
            </p>
          </div>

          {result.unusedRefund > 0 ? (
            <div className="flex items-center justify-between gap-3 bg-muted/40 border border-border p-3 rounded-lg">
              <Label htmlFor="deduct" className="cursor-pointer text-foreground">
                خصم القيمة غير المستهلكة من إجمالي العقد
              </Label>
              <Switch
                id="deduct"
                checked={deductFromContract}
                onCheckedChange={setDeductFromContract}
              />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-muted/30 border border-border p-3 rounded-lg text-center">
              لا يوجد مبلغ قابل للاسترداد
            </div>
          )}

          <div className="space-y-2 pt-1">
            <Label className="text-foreground">ملاحظات (اختياري)</Label>
            <Textarea
              placeholder="سبب الإيقاف..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none bg-background border-border"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            <X className="w-4 h-4 ml-1" />
            إلغاء
          </Button>
          <Button
            disabled={loading}
            onClick={async () => {
              if (isSubmittingRef.current) return;
              isSubmittingRef.current = true;
              setLoading(true);
              try {
                await onConfirm({
                  pauseDate: format(pauseDate, 'yyyy-MM-dd'),
                  notes,
                  refundAmount: result.unusedRefund,
                  deductFromContract
                });
              } catch (err) {
                isSubmittingRef.current = false;
                setLoading(false);
              }
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                جاري الإيقاف...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 ml-1" />
                تأكيد الإيقاف
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
