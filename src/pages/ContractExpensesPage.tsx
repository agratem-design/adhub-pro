// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle, Plus, Trash2, Wrench, Printer, Home,
  ArrowRight, Package, Hash, DollarSign, Calculator,
  FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Expense {
  id?: string;
  contract_number: number;
  amount: number;
  reason: string;
  expense_type: 'installation' | 'print' | 'rental';
  item_name?: string;
  quantity?: number;
  unit_price?: number;
  notes?: string;
  created_at?: string;
}

const TYPE_CONFIG = {
  installation: { label: 'تركيب', icon: Wrench, color: 'border-primary/40 bg-primary/5', badgeClass: 'bg-primary/20 text-primary border-primary/30' },
  print: { label: 'طباعة', icon: Printer, color: 'border-secondary/40 bg-secondary/5', badgeClass: 'bg-secondary/20 text-secondary-foreground border-secondary/30' },
  rental: { label: 'إيجار', icon: Home, color: 'border-accent/40 bg-accent/5', badgeClass: 'bg-accent/20 text-accent-foreground border-accent/30' },
};

export default function ContractExpensesPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contractInfo, setContractInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [form, setForm] = useState({
    item_name: '',
    quantity: '1',
    unit_price: '',
    reason: '',
    expense_type: 'installation' as 'installation' | 'print' | 'rental',
    notes: '',
  });

  const { confirm: systemConfirm } = useSystemDialog();
  const numericId = Number(contractId);

  const computedAmount = (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_price) || 0);

  useEffect(() => {
    if (!numericId || isNaN(numericId)) return;
    loadData();
  }, [numericId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expensesRes, contractRes] = await Promise.all([
        supabase
          .from('contract_expenses')
          .select('*')
          .eq('contract_number', numericId)
          .order('created_at', { ascending: false }),
        supabase
          .from('Contract')
          .select('"Contract_Number", "Customer Name", "Total", "Total Rent", "Discount", installation_cost, print_cost')
          .eq('Contract_Number', numericId)
          .single(),
      ]);

      if (expensesRes.error) throw expensesRes.error;
      setExpenses(expensesRes.data || []);

      if (contractRes.data) setContractInfo(contractRes.data);
    } catch (e) {
      console.error(e);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.item_name.trim()) { toast.error('يرجى إدخال اسم الصنف'); return; }
    if (!form.reason.trim()) { toast.error('يرجى إدخال السبب'); return; }
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.unit_price);
    if (!qty || qty <= 0) { toast.error('الكمية يجب أن تكون أكبر من صفر'); return; }
    if (!price || price <= 0) { toast.error('يرجى إدخال سعر الوحدة'); return; }

    const totalAmount = qty * price;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('contract_expenses')
        .insert({
          contract_number: numericId,
          amount: totalAmount,
          reason: form.reason.trim(),
          expense_type: form.expense_type,
          item_name: form.item_name.trim(),
          quantity: qty,
          unit_price: price,
          notes: form.notes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      setExpenses(prev => [data, ...prev]);
      setForm({ item_name: '', quantity: '1', unit_price: '', reason: '', expense_type: 'installation', notes: '' });
      setShowForm(false);
      toast.success('تمت إضافة المصروف بنجاح');
    } catch (e: any) {
      console.error(e);
      toast.error('فشل في إضافة المصروف');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا المصروف؟', variant: 'destructive', confirmText: 'حذف' })) return;
    try {
      const { error } = await supabase.from('contract_expenses').delete().eq('id', expense.id);
      if (error) throw error;
      setExpenses(prev => prev.filter(e => e.id !== expense.id));
      toast.success('تم حذف المصروف');
    } catch (e) {
      toast.error('فشل في الحذف');
    }
  };

  const totalByType = {
    installation: expenses.filter(e => e.expense_type === 'installation').reduce((s, e) => s + Number(e.amount), 0),
    print: expenses.filter(e => e.expense_type === 'print').reduce((s, e) => s + Number(e.amount), 0),
    rental: expenses.filter(e => e.expense_type === 'rental').reduce((s, e) => s + Number(e.amount), 0),
  };
  const grandTotal = Object.values(totalByType).reduce((a, b) => a + b, 0);

  const contractTotal = contractInfo?.Total || contractInfo?.['Total Rent'] || 0;
  const netAfterExpenses = contractTotal - grandTotal;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-5 font-cairo" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              مصاريف وخسائر العقد
            </h1>
            {contractInfo && (
              <p className="text-xs sm:text-sm text-muted-foreground">
                عقد رقم #{numericId} — {contractInfo['Customer Name']}
              </p>
            )}
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 w-full sm:w-auto">
          {showForm ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'إغلاق' : 'إضافة مصروف'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(TYPE_CONFIG) as Array<keyof typeof TYPE_CONFIG>).map(type => {
          const cfg = TYPE_CONFIG[type];
          const Icon = cfg.icon;
          const total = totalByType[type];
          return (
            <Card key={type} className={`border ${cfg.color}`}>
              <CardContent className="p-3 flex items-center gap-2">
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{cfg.label}</div>
                  <div className="font-bold text-sm truncate">{total.toLocaleString('ar-LY')} د.ل</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Card className="border border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-destructive shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-destructive">الإجمالي</div>
              <div className="font-bold text-sm text-destructive truncate">{grandTotal.toLocaleString('ar-LY')} د.ل</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contract profit summary */}
      {contractInfo && grandTotal > 0 && (
        <Card className="border border-border/50">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground mb-1">إجمالي العقد</div>
                <div className="font-bold text-primary">{Number(contractTotal).toLocaleString('ar-LY')} د.ل</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">إجمالي المصاريف</div>
                <div className="font-bold text-destructive">- {grandTotal.toLocaleString('ar-LY')} د.ل</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">صافي بعد المصاريف</div>
                <div className={`font-bold ${netAfterExpenses >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {netAfterExpenses.toLocaleString('ar-LY')} د.ل
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add form */}
      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              إضافة مصروف / خسارة جديدة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Type */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">نوع المصروف *</label>
              <Select value={form.expense_type} onValueChange={v => setForm(f => ({ ...f, expense_type: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="installation"><span className="flex items-center gap-2"><Wrench className="h-3 w-3" /> تركيب</span></SelectItem>
                  <SelectItem value="print"><span className="flex items-center gap-2"><Printer className="h-3 w-3" /> طباعة</span></SelectItem>
                  <SelectItem value="rental"><span className="flex items-center gap-2"><Home className="h-3 w-3" /> إيجار</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Item name */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">اسم الصنف / العنصر *</label>
              <Input
                placeholder="مثال: دهان، حديد، ورق طباعة..."
                value={form.item_name}
                onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
              />
            </div>

            {/* Quantity & Unit Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                  <Hash className="h-3 w-3" /> الكمية *
                </label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  placeholder="1"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> سعر الوحدة (د.ل) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.unit_price}
                  onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                />
              </div>
            </div>

            {/* Auto total */}
            {computedAmount > 0 && (
              <div className="flex items-center justify-between bg-muted/50 rounded p-2">
                <span className="text-xs text-muted-foreground">الإجمالي ({form.quantity} × {parseFloat(form.unit_price || '0').toLocaleString('ar-LY')})</span>
                <span className="font-bold text-destructive">{computedAmount.toLocaleString('ar-LY')} د.ل</span>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">السبب / الوصف *</label>
              <Input
                placeholder="وصف المصروف أو سبب الخسارة"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ملاحظات (اختياري)</label>
              <Textarea
                placeholder="ملاحظات إضافية..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="h-16 text-sm resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleAdd} disabled={saving} className="flex-1">
                <Plus className="h-4 w-4 ml-1" />
                {saving ? 'جاري الإضافة...' : 'إضافة المصروف'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            قائمة المصاريف والخسائر
            {expenses.length > 0 && (
              <Badge variant="destructive" className="mr-auto">{expenses.length} عنصر</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm opacity-60">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              لا توجد مصاريف أو خسائر مسجلة
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table header - hidden on mobile */}
              <div className="hidden sm:grid grid-cols-6 gap-2 text-xs text-muted-foreground px-3 py-1 bg-muted/30 rounded">
                <div className="col-span-2">الصنف / السبب</div>
                <div className="text-center">النوع</div>
                <div className="text-center">الكمية</div>
                <div className="text-center">سعر الوحدة</div>
                <div className="text-center">الإجمالي</div>
              </div>

              {expenses.map((expense) => {
                const cfg = TYPE_CONFIG[expense.expense_type];
                const Icon = cfg.icon;
                const qty = Number(expense.quantity) || 1;
                const unitP = Number(expense.unit_price) || Number(expense.amount);
                const total = Number(expense.amount);
                return (
                  <div
                    key={expense.id}
                    className="flex flex-col sm:grid sm:grid-cols-6 gap-1 sm:gap-2 sm:items-center px-3 py-2.5 rounded-lg border border-border/40 hover:bg-muted/20 group transition-colors"
                  >
                    <div className="sm:col-span-2 min-w-0">
                      <div className="font-medium text-sm truncate">{expense.item_name || expense.reason}</div>
                      {expense.item_name && expense.reason !== expense.item_name && (
                        <div className="text-xs text-muted-foreground truncate">{expense.reason}</div>
                      )}
                      {expense.notes && (
                        <div className="text-xs text-muted-foreground/70 truncate italic">{expense.notes}</div>
                      )}
                    </div>
                    <div className="flex sm:justify-center items-center gap-2 sm:gap-0">
                      <span className="text-xs text-muted-foreground sm:hidden">النوع:</span>
                      <Badge className={`text-xs ${cfg.badgeClass}`}>
                        <Icon className="h-3 w-3 ml-1" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="flex sm:justify-center sm:block items-center gap-2">
                      <span className="text-xs text-muted-foreground sm:hidden">الكمية:</span>
                      <span className="text-sm font-medium sm:text-center">{qty.toLocaleString('ar-LY')}</span>
                    </div>
                    <div className="flex sm:justify-center sm:block items-center gap-2">
                      <span className="text-xs text-muted-foreground sm:hidden">سعر الوحدة:</span>
                      <span className="text-sm sm:text-center">{unitP.toLocaleString('ar-LY')} <span className="text-xs text-muted-foreground">د.ل</span></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground sm:hidden">الإجمالي:</span>
                        <span className="font-bold text-destructive text-sm">{total.toLocaleString('ar-LY')} <span className="text-xs">د.ل</span></span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(expense)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Grand total row */}
              <div className="flex justify-between items-center pt-2 border-t border-border mt-2 px-3">
                <span className="font-semibold text-sm">الإجمالي الكلي للمصاريف</span>
                <span className="font-bold text-destructive text-lg">{grandTotal.toLocaleString('ar-LY')} د.ل</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
