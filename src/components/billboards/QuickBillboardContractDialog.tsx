import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { rentalRpc } from '@/services/billboardRentalService';
import { RentalCompensationAlert, readPrices, type CompensationChoices } from '@/components/contracts/RentalCompensationAlert';
import { calculateDaysBetween, calculateRemainingBillboardValue } from '@/utils/contractBillboardCalculations';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Props {
  contractDialogOpen: boolean; setContractDialogOpen: (open: boolean) => void;
  selectedBillboard: any; contractAction: 'add' | 'remove'; filteredContracts: any[];
  contractSearchQuery: string; setContractSearchQuery: (value: string) => void;
  loadBillboards: () => Promise<void>; createNewContract: () => void;
}
export function ContractManagementDialog(props: Props) {
  const { contractDialogOpen: open, setContractDialogOpen, selectedBillboard: board } = props;
  const [action, setAction] = useState<'add' | 'remove'>(props.contractAction);
  const [contractId, setContractId] = useState('');
  const [contract, setContract] = useState<any>(null);
  const [effective, setEffective] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [amount, setAmount] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<CompensationChoices>({});
  const boardId = String(board?.ID ?? board?.id ?? '');
  const source = board?.Contract_Number ?? board?.contractNumber;
  useEffect(() => {
    if (!open) return;
    setAction(props.contractAction); setContractId(''); setAmount(''); setDailyRate(''); setChoices({});
    setEffective(format(new Date(), 'yyyy-MM-dd'));
  }, [open, boardId, props.contractAction]);
  const targetId = action === 'remove' ? source : contractId;
  useEffect(() => {
    let cancelled = false;
    setContract(null); setAmount(''); setDailyRate(''); setLoading(false);
    if (!open || !targetId) return;
    setLoading(true);
    supabase.from('Contract').select('*').eq('Contract_Number', Number(targetId)).single().then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      if (error) { toast.error('تعذر تحميل تفاصيل العقد'); return; }
      setContract(data);
      if (action === 'add' && data['Contract Date']) setEffective(format(new Date(), 'yyyy-MM-dd') < data['Contract Date'] ? data['Contract Date'] : format(new Date(), 'yyyy-MM-dd'));
    });
    return () => { cancelled = true; };
  }, [open, targetId, action]);
  const preview = useMemo(() => {
    if (!contract) return null;
    const price = readPrices(contract.billboard_prices).find(p => String(p.billboardId ?? p.billboard_id) === boardId);
    const end = price?.endDate || contract['End Date'];
    const remaining = calculateRemainingBillboardValue({ startDate: price?.startDate || contract['Contract Date'], endDate: end, effectiveDate: effective,
      contractedPrice: Number(price?.finalPrice ?? price?.priceAfterDiscount ?? price?.contractPrice ?? 0),
      printCost: Number(price?.printCost || 0), installCost: Number(price?.installationCost || 0) });
    const days = action === 'add' ? calculateDaysBetween(effective, end) : remaining.remainingDays;
    const suggested = action === 'add' ? Math.round(Number(dailyRate) * days * 100) / 100 : remaining.remainingValue;
    const adjustment = amount === '' ? suggested : Number(amount);
    const difference = action === 'add' ? adjustment : -adjustment;
    return { days, adjustment, difference, total: Number(contract.Total || 0) + difference, end, price };
  }, [contract, boardId, effective, dailyRate, amount, action]);
  const valid = preview && Number.isFinite(preview.adjustment) && preview.adjustment >= 0 && preview.total >= 0 && effective &&
    (action === 'remove' ? (preview.price || amount !== '') : effective >= contract['Contract Date'] && effective <= contract['End Date'] && (dailyRate !== '' || amount !== ''));
  const save = async () => {
    if (!valid || !preview || saving) return;
    setSaving(true);
    try {
      await rentalRpc('quick_billboard_contract_change', {
        p_contract_number: Number(targetId), p_billboard_id: Number(boardId), p_action: action,
        p_amount: preview.adjustment, p_effective: effective, p_revision: contract.edit_revision,
        p_compensate: choices[boardId]?.enabled ?? false, p_source_contract: source ? Number(source) : null,
      });
      toast.success('تم تحديث اللوحة وقيمة العقد'); setContractDialogOpen(false); await props.loadBillboards();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  const currency = contract?.contract_currency || 'LYD';
  const money = (n: number) => `${n.toLocaleString('ar-LY', { maximumFractionDigits: 2 })} ${currency}`;
  return <Dialog open={open} onOpenChange={v => { if (!saving) setContractDialogOpen(v); }}>
    <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>إدارة عقد اللوحة — {board?.Billboard_Name || board?.name}</DialogTitle>
        <DialogDescription>راجع المدة والفرق المالي قبل حفظ التعديل.</DialogDescription></DialogHeader>
      <Tabs value={action} onValueChange={v => setAction(v as 'add' | 'remove')}>
        <TabsList className="grid w-full grid-cols-2"><TabsTrigger className="cursor-pointer" value="add">إضافة إلى عقد</TabsTrigger><TabsTrigger className="cursor-pointer" value="remove" disabled={!source}>إزالة من العقد</TabsTrigger></TabsList>
      </Tabs>
      {action === 'add' && <div className="space-y-2">
        <Input aria-label="بحث العقود" placeholder="ابحث برقم العقد أو العميل" value={props.contractSearchQuery} onChange={e => props.setContractSearchQuery(e.target.value)} />
        <Label htmlFor="quick-contract">العقد المستهدف</Label>
        <select id="quick-contract" className="w-full rounded-md border border-input bg-background p-2 cursor-pointer" value={contractId} onChange={e => setContractId(e.target.value)}>
          <option value="">اختر العقد</option>{props.filteredContracts.filter(c => String(c.Contract_Number) !== String(source)).map(c => <option key={c.Contract_Number} value={c.Contract_Number}>#{c.Contract_Number} — {c['Customer Name']}</option>)}
        </select>
      </div>}
      {loading && <p>جاري تحميل العقد...</p>}
      {contract && preview && <div className="space-y-3">
        <p className="text-sm text-muted-foreground">العقد #{contract.Contract_Number} — {contract['Customer Name']}</p>
        <Label htmlFor="quick-effective">{action === 'add' ? 'بداية استخدام اللوحة' : 'بداية المدة المسترجعة'}</Label>
        <Input id="quick-effective" type="date" value={effective} onChange={e => { setEffective(e.target.value); setAmount(''); }} />
        {action === 'add' && <><Label htmlFor="quick-rate">سعر الإيجار اليومي ({currency})</Label><Input id="quick-rate" type="number" min="0" step="0.01" value={dailyRate} onChange={e => { setDailyRate(e.target.value); setAmount(''); }} /></>}
        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2" aria-live="polite">
          <p className="flex items-center gap-2 font-semibold"><Calculator className="h-4 w-4 text-primary" />الفروقات المالية</p>
          <p className="text-sm">المدة المتبقية: {preview.days} يوم — انتهاء اللوحة: {preview.end}</p>
          <p className="text-sm">القيمة الحالية: {money(Number(contract.Total || 0))}</p>
          <Label htmlFor="quick-amount">{action === 'add' ? 'قيمة الإضافة' : 'المبلغ المسترجع'} — قابل للتعديل</Label>
          <Input id="quick-amount" type="number" min="0" step="0.01" value={amount === '' ? preview.adjustment : amount} onChange={e => setAmount(e.target.value)} />
          <p>الفرق: {money(preview.difference)}</p><p className="font-bold text-primary">الإجمالي بعد التعديل: {money(preview.total)}</p>
          <p className="text-xs text-muted-foreground">الإزالة فورية، والاسترجاع المقترح للمدة المتبقية بعد استبعاد الطباعة والتركيب المسجلين. تُعدّل الأقساط الأخيرة مع حفظ الدفعات السابقة.</p>
          {!preview.price && action === 'remove' && <p className="text-sm text-destructive">لا يوجد سعر محفوظ لهذه اللوحة. أدخل المبلغ المسترجع صراحة.</p>}
        </div>
        {action === 'add' && <RentalCompensationAlert billboards={[board]} startDate={effective} endDate={contract['End Date']} contractNumber={targetId} choices={choices} onChange={setChoices} />}
      </div>}
      <div className="flex gap-2"><Button className="flex-1 cursor-pointer transition-all duration-200" disabled={!valid || saving || loading} onClick={save}>{saving ? 'جاري الحفظ...' : 'تأكيد وحفظ الفرق'}</Button><Button className="cursor-pointer transition-all duration-200" variant="outline" disabled={saving} onClick={() => setContractDialogOpen(false)}>إلغاء</Button></div>
      {action === 'add' && <Button className="cursor-pointer transition-all duration-200" variant="ghost" disabled={saving} onClick={props.createNewContract}>إنشاء عقد جديد لهذه اللوحة</Button>}
    </DialogContent>
  </Dialog>;
}
