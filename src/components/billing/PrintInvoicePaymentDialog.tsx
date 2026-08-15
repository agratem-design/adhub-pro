import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PrintInvoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  invoice_date: string;
}

interface PrintInvoicePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PrintInvoice | null;
  customerId: string;
  onPaymentAdded: () => void;
}

export function PrintInvoicePaymentDialog({
  open,
  onOpenChange,
  invoice,
  customerId,
  onPaymentAdded
}: PrintInvoicePaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقدي');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  if (!invoice) return null;

  const remaining = Number(invoice.total_amount) - Number(invoice.paid_amount || 0);

  const handleSave = async () => {
    try {
      const paymentAmount = Number(amount);

      if (!paymentAmount || paymentAmount <= 0) {
        toast.error('يرجى إدخال مبلغ صحيح');
        return;
      }

      if (paymentAmount > remaining) {
        toast.error('المبلغ أكبر من المتبقي');
        return;
      }

      // التحقق من حالة القفل
      const { data: currentInvoice, error: checkError } = await supabase
        .from('printed_invoices')
        .select('locked')
        .eq('id', invoice.id)
        .single();

      if (checkError) throw checkError;

      if (currentInvoice?.locked) {
        toast.error('لا يمكن إضافة دفعات لفاتورة مسددة بالكامل');
        return;
      }

      // إضافة الدفعة
      const { error: paymentError } = await supabase
        .from('print_invoice_payments')
        .insert({
          invoice_id: invoice.id,
          customer_id: customerId,
          amount: paymentAmount,
          payment_method: paymentMethod,
          payment_reference: paymentReference || null,
          payment_date: paymentDate,
          notes: notes || null
        });

      if (paymentError) throw paymentError;

      // تحديث المبلغ المدفوع في الفاتورة
      const newPaidAmount = Number(invoice.paid_amount || 0) + paymentAmount;
      const isPaid = newPaidAmount >= Number(invoice.total_amount);

      const { error: updateError } = await supabase
        .from('printed_invoices')
        .update({
          paid_amount: newPaidAmount,
          paid: isPaid
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      // إضافة الدفعة في جدول الدفعات الرئيسي
      await supabase
        .from('customer_payments')
        .insert({
          customer_id: customerId,
          amount: paymentAmount,
          method: paymentMethod,
          reference: paymentReference || null,
          paid_at: paymentDate,
          notes: `سداد فاتورة طباعة ${invoice.invoice_number}` + (notes ? ` - ${notes}` : ''),
          entry_type: 'print_payment'
        });

      toast.success('تم إضافة الدفعة بنجاح');
      onOpenChange(false);
      onPaymentAdded();

      // إعادة تعيين النموذج
      setAmount('');
      setPaymentMethod('نقدي');
      setPaymentReference('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    } catch (error) {
      console.error('Error saving payment:', error);
      toast.error('فشل حفظ الدفعة');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg font-bold text-primary text-right">
            <DollarSign className="h-5 w-5 inline ml-2" />
            إضافة دفعة لفاتورة الطباعة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* معلومات الفاتورة */}
          <div className="bg-accent/10 border border-primary/30 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">رقم الفاتورة:</span>
              <span className="font-semibold text-foreground">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">إجمالي الفاتورة:</span>
              <span className="font-semibold text-foreground">
                {Number(invoice.total_amount).toLocaleString('ar-LY')} د.ل
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المدفوع:</span>
              <span className="font-semibold text-green-600">
                {Number(invoice.paid_amount || 0).toLocaleString('ar-LY')} د.ل
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground font-bold">المتبقي:</span>
              <span className="font-bold text-destructive">
                {remaining.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">المبلغ المدفوع *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-right bg-input border-border text-foreground"
              placeholder="0.00"
              min="0"
              max={remaining}
              step="0.01"
            />
            <div className="text-xs text-muted-foreground">
              الحد الأقصى: {remaining.toLocaleString('ar-LY')} د.ل
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">طريقة الدفع</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="text-right bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="نقدي" className="text-popover-foreground">نقدي</SelectItem>
                <SelectItem value="تحويل بنكي" className="text-popover-foreground">تحويل بنكي</SelectItem>
                <SelectItem value="شيك" className="text-popover-foreground">شيك</SelectItem>
                <SelectItem value="بطاقة ائتمان" className="text-popover-foreground">بطاقة ائتمان</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">المرجع</Label>
            <Input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="text-right bg-input border-border text-foreground"
              placeholder="رقم المرجع (اختياري)"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">تاريخ الدفع</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="text-right bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">ملاحظات</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-right bg-input border-border text-foreground"
              placeholder="ملاحظات إضافية (اختياري)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              إضافة الدفعة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
