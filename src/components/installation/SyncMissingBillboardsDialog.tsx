import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { BillboardImage } from '@/components/BillboardImage';
import { MapPin, Building2, Loader2, Package, Trash2, Plus, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface MissingBillboard {
  ID: number;
  Billboard_Name: string | null;
  Size: string | null;
  City: string | null;
  Nearest_Landmark: string | null;
  Image_URL: string | null;
  image_name: string | null;
  Faces_Count: number | null;
  friend_company_id: string | null;
  friendCompanyName?: string;
  /** رقم العقد الذي تنتمي له اللوحة */
  contractId?: number;
}

export interface SyncTaskItem {
  id: string;
  task_id: string;
  billboard_id: number;
  status: string;
  replacement_status?: string | null;
  replaced_by_item_id?: string | null;
}

interface ExtraItem {
  item: SyncTaskItem;
  billboard: any;
  /** محمية: تم تركيبها أو جزء من سجل استبدال — لا تُحذف */
  protected: boolean;
  protectReason?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** العقد الأساسي (للعرض) */
  contractId: number;
  /** جميع العقود المرتبطة بمجموعة المهام (للمهام المدمجة) */
  contractIds?: number[];
  taskIds: string[];
  /** عناصر مهام المجموعة الحالية */
  existingItems: SyncTaskItem[];
  onConfirm: (toAdd: MissingBillboard[], removeItemIds: string[]) => void;
  isAdding?: boolean;
  billboardById?: Record<number, any>;
}

const isProtectedItem = (item: SyncTaskItem): { protected: boolean; reason?: string } => {
  if (item.status === 'completed') return { protected: true, reason: 'تم التركيب' };
  if (item.replaced_by_item_id || item.replacement_status) return { protected: true, reason: 'ضمن سجل استبدال' };
  return { protected: false };
};

export function SyncMissingBillboardsDialog({
  open,
  onOpenChange,
  contractId,
  contractIds,
  taskIds,
  existingItems,
  onConfirm,
  isAdding = false,
  billboardById = {},
}: Props) {
  const [missingBillboards, setMissingBillboards] = useState<MissingBillboard[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [selectedAddIds, setSelectedAddIds] = useState<Set<number>>(new Set());
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const effectiveContractIds = useMemo(() => {
    const ids = new Set<number>((contractIds && contractIds.length ? contractIds : [contractId]).map(Number).filter(Boolean));
    return [...ids].sort((a, b) => a - b);
  }, [contractIds, contractId]);

  useEffect(() => {
    if (!open || effectiveContractIds.length === 0) return;

    const run = async () => {
      setLoading(true);
      setSelectedAddIds(new Set());
      setSelectedRemoveIds(new Set());
      try {
        // 1. لوحات العقود (billboard_ids) — المصدر الوحيد للحقيقة
        const { data: contracts, error: contractError } = await supabase
          .from('Contract')
          .select('Contract_Number, billboard_ids')
          .in('Contract_Number', effectiveContractIds);
        if (contractError) console.error('Error fetching contracts:', contractError);

        // 🚫 اللوحات الموقوفة لا تعتبر ضمن العقد
        const { data: pausedRows } = await supabase
          .from('paused_billboards' as any)
          .select('billboard_id, contract_number')
          .in('contract_number', effectiveContractIds);
        const pausedKey = new Set<string>((pausedRows || []).map((p: any) => `${Number(p.contract_number)}_${Number(p.billboard_id)}`));

        const contractOfBillboard = new Map<number, number>();
        (contracts || []).forEach((c: any) => {
          String(c.billboard_ids || '')
            .split(',')
            .map((s: string) => Number(s.trim()))
            .filter((id: number) => !isNaN(id) && id > 0)
            .forEach((id: number) => {
              if (pausedKey.has(`${Number(c.Contract_Number)}_${id}`)) return;
              if (!contractOfBillboard.has(id)) contractOfBillboard.set(id, Number(c.Contract_Number));
            });
        });

        const existingBillboardIds = new Set(existingItems.map(i => Number(i.billboard_id)));

        // 2. اللوحات الناقصة (في العقد وليست في المهام)
        const missingIds = [...contractOfBillboard.keys()].filter(id => !existingBillboardIds.has(id));

        // 3. اللوحات الزائدة (في المهام وليست في العقد)
        const extraRaw = existingItems.filter(i => !contractOfBillboard.has(Number(i.billboard_id)));

        // تحميل بيانات اللوحات المطلوبة
        const neededIds = [...new Set([...missingIds, ...extraRaw.map(i => Number(i.billboard_id))])];
        const bbMap: Record<number, any> = {};
        const notLoaded: number[] = [];
        neededIds.forEach(id => {
          if (billboardById[id]) bbMap[id] = billboardById[id];
          else notLoaded.push(id);
        });
        if (notLoaded.length > 0) {
          const { data: fetched } = await supabase
            .from('billboards')
            .select('ID, Billboard_Name, Size, City, Nearest_Landmark, Image_URL, image_name, Faces_Count, friend_company_id, friend_companies:friend_company_id(name)')
            .in('ID', notLoaded);
          (fetched || []).forEach((bb: any) => {
            bbMap[bb.ID] = { ...bb, friendCompanyName: bb.friend_companies?.name || null };
          });
        }

        // أسماء الشركات الصديقة
        const friendIds = [...new Set(Object.values(bbMap).map((bb: any) => bb.friend_company_id).filter((x: any) => x && !Object.values(bbMap).find((b: any) => b.friend_company_id === x && b.friendCompanyName)))];
        const friendNames: Record<string, string> = {};
        if (friendIds.length > 0) {
          const { data: companies } = await supabase.from('friend_companies').select('id, name').in('id', friendIds as string[]);
          (companies || []).forEach((c: any) => { friendNames[c.id] = c.name; });
        }

        const formattedMissing: MissingBillboard[] = missingIds
          .filter(id => bbMap[id])
          .map(id => {
            const bb = bbMap[id];
            return {
              ID: bb.ID,
              Billboard_Name: bb.Billboard_Name,
              Size: bb.Size,
              City: bb.City,
              Nearest_Landmark: bb.Nearest_Landmark,
              Image_URL: bb.Image_URL,
              image_name: bb.image_name,
              Faces_Count: bb.Faces_Count,
              friend_company_id: bb.friend_company_id,
              friendCompanyName: bb.friendCompanyName || friendNames[bb.friend_company_id] || undefined,
              contractId: contractOfBillboard.get(id),
            };
          });

        const formattedExtra: ExtraItem[] = extraRaw.map(item => {
          const p = isProtectedItem(item);
          return {
            item,
            billboard: bbMap[Number(item.billboard_id)] || { ID: item.billboard_id },
            protected: p.protected,
            protectReason: p.reason,
          };
        });

        setMissingBillboards(formattedMissing);
        setExtraItems(formattedExtra);
        setSelectedAddIds(new Set(formattedMissing.map(b => b.ID)));
        setSelectedRemoveIds(new Set(formattedExtra.filter(e => !e.protected).map(e => e.item.id)));
      } catch (err) {
        console.error('Error syncing billboards with contract:', err);
        setMissingBillboards([]);
        setExtraItems([]);
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, effectiveContractIds.join(','), taskIds.join(',')]);

  const removableExtras = extraItems.filter(e => !e.protected);
  const protectedExtras = extraItems.filter(e => e.protected);

  const toggleAdd = (id: number) => setSelectedAddIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleRemove = (id: string) => setSelectedRemoveIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleConfirm = () => {
    onConfirm(
      missingBillboards.filter(b => selectedAddIds.has(b.ID)),
      removableExtras.filter(e => selectedRemoveIds.has(e.item.id)).map(e => e.item.id),
    );
  };

  const totalActions = selectedAddIds.size + selectedRemoveIds.size;
  const inSync = !loading && missingBillboards.length === 0 && removableExtras.length === 0;

  const renderBillboardRow = (
    bb: any,
    opts: { key: string; checked?: boolean; onToggle?: () => void; tone: 'add' | 'remove' | 'protected'; badge?: string },
  ) => {
    const toneClass = opts.tone === 'add'
      ? (opts.checked ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border hover:border-muted-foreground/30')
      : opts.tone === 'remove'
        ? (opts.checked ? 'border-destructive/50 bg-destructive/5' : 'border-border hover:border-muted-foreground/30')
        : 'border-border/60 bg-muted/30 opacity-80';
    return (
      <div
        key={opts.key}
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${opts.onToggle ? 'cursor-pointer' : ''} ${toneClass}`}
        onClick={opts.onToggle}
      >
        {opts.onToggle ? (
          <Checkbox checked={!!opts.checked} className="mt-0.5" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
        )}
        <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
          <BillboardImage billboard={bb} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{bb.Billboard_Name || `لوحة ${bb.ID}`}</span>
            {bb.Size && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{bb.Size}</Badge>
            )}
            {opts.badge && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{opts.badge}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {bb.Nearest_Landmark && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {bb.Nearest_Landmark}
              </span>
            )}
            {bb.friendCompanyName && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 shrink-0">
                <Building2 className="h-2.5 w-2.5" />
                {bb.friendCompanyName}
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-500" />
            مطابقة اللوحات مع العقد — {effectiveContractIds.map(id => `#${id}`).join('، ')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            جعل لوحات المهمة انعكاساً للعقد: إضافة اللوحات الناقصة وحذف اللوحات غير الموجودة في العقد.
            اللوحات التي تم تركيبها لا تُحذف.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col gap-3 py-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : inSync && protectedExtras.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center py-10 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            لوحات المهام مطابقة للعقد تماماً
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[55vh] -mx-2 px-2">
            <div className="flex flex-col gap-5">
              {missingBillboards.length > 0 && (
                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600">
                      <Plus className="h-4 w-4" />
                      لوحات ناقصة (موجودة في العقد)
                    </span>
                    <Badge variant="secondary" className="text-xs">{selectedAddIds.size} / {missingBillboards.length}</Badge>
                  </div>
                  {missingBillboards.map(bb => renderBillboardRow(bb, {
                    key: `add-${bb.ID}`,
                    checked: selectedAddIds.has(bb.ID),
                    onToggle: () => toggleAdd(bb.ID),
                    tone: 'add',
                    badge: effectiveContractIds.length > 1 && bb.contractId ? `عقد #${bb.contractId}` : undefined,
                  }))}
                </section>
              )}

              {removableExtras.length > 0 && (
                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-destructive">
                      <Trash2 className="h-4 w-4" />
                      لوحات زائدة (ليست في العقد) — سيتم حذفها
                    </span>
                    <Badge variant="secondary" className="text-xs">{selectedRemoveIds.size} / {removableExtras.length}</Badge>
                  </div>
                  {removableExtras.map(e => renderBillboardRow(e.billboard, {
                    key: `rm-${e.item.id}`,
                    checked: selectedRemoveIds.has(e.item.id),
                    onToggle: () => toggleRemove(e.item.id),
                    tone: 'remove',
                  }))}
                </section>
              )}

              {protectedExtras.length > 0 && (
                <section className="flex flex-col gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    ليست في العقد لكنها محمية من الحذف
                  </span>
                  {protectedExtras.map(e => renderBillboardRow(e.billboard, {
                    key: `pr-${e.item.id}`,
                    tone: 'protected',
                    badge: e.protectReason,
                  }))}
                </section>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
            إغلاق
          </Button>
          <Button onClick={handleConfirm} disabled={totalActions === 0 || isAdding || loading} className="gap-1.5">
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري المطابقة...
              </>
            ) : (
              <>
                تطبيق المطابقة
                {selectedAddIds.size > 0 && ` (+${selectedAddIds.size})`}
                {selectedRemoveIds.size > 0 && ` (-${selectedRemoveIds.size})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
