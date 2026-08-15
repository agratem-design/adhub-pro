import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { DollarSign } from 'lucide-react';
import { formatAmount } from '@/lib/formatUtils';
import { supabase } from '@/integrations/supabase/client';

interface SalesInvoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  invoice_date: string;
  customer_name: string;
}

interface SalesInvoicePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: SalesInvoice | null;
  customerId: string;
  onPaymentAdded: () => void;
}

export function SalesInvoicePaymentDialog({
  open,
  onOpenChange,
  invoice,
  customerId,
  onPaymentAdded
}: SalesInvoicePaymentDialogProps) {
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

      // إضافة الدفعة إلى جدول customer_payments
      const { error: paymentError } = await supabase
        .from('customer_payments')
        .insert({
          customer_id: customerId,
          customer_name: invoice.customer_name,
          sales_invoice_id: invoice.id,
          amount: paymentAmount,
          method: paymentMethod,
          reference: paymentReference || null,
          notes: notes || `دفعة لفاتورة مبيعات ${invoice.invoice_number}`,
          paid_at: paymentDate,
          entry_type: 'sales_invoice'
        });

      if (paymentError) throw paymentError;

      // تحديث المبلغ المدفوع في الفاتورة
      const newPaidAmount = Number(invoice.paid_amount || 0) + paymentAmount;
      const { error: updateError } = await supabase
        .from('sales_invoices')
        .update({ paid_amount: newPaidAmount })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      toast.success('تم إضافة الدفعة بنجاح');
      onPaymentAdded();
      onOpenChange(false);
      setAmount('');
      setPaymentMethod('نقدي');
      setPaymentReference('');
      setNotes('');
    } catch (error) {
      console.error('Error adding payment:', error);
      toast.error('فشل في إضافة الدفعة');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة دفعة لفاتورة مبيعات {invoice.invoice_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">إجمالي الفاتورة:</span>
              <span className="font-bold">{formatAmount(Number(invoice.total_amount))} د.ل</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المدفوع:</span>
              <span className="font-bold text-green-600">{formatAmount(Number(invoice.paid_amount || 0))} د.ل</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">المتبقي:</span>
              <span className="font-bold text-primary">{formatAmount(remaining)} د.ل</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ المدفوع</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">طريقة الدفع</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="نقدي">نقدي</SelectItem>
                <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                <SelectItem value="شيك">شيك</SelectItem>
                <SelectItem value="بطاقة">بطاقة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">رقم المرجع (اختياري)</Label>
            <Input
              id="reference"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="رقم الشيك أو التحويل"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">تاريخ الدفع</Label>
            <Input
              id="date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} className="gap-2">
              <DollarSign className="h-4 w-4" />
              حفظ الدفعة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
