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
  const [contractBillboards, setContractBillboards] = useState<any[]>([]);
  const [selectedBillboardIdsToRemove, setSelectedBillboardIdsToRemove] = useState<string[]>([]);
  const boardId = String(board?.ID ?? board?.id ?? '');
  const source = board?.Contract_Number ?? board?.contractNumber;

  useEffect(() => {
    if (!open) return;
    setAction(props.contractAction);
    setContractId('');
    setAmount('');
    setDailyRate('');
    setChoices({});
    setSelectedBillboardIdsToRemove(boardId ? [boardId] : []);
    setEffective(format(new Date(), 'yyyy-MM-dd'));
  }, [open, boardId, props.contractAction]);

  const targetId = action === 'remove' ? source : contractId;

  useEffect(() => {
    let cancelled = false;
    setContract(null);
    setContractBillboards([]);
    setAmount('');
    setDailyRate('');
    setLoading(false);
    if (!open || !targetId) return;

    setLoading(true);
    supabase
      .from('Contract')
      .select('*')
      .eq('Contract_Number', Number(targetId))
      .single()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLoading(false);
          toast.error('تعذر تحميل تفاصيل العقد');
          return;
        }
        setContract(data);

        // Load all billboards in this contract if removing
        const cBoardIds = (data.billboard_ids || '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);

        if (cBoardIds.length > 0) {
          const { data: bData } = await supabase
            .from('billboards')
            .select('ID, Billboard_Name, name, Size, Nearest_Landmark, Municipality, Image_URL')
            .in('ID', cBoardIds.map(Number));

          if (!cancelled && bData) {
            setContractBillboards(bData);
            if (boardId && cBoardIds.includes(boardId)) {
              setSelectedBillboardIdsToRemove([boardId]);
            } else if (bData.length > 0) {
              setSelectedBillboardIdsToRemove([String(bData[0].ID)]);
            }
          }
        }

        setLoading(false);
        if (action === 'add' && data['Contract Date']) {
          setEffective(format(new Date(), 'yyyy-MM-dd') < data['Contract Date'] ? data['Contract Date'] : format(new Date(), 'yyyy-MM-dd'));
        }
      });

    return () => { cancelled = true; };
  }, [open, targetId, action, boardId]);

  const preview = useMemo(() => {
    if (!contract) return null;
    const allPrices = readPrices(contract.billboard_prices);

    if (action === 'remove') {
      const activeIds = selectedBillboardIdsToRemove.length > 0 ? selectedBillboardIdsToRemove : (boardId ? [boardId] : []);
      let totalSuggestedRemaining = 0;
      let sampleDays = 0;
      let sampleEnd = contract['End Date'];
      const itemsDetails: Array<{ id: string; name: string; remainingValue: number; days: number; hasPrice: boolean }> = [];

      activeIds.forEach(id => {
        const price = allPrices.find(p => String(p.billboardId ?? p.billboard_id) === String(id));
        const end = price?.endDate || contract['End Date'];
        sampleEnd = end;
        const remaining = calculateRemainingBillboardValue({
          startDate: price?.startDate || contract['Contract Date'],
          endDate: end,
          effectiveDate: effective,
          contractedPrice: Number(price?.finalPrice ?? price?.priceAfterDiscount ?? price?.contractPrice ?? 0),
          printCost: Number(price?.printCost || 0),
          installCost: Number(price?.installationCost || 0),
        });
        totalSuggestedRemaining += remaining.remainingValue;
        sampleDays = remaining.remainingDays;
        const bObj = contractBillboards.find(b => String(b.ID) === String(id));
        itemsDetails.push({
          id,
          name: bObj?.Billboard_Name || bObj?.name || `لوحة #${id}`,
          remainingValue: remaining.remainingValue,
          days: remaining.remainingDays,
          hasPrice: Boolean(price),
        });
      });

      const adjustment = amount === '' ? totalSuggestedRemaining : Number(amount);
      const difference = -adjustment;
      return {
        days: sampleDays,
        adjustment,
        difference,
        total: Number(contract.Total || 0) + difference,
        end: sampleEnd,
        itemsDetails,
        allPricesFound: itemsDetails.every(it => it.hasPrice),
      };
    } else {
      const price = allPrices.find(p => String(p.billboardId ?? p.billboard_id) === boardId);
      const end = price?.endDate || contract['End Date'];
      const days = calculateDaysBetween(effective, end);
      const suggested = Math.round(Number(dailyRate) * days * 100) / 100;
      const adjustment = amount === '' ? suggested : Number(amount);
      const difference = adjustment;
      return {
        days,
        adjustment,
        difference,
        total: Number(contract.Total || 0) + difference,
        end,
        price,
        itemsDetails: [],
        allPricesFound: true,
      };
    }
  }, [contract, boardId, selectedBillboardIdsToRemove, contractBillboards, effective, dailyRate, amount, action]);

  const valid = preview && Number.isFinite(preview.adjustment) && preview.adjustment >= 0 && preview.total >= 0 && effective &&
    (action === 'remove'
      ? (preview.allPricesFound || amount !== '') && selectedBillboardIdsToRemove.length > 0
      : effective >= contract?.['Contract Date'] && effective <= contract?.['End Date'] && (dailyRate !== '' || amount !== ''));

  const save = async () => {
    if (!valid || !preview || saving) return;
    setSaving(true);
    try {
      if (action === 'remove') {
        const activeIds = selectedBillboardIdsToRemove.length > 0 ? selectedBillboardIdsToRemove : [boardId];
        const totalSuggested = preview.itemsDetails.reduce((sum, it) => sum + it.remainingValue, 0);
        const userEnteredTotal = preview.adjustment;
        const ratio = totalSuggested > 0 ? userEnteredTotal / totalSuggested : 1;

        let accumulatedAdjustment = 0;

        for (let i = 0; i < activeIds.length; i++) {
          const bId = activeIds[i];
          const itemDetail = preview.itemsDetails.find(it => it.id === bId);
          const isLast = i === activeIds.length - 1;
          const itemAmount = isLast
            ? Math.max(0, Math.round((userEnteredTotal - accumulatedAdjustment) * 100) / 100)
            : Math.max(0, Math.round(((itemDetail?.remainingValue || 0) * ratio) * 100) / 100);

          accumulatedAdjustment += itemAmount;

          // Fetch fresh revision of the contract to avoid version conflict
          const { data: freshContract, error: freshErr } = await supabase
            .from('Contract')
            .select('edit_revision')
            .eq('Contract_Number', Number(targetId))
            .single();

          if (freshErr || !freshContract) {
            throw new Error('تعذر جلب نسخة العقد المحدثة');
          }

          await rentalRpc('quick_billboard_contract_change', {
            p_contract_number: Number(targetId),
            p_billboard_id: Number(bId),
            p_action: 'remove',
            p_amount: itemAmount,
            p_effective: effective,
            p_revision: freshContract.edit_revision,
            p_compensate: false,
            p_source_contract: source ? Number(source) : null,
          });
        }

        toast.success(`تمت إزالة ${activeIds.length} لوحة من العقد وتحديث قيمته بنجاح`);
      } else {
        await rentalRpc('quick_billboard_contract_change', {
          p_contract_number: Number(targetId),
          p_billboard_id: Number(boardId),
          p_action: action,
          p_amount: preview.adjustment,
          p_effective: effective,
          p_revision: contract.edit_revision,
          p_compensate: choices[boardId]?.enabled ?? false,
          p_source_contract: source ? Number(source) : null,
        });
        toast.success('تم تحديث اللوحة وقيمة العقد');
      }

      setContractDialogOpen(false);
      await props.loadBillboards();
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ أثناء حفظ التعديل');
    } finally {
      setSaving(false);
    }
  };

  const currency = contract?.contract_currency || 'LYD';
  const money = (n: number) => `${n.toLocaleString('ar-LY', { maximumFractionDigits: 2 })} ${currency}`;

  return (
    <Dialog open={open} onOpenChange={v => { if (!saving) setContractDialogOpen(v); }}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إدارة عقد اللوحة — {board?.Billboard_Name || board?.name}</DialogTitle>
          <DialogDescription>راجع المدة والفرق المالي واللوحات المراد إزالتها قبل حفظ التعديل.</DialogDescription>
        </DialogHeader>

        <Tabs value={action} onValueChange={v => setAction(v as 'add' | 'remove')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger className="cursor-pointer" value="add">إضافة إلى عقد</TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="remove" disabled={!source}>إزالة من العقد</TabsTrigger>
          </TabsList>
        </Tabs>

        {action === 'add' && (
          <div className="space-y-2">
            <Input
              aria-label="بحث العقود"
              placeholder="ابحث برقم العقد أو العميل"
              value={props.contractSearchQuery}
              onChange={e => props.setContractSearchQuery(e.target.value)}
            />
            <Label htmlFor="quick-contract">العقد المستهدف</Label>
            <select
              id="quick-contract"
              className="w-full rounded-md border border-input bg-background p-2 cursor-pointer"
              value={contractId}
              onChange={e => setContractId(e.target.value)}
            >
              <option value="">اختر العقد</option>
              {props.filteredContracts.filter(c => String(c.Contract_Number) !== String(source)).map(c => (
                <option key={c.Contract_Number} value={c.Contract_Number}>
                  #{c.Contract_Number} — {c['Customer Name']}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground animate-pulse">جاري تحميل تفاصيل العقد واللوحات...</p>}

        {contract && preview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-muted/40 p-2.5 rounded-lg border border-border/60">
              <span className="text-xs font-bold text-foreground">
                العقد #{contract.Contract_Number} — {contract['Customer Name']}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {contractBillboards.length > 0 ? `${contractBillboards.length} لوحات في العقد` : ''}
              </span>
            </div>

            {/* Checklist of billboards in this contract when removing */}
            {action === 'remove' && contractBillboards.length > 1 && (
              <div className="space-y-2 border border-border/80 rounded-xl p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">
                    لوحات هذا العقد (اختر اللوحات المراد إزالتها):
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 text-primary hover:bg-primary/10"
                      onClick={() => setSelectedBillboardIdsToRemove(contractBillboards.map(b => String(b.ID)))}
                    >
                      تحديد الكل ({contractBillboards.length})
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 text-muted-foreground hover:bg-muted"
                      onClick={() => setSelectedBillboardIdsToRemove([boardId])}
                    >
                      الحالية فقط
                    </Button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {contractBillboards.map(b => {
                    const bId = String(b.ID);
                    const isChecked = selectedBillboardIdsToRemove.includes(bId);
                    const itemDetail = preview.itemsDetails.find(it => it.id === bId);
                    return (
                      <label
                        key={bId}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked ? 'border-destructive/60 bg-destructive/5' : 'border-border/60 hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBillboardIdsToRemove(prev => [...prev, bId]);
                              } else {
                                if (selectedBillboardIdsToRemove.length <= 1) {
                                  toast.error('يجب تحديد لوحة واحدة على الأقل للإزالة');
                                  return;
                                }
                                setSelectedBillboardIdsToRemove(prev => prev.filter(x => x !== bId));
                              }
                            }}
                            className="h-4 w-4 rounded border-border text-primary cursor-pointer shrink-0"
                          />
                          <div className="truncate">
                            <span className="font-bold text-foreground">
                              {b.Billboard_Name || b.name || `لوحة #${bId}`}
                            </span>
                            <span className="text-[10px] text-muted-foreground mr-2">
                              {b.Size} {b.Nearest_Landmark ? `· ${b.Nearest_Landmark}` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="text-left font-mono font-bold text-foreground text-[11px] shrink-0 mr-2">
                          {itemDetail ? `${itemDetail.remainingValue.toLocaleString('ar-LY')} د.ل` : '—'}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="text-[11px] text-muted-foreground flex justify-between pt-1 border-t border-border/40">
                  <span>المحدد للإزالة: <strong className="text-destructive font-bold">{selectedBillboardIdsToRemove.length}</strong> لوحة</span>
                  <span>إجمالي المقترح: <strong className="text-primary font-bold">{preview.itemsDetails.reduce((s, it) => s + it.remainingValue, 0).toLocaleString('ar-LY')} د.ل</strong></span>
                </div>
              </div>
            )}

            <Label htmlFor="quick-effective">{action === 'add' ? 'بداية استخدام اللوحة' : 'بداية المدة المسترجعة'}</Label>
            <Input id="quick-effective" type="date" value={effective} onChange={e => { setEffective(e.target.value); setAmount(''); }} />

            {action === 'add' && (
              <>
                <Label htmlFor="quick-rate">سعر الإيجار اليومي ({currency})</Label>
                <Input id="quick-rate" type="number" min="0" step="0.01" value={dailyRate} onChange={e => { setDailyRate(e.target.value); setAmount(''); }} />
              </>
            )}

            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2" aria-live="polite">
              <p className="flex items-center gap-2 font-semibold"><Calculator className="h-4 w-4 text-primary" />الفروقات المالية</p>
              <p className="text-sm">المدة المتبقية: {preview.days} يوم — انتهاء اللوحة: {preview.end}</p>
              <p className="text-sm">القيمة الحالية: {money(Number(contract.Total || 0))}</p>
              <Label htmlFor="quick-amount">{action === 'add' ? 'قيمة الإضافة' : 'المبلغ المسترجع الإجمالي'} — قابل للتعديل</Label>
              <Input id="quick-amount" type="number" min="0" step="0.01" value={amount === '' ? preview.adjustment : amount} onChange={e => setAmount(e.target.value)} />
              <p>الفرق: {money(preview.difference)}</p>
              <p className="font-bold text-primary">الإجمالي بعد التعديل: {money(preview.total)}</p>
              <p className="text-xs text-muted-foreground">الإزالة فورية، والاسترجاع المقترح للمدة المتبقية بعد استبعاد الطباعة والتركيب المسجلين. تُعدّل الأقساط الأخيرة مع حفظ الدفعات السابقة.</p>
              {!preview.allPricesFound && action === 'remove' && (
                <p className="text-sm text-destructive">بعض اللوحات المحددة لا تحتوي على سعر محفوظ. أدخل المبلغ المسترجع صراحة.</p>
              )}
            </div>

            {action === 'add' && (
              <RentalCompensationAlert
                billboards={[board]}
                startDate={effective}
                endDate={contract['End Date']}
                contractNumber={targetId}
                contractStatus={contract?.Status || contract?.status}
                choices={choices}
                onChange={setChoices}
              />
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            className="flex-1 cursor-pointer transition-all duration-200"
            disabled={!valid || saving || loading}
            onClick={save}
          >
            {saving
              ? 'جاري الحفظ...'
              : action === 'remove' && selectedBillboardIdsToRemove.length > 1
                ? `تأكيد إزالة ${selectedBillboardIdsToRemove.length} لوحات وحفظ الفرق`
                : 'تأكيد وحفظ الفرق'}
          </Button>
          <Button
            className="cursor-pointer transition-all duration-200"
            variant="outline"
            disabled={saving}
            onClick={() => setContractDialogOpen(false)}
          >
            إلغاء
          </Button>
        </div>

        {action === 'add' && (
          <Button
            className="cursor-pointer transition-all duration-200"
            variant="ghost"
            disabled={saving}
            onClick={props.createNewContract}
          >
            إنشاء عقد جديد لهذه اللوحة
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
