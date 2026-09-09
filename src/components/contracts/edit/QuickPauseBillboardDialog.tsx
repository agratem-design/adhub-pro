import { supabase } from '@/integrations/supabase/client';
import { parsePriceSnapshot, priceId, type ContractPriceSnapshot } from '@/utils/contractEditMoney';
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PauseCircle, Loader2 } from 'lucide-react';
import { calculateRemainingBillboardValue } from '@/utils/contractBillboardCalculations';
import { executeQuickPause } from '@/services/contractBillboardSwapService';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  billboard: {
    ID: number | string;
    Billboard_Name?: string | null;
    Size?: string | null;
    City?: string | null;
    Rent_Start_Date?: string | null;
    Rent_End_Date?: string | null;
  };
  contractNumber: number;
  contractStartDate: string;
  contractEndDate: string;
  contractedPrice?: number;
  onPaused?: (result: { pauseRefund: number; newBillboardIds: string[] }) => void;
}

type SavedPausePrice = ContractPriceSnapshot & {
  currency: string;
  start: string;
  end: string;
  revision: number;
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'حدث خطأ غير متوقع';

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

  const [saved, setSaved] = useState<SavedPausePrice | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setSaved(null);
    (async () => {
      const { data, error } = await supabase.from('Contract').select('*').eq('Contract_Number', contractNumber).single();
      if (!active) return;
      if (error) { toast.error('تعذر تحميل السعر المحفوظ'); return; }
      const contractRecord = data as unknown as Record<string, unknown>;
      const price = parsePriceSnapshot(data.billboard_prices).find(p => priceId(p) === String(billboard.ID));
      if (!price) { toast.error('احفظ سعر اللوحة قبل إيقافها'); return; }
      const start = String(price.startDate || billboard.Rent_Start_Date || data['Contract Date']);
      const end = String(price.endDate || billboard.Rent_End_Date || data['End Date']);
      setSaved({ ...price, currency: String(contractRecord.contract_currency || price.currency || 'LYD'), start, end, revision: Number(contractRecord.edit_revision || 0) });
      setPauseDate(todayStr >= start && todayStr <= end ? todayStr : start);
    })();
    return () => { active = false; };
  }, [open, contractNumber, billboard.ID, billboard.Rent_Start_Date, billboard.Rent_End_Date, todayStr]);
  const currencySymbol = ({ LYD: 'د.ل', USD: '$', EUR: '€' } as Record<string, string>)[saved?.currency] || saved?.currency || 'د.ل';
  const effectivePrice = Number(saved?.finalPrice ?? saved?.priceAfterDiscount ?? saved?.contractPrice ?? 0);

  const remainingCalc = useMemo(() => {
    return calculateRemainingBillboardValue({
      startDate: saved?.start,
      endDate: saved?.end,
      effectiveDate: pauseDate,
      contractedPrice: effectivePrice,
      printCost: Number(saved?.printCost || 0),
      installCost: Number(saved?.installationCost || 0),
    });
  }, [saved, pauseDate, effectivePrice]);

  const handleExecute = async () => {
    if (!billboard || !saved || isExecuting || !pauseDate || pauseDate < saved.start || pauseDate > saved.end) return;

    setIsExecuting(true);
    try {
      const result = await executeQuickPause({
        contractNumber,
        billboardId: Number(billboard.ID),
        pauseDate,
        expectedRevision: saved.revision,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast.success(`تم إيقاف اللوحة #${billboard.ID} بنجاح وخصم المسترجع (${result.pauseRefund.toLocaleString('ar-LY')} ${currencySymbol}) من العقد`);
        onOpenChange(false);
        if (onPaused) {
          onPaused(result);
        }
      } else {
        toast.error(result.error || 'تعذر إيقاف اللوحة');
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error));
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
                يُنفّذ الإيقاف فور التأكيد، وتُخصم قيمة الإيجار المتبقي مع الاحتفاظ بتكاليف الخدمات
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
              <div>السعر الإجمالي: <strong className="text-foreground">{effectivePrice.toLocaleString('ar-LY')} {currencySymbol}</strong></div>
              <div>الأيام المتبقية: <strong className="text-foreground">{remainingCalc.remainingDays} يوم</strong></div>
            </div>
          </div>

          {/* Pause Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">تاريخ الإيقاف:</Label>
            <Input
              type="date"
              value={pauseDate}
              min={saved?.start}
              max={saved?.end}
              onChange={(e) => setPauseDate(e.target.value)}
              className="text-xs bg-background"
            />
          </div>

          {/* Financial Refund Preview */}
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
            <div className="flex justify-between items-center text-emerald-500 font-bold">
              <span>المبلغ المسترجع للعميل (يُخصم من العقد):</span>
              <span className="text-sm">{remainingCalc.remainingValue.toLocaleString('ar-LY')} {currencySymbol}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground text-[11px] pt-1">
              <span>المبلغ المستهلك للأيام المنقضية ({remainingCalc.elapsedDays} يوم):</span>
              <span>{remainingCalc.consumedValue.toLocaleString('ar-LY')} {currencySymbol}</span>
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
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isExecuting} className="min-h-10 cursor-pointer transition-all duration-200">
            إلغاء
          </Button>
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={isExecuting || !saved || !pauseDate || pauseDate < saved.start || pauseDate > saved.end}
            className="min-h-10 cursor-pointer bg-amber-500 text-white font-bold transition-all duration-200 hover:bg-amber-600 active:scale-95"
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
