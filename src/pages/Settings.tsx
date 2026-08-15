// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  Plus, Edit, Trash2, Layers, Tag, Save, X, MapPin, RefreshCw, DollarSign, Ruler, Image as ImageIcon,
  Building, Upload, Sparkles, CheckCircle2, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { uploadImage } from '@/services/imageUploadService';

interface BillboardSize {
  id: number;
  name: string;
  width: number;
  height: number;
  description?: string;
  installation_price: number;
  sort_order: number;
  image_url?: string | null;
  created_at: string;
}

interface BillboardFaces {
  id: number;
  name: string;
  count: number;
  description?: string;
  created_at: string;
}

interface BillboardType {
  id: number;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
}

interface Municipality {
  id: number;
  name: string;
  code: string;
  logo_url?: string;
  sort_order: number;
  created_at: string;
}

interface City {
  id: number;
  name: string;
  created_at?: string;
}

export default function BillboardSettings() {
  const [sizes, setSizes] = useState<BillboardSize[]>([]);
  const [faces, setFaces] = useState<BillboardFaces[]>([]);
  const [types, setTypes] = useState<BillboardType[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploadingSizeId, setUploadingSizeId] = useState<number | null>(null);

  // Dialog states
  const [sizeDialog, setSizeDialog] = useState(false);
  const [faceDialog, setFaceDialog] = useState(false);
  const [typeDialog, setTypeDialog] = useState(false);
  const [municipalityDialog, setMunicipalityDialog] = useState(false);
  const [cityDialog, setCityDialog] = useState(false);

  // Form states
  const [sizeForm, setSizeForm] = useState({
    id: 0,
    name: '',
    width: 0,
    height: 0,
    description: '',
    installation_price: 0,
    sort_order: 999,
    image_url: '',
  });
  const [faceForm, setFaceForm] = useState({ id: 0, name: '', count: 1, description: '' });
  const [typeForm, setTypeForm] = useState({ id: 0, name: '', description: '', color: '#d6ac40' });
  const [municipalityForm, setMunicipalityForm] = useState({ id: 0, name: '', code: '', logo_url: '', sort_order: 999 });
  const [cityForm, setCityForm] = useState({ id: 0, name: '' });
  const [editMode, setEditMode] = useState(false);

  // Load all data
  const loadData = async () => {
    try {
      setLoading(true);

      const [sizesRes, facesRes, typesRes, munRes, citiesRes] = await Promise.all([
        supabase.from('sizes').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
        supabase.from('billboard_faces').select('*').order('id', { ascending: true }),
        supabase.from('billboard_types').select('*').order('id', { ascending: true }),
        supabase.from('municipalities').select('*').order('sort_order', { ascending: true }),
        supabase.from('cities').select('*').order('name', { ascending: true }),
      ]);

      if (sizesRes.error) toast.error('فشل في تحميل أحجام اللوحات');
      else setSizes(sizesRes.data || []);

      if (facesRes.error) toast.error('فشل في تحميل عدد الأوجه');
      else setFaces(facesRes.data || []);

      if (typesRes.error) toast.error('فشل في تحميل أنواع اللوحات');
      else setTypes(typesRes.data || []);

      if (munRes.error) toast.error('فشل في تحميل البلديات');
      else setMunicipalities(munRes.data || []);

      if (citiesRes.error) toast.error('فشل في تحميل المدن');
      else setCities(citiesRes.data || []);

    } catch (error) {
      console.error('Error loading settings data:', error);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Upload Cutout PNG for a size directly
  const handleDirectSizeImageUpload = async (sizeId: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار صورة مفرغة بصيغة PNG أو SVG');
      return;
    }
    setUploadingSizeId(sizeId);
    try {
      const imgName = `size-cutout-${sizeId}-${Date.now()}`;
      const url = await uploadImage(file, imgName, 'billboard-sizes-cutouts');

      const { error } = await supabase
        .from('sizes')
        .update({ image_url: url })
        .eq('id', sizeId);

      if (error) throw error;

      setSizes(prev => prev.map(s => s.id === sizeId ? { ...s, image_url: url } : s));
      toast.success('تم رفع صورة المقاس المفرغة بنجاح');
    } catch (err: any) {
      console.error('Error uploading size PNG:', err);
      toast.error('فشل رفع صورة المقاس: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setUploadingSizeId(null);
    }
  };

  // Check unique sort order for size
  const isSortOrderUnique = async (sortOrder: number, excludeId?: number): Promise<boolean> => {
    try {
      let query = supabase.from('sizes').select('id').eq('sort_order', sortOrder);
      if (excludeId) query = query.neq('id', excludeId);
      const { data, error } = await query;
      if (error) throw error;
      return !data || data.length === 0;
    } catch {
      return false;
    }
  };

  // Save Size
  const handleSizeSubmit = async () => {
    try {
      if (!sizeForm.name || sizeForm.width <= 0 || sizeForm.height <= 0) {
        toast.error('يرجى ملء جميع الحقول المطلوبة (اسم الحجم، العرض، والارتفاع)');
        return;
      }

      const isUnique = await isSortOrderUnique(sizeForm.sort_order, editMode ? sizeForm.id : undefined);
      if (!isUnique) {
        toast.error(`رقم الترتيب ${sizeForm.sort_order} مستخدم بالفعل. يرجى اختيار رقم آخر.`);
        return;
      }

      const payload = {
        name: sizeForm.name.trim(),
        width: sizeForm.width,
        height: sizeForm.height,
        description: sizeForm.description,
        installation_price: sizeForm.installation_price,
        sort_order: sizeForm.sort_order,
        image_url: sizeForm.image_url || null,
      };

      if (editMode) {
        const { error } = await supabase.from('sizes').update(payload).eq('id', sizeForm.id);
        if (error) throw error;
        toast.success('تم تحديث الحجم بنجاح');
      } else {
        const { error } = await supabase.from('sizes').insert(payload);
        if (error) throw error;
        toast.success('تم إضافة الحجم بنجاح');
      }

      setSizeDialog(false);
      setSizeForm({ id: 0, name: '', width: 0, height: 0, description: '', installation_price: 0, sort_order: 999, image_url: '' });
      setEditMode(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving size:', error);
      toast.error('حدث خطأ في حفظ الحجم: ' + (error?.message || ''));
    }
  };

  const handleSizeEdit = (size: BillboardSize) => {
    setSizeForm({
      id: size.id,
      name: size.name,
      width: size.width,
      height: size.height,
      description: size.description || '',
      installation_price: size.installation_price || 0,
      sort_order: size.sort_order || 999,
      image_url: size.image_url || '',
    });
    setEditMode(true);
    setSizeDialog(true);
  };

  const handleSizeDelete = async (id: number) => {
    try {
      const { error } = await supabase.from('sizes').delete().eq('id', id);
      if (error) throw error;
      toast.success('تم حذف الحجم بنجاح');
      loadData();
    } catch (error) {
      console.error('Error deleting size:', error);
      toast.error('حدث خطأ في حذف الحجم');
    }
  };

  // Sync municipalities from billboards and normalize names across database
  const syncMunicipalitiesFromBillboards = async () => {
    setSyncing(true);
    try {
      // 1. Normalize common municipality name variations across all tables
      const mappingRules: Record<string, string> = {
        'قصر خيار': 'قصر الاخيار',
        'قصر_خيار': 'قصر الاخيار',
        'قصر الخيار': 'قصر الاخيار',
        'القره بوللي': 'القره بوللي',
        'القره_بوللي': 'القره بوللي',
        'القرهبوللي': 'القره بوللي',
        'طرابلس': 'طرابلس المركز',
        'طرابلس القديمة': 'طرابلس المركز',
        'صبراتة': 'صبراته',
        'امسلاته': 'امسلاتة',
        'مسلاتة': 'امسلاتة',
      };

      for (const [raw, target] of Object.entries(mappingRules)) {
        await Promise.allSettled([
          supabase.from('billboards').update({ Municipality: target }).eq('Municipality', raw),
          supabase.from('billboards').update({ Municipality: target }).ilike('Municipality', raw),
          supabase.from('municipality_collections').update({ municipality_name: target }).eq('municipality_name', raw),
          supabase.from('municipality_collections').update({ municipality_name: target }).ilike('municipality_name', raw),
          supabase.from('municipality_collection_items').update({ municipality: target }).eq('municipality', raw),
          supabase.from('municipality_collection_items').update({ municipality: target }).ilike('municipality', raw),
        ]);
      }

      // 2. Query billboards table for unique municipality values
      const { data: billboardData, error: billboardError } = await supabase
        .from('billboards')
        .select('Municipality')
        .not('Municipality', 'is', null);

      if (billboardError) throw billboardError;

      const uniqueMunicipalities = [...new Set((billboardData || []).map((b: any) => b.Municipality).filter(Boolean).map((m: string) => m.trim()))];
      const { data: existingMunicipalities } = await supabase.from('municipalities').select('name');
      const existingNames = new Set((existingMunicipalities || []).map((m: any) => m.name));
      const newMunicipalities = uniqueMunicipalities.filter(name => !existingNames.has(name));

      if (newMunicipalities.length > 0) {
        const toInsert = newMunicipalities.map((name, idx) => ({
          name,
          code: `AUTO-${String(municipalities.length + idx + 1).padStart(3, '0')}`,
          sort_order: municipalities.length + idx + 1,
        }));

        const { error: insertError } = await supabase.from('municipalities').insert(toInsert);
        if (insertError) throw insertError;
        toast.success(`تم مزامنة وتوحيد أسماء البلديات وإضافة ${newMunicipalities.length} بلدية جديدة تلقائياً`);
      } else {
        toast.success('تمت مزامنة وتوحيد أسماء البلديات في جميع اللوحات والمجموعات بنجاح');
      }

      loadData();
    } catch (err: any) {
      toast.error('فشل المزامنة: ' + (err?.message || ''));
    } finally {
      setSyncing(false);
    }
  };

  // Face handlers
  const handleFaceSubmit = async () => {
    if (!faceForm.name || faceForm.count <= 0) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }
    const payload = { name: faceForm.name, count: faceForm.count, description: faceForm.description };
    if (editMode) await supabase.from('billboard_faces').update(payload).eq('id', faceForm.id);
    else await supabase.from('billboard_faces').insert(payload);
    setFaceDialog(false);
    loadData();
  };

  const handleFaceDelete = async (id: number) => {
    await supabase.from('billboard_faces').delete().eq('id', id);
    loadData();
  };

  // Type handlers
  const handleTypeSubmit = async () => {
    if (!typeForm.name) {
      toast.error('يرجى ملء الاسم');
      return;
    }
    const payload = { name: typeForm.name, description: typeForm.description, color: typeForm.color };
    if (editMode) await supabase.from('billboard_types').update(payload).eq('id', typeForm.id);
    else await supabase.from('billboard_types').insert(payload);
    setTypeDialog(false);
    loadData();
  };

  const handleTypeDelete = async (id: number) => {
    await supabase.from('billboard_types').delete().eq('id', id);
    loadData();
  };

  // Municipality handlers
  const handleMunicipalitySubmit = async () => {
    const name = String(municipalityForm.name || '').trim();
    const code = String(municipalityForm.code || '').trim();
    const logo_url = String(municipalityForm.logo_url || '').trim();

    if (!name || !code) {
      toast.error('يرجى ملء الاسم والكود');
      return;
    }
    const payload = {
      name,
      code,
      logo_url: logo_url || null,
      sort_order: municipalityForm.sort_order,
    };

    try {
      if (editMode && municipalityForm.id) {
        // 1. Fetch old municipality record
        const { data: oldData } = await supabase
          .from('municipalities')
          .select('name')
          .eq('id', municipalityForm.id)
          .single();

        const oldName = oldData?.name?.trim();

        // 2. Update municipalities table record
        const { error: updateError } = await supabase
          .from('municipalities')
          .update(payload)
          .eq('id', municipalityForm.id);

        if (updateError) throw updateError;

        // 3. Cascade update name across all related tables if name changed
        if (oldName && oldName !== name) {
          await Promise.allSettled([
            supabase.from('billboards').update({ Municipality: name }).eq('Municipality', oldName),
            supabase.from('billboards').update({ Municipality: name }).ilike('Municipality', oldName),
            supabase.from('municipality_collections').update({ municipality_name: name }).eq('municipality_name', oldName),
            supabase.from('municipality_collections').update({ municipality_name: name }).ilike('municipality_name', oldName),
            supabase.from('municipality_collection_items').update({ municipality: name }).eq('municipality', oldName),
            supabase.from('municipality_collection_items').update({ municipality: name }).ilike('municipality', oldName),
            supabase.from('municipality_rent_prices').update({ municipality_name: name }).eq('municipality_name', oldName),
            supabase.from('municipality_factors').update({ municipality_name: name }).eq('municipality_name', oldName),
          ]);
          toast.success(`تم تحديث اسم البلدية من "${oldName}" إلى "${name}" وتحديث كافة اللوحات والمجموعات بنجاح`);
        } else {
          toast.success('تم تحديث البلدية بنجاح');
        }
      } else {
        const { error: insertError } = await supabase.from('municipalities').insert(payload);
        if (insertError) throw insertError;
        toast.success('تم إضافة البلدية بنجاح');
      }
    } catch (e: any) {
      console.error('Error saving municipality:', e);
      toast.error('حدث خطأ أثناء حفظ البلدية: ' + (e?.message || ''));
    }

    setMunicipalityDialog(false);
    loadData();
  };

  const handleMunicipalityDelete = async (id: number) => {
    await supabase.from('municipalities').delete().eq('id', id);
    loadData();
  };

  // City handlers
  const handleCitySubmit = async () => {
    const cityName = String(cityForm.name || '').trim();
    if (!cityName) return;
    if (editMode) await supabase.from('cities').update({ name: cityName }).eq('id', cityForm.id);
    else await supabase.from('cities').insert({ name: cityName });
    setCityDialog(false);
    loadData();
  };

  const handleCityDelete = async (id: number) => {
    await supabase.from('cities').delete().eq('id', id);
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-sm font-medium text-muted-foreground">جاري تحميل إعدادات اللوحات والبلديات...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-card border border-border/40 backdrop-blur-xl shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-primary text-primary-foreground rounded-2xl shadow-md">
            <Ruler className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">إدارة إعدادات اللوحات والبلديات</h1>
            <p className="text-xs text-muted-foreground mt-1">
              تحديد المقاسات الـ 11، صور PNG المفرغة، عدد الأوجه، أنواع اللوحات، والبلديات المرتبطة
            </p>
          </div>
        </div>

        {/* Quick Badges + Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl text-xs font-bold text-primary">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>{sizes.length} أحجام مسجلة</span>
          </div>
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400">
            <span>{municipalities.length} بلديات</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="h-9 rounded-xl border-border gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* ── Main Tabs Dashboard ── */}
      <Tabs defaultValue="sizes" className="w-full space-y-6">
        <TabsList className="flex items-center justify-start gap-2 bg-muted/40 backdrop-blur-md border border-border/30 p-1.5 rounded-2xl overflow-x-auto no-scrollbar w-full sm:w-auto">
          <TabsTrigger value="sizes" className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <Ruler className="h-4 w-4" />
            <span>أحجام اللوحات ({sizes.length})</span>
          </TabsTrigger>
          <TabsTrigger value="faces" className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <Layers className="h-4 w-4" />
            <span>عدد الأوجه ({faces.length})</span>
          </TabsTrigger>
          <TabsTrigger value="types" className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <Tag className="h-4 w-4" />
            <span>أنواع اللوحات ({types.length})</span>
          </TabsTrigger>
          <TabsTrigger value="municipalities" className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <MapPin className="h-4 w-4" />
            <span>البلديات ({municipalities.length})</span>
          </TabsTrigger>
          <TabsTrigger value="cities" className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <Building className="h-4 w-4" />
            <span>المدن ({cities.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: SIZES (11 Sizes with PNG Cutout Image Upload) ─── */}
        <TabsContent value="sizes" className="space-y-6">
          <Card className="border border-border/40 bg-card rounded-3xl shadow-sm overflow-hidden">
            <CardHeader className="pb-4 pt-6 border-b border-border/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Ruler className="h-5 w-5 text-primary" />
                    <span>إدارة أحجام اللوحات والـ PNG المفرغة ({sizes.length} مقاس)</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    قم بتعديل المقاسات، ترتيبها، ورفع صورة PNG بدون خلفية لكل مقاس لدمجها تلقائياً في السكيل الواقعي
                  </CardDescription>
                </div>
                <Dialog open={sizeDialog} onOpenChange={setSizeDialog}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setSizeForm({ id: 0, name: '', width: 0, height: 0, description: '', installation_price: 0, sort_order: sizes.length + 1, image_url: '' });
                        setEditMode(false);
                      }}
                      className="rounded-xl bg-primary text-primary-foreground font-semibold shadow gap-2 h-10 px-5"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة مقاس جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg border-border rounded-3xl bg-background">
                    <DialogHeader>
                      <DialogTitle className="font-bold text-base flex items-center gap-2">
                        <Ruler className="h-5 w-5 text-primary" />
                        {editMode ? 'تعديل بيانات المقاس' : 'إضافة مقاس جديد'}
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">اسم المقاس *</Label>
                        <Input
                          value={sizeForm.name}
                          onChange={e => setSizeForm(p => ({ ...p, name: e.target.value }))}
                          placeholder="مثال: 12x4 أو 13x5"
                          className="rounded-xl border-border bg-background h-10 font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">العرض (متر) *</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={sizeForm.width || ''}
                            onChange={e => setSizeForm(p => ({ ...p, width: parseFloat(e.target.value) || 0 }))}
                            placeholder="12.0"
                            className="rounded-xl border-border bg-background h-10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">الارتفاع (متر) *</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={sizeForm.height || ''}
                            onChange={e => setSizeForm(p => ({ ...p, height: parseFloat(e.target.value) || 0 }))}
                            placeholder="4.0"
                            className="rounded-xl border-border bg-background h-10"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">ترتيب العرض *</Label>
                          <Input
                            type="number"
                            value={sizeForm.sort_order}
                            onChange={e => setSizeForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 999 }))}
                            className="rounded-xl border-border bg-background h-10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">سعر التركيب (د.ل)</Label>
                          <Input
                            type="number"
                            value={sizeForm.installation_price || ''}
                            onChange={e => setSizeForm(p => ({ ...p, installation_price: parseFloat(e.target.value) || 0 }))}
                            placeholder="0.00"
                            className="rounded-xl border-border bg-background h-10"
                          />
                        </div>
                      </div>

                      {/* PNG Cutout Image URL or File Upload */}
                      <div className="space-y-2 pt-2 border-t border-border">
                        <Label className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                          <span>صورة PNG مفرغة بدون خلفية للمقاس</span>
                          <Sparkles className="h-3.5 w-3.5" />
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={sizeForm.image_url}
                            onChange={e => setSizeForm(p => ({ ...p, image_url: e.target.value }))}
                            placeholder="رابط الصورة PNG أو ارفع ملف من الزر..."
                            className="rounded-xl border-border bg-background text-xs h-10 flex-1"
                          />
                          <label className="cursor-pointer">
                            <span className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                              <Upload className="h-4 w-4" />
                              رفع PNG
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/svg+xml,image/webp"
                              className="hidden"
                              onChange={async e => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                try {
                                  const url = await uploadImage(f, `size-${sizeForm.name || 'cutout'}-${Date.now()}`, 'billboard-sizes-cutouts');
                                  setSizeForm(p => ({ ...p, image_url: url }));
                                  toast.success('تم رفع الصورة بنجاح');
                                } catch (err: any) {
                                  toast.error('فشل رفع الصورة: ' + (err?.message || ''));
                                }
                              }}
                            />
                          </label>
                        </div>
                        {sizeForm.image_url && (
                          <div className="relative p-2 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
                            <img src={sizeForm.image_url} alt="معاينة" className="h-12 object-contain" />
                            <Button variant="ghost" size="sm" onClick={() => setSizeForm(p => ({ ...p, image_url: '' }))} className="text-destructive text-xs">
                              إزالة
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">الوصف / ملاحظات</Label>
                        <Input
                          value={sizeForm.description}
                          onChange={e => setSizeForm(p => ({ ...p, description: e.target.value }))}
                          placeholder="وصف اختياري..."
                          className="rounded-xl border-border bg-background h-10"
                        />
                      </div>
                    </div>

                    <DialogFooter className="gap-2">
                      <Button variant="outline" onClick={() => setSizeDialog(false)} className="rounded-xl h-10">إلغاء</Button>
                      <Button onClick={handleSizeSubmit} className="rounded-xl h-10 bg-primary text-primary-foreground font-semibold">
                        {editMode ? 'تحديث المقاس' : 'إضافة المقاس'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sizes.map((size) => {
                  const area = (size.width * size.height).toFixed(1);
                  const isUploadingThis = uploadingSizeId === size.id;

                  return (
                    <div
                      key={size.id}
                      className="group relative rounded-2xl border border-border/40 bg-card p-4 space-y-3 transition-all duration-300 hover:shadow-md hover:border-primary/50 flex flex-col justify-between"
                    >
                      {/* Top bar: Sort badge + Action buttons */}
                      <div className="flex items-center justify-between">
                        <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-lg px-2.5 py-0.5">
                          ترتيب #{size.sort_order}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSizeEdit(size)}
                            className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="تعديل"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10" title="حذف">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl border-border">
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد حذف المقاس</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل أنت متأكد من حذف المقاس "{size.name}"؟ لا يمكن التراجع عن هذا القرار.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleSizeDelete(size.id)} className="rounded-xl bg-destructive text-destructive-foreground">
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {/* PNG Cutout Preview Box */}
                      <div className="relative rounded-xl border border-dashed border-border/40 bg-muted/20 p-3 h-28 flex flex-col items-center justify-center overflow-hidden group-hover:border-primary/40 transition-colors">
                        {size.image_url ? (
                          <>
                            <img
                              src={size.image_url}
                              alt={`مفرغة ${size.name}`}
                              className="max-h-20 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <label className="cursor-pointer">
                                <span className="p-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold flex items-center gap-1 shadow">
                                  <Upload className="h-3 w-3" /> تغيير
                                </span>
                                <input
                                  type="file"
                                  accept="image/png,image/svg+xml,image/webp"
                                  className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleDirectSizeImageUpload(size.id, f); }}
                                />
                              </label>
                            </div>
                          </>
                        ) : (
                          <label className="cursor-pointer text-center space-y-1">
                            {isUploadingThis ? (
                              <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto" />
                            ) : (
                              <>
                                <ImageIcon className="h-7 w-7 text-muted-foreground/40 mx-auto group-hover:text-primary transition-colors" />
                                <p className="text-[11px] text-muted-foreground font-medium">اضغط لرفع صورة PNG مفرغة</p>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/png,image/svg+xml,image/webp"
                              className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleDirectSizeImageUpload(size.id, f); }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Info Details */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-base text-foreground">{size.name}</span>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-mono">
                            {area} م²
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>الأبعاد: {size.width} × {size.height} م</span>
                          <span>التركيب: {size.installation_price ? `${size.installation_price} د.ل` : 'مجاني'}</span>
                        </div>
                        {size.description && (
                          <p className="text-[11px] text-muted-foreground/70 truncate">{size.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: FACES ─── */}
        <TabsContent value="faces">
          <Card className="border border-border/40 bg-card rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                <span>إدارة عدد الأوجه ({faces.length} نوع)</span>
              </CardTitle>
              <Button onClick={() => { setFaceForm({ id: 0, name: '', count: 1, description: '' }); setEditMode(false); setFaceDialog(true); }} className="rounded-xl bg-primary text-primary-foreground gap-2">
                <Plus className="h-4 w-4" /> إضافة عدد أوجه
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {faces.map(f => (
                  <div key={f.id} className="p-4 rounded-2xl border border-border/30 bg-muted/20 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm">{f.name}</h4>
                      <p className="text-xs text-muted-foreground">{f.count} وجه {f.description ? `• ${f.description}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setFaceForm(f); setEditMode(true); setFaceDialog(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleFaceDelete(f.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 3: TYPES ─── */}
        <TabsContent value="types">
          <Card className="border border-border/40 bg-card rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                <span>أنواع اللوحات الإعلانية ({types.length} نوع)</span>
              </CardTitle>
              <Button onClick={() => { setTypeForm({ id: 0, name: '', description: '', color: '#d6ac40' }); setEditMode(false); setTypeDialog(true); }} className="rounded-xl bg-primary text-primary-foreground gap-2">
                <Plus className="h-4 w-4" /> إضافة نوع جديد
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {types.map(t => (
                  <div key={t.id} className="p-4 rounded-2xl border border-border/30 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color || '#d6ac40' }} />
                      <div>
                        <h4 className="font-bold text-sm">{t.name}</h4>
                        {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setTypeForm(t); setEditMode(true); setTypeDialog(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleTypeDelete(t.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 4: MUNICIPALITIES ─── */}
        <TabsContent value="municipalities">
          <Card className="border border-border/40 bg-card rounded-3xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span>البلديات المسجلة ({municipalities.length} بلدية)</span>
                </CardTitle>
                <CardDescription className="text-xs mt-1">قائمة البلديات المتاحة مع الشعار والكود والترتيب</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={syncMunicipalitiesFromBillboards} disabled={syncing} className="rounded-xl border-border text-xs gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  مزامنة من اللوحات
                </Button>
                <Button onClick={() => { setMunicipalityForm({ id: 0, name: '', code: '', logo_url: '', sort_order: municipalities.length + 1 }); setEditMode(false); setMunicipalityDialog(true); }} className="rounded-xl bg-primary text-primary-foreground text-xs gap-1.5 h-9">
                  <Plus className="h-4 w-4" /> إضافة بلدية
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {municipalities.map(m => (
                  <div key={m.id} className="p-4 rounded-2xl border border-border/30 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {m.logo_url ? (
                        <img src={m.logo_url} alt={m.name} className="w-10 h-10 object-contain rounded-lg border border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {m.name.slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-sm">{m.name}</h4>
                        <span className="text-[10px] text-muted-foreground font-mono">{m.code}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setMunicipalityForm({ id: m.id, name: m.name || '', code: m.code || '', logo_url: m.logo_url || '', sort_order: m.sort_order || 999 }); setEditMode(true); setMunicipalityDialog(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleMunicipalityDelete(m.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 5: CITIES ─── */}
        <TabsContent value="cities">
          <Card className="border border-border/40 bg-card rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <span>المدن والدوائر ({cities.length} مدينة)</span>
              </CardTitle>
              <Button onClick={() => { setCityForm({ id: 0, name: '' }); setEditMode(false); setCityDialog(true); }} className="rounded-xl bg-primary text-primary-foreground gap-2">
                <Plus className="h-4 w-4" /> إضافة مدينة
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {cities.map(c => (
                  <div key={c.id} className="p-3 rounded-xl border border-border/30 bg-muted/20 flex items-center justify-between text-xs">
                    <span className="font-bold">{c.name}</span>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setCityForm({ id: c.id, name: c.name || '' }); setEditMode(true); setCityDialog(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleCityDelete(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── DIALOGS FOR FACES, TYPES, MUNICIPALITIES, CITIES ─── */}
      <Dialog open={faceDialog} onOpenChange={setFaceDialog}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editMode ? 'تعديل عدد الأوجه' : 'إضافة عدد أوجه جديد'}</DialogTitle>
            <DialogDescription className="sr-only">تعديل عدد الأوجه</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs font-bold">اسم النوع *</Label><Input value={faceForm.name || ''} onChange={e => setFaceForm(p => ({ ...p, name: e.target.value }))} placeholder="وجهين / وجه واحد" className="rounded-xl h-10" /></div>
            <div><Label className="text-xs font-bold">العدد *</Label><Input type="number" value={faceForm.count} onChange={e => setFaceForm(p => ({ ...p, count: parseInt(e.target.value) || 1 }))} className="rounded-xl h-10" /></div>
          </div>
          <DialogFooter><Button onClick={handleFaceSubmit} className="rounded-xl bg-primary text-primary-foreground">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={typeDialog} onOpenChange={setTypeDialog}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editMode ? 'تعديل نوع اللوحة' : 'إضافة نوع جديد'}</DialogTitle>
            <DialogDescription className="sr-only">تعديل نوع اللوحة</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs font-bold">اسم النوع *</Label><Input value={typeForm.name || ''} onChange={e => setTypeForm(p => ({ ...p, name: e.target.value }))} placeholder="ميجالاين / يوني بول" className="rounded-xl h-10" /></div>
            <div><Label className="text-xs font-bold">اللون المميز</Label><Input type="color" value={typeForm.color || '#3b82f6'} onChange={e => setTypeForm(p => ({ ...p, color: e.target.value }))} className="rounded-xl h-10 p-1 cursor-pointer" /></div>
          </div>
          <DialogFooter><Button onClick={handleTypeSubmit} className="rounded-xl bg-primary text-primary-foreground">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={municipalityDialog} onOpenChange={setMunicipalityDialog}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editMode ? 'تعديل البلدية' : 'إضافة بلدية جديدة'}</DialogTitle>
            <DialogDescription className="sr-only">تعديل أو إضافة بلدية</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs font-bold">اسم البلدية *</Label><Input value={municipalityForm.name || ''} onChange={e => setMunicipalityForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl h-10" /></div>
            <div><Label className="text-xs font-bold">الكود *</Label><Input value={municipalityForm.code || ''} onChange={e => setMunicipalityForm(p => ({ ...p, code: e.target.value }))} className="rounded-xl h-10" /></div>
            <div><Label className="text-xs font-bold">رابط الشعار</Label><Input value={municipalityForm.logo_url || ''} onChange={e => setMunicipalityForm(p => ({ ...p, logo_url: e.target.value }))} className="rounded-xl h-10" /></div>
          </div>
          <DialogFooter><Button onClick={handleMunicipalitySubmit} className="rounded-xl bg-primary text-primary-foreground">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cityDialog} onOpenChange={setCityDialog}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>{editMode ? 'تعديل المدينة' : 'إضافة مدينة جديدة'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs font-bold">اسم المدينة *</Label><Input value={cityForm.name} onChange={e => setCityForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl h-10" /></div>
          </div>
          <DialogFooter><Button onClick={handleCitySubmit} className="rounded-xl bg-primary text-primary-foreground">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}