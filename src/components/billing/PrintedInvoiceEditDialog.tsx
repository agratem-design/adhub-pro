import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PrintedInvoiceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  onSuccess: () => void;
}

interface CompositeTaskDetails {
  id: string;
  task_type: string;
  customer_installation_cost: number;
  company_installation_cost: number;
  customer_print_cost: number;
  company_print_cost: number;
  customer_cutout_cost: number;
  company_cutout_cost: number;
  customer_total: number;
  company_total: number;
  net_profit: number;
  profit_percentage: number;
  print_task?: {
    total_area: number;
  };
  cutout_task?: {
    total_quantity: number;
  };
}

export function PrintedInvoiceEditDialog({
  open,
  onOpenChange,
  invoiceId,
  onSuccess
}: PrintedInvoiceEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCompositeTask, setIsCompositeTask] = useState(false);
  const [compositeTaskDetails, setCompositeTaskDetails] = useState<CompositeTaskDetails | null>(null);
  const [editingPrices, setEditingPrices] = useState(false);
  const [pricePerMeter, setPricePerMeter] = useState(0);
  const [printerPricePerMeter, setPrinterPricePerMeter] = useState(0);
  const [cutoutCustomerPrice, setCutoutCustomerPrice] = useState(0);
  const [cutoutPrinterPrice, setCutoutPrinterPrice] = useState(0);
  const [formData, setFormData] = useState({
    invoice_number: '',
    printer_name: '',
    invoice_date: '',
    total_amount: '',
    printer_cost: '',
    notes: '',
    invoice_type: ''
  });

  useEffect(() => {
    if (open && invoiceId) {
      loadInvoice();
    }
  }, [open, invoiceId]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('printed_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (error) throw error;

      setFormData({
        invoice_number: data.invoice_number || '',
        printer_name: data.printer_name || '',
        invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
        total_amount: data.total_amount?.toString() || '',
        printer_cost: data.printer_cost?.toString() || '',
        notes: data.notes || '',
        invoice_type: data.invoice_type || ''
      });

      // Check if this is a composite task invoice
      if (data.invoice_type === 'composite_task') {
        setIsCompositeTask(true);
        await loadCompositeTaskDetails(data.id);
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      toast.error('فشل في تحميل بيانات الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  const loadCompositeTaskDetails = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase
        .from('composite_tasks')
        .select(`
          *,
          print_task:print_tasks!composite_tasks_print_task_id_fkey(total_area),
          cutout_task:cutout_tasks!composite_tasks_cutout_task_id_fkey(total_quantity)
        `)
        .eq('combined_invoice_id', invoiceId)
        .single();

      if (error) throw error;

      setCompositeTaskDetails(data as CompositeTaskDetails);

      // Initialize price editing values
      if (data.print_task && data.print_task.total_area > 0) {
        setPricePerMeter(data.customer_print_cost / data.print_task.total_area);
        setPrinterPricePerMeter(data.company_print_cost / data.print_task.total_area);
      }
      if (data.cutout_task) {
        setCutoutCustomerPrice(data.customer_cutout_cost);
        setCutoutPrinterPrice(data.company_cutout_cost);
      }
    } catch (error) {
      console.error('Error loading composite task details:', error);
    }
  };

  const handleSubmit = async () => {
    if (isCompositeTask && compositeTaskDetails) {
      // Update composite task costs
      try {
        setSubmitting(true);

        const totalArea = compositeTaskDetails.print_task?.total_area || 0;
        const newCustomerPrintCost = pricePerMeter * totalArea;
        const newCompanyPrintCost = printerPricePerMeter * totalArea;

        const { error: taskError } = await supabase
          .from('composite_tasks')
          .update({
            customer_print_cost: newCustomerPrintCost,
            company_print_cost: newCompanyPrintCost,
            customer_cutout_cost: cutoutCustomerPrice,
            company_cutout_cost: cutoutPrinterPrice
          })
          .eq('id', compositeTaskDetails.id);

        if (taskError) throw taskError;

        // Recalculate totals (triggers will handle this automatically)
        toast.success('تم تحديث الأسعار بنجاح');
        onSuccess();
        onOpenChange(false);
      } catch (error) {
        console.error('Error updating composite task:', error);
        toast.error('فشل في تحديث الأسعار');
      } finally {
        setSubmitting(false);
      }
    } else {
      // Regular invoice update
      if (!formData.printer_name || !formData.invoice_date) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      try {
        setSubmitting(true);

        const { error } = await supabase
          .from('printed_invoices')
          .update({
            invoice_number: formData.invoice_number,
            printer_name: formData.printer_name,
            invoice_date: formData.invoice_date,
            total_amount: formData.total_amount ? Number(formData.total_amount) : null,
            printer_cost: formData.printer_cost ? Number(formData.printer_cost) : null,
            notes: formData.notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', invoiceId);

        if (error) throw error;

        toast.success('تم تحديث الفاتورة بنجاح');
        onSuccess();
        onOpenChange(false);
      } catch (error) {
        console.error('Error updating invoice:', error);
        toast.error('فشل في تحديث الفاتورة');
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCompositeTask ? 'تعديل فاتورة مجمعة' : 'تعديل فاتورة الطباعة'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isCompositeTask && compositeTaskDetails ? (
          <div className="space-y-4">
            {/* Composite Task Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  تفاصيل المهمة المجمعة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-blue-50 p-3 rounded">
                    <span className="text-muted-foreground block mb-1">التركيب</span>
                    <span className="font-bold text-blue-600">
                      {compositeTaskDetails.customer_installation_cost.toLocaleString()} د.ل
                    </span>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <span className="text-muted-foreground block mb-1">الطباعة</span>
                    <span className="font-bold text-green-600">
                      {compositeTaskDetails.customer_print_cost.toLocaleString()} د.ل
                    </span>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <span className="text-muted-foreground block mb-1">القص</span>
                    <span className="font-bold text-purple-600">
                      {compositeTaskDetails.customer_cutout_cost.toLocaleString()} د.ل
                    </span>
                  </div>
                </div>

                {/* Price Editing Section */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold">تعديل الأسعار</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPrices(!editingPrices)}
                    >
                      {editingPrices ? 'إلغاء التعديل' : 'تعديل الأسعار'}
                    </Button>
                  </div>

                  {editingPrices && (
                    <div className="space-y-4">
                      {compositeTaskDetails.print_task && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium">أسعار الطباعة</h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">سعر المتر للزبون (د.ل/م²)</Label>
                              <Input
                                type="number"
                                value={pricePerMeter}
                                onChange={(e) => setPricePerMeter(parseFloat(e.target.value) || 0)}
                                step="0.5"
                              />
                              <span className="text-xs text-muted-foreground">
                                الإجمالي: {(pricePerMeter * (compositeTaskDetails.print_task?.total_area || 0)).toLocaleString()} د.ل
                              </span>
                            </div>
                            <div>
                              <Label className="text-xs">سعر المتر للمطبعة (د.ل/م²)</Label>
                              <Input
                                type="number"
                                value={printerPricePerMeter}
                                onChange={(e) => setPrinterPricePerMeter(parseFloat(e.target.value) || 0)}
                                step="0.5"
                              />
                              <span className="text-xs text-muted-foreground">
                                الإجمالي: {(printerPricePerMeter * (compositeTaskDetails.print_task?.total_area || 0)).toLocaleString()} د.ل
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {compositeTaskDetails.cutout_task && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium">أسعار القص</h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">سعر الزبون (د.ل)</Label>
                              <Input
                                type="number"
                                value={cutoutCustomerPrice}
                                onChange={(e) => setCutoutCustomerPrice(parseFloat(e.target.value) || 0)}
                                step="0.5"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">سعر المطبعة (د.ل)</Label>
                              <Input
                                type="number"
                                value={cutoutPrinterPrice}
                                onChange={(e) => setCutoutPrinterPrice(parseFloat(e.target.value) || 0)}
                                step="0.5"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-purple-50 p-3 rounded">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">الربح المتوقع</span>
                          <span className="text-lg font-bold text-purple-600">
                            {(
                              (pricePerMeter * (compositeTaskDetails.print_task?.total_area || 0) + cutoutCustomerPrice) -
                              (printerPricePerMeter * (compositeTaskDetails.print_task?.total_area || 0) + cutoutPrinterPrice)
                            ).toLocaleString()} د.ل
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم الفاتورة</Label>
                <Input
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="رقم الفاتورة"
                />
              </div>

              <div className="space-y-2">
                <Label>اسم المطبعة <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.printer_name}
                  onChange={(e) => setFormData({ ...formData, printer_name: e.target.value })}
                  placeholder="اسم المطبعة"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ الفاتورة <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>المبلغ الإجمالي (للعميل)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تكلفة المطبعة (سعر التكلفة)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.printer_cost}
                  onChange={(e) => setFormData({ ...formData, printer_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2 flex items-end">
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800 w-full">
                  <p className="text-sm text-muted-foreground mb-1">الربح المتوقع</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {((Number(formData.total_amount) || 0) - (Number(formData.printer_cost) || 0)).toLocaleString('ar-LY')} د.ل
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading}
          >
            {submitting ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جارٍ الحفظ...
              </>
            ) : (
              'حفظ التعديلات'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
