import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileText, Printer } from 'lucide-react';

export interface FullStatementOptions {
  detailed: boolean;
  showCost: boolean;
  showStampSignature: boolean;
}

interface FullStatementOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: FullStatementOptions) => void;
  printerName?: string;
}

export function FullStatementOptionsDialog({
  open,
  onOpenChange,
  onConfirm,
  printerName
}: FullStatementOptionsDialogProps) {
  const [detailed, setDetailed] = useState(true);
  const [showCost, setShowCost] = useState(true);
  const [showStampSignature, setShowStampSignature] = useState(true);

  const handleConfirm = () => {
    onConfirm({ detailed, showCost, showStampSignature });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            خيارات كشف الحساب
            {printerName && <span className="text-sm font-normal text-muted-foreground">- {printerName}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <Checkbox
              id="detailed"
              checked={detailed}
              onCheckedChange={(v) => setDetailed(!!v)}
            />
            <Label htmlFor="detailed" className="flex-1 cursor-pointer">
              <div className="font-medium">كشف تفصيلي</div>
              <div className="text-xs text-muted-foreground">عرض جدول اللوحات والتصاميم لكل عقد</div>
            </Label>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <Checkbox
              id="showCost"
              checked={showCost}
              onCheckedChange={(v) => setShowCost(!!v)}
            />
            <Label htmlFor="showCost" className="flex-1 cursor-pointer">
              <div className="font-medium">إظهار التكاليف</div>
              <div className="text-xs text-muted-foreground">عرض سعر المتر والإجماليات والمدفوعات</div>
            </Label>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <Checkbox
              id="showStampSignature"
              checked={showStampSignature}
              onCheckedChange={(v) => setShowStampSignature(!!v)}
            />
            <Label htmlFor="showStampSignature" className="flex-1 cursor-pointer">
              <div className="font-medium">الختم والتوقيع</div>
              <div className="text-xs text-muted-foreground">إضافة مكان للختم والتوقيع في نهاية الكشف</div>
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <Printer className="h-4 w-4" />
            طباعة الكشف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
