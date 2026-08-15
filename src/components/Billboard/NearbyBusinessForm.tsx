import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { Plus, Trash2, Building2, Phone, MapPin } from 'lucide-react';

interface NearbyBusiness {
  id?: string;
  billboard_id: number;
  business_name: string;
  business_type: string;
  phone: string;
  address: string;
  distance_estimate: string;
  source: string;
  notes: string;
}

const BUSINESS_TYPES = [
  'مستشفى', 'عيادة', 'صيدلية', 'مطعم', 'مقهى', 'بنك', 'مدرسة', 'جامعة',
  'شركة اتصالات', 'محل ملابس', 'سوبرماركت', 'محطة وقود', 'فندق', 'شركة',
  'مركز تسوق', 'مكتبة', 'صالة رياضية', 'معرض سيارات', 'مكتب عقارات', 'أخرى',
];

const DISTANCES = ['مباشرة أمام اللوحة', '50م', '100م', '200م', '300م', '500م'];

interface NearbyBusinessFormProps {
  billboardId: number;
  billboardName?: string;
}

export default function NearbyBusinessForm({ billboardId, billboardName }: NearbyBusinessFormProps) {
  const [businesses, setBusinesses] = useState<NearbyBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const emptyBusiness: NearbyBusiness = {
    billboard_id: billboardId,
    business_name: '',
    business_type: '',
    phone: '',
    address: '',
    distance_estimate: '',
    source: 'manual',
    notes: '',
  };

  useEffect(() => {
    loadBusinesses();
  }, [billboardId]);

  const loadBusinesses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('billboard_nearby_businesses')
      .select('*')
      .eq('billboard_id', billboardId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      toast.error('فشل تحميل الشركات المجاورة');
    } else {
      setBusinesses(data || []);
    }
    setLoading(false);
  };

  const addRow = () => setBusinesses((prev) => [...prev, { ...emptyBusiness }]);

  const updateRow = (index: number, field: keyof NearbyBusiness, value: string) => {
    setBusinesses((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  };

  const removeRow = async (index: number) => {
    const biz = businesses[index];
    if (biz.id) {
      await supabase.from('billboard_nearby_businesses').delete().eq('id', biz.id);
    }
    setBusinesses((prev) => prev.filter((_, i) => i !== index));
    toast.success('تم الحذف');
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const biz of businesses) {
        if (!biz.business_name.trim()) continue;
        const record = {
          billboard_id: billboardId,
          business_name: biz.business_name,
          business_type: biz.business_type,
          phone: biz.phone,
          address: biz.address,
          distance_estimate: biz.distance_estimate,
          source: biz.source || 'manual',
          notes: biz.notes,
        };
        if (biz.id) {
          await supabase.from('billboard_nearby_businesses').update(record).eq('id', biz.id);
        } else {
          await supabase.from('billboard_nearby_businesses').insert(record);
        }
      }
      toast.success('تم الحفظ بنجاح');
      await loadBusinesses();
    } catch (e: any) {
      toast.error(e?.message || 'فشل الحفظ');
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5" />
          الشركات المجاورة {billboardName ? `- ${billboardName}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        ) : (
          <>
            {businesses.map((biz, i) => (
              <div key={biz.id || `new-${i}`} className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 bg-muted/30 rounded-lg items-end">
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">اسم الشركة/المحل</label>
                  <Input
                    value={biz.business_name}
                    onChange={(e) => updateRow(i, 'business_name', e.target.value)}
                    placeholder="مثال: مستشفى المدينة"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">النوع</label>
                  <Select value={biz.business_type} onValueChange={(v) => updateRow(i, 'business_type', v)}>
                    <SelectTrigger><SelectValue placeholder="النوع" /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />الهاتف</label>
                  <Input value={biz.phone} onChange={(e) => updateRow(i, 'phone', e.target.value)} placeholder="091XXXXXXX" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />المسافة</label>
                  <Select value={biz.distance_estimate} onValueChange={(v) => updateRow(i, 'distance_estimate', v)}>
                    <SelectTrigger><SelectValue placeholder="المسافة" /></SelectTrigger>
                    <SelectContent>
                      {DISTANCES.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeRow(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
                <Plus className="h-4 w-4" /> إضافة شركة
              </Button>
              {businesses.length > 0 && (
                <Button size="sm" onClick={saveAll} disabled={saving}>
                  {saving ? 'جاري الحفظ...' : 'حفظ الكل'}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
