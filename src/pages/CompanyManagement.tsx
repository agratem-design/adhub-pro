import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Building, Plus, Pencil, Trash2, Upload, Image as ImageIcon, Phone, User, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { uploadImage } from '@/services/imageUploadService';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  logo_url: string | null;
  brand_color: string | null;
  company_type: string | null;
}

const emptyForm = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  notes: '',
  brand_color: '#3b82f6',
  logo_url: '',
};

const CompanyManagement: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('own');

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('friend_companies')
      .select('*')
      .order('name');
    if (!error) setCompanies(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const filtered = companies.filter(c => (c.company_type || 'friend') === activeTab);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditing(c);
    setForm({
      name: c.name || '',
      contact_person: c.contact_person || '',
      phone: c.phone || '',
      email: c.email || '',
      notes: c.notes || '',
      brand_color: c.brand_color || '#3b82f6',
      logo_url: c.logo_url || '',
    });
    setDialogOpen(true);
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(file, `logo_${Date.now()}.jpg`, 'company-logos');
      setForm(f => ({ ...f, logo_url: url }));
      toast.success('تم رفع الشعار');
    } catch (e: any) {
      toast.error('فشل رفع الشعار: ' + (e.message || ''));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('اسم الشركة مطلوب');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact_person: form.contact_person || null,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
        brand_color: form.brand_color || null,
        logo_url: form.logo_url || null,
        company_type: activeTab,
      };

      if (editing) {
        const { error } = await supabase.from('friend_companies').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('تم تحديث بيانات الشركة');
      } else {
        const { error } = await supabase.from('friend_companies').insert(payload);
        if (error) throw error;
        toast.success('تم إضافة الشركة');
      }
      setDialogOpen(false);
      loadCompanies();
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الشركة؟')) return;
    const { error } = await supabase.from('friend_companies').delete().eq('id', id);
    if (error) {
      toast.error('فشل الحذف: ' + error.message);
    } else {
      toast.success('تم الحذف');
      loadCompanies();
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building className="h-6 w-6 text-primary" />
            إدارة الشركات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة شركاتنا والشركات الصديقة مع الشعارات</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة شركة
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="own">شركاتنا</TabsTrigger>
          <TabsTrigger value="friend">الشركات الصديقة</TabsTrigger>
        </TabsList>

        {['own', 'friend'].map(tab => (
          <TabsContent key={tab} value={tab}>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  لا توجد شركات. اضغط "إضافة شركة" لإنشاء واحدة.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map(company => (
                  <Card key={company.id} className="relative group overflow-hidden">
                    {company.brand_color && (
                      <div className="h-1 w-full" style={{ backgroundColor: company.brand_color }} />
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        {company.logo_url ? (
                          <img
                            src={company.logo_url}
                            alt={company.name}
                            className="w-12 h-12 rounded-lg object-contain border bg-background p-1"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg border bg-muted flex items-center justify-center">
                            <Building className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{company.name}</CardTitle>
                          {company.contact_person && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <User className="h-3 w-3" />
                              {company.contact_person}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 space-y-1">
                      {company.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {company.phone}
                        </p>
                      )}
                      {company.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{company.notes}</p>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(company)} className="gap-1 text-xs">
                          <Pencil className="h-3 w-3" />
                          تعديل
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(company.id)} className="gap-1 text-xs">
                          <Trash2 className="h-3 w-3" />
                          حذف
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل الشركة' : 'إضافة شركة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3">
              {form.logo_url ? (
                <img src={form.logo_url} alt="شعار" className="w-20 h-20 rounded-lg object-contain border bg-background p-1" />
              ) : (
                <div className="w-20 h-20 rounded-lg border-2 border-dashed bg-muted flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => document.getElementById('logo-upload')?.click()}
                  disabled={uploading}
                  className="gap-1 text-xs"
                >
                  <Upload className="h-3 w-3" />
                  {uploading ? 'جاري الرفع...' : 'رفع شعار'}
                </Button>
                {form.logo_url && (
                  <Button size="sm" variant="ghost" onClick={() => setForm(f => ({ ...f, logo_url: '' }))} className="text-xs text-destructive">
                    إزالة
                  </Button>
                )}
              </div>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              />
            </div>

            <div>
              <Label>اسم الشركة *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم الشركة" />
            </div>
            <div>
              <Label>الشخص المسؤول</Label>
              <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} placeholder="اسم المسؤول" />
            </div>
            <div>
              <Label>الهاتف</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="رقم الهاتف" />
            </div>
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="البريد" />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Palette className="h-3.5 w-3.5" />
                لون العلامة التجارية
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.brand_color}
                  onChange={e => setForm(f => ({ ...f, brand_color: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.brand_color}
                  onChange={e => setForm(f => ({ ...f, brand_color: e.target.value }))}
                  className="flex-1"
                  placeholder="#3b82f6"
                />
              </div>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات إضافية" rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyManagement;
