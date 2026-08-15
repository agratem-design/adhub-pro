// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { History, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  addPausedBillboard,
  listPausedBillboards,
  listRemovedBillboardsHistory,
} from '@/services/pausedBillboardsService';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractNumber: number | null;
  contractStartDate?: string | null;
  onAdded?: () => void;
}

interface Row {
  billboard_id: number;
  billboard_name: string | null;
  city: string | null;
  size: string | null;
  original_price: number;
  pause_date: string;
  refund_amount: number;
  selected: boolean;
  was_pause: boolean;
  linked_contract_number: number | null;
  linked_ad_type: string | null;
  linked_customer: string | null;
  linked_start: string | null;
  linked_end: string | null;
}

const toDateInput = (v: any): string => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export function BulkRegisterPausedDialog({
  open,
  onOpenChange,
  contractNumber,
  contractStartDate,
  onAdded,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [deduct, setDeduct] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !contractNumber) return;
    setNotes('');
    setDeduct(true);

    (async () => {
      try {
        setLoading(true);

        const [history, alreadyPaused] = await Promise.all([
          listRemovedBillboardsHistory(contractNumber),
          listPausedBillboards(contractNumber),
        ]);

        const excludeIds = new Set(
          (alreadyPaused || []).map((p: any) => String(p.billboard_id))
        );

        // unique billboard_ids from history not already paused
        const seen = new Set<string>();
        const candidates: any[] = [];
        for (const h of history || []) {
          const id = String(h.billboard_id);
          if (excludeIds.has(id)) continue;
          if (seen.has(id)) continue;
          seen.add(id);
          candidates.push(h);
        }

        if (candidates.length === 0) {
          setRows([]);
          return;
        }

        const ids = candidates.map((c) => c.billboard_id);
        const { data: bbs } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, City, Size, Price, Rent_Start_Date, Rent_End_Date, Contract_Number, Ad_Type, Customer_Name')
          .in('ID', ids);

        const map = new Map((bbs || []).map((b: any) => [String(b.ID), b]));

        // Fetch linked contracts info (ad type, customer, start date) for billboards currently in another contract
        const linkedContractNumbers = Array.from(
          new Set(
            (bbs || [])
              .map((b: any) => b.Contract_Number)
              .filter((n: any) => n && Number(n) !== Number(contractNumber))
          )
        );
        const contractMap = new Map<number, any>();
        if (linkedContractNumbers.length > 0) {
          const { data: contracts } = await supabase
            .from('Contract')
            .select('Contract_Number, "Ad Type", "Customer Name", Rent_Start_Date, End_Date')
            .in('Contract_Number', linkedContractNumbers as number[]);
          for (const c of contracts || []) {
            contractMap.set(Number((c as any).Contract_Number), c);
          }
        }

        const fallback = toDateInput(contractStartDate) || new Date().toISOString().split('T')[0];

        const built: Row[] = candidates.map((h) => {
          const bb: any = map.get(String(h.billboard_id));
          const linkedC: any = bb?.Contract_Number && Number(bb.Contract_Number) !== Number(contractNumber)
            ? contractMap.get(Number(bb.Contract_Number))
            : null;
          // Priority: linked contract's start date (the contract billboard is currently active in)
          // → billboard's own Rent_Start_Date → history end_date → contract start fallback
          const pauseDate =
            toDateInput(linkedC?.Rent_Start_Date) ||
            toDateInput(bb?.Rent_Start_Date) ||
            toDateInput(h.end_date) ||
            fallback;
          const price = Number(bb?.Price || 0);
          return {
            billboard_id: Number(h.billboard_id),
            billboard_name: bb?.Billboard_Name || null,
            city: bb?.City || null,
            size: bb?.Size || null,
            original_price: price,
            pause_date: pauseDate,
            refund_amount: price,
            selected: true,
            was_pause: h?.individual_billboard_data?.type === 'pause',
            linked_contract_number: linkedC ? Number(bb.Contract_Number) : (bb?.Contract_Number ? Number(bb.Contract_Number) : null),
            linked_ad_type: linkedC?.['Ad Type'] || bb?.Ad_Type || null,
            linked_customer: linkedC?.['Customer Name'] || bb?.Customer_Name || null,
            linked_start: toDateInput(linkedC?.Rent_Start_Date) || toDateInput(bb?.Rent_Start_Date) || null,
            linked_end: toDateInput(linkedC?.End_Date) || toDateInput(bb?.Rent_End_Date) || null,
          };
        });

        setRows(built);
      } catch (e: any) {
        toast.error('فشل التحميل: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, contractNumber, contractStartDate]);

  const selectedCount = useMemo(() => rows.filter((r) => r.selected).length, [rows]);
  const allSelected = rows.length > 0 && selectedCount === rows.length;

  const updateRow = (id: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.billboard_id === id ? { ...r, ...patch } : r)));
  };

  const toggleAll = (v: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: v })));
  };

  const handleSave = async () => {
    if (!contractNumber) return;
    const picked = rows.filter((r) => r.selected);
    if (picked.length === 0) {
      toast.error('اختر لوحة واحدة على الأقل');
      return;
    }
    try {
      setSaving(true);
      let ok = 0;
      let fail = 0;
      for (const r of picked) {
        try {
          await addPausedBillboard({
            contract_number: contractNumber,
            billboard_id: r.billboard_id,
            billboard_name: r.billboard_name,
            pause_date: r.pause_date,
            original_price: Number(r.original_price) || 0,
            consumed_amount: Math.max(0, (Number(r.original_price) || 0) - (Number(r.refund_amount) || 0)),
            refund_amount: Number(r.refund_amount) || 0,
            deducted_from_contract: deduct,
            notes: notes || null,
          });
          ok++;
        } catch (e) {
          console.error(e);
          fail++;
        }
      }
      toast.success(`تم تسجيل ${ok} لوحة${fail ? ` — فشل ${fail}` : ''}`);
      onOpenChange(false);
      onAdded?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-[920px] bg-card border-border max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <History className="w-6 h-6 text-primary" />
            تسجيل اللوحات الموقوفة سابقاً
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            لا توجد لوحات سابقة قابلة للتسجيل (إما لا توجد لوحات مُزالت من العقد، أو جميعها مسجلة بالفعل).
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 bg-muted/40 border border-border p-3 rounded-lg flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulk-all"
                  checked={allSelected}
                  onCheckedChange={(v) => toggleAll(!!v)}
                />
                <Label htmlFor="bulk-all" className="cursor-pointer text-sm">
                  تحديد الكل ({selectedCount}/{rows.length})
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="deduct-bulk" className="cursor-pointer text-sm">
                  خصم قيم الاسترداد من إجمالي العقد
                </Label>
                <Switch id="deduct-bulk" checked={deduct} onCheckedChange={setDeduct} />
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-right">
                    <th className="p-2 w-8"></th>
                    <th className="p-2">اللوحة</th>
                    <th className="p-2">تاريخ الإيقاف</th>
                    <th className="p-2">السعر الأصلي</th>
                    <th className="p-2">الاسترداد</th>
                    <th className="p-2">المستهلك</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.billboard_id} className="border-t border-border">
                      <td className="p-2">
                        <Checkbox
                          checked={r.selected}
                          onCheckedChange={(v) => updateRow(r.billboard_id, { selected: !!v })}
                        />
                      </td>
                      <td className="p-2">
                        <div className="font-bold">{r.billboard_name || `#${r.billboard_id}`}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap mt-0.5">
                          <span>{r.city}</span>
                          <span>•</span>
                          <span>{r.size}</span>
                          {r.was_pause && (
                            <Badge className="text-[9px] bg-primary/20 text-primary border border-primary/30">
                              إيقاف سابق
                            </Badge>
                          )}
                        </div>
                        {r.linked_contract_number && (
                          <div className="text-[10px] mt-1 flex items-center gap-1 flex-wrap">
                            <Badge className="text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                              مرتبطة بعقد #{r.linked_contract_number}
                            </Badge>
                            {r.linked_ad_type && (
                              <span className="text-muted-foreground">— {r.linked_ad_type}</span>
                            )}
                            {r.linked_start && (
                              <span className="text-muted-foreground" dir="ltr">
                                ({r.linked_start}{r.linked_end ? ` → ${r.linked_end}` : ''})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <Input
                          type="date"
                          value={r.pause_date}
                          onChange={(e) => updateRow(r.billboard_id, { pause_date: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={r.original_price}
                          onChange={(e) =>
                            updateRow(r.billboard_id, {
                              original_price: Number(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs w-28"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={r.refund_amount}
                          onChange={(e) =>
                            updateRow(r.billboard_id, {
                              refund_amount: Number(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs w-28"
                        />
                      </td>
                      <td className="p-2 text-foreground font-medium" dir="ltr">
                        {Math.max(0, r.original_price - r.refund_amount).toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">ملاحظة موحّدة (اختياري)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="w-4 h-4 ml-1" /> إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving || rows.length === 0 || selectedCount === 0}>
            <Check className="w-4 h-4 ml-1" />
            {saving ? 'جاري الحفظ...' : `تسجيل المحدد (${selectedCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
