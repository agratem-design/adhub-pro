import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Printer, Check, Image, Layers, FileText, Users, Settings, Loader2, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';
import { formatFacesCountArabic } from '@/lib/utils';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';

// Print modes
const PRINT_MODES = {
  default: 'الافتراضي',
  with_design: 'مع تصميم مرفق',
  without_design: 'بدون تصميم',
  two_faces: 'وجهين (أمامي وخلفي)',
  two_faces_with_designs: 'وجهين مع التصاميم',
  single_face: 'وجه واحد',
  single_installation_with_designs: 'صورة تركيب واحدة + التصاميم',
};

interface BillboardData {
  ID: number;
  Billboard_Name: string;
  Size: string;
  Level?: string;
  Faces_Count: number;
  Municipality: string;
  District: string;
  Nearest_Landmark: string;
  Image_URL: string;
  GPS_Coordinates?: string;
  GPS_Link?: string;
  has_cutout?: boolean;
  design_face_a?: string | null;
  design_face_b?: string | null;
  installed_image_url?: string | null;
  installed_image_face_a_url?: string | null;
  installed_image_face_b_url?: string | null;
  cutout_image_url?: string | null;
  installation_date?: string;
  team_name?: string;
}

interface BillboardBulkPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboards: BillboardData[];
  contractInfo: {
    number: number;
    customerName: string;
    adType?: string;
    startDate?: string;
    endDate?: string;
  };
  isOffer?: boolean;
}

export function BillboardBulkPrintDialog({
  open,
  onOpenChange,
  billboards,
  contractInfo,
  isOffer = false,
}: BillboardBulkPrintDialogProps) {
  const [selectedBillboards, setSelectedBillboards] = useState<number[]>([]);
  const [useSmartMode, setUseSmartMode] = useState(true);
  const [currentMode, setCurrentMode] = useState<string>('default');
  const [bulkPrintMode, setBulkPrintMode] = useState<'customer' | 'team' | 'both'>('customer');
  const [hideBackground, setHideBackground] = useState(false);
  const [showDesignsInPrint, setShowDesignsInPrint] = useState(true);
  const [showCutoutsInPrint, setShowCutoutsInPrint] = useState(true);
  const [showInstallationImagesInPrint, setShowInstallationImagesInPrint] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeProfileName, setActiveProfileName] = useState<string>('');
  const [loadedProfileSettings, setLoadedProfileSettings] = useState<any>(null);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string>('');

  // Fetch print settings
  const { data: settings } = useQuery({
    queryKey: ['billboard-print-settings', currentMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_print_settings')
        .select('*')
        .eq('setting_key', currentMode)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch global settings
  const { data: globalSettings } = useQuery({
    queryKey: ['billboard-print-settings-global'],
    queryFn: async () => {
      let { data } = await supabase
        .from('billboard_print_settings')
        .select('*')
        .eq('setting_key', 'global')
        .maybeSingle();
      
      if (!data) {
        const { data: defaultData } = await supabase
          .from('billboard_print_settings')
          .select('*')
          .eq('setting_key', 'default')
          .maybeSingle();
        return defaultData;
      }
      return data;
    },
    enabled: open,
  });

  // Fetch profiles
  const { data: profiles } = useQuery({
    queryKey: ['billboard-print-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_print_profiles')
        .select('*')
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Load default profile
  useEffect(() => {
    if (profiles && profiles.length > 0) {
      const defaultProfile = profiles.find((p: any) => p.is_default);
      if (defaultProfile) {
        loadProfile(defaultProfile);
      }
    }
  }, [profiles]);

  const loadProfile = (profile: any) => {
    const data = profile.settings_data as any;
    if (data) {
      // تحميل الإعدادات الكاملة من البروفايل
      if (data.currentMode) {
        setCurrentMode(data.currentMode);
      }
      if (data.settings) {
        // حفظ إعدادات البروفايل لاستخدامها في الطباعة
        setLoadedProfileSettings({
          background_url: data.settings.background_url,
          background_width: data.settings.background_width,
          background_height: data.settings.background_height,
          elements: data.settings.elements,
          primary_font: data.settings.primary_font,
          secondary_font: data.settings.secondary_font,
        });
      }
      setActiveProfileId(profile.id);
      setActiveProfileName(profile.profile_name);
    }
  };

  // Reset selection when billboards change
  useEffect(() => {
    if (billboards.length > 0 && open) {
      setSelectedBillboards(billboards.map(b => b.ID));
    }
  }, [billboards, open]);

  const toggleBillboardSelection = (id: number) => {
    setSelectedBillboards(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllBillboards = () => {
    setSelectedBillboards(billboards.map(b => b.ID));
  };

  const deselectAllBillboards = () => {
    setSelectedBillboards([]);
  };

  // Smart mode detection for each billboard
  const getSmartModeForBillboard = (billboard: BillboardData): string => {
    const hasTwoFaceInstallation = billboard?.installed_image_face_a_url && billboard?.installed_image_face_b_url;
    const hasSingleInstallation = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
    const hasTwoDesigns = billboard?.design_face_a && billboard?.design_face_b;
    const hasSingleDesign = billboard?.design_face_a && !billboard?.design_face_b;
    
    if (hasTwoFaceInstallation && hasTwoDesigns) return 'two_faces_with_designs';
    if (hasTwoFaceInstallation) return 'two_faces';
    if (hasSingleInstallation && (hasSingleDesign || hasTwoDesigns)) return 'single_installation_with_designs';
    if (hasSingleInstallation) return 'single_face';
    if (hasTwoDesigns || hasSingleDesign) return 'with_design';
    
    return 'default';
  };

  // Get visible elements for mode
  const getVisibleElements = (mode: string): string[] => {
    const baseElements = ['contractNumber', 'adType', 'billboardName', 'size', 'facesCount', 'image', 'locationInfo', 'landmarkInfo', 'qrCode', 'installationDate'];
    
    switch (mode) {
      case 'with_design':
        return [...baseElements, 'designs', 'printType'];
      case 'without_design':
        return [...baseElements, 'printType'];
      case 'two_faces':
        return [...baseElements, 'faceAImage', 'faceBImage', 'printType'];
      case 'two_faces_with_designs':
        return [...baseElements, 'twoFacesContainer', 'designs', 'printType'];
      case 'single_face':
        return [...baseElements, 'singleInstallationImage', 'printType'];
      case 'single_installation_with_designs':
        return [...baseElements, 'singleInstallationImage', 'designs', 'printType'];
      default:
        return [...baseElements, 'designs', 'printType'];
    }
  };

  // Generate QR code
  const generateQRCode = async (billboard: BillboardData): Promise<string> => {
    const mapLink = billboard?.GPS_Link || 
      (billboard?.GPS_Coordinates ? `https://www.google.com/maps?q=${encodeURIComponent(billboard.GPS_Coordinates)}` : 
      `https://fares.sa/billboard/${billboard?.ID}`);
    
    try {
      return await QRCode.toDataURL(mapLink, { width: 260, margin: 1, errorCorrectionLevel: 'M' });
    } catch {
      return '';
    }
  };

  // Generate HTML for single billboard page
  const generateBillboardPageHTML = async (
    billboard: BillboardData, 
    printMode: 'customer' | 'team',
    mode: string
  ): Promise<string> => {
    const qrUrl = await generateQRCode(billboard);
    // ✅ استخدام الخلفية المخصصة أولاً، ثم إعدادات البروفايل، ثم الإعدادات الافتراضية
    const elements = (loadedProfileSettings?.elements || settings?.elements || globalSettings?.elements || {}) as Record<string, any>;
    const bgUrl = customBackgroundUrl || loadedProfileSettings?.background_url || globalSettings?.background_url || settings?.background_url || '/ipg.svg';
    
    const allowedElements = getVisibleElements(mode);
    
    const getElementSettings = (key: string) => elements[key] || {};
    
    const getBorderRadius = (element: any) => {
      if (element.borderRadiusTopLeft || element.borderRadiusTopRight || 
          element.borderRadiusBottomLeft || element.borderRadiusBottomRight) {
        return `${element.borderRadiusTopRight || '0px'} ${element.borderRadiusTopLeft || '0px'} ${element.borderRadiusBottomLeft || '0px'} ${element.borderRadiusBottomRight || '0px'}`;
      }
      return element.borderRadius || '0';
    };
    
    let html = '';
    
    Object.entries(elements).forEach(([key, element]: [string, any]) => {
      if (printMode === 'customer' && key === 'printType') return;
      if (!element.visible || !allowedElements.includes(key)) return;
      
      // Skip elements based on user settings
      if (key === 'designs' && !showDesignsInPrint) return;
      if (key === 'cutoutImage' && !showCutoutsInPrint) return;
      const installationImageElements = ['faceAImage', 'faceBImage', 'twoFacesContainer', 'singleInstallationImage', 'linkedInstallationImages'];
      if (installationImageElements.includes(key) && !showInstallationImagesInPrint) return;
      
      let style = `position: absolute; font-size: ${element.fontSize || '14px'}; font-weight: ${element.fontWeight || '400'}; color: ${element.color || '#000'}; direction: rtl; unicode-bidi: embed;`;
      if (element.fontFamily && element.fontFamily !== 'inherit') style += ` font-family: ${element.fontFamily};`;
      if (element.width) style += ` width: ${element.width};`;
      if (element.height) style += ` height: ${element.height};`;
      if (element.textAlign) style += ` text-align: ${element.textAlign};`;
      if (element.top) style += ` top: ${element.top};`;
      if (element.left) style += ` left: ${element.left};`;
      if (element.right) style += ` right: ${element.right};`;
      if (element.bottom) style += ` bottom: ${element.bottom};`;
      
      const transforms: string[] = [];
      if (element.left?.includes('%') && element.textAlign === 'center') transforms.push('translateX(-50%)');
      if (element.rotation && element.rotation !== '0') transforms.push(`rotate(${element.rotation}deg)`);
      if (transforms.length > 0) style += ` transform: ${transforms.join(' ')};`;
      
      let content = '';
      const borderRadius = getBorderRadius(element);
      const objectFit = element.objectFit || 'contain';
      const objectPosition = element.objectPosition || 'center';
      
      switch (key) {
        case 'contractNumber':
          content = isOffer ? `عرض رقم: ${contractInfo.number}` : `عقد رقم: ${contractInfo.number}`;
          break;
        case 'adType':
          content = `${element.label || 'نوع الإعلان:'} ${contractInfo.adType || ''}`;
          break;
        case 'billboardName':
          content = billboard.Billboard_Name || '';
          break;
        case 'size':
          content = billboard.Size || '';
          break;
        case 'facesCount':
          content = formatFacesCountArabic(billboard.Faces_Count || 1);
          break;
        case 'locationInfo':
          content = `${billboard.Municipality || ''} - ${billboard.District || ''}`;
          break;
        case 'landmarkInfo':
          content = billboard.Nearest_Landmark || '';
          break;
        case 'installationDate':
          const installDate = billboard.installation_date || contractInfo.startDate;
          content = installDate 
            ? `تاريخ التركيب: ${new Date(installDate).toLocaleDateString('en-GB')}`
            : '';
          break;
        case 'printType':
          content = printMode === 'team' ? (billboard.team_name || 'فريق التركيب') : 'نسخة العميل';
          break;
        case 'image': {
          // ✅ دعم أسماء حقول متعددة للصورة الافتراضية
          const defaultImage = billboard.Image_URL || (billboard as any).image_url || (billboard as any).image || (billboard as any).billboard_image || '';
          const imgUrl = billboard.installed_image_url || defaultImage || '/placeholder.svg';
          const borderStyle = `border: ${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}; border-radius: ${borderRadius};`;
          content = `<img src="${imgUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${objectFit}; object-position: ${objectPosition}; ${borderStyle}" />`;
          break;
        }
        case 'qrCode':
          if (qrUrl) content = `<img src="${qrUrl}" style="width: 100%; height: 100%; object-fit: contain;" />`;
          break;
        case 'designs': {
          const designA = billboard.design_face_a;
          const designB = billboard.design_face_b;
          const designBorderStyle = `border: ${element.borderWidth || '1px'} solid ${element.borderColor || '#ddd'}; border-radius: ${borderRadius};`;
          content = `
            <div style="display: flex; gap: ${element.gap || '12px'}; height: 100%; align-items: center; justify-content: center;">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%;">
                ${designA ? `<img src="${designA}" style="max-width: 100%; max-height: 100%; object-fit: ${objectFit}; object-position: ${objectPosition}; ${designBorderStyle}" />` : ''}
              </div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%;">
                ${designB ? `<img src="${designB}" style="max-width: 100%; max-height: 100%; object-fit: ${objectFit}; object-position: ${objectPosition}; ${designBorderStyle}" />` : ''}
              </div>
            </div>
          `;
          break;
        }
        case 'cutoutImage':
          if (billboard.cutout_image_url) {
            const cutoutBorderStyle = `border: ${element.borderWidth || '2px'} solid ${element.borderColor || '#000'}; border-radius: ${borderRadius};`;
            content = `<img src="${billboard.cutout_image_url}" style="max-width: 100%; max-height: 100%; object-fit: ${objectFit}; object-position: ${objectPosition}; ${cutoutBorderStyle}" />`;
          }
          break;
        case 'singleInstallationImage': {
          // ✅ دعم أسماء حقول متعددة للصورة الافتراضية
          const defaultImg = billboard.Image_URL || (billboard as any).image_url || (billboard as any).image || '';
          const singleInstallUrl = billboard.installed_image_face_a_url || billboard.installed_image_url || defaultImg || '/placeholder.svg';
          const singleBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
          content = `<img src="${singleInstallUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${objectFit}; object-position: ${objectPosition}; ${singleBorderStyle}" />`;
          break;
        }
        case 'faceAImage': {
          if (mode === 'two_faces_with_designs') break;
          // ✅ دعم أسماء حقول متعددة للصورة الافتراضية
          const defaultImgA = billboard.Image_URL || (billboard as any).image_url || (billboard as any).image || '';
          const faceAUrl = billboard.installed_image_face_a_url || billboard.installed_image_url || defaultImgA || '/placeholder.svg';
          const faceABorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
          content = `<img src="${faceAUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${objectFit}; object-position: ${objectPosition}; ${faceABorderStyle}" />`;
          break;
        }
        case 'faceBImage': {
          if (mode === 'two_faces_with_designs') break;
          // ✅ دعم أسماء حقول متعددة للصورة الافتراضية للوجه الخلفي
          const defaultImgB = billboard.Image_URL || (billboard as any).image_url || (billboard as any).image || '';
          const faceBUrl = billboard.installed_image_face_b_url || (billboard.Faces_Count > 1 ? defaultImgB : null) || '/placeholder.svg';
          const faceBBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
          content = `<img src="${faceBUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${objectFit}; object-position: ${objectPosition}; ${faceBBorderStyle}" />`;
          break;
        }
        case 'twoFacesContainer': {
          if (mode !== 'two_faces_with_designs') break;
          // ✅ دعم أسماء حقول متعددة للصورة الافتراضية
          const defaultImgTwo = billboard.Image_URL || (billboard as any).image_url || (billboard as any).image || '/placeholder.svg';
          const faceAUrl = billboard.installed_image_face_a_url || billboard.installed_image_url || defaultImgTwo;
          const faceBUrl = billboard.installed_image_face_b_url || (billboard.Faces_Count > 1 ? defaultImgTwo : null);
          const containerBorderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${borderRadius};`;
          const gapValue = element.gap || '20px';
          
          content = `
            <div style="display: flex; gap: ${gapValue}; height: 100%; align-items: center; justify-content: center;">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${faceAUrl ? `<img src="${faceAUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${objectFit}; object-position: ${objectPosition}; ${containerBorderStyle}" />` : ''}
              </div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
                ${faceBUrl ? `<img src="${faceBUrl}" style="max-width: 100%; max-height: 100%; object-fit: ${objectFit}; object-position: ${objectPosition}; ${containerBorderStyle}" />` : ''}
              </div>
            </div>
          `;
          break;
        }
      }
      
      if (content) html += `<div style="${style}">${content}</div>`;
    });
    
    return `
      <div class="print-page">
        ${!hideBackground ? `<img class="background" src="${bgUrl}" />` : ''}
        ${html}
      </div>
    `;
  };

  // Handle print
  const handlePrint = async () => {
    if (selectedBillboards.length === 0) {
      toast.error('يرجى اختيار لوحات للطباعة');
      return;
    }
    
    const docTitle = `طباعة لوحات ${isOffer ? 'العرض' : 'العقد'} #${contractInfo.number}`;
    const printWindow = preparePrintWindow(docTitle);
    setIsPrinting(true);
    
    try {
      const billboardsToPrint = billboards.filter(b => selectedBillboards.includes(b.ID));
      // ✅ استخدام إعدادات البروفايل المحمّلة أولاً
      const primaryFont = loadedProfileSettings?.primary_font || globalSettings?.primary_font || settings?.primary_font || 'Doran';
      
      // Generate pages
      const pages: string[] = [];
      
      for (const bb of billboardsToPrint) {
        const mode = useSmartMode ? getSmartModeForBillboard(bb) : currentMode;
        
        if (bulkPrintMode === 'both') {
          // Generate both customer and team versions
          const customerPage = await generateBillboardPageHTML(bb, 'customer', mode);
          const teamPage = await generateBillboardPageHTML(bb, 'team', mode);
          pages.push(customerPage, teamPage);
        } else {
          const page = await generateBillboardPageHTML(bb, bulkPrintMode, mode);
          pages.push(page);
        }
      }
      
      const content = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${docTitle}</title>
          <style>
            @page { size: A4; margin: 0; }
            body { margin: 0; padding: 0; font-family: ${primaryFont}, Arial, sans-serif; }
            .print-page {
              width: 210mm;
              height: 297mm;
              position: relative;
              overflow: hidden;
              page-break-after: always;
            }
            .print-page img.background {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${pages.join('\n')}
        </body>
        </html>
      `;
      
      writePrintWindow(printWindow, content, {
        title: docTitle,
        landscape: false,
        showDownloadPdf: true,
        showShare: true,
        autoPrint: true,
      });
      
    } catch (error) {
      console.error('Print error:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            طباعة لوحات {isOffer ? 'العرض' : 'العقد'} #{contractInfo.number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto space-y-4 py-4">
          {/* Smart Mode Toggle */}
          <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold flex items-center gap-2">
                <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span className="text-green-700 dark:text-green-400">الوضع الذكي التلقائي</span>
              </Label>
              <Switch
                checked={useSmartMode}
                onCheckedChange={setUseSmartMode}
              />
            </div>
            {useSmartMode && (
              <p className="text-xs text-green-700 dark:text-green-400 bg-green-500/10 rounded-lg p-2">
                سيتم تحديد وضع الطباعة المناسب لكل لوحة تلقائياً بناءً على محتوياتها
              </p>
            )}
          </div>

          {/* Print Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Copy Type */}
            <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
              <Label className="text-sm font-bold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                نوع النسخة
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={bulkPrintMode === 'customer' ? 'default' : 'outline'}
                  onClick={() => setBulkPrintMode('customer')}
                  className="flex-1"
                  size="sm"
                >
                  <FileText className="h-4 w-4 ml-1" />
                  عميل
                </Button>
                <Button 
                  variant={bulkPrintMode === 'team' ? 'default' : 'outline'}
                  onClick={() => setBulkPrintMode('team')}
                  className="flex-1"
                  size="sm"
                >
                  <Users className="h-4 w-4 ml-1" />
                  فريق
                </Button>
                <Button 
                  variant={bulkPrintMode === 'both' ? 'default' : 'outline'}
                  onClick={() => setBulkPrintMode('both')}
                  className="flex-1"
                  size="sm"
                >
                  <Layers className="h-4 w-4 ml-1" />
                  كلاهما
                </Button>
              </div>
            </div>

            {/* Display Options */}
            <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Image className="h-4 w-4" />
                إظهار العناصر
              </Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showDesigns"
                    checked={showDesignsInPrint}
                    onCheckedChange={(checked) => setShowDesignsInPrint(checked as boolean)}
                  />
                  <Label htmlFor="showDesigns" className="text-xs cursor-pointer">التصاميم</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showCutouts"
                    checked={showCutoutsInPrint}
                    onCheckedChange={(checked) => setShowCutoutsInPrint(checked as boolean)}
                  />
                  <Label htmlFor="showCutouts" className="text-xs cursor-pointer">المجسمات</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showInstallationImages"
                    checked={showInstallationImagesInPrint}
                    onCheckedChange={(checked) => setShowInstallationImagesInPrint(checked as boolean)}
                  />
                  <Label htmlFor="showInstallationImages" className="text-xs cursor-pointer">صور التركيب</Label>
                </div>
              </div>
            </div>

            {/* Additional Settings */}
            <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Settings className="h-4 w-4" />
                إعدادات
              </Label>
              <div className="flex flex-col gap-3">
                {/* اختيار الخلفية */}
                {!hideBackground && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      الخلفية
                    </Label>
                    <BackgroundSelector
                      value={customBackgroundUrl || loadedProfileSettings?.background_url || globalSettings?.background_url || '/ipg.svg'}
                      onChange={setCustomBackgroundUrl}
                      compact
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hideBackgroundBulk"
                    checked={hideBackground}
                    onCheckedChange={(checked) => setHideBackground(checked as boolean)}
                  />
                  <Label htmlFor="hideBackgroundBulk" className="text-xs cursor-pointer">إخفاء الخلفية</Label>
                </div>
                
                {/* Profile Selection */}
                {profiles && profiles.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    <Label className="text-xs text-muted-foreground">البروفايل</Label>
                    <Select
                      value={activeProfileId || ''}
                      onValueChange={(profileId) => {
                        const profile = profiles.find((p: any) => p.id === profileId);
                        if (profile) loadProfile(profile);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="اختر بروفايل">
                          {activeProfileName || 'اختر بروفايل'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((profile: any) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.profile_name} {profile.is_default && '(افتراضي)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {activeProfileName && (
                      <p className="text-xs text-green-600 dark:text-green-400">
 البروفايل النشط: {activeProfileName}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Manual Mode Selection */}
          {!useSmartMode && (
            <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 space-y-3">
              <Label className="text-sm font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Layers className="h-4 w-4" />
                وضع الطباعة اليدوي
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(PRINT_MODES).map(([key, label]) => (
                  <Button
                    key={key}
                    variant={currentMode === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentMode(key)}
                    className="text-xs"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Selection Tools */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllBillboards}>
                <Check className="h-4 w-4 ml-1" />
                تحديد الكل
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllBillboards}>
                إلغاء التحديد
              </Button>
            </div>
            <span className="text-sm font-medium">
              المحدد: <span className="text-primary font-bold">{selectedBillboards.length}</span> من {billboards.length}
            </span>
          </div>

          {/* Billboards Grid */}
          <ScrollArea className="h-[350px] border rounded-xl p-3 bg-card">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {billboards.map(bb => {
                const isSelected = selectedBillboards.includes(bb.ID);
                const mainImage = bb.installed_image_face_a_url || bb.installed_image_url || bb.Image_URL;
                const hasInstallation = bb.installed_image_face_a_url || bb.installed_image_url;
                const hasTwoFaces = bb.installed_image_face_a_url && bb.installed_image_face_b_url;
                const hasDesign = bb.design_face_a;
                const hasCutout = bb.has_cutout === true;
                
                return (
                  <div 
                    key={bb.ID}
                    onClick={() => toggleBillboardSelection(bb.ID)}
                    className={`relative cursor-pointer rounded-xl border-2 overflow-hidden transition-all ${
                      isSelected 
                        ? 'border-primary shadow-lg shadow-primary/20 scale-[1.02]' 
                        : 'border-border hover:border-primary/50 hover:shadow-md'
                    }`}
                  >
                    {/* Billboard Image */}
                    <div className="aspect-[4/3] bg-muted/30 relative">
                      {mainImage ? (
                        <img 
                          src={mainImage} 
                          alt={bb.Billboard_Name || `لوحة ${bb.ID}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                      
                      {/* Status Badges */}
                      <div className="absolute top-2 right-2 flex flex-col gap-1">
                        {hasTwoFaces && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/90 text-white font-medium">
                            وجهين
                          </span>
                        )}
                        {!hasTwoFaces && hasInstallation && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/90 text-white font-medium">
                            مركبة
                          </span>
                        )}
                        {hasCutout && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/90 text-white font-medium">
                            مجسم
                          </span>
                        )}
                      </div>
                      
                      {/* Selection Indicator */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full p-2">
                            <Check className="h-5 w-5" />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Billboard Info */}
                    <div className="p-2 space-y-1 bg-card">
                      <p className="text-xs font-medium truncate">{bb.Billboard_Name || `لوحة ${bb.ID}`}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{bb.Size}</span>
                        <div className="flex gap-1">
                          {hasDesign && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-600">تصميم</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{bb.Municipality}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
        
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button 
            onClick={handlePrint}
            disabled={selectedBillboards.length === 0 || isPrinting}
          >
            {isPrinting ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جاري الطباعة...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 ml-2" />
                طباعة ({selectedBillboards.length} لوحة)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
