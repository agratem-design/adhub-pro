import { useState, useEffect, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, FileText, PrinterIcon, ShoppingCart, ArrowRightLeft } from 'lucide-react';

interface UseAsPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  purchaseInvoice: {
    id: string;
    invoice_number: string;
    total_amount: number;
    used_as_payment: number;
  };
  onSuccess: () => void;
}

interface PayableItem {
  id: string | number;
  type: 'contract' | 'printed_invoice' | 'sales_invoice';
  displayName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  selected: boolean;
  allocatedAmount: number;
}

// مكون العنصر خارج المكون الرئيسي لتجنب إعادة الرسم
const PayableItemRow = memo(({
  item,
  availableCredit,
  onSelect,
  onAmountChange
}: {
  item: PayableItem;
  availableCredit: number;
  onSelect: (selected: boolean) => void;
  onAmountChange: (value: string) => void;
}) => (
  <div className="border rounded-lg p-3 space-y-2">
    <div className="flex items-start gap-3">
      <Checkbox
        checked={item.selected}
        onCheckedChange={(checked) => onSelect(checked as boolean)}
      />
      <div className="flex-1">
        <div className="font-medium">{item.displayName}</div>
        <div className="text-sm text-muted-foreground">
          المستحق: {item.remainingAmount.toFixed(2)} د.ل
        </div>
      </div>
    </div>
    {item.selected && (
      <div>
        <Label>المبلغ المخصص</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          max={Math.min(item.remainingAmount, availableCredit)}
          value={item.allocatedAmount || ''}
          onChange={(e) => onAmountChange(e.target.value)}
        />
      </div>
    )}
  </div>
));

export function UseAsPaymentDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  purchaseInvoice,
  onSuccess
}: UseAsPaymentDialogProps) {
  const [items, setItems] = useState<PayableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const availableCredit = purchaseInvoice.total_amount - purchaseInvoice.used_as_payment;

  useEffect(() => {
    if (open) {
      loadPayableItems();
    }
  }, [open, customerId]);

  const loadPayableItems = async () => {
    setLoading(true);
    try {
      const allItems: PayableItem[] = [];

      // جلب العقود المستحقة
      const { data: contracts } = await supabase
        .from('Contract')
        .select('Contract_Number, Total, "Total Paid"')
        .eq('customer_id', customerId);

      if (contracts) {
        contracts.forEach(contract => {
          const total = Number(contract.Total) || 0;
          const paid = Number(contract['Total Paid']) || 0;
          const remaining = total - paid;
          if (remaining > 0) {
            allItems.push({
              id: contract.Contract_Number,
              type: 'contract',
              displayName: `عقد رقم ${contract.Contract_Number}`,
              totalAmount: total,
              paidAmount: paid,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // جلب فواتير الطباعة المستحقة
      const { data: printedInvoices } = await supabase
        .from('printed_invoices')
        .select('id, invoice_number, total_amount, paid_amount')
        .eq('customer_id', customerId)
        .eq('locked', false);

      if (printedInvoices) {
        printedInvoices.forEach(invoice => {
          const total = Number(invoice.total_amount) || 0;
          const paid = Number(invoice.paid_amount) || 0;
          const remaining = total - paid;
          if (remaining > 0) {
            allItems.push({
              id: invoice.id,
              type: 'printed_invoice',
              displayName: `فاتورة طباعة ${invoice.invoice_number}`,
              totalAmount: total,
              paidAmount: paid,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      // جلب فواتير المبيعات المستحقة
      const { data: salesInvoices } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, total_amount, paid_amount')
        .eq('customer_id', customerId);

      if (salesInvoices) {
        salesInvoices.forEach(invoice => {
          const total = Number(invoice.total_amount) || 0;
          const paid = Number(invoice.paid_amount) || 0;
          const remaining = total - paid;
          if (remaining > 0) {
            allItems.push({
              id: invoice.id,
              type: 'sales_invoice',
              displayName: `فاتورة مبيعات ${invoice.invoice_number}`,
              totalAmount: total,
              paidAmount: paid,
              remainingAmount: remaining,
              selected: false,
              allocatedAmount: 0
            });
          }
        });
      }

      setItems(allItems);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (index: number, selected: boolean) => {
    const newItems = [...items];
    newItems[index].selected = selected;
    if (!selected) {
      newItems[index].allocatedAmount = 0;
    }
    setItems(newItems);
  };

  const handleAmountChange = (index: number, value: string) => {
    const newItems = [...items];
    
    if (value === '') {
      newItems[index].allocatedAmount = 0;
      setItems(newItems);
      return;
    }
    
    const amount = parseFloat(value);
    if (!Number.isFinite(amount)) return;
    
    newItems[index].allocatedAmount = Math.min(amount, newItems[index].remainingAmount, availableCredit - totalAllocated + newItems[index].allocatedAmount);
    setItems(newItems);
  };

  const totalAllocated = items.reduce((sum, item) => sum + (item.selected ? item.allocatedAmount : 0), 0);
  const remainingCredit = availableCredit - totalAllocated;

  const handleApplyAsPayment = async () => {
    const selectedItems = items.filter(i => i.selected && i.allocatedAmount > 0);
    if (selectedItems.length === 0) {
      toast.error('الرجاء اختيار عنصر واحد على الأقل');
      return;
    }

    if (totalAllocated > availableCredit) {
      toast.error('المبلغ المخصص أكبر من الرصيد المتاح');
      return;
    }

    setProcessing(true);
    try {
      for (const item of selectedItems) {
        // إنشاء دفعة من نوع مقايضة/خصم من المشتريات
        const paymentData: any = {
          customer_id: customerId,
          customer_name: customerName,
          amount: item.allocatedAmount,
          paid_at: new Date().toISOString(),
          entry_type: 'payment',
          purchase_invoice_id: purchaseInvoice.id,
          method: 'مقايضة',
          notes: `مقايضة من فاتورة مشتريات ${String((purchaseInvoice as any).invoice_name ?? '').trim() || purchaseInvoice.invoice_number}`
        };

        if (item.type === 'contract') {
          paymentData.contract_number = item.id;
        } else if (item.type === 'printed_invoice') {
          paymentData.printed_invoice_id = item.id;
        } else if (item.type === 'sales_invoice') {
          paymentData.sales_invoice_id = item.id;
        }

        const { error: paymentError } = await supabase
          .from('customer_payments')
          .insert(paymentData);

        if (paymentError) throw paymentError;

        // تحديث المبلغ المدفوع في العنصر المستهدف
        if (item.type === 'contract') {
          const { error: updateError } = await supabase
            .from('Contract')
            .update({
              'Total Paid': String(item.paidAmount + item.allocatedAmount)
            })
            .eq('Contract_Number', Number(item.id));
          if (updateError) throw updateError;
        } else if (item.type === 'printed_invoice') {
          const { error: updateError } = await supabase
            .from('printed_invoices')
            .update({
              paid_amount: item.paidAmount + item.allocatedAmount
            })
            .eq('id', String(item.id));
          if (updateError) throw updateError;
        } else if (item.type === 'sales_invoice') {
          const { error: updateError } = await supabase
            .from('sales_invoices')
            .update({
              paid_amount: item.paidAmount + item.allocatedAmount
            })
            .eq('id', String(item.id));
          if (updateError) throw updateError;
        }
      }

      // تحديث المبلغ المستخدم من فاتورة المشتريات
      const { error: purchaseUpdateError } = await supabase
        .from('purchase_invoices')
        .update({
          used_as_payment: purchaseInvoice.used_as_payment + totalAllocated
        })
        .eq('id', purchaseInvoice.id);

      if (purchaseUpdateError) throw purchaseUpdateError;

      toast.success('تم استخدام فاتورة المشتريات كدفعة بنجاح');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error applying as payment:', error);
      toast.error('فشل في تطبيق الدفعة');
    } finally {
      setProcessing(false);
    }
  };

  const contracts = items.filter(i => i.type === 'contract');
  const printedInvoices = items.filter(i => i.type === 'printed_invoice');
  const salesInvoices = items.filter(i => i.type === 'sales_invoice');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            استخدام فاتورة مشتريات كدفعة - {customerName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-primary/10 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">فاتورة المشتريات:</span>
                <span className="text-lg font-bold">{purchaseInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span>الرصيد المتاح:</span>
                <span className="text-lg font-bold text-primary">{availableCredit.toFixed(2)} د.ل</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span>المخصص:</span>
                <span className={totalAllocated > availableCredit ? 'text-destructive' : ''}>{totalAllocated.toFixed(2)} د.ل</span>
              </div>
              <div className="flex justify-between items-center">
                <span>المتبقي:</span>
                <span className={remainingCredit < 0 ? 'text-destructive' : 'text-success'}>{remainingCredit.toFixed(2)} د.ل</span>
              </div>
            </div>

            <Tabs defaultValue="contracts">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="contracts">
                  <FileText className="h-4 w-4 ml-2" />
                  العقود ({contracts.length})
                </TabsTrigger>
                <TabsTrigger value="printed">
                  <PrinterIcon className="h-4 w-4 ml-2" />
                  فواتير الطباعة ({printedInvoices.length})
                </TabsTrigger>
                <TabsTrigger value="sales">
                  <ShoppingCart className="h-4 w-4 ml-2" />
                  فواتير المبيعات ({salesInvoices.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contracts" className="space-y-2 max-h-96 overflow-y-auto">
                {contracts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">لا توجد عقود مستحقة</p>
                ) : (
                  contracts.map((item) => {
                    const actualIndex = items.indexOf(item);
                    return (
                      <PayableItemRow
                        key={item.id}
                        item={item}
                        availableCredit={availableCredit}
                        onSelect={(selected) => handleSelectItem(actualIndex, selected)}
                        onAmountChange={(value) => handleAmountChange(actualIndex, value)}
                      />
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="printed" className="space-y-2 max-h-96 overflow-y-auto">
                {printedInvoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">لا توجد فواتير طباعة مستحقة</p>
                ) : (
                  printedInvoices.map((item) => {
                    const actualIndex = items.indexOf(item);
                    return (
                      <PayableItemRow
                        key={item.id}
                        item={item}
                        availableCredit={availableCredit}
                        onSelect={(selected) => handleSelectItem(actualIndex, selected)}
                        onAmountChange={(value) => handleAmountChange(actualIndex, value)}
                      />
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="sales" className="space-y-2 max-h-96 overflow-y-auto">
                {salesInvoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">لا توجد فواتير مبيعات مستحقة</p>
                ) : (
                  salesInvoices.map((item) => {
                    const actualIndex = items.indexOf(item);
                    return (
                      <PayableItemRow
                        key={item.id}
                        item={item}
                        availableCredit={availableCredit}
                        onSelect={(selected) => handleSelectItem(actualIndex, selected)}
                        onAmountChange={(value) => handleAmountChange(actualIndex, value)}
                      />
                    );
                  })
                )}
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
                إلغاء
              </Button>
              <Button onClick={handleApplyAsPayment} disabled={processing || items.filter(i => i.selected).length === 0}>
                {processing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                تطبيق كدفعة
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
