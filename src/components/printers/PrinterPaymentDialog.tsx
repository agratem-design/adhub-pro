import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Wallet, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PrinterPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printerId: string;
  printerName: string;
  totalDebt: number;
  totalPaid: number;
  onPaymentAdded: () => void;
}

export function PrinterPaymentDialog({
  open,
  onOpenChange,
  printerId,
  printerName,
  totalDebt,
  totalPaid,
  onPaymentAdded,
}: PrinterPaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقدي');
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const remaining = totalDebt - totalPaid;

  const handleSave = async () => {
    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('printer_payments').insert({
        printer_id: printerId,
        amount: paymentAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: reference || null,
        notes: notes || null,
      });

      if (error) throw error;

      toast.success('تم تسجيل الدفعة بنجاح');
      onOpenChange(false);
      onPaymentAdded();

      setAmount('');
      setPaymentMethod('نقدي');
      setReference('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    } catch (err) {
      console.error(err);
      toast.error('فشل في تسجيل الدفعة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg font-bold text-primary text-right flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            تسجيل دفعة للمطبعة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* معلومات الحساب */}
          <div className="bg-accent/10 border border-primary/30 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المطبعة:</span>
              <span className="font-semibold">{printerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">إجمالي المستحقات:</span>
              <span className="font-semibold text-red-600">{totalDebt.toLocaleString('ar-LY')} د.ل</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المدفوع:</span>
              <span className="font-semibold text-green-600">{totalPaid.toLocaleString('ar-LY')} د.ل</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-border">
              <span className="font-bold text-muted-foreground">المتبقي:</span>
              <span className={`font-bold ${remaining > 0 ? 'text-destructive' : 'text-green-600'}`}>
                {remaining.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">المبلغ المدفوع *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-right bg-input border-border"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">طريقة الدفع</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="text-right bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="نقدي">نقدي</SelectItem>
                <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                <SelectItem value="شيك">شيك</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">المرجع / رقم العملية</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="text-right bg-input border-border"
              placeholder="اختياري"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">تاريخ الدفع</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="text-right bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">ملاحظات</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-right bg-input border-border"
              placeholder="اختياري"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={loading} className="bg-primary text-primary-foreground">
              <DollarSign className="h-4 w-4 mr-1" />
              {loading ? 'جاري الحفظ...' : 'تسجيل الدفعة'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
