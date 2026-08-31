import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, Printer } from 'lucide-react';
import { formatAmount } from '@/lib/formatUtils';
import { supabase } from '@/integrations/supabase/client';
import { generateSalesInvoiceHTML } from '@/components/billing/InvoiceTemplates';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import { DimensionsRow, DuplicateItemControl } from '@/components/billing/InvoiceItemExtras';

interface SalesItem {
  id?: string;
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

interface SalesInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  customer_name: string;
  items: string;
  total_amount: number;
  paid_amount: number;
  paid: boolean;
  notes: string | null;
}

interface SalesInvoiceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: SalesInvoice | null;
  onSuccess: () => void;
}

export function SalesInvoiceEditDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess
}: SalesInvoiceEditDialogProps) {
  const [items, setItems] = useState<SalesItem[]>([
    { id: 'item-init', item_name: '', quantity: 1, unit: 'قطعة', unit_price: 0, total_price: 0, image_url: '' }
  ]);
  const [unitSuggestions, setUnitSuggestions] = useState<string[]>([]);
  const defaultUnits = ['قطعة', 'متر', 'كيلو', 'لفة', 'علبة', 'كرتون', 'لتر', 'طن', 'حبة', 'عدد'];
  const [invoiceName, setInvoiceName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const lastLoadedInvoiceIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (open && invoice) {
      if (lastLoadedInvoiceIdRef.current !== invoice.id) {
        lastLoadedInvoiceIdRef.current = invoice.id;

        try {
          const parsedItems = typeof invoice.items === 'string'
            ? JSON.parse(invoice.items)
            : invoice.items;

          const loadedItems: SalesItem[] = Array.isArray(parsedItems) && parsedItems.length > 0
            ? parsedItems.map((item: any, idx: number) => ({
                id: `item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
                item_name: item.item_name || item.description || '',
                quantity: Number(item.quantity) || 1,
                unit: item.unit || 'قطعة',
                unit_price: Number(item.unit_price ?? item.unitPrice) || 0,
                total_price: Number(item.total_price ?? item.total) || ((Number(item.quantity) || 1) * (Number(item.unit_price ?? item.unitPrice) || 0)),
                image_url: item.image_url || '',
                width: item.width ?? null,
                height: item.height ?? null,
                depth: item.depth ?? null
              }))
            : [{ id: `item-${Date.now()}`, item_name: '', quantity: 1, unit: 'قطعة', unit_price: 0, total_price: 0, image_url: '' }];

          setItems(loadedItems);
        } catch (e) {
          console.error('Error parsing invoice items:', e);
          setItems([{ id: `item-${Date.now()}`, item_name: '', quantity: 1, unit: 'قطعة', unit_price: 0, total_price: 0, image_url: '' }]);
        }

        setInvoiceName((invoice as any).invoice_name || '');
        const rawDate = invoice.invoice_date || '';
        setInvoiceDate(rawDate ? rawDate.slice(0, 10) : '');
        setDiscount(Number((invoice as any).discount) || 0);
        setNotes(invoice.notes || '');
      }
    } else if (!open) {
      lastLoadedInvoiceIdRef.current = null;
    }
  }, [open, invoice]);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        item_name: '',
        quantity: 1,
        unit: 'قطعة',
        unit_price: 0,
        total_price: 0,
        image_url: '',
        width: null,
        height: null,
        depth: null
      }
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      setItems([
        {
          id: `item-${Date.now()}`,
          item_name: '',
          quantity: 1,
          unit: 'قطعة',
          unit_price: 0,
          total_price: 0,
          image_url: '',
          width: null,
          height: null,
          depth: null
        }
      ]);
      toast.info('تم تفريغ بيانات الصنف');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
    toast.success('تم حذف الصنف');
  };

  const duplicateItem = (index: number, count: number) => {
    const src = items[index];
    if (!src.item_name.trim()) {
      toast.error('يرجى تعبئة اسم الصنف قبل النسخ');
      return;
    }
    const copies: SalesItem[] = Array.from({ length: count }, (_, cIdx) => ({
      ...src,
      id: `item-${Date.now()}-${cIdx}-${Math.random().toString(36).slice(2, 6)}`
    }));
    setItems([...items.slice(0, index + 1), ...copies, ...items.slice(index + 1)]);
    toast.success(`تم نسخ الصنف ${count} مرة`);
  };

  const updateItem = (index: number, field: keyof SalesItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      const q = Number(field === 'quantity' ? value : newItems[index].quantity) || 0;
      const p = Number(field === 'unit_price' ? value : newItems[index].unit_price) || 0;
      newItems[index].total_price = q * p;
    }

    setItems(newItems);
  };

  const subtotal = items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
  const totalAmount = Math.max(0, subtotal - (Number(discount) || 0));

  const handleSave = async (shouldPrint: boolean = false) => {
    if (!invoice) return;

    try {
      setIsSaving(true);

      const validItems = items
        .filter(item => item.item_name.trim())
        .map(({ id, ...rest }) => ({
          item_name: rest.item_name.trim(),
          quantity: Number(rest.quantity) || 1,
          unit: rest.unit || 'قطعة',
          unit_price: Number(rest.unit_price) || 0,
          total_price: (Number(rest.quantity) || 1) * (Number(rest.unit_price) || 0),
          image_url: rest.image_url ? rest.image_url.trim() : null,
          width: rest.width ?? null,
          height: rest.height ?? null,
          depth: rest.depth ?? null
        }));

      if (validItems.length === 0) {
        toast.error('يرجى إضافة صنف واحد على الأقل مع تحديد اسمه');
        return;
      }

      const { data: updatedInvoice, error: invoiceError } = await (supabase as any)
        .from('sales_invoices')
        .update({
          items: JSON.stringify(validItems),
          total_amount: totalAmount,
          invoice_name: invoiceName || null,
          invoice_date: invoiceDate || null,
          discount: Number(discount) || 0,
          notes: notes || null
        })
        .eq('id', invoice.id)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      toast.success('تم تحديث فاتورة المبيعات بنجاح');

      if (shouldPrint) {
        printInvoice(updatedInvoice);
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating sales invoice:', error);
      toast.error('فشل تحديث فاتورة المبيعات');
    } finally {
      setIsSaving(false);
    }
  };

  const printInvoice = async (invoiceData: any) => {
    const rawItems = typeof invoiceData.items === 'string' ? JSON.parse(invoiceData.items) : invoiceData.items;
    const data = {
      invoiceNumber: invoiceData.invoice_number,
      invoiceDate: invoiceData.invoice_date,
      customerName: invoiceData.customer_name,
      invoiceName: invoiceData.invoice_name || undefined,
      items: (rawItems || []).map((item: any) => ({
        description: item.item_name || item.description || '',
        quantity: item.quantity,
        unit: item.unit || '',
        unitPrice: item.unit_price ?? item.unitPrice ?? 0,
        total: item.total_price ?? item.total ?? 0,
        image_url: item.image_url || undefined,
        width: item.width ?? null,
        height: item.height ?? null,
        depth: item.depth ?? null
      })),
      discount: Number(invoiceData.discount) || 0,
      totalAmount: invoiceData.total_amount,
      notes: invoiceData.notes || undefined
    };

    const html = await generateSalesInvoiceHTML(data);
    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(html, `فاتورة مبيعات ${invoiceData.invoice_number}${invoiceData.invoice_name ? ' - ' + invoiceData.invoice_name : ''}`, 'billing-invoices');
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg font-bold text-primary text-right">
            تعديل فاتورة مبيعات - {invoice.invoice_number}
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
              <h3 className="expenses-preview-label font-bold text-base">الأصناف</h3>
              <Button onClick={addItem} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1 font-medium">
                <Plus className="h-4 w-4" />
                إضافة صنف جديد
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id || `item-${index}`} className="bg-muted/30 p-4 rounded-xl border border-border space-y-3 relative transition-all shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <span className="font-semibold text-card-foreground text-base">
                      صنف {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2.5 gap-1.5 rounded-lg"
                      title={items.length === 1 ? 'تفريغ بيانات هذا الصنف' : 'حذف هذا الصنف بالكامل'}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="text-xs font-semibold">{items.length === 1 ? 'تفريغ الصنف' : 'حذف الصنف'}</span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2">
                      <label className="expenses-form-label block mb-1.5 text-xs">اسم الصنف <span className="text-destructive">*</span></label>
                      <Input
                        placeholder="اسم الصنف"
                        value={item.item_name}
                        onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>
                    <div>
                      <label className="expenses-form-label block mb-1.5 text-xs">الوحدة</label>
                      <Input
                        list={`edit-unit-suggestions-${index}`}
                        value={item.unit || ''}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        placeholder="قطعة، متر..."
                        className="bg-input border-border text-card-foreground"
                      />
                      <datalist id={`edit-unit-suggestions-${index}`}>
                        {unitSuggestions.map(u => (
                          <option key={u} value={u} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="expenses-form-label block mb-1.5 text-xs">الكمية</label>
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
                      <label className="expenses-form-label block mb-1.5 text-xs">السعر الإفرادي</label>
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

                  {/* صورة الصنف مع زر حذف مباشر */}
                  <div className="mt-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="expenses-form-label text-xs">صورة الصنف (اختياري)</label>
                      {item.image_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            updateItem(index, 'image_url', '');
                            toast.success('تم حذف صورة الصنف');
                          }}
                          className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 gap-1 font-medium"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف الصورة
                        </Button>
                      )}
                    </div>
                    <ImageUploadZone
                      value={item.image_url}
                      onChange={(url) => updateItem(index, 'image_url', url)}
                      onClear={() => updateItem(index, 'image_url', '')}
                      imageName={`sales-item-${index}`}
                      folder="invoices"
                      showUrlInput={false}
                      showPreview={!!item.image_url}
                      dropZoneHeight="h-16"
                      previewHeight="h-24"
                      label=""
                    />
                  </div>

                  <DimensionsRow
                    width={item.width}
                    height={item.height}
                    depth={item.depth}
                    onChange={(f, v) => updateItem(index, f, v)}
                  />

                  <div className="mt-2 flex items-center justify-between text-sm bg-muted/40 p-2.5 rounded-lg border border-border/50">
                    <span className="text-muted-foreground font-medium">إجمالي هذا الصنف:</span>
                    <span className="expenses-amount-calculated font-bold text-base text-primary">{formatAmount(item.total_price)} د.ل</span>
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
                <div className="flex justify-between text-lg text-red-600 dark:text-red-400">
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
          <div className="expenses-actions justify-end pt-4 border-t border-border gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="stat-green bg-green-600 hover:bg-green-700 text-white font-semibold shadow"
            >
              حفظ التعديلات
            </Button>
            <Button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow"
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
