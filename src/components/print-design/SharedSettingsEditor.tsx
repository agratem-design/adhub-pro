import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SharedInvoiceSettings, AVAILABLE_LOGOS, AVAILABLE_BACKGROUNDS, AlignmentOption, DEFAULT_SHARED_SETTINGS } from '@/types/invoice-templates';
import { Building2, Image, Palette, Type, Layout, AlignLeft, AlignCenter, AlignRight, RotateCcw, Ruler } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

interface Props {
  settings: SharedInvoiceSettings;
  onSettingsChange: (settings: SharedInvoiceSettings) => void;
}

const ColorInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={value === 'transparent' ? '#ffffff' : value}
      onChange={(e) => onChange(e.target.value)}
      className="w-8 h-8 rounded border cursor-pointer flex-shrink-0"
    />
    <div className="flex-1 min-w-0">
      <Label className="text-xs truncate block">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 text-[10px] font-mono px-1"
      />
    </div>
  </div>
);

const SliderInput = ({ label, value, onChange, min = 0, max = 100, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) => (
  <div className="space-y-1.5">
    <div className="flex justify-between">
      <Label className="text-xs">{label}</Label>
      <span className="text-xs font-mono text-muted-foreground">{value}</span>
    </div>
    <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
  </div>
);

const AlignmentSelector = ({ value, onChange, label }: { 
  value: AlignmentOption; onChange: (v: AlignmentOption) => void; label: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <RadioGroup value={value} onValueChange={(v) => onChange(v as AlignmentOption)} className="flex gap-1">
      {(['right', 'center', 'left'] as const).map((align) => (
        <div key={align} className="flex items-center">
          <RadioGroupItem value={align} id={`shared-${label}-${align}`} className="sr-only" />
          <Label htmlFor={`shared-${label}-${align}`}
            className={`flex items-center justify-center w-8 h-8 rounded border cursor-pointer transition-colors
              ${value === align ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
          >
            {align === 'right' ? <AlignRight className="h-3 w-3" /> : align === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignLeft className="h-3 w-3" />}
          </Label>
        </div>
      ))}
    </RadioGroup>
  </div>
);

const SectionResetButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    variant="ghost"
    size="sm"
    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive gap-0.5"
    onClick={onClick}
  >
    <RotateCcw className="h-2.5 w-2.5" />
    تعيين
  </Button>
);

export function SharedSettingsEditor({ settings, onSettingsChange }: Props) {
  const update = (key: keyof SharedInvoiceSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const resetSection = (keys: (keyof SharedInvoiceSettings)[]) => {
    const updated = { ...settings };
    keys.forEach(key => {
      (updated as any)[key] = (DEFAULT_SHARED_SETTINGS as any)[key];
    });
    onSettingsChange(updated);
    toast.success('تم إعادة تعيين القسم');
  };

  return (
    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
      <Tabs defaultValue="header" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-0.5 mb-3 p-0.5">
          <TabsTrigger value="header" className="text-[10px] gap-0.5 flex-1 min-w-[55px] h-7 px-1">
            <Layout className="h-3 w-3" />الهيدر
          </TabsTrigger>
          <TabsTrigger value="company" className="text-[10px] gap-0.5 flex-1 min-w-[55px] h-7 px-1">
            <Building2 className="h-3 w-3" />الشركة
          </TabsTrigger>
          <TabsTrigger value="background" className="text-[10px] gap-0.5 flex-1 min-w-[55px] h-7 px-1">
            <Image className="h-3 w-3" />خلفية
          </TabsTrigger>
          <TabsTrigger value="footer" className="text-[10px] gap-0.5 flex-1 min-w-[55px] h-7 px-1">
            <Layout className="h-3 w-3 rotate-180" />فوتر
          </TabsTrigger>
          <TabsTrigger value="spacing" className="text-[10px] gap-0.5 flex-1 min-w-[55px] h-7 px-1">
            <Ruler className="h-3 w-3" />هوامش
          </TabsTrigger>
        </TabsList>

        {/* ========== HEADER TAB ========== */}
        <TabsContent value="header" className="space-y-3 mt-0">
          <Accordion type="multiple" defaultValue={['logo', 'invoice-title']} className="space-y-2">
            {/* الشعار */}
            <AccordionItem value="logo" className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                <span className="flex items-center gap-1.5"><Image className="h-3.5 w-3.5 text-primary" />الشعار</span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">إظهار الشعار</Label>
                  <Switch checked={settings.showLogo} onCheckedChange={(v) => update('showLogo', v)} className="scale-75" />
                </div>
                {settings.showLogo && (
                  <>
                    <div className="grid grid-cols-3 gap-1.5">
                      {AVAILABLE_LOGOS.map(logo => (
                        <div key={logo.id} onClick={() => update('logoPath', logo.path)}
                          className={`flex flex-col items-center p-1.5 rounded border cursor-pointer transition-all
                            ${settings.logoPath === logo.path ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'hover:border-primary/50'}`}
                        >
                          <img src={logo.path} alt={logo.name} className="h-8 w-auto" />
                          <span className="text-[9px] mt-0.5 text-center">{logo.name}</span>
                        </div>
                      ))}
                    </div>
                    <SliderInput label="حجم الشعار" value={settings.logoSize} onChange={(v) => update('logoSize', v)} min={30} max={120} />
                    <AlignmentSelector label="موضع الشعار" value={settings.logoPosition} onChange={(v) => update('logoPosition', v)} />
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* معلومات الاتصال */}
            <AccordionItem value="contact-info" className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-blue-500" />معلومات الاتصال</span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">إظهار العنوان والهاتف</Label>
                  <Switch checked={settings.showContactInfo} onCheckedChange={(v) => update('showContactInfo', v)} className="scale-75" />
                </div>
                {settings.showContactInfo && (
                  <>
                    <Input value={settings.companyAddress} onChange={(e) => update('companyAddress', e.target.value)} className="h-7 text-xs" placeholder="العنوان" />
                    <Input value={settings.companyPhone} onChange={(e) => update('companyPhone', e.target.value)} className="h-7 text-xs" placeholder="الهاتف" />
                    <SliderInput label="حجم الخط" value={settings.contactInfoFontSize} onChange={(v) => update('contactInfoFontSize', v)} min={8} max={16} />
                    <AlignmentSelector label="المحاذاة" value={settings.contactInfoAlignment || 'center'} onChange={(v) => update('contactInfoAlignment', v)} />
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* عنوان الفاتورة */}
            <AccordionItem value="invoice-title" className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                <span className="flex items-center gap-1.5"><Type className="h-3.5 w-3.5 text-green-500" />عنوان الفاتورة</span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">إظهار العنوان</Label>
                  <Switch checked={settings.showInvoiceTitle} onCheckedChange={(v) => update('showInvoiceTitle', v)} className="scale-75" />
                </div>
                {settings.showInvoiceTitle && (
                  <>
                    <Input value={settings.invoiceTitle} onChange={(e) => update('invoiceTitle', e.target.value)} className="h-7 text-xs" placeholder="العنوان بالعربي" />
                    <Input value={settings.invoiceTitleEn} onChange={(e) => update('invoiceTitleEn', e.target.value)} className="h-7 text-xs" placeholder="English Title" dir="ltr" />
                    <AlignmentSelector label="المحاذاة" value={settings.invoiceTitleAlignment} onChange={(v) => update('invoiceTitleAlignment', v)} />
                    <SliderInput label="حجم خط العنوان" value={settings.invoiceTitleFontSize || 28} onChange={(v) => update('invoiceTitleFontSize', v)} min={16} max={48} />
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* ألوان الهيدر */}
            <AccordionItem value="header-colors" className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5 text-purple-500" />ألوان الهيدر</span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-3">
                <div className="flex justify-end">
                  <SectionResetButton onClick={() => resetSection(['headerBgColor', 'headerTextColor', 'headerBgOpacity', 'headerAlignment'])} />
                </div>
                <ColorInput label="لون الخلفية" value={settings.headerBgColor} onChange={(v) => update('headerBgColor', v)} />
                <ColorInput label="لون النص" value={settings.headerTextColor} onChange={(v) => update('headerTextColor', v)} />
                <SliderInput label="شفافية الهيدر" value={settings.headerBgOpacity} onChange={(v) => update('headerBgOpacity', v)} />
                <AlignmentSelector label="محاذاة الهيدر" value={settings.headerAlignment} onChange={(v) => update('headerAlignment', v)} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* الخط العام */}
          <Card className="border-dashed">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                <Type className="h-3.5 w-3.5" />الخط العام
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <Select value={settings.fontFamily} onValueChange={(v) => update('fontFamily', v)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Doran">Doran</SelectItem>
                  <SelectItem value="Manrope">Manrope</SelectItem>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Tahoma">Tahoma</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== COMPANY TAB ========== */}
        <TabsContent value="company" className="space-y-3 mt-0">
          <Card className="border-border/50">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />معلومات الشركة
                </CardTitle>
                <Switch checked={settings.showCompanyInfo} onCheckedChange={(v) => update('showCompanyInfo', v)} className="scale-75" />
              </div>
            </CardHeader>
            {settings.showCompanyInfo && (
              <CardContent className="px-3 pb-3 space-y-2">
                {[
                  { show: 'showCompanyName', value: 'companyName', label: 'اسم الشركة', placeholder: 'اسم الشركة' },
                  { show: 'showCompanySubtitle', value: 'companySubtitle', label: 'الوصف', placeholder: 'الوصف الفرعي' },
                  { show: 'showCompanyAddress', value: 'companyAddress', label: 'العنوان', placeholder: 'العنوان' },
                  { show: 'showCompanyPhone', value: 'companyPhone', label: 'الهاتف', placeholder: 'الهاتف' },
                  { show: 'showTaxId', value: 'companyTaxId', label: 'الرقم الضريبي', placeholder: 'الرقم الضريبي' },
                  { show: 'showEmail', value: 'companyEmail', label: 'البريد', placeholder: 'البريد الإلكتروني' },
                  { show: 'showWebsite', value: 'companyWebsite', label: 'الموقع', placeholder: 'الموقع الإلكتروني' },
                ].map(item => (
                  <div key={item.show} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{item.label}</Label>
                      <Switch checked={(settings as any)[item.show]} onCheckedChange={(v) => update(item.show as any, v)} className="scale-[0.6]" />
                    </div>
                    {(settings as any)[item.show] && (
                      <Input
                        value={(settings as any)[item.value]}
                        onChange={(e) => update(item.value as any, e.target.value)}
                        className="h-7 text-xs"
                        placeholder={item.placeholder}
                        dir={item.value === 'companyEmail' || item.value === 'companyWebsite' ? 'ltr' : undefined}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* ========== BACKGROUND TAB ========== */}
        <TabsContent value="background" className="space-y-3 mt-0">
          <Card className="border-border/50">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5 text-primary" />صورة الخلفية
                </CardTitle>
                <SectionResetButton onClick={() => resetSection(['backgroundImage', 'backgroundOpacity', 'backgroundScale', 'backgroundPosX', 'backgroundPosY'])} />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-3">
              <div className="grid grid-cols-3 gap-1.5">
                {AVAILABLE_BACKGROUNDS.map(bg => (
                  <div key={bg.id} onClick={() => update('backgroundImage', bg.path)}
                    className={`flex flex-col items-center p-1.5 rounded border cursor-pointer transition-all min-h-[50px]
                      ${settings.backgroundImage === bg.path ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'hover:border-primary/50'}`}
                  >
                    {bg.path ? (
                      <img src={bg.path} alt={bg.name} className="h-7 w-auto" />
                    ) : (
                      <div className="h-7 w-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground">بدون</div>
                    )}
                    <span className="text-[9px] mt-0.5">{bg.name}</span>
                  </div>
                ))}
              </div>
              
              <Input value={settings.backgroundImage} onChange={(e) => update('backgroundImage', e.target.value)} placeholder="أو رابط مخصص" className="h-7 text-xs" />
              
              {settings.backgroundImage && (
                <>
                  <SliderInput label="الشفافية" value={settings.backgroundOpacity} onChange={(v) => update('backgroundOpacity', v)} min={5} max={100} />
                  <SliderInput label="الحجم" value={settings.backgroundScale} onChange={(v) => update('backgroundScale', v)} min={10} max={200} />
                  <div className="grid grid-cols-2 gap-3">
                    <SliderInput label="موضع X" value={settings.backgroundPosX} onChange={(v) => update('backgroundPosX', v)} />
                    <SliderInput label="موضع Y" value={settings.backgroundPosY} onChange={(v) => update('backgroundPosY', v)} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== FOOTER TAB ========== */}
        <TabsContent value="footer" className="space-y-3 mt-0">
          <Card className="border-border/50">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <Layout className="h-3.5 w-3.5 rotate-180 text-primary" />إعدادات الفوتر
                </CardTitle>
                <Switch checked={settings.showFooter} onCheckedChange={(v) => update('showFooter', v)} className="scale-75" />
              </div>
            </CardHeader>
            {settings.showFooter && (
              <CardContent className="px-3 pb-3 space-y-3">
                <Input value={settings.footerText} onChange={(e) => update('footerText', e.target.value)} className="h-7 text-xs" placeholder="نص الفوتر" />
                
                <div className="flex items-center justify-between">
                  <Label className="text-xs">رقم الصفحة</Label>
                  <Switch checked={settings.showPageNumber} onCheckedChange={(v) => update('showPageNumber', v)} className="scale-[0.6]" />
                </div>
                
                <AlignmentSelector label="المحاذاة" value={settings.footerAlignment} onChange={(v) => update('footerAlignment', v)} />
                <SliderInput label="المسافة من الأسفل (مم)" value={settings.footerPosition} onChange={(v) => update('footerPosition', v)} min={5} max={50} />
                
                <div className="grid grid-cols-2 gap-2">
                  <ColorInput label="خلفية الفوتر" value={settings.footerBgColor === 'transparent' ? '#ffffff' : settings.footerBgColor} onChange={(v) => update('footerBgColor', v)} />
                  <ColorInput label="لون النص" value={settings.footerTextColor} onChange={(v) => update('footerTextColor', v)} />
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* ========== SPACING TAB ========== */}
        <TabsContent value="spacing" className="space-y-3 mt-0">
          <Card className="border-border/50">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 text-primary" />هوامش الصفحة (مم)
                </CardTitle>
                <SectionResetButton onClick={() => resetSection([
                  'pageMarginTop', 'pageMarginBottom', 'pageMarginRight', 'pageMarginLeft', 'headerMarginBottom', 'contentBottomSpacing'
                ])} />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SliderInput label="أعلى" value={settings.pageMarginTop} onChange={(v) => update('pageMarginTop', v)} min={5} max={40} />
                <SliderInput label="أسفل" value={settings.pageMarginBottom} onChange={(v) => update('pageMarginBottom', v)} min={5} max={40} />
                <SliderInput label="يمين" value={settings.pageMarginRight} onChange={(v) => update('pageMarginRight', v)} min={5} max={40} />
                <SliderInput label="يسار" value={settings.pageMarginLeft} onChange={(v) => update('pageMarginLeft', v)} min={5} max={40} />
              </div>
              <SliderInput label="مسافة بعد الهيدر" value={settings.headerMarginBottom} onChange={(v) => update('headerMarginBottom', v)} min={5} max={50} />
              <SliderInput label="مسافة آمنة فوق الفوتر" value={settings.contentBottomSpacing} onChange={(v) => update('contentBottomSpacing', v)} min={0} max={60} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
