// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CalendarPlus, Plus, Save, Trash2, RefreshCw, Search, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useSystemDialog } from '@/contexts/SystemDialogContext';

const empty = { size: '', billboard_level: 'عادي', customer_category: 'عادي', one_day: 0, duration_prices: '{}' };

export default function EventPricingList() {
  const { confirm } = useSystemDialog();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const load = async () => { const { data, error } = await supabase.from('event_pricing' as any).select('*').order('size').order('billboard_level'); if (error) toast.error('تعذر تحميل أسعار المناسبات: ' + error.message); else setRows(data || []); };
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => rows.filter((r) => `${r.size} ${r.billboard_level} ${r.customer_category}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const save = async () => {
    if (!form.size.trim()) return toast.error('اكتب المقاس');
    let durationPrices: any = {};
    try { durationPrices = form.duration_prices ? JSON.parse(form.duration_prices) : {}; } catch { return toast.error('أسعار المدد يجب أن تكون بصيغة JSON صحيحة'); }
    setSaving(true);
    const { error } = await supabase.from('event_pricing' as any).insert({ size: form.size.trim(), billboard_level: form.billboard_level.trim() || 'عادي', customer_category: form.customer_category.trim() || 'عادي', one_day: Number(form.one_day) || 0, duration_prices: durationPrices });
    setSaving(false); if (error) toast.error('فشل الحفظ: ' + error.message); else { toast.success('تمت إضافة سعر المناسبة'); setForm(empty); load(); }
  };
  const remove = async (id: string) => { if (!await confirm({ title: 'حذف سعر المناسبة', message: 'هل تريد حذف هذا السعر؟', confirmText: 'حذف', cancelText: 'إلغاء', variant: 'destructive' })) return; const { error } = await supabase.from('event_pricing' as any).delete().eq('id', id); if (error) toast.error(error.message); else load(); };
  return <div dir="rtl" className="space-y-6">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><p className="text-xs font-semibold text-muted-foreground">نظام المناسبات</p><h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><CalendarPlus className="h-7 w-7 text-primary" /> قائمة أسعار المناسبات</h1><p className="text-sm text-muted-foreground mt-1">أسعار مستقلة عن أسعار العقود والعروض العادية</p></div><Button variant="outline" size="icon" onClick={load} title="تحديث"><RefreshCw className="h-4 w-4" /></Button></div>
    <Card className="border-primary/20"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-primary" /> إضافة سعر مناسبة</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"><div><Label>المقاس</Label><Input value={form.size} onChange={e => setForm({...form,size:e.target.value})} placeholder="مثال: 8×3" /></div><div><Label>المستوى</Label><Input value={form.billboard_level} onChange={e => setForm({...form,billboard_level:e.target.value})} /></div><div><Label>الفئة</Label><Input value={form.customer_category} onChange={e => setForm({...form,customer_category:e.target.value})} /></div><div><Label>سعر اليوم</Label><Input type="number" value={form.one_day} onChange={e => setForm({...form,one_day:e.target.value})} /></div><Button onClick={save} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> حفظ السعر</Button><div className="md:col-span-5"><Label>أسعار المدد الاختيارية (JSON)</Label><Input value={form.duration_prices} onChange={e => setForm({...form,duration_prices:e.target.value})} placeholder={'مثال: {"1.5": 1200, "24": 15000}'} /><p className="text-xs text-muted-foreground mt-1">استخدم عدد الأشهر كمفتاح، مثل 1.5 لشهر ونصف و24 لسنتين.</p></div></CardContent></Card>
    <Card><CardHeader><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><CardTitle className="text-lg">الأسعار المطبقة على عقود المناسبات <Badge variant="secondary">{filtered.length}</Badge></CardTitle><div className="relative w-full md:w-80"><Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pr-9" placeholder="بحث بالمقاس أو الفئة" value={q} onChange={e => setQ(e.target.value)} /></div></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-right"><th className="p-3">المقاس</th><th className="p-3">المستوى</th><th className="p-3">الفئة</th><th className="p-3">سعر اليوم</th><th className="p-3">المدد</th><th className="p-3">إجراء</th></tr></thead><tbody>{filtered.map(r => <tr key={r.id} className="border-b hover:bg-muted/40"><td className="p-3 font-bold text-primary">{r.size}</td><td className="p-3">{r.billboard_level}</td><td className="p-3"><Badge variant="outline" className="gap-1"><Tag className="h-3 w-3" />{r.customer_category}</Badge></td><td className="p-3 font-semibold">{Number(r.one_day || 0).toLocaleString('ar-LY')} د.ل</td><td className="p-3 text-xs text-muted-foreground">{Object.keys(r.duration_prices || {}).length ? Object.keys(r.duration_prices).join('، ') + ' شهر' : 'سعر اليوم فقط'}</td><td className="p-3"><Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(r.id)} title="حذف"><Trash2 className="h-4 w-4" /></Button></td></tr>)}{!filtered.length && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">لا توجد أسعار مناسبات بعد</td></tr>}</tbody></table></div></CardContent></Card>
  </div>;
}
