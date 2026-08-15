import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Type, Save, RotateCcw, Eye, ZoomIn, ZoomOut, Maximize2, FileText, ChevronDown, Check, Loader2, Sparkles } from 'lucide-react';

import { useSiteTheme, type SiteThemeSettings } from '@/hooks/useSiteTheme';
import { usePrintSettings } from '@/store';
import { PrintEnginePreview } from '@/components/print-design/PrintEnginePreview';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_INFO, DocumentType } from '@/types/document-types';
import { PrintSettings } from '@/types/print-settings';
import { invalidateBrandingCache } from '@/hooks/useBranding';
import { invalidateThemeCache } from '@/components/AppThemeLoader';
import { toast } from 'sonner';

const AVAILABLE_FONTS = [
  { name: 'Doran', label: 'دوران (Doran)' },
  { name: 'Cairo', label: 'القاهرة (Cairo)' },
  { name: 'Tajawal', label: 'تجوال (Tajawal)' },
  { name: 'Amiri', label: 'أميري (Amiri)' },
  { name: 'Manrope', label: 'مانروب (Manrope)' },
];

const PREVIEW_DOC_TYPES = [
  { value: DOCUMENT_TYPES.CUSTOMER_INVOICE, label: 'فاتورة عميل' },
  { value: DOCUMENT_TYPES.PAYMENT_RECEIPT, label: 'إيصال دفع' },
  { value: DOCUMENT_TYPES.ACCOUNT_STATEMENT, label: 'كشف حساب' },
  { value: DOCUMENT_TYPES.COMBINED_TASK, label: 'مهمة مجمعة' },
];

export default function FontSettings() {
  // --- Site UI Font Settings State ---
  const { 
    theme: siteTheme, 
    loading: siteLoading, 
    saving: siteSaving, 
    updateThemeSetting, 
    saveTheme,
    refetch: refetchSiteTheme
  } = useSiteTheme();
  
  const [selectedSiteFont, setSelectedSiteFont] = useState<string>('Doran');

  useEffect(() => {
    if (siteTheme?.site_font_family) {
      setSelectedSiteFont(siteTheme.site_font_family);
    }
  }, [siteTheme]);

  const handleSaveSiteFont = async () => {
    const success = await saveTheme({ site_font_family: selectedSiteFont });
    if (success) {
      invalidateBrandingCache();
      invalidateThemeCache();
      // Apply body font immediately
      document.body.style.fontFamily = `'${selectedSiteFont}', 'Cairo', 'Tajawal', sans-serif`;
      document.documentElement.style.setProperty('--app-font-family', `'${selectedSiteFont}', 'Cairo', 'Tajawal', sans-serif`);
    }
  };

  // --- Print Invoice Font Settings State ---
  const { 
    state: printState, 
    saveGlobalToAll 
  } = usePrintSettings();

  const [printFontFamily, setPrintFontFamily] = useState<string>('Doran');
  const [titleFontSize, setTitleFontSize] = useState<number>(24);
  const [headerFontSize, setHeaderFontSize] = useState<number>(14);
  const [bodyFontSize, setBodyFontSize] = useState<number>(12);
  const [invoiceTitleArFontSize, setInvoiceTitleArFontSize] = useState<number>(18);
  const [invoiceTitleEnFontSize, setInvoiceTitleEnFontSize] = useState<number>(22);
  const [customerNameFontSize, setCustomerNameFontSize] = useState<number>(20);
  const [statValueFontSize, setStatValueFontSize] = useState<number>(28);
  const [tableHeaderFontSize, setTableHeaderFontSize] = useState<number>(10);
  const [tableBodyFontSize, setTableBodyFontSize] = useState<number>(10);
  const [totalsTitleFontSize, setTotalsTitleFontSize] = useState<number>(14);
  const [totalsValueFontSize, setTotalsValueFontSize] = useState<number>(16);

  const [savingPrint, setSavingPrint] = useState(false);
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<DocumentType>(DOCUMENT_TYPES.CUSTOMER_INVOICE);
  const [previewZoom, setPreviewZoom] = useState<number>(0.5);

  // Sync state from shared defaults on load
  useEffect(() => {
    if (printState?.sharedDefaults) {
      const defaults = printState.sharedDefaults;
      setPrintFontFamily(defaults.font_family || 'Doran');
      setTitleFontSize(defaults.title_font_size || 24);
      setHeaderFontSize(defaults.header_font_size || 14);
      setBodyFontSize(defaults.body_font_size || 12);
      setInvoiceTitleArFontSize(defaults.invoice_title_ar_font_size || 18);
      setInvoiceTitleEnFontSize(defaults.invoice_title_en_font_size || 22);
      setCustomerNameFontSize(defaults.customer_name_font_size || 20);
      setStatValueFontSize(defaults.stat_value_font_size || 28);
      setTableHeaderFontSize(defaults.table_header_font_size || 10);
      setTableBodyFontSize(defaults.table_body_font_size || 10);
      setTotalsTitleFontSize(defaults.totals_title_font_size || 14);
      setTotalsValueFontSize(defaults.totals_value_font_size || 16);
    }
  }, [printState?.sharedDefaults]);

  const handleSavePrintFonts = async () => {
    try {
      setSavingPrint(true);
      const changes: Partial<PrintSettings> = {
        font_family: printFontFamily,
        title_font_size: titleFontSize,
        header_font_size: headerFontSize,
        body_font_size: bodyFontSize,
        invoice_title_ar_font_size: invoiceTitleArFontSize,
        invoice_title_en_font_size: invoiceTitleEnFontSize,
        customer_name_font_size: customerNameFontSize,
        stat_value_font_size: statValueFontSize,
        table_header_font_size: tableHeaderFontSize,
        table_body_font_size: tableBodyFontSize,
        totals_title_font_size: totalsTitleFontSize,
        totals_value_font_size: totalsValueFontSize,
      };

      const success = await saveGlobalToAll(changes);
      if (success) {
        toast.success('تم حفظ خطوط وأحجام الطباعة وتعميمها بنجاح');
      } else {
        toast.error('فشل في حفظ إعدادات خطوط الطباعة');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ إعدادات الطباعة');
    } finally {
      setSavingPrint(false);
    }
  };

  const handleResetPrintFonts = () => {
    setPrintFontFamily('Doran');
    setTitleFontSize(24);
    setHeaderFontSize(14);
    setBodyFontSize(12);
    setInvoiceTitleArFontSize(18);
    setInvoiceTitleEnFontSize(22);
    setCustomerNameFontSize(20);
    setStatValueFontSize(28);
    setTableHeaderFontSize(10);
    setTableBodyFontSize(10);
    setTotalsTitleFontSize(14);
    setTotalsValueFontSize(16);
    toast.success('تمت إعادة تعيين القيم المحلّية (تذكر الضغط على حفظ لتعميمها)');
  };

  // Build temporary PrintSettings object for the PrintEnginePreview
  const currentPrintSettings = {
    ...printState?.sharedDefaults,
    font_family: printFontFamily,
    title_font_size: titleFontSize,
    header_font_size: headerFontSize,
    body_font_size: bodyFontSize,
    invoice_title_ar_font_size: invoiceTitleArFontSize,
    invoice_title_en_font_size: invoiceTitleEnFontSize,
    customer_name_font_size: customerNameFontSize,
    stat_value_font_size: statValueFontSize,
    table_header_font_size: tableHeaderFontSize,
    table_body_font_size: tableBodyFontSize,
    totals_title_font_size: totalsTitleFontSize,
    totals_value_font_size: totalsValueFontSize,
  };

  const isGlobalLoading = siteLoading || printState?.isLoading;

  if (isGlobalLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Type className="h-8 w-8 text-primary" />
            إعدادات الخطوط
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            إدارة وتخصيص خطوط واجهة الموقع وعناصر الخطوط والأحجام الموحدة لطباعة الفواتير والكشوفات.
          </p>
        </div>
      </div>

      <Tabs defaultValue="site-fonts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
          <TabsTrigger value="site-fonts" className="gap-2">
            <Sparkles className="h-4 w-4" />
            خط واجهة الموقع
          </TabsTrigger>
          <TabsTrigger value="print-fonts" className="gap-2">
            <FileText className="h-4 w-4" />
            خطوط فواتير الطباعة
          </TabsTrigger>
        </TabsList>

        {/* ========================================================
            TAB 1: SITE UI FONT SETTINGS
           ======================================================== */}
        <TabsContent value="site-fonts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Control Panel */}
            <Card className="lg:col-span-5 shadow-luxury border-primary/10">
              <CardHeader>
                <CardTitle className="text-xl">تخصيص خط الموقع</CardTitle>
                <CardDescription>اختر الخط المعتمد لعرض جميع نصوص وعناصر واجهة المستخدم.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2.5">
                  <Label htmlFor="site-font-select" className="text-sm font-medium">خط الواجهة الأساسي</Label>
                  <Select value={selectedSiteFont} onValueChange={setSelectedSiteFont}>
                    <SelectTrigger id="site-font-select" className="h-10 text-sm">
                      <SelectValue placeholder="اختر الخط" />
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
 يمكنك رؤية التغيير فوراً في لوحة المعاينة المجاورة. اضغط على حفظ لتطبيقه نهائياً.
                  </p>
                </div>

                <Separator />

                <div className="flex gap-3 justify-end pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      if (siteTheme?.site_font_family) {
                        setSelectedSiteFont(siteTheme.site_font_family);
                      }
                      toast.info('تم التراجع عن التعديلات غير المحفوظة');
                    }}
                    disabled={siteSaving}
                  >
                    <RotateCcw className="h-4 w-4 ml-2" />
                    تراجع
                  </Button>
                  <Button onClick={handleSaveSiteFont} disabled={siteSaving}>
                    {siteSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                        جاري الحفظ...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 ml-2" />
                        حفظ التغييرات
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview Panel */}
            <Card className="lg:col-span-7 bg-muted/20 border-dashed">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  معاينة حية لخط الموقع
                </CardTitle>
                <CardDescription>
                  تعرض هذه اللوحة شكل نصوص القوائم والأزرار والجداول بالخط المختار حالياً.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div 
                  className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-300"
                  style={{ fontFamily: `'${selectedSiteFont}', 'Cairo', 'Tajawal', sans-serif` }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">لوحة تحكم إدارة الإعلانات</h3>
                    <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold">نشط حالياً</Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                    هذا النص يمثل محاكاة للخط المختار. يمكنك قراءة الأرقام والرموز وتوزيع الحروف العربية والإنجليزية بشكل متناسق في كامل أجزاء النظام.
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="p-3 bg-muted/40 rounded-lg border">
                      <span className="text-xs text-muted-foreground block">إجمالي المبيعات</span>
                      <span className="text-xl font-bold mt-1 block">473,400 د.ل</span>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg border">
                      <span className="text-xs text-muted-foreground block">تاريخ اليوم</span>
                      <span className="text-sm font-medium mt-1 block">07 يونيو 2026</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button size="sm">زر رئيسي</Button>
                    <Button size="sm" variant="outline">زر ثنائي</Button>
                    <Input placeholder="حقل إدخال تجريبي" className="h-9 max-w-xs" disabled />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========================================================
            TAB 2: PRINT & INVOICES FONT SETTINGS
           ======================================================== */}
        <TabsContent value="print-fonts" className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Control Panel (Sliders) */}
            <div className="w-full lg:w-5/12 space-y-6">
              <Card className="shadow-luxury border-primary/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">تنسيق خطوط الطباعة</CardTitle>
                      <CardDescription>تعديل حجم خطوط المستندات والفواتير الموحدة.</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleResetPrintFonts} className="text-muted-foreground hover:text-destructive h-8 text-xs">
                      <RotateCcw className="h-3 w-3 ml-1" />
                      إعادة الافتراضي
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Print Font Family Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-foreground">نوع خط الطباعة</Label>
                    <Select value={printFontFamily} onValueChange={setPrintFontFamily}>
                      <SelectTrigger className="h-9 text-xs">
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
                  </div>

                  <Separator />

                  {/* General Sizes */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      أحجام الخطوط العامة للمستند
                    </h4>
                    
                    <div className="space-y-3.5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">حجم العنوان الرئيسي: {titleFontSize}px</Label>
                        </div>
                        <Slider value={[titleFontSize]} onValueChange={([v]) => setTitleFontSize(v)} min={14} max={36} step={1} />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">حجم خط الترويسة: {headerFontSize}px</Label>
                        </div>
                        <Slider value={[headerFontSize]} onValueChange={([v]) => setHeaderFontSize(v)} min={10} max={24} step={1} />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">حجم نص المحتوى العام: {bodyFontSize}px</Label>
                        </div>
                        <Slider value={[bodyFontSize]} onValueChange={([v]) => setBodyFontSize(v)} min={8} max={18} step={1} />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Invoice Header details */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      عناوين الفاتورة والعملاء
                    </h4>

                    <div className="space-y-3.5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">عنوان الفاتورة (العربي): {invoiceTitleArFontSize}px</Label>
                        </div>
                        <Slider value={[invoiceTitleArFontSize]} onValueChange={([v]) => setInvoiceTitleArFontSize(v)} min={12} max={32} step={1} />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">عنوان الفاتورة (الإنجليزي): {invoiceTitleEnFontSize}px</Label>
                        </div>
                        <Slider value={[invoiceTitleEnFontSize]} onValueChange={([v]) => setInvoiceTitleEnFontSize(v)} min={12} max={36} step={1} />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">اسم العميل: {customerNameFontSize}px</Label>
                        </div>
                        <Slider value={[customerNameFontSize]} onValueChange={([v]) => setCustomerNameFontSize(v)} min={12} max={30} step={1} />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">قيم الإحصائيات والأرقام الكبيرة: {statValueFontSize}px</Label>
                        </div>
                        <Slider value={[statValueFontSize]} onValueChange={([v]) => setStatValueFontSize(v)} min={16} max={40} step={1} />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Table & Totals Box */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      خطوط الجدول وصندوق الإجماليات
                    </h4>

                    <div className="space-y-3.5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">رأس الجدول (الترويسة): {tableHeaderFontSize}px</Label>
                        </div>
                        <Slider value={[tableHeaderFontSize]} onValueChange={([v]) => setTableHeaderFontSize(v)} min={7} max={18} step={1} />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">محتوى الجدول (الصفوف): {tableBodyFontSize}px</Label>
                        </div>
                        <Slider value={[tableBodyFontSize]} onValueChange={([v]) => setTableBodyFontSize(v)} min={7} max={18} step={1} />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">عنوان حقل الإجماليات: {totalsTitleFontSize}px</Label>
                        </div>
                        <Slider value={[totalsTitleFontSize]} onValueChange={([v]) => setTotalsTitleFontSize(v)} min={8} max={24} step={1} />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs">قيمة حقل الإجماليات: {totalsValueFontSize}px</Label>
                        </div>
                        <Slider value={[totalsValueFontSize]} onValueChange={([v]) => setTotalsValueFontSize(v)} min={8} max={28} step={1} />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-3 justify-end pt-2">
                    <Button onClick={handleSavePrintFonts} disabled={savingPrint} className="w-full">
                      {savingPrint ? (
                        <>
                          <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                          جاري حفظ وتعميم الخطوط...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 ml-2" />
                          حفظ وتعميم خطوط الطباعة
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Print Preview Panel */}
            <div className="w-full lg:w-7/12">
              <Card className="sticky top-4">
                <CardHeader className="pb-2 pt-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      معاينة حية للمستند المطبوع
                    </CardTitle>
                    {/* Document Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">نوع المستند المعاين:</span>
                      <Select value={selectedPreviewDoc} onValueChange={(v) => setSelectedPreviewDoc(v as DocumentType)}>
                        <SelectTrigger className="h-7 text-xs w-[140px] px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PREVIEW_DOC_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative p-0 overflow-hidden bg-muted/10 rounded-b-xl">
                  {/* Floating Zoom Control */}
                  <div className="absolute top-3 right-3 z-10 bg-background/90 backdrop-blur border shadow rounded-full px-2 py-1 flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewZoom(Math.max(0.3, previewZoom - 0.05))} disabled={previewZoom <= 0.3}>
                      <ZoomOut className="h-3 w-3" />
                    </Button>
                    <div className="w-16">
                      <Slider value={[previewZoom]} onValueChange={([v]) => setPreviewZoom(v)} min={0.3} max={0.8} step={0.05} className="cursor-pointer" />
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewZoom(Math.min(0.8, previewZoom + 0.05))} disabled={previewZoom >= 0.8}>
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground min-w-[28px] text-center font-mono">{Math.round(previewZoom * 100)}%</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewZoom(0.5)} title="إعادة تعيين الزووم">
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="p-4" style={{ height: '700px', overflowY: 'auto' }}>
                    <PrintEnginePreview 
                      settings={currentPrintSettings} 
                      documentType={selectedPreviewDoc} 
                      zoom={previewZoom} 
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
