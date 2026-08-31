import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, Printer } from 'lucide-react';
import { formatAmount } from '@/lib/formatUtils';
import { supabase } from '@/integrations/supabase/client';
import { generatePurchaseInvoiceHTML } from '@/components/billing/InvoiceTemplates';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import { DimensionsRow, DuplicateItemControl } from '@/components/billing/InvoiceItemExtras';

interface PurchaseItem {
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

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  paid?: boolean;
  locked?: boolean;
  invoice_name: string | null;
  notes: string | null;
  used_as_payment?: number;
}

interface PurchaseInvoiceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice | null;
  onSuccess: () => void;
}

export function PurchaseInvoiceEditDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess
}: PurchaseInvoiceEditDialogProps) {
  const [items, setItems] = useState<PurchaseItem[]>([
    { id: 'item-init', item_name: '', quantity: 1, unit: 'قطعة', unit_price: 0, total_price: 0, image_url: '' }
  ]);
  const [invoiceName, setInvoiceName] = useState('فاتورة مشتريات');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const lastLoadedInvoiceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && invoice) {
      if (lastLoadedInvoiceIdRef.current !== invoice.id) {
        lastLoadedInvoiceIdRef.current = invoice.id;
        loadInvoiceItems();
        setInvoiceName(invoice.invoice_name || 'فاتورة مشتريات');
        setNotes(invoice.notes || '');
        setDiscount(Number((invoice as any).discount) || 0);
        const raw = invoice.invoice_date || '';
        const iso = raw ? new Date(raw).toISOString().slice(0, 10) : '';
        setInvoiceDate(iso || raw.slice(0, 10));
      }
    } else if (!open) {
      lastLoadedInvoiceIdRef.current = null;
    }
  }, [open, invoice]);

  const loadInvoiceItems = async () => {
    if (!invoice) return;

    try {
      const { data, error } = await supabase
        .from('purchase_invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setItems(data.map((item: any, idx: number) => ({
          id: item.id || `item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          item_name: item.item_name,
          quantity: item.quantity,
          unit: item.unit || 'قطعة',
          unit_price: item.unit_price,
          total_price: item.total_price,
          image_url: item.image_url || '',
          width: item.width ?? null,
          height: item.height ?? null,
          depth: item.depth ?? null,
        })));
      } else {
        setItems([{ id: `item-${Date.now()}`, item_name: '', quantity: 1, unit: 'قطعة', unit_price: 0, total_price: 0, image_url: '' }]);
      }
    } catch (error) {
      console.error('Error loading invoice items:', error);
      toast.error('فشل تحميل عناصر الفاتورة');
    }
  };

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

  const duplicateItem = (index: number, count: number) => {
    const src = items[index];
    if (!src.item_name.trim()) {
      toast.error('يرجى تعبئة اسم الصنف قبل النسخ');
      return;
    }
    const copies: PurchaseItem[] = Array.from({ length: count }, (_, cIdx) => ({
      ...src,
      id: `item-${Date.now()}-${cIdx}-${Math.random().toString(36).slice(2, 6)}`
    }));
    setItems([...items.slice(0, index + 1), ...copies, ...items.slice(index + 1)]);
    toast.success(`تم نسخ الصنف ${count} مرة`);
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

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
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
  const totalAmount = Math.max(0, subtotal - (discount || 0));

  const handleSave = async (shouldPrint: boolean = false) => {
    if (!invoice) return;

    try {
      setIsSaving(true);

      const validItems = items.filter(item => item.item_name.trim() && item.quantity > 0 && item.unit_price > 0);
      if (validItems.length === 0) {
        toast.error('يرجى إضافة عنصر واحد على الأقل');
        return;
      }

      const { data: updatedInvoice, error: invoiceError } = await (supabase as any)
        .from('purchase_invoices')
        .update({
          total_amount: totalAmount,
          discount: discount || 0,
          invoice_name: invoiceName || 'فاتورة مشتريات',
          invoice_date: invoiceDate || invoice.invoice_date,
          notes: notes || null
        })
        .eq('id', invoice.id)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      await supabase
        .from('purchase_invoice_items')
        .delete()
        .eq('invoice_id', invoice.id);

      const { error: itemsError } = await (supabase as any)
        .from('purchase_invoice_items')
        .insert(
          validItems.map(item => ({
            invoice_id: invoice.id,
            item_name: item.item_name,
            quantity: item.quantity,
            unit: item.unit || 'قطعة',
            unit_price: item.unit_price,
            total_price: item.total_price,
            image_url: item.image_url || null,
            width: item.width ?? null,
            height: item.height ?? null,
            depth: item.depth ?? null
          }))
        );

      if (itemsError) throw itemsError;

      // تحديث حركة الدفع المرتبطة بالفاتورة في جدول customer_payments
      const { data: existingPayments, error: searchError } = await supabase
        .from('customer_payments')
        .select('id')
        .eq('entry_type', 'purchase_invoice')
        .or(`purchase_invoice_id.eq.${invoice.id},notes.like.%${invoice.invoice_number}%`);

      if (!searchError && existingPayments && existingPayments.length > 0) {
        await supabase
          .from('customer_payments')
          .update({
            amount: -totalAmount,
            notes: `فاتورة مشتريات ${invoice.invoice_number}` + (notes ? ` - ${notes}` : ''),
            purchase_invoice_id: invoice.id
          })
          .eq('id', existingPayments[0].id);
      } else {
        // إذا لم توجد، نقوم بإنشائها
        await supabase
          .from('customer_payments')
          .insert({
            customer_id: invoice.customer_id,
            amount: -totalAmount,
            method: 'نقدي',
            paid_at: invoiceDate || invoice.invoice_date,
            notes: `فاتورة مشتريات ${invoice.invoice_number}` + (notes ? ` - ${notes}` : ''),
            entry_type: 'purchase_invoice',
            purchase_invoice_id: invoice.id
          });
      }

      toast.success('تم تحديث فاتورة المشتريات بنجاح');

      if (shouldPrint) {
        handlePrint(updatedInvoice, validItems);
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating purchase invoice:', error);
      toast.error('فشل تحديث فاتورة المشتريات');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async (invoiceData: any, items: PurchaseItem[]) => {
    const data = {
      invoiceNumber: invoiceData.invoice_number,
      invoiceDate: invoiceData.invoice_date,
      customerName: invoiceData.customer_name,
      invoiceName: invoiceData.invoice_name || invoiceName,
      items: items.map(item => ({
        description: item.item_name,
        quantity: item.quantity,
        unit: item.unit || 'قطعة',
        unitPrice: item.unit_price,
        total: item.total_price,
        image_url: item.image_url || undefined,
        width: item.width ?? null,
        height: item.height ?? null,
        depth: item.depth ?? null
      })),
      discount: discount || 0,
      totalAmount: totalAmount,
      notes: invoiceData.notes || undefined
    };

    const html = await generatePurchaseInvoiceHTML(data);
    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(html, `فاتورة مشتريات ${invoiceData.invoice_number} - ${invoiceData.customer_name}`, 'billing-invoices');
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg font-bold text-primary text-right">
            تعديل فاتورة مشتريات - {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* عنوان الفاتورة + التاريخ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="expenses-preview-item">
              <h3 className="expenses-preview-label">عنوان الفاتورة</h3>
              <Input
                value={invoiceName}
                onChange={(e) => setInvoiceName(e.target.value)}
                placeholder="مثال: فاتورة قطع، فاتورة مواد..."
                className="bg-input border-border text-card-foreground"
              />
            </div>
            <div className="expenses-preview-item">
              <h3 className="expenses-preview-label">تاريخ الفاتورة</h3>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="bg-input border-border text-card-foreground"
              />
            </div>
          </div>
          {/* العناصر */}
          <div className="expenses-preview-item">
            <div className="flex justify-between items-center mb-3">
              <h3 className="expenses-preview-label">الأصناف</h3>
              <Button
                type="button"
                size="sm"
                onClick={addItem}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة صنف
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id || `item-${index}`} className="bg-muted/30 p-4 rounded-xl border border-border space-y-3 relative shadow-sm">
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
                        value={item.item_name}
                        onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                        placeholder="مثال: طباعة، تركيب، مواد..."
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>

                    <div>
                      <label className="expenses-form-label block mb-1.5 text-xs">الوحدة</label>
                      <Input
                        value={item.unit || ''}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        placeholder="قطعة، متر..."
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>

                    <div>
                      <label className="expenses-form-label block mb-1.5 text-xs">الكمية <span className="text-destructive">*</span></label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', Number(e.target.value) || 1)}
                        className="bg-input border-border text-card-foreground"
                      />
                    </div>

                    <div>
                      <label className="expenses-form-label block mb-1.5 text-xs">سعر الوحدة <span className="text-destructive">*</span></label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value) || 0)}
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
                      imageName={`purchase-edit-item-${index}`}
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

          {/* التخفيض */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">التخفيض (اختياري)</h3>
            <Input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              placeholder="أدخل قيمة التخفيض"
              min="0"
              step="0.01"
              className="bg-input border-border text-card-foreground"
            />
          </div>

          {/* الملاحظات */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">ملاحظات (اختياري)</h3>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية (اختياري)"
              className="bg-input border-border text-card-foreground"
            />
          </div>

          {/* الملخص */}
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

          {/* الأزرار */}
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
              disabled={isSaving || totalAmount === 0}
              className="stat-green bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              حفظ التعديلات
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving || totalAmount === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              <Printer className="h-4 w-4 ml-2" />
              حفظ وطباعة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
