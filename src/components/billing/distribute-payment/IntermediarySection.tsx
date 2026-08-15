import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, UserCheck } from 'lucide-react';
import { useState } from 'react';

interface IntermediarySectionProps {
  collectedViaIntermediary: boolean;
  setCollectedViaIntermediary: (v: boolean) => void;
  collectorName: string;
  setCollectorName: (v: string) => void;
  receiverName: string;
  setReceiverName: (v: string) => void;
  deliveryLocation: string;
  setDeliveryLocation: (v: string) => void;
  collectionDate: string;
  setCollectionDate: (v: string) => void;
  intermediaryCommission: string;
  setIntermediaryCommission: (v: string) => void;
  transferFee: string;
  setTransferFee: (v: string) => void;
  commissionNotes: string;
  setCommissionNotes: (v: string) => void;
  inputAmountNum: number;
}

export function IntermediarySection({
  collectedViaIntermediary, setCollectedViaIntermediary,
  collectorName, setCollectorName,
  receiverName, setReceiverName,
  deliveryLocation, setDeliveryLocation,
  collectionDate, setCollectionDate,
  intermediaryCommission, setIntermediaryCommission,
  transferFee, setTransferFee,
  commissionNotes, setCommissionNotes,
  inputAmountNum,
}: IntermediarySectionProps) {
  const [isOpen, setIsOpen] = useState(collectedViaIntermediary);
  const netAmount = inputAmountNum - (parseFloat(intermediaryCommission) || 0) - (parseFloat(transferFee) || 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between w-full p-2.5 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={collectedViaIntermediary}
              onCheckedChange={(checked) => {
                setCollectedViaIntermediary(checked as boolean);
                if (checked) setIsOpen(true);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <UserCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">عبر وسيط</span>
            {collectedViaIntermediary && collectorName && (
              <span className="text-xs text-muted-foreground">({collectorName})</span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {collectedViaIntermediary && (
          <div className="space-y-2.5 p-3 mt-1 bg-muted/30 rounded-lg border border-primary/10">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">المحصل <span className="text-destructive">*</span></Label>
                <Input value={collectorName} onChange={(e) => setCollectorName(e.target.value)} placeholder="اسم المحصل" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">المسلم له <span className="text-destructive">*</span></Label>
                <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="اسم المستلم" className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">مكان التسليم <span className="text-destructive">*</span></Label>
                <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="المكان" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">تاريخ القبض <span className="text-destructive">*</span></Label>
                <Input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">عمولة الوسيط (د.ل)</Label>
                <Input type="number" step="0.01" min="0" value={intermediaryCommission} onChange={(e) => setIntermediaryCommission(e.target.value)} placeholder="0" className="h-8 text-xs text-right" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">عمولة التحويل (د.ل)</Label>
                <Input type="number" step="0.01" min="0" value={transferFee} onChange={(e) => setTransferFee(e.target.value)} placeholder="0" className="h-8 text-xs text-right" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ملاحظات العمولات</Label>
              <Input value={commissionNotes} onChange={(e) => setCommissionNotes(e.target.value)} placeholder="تفاصيل إضافية" className="h-8 text-xs" />
            </div>
            {inputAmountNum > 0 && (
              <div className="p-2 bg-background rounded border text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">المبلغ:</span><span>{inputAmountNum.toFixed(2)} د.ل</span></div>
                {(parseFloat(intermediaryCommission) || 0) > 0 && (
                  <div className="flex justify-between text-red-600"><span>- عمولة الوسيط:</span><span>{parseFloat(intermediaryCommission).toFixed(2)} د.ل</span></div>
                )}
                {(parseFloat(transferFee) || 0) > 0 && (
                  <div className="flex justify-between text-red-600"><span>- عمولة التحويل:</span><span>{parseFloat(transferFee).toFixed(2)} د.ل</span></div>
                )}
                <div className="flex justify-between font-bold border-t pt-1"><span>الصافي:</span><span className="text-primary">{netAmount.toFixed(2)} د.ل</span></div>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
