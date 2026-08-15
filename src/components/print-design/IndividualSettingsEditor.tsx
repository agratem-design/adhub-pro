import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { IndividualInvoiceSettings, AlignmentOption, InvoiceTemplateType, hasSection, DEFAULT_INDIVIDUAL_SETTINGS } from '@/types/invoice-templates';
import { Palette, Table, Type, User, Calculator, FileText, AlignLeft, AlignCenter, AlignRight, CreditCard, Users, Wallet, PenTool, Image, Wrench, BarChart2, ArrowLeftRight, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  settings: IndividualInvoiceSettings;
  onSettingsChange: (settings: IndividualInvoiceSettings) => void;
  templateName: string;
  templateType?: InvoiceTemplateType;
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

const AlignmentSelector = ({ value, onChange, label }: { value: AlignmentOption; onChange: (v: AlignmentOption) => void; label: string; }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <RadioGroup value={value} onValueChange={(v) => onChange(v as AlignmentOption)} className="flex gap-1">
      {['right', 'center', 'left'].map((align) => (
        <div key={align} className="flex items-center">
          <RadioGroupItem value={align} id={`${label}-${align}`} className="sr-only" />
          <Label htmlFor={`${label}-${align}`}
            className={`flex items-center justify-center w-8 h-8 rounded border cursor-pointer transition-colors
              ${value === align ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
            {align === 'right' ? <AlignRight className="h-3 w-3" /> : align === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignLeft className="h-3 w-3" />}
          </Label>
        </div>
      ))}
    </RadioGroup>
  </div>
);

const SectionResetButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive gap-1"
    onClick={onClick}
  >
    <RotateCcw className="h-2.5 w-2.5" />
    إعادة تعيين
  </Button>
);

export function IndividualSettingsEditor({ settings, onSettingsChange, templateName, templateType = 'contract' }: Props) {
  const update = (key: keyof IndividualInvoiceSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const resetSection = (keys: (keyof IndividualInvoiceSettings)[]) => {
    const updated = { ...settings };
    keys.forEach(key => {
      (updated as any)[key] = (DEFAULT_INDIVIDUAL_SETTINGS as any)[key];
    });
    onSettingsChange(updated);
    toast.success('تم إعادة تعيين القسم');
  };

  const hasSec = (section: string) => hasSection(templateType, section as any);

  return (
    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
      {/* Template Name Badge */}
      <div className="text-center py-2 bg-muted/50 rounded-lg">
        <p className="text-sm font-semibold">{templateName}</p>
        <p className="text-[10px] text-muted-foreground">إعدادات خاصة بهذه الفاتورة</p>
      </div>

      {/* عنوان مخصص */}
      <Card className="border-dashed">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium flex items-center gap-1.5">
            <Type className="h-3.5 w-3.5 text-primary" />
            عنوان مخصص
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <Input
            value={settings.customTitleAr ?? ''}
            onChange={(e) => update('customTitleAr', e.target.value)}
            className="h-7 text-xs"
            placeholder="العنوان بالعربي (اتركه فارغاً للافتراضي)"
          />
          <Input
            value={settings.customTitleEn ?? ''}
            onChange={(e) => update('customTitleEn', e.target.value)}
            className="h-7 text-xs"
            placeholder="English title (leave empty for default)"
            dir="ltr"
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="colors" className="w-full">
        <TabsList className="grid grid-cols-4 mb-3 h-8">
          <TabsTrigger value="colors" className="text-[10px] gap-0.5 px-1 h-7"><Palette className="h-3 w-3" />ألوان</TabsTrigger>
          <TabsTrigger value="sections" className="text-[10px] gap-0.5 px-1 h-7"><Eye className="h-3 w-3" />أقسام</TabsTrigger>
          <TabsTrigger value="table" className="text-[10px] gap-0.5 px-1 h-7"><Table className="h-3 w-3" />جدول</TabsTrigger>
          <TabsTrigger value="extras" className="text-[10px] gap-0.5 px-1 h-7"><Calculator className="h-3 w-3" />تفاصيل</TabsTrigger>
        </TabsList>

        {/* ========== COLORS TAB ========== */}
        <TabsContent value="colors" className="space-y-3 mt-0">
          <Accordion type="multiple" defaultValue={['main-colors', 'font-sizes']} className="space-y-2">
            {/* الألوان الرئيسية */}
            <AccordionItem value="main-colors" className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5 text-primary" />الألوان الرئيسية</span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <div className="flex justify-end mb-2">
                  <SectionResetButton label="الألوان" onClick={() => resetSection(['primaryColor', 'secondaryColor', 'accentColor'])} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ColorInput label="اللون الأساسي" value={settings.primaryColor} onChange={(v) => update('primaryColor', v)} />
                  <ColorInput label="اللون الثانوي" value={settings.secondaryColor} onChange={(v) => update('secondaryColor', v)} />
                  <ColorInput label="لون التمييز" value={settings.accentColor} onChange={(v) => update('accentColor', v)} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* أحجام الخطوط */}
            <AccordionItem value="font-sizes" className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                <span className="flex items-center gap-1.5"><Type className="h-3.5 w-3.5 text-green-500" />أحجام الخطوط</span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-3">
                <div className="flex justify-end mb-1">
                  <SectionResetButton label="الخطوط" onClick={() => resetSection(['titleFontSize', 'headerFontSize', 'bodyFontSize'])} />
                </div>
                <SliderInput label="حجم العنوان" value={settings.titleFontSize} onChange={(v) => update('titleFontSize', v)} min={12} max={48} />
                <SliderInput label="حجم الترويسة" value={settings.headerFontSize} onChange={(v) => update('headerFontSize', v)} min={8} max={24} />
                <SliderInput label="حجم النص" value={settings.bodyFontSize} onChange={(v) => update('bodyFontSize', v)} min={8} max={20} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* ========== SECTIONS TAB ========== */}
        <TabsContent value="sections" className="space-y-3 mt-0">
          {/* إظهار/إخفاء الأقسام */}
          <Card className="border-border/50">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-blue-500" />
                  إظهار/إخفاء
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              {[
                { key: 'showHeader', label: 'الهيدر', always: true },
                { key: 'showCustomerSection', label: 'بيانات العميل', sec: 'customer' },
                { key: 'showBillboardsSection', label: 'اللوحات', sec: 'billboards' },
                { key: 'showItemsSection', label: 'العناصر', sec: 'items' },
                { key: 'showServicesSection', label: 'الخدمات', sec: 'services' },
                { key: 'showTransactionsSection', label: 'الحركات المالية', sec: 'transactions' },
                { key: 'showTotalsSection', label: 'المجاميع', sec: 'totals' },
                { key: 'showPaymentInfoSection', label: 'معلومات الدفع', sec: 'payment_info' },
                { key: 'showTeamInfoSection', label: 'معلومات الفريق', sec: 'team_info' },
                { key: 'showCustodyInfoSection', label: 'معلومات العهدة', sec: 'custody_info' },
                { key: 'showBalanceSummarySection', label: 'ملخص الرصيد', sec: 'balance_summary' },
                { key: 'showSignaturesSection', label: 'التوقيعات', sec: 'signatures' },
                { key: 'showNotesSection', label: 'الملاحظات', sec: 'notes' },
              ].filter(item => item.always || (item.sec && hasSec(item.sec)))
                .map(item => (
                  <div key={item.key} className="flex items-center justify-between py-0.5">
                    <Label className="text-xs">{item.label}</Label>
                    <Switch 
                      className="scale-75"
                      checked={(settings as any)[item.key]} 
                      onCheckedChange={(v) => update(item.key as any, v)} 
                    />
                  </div>
                ))
              }
            </CardContent>
          </Card>

          {/* ألوان الأقسام */}
          <Accordion type="single" collapsible className="space-y-2">
            {hasSec('customer') && (
              <AccordionItem value="customer-section" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                  <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-blue-500" />قسم العميل</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex justify-end mb-2">
                    <SectionResetButton label="العميل" onClick={() => resetSection([
                      'customerSectionBgColor', 'customerSectionBorderColor', 'customerSectionTitleColor', 'customerSectionTextColor', 'customerSectionAlignment'
                    ])} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <ColorInput label="الخلفية" value={settings.customerSectionBgColor} onChange={(v) => update('customerSectionBgColor', v)} />
                    <ColorInput label="الحدود" value={settings.customerSectionBorderColor} onChange={(v) => update('customerSectionBorderColor', v)} />
                    <ColorInput label="العنوان" value={settings.customerSectionTitleColor} onChange={(v) => update('customerSectionTitleColor', v)} />
                    <ColorInput label="النص" value={settings.customerSectionTextColor} onChange={(v) => update('customerSectionTextColor', v)} />
                  </div>
                  <AlignmentSelector label="المحاذاة" value={settings.customerSectionAlignment} onChange={(v) => update('customerSectionAlignment', v)} />
                </AccordionContent>
              </AccordionItem>
            )}

            {hasSec('payment_info') && (
              <AccordionItem value="payment-section" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                  <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-green-500" />قسم الدفع</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex justify-end mb-2">
                    <SectionResetButton label="الدفع" onClick={() => resetSection([
                      'paymentSectionBgColor', 'paymentSectionBorderColor', 'paymentSectionTitleColor', 'paymentSectionTextColor'
                    ])} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="الخلفية" value={settings.paymentSectionBgColor} onChange={(v) => update('paymentSectionBgColor', v)} />
                    <ColorInput label="الحدود" value={settings.paymentSectionBorderColor} onChange={(v) => update('paymentSectionBorderColor', v)} />
                    <ColorInput label="العنوان" value={settings.paymentSectionTitleColor} onChange={(v) => update('paymentSectionTitleColor', v)} />
                    <ColorInput label="النص" value={settings.paymentSectionTextColor} onChange={(v) => update('paymentSectionTextColor', v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {hasSec('team_info') && (
              <AccordionItem value="team-section" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-purple-500" />قسم الفريق</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex justify-end mb-2">
                    <SectionResetButton label="الفريق" onClick={() => resetSection([
                      'teamSectionBgColor', 'teamSectionBorderColor', 'teamSectionTitleColor', 'teamSectionTextColor'
                    ])} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="الخلفية" value={settings.teamSectionBgColor} onChange={(v) => update('teamSectionBgColor', v)} />
                    <ColorInput label="الحدود" value={settings.teamSectionBorderColor} onChange={(v) => update('teamSectionBorderColor', v)} />
                    <ColorInput label="العنوان" value={settings.teamSectionTitleColor} onChange={(v) => update('teamSectionTitleColor', v)} />
                    <ColorInput label="النص" value={settings.teamSectionTextColor} onChange={(v) => update('teamSectionTextColor', v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {hasSec('custody_info') && (
              <AccordionItem value="custody-section" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                  <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-orange-500" />قسم العهدة</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex justify-end mb-2">
                    <SectionResetButton label="العهدة" onClick={() => resetSection([
                      'custodySectionBgColor', 'custodySectionBorderColor', 'custodySectionTitleColor', 'custodySectionTextColor'
                    ])} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="الخلفية" value={settings.custodySectionBgColor} onChange={(v) => update('custodySectionBgColor', v)} />
                    <ColorInput label="الحدود" value={settings.custodySectionBorderColor} onChange={(v) => update('custodySectionBorderColor', v)} />
                    <ColorInput label="العنوان" value={settings.custodySectionTitleColor} onChange={(v) => update('custodySectionTitleColor', v)} />
                    <ColorInput label="النص" value={settings.custodySectionTextColor} onChange={(v) => update('custodySectionTextColor', v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {hasSec('balance_summary') && (
              <AccordionItem value="balance-section" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                  <span className="flex items-center gap-1.5"><BarChart2 className="h-3.5 w-3.5 text-cyan-500" />ملخص الرصيد</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex justify-end mb-2">
                    <SectionResetButton label="الرصيد" onClick={() => resetSection([
                      'balanceSummaryBgColor', 'balanceSummaryBorderColor', 'balanceSummaryTitleColor', 'balanceSummaryTextColor',
                      'balanceSummaryPositiveColor', 'balanceSummaryNegativeColor'
                    ])} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="الخلفية" value={settings.balanceSummaryBgColor} onChange={(v) => update('balanceSummaryBgColor', v)} />
                    <ColorInput label="الحدود" value={settings.balanceSummaryBorderColor} onChange={(v) => update('balanceSummaryBorderColor', v)} />
                    <ColorInput label="العنوان" value={settings.balanceSummaryTitleColor} onChange={(v) => update('balanceSummaryTitleColor', v)} />
                    <ColorInput label="النص" value={settings.balanceSummaryTextColor} onChange={(v) => update('balanceSummaryTextColor', v)} />
                    <ColorInput label="لون الموجب" value={settings.balanceSummaryPositiveColor} onChange={(v) => update('balanceSummaryPositiveColor', v)} />
                    <ColorInput label="لون السالب" value={settings.balanceSummaryNegativeColor} onChange={(v) => update('balanceSummaryNegativeColor', v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {hasSec('transactions') && (
              <AccordionItem value="transactions-section" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                  <span className="flex items-center gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5 text-indigo-500" />الحركات المالية</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex justify-end mb-2">
                    <SectionResetButton label="الحركات" onClick={() => resetSection([
                      'transactionsSectionBgColor', 'transactionsSectionBorderColor', 'transactionsSectionTitleColor', 'transactionsSectionTextColor'
                    ])} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="الخلفية" value={settings.transactionsSectionBgColor} onChange={(v) => update('transactionsSectionBgColor', v)} />
                    <ColorInput label="الحدود" value={settings.transactionsSectionBorderColor} onChange={(v) => update('transactionsSectionBorderColor', v)} />
                    <ColorInput label="العنوان" value={settings.transactionsSectionTitleColor} onChange={(v) => update('transactionsSectionTitleColor', v)} />
                    <ColorInput label="النص" value={settings.transactionsSectionTextColor} onChange={(v) => update('transactionsSectionTextColor', v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </TabsContent>

        {/* ========== TABLE TAB ========== */}
        <TabsContent value="table" className="space-y-3 mt-0">
          <Accordion type="multiple" defaultValue={['table-colors']} className="space-y-2">
            {/* ألوان الجدول */}
            <AccordionItem value="table-colors" className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5 text-primary" />ألوان الجدول</span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <div className="flex justify-end mb-2">
                  <SectionResetButton label="ألوان الجدول" onClick={() => resetSection([
                    'tableBorderColor', 'tableHeaderBgColor', 'tableHeaderTextColor', 'tableTextColor', 'tableRowEvenColor', 'tableRowOddColor', 'tableRowOpacity'
                  ])} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ColorInput label="الحدود" value={settings.tableBorderColor} onChange={(v) => update('tableBorderColor', v)} />
                  <ColorInput label="خلفية الترويسة" value={settings.tableHeaderBgColor} onChange={(v) => update('tableHeaderBgColor', v)} />
                  <ColorInput label="نص الترويسة" value={settings.tableHeaderTextColor} onChange={(v) => update('tableHeaderTextColor', v)} />
                  <ColorInput label="لون النص" value={settings.tableTextColor} onChange={(v) => update('tableTextColor', v)} />
                  <ColorInput label="صف زوجي" value={settings.tableRowEvenColor} onChange={(v) => update('tableRowEvenColor', v)} />
                  <ColorInput label="صف فردي" value={settings.tableRowOddColor} onChange={(v) => update('tableRowOddColor', v)} />
                </div>
                <div className="mt-3">
                  <SliderInput label="شفافية الصفوف" value={settings.tableRowOpacity} onChange={(v) => update('tableRowOpacity', v)} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* خصائص ترويسة الجدول */}
            <AccordionItem value="table-header" className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                <span className="flex items-center gap-1.5"><Table className="h-3.5 w-3.5 text-blue-500" />ترويسة الجدول</span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-3">
                <div className="flex justify-end mb-1">
                  <SectionResetButton label="ترويسة الجدول" onClick={() => resetSection([
                    'tableHeaderFontSize', 'tableHeaderFontWeight', 'tableHeaderPadding'
                  ])} />
                </div>
                <SliderInput label="حجم خط الترويسة" value={settings.tableHeaderFontSize ?? 12} onChange={(v) => update('tableHeaderFontSize', v)} min={8} max={20} />
                <div className="space-y-1.5">
                  <Label className="text-xs">وزن الخط</Label>
                  <Select value={settings.tableHeaderFontWeight ?? 'bold'} onValueChange={(v) => update('tableHeaderFontWeight', v)}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">عادي</SelectItem>
                      <SelectItem value="500">متوسط</SelectItem>
                      <SelectItem value="600">شبه سميك</SelectItem>
                      <SelectItem value="bold">سميك</SelectItem>
                      <SelectItem value="800">سميك جداً</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">padding الترويسة</Label>
                  <Input value={settings.tableHeaderPadding ?? '12px 8px'} onChange={(e) => update('tableHeaderPadding', e.target.value)} className="h-7 text-xs" placeholder="12px 8px" dir="ltr" />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* خصائص جسم الجدول */}
            <AccordionItem value="table-body" className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-green-500" />صفوف الجدول</span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-3">
                <div className="flex justify-end mb-1">
                  <SectionResetButton label="صفوف الجدول" onClick={() => resetSection([
                    'tableBodyFontSize', 'tableBodyPadding', 'tableLineHeight', 'tableColumnMinWidth'
                  ])} />
                </div>
                <SliderInput label="حجم خط الصفوف" value={settings.tableBodyFontSize ?? 12} onChange={(v) => update('tableBodyFontSize', v)} min={8} max={20} />
                <div className="space-y-1.5">
                  <Label className="text-xs">padding الصفوف</Label>
                  <Input value={settings.tableBodyPadding ?? '12px 8px'} onChange={(e) => update('tableBodyPadding', e.target.value)} className="h-7 text-xs" placeholder="12px 8px" dir="ltr" />
                </div>
                <SliderInput label="ارتفاع السطر" value={Math.round((settings.tableLineHeight ?? 1.4) * 10)} onChange={(v) => update('tableLineHeight', v / 10)} min={10} max={25} />
                <SliderInput label="أقل عرض للعمود (px)" value={settings.tableColumnMinWidth ?? 40} onChange={(v) => update('tableColumnMinWidth', v)} min={20} max={120} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* ========== EXTRAS TAB ========== */}
        <TabsContent value="extras" className="space-y-3 mt-0">
          <Accordion type="multiple" defaultValue={['totals-section']} className="space-y-2">
            {hasSec('totals') && (
              <AccordionItem value="totals-section" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                  <span className="flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5 text-primary" />المجاميع</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex justify-end mb-2">
                    <SectionResetButton label="المجاميع" onClick={() => resetSection([
                      'subtotalBgColor', 'subtotalTextColor', 'discountTextColor', 'totalBgColor', 'totalTextColor', 'totalsAlignment'
                    ])} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <ColorInput label="خلفية الفرعي" value={settings.subtotalBgColor} onChange={(v) => update('subtotalBgColor', v)} />
                    <ColorInput label="نص الفرعي" value={settings.subtotalTextColor} onChange={(v) => update('subtotalTextColor', v)} />
                    <ColorInput label="لون الخصم" value={settings.discountTextColor} onChange={(v) => update('discountTextColor', v)} />
                    <ColorInput label="خلفية الإجمالي" value={settings.totalBgColor} onChange={(v) => update('totalBgColor', v)} />
                    <ColorInput label="نص الإجمالي" value={settings.totalTextColor} onChange={(v) => update('totalTextColor', v)} />
                  </div>
                  <AlignmentSelector label="محاذاة المجاميع" value={settings.totalsAlignment} onChange={(v) => update('totalsAlignment', v)} />
                </AccordionContent>
              </AccordionItem>
            )}

            {hasSec('notes') && (
              <AccordionItem value="notes-section" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                  <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-amber-500" />الملاحظات</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex justify-end mb-2">
                    <SectionResetButton label="الملاحظات" onClick={() => resetSection([
                      'notesBgColor', 'notesTextColor', 'notesBorderColor', 'notesAlignment'
                    ])} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <ColorInput label="الخلفية" value={settings.notesBgColor} onChange={(v) => update('notesBgColor', v)} />
                    <ColorInput label="النص" value={settings.notesTextColor} onChange={(v) => update('notesTextColor', v)} />
                    <ColorInput label="الحدود" value={settings.notesBorderColor} onChange={(v) => update('notesBorderColor', v)} />
                  </div>
                  <AlignmentSelector label="المحاذاة" value={settings.notesAlignment} onChange={(v) => update('notesAlignment', v)} />
                </AccordionContent>
              </AccordionItem>
            )}

            {hasSec('signatures') && (
              <AccordionItem value="signatures-section" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                  <span className="flex items-center gap-1.5"><PenTool className="h-3.5 w-3.5 text-gray-500" />التوقيعات</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex justify-end mb-2">
                    <SectionResetButton label="التوقيعات" onClick={() => resetSection([
                      'signaturesSectionBgColor', 'signaturesSectionBorderColor', 'signaturesSectionTextColor', 'signatureLineColor'
                    ])} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="الخلفية" value={settings.signaturesSectionBgColor} onChange={(v) => update('signaturesSectionBgColor', v)} />
                    <ColorInput label="الحدود" value={settings.signaturesSectionBorderColor} onChange={(v) => update('signaturesSectionBorderColor', v)} />
                    <ColorInput label="النص" value={settings.signaturesSectionTextColor} onChange={(v) => update('signaturesSectionTextColor', v)} />
                    <ColorInput label="خط التوقيع" value={settings.signatureLineColor} onChange={(v) => update('signatureLineColor', v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {hasSec('billboards') && (
              <AccordionItem value="billboards-section" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                  <span className="flex items-center gap-1.5"><Image className="h-3.5 w-3.5 text-teal-500" />قسم اللوحات</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex justify-end mb-2">
                    <SectionResetButton label="اللوحات" onClick={() => resetSection([
                      'billboardsSectionBgColor', 'billboardsSectionBorderColor', 'billboardsSectionTitleColor'
                    ])} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="الخلفية" value={settings.billboardsSectionBgColor} onChange={(v) => update('billboardsSectionBgColor', v)} />
                    <ColorInput label="الحدود" value={settings.billboardsSectionBorderColor} onChange={(v) => update('billboardsSectionBorderColor', v)} />
                    <ColorInput label="لون العنوان" value={settings.billboardsSectionTitleColor} onChange={(v) => update('billboardsSectionTitleColor', v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {hasSec('services') && (
              <AccordionItem value="services-section" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline [&[data-state=open]]:bg-muted/50">
                  <span className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-rose-500" />قسم الخدمات</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="flex justify-end mb-2">
                    <SectionResetButton label="الخدمات" onClick={() => resetSection([
                      'servicesSectionBgColor', 'servicesSectionBorderColor', 'servicesSectionTitleColor'
                    ])} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="الخلفية" value={settings.servicesSectionBgColor} onChange={(v) => update('servicesSectionBgColor', v)} />
                    <ColorInput label="الحدود" value={settings.servicesSectionBorderColor} onChange={(v) => update('servicesSectionBorderColor', v)} />
                    <ColorInput label="لون العنوان" value={settings.servicesSectionTitleColor} onChange={(v) => update('servicesSectionTitleColor', v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
}
