// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PauseCircle, Search, Check, X, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { addPausedBillboard, listRemovedBillboardsHistory } from '@/services/pausedBillboardsService';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractNumber: number | null;
  onAdded?: () => void;
}

export function AddPausedBillboardDialog({ open, onOpenChange, contractNumber, onAdded }: Props) {
  const [tab, setTab] = useState<'history' | 'all'>('history');
  const [allBillboards, setAllBillboards] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<any>(null);

  const [pauseDate, setPauseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [originalPrice, setOriginalPrice] = useState<number>(0);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [deduct, setDeduct] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setSearch('');
    setNotes('');
    setRefundAmount(0);
    setOriginalPrice(0);
    setDeduct(true);
    setPauseDate(new Date().toISOString().split('T')[0]);

    (async () => {
      const { data } = await supabase.from('billboards').select('ID, Billboard_Name, City, Size, Price, Image_URL').limit(5000);
      setAllBillboards(data || []);
      if (contractNumber) {
        try {
          const h = await listRemovedBillboardsHistory(contractNumber);
          // resolve names
          const ids = (h || []).map((r: any) => r.billboard_id);
          if (ids.length) {
            const { data: bbs } = await supabase
              .from('billboards')
              .select('ID, Billboard_Name, City, Size, Price, Image_URL')
              .in('ID', ids);
            const map = new Map((bbs || []).map((b: any) => [String(b.ID), b]));
            setHistory(
              (h || []).map((r: any) => ({
                ...r,
                billboard: map.get(String(r.billboard_id)) || null,
              }))
            );
          } else {
            setHistory([]);
          }
        } catch {
          setHistory([]);
        }
      }
    })();
  }, [open, contractNumber]);

  const filteredAll = useMemo(() => {
    const q = search.trim();
    if (!q) return allBillboards.slice(0, 200);
    return allBillboards
      .filter((b) =>
        [b.Billboard_Name, b.City, b.Size]
          .map((v: any) => String(v || ''))
          .join(' ')
          .includes(q)
      )
      .slice(0, 200);
  }, [allBillboards, search]);

  const pick = (b: any) => {
    setPicked(b);
    setOriginalPrice(Number(b.Price) || 0);
    setRefundAmount(Number(b.Price) || 0);
  };

  const handleSave = async () => {
    if (!contractNumber) {
      toast.error('رقم العقد غير متوفر');
      return;
    }
    if (!picked) {
      toast.error('اختر اللوحة');
      return;
    }
    try {
      setSaving(true);
      await addPausedBillboard({
        contract_number: contractNumber,
        billboard_id: Number(picked.ID),
        billboard_name: picked.Billboard_Name || null,
        pause_date: pauseDate,
        original_price: Number(originalPrice) || 0,
        consumed_amount: Math.max(0, (Number(originalPrice) || 0) - (Number(refundAmount) || 0)),
        refund_amount: Number(refundAmount) || 0,
        deducted_from_contract: deduct,
        notes: notes || null,
      });
      toast.success('تم تسجيل اللوحة كموقوفة');
      onOpenChange(false);
      onAdded?.();
    } catch (e: any) {
      toast.error('فشل التسجيل: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-[720px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <PauseCircle className="w-6 h-6 text-primary" />
            إضافة لوحة موقوفة للعقد
          </DialogTitle>
        </DialogHeader>

        {!picked ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-3">
            <TabsList>
              <TabsTrigger value="history">
                <RotateCcw className="w-4 h-4 ml-1" />
                لوحات مُزالت سابقاً ({history.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                <Search className="w-4 h-4 ml-1" />
                كل اللوحات
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="space-y-2">
              {history.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  لا توجد لوحات مُزالة من هذا العقد سابقاً
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                  {history.map((row, i) => (
                    <button
                      key={`${row.billboard_id}-${i}`}
                      type="button"
                      onClick={() => row.billboard && pick(row.billboard)}
                      disabled={!row.billboard}
                      className="text-right p-3 border border-border rounded-lg hover:border-primary hover:bg-muted/40 transition disabled:opacity-50"
                    >
                      <div className="font-bold text-sm">
                        {row.billboard?.Billboard_Name || `#${row.billboard_id}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {row.billboard?.City} • {row.billboard?.Size}
                      </div>
                      <div className="text-xs mt-1 flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          أُزيلت: {row.end_date}
                        </Badge>
                        {row.individual_billboard_data?.type === 'pause' && (
                          <Badge className="text-[10px] bg-primary/20 text-primary border border-primary/30">
                            إيقاف سابق
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="all" className="space-y-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث بالاسم/المدينة/المقاس..."
                  className="pr-10"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto">
                {filteredAll.map((b: any) => (
                  <button
                    key={b.ID}
                    type="button"
                    onClick={() => pick(b)}
                    className="text-right p-3 border border-border rounded-lg hover:border-primary hover:bg-muted/40 transition"
                  >
                    <div className="font-bold text-sm">{b.Billboard_Name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {b.City} • {b.Size}
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3 py-2">
            <div className="bg-muted/50 border border-border p-3 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">{picked.Billboard_Name}</div>
                <div className="text-xs text-muted-foreground">
                  {picked.City} • {picked.Size}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                تغيير
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">تاريخ الإيقاف</Label>
                <Input type="date" value={pauseDate} onChange={(e) => setPauseDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">السعر الأصلي للوحة</Label>
                <Input
                  type="number"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">قيمة الاسترداد (غير المستهلك)</Label>
                <Input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">القيمة المستهلكة</Label>
                <Input
                  type="number"
                  value={Math.max(0, originalPrice - refundAmount)}
                  disabled
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 bg-muted/40 border border-border p-3 rounded-lg">
              <Label htmlFor="deduct-add" className="cursor-pointer text-foreground text-sm">
                خصم قيمة الاسترداد من إجمالي العقد
              </Label>
              <Switch id="deduct-add" checked={deduct} onCheckedChange={setDeduct} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">ملاحظات (اختياري)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 ml-1" />
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={!picked || saving}>
            <Check className="w-4 h-4 ml-1" />
            {saving ? 'جاري الحفظ...' : 'تسجيل كموقوفة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
