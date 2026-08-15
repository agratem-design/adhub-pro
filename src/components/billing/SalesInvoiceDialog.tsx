import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, X, Printer } from 'lucide-react';
import { formatAmount } from '@/lib/formatUtils';
import { supabase } from '@/integrations/supabase/client';
import { generateSalesInvoiceHTML } from '@/components/billing/InvoiceTemplates';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import { DimensionsRow, DuplicateItemControl } from '@/components/billing/InvoiceItemExtras';

interface SalesItem {
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  image_url?: string;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
}

interface SalesInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onSuccess: () => void;
}

export function SalesInvoiceDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess
}: SalesInvoiceDialogProps) {
  const [items, setItems] = useState<SalesItem[]>([
    { item_name: '', quantity: 1, unit: 'قطعة', unit_price: 0, total_price: 0, image_url: '' }
  ]);
  const [unitSuggestions, setUnitSuggestions] = useState<string[]>([]);
  const defaultUnits = ['قطعة', 'متر', 'كيلو', 'لفة', 'علبة', 'كرتون', 'لتر', 'طن', 'حبة', 'عدد'];
  const [invoiceName, setInvoiceName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      supabase
        .from('purchase_invoice_items')
        .select('unit')
        .not('unit', 'is', null)
        .then(({ data }) => {
          if (data) {
            const unique = [...new Set(data.map(d => d.unit).filter(Boolean) as string[])];
            const merged = [...new Set([...defaultUnits, ...unique])];
            setUnitSuggestions(merged);
          }
        });
    }
  }, [open]);

  const addItem = () => {
    setItems([...items, { item_name: '', quantity: 1, unit: 'قطعة', unit_price: 0, total_price: 0, image_url: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      toast.error('يجب أن يحتوي على عنصر واحد على الأقل');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const duplicateItem = (index: number, count: number) => {
    const src = items[index];
    if (!src.item_name.trim()) {
      toast.error('يرجى تعبئة الصنف قبل النسخ');
      return;
    }
    const copies: SalesItem[] = Array.from({ length: count }, () => ({ ...src }));
    setItems([...items.slice(0, index + 1), ...copies, ...items.slice(index + 1)]);
    toast.success(`تم نسخ الصنف ${count} مرة`);
  };

  const updateItem = (index: number, field: keyof SalesItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    
    setItems(newItems);
  };

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const totalAmount = subtotal - discount;

  const handleSave = async (shouldPrint: boolean = false) => {
    try {
      setIsSaving(true);

      const validItems = items.filter(item => item.item_name.trim() && item.quantity > 0 && item.unit_price > 0);
      if (validItems.length === 0) {
        toast.error('يرجى إضافة عنصر واحد على الأقل');
        return;
      }

      const invoiceNumber = `SALE-${Date.now()}`;

      const { data: invoice, error: invoiceError } = await (supabase as any)
        .from('sales_invoices')
        .insert({
          customer_id: customerId,
          customer_name: customerName,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
          items: JSON.stringify(validItems),
          total_amount: totalAmount,
          paid_amount: 0,
          paid: false,
          invoice_name: invoiceName || null,
          discount: discount || 0,
          notes: notes || null
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      toast.success('تم إنشاء فاتورة المبيعات بنجاح');

      if (shouldPrint) {
        printInvoice(invoice);
      }

      onOpenChange(false);
      onSuccess();
      
      setItems([{ item_name: '', quantity: 1, unit: 'قطعة', unit_price: 0, total_price: 0, image_url: '' }]);
      setInvoiceName('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setDiscount(0);
      setNotes('');
    } catch (error) {
      console.error('Error saving sales invoice:', error);
      toast.error('فشل حفظ فاتورة المبيعات');
    } finally {
      setIsSaving(false);
    }
  };

  const printInvoice = async (invoice: any) => {
    const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
    const invoiceData = {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      customerName: invoice.customer_name,
      invoiceName: invoice.invoice_name || undefined,
      items: items.map((item: SalesItem) => ({
        description: item.item_name,
        quantity: item.quantity,
        unit: item.unit || '',
        unitPrice: item.unit_price,
        total: item.total_price,
        image_url: item.image_url || undefined,
        width: item.width ?? null,
        height: item.height ?? null,
        depth: item.depth ?? null
      })),
      discount: invoice.discount || 0,
      totalAmount: invoice.total_amount,
      notes: invoice.notes || undefined
    };

    const html = await generateSalesInvoiceHTML(invoiceData);
    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(html, `فاتورة مبيعات ${invoice.invoice_number}${invoice.invoice_name ? ' - ' + invoice.invoice_name : ''}`, 'billing-invoices');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg font-bold text-primary text-right">
            إنشاء فاتورة مبيعات - {customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Invoice Name */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">اسم الفاتورة (اختياري)</h3>
            <Input
              value={invoiceName}
              onChange={(e) => setInvoiceName(e.target.value)}
              className="bg-input border-border text-card-foreground"
              placeholder="مثال: فاتورة مبيعات لوحات إعلانية"
            />
          </div>

          {/* Invoice Date */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">تاريخ الفاتورة</h3>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="bg-input border-border text-card-foreground"
            />
          </div>

          {/* Items Table */}
          <div className="expenses-preview-item">
            <div className="flex justify-between items-center mb-3">
              <h3 className="expenses-preview-label">الأصناف</h3>
              <Button onClick={addItem} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 ml-1" />
                إضافة صنف
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="bg-muted/30 p-4 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-card-foreground text-lg">
                      صنف {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-2">
                      <label className="expenses-form-label block mb-2">اسم الصنف</label>
                      <Input
                        placeholder="اسم الصنف"
                        value={item.item_name}
                        onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>
                    <div>
                      <label className="expenses-form-label block mb-2">الوحدة</label>
                      <Input
                        list={`sales-unit-suggestions-${index}`}
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        placeholder="قطعة، متر..."
                        className="bg-input border-border text-card-foreground"
                      />
                      <datalist id={`sales-unit-suggestions-${index}`}>
                        {unitSuggestions.map(u => (
                          <option key={u} value={u} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="expenses-form-label block mb-2">الكمية</label>
                      <Input
                        type="number"
                        placeholder="الكمية"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                        min="1"
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>
                    <div>
                      <label className="expenses-form-label block mb-2">السعر</label>
                      <Input
                        type="number"
                        placeholder="السعر"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                        min="0"
                        step="0.01"
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>
                  </div>
                  {/* صورة الصنف */}
                  <div className="mt-3">
                    <label className="expenses-form-label block mb-2">صورة الصنف (اختياري)</label>
                    <ImageUploadZone
                      value={item.image_url}
                      onChange={(url) => updateItem(index, 'image_url' as any, url)}
                      imageName={`sales-item-${index}`}
                      folder="invoices"
                      showUrlInput={false}
                      showPreview={!!item.image_url}
                      dropZoneHeight="h-16"
                      previewHeight="h-20"
                      label="اسحب أو انقر لرفع صورة الصنف"
                    />
                  </div>
                  <DimensionsRow
                    width={item.width}
                    height={item.height}
                    depth={item.depth}
                    onChange={(f, v) => updateItem(index, f, v)}
                  />
                  <div className="mt-3 text-sm text-muted-foreground bg-muted/20 p-2 rounded">
                    الإجمالي: <span className="expenses-amount-calculated font-bold">{formatAmount(item.total_price)} د.ل</span>
                  </div>
                  <DuplicateItemControl
                    onDuplicate={(c) => duplicateItem(index, c)}
                    disabled={!item.item_name.trim()}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Discount */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">التخفيض (اختياري)</h3>
            <Input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="bg-input border-border text-card-foreground"
              placeholder="أدخل قيمة التخفيض"
              min="0"
              step="0.01"
            />
          </div>

          {/* Notes */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">ملاحظات (اختياري)</h3>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-input border-border text-card-foreground"
              placeholder="أضف ملاحظات إضافية"
            />
          </div>

          {/* Summary */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">ملخص الفاتورة:</h3>
            <div className="space-y-3 text-card-foreground">
              <div className="flex justify-between text-lg">
                <span>المجموع الفرعي:</span>
                <span className="font-semibold">{formatAmount(subtotal)} د.ل</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-lg text-red-600">
                  <span>التخفيض:</span>
                  <span className="font-semibold">- {formatAmount(discount)} د.ل</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xl pt-2 border-t border-border">
                <span>الإجمالي النهائي:</span>
                <span className="text-primary">{formatAmount(totalAmount)} د.ل</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="expenses-actions justify-end pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              إلغاء
            </Button>
            <Button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="stat-green bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              حفظ الفاتورة
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              <Printer className="h-4 w-4 ml-1" />
              حفظ وطباعة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
