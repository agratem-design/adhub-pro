import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scissors, Building2, DollarSign, TrendingUp, TrendingDown, Upload, Image as ImageIcon, Loader2, Landmark, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface CutoutBillboardItem {
  id: string; // installation_task_items.id
  billboard_id: number;
  has_cutout?: boolean;
  cutout_workshop_id?: string | null;
  cutout_company_cost?: number | null;
  cutout_customer_cost?: number | null;
  cutout_count?: number | null;
  cutout_image_url?: string | null;
  cutout_notes?: string | null;
  design_image_url?: string | null; // fallback image from print task
  billboard?: {
    ID: number;
    Billboard_Name?: string;
    Size?: string;
    Image_URL?: string;
    Nearest_Landmark?: string;
  };
}

interface Workshop {
  id: string;
  name: string;
  is_active?: boolean;
  source?: 'workshop' | 'printer';
}


interface Props {
  items: CutoutBillboardItem[];
  onChange: (items: CutoutBillboardItem[]) => void;
  onEnableCutoutForItem?: (itemId: string) => void; // optional callback to enable has_cutout from outside
}

const NumberInputWithSuffix = ({ value, onChange, suffix, placeholder = '0', className }: {
  value: number | '';
  onChange: (value: number | '') => void;
  suffix: string;
  placeholder?: string;
  className?: string;
}) => (
  <div dir="ltr" className={cn("flex items-center rounded-xl border border-border/20 bg-background px-2 h-10 min-w-0", className)}>
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      step="0.5"
      value={value}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      className="h-9 flex-1 min-w-0 border-0 bg-transparent text-center text-xs font-semibold font-mono focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
      placeholder={placeholder}
    />
    <span className="text-xs font-semibold text-muted-foreground/60 shrink-0 px-1 whitespace-nowrap">{suffix}</span>
  </div>
);

export const CutoutPerBillboardEditor: React.FC<Props> = ({ items, onChange, onEnableCutoutForItem }) => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Bulk-apply (تعميم على كل اللوحات) ──
  const [bulkWorkshop, setBulkWorkshop] = useState<string>('none');
  const [bulkCompanyCost, setBulkCompanyCost] = useState<number | ''>('');
  const [bulkCustomerCost, setBulkCustomerCost] = useState<number | ''>('');
  const [bulkCount, setBulkCount] = useState<number | ''>('');
  const [bulkApplying, setBulkApplying] = useState(false);

  useEffect(() => {
    (async () => {
      const [wsRes, prRes] = await Promise.all([
        supabase.from('cutout_workshops').select('id, name, is_active').eq('is_active', true).order('name'),
        supabase.from('printers').select('id, name, is_active').eq('is_active', true).order('name'),
      ]);
      const merged: Workshop[] = [];
      const seen = new Set<string>();
      (wsRes.data || []).forEach((w: any) => { if (!seen.has(w.id)) { seen.add(w.id); merged.push({ ...w, source: 'workshop' }); } });
      (prRes.data || []).forEach((p: any) => { if (!seen.has(p.id)) { seen.add(p.id); merged.push({ ...p, source: 'printer' }); } });
      setWorkshops(merged);
    })();
  }, []);


  const cutoutItems = useMemo(() => items.filter(it => it.has_cutout), [items]);

  const totals = useMemo(() => {
    let count = 0, company = 0, customer = 0;
    cutoutItems.forEach(it => {
      const c = Number(it.cutout_count) || 1;
      count += c;
      company += (Number(it.cutout_company_cost) || 0) * c;
      customer += (Number(it.cutout_customer_cost) || 0) * c;
    });
    return { count, company, customer, profit: customer - company };
  }, [cutoutItems]);

  const updateItem = async (id: string, patch: Partial<CutoutBillboardItem>) => {
    const next = items.map(it => (it.id === id ? { ...it, ...patch } : it));
    onChange(next);
    // Persist immediately
    const dbPatch: Record<string, any> = {};
    if ('cutout_workshop_id' in patch) dbPatch.cutout_workshop_id = patch.cutout_workshop_id || null;
    if ('cutout_company_cost' in patch) dbPatch.cutout_company_cost = patch.cutout_company_cost ?? 0;
    if ('cutout_customer_cost' in patch) dbPatch.cutout_customer_cost = patch.cutout_customer_cost ?? 0;
    if ('cutout_count' in patch) dbPatch.cutout_count = patch.cutout_count ?? 1;
    if ('cutout_image_url' in patch) dbPatch.cutout_image_url = patch.cutout_image_url || null;
    if ('cutout_notes' in patch) dbPatch.cutout_notes = patch.cutout_notes || null;
    if ('has_cutout' in patch) dbPatch.has_cutout = !!patch.has_cutout;
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await (supabase.from('installation_task_items') as any).update(dbPatch).eq('id', id);
    if (error) toast.error('فشل الحفظ: ' + error.message);
  };

  const uploadImage = async (id: string, file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('يرجى اختيار صورة'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('الحجم > 10MB'); return; }
    setUploadingId(id);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `mockups/${id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('mockup-images').upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('mockup-images').getPublicUrl(path);
      await updateItem(id, { cutout_image_url: data.publicUrl });
      toast.success('تم رفع الصورة');
    } catch (e: any) {
      toast.error('فشل الرفع: ' + (e?.message || ''));
    } finally {
      setUploadingId(null);
    }
  };

  // ── Apply bulk values to all cutout-enabled items ──
  const applyBulk = async (opts: { workshopOnly?: boolean }) => {
    const targets = items.filter(it => it.has_cutout);
    if (targets.length === 0) { toast.error('لا توجد لوحات مفعّل عليها مجسم'); return; }
    setBulkApplying(true);
    try {
      const patch: Partial<CutoutBillboardItem> = {};
      if (bulkWorkshop && bulkWorkshop !== 'none') patch.cutout_workshop_id = bulkWorkshop;
      if (!opts.workshopOnly) {
        if (bulkCompanyCost !== '' && !Number.isNaN(Number(bulkCompanyCost))) patch.cutout_company_cost = Number(bulkCompanyCost);
        if (bulkCustomerCost !== '' && !Number.isNaN(Number(bulkCustomerCost))) patch.cutout_customer_cost = Number(bulkCustomerCost);
        if (bulkCount !== '' && !Number.isNaN(Number(bulkCount))) patch.cutout_count = Math.max(1, Number(bulkCount));
      }
      if (Object.keys(patch).length === 0) { toast.error('لا توجد قيم للتعميم'); return; }

      const next = items.map(it => (it.has_cutout ? { ...it, ...patch } : it));
      onChange(next);

      // Build db patch
      const dbPatch: Record<string, any> = {};
      if ('cutout_workshop_id' in patch) dbPatch.cutout_workshop_id = patch.cutout_workshop_id;
      if ('cutout_company_cost' in patch) dbPatch.cutout_company_cost = patch.cutout_company_cost;
      if ('cutout_customer_cost' in patch) dbPatch.cutout_customer_cost = patch.cutout_customer_cost;
      if ('cutout_count' in patch) dbPatch.cutout_count = patch.cutout_count;

      const ids = targets.map(t => t.id);
      const { error } = await (supabase.from('installation_task_items') as any)
        .update(dbPatch).in('id', ids);
      if (error) throw error;
      toast.success(`تم التطبيق على ${targets.length} لوحة`);
    } catch (e: any) {
      toast.error('فشل التعميم: ' + (e?.message || ''));
    } finally {
      setBulkApplying(false);
    }
  };

  // ── Toggle cutout status for all billboards in the task ──
  const toggleAllCutouts = async (enable: boolean) => {
    if (items.length === 0) return;
    setBulkApplying(true);
    try {
      const next = items.map(it => ({ ...it, has_cutout: enable }));
      onChange(next);
      const ids = items.map(t => t.id);
      const { error } = await (supabase.from('installation_task_items') as any)
        .update({ has_cutout: enable })
        .in('id', ids);
      if (error) throw error;
      toast.success(enable ? `تم تفعيل المجسم على جميع اللوحات (${items.length})` : `تم إيقاف المجسم على جميع اللوحات (${items.length})`);
    } catch (e: any) {
      toast.error('فشل التعديل الجماعي: ' + (e?.message || ''));
    } finally {
      setBulkApplying(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-4 text-right">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-right">
        <div className="p-3.5 rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] text-right">
          <div className="text-xs font-semibold text-muted-foreground/80 mb-2 leading-relaxed">إجمالي لوحات المهمة</div>
          <div className="text-xl font-bold text-purple-600 flex items-center justify-start gap-1.5 leading-none">
            <Building2 className="h-4.5 w-4.5 shrink-0" />
            <span>{items.length}</span>
            <span className="text-xs font-semibold text-muted-foreground/80 mr-1">لوحة ({cutoutItems.length} مجسم)</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] text-right">
          <div className="text-xs font-semibold text-muted-foreground/80 mb-2 leading-relaxed">إجمالي تكلفة الشركات</div>
          <div className="text-xl font-bold text-amber-600 flex items-center justify-start gap-1 leading-none">
            <span>{totals.companyCost.toLocaleString('ar-LY')}</span>
            <span className="text-xs font-semibold mr-0.5">د.ل</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] text-right">
          <div className="text-xs font-semibold text-muted-foreground/80 mb-2 leading-relaxed">إجمالي سعر الزبائن</div>
          <div className="text-xl font-bold text-emerald-600 flex items-center justify-start gap-1 leading-none">
            <span>{totals.customerCost.toLocaleString('ar-LY')}</span>
            <span className="text-xs font-semibold mr-0.5">د.ل</span>
          </div>
        </div>

        <div className={cn("p-3.5 rounded-2xl border text-right", 
          totals.profit >= 0 ? "bg-emerald-500/[0.03] border-emerald-500/20" : "bg-rose-500/[0.03] border-rose-500/20")}>
          <div className="text-xs font-semibold text-muted-foreground/80 mb-2 leading-relaxed">صافي أرباح القص</div>
          <div className={cn("text-xl font-bold flex items-center justify-start gap-1 leading-none", 
            totals.profit >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {totals.profit >= 0 ? <TrendingUp className="h-4.5 w-4.5 shrink-0" /> : <TrendingDown className="h-4.5 w-4.5 shrink-0" />}
            <span>{totals.profit.toLocaleString('ar-LY')}</span>
            <span className="text-xs font-semibold mr-0.5">د.ل</span>
          </div>
        </div>
      </div>

      {/* Bulk apply (تعميم على المهمة) */}
      <Card dir="rtl" className="p-5 border-purple-500/20 bg-purple-500/[0.02] rounded-2xl shadow-sm backdrop-blur-md relative overflow-hidden text-right">
        <div className="absolute top-0 left-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-x-5 -translate-y-5"></div>
        <Label className="text-sm font-bold mb-4 flex items-center gap-2.5 text-purple-600 relative leading-relaxed">
          <Building2 className="h-5 w-5 shrink-0 text-purple-500" /> 
          <span>تعميم وتطبيق جماعي على جميع مجسمات المهمة</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 relative text-right">
          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground/80 font-semibold leading-relaxed text-right block">ورشة القص الموحدة</Label>
            <Select value={bulkWorkshop} onValueChange={setBulkWorkshop}>
              <SelectTrigger className="h-10 text-xs rounded-xl bg-background border-border/20">
                <SelectValue placeholder="اختر ورشة للتعميم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— غير محدد —</SelectItem>
                {workshops.map(w => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}{w.source === 'printer' ? ' (مطبعة)' : ' (ورشة)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-amber-600 font-semibold leading-relaxed text-right block">تكلفة الشركة / قطعة</Label>
            <NumberInputWithSuffix value={bulkCompanyCost} onChange={setBulkCompanyCost} suffix="د.ل" placeholder="—" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-emerald-600 font-semibold leading-relaxed text-right block">سعر العميل / قطعة</Label>
            <NumberInputWithSuffix value={bulkCustomerCost} onChange={setBulkCustomerCost} suffix="د.ل" placeholder="—" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-semibold leading-relaxed text-right block">الكمية لكل لوحة</Label>
            <NumberInputWithSuffix value={bulkCount} onChange={setBulkCount} suffix="قطعة" placeholder="—" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 relative">
          <Button 
            size="sm" 
            className="h-9 text-xs font-semibold rounded-xl px-4 shadow-sm" 
            disabled={bulkApplying} 
            onClick={() => applyBulk({})}
          >
            تطبيق القيم على جميع المجسمات
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-9 text-xs font-semibold rounded-xl px-4 border-purple-200 text-purple-600 hover:bg-purple-50/50 transition-colors" 
            disabled={bulkApplying || bulkWorkshop === 'none'} 
            onClick={() => applyBulk({ workshopOnly: true })}
          >
            تعميم الورشة فقط
          </Button>
        </div>
      </Card>

      {/* Checklist to toggle cutout state per billboard */}
      {items.length > 0 && (
        <Card dir="rtl" className="p-5 border-dashed border-border/20 bg-muted/5 rounded-2xl text-right">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <Label className="text-sm font-semibold text-foreground leading-relaxed text-right">تفعيل أو إيقاف المجسم على لوحات المهمة:</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2.5 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold"
                disabled={bulkApplying}
                onClick={() => toggleAllCutouts(false)}
              >
                إيقاف المجسم على الجميع
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2.5 rounded-lg border-purple-200 text-purple-600 hover:bg-purple-50 font-semibold"
                disabled={bulkApplying}
                onClick={() => toggleAllCutouts(true)}
              >
                تفعيل المجسم على الجميع
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 max-h-32 overflow-y-auto p-1.5">
            {items.map(it => (
              <button
                key={`toggle-${it.id}`}
                type="button"
                onClick={() => updateItem(it.id, { has_cutout: !it.has_cutout })}
                className={cn(
                  "text-xs px-3.5 py-2 rounded-xl border transition-all duration-300 font-semibold flex items-center gap-1.5 shadow-none leading-relaxed cursor-pointer",
                  it.has_cutout
                    ? "bg-purple-500 text-white border-purple-650 shadow-sm shadow-purple-500/10 scale-[1.01]"
                    : "bg-background/80 text-muted-foreground/80 border-border/15 hover:border-purple-300 hover:text-purple-650 hover:bg-background"
                )}
              >
                {it.has_cutout ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Scissors className="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />}
                <span>{it.billboard?.Billboard_Name || `لوحة #${it.billboard_id}`}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Items list */}
      {cutoutItems.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground/70 border-2 border-dashed border-border/20 rounded-2xl bg-muted/5 font-semibold leading-relaxed">
          <Scissors className="h-9 w-9 text-muted-foreground/30 mx-auto mb-3" />
          <span>لا توجد لوحات مفعّل عليها مجسم حالياً. يمكنك تفعيلها من القائمة أعلاه.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {cutoutItems.map(it => {
            const count = Number(it.cutout_count) || 1;
            const compTotal = (Number(it.cutout_company_cost) || 0) * count;
            const custTotal = (Number(it.cutout_customer_cost) || 0) * count;
            const profit = custTotal - compTotal;
            return (
              <Card key={it.id} dir="rtl" className="p-5 border-purple-200/40 bg-card/60 backdrop-blur-md rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 text-right">
                <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr] gap-5">
                  {/* Image / upload wrapper */}
                  <div className="flex flex-col items-center">
                    <input
                      ref={(el) => (fileRefs.current[it.id] = el)}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(it.id, f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRefs.current[it.id]?.click()}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-purple-200 bg-purple-500/[0.02] flex items-center justify-center overflow-hidden hover:bg-purple-500/5 relative group transition-all duration-300 shadow-inner cursor-pointer"
                      title={it.cutout_image_url ? 'تغيير صورة المجسم' : 'تحميل صورة مجسم (اختياري)'}
                    >
                      {uploadingId === it.id ? (
                        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                      ) : it.cutout_image_url ? (
                        <>
                          <img src={it.cutout_image_url} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">تغيير</div>
                        </>
                      ) : it.design_image_url ? (
                        <>
                          <img src={it.design_image_url} alt="" className="w-full h-full object-cover opacity-80" />
                          <span className="absolute bottom-0 inset-x-0 text-xs bg-black/60 text-white text-center leading-tight py-0.5 font-semibold">تصميم</span>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-purple-500/60 group-hover:text-purple-500">
                          <Upload className="h-5 w-5" />
                          <span className="text-xs font-semibold">ارفع صورة</span>
                        </div>
                      )}
                    </button>
                  </div>

                  <div className="min-w-0 text-right">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-4 pb-2.5 border-b border-border/10 text-right">
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate flex items-center gap-2 text-foreground leading-relaxed">
                          <Scissors className="h-4.5 w-4.5 text-purple-500 shrink-0" />
                          <span>{it.billboard?.Billboard_Name || `لوحة TR-TC${String(it.billboard_id).padStart(4, '0')}`}</span>
                        </div>
                        <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                          {it.billboard?.Size && <Badge variant="secondary" className="text-xs font-semibold h-5.5 px-2.5 rounded-lg bg-muted/65 border border-border/10">{it.billboard.Size}</Badge>}
                          {it.billboard?.Nearest_Landmark && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold truncate leading-relaxed">
                              <Landmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" /> 
                              <span className="truncate">{it.billboard.Nearest_Landmark}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-xs shrink-0 font-semibold rounded-lg py-1 px-3 border-none shadow-none leading-normal",
                        profit >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                      )}>
                        صافي ربح: {profit.toLocaleString('ar-LY')} د.ل
                      </Badge>
                    </div>

                    {/* Workshop + count + costs */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-right">
                      <div className="col-span-1 sm:col-span-2 space-y-1.5">
                        <Label className="text-xs text-muted-foreground/80 font-semibold leading-relaxed block text-right">ورشة صناعة المجسم</Label>
                        <Select
                          value={it.cutout_workshop_id || 'none'}
                          onValueChange={(v) => updateItem(it.id, { cutout_workshop_id: v === 'none' ? null : v })}
                        >
                          <SelectTrigger className="h-9.5 text-xs rounded-xl bg-background border-border/20">
                            <SelectValue placeholder="اختر ورشة" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— غير محدد —</SelectItem>
                            {workshops.map(w => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}{w.source === 'printer' ? ' (مطبعة)' : ' (ورشة)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground/85 font-semibold leading-relaxed block text-right">العدد بالقطعة</Label>
                        <NumberInputWithSuffix value={count} onChange={(value) => updateItem(it.id, { cutout_count: Math.max(1, Number(value) || 1) })} suffix="قطعة" />
                      </div>
                      <div className="hidden sm:block" />
                      
                      <div className="space-y-1.5">
                        <Label className="text-xs text-amber-600 font-semibold block leading-relaxed text-right">تكلفة الشركة / قطعة</Label>
                        <NumberInputWithSuffix value={it.cutout_company_cost ?? ''} onChange={(value) => updateItem(it.id, { cutout_company_cost: Number(value) || 0 })} suffix="د.ل" />
                        <div className="text-xs text-amber-500 font-semibold text-center mt-1 leading-relaxed">الإجمالي: {compTotal.toLocaleString('ar-LY')} د.ل</div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label className="text-xs text-emerald-600 font-semibold block leading-relaxed text-right">سعر الزبون / قطعة</Label>
                        <NumberInputWithSuffix value={it.cutout_customer_cost ?? ''} onChange={(value) => updateItem(it.id, { cutout_customer_cost: Number(value) || 0 })} suffix="د.ل" />
                        <div className="text-xs text-emerald-500 font-semibold text-center mt-1 leading-relaxed">الإجمالي: {custTotal.toLocaleString('ar-LY')} د.ل</div>
                      </div>

                      <div className="col-span-1 sm:col-span-2 space-y-1.5">
                        <Label className="text-xs text-muted-foreground/80 font-semibold leading-relaxed block text-right">ملاحظات القص</Label>
                        <Input
                          dir="rtl"
                          value={it.cutout_notes || ''}
                          onChange={(e) => updateItem(it.id, { cutout_notes: e.target.value })}
                          className="h-9.5 text-xs rounded-xl text-right"
                          placeholder="مثال: أحرف بارزة مضيئة، بلاستيك..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
