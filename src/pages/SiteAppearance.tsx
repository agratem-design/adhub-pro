import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Image, Save, RotateCcw, Wand2, Upload, Loader2, Trash2, Type } from 'lucide-react';
import { useSiteTheme, generateThemeFromPrimary, type SiteThemeSettings } from '@/hooks/useSiteTheme';
import { invalidateBrandingCache } from '@/hooks/useBranding';
import { invalidateThemeCache } from '@/components/AppThemeLoader';
import { toast } from 'sonner';

const colorFields: { key: keyof SiteThemeSettings; label: string; description: string }[] = [
  { key: 'primary_color', label: 'اللون الرئيسي', description: 'أزرار، روابط، عناصر بارزة' },
  { key: 'secondary_color', label: 'اللون الثانوي', description: 'خلفيات ثانوية' },
  { key: 'accent_color', label: 'لون التمييز', description: 'شارات، تمييز العناصر' },
  { key: 'muted_color', label: 'اللون الخافت', description: 'خلفيات خافتة' },
  { key: 'border_color', label: 'لون الحدود', description: 'حدود الكروت والحقول' },
  { key: 'background_color', label: 'لون الخلفية', description: 'خلفية الصفحة' },
  { key: 'text_color', label: 'لون النصوص', description: 'النصوص الأساسية' },
];

const AVAILABLE_FONTS = [
  { name: 'Doran', label: 'دوران (Doran)' },
  { name: 'Cairo', label: 'القاهرة (Cairo)' },
  { name: 'Tajawal', label: 'تجوال (Tajawal)' },
  { name: 'Amiri', label: 'أميري (Amiri)' },
  { name: 'Manrope', label: 'مانروب (Manrope)' },
];

const SiteAppearance = () => {
  const { theme, loading, saving, updateThemeSetting, saveTheme, resetToDefaults } = useSiteTheme();
  const [uploading, setUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateFromPrimary = () => {
    const generated = generateThemeFromPrimary(theme.primary_color);
    Object.entries(generated).forEach(([key, value]) => {
      if (key !== 'primary_color' && value) {
        updateThemeSetting(key as keyof SiteThemeSettings, value as string);
      }
    });
    toast.success('تم توليد الألوان الفرعية من اللون الرئيسي');
  };

  const handleSave = async () => {
    const success = await saveTheme(theme);
    if (success) {
      invalidateBrandingCache();
      invalidateThemeCache();
    }
  };

  const handleUpload = async (file: File, type: 'logo' | 'favicon') => {
    try {
      setUploading(true);
      const { uploadImage } = await import('@/services/imageUploadService');
      const url = await uploadImage(file, `${type}.jpg`, 'branding');

      const key = type === 'logo' ? 'logo_url' : 'favicon_url';
      updateThemeSetting(key as keyof SiteThemeSettings, url);
      toast.success(`تم رفع ${type === 'logo' ? 'الشعار' : 'الأيقونة'} بنجاح`);
    } catch {
      toast.error('خطأ في رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (type: 'logo' | 'favicon') => {
    const key = type === 'logo' ? 'logo_url' : 'favicon_url';
    updateThemeSetting(key as keyof SiteThemeSettings, '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مظهر الموقع</h1>
          <p className="text-muted-foreground text-sm">تخصيص ألوان وشعار الموقع</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults} disabled={saving}>
            <RotateCcw className="h-4 w-4 ml-2" />
            إعادة تعيين
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
            حفظ التغييرات
          </Button>
        </div>
      </div>

      <Tabs defaultValue="colors" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="colors" className="gap-2">
            <Palette className="h-4 w-4" />
            الألوان
          </TabsTrigger>
          <TabsTrigger value="fonts" className="gap-2">
            <Type className="h-4 w-4" />
            الخطوط
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Image className="h-4 w-4" />
            الشعار والأيقونة
          </TabsTrigger>
        </TabsList>

        {/* === تبويب الألوان === */}
        <TabsContent value="colors" className="space-y-6">
          {/* اللون الرئيسي + توليد */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                اللون الرئيسي وتوليد الثيم
              </CardTitle>
              <CardDescription>اختر لوناً رئيسياً ثم اضغط "توليد" لإنشاء ألوان فرعية متناسقة تلقائياً</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="flex-1 max-w-xs">
                  <Label className="text-sm mb-1.5 block">اللون الرئيسي</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={theme.primary_color}
                      onChange={(e) => updateThemeSetting('primary_color', e.target.value)}
                      className="w-12 h-10 rounded-lg border border-border cursor-pointer"
                    />
                    <Input
                      value={theme.primary_color}
                      onChange={(e) => updateThemeSetting('primary_color', e.target.value)}
                      className="font-mono text-sm w-32"
                      dir="ltr"
                    />
                  </div>
                </div>
                <Button variant="outline" onClick={handleGenerateFromPrimary} className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  توليد الألوان الفرعية
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* جميع الألوان */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">جميع الألوان</CardTitle>
              <CardDescription>يمكنك تعديل كل لون يدوياً</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {colorFields.map(({ key, label, description }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-sm font-medium">{label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={(theme[key] as string) || '#000000'}
                        onChange={(e) => updateThemeSetting(key, e.target.value)}
                        className="w-10 h-9 rounded border border-border cursor-pointer shrink-0"
                      />
                      <Input
                        value={(theme[key] as string) || ''}
                        onChange={(e) => updateThemeSetting(key, e.target.value)}
                        className="font-mono text-xs"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* معاينة حية */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">معاينة حية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button>زر رئيسي</Button>
                <Button variant="secondary">زر ثانوي</Button>
                <Button variant="outline">زر محدد</Button>
                <Button variant="destructive">حذف</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>شارة افتراضية</Badge>
                <Badge variant="secondary">ثانوية</Badge>
                <Badge variant="outline">محددة</Badge>
                <Badge variant="destructive">تحذير</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="p-4">
                  <p className="text-sm font-medium text-foreground">كرت نموذجي</p>
                  <p className="text-xs text-muted-foreground mt-1">نص فرعي للمعاينة</p>
                </Card>
                <div className="p-4 rounded-lg bg-accent">
                  <p className="text-sm font-medium text-accent-foreground">خلفية تمييز</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm font-medium text-muted-foreground">خلفية خافتة</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Input placeholder="حقل إدخال نموذجي" className="max-w-xs" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === تبويب الخطوط === */}
        <TabsContent value="fonts" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Type className="h-5 w-5 text-primary" />
                خط الواجهة
              </CardTitle>
              <CardDescription>
                اختر الخط الذي يظهر في جميع صفحات وعناصر التطبيق — يُطبَّق فور بدء التشغيل
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">نوع الخط</Label>
                <Select
                  value={theme.site_font_family || 'Doran'}
                  onValueChange={(v) => {
                    updateThemeSetting('site_font_family' as keyof SiteThemeSettings, v);
                    // تطبيق فوري لمعاينة الخط
                    document.body.style.fontFamily = `'${v}', 'Cairo', 'Tajawal', sans-serif`;
                  }}
                >
                  <SelectTrigger className="max-w-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_FONTS.map((font) => (
                      <SelectItem key={font.name} value={font.name}>
                        <span style={{ fontFamily: font.name }}>{font.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
 سيُطبَّق الخط على الفور في الواجهة. اضغط &ldquo;حفظ التغييرات&rdquo; لحفظه بشكل دائم.
                </p>
              </div>

              {/* معاينة الخط */}
              <Card className="p-4 border border-border/50">
                <p className="text-xs text-muted-foreground mb-3">معاينة الخط</p>
                <p style={{ fontFamily: theme.site_font_family || 'Doran', fontSize: '18px', fontWeight: 'bold' }}>
                  مرحباً بك في النظام
                </p>
                <p style={{ fontFamily: theme.site_font_family || 'Doran', fontSize: '14px', marginTop: '4px', color: 'hsl(var(--muted-foreground))' }}>
                  هذه عينة من النصوص التي ستظهر في جميع أنحاء التطبيق باستخدام الخط المختار
                </p>
                <p style={{ fontFamily: 'Manrope', fontSize: '14px', marginTop: '8px', color: 'hsl(var(--muted-foreground))' }}>
                  الأرقام: 1,234,567 — 99.5% — 2026/06/07
                </p>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === تبويب الشعار === */}
        <TabsContent value="branding" className="space-y-6">
          {/* الشعار */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">شعار الموقع</CardTitle>
              <CardDescription>يظهر في الشريط الجانبي وصفحة تسجيل الدخول</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                  {theme.logo_url ? (
                    <img src={theme.logo_url} alt="الشعار" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Image className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*,.svg"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo')}
                  />
                  <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Upload className="h-4 w-4 ml-2" />}
                    رفع شعار جديد
                  </Button>
                  {theme.logo_url && (
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveImage('logo')} className="text-destructive">
                      <Trash2 className="h-4 w-4 ml-1" />
                      إزالة
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">PNG, SVG, JPG (يفضل بخلفية شفافة)</p>
                </div>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">أو أدخل رابط الشعار</Label>
                <Input
                  value={theme.logo_url || ''}
                  onChange={(e) => updateThemeSetting('logo_url' as keyof SiteThemeSettings, e.target.value)}
                  placeholder="https://example.com/logo.svg"
                  dir="ltr"
                  className="max-w-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* الأيقونة */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">أيقونة الموقع (Favicon)</CardTitle>
              <CardDescription>الأيقونة الصغيرة التي تظهر في تبويب المتصفح</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                  {theme.favicon_url ? (
                    <img src={theme.favicon_url} alt="الأيقونة" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Image className="h-6 w-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/*,.ico,.svg"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'favicon')}
                  />
                  <Button variant="outline" size="sm" onClick={() => faviconInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Upload className="h-4 w-4 ml-2" />}
                    رفع أيقونة جديدة
                  </Button>
                  {theme.favicon_url && (
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveImage('favicon')} className="text-destructive">
                      <Trash2 className="h-4 w-4 ml-1" />
                      إزالة
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">ICO, PNG, SVG (32×32 أو 64×64)</p>
                </div>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">أو أدخل رابط الأيقونة</Label>
                <Input
                  value={theme.favicon_url || ''}
                  onChange={(e) => updateThemeSetting('favicon_url' as keyof SiteThemeSettings, e.target.value)}
                  placeholder="https://example.com/favicon.ico"
                  dir="ltr"
                  className="max-w-lg"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SiteAppearance;
