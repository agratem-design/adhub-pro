import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Phone, MapPin, QrCode, Settings, Eye, EyeOff, Save, RotateCcw, Download, Palette, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Municipality {
  id: string;
  name: string;
  logo_url?: string | null;
}

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Municipality: string;
  Size: string;
  GPS_Coordinates: string | null;
  GPS_Link: string | null;
  Nearest_Landmark?: string | null;
  District?: string | null;
  size_id: number | null;
}

interface SizeData {
  id: number;
  name: string;
  sort_order: number;
}

interface SizeConfig {
  visible: boolean;
  stickerWidth: number;
  stickerHeight: number;
}

interface ElementPositions {
  logoHeight: number;
  numberSize: number;
  qrSize: number;
  phoneSize: number;
  infoSize: number;
  topSectionHeight: number;
  bottomSectionHeight: number;
}

interface ElementVisibility {
  companyLogo: boolean;
  municipalityLogo: boolean;
  billboardNumber: boolean;
  billboardName: boolean;
  billboardSize: boolean;
  billboardId: boolean;
  district: boolean;
  nearestLandmark: boolean;
  phoneNumber: boolean;
  whatsappQr: boolean;
  gpsQr: boolean;
  reserveLabel: boolean;
  logosVertical: boolean; // ترتيب الشعارات عموديًا
}

interface ColorSettings {
  borderColor: string;
  numberColor: string;
  textColor: string;
  phoneColor: string;
  qrLabelColor: string;
  dividerColor: string;
}

interface FontSettings {
  main: string;
  number: string;
  info: string;
  phone: string;
}

interface ReserveNumber {
  number: string;
  sizeIndex: number;
}

const DEFAULT_ELEMENT_POSITIONS: ElementPositions = {
  logoHeight: 20,
  numberSize: 28,
  qrSize: 22,
  phoneSize: 6,
  infoSize: 4,
  topSectionHeight: 22,
  bottomSectionHeight: 28,
};

const DEFAULT_VISIBILITY: ElementVisibility = {
  companyLogo: true,
  municipalityLogo: true,
  billboardNumber: true,
  billboardName: true,
  billboardSize: true,
  billboardId: true,
  district: true,
  nearestLandmark: true,
  phoneNumber: true,
  whatsappQr: true,
  gpsQr: true,
  reserveLabel: true,
  logosVertical: false,
};

const DEFAULT_COLORS: ColorSettings = {
  borderColor: '#000000',
  numberColor: '#000000',
  textColor: '#000000',
  phoneColor: '#000000',
  qrLabelColor: '#000000',
  dividerColor: '#000000',
};

const DEFAULT_FONTS: FontSettings = {
  main: 'Doran',
  number: 'Doran',
  info: 'Doran',
  phone: 'Doran',
};

// PDF / طباعة - ثوابت ورق A4
const A4_PAGE_WIDTH_MM = 210;
const A4_PAGE_HEIGHT_MM = 297;
const PDF_MARGIN_MM = 10;

const FONT_OPTIONS = [
  { value: 'Doran', label: 'Doran' },
  { value: 'Manrope', label: 'Manrope' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'sans-serif', label: 'Sans Serif' },
];

export default function MunicipalityStickers() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [sizes, setSizes] = useState<SizeData[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [useUnifiedSize, setUseUnifiedSize] = useState<boolean>(false);
  const [unifiedSizeWidth, setUnifiedSizeWidth] = useState<number>(30);
  const [unifiedSizeHeight, setUnifiedSizeHeight] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [qrCodes, setQrCodes] = useState<{ [key: string]: { whatsapp: string; gps: string } }>({});
  const [sizeConfigs, setSizeConfigs] = useState<{ [sizeName: string]: SizeConfig }>({});
  const [elementPositions, setElementPositions] = useState<ElementPositions>(DEFAULT_ELEMENT_POSITIONS);
  const [elementVisibility, setElementVisibility] = useState<ElementVisibility>(DEFAULT_VISIBILITY);
  const [colorSettings, setColorSettings] = useState<ColorSettings>(DEFAULT_COLORS);
  const [fontSettings, setFontSettings] = useState<FontSettings>(DEFAULT_FONTS);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [printLayoutMode, setPrintLayoutMode] = useState<'single' | 'grouped'>('single');
  
  // Reserve numbers
  const [reserveCount, setReserveCount] = useState<number>(0);
  const [maxNumber, setMaxNumber] = useState<number | null>(null);
  const [reserveNumbers, setReserveNumbers] = useState<ReserveNumber[]>([]);
  
  // PDF / SVG generation
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [exportingSvg, setExportingSvg] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Load saved settings from database on mount
  useEffect(() => {
    loadSettingsFromDatabase();
  }, []);

  const loadSettingsFromDatabase = async () => {
    try {
      const result: any = await supabase
        .from('municipality_stickers_settings' as any)
        .select('*')
        .eq('setting_name', 'default')
        .maybeSingle();

      const data = result?.data as any;
      const error = result?.error;

      if (error) {
        console.error('Error loading settings:', error);
        return;
      }

      if (data) {
        setSettingsId(data.id);
        if (data.phone_number) setPhoneNumber(data.phone_number);
        if (data.use_unified_size !== null) setUseUnifiedSize(data.use_unified_size);
        if (data.unified_size_width) setUnifiedSizeWidth(Number(data.unified_size_width));
        if (data.unified_size_height) setUnifiedSizeHeight(Number(data.unified_size_height));
        if (data.reserve_count) setReserveCount(data.reserve_count);
        if (data.max_number) setMaxNumber(data.max_number);
        if (data.element_positions) setElementPositions(data.element_positions as unknown as ElementPositions);
        if (data.element_visibility) setElementVisibility(data.element_visibility as unknown as ElementVisibility);
        if (data.color_settings) setColorSettings(data.color_settings as unknown as ColorSettings);
        if (data.font_settings) setFontSettings(data.font_settings as unknown as FontSettings);
        if (data.size_configs) setSizeConfigs(data.size_configs as unknown as { [sizeName: string]: SizeConfig });
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  // Save settings to database
  const saveSettings = useCallback(async () => {
    setSavingSettings(true);
    try {
      const settingsData = {
        setting_name: 'default',
        phone_number: phoneNumber,
        use_unified_size: useUnifiedSize,
        unified_size_width: unifiedSizeWidth,
        unified_size_height: unifiedSizeHeight,
        reserve_count: reserveCount,
        max_number: maxNumber,
        element_positions: JSON.parse(JSON.stringify(elementPositions)),
        element_visibility: JSON.parse(JSON.stringify(elementVisibility)),
        color_settings: JSON.parse(JSON.stringify(colorSettings)),
        font_settings: JSON.parse(JSON.stringify(fontSettings)),
        size_configs: JSON.parse(JSON.stringify(sizeConfigs)),
        updated_at: new Date().toISOString(),
      };

      if (settingsId) {
        const { error } = await supabase
          .from('municipality_stickers_settings' as any)
          .update(settingsData)
          .eq('id', settingsId);
        
        if (error) throw error;
      } else {
        const result: any = await supabase
          .from('municipality_stickers_settings' as any)
          .insert(settingsData)
          .select('id')
          .single();
        
        const { data, error } = result as { data: any; error: any };
        
        if (error) throw error;
        if (data) setSettingsId((data as any).id);
      }

      toast.success('تم حفظ الإعدادات في قاعدة البيانات');
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('خطأ في حفظ الإعدادات');
    } finally {
      setSavingSettings(false);
    }
  }, [settingsId, phoneNumber, useUnifiedSize, unifiedSizeWidth, unifiedSizeHeight, reserveCount, maxNumber, elementPositions, elementVisibility, colorSettings, fontSettings, sizeConfigs]);

  const resetSettings = async () => {
    setElementPositions(DEFAULT_ELEMENT_POSITIONS);
    setElementVisibility(DEFAULT_VISIBILITY);
    setColorSettings(DEFAULT_COLORS);
    setFontSettings(DEFAULT_FONTS);
    setSizeConfigs({});
    setReserveCount(0);
    setMaxNumber(null);
    
    if (settingsId) {
      try {
        await supabase
          .from('municipality_stickers_settings' as any)
          .delete()
          .eq('id', settingsId);
        setSettingsId(null);
      } catch (e) {
        console.error('Error deleting settings:', e);
      }
    }
    
    toast.success('تم إعادة تعيين الإعدادات');
  };

  useEffect(() => {
    fetchMunicipalities();
    fetchSizes();
  }, []);

  useEffect(() => {
    if (selectedMunicipality) {
      fetchBillboards();
    }
  }, [selectedMunicipality]);

  useEffect(() => {
    if ((billboards.length > 0 || reserveNumbers.length > 0) && phoneNumber) {
      generateQRCodes();
    }
  }, [billboards, phoneNumber, reserveNumbers]);

  // Generate reserve numbers when count changes
  useEffect(() => {
    if (reserveCount > 0 && sizes.length > 0) {
      const baseIndex = billboards.length;
      const newReserve: ReserveNumber[] = [];
      for (let i = 0; i < reserveCount; i++) {
        newReserve.push({
          number: String(baseIndex + i + 1).padStart(3, '0'),
          sizeIndex: 0,
        });
      }
      setReserveNumbers(newReserve);
    } else {
      setReserveNumbers([]);
    }
  }, [reserveCount, billboards.length, sizes]);

  // Initialize size configs when sizes load
  useEffect(() => {
    if (sizes.length > 0 && Object.keys(sizeConfigs).length === 0) {
      const newConfigs: { [sizeName: string]: SizeConfig } = {};
      sizes.forEach(size => {
        newConfigs[size.name] = {
          visible: true,
          stickerWidth: 30,
          stickerHeight: 30,
        };
      });
      setSizeConfigs(newConfigs);
    }
  }, [sizes, sizeConfigs]);

  const fetchMunicipalities = async () => {
    const { data, error } = await supabase
      .from('municipalities')
      .select('*')
      .order('name');

    if (error) {
      toast.error('خطأ في جلب البلديات');
      return;
    }
    setMunicipalities(data || []);
  };

  const fetchSizes = async () => {
    const { data, error } = await supabase
      .from('sizes')
      .select('id, name, sort_order')
      .order('sort_order');

    if (error) {
      console.error('Error fetching sizes:', error);
      return;
    }
    setSizes(data || []);
  };

  const fetchBillboards = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('billboards')
      .select('ID, Billboard_Name, Municipality, Size, GPS_Coordinates, GPS_Link, Nearest_Landmark, District, size_id')
      .eq('Municipality', selectedMunicipality)
      .order('ID');

    if (error) {
      toast.error('خطأ في جلب اللوحات');
      setLoading(false);
      return;
    }
    
    const sortedBillboards = (data || []).sort((a, b) => {
      const sizeA = sizes.find(s => s.id === a.size_id || s.name === a.Size);
      const sizeB = sizes.find(s => s.id === b.size_id || s.name === b.Size);
      const orderA = sizeA?.sort_order ?? 999;
      const orderB = sizeB?.sort_order ?? 999;
      return orderA - orderB;
    });
    
    setBillboards(sortedBillboards);
    setLoading(false);
  };

  // دالة تحويل الإحداثيات إلى رابط Google Maps
  const buildGoogleMapsUrl = (coords: string | null | undefined): string => {
    if (!coords || coords.trim() === '') {
      return 'https://www.google.com/maps';
    }

    // تنظيف الإحداثيات (يدعم الفاصلة العربية)
    const cleanCoords = coords
      .trim()
      .replace(/\s+/g, '')
      .replace(/،/g, ',');

    // التحقق من صيغة الإحداثيات (lat,lng أو lat lng)
    const parts = cleanCoords.split(/[\s,]+/).filter(Boolean);
    if (parts.length >= 2) {
      const lat = parts[0];
      const lng = parts[1];
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }

    return `https://www.google.com/maps/search/${encodeURIComponent(cleanCoords)}`;
  };

  const generateQRCodes = async () => {
    const codes: { [key: string]: { whatsapp: string; gps: string } } = {};
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`;

    try {
      // واتساب QR واحد لجميع الملصقات (لتسريع الأداء)
      const whatsappQR = await QRCode.toDataURL(whatsappUrl, {
        width: 260,
        margin: 1,
        errorCorrectionLevel: 'M',
      });

      // For billboards
      for (const billboard of billboards) {
        // المطلوب: الاعتماد على GPS_Coordinates أولاً (إن وُجدت)، ثم GPS_Link كبديل
        const hasCoords = Boolean(billboard.GPS_Coordinates && billboard.GPS_Coordinates.trim() !== '');
        const hasLink = Boolean(billboard.GPS_Link && billboard.GPS_Link.trim() !== '');

        const gpsUrl = hasCoords
          ? buildGoogleMapsUrl(billboard.GPS_Coordinates)
          : hasLink
            ? (billboard.GPS_Link as string)
            : 'https://www.google.com/maps';

        try {
          const gpsQR = await QRCode.toDataURL(gpsUrl, {
            width: 260,
            margin: 1,
            errorCorrectionLevel: 'M',
          });

          codes[`bb-${billboard.ID}`] = { whatsapp: whatsappQR, gps: gpsQR };
        } catch (error) {
          console.error('Error generating QR codes:', error);
        }
      }

      // For reserve numbers
      for (let i = 0; i < reserveNumbers.length; i++) {
        codes[`reserve-${i}`] = { whatsapp: whatsappQR, gps: whatsappQR };
      }

      setQrCodes(codes);
    } catch (error) {
      console.error('Error generating QR codes:', error);
    }
  };

  const getMunicipalityLogo = () => {
    const municipality = municipalities.find(m => m.name === selectedMunicipality);
    return municipality?.logo_url;
  };

  const handlePrint = () => {
    window.print();
  };
  
  // Fixed PDF generation with accurate A4 scaling
  const handleDownloadPDF = async () => {
    setGeneratingPdf(true);
    setPdfProgress(0);
    toast.info('جاري إنشاء ملف PDF...');
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pageWidth = A4_PAGE_WIDTH_MM;
      const pageHeight = A4_PAGE_HEIGHT_MM;
      const margin = PDF_MARGIN_MM;
      const availableHeight = pageHeight - margin * 2; // الارتفاع الفعلي المتاح
      
      // 1) صفحة معلومات الطباعة (الجدول) على الصفحة الأولى
      const summaryElement = document.querySelector('.print-summary-page') as HTMLElement | null;
      if (summaryElement) {
        const summaryCanvas = await html2canvas(summaryElement, {
          scale: 1.5,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
        });
        
        const imgData = summaryCanvas.toDataURL('image/png');
        let imgWidth = pageWidth - margin * 2;
        let imgHeight = (summaryCanvas.height * imgWidth) / summaryCanvas.width;
        
        if (imgHeight > pageHeight - margin * 2) {
          imgHeight = pageHeight - margin * 2;
          imgWidth = (summaryCanvas.width * imgHeight) / summaryCanvas.height;
        }
        
        const x = (pageWidth - imgWidth) / 2;
        const y = margin;
        
        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      }
      
      // 2) تجهيز عناصر الملصقات من الحاوية الخاصة بـ PDF (بأبعاد حقيقية بالسم)
      const stickerElements = Array.from(
        document.querySelectorAll('.sticker-for-pdf') as NodeListOf<HTMLElement>
      );

      if (stickerElements.length === 0) {
        toast.error('لا توجد ملصقات للتصدير');
        setGeneratingPdf(false);
        return;
      }

      // ضمان ثبات القياسات قبل الالتقاط (بدون انتظار إضافي إذا كانت جاهزة)
      try {
        await document.fonts?.ready;
      } catch {
        // ignore
      }

      const imgs = Array.from(document.querySelectorAll('.sticker-for-pdf img')) as HTMLImageElement[];
      await Promise.all(
        imgs.map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  const done = () => resolve();
                  img.addEventListener('load', done, { once: true });
                  img.addEventListener('error', done, { once: true });
                })
        )
      );
      
      // تحويل كل ملصق إلى صورة مرة واحدة (نستخدمها لوضع فردي وتجميع)
      const stickerImages: {
        imgData: string;
        widthPx: number;
        heightPx: number;
        stickerWidthCm: number;
        stickerHeightCm: number;
      }[] = [];
      
      for (let i = 0; i < stickerElements.length; i++) {
        const el = stickerElements[i];
        const canvas = await html2canvas(el, {
          scale: 1.5,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          allowTaint: true,
        });

        const imgData = canvas.toDataURL('image/png');
        const stickerWidthCm = Number(el.dataset.width) || 30;
        const stickerHeightCm = Number(el.dataset.height) || 30;

        stickerImages.push({
          imgData,
          widthPx: canvas.width,
          heightPx: canvas.height,
          stickerWidthCm,
          stickerHeightCm,
        });

        setPdfProgress(Math.round(((i + 1) / stickerElements.length) * 40)); // لحد 40%
        // بدون تأخير إضافي لتسريع إنشاء PDF
      }
      
      if (printLayoutMode === 'single') {
        // وضع فردي: ملصق واحد في كل صفحة A4 مع ضمان عدم تجاوز حجم الورقة
        const availableWidth = pageWidth - margin * 2;
        
        stickerImages.forEach((sticker, index) => {
          pdf.addPage();
          
          const aspectRatio = sticker.widthPx / sticker.heightPx;
          
          // حساب الأبعاد مع الحفاظ على النسبة وعدم تجاوز A4
          let imgWidthMm = availableWidth;
          let imgHeightMm = imgWidthMm / aspectRatio;
          
          // إذا تجاوز الارتفاع، نقلل بناءً على الارتفاع
          if (imgHeightMm > availableHeight) {
            imgHeightMm = availableHeight;
            imgWidthMm = imgHeightMm * aspectRatio;
          }
          
          const x = (pageWidth - imgWidthMm) / 2;
          const y = (pageHeight - imgHeightMm) / 2; // توسيط عمودي
          
          pdf.addImage(sticker.imgData, 'PNG', x, y, imgWidthMm, imgHeightMm);
          // ستروك خارجي لتسهيل القص
          pdf.setLineWidth(0.3);
          pdf.rect(x - 1, y - 1, imgWidthMm + 2, imgHeightMm + 2);
          
          setPdfProgress(40 + Math.round(((index + 1) / stickerImages.length) * 60));
        });
      } else {
        // وضع التجميع: ترتيب الملصقات في شبكة في صفحات A4 متتالية
        pdf.addPage();
        const gapMm = 5;
        const cols = 2; // عمودان لعرض أوضح
        const cellWidthMm = (pageWidth - 2 * margin - (cols - 1) * gapMm) / cols;
        
        let x = margin;
        let y = margin;
        let rowMaxHeightMm = 0;
        
        stickerImages.forEach((sticker, index) => {
          const aspectRatio = sticker.heightPx / sticker.widthPx;
          let imgWidthMm = cellWidthMm;
          let imgHeightMm = imgWidthMm * aspectRatio;
          
          // إن كان الارتفاع أكبر من المساحة المتاحة، صغّر أكثر
          if (imgHeightMm > availableHeight / 2) {
            imgHeightMm = availableHeight / 2;
            imgWidthMm = imgHeightMm / aspectRatio;
          }
          
          // الانتقال لصفحة جديدة عند الامتلاء
          if (y + imgHeightMm > pageHeight - margin) {
            pdf.addPage();
            x = margin;
            y = margin;
            rowMaxHeightMm = 0;
          }
          
          pdf.addImage(sticker.imgData, 'PNG', x, y, imgWidthMm, imgHeightMm);
          pdf.setLineWidth(0.3);
          pdf.rect(x - 1, y - 1, imgWidthMm + 2, imgHeightMm + 2);
          
          rowMaxHeightMm = Math.max(rowMaxHeightMm, imgHeightMm + 2);
          x += cellWidthMm + gapMm;
          
          if (x + cellWidthMm > pageWidth - margin) {
            x = margin;
            y += rowMaxHeightMm + gapMm;
            rowMaxHeightMm = 0;
          }
          
          setPdfProgress(40 + Math.round(((index + 1) / stickerImages.length) * 60));
        });
      }
      
      pdf.save(`ملصقات-${selectedMunicipality || 'بلدية'}.pdf`);
      toast.success('تم حفظ ملف PDF بنجاح');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('خطأ في إنشاء ملف PDF - حاول تقليل عدد الملصقات');
    } finally {
      setGeneratingPdf(false);
      setPdfProgress(0);
    }
  };
  
  // حفظ كـ SVG باستخدام لقطة من معاينة الملصقات
  const handleDownloadSVG = async () => {
    const previewGrid = document.querySelector('.stickers-preview-grid') as HTMLElement | null;
    if (!previewGrid) {
      toast.error('لا توجد ملصقات للحفظ كـ SVG');
      return;
    }
    
    setExportingSvg(true);
    toast.info('جاري إنشاء ملف SVG...');
    
    try {
      const canvas = await html2canvas(previewGrid, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      
      const pngDataUrl = canvas.toDataURL('image/png');
      const svgWidth = canvas.width;
      const svgHeight = canvas.height;
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}"><image href="${pngDataUrl}" width="${svgWidth}" height="${svgHeight}" /></svg>`;
      
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ملصقات-${selectedMunicipality || 'بلدية'}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('تم حفظ ملف SVG بنجاح');
    } catch (error) {
      console.error('Error generating SVG:', error);
      toast.error('خطأ في إنشاء ملف SVG');
    } finally {
      setExportingSvg(false);
    }
  };

  const getStickerSize = (billboard: Billboard | null, sizeIndex?: number): { width: number; height: number } => {
    if (useUnifiedSize) {
      return { width: unifiedSizeWidth, height: unifiedSizeHeight };
    }
    if (billboard) {
      const sizeName = billboard.Size;
      const config = sizeConfigs[sizeName];
      if (config) {
        return { width: config.stickerWidth, height: config.stickerHeight };
      }
    } else if (sizeIndex !== undefined && sizes[sizeIndex]) {
      const sizeName = sizes[sizeIndex].name;
      const config = sizeConfigs[sizeName];
      if (config) {
        return { width: config.stickerWidth, height: config.stickerHeight };
      }
    }
    return { width: 30, height: 30 };
  };

  const isBillboardVisible = (billboard: Billboard): boolean => {
    if (useUnifiedSize) return true;
    const sizeName = billboard.Size;
    const config = sizeConfigs[sizeName];
    return config?.visible !== false;
  };

  const updateSizeConfig = (sizeName: string, updates: Partial<SizeConfig>) => {
    setSizeConfigs(prev => ({
      ...prev,
      [sizeName]: { ...prev[sizeName], ...updates },
    }));
  };

  const updateReserveSize = (index: number, sizeIndex: number) => {
    setReserveNumbers(prev => prev.map((r, i) => 
      i === index ? { ...r, sizeIndex } : r
    ));
  };

  const municipalityLogo = getMunicipalityLogo();

  // Filter visible billboards and group by size
  const visibleBillboards = billboards.filter(isBillboardVisible).filter((_, i) => {
    if (maxNumber) return i + 1 <= maxNumber;
    return true;
  });
  
  const billboardsBySize = visibleBillboards.reduce((acc, bb) => {
    const size = bb.Size || 'غير محدد';
    if (!acc[size]) acc[size] = [];
    acc[size].push(bb);
    return acc;
  }, {} as { [size: string]: Billboard[] });

  // Generate print summary info (مع معلومات السكيل في حالة الطباعة الفردية)
  const availableHeightForScale = A4_PAGE_HEIGHT_MM - PDF_MARGIN_MM * 2;
  const showScaleColumn = printLayoutMode === 'single';
  const printSummary = Object.entries(billboardsBySize).map(([size, bbs]) => {
    const config = sizeConfigs[size] || { stickerWidth: 30, stickerHeight: 30 };
    const stickerSize = useUnifiedSize 
      ? { width: unifiedSizeWidth, height: unifiedSizeHeight }
      : { width: config.stickerWidth, height: config.stickerHeight };
    const scaleToA4Height = showScaleColumn
      ? availableHeightForScale / (stickerSize.height * 10) // السكيل بالنسبة لارتفاع الملصق (مم)
      : null;
    return {
      size,
      count: bbs.length,
      stickerWidth: stickerSize.width,
      stickerHeight: stickerSize.height,
      scaleToA4Height,
      billboardNumbers: bbs.map((_, i) => i + 1),
    };
  });

  return (
    <div className="p-6 space-y-6" data-print-layout={printLayoutMode}>
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ملصقات البلديات</h1>
          <p className="text-muted-foreground">إنشاء وطباعة ملصقات اللوحات الإعلانية</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="h-4 w-4 ml-2" />
            إعدادات التصميم
          </Button>
          <Button 
            onClick={handleDownloadSVG}
            disabled={visibleBillboards.length === 0 || exportingSvg}
            variant="outline"
          >
            {exportingSvg ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                SVG
              </>
            ) : (
              <>
                <Download className="h-4 w-4 ml-2" />
                حفظ SVG
              </>
            )}
          </Button>
          <Button 
            onClick={handleDownloadPDF} 
            disabled={visibleBillboards.length === 0 || generatingPdf}
            variant="default"
          >
            {generatingPdf ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                {pdfProgress}%
              </>
            ) : (
              <>
                <Download className="h-4 w-4 ml-2" />
                تحميل PDF
              </>
            )}
          </Button>
          <Button onClick={handlePrint} disabled={visibleBillboards.length === 0} variant="outline">
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>إعدادات الملصقات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>البلدية</Label>
              <Select value={selectedMunicipality} onValueChange={setSelectedMunicipality}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر البلدية" />
                </SelectTrigger>
                <SelectContent>
                  {municipalities.map((m) => (
                    <SelectItem key={m.id} value={m.name}>
                      <div className="flex items-center gap-2">
                        {m.logo_url && (
                          <img src={m.logo_url} alt="" className="w-5 h-5 object-contain" />
                        )}
                        {m.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>رقم الهاتف / الواتساب</Label>
              <Input
                type="tel"
                placeholder="مثال: 966501234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label>أرقام احتياطية</Label>
              <Input
                type="number"
                placeholder="0"
                value={reserveCount}
                onChange={(e) => setReserveCount(parseInt(e.target.value) || 0)}
                min="0"
                max="100"
              />
            </div>

            <div className="space-y-2">
              <Label>الحد الأقصى للرقم (اختياري)</Label>
              <Input
                type="number"
                placeholder="بدون حد"
                value={maxNumber || ''}
                onChange={(e) => setMaxNumber(e.target.value ? parseInt(e.target.value) : null)}
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label>عدد اللوحات</Label>
              <div className="h-10 flex items-center px-3 bg-muted rounded-md text-foreground font-medium">
                {visibleBillboards.length + reserveNumbers.length} لوحة
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={printLayoutMode === 'single' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPrintLayoutMode('single')}
              >
                طباعة فردية A4
              </Button>
              <Button
                type="button"
                variant={printLayoutMode === 'grouped' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPrintLayoutMode('grouped')}
              >
                تجميع في صفحة واحدة
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              في الوضع الفردي: كل ملصق في صفحة A4 بسكيل ثابت. في وضع التجميع: جميع الملصقات في صفحة واحدة وتقوم المطبعة بعمل السكيل.
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={saveSettings} variant="outline" size="sm" disabled={savingSettings}>
              {savingSettings ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
              حفظ في قاعدة البيانات
            </Button>
            <Button onClick={resetSettings} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 ml-2" />
              إعادة تعيين
            </Button>
          </div>

          {/* Quick toggles */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-4 mb-4">
              <Switch
                checked={elementVisibility.logosVertical}
                onCheckedChange={(v) => setElementVisibility((prev) => ({ ...prev, logosVertical: v }))}
                id="logos-vertical"
              />
              <Label htmlFor="logos-vertical">جعل الشعارات عمودية</Label>
            </div>
          </div>

          {/* Unified Size Option */}
          <div className="mt-4 pt-0">
            <div className="flex items-center gap-4 mb-4">
              <Switch
                checked={useUnifiedSize}
                onCheckedChange={setUseUnifiedSize}
                id="unified-size"
              />
              <Label htmlFor="unified-size">استخدام مقاس موحد لجميع الملصقات</Label>
            </div>
            
            {useUnifiedSize && (
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div className="space-y-2">
                  <Label>العرض (سم)</Label>
                  <Input
                    type="number"
                    value={unifiedSizeWidth}
                    onChange={(e) => setUnifiedSizeWidth(parseFloat(e.target.value) || 30)}
                    placeholder="30"
                    min="10"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الارتفاع (سم)</Label>
                  <Input
                    type="number"
                    value={unifiedSizeHeight}
                    onChange={(e) => setUnifiedSizeHeight(parseFloat(e.target.value) || 30)}
                    placeholder="30"
                    min="10"
                    max="100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Size-specific configurations */}
          {!useUnifiedSize && sizes.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium mb-3">تخصيص مقاس كل حجم لوحة</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sizes.map(size => {
                  const config = sizeConfigs[size.name] || { visible: true, stickerWidth: 30, stickerHeight: 30 };
                  const billboardCount = billboards.filter(b => b.Size === size.name).length;
                  
                  return (
                    <div key={size.id} className={`p-3 border rounded-lg ${!config.visible ? 'opacity-50 bg-muted' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{size.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{billboardCount}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateSizeConfig(size.name, { visible: !config.visible })}
                          >
                            {config.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      {config.visible && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">العرض (سم)</Label>
                            <Input
                              type="number"
                              value={config.stickerWidth}
                              onChange={(e) => updateSizeConfig(size.name, { stickerWidth: parseFloat(e.target.value) || 30 })}
                              className="h-8"
                              min="10"
                              max="100"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">الارتفاع (سم)</Label>
                            <Input
                              type="number"
                              value={config.stickerHeight}
                              onChange={(e) => updateSizeConfig(size.name, { stickerHeight: parseFloat(e.target.value) || 30 })}
                              className="h-8"
                              min="10"
                              max="100"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Design Settings */}
      {showSettings && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              تخصيص التصميم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="positions" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="positions">الأحجام</TabsTrigger>
                <TabsTrigger value="visibility">الإظهار/الإخفاء</TabsTrigger>
                <TabsTrigger value="colors">الألوان</TabsTrigger>
                <TabsTrigger value="fonts">الخطوط</TabsTrigger>
              </TabsList>
              
              <TabsContent value="positions">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label>ارتفاع الشعارات (%)</Label>
                    <Slider
                      value={[elementPositions.logoHeight]}
                      onValueChange={([v]) => setElementPositions(p => ({ ...p, logoHeight: v }))}
                      min={10}
                      max={40}
                      step={1}
                    />
                    <span className="text-sm text-muted-foreground">{elementPositions.logoHeight}%</span>
                  </div>

                  <div className="space-y-3">
                    <Label>حجم رقم اللوحة (%)</Label>
                    <Slider
                      value={[elementPositions.numberSize]}
                      onValueChange={([v]) => setElementPositions(p => ({ ...p, numberSize: v }))}
                      min={15}
                      max={50}
                      step={1}
                    />
                    <span className="text-sm text-muted-foreground">{elementPositions.numberSize}%</span>
                  </div>

                  <div className="space-y-3">
                    <Label>حجم QR (%)</Label>
                    <Slider
                      value={[elementPositions.qrSize]}
                      onValueChange={([v]) => setElementPositions(p => ({ ...p, qrSize: v }))}
                      min={10}
                      max={35}
                      step={1}
                    />
                    <span className="text-sm text-muted-foreground">{elementPositions.qrSize}%</span>
                  </div>

                  <div className="space-y-3">
                    <Label>حجم رقم الهاتف (%)</Label>
                    <Slider
                      value={[elementPositions.phoneSize]}
                      onValueChange={([v]) => setElementPositions(p => ({ ...p, phoneSize: v }))}
                      min={3}
                      max={12}
                      step={0.5}
                    />
                    <span className="text-sm text-muted-foreground">{elementPositions.phoneSize}%</span>
                  </div>

                  <div className="space-y-3">
                    <Label>حجم معلومات اللوحة (%)</Label>
                    <Slider
                      value={[elementPositions.infoSize]}
                      onValueChange={([v]) => setElementPositions(p => ({ ...p, infoSize: v }))}
                      min={2}
                      max={8}
                      step={0.5}
                    />
                    <span className="text-sm text-muted-foreground">{elementPositions.infoSize}%</span>
                  </div>

                  <div className="space-y-3">
                    <Label>ارتفاع القسم العلوي (%)</Label>
                    <Slider
                      value={[elementPositions.topSectionHeight]}
                      onValueChange={([v]) => setElementPositions(p => ({ ...p, topSectionHeight: v }))}
                      min={15}
                      max={35}
                      step={1}
                    />
                    <span className="text-sm text-muted-foreground">{elementPositions.topSectionHeight}%</span>
                  </div>

                  <div className="space-y-3">
                    <Label>ارتفاع القسم السفلي (%)</Label>
                    <Slider
                      value={[elementPositions.bottomSectionHeight]}
                      onValueChange={([v]) => setElementPositions(p => ({ ...p, bottomSectionHeight: v }))}
                      min={20}
                      max={40}
                      step={1}
                    />
                    <span className="text-sm text-muted-foreground">{elementPositions.bottomSectionHeight}%</span>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="visibility">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[
                    { key: 'companyLogo', label: 'شعار الشركة' },
                    { key: 'municipalityLogo', label: 'شعار البلدية' },
                    { key: 'logosVertical', label: 'الشعارات عموديًا' },
                    { key: 'billboardNumber', label: 'رقم اللوحة' },
                    { key: 'billboardName', label: 'اسم اللوحة' },
                    { key: 'billboardSize', label: 'مقاس اللوحة' },
                    { key: 'billboardId', label: 'كود اللوحة' },
                    { key: 'district', label: 'المنطقة' },
                    { key: 'nearestLandmark', label: 'أقرب نقطة دالة' },
                    { key: 'phoneNumber', label: 'رقم الهاتف' },
                    { key: 'whatsappQr', label: 'QR واتساب' },
                    { key: 'gpsQr', label: 'QR الموقع' },
                    { key: 'reserveLabel', label: 'ملصق احتياطي' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
                      <Label>{item.label}</Label>
                      <Switch
                        checked={elementVisibility[item.key as keyof ElementVisibility]}
                        onCheckedChange={(v) => setElementVisibility(prev => ({ ...prev, [item.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="colors">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>لون الإطار</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={colorSettings.borderColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, borderColor: e.target.value }))}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={colorSettings.borderColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, borderColor: e.target.value }))}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>لون الرقم</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={colorSettings.numberColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, numberColor: e.target.value }))}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={colorSettings.numberColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, numberColor: e.target.value }))}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>لون النص</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={colorSettings.textColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, textColor: e.target.value }))}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={colorSettings.textColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, textColor: e.target.value }))}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>لون الهاتف</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={colorSettings.phoneColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, phoneColor: e.target.value }))}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={colorSettings.phoneColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, phoneColor: e.target.value }))}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>لون تسميات QR</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={colorSettings.qrLabelColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, qrLabelColor: e.target.value }))}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={colorSettings.qrLabelColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, qrLabelColor: e.target.value }))}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>لون الفواصل</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={colorSettings.dividerColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, dividerColor: e.target.value }))}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={colorSettings.dividerColor}
                        onChange={(e) => setColorSettings(prev => ({ ...prev, dividerColor: e.target.value }))}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fonts">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label>الخط الرئيسي</Label>
                    <Select value={fontSettings.main} onValueChange={(v) => setFontSettings(prev => ({ ...prev, main: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map(font => (
                          <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>خط الرقم</Label>
                    <Select value={fontSettings.number} onValueChange={(v) => setFontSettings(prev => ({ ...prev, number: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map(font => (
                          <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>خط المعلومات</Label>
                    <Select value={fontSettings.info} onValueChange={(v) => setFontSettings(prev => ({ ...prev, info: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map(font => (
                          <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>خط الهاتف</Label>
                    <Select value={fontSettings.phone} onValueChange={(v) => setFontSettings(prev => ({ ...prev, phone: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map(font => (
                          <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Print Summary */}
      <div className="print-summary-page bg-white p-8 rounded-lg border print:border-0 print:p-0 print:rounded-none">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold" style={{ color: '#000000' }}>معلومات الطباعة</h2>
          <p className="text-lg mt-2" style={{ color: '#000000' }}>
            البلدية: <span className="font-bold">{selectedMunicipality || '—'}</span>
          </p>
          <p className="text-sm mt-1" style={{ color: '#000000' }}>
            وضع الطباعة / PDF: {printLayoutMode === 'single' ? 'طباعة فردية لكل ملصق على صفحة A4 بسكيل ثابت' : 'تجميع الملصقات في صفحة واحدة والمطبعة تقوم بعمل السكيل'}
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-lg" style={{ borderCollapse: 'collapse', color: '#000000' }}>
            <thead>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <th className="p-4 text-right font-bold" style={{ border: '2px solid #000000', color: '#000000' }}>المقاس</th>
                <th className="p-4 text-center font-bold" style={{ border: '2px solid #000000', color: '#000000' }}>العدد</th>
                <th className="p-4 text-center font-bold" style={{ border: '2px solid #000000', color: '#000000' }}>مقاس الملصق</th>
                <th className="p-4 text-right font-bold" style={{ border: '2px solid #000000', color: '#000000' }}>الأرقام</th>
              </tr>
            </thead>
            <tbody>
              {printSummary.map((item, idx) => (
                <tr key={item.size} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td className="p-4 font-semibold" style={{ border: '2px solid #000000', color: '#000000' }}>{item.size}</td>
                  <td className="p-4 text-center font-medium" style={{ border: '2px solid #000000', color: '#000000' }}>{item.count}</td>
                  <td className="p-4 text-center font-medium" style={{ border: '2px solid #000000', color: '#000000' }}>{item.stickerWidth} × {item.stickerHeight} سم</td>
                  <td className="p-4 text-base" style={{ border: '2px solid #000000', color: '#000000' }}>
                    {item.billboardNumbers.slice(0, 20).join(' - ')}{item.billboardNumbers.length > 20 ? ' ...' : ''}
                  </td>
                </tr>
              ))}
              {reserveNumbers.length > 0 && (
                <tr style={{ backgroundColor: '#fef9c3' }}>
                  <td className="p-4 font-semibold" style={{ border: '2px solid #000000', color: '#000000' }}>أرقام احتياطية</td>
                  <td className="p-4 text-center font-medium" style={{ border: '2px solid #000000', color: '#000000' }}>{reserveNumbers.length}</td>
                  <td className="p-4 text-center font-medium" style={{ border: '2px solid #000000', color: '#000000' }}>متنوع</td>
                  <td className="p-4 text-base" style={{ border: '2px solid #000000', color: '#000000' }}>
                    {reserveNumbers.map(r => r.number).join(' - ')}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <td className="p-4 font-bold" style={{ border: '2px solid #000000', color: '#000000' }}>الإجمالي</td>
                <td className="p-4 text-center font-bold" style={{ border: '2px solid #000000', color: '#000000' }}>{visibleBillboards.length + reserveNumbers.length}</td>
                <td className="p-4 text-center" style={{ border: '2px solid #000000', color: '#000000' }} colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Stickers Preview & Print */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground print:hidden">جاري التحميل...</div>
      ) : visibleBillboards.length > 0 || reserveNumbers.length > 0 ? (
        <div className="stickers-container">
          {/* Screen Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 print:hidden stickers-preview-grid">
            {visibleBillboards.map((billboard, index) => (
              <StickerPreview
                key={billboard.ID}
                billboard={billboard}
                index={index}
                size={getStickerSize(billboard)}
                municipalityLogo={municipalityLogo}
                phoneNumber={phoneNumber}
                qrCodes={qrCodes}
                qrKey={`bb-${billboard.ID}`}
                elementPositions={elementPositions}
                elementVisibility={elementVisibility}
                colorSettings={colorSettings}
                fontSettings={fontSettings}
                isPreview={true}
                isReserve={false}
                layoutMode={printLayoutMode}
              />
            ))}
            {reserveNumbers.map((reserve, idx) => (
              <StickerPreview
                key={`reserve-${idx}`}
                billboard={null}
                index={billboards.length + idx}
                size={getStickerSize(null, reserve.sizeIndex)}
                municipalityLogo={municipalityLogo}
                phoneNumber={phoneNumber}
                qrCodes={qrCodes}
                qrKey={`reserve-${idx}`}
                elementPositions={elementPositions}
                elementVisibility={elementVisibility}
                colorSettings={colorSettings}
                fontSettings={fontSettings}
                isPreview={true}
                isReserve={true}
                reserveNumber={reserve.number}
                layoutMode={printLayoutMode}
              />
            ))}
          </div>

          {/* Print Output */}
          <div className="hidden print:block">
            {printLayoutMode === 'single' ? (
              <>
                {visibleBillboards.map((billboard, index) => (
                  <StickerPreview
                    key={billboard.ID}
                    billboard={billboard}
                    index={index}
                    size={getStickerSize(billboard)}
                    municipalityLogo={municipalityLogo}
                    phoneNumber={phoneNumber}
                    qrCodes={qrCodes}
                    qrKey={`bb-${billboard.ID}`}
                    elementPositions={elementPositions}
                    elementVisibility={elementVisibility}
                    colorSettings={colorSettings}
                    fontSettings={fontSettings}
                    isPreview={false}
                    isReserve={false}
                    layoutMode={printLayoutMode}
                  />
                ))}
                {reserveNumbers.map((reserve, idx) => (
                  <StickerPreview
                    key={`reserve-${idx}`}
                    billboard={null}
                    index={billboards.length + idx}
                    size={getStickerSize(null, reserve.sizeIndex)}
                    municipalityLogo={municipalityLogo}
                    phoneNumber={phoneNumber}
                    qrCodes={qrCodes}
                    qrKey={`reserve-${idx}`}
                    elementPositions={elementPositions}
                    elementVisibility={elementVisibility}
                    colorSettings={colorSettings}
                    fontSettings={fontSettings}
                    isPreview={false}
                    isReserve={true}
                    reserveNumber={reserve.number}
                    layoutMode={printLayoutMode}
                  />
                ))}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {visibleBillboards.map((billboard, index) => (
                  <StickerPreview
                    key={billboard.ID}
                    billboard={billboard}
                    index={index}
                    size={getStickerSize(billboard)}
                    municipalityLogo={municipalityLogo}
                    phoneNumber={phoneNumber}
                    qrCodes={qrCodes}
                    qrKey={`bb-${billboard.ID}`}
                    elementPositions={elementPositions}
                    elementVisibility={elementVisibility}
                    colorSettings={colorSettings}
                    fontSettings={fontSettings}
                    isPreview={false}
                    isReserve={false}
                    layoutMode={printLayoutMode}
                  />
                ))}
                {reserveNumbers.map((reserve, idx) => (
                  <StickerPreview
                    key={`reserve-${idx}`}
                    billboard={null}
                    index={billboards.length + idx}
                    size={getStickerSize(null, reserve.sizeIndex)}
                    municipalityLogo={municipalityLogo}
                    phoneNumber={phoneNumber}
                    qrCodes={qrCodes}
                    qrKey={`reserve-${idx}`}
                    elementPositions={elementPositions}
                    elementVisibility={elementVisibility}
                    colorSettings={colorSettings}
                    fontSettings={fontSettings}
                    isPreview={false}
                    isReserve={true}
                    reserveNumber={reserve.number}
                    layoutMode={printLayoutMode}
                  />
                ))}
              </div>
            )}
          </div>

          {/* PDF Generation Container - Hidden but rendered for PDF */}
          <div className="fixed left-[-9999px] top-0" ref={printContainerRef}>
            {visibleBillboards.map((billboard, index) => {
              const size = getStickerSize(billboard);
              return (
                <div
                  key={billboard.ID}
                  className="sticker-for-pdf"
                  data-width={size.width}
                  data-height={size.height}
                  style={{
                    width: `${size.width}cm`,
                    height: `${size.height}cm`,
                  }}
                >
                  <StickerContent
                    billboard={billboard}
                    index={index}
                    size={size}
                    municipalityLogo={municipalityLogo}
                    phoneNumber={phoneNumber}
                    qrCodes={qrCodes}
                    qrKey={`bb-${billboard.ID}`}
                    elementPositions={elementPositions}
                    elementVisibility={elementVisibility}
                    colorSettings={colorSettings}
                    fontSettings={fontSettings}
                    isReserve={false}
                  />
                </div>
              );
            })}
            {reserveNumbers.map((reserve, idx) => {
              const size = getStickerSize(null, reserve.sizeIndex);
              return (
                <div
                  key={`reserve-${idx}`}
                  className="sticker-for-pdf"
                  data-width={size.width}
                  data-height={size.height}
                  style={{
                    width: `${size.width}cm`,
                    height: `${size.height}cm`,
                  }}
                >
                  <StickerContent
                    billboard={null}
                    index={billboards.length + idx}
                    size={size}
                    municipalityLogo={municipalityLogo}
                    phoneNumber={phoneNumber}
                    qrCodes={qrCodes}
                    qrKey={`reserve-${idx}`}
                    elementPositions={elementPositions}
                    elementVisibility={elementVisibility}
                    colorSettings={colorSettings}
                    fontSettings={fontSettings}
                    isReserve={true}
                    reserveNumber={reserve.number}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : selectedMunicipality ? (
        <div className="text-center py-12 text-muted-foreground print:hidden">
          لا توجد لوحات في هذه البلدية
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground print:hidden">
          اختر بلدية لعرض اللوحات
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          
          html, body {
            margin: 0;
            padding: 0;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          body * {
            visibility: hidden;
          }
          
          .print-summary-page,
          .print-summary-page *,
          .stickers-container .print\\:block,
          .stickers-container .print\\:block * {
            visibility: visible !important;
          }
          
          .print-summary-page {
            position: relative;
            background: white !important;
          }
          
          [data-print-layout="single"] .sticker-print-wrapper {
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            justify-content: center;
            align-items: center;
            background: white !important;
          }
          
          [data-print-layout="grouped"] .sticker-print-wrapper {
            page-break-after: auto;
            page-break-inside: avoid;
            display: flex;
            justify-content: center;
            align-items: center;
            background: white !important;
          }
          
          .sticker-card {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}

// Sticker Content Component (shared between preview and PDF)
interface StickerContentProps {
  billboard: Billboard | null;
  index: number;
  size: { width: number; height: number };
  municipalityLogo: string | undefined;
  phoneNumber: string;
  qrCodes: { [key: string]: { whatsapp: string; gps: string } };
  qrKey: string;
  elementPositions: ElementPositions;
  elementVisibility: ElementVisibility;
  colorSettings: ColorSettings;
  fontSettings: FontSettings;
  isReserve: boolean;
  reserveNumber?: string;
}

function StickerContent({
  billboard,
  index,
  size,
  municipalityLogo,
  phoneNumber,
  qrCodes,
  qrKey,
  elementPositions,
  elementVisibility,
  colorSettings,
  fontSettings,
  isReserve,
  reserveNumber,
}: StickerContentProps) {
  const formatBillboardNumber = (idx: number) => String(idx + 1).padStart(3, '0');
  const displayNumber = isReserve ? reserveNumber : formatBillboardNumber(index);
  
  const logoHeight = (size.height * elementPositions.logoHeight) / 100;
  const numberSize = (size.width * elementPositions.numberSize) / 100;
  const qrSize = (size.width * elementPositions.qrSize) / 100;
  const phoneSize = (size.width * elementPositions.phoneSize) / 100;
  const infoSize = (size.width * elementPositions.infoSize) / 100;

  return (
    <div
      className="sticker-card bg-white overflow-hidden"
      style={{
        width: '100%',
        height: '100%',
        border: `3px solid ${colorSettings.borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        fontFamily: fontSettings.main,
      }}
    >
      {/* Logos Section */}
      {(elementVisibility.companyLogo || elementVisibility.municipalityLogo) && (
        <div 
          className={`flex items-center justify-center px-[4%] ${
            elementVisibility.logosVertical ? 'flex-col gap-[2%]' : 'justify-between'
          }`}
          style={{
            height: elementVisibility.logosVertical 
              ? `${elementPositions.topSectionHeight * 1.5}%` 
              : `${elementPositions.topSectionHeight}%`,
            borderBottom: `2px solid ${colorSettings.dividerColor}`,
            minHeight: 0,
          }}
        >
          {elementVisibility.companyLogo && (
            <img
              src="/logofaresgold.svg"
              alt="شعار الشركة"
              style={{
                height: elementVisibility.logosVertical 
                  ? `${logoHeight * 0.7}cm` 
                  : `${logoHeight}cm`,
                maxWidth: elementVisibility.logosVertical ? '70%' : '45%',
                objectFit: 'contain',
              }}
            />
          )}
          
          {/* فاصل أسود أنيق بين الشعارات في الوضع العمودي */}
          {elementVisibility.logosVertical && elementVisibility.companyLogo && elementVisibility.municipalityLogo && (
            <div 
              style={{
                width: '60%',
                height: '2px',
                backgroundColor: colorSettings.dividerColor,
                margin: '0',
              }}
            />
          )}
          
          {elementVisibility.municipalityLogo && (
            municipalityLogo ? (
              <img
                src={municipalityLogo}
                alt="شعار البلدية"
                style={{
                  height: elementVisibility.logosVertical 
                    ? `${logoHeight * 0.7}cm` 
                    : `${logoHeight}cm`,
                  maxWidth: elementVisibility.logosVertical ? '70%' : '45%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div 
                className="bg-gray-100 rounded-full flex items-center justify-center"
                style={{
                  width: elementVisibility.logosVertical 
                    ? `${logoHeight * 0.7}cm` 
                    : `${logoHeight}cm`,
                  height: elementVisibility.logosVertical 
                    ? `${logoHeight * 0.7}cm` 
                    : `${logoHeight}cm`,
                }}
              >
                <MapPin className="text-gray-400" style={{ width: '50%', height: '50%' }} />
              </div>
            )
          )}
        </div>
      )}

      {/* Main Content - Billboard Number */}
      <div 
        className="flex-1 flex flex-col items-center justify-center"
        style={{ padding: '2%', overflow: 'hidden' }}
      >
        {elementVisibility.billboardNumber && (
          <div 
            className="font-black tracking-wider"
            style={{
              fontSize: `${numberSize}cm`,
              lineHeight: 1.1,
              letterSpacing: '0.05em',
              color: colorSettings.numberColor,
              fontFamily: fontSettings.number,
            }}
          >
            {displayNumber}
          </div>
        )}

        {billboard && (
          <div className="text-center mt-[2%]" style={{ fontFamily: fontSettings.info }}>
            {elementVisibility.billboardName && (
              <div 
                className="font-bold"
                style={{ 
                  fontSize: `${infoSize * 1.3}cm`,
                  color: colorSettings.textColor,
                }}
              >
                {billboard.Billboard_Name}
              </div>
            )}
            {elementVisibility.billboardSize && (
              <div 
                className="font-medium"
                style={{ 
                  fontSize: `${infoSize}cm`,
                  color: colorSettings.qrLabelColor,
                }}
              >
                {billboard.Size}
              </div>
            )}
            {elementVisibility.billboardId && (
              <div 
                className="font-mono"
                style={{ 
                  fontSize: `${infoSize * 0.9}cm`,
                  color: colorSettings.qrLabelColor,
                }}
              >
                #{billboard.ID}
              </div>
            )}

            {elementVisibility.district && billboard.District && (
              <div
                className="font-medium"
                style={{
                  fontSize: `${infoSize * 0.85}cm`,
                  color: colorSettings.textColor,
                }}
              >
                {billboard.District}
              </div>
            )}

            {elementVisibility.nearestLandmark && billboard.Nearest_Landmark && (
              <div
                className="font-medium"
                style={{
                  fontSize: `${infoSize * 0.85}cm`,
                  color: colorSettings.textColor,
                }}
              >
                {billboard.Nearest_Landmark}
              </div>
            )}
          </div>
        )}

        {isReserve && elementVisibility.reserveLabel && (
          <div 
            className="font-medium mt-2"
            style={{ 
              fontSize: `${infoSize}cm`,
              color: colorSettings.qrLabelColor,
              fontFamily: fontSettings.info,
            }}
          >
            ملصق احتياطي
          </div>
        )}
      </div>

      {/* Bottom Section */}
      {(elementVisibility.gpsQr || elementVisibility.phoneNumber || elementVisibility.whatsappQr) && (
        <div 
          style={{
            height: `${elementPositions.bottomSectionHeight}%`,
            borderTop: `2px solid ${colorSettings.dividerColor}`,
            padding: '2% 3%',
            minHeight: 0,
          }}
        >
          <div className="flex items-center justify-between h-full gap-[2%]">
            {/* GPS QR */}
            {elementVisibility.gpsQr && !isReserve && (
              <div className="flex flex-col items-center justify-center">
                {qrCodes[qrKey]?.gps ? (
                  <img
                    src={qrCodes[qrKey].gps}
                    alt="QR إحداثيات"
                    style={{
                      width: `${qrSize}cm`,
                      height: `${qrSize}cm`,
                    }}
                  />
                ) : (
                  <div 
                    className="bg-gray-100 rounded flex items-center justify-center"
                    style={{
                      width: `${qrSize}cm`,
                      height: `${qrSize}cm`,
                    }}
                  >
                    <QrCode className="text-gray-400" style={{ width: '50%', height: '50%' }} />
                  </div>
                )}
                <span 
                  className="font-medium"
                  style={{ 
                    fontSize: `${infoSize * 0.8}cm`,
                    marginTop: '1mm',
                    color: colorSettings.qrLabelColor,
                    fontFamily: fontSettings.info,
                  }}
                >
                  الموقع
                </span>
              </div>
            )}

            {/* Phone Number */}
            {elementVisibility.phoneNumber && (
              <div className="flex-1 flex flex-col items-center justify-center" style={{ fontFamily: fontSettings.phone }}>
                <div className="flex items-center gap-[2mm]" style={{ color: colorSettings.phoneColor }}>
                  <Phone style={{ 
                    width: `${phoneSize}cm`,
                    height: `${phoneSize}cm`,
                  }} />
                  <span 
                    className="font-bold tracking-wide" 
                    dir="ltr"
                    style={{ fontSize: `${phoneSize * 1.1}cm` }}
                  >
                    {phoneNumber || '---'}
                  </span>
                </div>
                <div className="flex items-center gap-[1mm] text-green-600 mt-[1mm]">
                  <svg 
                    viewBox="0 0 24 24" 
                    fill="currentColor"
                    style={{ 
                      width: `${phoneSize * 0.8}cm`,
                      height: `${phoneSize * 0.8}cm`,
                    }}
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  <span 
                    className="font-semibold"
                    style={{ fontSize: `${phoneSize * 0.8}cm` }}
                  >
                    واتساب
                  </span>
                </div>
              </div>
            )}

            {/* WhatsApp QR */}
            {elementVisibility.whatsappQr && (
              <div className="flex flex-col items-center justify-center">
                {qrCodes[qrKey]?.whatsapp ? (
                  <img
                    src={qrCodes[qrKey].whatsapp}
                    alt="QR واتساب"
                    style={{
                      width: `${qrSize}cm`,
                      height: `${qrSize}cm`,
                    }}
                  />
                ) : (
                  <div 
                    className="bg-gray-100 rounded flex items-center justify-center"
                    style={{
                      width: `${qrSize}cm`,
                      height: `${qrSize}cm`,
                    }}
                  >
                    <QrCode className="text-gray-400" style={{ width: '50%', height: '50%' }} />
                  </div>
                )}
                <span 
                  className="font-medium"
                  style={{ 
                    fontSize: `${infoSize * 0.8}cm`,
                    marginTop: '1mm',
                    color: colorSettings.qrLabelColor,
                    fontFamily: fontSettings.info,
                  }}
                >
                  واتساب
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Sticker Preview Wrapper Component
interface StickerPreviewProps {
  billboard: Billboard | null;
  index: number;
  size: { width: number; height: number };
  municipalityLogo: string | undefined;
  phoneNumber: string;
  qrCodes: { [key: string]: { whatsapp: string; gps: string } };
  qrKey: string;
  elementPositions: ElementPositions;
  elementVisibility: ElementVisibility;
  colorSettings: ColorSettings;
  fontSettings: FontSettings;
  isPreview: boolean;
  isReserve: boolean;
  reserveNumber?: string;
  layoutMode: 'single' | 'grouped';
}

function StickerPreview({
  billboard,
  index,
  size,
  municipalityLogo,
  phoneNumber,
  qrCodes,
  qrKey,
  elementPositions,
  elementVisibility,
  colorSettings,
  fontSettings,
  isPreview,
  isReserve,
  reserveNumber,
  layoutMode,
}: StickerPreviewProps) {
  const previewScale = 3.5;
  
  // أبعاد الملصق الأصلية بالميليمتر (من سم)
  const stickerWidthMm = size.width * 10;
  const stickerHeightMm = size.height * 10;
  
  let printWidthMm = stickerWidthMm;
  let printHeightMm = stickerHeightMm;
  
  // في وضع الطباعة الفردية: نُصغّر الملصق ليناسب A4 مع الحفاظ على النسبة
  if (!isPreview && layoutMode === 'single') {
    const maxPrintWidthMm = 190;
    const maxPrintHeightMm = 277;
    const scaleW = maxPrintWidthMm / stickerWidthMm;
    const scaleH = maxPrintHeightMm / stickerHeightMm;
    const printScale = Math.min(scaleW, scaleH, 1); // لا نكبر، فقط نصغر إذا لزم
    
    printWidthMm = stickerWidthMm * printScale;
    printHeightMm = stickerHeightMm * printScale;
  }
  
  const wrapperStyle = !isPreview
    ? {
        width: `${printWidthMm}mm`,
        height: `${printHeightMm}mm`,
        padding: 0,
        margin: layoutMode === 'single' ? '0 auto' : '0',
      }
    : undefined;
  
  const innerWidth = isPreview ? `${size.width * previewScale}mm` : `${printWidthMm}mm`;
  const innerHeight = isPreview ? `${size.height * previewScale}mm` : `${printHeightMm}mm`;
  
  const contentSize = isPreview
    ? { width: (size.width / 10) * previewScale, height: (size.height / 10) * previewScale }
    : { width: printWidthMm / 10, height: printHeightMm / 10 };
  
  return (
    <div 
      className={isPreview ? 'sticker-wrapper' : 'sticker-print-wrapper'}
      style={wrapperStyle}
    >
      <div
        style={{
          width: innerWidth,
          height: innerHeight,
          fontFamily: fontSettings.main,
        }}
      >
        <StickerContent
          billboard={billboard}
          index={index}
          size={contentSize}
          municipalityLogo={municipalityLogo}
          phoneNumber={phoneNumber}
          qrCodes={qrCodes}
          qrKey={qrKey}
          elementPositions={elementPositions}
          elementVisibility={elementVisibility}
          colorSettings={colorSettings}
          fontSettings={fontSettings}
          isReserve={isReserve}
          reserveNumber={reserveNumber}
        />
      </div>
      
      {/* Size label for preview only */}
      {isPreview && (
        <div className="text-center mt-2 text-sm text-muted-foreground">
          {size.width} × {size.height} سم {isReserve && '(احتياطي)'}
        </div>
      )}
    </div>
  );
}
