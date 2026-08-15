import { useState, useEffect } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2, Percent, DollarSign } from 'lucide-react';

interface GeneralDiscount {
  id: string;
  customer_id: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  reason?: string;
  applied_date: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

interface GeneralDiscountsSectionProps {
  customerId: string | null;
  customerName: string;
  onDiscountChange?: () => void;
}

export default function GeneralDiscountsSection({ 
  customerId, 
  customerName,
  onDiscountChange 
}: GeneralDiscountsSectionProps) {
  const { confirm: systemConfirm } = useSystemDialog();
  const [discounts, setDiscounts] = useState<GeneralDiscount[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<GeneralDiscount | null>(null);
  
  // Form states
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [reason, setReason] = useState('');
  const [appliedDate, setAppliedDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  useEffect(() => {
    if (customerId) {
      loadDiscounts();
    }
  }, [customerId]);

  const loadDiscounts = async () => {
    if (!customerId) return;

    try {
      const { data, error } = await supabase
        .from('customer_general_discounts')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDiscounts((data || []) as GeneralDiscount[]);
    } catch (error) {
      console.error('Error loading discounts:', error);
      toast.error('فشل تحميل الخصومات');
    }
  };

  const openAddDialog = () => {
    setEditingDiscount(null);
    setDiscountType('percentage');
    setDiscountValue('');
    setReason('');
    setAppliedDate(new Date().toISOString().slice(0, 10));
    setStatus('active');
    setDialogOpen(true);
  };

  const openEditDialog = (discount: GeneralDiscount) => {
    setEditingDiscount(discount);
    setDiscountType(discount.discount_type);
    setDiscountValue(String(discount.discount_value));
    setReason(discount.reason || '');
    setAppliedDate(discount.applied_date);
    setStatus(discount.status);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!customerId) {
      toast.error('معرف العميل مفقود');
      return;
    }

    if (!discountValue || Number(discountValue) <= 0) {
      toast.error('يرجى إدخال قيمة خصم صالحة');
      return;
    }

    try {
      const payload = {
        customer_id: customerId,
        discount_type: discountType,
        discount_value: Number(discountValue),
        reason: reason || null,
        applied_date: appliedDate,
        status: status,
      };

      if (editingDiscount) {
        const { error } = await supabase
          .from('customer_general_discounts')
          .update(payload)
          .eq('id', editingDiscount.id);

        if (error) throw error;
        toast.success('تم تحديث الخصم بنجاح');
      } else {
        const { error } = await supabase
          .from('customer_general_discounts')
          .insert(payload);

        if (error) throw error;
        toast.success('تم إضافة الخصم بنجاح');
      }

      setDialogOpen(false);
      loadDiscounts();
      if (onDiscountChange) onDiscountChange();
    } catch (error: any) {
      console.error('Error saving discount:', error);
      toast.error(`فشل حفظ الخصم: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  const handleDelete = async (discountId: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا الخصم؟', variant: 'destructive', confirmText: 'حذف' })) return;

    try {
      const { error } = await supabase
        .from('customer_general_discounts')
        .delete()
        .eq('id', discountId);

      if (error) throw error;
      toast.success('تم حذف الخصم بنجاح');
      loadDiscounts();
      if (onDiscountChange) onDiscountChange();
    } catch (error: any) {
      console.error('Error deleting discount:', error);
      toast.error(`فشل حذف الخصم: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  const formatDiscount = (discount: GeneralDiscount) => {
    if (discount.discount_type === 'percentage') {
      return `${discount.discount_value}%`;
    }
    return `${discount.discount_value.toLocaleString()} د.ل`;
  };

  const calculateTotalActiveDiscount = () => {
    const activeDiscounts = discounts.filter(d => d.status === 'active');
    const percentageTotal = activeDiscounts
      .filter(d => d.discount_type === 'percentage')
      .reduce((sum, d) => sum + d.discount_value, 0);
    const fixedTotal = activeDiscounts
      .filter(d => d.discount_type === 'fixed')
      .reduce((sum, d) => sum + d.discount_value, 0);

    return { percentageTotal, fixedTotal };
  };

  const { percentageTotal, fixedTotal } = calculateTotalActiveDiscount();

  return (
    <>
      <Card className="border border-amber-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl overflow-hidden relative group transition-all duration-300 hover:border-amber-500/30 rounded-2xl mt-6">
        <CardHeader className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/20 text-white py-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/10">
                <Percent className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-white">الخصومات</CardTitle>
                <p className="text-white/70 text-sm mt-0.5">سجل الخصومات العامة الممنوحة للعميل</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              {/* إجمالي الخصومات */}
              {discounts.length > 0 && (percentageTotal > 0 || fixedTotal > 0) && (
                <div className="flex gap-3 text-sm bg-white/5 border border-white/10 rounded-lg p-2">
                  {percentageTotal > 0 && (
                    <div className="flex items-center gap-1 text-amber-400">
                      <Percent className="h-4 w-4" />
                      <span className="font-semibold">{percentageTotal}% نسبة مئوية</span>
                    </div>
                  )}
                  {fixedTotal > 0 && (
                    <div className="flex items-center gap-1 text-amber-400">
                      <DollarSign className="h-4 w-4" />
                      <span className="font-semibold">{fixedTotal.toLocaleString('ar-LY')} د.ل مبلغ ثابت</span>
                    </div>
                  )}
                </div>
              )}
              
              <Button 
                onClick={openAddDialog} 
                className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة خصم
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {discounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Percent className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد خصومات مضافة لهذا العميل</p>
            </div>
          ) : (
            <>
              {/* ملخص الخصومات النشطة */}
              {(percentageTotal > 0 || fixedTotal > 0) && (
                <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                  <h4 className="font-bold text-emerald-400 text-sm mb-2">إجمالي الخصومات النشطة:</h4>
                  <div className="flex gap-4 text-sm text-emerald-300">
                    {percentageTotal > 0 && (
                      <div className="flex items-center gap-1 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10">
                        <Percent className="h-4 w-4 text-emerald-400" />
                        <span>{percentageTotal}% نسبة مئوية</span>
                      </div>
                    )}
                    {fixedTotal > 0 && (
                      <div className="flex items-center gap-1 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10">
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                        <span>{fixedTotal.toLocaleString('ar-LY')} د.ل مبلغ ثابت</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* جدول الخصومات */}
              <div className="border border-white/10 rounded-xl overflow-hidden mt-4 bg-slate-900/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 hover:bg-muted/50 border-b border-white/10">
                      <th className="text-right p-4 font-bold text-white">نوع الخصم</th>
                      <th className="text-right p-4 font-bold text-white">القيمة</th>
                      <th className="text-right p-4 font-bold text-white">السبب</th>
                      <th className="text-right p-4 font-bold text-white">تاريخ التطبيق</th>
                      <th className="text-right p-4 font-bold text-white">الحالة</th>
                      <th className="text-center p-4 font-bold text-white">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discounts.map((discount) => (
                      <tr key={discount.id} className="border-b border-white/5 hover:bg-white/5 transition-all duration-150">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {discount.discount_type === 'percentage' ? (
                              <Percent className="h-4 w-4 text-amber-500" />
                            ) : (
                              <DollarSign className="h-4 w-4 text-amber-500" />
                            )}
                            <span className="text-white">
                              {discount.discount_type === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-white">{formatDiscount(discount)}</td>
                        <td className="p-4 text-white/70">{discount.reason || '-'}</td>
                        <td className="p-4 text-white/70">{new Date(discount.applied_date).toLocaleDateString('ar-LY')}</td>
                        <td className="p-4">
                          <Badge 
                            variant={discount.status === 'active' ? 'default' : 'secondary'}
                            className={discount.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-slate-700/50 text-slate-300 border border-slate-600/30'}
                          >
                            {discount.status === 'active' ? 'نشط' : 'غير نشط'}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(discount)}
                              className="text-amber-500 hover:text-amber-400 hover:bg-white/5 cursor-pointer transition-all duration-200"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(discount.id)}
                              className="text-red-500 hover:text-red-400 hover:bg-white/5 cursor-pointer transition-all duration-200"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog لإضافة/تعديل الخصم */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingDiscount ? 'تعديل الخصم' : 'إضافة خصم جديد'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>نوع الخصم</Label>
              <Select value={discountType} onValueChange={(v: 'percentage' | 'fixed') => setDiscountType(v)}>
                <SelectTrigger className="text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                  <SelectItem value="fixed">مبلغ ثابت (د.ل)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>قيمة الخصم</Label>
              <Input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percentage' ? '10' : '100'}
                className="text-right"
                min="0"
                step={discountType === 'percentage' ? '0.1' : '1'}
              />
            </div>

            <div>
              <Label>السبب (اختياري)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="سبب منح الخصم..."
                className="text-right"
              />
            </div>

            <div>
              <Label>تاريخ التطبيق</Label>
              <Input
                type="date"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
                className="text-right"
              />
            </div>

            <div>
              <Label>الحالة</Label>
              <Select value={status} onValueChange={(v: 'active' | 'inactive') => setStatus(v)}>
                <SelectTrigger className="text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleSave}>
                {editingDiscount ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}