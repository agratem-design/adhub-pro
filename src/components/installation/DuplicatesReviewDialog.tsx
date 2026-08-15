import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, MapPin } from 'lucide-react';

interface DuplicateRow {
  itemId: string;
  billboardId: number;
  billboardName: string;
  size: string;
  city: string;
  imageUrl: string;
  nearestLandmark: string;
  taskId: string;
  taskShortId: string;
  teamName: string;
  contractName: string;
  priority: number;
  willKeep: boolean;
  reason: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: DuplicateRow[];
  onConfirm: (itemIdsToDelete: string[]) => void;
  isPending?: boolean;
}

export const DuplicatesReviewDialog: React.FC<Props> = ({ open, onOpenChange, rows, onConfirm, isPending }) => {
  const groups = useMemo(() => {
    const map: Record<string, DuplicateRow[]> = {};
    rows.forEach(r => {
      const key = `${r.contractName}_${r.billboardId}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [rows]);

  // Default selection: all rows where willKeep === false
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) {
      const init = new Set<string>();
      rows.forEach(r => { if (!r.willKeep) init.add(r.itemId); });
      setSelected(init);
    }
  }, [open, rows]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(rows.filter(r => !r.willKeep).map(r => r.itemId)));
  };
  const invert = () => {
    setSelected(prev => {
      const next = new Set<string>();
      rows.forEach(r => { if (!prev.has(r.itemId) && !r.willKeep) next.add(r.itemId); });
      return next;
    });
  };
  const clear = () => setSelected(new Set());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col font-sans" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>مراجعة اللوحات المكررة قبل الحذف</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="text-muted-foreground">
            {Object.keys(groups).length} لوحة مكررة بالعقود — محدد للحذف: <strong>{selected.size}</strong>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={selectAll}>تحديد الكل</Button>
            <Button size="sm" variant="outline" onClick={invert}>عكس التحديد</Button>
            <Button size="sm" variant="ghost" onClick={clear}>إلغاء</Button>
          </div>
        </div>

        <ScrollArea className="flex-1 border rounded-md font-sans">
          <div className="p-3 space-y-4">
            {Object.entries(groups).map(([groupKey, items]) => (
              <div key={groupKey} className="border rounded-md overflow-hidden">
                <div className="px-4 py-3 bg-muted/40 border-b flex items-start gap-4 justify-between">
                  <div className="flex gap-3 items-center">
                    {items[0].imageUrl && (
                      <img
                        src={items[0].imageUrl}
                        alt={items[0].billboardName}
                        className="w-16 h-12 object-cover rounded border border-border bg-background"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="font-bold text-sm flex flex-wrap items-center gap-2 text-right">
                        <span>{items[0].contractName}</span>
                        <span className="text-muted-foreground/60">—</span>
                        <span className="text-amber-500 font-black">اللوحة #{items[0].billboardId}</span>
                        <span className="text-muted-foreground">({items[0].billboardName})</span>
                        {items[0].size && (
                          <span dir="ltr" className="inline-block px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black rounded ml-1">
                            {items[0].size}
                          </span>
                        )}
                      </div>
                      {items[0].nearestLandmark && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 text-right">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>أقرب نقطة دالة: {items[0].nearestLandmark}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold shrink-0 bg-background/50">
                    {items[0].city}
                  </Badge>
                </div>
                
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="text-muted-foreground border-b bg-muted/20">
                      <th className="p-2 w-10 text-center"></th>
                      <th className="p-2 text-right">المهمة</th>
                      <th className="p-2 text-right">الفريق</th>
                      <th className="p-2 text-right">العقد</th>
                      <th className="p-2 text-right">الأولوية</th>
                      <th className="p-2 text-right">الحالة</th>
                      <th className="p-2 text-right">السبب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(it => {
                      const isDeleted = selected.has(it.itemId);
                      const isManuallyToggled = isDeleted !== !it.willKeep;
                      const displayReason = isManuallyToggled
                        ? (isDeleted ? 'تحديد يدوي للحذف' : 'تحديد يدوي للإبقاء')
                        : it.reason;

                      return (
                        <tr key={it.itemId} className={`border-b last:border-0 ${!isDeleted ? 'bg-emerald-500/5' : ''}`}>
                          <td className="p-2 text-center">
                            <Checkbox checked={isDeleted} onCheckedChange={() => toggle(it.itemId)} />
                          </td>
                          <td className="p-2 font-mono" dir="ltr">{it.taskShortId}</td>
                          <td className="p-2 font-semibold">{it.teamName}</td>
                          <td className="p-2 text-muted-foreground">{it.contractName}</td>
                          <td className="p-2 font-mono">{it.priority}</td>
                          <td className="p-2">
                            {!isDeleted
                              ? <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">يُحتفظ به</Badge>
                              : <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/5">سيتم حذفه</Badge>}
                          </td>
                          <td className="p-2 text-muted-foreground">{displayReason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">لا توجد لوحات مكررة.</div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>إلغاء</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(Array.from(selected))}
            disabled={isPending || selected.size === 0}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            تأكيد حذف {selected.size}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export type { DuplicateRow };
