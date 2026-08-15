import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Trash2, Plus, ArrowUp, ArrowDown, Image, Building2, MapPin, 
  Upload, ClipboardPaste, DollarSign, Download, FileSpreadsheet, 
  Search, SlidersHorizontal, Loader2, Save, Sparkles, Check, AlertCircle 
} from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';

interface ExportSlide {
  id: string;
  title: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

interface ExportCompanyImage {
  id: string;
  company_name: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

interface ExportCityImage {
  id: string;
  city_name: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

interface ExportPricingRow {
  id: number;
  size: string;
  billboard_level: string;
  customer_category: string;
  one_day: number;
  one_month: number;
  "2_months": number;
  "3_months": number;
  "6_months": number;
  full_year: number;
  isNew?: boolean; // locally added
  hasChanges?: boolean; // locally modified
}

export default function ExportContentSettings() {
  const [slides, setSlides] = useState<ExportSlide[]>([]);
  const [companies, setCompanies] = useState<ExportCompanyImage[]>([]);
  const [cities, setCities] = useState<ExportCityImage[]>([]);
  const [pricing, setPricing] = useState<ExportPricingRow[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  
  // Search & Filters for pricing table
  const [searchSize, setSearchSize] = useState('');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  
  const pricingFileRef = useRef<HTMLInputElement>(null);
  const { uploadImageToFolder, uploadingImage } = useImageUpload();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [slidesRes, companiesRes, citiesRes, pricingRes] = await Promise.all([
        supabase.from('export_slides').select('*').order('sort_order'),
        supabase.from('export_company_images').select('*').order('sort_order'),
        supabase.from('export_city_images').select('*').order('sort_order'),
        supabase.from('export_pricing').select('*').order('id'),
      ]);
      
      if (slidesRes.data) setSlides(slidesRes.data);
      if (companiesRes.data) setCompanies(companiesRes.data);
      if (citiesRes.data) setCities(citiesRes.data);
      if (pricingRes.data) setPricing(pricingRes.data as ExportPricingRow[]);
    } catch (e) {
      console.error(e);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    loadData(); 
  }, [loadData]);

  // ===== Slides CRUD =====
  const addSlide = async () => {
    const maxOrder = slides.length > 0 ? Math.max(...slides.map(s => s.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from('export_slides').insert({
      title: 'سلايد جديد', image_url: '', sort_order: maxOrder, is_active: true,
    }).select().single();
    if (error) { toast.error('فشل في الإضافة'); return; }
    if (data) setSlides(prev => [...prev, data]);
    toast.success('تم إضافة سلايد جديد بنجاح');
  };

  const updateSlide = async (id: string, updates: Partial<ExportSlide>) => {
    const { error } = await supabase.from('export_slides').update(updates).eq('id', id);
    if (error) { toast.error('فشل في التحديث'); return; }
    setSlides(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSlide = async (id: string) => {
    const { error } = await supabase.from('export_slides').delete().eq('id', id);
    if (error) { toast.error('فشل في الحذف'); return; }
    setSlides(prev => prev.filter(s => s.id !== id));
    toast.success('تم حذف السلايد');
  };

  const moveSlide = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;
    
    const current = { ...slides[index] };
    const target = { ...slides[targetIndex] };
    
    // Swap sort order locally
    const tempOrder = current.sort_order;
    current.sort_order = target.sort_order;
    target.sort_order = tempOrder;
    
    // Update DB
    await Promise.all([
      supabase.from('export_slides').update({ sort_order: current.sort_order }).eq('id', current.id),
      supabase.from('export_slides').update({ sort_order: target.sort_order }).eq('id', target.id)
    ]);
    
    // Reload state sorted
    const updated = [...slides];
    updated[index] = target;
    updated[targetIndex] = current;
    setSlides(updated.sort((a, b) => a.sort_order - b.sort_order));
    toast.success('تم تغيير الترتيب');
  };

  // ===== Companies CRUD =====
  const addCompany = async () => {
    const maxOrder = companies.length > 0 ? Math.max(...companies.map(c => c.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from('export_company_images').insert({
      company_name: 'شركة جديدة', image_url: '', sort_order: maxOrder, is_active: true,
    }).select().single();
    if (error) { toast.error('فشل في الإضافة'); return; }
    if (data) setCompanies(prev => [...prev, data]);
    toast.success('تم إضافة الشركة بنجاح');
  };

  const updateCompany = async (id: string, updates: Partial<ExportCompanyImage>) => {
    const { error } = await supabase.from('export_company_images').update(updates).eq('id', id);
    if (error) { toast.error('فشل في التحديث'); return; }
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCompany = async (id: string) => {
    const { error } = await supabase.from('export_company_images').delete().eq('id', id);
    if (error) { toast.error('فشل في الحذف'); return; }
    setCompanies(prev => prev.filter(c => c.id !== id));
    toast.success('تم حذف الشركة');
  };

  const moveCompany = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= companies.length) return;
    
    const current = { ...companies[index] };
    const target = { ...companies[targetIndex] };
    
    const tempOrder = current.sort_order;
    current.sort_order = target.sort_order;
    target.sort_order = tempOrder;
    
    await Promise.all([
      supabase.from('export_company_images').update({ sort_order: current.sort_order }).eq('id', current.id),
      supabase.from('export_company_images').update({ sort_order: target.sort_order }).eq('id', target.id)
    ]);
    
    const updated = [...companies];
    updated[index] = target;
    updated[targetIndex] = current;
    setCompanies(updated.sort((a, b) => a.sort_order - b.sort_order));
    toast.success('تم تغيير الترتيب');
  };

  // ===== Cities CRUD =====
  const addCity = async () => {
    const maxOrder = cities.length > 0 ? Math.max(...cities.map(c => c.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from('export_city_images').insert({
      city_name: 'مدينة جديدة', image_url: '', sort_order: maxOrder, is_active: true,
    }).select().single();
    if (error) { toast.error('فشل في الإضافة'); return; }
    if (data) setCities(prev => [...prev, data]);
    toast.success('تم إضافة المدينة بنجاح');
  };

  const updateCity = async (id: string, updates: Partial<ExportCityImage>) => {
    const { error } = await supabase.from('export_city_images').update(updates).eq('id', id);
    if (error) { toast.error('فشل في التحديث'); return; }
    setCities(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCity = async (id: string) => {
    const { error } = await supabase.from('export_city_images').delete().eq('id', id);
    if (error) { toast.error('فشل في الحذف'); return; }
    setCities(prev => prev.filter(c => c.id !== id));
    toast.success('تم حذف المدينة');
  };

  const moveCity = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cities.length) return;
    
    const current = { ...cities[index] };
    const target = { ...cities[targetIndex] };
    
    const tempOrder = current.sort_order;
    current.sort_order = target.sort_order;
    target.sort_order = tempOrder;
    
    await Promise.all([
      supabase.from('export_city_images').update({ sort_order: current.sort_order }).eq('id', current.id),
      supabase.from('export_city_images').update({ sort_order: target.sort_order }).eq('id', target.id)
    ]);
    
    const updated = [...cities];
    updated[index] = target;
    updated[targetIndex] = current;
    setCities(updated.sort((a, b) => a.sort_order - b.sort_order));
    toast.success('تم تغيير الترتيب');
  };

  // ===== Image Upload Handler =====
  const handleImageUpload = async (
    file: File,
    itemId: string,
    itemName: string,
    type: 'slide' | 'company' | 'city'
  ) => {
    try {
      const url = await uploadImageToFolder(file, itemName, `export-${type}`);
      if (typeof url === 'string') {
        if (type === 'slide') await updateSlide(itemId, { image_url: url });
        else if (type === 'company') await updateCompany(itemId, { image_url: url });
        else await updateCity(itemId, { image_url: url });
        toast.success('تم رفع وتحديث الصورة بنجاح');
      }
    } catch {
      toast.error('حدث خطأ أثناء رفع الصورة');
    }
  };

  // ===== Pricing Excel Download / Upload =====
  const downloadPricingExcel = async () => {
    setPricingBusy(true);
    try {
      const { data, error } = await supabase
        .from('export_pricing')
        .select('*')
        .order('id');
      if (error) throw error;
      const rows = (data || []).map((r: any) => ({
        id: r.id,
        size: r.size,
        billboard_level: r.billboard_level,
        customer_category: r.customer_category,
        one_day: r.one_day ?? 0,
        one_month: r.one_month ?? 0,
        '2_months': r['2_months'] ?? 0,
        '3_months': r['3_months'] ?? 0,
        '6_months': r['6_months'] ?? 0,
        full_year: r.full_year ?? 0,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الأسعار');
      XLSX.writeFile(wb, `export_pricing_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('تم تنزيل ملف الأسعار بنجاح');
    } catch (e: any) {
      console.error(e);
      toast.error('فشل تنزيل ملف الأسعار');
    } finally {
      setPricingBusy(false);
    }
  };

  const uploadPricingExcel = async (file: File) => {
    setPricingBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: 0 });
      if (rows.length === 0) {
        toast.error('الملف فارغ');
        return;
      }
      const num = (v: any) => {
        if (v === null || v === undefined || v === '') return 0;
        const n = Number(String(v).replace(/[^\d.-]/g, ''));
        return isNaN(n) ? 0 : n;
      };
      
      let updated = 0;
      let inserted = 0;
      
      for (const row of rows) {
        const payload: any = {
          size: String(row.size ?? '').trim(),
          billboard_level: String(row.billboard_level ?? '').trim(),
          customer_category: String(row.customer_category ?? '').trim(),
          one_day: num(row.one_day),
          one_month: num(row.one_month),
          '2_months': num(row['2_months']),
          '3_months': num(row['3_months']),
          '6_months': num(row['6_months']),
          full_year: num(row.full_year),
        };
        
        if (!payload.size || !payload.billboard_level || !payload.customer_category) continue;
        
        if (row.id) {
          const { error } = await supabase.from('export_pricing').update(payload).eq('id', Number(row.id));
          if (!error) updated++;
        } else {
          const { error } = await supabase.from('export_pricing').insert(payload);
          if (!error) inserted++;
        }
      }
      
      toast.success(`تم تحديث ${updated} وإضافة ${inserted} سجل بنجاح`);
      // Reload pricing data
      const { data } = await supabase.from('export_pricing').select('*').order('id');
      if (data) setPricing(data as ExportPricingRow[]);
    } catch (e: any) {
      console.error(e);
      toast.error('فشل رفع الملف. تحقق من التنسيق والأعمدة المطلوبة');
    } finally {
      setPricingBusy(false);
      if (pricingFileRef.current) pricingFileRef.current.value = '';
    }
  };

  // ===== Inline Table Pricing Editing =====
  const addPricingRow = () => {
    const newRow: ExportPricingRow = {
      id: Date.now(), // temporary ID
      size: '',
      billboard_level: 'A',
      customer_category: 'عادي',
      one_day: 0,
      one_month: 0,
      "2_months": 0,
      "3_months": 0,
      "6_months": 0,
      full_year: 0,
      isNew: true
    };
    setPricing(prev => [newRow, ...prev]);
    toast.success('تمت إضافة صف سعر محلي جديد (تذكر الضغط على حفظ التغييرات)');
  };

  const updatePricingCell = (id: number, field: keyof ExportPricingRow, value: any) => {
    setPricing(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value, hasChanges: true };
      }
      return row;
    }));
  };

  const deletePricingRow = async (row: ExportPricingRow) => {
    if (row.isNew) {
      setPricing(prev => prev.filter(r => r.id !== row.id));
      toast.success('تم إلغاء الصف المضاف محلياً');
      return;
    }

    try {
      const { error } = await supabase.from('export_pricing').delete().eq('id', row.id);
      if (error) throw error;
      setPricing(prev => prev.filter(r => r.id !== row.id));
      toast.success('تم حذف باقة التسعير بنجاح');
    } catch (e) {
      toast.error('فشل في حذف باقة التسعير');
    }
  };

  const savePricingChanges = async () => {
    const changedRows = pricing.filter(row => row.hasChanges || row.isNew);
    if (changedRows.length === 0) {
      toast.info('لا توجد تعديلات لحفظها');
      return;
    }

    // Validation
    const invalid = changedRows.some(row => !row.size.trim());
    if (invalid) {
      toast.error('الرجاء التأكد من كتابة المقاس لجميع الباقات المعدلة أو المضافة');
      return;
    }

    setSavingPrices(true);
    try {
      let savedCount = 0;
      for (const row of changedRows) {
        const payload = {
          size: row.size.trim(),
          billboard_level: row.billboard_level,
          customer_category: row.customer_category,
          one_day: Number(row.one_day) || 0,
          one_month: Number(row.one_month) || 0,
          '2_months': Number(row['2_months']) || 0,
          '3_months': Number(row['3_months']) || 0,
          '6_months': Number(row['6_months']) || 0,
          full_year: Number(row.full_year) || 0,
        };

        if (row.isNew) {
          const { error } = await supabase.from('export_pricing').insert(payload);
          if (!error) savedCount++;
        } else {
          const { error } = await supabase.from('export_pricing').update(payload).eq('id', row.id);
          if (!error) savedCount++;
        }
      }

      toast.success(`تم حفظ ${savedCount} تعديل بنجاح في قاعدة البيانات`);
      // Reload
      const { data } = await supabase.from('export_pricing').select('*').order('id');
      if (data) setPricing(data as ExportPricingRow[]);
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ الأسعار');
    } finally {
      setSavingPrices(false);
    }
  };

  // Filter pricing rows
  const filteredPricing = pricing.filter(row => {
    const sizeMatch = row.size.toLowerCase().includes(searchSize.toLowerCase());
    const levelMatch = filterLevel === 'ALL' || row.billboard_level === filterLevel;
    const catMatch = filterCategory === 'ALL' || row.customer_category === filterCategory;
    return sizeMatch && levelMatch && catMatch;
  });

  const levels = Array.from(new Set(pricing.map(p => p.billboard_level))).filter(Boolean);
  const categories = Array.from(new Set(pricing.map(p => p.customer_category))).filter(Boolean);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Dynamic Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border border-primary/10 p-6 md:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-primary" />
              إعدادات محتوى التصدير
            </h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">
              تخصيص وإدارة المعرض الملحق بملف إكسل (Excel) عند التصدير، بما في ذلك السلايدات الافتتاحية، صور الشركات الشريكة، معالم المدن، وجداول التسعير الذكي.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 shrink-0">
            <div className="px-4 py-2 bg-background/60 backdrop-blur border rounded-xl text-center min-w-[70px]">
              <span className="text-xs text-muted-foreground block">السلايدات</span>
              <span className="text-lg font-bold text-primary">{slides.length}</span>
            </div>
            <div className="px-4 py-2 bg-background/60 backdrop-blur border rounded-xl text-center min-w-[70px]">
              <span className="text-xs text-muted-foreground block">الشركات</span>
              <span className="text-lg font-bold text-primary">{companies.length}</span>
            </div>
            <div className="px-4 py-2 bg-background/60 backdrop-blur border rounded-xl text-center min-w-[70px]">
              <span className="text-xs text-muted-foreground block">المدن</span>
              <span className="text-lg font-bold text-primary">{cities.length}</span>
            </div>
            <div className="px-4 py-2 bg-background/60 backdrop-blur border rounded-xl text-center min-w-[70px]">
              <span className="text-xs text-muted-foreground block">الباقات</span>
              <span className="text-lg font-bold text-primary">{pricing.length}</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="slides" dir="rtl" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl mb-6 bg-muted p-1 rounded-xl">
          <TabsTrigger value="slides" className="gap-2 rounded-lg py-2.5">
            <Image className="h-4 w-4" />
            سلايدات التصدير
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2 rounded-lg py-2.5">
            <Building2 className="h-4 w-4" />
            شعارات الشركات
          </TabsTrigger>
          <TabsTrigger value="cities" className="gap-2 rounded-lg py-2.5">
            <MapPin className="h-4 w-4" />
            صور معالم المدن
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2 rounded-lg py-2.5">
            <DollarSign className="h-4 w-4" />
            جدول الأسعار الموحد
          </TabsTrigger>
        </TabsList>

        {/* ========================================================
            TAB 1: SLIDES MANAGEMENT
           ======================================================== */}
        <TabsContent value="slides" className="space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-xl font-bold">معرض السلايدات</h2>
              <p className="text-xs text-muted-foreground mt-0.5">تظهر كواجهات تقديمية في ملفات التصدير.</p>
            </div>
            <Button onClick={addSlide} size="sm" className="gap-2 rounded-lg shadow-gold">
              <Plus className="h-4 w-4" />
              إضافة سلايد جديد
            </Button>
          </div>

          {slides.length === 0 ? (
            <Card className="border-dashed py-12 text-center text-muted-foreground bg-muted/5">
              <CardContent className="space-y-2">
                <Image className="h-10 w-10 mx-auto text-muted-foreground/45" />
                <p>لا توجد أي سلايدات مضافة حالياً.</p>
                <Button variant="outline" size="sm" onClick={addSlide} className="mt-2">أضف أول سلايد</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {slides.map((slide, index) => (
                <ExportItemCard
                  key={slide.id}
                  imageUrl={slide.image_url}
                  title={slide.title}
                  isActive={slide.is_active}
                  onDelete={() => deleteSlide(slide.id)}
                  onUpload={(file) => handleImageUpload(file, slide.id, slide.title, 'slide')}
                  uploading={uploadingImage}
                  onToggleActive={(val) => updateSlide(slide.id, { is_active: val })}
                  onMoveUp={index > 0 ? () => moveSlide(index, 'up') : undefined}
                  onMoveDown={index < slides.length - 1 ? () => moveSlide(index, 'down') : undefined}
                  aspectRatio="16/9"
                >
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">عنوان السلايد</Label>
                      <Input 
                        value={slide.title} 
                        onChange={(e) => updateSlide(slide.id, { title: e.target.value })} 
                        className="h-9"
                        placeholder="اكتب عنوان السلايد هنا..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">رابط الصورة المباشر</Label>
                      <Input 
                        value={slide.image_url} 
                        onChange={(e) => updateSlide(slide.id, { image_url: e.target.value })} 
                        className="h-9 font-mono text-[11px]" 
                        placeholder="https://example.com/image.jpg"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </ExportItemCard>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========================================================
            TAB 2: COMPANIES LOGOS
           ======================================================== */}
        <TabsContent value="companies" className="space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-xl font-bold">شعارات الشركات الشريكة</h2>
              <p className="text-xs text-muted-foreground mt-0.5">تُضاف كعلامة جودة وإشادة في تقارير التصدير للعملاء.</p>
            </div>
            <Button onClick={addCompany} size="sm" className="gap-2 rounded-lg shadow-gold">
              <Plus className="h-4 w-4" />
              إضافة شركة شريكة
            </Button>
          </div>

          {companies.length === 0 ? (
            <Card className="border-dashed py-12 text-center text-muted-foreground bg-muted/5">
              <CardContent className="space-y-2">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground/45" />
                <p>لا توجد شركات مضافة حالياً.</p>
                <Button variant="outline" size="sm" onClick={addCompany} className="mt-2">أضف أول شركة</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {companies.map((company, index) => (
                <ExportItemCard
                  key={company.id}
                  imageUrl={company.image_url}
                  title={company.company_name}
                  isActive={company.is_active}
                  onDelete={() => deleteCompany(company.id)}
                  onUpload={(file) => handleImageUpload(file, company.id, company.company_name, 'company')}
                  uploading={uploadingImage}
                  onToggleActive={(val) => updateCompany(company.id, { is_active: val })}
                  onMoveUp={index > 0 ? () => moveCompany(index, 'up') : undefined}
                  onMoveDown={index < companies.length - 1 ? () => moveCompany(index, 'down') : undefined}
                  aspectRatio="4/3"
                >
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">اسم الشركة</Label>
                      <Input 
                        value={company.company_name} 
                        onChange={(e) => updateCompany(company.id, { company_name: e.target.value })} 
                        className="h-9"
                        placeholder="اسم الشركة الشريكة..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">رابط الشعار المباشر</Label>
                      <Input 
                        value={company.image_url} 
                        onChange={(e) => updateCompany(company.id, { image_url: e.target.value })} 
                        className="h-9 font-mono text-[11px]" 
                        placeholder="https://example.com/logo.png"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </ExportItemCard>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========================================================
            TAB 3: CITIES SHOWCASE
           ======================================================== */}
        <TabsContent value="cities" className="space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-xl font-bold">معالم وصور المدن</h2>
              <p className="text-xs text-muted-foreground mt-0.5">تُدرج في التصدير لعرض نطاقات التغطية الجغرافية.</p>
            </div>
            <Button onClick={addCity} size="sm" className="gap-2 rounded-lg shadow-gold">
              <Plus className="h-4 w-4" />
              إضافة معلم مدينة
            </Button>
          </div>

          {cities.length === 0 ? (
            <Card className="border-dashed py-12 text-center text-muted-foreground bg-muted/5">
              <CardContent className="space-y-2">
                <MapPin className="h-10 w-10 mx-auto text-muted-foreground/45" />
                <p>لا توجد مدن مضافة حالياً.</p>
                <Button variant="outline" size="sm" onClick={addCity} className="mt-2">أضف أول مدينة</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {cities.map((city, index) => (
                <ExportItemCard
                  key={city.id}
                  imageUrl={city.image_url}
                  title={city.city_name}
                  isActive={city.is_active}
                  onDelete={() => deleteCity(city.id)}
                  onUpload={(file) => handleImageUpload(file, city.id, city.city_name, 'city')}
                  uploading={uploadingImage}
                  onToggleActive={(val) => updateCity(city.id, { is_active: val })}
                  onMoveUp={index > 0 ? () => moveCity(index, 'up') : undefined}
                  onMoveDown={index < cities.length - 1 ? () => moveCity(index, 'down') : undefined}
                  aspectRatio="16/10"
                >
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">اسم المدينة / المعلم</Label>
                      <Input 
                        value={city.city_name} 
                        onChange={(e) => updateCity(city.id, { city_name: e.target.value })} 
                        className="h-9"
                        placeholder="مثال: طرابلس - ميدان الشهداء..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">رابط صورة المعلم</Label>
                      <Input 
                        value={city.image_url} 
                        onChange={(e) => updateCity(city.id, { image_url: e.target.value })} 
                        className="h-9 font-mono text-[11px]" 
                        placeholder="https://example.com/city.jpg"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </ExportItemCard>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========================================================
            TAB 4: EXPORT PRICING CONSOLE
           ======================================================== */}
        <TabsContent value="pricing" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Excel import/export actions */}
            <Card className="lg:col-span-4 border-primary/10 shadow-sm h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  عمليات ملف Excel
                </CardTitle>
                <CardDescription>
                  تحديث باقات الأسعار المعتمدة عند تصدير العروض عبر جدول بيانات إكسل خارجي.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={downloadPricingExcel} 
                  disabled={pricingBusy} 
                  className="w-full gap-2 rounded-xl h-11"
                  variant="outline"
                >
                  {pricingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  تنزيل ملف الأسعار الحالي
                </Button>
                
                <div 
                  className="border-2 border-dashed border-muted rounded-xl p-5 text-center bg-muted/10 cursor-pointer hover:bg-muted/20 hover:border-primary/30 transition-all"
                  onClick={() => pricingFileRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <span className="text-xs font-semibold block text-foreground">ارفع ملف الأسعار المعدّل</span>
                  <span className="text-[10px] text-muted-foreground mt-1 block">يدعم فقط صيغ .xlsx أو .xls</span>
                  
                  <input
                    ref={pricingFileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPricingExcel(f);
                    }}
                  />
                </div>

                <div className="p-3.5 bg-yellow-500/5 border border-yellow-500/10 rounded-xl flex gap-3 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong>تنبيه:</strong> سيقوم نظام الرفع بدمج أو إضافة الأسعار حسب معرّف العمود <code>id</code>. تأكد من عدم تعديل عمود المعرف في Excel.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Interactive Pricing Editor Table */}
            <Card className="lg:col-span-8 border-primary/10 shadow-luxury">
              <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    محرر الأسعار الفوري
                  </CardTitle>
                  <CardDescription>عرض وتعديل أسعار وباقات التصدير الموحدة للوحات مباشرة من المتصفح.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addPricingRow} size="sm" variant="outline" className="gap-1.5 rounded-lg text-xs h-8">
                    <Plus className="h-3.5 w-3.5" />
                    إضافة باقة
                  </Button>
                  <Button onClick={savePricingChanges} disabled={savingPrices} size="sm" className="gap-1.5 rounded-lg text-xs h-8 shadow-gold">
                    {savingPrices ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    حفظ التعديلات
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search & Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/30 p-3 rounded-xl border border-muted/50 text-xs">
                  <div className="relative">
                    <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="البحث بالمقاس (مثال: 12x4)..."
                      value={searchSize}
                      onChange={(e) => setSearchSize(e.target.value)}
                      className="h-8 text-xs pr-8 bg-background"
                    />
                  </div>
                  <div>
                    <Select value={filterLevel} onValueChange={setFilterLevel}>
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <span className="flex items-center gap-1.5">
                          <SlidersHorizontal className="h-3 w-3 opacity-60" />
                          فئة اللوحة: {filterLevel === 'ALL' ? 'الكل' : filterLevel}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">جميع الفئات</SelectItem>
                        {levels.map(l => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <span className="flex items-center gap-1.5">
                          <SlidersHorizontal className="h-3 w-3 opacity-60" />
                          فئة العميل: {filterCategory === 'ALL' ? 'الكل' : filterCategory}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">جميع فئات العملاء</SelectItem>
                        {categories.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Pricing Table */}
                {filteredPricing.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    لا توجد أي باقات أسعار تطابق معايير التصفية والبحث الحالية.
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-xl bg-card">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b">
                          <th className="p-2.5 font-bold text-muted-foreground w-[12%]">المقاس</th>
                          <th className="p-2.5 font-bold text-muted-foreground w-[10%]">الفئة</th>
                          <th className="p-2.5 font-bold text-muted-foreground w-[12%]">فئة العميل</th>
                          <th className="p-2.5 font-bold text-muted-foreground">يومي (د.ل)</th>
                          <th className="p-2.5 font-bold text-muted-foreground">شهري (د.ل)</th>
                          <th className="p-2.5 font-bold text-muted-foreground">شهرين (د.ل)</th>
                          <th className="p-2.5 font-bold text-muted-foreground">3 أشهر (د.ل)</th>
                          <th className="p-2.5 font-bold text-muted-foreground">6 أشهر (د.ل)</th>
                          <th className="p-2.5 font-bold text-muted-foreground">سنوي (د.ل)</th>
                          <th className="p-2.5 text-center text-muted-foreground w-[8%]">خيارات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPricing.map((row) => (
                          <tr 
                            key={row.id} 
                            className={`border-b hover:bg-muted/10 transition-colors ${row.isNew ? 'bg-green-500/5' : ''} ${row.hasChanges && !row.isNew ? 'bg-blue-500/5' : ''}`}
                          >
                            <td className="p-1.5">
                              <Input 
                                value={row.size} 
                                onChange={(e) => updatePricingCell(row.id, 'size', e.target.value)} 
                                className="h-7 text-xs bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-primary text-right font-medium"
                                placeholder="مثال: 12x4"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input 
                                value={row.billboard_level} 
                                onChange={(e) => updatePricingCell(row.id, 'billboard_level', e.target.value)} 
                                className="h-7 text-xs bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-primary text-center font-bold"
                                placeholder="A"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input 
                                value={row.customer_category} 
                                onChange={(e) => updatePricingCell(row.id, 'customer_category', e.target.value)} 
                                className="h-7 text-xs bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-primary text-right"
                                placeholder="عادي"
                              />
                            </td>
                            <td className="p-1.5">
                              <input 
                                type="number" 
                                value={row.one_day} 
                                onChange={(e) => updatePricingCell(row.id, 'one_day', parseFloat(e.target.value) || 0)} 
                                className="w-full h-7 text-xs bg-transparent border-0 focus-visible:outline-none text-center font-mono"
                              />
                            </td>
                            <td className="p-1.5">
                              <input 
                                type="number" 
                                value={row.one_month} 
                                onChange={(e) => updatePricingCell(row.id, 'one_month', parseFloat(e.target.value) || 0)} 
                                className="w-full h-7 text-xs bg-transparent border-0 focus-visible:outline-none text-center font-mono"
                              />
                            </td>
                            <td className="p-1.5">
                              <input 
                                type="number" 
                                value={row['2_months']} 
                                onChange={(e) => updatePricingCell(row.id, '2_months', parseFloat(e.target.value) || 0)} 
                                className="w-full h-7 text-xs bg-transparent border-0 focus-visible:outline-none text-center font-mono"
                              />
                            </td>
                            <td className="p-1.5">
                              <input 
                                type="number" 
                                value={row['3_months']} 
                                onChange={(e) => updatePricingCell(row.id, '3_months', parseFloat(e.target.value) || 0)} 
                                className="w-full h-7 text-xs bg-transparent border-0 focus-visible:outline-none text-center font-mono"
                              />
                            </td>
                            <td className="p-1.5">
                              <input 
                                type="number" 
                                value={row['6_months']} 
                                onChange={(e) => updatePricingCell(row.id, '6_months', parseFloat(e.target.value) || 0)} 
                                className="w-full h-7 text-xs bg-transparent border-0 focus-visible:outline-none text-center font-mono"
                              />
                            </td>
                            <td className="p-1.5">
                              <input 
                                type="number" 
                                value={row.full_year} 
                                onChange={(e) => updatePricingCell(row.id, 'full_year', parseFloat(e.target.value) || 0)} 
                                className="w-full h-7 text-xs bg-transparent border-0 focus-visible:outline-none text-center font-mono"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => deletePricingRow(row)} 
                                className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Reusable Premium Item Card Component =====
interface ExportItemCardProps {
  imageUrl: string;
  title: string;
  isActive: boolean;
  onDelete: () => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  onToggleActive: (val: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  aspectRatio?: string;
  children: React.ReactNode;
}

function ExportItemCard({
  imageUrl, title, isActive, onDelete, onUpload, uploading, 
  onToggleActive, onMoveUp, onMoveDown, aspectRatio = "16/9", children
}: ExportItemCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !(navigator.clipboard as any).read) {
        toast.error('المتصفح لا يدعم اللصق من الحافظة');
        return;
      }
      const items = await (navigator.clipboard as any).read();
      for (const item of items) {
        const imgType = item.types.find((t: string) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          const ext = imgType.split('/')[1] || 'png';
          const file = new File([blob], `pasted-${Date.now()}.${ext}`, { type: imgType });
          onUpload(file);
          toast.success('تم لصق الصورة بنجاح');
          return;
        }
      }
      toast.error('لا توجد صورة في الحافظة');
    } catch {
      toast.error('فشل اللصق. الرجاء مراجعة صلاحيات الحافظة');
    }
  };

  return (
    <Card 
      className={`relative border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${!isActive ? 'opacity-60 bg-muted/20' : 'bg-card'}`}
      onPaste={(e) => {
        const file = Array.from(e.clipboardData?.files || []).find((f) => f.type.startsWith('image/'));
        if (file) {
          e.preventDefault();
          onUpload(file);
          toast.success('تم لصق الصورة المنسوخة');
        }
      }}
    >
      <CardContent className="p-4 flex flex-col md:flex-row gap-5">
        {/* Left Side: Thumbnail Preview with controls */}
        <div className="shrink-0 space-y-2.5">
          <div 
            className="relative rounded-xl border bg-muted overflow-hidden flex items-center justify-center group shadow-sm"
            style={{ width: '160px', aspectRatio }}
          >
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt={title} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            ) : (
              <Image className="h-8 w-8 text-muted-foreground/30" />
            )}
            
            {/* Glassmorphic hover overlay for file drop */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-all flex items-center justify-center gap-2">
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8 rounded-full bg-white/90 hover:bg-white text-black"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="تحديث الصورة"
              >
                <Upload className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick sorting buttons */}
          <div className="flex items-center justify-center gap-1.5 p-1 bg-muted/40 border rounded-lg max-w-[160px]">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onMoveUp} 
              disabled={!onMoveUp} 
              className="h-7 w-7 rounded-md hover:bg-background/80"
              title="نقل لأعلى"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] text-muted-foreground px-1.5 select-none font-bold">الترتيب</span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onMoveDown} 
              disabled={!onMoveDown} 
              className="h-7 w-7 rounded-md hover:bg-background/80"
              title="نقل لأسفل"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Right Side: Form and actions */}
        <div className="flex-1 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            {children}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={onToggleActive} />
              <span className={`text-xs font-semibold ${isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
                {isActive ? 'مفعّل في التصدير' : 'معطّل حالياً'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                  e.target.value = '';
                }}
              />
              
              <Button
                variant="outline"
                size="sm"
                onClick={handlePasteFromClipboard}
                disabled={uploading}
                className="h-8 text-xs gap-1 px-2.5 rounded-lg border-muted-foreground/20 hover:border-primary/30"
              >
                <ClipboardPaste className="h-3.5 w-3.5 text-muted-foreground" />
                لصق
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onDelete} 
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
