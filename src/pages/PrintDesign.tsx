import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Palette,
  Layout,
  Type,
  FileText,
  Table,
  AlignVerticalJustifyStart,
  Square,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Building2,
  Image as ImageIcon,
  Plus,
  Trash2,
  FolderOpen,
  Phone,
  MapPin,
  Ruler
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { InvoiceExtrasSettings } from "@/components/print/InvoiceExtrasSettings";

// الخطوط المتوفرة في مجلد public
const AVAILABLE_FONTS = [
  { name: 'Doran', variants: ['Thin', 'Light', 'Regular', 'Medium', 'Bold', 'ExtraBold'] },
  { name: 'Manrope', variants: ['ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold'] },
];

// الشعارات المتوفرة في مجلد public
const AVAILABLE_LOGOS = [
  '/logofaresgold.svg',
  '/logofares2.svg',
  '/logofaresgold.svg',
  '/logo-symbol.svg',
  '/logo-text.svg',
  '/new-logo.svg',
  '/coplete logofares-text. and sympol.svg',
];

// الخلفيات المتوفرة في مجلد public
const AVAILABLE_BACKGROUNDS = [
  '',
  '/bgc1.svg',
  '/bgc2.svg',
  '/price-bg.svg',
  '/ipg.svg',
];

const DEFAULT_PRINT_TEMPLATE = {
  bgPosX: 0,
  bgPosY: 0,
  bgScale: 100,
  bgOpacity: 100,
  padTop: 55,
  padRight: 20,
  padBottom: 35,
  padLeft: 20,
  contentMaxH: 200,
  headerEnabled: true,
  logoEnabled: true,
  companyInfoEnabled: true,
  footerEnabled: true,
  pageNumberEnabled: true,
  footerHeight: 15,
  footerBottom: 10,
  // ألوان التصميم الذهبي المطابقة لفاتورة العقد
  tableHeaderColor: '#D4AF37',
  tableBorderColor: '#D4AF37',
  sectionTitleColor: '#D4AF37',
  tableRowEvenColor: '#f8f9fa',
  tableRowOddColor: '#ffffff',
  tableTextColor: '#333333',
  headerTextColor: '#ffffff',
  // ألوان إضافية
  invoiceTitleColor: '#D4AF37',
  customerInfoBgColor: '#f8f9fa',
  customerInfoBorderColor: '#D4AF37',
  totalsLabelColor: '#333333',
  grandTotalBgColor: '#D4AF37',
  grandTotalTextColor: '#ffffff',
  amountWordsBgColor: '#fef9e7',
  amountWordsBorderColor: '#D4AF37',
  footerTextColor: '#666666',
  footerBorderColor: '#dddddd',
  pageBackgroundColor: '#ffffff',
  // شفافية خلفيات العناصر
  customerInfoBgOpacity: 100,
  tableRowOpacity: 100,
  grandTotalBgOpacity: 100,
  amountWordsBgOpacity: 100,
  // أحجام الخطوط
  tableFontSize: 13,
  headerFontSize: 14,
  titleFontSize: 16,
  borderWidth: 1,
  borderRadius: 8,
  cellPadding: 12,
  reportBackground: '',
  // بيانات الشركة - فارغة افتراضياً
  companyName: '',
  companySubtitle: '',
  companyAddress: '',
  companyPhone: '',
  logoPath: '/logofaresgold.svg',
  printBackground: '',
  fontFamily: 'Doran',
  fontWeight: 'Regular',
} as const;

interface DesignProfile {
  id: string;
  name: string;
  settings: typeof DEFAULT_PRINT_TEMPLATE;
  created_at: string;
}

const PROFILES_KEY = 'print_design_profiles';
const SETTINGS_KEY = 'print_design_settings';
const SIZES_INVOICE_KEY = 'sizes_invoice_settings';

const DEFAULT_SIZES_INVOICE_SETTINGS = {
  title: 'كشف المقاسات',
  subtitle: 'SIZES STATEMENT',
  showSingleFaceSeparately: true,
  showAreaPerFace: true,
  showTotalArea: true,
  showFacesCount: true,
  showDimensions: true,
  groupByFaces: true,
};

const PrintDesign = () => {
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.5);
  const [isLoading, setIsLoading] = useState(true);

  // Background controls
  const [bgPosX, setBgPosX] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgPosX);
  const [bgPosY, setBgPosY] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgPosY);
  const [bgScale, setBgScale] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgScale);
  const [reportBackground, setReportBackground] = useState<string>('');

  // Company & Logo controls
  const [companyName, setCompanyName] = useState<string>(DEFAULT_PRINT_TEMPLATE.companyName);
  const [companySubtitle, setCompanySubtitle] = useState<string>(DEFAULT_PRINT_TEMPLATE.companySubtitle);
  const [companyAddress, setCompanyAddress] = useState<string>(DEFAULT_PRINT_TEMPLATE.companyAddress);
  const [companyPhone, setCompanyPhone] = useState<string>(DEFAULT_PRINT_TEMPLATE.companyPhone);
  const [logoPath, setLogoPath] = useState<string>(DEFAULT_PRINT_TEMPLATE.logoPath);
  const [printBackground, setPrintBackground] = useState<string>(DEFAULT_PRINT_TEMPLATE.printBackground);
  const [fontFamily, setFontFamily] = useState<string>(DEFAULT_PRINT_TEMPLATE.fontFamily);
  const [fontWeight, setFontWeight] = useState<string>(DEFAULT_PRINT_TEMPLATE.fontWeight);

  // Profiles system
  const [profiles, setProfiles] = useState<DesignProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  // Padding controls
  const [padTop, setPadTop] = useState<number>(DEFAULT_PRINT_TEMPLATE.padTop);
  const [padRight, setPadRight] = useState<number>(DEFAULT_PRINT_TEMPLATE.padRight);
  const [padBottom, setPadBottom] = useState<number>(DEFAULT_PRINT_TEMPLATE.padBottom);
  const [padLeft, setPadLeft] = useState<number>(DEFAULT_PRINT_TEMPLATE.padLeft);
  const [contentMaxH, setContentMaxH] = useState<number>(DEFAULT_PRINT_TEMPLATE.contentMaxH);

  // Header & Footer controls
  const [headerEnabled, setHeaderEnabled] = useState<boolean>(DEFAULT_PRINT_TEMPLATE.headerEnabled);
  const [logoEnabled, setLogoEnabled] = useState<boolean>(DEFAULT_PRINT_TEMPLATE.logoEnabled);
  const [companyInfoEnabled, setCompanyInfoEnabled] = useState<boolean>(DEFAULT_PRINT_TEMPLATE.companyInfoEnabled);
  const [footerEnabled, setFooterEnabled] = useState<boolean>(DEFAULT_PRINT_TEMPLATE.footerEnabled);
  const [pageNumberEnabled, setPageNumberEnabled] = useState<boolean>(DEFAULT_PRINT_TEMPLATE.pageNumberEnabled);
  const [footerHeight, setFooterHeight] = useState<number>(DEFAULT_PRINT_TEMPLATE.footerHeight);
  const [footerBottom, setFooterBottom] = useState<number>(DEFAULT_PRINT_TEMPLATE.footerBottom);

  // Table color controls
  const [tableHeaderColor, setTableHeaderColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableHeaderColor);
  const [tableBorderColor, setTableBorderColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableBorderColor);
  const [sectionTitleColor, setSectionTitleColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.sectionTitleColor);

  // Extended table controls
  const [tableRowEvenColor, setTableRowEvenColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableRowEvenColor);
  const [tableRowOddColor, setTableRowOddColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableRowOddColor);
  const [tableTextColor, setTableTextColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableTextColor);
  const [headerTextColor, setHeaderTextColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.headerTextColor);
  
  // Extended color controls
  const [bgOpacity, setBgOpacity] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgOpacity);
  const [invoiceTitleColor, setInvoiceTitleColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.invoiceTitleColor);
  const [customerInfoBgColor, setCustomerInfoBgColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.customerInfoBgColor);
  const [customerInfoBorderColor, setCustomerInfoBorderColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.customerInfoBorderColor);
  const [totalsLabelColor, setTotalsLabelColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.totalsLabelColor);
  const [grandTotalBgColor, setGrandTotalBgColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.grandTotalBgColor);
  const [grandTotalTextColor, setGrandTotalTextColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.grandTotalTextColor);
  const [amountWordsBgColor, setAmountWordsBgColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.amountWordsBgColor);
  const [amountWordsBorderColor, setAmountWordsBorderColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.amountWordsBorderColor);
  const [footerTextColor, setFooterTextColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.footerTextColor);
  const [footerBorderColor, setFooterBorderColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.footerBorderColor);
  const [pageBackgroundColor, setPageBackgroundColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.pageBackgroundColor);
  const [customerInfoBgOpacity, setCustomerInfoBgOpacity] = useState<number>(DEFAULT_PRINT_TEMPLATE.customerInfoBgOpacity);
  const [tableRowOpacity, setTableRowOpacity] = useState<number>(DEFAULT_PRINT_TEMPLATE.tableRowOpacity);
  const [grandTotalBgOpacity, setGrandTotalBgOpacity] = useState<number>(DEFAULT_PRINT_TEMPLATE.grandTotalBgOpacity);
  const [amountWordsBgOpacity, setAmountWordsBgOpacity] = useState<number>(DEFAULT_PRINT_TEMPLATE.amountWordsBgOpacity);
  
  const [tableFontSize, setTableFontSize] = useState<number>(DEFAULT_PRINT_TEMPLATE.tableFontSize);
  const [headerFontSize, setHeaderFontSize] = useState<number>(DEFAULT_PRINT_TEMPLATE.headerFontSize);
  const [titleFontSize, setTitleFontSize] = useState<number>(DEFAULT_PRINT_TEMPLATE.titleFontSize);
  const [borderWidth, setBorderWidth] = useState<number>(DEFAULT_PRINT_TEMPLATE.borderWidth);
  const [borderRadius, setBorderRadius] = useState<number>(DEFAULT_PRINT_TEMPLATE.borderRadius);
  const [cellPadding, setCellPadding] = useState<number>(DEFAULT_PRINT_TEMPLATE.cellPadding);

  // Sizes Invoice Settings
  const [sizesInvoiceTitle, setSizesInvoiceTitle] = useState<string>(DEFAULT_SIZES_INVOICE_SETTINGS.title);
  const [sizesInvoiceSubtitle, setSizesInvoiceSubtitle] = useState<string>(DEFAULT_SIZES_INVOICE_SETTINGS.subtitle);
  const [sizesShowSingleFaceSeparately, setSizesShowSingleFaceSeparately] = useState<boolean>(DEFAULT_SIZES_INVOICE_SETTINGS.showSingleFaceSeparately);
  const [sizesShowAreaPerFace, setSizesShowAreaPerFace] = useState<boolean>(DEFAULT_SIZES_INVOICE_SETTINGS.showAreaPerFace);
  const [sizesShowTotalArea, setSizesShowTotalArea] = useState<boolean>(DEFAULT_SIZES_INVOICE_SETTINGS.showTotalArea);
  const [sizesShowFacesCount, setSizesShowFacesCount] = useState<boolean>(DEFAULT_SIZES_INVOICE_SETTINGS.showFacesCount);
  const [sizesShowDimensions, setSizesShowDimensions] = useState<boolean>(DEFAULT_SIZES_INVOICE_SETTINGS.showDimensions);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load main settings
        const { data, error } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("setting_key", SETTINGS_KEY)
          .single();

        if (data?.setting_value) {
          const settings = JSON.parse(data.setting_value);
          applySettings(settings);
        }

        // Load profiles
        const { data: profilesData } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("setting_key", PROFILES_KEY)
          .single();

        if (profilesData?.setting_value) {
          const loadedProfiles = JSON.parse(profilesData.setting_value);
          setProfiles(loadedProfiles);
        }

        // Load sizes invoice settings
        const { data: sizesData } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("setting_key", SIZES_INVOICE_KEY)
          .single();

        if (sizesData?.setting_value) {
          const sizesSettings = JSON.parse(sizesData.setting_value);
          setSizesInvoiceTitle(sizesSettings.title ?? DEFAULT_SIZES_INVOICE_SETTINGS.title);
          setSizesInvoiceSubtitle(sizesSettings.subtitle ?? DEFAULT_SIZES_INVOICE_SETTINGS.subtitle);
          setSizesShowSingleFaceSeparately(sizesSettings.showSingleFaceSeparately ?? DEFAULT_SIZES_INVOICE_SETTINGS.showSingleFaceSeparately);
          setSizesShowAreaPerFace(sizesSettings.showAreaPerFace ?? DEFAULT_SIZES_INVOICE_SETTINGS.showAreaPerFace);
          setSizesShowTotalArea(sizesSettings.showTotalArea ?? DEFAULT_SIZES_INVOICE_SETTINGS.showTotalArea);
          setSizesShowFacesCount(sizesSettings.showFacesCount ?? DEFAULT_SIZES_INVOICE_SETTINGS.showFacesCount);
          setSizesShowDimensions(sizesSettings.showDimensions ?? DEFAULT_SIZES_INVOICE_SETTINGS.showDimensions);
        }
      } catch (e) {
        console.log("No existing settings found, using defaults");
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Helper function to apply settings
  const applySettings = (settings: any) => {
    setBgPosX(settings.bgPosX ?? DEFAULT_PRINT_TEMPLATE.bgPosX);
    setBgPosY(settings.bgPosY ?? DEFAULT_PRINT_TEMPLATE.bgPosY);
    setBgScale(settings.bgScale ?? DEFAULT_PRINT_TEMPLATE.bgScale);
    setReportBackground(settings.reportBackground ?? '');
    setCompanyName(settings.companyName ?? DEFAULT_PRINT_TEMPLATE.companyName);
    setCompanySubtitle(settings.companySubtitle ?? DEFAULT_PRINT_TEMPLATE.companySubtitle);
    setCompanyAddress(settings.companyAddress ?? DEFAULT_PRINT_TEMPLATE.companyAddress);
    setCompanyPhone(settings.companyPhone ?? DEFAULT_PRINT_TEMPLATE.companyPhone);
    setLogoPath(settings.logoPath ?? DEFAULT_PRINT_TEMPLATE.logoPath);
    setPrintBackground(settings.printBackground ?? DEFAULT_PRINT_TEMPLATE.printBackground);
    setFontFamily(settings.fontFamily ?? DEFAULT_PRINT_TEMPLATE.fontFamily);
    setFontWeight(settings.fontWeight ?? DEFAULT_PRINT_TEMPLATE.fontWeight);
    setPadTop(settings.padTop ?? DEFAULT_PRINT_TEMPLATE.padTop);
    setPadRight(settings.padRight ?? DEFAULT_PRINT_TEMPLATE.padRight);
    setPadBottom(settings.padBottom ?? DEFAULT_PRINT_TEMPLATE.padBottom);
    setPadLeft(settings.padLeft ?? DEFAULT_PRINT_TEMPLATE.padLeft);
    setContentMaxH(settings.contentMaxH ?? DEFAULT_PRINT_TEMPLATE.contentMaxH);
    setHeaderEnabled(settings.headerEnabled ?? DEFAULT_PRINT_TEMPLATE.headerEnabled);
    setLogoEnabled(settings.logoEnabled ?? DEFAULT_PRINT_TEMPLATE.logoEnabled);
    setCompanyInfoEnabled(settings.companyInfoEnabled ?? DEFAULT_PRINT_TEMPLATE.companyInfoEnabled);
    setFooterEnabled(settings.footerEnabled ?? DEFAULT_PRINT_TEMPLATE.footerEnabled);
    setPageNumberEnabled(settings.pageNumberEnabled ?? DEFAULT_PRINT_TEMPLATE.pageNumberEnabled);
    setFooterHeight(settings.footerHeight ?? DEFAULT_PRINT_TEMPLATE.footerHeight);
    setFooterBottom(settings.footerBottom ?? DEFAULT_PRINT_TEMPLATE.footerBottom);
    setTableHeaderColor(settings.tableHeaderColor ?? DEFAULT_PRINT_TEMPLATE.tableHeaderColor);
    setTableBorderColor(settings.tableBorderColor ?? DEFAULT_PRINT_TEMPLATE.tableBorderColor);
    setSectionTitleColor(settings.sectionTitleColor ?? DEFAULT_PRINT_TEMPLATE.sectionTitleColor);
    setTableRowEvenColor(settings.tableRowEvenColor ?? DEFAULT_PRINT_TEMPLATE.tableRowEvenColor);
    setTableRowOddColor(settings.tableRowOddColor ?? DEFAULT_PRINT_TEMPLATE.tableRowOddColor);
    setTableTextColor(settings.tableTextColor ?? DEFAULT_PRINT_TEMPLATE.tableTextColor);
    setHeaderTextColor(settings.headerTextColor ?? DEFAULT_PRINT_TEMPLATE.headerTextColor);
    // Extended colors
    setBgOpacity(settings.bgOpacity ?? DEFAULT_PRINT_TEMPLATE.bgOpacity);
    setInvoiceTitleColor(settings.invoiceTitleColor ?? DEFAULT_PRINT_TEMPLATE.invoiceTitleColor);
    setCustomerInfoBgColor(settings.customerInfoBgColor ?? DEFAULT_PRINT_TEMPLATE.customerInfoBgColor);
    setCustomerInfoBorderColor(settings.customerInfoBorderColor ?? DEFAULT_PRINT_TEMPLATE.customerInfoBorderColor);
    setTotalsLabelColor(settings.totalsLabelColor ?? DEFAULT_PRINT_TEMPLATE.totalsLabelColor);
    setGrandTotalBgColor(settings.grandTotalBgColor ?? DEFAULT_PRINT_TEMPLATE.grandTotalBgColor);
    setGrandTotalTextColor(settings.grandTotalTextColor ?? DEFAULT_PRINT_TEMPLATE.grandTotalTextColor);
    setAmountWordsBgColor(settings.amountWordsBgColor ?? DEFAULT_PRINT_TEMPLATE.amountWordsBgColor);
    setAmountWordsBorderColor(settings.amountWordsBorderColor ?? DEFAULT_PRINT_TEMPLATE.amountWordsBorderColor);
    setFooterTextColor(settings.footerTextColor ?? DEFAULT_PRINT_TEMPLATE.footerTextColor);
    setFooterBorderColor(settings.footerBorderColor ?? DEFAULT_PRINT_TEMPLATE.footerBorderColor);
    setPageBackgroundColor(settings.pageBackgroundColor ?? DEFAULT_PRINT_TEMPLATE.pageBackgroundColor);
    // Element opacities
    setCustomerInfoBgOpacity(settings.customerInfoBgOpacity ?? DEFAULT_PRINT_TEMPLATE.customerInfoBgOpacity);
    setTableRowOpacity(settings.tableRowOpacity ?? DEFAULT_PRINT_TEMPLATE.tableRowOpacity);
    setGrandTotalBgOpacity(settings.grandTotalBgOpacity ?? DEFAULT_PRINT_TEMPLATE.grandTotalBgOpacity);
    setAmountWordsBgOpacity(settings.amountWordsBgOpacity ?? DEFAULT_PRINT_TEMPLATE.amountWordsBgOpacity);
    // Font sizes
    setTableFontSize(settings.tableFontSize ?? DEFAULT_PRINT_TEMPLATE.tableFontSize);
    setHeaderFontSize(settings.headerFontSize ?? DEFAULT_PRINT_TEMPLATE.headerFontSize);
    setTitleFontSize(settings.titleFontSize ?? DEFAULT_PRINT_TEMPLATE.titleFontSize);
    setBorderWidth(settings.borderWidth ?? DEFAULT_PRINT_TEMPLATE.borderWidth);
    setBorderRadius(settings.borderRadius ?? DEFAULT_PRINT_TEMPLATE.borderRadius);
    setCellPadding(settings.cellPadding ?? DEFAULT_PRINT_TEMPLATE.cellPadding);
  };

  // Get current settings as object
  const getCurrentSettings = () => ({
    bgPosX, bgPosY, bgScale, bgOpacity, reportBackground,
    companyName, companySubtitle, companyAddress, companyPhone,
    logoPath, printBackground, fontFamily, fontWeight,
    padTop, padRight, padBottom, padLeft, contentMaxH,
    headerEnabled, logoEnabled, companyInfoEnabled, footerEnabled, pageNumberEnabled, footerHeight, footerBottom,
    tableHeaderColor, tableBorderColor, sectionTitleColor,
    tableRowEvenColor, tableRowOddColor, tableTextColor, headerTextColor,
    invoiceTitleColor, customerInfoBgColor, customerInfoBorderColor,
    totalsLabelColor, grandTotalBgColor, grandTotalTextColor,
    amountWordsBgColor, amountWordsBorderColor,
    footerTextColor, footerBorderColor, pageBackgroundColor,
    customerInfoBgOpacity, tableRowOpacity, grandTotalBgOpacity, amountWordsBgOpacity,
    tableFontSize, headerFontSize, titleFontSize,
    borderWidth, borderRadius, cellPadding,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settings = getCurrentSettings();

      // Try to update first
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("setting_key", SETTINGS_KEY)
        .single();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({
            setting_value: JSON.stringify(settings),
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", SETTINGS_KEY);
      } else {
        await supabase
          .from("system_settings")
          .insert({
            setting_key: SETTINGS_KEY,
            setting_value: JSON.stringify(settings),
            setting_type: "json",
            description: "إعدادات تصميم الطباعة",
            category: "print",
          });
      }

      // Save sizes invoice settings
      const sizesInvoiceSettings = {
        title: sizesInvoiceTitle,
        subtitle: sizesInvoiceSubtitle,
        showSingleFaceSeparately: sizesShowSingleFaceSeparately,
        showAreaPerFace: sizesShowAreaPerFace,
        showTotalArea: sizesShowTotalArea,
        showFacesCount: sizesShowFacesCount,
        showDimensions: sizesShowDimensions,
      };

      const { data: existingSizes } = await supabase
        .from("system_settings")
        .select("id")
        .eq("setting_key", SIZES_INVOICE_KEY)
        .single();

      if (existingSizes) {
        await supabase
          .from("system_settings")
          .update({
            setting_value: JSON.stringify(sizesInvoiceSettings),
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", SIZES_INVOICE_KEY);
      } else {
        await supabase
          .from("system_settings")
          .insert({
            setting_key: SIZES_INVOICE_KEY,
            setting_value: JSON.stringify(sizesInvoiceSettings),
            setting_type: "json",
            description: "إعدادات فاتورة المقاسات",
            category: "print",
          });
      }
      
      toast.success("تم حفظ إعدادات التصميم بنجاح");
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setIsSaving(false);
    }
  };

  // Save profiles to database
  const saveProfiles = async (updatedProfiles: DesignProfile[]) => {
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("setting_key", PROFILES_KEY)
        .single();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({
            setting_value: JSON.stringify(updatedProfiles),
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", PROFILES_KEY);
      } else {
        await supabase
          .from("system_settings")
          .insert({
            setting_key: PROFILES_KEY,
            setting_value: JSON.stringify(updatedProfiles),
            setting_type: "json",
            description: "بروفايلات تصميم الطباعة",
            category: "print",
          });
      }
    } catch (error) {
      console.error("Error saving profiles:", error);
      throw error;
    }
  };

  // Create new profile
  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      toast.error("يرجى إدخال اسم البروفايل");
      return;
    }

    const newProfile: DesignProfile = {
      id: `profile_${Date.now()}`,
      name: newProfileName.trim(),
      settings: getCurrentSettings() as any,
      created_at: new Date().toISOString(),
    };

    const updatedProfiles = [...profiles, newProfile];
    
    try {
      await saveProfiles(updatedProfiles);
      setProfiles(updatedProfiles);
      setCurrentProfileId(newProfile.id);
      setNewProfileName('');
      setShowProfileDialog(false);
      toast.success(`تم إنشاء بروفايل "${newProfile.name}" بنجاح`);
    } catch (error) {
      toast.error("حدث خطأ أثناء حفظ البروفايل");
    }
  };

  // Load profile
  const handleLoadProfile = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      applySettings(profile.settings);
      setCurrentProfileId(profileId);
      toast.success(`تم تحميل بروفايل "${profile.name}"`);
    }
  };

  // Delete profile
  const handleDeleteProfile = async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    
    try {
      await saveProfiles(updatedProfiles);
      setProfiles(updatedProfiles);
      if (currentProfileId === profileId) {
        setCurrentProfileId(null);
      }
      toast.success(`تم حذف بروفايل "${profile.name}"`);
    } catch (error) {
      toast.error("حدث خطأ أثناء حذف البروفايل");
    }
  };

  // Update current profile
  const handleUpdateCurrentProfile = async () => {
    if (!currentProfileId) {
      toast.error("لا يوجد بروفايل محدد للتحديث");
      return;
    }

    const updatedProfiles = profiles.map(p => 
      p.id === currentProfileId 
        ? { ...p, settings: getCurrentSettings() as any }
        : p
    );
    
    try {
      await saveProfiles(updatedProfiles);
      setProfiles(updatedProfiles);
      const profile = profiles.find(p => p.id === currentProfileId);
      toast.success(`تم تحديث بروفايل "${profile?.name}"`);
    } catch (error) {
      toast.error("حدث خطأ أثناء تحديث البروفايل");
    }
  };

  const handleReset = () => {
    applySettings(DEFAULT_PRINT_TEMPLATE);
    setCurrentProfileId(null);
    toast.info("تم إعادة الضبط للقيم الافتراضية");
  };

  // Color input component with popover
  const ColorInput = ({ label, value, onChange, description }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    description?: string;
  }) => {
    const presetColors = [
      '#D4AF37', '#FFD700', '#C0C0C0', '#CD7F32',
      '#1a1a2e', '#16213e', '#0f3460', '#e94560',
      '#2d3436', '#636e72', '#b2bec3', '#dfe6e9',
      '#00b894', '#00cec9', '#0984e3', '#6c5ce7',
      '#fdcb6e', '#e17055', '#d63031', '#e84393',
      '#ffffff', '#f8f9fa', '#e9ecef', '#000000',
    ];

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border-2 border-border hover:border-primary transition-colors appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-none"
            />
          </div>
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 font-mono text-sm h-10"
            dir="ltr"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {presetColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={cn(
                "w-6 h-6 rounded-md border-2 transition-all hover:scale-110 hover:shadow-md",
                value === color ? "border-primary ring-2 ring-primary/30" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    );
  };

  // Slider input component with number input
  const SliderInput = ({ label, value, onChange, min, max, step = 1, unit = "" }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step?: number;
    unit?: string;
  }) => (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={value}
            onChange={(e) => {
              const newVal = parseFloat(e.target.value) || min;
              onChange(Math.min(max, Math.max(min, newVal)));
            }}
            className="w-16 h-7 text-center text-sm font-mono px-1"
            min={min}
            max={max}
            step={step}
            dir="ltr"
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      </div>
      <div className="px-1">
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={min}
          max={max}
          step={step}
          className="w-full cursor-pointer"
        />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Sample data for preview - matching invoice structure (extended for 2 pages)
  const sampleInvoiceData = [
    { description: "لوحة إعلانية مقاس 3×2 - شارع الزاوية الرئيسي", quantity: "10.0", faces: "2", unitPrice: "2,361.6", total: "33,062.5" },
    { description: "لوحة إعلانية مقاس 6×3 - طريق المطار", quantity: "8.0", faces: "2", unitPrice: "9,367.3", total: "16,101.9" },
    { description: "لوحة إعلانية مقاس 12×4 - الطريق الساحلي", quantity: "1.0", faces: "2", unitPrice: "19,322.9", total: "19,322.9" },
    { description: "لوحة إعلانية مقاس 3×4 - ميدان الشهداء", quantity: "1.0", faces: "2", unitPrice: "4,661.7", total: "4,661.7" },
    { description: "لوحة إعلانية مقاس 4×3 - شارع النصر", quantity: "1.0", faces: "2", unitPrice: "2,361.6", total: "2,361.6" },
    { description: "لوحة إعلانية مقاس 8×4 - طريق الجامعة", quantity: "3.0", faces: "2", unitPrice: "5,500.0", total: "16,500.0" },
    { description: "لوحة إعلانية مقاس 5×3 - شارع عمر المختار", quantity: "2.0", faces: "1", unitPrice: "3,200.0", total: "6,400.0" },
    { description: "لوحة إعلانية مقاس 6×4 - منطقة الفندق", quantity: "4.0", faces: "2", unitPrice: "7,800.0", total: "31,200.0" },
    { description: "لوحة إعلانية مقاس 3×2 - حي الأندلس", quantity: "5.0", faces: "1", unitPrice: "1,800.0", total: "9,000.0" },
    { description: "لوحة إعلانية مقاس 10×5 - الطريق الدائري", quantity: "2.0", faces: "2", unitPrice: "12,000.0", total: "24,000.0" },
    { description: "لوحة إعلانية مقاس 4×2 - سوق الجمعة", quantity: "6.0", faces: "1", unitPrice: "2,100.0", total: "12,600.0" },
    { description: "لوحة إعلانية مقاس 8×3 - شارع الجمهورية", quantity: "3.0", faces: "2", unitPrice: "6,500.0", total: "19,500.0" },
  ];
  
  // Split data for pagination preview
  const itemsPerPage = 6;
  const page1Data = sampleInvoiceData.slice(0, itemsPerPage);
  const page2Data = sampleInvoiceData.slice(itemsPerPage);
  const totalPages = Math.ceil(sampleInvoiceData.length / itemsPerPage);

  // Helper function to apply opacity to hex color
  const hexToRgba = (hex: string, opacity: number) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
    }
    return hex;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Controls Sidebar */}
      <div
        className={cn(
          "transition-all duration-300 flex flex-col bg-card rounded-lg border overflow-hidden",
          sidebarCollapsed ? "w-12" : "w-[380px]"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b flex items-center justify-between bg-muted/30">
          {!sidebarCollapsed && (
            <h2 className="font-bold text-lg">إعدادات التصميم</h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="shrink-0"
          >
            {sidebarCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Sidebar Content */}
        {!sidebarCollapsed && (
          <ScrollArea className="flex-1 h-[calc(100%-60px)]">
            <div className="p-4 pb-20">
              <Tabs defaultValue="profiles" className="w-full">
                <TabsList className="w-full grid grid-cols-7 mb-4">
                  <TabsTrigger value="profiles" className="text-xs px-1" title="البروفايلات">
                    <FolderOpen className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="company" className="text-xs px-1" title="الشركة">
                    <Building2 className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="colors" className="text-xs px-1" title="الألوان">
                    <Palette className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="table" className="text-xs px-1" title="الجدول">
                    <Table className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="text-xs px-1" title="التخطيط">
                    <Layout className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="footer" className="text-xs px-1" title="الفوتر">
                    <AlignVerticalJustifyStart className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="sizes" className="text-xs px-1" title="فاتورة المقاسات">
                    <Ruler className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="extras" className="text-xs px-1" title="ختم وتحويلات">
                    <FileText className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>

                {/* Profiles Tab */}
                <TabsContent value="profiles" className="space-y-4 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        البروفايلات المحفوظة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {profiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          لا توجد بروفايلات محفوظة
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {profiles.map((profile) => (
                            <div 
                              key={profile.id}
                              className={cn(
                                "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors",
                                currentProfileId === profile.id 
                                  ? "border-primary bg-primary/5" 
                                  : "hover:bg-muted/50"
                              )}
                              onClick={() => handleLoadProfile(profile.id)}
                            >
                              <div>
                                <p className="font-medium text-sm">{profile.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(profile.created_at).toLocaleDateString('ar-LY')}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProfile(profile.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        إنشاء بروفايل جديد
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm">اسم البروفايل</Label>
                        <Input
                          value={newProfileName}
                          onChange={(e) => setNewProfileName(e.target.value)}
                          placeholder="مثال: تصميم شركة XYZ"
                        />
                      </div>
                      <Button 
                        onClick={handleCreateProfile} 
                        className="w-full"
                        disabled={!newProfileName.trim()}
                      >
                        <Plus className="h-4 w-4 ml-2" />
                        حفظ كبروفايل جديد
                      </Button>
                      {currentProfileId && (
                        <Button 
                          onClick={handleUpdateCurrentProfile} 
                          variant="outline"
                          className="w-full"
                        >
                          <Save className="h-4 w-4 ml-2" />
                          تحديث البروفايل الحالي
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Company Tab */}
                <TabsContent value="company" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        بيانات الشركة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm">اسم الشركة</Label>
                        <Input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="اسم الشركة"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">العنوان الفرعي</Label>
                        <Input
                          value={companySubtitle}
                          onChange={(e) => setCompanySubtitle(e.target.value)}
                          placeholder="للدعاية والإعلان"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          عنوان الشركة
                        </Label>
                        <Input
                          value={companyAddress}
                          onChange={(e) => setCompanyAddress(e.target.value)}
                          placeholder="طرابلس – طريق المطار، حي الزهور"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          رقم الهاتف
                        </Label>
                        <Input
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          placeholder="0912612255"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">الشعار</Label>
                        <Select value={logoPath} onValueChange={setLogoPath}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر الشعار" />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_LOGOS.map((logo) => (
                              <SelectItem key={logo} value={logo}>
                                <div className="flex items-center gap-2">
                                  <img src={logo} alt="" className="w-6 h-6 object-contain" />
                                  <span>{logo.split('/').pop()}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {logoPath && (
                          <div className="mt-2 p-2 border rounded-md bg-muted/30">
                            <img src={logoPath} alt="معاينة الشعار" className="max-h-16 mx-auto" />
                          </div>
                        )}
                        <div className="mt-2">
                          <Label className="text-sm text-muted-foreground">أو أدخل مسار مخصص:</Label>
                          <Input
                            value={logoPath}
                            onChange={(e) => setLogoPath(e.target.value)}
                            placeholder="/path/to/logo.svg"
                            dir="ltr"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        خلفية الطباعة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm">خلفية الصفحة</Label>
                        <Select value={printBackground || "__none__"} onValueChange={(v) => setPrintBackground(v === "__none__" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="بدون خلفية" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">بدون خلفية</SelectItem>
                            {AVAILABLE_BACKGROUNDS.filter(bg => bg).map((bg) => (
                              <SelectItem key={bg} value={bg}>
                                {bg.split('/').pop()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {printBackground && (
                          <div className="mt-2 p-2 border rounded-md bg-muted/30">
                            <img src={printBackground} alt="معاينة الخلفية" className="max-h-20 mx-auto opacity-50" />
                          </div>
                        )}
                        <div className="mt-2">
                          <Label className="text-sm text-muted-foreground">أو أدخل مسار مخصص:</Label>
                          <Input
                            value={printBackground}
                            onChange={(e) => setPrintBackground(e.target.value)}
                            placeholder="/path/to/background.svg"
                            dir="ltr"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        الخطوط
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm">عائلة الخط</Label>
                        <Select value={fontFamily} onValueChange={(v) => {
                          setFontFamily(v);
                          // Reset font weight to first available
                          const font = AVAILABLE_FONTS.find(f => f.name === v);
                          if (font) setFontWeight(font.variants[0]);
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر الخط" />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_FONTS.map((font) => (
                              <SelectItem key={font.name} value={font.name}>
                                {font.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">وزن الخط</Label>
                        <Select value={fontWeight} onValueChange={setFontWeight}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر الوزن" />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_FONTS.find(f => f.name === fontFamily)?.variants.map((variant) => (
                              <SelectItem key={variant} value={variant}>
                                {variant}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-3 p-3 border rounded-md bg-muted/30">
                        <p 
                          className="text-center text-lg"
                          style={{ fontFamily: `${fontFamily}, sans-serif` }}
                        >
                          معاينة الخط: {fontFamily} - {fontWeight}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Colors Tab */}
                <TabsContent value="colors" className="space-y-4 mt-0">
                  {/* Page & Background */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Square className="h-4 w-4" />
                        الصفحة والخلفية
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ColorInput
                        label="خلفية الصفحة"
                        value={pageBackgroundColor}
                        onChange={setPageBackgroundColor}
                      />
                      <SliderInput
                        label="شفافية الخلفية"
                        value={bgOpacity}
                        onChange={setBgOpacity}
                        min={5}
                        max={100}
                        unit="%"
                      />
                    </CardContent>
                  </Card>

                  {/* Invoice Title & Header */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        عنوان الفاتورة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ColorInput
                        label="لون عنوان INVOICE"
                        value={invoiceTitleColor}
                        onChange={setInvoiceTitleColor}
                      />
                      <ColorInput
                        label="لون عناوين الأقسام"
                        value={sectionTitleColor}
                        onChange={setSectionTitleColor}
                      />
                    </CardContent>
                  </Card>

                  {/* Customer Info Section */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        قسم بيانات العميل
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ColorInput
                        label="خلفية بيانات العميل"
                        value={customerInfoBgColor}
                        onChange={setCustomerInfoBgColor}
                      />
                      <SliderInput
                        label="شفافية خلفية بيانات العميل"
                        value={customerInfoBgOpacity}
                        onChange={setCustomerInfoBgOpacity}
                        min={0}
                        max={100}
                        unit="%"
                      />
                      <ColorInput
                        label="لون حد بيانات العميل"
                        value={customerInfoBorderColor}
                        onChange={setCustomerInfoBorderColor}
                      />
                    </CardContent>
                  </Card>

                  {/* Table Colors */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Table className="h-4 w-4" />
                        ألوان الجدول
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ColorInput
                        label="لون رأس الجدول"
                        value={tableHeaderColor}
                        onChange={setTableHeaderColor}
                      />
                      <ColorInput
                        label="لون نص الرأس"
                        value={headerTextColor}
                        onChange={setHeaderTextColor}
                      />
                      <ColorInput
                        label="لون الحدود"
                        value={tableBorderColor}
                        onChange={setTableBorderColor}
                      />
                      <ColorInput
                        label="لون الصفوف الزوجية"
                        value={tableRowEvenColor}
                        onChange={setTableRowEvenColor}
                      />
                      <ColorInput
                        label="لون الصفوف الفردية"
                        value={tableRowOddColor}
                        onChange={setTableRowOddColor}
                      />
                      <SliderInput
                        label="شفافية خلفية الصفوف"
                        value={tableRowOpacity}
                        onChange={setTableRowOpacity}
                        min={0}
                        max={100}
                        unit="%"
                      />
                      <ColorInput
                        label="لون نص الجدول"
                        value={tableTextColor}
                        onChange={setTableTextColor}
                      />
                    </CardContent>
                  </Card>

                  {/* Totals Section */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        قسم المجاميع
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ColorInput
                        label="لون تسميات المجاميع"
                        value={totalsLabelColor}
                        onChange={setTotalsLabelColor}
                      />
                      <ColorInput
                        label="خلفية المجموع الكلي"
                        value={grandTotalBgColor}
                        onChange={setGrandTotalBgColor}
                      />
                      <SliderInput
                        label="شفافية خلفية المجموع الكلي"
                        value={grandTotalBgOpacity}
                        onChange={setGrandTotalBgOpacity}
                        min={0}
                        max={100}
                        unit="%"
                      />
                      <ColorInput
                        label="لون نص المجموع الكلي"
                        value={grandTotalTextColor}
                        onChange={setGrandTotalTextColor}
                      />
                      <ColorInput
                        label="خلفية المبلغ بالكلمات"
                        value={amountWordsBgColor}
                        onChange={setAmountWordsBgColor}
                      />
                      <SliderInput
                        label="شفافية خلفية المبلغ بالكلمات"
                        value={amountWordsBgOpacity}
                        onChange={setAmountWordsBgOpacity}
                        min={0}
                        max={100}
                        unit="%"
                      />
                      <ColorInput
                        label="لون حد المبلغ بالكلمات"
                        value={amountWordsBorderColor}
                        onChange={setAmountWordsBorderColor}
                      />
                    </CardContent>
                  </Card>

                  {/* Footer Colors */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlignVerticalJustifyStart className="h-4 w-4" />
                        ألوان التذييل
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ColorInput
                        label="لون نص التذييل"
                        value={footerTextColor}
                        onChange={setFooterTextColor}
                      />
                      <ColorInput
                        label="لون حد التذييل"
                        value={footerBorderColor}
                        onChange={setFooterBorderColor}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Table Tab */}
                <TabsContent value="table" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        أحجام الخطوط
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <SliderInput
                        label="حجم خط العنوان"
                        value={titleFontSize}
                        onChange={setTitleFontSize}
                        min={10}
                        max={20}
                        unit="px"
                      />
                      <SliderInput
                        label="حجم خط الرأس"
                        value={headerFontSize}
                        onChange={setHeaderFontSize}
                        min={8}
                        max={16}
                        unit="px"
                      />
                      <SliderInput
                        label="حجم خط الجدول"
                        value={tableFontSize}
                        onChange={setTableFontSize}
                        min={8}
                        max={14}
                        unit="px"
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Square className="h-4 w-4" />
                        شكل الجدول
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <SliderInput
                        label="سمك الحدود"
                        value={borderWidth}
                        onChange={setBorderWidth}
                        min={0}
                        max={3}
                        unit="px"
                      />
                      <SliderInput
                        label="استدارة الزوايا"
                        value={borderRadius}
                        onChange={setBorderRadius}
                        min={0}
                        max={10}
                        unit="px"
                      />
                      <SliderInput
                        label="المسافة الداخلية للخلايا"
                        value={cellPadding}
                        onChange={setCellPadding}
                        min={2}
                        max={12}
                        unit="px"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Layout Tab */}
                <TabsContent value="layout" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        الخلفية
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <SliderInput
                        label="إزاحة X"
                        value={bgPosX}
                        onChange={setBgPosX}
                        min={-50}
                        max={50}
                        unit="mm"
                      />
                      <SliderInput
                        label="إزاحة Y"
                        value={bgPosY}
                        onChange={setBgPosY}
                        min={-50}
                        max={50}
                        unit="mm"
                      />
                      <SliderInput
                        label="الحجم"
                        value={bgScale}
                        onChange={setBgScale}
                        min={50}
                        max={150}
                        unit="%"
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Layout className="h-4 w-4" />
                        الهوامش
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <SliderInput
                        label="الهامش العلوي"
                        value={padTop}
                        onChange={setPadTop}
                        min={10}
                        max={100}
                        unit="mm"
                      />
                      <SliderInput
                        label="الهامش الأيمن"
                        value={padRight}
                        onChange={setPadRight}
                        min={5}
                        max={40}
                        unit="mm"
                      />
                      <SliderInput
                        label="الهامش الأيسر"
                        value={padLeft}
                        onChange={setPadLeft}
                        min={5}
                        max={40}
                        unit="mm"
                      />
                      <SliderInput
                        label="الهامش السفلي"
                        value={padBottom}
                        onChange={setPadBottom}
                        min={10}
                        max={60}
                        unit="mm"
                      />
                      <SliderInput
                        label="أقصى ارتفاع للمحتوى"
                        value={contentMaxH}
                        onChange={setContentMaxH}
                        min={100}
                        max={250}
                        unit="mm"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Footer Tab */}
                <TabsContent value="footer" className="space-y-4 mt-0">
                  {/* Header Settings */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        إعدادات الرأس (Header)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <Label className="text-sm">إظهار الرأس كاملاً</Label>
                        <Switch
                          checked={headerEnabled}
                          onCheckedChange={setHeaderEnabled}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <Label className="text-sm">إظهار الشعار</Label>
                        <Switch
                          checked={logoEnabled}
                          onCheckedChange={setLogoEnabled}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <Label className="text-sm">إظهار معلومات الشركة</Label>
                        <Switch
                          checked={companyInfoEnabled}
                          onCheckedChange={setCompanyInfoEnabled}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        يمكنك إخفاء الشعار أو معلومات الشركة بشكل منفصل
                      </p>
                    </CardContent>
                  </Card>

                  {/* Footer Settings */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlignVerticalJustifyStart className="h-4 w-4" />
                        إعدادات التذييل (Footer)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <Label className="text-sm">إظهار التذييل</Label>
                        <Switch
                          checked={footerEnabled}
                          onCheckedChange={setFooterEnabled}
                        />
                      </div>

                      {footerEnabled && (
                        <>
                          <SliderInput
                            label="ارتفاع التذييل"
                            value={footerHeight}
                            onChange={setFooterHeight}
                            min={5}
                            max={30}
                            unit="mm"
                          />
                          <SliderInput
                            label="المسافة من الأسفل"
                            value={footerBottom}
                            onChange={setFooterBottom}
                            min={5}
                            max={40}
                            unit="mm"
                          />
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Page Numbering */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        ترقيم الصفحات
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <Label className="text-sm">إظهار رقم الصفحة</Label>
                        <Switch
                          checked={pageNumberEnabled}
                          onCheckedChange={setPageNumberEnabled}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        يظهر رقم الصفحة في أسفل كل صفحة عند الطباعة
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Sizes Invoice Tab */}
                <TabsContent value="sizes" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        إعدادات فاتورة المقاسات
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm">عنوان الفاتورة</Label>
                        <Input
                          value={sizesInvoiceTitle}
                          onChange={(e) => setSizesInvoiceTitle(e.target.value)}
                          placeholder="كشف المقاسات"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">العنوان الفرعي (إنجليزي)</Label>
                        <Input
                          value={sizesInvoiceSubtitle}
                          onChange={(e) => setSizesInvoiceSubtitle(e.target.value)}
                          placeholder="SIZES STATEMENT"
                          dir="ltr"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Table className="h-4 w-4" />
                        عناصر العرض
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <div>
                          <Label className="text-sm">فصل لوحات الوجه الواحد</Label>
                          <p className="text-xs text-muted-foreground">عرض لوحات الوجه الواحد في جدول منفصل</p>
                        </div>
                        <Switch
                          checked={sizesShowSingleFaceSeparately}
                          onCheckedChange={setSizesShowSingleFaceSeparately}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <div>
                          <Label className="text-sm">إظهار الأبعاد</Label>
                          <p className="text-xs text-muted-foreground">عرض العرض والارتفاع بالمتر</p>
                        </div>
                        <Switch
                          checked={sizesShowDimensions}
                          onCheckedChange={setSizesShowDimensions}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <div>
                          <Label className="text-sm">إظهار عدد الأوجه</Label>
                          <p className="text-xs text-muted-foreground">عرض عمود عدد الأوجه</p>
                        </div>
                        <Switch
                          checked={sizesShowFacesCount}
                          onCheckedChange={setSizesShowFacesCount}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <div>
                          <Label className="text-sm">إظهار مساحة الوجه</Label>
                          <p className="text-xs text-muted-foreground">عرض المساحة لكل وجه</p>
                        </div>
                        <Switch
                          checked={sizesShowAreaPerFace}
                          onCheckedChange={setSizesShowAreaPerFace}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <div>
                          <Label className="text-sm">إظهار المساحة الكلية</Label>
                          <p className="text-xs text-muted-foreground">عرض إجمالي المساحة</p>
                        </div>
                        <Switch
                          checked={sizesShowTotalArea}
                          onCheckedChange={setSizesShowTotalArea}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-700">
                      <strong>ملاحظة:</strong> فاتورة المقاسات تستخدم إعدادات الألوان والخطوط من التابات الأخرى (الألوان، الشركة، الجدول).
                    </p>
                  </div>
                </TabsContent>
                {/* Extras Tab - ختم وتحويلات */}
                <TabsContent value="extras" className="space-y-4 mt-0">
                  <InvoiceExtrasSettings />
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}

        {/* Sidebar Footer - Actions */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t bg-muted/30 space-y-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="ml-2 h-4 w-4" />
                  حفظ الإعدادات
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="w-full"
            >
              <RotateCcw className="ml-2 h-4 w-4" />
              إعادة الضبط
            </Button>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-muted/30 rounded-lg border p-6 overflow-auto">
        <div className="mb-4 flex items-center justify-between">
          <div></div>
          <div className="text-center">
            <h3 className="text-lg font-bold">معاينة حية للطباعة</h3>
            <p className="text-sm text-muted-foreground">التغييرات تظهر مباشرة</p>
          </div>
          <div className="flex items-center gap-2 bg-card rounded-lg border p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPreviewScale(Math.max(0.3, previewScale - 0.1))}
              disabled={previewScale <= 0.3}
              title="تصغير"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono w-14 text-center">{Math.round(previewScale * 100)}%</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPreviewScale(Math.min(1, previewScale + 0.1))}
              disabled={previewScale >= 1}
              title="تكبير"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPreviewScale(1)}
              title="الحجم الكامل"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* A4 Invoice Preview - 2 Pages */}
        <div className="flex flex-col gap-8 items-center">
          {/* Page 1 */}
          <div
            className="relative shadow-2xl transition-transform duration-200 overflow-hidden"
            style={{
              width: '210mm',
              height: '297mm',
              maxWidth: '100%',
              transform: `scale(${previewScale})`,
              transformOrigin: 'top center',
              fontFamily: `${fontFamily}, 'Noto Sans Arabic', Arial, sans-serif`,
              direction: 'rtl',
              padding: '15mm',
              backgroundColor: pageBackgroundColor,
            }}
          >
            {/* Background Layer */}
            {(printBackground || reportBackground) && (
              <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                  backgroundImage: printBackground ? `url(${printBackground})` : (reportBackground ? `url(${reportBackground})` : 'none'),
                  backgroundRepeat: "no-repeat",
                  backgroundSize: `${bgScale}%`,
                  backgroundPosition: `${bgPosX}mm ${bgPosY}mm`,
                  opacity: bgOpacity / 100,
                }}
              />
            )}

            {/* Content Wrapper - Above Background */}
            <div className="relative z-10 h-full flex flex-col">

            {/* Header Section - uses visibility to keep space */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '25px',
                borderBottom: headerEnabled ? `2px solid ${sectionTitleColor}` : 'none',
                paddingBottom: '15px',
                visibility: headerEnabled ? 'visible' : 'hidden',
              }}
            >
              {/* Company Info - Right Side */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
                {logoPath && logoEnabled && (
                  <img 
                    src={logoPath} 
                    alt="شعار الشركة" 
                    style={{ 
                      maxWidth: '180px',
                      height: 'auto',
                      objectFit: 'contain',
                      marginBottom: '8px',
                    }} 
                  />
                )}
                {companyInfoEnabled && (
                  <div style={{ fontSize: '11px', color: footerTextColor, lineHeight: '1.6', textAlign: 'right' }}>
                    {companyAddress}<br/>
                    هاتف: {companyPhone}
                  </div>
                )}
              </div>

              {/* Invoice Info - Left Side */}
              <div style={{ textAlign: 'left', direction: 'ltr' }}>
                <div style={{ 
                  fontSize: '28px', 
                  fontWeight: 'bold', 
                  color: invoiceTitleColor,
                  marginBottom: '8px',
                  fontFamily: 'Manrope, sans-serif',
                }}>
                  INVOICE
                </div>
                <div style={{ fontSize: '11px', color: footerTextColor, lineHeight: '1.6' }}>
                  رقم الفاتورة: INV-1809<br/>
                  التاريخ: {new Date().toLocaleDateString('ar-LY')}<br/>
                  رقم العقد: 1809
                </div>
              </div>
            </div>

            <div
              style={{
                background: hexToRgba(customerInfoBgColor, customerInfoBgOpacity),
                padding: '16px',
                marginBottom: '20px',
                borderRight: `4px solid ${customerInfoBorderColor}`,
              }}
            >
              <div style={{ 
                fontSize: `${titleFontSize}px`, 
                fontWeight: 'bold', 
                marginBottom: '10px',
                color: sectionTitleColor,
              }}>
                بيانات العميل
              </div>
              <div style={{ fontSize: '12px', lineHeight: '1.6', color: tableTextColor }}>
                <strong>الاسم:</strong> محمد توفيق الأنصاري<br/>
                <strong>الشركة:</strong> شركة الأمنية للتسويق والإعلان<br/>
                <strong>الهاتف:</strong> 0913421002 - 0923456789<br/>
                <strong>مدة العقد:</strong> 11 نوفمبر 2025 إلى 11 فبراير 2026 (92 يوم)
              </div>
            </div>

            {/* Items Table - Page 1 */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: '20px',
                tableLayout: 'fixed',
                flex: '1',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: tableHeaderColor }}>
                  <th style={{ width: '8%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>#</th>
                  <th style={{ width: '34%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>الوصف / المقاس</th>
                  <th style={{ width: '12%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>الكمية</th>
                  <th style={{ width: '12%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>عدد الأوجه</th>
                  <th style={{ width: '17%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>السعر الوحدة</th>
                  <th style={{ width: '17%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>المجموع</th>
                </tr>
              </thead>
              <tbody>
                {page1Data.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor: hexToRgba(idx % 2 === 0 ? tableRowEvenColor : tableRowOddColor, tableRowOpacity),
                    }}
                  >
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'center', border: `1px solid ${tableBorderColor}`, color: tableTextColor }}>{idx + 1}</td>
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'right', border: `1px solid ${tableBorderColor}`, color: tableTextColor }}>{row.description}</td>
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'center', border: `1px solid ${tableBorderColor}`, color: tableTextColor, fontFamily: 'Manrope, sans-serif' }}>{row.quantity}</td>
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'center', border: `1px solid ${tableBorderColor}`, color: tableTextColor, fontFamily: 'Manrope, sans-serif' }}>{row.faces}</td>
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'center', border: `1px solid ${tableBorderColor}`, color: tableTextColor }}>
                      <span style={{ fontFamily: 'Manrope, sans-serif', direction: 'ltr', display: 'inline-block' }}>{row.unitPrice}</span>
                      <span style={{ marginRight: '4px' }}>د.ل</span>
                    </td>
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'center', border: `1px solid ${tableBorderColor}`, color: tableTextColor, fontWeight: 'bold' }}>
                      <span style={{ fontFamily: 'Manrope, sans-serif', direction: 'ltr', display: 'inline-block' }}>{row.total}</span>
                      <span style={{ marginRight: '4px' }}>د.ل</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer - uses visibility to keep space */}
            <div style={{ marginTop: 'auto' }}>
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '10px',
                  color: footerTextColor,
                  borderTop: footerEnabled ? `1px solid ${footerBorderColor}` : 'none',
                  paddingTop: '12px',
                  visibility: footerEnabled ? 'visible' : 'hidden',
                }}
              >
                شكراً لتعاملكم معنا | Thank you for your business<br/>
                يتبع في الصفحة التالية...
              </div>

              {/* Page Number */}
              <div
                style={{
                  marginTop: '10px',
                  textAlign: 'center',
                  fontSize: '9px',
                  color: footerTextColor,
                  visibility: pageNumberEnabled ? 'visible' : 'hidden',
                }}
              >
                صفحة 1 من {totalPages}
              </div>
            </div>
            </div> {/* End Content Wrapper */}
          </div>

          {/* Page 2 */}
          {page2Data.length > 0 && (
          <div
            className="relative shadow-2xl transition-transform duration-200 overflow-hidden"
            style={{
              width: '210mm',
              height: '297mm',
              maxWidth: '100%',
              transform: `scale(${previewScale})`,
              transformOrigin: 'top center',
              fontFamily: `${fontFamily}, 'Noto Sans Arabic', Arial, sans-serif`,
              direction: 'rtl',
              padding: '15mm',
              backgroundColor: pageBackgroundColor,
            }}
          >
            {/* Background Layer */}
            {(printBackground || reportBackground) && (
              <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                  backgroundImage: printBackground ? `url(${printBackground})` : (reportBackground ? `url(${reportBackground})` : 'none'),
                  backgroundRepeat: "no-repeat",
                  backgroundSize: `${bgScale}%`,
                  backgroundPosition: `${bgPosX}mm ${bgPosY}mm`,
                  opacity: bgOpacity / 100,
                }}
              />
            )}

            {/* Content Wrapper - Above Background */}
            <div className="relative z-10 h-full flex flex-col">

            {/* Header Section - uses visibility to keep space */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '25px',
                borderBottom: headerEnabled ? `2px solid ${sectionTitleColor}` : 'none',
                paddingBottom: '15px',
                visibility: headerEnabled ? 'visible' : 'hidden',
              }}
            >
              {/* Company Info - Right Side */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
                {logoPath && logoEnabled && (
                  <img 
                    src={logoPath} 
                    alt="شعار الشركة" 
                    style={{ 
                      maxWidth: '180px',
                      height: 'auto',
                      objectFit: 'contain',
                      marginBottom: '8px',
                    }} 
                  />
                )}
                {companyInfoEnabled && (
                  <div style={{ fontSize: '11px', color: footerTextColor, lineHeight: '1.6', textAlign: 'right' }}>
                    {companyAddress}<br/>
                    هاتف: {companyPhone}
                  </div>
                )}
              </div>

              {/* Invoice Info - Left Side */}
              <div style={{ textAlign: 'left', direction: 'ltr' }}>
                <div style={{ 
                  fontSize: '28px', 
                  fontWeight: 'bold', 
                  color: invoiceTitleColor,
                  marginBottom: '8px',
                  fontFamily: 'Manrope, sans-serif',
                }}>
                  INVOICE
                </div>
                <div style={{ fontSize: '11px', color: footerTextColor, lineHeight: '1.6' }}>
                  رقم الفاتورة: INV-1809<br/>
                  التاريخ: {new Date().toLocaleDateString('ar-LY')}<br/>
                  رقم العقد: 1809
                </div>
              </div>
            </div>

            {/* Continuation notice */}
            <div style={{ 
              fontSize: '11px', 
              color: footerTextColor, 
              marginBottom: '15px',
              padding: '8px',
              background: hexToRgba(customerInfoBgColor, customerInfoBgOpacity),
              borderRight: `4px solid ${customerInfoBorderColor}`,
            }}>
              تكملة الفاتورة - العميل: محمد توفيق الأنصاري
            </div>

            {/* Items Table - Page 2 */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: '20px',
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: tableHeaderColor }}>
                  <th style={{ width: '8%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>#</th>
                  <th style={{ width: '34%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>الوصف / المقاس</th>
                  <th style={{ width: '12%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>الكمية</th>
                  <th style={{ width: '12%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>عدد الأوجه</th>
                  <th style={{ width: '17%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>السعر الوحدة</th>
                  <th style={{ width: '17%', padding: `${cellPadding}px`, color: headerTextColor, fontSize: `${headerFontSize}px`, fontWeight: 'bold', textAlign: 'center', border: `1px solid ${tableBorderColor}` }}>المجموع</th>
                </tr>
              </thead>
              <tbody>
                {page2Data.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor: hexToRgba(idx % 2 === 0 ? tableRowEvenColor : tableRowOddColor, tableRowOpacity),
                    }}
                  >
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'center', border: `1px solid ${tableBorderColor}`, color: tableTextColor }}>{itemsPerPage + idx + 1}</td>
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'right', border: `1px solid ${tableBorderColor}`, color: tableTextColor }}>{row.description}</td>
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'center', border: `1px solid ${tableBorderColor}`, color: tableTextColor, fontFamily: 'Manrope, sans-serif' }}>{row.quantity}</td>
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'center', border: `1px solid ${tableBorderColor}`, color: tableTextColor, fontFamily: 'Manrope, sans-serif' }}>{row.faces}</td>
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'center', border: `1px solid ${tableBorderColor}`, color: tableTextColor }}>
                      <span style={{ fontFamily: 'Manrope, sans-serif', direction: 'ltr', display: 'inline-block' }}>{row.unitPrice}</span>
                      <span style={{ marginRight: '4px' }}>د.ل</span>
                    </td>
                    <td style={{ padding: `${cellPadding}px`, fontSize: `${tableFontSize}px`, textAlign: 'center', border: `1px solid ${tableBorderColor}`, color: tableTextColor, fontWeight: 'bold' }}>
                      <span style={{ fontFamily: 'Manrope, sans-serif', direction: 'ltr', display: 'inline-block' }}>{row.total}</span>
                      <span style={{ marginRight: '4px' }}>د.ل</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Section */}
            <div style={{ marginTop: 'auto', borderTop: `2px solid ${sectionTitleColor}`, paddingTop: '15px' }}>
              {/* Subtotal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: '14px', fontWeight: 'bold', borderBottom: `1px solid ${footerBorderColor}`, marginBottom: '8px', color: totalsLabelColor }}>
                <span>المجموع الفرعي:</span>
                <span style={{ direction: 'ltr' }}>
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 'bold' }}>190,790.6</span>
                  <span style={{ marginRight: '6px' }}>د.ل</span>
                </span>
              </div>

              {/* Discount */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: '14px', fontWeight: 'bold', color: '#28a745', marginBottom: '8px' }}>
                <span>خصم (15%):</span>
                <span style={{ direction: 'ltr' }}>
                  <span style={{ fontFamily: 'Manrope, sans-serif' }}>- 28,618.6</span>
                  <span style={{ marginRight: '6px' }}>د.ل</span>
                </span>
              </div>

              {/* Grand Total */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '16px 20px', 
                fontSize: '18px', 
                fontWeight: 'bold',
                backgroundColor: hexToRgba(grandTotalBgColor, grandTotalBgOpacity),
                color: grandTotalTextColor,
                marginTop: '10px',
                borderRadius: `${borderRadius}px`,
              }}>
                <span>المجموع الإجمالي:</span>
                <span style={{ direction: 'ltr' }}>
                  <span style={{ fontFamily: 'Manrope, sans-serif', color: '#FFD700', fontWeight: '800', textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>162,172.0</span>
                  <span style={{ marginRight: '6px', color: grandTotalTextColor }}>د.ل</span>
                </span>
              </div>

              {/* Amount in words */}
              <div style={{ 
                marginTop: '12px', 
                fontSize: '12px', 
                textAlign: 'center',
                background: hexToRgba(amountWordsBgColor, amountWordsBgOpacity),
                border: `1px solid ${amountWordsBorderColor}`,
                padding: '10px',
                borderRadius: `${borderRadius}px`,
                color: totalsLabelColor,
              }}>
                المبلغ بالكلمات: مائة واثنان وستون ألفاً ومائة واثنان وسبعون ديناراً ليبياً<br/>
                <small style={{ color: '#28a745' }}>* تم تطبيق خصم 15% بقيمة 28,618.6 دينار ليبي</small><br/>
                <small style={{ color: '#6c757d' }}>* الأسعار غير شاملة تكلفة الطباعة</small>
              </div>
            </div>

            {/* Footer - uses visibility to keep space */}
            <div
              style={{
                marginTop: '20px',
                textAlign: 'center',
                fontSize: '10px',
                color: footerTextColor,
                borderTop: footerEnabled ? `1px solid ${footerBorderColor}` : 'none',
                paddingTop: '12px',
                visibility: footerEnabled ? 'visible' : 'hidden',
              }}
            >
              شكراً لتعاملكم معنا | Thank you for your business<br/>
              هذه فاتورة إلكترونية ولا تحتاج إلى ختم أو توقيع
            </div>

            {/* Page Number */}
            <div
              style={{
                marginTop: '10px',
                textAlign: 'center',
                fontSize: '9px',
                color: footerTextColor,
                visibility: pageNumberEnabled ? 'visible' : 'hidden',
              }}
            >
              صفحة 2 من {totalPages}
            </div>
            </div> {/* End Content Wrapper */}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintDesign;
