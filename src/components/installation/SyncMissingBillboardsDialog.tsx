import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { BillboardImage } from '@/components/BillboardImage';
import { MapPin, Building2, Loader2, Package } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MissingBillboard {
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
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: number;
  taskIds: string[];
  existingBillboardIds: Set<number>;
  onConfirm: (billboards: MissingBillboard[]) => void;
  isAdding?: boolean;
  billboardById?: Record<number, any>;
}

export function SyncMissingBillboardsDialog({
  open,
  onOpenChange,
  contractId,
  taskIds,
  existingBillboardIds,
  onConfirm,
  isAdding = false,
  billboardById = {},
}: Props) {
  const [missingBillboards, setMissingBillboards] = useState<MissingBillboard[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !contractId) return;

    const fetchMissing = async () => {
      setLoading(true);
      setSelectedIds(new Set());
      try {
        // 1. Get contract billboard_ids
        const { data: contract, error: contractError } = await supabase
          .from('Contract')
          .select('billboard_ids')
          .eq('Contract_Number', contractId)
          .single();

        if (contractError) {
          console.error('Error fetching contract:', contractError);
        }

        if (!contract?.billboard_ids) {
          console.warn('No billboard_ids found for contract', contractId);
          setMissingBillboards([]);
          return;
        }

        const contractBillboardIds = contract.billboard_ids
          .split(',')
          .map((id: string) => Number(id.trim()))
          .filter((id: number) => !isNaN(id) && id > 0);

        // 🚫 Exclude paused billboards
        const { data: pausedRows } = await supabase
          .from('paused_billboards' as any)
          .select('billboard_id')
          .eq('contract_number', contractId);
        const pausedSet = new Set<number>((pausedRows || []).map((p: any) => Number(p.billboard_id)));

        const missingIds = contractBillboardIds.filter((id: number) => !existingBillboardIds.has(id) && !pausedSet.has(id));
        console.log(`Missing billboard IDs (${missingIds.length}):`, missingIds);

        if (missingIds.length === 0) {
          setMissingBillboards([]);
          return;
        }


        // 2. Try to use pre-loaded billboardById first
        const hasBillboardData = Object.keys(billboardById).length > 0;
        let formatted: MissingBillboard[] = [];

        if (hasBillboardData) {
          // Use pre-loaded data — no extra DB request needed
          const foundFromMap = missingIds
            .map((id: number) => billboardById[id])
            .filter(Boolean);

          // Collect friend_company_ids to fetch names
          const friendCompanyIds = [...new Set(
            foundFromMap
              .map((bb: any) => bb.friend_company_id)
              .filter(Boolean)
          )];

          let friendCompanyNames: Record<string, string> = {};
          if (friendCompanyIds.length > 0) {
            const { data: companies } = await supabase
              .from('friend_companies')
              .select('id, name')
              .in('id', friendCompanyIds);
            if (companies) {
              companies.forEach((c: any) => { friendCompanyNames[c.id] = c.name; });
            }
          }

          formatted = foundFromMap.map((bb: any) => ({
            ID: bb.ID,
            Billboard_Name: bb.Billboard_Name,
            Size: bb.Size,
            City: bb.City,
            Nearest_Landmark: bb.Nearest_Landmark,
            Image_URL: bb.Image_URL,
            image_name: bb.image_name,
            Faces_Count: bb.Faces_Count,
            friend_company_id: bb.friend_company_id,
            friendCompanyName: bb.friendCompanyName || friendCompanyNames[bb.friend_company_id] || null,
          }));
        } else {
          // Fallback: query DB directly
          const { data: billboards, error: bbError } = await supabase
            .from('billboards')
            .select('ID, Billboard_Name, Size, City, Nearest_Landmark, Image_URL, image_name, Faces_Count, friend_company_id, friend_companies:friend_company_id(name)')
            .in('ID', missingIds);

          if (!billboards?.length) {
            console.warn('No billboard data returned for missing IDs:', missingIds, 'Error:', bbError);
            setMissingBillboards([]);
            return;
          }

          formatted = billboards.map((bb: any) => ({
            ID: bb.ID,
            Billboard_Name: bb.Billboard_Name,
            Size: bb.Size,
            City: bb.City,
            Nearest_Landmark: bb.Nearest_Landmark,
            Image_URL: bb.Image_URL,
            image_name: bb.image_name,
            Faces_Count: bb.Faces_Count,
            friend_company_id: bb.friend_company_id,
            friendCompanyName: bb.friend_companies?.name || null,
          }));
        }

        setMissingBillboards(formatted);
        setSelectedIds(new Set(formatted.map(b => b.ID)));
      } catch (err) {
        console.error('Error fetching missing billboards:', err);
        setMissingBillboards([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMissing();
  }, [open, contractId, existingBillboardIds, billboardById]);

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === missingBillboards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(missingBillboards.map(b => b.ID)));
    }
  };

  const handleConfirm = () => {
    const selected = missingBillboards.filter(b => selectedIds.has(b.ID));
    onConfirm(selected);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-500" />
            اللوحات الناقصة — عقد {contractId}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            اللوحات الموجودة في العقد ولم يتم إنشاء مهمة تركيب لها بعد
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col gap-3 py-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : missingBillboards.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
 جميع اللوحات موجودة بالفعل في المهام 
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1 py-2">
              <div role="button" tabIndex={0} onClick={toggleAll} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-accent rounded-md px-3 py-1.5">
                <Checkbox checked={selectedIds.size === missingBillboards.length} onCheckedChange={toggleAll} />
                {selectedIds.size === missingBillboards.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </div>
              <Badge variant="secondary" className="text-xs">
                {selectedIds.size} / {missingBillboards.length} محددة
              </Badge>
            </div>

            <ScrollArea className="flex-1 max-h-[50vh] -mx-2 px-2">
              <div className="flex flex-col gap-2">
                {missingBillboards.map(bb => {
                  const isSelected = selectedIds.has(bb.ID);
                  return (
                    <div
                      key={bb.ID}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                      onClick={() => toggleOne(bb.ID)}
                    >
                      <Checkbox checked={isSelected} className="mt-0.5" />

                      <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        <BillboardImage
                          billboard={bb}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {bb.Billboard_Name || `لوحة ${bb.ID}`}
                          </span>
                          {bb.Size && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                              {bb.Size}
                            </Badge>
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
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
            إلغاء
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || isAdding || loading}
            className="gap-1.5"
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الإضافة...
              </>
            ) : (
              <>
                إضافة {selectedIds.size} لوحة
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
