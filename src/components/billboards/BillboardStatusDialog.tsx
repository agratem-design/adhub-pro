import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertTriangle, Ruler, XCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useBillboardStatuses, BillboardStatusType, STATUS_LABELS } from '@/hooks/useBillboardStatuses';
import { scheduleBodyPointerEventsCleanup, usePointerEventsCleanupOnUnmount } from '@/hooks/usePointerEventsCleanup';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboard: any;
  onLocalUpdate?: (id: number | string, updates: Record<string, any>) => void;
}

export const BillboardStatusDialog: React.FC<Props> = ({ open, onOpenChange, billboard, onLocalUpdate }) => {
  const bbId = Number(billboard?.ID || billboard?.id);
  const contractNumber = billboard?.Contract_Number ? Number(billboard.Contract_Number) : null;
  const currentSize = billboard?.Size || billboard?.size || '';

  const { add, resolveByType } = useBillboardStatuses([bbId]);
  const isTorn = String(billboard?.maintenance_status || '').toLowerCase() === 'torn';
  const [type, setType] = useState<BillboardStatusType>('torn_ad');
  const [note, setNote] = useState('');
  const [oldSize, setOldSize] = useState('');
  const [newSize, setNewSize] = useState('');
  const [saving, setSaving] = useState(false);

  usePointerEventsCleanupOnUnmount();

  useEffect(() => {
    if (open) {
      setType('torn_ad');
      setNote('');
      setOldSize(currentSize);
      setNewSize('');
    }
  }, [open, currentSize]);

  const handleSave = async () => {
    if (!bbId) return;
    setSaving(true);
    try {
      if (type === 'torn_ad' && isTorn) {
        await resolveByType([bbId], 'torn_ad');
        const { error } = await supabase
          .from('billboards')
          // @ts-ignore
          .update({ maintenance_status: 'operational' })
          .eq('ID', bbId);
        if (error) throw error;
        onLocalUpdate?.(bbId, { maintenance_status: 'operational' });
        toast.success('تم تسجيل الإصلاح');
      } else {
        await add({
          billboard_id: bbId,
          contract_number: contractNumber,
          status_type: type,
          note: note || null,
          old_size: type === 'size_changed' ? oldSize || null : null,
          new_size: type === 'size_changed' ? newSize || null : null,
        });
        if (type === 'torn_ad') {
          const { error } = await supabase
            .from('billboards')
            // @ts-ignore
            .update({ maintenance_status: 'torn' })
            .eq('ID', bbId);
          if (error) throw error;
          onLocalUpdate?.(bbId, { maintenance_status: 'torn' });
        }
      }
      handleOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'فشل حفظ الحالة');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      scheduleBodyPointerEventsCleanup();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>تسجيل حالة للوحة {billboard?.Billboard_Name || billboard?.name || ''}</DialogTitle>
        </DialogHeader>
        <Tabs value={type} onValueChange={(v) => setType(v as BillboardStatusType)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="torn_ad" className="gap-1">
              {isTorn ? (
                <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />تم الإصلاح</>
              ) : (
                <><AlertTriangle className="h-3.5 w-3.5" />ممزق</>
              )}
            </TabsTrigger>
            <TabsTrigger value="size_changed" className="gap-1"><Ruler className="h-3.5 w-3.5" />تغيير مقاس</TabsTrigger>
          </TabsList>

          <TabsContent value="size_changed" className="space-y-2 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">المقاس السابق</Label>
                <Input value={oldSize} onChange={(e) => setOldSize(e.target.value)} placeholder="مثال: 4x12" />
              </div>
              <div>
                <Label className="text-xs">المقاس الجديد</Label>
                <Input value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="مثال: 3x8" />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2 mt-2">
          <Label className="text-xs">ملاحظة (تظهر في التقرير)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`اكتب تفاصيل ${STATUS_LABELS[type]}...`}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {type === 'torn_ad' && isTorn ? 'تأكيد الإصلاح' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
