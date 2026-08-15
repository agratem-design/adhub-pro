import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QuickAddBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (value: string) => void;
  onRefresh: () => Promise<void>;
}

// 1. Add Size Dialog
export const QuickAddSizeDialog: React.FC<QuickAddBaseProps> = ({ open, onOpenChange, onSuccess, onRefresh }) => {
  const [form, setForm] = useState({ name: '', width: 0, height: 0, installation_price: 0, sort_order: 999, description: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.width <= 0 || form.height <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      setSaving(true);
      
      // Check for sort_order uniqueness
      const { data: existing } = await supabase
        .from('sizes')
        .select('id')
        .eq('sort_order', form.sort_order);
      
      if (existing && existing.length > 0) {
        toast.error(`رقم الترتيب ${form.sort_order} مستخدم بالفعل. يرجى اختيار رقم آخر.`);
        setSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from('sizes')
        .insert({
          name: form.name.trim(),
          width: form.width,
          height: form.height,
          installation_price: form.installation_price,
          sort_order: form.sort_order,
          description: form.description.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`تم إضافة المقاس "${form.name}" بنجاح`);
      await onRefresh();
      onSuccess(form.name.trim());
      onOpenChange(false);
      setForm({ name: '', width: 0, height: 0, installation_price: 0, sort_order: 999, description: '' });
    } catch (err: any) {
      console.error('Error saving size:', err);
      toast.error(`فشل في حفظ المقاس: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground text-right">إضافة مقاس لوحة جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-right" dir="rtl">
          <div>
            <Label className="text-xs">اسم المقاس *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: 12x4، 13x5"
              className="mt-1 text-right"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">العرض (متر) *</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={form.width || ''}
                onChange={(e) => setForm({ ...form, width: parseFloat(e.target.value) || 0 })}
                placeholder="12.0"
                className="mt-1 font-manrope text-right"
              />
            </div>
            <div>
              <Label className="text-xs">الارتفاع (متر) *</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={form.height || ''}
                onChange={(e) => setForm({ ...form, height: parseFloat(e.target.value) || 0 })}
                placeholder="4.0"
                className="mt-1 font-manrope text-right"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">سعر التركيب (د.ل)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.installation_price || ''}
                onChange={(e) => setForm({ ...form, installation_price: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="mt-1 font-manrope text-right"
              />
            </div>
            <div>
              <Label className="text-xs">الترتيب (فريد) *</Label>
              <Input
                type="number"
                min="1"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 999 })}
                className="mt-1 font-manrope text-right"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">الوصف</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف اختياري"
              className="mt-1 text-right"
            />
          </div>
          <DialogFooter className="gap-2 pt-2 justify-start flex-row-reverse">
            <Button type="submit" disabled={saving}>
              {saving ? 'جاري الحفظ...' : <><Save className="h-4 w-4 ml-1" /> حفظ</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// 2. Add Municipality Dialog
export const QuickAddMunicipalityDialog: React.FC<QuickAddBaseProps> = ({ open, onOpenChange, onSuccess, onRefresh }) => {
  const [form, setForm] = useState({ name: '', code: '', logo_url: '', sort_order: 1 });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('يرجى إدخال اسم البلدية والكود');
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('municipalities')
        .insert({
          name: form.name.trim(),
          code: form.code.trim(),
          logo_url: form.logo_url.trim() || null,
          sort_order: form.sort_order
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`تم إضافة البلدية "${form.name}" بنجاح`);
      await onRefresh();
      onSuccess(form.name.trim());
      onOpenChange(false);
      setForm({ name: '', code: '', logo_url: '', sort_order: 1 });
    } catch (err: any) {
      console.error('Error saving municipality:', err);
      toast.error(`فشل في حفظ البلدية: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground text-right">إضافة بلدية جديدة</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-right" dir="rtl">
          <div>
            <Label className="text-xs">اسم البلدية *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: بلدية طرابلس المركز"
              className="mt-1 text-right"
            />
          </div>
          <div>
            <Label className="text-xs">كود البلدية *</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="مثال: TRIPOLI"
              className="mt-1 font-manrope text-right"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">الترتيب</Label>
              <Input
                type="number"
                min="1"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 1 })}
                className="mt-1 font-manrope text-right"
              />
            </div>
            <div>
              <Label className="text-xs">رابط شعار البلدية (اختياري)</Label>
              <Input
                value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
                className="mt-1 font-manrope text-left"
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2 justify-start flex-row-reverse">
            <Button type="submit" disabled={saving}>
              {saving ? 'جاري الحفظ...' : <><Save className="h-4 w-4 ml-1" /> حفظ</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// 3. Add City Dialog
export const QuickAddCityDialog: React.FC<QuickAddBaseProps> = ({ open, onOpenChange, onSuccess, onRefresh }) => {
  const [cityName, setCityName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityName.trim()) {
      toast.error('يرجى إدخال اسم المدينة');
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('cities')
        .insert({ name: cityName.trim() })
        .select()
        .single();

      if (error) throw error;

      toast.success(`تم إضافة المدينة "${cityName}" بنجاح`);
      await onRefresh();
      onSuccess(cityName.trim());
      onOpenChange(false);
      setCityName('');
    } catch (err: any) {
      console.error('Error saving city:', err);
      toast.error(`فشل في حفظ المدينة: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground text-right">إضافة مدينة جديدة</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-right" dir="rtl">
          <div>
            <Label className="text-xs">اسم المدينة *</Label>
            <Input
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="مثال: طرابلس، بنغازي، مصراتة"
              className="mt-1 text-right"
            />
          </div>
          <DialogFooter className="gap-2 pt-2 justify-start flex-row-reverse">
            <Button type="submit" disabled={saving}>
              {saving ? 'جاري الحفظ...' : <><Save className="h-4 w-4 ml-1" /> حفظ</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// 4. Add Type Dialog
export const QuickAddTypeDialog: React.FC<QuickAddBaseProps> = ({ open, onOpenChange, onSuccess, onRefresh }) => {
  const [form, setForm] = useState({ name: '', color: '#3B82F6', description: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('يرجى إدخال اسم النوع');
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('billboard_types')
        .insert({
          name: form.name.trim(),
          color: form.color,
          description: form.description.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`تم إضافة نوع اللوحة "${form.name}" بنجاح`);
      await onRefresh();
      onSuccess(form.name.trim());
      onOpenChange(false);
      setForm({ name: '', color: '#3B82F6', description: '' });
    } catch (err: any) {
      console.error('Error saving type:', err);
      toast.error(`فشل في حفظ النوع: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground text-right">إضافة نوع لوحة جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-right" dir="rtl">
          <div>
            <Label className="text-xs">اسم النوع *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: رقمية LED، عادية شباك"
              className="mt-1 text-right"
            />
          </div>
          <div>
            <Label className="text-xs">لون التمييز في الخريطة</Label>
            <div className="flex gap-2 items-center mt-1">
              <Input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-12 h-9 p-0.5 border"
              />
              <Input
                type="text"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="font-manrope"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">الوصف</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف اختياري للنوع"
              className="mt-1 text-right"
            />
          </div>
          <DialogFooter className="gap-2 pt-2 justify-start flex-row-reverse">
            <Button type="submit" disabled={saving}>
              {saving ? 'جاري الحفظ...' : <><Save className="h-4 w-4 ml-1" /> حفظ</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// 5. Add Level Dialog
export const QuickAddLevelDialog: React.FC<QuickAddBaseProps> = ({ open, onOpenChange, onSuccess, onRefresh }) => {
  const [form, setForm] = useState({ level_code: '', level_name: '', description: '', sort_order: 1 });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.level_code.trim() || !form.level_name.trim()) {
      toast.error('يرجى إدخال رمز المستوى واسمه');
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('billboard_levels')
        .insert({
          level_code: form.level_code.trim().toUpperCase(),
          level_name: form.level_name.trim(),
          description: form.description.trim() || null,
          sort_order: form.sort_order
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`تم إضافة المستوى "${form.level_code}" بنجاح`);
      await onRefresh();
      onSuccess(form.level_code.trim().toUpperCase());
      onOpenChange(false);
      setForm({ level_code: '', level_name: '', description: '', sort_order: 1 });
    } catch (err: any) {
      console.error('Error saving level:', err);
      toast.error(`فشل في حفظ المستوى: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground text-right">إضافة مستوى لوحة جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-right" dir="rtl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">رمز المستوى *</Label>
              <Input
                value={form.level_code}
                onChange={(e) => setForm({ ...form, level_code: e.target.value })}
                placeholder="مثال: A، B، C"
                className="mt-1 font-manrope uppercase text-right"
              />
            </div>
            <div>
              <Label className="text-xs">اسم المستوى *</Label>
              <Input
                value={form.level_name}
                onChange={(e) => setForm({ ...form, level_name: e.target.value })}
                placeholder="مثال: ممتاز، عادي"
                className="mt-1 text-right"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">الترتيب</Label>
              <Input
                type="number"
                min="1"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 1 })}
                className="mt-1 font-manrope text-right"
              />
            </div>
            <div>
              <Label className="text-xs">الوصف (اختياري)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="موقع متميز بحركة مرور..."
                className="mt-1 text-right"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2 justify-start flex-row-reverse">
            <Button type="submit" disabled={saving}>
              {saving ? 'جاري الحفظ...' : <><Save className="h-4 w-4 ml-1" /> حفظ</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// 6. Add Faces Dialog
export const QuickAddFaceDialog: React.FC<QuickAddBaseProps> = ({ open, onOpenChange, onSuccess, onRefresh }) => {
  const [form, setForm] = useState({ name: '', count: 1, description: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.count <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('billboard_faces')
        .insert({
          name: form.name.trim(),
          count: form.count,
          description: form.description.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`تم إضافة عدد الأوجه "${form.name}" بنجاح`);
      await onRefresh();
      onSuccess(String(form.count));
      onOpenChange(false);
      setForm({ name: '', count: 1, description: '' });
    } catch (err: any) {
      console.error('Error saving face option:', err);
      toast.error(`فشل في حفظ خيار الأوجه: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground text-right">إضافة خيار أوجه جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-right" dir="rtl">
          <div>
            <Label className="text-xs">اسم خيار الأوجه *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: وجه واحد، وجهين، ثلاثة أوجه"
              className="mt-1 text-right"
            />
          </div>
          <div>
            <Label className="text-xs">عدد الأوجه (رقمي) *</Label>
            <Input
              type="number"
              min="1"
              value={form.count}
              onChange={(e) => setForm({ ...form, count: parseInt(e.target.value) || 1 })}
              placeholder="2"
              className="mt-1 font-manrope text-right"
            />
          </div>
          <div>
            <Label className="text-xs">الوصف</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف اختياري"
              className="mt-1 text-right"
            />
          </div>
          <DialogFooter className="gap-2 pt-2 justify-start flex-row-reverse">
            <Button type="submit" disabled={saving}>
              {saving ? 'جاري الحفظ...' : <><Save className="h-4 w-4 ml-1" /> حفظ</>}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
