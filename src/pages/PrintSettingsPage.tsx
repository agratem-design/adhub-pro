import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  RotateCcw,
  Palette,
  Layout,
  Type,
  FileText,
  Building2,
  Image as ImageIcon,
  Eye,
  Table,
  User,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Calculator,
  StickyNote,
  ArrowLeftRight,
  Users,
  Upload,
  Trash2,
  Download,
  BookmarkCheck,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_INFO, DOCUMENT_CATEGORIES, DocumentType, getAllDocumentTypes, getDocumentsByCategory } from "@/types/document-types";
import { DEFAULT_PRINT_SETTINGS, PrintSettings, HEADER_STYLES, HeaderStyleType, LOGO_SIZES, LogoSizeType, AlignmentType, HeaderAlignmentType, HeaderDirectionType } from "@/types/print-settings";
import { usePrintSettings, usePrintSettingsByType } from "@/store";
import { PrintEnginePreview } from "@/components/print-design/PrintEnginePreview";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/services/imageUploadService";

// =====================================================
// الخطوط والشعارات والتنسيقات
// =====================================================

const AVAILABLE_FONTS = [
  { name: "Doran", label: "دوران" },
  { name: "Manrope", label: "مانروب" },
  { name: "Cairo", label: "القاهرة" },
  { name: "Tajawal", label: "تجوال" },
  { name: "Amiri", label: "أميري" },
];

const AVAILABLE_LOGOS = [
  "/logofaresgold.svg",
  "/logofares2.svg",
  "/logofaresgold.svg",
  "/logo-symbol.svg",
  "/logo-text.svg",
  "/new-logo.svg",
];

const DATE_FORMATS = [
  { value: "ar-LY", label: "عربي (ليبيا)" },
  { value: "ar-SA", label: "عربي (السعودية)" },
  { value: "en-US", label: "إنجليزي (أمريكي)" },
  { value: "en-GB", label: "إنجليزي (بريطاني)" },
];

// =====================================================
// أنماط ألوان جاهزة
// =====================================================

interface ColorPreset {
  name: string;
  emoji: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  header_bg_color: string;
  header_text_color: string;
  table_header_bg_color: string;
  table_header_text_color: string;
  table_border_color: string;
  table_row_even_color: string;
  table_row_odd_color: string;
  customer_section_bg_color: string;
  customer_section_border_color: string;
  totals_box_border_color: string;
  summary_border_color: string;
}

const COLOR_PRESETS: ColorPreset[] = [
  {
    name: 'ذهبي كلاسيكي',
 emoji: '',
    primary_color: '#D4AF37',
    secondary_color: '#1a1a2e',
    accent_color: '#f0e6d2',
    header_bg_color: '#D4AF37',
    header_text_color: '#ffffff',
    table_header_bg_color: '#D4AF37',
    table_header_text_color: '#ffffff',
    table_border_color: '#e5e5e5',
    table_row_even_color: '#fdf8ed',
    table_row_odd_color: '#ffffff',
    customer_section_bg_color: '#fdf8ed',
    customer_section_border_color: '#D4AF37',
    totals_box_border_color: '#D4AF37',
    summary_border_color: '#D4AF37',
  },
  {
    name: 'أزرق احترافي',
 emoji: '',
    primary_color: '#2563eb',
    secondary_color: '#1e293b',
    accent_color: '#eff6ff',
    header_bg_color: '#2563eb',
    header_text_color: '#ffffff',
    table_header_bg_color: '#2563eb',
    table_header_text_color: '#ffffff',
    table_border_color: '#dbeafe',
    table_row_even_color: '#eff6ff',
    table_row_odd_color: '#ffffff',
    customer_section_bg_color: '#eff6ff',
    customer_section_border_color: '#2563eb',
    totals_box_border_color: '#2563eb',
    summary_border_color: '#2563eb',
  },
  {
    name: 'أخضر زمردي',
 emoji: '',
    primary_color: '#059669',
    secondary_color: '#064e3b',
    accent_color: '#ecfdf5',
    header_bg_color: '#059669',
    header_text_color: '#ffffff',
    table_header_bg_color: '#059669',
    table_header_text_color: '#ffffff',
    table_border_color: '#d1fae5',
    table_row_even_color: '#ecfdf5',
    table_row_odd_color: '#ffffff',
    customer_section_bg_color: '#ecfdf5',
    customer_section_border_color: '#059669',
    totals_box_border_color: '#059669',
    summary_border_color: '#059669',
  },
  {
    name: 'أحمر أنيق',
 emoji: '',
    primary_color: '#dc2626',
    secondary_color: '#1c1917',
    accent_color: '#fef2f2',
    header_bg_color: '#dc2626',
    header_text_color: '#ffffff',
    table_header_bg_color: '#dc2626',
    table_header_text_color: '#ffffff',
    table_border_color: '#fecaca',
    table_row_even_color: '#fef2f2',
    table_row_odd_color: '#ffffff',
    customer_section_bg_color: '#fef2f2',
    customer_section_border_color: '#dc2626',
    totals_box_border_color: '#dc2626',
    summary_border_color: '#dc2626',
  },
  {
    name: 'بنفسجي ملكي',
 emoji: '',
    primary_color: '#7c3aed',
    secondary_color: '#1e1b4b',
    accent_color: '#f5f3ff',
    header_bg_color: '#7c3aed',
    header_text_color: '#ffffff',
    table_header_bg_color: '#7c3aed',
    table_header_text_color: '#ffffff',
    table_border_color: '#e9d5ff',
    table_row_even_color: '#f5f3ff',
    table_row_odd_color: '#ffffff',
    customer_section_bg_color: '#f5f3ff',
    customer_section_border_color: '#7c3aed',
    totals_box_border_color: '#7c3aed',
    summary_border_color: '#7c3aed',
  },
  {
    name: 'داكن فاخر',
 emoji: '',
    primary_color: '#374151',
    secondary_color: '#111827',
    accent_color: '#f3f4f6',
    header_bg_color: '#1f2937',
    header_text_color: '#ffffff',
    table_header_bg_color: '#374151',
    table_header_text_color: '#ffffff',
    table_border_color: '#d1d5db',
    table_row_even_color: '#f9fafb',
    table_row_odd_color: '#ffffff',
    customer_section_bg_color: '#f3f4f6',
    customer_section_border_color: '#374151',
    totals_box_border_color: '#374151',
    summary_border_color: '#374151',
  },
  {
    name: 'برتقالي دافئ',
 emoji: '',
    primary_color: '#ea580c',
    secondary_color: '#431407',
    accent_color: '#fff7ed',
    header_bg_color: '#ea580c',
    header_text_color: '#ffffff',
    table_header_bg_color: '#ea580c',
    table_header_text_color: '#ffffff',
    table_border_color: '#fed7aa',
    table_row_even_color: '#fff7ed',
    table_row_odd_color: '#ffffff',
    customer_section_bg_color: '#fff7ed',
    customer_section_border_color: '#ea580c',
    totals_box_border_color: '#ea580c',
    summary_border_color: '#ea580c',
  },
  {
    name: 'تركوازي عصري',
 emoji: '',
    primary_color: '#0891b2',
    secondary_color: '#164e63',
    accent_color: '#ecfeff',
    header_bg_color: '#0891b2',
    header_text_color: '#ffffff',
    table_header_bg_color: '#0891b2',
    table_header_text_color: '#ffffff',
    table_border_color: '#a5f3fc',
    table_row_even_color: '#ecfeff',
    table_row_odd_color: '#ffffff',
    customer_section_bg_color: '#ecfeff',
    customer_section_border_color: '#0891b2',
    totals_box_border_color: '#0891b2',
    summary_border_color: '#0891b2',
  },
];

// =====================================================
// مكونات مساعدة
// =====================================================

const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 h-8 font-mono text-xs" dir="ltr" />
    </div>
  </div>
);

const AlignmentSelector = ({ value, onChange, label }: { value: AlignmentType; onChange: (v: AlignmentType) => void; label: string }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {[
        { value: 'right' as const, icon: AlignRight, label: 'يمين' },
        { value: 'center' as const, icon: AlignCenter, label: 'وسط' },
        { value: 'left' as const, icon: AlignLeft, label: 'يسار' },
      ].map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 p-1.5 rounded-md flex items-center justify-center transition-all ${
            value === option.value ? "bg-primary text-primary-foreground shadow" : "hover:bg-background/80"
          }`}
          title={option.label}
        >
          <option.icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  </div>
);

const SectionResetButton = ({ onClick, label = "إعادة تعيين" }: { onClick: () => void; label?: string }) => (
  <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-destructive px-2" onClick={onClick}>
    <RotateCcw className="h-3 w-3 ml-1" />
    {label}
  </Button>
);

// =====================================================
// المكون الرئيسي
// =====================================================

const PrintSettingsPage = () => {
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>(DOCUMENT_TYPES.ACCOUNT_STATEMENT);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(0.45);
  const [docTypeOpen, setDocTypeOpen] = useState(false);
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [editMode, setEditMode] = useState<'global' | 'per_document'>('global');

  // ✅ Real customer preview state
  const [realPreviewHtml, setRealPreviewHtml] = useState<string | null>(null);
  const [realPreviewLoading, setRealPreviewLoading] = useState(false);
  const [customersList, setCustomersList] = useState<Array<{ id: string; name: string; company?: string }>>([]);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const realPreviewIframeRef = useRef<HTMLIFrameElement>(null);

  const { saveSettings, selectPrintSettingsByType, fetchSettings, saveGlobalToAll } = usePrintSettings();
  const { settings: storeSettings, isLoading } = usePrintSettingsByType(selectedDocType);

  const [settings, setSettings] = useState<Omit<PrintSettings, "document_type">>({ ...DEFAULT_PRINT_SETTINGS });
  const [initializedDocType, setInitializedDocType] = useState<DocumentType | null>(null);

  useEffect(() => {
    if (!storeSettings || isLoading) return;
    if (initializedDocType === selectedDocType) return;
    const { document_type: _dt, ...rest } = storeSettings;
    setSettings({ ...DEFAULT_PRINT_SETTINGS, ...rest });
    setInitializedDocType(selectedDocType);
  }, [storeSettings, selectedDocType, isLoading, initializedDocType]);

  // Clear real preview when document type changes
  useEffect(() => {
    setRealPreviewHtml(null);
  }, [selectedDocType]);

  // Write real preview HTML to iframe
  useEffect(() => {
    const iframe = realPreviewIframeRef.current;
    if (!iframe || !realPreviewHtml) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(realPreviewHtml);
    doc.close();
  }, [realPreviewHtml]);

  // Load customers list on demand
  const loadCustomers = useCallback(async () => {
    if (customersList.length > 0) return;
    const { data } = await supabase
      .from('customers')
      .select('id, name, company')
      .order('name')
      .limit(100);
    if (data) setCustomersList(data);
  }, [customersList.length]);

  // Fetch real customer account statement
  const fetchRealCustomerPreview = useCallback(async (customerId: string, customerName: string) => {
    setRealPreviewLoading(true);
    try {
      // Dynamic import of generator
      const { generateAccountStatementHTML } = await import('@/lib/accountStatementGenerator');
      
      // Fetch contracts
      const { data: contracts } = await supabase
        .from('Contract')
        .select('*')
        .eq('customer_id', customerId)
        .order('Contract Date', { ascending: true });
      
      // Fetch payments
      const { data: payments } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('customer_id', customerId)
        .order('paid_at', { ascending: true });

      // Build transactions
      const transactions: any[] = [];
      let totalDebits = 0;
      let totalCredits = 0;

      (contracts || []).forEach((c: any) => {
        const total = Number(c.Total) || 0;
        totalDebits += total;
        transactions.push({
          date: c['Contract Date'] || new Date().toISOString(),
          description: `عقد رقم ${c.Contract_Number} - ${c['Ad Type'] || 'إعلان'}`,
          reference: `عقد-${c.Contract_Number}`,
          debit: total,
          credit: 0,
          balance: 0,
          notes: '',
          type: 'contract',
          itemTotal: total,
          itemRemaining: null,
          adType: c['Ad Type'] || null,
        });
      });

      (payments || []).forEach((p: any) => {
        const amount = Number(p.amount) || 0;
        totalCredits += amount;
        transactions.push({
          date: p.paid_at || new Date().toISOString(),
          description: p.notes || `دفعة على عقد ${p.contract_number || ''}`,
          reference: p.contract_number ? `عقد-${p.contract_number}` : 'دفعة',
          debit: 0,
          credit: amount,
          balance: 0,
          notes: p.method || '',
          type: 'payment',
          distributedPaymentId: p.distributed_payment_id || null,
          distributedPaymentTotal: p.distributed_payment_total || null,
        });
      });

      // Sort by date
      transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance
      let balance = 0;
      transactions.forEach(t => {
        balance += t.debit - t.credit;
        t.balance = balance;
      });

      const html = await generateAccountStatementHTML({
        customerData: { id: customerId, name: customerName },
        transactions,
        statistics: {
          totalContracts: (contracts || []).length,
          activeContracts: 0,
          totalDebits,
          totalCredits,
          balance: totalDebits - totalCredits,
          totalPayments: (payments || []).length,
        },
        currency: { code: 'LYD', symbol: 'د.ل', writtenName: 'دينار ليبي' },
      });

      setRealPreviewHtml(html);
      toast.success(`تم جلب كشف حساب ${customerName}`);
    } catch (error) {
      console.error('Error fetching customer preview:', error);
      toast.error('فشل في جلب بيانات العميل');
    } finally {
      setRealPreviewLoading(false);
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editMode === 'global') {
        const ok = await saveGlobalToAll(settings);
        if (!ok) throw new Error("فشل الحفظ");
 toast.success("تم حفظ الإعدادات العامة على جميع الفواتير ");
      } else {
        const ok = await saveSettings(selectedDocType, { document_type: selectedDocType, ...settings });
        if (!ok) throw new Error("فشل الحفظ");
        toast.success(`تم حفظ إعدادات ${DOCUMENT_TYPE_INFO[selectedDocType].nameAr}`);
      }
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_PRINT_SETTINGS });
    toast.info("تم إعادة الإعدادات للقيم الافتراضية");
  };

  // ✅ حفظ الإعدادات الحالية كإعدادات افتراضية مخصصة
  const handleSaveAsFactoryDefaults = async () => {
    setIsSavingDefaults(true);
    try {
      const snapshot = {
        settings: { ...settings },
        savedAt: new Date().toISOString(),
        savedForDocType: editMode === 'global' ? 'global' : selectedDocType,
      };
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'print_factory_defaults',
          setting_value: JSON.stringify(snapshot),
        } as any, { onConflict: 'setting_key' });
      if (error) throw error;
 toast.success(" تم حفظ الإعدادات الحالية كإعدادات افتراضية يمكن الرجوع لها في أي وقت");
    } catch (error) {
      console.error(error);
      toast.error("فشل في حفظ الإعدادات الافتراضية");
    } finally {
      setIsSavingDefaults(false);
    }
  };

  // ✅ استعادة الإعدادات الافتراضية المحفوظة
  const handleRestoreFactoryDefaults = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'print_factory_defaults')
        .single();
      if (error || !data?.setting_value) {
        toast.error("لا توجد إعدادات افتراضية محفوظة مسبقاً");
        return;
      }
      const raw = data.setting_value;
      const snapshot = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (snapshot.settings) {
        setSettings({ ...DEFAULT_PRINT_SETTINGS, ...snapshot.settings });
        const savedDate = snapshot.savedAt ? new Date(snapshot.savedAt).toLocaleDateString('ar-LY') : '';
 toast.success(` تم استعادة الإعدادات الافتراضية المحفوظة ${savedDate ? `بتاريخ ${savedDate}` : ''}`);
      }
    } catch (error) {
      console.error(error);
      toast.error("فشل في استعادة الإعدادات الافتراضية");
    }
  };

  const handleRefresh = async () => {
    setInitializedDocType(null);
    await fetchSettings();
    toast.success("تم تحديث الإعدادات");
  };

  const handleCopyFrom = (sourceDocType: DocumentType) => {
    const src = selectPrintSettingsByType(sourceDocType);
    const { document_type: _dt, ...rest } = src;
    setSettings({ ...DEFAULT_PRINT_SETTINGS, ...rest });
    toast.success(`تم نسخ الإعدادات من ${DOCUMENT_TYPE_INFO[sourceDocType].nameAr}`);
  };

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetSection = (keys: (keyof typeof settings)[]) => {
    setSettings((prev) => {
      const updated = { ...prev };
      keys.forEach((key) => {
        (updated as any)[key] = (DEFAULT_PRINT_SETTINGS as any)[key];
      });
      return updated;
    });
    toast.info("تم إعادة تعيين القسم");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const docTypeInfo = DOCUMENT_TYPE_INFO[selectedDocType];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="flex flex-col lg:flex-row gap-4 p-4">
        {/* Left Panel - Settings */}
        <div className="lg:w-[460px] space-y-3">
          {/* Header Card */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">إعدادات الطباعة</CardTitle>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} title="تحديث">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleRestoreFactoryDefaults} title="استعادة الإعدادات الافتراضية المحفوظة">
                    <Download className="h-3.5 w-3.5 ml-1" />
                    استعادة
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSaveAsFactoryDefaults} disabled={isSavingDefaults} title="حفظ الإعدادات الحالية كإعدادات افتراضية">
                    {isSavingDefaults ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <BookmarkCheck className="h-3.5 w-3.5 ml-1" />}
                    حفظ كافتراضي
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleReset}>
                    <RotateCcw className="h-3.5 w-3.5 ml-1" />
                    إعادة
                  </Button>
                  <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Save className="h-3.5 w-3.5 ml-1" />}
                    حفظ
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-3 space-y-2">
 {/* وضع التحرير: عام أو خاص */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setEditMode('global')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    editMode === 'global' ? "bg-primary text-primary-foreground shadow" : "hover:bg-background/80"
                  }`}
                >
                  إعدادات عامة (جميع الفواتير)
                </button>
                <button
                  onClick={() => setEditMode('per_document')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    editMode === 'per_document' ? "bg-primary text-primary-foreground shadow" : "hover:bg-background/80"
                  }`}
                >
                  إعدادات خاصة بمستند
                </button>
              </div>

              {editMode === 'global' && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    أي تغيير هنا سيُطبّق على <strong>جميع الفواتير</strong> عند الحفظ (الألوان، الشعار، الشركة، الخطوط، الهوامش...)
                  </p>
                </div>
              )}

              {editMode === 'per_document' && (
                <div className="grid grid-cols-2 gap-2">
                  {/* Document Type Selector */}
                  <div>
                    <Label className="text-xs text-muted-foreground">نوع المستند</Label>
                    <Popover open={docTypeOpen} onOpenChange={setDocTypeOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full h-8 justify-between text-xs font-normal">
                          {DOCUMENT_TYPE_INFO[selectedDocType]?.nameAr || 'اختر...'}
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="ابحث عن نوع المستند..." className="h-9" />
                          <CommandList>
                            <CommandEmpty>لا توجد نتائج</CommandEmpty>
                            {Object.entries(DOCUMENT_CATEGORIES).map(([catKey, catInfo]) => (
                              <CommandGroup key={catKey} heading={catInfo.nameAr}>
                                {getDocumentsByCategory(catKey as keyof typeof DOCUMENT_CATEGORIES).map((doc) => (
                                  <CommandItem key={doc.id} value={doc.nameAr} onSelect={() => { setSelectedDocType(doc.id); setDocTypeOpen(false); setInitializedDocType(null); }}>
                                    <Check className={cn("mr-2 h-4 w-4", selectedDocType === doc.id ? "opacity-100" : "opacity-0")} />
                                    {doc.nameAr}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {/* Copy From Selector */}
                  <div>
                    <Label className="text-xs text-muted-foreground">نسخ من</Label>
                    <Popover open={copyFromOpen} onOpenChange={setCopyFromOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full h-8 justify-between text-xs font-normal text-muted-foreground">
                          اختر...
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="ابحث..." className="h-9" />
                          <CommandList>
                            <CommandEmpty>لا توجد نتائج</CommandEmpty>
                            {Object.entries(DOCUMENT_CATEGORIES).map(([catKey, catInfo]) => (
                              <CommandGroup key={catKey} heading={catInfo.nameAr}>
                                {getDocumentsByCategory(catKey as keyof typeof DOCUMENT_CATEGORIES)
                                  .filter(d => d.id !== selectedDocType)
                                  .map((doc) => (
                                    <CommandItem key={doc.id} value={doc.nameAr} onSelect={() => { handleCopyFrom(doc.id); setCopyFromOpen(false); }}>
                                      {doc.nameAr}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings Tabs */}
          <Card className="flex-1">
            <ScrollArea className="h-[calc(100vh-260px)]">
              <Tabs defaultValue="header" className="p-3">
                <TabsList className="grid grid-cols-5 w-full mb-3 h-9">
                  <TabsTrigger value="header" className="text-[10px] px-1 gap-0.5">
                    <Layout className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">الهيدر</span>
                  </TabsTrigger>
                  <TabsTrigger value="table" className="text-[10px] px-1 gap-0.5">
                    <Table className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">الجدول</span>
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="text-[10px] px-1 gap-0.5">
                    <Type className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">التخطيط</span>
                  </TabsTrigger>
                  <TabsTrigger value="colors" className="text-[10px] px-1 gap-0.5">
                    <Palette className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">الألوان</span>
                  </TabsTrigger>
                  <TabsTrigger value="document" className="text-[10px] px-1 gap-0.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">المستند</span>
                  </TabsTrigger>
                </TabsList>

                {/* ===== Tab 1: الهيدر والشركة ===== */}
                <TabsContent value="header" className="mt-0">
                  <Accordion type="multiple" defaultValue={["header-style", "logo"]} className="space-y-0">
                    {/* نمط الهيدر */}
                    <AccordionItem value="header-style">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Layout className="h-4 w-4" /> نمط الهيدر</span>
                      </AccordionTrigger>
                       <AccordionContent className="space-y-3 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['header_style', 'header_alignment', 'header_direction', 'header_swap', 'logo_position_order'])} />
                        </div>

 {/* زر تبديل نصفي الهيدر */}
                        <div className="p-2.5 bg-muted/50 rounded-lg border border-dashed">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium">تبديل نصفي الهيدر</p>
                              <p className="text-[10px] text-muted-foreground">
                                {settings.header_swap ? 'الشعار يسار ← العنوان يمين' : 'الشعار يمين ← العنوان يسار'}
                              </p>
                            </div>
                            <Button
                              variant={settings.header_swap ? "default" : "outline"}
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => updateSetting("header_swap", !settings.header_swap)}
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                              تبديل
                            </Button>
                          </div>
                        </div>

                        {/* أنماط الهيدر */}
                        <div className="grid grid-cols-1 gap-1.5">
                          {(Object.keys(HEADER_STYLES) as HeaderStyleType[]).map((style) => (
                            <button
                              key={style}
                              onClick={() => updateSetting("header_style", style)}
                              className={`p-2.5 border rounded-lg text-right transition-all ${
                                settings.header_style === style ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "border-border hover:border-primary/50"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-xs">{HEADER_STYLES[style].label}</p>
                                  <p className="text-[10px] text-muted-foreground">{HEADER_STYLES[style].description}</p>
                                </div>
                                {settings.header_style === style && (
                                  <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
 <span className="text-primary-foreground text-[10px]"></span>
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* الشعار */}
                    <AccordionItem value="logo">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> الشعار</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['show_logo', 'logo_path', 'logo_size', 'logo_size_preset', 'logo_position'])} />
                        </div>
                        <div className="flex items-center gap-3 p-2 bg-muted/30 rounded">
                          <Checkbox id="show_logo" checked={settings.show_logo} onCheckedChange={(v) => updateSetting("show_logo", !!v)} />
                          <Label htmlFor="show_logo" className="text-xs cursor-pointer">إظهار الشعار</Label>
                        </div>
                        {settings.show_logo && (
                          <>
                            <Label className="text-xs">حجم الشعار</Label>
                            <div className="grid grid-cols-5 gap-1.5">
                              {(Object.keys(LOGO_SIZES) as LogoSizeType[]).map((size) => (
                                <button key={size} onClick={() => { updateSetting("logo_size_preset", size); updateSetting("logo_size", LOGO_SIZES[size].value); }}
                                  className={`p-2 border rounded text-center transition-all ${settings.logo_size_preset === size ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                                >
                                  <p className="font-medium text-[10px]">{LOGO_SIZES[size].label}</p>
                                  <p className="text-[9px] text-muted-foreground">{LOGO_SIZES[size].value}px</p>
                                </button>
                              ))}
                            </div>
                            
                            {/* سلايدر حجم الشعار المخصص */}
                            <div>
                              <Label className="text-xs">حجم مخصص: {settings.logo_size}px</Label>
                              <Slider value={[settings.logo_size]} onValueChange={([v]) => { updateSetting("logo_size", v); updateSetting("logo_size_preset", "xlarge"); }} min={20} max={250} step={5} className="mt-1" />
                            </div>
                            
                            {/* رفع شعار مخصص */}
                            <Label className="text-xs font-medium">رفع شعار مخصص</Label>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs flex-1"
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = async (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (!file) return;
                                    if (file.size > 2 * 1024 * 1024) {
                                      toast.error('حجم الملف كبير جداً (الحد الأقصى 2MB)');
                                      return;
                                    }
                                    try {
                                      const imageUrl = await uploadImage(file, `custom-logo-${Date.now()}.jpg`, 'print-settings');
                                      updateSetting('logo_path', imageUrl);
                                      toast.success('تم رفع الشعار بنجاح');
                                    } catch (err) {
                                      console.error('Logo upload error:', err);
                                      toast.error('فشل رفع الشعار');
                                    }
                                  };
                                  input.click();
                                }}
                              >
                                <Upload className="h-3.5 w-3.5" />
                                رفع شعار
                              </Button>
                              {settings.logo_path?.startsWith('http') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    updateSetting('logo_path', '/logofaresgold.svg');
                                    toast.success('تم إعادة الشعار الافتراضي');
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                            {settings.logo_path && (
                              <div className={`p-3 border rounded-lg flex items-center justify-center bg-muted/20 ${settings.logo_path?.startsWith('http') ? 'border-primary' : 'border-border'}`}>
                                <img src={settings.logo_path} alt="الشعار الحالي" className="max-h-16 object-contain" />
                              </div>
                            )}

                            <Separator />
                            <Label className="text-xs">أو اختر من الشعارات المتاحة</Label>
                            <div className="grid grid-cols-3 gap-1.5">
                              {AVAILABLE_LOGOS.map((logo) => (
                                <button key={logo} onClick={() => updateSetting("logo_path", logo)}
                                  className={`p-2 border rounded-lg hover:border-primary transition-colors ${settings.logo_path === logo ? "border-primary bg-primary/5" : "border-border"}`}
                                >
                                  <img src={logo} alt="" className="h-7 w-full object-contain" />
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* عناصر الهيدر */}
                    <AccordionItem value="header-elements">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Eye className="h-4 w-4" /> عناصر الهيدر</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="space-y-2 p-2 bg-muted/30 rounded">
                          {[
                            { id: 'show_tax_id' as const, label: 'السجل التجاري' },
                            { id: 'show_email' as const, label: 'البريد الإلكتروني' },
                            { id: 'show_website' as const, label: 'الموقع الإلكتروني' },
                          ].map(item => (
                            <div key={item.id} className="flex items-center gap-3">
                              <Checkbox id={item.id} checked={settings[item.id]} onCheckedChange={(v) => updateSetting(item.id, !!v)} />
                              <Label htmlFor={item.id} className="text-xs cursor-pointer">إظهار {item.label}</Label>
                            </div>
                          ))}
                        </div>
                        <Separator />
                        <Label className="text-xs font-medium">إظهار/إخفاء عناصر الشركة</Label>
                        <div className="space-y-2 p-2 bg-muted/30 rounded">
                          {[
                            { id: 'show_company_name' as const, label: 'اسم الشركة' },
                            { id: 'show_company_subtitle' as const, label: 'العنوان الفرعي' },
                            { id: 'show_company_address' as const, label: 'العنوان' },
                            { id: 'show_company_contact' as const, label: 'معلومات الاتصال' },
                          ].map(item => (
                            <div key={item.id} className="flex items-center gap-3">
                              <Checkbox id={item.id} checked={settings[item.id]} onCheckedChange={(v) => updateSetting(item.id, !!v)} />
                              <Label htmlFor={item.id} className="text-xs cursor-pointer">{item.label}</Label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* معلومات الشركة */}
                    <AccordionItem value="company-info">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Building2 className="h-4 w-4" /> معلومات الشركة</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['company_name', 'company_subtitle', 'company_address', 'company_phone', 'company_tax_id', 'company_email', 'company_website'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <Label className="text-xs">اسم الشركة</Label>
                            <Input value={settings.company_name} onChange={(e) => updateSetting("company_name", e.target.value)} placeholder="الفارس الذهبي" className="h-8 text-xs" />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">العنوان الفرعي</Label>
                            <Input value={settings.company_subtitle} onChange={(e) => updateSetting("company_subtitle", e.target.value)} placeholder="للإعلان والدعاية" className="h-8 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">العنوان</Label>
                            <Input value={settings.company_address} onChange={(e) => updateSetting("company_address", e.target.value)} placeholder="طرابلس - ليبيا" className="h-8 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">الهاتف</Label>
                            <Input value={settings.company_phone} onChange={(e) => updateSetting("company_phone", e.target.value)} placeholder="0912345678" className="h-8 text-xs" dir="ltr" />
                          </div>
                          <div>
                            <Label className="text-xs">السجل التجاري</Label>
                            <Input value={settings.company_tax_id || ''} onChange={(e) => updateSetting("company_tax_id", e.target.value)} placeholder="1234567890" className="h-8 text-xs" dir="ltr" />
                          </div>
                          <div>
                            <Label className="text-xs">البريد الإلكتروني</Label>
                            <Input value={settings.company_email || ''} onChange={(e) => updateSetting("company_email", e.target.value)} placeholder="info@example.com" className="h-8 text-xs" dir="ltr" />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">الموقع الإلكتروني</Label>
                            <Input value={settings.company_website || ''} onChange={(e) => updateSetting("company_website", e.target.value)} placeholder="www.example.com" className="h-8 text-xs" dir="ltr" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>

                {/* ===== Tab 2: الجدول والملخص ===== */}
                <TabsContent value="table" className="mt-0">
                  <Accordion type="multiple" defaultValue={["table-colors"]} className="space-y-0">
                    {/* ألوان الجدول */}
                    <AccordionItem value="table-colors">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Palette className="h-4 w-4" /> ألوان الجدول</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['table_header_bg_color', 'table_header_text_color', 'table_border_color', 'table_row_even_color', 'table_row_odd_color', 'table_text_color'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="خلفية الترويسة" value={settings.table_header_bg_color} onChange={(v) => updateSetting("table_header_bg_color", v)} />
                          <ColorPicker label="نص الترويسة" value={settings.table_header_text_color} onChange={(v) => updateSetting("table_header_text_color", v)} />
                          <ColorPicker label="لون الحدود" value={settings.table_border_color} onChange={(v) => updateSetting("table_border_color", v)} />
                          <ColorPicker label="نص الجدول" value={settings.table_text_color} onChange={(v) => updateSetting("table_text_color", v)} />
                          <ColorPicker label="صف زوجي" value={settings.table_row_even_color} onChange={(v) => updateSetting("table_row_even_color", v)} />
                          <ColorPicker label="صف فردي" value={settings.table_row_odd_color} onChange={(v) => updateSetting("table_row_odd_color", v)} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* خصائص الجدول */}
                    <AccordionItem value="table-props">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Table className="h-4 w-4" /> خصائص الجدول</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['table_header_font_size', 'table_body_font_size', 'table_header_padding', 'table_body_padding', 'table_header_font_weight', 'table_line_height', 'table_border_width', 'table_border_style', 'table_border_radius', 'table_header_height', 'table_body_row_height'])} />
                        </div>
                        {/* حجم الخطوط */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">حجم خط الترويسة: {settings.table_header_font_size}px</Label>
                            <Slider value={[settings.table_header_font_size]} onValueChange={([v]) => updateSetting("table_header_font_size", v)} min={7} max={18} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">حجم خط الصفوف: {settings.table_body_font_size}px</Label>
                            <Slider value={[settings.table_body_font_size]} onValueChange={([v]) => updateSetting("table_body_font_size", v)} min={7} max={18} step={1} className="mt-1" />
                          </div>
                        </div>
                        {/* Padding */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">padding الترويسة</Label>
                            <Input value={settings.table_header_padding} onChange={(e) => updateSetting("table_header_padding", e.target.value)} placeholder="4px 8px" className="h-8 font-mono text-xs" dir="ltr" />
                          </div>
                          <div>
                            <Label className="text-xs">padding الصفوف</Label>
                            <Input value={settings.table_body_padding} onChange={(e) => updateSetting("table_body_padding", e.target.value)} placeholder="4px" className="h-8 font-mono text-xs" dir="ltr" />
                          </div>
                        </div>
                        {/* وزن الخط وارتفاع السطر */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">وزن خط الترويسة</Label>
                            <Select value={settings.table_header_font_weight} onValueChange={(v) => updateSetting("table_header_font_weight", v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">عادي</SelectItem>
                                <SelectItem value="500">متوسط</SelectItem>
                                <SelectItem value="600">شبه سميك</SelectItem>
                                <SelectItem value="bold">سميك</SelectItem>
                                <SelectItem value="800">سميك جداً</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">ارتفاع السطر: {settings.table_line_height}</Label>
                            <Select value={settings.table_line_height} onValueChange={(v) => updateSetting("table_line_height", v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1.0">ضيق (1.0)</SelectItem>
                                <SelectItem value="1.2">متوسط (1.2)</SelectItem>
                                <SelectItem value="1.4">عادي (1.4)</SelectItem>
                                <SelectItem value="1.6">واسع (1.6)</SelectItem>
                                <SelectItem value="1.8">واسع جداً (1.8)</SelectItem>
                                <SelectItem value="2.0">مزدوج (2.0)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* ارتفاع الصفوف */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">ارتفاع الترويسة: {settings.table_header_height || 'تلقائي'}px</Label>
                            <Slider value={[settings.table_header_height]} onValueChange={([v]) => updateSetting("table_header_height", v)} min={0} max={60} step={2} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">ارتفاع الصف: {settings.table_body_row_height || 'تلقائي'}px</Label>
                            <Slider value={[settings.table_body_row_height]} onValueChange={([v]) => updateSetting("table_body_row_height", v)} min={0} max={60} step={2} className="mt-1" />
                          </div>
                        </div>
                        {/* نمط الحدود */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">سمك الحدود: {settings.table_border_width}px</Label>
                            <Slider value={[settings.table_border_width]} onValueChange={([v]) => updateSetting("table_border_width", v)} min={0} max={4} step={0.5} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">نمط الحدود</Label>
                            <Select value={settings.table_border_style} onValueChange={(v) => updateSetting("table_border_style", v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="solid">متصل</SelectItem>
                                <SelectItem value="dashed">متقطع</SelectItem>
                                <SelectItem value="dotted">منقط</SelectItem>
                                <SelectItem value="none">بدون</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* حواف الجدول المستديرة */}
                        <div>
                          <Label className="text-xs">حواف الجدول المستديرة: {(settings as any).table_border_radius || 0}px</Label>
                          <Slider value={[(settings as any).table_border_radius || 0]} onValueChange={([v]) => updateSetting("table_border_radius" as any, v)} min={0} max={20} step={1} className="mt-1" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* صندوق الإجماليات */}
                    <AccordionItem value="totals-box">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Calculator className="h-4 w-4" /> صندوق الإجماليات</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['totals_box_bg_color', 'totals_box_text_color', 'totals_box_border_color', 'totals_box_border_radius', 'totals_title_font_size', 'totals_value_font_size', 'summary_bg_color', 'summary_text_color', 'summary_border_color'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="خلفية الملخص" value={settings.summary_bg_color} onChange={(v) => updateSetting("summary_bg_color", v)} />
                          <ColorPicker label="نص الملخص (الإجمالي)" value={settings.summary_text_color} onChange={(v) => updateSetting("summary_text_color", v)} />
                          <ColorPicker label="حدود الملخص" value={settings.summary_border_color} onChange={(v) => updateSetting("summary_border_color", v)} />
                        </div>
                        <Separator />
                        <Label className="text-xs font-medium">صندوق الإجماليات المنفصل</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="خلفية الصندوق" value={settings.totals_box_bg_color} onChange={(v) => updateSetting("totals_box_bg_color", v)} />
                          <ColorPicker label="نص الصندوق" value={settings.totals_box_text_color} onChange={(v) => updateSetting("totals_box_text_color", v)} />
                          <ColorPicker label="حدود الصندوق" value={settings.totals_box_border_color} onChange={(v) => updateSetting("totals_box_border_color", v)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">نصف قطر الحدود: {settings.totals_box_border_radius}px</Label>
                            <Slider value={[settings.totals_box_border_radius]} onValueChange={([v]) => updateSetting("totals_box_border_radius", v)} min={0} max={20} step={1} className="mt-1" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">حجم خط العنوان: {settings.totals_title_font_size}px</Label>
                            <Slider value={[settings.totals_title_font_size]} onValueChange={([v]) => updateSetting("totals_title_font_size", v)} min={8} max={24} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">حجم خط القيمة: {settings.totals_value_font_size}px</Label>
                            <Slider value={[settings.totals_value_font_size]} onValueChange={([v]) => updateSetting("totals_value_font_size", v)} min={8} max={24} step={1} className="mt-1" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* قسم العميل */}
                    <AccordionItem value="customer-section">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><User className="h-4 w-4" /> قسم العميل</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['show_customer_section', 'customer_section_title', 'customer_section_bg_color', 'customer_section_border_color', 'customer_text_color'])} />
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <Label className="text-xs">إظهار قسم العميل</Label>
                          <Switch checked={settings.show_customer_section} onCheckedChange={(v) => updateSetting("show_customer_section", v)} />
                        </div>
                        {settings.show_customer_section && (
                          <>
                            <div>
                              <Label className="text-xs">عنوان القسم</Label>
                              <Input value={settings.customer_section_title} onChange={(e) => updateSetting("customer_section_title", e.target.value)} placeholder="بيانات العميل" className="h-8 text-xs" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <ColorPicker label="خلفية القسم" value={settings.customer_section_bg_color} onChange={(v) => updateSetting("customer_section_bg_color", v)} />
                              <ColorPicker label="حدود القسم" value={settings.customer_section_border_color} onChange={(v) => updateSetting("customer_section_border_color", v)} />
                              <ColorPicker label="لون النص" value={settings.customer_text_color} onChange={(v) => updateSetting("customer_text_color", v)} />
                            </div>
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>

                {/* ===== Tab 3: التخطيط والخطوط ===== */}
                <TabsContent value="layout" className="mt-0">
                  <Accordion type="multiple" defaultValue={["margins"]} className="space-y-0">
                    {/* الهوامش */}
                    <AccordionItem value="margins">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Layout className="h-4 w-4" /> الهوامش</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['page_margin_top', 'page_margin_bottom', 'page_margin_left', 'page_margin_right', 'header_margin_bottom', 'document_title_margin_top'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">أعلى: {settings.page_margin_top}mm</Label>
                            <Slider value={[settings.page_margin_top]} onValueChange={([v]) => updateSetting("page_margin_top", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">أسفل: {settings.page_margin_bottom}mm</Label>
                            <Slider value={[settings.page_margin_bottom]} onValueChange={([v]) => updateSetting("page_margin_bottom", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">يمين: {settings.page_margin_right}mm</Label>
                            <Slider value={[settings.page_margin_right]} onValueChange={([v]) => updateSetting("page_margin_right", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">يسار: {settings.page_margin_left}mm</Label>
                            <Slider value={[settings.page_margin_left]} onValueChange={([v]) => updateSetting("page_margin_left", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">مسافة أسفل الهيدر: {settings.header_margin_bottom}px</Label>
                            <Slider value={[settings.header_margin_bottom]} onValueChange={([v]) => updateSetting("header_margin_bottom", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">مسافة أعلى العنوان: {settings.document_title_margin_top}px</Label>
                            <Slider value={[settings.document_title_margin_top]} onValueChange={([v]) => updateSetting("document_title_margin_top", v)} min={0} max={50} step={1} className="mt-1" />
                          </div>
                        </div>
                        <AlignmentSelector value={settings.document_title_alignment} onChange={(v) => updateSetting("document_title_alignment", v)} label="محاذاة عنوان المستند" />
                      </AccordionContent>
                    </AccordionItem>

                    {/* الخطوط */}
                    <AccordionItem value="fonts">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Type className="h-4 w-4" /> الخطوط وأحجام العناصر</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['font_family', 'title_font_size', 'header_font_size', 'body_font_size', 'invoice_title_ar_font_size', 'invoice_title_en_font_size', 'customer_name_font_size', 'stat_value_font_size'])} />
                        </div>
                        <div>
                          <Label className="text-xs">نوع الخط</Label>
                          <Select value={settings.font_family} onValueChange={(v) => updateSetting("font_family", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_FONTS.map((font) => (
                                <SelectItem key={font.name} value={font.name}><span style={{ fontFamily: font.name }}>{font.label}</span></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">العنوان: {settings.title_font_size}px</Label>
                            <Slider value={[settings.title_font_size]} onValueChange={([v]) => updateSetting("title_font_size", v)} min={14} max={36} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">الهيدر: {settings.header_font_size}px</Label>
                            <Slider value={[settings.header_font_size]} onValueChange={([v]) => updateSetting("header_font_size", v)} min={10} max={24} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">النص: {settings.body_font_size}px</Label>
                            <Slider value={[settings.body_font_size]} onValueChange={([v]) => updateSetting("body_font_size", v)} min={8} max={18} step={1} className="mt-1" />
                          </div>
                        </div>
                        <Separator />
                        <Label className="text-xs font-medium">أحجام عناصر الفاتورة</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">عنوان الفاتورة (عربي): {settings.invoice_title_ar_font_size}px</Label>
                            <Slider value={[settings.invoice_title_ar_font_size]} onValueChange={([v]) => updateSetting("invoice_title_ar_font_size", v)} min={12} max={32} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">عنوان الفاتورة (إنجليزي): {settings.invoice_title_en_font_size}px</Label>
                            <Slider value={[settings.invoice_title_en_font_size]} onValueChange={([v]) => updateSetting("invoice_title_en_font_size", v)} min={12} max={36} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">اسم العميل: {settings.customer_name_font_size}px</Label>
                            <Slider value={[settings.customer_name_font_size]} onValueChange={([v]) => updateSetting("customer_name_font_size", v)} min={12} max={30} step={1} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">قيمة الإحصائيات: {settings.stat_value_font_size}px</Label>
                            <Slider value={[settings.stat_value_font_size]} onValueChange={([v]) => updateSetting("stat_value_font_size", v)} min={16} max={40} step={1} className="mt-1" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* الاتجاه والحدود */}
                    <AccordionItem value="direction">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Layout className="h-4 w-4" /> الاتجاه والحدود</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">اتجاه الصفحة</Label>
                            <Select value={settings.direction} onValueChange={(v) => updateSetting("direction", v as 'rtl' | 'ltr')}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="rtl">RTL (عربي)</SelectItem>
                                <SelectItem value="ltr">LTR (إنجليزي)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">نصف قطر الحدود: {settings.border_radius}px</Label>
                            <Slider value={[settings.border_radius]} onValueChange={([v]) => updateSetting("border_radius", v)} min={0} max={20} step={1} className="mt-1" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* الخلفية */}
                    <AccordionItem value="background">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> الخلفية (ووترمارك)</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['background_image', 'background_opacity'])} />
                        </div>
                        <div>
                          <Label className="text-xs">رابط صورة الخلفية</Label>
                          <Input value={settings.background_image} onChange={(e) => updateSetting("background_image", e.target.value)} placeholder="https://... أو /path/to/image.png" className="h-8 text-xs" dir="ltr" />
                        </div>
                        <div>
                          <Label className="text-xs">شفافية الخلفية: {settings.background_opacity}%</Label>
                          <Slider value={[settings.background_opacity]} onValueChange={([v]) => updateSetting("background_opacity", v)} min={0} max={100} step={5} className="mt-1" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>

                {/* ===== Tab 4: الألوان ===== */}
                <TabsContent value="colors" className="mt-0">
 {/* أنماط ألوان جاهزة */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2.5">
                      <Palette className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">أنماط ألوان جاهزة</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => {
                            setSettings(prev => ({
                              ...prev,
                              primary_color: preset.primary_color,
                              secondary_color: preset.secondary_color,
                              accent_color: preset.accent_color,
                              header_bg_color: preset.header_bg_color,
                              header_text_color: preset.header_text_color,
                              table_header_bg_color: preset.table_header_bg_color,
                              table_header_text_color: preset.table_header_text_color,
                              table_border_color: preset.table_border_color,
                              table_row_even_color: preset.table_row_even_color,
                              table_row_odd_color: preset.table_row_odd_color,
                              customer_section_bg_color: preset.customer_section_bg_color,
                              customer_section_border_color: preset.customer_section_border_color,
                              totals_box_border_color: preset.totals_box_border_color,
                              summary_border_color: preset.summary_border_color,
                            }));
                            toast.success(`تم تطبيق نمط "${preset.name}"`);
                          }}
                          className="group relative p-2 border rounded-lg hover:border-primary/50 transition-all hover:shadow-sm text-center"
                        >
                          <div className="flex items-center justify-center gap-1 mb-1.5">
                            <div className="w-4 h-4 rounded-full border border-border shadow-sm" style={{ backgroundColor: preset.primary_color }} />
                            <div className="w-3 h-3 rounded-full border border-border shadow-sm" style={{ backgroundColor: preset.secondary_color }} />
                          </div>
                          <p className="text-[9px] font-medium leading-tight">{preset.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator className="mb-3" />
                  <Accordion type="multiple" defaultValue={["main-colors"]} className="space-y-0">
                    {/* الألوان الأساسية */}
                    <AccordionItem value="main-colors">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Palette className="h-4 w-4" /> الألوان الأساسية</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['primary_color', 'secondary_color', 'accent_color'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="اللون الأساسي" value={settings.primary_color} onChange={(v) => { updateSetting("primary_color", v); updateSetting("header_bg_color", v); updateSetting("table_header_bg_color", v); }} />
                          <ColorPicker label="اللون الثانوي" value={settings.secondary_color} onChange={(v) => updateSetting("secondary_color", v)} />
                          <ColorPicker label="لون التمييز" value={settings.accent_color} onChange={(v) => updateSetting("accent_color", v)} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* ألوان الهيدر */}
                    <AccordionItem value="header-colors">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Layout className="h-4 w-4" /> ألوان الهيدر</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['header_bg_color', 'header_text_color', 'company_subtitle_color'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="خلفية الهيدر" value={settings.header_bg_color} onChange={(v) => updateSetting("header_bg_color", v)} />
                          <ColorPicker label="نص الهيدر" value={settings.header_text_color} onChange={(v) => updateSetting("header_text_color", v)} />
                          <ColorPicker label="العنوان الفرعي" value={settings.company_subtitle_color} onChange={(v) => updateSetting("company_subtitle_color", v)} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* ألوان النصوص */}
                    <AccordionItem value="text-colors">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><Type className="h-4 w-4" /> ألوان النصوص</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['customer_text_color', 'table_text_color', 'footer_text_color', 'document_info_text_color'])} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="نص قسم العميل" value={settings.customer_text_color} onChange={(v) => updateSetting("customer_text_color", v)} />
                          <ColorPicker label="نص الجدول" value={settings.table_text_color} onChange={(v) => updateSetting("table_text_color", v)} />
                          <ColorPicker label="نص الفوتر" value={settings.footer_text_color} onChange={(v) => updateSetting("footer_text_color", v)} />
                          <ColorPicker label="نص معلومات المستند" value={settings.document_info_text_color} onChange={(v) => updateSetting("document_info_text_color", v)} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>

                {/* ===== Tab 5: المستند ===== */}
                <TabsContent value="document" className="mt-0">
                  {editMode === 'global' && (
                    <div className="p-3 mb-3 bg-muted/50 border border-dashed rounded-lg">
                      <p className="text-xs text-muted-foreground text-center">
                        عنوان المستند وبيانات قسم العميل خاصة بكل مستند.<br/>
                        انتقل لوضع <strong>"إعدادات خاصة بمستند"</strong> لتعديلها.
                      </p>
                    </div>
                  )}
                  <Accordion type="multiple" defaultValue={["doc-title"]} className="space-y-0">
                    {/* عنوان المستند */}
                    <AccordionItem value="doc-title">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> عنوان المستند</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">العنوان بالعربي</Label>
                            <Input value={settings.document_title_ar} onChange={(e) => updateSetting("document_title_ar", e.target.value)} placeholder={docTypeInfo.nameAr} className="h-8 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">العنوان بالإنجليزي</Label>
                            <Input value={settings.document_title_en} onChange={(e) => updateSetting("document_title_en", e.target.value)} placeholder={docTypeInfo.nameEn} className="h-8 text-xs" dir="ltr" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* معلومات المستند */}
                    <AccordionItem value="doc-info">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> معلومات المستند</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <Label className="text-xs">إظهار رقم المستند</Label>
                          <Switch checked={settings.show_document_number} onCheckedChange={(v) => updateSetting("show_document_number", v)} />
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <Label className="text-xs">إظهار التاريخ</Label>
                          <Switch checked={settings.show_document_date} onCheckedChange={(v) => updateSetting("show_document_date", v)} />
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <Label className="text-xs">إظهار التاريخ الهجري</Label>
                          <Switch checked={settings.show_hijri_date} onCheckedChange={(v) => updateSetting("show_hijri_date", v)} />
                        </div>
                        <div>
                          <Label className="text-xs">تنسيق التاريخ</Label>
                          <Select value={settings.date_format} onValueChange={(v) => updateSetting("date_format", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DATE_FORMATS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Separator />
                        <Label className="text-xs font-medium">تنسيق قسم المعلومات</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <ColorPicker label="لون النص" value={settings.document_info_text_color} onChange={(v) => updateSetting("document_info_text_color", v)} />
                          <ColorPicker label="لون الخلفية" value={settings.document_info_bg_color} onChange={(v) => updateSetting("document_info_bg_color", v)} />
                        </div>
                        <AlignmentSelector value={settings.document_info_alignment} onChange={(v) => updateSetting("document_info_alignment", v)} label="محاذاة المعلومات" />
                        <div>
                          <Label className="text-xs">المسافة العلوية: {settings.document_info_margin_top}px</Label>
                          <Slider value={[settings.document_info_margin_top]} onValueChange={([v]) => updateSetting("document_info_margin_top", v)} min={0} max={50} step={1} className="mt-1" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* الفوتر */}
                    <AccordionItem value="footer">
                      <AccordionTrigger className="py-2.5 text-sm">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> الفوتر</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        <div className="flex justify-end">
                          <SectionResetButton onClick={() => resetSection(['show_footer', 'footer_text', 'show_page_number', 'footer_alignment', 'footer_text_color'])} />
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <Label className="text-xs">إظهار الفوتر</Label>
                          <Switch checked={settings.show_footer} onCheckedChange={(v) => updateSetting("show_footer", v)} />
                        </div>
                        {settings.show_footer && (
                          <>
                            <div>
                              <Label className="text-xs">نص الفوتر</Label>
                              <Input value={settings.footer_text} onChange={(e) => updateSetting("footer_text", e.target.value)} placeholder="شكراً لتعاملكم معنا" className="h-8 text-xs" />
                            </div>
                            <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <Label className="text-xs">إظهار رقم الصفحة</Label>
                              <Switch checked={settings.show_page_number} onCheckedChange={(v) => updateSetting("show_page_number", v)} />
                            </div>
                            <AlignmentSelector value={settings.footer_alignment} onChange={(v) => updateSetting("footer_alignment", v)} label="محاذاة الفوتر" />
                            <ColorPicker label="لون نص الفوتر" value={settings.footer_text_color} onChange={(v) => updateSetting("footer_text_color", v)} />
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TabsContent>
              </Tabs>
            </ScrollArea>
          </Card>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex-1">
          <Card className="sticky top-4">
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {realPreviewHtml ? 'معاينة حية - بيانات حقيقية' : editMode === 'global' ? 'معاينة حية - إعدادات عامة' : `معاينة حية - ${docTypeInfo.nameAr}`}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {realPreviewHtml && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRealPreviewHtml(null)}>
                      <RotateCcw className="h-3 w-3 ml-1" />
                      العودة للمعاينة التجريبية
                    </Button>
                  )}
                  <Popover open={customerSearchOpen} onOpenChange={(open) => { setCustomerSearchOpen(open); if (open) loadCustomers(); }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={realPreviewLoading}>
                        {realPreviewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                        جلب كشف حساب عميل
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="end">
                      <Command>
                        <CommandInput placeholder="ابحث عن عميل..." />
                        <CommandList>
                          <CommandEmpty>لا يوجد عملاء</CommandEmpty>
                          <CommandGroup heading="العملاء">
                            {customersList.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.name}
                                onSelect={() => {
                                  setCustomerSearchOpen(false);
                                  fetchRealCustomerPreview(customer.id, customer.name);
                                }}
                              >
                                <User className="h-4 w-4 ml-2 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">{customer.name}</div>
                                  {customer.company && <div className="text-xs text-muted-foreground">{customer.company}</div>}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              {realPreviewHtml ? (
                <div className="relative overflow-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                  <div className="bg-muted rounded-lg p-4" style={{ minHeight: '400px' }}>
                    <div
                      className="mx-auto shadow-xl"
                      style={{
                        width: '210mm',
                        height: '297mm',
                        transform: `scale(${previewZoom})`,
                        transformOrigin: 'top center',
                        marginBottom: previewZoom < 1 ? `calc(297mm * ${1 - previewZoom})` : '0',
                      }}
                    >
                      <iframe
                        ref={realPreviewIframeRef}
                        className="w-full h-full border-0 bg-background"
                        title="معاينة بيانات حقيقية"
                        sandbox="allow-same-origin"
                        style={{ pointerEvents: 'none' }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <PrintEnginePreview settings={settings} documentType={selectedDocType} zoom={previewZoom} />
              )}

              {/* Floating Zoom Control */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewZoom(Math.max(0.3, previewZoom - 0.1))} disabled={previewZoom <= 0.3}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <div className="w-28">
                  <Slider value={[previewZoom]} onValueChange={([v]) => setPreviewZoom(v)} min={0.3} max={1.2} step={0.05} className="cursor-pointer" />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewZoom(Math.min(1.2, previewZoom + 0.1))} disabled={previewZoom >= 1.2}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] text-muted-foreground min-w-[32px] text-center">{Math.round(previewZoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewZoom(0.45)} title="إعادة التعيين">
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PrintSettingsPage;
