import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X, RefreshCw, Download, DollarSign, Layers, TrendingUp, Plus, Trash2, Ruler } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExportPricingData {
  id: number;
  size: string;
  billboard_level: string;
  customer_category: string;
  one_month: number;
  '2_months': number;
  '3_months': number;
  '6_months': number;
  full_year: number;
  one_day: number;
}

interface BillboardLevel {
  id: number;
  level_code: string;
  level_name: string;
  sort_order: number;
}

interface SizeRecord {
  id: number;
  name: string;
  sort_order: number | null;
}

interface EntryForm {
  size: string;
  level: string;
  one_day: number;
  one_month: number;
  '2_months': number;
  '3_months': number;
  '6_months': number;
  full_year: number;
}

interface NewSizeForm {
  name: string;
  width: string;
  height: string;
  sort_order: string;
  description: string;
}

const DURATION_TABS = [
  { key: 'one_day', label: 'يوم واحد' },
  { key: 'one_month', label: 'شهر' },
  { key: '2_months', label: 'شهرين' },
  { key: '3_months', label: '3 أشهر' },
  { key: '6_months', label: '6 أشهر' },
  { key: 'full_year', label: 'سنة' },
] as const;

type DurationKey = (typeof DURATION_TABS)[number]['key'];

const emptyEntry: EntryForm = {
  size: '',
  level: '',
  one_day: 0,
  one_month: 0,
  '2_months': 0,
  '3_months': 0,
  '6_months': 0,
  full_year: 0,
};

export default function ExportPricingList() {
  const [data, setData] = useState<ExportPricingData[]>([]);
  const [levels, setLevels] = useState<BillboardLevel[]>([]);
  const [sizes, setSizes] = useState<SizeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<{ id: number; field: DurationKey } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedDuration, setSelectedDuration] = useState<DurationKey>('one_month');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddSizeDialog, setShowAddSizeDialog] = useState(false);
  const [newEntry, setNewEntry] = useState<EntryForm>(emptyEntry);
  const [newSize, setNewSize] = useState<NewSizeForm>({ name: '', width: '', height: '', sort_order: '', description: '' });

  const loadData = async () => {
    setLoading(true);
    const [{ data: rows }, { data: lvls }, { data: szs }] = await Promise.all([
      supabase.from('export_pricing').select('*'),
      supabase.from('billboard_levels').select('*').order('sort_order'),
      supabase.from('sizes').select('*').order('sort_order').order('name'),
    ]);

    setData((rows || []) as ExportPricingData[]);
    setLevels((lvls || []) as BillboardLevel[]);
    setSizes((szs || []) as SizeRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const availableLevels = useMemo(() => {
    const usedLevels = new Set(data.map((item) => item.billboard_level));
    return levels.filter((level) => usedLevels.has(level.level_code)).sort((a, b) => a.sort_order - b.sort_order);
  }, [data, levels]);

  const sortedSizeNames = useMemo(() => {
    const remaining = new Set(data.map((item) => item.size));
    const ordered: string[] = [];

    sizes.forEach((size) => {
      if (remaining.has(size.name)) {
        ordered.push(size.name);
        remaining.delete(size.name);
      }
    });

    Array.from(remaining).sort((a, b) => a.localeCompare(b, 'ar')).forEach((size) => ordered.push(size));
    return ordered;
  }, [data, sizes]);

  const nextSizeSortOrder = useMemo(() => {
    return sizes.reduce((max, size) => Math.max(max, size.sort_order ?? 0), 0) + 1;
  }, [sizes]);

  const filtered = useMemo(() => {
    return data.filter((item) => selectedLevel === 'all' || item.billboard_level === selectedLevel);
  }, [data, selectedLevel]);

  const displayLevelCodes = useMemo(() => {
    if (selectedLevel !== 'all') return [selectedLevel];
    return availableLevels.map((level) => level.level_code);
  }, [selectedLevel, availableLevels]);

  const sizeRows = useMemo(() => {
    const sizeMap = new Map<string, Map<string, { id: number; value: number }>>();

    filtered.forEach((item) => {
      if (!sizeMap.has(item.size)) sizeMap.set(item.size, new Map());
      sizeMap.get(item.size)?.set(item.billboard_level, {
        id: item.id,
        value: Number(item[selectedDuration] || 0),
      });
    });

    return sortedSizeNames.filter((size) => sizeMap.has(size)).map((size) => ({ size, levels: sizeMap.get(size)! }));
  }, [filtered, selectedDuration, sortedSizeNames]);

  const currentDurationLabel = DURATION_TABS.find((tab) => tab.key === selectedDuration)?.label || '';

  const stats = useMemo(() => {
    const values = filtered.map((item) => Number(item[selectedDuration] || 0));
    const total = filtered.length;
    const avgPrice = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    const maxPrice = values.length ? Math.max(...values) : 0;
    return { total, avgPrice, maxPrice };
  }, [filtered, selectedDuration]);

  const formatNumber = (value: number) => (value ? value.toLocaleString('ar-LY') : '—');

  const startEdit = (id: number, field: DurationKey, currentValue: number) => {
    setEditing({ id, field });
    setEditValue(String(currentValue));
  };

  const saveEdit = async () => {
    if (!editing) return;

    const numVal = Number(editValue);
    if (Number.isNaN(numVal)) {
      toast.error('قيمة غير صالحة');
      return;
    }

    const { error } = await supabase.from('export_pricing').update({ [editing.field]: numVal } as any).eq('id', editing.id);
    if (error) {
      toast.error('فشل في حفظ السعر');
      return;
    }

    setData((prev) => prev.map((item) => (item.id === editing.id ? { ...item, [editing.field]: numVal } : item)));
    setEditing(null);
    toast.success('تم حفظ السعر');
  };

  const deleteRow = async (id: number) => {
    if (!window.confirm('هل تريد حذف هذا السعر؟')) return;

    const { error } = await supabase.from('export_pricing').delete().eq('id', id);
    if (error) {
      toast.error('فشل في الحذف');
      return;
    }

    setData((prev) => prev.filter((item) => item.id !== id));
    toast.success('تم الحذف');
  };

  const addEntry = async () => {
    if (!newEntry.size || !newEntry.level) {
      toast.error('اختر المقاس والمستوى');
      return;
    }

    if (data.some((item) => item.size === newEntry.size && item.billboard_level === newEntry.level)) {
      toast.error('هذا المقاس والمستوى موجود بالفعل');
      return;
    }

    const { error } = await supabase.from('export_pricing').insert({
      size: newEntry.size,
      billboard_level: newEntry.level,
      customer_category: 'شركات',
      one_day: newEntry.one_day,
      one_month: newEntry.one_month,
      '2_months': newEntry['2_months'],
      '3_months': newEntry['3_months'],
      '6_months': newEntry['6_months'],
      full_year: newEntry.full_year,
    } as any);

    if (error) {
      toast.error('فشل في الإضافة');
      return;
    }

    setShowAddDialog(false);
    setNewEntry(emptyEntry);
    toast.success('تمت الإضافة');
    loadData();
  };

  const openAddSizeDialog = () => {
    setNewSize({ name: '', width: '', height: '', sort_order: String(nextSizeSortOrder), description: '' });
    setShowAddSizeDialog(true);
  };

  const addSize = async () => {
    const name = newSize.name.trim();
    const width = Number(newSize.width);
    const height = Number(newSize.height);
    const sortOrder = Number(newSize.sort_order);

    if (!name || width <= 0 || height <= 0 || sortOrder <= 0) {
      toast.error('أدخل اسم المقاس والأبعاد والترتيب بشكل صحيح');
      return;
    }

    if (sizes.some((size) => size.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.error('هذا المقاس موجود بالفعل');
      return;
    }

    if (sizes.some((size) => (size.sort_order ?? 0) === sortOrder)) {
      toast.error('رقم الترتيب مستخدم بالفعل');
      return;
    }

    const { data: insertedSize, error } = await supabase
      .from('sizes')
      .insert({
        name,
        width,
        height,
        sort_order: sortOrder,
        description: newSize.description.trim() || null,
        installation_price: 0,
      } as any)
      .select('id, name, sort_order')
      .single();

    if (error || !insertedSize) {
      toast.error('فشل في إضافة المقاس');
      return;
    }

    setSizes((prev) => [...prev, insertedSize as SizeRecord].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));
    setNewEntry((prev) => ({ ...prev, size: insertedSize.name }));
    setShowAddSizeDialog(false);
    toast.success('تمت إضافة المقاس بنجاح');
  };

  const syncFromPricing = async () => {
    const confirmed = window.confirm('هل تريد مزامنة أسعار فئة "شركات" من جدول أسعار الإيجار؟ سيتم استبدال جميع أسعار التصدير الحالية.');
    if (!confirmed) return;

    setSyncing(true);
    try {
      await supabase.from('export_pricing').delete().neq('id', 0);
      const { data: pricingData } = await supabase
        .from('pricing')
        .select('size, billboard_level, customer_category, one_month, "2_months", "3_months", "6_months", full_year, one_day')
        .eq('customer_category', 'شركات');

      if (pricingData?.length) {
        const inserts = pricingData.map((item: any) => ({
          size: item.size,
          billboard_level: item.billboard_level,
          customer_category: item.customer_category,
          one_month: item.one_month || 0,
          '2_months': item['2_months'] || 0,
          '3_months': item['3_months'] || 0,
          '6_months': item['6_months'] || 0,
          full_year: item.full_year || 0,
          one_day: item.one_day || 0,
        }));

        await supabase.from('export_pricing').insert(inserts as any);
      }

      toast.success(`تمت مزامنة ${pricingData?.length || 0} سجل من فئة "شركات"`);
      loadData();
    } catch {
      toast.error('فشل في المزامنة');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6" dir="rtl">
      <Card className="border-0 bg-gradient-to-l from-primary/5 via-background to-background shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">أسعار التصدير</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">الأسعار المعروضة في شيت الأسعار بملفات التصدير — فئة شركات</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowAddDialog(true)} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة سعر
              </Button>
              <Button onClick={openAddSizeDialog} variant="outline" className="gap-2">
                <Ruler className="h-4 w-4" />
                إضافة مقاس
              </Button>
              <Button onClick={syncFromPricing} variant="outline" className="gap-2 border-primary/30 hover:bg-primary/5" disabled={syncing}>
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                مزامنة من أسعار الإيجار
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border border-border/50">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الأسعار</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">متوسط السعر ({currentDurationLabel})</p>
              <p className="text-xl font-bold">{formatNumber(stats.avgPrice)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">أعلى سعر ({currentDurationLabel})</p>
              <p className="text-xl font-bold">{formatNumber(stats.maxPrice)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            المستويات
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={selectedLevel} onValueChange={setSelectedLevel}>
            <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
              <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                الكل
                <Badge variant="secondary" className="mr-1.5 px-1.5 py-0 text-[10px]">{data.length}</Badge>
              </TabsTrigger>
              {availableLevels.map((level) => {
                const count = data.filter((item) => item.billboard_level === level.level_code).length;
                return (
                  <TabsTrigger key={level.level_code} value={level.level_code} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    {level.level_code}
                    <Badge variant="secondary" className="mr-1.5 px-1.5 py-0 text-[10px]">{count}</Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border border-border/50">
        <CardHeader className="border-b bg-muted/30 pb-0">
          <div className="mb-3 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-primary" />
              جدول الأسعار
              <Badge variant="outline" className="mr-2 text-xs">{filtered.length} سجل</Badge>
            </CardTitle>
          </div>
          <Tabs value={selectedDuration} onValueChange={(value) => setSelectedDuration(value as DurationKey)}>
            <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0">
              {DURATION_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="rounded-b-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-none"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="sticky right-0 z-10 min-w-[120px] bg-muted/40 p-3.5 text-right font-bold text-foreground">المقاس</th>
                {displayLevelCodes.map((levelCode) => (
                  <th key={levelCode} className="min-w-[130px] p-3.5 text-center font-bold text-foreground">
                    <Badge variant="outline" className="border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-bold">
                      {levelCode}
                    </Badge>
                  </th>
                ))}
                <th className="w-[60px] p-3.5 text-center font-bold text-foreground">حذف</th>
              </tr>
            </thead>
            <tbody>
              {sizeRows.map((row, idx) => (
                <tr key={row.size} className={`border-b transition-colors hover:bg-primary/5 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                  <td className="sticky right-0 z-10 bg-inherit p-3.5 font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary/60" />
                      {row.size}
                    </div>
                  </td>
                  {displayLevelCodes.map((levelCode) => {
                    const cell = row.levels.get(levelCode);
                    if (!cell) return <td key={levelCode} className="p-3.5 text-center text-muted-foreground">—</td>;

                    const isEditing = editing?.id === cell.id && editing?.field === selectedDuration;
                    return (
                      <td key={levelCode} className="p-2 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-9 w-28 text-center text-sm font-medium"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') setEditing(null);
                              }}
                              autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}>
                              <Save className="h-4 w-4 text-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="w-full rounded-lg px-3 py-2 text-center text-base font-semibold tabular-nums transition-all hover:bg-primary/10 hover:text-primary"
                            onClick={() => startEdit(cell.id, selectedDuration, cell.value)}
                            title="انقر للتعديل"
                          >
                            {formatNumber(cell.value)}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-center">
                    {(() => {
                      const firstCell = row.levels.values().next().value as { id: number } | undefined;
                      if (!firstCell) return null;
                      return (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteRow(firstCell.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      );
                    })()}
                  </td>
                </tr>
              ))}
              {sizeRows.length === 0 && (
                <tr>
                  <td colSpan={displayLevelCodes.length + 2} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Download className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-base">لا توجد أسعار</p>
                      <p className="text-sm">استخدم زر المزامنة أو أضف مقاسًا وسعرًا جديدًا</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة سعر تصدير جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium">المقاس</label>
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2" onClick={openAddSizeDialog}>
                  <Plus className="h-3.5 w-3.5" />
                  إضافة مقاس جديد
                </Button>
              </div>
              <Select value={newEntry.size} onValueChange={(value) => setNewEntry((prev) => ({ ...prev, size: value }))}>
                <SelectTrigger><SelectValue placeholder="اختر المقاس" /></SelectTrigger>
                <SelectContent>
                  {sizes.map((size) => (
                    <SelectItem key={size.id} value={size.name}>{size.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">المستوى</label>
              <Select value={newEntry.level} onValueChange={(value) => setNewEntry((prev) => ({ ...prev, level: value }))}>
                <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                <SelectContent>
                  {levels.map((level) => (
                    <SelectItem key={level.id} value={level.level_code}>{level.level_code} — {level.level_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {DURATION_TABS.map((tab) => (
              <div key={tab.key} className="flex items-center gap-3">
                <label className="w-24 shrink-0 text-sm">{tab.label}</label>
                <Input
                  type="number"
                  value={newEntry[tab.key] || 0}
                  onChange={(e) => setNewEntry((prev) => ({ ...prev, [tab.key]: Number(e.target.value) || 0 }))}
                  className="h-9"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>إلغاء</Button>
            <Button onClick={addEntry}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSizeDialog} onOpenChange={setShowAddSizeDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مقاس جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">اسم المقاس</label>
              <Input value={newSize.name} onChange={(e) => setNewSize((prev) => ({ ...prev, name: e.target.value }))} placeholder="مثال: 4×12" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">العرض</label>
                <Input type="number" value={newSize.width} onChange={(e) => setNewSize((prev) => ({ ...prev, width: e.target.value }))} placeholder="4" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">الارتفاع</label>
                <Input type="number" value={newSize.height} onChange={(e) => setNewSize((prev) => ({ ...prev, height: e.target.value }))} placeholder="12" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">رقم الترتيب</label>
              <Input type="number" value={newSize.sort_order} onChange={(e) => setNewSize((prev) => ({ ...prev, sort_order: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">وصف اختياري</label>
              <Input value={newSize.description} onChange={(e) => setNewSize((prev) => ({ ...prev, description: e.target.value }))} placeholder="وصف داخلي للمقاس" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSizeDialog(false)}>إلغاء</Button>
            <Button onClick={addSize}>حفظ المقاس</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
