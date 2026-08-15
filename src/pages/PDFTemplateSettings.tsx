import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Palette, Type, Layout, Image as ImageIcon, FileText, Settings2, Eye, Save } from 'lucide-react';

interface TemplateSettings {
  id?: string;
  template_name: string;
  template_type: string;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  background_color: string;
  header_font: string;
  body_font: string;
  font_size_header: number;
  font_size_body: number;
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  logo_url: string;
  logo_width: number;
  logo_height: number;
  show_logo: boolean;
  header_text: string;
  footer_text: string;
  show_header: boolean;
  show_footer: boolean;
  signature_url: string;
  signature_label: string;
  show_signature: boolean;
  page_orientation: string;
  page_size: string;
  is_default: boolean;
}

const FONTS = ['Cairo', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
const TEMPLATE_TYPES = [
  { value: 'contract', label: 'عقود' },
  { value: 'billboard_print', label: 'طباعة اللوحات' },
  { value: 'invoice', label: 'فواتير' },
  { value: 'receipt', label: 'إيصالات' }
];

export default function PDFTemplateSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateSettings[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [settings, setSettings] = useState<TemplateSettings>({
    template_name: 'قالب جديد',
    template_type: 'contract',
    primary_color: '#d4af37',
    secondary_color: '#1e293b',
    text_color: '#f1f5f9',
    background_color: '#0f172a',
    header_font: 'Cairo',
    body_font: 'Cairo',
    font_size_header: 24,
    font_size_body: 14,
    margin_top: 40,
    margin_right: 40,
    margin_bottom: 40,
    margin_left: 40,
    logo_url: '',
    logo_width: 150,
    logo_height: 80,
    show_logo: true,
    header_text: '',
    footer_text: '',
    show_header: true,
    show_footer: true,
    signature_url: '',
    signature_label: 'التوقيع',
    show_signature: true,
    page_orientation: 'portrait',
    page_size: 'a4',
    is_default: false
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('template_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setTemplates(data);
        if (data.length > 0 && !selectedTemplateId) {
          const defaultTemplate = data.find(t => t.is_default) || data[0];
          setSelectedTemplateId(defaultTemplate.id);
          setSettings(defaultTemplate);
        }
      }
    } catch (error: any) {
      console.error('Error loading templates:', error);
      toast.error('فشل تحميل القوالب');
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setSettings(template);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      if (selectedTemplateId) {
        // Update existing template
        const { error } = await supabase
          .from('template_settings')
          .update(settings)
          .eq('id', selectedTemplateId);

        if (error) throw error;
        toast.success('تم حفظ الإعدادات بنجاح');
      } else {
        // Create new template
        const { data, error } = await supabase
          .from('template_settings')
          .insert(settings)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setSelectedTemplateId(data.id);
          toast.success('تم إنشاء القالب بنجاح');
        }
      }
      
      await loadTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error('فشل حفظ الإعدادات');
    } finally {
      setLoading(false);
    }
  };

  const handleNewTemplate = () => {
    setSelectedTemplateId(null);
    setSettings({
      template_name: 'قالب جديد',
      template_type: 'contract',
      primary_color: '#d4af37',
      secondary_color: '#1e293b',
      text_color: '#f1f5f9',
      background_color: '#0f172a',
      header_font: 'Cairo',
      body_font: 'Cairo',
      font_size_header: 24,
      font_size_body: 14,
      margin_top: 40,
      margin_right: 40,
      margin_bottom: 40,
      margin_left: 40,
      logo_url: '',
      logo_width: 150,
      logo_height: 80,
      show_logo: true,
      header_text: '',
      footer_text: '',
      show_header: true,
      show_footer: true,
      signature_url: '',
      signature_label: 'التوقيع',
      show_signature: true,
      page_orientation: 'portrait',
      page_size: 'a4',
      is_default: false
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-header flex items-center gap-2">
            <Settings2 className="h-8 w-8 text-primary" />
            إعدادات قوالب PDF
          </h1>
          <p className="page-subtitle">تخصيص شكل ومظهر ملفات PDF الناتجة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            رجوع
          </Button>
          <Button onClick={handleNewTemplate} variant="outline">
            قالب جديد
          </Button>
          <Button onClick={handleSave} disabled={loading} className="btn-primary">
            <Save className="h-4 w-4 ml-2" />
            {loading ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Selection */}
          <Card className="card-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                اختيار القالب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>القالب الحالي</Label>
                  <Select value={selectedTemplateId || undefined} onValueChange={handleTemplateSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر قالب" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id!}>
                          {template.template_name} {template.is_default && '(افتراضي)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>نوع القالب</Label>
                  <Select value={settings.template_type} onValueChange={(v) => setSettings({...settings, template_type: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>اسم القالب</Label>
                <Input
                  value={settings.template_name}
                  onChange={(e) => setSettings({...settings, template_name: e.target.value})}
                  placeholder="أدخل اسم القالب"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>تعيين كقالب افتراضي</Label>
                <Switch
                  checked={settings.is_default}
                  onCheckedChange={(checked) => setSettings({...settings, is_default: checked})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Settings */}
          <Tabs defaultValue="colors" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="colors">
                <Palette className="h-4 w-4 ml-2" />
                الألوان
              </TabsTrigger>
              <TabsTrigger value="fonts">
                <Type className="h-4 w-4 ml-2" />
                الخطوط
              </TabsTrigger>
              <TabsTrigger value="layout">
                <Layout className="h-4 w-4 ml-2" />
                التخطيط
              </TabsTrigger>
              <TabsTrigger value="branding">
                <ImageIcon className="h-4 w-4 ml-2" />
                العلامة
              </TabsTrigger>
            </TabsList>

            {/* Colors Tab */}
            <TabsContent value="colors">
              <Card className="card-elegant">
                <CardHeader>
                  <CardTitle>الألوان</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>اللون الأساسي</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={settings.primary_color}
                          onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                          className="w-16 h-10"
                        />
                        <Input
                          value={settings.primary_color}
                          onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>اللون الثانوي</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={settings.secondary_color}
                          onChange={(e) => setSettings({...settings, secondary_color: e.target.value})}
                          className="w-16 h-10"
                        />
                        <Input
                          value={settings.secondary_color}
                          onChange={(e) => setSettings({...settings, secondary_color: e.target.value})}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>لون النص</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={settings.text_color}
                          onChange={(e) => setSettings({...settings, text_color: e.target.value})}
                          className="w-16 h-10"
                        />
                        <Input
                          value={settings.text_color}
                          onChange={(e) => setSettings({...settings, text_color: e.target.value})}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>لون الخلفية</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={settings.background_color}
                          onChange={(e) => setSettings({...settings, background_color: e.target.value})}
                          className="w-16 h-10"
                        />
                        <Input
                          value={settings.background_color}
                          onChange={(e) => setSettings({...settings, background_color: e.target.value})}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Fonts Tab */}
            <TabsContent value="fonts">
              <Card className="card-elegant">
                <CardHeader>
                  <CardTitle>الخطوط</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>خط العناوين</Label>
                      <Select value={settings.header_font} onValueChange={(v) => setSettings({...settings, header_font: v})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONTS.map(font => (
                            <SelectItem key={font} value={font}>{font}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>حجم خط العناوين</Label>
                      <Input
                        type="number"
                        value={settings.font_size_header}
                        onChange={(e) => setSettings({...settings, font_size_header: parseInt(e.target.value) || 24})}
                        min={12}
                        max={48}
                      />
                    </div>

                    <div>
                      <Label>خط النص</Label>
                      <Select value={settings.body_font} onValueChange={(v) => setSettings({...settings, body_font: v})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONTS.map(font => (
                            <SelectItem key={font} value={font}>{font}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>حجم خط النص</Label>
                      <Input
                        type="number"
                        value={settings.font_size_body}
                        onChange={(e) => setSettings({...settings, font_size_body: parseInt(e.target.value) || 14})}
                        min={8}
                        max={24}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Layout Tab */}
            <TabsContent value="layout">
              <Card className="card-elegant">
                <CardHeader>
                  <CardTitle>التخطيط والهوامش</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>اتجاه الصفحة</Label>
                      <Select value={settings.page_orientation} onValueChange={(v) => setSettings({...settings, page_orientation: v})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="portrait">عمودي</SelectItem>
                          <SelectItem value="landscape">أفقي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>حجم الصفحة</Label>
                      <Select value={settings.page_size} onValueChange={(v) => setSettings({...settings, page_size: v})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a4">A4</SelectItem>
                          <SelectItem value="letter">Letter</SelectItem>
                          <SelectItem value="legal">Legal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-lg mb-3 block">الهوامش (بكسل)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>الهامش العلوي</Label>
                        <Input
                          type="number"
                          value={settings.margin_top}
                          onChange={(e) => setSettings({...settings, margin_top: parseInt(e.target.value) || 40})}
                          min={0}
                          max={100}
                        />
                      </div>

                      <div>
                        <Label>الهامش الأيمن</Label>
                        <Input
                          type="number"
                          value={settings.margin_right}
                          onChange={(e) => setSettings({...settings, margin_right: parseInt(e.target.value) || 40})}
                          min={0}
                          max={100}
                        />
                      </div>

                      <div>
                        <Label>الهامش السفلي</Label>
                        <Input
                          type="number"
                          value={settings.margin_bottom}
                          onChange={(e) => setSettings({...settings, margin_bottom: parseInt(e.target.value) || 40})}
                          min={0}
                          max={100}
                        />
                      </div>

                      <div>
                        <Label>الهامش الأيسر</Label>
                        <Input
                          type="number"
                          value={settings.margin_left}
                          onChange={(e) => setSettings({...settings, margin_left: parseInt(e.target.value) || 40})}
                          min={0}
                          max={100}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Branding Tab */}
            <TabsContent value="branding">
              <Card className="card-elegant">
                <CardHeader>
                  <CardTitle>العلامة التجارية</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Logo */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>الشعار</Label>
                      <Switch
                        checked={settings.show_logo}
                        onCheckedChange={(checked) => setSettings({...settings, show_logo: checked})}
                      />
                    </div>
                    <Input
                      value={settings.logo_url}
                      onChange={(e) => setSettings({...settings, logo_url: e.target.value})}
                      placeholder="رابط الشعار"
                      disabled={!settings.show_logo}
                    />
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Input
                        type="number"
                        value={settings.logo_width}
                        onChange={(e) => setSettings({...settings, logo_width: parseInt(e.target.value) || 150})}
                        placeholder="العرض"
                        disabled={!settings.show_logo}
                      />
                      <Input
                        type="number"
                        value={settings.logo_height}
                        onChange={(e) => setSettings({...settings, logo_height: parseInt(e.target.value) || 80})}
                        placeholder="الارتفاع"
                        disabled={!settings.show_logo}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Header */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>الرأسية</Label>
                      <Switch
                        checked={settings.show_header}
                        onCheckedChange={(checked) => setSettings({...settings, show_header: checked})}
                      />
                    </div>
                    <Input
                      value={settings.header_text}
                      onChange={(e) => setSettings({...settings, header_text: e.target.value})}
                      placeholder="نص الرأسية"
                      disabled={!settings.show_header}
                    />
                  </div>

                  {/* Footer */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>التذييل</Label>
                      <Switch
                        checked={settings.show_footer}
                        onCheckedChange={(checked) => setSettings({...settings, show_footer: checked})}
                      />
                    </div>
                    <Input
                      value={settings.footer_text}
                      onChange={(e) => setSettings({...settings, footer_text: e.target.value})}
                      placeholder="نص التذييل"
                      disabled={!settings.show_footer}
                    />
                  </div>

                  <Separator />

                  {/* Signature */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>التوقيع</Label>
                      <Switch
                        checked={settings.show_signature}
                        onCheckedChange={(checked) => setSettings({...settings, show_signature: checked})}
                      />
                    </div>
                    <Input
                      value={settings.signature_url}
                      onChange={(e) => setSettings({...settings, signature_url: e.target.value})}
                      placeholder="رابط التوقيع"
                      disabled={!settings.show_signature}
                      className="mb-2"
                    />
                    <Input
                      value={settings.signature_label}
                      onChange={(e) => setSettings({...settings, signature_label: e.target.value})}
                      placeholder="تسمية التوقيع"
                      disabled={!settings.show_signature}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-1">
          <Card className="card-elegant sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                معاينة مباشرة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="w-full h-[600px] overflow-auto border-2 border-border/50 rounded-lg shadow-lg"
                style={{
                  backgroundColor: settings.background_color,
                  color: settings.text_color,
                  fontFamily: settings.body_font,
                  padding: `${settings.margin_top}px ${settings.margin_right}px ${settings.margin_bottom}px ${settings.margin_left}px`
                }}
              >
                {/* Header */}
                {settings.show_header && settings.header_text && (
                  <div 
                    className="text-center mb-4 pb-2 border-b"
                    style={{ 
                      borderColor: settings.primary_color,
                      fontFamily: settings.header_font,
                      fontSize: `${settings.font_size_header}px`,
                      color: settings.primary_color
                    }}
                  >
                    {settings.header_text}
                  </div>
                )}

                {/* Logo */}
                {settings.show_logo && settings.logo_url && (
                  <div className="text-center mb-4">
                    <img 
                      src={settings.logo_url} 
                      alt="Logo" 
                      style={{
                        width: `${settings.logo_width}px`,
                        height: `${settings.logo_height}px`,
                        margin: '0 auto'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Sample Content */}
                <div 
                  className="mb-4"
                  style={{ 
                    fontFamily: settings.header_font,
                    fontSize: `${settings.font_size_header}px`,
                    color: settings.primary_color
                  }}
                >
                  عنوان نموذجي
                </div>

                <div 
                  className="mb-4"
                  style={{ 
                    fontFamily: settings.body_font,
                    fontSize: `${settings.font_size_body}px`
                  }}
                >
                  <p className="mb-2">هذا نص تجريبي لعرض كيف سيظهر المستند النهائي.</p>
                  <p className="mb-2">يمكنك تغيير الألوان والخطوط والتخطيط من الإعدادات.</p>
                  <p>سيتم تطبيق هذه الإعدادات على جميع ملفات PDF المُنشأة.</p>
                </div>

                {/* Sample Table */}
                <table 
                  className="w-full mb-4"
                  style={{ 
                    borderColor: settings.secondary_color,
                    fontSize: `${settings.font_size_body}px`
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: settings.secondary_color }}>
                      <th className="border p-2" style={{ borderColor: settings.primary_color }}>البند</th>
                      <th className="border p-2" style={{ borderColor: settings.primary_color }}>القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-2" style={{ borderColor: settings.secondary_color }}>البند 1</td>
                      <td className="border p-2" style={{ borderColor: settings.secondary_color }}>1000 د.ل</td>
                    </tr>
                    <tr>
                      <td className="border p-2" style={{ borderColor: settings.secondary_color }}>البند 2</td>
                      <td className="border p-2" style={{ borderColor: settings.secondary_color }}>500 د.ل</td>
                    </tr>
                  </tbody>
                </table>

                {/* Signature */}
                {settings.show_signature && (
                  <div className="mt-8 flex justify-between items-end">
                    <div className="text-center">
                      {settings.signature_url && (
                        <img 
                          src={settings.signature_url} 
                          alt="Signature" 
                          className="mb-2"
                          style={{ width: '100px', height: 'auto' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div 
                        className="border-t-2 pt-2"
                        style={{ 
                          borderColor: settings.primary_color,
                          fontSize: `${settings.font_size_body}px`
                        }}
                      >
                        {settings.signature_label}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                {settings.show_footer && settings.footer_text && (
                  <div 
                    className="text-center mt-8 pt-2 border-t"
                    style={{ 
                      borderColor: settings.primary_color,
                      fontSize: `${settings.font_size_body - 2}px`
                    }}
                  >
                    {settings.footer_text}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
