import { useState, useEffect } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Purchase {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  purchase_date: string;
  notes?: string;
}

interface PurchasesSectionProps {
  customerId: string;
  customerName: string;
}

export function PurchasesSection({ customerId, customerName }: PurchasesSectionProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { confirm: systemConfirm } = useSystemDialog();
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const loadPurchases = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_purchases')
        .select('*')
        .eq('customer_id', customerId)
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error('Error loading purchases:', error);
      toast.error('فشل تحميل المشتريات');
    }
  };

  useEffect(() => {
    if (customerId) {
      loadPurchases();
    }
  }, [customerId]);

  const openAddDialog = () => {
    setEditingPurchase(null);
    setItemName('');
    setQuantity('1');
    setUnitPrice('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setDialogOpen(true);
  };

  const openEditDialog = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setItemName(purchase.item_name);
    setQuantity(String(purchase.quantity));
    setUnitPrice(String(purchase.unit_price));
    setPurchaseDate(purchase.purchase_date);
    setNotes(purchase.notes || '');
    setDialogOpen(true);
  };

  const savePurchase = async () => {
    try {
      const qty = Number(quantity);
      const price = Number(unitPrice);

      if (!itemName.trim()) {
        toast.error('يرجى إدخال اسم المشتريات');
        return;
      }

      if (qty <= 0) {
        toast.error('يرجى إدخال كمية صحيحة');
        return;
      }

      if (price <= 0) {
        toast.error('يرجى إدخال سعر صحيح');
        return;
      }

      const purchaseData = {
        customer_id: customerId,
        customer_name: customerName,
        item_name: itemName.trim(),
        quantity: qty,
        unit_price: price,
        purchase_date: purchaseDate,
        notes: notes.trim() || null
      };

      if (editingPurchase) {
        // Update existing purchase
        const { error } = await supabase
          .from('customer_purchases')
          .update(purchaseData)
          .eq('id', editingPurchase.id);

        if (error) throw error;
        toast.success('تم تحديث المشتريات بنجاح');
      } else {
        // Add new purchase
        const { error } = await supabase
          .from('customer_purchases')
          .insert(purchaseData);

        if (error) throw error;
        toast.success('تم إضافة المشتريات بنجاح');
      }

      setDialogOpen(false);
      await loadPurchases();
    } catch (error) {
      console.error('Error saving purchase:', error);
      toast.error('فشل حفظ المشتريات');
    }
  };

  const deletePurchase = async (id: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل تريد حذف هذه المشتريات؟', variant: 'destructive', confirmText: 'حذف' })) return;

    try {
      const { error } = await supabase
        .from('customer_purchases')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف المشتريات');
      await loadPurchases();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast.error('فشل حذف المشتريات');
    }
  };

  const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.total_price), 0);

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-primary">
              مشتريات من العميل
            </CardTitle>
            <Button
              onClick={openAddDialog}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 ml-2" />
              إضافة مشتريات
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {purchases.length > 0 ? (
            <>
              <div className="expenses-table-container">
                <table className="w-full">
                  <thead>
                    <tr className="expenses-table-header">
                      <th>التاريخ</th>
                      <th>الصنف</th>
                      <th>الكمية</th>
                      <th>سعر الوحدة</th>
                      <th>الإجمالي</th>
                      <th>ملاحظات</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((purchase) => (
                      <tr key={purchase.id} className="expenses-table-row">
                        <td>{new Date(purchase.purchase_date).toLocaleDateString('ar-LY')}</td>
                        <td>{purchase.item_name}</td>
                        <td className="num">{purchase.quantity}</td>
                        <td className="num">{Number(purchase.unit_price).toLocaleString('ar-LY')} د.ل</td>
                        <td className="expenses-amount-calculated num">
                          {Number(purchase.total_price).toLocaleString('ar-LY')} د.ل
                        </td>
                        <td className="text-sm text-muted-foreground">{purchase.notes || '—'}</td>
                        <td>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(purchase)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deletePurchase(purchase.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="expenses-table-row font-bold">
                      <td colSpan={4} className="text-left">الإجمالي:</td>
                      <td className="expenses-amount-calculated num">
                        {totalPurchases.toLocaleString('ar-LY')} د.ل
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              لا توجد مشتريات من هذا العميل
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Purchase Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border" dir="rtl">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-lg font-bold text-primary text-right">
              {editingPurchase ? 'تعديل المشتريات' : 'إضافة مشتريات'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">اسم الصنف *</Label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="text-right bg-input border-border text-foreground"
                placeholder="مثال: حبر، ورق، خامات..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">الكمية *</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="text-right bg-input border-border text-foreground"
                  placeholder="1"
                  min="0.01"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">سعر الوحدة *</Label>
                <Input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="text-right bg-input border-border text-foreground"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {quantity && unitPrice && (
              <div className="bg-accent/10 border border-primary/30 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">الإجمالي:</span>
                  <span className="text-lg font-bold text-primary">
                    {(Number(quantity) * Number(unitPrice)).toLocaleString('ar-LY')} د.ل
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">التاريخ</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
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
                onClick={() => setDialogOpen(false)}
                className="border-border text-muted-foreground hover:bg-muted"
              >
                إلغاء
              </Button>
              <Button
                onClick={savePurchase}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {editingPurchase ? 'حفظ التعديلات' : 'إضافة'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
