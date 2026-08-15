// @ts-nocheck
import { useState, useEffect } from 'react';
import { Pricing } from '@/types';
import { fetchPricing } from '@/services/supabaseService';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Search, Plus, Edit, Trash2, Download, Save, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { smartArabicMatch } from '@/lib/arabicSearch';
import { useAuth } from '@/contexts/AuthContext';

export const PricingTable = () => {
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Partial<Pricing>>({});

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const data = await fetchPricing();
      setPricing(data);
    } catch (error) {
      toast({
        title: "خطأ في تحميل الأسعار",
        description: "تعذر تحميل بيانات التسعير",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const { user, isAdmin } = useAuth();
  const enforcedCategory = !isAdmin && user?.pricingCategory ? user.pricingCategory : null;

  // استخراج الفئات والمستويات الفريدة من كل البيانات (بدون فلترة)
  const uniqueCategories = Array.from(new Set(pricing.map(p => p.Customer_Category))).filter(Boolean).sort();
  const uniqueLevels = Array.from(new Set(pricing.map(p => p.Billboard_Level))).filter(Boolean).sort();

  const filteredPricing = pricing.filter(item => {
    const matchesSearch = smartArabicMatch(
      [
        item.size,
        item.Billboard_Level,
        item.Customer_Category,
        item.Full_Year,
        item.Monthly,
        item.Daily,
      ],
      searchTerm
    );
    const matchesLevel = levelFilter === 'all' || item.Billboard_Level === levelFilter;
    const categoryToUse = enforcedCategory ?? categoryFilter;
    const matchesCategory = categoryToUse === 'all' || item.Customer_Category === categoryToUse;

    return matchesSearch && matchesLevel && matchesCategory;
  });

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined) return 'غير محدد';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (Number.isNaN(num)) return 'غير محدد';
    return `${num.toLocaleString('ar-LY')} د.ل`;
  };

  const getLevelBadge = (level: string) => {
    const variant = level === 'A' ? 'default' : 'secondary';
    return <Badge variant={variant}>مستوى {level}</Badge>;
  };

  const startEdit = (item: Pricing) => {
    if (!item.id) {
      toast({ title: 'لا يمكن التعديل', description: 'المعرف مفقود للسجل', variant: 'destructive' });
      return;
    }
    setEditingId(item.id as number);
    setEditValues({
      id: item.id,
      One_Day: item.One_Day ?? 0,
      One_Month: item.One_Month ?? 0,
      ['3_Months']: item['3_Months'] ?? 0,
      ['6_Months']: item['6_Months'] ?? 0,
      Full_Year: item.Full_Year ?? 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleValueChange = (field: keyof Pricing, value: string) => {
    const num = value === '' ? null : Number(value);
    setEditValues((prev) => ({ ...prev, [field]: Number.isNaN(num) ? null : num }));
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    setSaving(true);
    try {
      const payload = {
        One_Day: editValues.One_Day ?? null,
        One_Month: editValues.One_Month ?? null,
        ['3_Months']: (editValues as any)['3_Months'] ?? null,
        ['6_Months']: (editValues as any)['6_Months'] ?? null,
        Full_Year: editValues.Full_Year ?? null,
      } as any;
      // محاولة أساسية بالتحديث عبر المعرف
      let { data, error } = await supabase
        .from('pricing')
        .update(payload)
        .eq('id', editingId)
        .select();
      if (error) throw error;

      let updated = Array.isArray(data) ? data[0] : data;

      // إن لم يُرجع صفًا، نجرب بالتطابق عبر مفاتيح مركبة (الحجم + المستوى + الفئة)
      if (!updated) {
        const row = pricing.find((p) => p.id === editingId);
        if (!row) throw new Error('لم يتم العثور على السجل محليًا');
        const res2 = await supabase
          .from('pricing')
          .update(payload)
          .eq('size', row.size)
          .eq('Billboard_Level', row.Billboard_Level)
          .eq('Customer_Category', row.Customer_Category)
          .select();
        if (res2.error) throw res2.error;
        updated = Array.isArray(res2.data) ? res2.data[0] : (res2.data as any);
      }

      // كحل أخير: upsert على id
      if (!updated) {
        const res3 = await supabase
          .from('pricing')
          .upsert([{ id: editingId, ...(payload as any) }], { onConflict: 'id', ignoreDuplicates: false })
          .select();
        if (res3.error) throw res3.error;
        updated = Array.isArray(res3.data) ? res3.data[0] : (res3.data as any);
      }

      if (!updated) throw new Error('لم يتم العثور على السجل بعد التحديث');

      setPricing((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...updated } : p)));
      toast({ title: 'تم الحفظ', description: 'تم تحديث الأسعار بنجاح' });
      cancelEdit();
    } catch (e: any) {
      console.error('pricing update error:', e?.message || e);
      toast({ title: 'فشل الحفظ', description: `تعذر تحديث الأسعار: ${e?.message || 'غير معروف'}` as any, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    const variants: Record<string, string> = {
      'شركات': 'default',
      'عادي': 'secondary',
      'مسوق': 'outline',
      'المدينة': 'destructive'
    };
    return <Badge variant={variants[category] as any || 'outline'}>{category}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="mr-2">جاري تحميل الأسعار...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* رأس القسم */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <DollarSign className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">إدارة الأسعار</h2>
            <p className="text-muted-foreground">عرض وإدارة جداول الأسعار لجميع أحجام اللوحات</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            تصدير
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            سعر جديد
          </Button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الأسعار</p>
                <p className="text-2xl font-bold">{pricing.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-forewriter">أحجام مختلفة</p>
                <p className="text-2xl font-bold text-green-600">
                  {new Set(pricing.map(p => p.size)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">فئات العملاء</p>
                <p className="text-2xl font-bold text-blue-600">
                  {new Set(pricing.map(p => p.Customer_Category)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">أعلى سعر سنوي</p>
                <p className="text-lg font-bold text-orange-600">
                  {formatCurrency(Math.max(...pricing.map(p => p.Full_Year || 0)))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البحث والفلاتر */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن حجم اللوحة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger>
                <SelectValue placeholder="مستوى اللوحة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المستويات</SelectItem>
                {uniqueLevels.map(level => (
                  <SelectItem key={level} value={level}>مستوى {level}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {enforcedCategory ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30">
                  الفئة المحددة: {enforcedCategory}
                </Badge>
                <span className="text-xs text-muted-foreground">محدد من قبل المدير</span>
              </div>
            ) : (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="فئة العميل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفئات</SelectItem>
                  {uniqueCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              فلترة متقدمة
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* جدول الأسعار */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الحجم</TableHead>
                <TableHead className="text-right">مستوى اللوحة</TableHead>
                <TableHead className="text-right">فئة العميل</TableHead>
                <TableHead className="text-right">يو�� واحد</TableHead>
                <TableHead className="text-right">شهر واحد</TableHead>
                <TableHead className="text-right">3 أشهر</TableHead>
                <TableHead className="text-right">6 أشهر</TableHead>
                <TableHead className="text-right">سنة كاملة</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPricing.map((item, index) => (
                <TableRow key={`${item.id ?? `${item.size}-${item.Billboard_Level}-${item.Customer_Category}`}-${index}`}>
                  <TableCell className="font-medium">{item.size}</TableCell>
                  <TableCell>{getLevelBadge(item.Billboard_Level)}</TableCell>
                  <TableCell>{getCategoryBadge(item.Customer_Category)}</TableCell>
                  {editingId === item.id ? (
                    <>
                      <TableCell>
                        <Input type="number" value={(editValues.One_Day as number | null) ?? ''} onChange={(e) => handleValueChange('One_Day', e.target.value)} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={(editValues.One_Month as number | null) ?? ''} onChange={(e) => handleValueChange('One_Month', e.target.value)} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={((editValues as any)['3_Months'] as number | null) ?? ''} onChange={(e) => handleValueChange('3_Months' as any, e.target.value)} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={((editValues as any)['6_Months'] as number | null) ?? ''} onChange={(e) => handleValueChange('6_Months' as any, e.target.value)} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={(editValues.Full_Year as number | null) ?? ''} onChange={(e) => handleValueChange('Full_Year', e.target.value)} className="h-8" />
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>{formatCurrency(item.One_Day)}</TableCell>
                      <TableCell>{formatCurrency(item.One_Month)}</TableCell>
                      <TableCell>{formatCurrency(item['3_Months'])}</TableCell>
                      <TableCell>{formatCurrency(item['6_Months'])}</TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatCurrency(item.Full_Year)}
                      </TableCell>
                    </>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {editingId === item.id ? (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={cancelEdit} disabled={saving}>
                            <X className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={saveEdit} disabled={saving}>
                            <Save className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => startEdit(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredPricing.length === 0 && (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد أسعار</h3>
              <p className="text-muted-foreground">
                {pricing.length === 0 
                  ? "لم ��تم تحديد أي أسعار بعد"
                  : "لا توجد أسعار تطابق معايير البحث"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
