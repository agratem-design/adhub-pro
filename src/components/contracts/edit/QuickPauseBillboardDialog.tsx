// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PauseCircle, Calendar, Clock, DollarSign, AlertCircle, Loader2 } from 'lucide-react';
import { calculateRemainingBillboardValue } from '@/utils/contractBillboardCalculations';
import { executeQuickPause } from '@/services/contractBillboardSwapService';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  billboard: any;
  contractNumber: number;
  contractStartDate: string;
  contractEndDate: string;
  contractedPrice?: number;
  onPaused?: (result: { pauseRefund: number; newBillboardIds: string[] }) => void;
}

export function QuickPauseBillboardDialog({
  open,
  onOpenChange,
  billboard,
  contractNumber,
  contractStartDate,
  contractEndDate,
  contractedPrice,
  onPaused,
}: Props) {
  const todayStr = new Date().toISOString().split('T')[0];
  const initialPauseDate = (todayStr >= contractStartDate && todayStr <= contractEndDate)
    ? todayStr
    : contractStartDate || todayStr;

  const [pauseDate, setPauseDate] = useState(initialPauseDate);
  const [notes, setNotes] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const effectivePrice = Number(contractedPrice || billboard?.Price || 0);

  const remainingCalc = useMemo(() => {
    return calculateRemainingBillboardValue({
      startDate: contractStartDate,
      endDate: contractEndDate,
      effectiveDate: pauseDate,
      contractedPrice: effectivePrice,
    });
  }, [contractStartDate, contractEndDate, pauseDate, effectivePrice]);

  const handleExecute = async () => {
    if (!billboard) return;

    setIsExecuting(true);
    try {
      const result = await executeQuickPause({
        contractNumber,
        billboardId: Number(billboard.ID),
        pauseDate,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast.success(`تم إيقاف اللوحة #${billboard.ID} بنجاح وخصم المسترجع (${result.pauseRefund.toLocaleString('ar-LY')} د.ل) من العقد`);
        onOpenChange(false);
        if (onPaused) {
          onPaused(result);
        }
      } else {
        toast.error(result.error || 'تعذر إيقاف اللوحة');
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background border-border" dir="rtl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">إيقاف اللوحة (بدون بديل)</DialogTitle>
              <p className="text-xs text-muted-foreground">
                سيتم تحرير اللوحة لتصبح متاحة وخصم قيمة الأيام المتبقية من العقد
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Billboard Info Card */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-foreground">{billboard?.Billboard_Name || `#${billboard?.ID}`}</span>
              <Badge variant="outline" className="text-[11px]">{billboard?.Size} • {billboard?.City}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 text-muted-foreground">
              <div>السعر الإجمالي: <strong className="text-foreground">{effectivePrice.toLocaleString('ar-LY')} د.ل</strong></div>
              <div>الأيام المتبقية: <strong className="text-foreground">{remainingCalc.remainingDays} يوم</strong></div>
            </div>
          </div>

          {/* Pause Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">تاريخ الإيقاف:</Label>
            <Input
              type="date"
              value={pauseDate}
              min={contractStartDate}
              max={contractEndDate}
              onChange={(e) => setPauseDate(e.target.value)}
              className="text-xs bg-background"
            />
          </div>

          {/* Financial Refund Preview */}
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
            <div className="flex justify-between items-center text-emerald-500 font-bold">
              <span>المبلغ المسترجع للعميل (يُخصم من العقد):</span>
              <span className="text-sm">{remainingCalc.remainingValue.toLocaleString('ar-LY')} د.ل</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground text-[11px] pt-1">
              <span>المبلغ المستهلك للأيام المنقضية ({remainingCalc.elapsedDays} يوم):</span>
              <span>{remainingCalc.consumedValue.toLocaleString('ar-LY')} د.ل</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">سبب أو ملاحظات الإيقاف (اختياري):</Label>
            <Textarea
              placeholder="اكتب ملاحظات إن وجدت..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-xs bg-background resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isExecuting}>
            إلغاء
          </Button>
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={isExecuting}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin ml-1.5" />
                <span>جاري الإيقاف...</span>
              </>
            ) : (
              <span>تأكيد الإيقاف</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
