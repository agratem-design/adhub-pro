// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { BillboardImage } from '@/components/BillboardImage';
import { Loader2, Search, PauseCircle, Check, X, ArrowRight, Calendar, User, FileText, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addPausedBillboard, deletePausedBillboard, listPausedBillboards } from '@/services/pausedBillboardsService';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Current contract receiving the paused billboards */
  targetContractNumber: string;
  targetStartDate: string;
  targetEndDate: string;
  /** Optional discount % to apply on each billboard's price to compute its net rent */
  contractDiscountPercent?: number;
  onDone?: () => void;
}

interface Row {
  billboard_id: number;
  billboard_name: string | null;
  city: string | null;
  size: string | null;
  image_url: string | null;
  nearest_landmark: string | null;
  municipality: string | null;
  level: string | null;
  source_start: string | null;
  source_end: string | null;
  source_ad_type: string | null;
  source_customer: string | null;
  install_date: string | null;
  pause_date: string;
  original_price: number;
  net_rent: number;
  consumed_amount: number;
  refund_amount: number;
  /** id of the saved paused_billboards record once added */
  paused_id?: string | null;
  saving?: boolean;
  raw: any;
}

const toDateInput = (v: any): string => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch { return ''; }
};

const daysBetween = (a: string, b: string): number => {
  if (!a || !b) return 0;
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (isNaN(d1) || isNaN(d2)) return 0;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
};

export const AddPausedFromContractDialog: React.FC<Props> = ({
  open, onOpenChange, targetContractNumber, targetStartDate, targetEndDate, contractDiscountPercent = 0, onDone,
}) => {
  const [sourceQuery, setSourceQuery] = useState('');
  const [allContracts, setAllContracts] = useState<any[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [sourceContract, setSourceContract] = useState<any | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingBillboards, setLoadingBillboards] = useState(false);
  /** Map of billboard_id -> paused_billboards record id (for already-added in current target) */
  const [existingPausedMap, setExistingPausedMap] = useState<Record<number, string>>({});

  // Load existing paused billboards for the target contract (so we can reflect "added" state)
  const loadExisting = async () => {
    if (!targetContractNumber) return;
    try {
      const list = await listPausedBillboards(Number(targetContractNumber));
      const map: Record<number, string> = {};
      (list || []).forEach((p: any) => { map[Number(p.billboard_id)] = String(p.id); });
      setExistingPausedMap(map);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    if (!open) {
      setSourceQuery('');
      setSourceContract(null);
      setRows([]);
      setExistingPausedMap({});
      return;
    }
    loadExisting();
    // Load all contracts (excluding current)
    (async () => {
      setLoadingContracts(true);
      try {
        const { data, error } = await supabase
          .from('Contract')
          .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", "Total Rent", billboards_count')
          .order('Contract_Number', { ascending: false })
          .limit(1000);
        if (error) throw error;
        setAllContracts(
          (data || []).filter((c: any) => String(c.Contract_Number) !== String(targetContractNumber))
        );
      } catch (e: any) {
        toast.error('فشل تحميل العقود: ' + (e?.message || e));
      } finally {
        setLoadingContracts(false);
      }
    })();
  }, [open, targetContractNumber]);

  const targetDuration = useMemo(
    () => Math.max(1, daysBetween(targetStartDate, targetEndDate)),
    [targetStartDate, targetEndDate]
  );

  const filteredContracts = useMemo(() => {
    const q = sourceQuery.trim().toLowerCase();
    if (!q) return allContracts.slice(0, 60);
    return allContracts
      .filter((c: any) => {
        const fields = [
          String(c.Contract_Number || ''),
          String(c['Customer Name'] || ''),
          String(c['Ad Type'] || ''),
        ].join(' ').toLowerCase();
        return fields.includes(q);
      })
      .slice(0, 100);
  }, [allContracts, sourceQuery]);

  const pickContract = async (contract: any) => {
    setSourceContract(contract);
    setLoadingBillboards(true);
    try {
      const { data: bbs } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, City, Municipality, Nearest_Landmark, Size, Level, Price, Rent_Start_Date, Rent_End_Date, Ad_Type, Customer_Name, Image_URL, image_name, Faces_Count')
        .eq('Contract_Number', Number(contract.Contract_Number));

      const adType = contract['Ad Type'] || null;
      const custName = contract['Customer Name'] || null;

      // Resolve installation dates for both contracts:
      // - target contract: kept for current pause/pricing flow
      // - source contract: shown in the card as the real install date of the imported billboard
      const { resolveInstallDatesForContract } = await import('@/utils/installDateResolver');
      const [targetInstallDateMap, sourceInstallDateMap] = await Promise.all([
        resolveInstallDatesForContract(targetContractNumber),
        resolveInstallDatesForContract(contract.Contract_Number),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const built: Row[] = (bbs || []).map((b: any) => {
        const bbId = Number(b.ID);
        // Keep target contract dates for the saved pause math.
        const realInstallDate = targetInstallDateMap.get(String(bbId)) || '';
        // Show the real installation date from the SOURCE contract in this picker.
        const sourceInstallDate = sourceInstallDateMap.get(String(bbId)) || toDateInput(b.Rent_Start_Date) || '';
        const startD = realInstallDate || targetStartDate || '';
        const endD = targetEndDate || '';
        const price = Number(b.Price) || 0;
        const netRent = Math.round(price * (1 - (Number(contractDiscountPercent) || 0) / 100));
        // Default pause date = the installation date shown to the user in this dialog
        const pauseDate = sourceInstallDate || startD || today;
        const targetDur = Math.max(1, daysBetween(startD, endD) || 1);
        const usedDays = Math.min(targetDur, daysBetween(startD, pauseDate));
        const consumed = Math.round((netRent * usedDays) / targetDur);
        const refund = Math.max(0, netRent - consumed);
        return {
          billboard_id: bbId,
          billboard_name: b.Billboard_Name || null,
          city: b.City || null,
          size: b.Size || null,
          image_url: b.Image_URL || null,
          nearest_landmark: b.Nearest_Landmark || null,
          municipality: b.Municipality || null,
          level: b.Level || null,
          source_start: startD || null,
          source_end: endD || null,
          source_ad_type: b.Ad_Type || adType,
          source_customer: b.Customer_Name || custName,
          install_date: sourceInstallDate || startD || null,
          pause_date: pauseDate,
          original_price: price,
          net_rent: netRent,
          consumed_amount: consumed,
          refund_amount: refund,
          paused_id: existingPausedMap[bbId] || null,
          saving: false,
          raw: b,
        };
      });
      setRows(built);
    } catch (e: any) {
      toast.error('فشل تحميل اللوحات: ' + (e?.message || e));
    } finally {
      setLoadingBillboards(false);
    }
  };

  const backToList = () => {
    setSourceContract(null);
    setRows([]);
  };

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      if (
        patch.pause_date !== undefined ||
        patch.original_price !== undefined ||
        patch.net_rent !== undefined
      ) {
        const r = next[idx];
        const netRent = patch.net_rent !== undefined
          ? Number(patch.net_rent) || 0
          : Math.round(r.original_price * (1 - (Number(contractDiscountPercent) || 0) / 100));
        // ✅ Use TARGET contract span for proportional calculation
        const targetDur = Math.max(1, daysBetween(targetStartDate || '', targetEndDate || '') || 1);
        const usedDays = Math.min(targetDur, daysBetween(targetStartDate || '', r.pause_date));
        const consumed = Math.round((netRent * usedDays) / targetDur);
        next[idx].net_rent = netRent;
        next[idx].consumed_amount = consumed;
        next[idx].refund_amount = Math.max(0, netRent - consumed);
      }
      return next;
    });
  };

  /** One-click add: immediately persists the paused billboard to DB */
  const handleAddRow = async (idx: number) => {
    if (!targetContractNumber) { toast.error('رقم العقد الحالي غير محدد'); return; }
    const r = rows[idx];
    if (!r || r.paused_id || r.saving) return;
    setRows(prev => prev.map((x, i) => i === idx ? { ...x, saving: true } : x));
    try {
      const created: any = await addPausedBillboard({
        contract_number: Number(targetContractNumber),
        billboard_id: r.billboard_id,
        billboard_name: r.billboard_name,
        pause_date: r.pause_date,
        original_price: r.original_price,
        net_rent: r.net_rent,
        full_price: r.net_rent,
        consumed_amount: r.consumed_amount,
        refund_amount: r.refund_amount,
        original_start_date: r.source_start || null,
        original_end_date: r.source_end || null,
        deducted_from_contract: true,
        notes: `لوحة موقوفة من العقد المصدر #${sourceContract?.Contract_Number}`,
      } as any);
      const newId = String(created?.id || '');
      setRows(prev => prev.map((x, i) => i === idx ? { ...x, paused_id: newId, saving: false } : x));
      setExistingPausedMap(prev => ({ ...prev, [r.billboard_id]: newId }));
      toast.success(`تم إضافة "${r.billboard_name || r.billboard_id}" كلوحة موقوفة`);
      try { window.dispatchEvent(new CustomEvent('paused-billboards-changed', { detail: Number(targetContractNumber) })); } catch {}
      onDone?.();
    } catch (e: any) {
      setRows(prev => prev.map((x, i) => i === idx ? { ...x, saving: false } : x));
      toast.error('فشل الإضافة: ' + (e?.message || e));
    }
  };

  /** Remove an already-added paused billboard */
  const handleRemoveRow = async (idx: number) => {
    const r = rows[idx];
    if (!r || !r.paused_id || r.saving) return;
    setRows(prev => prev.map((x, i) => i === idx ? { ...x, saving: true } : x));
    try {
      await deletePausedBillboard(r.paused_id);
      setRows(prev => prev.map((x, i) => i === idx ? { ...x, paused_id: null, saving: false } : x));
      setExistingPausedMap(prev => {
        const next = { ...prev };
        delete next[r.billboard_id];
        return next;
      });
      toast.success('تم إزالة اللوحة الموقوفة');
      try { window.dispatchEvent(new CustomEvent('paused-billboards-changed', { detail: Number(targetContractNumber) })); } catch {}
      onDone?.();
    } catch (e: any) {
      setRows(prev => prev.map((x, i) => i === idx ? { ...x, saving: false } : x));
      toast.error('فشل الإزالة: ' + (e?.message || e));
    }
  };

  const addedCount = rows.filter(r => !!r.paused_id).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-primary" />
            إضافة لوحة موقوفة من عقد آخر
          </DialogTitle>
          <DialogDescription>
            جلب لوحة من عقد آخر وإضافتها للعقد الحالي كموقوفة فقط، دون فكها من العقد المصدر.
            يُحسب من صافي الإيجار جزء المدة المنفّذ ويُضاف للإجمالي، والباقي يُعتبر خصماً.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pl-1 space-y-4">
          {!sourceContract ? (
            <>
              <div className="space-y-2">
                <Label>بحث في العقود</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={sourceQuery}
                    onChange={e => setSourceQuery(e.target.value)}
                    placeholder="رقم العقد أو اسم الزبون أو نوع الإعلان..."
                    className="pr-10"
                  />
                </div>
              </div>

              <div className="h-[480px] border rounded-md p-2 overflow-y-auto">
                {loadingContracts ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin ml-2" /> جاري التحميل...
                  </div>
                ) : filteredContracts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">
                    لا توجد عقود مطابقة
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredContracts.map((c: any) => (
                      <button
                        key={c.Contract_Number}
                        type="button"
                        onClick={() => pickContract(c)}
                        className="text-right p-3 border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Badge variant="outline" className="text-xs tabular-nums">
                            <FileText className="h-3 w-3 ml-1" />
                            #{c.Contract_Number}
                          </Badge>
                          {c['Ad Type'] && (
                            <Badge variant="secondary" className="text-[10px]">{c['Ad Type']}</Badge>
                          )}
                        </div>
                        <div className="font-bold text-sm flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-primary" />
                          {c['Customer Name'] || '—'}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 tabular-nums">
                          <Calendar className="h-3 w-3" />
                          {toDateInput(c['Contract Date'])} → {toDateInput(c['End Date'])}
                        </div>
                        {c['Total Rent'] != null && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                            الإجمالي: {Number(c['Total Rent']).toLocaleString()}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2 bg-muted/40 border border-border p-2 rounded-lg">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <Badge variant="outline" className="tabular-nums">#{sourceContract.Contract_Number}</Badge>
                <Badge variant="outline">{sourceContract['Customer Name']}</Badge>
                {sourceContract['Ad Type'] && <Badge variant="secondary">{sourceContract['Ad Type']}</Badge>}
                <span className="text-muted-foreground tabular-nums text-xs">
                  {toDateInput(sourceContract['Contract Date'])} → {toDateInput(sourceContract['End Date'])}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={backToList}>
                <ArrowRight className="h-4 w-4 ml-1" />
                تغيير العقد
              </Button>
            </div>
          )}

          {sourceContract && loadingBillboards && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin ml-2" /> جاري تحميل اللوحات...
            </div>
          )}

          {sourceContract && !loadingBillboards && rows.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              لا توجد لوحات في هذا العقد
            </div>
          )}

          {rows.length > 0 && (
            <div className="max-h-[560px] border rounded-md p-3 overflow-y-auto">
              <div className="flex items-center justify-between mb-2 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
                <div className="text-[11px] text-muted-foreground">
                  انقر على البطاقة لإضافة اللوحة فوراً كموقوفة. انقر مرة أخرى لإزالتها.
                </div>
                <Badge className={`text-xs tabular-nums ${addedCount > 0 ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'} border-0`}>
                  تمت إضافة {addedCount} من {rows.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {rows.map((r, idx) => {
                  const isAdded = !!r.paused_id;
                  return (
                  <Card
                    key={r.billboard_id}
                    className={`group relative overflow-hidden cursor-pointer transition-all duration-200 ${
                      isAdded
                        ? 'ring-4 ring-emerald-500 ring-offset-2 ring-offset-background shadow-2xl scale-[1.02] border-emerald-500'
                        : 'hover:ring-1 hover:ring-primary/30 hover:shadow-md'
                    } ${r.saving ? 'opacity-70 pointer-events-none' : ''}`}
                  >
                    {isAdded && (
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-500 z-30" />
                    )}
                    <button
                      type="button"
                      aria-label={isAdded ? 'إزالة من الموقوفة' : 'إضافة كلوحة موقوفة'}
                      onClick={() => isAdded ? handleRemoveRow(idx) : handleAddRow(idx)}
                      className="absolute inset-0 z-10 cursor-pointer"
                    />
                    <div className="relative h-36 overflow-hidden bg-gradient-to-br from-muted to-muted/50 pointer-events-none">
                      <BillboardImage
                        billboard={r.raw}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        alt={r.billboard_name || `#${r.billboard_id}`}
                      />
                      {r.size && (
                        <Badge variant="secondary" className="absolute bottom-2 left-2 bg-black/60 text-white backdrop-blur-sm border-0">
                          {r.size}
                        </Badge>
                      )}
                      {r.level && (
                        <Badge className="absolute top-2 right-2 bg-primary/90 text-primary-foreground border-0">
                          {r.level}
                        </Badge>
                      )}
                      {r.saving && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <Loader2 className="h-7 w-7 text-primary animate-spin" />
                        </div>
                      )}
                      {isAdded && !r.saving && (
                        <div className="absolute inset-0 bg-emerald-500/30 backdrop-blur-[1px] flex items-center justify-center">
                          <div className="bg-emerald-500 rounded-full p-2.5 shadow-2xl ring-4 ring-white/40">
                            <Check className="h-7 w-7 text-white" strokeWidth={3} />
                          </div>
                        </div>
                      )}
                      {isAdded && (
                        <Badge className="absolute top-2 left-2 bg-emerald-600 text-white border-0 z-20 shadow-lg gap-1">
                          <Check className="h-3 w-3" strokeWidth={3} />
                          مضافة للعقد
                        </Badge>
                      )}
                    </div>

                    <CardContent className="p-3 space-y-2 relative z-0 pointer-events-none">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm line-clamp-1 flex-1">
                          {r.billboard_name || `#${r.billboard_id}`}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="line-clamp-1">{r.nearest_landmark || 'موقع غير محدد'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.city && <Badge variant="secondary" className="text-[10px] font-medium">{r.city}</Badge>}
                        {r.municipality && <Badge variant="outline" className="text-[10px] font-medium">{r.municipality}</Badge>}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 tabular-nums">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>تركيب: {r.install_date || '—'}</span>
                      </div>

                      {r.original_price > 0 && (
                        <div className="space-y-1 pt-1.5 border-t border-border/50 tabular-nums">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">السعر الكامل</span>
                            <span className="font-bold text-sm text-foreground">
                              {Number(r.net_rent).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">د.ل</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">يُضاف للإجمالي</span>
                            <span className="text-[12px] text-primary font-semibold">
                              {Number(r.consumed_amount).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">خصم متبقي</span>
                            <span className="text-[12px] text-amber-600 font-semibold">
                              {Number(r.refund_amount).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </div>
          )}

          {addedCount > 0 && (
            <div className="rounded-lg border p-3 bg-accent/30 text-sm space-y-1 tabular-nums">
              <div>اللوحات المضافة: <b className="text-emerald-600">{addedCount}</b></div>
              <div className="text-[11px] text-muted-foreground">
                التغييرات تُحفظ تلقائياً. أغلق النافذة عند الانتهاء.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button onClick={() => onOpenChange(false)}>
            <Check className="h-4 w-4 ml-1" />
            تم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
