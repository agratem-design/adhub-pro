import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { createBillboardLoan } from '@/hooks/useBillboardLoans';
import { addBillboardsToContract } from '@/services/contractService';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The contract that will RECEIVE the borrowed billboard */
  targetContractNumber: string;
  targetCustomerName: string;
  targetStartDate: string;
  targetEndDate: string;
  onDone?: (billboardId: string) => void;
}

export const BorrowBillboardDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  targetContractNumber,
  targetCustomerName,
  targetStartDate,
  targetEndDate,
  onDone,
}) => {
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceContract, setSourceContract] = useState<any | null>(null);
  const [sourceBillboards, setSourceBillboards] = useState<any[]>([]);
  const [selectedBillboardId, setSelectedBillboardId] = useState<string>('');
  const [loanDays, setLoanDays] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setSourceQuery('');
      setSourceContract(null);
      setSourceBillboards([]);
      setSelectedBillboardId('');
      setLoanDays(30);
    }
  }, [open]);

  const findSourceContract = async () => {
    const num = sourceQuery.trim();
    if (!num) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('Contract')
        .select('*')
        .eq('Contract_Number', Number(num))
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error('لم يتم العثور على العقد');
        setSourceContract(null);
        setSourceBillboards([]);
        return;
      }
      if (String((data as any).Contract_Number) === String(targetContractNumber)) {
        toast.error('لا يمكن الاستعارة من نفس العقد');
        return;
      }
      setSourceContract(data);
      const { data: bbs, error: bbErr } = await supabase
        .from('billboards')
        .select('*')
        .eq('Contract_Number', Number(num));
      if (bbErr) throw bbErr;
      setSourceBillboards(bbs || []);
    } catch (e: any) {
      toast.error(e?.message || 'فشل البحث');
    } finally {
      setSearching(false);
    }
  };

  const computedEndDate = useMemo(() => {
    if (!targetStartDate || !loanDays) return '';
    const d = new Date(targetStartDate);
    d.setDate(d.getDate() + loanDays);
    return d.toISOString().slice(0, 10);
  }, [targetStartDate, loanDays]);

  const newSourceBillboardEnd = useMemo(() => {
    if (!selectedBillboardId) return '';
    const bb = sourceBillboards.find((b: any) => String(b.ID) === selectedBillboardId);
    if (!bb?.Rent_End_Date) return '';
    const d = new Date(bb.Rent_End_Date);
    d.setDate(d.getDate() + loanDays);
    return d.toISOString().slice(0, 10);
  }, [selectedBillboardId, loanDays, sourceBillboards]);

  const handleConfirm = async () => {
    if (!selectedBillboardId) { toast.error('اختر لوحة'); return; }
    if (!loanDays || loanDays < 1) { toast.error('عدد الأيام غير صالح'); return; }
    if (!targetStartDate) { toast.error('تاريخ بداية العقد المستهدف غير محدد'); return; }
    setLoading(true);
    try {
      const startDate = targetStartDate;
      const endDate = computedEndDate;

      // 1) Create loan + extend source billboard end date
      await createBillboardLoan({
        source_contract_number: Number(sourceContract.Contract_Number),
        target_contract_number: Number(targetContractNumber),
        billboard_id: Number(selectedBillboardId),
        loan_days: loanDays,
        start_date: startDate,
        end_date: endDate,
        notes: `استعارة من العقد ${sourceContract.Contract_Number} إلى العقد ${targetContractNumber} لمدة ${loanDays} يوم`,
      });

      // 2) Attach billboard to target contract for the loan period
      await addBillboardsToContract(String(targetContractNumber), [Number(selectedBillboardId)], {
        start_date: startDate,
        end_date: endDate,
        customer_name: targetCustomerName || '',
      });

      toast.success('تمت الاستعارة بنجاح');
      onDone?.(selectedBillboardId);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`فشل في الاستعارة: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>استعارة لوحة من عقد آخر</DialogTitle>
          <DialogDescription>
            استعارة لوحة لعدد محدد من الأيام، وسيتم تعويض اللوحة بنفس عدد الأيام (تمديد تاريخ الانتهاء) في العقد المصدر.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: search contract */}
          <div className="space-y-2">
            <Label>رقم العقد المصدر</Label>
            <div className="flex gap-2">
              <Input
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
                placeholder="أدخل رقم العقد"
                onKeyDown={(e) => e.key === 'Enter' && findSourceContract()}
              />
              <Button onClick={findSourceContract} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                بحث
              </Button>
            </div>
          </div>

          {/* Step 2: pick billboard */}
          {sourceContract && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>اختر اللوحة</Label>
                <Badge variant="outline">{sourceContract['Customer Name']}</Badge>
              </div>
              <ScrollArea className="h-56 border rounded-md p-2">
                {sourceBillboards.length === 0 && (
                  <div className="text-sm text-muted-foreground p-4 text-center">لا توجد لوحات في هذا العقد</div>
                )}
                <div className="grid grid-cols-1 gap-2">
                  {sourceBillboards.map((bb: any) => {
                    const id = String(bb.ID);
                    const active = id === selectedBillboardId;
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setSelectedBillboardId(id)}
                        className={
                          'text-right p-2 rounded-md border transition ' +
                          (active ? 'bg-primary/10 border-primary' : 'hover:bg-accent')
                        }
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{bb.Billboard_Name}</span>
                          <Badge variant="secondary">{bb.Size}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {bb.Nearest_Landmark} — ينتهي: {bb.Rent_End_Date}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 3: days */}
          {selectedBillboardId && (
            <div className="space-y-3">
              <div>
                <Label>عدد أيام الاستعارة</Label>
                <Input
                  type="number"
                  min={1}
                  value={loanDays}
                  onChange={(e) => setLoanDays(Math.max(1, Number(e.target.value) || 0))}
                />
              </div>
              <div className="rounded-lg border p-3 bg-accent/30 text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <span>فترة الاستعارة: <b>{targetStartDate}</b> → <b>{computedEndDate}</b></span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-amber-500" />
                  <span>تاريخ نهاية اللوحة في العقد المصدر بعد التعويض: <b>{newSourceBillboardEnd}</b></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleConfirm} disabled={loading || !selectedBillboardId}>
            {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            تأكيد الاستعارة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
