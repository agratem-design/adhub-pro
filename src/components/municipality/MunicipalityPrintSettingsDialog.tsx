/**
 * Municipality Print Settings Dialog
 * إعدادات طباعة لوحات البلدية مع معاينة مباشرة وتصميم عصري احترافي
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Save, 
  RotateCcw, 
  Type, 
  Image as ImageIcon, 
  MapPin, 
  QrCode, 
  Hash, 
  Map, 
  ZoomIn, 
  ZoomOut, 
  BookOpen, 
  Sliders,
  Check
} from 'lucide-react';
import { usePrintCustomization, PrintCustomizationSettings } from '@/hooks/usePrintCustomization';
import { createPinSvgUrl } from '@/hooks/useMapMarkers';
import { generateGoogleTilesMapDataUrl } from '@/utils/googleTilesMapGenerator';
import DOMPurify from 'dompurify';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backgroundUrl: string;
  onSaveSuccess?: () => void;
  sampleBillboard?: {
    name: string;
    size: string;
    faces: number;
    municipality: string;
    landmark: string;
    coords: string;
    imageUrl?: string;
  };
  items?: any[];
}

const parseMM = (val: string): number => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };
const toMM = (n: number): string => `${n}mm`;
const parsePX = (val: string): number => { const n = parseFloat(val); return isNaN(n) ? 12 : n; };
const toPX = (n: number): string => `${n}px`;
const parsePercent = (val: string): number => { const n = parseFloat(val); return isNaN(n) ? 50 : n; };
const toPercent = (n: number): string => `${n}%`;
const parseRaw = (val: string): number => { const n = parseFloat(val); return isNaN(n) ? 80 : n; };

const parseDimensions = (sizeStr: string) => {
  if (!sizeStr) return { length: '', width: '', height: '' };
  const normalized = sizeStr.replace(/×/g, 'x').replace(/X/g, 'x').replace(/\*/g, 'x');
  const parts = normalized.split('x').map(p => p.trim());
  return {
    length: parts[0] || '',
    width: parts[1] || '',
    height: parts[2] || ''
  };
};

const generatePrintedSizeHtml = (sizeStr: string, showHeight: boolean, showLabels: boolean = false) => {
  if (!sizeStr) return '';
  const dims = parseDimensions(sizeStr);
  if (!dims.length && !dims.width && !dims.height) return '';

  const showH = showHeight && !!dims.height;
  
  return `
    <div class="print-size-container">
      <div class="print-dim-col">
        ${showLabels ? `<div class="print-dim-label">طول</div>` : ''}
        <div class="print-dim-value">${dims.length || '-'}</div>
      </div>
      <div class="print-dim-separator">×</div>
      <div class="print-dim-col">
        ${showLabels ? `<div class="print-dim-label">عرض</div>` : ''}
        <div class="print-dim-value">${dims.width || '-'}</div>
      </div>
      ${showH ? `
        <div class="print-dim-separator">×</div>
        <div class="print-dim-col">
          ${showLabels ? `<div class="print-dim-label">ارتفاع</div>` : ''}
          <div class="print-dim-value">${dims.height}</div>
        </div>
      ` : ''}
    </div>
  `;
};

interface SettingField {
  key: keyof PrintCustomizationSettings;
  label: string;
  type: 'mm' | 'px' | 'percent' | 'text' | 'select' | 'raw';
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

interface SettingGroup {
  label: string;
  icon: React.ReactNode;
  fields: SettingField[];
}

const settingGroups: SettingGroup[] = [
  {
    label: 'الترقيم',
    icon: <Hash className="h-3.5 w-3.5" />,
    fields: [
      { key: 'billboard_name_top', label: 'الموقع من الأعلى', type: 'mm', min: 0, max: 280, step: 0.5 },
      { key: 'billboard_name_left', label: 'الموقع من اليسار', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'billboard_name_font_size', label: 'حجم خط الرقم', type: 'px', min: 8, max: 60, step: 1 },
      { key: 'billboard_name_font_weight', label: 'سماكة الخط', type: 'text' },
      { key: 'billboard_name_color', label: 'لون الخط', type: 'text' },
      { key: 'coords_font_family', label: 'نوع خط الأرقام', type: 'select', options: [
        { value: 'Manrope', label: 'Manrope (عصري)' },
        { value: 'Doran', label: 'Doran (فني)' },
        { value: 'monospace', label: 'Monospace (ثابت)' },
        { value: 'Arial', label: 'Arial (افتراضي)' },
      ]},
    ],
  },
  {
    label: 'المقاس',
    icon: <Type className="h-3.5 w-3.5" />,
    fields: [
      { key: 'size_top', label: 'الموقع من الأعلى', type: 'mm', min: 0, max: 280, step: 0.5 },
      { key: 'size_left', label: 'الموقع من اليسار', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'size_font_size', label: 'حجم الخط الأساسي', type: 'px', min: 8, max: 80, step: 1 },
      { key: 'size_color', label: 'لون الخط', type: 'text' },
      { key: 'coords_font_family', label: 'نوع خط الأرقام', type: 'select', options: [
        { value: 'Manrope', label: 'Manrope (عصري)' },
        { value: 'Doran', label: 'Doran (فني)' },
        { value: 'monospace', label: 'Monospace (ثابت)' },
        { value: 'Arial', label: 'Arial (افتراضي)' },
      ]},
      { key: 'calc_meters_by_faces', label: 'حساب إجمالي الأمتار بعدد الأوجه', type: 'select', options: [
        { value: 'true', label: 'نعم (ضرب المساحة في عدد الأوجه)' },
        { value: 'false', label: 'لا (حساب مساحة الوجه الواحد فقط)' },
      ]},
      { key: 'show_size_dimension_labels', label: 'إظهار الكلمات فوق المقاس (طول، عرض، ارتفاع)', type: 'select', options: [
        { value: 'false', label: 'إخفاء الكلمات (معطّل افتراضياً)' },
        { value: 'true', label: 'إظهار الكلمات' },
      ]},
    ],
  },
  {
    label: 'عدد الأوجه',
    icon: <Sliders className="h-3.5 w-3.5" />,
    fields: [
      { key: 'faces_count_top', label: 'الموقع من الأعلى', type: 'mm', min: 0, max: 280, step: 0.5 },
      { key: 'faces_count_left', label: 'الموقع من اليسار', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'faces_count_font_size', label: 'حجم الخط', type: 'px', min: 8, max: 40, step: 1 },
      { key: 'faces_count_color', label: 'لون الخط', type: 'text' },
      { key: 'faces_count_font_weight' as any, label: 'سماكة الخط', type: 'text' },
      { key: 'faces_count_font_family' as any, label: 'نوع الخط', type: 'select', options: [
        { value: 'Doran', label: 'Doran (فني / افتراضي)' },
        { value: 'Manrope', label: 'Manrope (عصري)' },
        { value: 'Cairo', label: 'Cairo (عريض)' },
        { value: 'Tajawal', label: 'Tajawal (واضح)' },
        { value: 'monospace', label: 'Monospace (ثابت)' },
        { value: 'Arial', label: 'Arial (افتراضي)' },
      ]},
      { key: 'faces_count_show', label: 'إظهار عدد الأوجه في الطباعة', type: 'select', options: [
        { value: 'true', label: 'مفعّل' },
        { value: 'false', label: 'معطّل' },
      ]},
    ],
  },
  {
    label: 'الصورة',
    icon: <ImageIcon className="h-3.5 w-3.5" />,
    fields: [
      { key: 'main_image_top', label: 'الموقع من الأعلى', type: 'mm', min: 0, max: 280, step: 0.5 },
      { key: 'main_image_left', label: 'الموقع من اليسار', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'main_image_width', label: 'عرض إطار الصورة', type: 'mm', min: 20, max: 200, step: 1 },
      { key: 'main_image_height', label: 'ارتفاع إطار الصورة', type: 'mm', min: 20, max: 200, step: 1 },
      { key: 'main_image_object_fit', label: 'طريقة عرض الصورة', type: 'select', options: [
        { value: 'cover', label: 'ملء الإطار (مع اقتصاص)' },
        { value: 'contain', label: 'كامل الصورة (بدون اقتصاص)' },
      ]},
    ],
  },
  {
    label: 'الموقع',
    icon: <MapPin className="h-3.5 w-3.5" />,
    fields: [
      { key: 'location_info_top', label: 'الموقع من الأعلى', type: 'mm', min: 0, max: 290, step: 0.5 },
      { key: 'location_info_left', label: 'الموقع من اليسار', type: 'mm', min: 0, max: 200, step: 0.5 },
      { key: 'location_info_width', label: 'عرض صندوق النص', type: 'mm', min: 20, max: 200, step: 1 },
      { key: 'location_info_font_size', label: 'حجم خط العنوان', type: 'px', min: 8, max: 30, step: 1 },
    ],
  },
  {
    label: 'أقرب معلم',
    icon: <MapPin className="h-3.5 w-3.5" />,
    fields: [
      { key: 'landmark_info_top', label: 'الموقع من الأعلى', type: 'mm', min: 0, max: 290, step: 0.5 },
      { key: 'landmark_info_left', label: 'الموقع من اليسار', type: 'mm', min: 0, max: 200, step: 0.5 },
      { key: 'landmark_info_width', label: 'عرض صندوق النص', type: 'mm', min: 20, max: 200, step: 1 },
      { key: 'landmark_info_font_size', label: 'حجم خط المعلم', type: 'px', min: 8, max: 30, step: 1 },
    ],
  },
  {
    label: 'QR Code',
    icon: <QrCode className="h-3.5 w-3.5" />,
    fields: [
      { key: 'qr_top', label: 'الموقع من الأعلى', type: 'mm', min: 0, max: 290, step: 0.5 },
      { key: 'qr_left', label: 'الموقع من اليسار', type: 'mm', min: 0, max: 200, step: 0.5 },
      { key: 'qr_size', label: 'حجم الكود (مربع)', type: 'mm', min: 10, max: 60, step: 1 },
    ],
  },
  {
    label: 'الخريطة',
    icon: <Map className="h-3.5 w-3.5" />,
    fields: [
      { key: 'map_zoom', label: 'مستوى التكبير (Zoom)', type: 'raw', min: 10, max: 21, step: 0.25 },
      { key: 'map_show_labels', label: 'نمط عرض الخريطة', type: 'select', options: [
        { value: 'hybrid', label: 'قمر صناعي + مسميات' },
        { value: 'satellite', label: 'قمر صناعي فقط' },
      ]},
      { key: 'map_label_scale' as any, label: 'حجم خط مسميات الخريطة', type: 'raw', min: 1, max: 3, step: 0.25 },
      { key: 'pin_size', label: 'حجم دبوس الخريطة (بكسل)', type: 'raw', min: 30, max: 200, step: 5 },
      { key: 'pin_color', label: 'لون الدبوس', type: 'text' },
      { key: 'pin_text_color', label: 'لون كتابة المقاس على الدبوس', type: 'text' },
      { key: 'custom_pin_url', label: 'رابط دبوس مخصص (SVG)', type: 'text' },
    ],
  },
  {
    label: 'الإحداثيات',
    icon: <MapPin className="h-3.5 w-3.5" />,
    fields: [
      { key: 'coords_font_size', label: 'حجم خط الإحداثيات', type: 'px', min: 6, max: 30, step: 1 },
      { key: 'coords_bar_height', label: 'ارتفاع شريط الإحداثيات', type: 'px', min: 16, max: 60, step: 1 },
      { key: 'coords_font_family', label: 'نوع خط الأرقام', type: 'select', options: [
        { value: 'Manrope', label: 'Manrope (عصري)' },
        { value: 'Doran', label: 'Doran (فني)' },
        { value: 'monospace', label: 'Monospace (ثابت)' },
        { value: 'Arial', label: 'Arial (افتراضي)' },
      ]},
    ],
  },
  {
    label: 'صفحة الغلاف',
    icon: <BookOpen className="h-3.5 w-3.5" />,
    fields: [
      { key: 'cover_page_enabled', label: 'تفعيل صفحة الغلاف', type: 'select', options: [
        { value: 'true', label: 'مفعّل' },
        { value: 'false', label: 'معطّل' },
      ]},
      { key: 'cover_logo_url', label: 'رابط شعار الغلاف', type: 'text' },
      { key: 'cover_logo_size', label: 'عرض الشعار', type: 'px', min: 100, max: 2000, step: 10 },
      { key: 'cover_logo_top' as any, label: 'موقع الشعار (أعلى)', type: 'mm', min: 0, max: 280, step: 1 },
      { key: 'cover_logo_left' as any, label: 'موقع الشعار (يسار)', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'cover_phrase', label: 'العبارة الافتتاحية', type: 'text' },
      { key: 'cover_phrase_font_size', label: 'حجم خط العبارة', type: 'px', min: 14, max: 80, step: 1 },
      { key: 'cover_phrase_top' as any, label: 'موقع العبارة (أعلى)', type: 'mm', min: 0, max: 280, step: 1 },
      { key: 'cover_phrase_left' as any, label: 'موقع العبارة (يسار)', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'cover_municipality_font_size', label: 'حجم خط اسم البلدية', type: 'px', min: 18, max: 100, step: 1 },
      { key: 'cover_municipality_top' as any, label: 'موقع اسم البلدية (أعلى)', type: 'mm', min: 0, max: 280, step: 1 },
      { key: 'cover_municipality_left' as any, label: 'موقع اسم البلدية (يسار)', type: 'percent', min: 0, max: 100, step: 0.5 },
      { key: 'cover_background_enabled' as any, label: 'خلفية صفحة الغلاف', type: 'select', options: [
        { value: 'true', label: 'مع خلفية' },
        { value: 'false', label: 'بدون خلفية' },
      ]},
      { key: 'cover_background_url' as any, label: 'رابط خلفية مخصصة للغلاف', type: 'text' },
    ],
  },
];

export default function MunicipalityPrintSettingsDialog({
  open,
  onOpenChange,
  backgroundUrl,
  onSaveSuccess,
  sampleBillboard: initialSampleBillboard,
  items,
}: Props) {
  const { settings, saveSettings, resetToDefaults, saving } = usePrintCustomization('municipality');
  const [localSettings, setLocalSettings] = useState<PrintCustomizationSettings>(settings);

  const [showHeightInPrint, setShowHeightInPrint] = useState(() => {
    try {
      const val = localStorage.getItem('mun_show_height_in_print');
      return val !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('mun_show_height_in_print', String(showHeightInPrint));
    } catch {}
  }, [showHeightInPrint]);

  useEffect(() => {
    if (open) {
      try {
        const val = localStorage.getItem('mun_show_height_in_print');
        setShowHeightInPrint(val !== 'false');
      } catch {}
    }
  }, [open]);

  const updateLocalStatusOverride = (key: string, value: string) => {
    setLocalSettings(prev => {
      const overrides = prev.status_overrides || ({} as any);
      const munOverrides = overrides['municipality'] || {};
      return {
        ...prev,
        status_overrides: {
          ...overrides,
          'municipality': { ...munOverrides, [key]: value }
        }
      };
    });
  };

  const [previewZoom, setPreviewZoom] = useState(1.0);
  const [activeTab, setActiveTab] = useState('الترقيم');
  const [sampleBillboard, setSampleBillboard] = useState<{
    name: string; size: string; faces: number; municipality: string; landmark: string; coords: string; imageUrl: string;
  } | null>(null);
  
  const [previewMapUrl, setPreviewMapUrl] = useState<string>('');
  const [previewMapLoading, setPreviewMapLoading] = useState(false);
  const mapDebounceRef = useRef<number | null>(null);
  const mapReqIdRef = useRef(0);
  const previewPaneRef = useRef<HTMLDivElement>(null);

  // Auto-fit zoom calculation for responsive A4 sheet preview
  const fitZoomToContainer = () => {
    if (!previewPaneRef.current) return;
    const containerWidth = previewPaneRef.current.clientWidth - 48;
    const containerHeight = previewPaneRef.current.clientHeight - 48;
    const mmToPx = 3.7795275591;
    const a4WidthPx = 210 * mmToPx;
    const a4HeightPx = 297 * mmToPx;

    const scaleX = containerWidth / a4WidthPx;
    const scaleY = containerHeight / a4HeightPx;
    const fitScale = Math.min(scaleX, scaleY);
    if (!isNaN(fitScale) && fitScale > 0) {
      setPreviewZoom(Number(fitScale.toFixed(2)));
    }
  };

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
      setPreviewZoom(1.0); // Default Zoom to 100%
      loadSampleBillboard();
    }
  }, [open, settings, items]);

  const loadSampleBillboard = async (targetIndex?: number) => {
    // 1. Prioritize active collection items from props
    if (items && items.length > 0) {
      let selectedItem: any;
      if (typeof targetIndex === 'number' && items[targetIndex]) {
        selectedItem = items[targetIndex];
      } else {
        // Pick the last item with an image or last item
        selectedItem = [...items].reverse().find(i => i.image_url) || items[items.length - 1];
      }

      if (selectedItem) {
        const rawSize = selectedItem.size || '12x4';
        const normalized = rawSize.replace(/×/g, 'x').replace(/X/g, 'x').replace(/\*/g, 'x');
        const parts = normalized.split('x').map((s: string) => s.trim());
        const sizeWithHeight = parts.length >= 3 ? rawSize : `${parts[0] || '12'}x${parts[1] || '4'}x3`;
        const lat = selectedItem.latitude;
        const lng = selectedItem.longitude;
        setSampleBillboard({
          name: String(selectedItem.sequence_number).padStart(2, '0'),
          size: sizeWithHeight,
          faces: selectedItem.faces_count === 'وجه' ? 1 : 2,
          municipality: selectedItem.municipality || selectedItem.location_text || 'البلدية',
          landmark: selectedItem.nearest_landmark || 'أقرب نقطة دالة',
          coords: lat && lng ? `${lat}, ${lng}` : '32.901753, 13.217222',
          imageUrl: selectedItem.image_url || '',
        });
        return;
      }
    }

    // 2. Fallback to Supabase query
    try {
      const { data } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, Faces_Count, Municipality, Nearest_Landmark, GPS_Coordinates, Image_URL')
        .not('Municipality', 'is', null)
        .not('GPS_Coordinates', 'is', null)
        .order('ID', { ascending: true })
        .limit(1);
      const row = data?.[0];
      if (row) {
        const [lat, lng] = (row.GPS_Coordinates || '').split(',').map((s: string) => s.trim());
        const rawSize = row.Size || '12x4';
        const normalized = rawSize.replace(/×/g, 'x').replace(/X/g, 'x').replace(/\*/g, 'x');
        const parts = normalized.split('x').map(s => s.trim());
        const sizeWithHeight = parts.length >= 3 ? rawSize : `${parts[0] || '12'}x${parts[1] || '4'}x3`;
        setSampleBillboard({
          name: row.Billboard_Name || `لوحة ${row.ID}`,
          size: sizeWithHeight,
          faces: row.Faces_Count || 2,
          municipality: row.Municipality || 'طرابلس المركز',
          landmark: row.Nearest_Landmark || 'وسط جسر القبة الفلكية',
          coords: lat && lng ? `${lat}, ${lng}` : '32.901753, 13.217222',
          imageUrl: row.Image_URL || '',
        });
      }
    } catch { /* ignore */ }
  };

  const updateLocal = (key: keyof PrintCustomizationSettings, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const success = await saveSettings(localSettings);
    if (success) {
      if (onSaveSuccess) onSaveSuccess();
      onOpenChange(false);
    }
  };

  const handleReset = async () => {
    await resetToDefaults();
    setLocalSettings(settings);
  };

  const getValue = (key: keyof PrintCustomizationSettings, type: string): number => {
    const val = localSettings[key] as string;
    if (type === 'mm') return parseMM(val);
    if (type === 'px') return parsePX(val);
    if (type === 'percent') return parsePercent(val);
    if (type === 'raw') return parseRaw(val);
    return 0;
  };

  const pinColor = (localSettings.pin_color || '').trim() || undefined;
  const pinTextColor = (localSettings.pin_text_color || '').trim() || undefined;
  const pinData = createPinSvgUrl('4×12', 'متاحة', false, undefined, undefined, pinColor, pinTextColor, undefined, undefined, undefined, undefined, true);
  const pinUrl = (localSettings.custom_pin_url || '').trim() || pinData.url;
  const customPinUrl = (localSettings.custom_pin_url || '').trim();
  const pinTipOffsetPercent = customPinUrl ? 100 : (pinData.anchorY / pinData.height) * 100;

  const sb = sampleBillboard || initialSampleBillboard || {
    name: '01', size: '12x4x3', faces: 2, municipality: 'طرابلس المركز',
    landmark: 'وسط جسر القبة الفلكية', coords: '32.901753, 13.217222', imageUrl: '',
  };

  // Generate real map preview with debounce
  useEffect(() => {
    if (!open) return;
    const coords = (sb.coords || '').split(',').map(c => parseFloat(c.trim()));
    if (coords.length < 2 || isNaN(coords[0]) || isNaN(coords[1])) return;
    const zoom = parseFloat(localSettings.map_zoom || '16') || 16;
    const mapType = (localSettings.map_show_labels || 'hybrid') as 'satellite' | 'hybrid' | 'roadmap';
    const labelScale = parseFloat((localSettings as any).map_label_scale || '1') || 1;
    if (mapDebounceRef.current) window.clearTimeout(mapDebounceRef.current);
    mapDebounceRef.current = window.setTimeout(async () => {
      const reqId = ++mapReqIdRef.current;
      setPreviewMapLoading(true);
      try {
        const url = await generateGoogleTilesMapDataUrl({
          lat: coords[0], lng: coords[1], zoom, width: 900, height: 900, mapType, labelScale,
        });
        if (reqId === mapReqIdRef.current) setPreviewMapUrl(url);
      } catch { /* ignore */ }
      finally { if (reqId === mapReqIdRef.current) setPreviewMapLoading(false); }
    }, 300);
    return () => { if (mapDebounceRef.current) window.clearTimeout(mapDebounceRef.current); };
  }, [open, sb.coords, localSettings.map_zoom, localSettings.map_show_labels, (localSettings as any).map_label_scale]);

  // Live preview template
  const previewHtml = useMemo(() => {
    const s = localSettings;
    const pinSize = parseRaw(s.pin_size || '80');
    // Status preview
    const munOverrides = localSettings.status_overrides?.['municipality'] || {};
    const showStatus = munOverrides.mun_show_status !== 'false';
    const statusPos = munOverrides.mun_status_position || 'below_number';
    const statusGap = munOverrides.mun_status_gap || '2mm';
    const statusFontSize = munOverrides.mun_status_font_size || '14px';
    const statusColor = munOverrides.mun_status_color || '#000000';
    const statusTop = munOverrides.mun_status_top || '12mm';
    const statusLeft = munOverrides.mun_status_left || '50%';
    const statusText = 'متاحة';
    
    const statusHtml = showStatus
      ? `<span style="font-size:${statusPos === 'custom' ? statusFontSize : '14px'};font-weight:700;color:${statusPos === 'custom' ? statusColor : '#000'};">${statusText}</span>`
      : '';
    const statusAbove = showStatus && statusPos === 'above_number' ? `<div style="margin-bottom:${statusGap};">${statusHtml}</div>` : '';
    const statusBelow = showStatus && statusPos === 'below_number' ? `<div style="margin-top:${statusGap};">${statusHtml}</div>` : '';
    const statusBeside = showStatus && statusPos === 'beside_number' ? `<span style="margin-right:${statusGap};">${statusHtml}</span>` : '';
    const statusHeader = showStatus && statusPos === 'header'
      ? `<div style="position:absolute;top:${statusGap};left:50%;transform:translateX(-50%);text-align:center;z-index:50;">${statusHtml}</div>` : '';
    const statusFooter = showStatus && statusPos === 'footer'
      ? `<div style="position:absolute;bottom:${statusGap};left:50%;transform:translateX(-50%);text-align:center;z-index:50;">${statusHtml}</div>` : '';
    const statusCustom = showStatus && statusPos === 'custom'
      ? `<div style="position:absolute;top:${statusTop};left:${statusLeft};transform:translateX(-50%);text-align:center;z-index:50;">${statusHtml}</div>` : '';
    
    return `
      <div style="position:relative;width:210mm;height:297mm;background-color:#fff;background-image:url('${backgroundUrl}');background-size:210mm 297mm;background-repeat:no-repeat;font-family:'Doran',Arial,sans-serif;direction:rtl;overflow:hidden;">
        <style>
          .print-size-container { display: flex; align-items: center; justify-content: center; margin: 0 auto; width: 100%; gap: 0.12em; direction: rtl; color: inherit; text-align: center; }
          .print-dim-col { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; color: inherit; }
          .print-dim-label { font-size: 0.45em; font-weight: 700; opacity: 1; margin-bottom: 2px; letter-spacing: 0.5px; color: inherit; text-align: center; }
          .print-dim-value { font-size: 1em; font-weight: 700; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif; color: inherit; text-align: center; }
          .print-dim-separator { font-size: 0.65em; opacity: 1; margin-top: 0.25em; font-weight: 700; color: inherit; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif; }
        </style>
        ${statusHeader}
        <!-- الترقيم -->
        <div style="position:absolute;top:${s.billboard_name_top};left:${s.billboard_name_left};transform:translateX(-50%);width:120mm;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:${s.billboard_name_font_size || '32px'};font-weight:${s.billboard_name_font_weight || '700'};color:${s.billboard_name_color || '#000'};line-height:1;z-index:5;">
          ${statusAbove}
          <div style="font-family: '${s.coords_font_family || 'Manrope'}', sans-serif;">${sb.name}${statusBeside}</div>
          ${statusBelow}
        </div>
 
        <!-- المقاس -->
        <div style="position:absolute;top:${s.size_top};left:${s.size_left};transform:translateX(-50%);width:70mm;display:flex;align-items:center;justify-content:center;text-align:center;font-size:${s.size_font_size};font-weight:${s.size_font_weight || '500'};color:${s.size_color};z-index:5;margin:0;padding:0;">
          ${generatePrintedSizeHtml(sb.size, showHeightInPrint, (s as any).show_size_dimension_labels === 'true')}
        </div>
 
        <!-- عدد الأوجه -->
        ${s.faces_count_show !== 'false' ? `
        <div style="position:absolute;top:${s.faces_count_top};left:${s.size_left};transform:translateX(-50%);width:70mm;display:flex;align-items:center;justify-content:center;text-align:center;font-size:${s.faces_count_font_size};font-weight:${(s as any).faces_count_font_weight || '700'};color:${s.faces_count_color || '#000000'};font-family:'${(s as any).faces_count_font_family || s.coords_font_family || 'Doran'}',sans-serif;z-index:5;margin:0;padding:0;line-height:1;">
          ${sb.faces === 1 ? 'وجه واحد' : 'وجهين'}
        </div>
        ` : ''}
 
        <!-- الصورة / الخريطة -->
        <div style="position:absolute;top:${s.main_image_top};left:${s.main_image_left};transform:translateX(-50%);width:${s.main_image_width};height:${s.main_image_height};border:2px solid #ccc;border-radius:8px;overflow:hidden;z-index:5;display:flex;flex-direction:column;">
          ${sb.imageUrl ? `
            <div style="flex:1 1 50%;min-height:0;overflow:hidden;border-bottom:1px solid #ddd;position:relative;">
              <img src="${sb.imageUrl}" style="width:100%;height:100%;object-fit:${s.main_image_object_fit || 'cover'};display:block;" />
            </div>
            <div style="flex:1 1 50%;min-height:0;position:relative;overflow:hidden;">
              <div style="width:100%;height:100%;background:${previewMapUrl ? `url('${previewMapUrl}') center/cover no-repeat` : 'linear-gradient(135deg, #4a7c59, #2d5a3f)'};display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;position:relative;">
                ${!previewMapUrl ? `<div style="font-size:12px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.8);background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:4px;">${previewMapLoading ? 'جاري تحميل الخريطة...' : 'خريطة القمر الصناعي'}</div>` : ''}
                <!-- Pin overlay -->
                <div style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:10;">
                  <img src="${pinUrl}" style="position:absolute;top:50%;left:50%;width:${pinSize}px;height:auto;transform:translate(-50%,-${pinTipOffsetPercent}%);" />
                </div>
                <div style="position:absolute;bottom:6px;left:6px;font-size:10px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);background:rgba(0,0,0,0.5);padding:1px 6px;border-radius:3px;z-index:11;">الزوم: ${s.map_zoom || '15'} | الدبوس: ${pinSize}px</div>
              </div>
            </div>
          ` : `
            <div style="flex:1 1 auto;min-height:0;position:relative;overflow:hidden;">
              <div style="width:100%;height:100%;background:${previewMapUrl ? `url('${previewMapUrl}') center/cover no-repeat` : 'linear-gradient(135deg, #4a7c59, #2d5a3f)'};display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;position:relative;">
                ${!previewMapUrl ? `<div style="font-size:12px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.8);background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:4px;">${previewMapLoading ? 'جاري تحميل الخريطة...' : 'خريطة القمر الصناعي'}</div>` : ''}
                <!-- Pin overlay -->
                <div style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:10;">
                  <img src="${pinUrl}" style="position:absolute;top:50%;left:50%;width:${pinSize}px;height:auto;transform:translate(-50%,-${pinTipOffsetPercent}%);" />
                </div>
                <div style="position:absolute;bottom:6px;left:6px;font-size:10px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);background:rgba(0,0,0,0.5);padding:1px 6px;border-radius:3px;z-index:11;">الزوم: ${s.map_zoom || '15'} | الدبوس: ${pinSize}px</div>
              </div>
            </div>
          `}
          <div style="height:${s.coords_bar_height || '26px'};background:rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;border-top:1px solid #ddd;flex-shrink:0;z-index:12;">
            <span style="font-size:${s.coords_font_size || '11px'};font-weight:700;color:#222;direction:ltr;font-family:'${s.coords_font_family || 'Manrope'}',monospace;letter-spacing:0.5px;">${sb.coords}</span>
          </div>
        </div>
 
        <!-- الموقع -->
        <div style="position:absolute;top:${s.location_info_top};left:${s.location_info_left};width:${s.location_info_width};font-size:${s.location_info_font_size};color:${s.location_info_color || '#000'};z-index:5;">
          ${sb.municipality} - طريق الشط
        </div>
 
        <!-- أقرب معلم -->
        <div style="position:absolute;top:${s.landmark_info_top};left:${s.landmark_info_left};width:${s.landmark_info_width};font-size:${s.landmark_info_font_size};color:${s.landmark_info_color || '#000'};z-index:5;">
          ${sb.landmark}
        </div>
 
        <!-- QR Code -->
        <div style="position:absolute;top:${s.qr_top};left:${s.qr_left};width:${s.qr_size};text-align:center;z-index:5;">
          <div style="width:${s.qr_size};height:${s.qr_size};background:#f0f0f0;border:2px solid #999;display:flex;align-items:center;justify-content:center;font-size:10px;color:#666;border-radius:4px;">QR</div>
        </div>
        ${statusCustom}
        ${statusFooter}
      </div>
    `;
  }, [localSettings, backgroundUrl, pinData.url, sb, previewMapUrl, previewMapLoading, pinUrl, showHeightInPrint]);

  // Cover page preview
  const coverPreviewHtml = useMemo(() => {
    const s = localSettings;
    let coverLogoUrl = (s as any).cover_logo_url || '/logofaresgold.svg';
    if (backgroundUrl) {
      if (backgroundUrl.includes('1qgKLCpd9b14m51mVxUMJ09SyzzfagMqB') || backgroundUrl.toLowerCase().includes('gold')) {
        coverLogoUrl = '/logofaresgold.svg';
      } else if (backgroundUrl.includes('1VnWV0LpSkrPADcF4oOV6MgvLNbDN5ctd') || backgroundUrl.toLowerCase().includes('without')) {
        coverLogoUrl = '/logofaresgold.svg';
      } else if (backgroundUrl.includes('ipg.svg') || backgroundUrl.includes('default')) {
        coverLogoUrl = '/logofares2.svg';
      }
    }
    const coverPhrase = (s as any).cover_phrase || 'لوحات';
    const formatCssSize = (val: any, fallback: string) => {
      if (!val) return fallback;
      const str = String(val).trim();
      if (/^\d+(\.\d+)?$/.test(str)) {
        const num = parseFloat(str);
        if (num <= 180) return `${num}mm`;
        return `${num}px`;
      }
      return str;
    };
    const coverLogoSize = formatCssSize((s as any).cover_logo_size, '220px');
    const coverPhraseFontSize = formatCssSize((s as any).cover_phrase_font_size, '28px');
    const coverMunicipalityFontSize = formatCssSize((s as any).cover_municipality_font_size, '36px');
    const municipalityName = sb.municipality || 'طرابلس المركز';

    const logoTop = (s as any).cover_logo_top || '65mm';
    const logoLeft = (s as any).cover_logo_left || '50%';
    const phraseTop = (s as any).cover_phrase_top || '138mm';
    const phraseLeft = (s as any).cover_phrase_left || '50%';
    const muniTop = (s as any).cover_municipality_top || '154mm';
    const muniLeft = (s as any).cover_municipality_left || '50%';

    const coverBgEnabled = (s as any).cover_background_enabled !== 'false';
    const coverBgUrl = (s as any).cover_background_url || backgroundUrl;
    const bgStyle = coverBgEnabled ? `background-image:url('${coverBgUrl}');background-size:210mm 297mm;background-repeat:no-repeat;` : '';

    const posStyle = (left: string) => {
      return `left:${left};transform:translateX(-50%);text-align:center;`;
    };

    return `
      <div style="position:relative;width:210mm;height:297mm;background-color:#fff;${bgStyle}font-family:'Doran',Arial,sans-serif;direction:rtl;overflow:visible;">
        <div style="position:absolute;top:45%;left:0;right:0;width:100%;transform:translateY(-50%);text-align:center;margin:0 auto;display:block;z-index:5;">
          <div style="width:100%;text-align:center;margin:0 auto 20px auto;display:block;clear:both;">
            <img src="${coverLogoUrl}" alt="شعار" style="display:inline-block;margin:0 auto;text-align:center;width:${coverLogoSize};max-width:90%;height:auto;vertical-align:middle;" onerror="this.style.display='none'" />
          </div>
          <div style="width:100%;text-align:center;margin:0 auto;display:block;">
            <div style="font-family:'Doran',Arial,sans-serif;font-size:${coverPhraseFontSize};font-weight:700;color:#000;line-height:1.3;text-align:center;margin:0 auto 8px auto;display:block;">
              ${coverPhrase}
            </div>
            <div style="font-family:'Doran',Arial,sans-serif;font-size:${coverMunicipalityFontSize};font-weight:700;color:#000;line-height:1.3;text-align:center;margin:0 auto;display:block;">
              ${municipalityName}
            </div>
          </div>
        </div>
      </div>
    `;
  }, [localSettings, backgroundUrl, sb]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px] w-[95vw] p-0 overflow-hidden h-[92vh] rounded-3xl border border-emerald-500/20 shadow-2xl bg-slate-950/95 backdrop-blur-2xl">
        <DialogTitle className="sr-only">إعدادات الطباعة</DialogTitle>
        <DialogDescription className="sr-only">تعديل مواضع وتصميم لوحة البلدية</DialogDescription>
        <div className="flex h-full overflow-hidden">
          
          {/* Settings Sidebar Panel */}
          <div className="w-[390px] border-l border-white/5 flex flex-col bg-slate-900/40 backdrop-blur-3xl overflow-hidden shrink-0">
            
            {/* Header & Saving State Indicator */}
            <div className="p-5 border-b border-white/5 bg-slate-900/20 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white tracking-wide">إعدادات الطباعة</h2>
                <p className="text-[10.5px] text-slate-400 mt-0.5">تعديل مواضع وتصميم لوحة البلدية</p>
              </div>
              {saving && (
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                  جاري الحفظ...
                </span>
              )}
            </div>

            <Tabs defaultValue="الترقيم" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              
              {/* Tab Categories - Horizontal pill scroll list */}
              <div className="px-4 py-3 bg-slate-900/10 border-b border-white/5 shrink-0 overflow-x-auto no-scrollbar">
                <TabsList className="flex gap-1.5 bg-transparent p-0 justify-start h-auto w-max">
                  {settingGroups.map(g => (
                    <TabsTrigger 
                      key={g.label} 
                      value={g.label} 
                      className="text-[11.5px] font-semibold gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 text-slate-300 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:border-indigo-500/20 transition-all hover:bg-white/5"
                    >
                      {g.icon}
                      {g.label}
                    </TabsTrigger>
                  ))}
                  <TabsTrigger 
                    value="حالة اللوحة" 
                    className="text-[11.5px] font-semibold gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 text-slate-300 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:border-indigo-500/20 transition-all hover:bg-white/5"
                  >
                    <Hash className="h-3.5 w-3.5" />
                    حالة اللوحة
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Scrollable control settings list */}
              <ScrollArea className="flex-1 overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(90vh - 170px)' }}>
                
                {/* Dynamically render fields for normal settings */}
                {settingGroups.map(group => (
                  <TabsContent key={group.label} value={group.label} className="space-y-4 m-0 outline-none animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 pb-2 mb-3 border-b border-white/5">
                      <div className="p-1.5 bg-indigo-500/15 text-indigo-400 rounded-lg">
                        {group.icon}
                      </div>
                      <h3 className="font-bold text-xs text-white">
                        {group.label}
                      </h3>
                    </div>
                    
                    <div className="space-y-4 pt-1">
                      {group.fields.map(field => (
                        <div key={field.key} className="space-y-2 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.06] transition-all duration-300">
                          <div className="flex justify-between items-center">
                            <Label className="text-[11.5px] font-semibold text-slate-300">{field.label}</Label>
                            {field.type !== 'text' && field.type !== 'select' && (
                              <span className="text-[10px] text-slate-400 font-mono bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                {localSettings[field.key] as string}
                              </span>
                            )}
                          </div>

                          {field.type === 'text' ? (
                            <>
                              {(field.key === 'pin_color' || field.key === 'pin_text_color') ? (
                                <div className="flex items-center gap-2">
                                  <div className="relative w-9 h-9 rounded-xl border border-white/10 overflow-hidden shrink-0 bg-slate-950">
                                    <Input
                                      type="color"
                                      value={localSettings[field.key] as string || '#000000'}
                                      onChange={e => updateLocal(field.key, e.target.value)}
                                      className="absolute inset-0 w-full h-full p-0 cursor-pointer scale-150"
                                    />
                                  </div>
                                  <Input
                                    value={localSettings[field.key] as string || ''}
                                    onChange={e => updateLocal(field.key, e.target.value)}
                                    className="h-9 text-xs flex-1 rounded-xl bg-slate-950/40 border-white/5 focus:border-indigo-500/30 text-white placeholder-slate-500"
                                    placeholder="اتركه فارغاً للتلقائي"
                                  />
                                </div>
                              ) : (
                                <Input
                                  value={localSettings[field.key] as string || ''}
                                  onChange={e => updateLocal(field.key, e.target.value)}
                                  className="h-9 text-xs rounded-xl bg-slate-950/40 border-white/5 focus:border-indigo-500/30 text-white placeholder-slate-500"
                                  placeholder={field.key === 'custom_pin_url' ? 'رابط ملف SVG للدبوس المخصص' : 'اكتب القيمة هنا'}
                                />
                              )}

                              {field.key === 'custom_pin_url' && (
                                <div className="text-[9.5px] leading-relaxed text-slate-400 bg-slate-950/50 p-2.5 rounded-xl border border-white/5 space-y-1 mt-2">
                                  <p className="font-semibold text-indigo-400">شروط الدبوس القابل للتلوين:</p>
                                  <ul className="list-disc mr-3 space-y-0.5">
                                    <li>يجب أن يكون بصيغة <span className="text-white">SVG</span></li>
                                    <li>استخدم <code className="bg-white/10 px-1 rounded text-white">currentColor</code> لتلوين الدبوس تلقائياً</li>
                                  </ul>
                                </div>
                              )}
                            </>
                          ) : field.type === 'select' ? (
                            <Select
                              value={localSettings[field.key] as string}
                              onValueChange={v => updateLocal(field.key, v)}
                            >
                              <SelectTrigger className="h-9 text-xs rounded-xl bg-slate-950/40 border-white/5 focus:ring-0 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
                                {field.options?.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs focus:bg-indigo-600 focus:text-white rounded-lg">{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex items-center gap-3 py-1">
                              <Slider
                                value={[getValue(field.key, field.type)]}
                                min={field.min ?? 0}
                                max={field.max ?? 300}
                                step={field.step ?? 1}
                                onValueChange={([v]) => {
                                  if (field.type === 'mm') updateLocal(field.key, toMM(v));
                                  else if (field.type === 'px') updateLocal(field.key, toPX(v));
                                  else if (field.type === 'percent') updateLocal(field.key, toPercent(v));
                                  else if (field.type === 'raw') updateLocal(field.key, String(v));
                                }}
                                className="flex-1"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* Premium Dimension Height Custom Switch inside the 'المقاس' Tab */}
                      {group.label === 'المقاس' && (
                        <div className="flex items-center justify-between p-4 border border-white/5 rounded-2xl bg-white/[0.02] mt-4 animate-in fade-in duration-300 hover:bg-white/[0.03] transition-all">
                          <div className="space-y-0.5">
                            <Label htmlFor="preview_show_height_in_print" className="font-bold text-xs text-white">إظهار البُعد الثالث (الارتفاع)</Label>
                            <div className="text-[9.5px] text-slate-400">تضمين ارتفاع العمود من الأرض في المقاس والمعاينة</div>
                          </div>
                          <Switch 
                            id="preview_show_height_in_print" 
                            checked={showHeightInPrint} 
                            onCheckedChange={setShowHeightInPrint} 
                            className="data-[state=checked]:bg-indigo-600"
                          />
                        </div>
                      )}

                    </div>
                  </TabsContent>
                ))}

                {/* Status custom tab */}
                <TabsContent value="حالة اللوحة" className="space-y-4 m-0 outline-none animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-white/5">
                    <div className="p-1.5 bg-indigo-500/15 text-indigo-400 rounded-lg">
                      <Hash className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="font-bold text-xs text-white">إعدادات حالة اللوحة</h3>
                  </div>

                  <div className="flex items-center justify-between p-3.5 border border-white/5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.03] transition-all">
                    <Label className="text-[11.5px] font-semibold text-slate-300">إظهار حالة اللوحة في الطباعة</Label>
                    <Switch 
                      checked={localSettings.status_overrides?.['municipality']?.mun_show_status !== 'false'}
                      onCheckedChange={(v) => updateLocalStatusOverride('mun_show_status', v ? 'true' : 'false')}
                      className="data-[state=checked]:bg-indigo-600"
                    />
                  </div>

                  {localSettings.status_overrides?.['municipality']?.mun_show_status !== 'false' && (
                    <div className="space-y-4 pt-1">
                      
                      <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                        <Label className="text-[11.5px] font-semibold text-slate-300">موضع ظهور الحالة</Label>
                        <Select 
                          value={localSettings.status_overrides?.['municipality']?.mun_status_position || 'below_number'} 
                          onValueChange={v => updateLocalStatusOverride('mun_status_position', v)}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-xl bg-slate-950/40 border-white/5 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
                            <SelectItem value="below_number" className="text-xs rounded-lg focus:bg-indigo-600 focus:text-white">تحت رقم اللوحة</SelectItem>
                            <SelectItem value="above_number" className="text-xs rounded-lg focus:bg-indigo-600 focus:text-white">فوق رقم اللوحة</SelectItem>
                            <SelectItem value="beside_number" className="text-xs rounded-lg focus:bg-indigo-600 focus:text-white">بجانب رقم اللوحة</SelectItem>
                            <SelectItem value="header" className="text-xs rounded-lg focus:bg-indigo-600 focus:text-white">في رأس الصفحة</SelectItem>
                            <SelectItem value="footer" className="text-xs rounded-lg focus:bg-indigo-600 focus:text-white">في تذييل الصفحة</SelectItem>
                            <SelectItem value="custom" className="text-xs rounded-lg focus:bg-indigo-600 focus:text-white">موضع مخصص بالكامل</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {['below_number', 'above_number', 'beside_number', 'header', 'footer'].includes(localSettings.status_overrides?.['municipality']?.mun_status_position || 'below_number') && (
                        <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                          <div className="flex justify-between items-center">
                            <Label className="text-[11.5px] font-semibold text-slate-300">
                              {(localSettings.status_overrides?.['municipality']?.mun_status_position === 'header') ? 'البُعد من أعلى الصفحة' : 
                               (localSettings.status_overrides?.['municipality']?.mun_status_position === 'footer') ? 'البُعد من أسفل الصفحة' : 'البُعد عن الرقم'}
                            </Label>
                            <span className="text-[10px] text-slate-400 font-mono bg-white/5 px-2 py-0.5 rounded-md">
                              {localSettings.status_overrides?.['municipality']?.mun_status_gap || '2mm'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 py-1">
                            <Slider
                              value={[parseMM(localSettings.status_overrides?.['municipality']?.mun_status_gap || '2mm')]}
                              min={-20}
                              max={40}
                              step={0.5}
                              onValueChange={([v]) => updateLocalStatusOverride('mun_status_gap', toMM(v))}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      )}

                      {(localSettings.status_overrides?.['municipality']?.mun_status_position === 'custom') && (
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-[10.5px] text-slate-300">أعلى (مثل 12mm)</Label>
                              <Input 
                                value={localSettings.status_overrides?.['municipality']?.mun_status_top || '12mm'} 
                                onChange={e => updateLocalStatusOverride('mun_status_top', e.target.value)} 
                                className="h-8.5 text-xs rounded-xl bg-slate-950/40 border-white/5 text-white" 
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10.5px] text-slate-300">يسار (مثل 50%)</Label>
                              <Input 
                                value={localSettings.status_overrides?.['municipality']?.mun_status_left || '50%'} 
                                onChange={e => updateLocalStatusOverride('mun_status_left', e.target.value)} 
                                className="h-8.5 text-xs rounded-xl bg-slate-950/40 border-white/5 text-white" 
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10.5px] text-slate-300">حجم الخط (مثل 14px)</Label>
                              <Input 
                                value={localSettings.status_overrides?.['municipality']?.mun_status_font_size || '14px'} 
                                onChange={e => updateLocalStatusOverride('mun_status_font_size', e.target.value)} 
                                className="h-8.5 text-xs rounded-xl bg-slate-950/40 border-white/5 text-white" 
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10.5px] text-slate-300">لون الخط</Label>
                              <div className="flex gap-2">
                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0 relative bg-slate-950">
                                  <Input 
                                    type="color" 
                                    value={localSettings.status_overrides?.['municipality']?.mun_status_color || '#000000'} 
                                    onChange={e => updateLocalStatusOverride('mun_status_color', e.target.value)} 
                                    className="absolute inset-0 w-full h-full p-0 cursor-pointer scale-150" 
                                  />
                                </div>
                                <Input 
                                  value={localSettings.status_overrides?.['municipality']?.mun_status_color || '#000000'} 
                                  onChange={e => updateLocalStatusOverride('mun_status_color', e.target.value)} 
                                  className="h-8 text-[11px] rounded-lg bg-slate-950/40 border-white/5 text-white flex-1" 
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </TabsContent>

              </ScrollArea>
            </Tabs>

            {/* Sidebar Dialog Footer Actions */}
            <div className="p-4 border-t border-white/5 bg-slate-900/40 flex gap-3 shrink-0">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleReset} 
                className="flex-1 h-10 rounded-2xl border-white/10 hover:bg-white/5 text-slate-300 font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5 ml-1.5" />
                إعادة ضبط الافتراضي
              </Button>
              <Button 
                size="sm" 
                onClick={handleSave} 
                disabled={saving} 
                className="flex-1 h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all hover:shadow-lg hover:shadow-indigo-500/20"
              >
                <Save className="h-3.5 w-3.5 ml-1.5" />
                {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
              </Button>
            </div>
          </div>

          {/* Live Preview Panel */}
          <div className="flex-1 bg-slate-950 overflow-hidden flex flex-col relative">
            
            {/* Live Preview Header Toolbar */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900/60 border-b border-white/5 shrink-0 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs font-bold text-slate-200">المعاينة الحية التفاعلية</h3>
                {items && items.length > 0 ? (
                  <Select
                    value={sb?.name || ''}
                    onValueChange={(val) => {
                      const idx = items.findIndex(i => String(i.sequence_number).padStart(2, '0') === val);
                      if (idx !== -1) loadSampleBillboard(idx);
                    }}
                  >
                    <SelectTrigger className="h-7 text-[11px] bg-white/10 border-white/15 text-slate-200 w-44 font-semibold rounded-lg focus:ring-0">
                      <SelectValue placeholder="اختر عينة اللوحة" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white text-xs">
                      {items.map((it) => (
                        <SelectItem key={it.sequence_number} value={String(it.sequence_number).padStart(2, '0')} className="text-xs focus:bg-indigo-600">
                          عينة #{String(it.sequence_number).padStart(2, '0')} - {it.location_text || 'بدون اسم'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : sb ? (
                  <span className="text-[10px] bg-white/5 border border-white/10 text-slate-400 px-2 py-0.5 rounded-md font-mono">
                    عينة اللوحة: #{sb.name}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setPreviewZoom(z => Math.max(0.15, z - 0.05))}
                  className="w-8 h-8 p-0 rounded-lg border-white/10 hover:bg-white/10 text-slate-300"
                  title="تصغير (-)"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-[11px] font-mono w-14 text-center text-slate-200 bg-white/10 px-2 py-1 rounded-md border border-white/10 font-bold">
                  {Math.round(previewZoom * 100)}%
                </span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setPreviewZoom(z => Math.min(1.2, z + 0.05))}
                  className="w-8 h-8 p-0 rounded-lg border-white/10 hover:bg-white/10 text-slate-300"
                  title="تكبير (+)"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={fitZoomToContainer} 
                  className="h-8 text-xs text-emerald-300 hover:text-white px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 font-semibold gap-1"
                  title="احتواء الورقة بالكامل داخل الشاشة تلقائياً"
                >
                  🎯 احتواء تلقائي
                </Button>
              </div>
            </div>

            {/* Scrollable Container with centered interactive document preview */}
            <div ref={previewPaneRef} className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-950 no-scrollbar">
              <div
                className="relative shadow-2xl rounded-xl bg-white overflow-hidden transition-all duration-200 my-auto shrink-0 border border-white/10"
                style={{
                  width: `calc(210mm * ${previewZoom})`,
                  height: `calc(297mm * ${previewZoom})`,
                }}
              >
                <div
                  className="origin-top-left bg-white"
                  style={{
                    width: '210mm',
                    height: '297mm',
                    transform: `scale(${previewZoom})`,
                    transformOrigin: 'top left',
                  }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeTab === 'صفحة الغلاف' ? coverPreviewHtml : previewHtml) }}
                />
              </div>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
