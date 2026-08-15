import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Printer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { DesignDisplayCard } from './DesignDisplayCard';

interface PrintItem {
  id: string;
  description: string;
  width: number;
  height: number;
  quantity: number;
  design_face_a: string;
  design_face_b: string;
  model_link: string;
  has_cutout: boolean;
}

interface DesignGroup {
  design: string | null;
  face: 'a' | 'b';
  size: string;
  quantity: number;
  area: number;
  width: number;
  height: number;
}

interface CreateManualPrintTaskProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateManualPrintTask({ open, onOpenChange, onSuccess }: CreateManualPrintTaskProps) {
  const [customerName, setCustomerName] = useState('');
  const [printerId, setPrinterId] = useState('');
  const [customerTotalAmount, setCustomerTotalAmount] = useState(0);
  const [printerPricePerMeter, setPrinterPricePerMeter] = useState(0);
  const [cutoutPrinterCost, setCutoutPrinterCost] = useState(0);
  const [modelLink, setModelLink] = useState('');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PrintItem[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: printers = [] } = useQuery({
    queryKey: ['printers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  const designGroups = useMemo(() => {
    const groups: Record<string, DesignGroup> = {};

    items.forEach(item => {
      const size = `${item.width}×${item.height}`;
      
      if (item.design_face_a) {
        const keyA = `${size}_${item.design_face_a}_a`;
        if (!groups[keyA]) {
          groups[keyA] = {
            design: item.design_face_a,
            face: 'a' as const,
            size,
            quantity: 0,
            area: item.width * item.height,
            width: item.width,
            height: item.height
          };
        }
        groups[keyA].quantity += item.quantity;
      }

      if (item.design_face_b) {
        const keyB = `${size}_${item.design_face_b}_b`;
        if (!groups[keyB]) {
          groups[keyB] = {
            design: item.design_face_b,
            face: 'b' as const,
            size,
            quantity: 0,
            area: item.width * item.height,
            width: item.width,
            height: item.height
          };
        }
        groups[keyB].quantity += item.quantity;
      }
    });

    return Object.values(groups);
  }, [items]);

  const addItem = () => {
    setItems([...items, {
      id: `temp_${Date.now()}`,
      description: '',
      width: 3,
      height: 4,
      quantity: 1,
      design_face_a: '',
      design_face_b: '',
      model_link: '',
      has_cutout: false
    }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof PrintItem, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const totalArea = items.reduce((sum, item) => 
    sum + (item.width * item.height * item.quantity), 0
  );

  const totalPrinterCost = totalArea * printerPricePerMeter;
  const profit = customerTotalAmount - totalPrinterCost - cutoutPrinterCost;

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error('يرجى إدخال اسم العميل');
      return;
    }

    if (items.length === 0) {
      toast.error('يرجى إضافة بند واحد على الأقل');
      return;
    }

    if (customerTotalAmount <= 0) {
      toast.error('يرجى إدخال سعر الزبون');
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // إنشاء فاتورة طباعة مطابقة لمهام الطباعة من التركيب
      const manualInvoiceNumber = `PTM-${Date.now()}`;
      const { data: invoice, error: invoiceError } = await supabase
        .from('printed_invoices')
        .insert({
          contract_number: null, // لا يوجد عقد مرتبط مباشرة بالمهمة اليدوية
          invoice_number: manualInvoiceNumber,
          customer_id: null, // لا نملك معرف العميل هنا، فقط الاسم
          customer_name: customerName,
          printer_id: printerId || null,
          printer_name: printers.find((p) => p.id === printerId)?.name || 'غير محدد',
          invoice_date: today,
          total_amount: customerTotalAmount,
          printer_cost: totalPrinterCost,
          invoice_type: 'print',
          notes: notes || `مهمة طباعة يدوية`
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // إنشاء مهمة الطباعة وربطها بالفاتورة
      const { data: task, error: taskError } = await supabase
        .from('print_tasks')
        .insert({
          invoice_id: invoice.id,
          contract_id: null,
          customer_id: null,
          customer_name: customerName,
          customer_total_amount: customerTotalAmount,
          printer_id: printerId || null,
          status: 'pending',
          total_area: totalArea,
          total_cost: totalPrinterCost,
          customer_total_cost: totalPrinterCost + cutoutPrinterCost,
          price_per_meter: printerPricePerMeter,
          cutout_cost: cutoutPrinterCost,
          priority,
          notes,
          has_cutouts: cutoutPrinterCost > 0,
          cutout_quantity: items
            .filter((i) => i.has_cutout)
            .reduce((sum, i) => sum + i.quantity, 0)
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // إنشاء بنود مهمة الطباعة
      const taskItems = items.map((item) => ({
        task_id: task.id,
        description: item.description || `${item.width}x${item.height}`,
        width: item.width,
        height: item.height,
        area: item.width * item.height,
        quantity: item.quantity,
        unit_cost: 0,
        total_cost: 0,
        design_face_a: item.design_face_a || null,
        design_face_b: item.design_face_b || null,
        model_link: item.model_link || null,
        has_cutout: item.has_cutout || false,
        status: 'pending'
      }));

      const { error: itemsError } = await supabase
        .from('print_task_items')
        .insert(taskItems);

      if (itemsError) throw itemsError;

      // تسجيل في حساب العميل (قيد فاتورة طباعة)
      await supabase.from('customer_payments').insert({
        customer_id: null,
        customer_name: customerName,
        printed_invoice_id: invoice.id,
        amount: -customerTotalAmount,
        entry_type: 'invoice',
        paid_at: today,
        method: 'حساب',
        notes: `فاتورة طباعة يدوية ${manualInvoiceNumber}`
      });

      toast.success('تم إنشاء مهمة الطباعة والفاتورة بنجاح');
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setCustomerName('');
      setPrinterId('');
      setCustomerTotalAmount(0);
      setPrinterPricePerMeter(0);
      setCutoutPrinterCost(0);
      setModelLink('');
      setPriority('normal');
      setNotes('');
      setItems([]);
    } catch (error: any) {
      console.error('Error creating print task:', error);
      toast.error('فشل في إنشاء مهمة الطباعة: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            إنشاء مهمة طباعة يدوية
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer and Printer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>اسم العميل *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="اسم العميل"
              />
            </div>
            <div>
              <Label>المطبعة</Label>
              <Select value={printerId} onValueChange={setPrinterId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المطبعة" />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      {printer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pricing Section */}
          <Card className="p-4 border-2 border-primary">
            <h3 className="text-lg font-bold mb-4">التسعير والأرباح</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>سعر الزبون الكلي (د.ل) *</Label>
                <Input
                  type="number"
                  value={customerTotalAmount}
                  onChange={(e) => setCustomerTotalAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.1"
                  placeholder="السعر الذي يدفعه الزبون"
                />
              </div>
              <div>
                <Label>سعر المطبعة للمتر (د.ل)</Label>
                <Input
                  type="number"
                  value={printerPricePerMeter}
                  onChange={(e) => setPrinterPricePerMeter(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.1"
                  placeholder="سعر المتر للمطبعة"
                />
              </div>
              <div>
                <Label>تكلفة القص (د.ل)</Label>
                <Input
                  type="number"
                  value={cutoutPrinterCost}
                  onChange={(e) => setCutoutPrinterCost(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.1"
                  placeholder="تكلفة خدمة القص"
                />
              </div>
              <div>
                <Label>الربح (تلقائي)</Label>
                <Input
                  type="number"
                  value={profit.toFixed(2)}
                  disabled
                  className="bg-muted font-bold"
                />
              </div>
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">المساحة الكلية:</span>
                  <div className="font-bold text-primary">{totalArea.toFixed(2)} م²</div>
                </div>
                <div>
                  <span className="text-muted-foreground">تكلفة الطباعة:</span>
                  <div className="font-bold">{totalPrinterCost.toFixed(2)} د.ل</div>
                </div>
                <div>
                  <span className="text-muted-foreground">التكلفة الكلية:</span>
                  <div className="font-bold">{(totalPrinterCost + cutoutPrinterCost).toFixed(2)} د.ل</div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Label>رابط المجسمات</Label>
              <Input
                type="url"
                value={modelLink}
                onChange={(e) => setModelLink(e.target.value)}
                placeholder="https://example.com/models"
              />
            </div>
          </Card>

          {/* Priority and Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>الأولوية</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="normal">عادية</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية"
              rows={2}
            />
          </div>

          {/* Items Input Form */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-lg font-semibold">البنود</Label>
              <Button onClick={addItem} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                إضافة بند
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 grid grid-cols-6 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs">الوصف</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          placeholder="وصف البند"
                          size={1}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">العرض (م)</Label>
                        <Input
                          type="number"
                          value={item.width}
                          onChange={(e) => updateItem(item.id, 'width', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.1"
                          size={1}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">الارتفاع (م)</Label>
                        <Input
                          type="number"
                          value={item.height}
                          onChange={(e) => updateItem(item.id, 'height', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.1"
                          size={1}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">الكمية</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          min="1"
                          size={1}
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="text-sm font-semibold text-center w-full">
                          {(item.width * item.height * item.quantity).toFixed(2)} م²
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="text-destructive mt-6"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label className="text-xs">رابط التصميم - الوجه الأمامي</Label>
                      <Input
                        value={item.design_face_a}
                        onChange={(e) => updateItem(item.id, 'design_face_a', e.target.value)}
                        placeholder="رابط التصميم الأمامي"
                        size={1}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">رابط التصميم - الوجه الخلفي</Label>
                      <Input
                        value={item.design_face_b}
                        onChange={(e) => updateItem(item.id, 'design_face_b', e.target.value)}
                        placeholder="رابط التصميم الخلفي"
                        size={1}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label className="text-xs">رابط المجسم</Label>
                      <Input
                        value={item.model_link}
                        onChange={(e) => updateItem(item.id, 'model_link', e.target.value)}
                        placeholder="رابط صورة المجسم"
                        size={1}
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.has_cutout}
                          onChange={(e) => updateItem(item.id, 'has_cutout', e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">يحتوي على مجسم</span>
                      </label>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                اضغط على "إضافة بند" لإضافة بنود الطباعة
              </div>
            )}
          </div>

          {/* Design Summary */}
          {designGroups.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">ملخص التصاميم المطلوبة:</h3>
              
              {designGroups.map((group, index) => (
                <DesignDisplayCard
                  key={index}
                  group={group}
                  index={index}
                  editMode={false}
                />
              ))}

              {/* Design Summary Stats */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">عدد التصاميم</div>
                      <div className="text-2xl font-bold">{designGroups.length}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">إجمالي الكمية</div>
                      <div className="text-2xl font-bold">{designGroups.reduce((sum, g) => sum + g.quantity, 0)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">إجمالي المساحة</div>
                      <div className="text-2xl font-bold text-primary">{totalArea.toFixed(2)} م²</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">سعر الزبون</div>
                      <div className="text-2xl font-bold text-primary">{customerTotalAmount.toLocaleString()} د.ل</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={loading || items.length === 0 || customerTotalAmount <= 0}>
              {loading ? 'جاري الإنشاء...' : 'إنشاء المهمة'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
