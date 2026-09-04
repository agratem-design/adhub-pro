// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { createRequestId } from '@/lib/requestId';
import '@/components/finance/finance.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Wallet } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense: {
    id: string;
    amount: number;
    paid_amount?: number;
    description: string;
    employee_id?: string;
  } | null;
  onSuccess?: () => void;
}

interface CustodyAccount {
  id: string;
  account_number: string;
  current_balance: number;
  employee_id: string;
}

export function DirectExpensePaymentDialog({ open, onOpenChange, expense, onSuccess }: Props) {
  const [amount, setAmount] = useState('');
  const [sourceType, setSourceType] = useState<'cash' | 'bank' | 'custody' | 'other'>('cash');
  const [sourceDetails, setSourceDetails] = useState('');
  const [custodyId, setCustodyId] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const requestId = useRef(createRequestId());
  const [custodyAccounts, setCustodyAccounts] = useState<CustodyAccount[]>([]);

  const remaining = expense ? Number(expense.amount) - Number(expense.paid_amount || 0) : 0;

  useEffect(() => {
    if (!open) return;
    requestId.current = createRequestId();
    setAmount(remaining > 0 ? String(remaining) : '');
    setSourceType('cash');
    setSourceDetails('');
    setCustodyId('');
    setPaidAt(new Date().toISOString().split('T')[0]);
    setNotes('');
    // Load custody accounts (for current employee if available)
    (async () => {
      let q = supabase.from('custody_accounts').select('id, account_number, current_balance, employee_id').eq('status', 'active');
      if (expense?.employee_id) q = q.eq('employee_id', expense.employee_id);
      const { data } = await q;
      setCustodyAccounts((data as any) || []);
    })();
  }, [open, expense?.id]);

  const handleSave = async () => {
    if (!expense || savingRef.current) return;
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }
    if (amt > remaining + 0.01) {
      toast.error(`المبلغ أكبر من المتبقي (${remaining.toFixed(2)} د.ل)`);
      return;
    }

    let payment_source = '';
    if (sourceType === 'cash') payment_source = 'cash';
    else if (sourceType === 'bank') payment_source = `bank:${sourceDetails || 'main'}`;
    else if (sourceType === 'custody') {
      if (!custodyId) {
        toast.error('اختر حساب العهدة');
        return;
      }
      payment_source = `custody:${custodyId}`;
      const account = custodyAccounts.find(c => c.id === custodyId);
      if (!account || amt > Number(account.current_balance)) {
        toast.error('المبلغ يتجاوز الرصيد المتاح في العهدة');
        return;
      }
    } else payment_source = sourceDetails || 'other';

    if (!paidAt || !Number.isFinite(new Date(paidAt).getTime())) { toast.error('حدد تاريخ سداد صحيحًا'); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('record_expense_payment', {
        p_expense_id: expense.id,
        p_amount: amt,
        p_paid_at: new Date(paidAt).toISOString(),
        p_source: payment_source,
        p_notes: notes || null,
        p_request_id: requestId.current,
      });
      if (error) throw error;

      toast.success('تم تسجيل الدفعة');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      console.error(e);
      toast.error('فشل تسجيل الدفعة: ' + (e.message || ''));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="finance-dialog sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-card rounded-2xl border-primary/20 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            سداد مباشر للمصروف
          </DialogTitle>
          <p className="text-sm text-muted-foreground">اختر مصدر الأموال وسجّل مبلغ السداد. سيظهر القيد في سجل تسديدات المصروف.</p>
        </DialogHeader>

        {expense && (
          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-sm">
              <div className="font-semibold mb-1">{expense.description}</div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>إجمالي: {Number(expense.amount).toLocaleString('ar-LY')} د.ل</span>
                <span>مسدد: {Number(expense.paid_amount || 0).toLocaleString('ar-LY')} د.ل</span>
                <span className="font-bold text-destructive">متبقي: {remaining.toLocaleString('ar-LY')} د.ل</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">المبلغ المدفوع (د.ل)</Label>
              <Input aria-label="المبلغ المدفوع" className="h-12 text-lg font-bold" type="number" min={0.01} max={remaining} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">مصدر الأموال</Label>
              <Select value={sourceType} onValueChange={(v: any) => setSourceType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي (صندوق)</SelectItem>
                  <SelectItem value="bank">حساب مصرفي</SelectItem>
                  <SelectItem value="custody">من عهدة موظف</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sourceType === 'bank' && (
              <div className="space-y-1.5">
                <Label className="text-xs">اسم المصرف / الحساب</Label>
                <Input value={sourceDetails} onChange={(e) => setSourceDetails(e.target.value)} placeholder="مثال: مصرف الجمهورية" />
              </div>
            )}

            {sourceType === 'custody' && (
              <div className="space-y-1.5">
                <Label className="text-xs">حساب العهدة</Label>
                <Select value={custodyId} onValueChange={setCustodyId}>
                  <SelectTrigger><SelectValue placeholder="اختر حساب العهدة" /></SelectTrigger>
                  <SelectContent>
                    {custodyAccounts.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.account_number} - رصيد {Number(c.current_balance).toLocaleString('ar-LY')} د.ل
                      </SelectItem>
                    ))}
                    {custodyAccounts.length === 0 && (
                      <div className="p-2 text-xs text-muted-foreground">لا توجد عهد نشطة</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sourceType === 'other' && (
              <div className="space-y-1.5">
                <Label className="text-xs">تفاصيل المصدر</Label>
                <Input value={sourceDetails} onChange={(e) => setSourceDetails(e.target.value)} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">تاريخ السداد</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">ملاحظات</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin ml-2" /> جاري الحفظ...</> : 'حفظ السداد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DirectExpensePaymentDialog;
