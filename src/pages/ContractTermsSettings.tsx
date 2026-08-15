import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import QRCode from 'qrcode';
import { Installment, generatePaymentsClauseText } from "@/utils/paymentGrouping";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save,
  Loader2,
  RotateCcw,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  FileText,
  Settings,
  ArrowUp,
  ArrowDown,
  Info,
  Move,
  Type,
  Maximize2,
  Code,
  Image,
  Upload,
  Printer,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import * as UIDialog from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const __textMeasureCache = new Map<string, number>();
let __textMeasureCtx: CanvasRenderingContext2D | null = null;

function measureTextWidthPx(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: string | number = 400
): number {
  // This project is client-only, but keep a safe fallback.
  if (typeof document === "undefined") return text.length * fontSize * 0.5;

  const key = `${fontFamily}|${fontWeight}|${fontSize}|${text}`;
  const cached = __textMeasureCache.get(key);
  if (cached != null) return cached;

  if (!__textMeasureCtx) {
    const canvas = document.createElement("canvas");
    __textMeasureCtx = canvas.getContext("2d");
  }

  // If canvas isn't available, fallback to an approximation.
  if (!__textMeasureCtx) return text.length * fontSize * 0.5;

  __textMeasureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const width = __textMeasureCtx.measureText(text).width;

  __textMeasureCache.set(key, width);
  return width;
}

// علامة عربية تساعد على تثبيت اتجاه النص عند بداية السطر بأرقام/رموز
const ALM = '\u061C';
const rtlSafe = (text: string) => `${ALM}${text ?? ''}`;

// عزل المقاطع اللاتينية/الأرقام داخل tspan LTR لمنع قفز ترتيب النص المختلط داخل SVG
const LTR_RUN_REGEX = /[A-Za-z0-9+][A-Za-z0-9 .,&()_+\/-]*/g;

function renderMixedDirectionTspans(text: string): Array<string | JSX.Element> {
  const value = `${text ?? ''}`;
  const matches = Array.from(value.matchAll(LTR_RUN_REGEX));

  if (!matches.length) return [value];

  const parts: Array<string | JSX.Element> = [];
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const run = match[0] ?? '';
    const start = match.index ?? 0;

    if (start > lastIndex) {
      parts.push(value.slice(lastIndex, start));
    }

    parts.push(
      <tspan key={`ltr-run-${index}-${start}`} direction="ltr" unicodeBidi="embed">
        {run}
      </tspan>
    );

    lastIndex = start + run.length;
  });

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }

  return parts;
}

// خلفية على شكل صورة (SVG data-uri) حتى تُطبع الألوان بشكل مطابق بدون الاعتماد على إعداد “طباعة الخلفيات”.
function solidFillDataUri(fill: string): string {
  const safeFill = (fill ?? "").toString().trim() || "#000000";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="100%" height="100%" fill="${safeFill}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface ContractTerm {
  id: string;
  term_key: string;
  term_title: string;
  term_content: string;
  term_order: number;
  is_active: boolean;
  font_size: number;
  font_weight: string;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TERM: Partial<ContractTerm> = {
  term_key: '',
  term_title: '',
  term_content: '',
  term_order: 0,
  is_active: true,
  font_size: 42,
  font_weight: 'normal',
  position_x: 1200,
  position_y: 0,
};

// المتغيرات المتاحة في بنود العقد
const AVAILABLE_VARIABLES = [
  { key: '{duration}', label: 'مدة العقد', example: '365', description: 'عدد أيام العقد' },
  { key: '{startDate}', label: 'تاريخ البداية', example: '01/01/2025', description: 'تاريخ بداية العقد' },
  { key: '{endDate}', label: 'تاريخ النهاية', example: '31/12/2025', description: 'تاريخ نهاية العقد' },
  { key: '{customerName}', label: 'اسم العميل', example: 'شركة المثال', description: 'اسم العميل أو الشركة' },
  { key: '{contractNumber}', label: 'رقم العقد', example: '1001', description: 'رقم العقد' },
  { key: '{totalAmount}', label: 'إجمالي المبلغ', example: '50,000', description: 'إجمالي قيمة العقد' },
  { key: '{discount}', label: 'قيمة التخفيض', example: '5,000', description: 'قيمة التخفيض المطبق على العقد' },
  { key: '{currency}', label: 'العملة', example: 'دينار ليبي', description: 'عملة العقد' },
  { key: '{billboardsCount}', label: 'عدد اللوحات', example: '5', description: 'عدد اللوحات في العقد' },
  { key: '{payments}', label: 'الدفعات', example: 'دفعة أولى 52,000 د.ل بتاريخ 20/07/2025 ثم 7 دفعات × 50,000 د.ل', description: 'ملخص الدفعات مع التواريخ ودمج المتكررة' },
  { key: '{inclusionText}', label: 'شامل/غير شامل', example: 'شامل الطباعة والتركيب', description: 'نص شامل أو غير شامل الطباعة والتركيب' },
];

// دالة تنسيق التاريخ للعرض
const formatDateForDisplay = (dateStr: string): string => {
  if (!dateStr) return 'غير محدد';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    // تنسيق التاريخ بمعكوس الترتيب داخل عزل LTR ليظهر بالترتيب الصحيح (اليوم أولاً من اليمين)
    return `\u202A${year}/${month}/${day}\u202C`;
  } catch {
    return dateStr;
  }
};

// دالة تحويل التاريخ الميلادي إلى هجري (توقيت ليبيا)
const formatHijriDate = (dateStr?: string): string => {
  try {
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date.getTime())) return '';
    const formatted = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
      calendar: 'islamic-umalqura',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Africa/Tripoli',
    }).format(date);
    return formatted.includes('هـ') ? formatted : formatted + ' هـ';
  } catch {
    return '';
  }
};

// دالة تنسيق ملخص الدفعات (صيغة البند الخامس) - نفس منطق الطباعة تمامًا
const formatPaymentsSummary = (installmentsData: string | null, currencySymbol = 'د.ل', currencyWrittenName = 'دينار ليبي'): string => {
  if (!installmentsData) return 'دفعة واحدة عند التوقيع';

  try {
    const raw: any[] = typeof installmentsData === 'string' ? JSON.parse(installmentsData) : (installmentsData as any);
    const installments: Installment[] = Array.isArray(raw)
      ? raw.map((inst: any, idx: number) => ({
          amount: Number(inst?.amount ?? 0) || 0,
          description: String(inst?.description ?? inst?.desc ?? `الدفعة ${idx + 1}`).trim(),
          paymentType: String(inst?.paymentType ?? inst?.type ?? inst?.payment_type ?? '').trim(),
          dueDate: String(inst?.dueDate ?? inst?.due_date ?? '').trim(),
        }))
      : [];

    if (installments.length === 0) return 'دفعة واحدة عند التوقيع';

    // نفس الصيغة التي تُستخدم في الطباعة: "دفعة أولى ... ثم ..."
    return generatePaymentsClauseText(installments, currencySymbol, currencyWrittenName);
  } catch (e) {
    console.error('Error parsing installments:', e);
    return 'دفعة واحدة عند التوقيع';
  }
};

// بيانات تجريبية للمعاينة من العقد 1114 - مع دفعات مدمجة
const SAMPLE_INSTALLMENTS = JSON.stringify([
  {"amount":52000,"paymentType":"عند التوقيع","description":"الدفعة الأولى","dueDate":"2025-07-20"},
  {"amount":50000,"paymentType":"شهري","description":"الدفعة 2","dueDate":"2025-08-20"},
  {"amount":50000,"paymentType":"شهري","description":"الدفعة 3","dueDate":"2025-09-20"},
  {"amount":50000,"paymentType":"شهري","description":"الدفعة 4","dueDate":"2025-10-20"},
  {"amount":50000,"paymentType":"شهري","description":"الدفعة 5","dueDate":"2025-11-20"},
  {"amount":50000,"paymentType":"شهري","description":"الدفعة 6","dueDate":"2025-12-20"},
  {"amount":50000,"paymentType":"شهري","description":"الدفعة 7","dueDate":"2026-01-20"},
  {"amount":50000,"paymentType":"شهري","description":"الدفعة 8","dueDate":"2026-02-20"}
]);

const SAMPLE_CONTRACT_DATA = {
  contractNumber: '1114',
  customerName: 'محمد عبدالله بن نصر ( المدير العام)',
  customerPhone: '0914175007',
  company: 'شركة المدينة للطلاء',
  startDate: '2025-07-20',
  endDate: '2026-07-15',
  duration: '360',
  totalAmount: '402,000',
  totalRent: '393,700',
  currency: 'دينار ليبي',
  billboardsCount: '21',
  adType: 'طلاء المدينة مصراتة',
  year: '2025',
  payments: formatPaymentsSummary(SAMPLE_INSTALLMENTS),
  discount: '8,300', // قيمة تخفيض تجريبية
};

// إعدادات موقع كل جزء من الصفحة
interface SectionPosition {
  x: number;
  y: number;
  fontSize: number;
  visible: boolean;
  textAlign?: 'start' | 'middle' | 'end';
 lineSpacing?: number; // التباعد بين السطرين
  suffixText?: string; // نص إضافي بعد رقم الهاتف
}

interface FirstPartyData {
  companyName: string;
  address: string;
  representative: string;
}

// إعدادات أعمدة الجدول
interface TableColumnSettings {
  key: string;
  label: string;
  visible: boolean;
  width: number;
  fontSize: number;
  headerFontSize: number;
  /**
   * When undefined, it falls back to the global table setting (cellTextAlign).
   */
  textAlign?: 'right' | 'center' | 'left';
  padding?: number; // التباعد الداخلي للعمود
  lineHeight?: number; // ارتفاع السطر
}

interface TableSettings {
  topPosition: number;
  leftPosition: number;
  rightPosition: number;
  tableWidth: number;
  rowHeight: number;
  headerRowHeight: number;
  maxRows: number;
  headerBgColor: string;
  headerTextColor: string;
  borderColor: string;
  borderWidth: number;
  alternateRowColor: string;
  fontSize: number;
  headerFontSize: number;
  fontWeight: string;
  headerFontWeight: string;
  cellTextAlign: 'right' | 'center' | 'left';
  headerTextAlign: 'right' | 'center' | 'left';
  columns: TableColumnSettings[];
  highlightedColumns: string[];
  highlightedColumnBgColor: string;
  highlightedColumnTextColor: string;
  cellTextColor: string;
  cellPadding: number;
  qrForegroundColor: string;
  qrBackgroundColor: string;
}

// دالة تحويل عدد الأوجه للنص العربي
const getFacesText = (faces: number): string => {
  switch(faces) {
    case 1: return 'وجه واحد';
    case 2: return 'وجهين';
    case 3: return 'ثلاثة أوجه';
    case 4: return 'أربعة أوجه';
    default: return `${faces} أوجه`;
  }
};

// مكون لعرض QR Code
const QRCodeCell = ({ gpsUrl, size, foregroundColor, backgroundColor }: { 
  gpsUrl: string; 
  size: number; 
  foregroundColor: string; 
  backgroundColor: string; 
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (gpsUrl) {
      QRCode.toDataURL(gpsUrl, {
        width: Math.max(50, Math.round(size * 4)),
        margin: 0,
        color: {
          dark: foregroundColor,
          light: backgroundColor,
        },
        errorCorrectionLevel: 'M',
      })
        .then((url: string) => setQrDataUrl(url))
        .catch((err: Error) => console.error('QR Error:', err));
    }
  }, [gpsUrl, size, foregroundColor, backgroundColor]);

  if (!qrDataUrl) return null;

  return (
    <a href={gpsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', margin: '0 auto' }}>
      <img 
        src={qrDataUrl} 
        alt="QR Code"
        style={{ 
          height: `${size}px`,
          width: `${size}px`,
          display: 'block',
        }}
      />
    </a>
  );
};

interface GoldLineSettings {
  visible: boolean;
  heightPercent: number;
  color: string;
}

interface DiscountDisplaySettings {
  enabled: boolean;
  showOriginalPrice: boolean;
  originalPriceFontSize: number;
  originalPriceColor: string;
  discountedPriceFontSize: number;
  discountedPriceColor: string;
  strikethroughColor: string;
  strikethroughWidth: number;
}

interface FallbackSettings {
  defaultImageUrl: string;
  defaultGoogleMapsUrl: string;
  useDefaultImage: boolean;
  useDefaultQR: boolean;
}

interface TableTermSettings {
  termTitle: string;
  termContent: string;
  fontSize: number;
  titleFontWeight: string;
  contentFontWeight: string;
  color: string;
  marginBottom: number;
  visible: boolean;
  positionX: number;
  positionY: number;
  goldLine?: GoldLineSettings;
}

interface PageSectionSettings {
  header: SectionPosition;
  date: SectionPosition;
  adType: SectionPosition;
  firstParty: SectionPosition;
  firstPartyData: FirstPartyData;
  secondParty: SectionPosition;
  secondPartyCustomer: SectionPosition;
  termsStartX: number;
  termsStartY: number;
  termsWidth: number;
  termsTextAlign: 'start' | 'middle' | 'end';
  termsTitleWeight: string;
  termsContentWeight: string;
  termsSpacing: number;
  termsLineHeight: number;
  termsGoldLine?: GoldLineSettings;
  tableSettings: TableSettings;
  tableTerm?: TableTermSettings;
  discountDisplay?: DiscountDisplaySettings;
  fallbackSettings?: FallbackSettings;
}

const DEFAULT_TABLE_COLUMNS: TableColumnSettings[] = [
  { key: 'index', label: '#', visible: true, width: 5, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
  { key: 'image', label: 'الصورة', visible: true, width: 10, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
  { key: 'code', label: 'الكود', visible: true, width: 8, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
  { key: 'billboardName', label: 'اسم اللوحة', visible: true, width: 12, fontSize: 26, headerFontSize: 28, padding: 4, lineHeight: 1.3 },
  { key: 'municipality', label: 'البلدية', visible: true, width: 9, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
  { key: 'district', label: 'المنطقة', visible: true, width: 10, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
  { key: 'name', label: 'الموقع', visible: true, width: 14, fontSize: 26, headerFontSize: 28, padding: 4, lineHeight: 1.3 },
  { key: 'size', label: 'المقاس', visible: true, width: 7, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
  { key: 'faces', label: 'الأوجه', visible: true, width: 7, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
  { key: 'price', label: 'السعر', visible: true, width: 9, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
  { key: 'endDate', label: 'تاريخ الانتهاء', visible: false, width: 10, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
  { key: 'durationDays', label: 'المدة (أيام)', visible: false, width: 8, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
  { key: 'location', label: 'GPS', visible: true, width: 9, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
];

const DEFAULT_TABLE_SETTINGS: TableSettings = {
  topPosition: 63.53,
  leftPosition: 5,
  rightPosition: 5,
  tableWidth: 90,
  rowHeight: 12,
  headerRowHeight: 14,
  maxRows: 12,
  headerBgColor: '#000000',
  headerTextColor: '#ffffff',
  borderColor: '#000000',
  borderWidth: 1,
  alternateRowColor: '#f5f5f5',
  fontSize: 10,
  headerFontSize: 11,
  fontWeight: 'normal',
  headerFontWeight: 'bold',
  cellTextAlign: 'center',
  headerTextAlign: 'center',
  columns: DEFAULT_TABLE_COLUMNS,
  highlightedColumns: ['index'],
  highlightedColumnBgColor: '#1a1a2e',
  highlightedColumnTextColor: '#ffffff',
  cellTextColor: '#000000',
  cellPadding: 2,
  qrForegroundColor: '#000000',
  qrBackgroundColor: '#ffffff',
};

const DEFAULT_GOLD_LINE: GoldLineSettings = {
  visible: true,
  heightPercent: 30,
  color: '#D4AF37',
};

const DEFAULT_TABLE_TERM: TableTermSettings = {
  termTitle: 'البند الثامن:',
  termContent: 'المواقع المتفق عليها بين الطرفين',
  fontSize: 14,
  titleFontWeight: 'bold',
  contentFontWeight: 'normal',
  color: '#1a1a2e',
  marginBottom: 8,
  visible: true,
  positionX: 0,
  positionY: 0,
  goldLine: DEFAULT_GOLD_LINE,
};

const DEFAULT_DISCOUNT_DISPLAY: DiscountDisplaySettings = {
  enabled: true,
  showOriginalPrice: true,
  originalPriceFontSize: 18,
  originalPriceColor: '#888888',
  discountedPriceFontSize: 24,
  discountedPriceColor: '#000000',
  strikethroughColor: '#cc0000',
  strikethroughWidth: 2,
};

const DEFAULT_FALLBACK_SETTINGS: FallbackSettings = {
  defaultImageUrl: '/logofaresgold.svg',
  defaultGoogleMapsUrl: 'https://www.google.com/maps?q=32.8872,13.1913',
  useDefaultImage: true,
  useDefaultQR: true,
};

const DEFAULT_SECTION_SETTINGS: PageSectionSettings = {
  header: { x: 2200, y: 680, fontSize: 52, visible: true, textAlign: 'end' },
  date: { x: 300, y: 680, fontSize: 42, visible: true, textAlign: 'start' },
  adType: { x: 2200, y: 770, fontSize: 40, visible: true, textAlign: 'end' },
  firstParty: { x: 2200, y: 900, fontSize: 38, visible: true, textAlign: 'end', lineSpacing: 50 },
  firstPartyData: {
    companyName: '',
    address: '',
    representative: '',
  },
  secondParty: { x: 2200, y: 1050, fontSize: 38, visible: true, textAlign: 'end', lineSpacing: 50 },
  secondPartyCustomer: { x: 2200, y: 1120, fontSize: 36, visible: true, textAlign: 'end', lineSpacing: 50, suffixText: 'بموجب التفويض' },
  termsStartX: 2280,
  termsStartY: 1250,
  termsWidth: 2000,
  termsTextAlign: 'end',
  termsTitleWeight: 'bold',
  termsContentWeight: 'normal',
  termsSpacing: 40,
  termsLineHeight: 65,
  termsGoldLine: DEFAULT_GOLD_LINE,
  tableSettings: DEFAULT_TABLE_SETTINGS,
  tableTerm: DEFAULT_TABLE_TERM,
  discountDisplay: DEFAULT_DISCOUNT_DISPLAY,
  fallbackSettings: DEFAULT_FALLBACK_SETTINGS,
};

export default function ContractTermsSettings() {
  const queryClient = useQueryClient();
  const { confirm: systemConfirm } = useSystemDialog();
  const [selectedTerm, setSelectedTerm] = useState<ContractTerm | null>(null);
  const [editedTerm, setEditedTerm] = useState<Partial<ContractTerm> | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTerm, setNewTerm] = useState<Partial<ContractTerm>>(DEFAULT_TERM);
  const [previewScale, setPreviewScale] = useState(0.25);
  const [activeTab, setActiveTab] = useState('terms');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<'page1' | 'page2'>('page1');
  const [, forceFontRerender] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);
  const printRestoredRef = useRef(false);
  
  // Drag state for SVG elements
  const [dragState, setDragState] = useState<{
    section: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const restoreAfterPrint = useCallback(() => {
    if (printRestoredRef.current) return;
    printRestoredRef.current = true;
    setIsPrinting(false);
    setTimeout(() => {
      printRestoredRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = () => restoreAfterPrint();
    window.addEventListener("afterprint", handler);

    const mql = window.matchMedia?.("print");
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) restoreAfterPrint();
    };

    // Modern browsers
    mql?.addEventListener?.("change", onChange);
    // Safari fallback (deprecated API)
    mql?.addListener?.(onChange);

    return () => {
      window.removeEventListener("afterprint", handler);
      mql?.removeEventListener?.("change", onChange);
      // Safari fallback
      mql?.removeListener?.(onChange);
    };
  }, [restoreAfterPrint]);

  useEffect(() => {
    // Ensure text measurement uses the loaded custom fonts (Doran/Manrope) to avoid gold line overflow.
    if (typeof document === "undefined" || !("fonts" in document)) return;
    const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
    if (!fonts?.ready) return;

    fonts.ready.then(() => {
      __textMeasureCache.clear();
      forceFontRerender((t) => t + 1);
    });
  }, []);
  
  // إعدادات مواقع أجزاء الصفحة
  const [sectionSettings, setSectionSettings] = useState<PageSectionSettings>(DEFAULT_SECTION_SETTINGS);
  const [backgroundUrl, setBackgroundUrl] = useState('/bgc1.svg');
  const [tableBackgroundUrl, setTableBackgroundUrl] = useState('/bgc2.svg');
  const [noStampBgUrl, setNoStampBgUrl] = useState('/bgc1not.svg');
  const [noStampTableBgUrl, setNoStampTableBgUrl] = useState('/bgc2.svg');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [previewContractData, setPreviewContractData] = useState(SAMPLE_CONTRACT_DATA);
  const [previewBillboards, setPreviewBillboards] = useState<any[]>([]);
  const sampleBillboards = [
    { id: 9, code: 'TR-SJ0009', billboardName: 'لوحة رقم 9', name: 'بجوار سياج مطار معيثيقة', size: '10×4', faces: 2, municipality: 'سوق الجمعة', district: 'طريق الشط', price: 50000, image: 'https://lh3.googleusercontent.com/d/1fO8SBFNMKimX20pAp_mhecDO8CwwTS1W', gps: 'https://www.google.com/maps?q=32.90825537179782,13.281454746188881' },
    { id: 27, code: 'TR-TC0027', billboardName: 'لوحة رقم 27', name: 'شارع عمر المختار', size: '10×4', faces: 2, municipality: 'طرابلس المركز', district: 'شارع عمر المختار', price: 50000, image: 'https://lh3.googleusercontent.com/d/1ixiDd9GWYUL_isAnkkn6XIhP3F88i5vR', gps: 'https://www.google.com/maps?q=32.883557,13.160178' },
    { id: 127, code: 'TR-TG0127', billboardName: 'لوحة رقم 127', name: 'الطريق الساحلي تاجوراء', size: '12×4', faces: 2, municipality: 'تاجوراء', district: 'الطريق الساحلي', price: 55000, image: 'https://lh3.googleusercontent.com/d/154iOgwbBqCHAla_vAepNLMweISdeGdr1', gps: 'https://www.google.com/maps?q=32.823573,13.519761' },
    { id: 219, code: 'TR-HA0219', billboardName: 'لوحة رقم 219', name: 'طريق الكريمية', size: '6×3', faces: 2, municipality: 'حي الأندلس', district: 'طريق الكريمية', price: 14000, image: 'https://lh3.googleusercontent.com/d/1lUzKg1ttN0rYFVTL0OqlfpzpiFMpGFSG', gps: 'https://www.google.com/maps?q=32.802585,13.113454' },
    { id: 220, code: 'TR-BS0220', billboardName: 'لوحة رقم 220', name: 'طريق الكريمية', size: '8×3', faces: 2, municipality: 'بوسليم', district: 'طريق الكريمية', price: 16000, image: 'https://lh3.googleusercontent.com/d/1LyVE7COutuj4Lg7eWu080CVsdLY3TIg6', gps: 'https://www.google.com/maps?q=32.801722,13.113184' },
    { id: 259, code: 'TR-BS0259', billboardName: 'لوحة رقم 259', name: 'غابة النصر', size: '8×3', faces: 1, municipality: 'بوسليم', district: 'غابة النصر', price: 16000, image: 'https://lh3.googleusercontent.com/d/1vEnzGLUV5vhjZWv8xEzUW8EurbjbScCy', gps: 'https://www.google.com/maps?q=32.866809,13.179059' },
    { id: 271, code: 'TR-AZ0271', billboardName: 'لوحة رقم 271', name: 'صلاح الدين', size: '8×3', faces: 2, municipality: 'عين زارة', district: 'صلاح الدين', price: 16000, image: 'https://lh3.googleusercontent.com/d/10R4FYtq1qJ3TETPuUMTpURh-6r9Kv33j', gps: 'https://www.google.com/maps?q=32.799152,13.220569' },
    { id: 273, code: 'TR-AZ0273', billboardName: 'لوحة رقم 273', name: 'صلاح الدين', size: '8×3', faces: 2, municipality: 'عين زارة', district: 'صلاح الدين', price: 16000, image: 'https://lh3.googleusercontent.com/d/1Ho9OlbV0Bj7lfdDdhpp5gf30UqF9FllG', gps: 'https://www.google.com/maps?q=32.836560,13.208599' },
    { id: 277, code: 'TR-BS0277', billboardName: 'لوحة رقم 277', name: 'صلاح الدين', size: '6×3', faces: 2, municipality: 'بوسليم', district: 'صلاح الدين', price: 14000, image: 'https://lh3.googleusercontent.com/d/1xDKDiPKVgdE6rCULOshbwYlDPsUpvBal', gps: 'https://www.google.com/maps?q=32.774173,13.19916' },
    { id: 279, code: 'TR-AZ0279', billboardName: 'لوحة رقم 279', name: 'صلاح الدين', size: '8×3', faces: 2, municipality: 'عين زارة', district: 'صلاح الدين', price: 16000, image: 'https://lh3.googleusercontent.com/d/1Y3NQA_TS5xgj5XdjjCPE_8ze2WbpeYU4', gps: 'https://www.google.com/maps?q=32.809252,13.222941' },
    { id: 311, code: 'TR-JZ0311', billboardName: 'لوحة رقم 311', name: 'الطريق الساحلي', size: '8×3', faces: 2, municipality: 'جنزور', district: 'الطريق الساحلي', price: 16000, image: 'https://lh3.googleusercontent.com/d/1C60NSIUM4ky3Z1g2zkh99piL_dTgoCdE', gps: 'https://www.google.com/maps?q=32.820944,12.975107' },
    { id: 315, code: 'TR-JZ0315', billboardName: 'لوحة رقم 315', name: 'الطريق الساحلي', size: '8×3', faces: 2, municipality: 'جنزور', district: 'الطريق الساحلي', price: 16000, image: 'https://lh3.googleusercontent.com/d/14azGrHurImitb7hICmw41PKyvgd-VMd1', gps: 'https://www.google.com/maps?q=32.826935,12.996894' },
    { id: 316, code: 'TR-JZ0316', billboardName: 'لوحة رقم 316', name: 'الطريق الساحلي', size: '8×3', faces: 2, municipality: 'جنزور', district: 'الطريق الساحلي', price: 16000, image: 'https://lh3.googleusercontent.com/d/1IXKBjFEKgBebmEMUKVUdYmEHsf17dXiz', gps: 'https://www.google.com/maps?q=32.828520,13.009802' },
    { id: 351, code: 'TR-TG0351', billboardName: 'لوحة رقم 351', name: 'طريق الشط', size: '8×3', faces: 2, municipality: 'تاجوراء', district: 'طريق الشط', price: 16000, image: 'https://lh3.googleusercontent.com/d/1wt3kNgMXmtqcgQnADe73G8iO8VVwQYT1', gps: 'https://www.google.com/maps?q=32.894840,13.376913' },
    { id: 361, code: 'TR-TG0361', billboardName: 'لوحة رقم 361', name: 'جزيرة 25', size: '8×3', faces: 2, municipality: 'تاجوراء', district: 'جزيرة 25', price: 16000, image: 'https://lh3.googleusercontent.com/d/11IeCLi1_tWif8DnbCHAczhsvQrnzW9dc', gps: 'https://www.google.com/maps?q=32.885531,13.328127' },
    { id: 541, code: 'TR-TC0541', billboardName: 'لوحة رقم 541', name: 'الظهرة', size: '4×3', faces: 2, municipality: 'طرابلس المركز', district: 'الظهرة', price: 9000, image: 'https://lh3.googleusercontent.com/d/1a50Fzeg394RVfJTXkiFZSi1XExRbc0sT', gps: 'https://www.google.com/maps?q=32.894070,13.202471' },
    { id: 552, code: 'TR-BS0552', billboardName: 'لوحة رقم 552', name: 'الحديقة', size: '4×3', faces: 2, municipality: 'بوسليم', district: 'الحديقة', price: 9000, image: 'https://lh3.googleusercontent.com/d/1aNYeAxnMikpqrGybMNPIgEZDoNYRlLHx', gps: 'https://www.google.com/maps?q=32.865454,13.178380' },
    { id: 554, code: 'TR-BS0554', billboardName: 'لوحة رقم 554', name: 'الهضبة', size: '4×3', faces: 2, municipality: 'بوسليم', district: 'الهضبة', price: 9000, image: 'https://lh3.googleusercontent.com/d/1fFHRU3CL8IZ_S8V62kRwtmRCq3rP7UG2', gps: 'https://www.google.com/maps?q=32.851960,13.192338' },
  ];

  // Available backgrounds
  const availableBackgrounds = [
    { url: '/bgc1.svg', name: 'القالب الأول (مع ختم)' },
    { url: '/bgc1not.svg', name: 'القالب الأول (بدون ختم)' },
    { url: '/bgc2.svg', name: 'القالب الثاني' },
  ];

  // Fetch contracts list for preview selection
  const { data: contractsList } = useQuery({
    queryKey: ['contracts-list-preview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", Company, "Ad Type", "Contract Date", billboards_count')
        .order('Contract_Number', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch selected contract details
  const { data: selectedContract, isLoading: isLoadingContract } = useQuery({
    queryKey: ['contract-preview-details', selectedContractId],
    queryFn: async () => {
      if (!selectedContractId) return null;
      
      const { data: contract, error: contractError } = await supabase
        .from('Contract')
        .select('*')
        .eq('Contract_Number', selectedContractId)
        .maybeSingle();
      
      if (contractError) throw contractError;
      if (!contract) return null;

      // Get billboards for this contract
      const { data: billboards, error: billboardsError } = await supabase
        .from('billboards')
        .select('*')
        .eq('Contract_Number', selectedContractId);
      
      if (billboardsError) throw billboardsError;

      return { contract, billboards: billboards || [] };
    },
    enabled: !!selectedContractId,
  });

  // Update preview data when contract is selected
  useEffect(() => {
    const updatePreviewData = async () => {
      if (selectedContract?.contract) {
        const c = selectedContract.contract;
        const discount = c.Discount || 0;
        const totalRent = c['Total Rent'] || 0;
        
        // استخدام دالة تنسيق الدفعات مع دمج المتكررة - مع العملة الصحيحة
        const currencyCode = c.contract_currency || 'LYD';
        const currencyMap: Record<string, { symbol: string; written: string }> = {
          'LYD': { symbol: 'د.ل', written: 'دينار ليبي' },
          'USD': { symbol: '$', written: 'دولار أمريكي' },
          'EUR': { symbol: '€', written: 'يورو' },
          'SAR': { symbol: 'ر.س', written: 'ريال سعودي' },
          'AED': { symbol: 'د.إ', written: 'درهم إماراتي' },
          'TRY': { symbol: '₺', written: 'ليرة تركية' },
        };
        const curr = currencyMap[currencyCode] || currencyMap['LYD'];
        const paymentsText = formatPaymentsSummary(c.installments_data, curr.symbol, curr.written);
        
        // ✅ جلب بيانات الزبون من جدول customers للحصول على الشركة والهاتف
        let customerName = c['Customer Name'] || '';
        let customerPhone = c.Phone || '';
        let customerCompany = c.Company || '';
        
        const customerId = c.customer_id;
        if (customerId) {
          try {
            const { data: customerData } = await supabase
              .from('customers')
              .select('name, company, phone')
              .eq('id', customerId)
              .single();
            
            if (customerData) {
              customerName = customerData.name || customerName;
              customerCompany = customerData.company || customerCompany;
              customerPhone = customerData.phone || customerPhone;
            }
          } catch (e) {
            // fallback to contract data
          }
        }
        
        setPreviewContractData({
          contractNumber: String(c.Contract_Number),
          customerName,
          customerPhone,
          company: customerCompany,
          startDate: c['Contract Date'] || '',
          endDate: c['End Date'] || '',
          duration: c.Duration || '',
          totalAmount: c.Total ? c.Total.toLocaleString() : '0',
          totalRent: totalRent ? totalRent.toLocaleString() : '0',
          currency: curr.written,
          billboardsCount: String(c.billboards_count || selectedContract.billboards?.length || 0),
          adType: c['Ad Type'] || '',
          year: c['Contract Date'] ? new Date(c['Contract Date']).getFullYear().toString() : '',
          payments: paymentsText,
          discount: discount > 0 ? discount.toLocaleString() : '',
        });

        // Transform billboards for preview
        const transformedBillboards = selectedContract.billboards?.map((b: any) => {
          const originalPrice = b.Price || 0;
          const billboardDiscount = discount > 0 && totalRent > 0 ? (originalPrice / totalRent) * discount : 0;
          const priceAfterDiscount = originalPrice - billboardDiscount;
          const hasDiscount = discount > 0 && billboardDiscount > 0;

          return {
            id: b.ID,
            code: b.Billboard_Name || `TR-${b.ID}`,
            billboardName: `لوحة رقم ${b.ID}`,
            name: b.Nearest_Landmark || '',
            size: b.Size || '',
            faces: b.Faces_Count || 1,
            municipality: b.Municipality || '',
            district: b.District || '',
            price: hasDiscount ? priceAfterDiscount : originalPrice,
            originalPrice: hasDiscount ? originalPrice : undefined,
            hasDiscount,
            image: b.Image_URL || '',
            gps: b.GPS_Link || '',
          };
        }) || [];

        setPreviewBillboards(transformedBillboards);
      } else if (!selectedContractId) {
        // Reset to sample data
        setPreviewContractData(SAMPLE_CONTRACT_DATA);
        setPreviewBillboards([]);
      }
    };
    
    updatePreviewData();
  }, [selectedContract, selectedContractId]);

  // Fetch template settings
  const { data: templateSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['contract-template-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_template_settings')
        .select('*')
        .eq('setting_key', 'default')
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Load saved settings
  useEffect(() => {
    if (templateSettings) {
      if (templateSettings.setting_value) {
        const loadedSettings = templateSettings.setting_value as unknown as Partial<PageSectionSettings>;
        
        // دمج الأعمدة: احتفظ بالأعمدة المحفوظة وأضف أي أعمدة جديدة من الافتراضية
        let mergedColumns = DEFAULT_TABLE_COLUMNS;
        if (loadedSettings.tableSettings?.columns) {
          const savedColumns = loadedSettings.tableSettings.columns;
          const savedColumnKeys = savedColumns.map(c => c.key);
          // أضف أي أعمدة جديدة غير موجودة في المحفوظة
          const newColumns = DEFAULT_TABLE_COLUMNS.filter(c => !savedColumnKeys.includes(c.key));
          mergedColumns = [...savedColumns, ...newColumns];
        }
        
        setSectionSettings(prev => ({
          ...DEFAULT_SECTION_SETTINGS,
          ...loadedSettings,
          // دمج الحقول المتداخلة بشكل صحيح مع القيم الافتراضية
          header: { ...DEFAULT_SECTION_SETTINGS.header, ...(loadedSettings.header || {}) },
          date: { ...DEFAULT_SECTION_SETTINGS.date, ...(loadedSettings.date || {}) },
          adType: { ...DEFAULT_SECTION_SETTINGS.adType!, ...(loadedSettings.adType || {}) },
          firstParty: { ...DEFAULT_SECTION_SETTINGS.firstParty, ...(loadedSettings.firstParty || {}) },
          firstPartyData: { ...DEFAULT_SECTION_SETTINGS.firstPartyData, ...(loadedSettings.firstPartyData || {}) },
          secondParty: { ...DEFAULT_SECTION_SETTINGS.secondParty, ...(loadedSettings.secondParty || {}) },
          secondPartyCustomer: { ...DEFAULT_SECTION_SETTINGS.secondPartyCustomer!, ...(loadedSettings.secondPartyCustomer || {}) },
          tableSettings: {
            ...DEFAULT_TABLE_SETTINGS,
            ...(loadedSettings.tableSettings || {}),
            columns: mergedColumns,
          },
          tableTerm: {
            ...DEFAULT_TABLE_TERM,
            ...(loadedSettings.tableTerm || {}),
          },
          termsGoldLine: {
            ...DEFAULT_GOLD_LINE,
            ...(loadedSettings.termsGoldLine || {}),
          },
          discountDisplay: {
            ...DEFAULT_DISCOUNT_DISPLAY,
            ...(loadedSettings.discountDisplay || {}),
          },
          fallbackSettings: {
            ...DEFAULT_FALLBACK_SETTINGS,
            ...(loadedSettings.fallbackSettings || {}),
          },
        }));
      }
      if (templateSettings.background_url) {
        setBackgroundUrl(templateSettings.background_url);
      }
      // تحميل خلفية جدول اللوحات
      const loadedTableBg = (templateSettings.setting_value as any)?.tableBackgroundUrl;
      if (loadedTableBg) {
        setTableBackgroundUrl(loadedTableBg);
      }
      const loadedNoStampBg = (templateSettings.setting_value as any)?.noStampBgUrl;
      if (loadedNoStampBg) {
        setNoStampBgUrl(loadedNoStampBg);
      }
      const loadedNoStampTableBg = (templateSettings.setting_value as any)?.noStampTableBgUrl;
      if (loadedNoStampTableBg) {
        setNoStampTableBgUrl(loadedNoStampTableBg);
      }
    }
  }, [templateSettings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      // First check if record exists
      const { data: existing } = await supabase
        .from('contract_template_settings')
        .select('id')
        .eq('setting_key', 'default')
        .maybeSingle();

      const settingsJson = JSON.parse(JSON.stringify({ ...sectionSettings, tableBackgroundUrl, noStampBgUrl, noStampTableBgUrl }));

      // Always update (upsert behavior - since we already inserted default in migration)
      const { error } = await supabase
        .from('contract_template_settings')
        .update({
          setting_value: settingsJson,
          background_url: backgroundUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('setting_key', 'default');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-template-settings'] });
      toast.success('تم حفظ الإعدادات بنجاح');
    },
    onError: (error) => {
      toast.error('فشل حفظ الإعدادات: ' + error.message);
    },
  });

  // Fetch all contract terms
  const { data: terms = [], isLoading, error } = useQuery({
    queryKey: ['contract-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_terms')
        .select('*')
        .order('term_order', { ascending: true });
      
      if (error) throw error;
      return data as ContractTerm[];
    },
  });

  // Update term mutation
  const updateMutation = useMutation({
    mutationFn: async (term: Partial<ContractTerm>) => {
      const { error } = await supabase
        .from('contract_terms')
        .update({
          term_title: term.term_title,
          term_content: term.term_content,
          term_order: term.term_order,
          is_active: term.is_active,
          font_size: term.font_size,
          font_weight: term.font_weight,
          position_x: term.position_x,
          position_y: term.position_y,
        })
        .eq('id', term.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-terms'] });
      toast.success('تم حفظ التعديلات بنجاح');
      setSelectedTerm(null);
      setEditedTerm(null);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء الحفظ: ' + error.message);
    },
  });

  // Add new term mutation
  const addMutation = useMutation({
    mutationFn: async (term: Partial<ContractTerm>) => {
      const { error } = await supabase
        .from('contract_terms')
        .insert({
          term_key: term.term_key,
          term_title: term.term_title,
          term_content: term.term_content,
          term_order: term.term_order,
          is_active: term.is_active ?? true,
          font_size: term.font_size ?? 42,
          font_weight: term.font_weight ?? 'normal',
          position_x: term.position_x ?? 1200,
          position_y: term.position_y ?? 0,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-terms'] });
      toast.success('تم إضافة البند بنجاح');
      setIsAddDialogOpen(false);
      setNewTerm(DEFAULT_TERM);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء الإضافة: ' + error.message);
    },
  });

  // Delete term mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contract_terms')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-terms'] });
      toast.success('تم حذف البند بنجاح');
      setSelectedTerm(null);
      setEditedTerm(null);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء الحذف: ' + error.message);
    },
  });

  // Move term order
  const moveTermOrder = async (termId: string, direction: 'up' | 'down') => {
    const currentIndex = terms.findIndex(t => t.id === termId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= terms.length) return;
    
    const currentTerm = terms[currentIndex];
    const swapTerm = terms[newIndex];
    
    try {
      await supabase
        .from('contract_terms')
        .update({ term_order: swapTerm.term_order })
        .eq('id', currentTerm.id);
      
      await supabase
        .from('contract_terms')
        .update({ term_order: currentTerm.term_order })
        .eq('id', swapTerm.id);
      
      queryClient.invalidateQueries({ queryKey: ['contract-terms'] });
      toast.success('تم تغيير الترتيب');
    } catch (error) {
      toast.error('حدث خطأ أثناء تغيير الترتيب');
    }
  };

  const handleSelectTerm = (term: ContractTerm) => {
    setSelectedTerm(term);
    setEditedTerm({ ...term });
  };

  const handleSave = () => {
    if (editedTerm) {
      updateMutation.mutate(editedTerm);
    }
  };

  const handleAddTerm = () => {
    if (!newTerm.term_key || !newTerm.term_title || !newTerm.term_content) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    
    const maxOrder = terms.length > 0 ? Math.max(...terms.map(t => t.term_order)) + 1 : 0;
    addMutation.mutate({ ...newTerm, term_order: maxOrder });
  };

  const handleReset = () => {
    if (selectedTerm) {
      setEditedTerm({ ...selectedTerm });
    }
  };

  // Replace variables with selected contract data or sample data
  const replaceVariables = (text: string) => {
    const data = previewContractData;
    // إذا لم يكن هناك تخفيض، نزيل المتغير {discount} بالكامل مع أي مسافات زائدة
    const discountValue = data.discount && data.discount !== '0' && data.discount !== '' 
      ? `بعد خصم ${data.discount} ${data.currency}` 
      : '';
    
    // بناء نص شامل/غير شامل بناءً على بيانات العقد - نفس منطق الطباعة
    const inclusionParts: string[] = [];
    if (selectedContract?.contract) {
      const c = selectedContract.contract;
      const installationEnabled = c.installation_enabled !== false && (c.installation_enabled as any) !== 0;
      const printCostEnabled = Boolean(
        c.print_cost_enabled === "true" ||
        c.print_cost_enabled === "1" ||
        (c.print_cost_enabled as any) === true || 
        (c.print_cost_enabled as any) === 1
      );
      if (installationEnabled) { inclusionParts.push('شامل التركيب'); } else { inclusionParts.push('غير شامل التركيب'); }
      if (printCostEnabled) { inclusionParts.push('شامل الطباعة'); } else { inclusionParts.push('غير شامل الطباعة'); }
    } else {
      inclusionParts.push('شامل الطباعة والتركيب');
    }
    const inclusionText = inclusionParts.join(' و');

    return text
      .replace(/{duration}/g, data.duration)
      .replace(/{startDate}/g, data.startDate)
      .replace(/{endDate}/g, data.endDate)
      .replace(/{customerName}/g, data.customerName)
      .replace(/{contractNumber}/g, data.contractNumber)
      .replace(/{totalAmount}/g, data.totalAmount)
      .replace(/{discount}/g, discountValue)
      .replace(/{currency}/g, data.currency)
      .replace(/{billboardsCount}/g, data.billboardsCount)
      .replace(/{payments}/g, data.payments)
      .replace(/{inclusionText}/g, inclusionText)
      // تنظيف المسافات الزائدة إذا كان التخفيض فارغاً
      .replace(/\s{2,}/g, ' ')
      .replace(/\.\s*\./g, '.')
      .trim();
  };

  // Highlight variables in text
  const highlightVariables = (text: string) => {
    let result = text;
    AVAILABLE_VARIABLES.forEach(v => {
      result = result.replace(
        new RegExp(v.key.replace(/[{}]/g, '\\$&'), 'g'),
        `<span class="bg-amber-200 dark:bg-amber-800 px-1 rounded text-amber-900 dark:text-amber-100 font-medium">${v.key}</span>`
      );
    });
    return result;
  };

  // Insert variable at cursor position
  const insertVariable = (variable: string) => {
    if (!editedTerm) return;
    const currentContent = editedTerm.term_content || '';
    setEditedTerm({
      ...editedTerm,
      term_content: currentContent + ' ' + variable
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mr-2">جاري التحميل...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 text-destructive">
        حدث خطأ في تحميل البيانات
      </div>
    );
  }

  // Split long text into lines that fit within maxWidth (pixel-based measurement)
  const wrapText = (text: string, _maxCharsPerLine: number = 70, fontSize: number = 42): string[] => {
    const maxWidthPx = sectionSettings.termsWidth;
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    const fontFamily = 'Doran, sans-serif';
    
    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = measureTextWidthPx(testLine, fontSize, fontFamily, 'normal');
      
      if (testWidth > maxWidthPx && currentLine) {
        lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine.trim());
    
    return lines;
  };

  // تحديث إعدادات عمود في الجدول
  const updateColumnSetting = (columnKey: string, field: keyof TableColumnSettings, value: any) => {
    setSectionSettings(prev => ({
      ...prev,
      tableSettings: {
        ...prev.tableSettings,
        columns: prev.tableSettings.columns.map(col => 
          col.key === columnKey ? { ...col, [field]: value } : col
        )
      }
    }));
  };

  // تحريك عمود للأعلى أو الأسفل
  const moveColumn = (columnKey: string, direction: 'up' | 'down') => {
    setSectionSettings(prev => {
      const columns = [...prev.tableSettings.columns];
      const currentIndex = columns.findIndex(col => col.key === columnKey);
      
      if (currentIndex === -1) return prev;
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      if (newIndex < 0 || newIndex >= columns.length) return prev;
      
      // Swap columns
      [columns[currentIndex], columns[newIndex]] = [columns[newIndex], columns[currentIndex]];
      
      return {
        ...prev,
        tableSettings: {
          ...prev.tableSettings,
          columns
        }
      };
    });
  };

  // --- Drag handlers for SVG elements ---
  const handleSvgMouseDown = (section: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const scaleX = 2480 / svgRect.width;
    const scaleY = 3508 / svgRect.height;
    const pos = sectionSettings[section as keyof PageSectionSettings] as SectionPosition;
    if (!pos) return;
    setDragState({
      section,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    });
    setSelectedSection(section);
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (!dragState || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const scaleX = 2480 / svgRect.width;
    const scaleY = 3508 / svgRect.height;
    const dx = (e.clientX - dragState.startX) * scaleX;
    const dy = (e.clientY - dragState.startY) * scaleY;
    const newX = Math.round(dragState.origX + dx);
    const newY = Math.round(dragState.origY + dy);
    const key = dragState.section as 'header' | 'date' | 'adType' | 'firstParty' | 'secondParty' | 'secondPartyCustomer';
    setSectionSettings(s => ({
      ...s,
      [key]: { ...s[key], x: newX, y: newY }
    }));
  };

  const handleSvgMouseUp = () => {
    setDragState(null);
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <FileText className="h-6 w-6" />
            إعدادات قالب العقد
          </h1>
          <p className="text-muted-foreground text-sm">
            تعديل وتنسيق الصفحة الأولى (البنود) والصفحة الثانية (جدول اللوحات)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Page Toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button 
              variant={activePage === 'page1' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActivePage('page1')}
              className="gap-1"
            >
              <FileText className="h-3 w-3" />
              الصفحة الأولى
            </Button>
            <Button 
              variant={activePage === 'page2' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActivePage('page2')}
              className="gap-1"
            >
              <Settings className="h-3 w-3" />
              جدول اللوحات
            </Button>
          </div>
          {/* Contract Selection for Preview */}
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1">
            <Label className="text-xs whitespace-nowrap">عقد المعاينة:</Label>
            <Select 
              value={selectedContractId ? String(selectedContractId) : "sample"} 
              onValueChange={(v) => setSelectedContractId(v === "sample" ? null : Number(v))}
            >
              <SelectTrigger className="h-7 w-[180px] text-xs">
                <SelectValue placeholder="اختر عقد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sample">بيانات تجريبية</SelectItem>
                {contractsList?.map((c: any) => (
                  <SelectItem key={c.Contract_Number} value={String(c.Contract_Number)}>
                    #{c.Contract_Number} - {c['Customer Name'] || c.Company || 'بدون اسم'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isLoadingContract && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1">
            <Label className="text-xs">حجم المعاينة:</Label>
            <Slider
              value={[previewScale]}
              onValueChange={(v) => setPreviewScale(v[0])}
              min={0.15}
              max={0.5}
              step={0.05}
              className="w-20"
            />
            <span className="text-xs font-mono w-8">{Math.round(previewScale * 100)}%</span>
          </div>
          <Button
            onClick={async () => {
              // مقاس التصميم الداخلي (نفس viewBox)
              const DESIGN_W = 2480;
              const DESIGN_H = 3508;

              // تحويل A4 إلى px (المتصفح يعتبر 1in = 96px)
              const a4WidthPx = (210 / 25.4) * 96;
              const printScale = a4WidthPx / DESIGN_W;

              // نأخذ نسخة من المعاينة الأولى (البنود)
              const page1El = document.querySelector(
                '.contract-preview-container'
              ) as HTMLElement | null;

              if (!page1El) {
                toast.error('لم يتم العثور على المعاينة للطباعة');
                return;
              }

              // استنساخ الصفحة الأولى
              const clonedPage1 = page1El.cloneNode(true) as HTMLElement;
              clonedPage1.style.width = `${DESIGN_W}px`;
              clonedPage1.style.height = `${DESIGN_H}px`;
              clonedPage1.style.removeProperty('transform');
              clonedPage1.style.removeProperty('transform-origin');

              // بيانات اللوحات للطباعة
              const billboardsData = previewBillboards.length > 0 ? previewBillboards : sampleBillboards;
              const maxRowsPerPage = sectionSettings.tableSettings.maxRows || 8;
              
              // تقسيم اللوحات إلى صفحات
              const billboardPages: any[][] = [];
              for (let i = 0; i < billboardsData.length; i += maxRowsPerPage) {
                billboardPages.push(billboardsData.slice(i, i + maxRowsPerPage));
              }

              // إنشاء HTML للجداول
              const generateTablePageHtml = (billboards: any[], pageIndex: number) => {
                const visibleColumns = sectionSettings.tableSettings.columns.filter(col => col.visible);
                
                const getCellValue = (billboard: any, col: any, idx: number) => {
                  switch (col.key) {
                    case 'index': return idx + 1 + (pageIndex * maxRowsPerPage);
                    case 'id': return billboard.id;
                    case 'code': return billboard.code || '';
                    case 'billboardName': return billboard.billboardName || '';
                    case 'name': return billboard.name || '';
                    case 'size': return billboard.size || '';
                    case 'faces': return billboard.faces || '';
                    case 'municipality': return billboard.municipality || '';
                    case 'district': return billboard.district || '';
                    case 'price': 
                      if (billboard.hasDiscount && billboard.originalPrice) {
                        return `<span style="text-decoration: line-through; color: #999; font-size: 0.8em;">${billboard.originalPrice.toLocaleString()}</span><br/>${billboard.price.toLocaleString()}`;
                      }
                      return billboard.price ? billboard.price.toLocaleString() : '';
                    case 'image': return billboard.image ? `<img src="${billboard.image}" style="width: 100%; height: 100%; object-fit: cover;" />` : '';
                    case 'location': return billboard.gps ? `<a href="${billboard.gps}" target="_blank" style="color: #004aad;">خريطة</a>` : '';
                    default: return '';
                  }
                };

                return `
                  <div class="print-page">
                    <div class="contract-preview-container" style="width: ${DESIGN_W}px; height: ${DESIGN_H}px;">
                      <img src="${tableBackgroundUrl}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;" />
                      <div style="position: absolute; top: ${sectionSettings.tableSettings.topPosition * 3.779}px; left: ${(100 - (sectionSettings.tableSettings.tableWidth || 90)) / 2}%; width: ${sectionSettings.tableSettings.tableWidth || 90}%; z-index: 20;">
                        ${pageIndex === 0 && sectionSettings.tableTerm?.visible !== false ? `
                          <div style="text-align: center; margin-bottom: ${sectionSettings.tableTerm?.marginBottom || 8}px; font-family: Doran, sans-serif; direction: rtl;">
                            <h2 style="font-size: ${sectionSettings.tableTerm?.fontSize || 14}px; color: ${sectionSettings.tableTerm?.color || '#1a1a2e'}; margin: 0; display: inline-block;">
                              <span style="font-weight: ${sectionSettings.tableTerm?.titleFontWeight || 'bold'};">${sectionSettings.tableTerm?.termTitle || 'البند الثامن:'}</span>
                              <span style="font-weight: ${sectionSettings.tableTerm?.contentFontWeight || 'normal'};">${sectionSettings.tableTerm?.termContent || 'المواقع المتفق عليها بين الطرفين'}</span>
                            </h2>
                          </div>
                        ` : ''}
                        <table style="width: 100%; border-collapse: collapse; table-layout: fixed; font-size: ${sectionSettings.tableSettings.fontSize || 8}px; font-family: Doran, sans-serif; direction: rtl;" dir="rtl">
                          <thead>
                            <tr style="height: ${(sectionSettings.tableSettings.headerRowHeight || 14) * 3.779}px;">
                              ${visibleColumns.map(col => {
                                const isHighlighted = (sectionSettings.tableSettings.highlightedColumns || ['index']).includes(col.key);
                                const headerBg = isHighlighted ? (sectionSettings.tableSettings.highlightedColumnBgColor || '#1a1a2e') : sectionSettings.tableSettings.headerBgColor;
                                const headerFg = isHighlighted ? (sectionSettings.tableSettings.highlightedColumnTextColor || '#ffffff') : sectionSettings.tableSettings.headerTextColor;
                                return `<th style="width: ${col.width}%; background-color: ${headerBg}; color: ${headerFg}; padding: ${col.padding ?? sectionSettings.tableSettings.cellPadding ?? 2}px; border: ${sectionSettings.tableSettings.borderWidth ?? 1}px solid ${sectionSettings.tableSettings.borderColor}; font-size: ${col.headerFontSize ?? sectionSettings.tableSettings.headerFontSize ?? 11}px; font-weight: ${sectionSettings.tableSettings.headerFontWeight || 'bold'}; text-align: ${sectionSettings.tableSettings.headerTextAlign || 'center'}; vertical-align: middle;">${col.label}</th>`;
                              }).join('')}
                            </tr>
                          </thead>
                          <tbody>
                            ${billboards.map((billboard, idx) => `
                              <tr style="height: ${(sectionSettings.tableSettings.rowHeight || 12) * 3.779}px; background-color: ${idx % 2 === 1 ? sectionSettings.tableSettings.alternateRowColor : 'white'};">
                                ${visibleColumns.map(col => {
                                  const isHighlighted = (sectionSettings.tableSettings.highlightedColumns || ['index']).includes(col.key);
                                  const cellBg = isHighlighted ? (sectionSettings.tableSettings.highlightedColumnBgColor || '#1a1a2e') : '';
                                  const cellColor = isHighlighted ? (sectionSettings.tableSettings.highlightedColumnTextColor || '#ffffff') : (sectionSettings.tableSettings.cellTextColor || '#000000');
                                  return `<td style="border: ${sectionSettings.tableSettings.borderWidth ?? 1}px solid ${sectionSettings.tableSettings.borderColor}; padding: ${col.key === 'image' || col.key === 'location' ? 0 : (col.padding ?? sectionSettings.tableSettings.cellPadding ?? 2)}px; text-align: ${col.textAlign ?? (sectionSettings.tableSettings.cellTextAlign || 'center')}; font-size: ${col.fontSize ?? sectionSettings.tableSettings.fontSize ?? 10}px; background-color: ${cellBg}; color: ${cellColor}; vertical-align: middle;">${getCellValue(billboard, col, idx)}</td>`;
                                }).join('')}
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                `;
              };

              // CSS للطباعة
              const stylesHtml = Array.from(
                document.querySelectorAll('style, link[rel="stylesheet"]')
              )
                .map((n) => (n as HTMLElement).outerHTML)
                .join('\n');

              const origin = window.location.origin;

              const html = `
                <!DOCTYPE html>
                <html dir="ltr">
                <head>
                  <meta charset="utf-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <base href="${origin}/" />
                  <title>طباعة العقد الكامل</title>
                  ${stylesHtml}
                  <style>
                    @page { size: A4; margin: 0; }
                    html, body { width: 210mm; margin: 0; padding: 0; background: white; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }

                    @font-face {
                      font-family: 'Doran';
                      src: url('/Doran-Regular.otf') format('opentype');
                      font-weight: 400;
                      font-style: normal;
                      font-display: swap;
                    }
                    @font-face {
                      font-family: 'Doran';
                      src: url('/Doran-Bold.otf') format('opentype');
                      font-weight: 700;
                      font-style: normal;
                      font-display: swap;
                    }

                    body { font-family: 'Doran', 'Tajawal', sans-serif; direction: ltr; }

                    .print-page {
                      width: 210mm;
                      height: 297mm;
                      position: relative;
                      overflow: hidden;
                      direction: ltr;
                      page-break-after: always;
                    }

                    .print-page:last-child {
                      page-break-after: avoid;
                    }

                    .print-page .contract-preview-container {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      right: auto !important;
                      width: ${DESIGN_W}px !important;
                      height: ${DESIGN_H}px !important;
                      transform: scale(${printScale}) !important;
                      transform-origin: top left !important;
                      margin: 0 !important;
                      border-radius: 0 !important;
                      box-shadow: none !important;
                      direction: ltr;
                    }

                    .contract-preview-container img { max-width: none !important; }

                    .contract-preview-container,
                    .contract-preview-container * {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      color-adjust: exact !important;
                    }

                    table, thead, tbody, tr, th, td {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      color-adjust: exact !important;
                    }

                    th, td {
                      background-color: inherit !important;
                    }

                    @media print {
                      .print-page {
                        page-break-inside: avoid;
                      }
                    }

                  </style>
                  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
                </head>
                <body>
                  <!-- الصفحة الأولى: البنود -->
                  <div class="print-page">
                    ${clonedPage1.outerHTML}
                  </div>
                  
                  <!-- صفحات الجداول -->
                  ${billboardPages.map((pageBillboards, pageIdx) => generateTablePageHtml(pageBillboards, pageIdx)).join('')}
                  
                  <script>
                    window.addEventListener('load', function () {
                      function waitForCss() {
                        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
                        return Promise.all(links.map((l) => new Promise((res) => {
                          try {
                            if (l.sheet) return res();
                            l.addEventListener('load', () => res(), { once: true });
                            l.addEventListener('error', () => res(), { once: true });
                            setTimeout(() => res(), 1200);
                          } catch (e) {
                            res();
                          }
                        })));
                      }

                      const imgs = Array.from(document.images || []);
                      const waitImgs = Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((res) => {
                        img.onload = () => res();
                        img.onerror = () => res();
                      })));

                      const waitFonts = (document.fonts && document.fonts.ready)
                        ? document.fonts.ready.catch(function () { return; })
                        : Promise.resolve();

                      Promise.all([waitForCss(), waitImgs, waitFonts]).then(function () {
                        setTimeout(function () { window.print(); }, 300);
                      });
                    });
                  </script>
                </body>
                </html>
              `;

              import('@/components/print/PrintPreviewDialog').then(m => m.showPrintPreview(html, 'معاينة بنود العقد'));
            }}
            variant="outline"
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            طباعة العقد كاملاً
          </Button>
          <Button 
            onClick={() => saveSettingsMutation.mutate()} 
            disabled={saveSettingsMutation.isPending}
            variant="default"
            className="gap-2"
          >
            {saveSettingsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ الإعدادات
          </Button>
          {activePage === 'page1' && (
            <Button onClick={() => setIsAddDialogOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              إضافة بند
            </Button>
          )}
        </div>
      </div>

      {/* Main Layout: Side by Side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Left Side: Preview - Sticky */}
        <Card className="order-2 xl:order-1 xl:sticky xl:top-4 xl:self-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Maximize2 className="h-4 w-4" />
              {activePage === 'page1' ? 'معاينة الصفحة الأولى (البنود)' : 'معاينة جدول اللوحات'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="bg-muted/30 rounded-lg p-2">
                {activePage === 'page1' ? (
                  /* Page 1: Contract Terms Preview - نستخدم wrapper مع transform لتصغير المعاينة */
                  <div className="w-full overflow-x-auto pb-2">
                    <div 
                      className="flex justify-center min-w-max"
                      style={{
                        paddingLeft: '20px',
                        paddingRight: '20px',
                      }}
                    >
                      <div 
                        style={{
                          width: `${2480 * previewScale}px`,
                          height: `${3508 * previewScale}px`,
                          overflow: 'hidden',
                        }}
                      >
                    <div 
                      className="relative bg-white shadow-xl rounded overflow-hidden contract-preview-container"
                      style={{
                        width: '2480px',
                        height: '3508px',
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                    {/* Background Template */}
                    <img 
                      src={backgroundUrl} 
                      alt="قالب العقد"
                      className="absolute inset-0 w-full h-full object-cover z-0"
                    />
                    
                    {/* SVG Overlay */}
                    <svg 
                      ref={svgRef}
                      className="absolute inset-0 w-full h-full z-10"
                      viewBox="0 0 2480 3508"
                      preserveAspectRatio="xMidYMid slice"
                      onMouseMove={handleSvgMouseMove}
                      onMouseUp={handleSvgMouseUp}
                      onMouseLeave={handleSvgMouseUp}
                      style={{ cursor: dragState ? 'grabbing' : 'default' }}
                    >
                      {/* Contract Header Title */}
                      {sectionSettings.header.visible && (
                        <text 
                          x={sectionSettings.header.x} 
                          y={sectionSettings.header.y} 
                          fontFamily="Doran, sans-serif" 
                          fontWeight="bold" 
                          fontSize={sectionSettings.header.fontSize} 
                          fill="#000" 
                          textAnchor={sectionSettings.header.textAlign || 'middle'}
                          dominantBaseline="middle"
                          style={{ cursor: dragState ? 'grabbing' : 'grab' }}
                          onMouseDown={(e) => handleSvgMouseDown('header', e)}
                        >
                          عقد إيجار مواقع إعلانية رقم: {previewContractData.contractNumber} سنة {previewContractData.year}
                        </text>
                      )}
                      
                      {/* Date */}
                      {sectionSettings.date.visible && (
                        <g
                          style={{ cursor: dragState ? 'grabbing' : 'grab' }}
                          onMouseDown={(e) => handleSvgMouseDown('date', e)}
                        >
                          <text 
                            x={sectionSettings.date.x} 
                            y={sectionSettings.date.y} 
                            fontFamily="Doran, sans-serif" 
                            fontWeight="bold" 
                            fontSize={sectionSettings.date.fontSize} 
                            fill="#000" 
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            التاريخ: {new Date().toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </text>
                          <text 
                            x={sectionSettings.date.x} 
                            y={sectionSettings.date.y + (sectionSettings.date.fontSize || 42) * 1.3} 
                            fontFamily="Doran, sans-serif" 
                            fontWeight="bold" 
                            fontSize={sectionSettings.date.fontSize} 
                            fill="#000" 
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            الموافق: {formatHijriDate()}
                          </text>
                        </g>
                      )}

                      {/* Ad Type - نوع الإعلان */}
                      {sectionSettings.adType?.visible && (
                        <text 
                          x={sectionSettings.adType.x} 
                          y={sectionSettings.adType.y} 
                          fontFamily="Doran, sans-serif" 
                          fontWeight="bold" 
                          fontSize={sectionSettings.adType.fontSize} 
                          fill="#1a1a2e" 
                          textAnchor="start"
                          dominantBaseline="middle"
                          style={{ cursor: dragState ? 'grabbing' : 'grab', unicodeBidi: 'plaintext' }}
                          onMouseDown={(e) => handleSvgMouseDown('adType', e)}
                          direction="rtl"
                        >
                          نوع الإعلان: {previewContractData.adType}
                        </text>
                      )}

                      {/* First Party */}
                      {sectionSettings.firstParty.visible && (
                        <g onMouseDown={(e) => handleSvgMouseDown('firstParty', e)} style={{ cursor: dragState ? 'grabbing' : 'grab' }}>
                          <text 
                            x={sectionSettings.firstParty.x} 
                            y={sectionSettings.firstParty.y} 
                            fontFamily="Doran, sans-serif" 
                            fontWeight="bold" 
                            fontSize={sectionSettings.firstParty.fontSize + 4} 
                            fill="#000" 
                            textAnchor={sectionSettings.firstParty.textAlign || 'end'}
                            dominantBaseline="middle"
                          >
                            الطرف الأول: {sectionSettings.firstPartyData.companyName}، {sectionSettings.firstPartyData.address}
                          </text>
                          <text 
                            x={sectionSettings.firstParty.x} 
                            y={sectionSettings.firstParty.y + (sectionSettings.firstParty.lineSpacing || 50)} 
                            fontFamily="Doran, sans-serif" 
                            fontSize={sectionSettings.firstParty.fontSize} 
                            fill="#000" 
                            textAnchor={sectionSettings.firstParty.textAlign || 'end'}
                            dominantBaseline="middle"
                          >
                            {sectionSettings.firstPartyData.representative}
                          </text>
                        </g>
                      )}

                      {/* Second Party - Company Name */}
                      {sectionSettings.secondParty.visible && (
                        <g onMouseDown={(e) => handleSvgMouseDown('secondParty', e)} style={{ cursor: dragState ? 'grabbing' : 'grab' }}>
                          <text 
                            x={sectionSettings.secondParty.x} 
                            y={sectionSettings.secondParty.y} 
                            fontFamily="Doran, sans-serif" 
                            fontWeight="bold" 
                            fontSize={sectionSettings.secondParty.fontSize} 
                            fill="#000" 
                            textAnchor="start"
                            dominantBaseline="middle"
                            direction="rtl"
                            style={{ unicodeBidi: 'plaintext' }}
                          >
                            <tspan>{'الطرف الثاني، '}</tspan>
                            {renderMixedDirectionTspans(
                              rtlSafe(previewContractData.company || previewContractData.customerName)
                            )}
                          </text>
                        </g>
                      )}

                      {/* Second Party Customer - Name & Phone */}
                      {sectionSettings.secondPartyCustomer?.visible && (
                        <g onMouseDown={(e) => handleSvgMouseDown('secondPartyCustomer', e)} style={{ cursor: dragState ? 'grabbing' : 'grab' }}>
                          <text 
                            x={sectionSettings.secondPartyCustomer.x} 
                            y={sectionSettings.secondPartyCustomer.y} 
                            fontFamily="Doran, sans-serif" 
                            fontSize={sectionSettings.secondPartyCustomer.fontSize} 
                            fill="#000" 
                            textAnchor="start"
                            dominantBaseline="middle"
                            direction="rtl"
                            style={{ unicodeBidi: 'plaintext' }}
                          >
                            <tspan>{'يمثلها السيد '}</tspan>
                            {renderMixedDirectionTspans(rtlSafe(previewContractData.customerName))}
                            <tspan>{' - هاتف: '}</tspan>
                            {renderMixedDirectionTspans(rtlSafe(previewContractData.customerPhone || 'غير محدد'))}
                            {sectionSettings.secondPartyCustomer?.suffixText && (
                              <tspan>{` ${sectionSettings.secondPartyCustomer.suffixText}`}</tspan>
                            )}
                          </text>
                        </g>
                      )}

                      {/* Dynamic Terms - Matching Original PDF Layout */}
                      {(() => {
                        let currentY = sectionSettings.termsStartY;
                        const activeTerms = terms.filter(t => t.is_active);
                        const charsPerLine = Math.floor(sectionSettings.termsWidth / 28);
                        const lineHeight = sectionSettings.termsLineHeight || 65;
                        const termsX = sectionSettings.termsStartX;
                        
                        return activeTerms.map((term, termIndex) => {
                          const termY = currentY;
                          const titleText = `${term.term_title}:`;
                          const contentText = replaceVariables(term.term_content);
                          const fullText = `${titleText} ${contentText}`;
                          const contentLines = wrapText(fullText, charsPerLine, term.font_size || 42);
                          const isSelected = selectedTerm?.id === term.id;
                          const termHeight = contentLines.length * lineHeight;
                          
                          // Calculate next Y position AFTER this term with spacing
                          currentY = termY + termHeight + (sectionSettings.termsSpacing || 40);
                          
                          // Find where title ends in the first line
                          const titleLength = titleText.length;
                          
                          const foX = termsX - sectionSettings.termsWidth;
                          const goldColor = sectionSettings.termsGoldLine?.color || '#D4AF37';
                          const titleWeight = sectionSettings.termsTitleWeight || 'bold';
                          const contentWeight = sectionSettings.termsContentWeight || 'normal';
                          
                          const heightPercent = sectionSettings.termsGoldLine?.heightPercent || 30;
                          const insetPercent = (100 - heightPercent) / 2;
                          
                          return (
                            <g key={term.id} onClick={() => handleSelectTerm(term)} style={{ cursor: 'pointer' }}>
                              {isSelected && (
                                <rect 
                                  x={termsX - sectionSettings.termsWidth - 20} 
                                  y={termY - 15} 
                                  width={sectionSettings.termsWidth + 40} 
                                  height={termHeight + 20} 
                                  fill="rgba(201, 162, 39, 0.1)"
                                  stroke="#c9a227"
                                  strokeWidth="3"
                                  strokeDasharray="10,5"
                                  rx="6"
                                />
                              )}
                              
                              <foreignObject x={foX} y={termY} width={sectionSettings.termsWidth} height={termHeight + 10}>
                                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                                  direction: 'rtl',
                                  textAlign: 'justify',
                                  textJustify: 'inter-word',
                                  fontFamily: "Doran, 'Noto Sans Arabic', sans-serif",
                                  fontSize: `${term.font_size || 42}px`,
                                  lineHeight: `${lineHeight}px`,
                                  color: '#000',
                                  fontWeight: contentWeight === 'bold' ? 'bold' : 'normal'
                                }}>
                                  <span style={{ position: 'relative', display: 'inline-block', zIndex: 1, marginLeft: '6px' }}>
                                    {sectionSettings.termsGoldLine?.visible !== false && (
                                      <span style={{ position: 'absolute', inset: `${insetPercent}% 0 ${insetPercent}% 0`, backgroundColor: goldColor, zIndex: -1, borderRadius: '2px', width: '100%' }}></span>
                                    )}
                                    <span style={{ position: 'relative', zIndex: 2, fontWeight: titleWeight === 'bold' || titleWeight === '800' ? 800 : 700, padding: '0 4px' }}>
                                      {titleText}
                                    </span>
                                  </span>
                                  {contentText}
                                </div>
                              </foreignObject>
                            </g>
                          );
                        });
                      })()}
                    </svg>
                    </div>
                  </div>
                    </div>
                  </div>
                ) : (
                  /* Page 2: Billboards Table Preview - نستخدم wrapper مع transform لتصغير المعاينة */
                  <div 
                    style={{
                      width: `${2480 * previewScale}px`,
                      height: `${3508 * previewScale}px`,
                      overflow: 'hidden',
                    }}
                  >
                    <div 
                      className="relative bg-white shadow-xl rounded overflow-hidden contract-preview-container"
                      style={{
                        width: '2480px',
                        height: '3508px',
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      {/* Background Template */}
                      <img 
                        src={tableBackgroundUrl} 
                        alt="قالب جدول اللوحات"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      
                      {/* Table Preview with Title */}
                      <div 
                        className="absolute overflow-hidden"
                        style={{
                          top: `${sectionSettings.tableSettings.topPosition * 3.779}px`,
                          left: `${(100 - (sectionSettings.tableSettings.tableWidth || 90)) / 2}%`,
                          width: `${sectionSettings.tableSettings.tableWidth || 90}%`,
                          zIndex: 20,
                        }}
                      >
                        {/* عنوان البند فوق الجدول */}
                        {(sectionSettings.tableTerm?.visible !== false) && (
                          <div 
                            style={{
                              textAlign: 'center',
                              marginBottom: `${(sectionSettings.tableTerm?.marginBottom || 8)}px`,
                              fontFamily: 'Doran, sans-serif',
                              direction: 'rtl',
                              position: 'relative',
                              left: `${(sectionSettings.tableTerm?.positionX ?? 0)}px`,
                              top: `${(sectionSettings.tableTerm?.positionY ?? 0)}px`,
                            }}
                          >
                            <h2 style={{
                              fontSize: `${(sectionSettings.tableTerm?.fontSize || 14)}px`,
                              color: sectionSettings.tableTerm?.color || '#1a1a2e',
                              margin: 0,
                              display: 'inline-block',
                            }}>
                              <span style={{ 
                                fontWeight: sectionSettings.tableTerm?.titleFontWeight || 'bold', 
                                position: 'relative',
                                display: 'inline-block',
                              }}>
                                {/* Gold Line behind title only */}
                                {sectionSettings.tableTerm?.goldLine?.visible !== false && (
                                  <span
                                    style={{
                                      position: 'absolute',
                                      left: '0px',
                                      right: '0px',
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      height: `${sectionSettings.tableTerm?.goldLine?.heightPercent || 30}%`,
                                      backgroundColor: sectionSettings.tableTerm?.goldLine?.color || '#D4AF37',
                                      borderRadius: '2px',
                                      zIndex: 0,
                                    }}
                                  />
                                )}
                                <span style={{ position: 'relative', zIndex: 1 }}>
                                  {sectionSettings.tableTerm?.termTitle || 'البند الثامن:'}
                                </span>
                              </span>
                              {' '}
                              <span style={{ fontWeight: sectionSettings.tableTerm?.contentFontWeight || 'normal' }}>
                                {sectionSettings.tableTerm?.termContent || 'المواقع المتفق عليها بين الطرفين'}
                              </span>
                            </h2>
                          </div>
                        )}
                        <table
                          className="border-collapse w-full"
                          dir="rtl"
                          style={{
                            fontSize: `${(sectionSettings.tableSettings.fontSize || 8)}px`,
                            fontFamily: 'Doran, sans-serif',
                            direction: 'rtl',
                            tableLayout: 'fixed',
                          }}
                        >
                          <thead>
                            <tr style={{ 
                              height: `${(sectionSettings.tableSettings.headerRowHeight || 14) * 3.779}px`,
                            }}>
                              {sectionSettings.tableSettings.columns
                                .filter(col => col.visible)
                                .map((col) => {
                                  const isHighlighted = (sectionSettings.tableSettings.highlightedColumns || ['index']).includes(col.key);
                                  const headerBg = isHighlighted 
                                    ? (sectionSettings.tableSettings.highlightedColumnBgColor || '#1a1a2e')
                                    : sectionSettings.tableSettings.headerBgColor;
                                  const headerFg = isHighlighted 
                                    ? (sectionSettings.tableSettings.highlightedColumnTextColor || '#ffffff')
                                    : sectionSettings.tableSettings.headerTextColor;

                                  return (
                                    <th
                                      key={col.key}
                                      style={{
                                        width: `${col.width}%`,
                                        backgroundColor: headerBg,
                                        color: headerFg,
                                        padding: `${(col.padding ?? sectionSettings.tableSettings.cellPadding ?? 2)}px`,
                                        border: `${sectionSettings.tableSettings.borderWidth ?? 1}px solid ${sectionSettings.tableSettings.borderColor}`,
                                        fontSize: `${(col.headerFontSize ?? sectionSettings.tableSettings.headerFontSize ?? 11)}px`,
                                        fontWeight: sectionSettings.tableSettings.headerFontWeight || 'bold',
                                        textAlign: sectionSettings.tableSettings.headerTextAlign || 'center',
                                        verticalAlign: 'middle',
                                        lineHeight: col.lineHeight ?? 1.3,
                                        overflow: 'hidden',
                                        position: 'relative',
                                      }}
                                    >
                                      {/* طبقة صورة لضمان طباعة اللون الداكن كما هو */}
                                      <img
                                        src={solidFillDataUri(headerBg)}
                                        alt=""
                                        aria-hidden="true"
                                        style={{
                                          position: 'absolute',
                                          inset: 0,
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover',
                                          zIndex: 0,
                                          pointerEvents: 'none',
                                        }}
                                      />
                                      <span style={{ position: 'relative', zIndex: 1 }}>
                                        {col.label}
                                      </span>
                                    </th>
                                  );
                                })}
                            </tr>
                          </thead>
                          <tbody>
                            {(previewBillboards.length > 0 ? previewBillboards : sampleBillboards).slice(0, sectionSettings.tableSettings.maxRows || 8).map((billboard, idx) => (
                              <tr 
                                key={billboard.id}
                                style={{
                                  height: `${(sectionSettings.tableSettings.rowHeight || 12) * 3.779}px`,
                                  backgroundColor: idx % 2 === 1 ? sectionSettings.tableSettings.alternateRowColor : 'white',
                                }}
                              >
                                {sectionSettings.tableSettings.columns
                                  .filter(col => col.visible)
                                  .map((col) => {
                                    const isHighlighted = (sectionSettings.tableSettings.highlightedColumns || ['index']).includes(col.key);
                                    const cellBg = isHighlighted
                                      ? (sectionSettings.tableSettings.highlightedColumnBgColor || '#1a1a2e')
                                      : undefined;

                                    return (
                                      <td
                                        key={col.key}
                                        style={{
                                          border: `${sectionSettings.tableSettings.borderWidth ?? 1}px solid ${sectionSettings.tableSettings.borderColor}`,
                                          padding:
                                            col.key === 'image' || col.key === 'location'
                                              ? 0
                                              : `${(col.padding ?? sectionSettings.tableSettings.cellPadding ?? 2)}px`,
                                          textAlign: col.textAlign ?? (sectionSettings.tableSettings.cellTextAlign || 'center'),
                                          fontSize: `${(col.fontSize ?? sectionSettings.tableSettings.fontSize ?? 10)}px`,
                                          fontWeight: sectionSettings.tableSettings.fontWeight || 'normal',
                                          backgroundColor: cellBg,
                                          color: isHighlighted
                                            ? (sectionSettings.tableSettings.highlightedColumnTextColor || '#ffffff')
                                            : (sectionSettings.tableSettings.cellTextColor || '#000000'),
                                          verticalAlign: 'middle',
                                          lineHeight: col.lineHeight ?? 1.3,
                                          whiteSpace: 'normal',
                                          wordBreak: 'break-word',
                                          overflow: 'hidden',
                                          position: cellBg ? 'relative' : undefined,
                                        }}
                                      >
                                        {cellBg && (
                                          <img
                                            src={solidFillDataUri(cellBg)}
                                            alt=""
                                            aria-hidden="true"
                                            style={{
                                              position: 'absolute',
                                              inset: 0,
                                              width: '100%',
                                              height: '100%',
                                              objectFit: 'cover',
                                              zIndex: 0,
                                              pointerEvents: 'none',
                                            }}
                                          />
                                        )}
                                        <div style={{ position: 'relative', zIndex: 1, lineHeight: col.lineHeight ?? 1.3, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                          {col.key === 'index' && idx + 1}
                                          {col.key === 'image' && (() => {
                                            const imgSrc = billboard.image || (sectionSettings.fallbackSettings?.useDefaultImage ? sectionSettings.fallbackSettings?.defaultImageUrl || '/logofaresgold.svg' : null);
                                            return imgSrc ? (
                                              <img 
                                                src={imgSrc} 
                                                alt={billboard.name}
                                                style={{ 
                                                  height: `${((sectionSettings.tableSettings.rowHeight || 12) * 3.779) - 6}px`,
                                                  maxHeight: `${((sectionSettings.tableSettings.rowHeight || 12) * 3.779) - 6}px`,
                                                  width: 'auto',
                                                  objectFit: 'contain',
                                                  display: 'block',
                                                  margin: '0 auto',
                                                }}
                                              />
                                            ) : null;
                                          })()}
                                          {col.key === 'code' && billboard.code}
                                          {col.key === 'billboardName' && billboard.billboardName}
                                          {col.key === 'name' && billboard.name}
                                          {col.key === 'size' && billboard.size}
                                          {col.key === 'faces' && getFacesText(billboard.faces)}
                                          {col.key === 'municipality' && billboard.municipality}
                                          {col.key === 'district' && billboard.district}
                                          {col.key === 'price' && (
                                            billboard.hasDiscount && billboard.originalPrice && sectionSettings.discountDisplay?.enabled && sectionSettings.discountDisplay?.showOriginalPrice ? (
                                              <div
                                                style={{
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  alignItems:
                                                    (col.textAlign ?? (sectionSettings.tableSettings.cellTextAlign as any) ?? 'center') === 'left'
                                                      ? 'flex-start'
                                                      : (col.textAlign ?? (sectionSettings.tableSettings.cellTextAlign as any) ?? 'center') === 'right'
                                                        ? 'flex-end'
                                                        : 'center',
                                                  justifyContent: 'center',
                                                  lineHeight: col.lineHeight ?? 1.3,
                                                  textAlign: col.textAlign ?? (sectionSettings.tableSettings.cellTextAlign || 'center'),
                                                }}
                                              >
                                                <span style={{
                                                  fontSize: `${sectionSettings.discountDisplay?.originalPriceFontSize || 18}px`,
                                                  color: sectionSettings.discountDisplay?.originalPriceColor || '#888888',
                                                  textDecoration: 'line-through',
                                                  textDecorationColor: sectionSettings.discountDisplay?.strikethroughColor || '#cc0000',
                                                  textDecorationThickness: `${sectionSettings.discountDisplay?.strikethroughWidth || 2}px`,
                                                }}>
                                                  {billboard.originalPrice.toLocaleString()} د.ل
                                                </span>
                                                <span style={{
                                                  fontSize: `${sectionSettings.discountDisplay?.discountedPriceFontSize || 24}px`,
                                                  color: sectionSettings.discountDisplay?.discountedPriceColor || '#000000',
                                                  fontWeight: 'bold',
                                                }}>
                                                  {billboard.price ? `${billboard.price.toLocaleString()} د.ل` : '-'}
                                                </span>
                                              </div>
                                            ) : (
                                              billboard.price ? `${billboard.price.toLocaleString()} د.ل` : '-'
                                            )
                                          )}
                                          {col.key === 'endDate' && (billboard.endDate || previewContractData.endDate || '-')}
                                          {col.key === 'durationDays' && (billboard.durationDays || previewContractData.duration || '-')}
                                          {col.key === 'location' && (() => {
                                            const gpsUrl = billboard.gps || (sectionSettings.fallbackSettings?.useDefaultQR ? sectionSettings.fallbackSettings?.defaultGoogleMapsUrl || 'https://www.google.com/maps?q=32.8872,13.1913' : null);
                                            return gpsUrl ? (
                                              <QRCodeCell 
                                                gpsUrl={gpsUrl}
                                                size={((sectionSettings.tableSettings.rowHeight || 12) * 3.779) - 8}
                                                foregroundColor={sectionSettings.tableSettings.qrForegroundColor || '#000000'}
                                                backgroundColor={sectionSettings.tableSettings.qrBackgroundColor || '#ffffff'}
                                              />
                                            ) : null;
                                          })()}
                                        </div>
                                      </td>
                                    );
                                  })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Side: Settings Management */}
        <div className="order-1 xl:order-2 space-y-4">
          {activePage === 'page1' ? (
            <>
              {/* Page 1: Terms Settings */}
              {/* Page Sections Control */}
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Move className="h-4 w-4" />
                    التحكم في أجزاء الصفحة
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-4">
              {/* Visibility toggles and edit buttons */}
              <div className="grid grid-cols-2 gap-2">
                <div 
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    selectedSection === 'header' ? 'bg-primary/20 ring-1 ring-primary' : 'bg-muted/50 hover:bg-muted'
                  }`}
                  onClick={() => setSelectedSection(selectedSection === 'header' ? null : 'header')}
                >
                  <Label className="text-xs cursor-pointer">العنوان</Label>
                  <Switch
                    checked={sectionSettings.header.visible}
                    onCheckedChange={(v) => setSectionSettings(s => ({ 
                      ...s, 
                      header: { ...s.header, visible: v } 
                    }))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div 
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    selectedSection === 'date' ? 'bg-primary/20 ring-1 ring-primary' : 'bg-muted/50 hover:bg-muted'
                  }`}
                  onClick={() => setSelectedSection(selectedSection === 'date' ? null : 'date')}
                >
                  <Label className="text-xs cursor-pointer">التاريخ</Label>
                  <Switch
                    checked={sectionSettings.date.visible}
                    onCheckedChange={(v) => setSectionSettings(s => ({ 
                      ...s, 
                      date: { ...s.date, visible: v } 
                    }))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {/* نوع الإعلان */}
                <div 
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    selectedSection === 'adType' ? 'bg-primary/20 ring-1 ring-primary' : 'bg-muted/50 hover:bg-muted'
                  }`}
                  onClick={() => setSelectedSection(selectedSection === 'adType' ? null : 'adType')}
                >
                  <Label className="text-xs cursor-pointer">نوع الإعلان</Label>
                  <Switch
                    checked={sectionSettings.adType?.visible ?? true}
                    onCheckedChange={(v) => setSectionSettings(s => ({ 
                      ...s, 
                      adType: { ...(s.adType || DEFAULT_SECTION_SETTINGS.adType), visible: v } 
                    }))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div 
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    selectedSection === 'firstParty' ? 'bg-primary/20 ring-1 ring-primary' : 'bg-muted/50 hover:bg-muted'
                  }`}
                  onClick={() => setSelectedSection(selectedSection === 'firstParty' ? null : 'firstParty')}
                >
                  <Label className="text-xs cursor-pointer">الطرف الأول</Label>
                  <Switch
                    checked={sectionSettings.firstParty.visible}
                    onCheckedChange={(v) => setSectionSettings(s => ({ 
                      ...s, 
                      firstParty: { ...s.firstParty, visible: v } 
                    }))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div 
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    selectedSection === 'secondParty' ? 'bg-primary/20 ring-1 ring-primary' : 'bg-muted/50 hover:bg-muted'
                  }`}
                  onClick={() => setSelectedSection(selectedSection === 'secondParty' ? null : 'secondParty')}
                >
                  <Label className="text-xs cursor-pointer">الطرف الثاني (الشركة)</Label>
                  <Switch
                    checked={sectionSettings.secondParty.visible}
                    onCheckedChange={(v) => setSectionSettings(s => ({ 
                      ...s, 
                      secondParty: { ...s.secondParty, visible: v } 
                    }))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div 
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    selectedSection === 'secondPartyCustomer' ? 'bg-primary/20 ring-1 ring-primary' : 'bg-muted/50 hover:bg-muted'
                  }`}
                  onClick={() => setSelectedSection(selectedSection === 'secondPartyCustomer' ? null : 'secondPartyCustomer')}
                >
                  <Label className="text-xs cursor-pointer">الطرف الثاني (الزبون)</Label>
                  <Switch
                    checked={sectionSettings.secondPartyCustomer?.visible ?? true}
                    onCheckedChange={(v) => setSectionSettings(s => ({ 
                      ...s, 
                      secondPartyCustomer: { ...(s.secondPartyCustomer || DEFAULT_SECTION_SETTINGS.secondPartyCustomer), visible: v } 
                    }))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">اضغط على أي جزء لتحرير موقعه وإعداداته</p>

              {/* Selected section position controls */}
              {selectedSection && ['header', 'date', 'adType', 'firstParty', 'secondParty', 'secondPartyCustomer'].includes(selectedSection) && (
                <div className="border rounded-lg p-3 space-y-3 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      تحرير: {selectedSection === 'header' ? 'العنوان' : 
                              selectedSection === 'date' ? 'التاريخ' :
                              selectedSection === 'adType' ? 'نوع الإعلان' :
                              selectedSection === 'firstParty' ? 'الطرف الأول' : 
                              selectedSection === 'secondParty' ? 'الطرف الثاني (الشركة)' : 'الطرف الثاني (الزبون)'}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedSection(null)}>
                      إغلاق
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">X (أفقي)</Label>
                      <Input
                        type="number"
                        value={(sectionSettings[selectedSection as keyof PageSectionSettings] as SectionPosition)?.x || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const key = selectedSection as 'header' | 'date' | 'adType' | 'firstParty' | 'secondParty' | 'secondPartyCustomer';
                          setSectionSettings(s => ({
                            ...s,
                            [key]: { ...s[key], x: val }
                          }));
                        }}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Y (رأسي)</Label>
                      <Input
                        type="number"
                        value={(sectionSettings[selectedSection as keyof PageSectionSettings] as SectionPosition)?.y || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const key = selectedSection as 'header' | 'date' | 'adType' | 'firstParty' | 'secondParty' | 'secondPartyCustomer';
                          setSectionSettings(s => ({
                            ...s,
                            [key]: { ...s[key], y: val }
                          }));
                        }}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">حجم الخط</Label>
                      <Input
                        type="number"
                        value={(sectionSettings[selectedSection as keyof PageSectionSettings] as SectionPosition)?.fontSize || 38}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const key = selectedSection as 'header' | 'date' | 'adType' | 'firstParty' | 'secondParty' | 'secondPartyCustomer';
                          setSectionSettings(s => ({
                            ...s,
                            [key]: { ...s[key], fontSize: val }
                          }));
                        }}
                        className="h-8"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs">المحاذاة</Label>
                    <Select
                      value={(sectionSettings[selectedSection as keyof PageSectionSettings] as SectionPosition)?.textAlign || 'end'}
                      onValueChange={(v: 'start' | 'middle' | 'end') => {
                        const key = selectedSection as 'header' | 'date' | 'adType' | 'firstParty' | 'secondParty' | 'secondPartyCustomer';
                        setSectionSettings(s => ({
                          ...s,
                          [key]: { ...(s[key] as SectionPosition || {}), textAlign: v }
                        }));
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="end">يمين</SelectItem>
                        <SelectItem value="middle">وسط</SelectItem>
                        <SelectItem value="start">يسار</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* First Party Data Editor */}
                  {selectedSection === 'firstParty' && (
                    <div className="border-t pt-2 mt-2 space-y-2">
                      <Label className="text-xs font-medium">بيانات الطرف الأول</Label>
                      <div>
                        <Label className="text-[10px]">اسم الشركة</Label>
                        <Input
                          value={sectionSettings.firstPartyData.companyName}
                          onChange={(e) => setSectionSettings(s => ({
                            ...s,
                            firstPartyData: { ...s.firstPartyData, companyName: e.target.value }
                          }))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">العنوان</Label>
                        <Input
                          value={sectionSettings.firstPartyData.address}
                          onChange={(e) => setSectionSettings(s => ({
                            ...s,
                            firstPartyData: { ...s.firstPartyData, address: e.target.value }
                          }))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">الممثل</Label>
                        <Input
                          value={sectionSettings.firstPartyData.representative}
                          onChange={(e) => setSectionSettings(s => ({
                            ...s,
                            firstPartyData: { ...s.firstPartyData, representative: e.target.value }
                          }))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">التباعد بين السطرين</Label>
                        <Input
                          type="number"
                          value={sectionSettings.firstParty.lineSpacing || 50}
                          onChange={(e) => setSectionSettings(s => ({
                            ...s,
                            firstParty: { ...s.firstParty, lineSpacing: Number(e.target.value) }
                          }))}
                          className="h-7 text-xs"
                          min={20}
                          max={150}
                        />
                      </div>
                    </div>
                  )}

                  {/* Second Party Customer Settings */}
                  {selectedSection === 'secondPartyCustomer' && (
                    <div className="border-t pt-2 mt-2 space-y-2">
                      <Label className="text-xs font-medium">إعدادات الطرف الثاني (الزبون)</Label>
                      <p className="text-[10px] text-muted-foreground">يتم التحكم في اسم الزبون ورقم الهاتف بشكل منفصل</p>
                      <div>
                        <Label className="text-[10px]">نص بعد رقم الهاتف</Label>
                        <Input
                          value={sectionSettings.secondPartyCustomer?.suffixText || ''}
                          onChange={(e) => setSectionSettings(s => ({
                            ...s,
                            secondPartyCustomer: { ...(s.secondPartyCustomer || DEFAULT_SECTION_SETTINGS.secondPartyCustomer!), suffixText: e.target.value }
                          }))}
                          placeholder="مثال: بموجب التفويض"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Terms Layout Settings */}
              <div className="border-t pt-3 space-y-2">
                <Label className="text-sm font-medium">إعدادات البنود</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">موقع X (أفقي)</Label>
                    <Input
                      type="number"
                      value={sectionSettings.termsStartX}
                      onChange={(e) => setSectionSettings(s => ({ ...s, termsStartX: Number(e.target.value) }))}
                      className="h-8"
                      min={200}
                      max={2480}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">موقع Y (رأسي)</Label>
                    <Input
                      type="number"
                      value={sectionSettings.termsStartY}
                      onChange={(e) => setSectionSettings(s => ({ ...s, termsStartY: Number(e.target.value) }))}
                      className="h-8"
                      min={0}
                      max={3508}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">عرض النص (px)</Label>
                    <Input
                      type="number"
                      value={sectionSettings.termsWidth}
                      onChange={(e) => setSectionSettings(s => ({ ...s, termsWidth: Number(e.target.value) }))}
                      className="h-8"
                      min={500}
                      max={2400}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">المحاذاة</Label>
                    <Select
                      value={sectionSettings.termsTextAlign || 'end'}
                      onValueChange={(v: 'start' | 'middle' | 'end') => setSectionSettings(s => ({ ...s, termsTextAlign: v }))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="end">يمين</SelectItem>
                        <SelectItem value="middle">وسط</SelectItem>
                        <SelectItem value="start">يسار</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">التباعد بين البنود (px)</Label>
                    <Input
                      type="number"
                      value={sectionSettings.termsSpacing}
                      onChange={(e) => setSectionSettings(s => ({ ...s, termsSpacing: Number(e.target.value) }))}
                      className="h-8"
                      min={0}
                      max={200}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">التباعد بين الأسطر (px)</Label>
                    <Input
                      type="number"
                      value={sectionSettings.termsLineHeight || 65}
                      onChange={(e) => setSectionSettings(s => ({ ...s, termsLineHeight: Number(e.target.value) }))}
                      className="h-8"
                      min={30}
                      max={120}
                    />
                  </div>
                </div>
                
                {/* Font Weight Controls */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div>
                    <Label className="text-xs">وزن عنوان البند</Label>
                    <Select
                      value={sectionSettings.termsTitleWeight || 'bold'}
                      onValueChange={(v) => setSectionSettings(s => ({ ...s, termsTitleWeight: v }))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">عادي</SelectItem>
                        <SelectItem value="500">متوسط</SelectItem>
                        <SelectItem value="600">نصف عريض</SelectItem>
                        <SelectItem value="bold">عريض</SelectItem>
                        <SelectItem value="800">ثقيل</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">وزن المحتوى</Label>
                    <Select
                      value={sectionSettings.termsContentWeight || 'normal'}
                      onValueChange={(v) => setSectionSettings(s => ({ ...s, termsContentWeight: v }))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">عادي</SelectItem>
                        <SelectItem value="500">متوسط</SelectItem>
                        <SelectItem value="600">نصف عريض</SelectItem>
                        <SelectItem value="bold">عريض</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Gold Line Controls for Page 1 Terms */}
                <div className="pt-2 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">الخط الذهبي خلف البنود</Label>
                    <Switch
                      checked={sectionSettings.termsGoldLine?.visible !== false}
                      onCheckedChange={(checked) => setSectionSettings(s => ({
                        ...s,
                        termsGoldLine: { ...(s.termsGoldLine || DEFAULT_GOLD_LINE), visible: checked }
                      }))}
                    />
                  </div>
                  {sectionSettings.termsGoldLine?.visible !== false && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">ارتفاع الخط (%)</Label>
                        <Input
                          type="number"
                          value={sectionSettings.termsGoldLine?.heightPercent || 30}
                          onChange={(e) => setSectionSettings(s => ({
                            ...s,
                            termsGoldLine: { ...(s.termsGoldLine || DEFAULT_GOLD_LINE), heightPercent: Number(e.target.value) }
                          }))}
                          className="h-8"
                          min={5}
                          max={100}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">لون الخط</Label>
                        <Input
                          type="color"
                          value={sectionSettings.termsGoldLine?.color || '#D4AF37'}
                          onChange={(e) => setSectionSettings(s => ({
                            ...s,
                            termsGoldLine: { ...(s.termsGoldLine || DEFAULT_GOLD_LINE), color: e.target.value }
                          }))}
                          className="h-8 w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Background Selection */}
                <div className="pt-2 border-t space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    خلفية القالب
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableBackgrounds.map((bg) => (
                      <div
                        key={bg.url}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          backgroundUrl === bg.url 
                            ? 'border-primary bg-primary/10 ring-2 ring-primary' 
                            : 'border-muted hover:border-primary/50'
                        }`}
                        onClick={() => setBackgroundUrl(bg.url)}
                      >
                        <img 
                          src={bg.url} 
                          alt={bg.name} 
                          className="w-full h-16 object-cover rounded mb-1"
                        />
                        <p className="text-xs text-center">{bg.name}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      placeholder="أو أدخل رابط صورة مخصصة..."
                      value={backgroundUrl.startsWith('/') ? '' : backgroundUrl}
                      onChange={(e) => setBackgroundUrl(e.target.value || '/bgc1.svg')}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">A4 = 2480px عرض × 3508px ارتفاع | التغييرات فورية</p>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-2">
              <TabsTrigger value="terms" className="gap-2 text-sm">
                <Settings className="h-4 w-4" />
                إدارة البنود
              </TabsTrigger>
              <TabsTrigger value="variables" className="gap-2 text-sm">
                <Code className="h-4 w-4" />
                المتغيرات
              </TabsTrigger>
            </TabsList>

            {/* Tab: Terms Management */}
            <TabsContent value="terms" className="space-y-3 mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Terms List */}
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      قائمة البنود ({terms.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[calc(100vh-320px)]">
                      <div className="space-y-1.5 pr-2">
                        {terms.map((term, index) => (
                          <div
                            key={term.id}
                            className={`p-2 rounded-lg border cursor-pointer transition-all ${
                              selectedTerm?.id === term.id
                                ? 'border-primary bg-primary/10 shadow-sm'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            } ${!term.is_active ? 'opacity-50' : ''}`}
                            onClick={() => handleSelectTerm(term)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                                  {index + 1}
                                </div>
                                <span className="font-medium text-xs">{term.term_title}</span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-5 w-5 ${term.is_active ? 'text-green-500' : 'text-muted-foreground'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateMutation.mutate({ id: term.id, is_active: !term.is_active });
                                  }}
                                  title={term.is_active ? 'إلغاء تفعيل البند' : 'تفعيل البند'}
                                >
                                  {term.is_active ? (
                                    <Eye className="h-3 w-3" />
                                  ) : (
                                    <EyeOff className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => { e.stopPropagation(); moveTermOrder(term.id, 'up'); }}
                                  disabled={index === 0}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => { e.stopPropagation(); moveTermOrder(term.id, 'down'); }}
                                  disabled={index === terms.length - 1}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                              {term.term_content.substring(0, 60)}...
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Term Editor */}
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm">
                      {selectedTerm ? `تعديل: ${selectedTerm.term_title}` : 'اختر بنداً'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    {editedTerm ? (
                      <ScrollArea className="h-[calc(100vh-320px)]">
                        <div className="space-y-3 pr-2">
                          <div>
                            <Label className="text-xs">عنوان البند</Label>
                            <Input
                              value={editedTerm.term_title || ''}
                              onChange={(e) => setEditedTerm({ ...editedTerm, term_title: e.target.value })}
                              placeholder="عنوان البند"
                              className="h-8 text-sm"
                            />
                          </div>

                          <div>
                            <Label className="text-xs">محتوى البند</Label>
                            <Textarea
                              value={editedTerm.term_content || ''}
                              onChange={(e) => setEditedTerm({ ...editedTerm, term_content: e.target.value })}
                              placeholder="محتوى البند"
                              rows={4}
                              className="resize-none text-xs"
                            />
                            <div className="flex flex-wrap gap-1 mt-1">
                              {AVAILABLE_VARIABLES.map(v => (
                                <Badge 
                                  key={v.key}
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-[9px] py-0"
                                  onClick={() => insertVariable(v.key)}
                                >
                                  {v.label}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded-lg">
                            <div>
                              <Label className="text-[10px]">حجم الخط</Label>
                              <div className="flex items-center gap-1">
                                <Slider
                                  value={[editedTerm.font_size || 42]}
                                  onValueChange={(v) => setEditedTerm({ ...editedTerm, font_size: v[0] })}
                                  min={24}
                                  max={72}
                                  step={2}
                                  className="flex-1"
                                />
                                <span className="text-[10px] w-6 font-mono">{editedTerm.font_size}</span>
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px]">وزن الخط</Label>
                              <Select
                                value={editedTerm.font_weight || 'normal'}
                                onValueChange={(v) => setEditedTerm({ ...editedTerm, font_weight: v })}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="normal">عادي</SelectItem>
                                  <SelectItem value="500">متوسط</SelectItem>
                                  <SelectItem value="600">نصف عريض</SelectItem>
                                  <SelectItem value="bold">عريض</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="p-2 bg-muted/50 rounded-lg">
                            <Label className="text-[10px]">الموقع الرأسي (Y) - 0 = تلقائي</Label>
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[editedTerm.position_y || 0]}
                                onValueChange={(v) => setEditedTerm({ ...editedTerm, position_y: v[0] })}
                                min={0}
                                max={3200}
                                step={10}
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                value={editedTerm.position_y || 0}
                                onChange={(e) => setEditedTerm({ ...editedTerm, position_y: Number(e.target.value) })}
                                className="w-16 h-7 text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <Label className="text-xs">تفعيل البند</Label>
                            <Switch
                              checked={editedTerm.is_active ?? true}
                              onCheckedChange={(v) => setEditedTerm({ ...editedTerm, is_active: v })}
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={handleSave}
                              disabled={updateMutation.isPending}
                              className="flex-1 h-8 text-sm"
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin ml-1" />
                              ) : (
                                <Save className="h-3 w-3 ml-1" />
                              )}
                              حفظ
                            </Button>
                            <Button variant="outline" onClick={handleReset} size="icon" className="h-8 w-8">
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={async () => {
                                if (await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا البند؟', variant: 'destructive', confirmText: 'حذف' })) {
                                  deleteMutation.mutate(editedTerm.id!);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                        اختر بنداً من القائمة للتعديل
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab: Variables Reference */}
            <TabsContent value="variables" className="mt-0">
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    المتغيرات المتاحة
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-3">
                    استخدم هذه المتغيرات في محتوى البنود وسيتم استبدالها ببيانات العقد الفعلية.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_VARIABLES.map(variable => (
                      <div key={variable.key} className="p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {variable.key}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => {
                              navigator.clipboard.writeText(variable.key);
                              toast.success('تم نسخ المتغير');
                            }}
                          >
                            <Code className="h-3 w-3" />
                          </Button>
                        </div>
                        <h4 className="font-medium text-xs">{variable.label}</h4>
                        <p className="text-[10px] text-muted-foreground">{variable.description}</p>
                        <div className="mt-1 text-[10px] font-mono text-primary">
                          مثال: {variable.example}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h4 className="font-medium text-amber-900 dark:text-amber-100 flex items-center gap-1 mb-1 text-xs">
                      <Info className="h-3 w-3" />
                      كيفية الاستخدام
                    </h4>
                    <code className="block p-1.5 bg-amber-100 dark:bg-amber-900 rounded text-[10px] font-mono text-amber-900 dark:text-amber-100">
                      مدة العقد {'{duration}'} يوم تبدأ من {'{startDate}'}
                    </code>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
            </>
          ) : (
            /* Page 2: Table Settings */
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  إعدادات جدول اللوحات
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-4">
                {/* Table Term Settings - عنوان البند فوق الجدول */}
                <div className="p-3 bg-muted/30 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      عنوان البند فوق الجدول
                    </Label>
                    <Switch
                      checked={sectionSettings.tableTerm?.visible !== false}
                      onCheckedChange={(checked) => setSectionSettings(s => ({
                        ...s,
                        tableTerm: { ...(s.tableTerm || DEFAULT_TABLE_TERM), visible: checked }
                      }))}
                    />
                  </div>
                  
                  {sectionSettings.tableTerm?.visible !== false && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">عنوان البند (مثل: البند الثامن:)</Label>
                          <Input
                            value={sectionSettings.tableTerm?.termTitle || 'البند الثامن:'}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              tableTerm: { ...(s.tableTerm || DEFAULT_TABLE_TERM), termTitle: e.target.value }
                            }))}
                            className="h-8 text-right"
                            dir="rtl"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">محتوى البند</Label>
                          <Input
                            value={sectionSettings.tableTerm?.termContent || 'المواقع المتفق عليها بين الطرفين'}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              tableTerm: { ...(s.tableTerm || DEFAULT_TABLE_TERM), termContent: e.target.value }
                            }))}
                            className="h-8 text-right"
                            dir="rtl"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">حجم الخط</Label>
                          <Input
                            type="number"
                            value={sectionSettings.tableTerm?.fontSize || 14}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              tableTerm: { ...(s.tableTerm || DEFAULT_TABLE_TERM), fontSize: Number(e.target.value) }
                            }))}
                            className="h-8"
                            min={8}
                            max={24}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">وزن خط العنوان</Label>
                          <select
                            value={sectionSettings.tableTerm?.titleFontWeight || 'bold'}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              tableTerm: { ...(s.tableTerm || DEFAULT_TABLE_TERM), titleFontWeight: e.target.value }
                            }))}
                            className="h-8 w-full rounded border bg-background px-2 text-xs"
                          >
                            <option value="normal">عادي</option>
                            <option value="bold">عريض</option>
                            <option value="600">شبه عريض</option>
                            <option value="800">عريض جداً</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">وزن خط المحتوى</Label>
                          <select
                            value={sectionSettings.tableTerm?.contentFontWeight || 'normal'}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              tableTerm: { ...(s.tableTerm || DEFAULT_TABLE_TERM), contentFontWeight: e.target.value }
                            }))}
                            className="h-8 w-full rounded border bg-background px-2 text-xs"
                          >
                            <option value="normal">عادي</option>
                            <option value="bold">عريض</option>
                            <option value="600">شبه عريض</option>
                            <option value="800">عريض جداً</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">المسافة للجدول (mm)</Label>
                          <Input
                            type="number"
                            value={sectionSettings.tableTerm?.marginBottom || 8}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              tableTerm: { ...(s.tableTerm || DEFAULT_TABLE_TERM), marginBottom: Number(e.target.value) }
                            }))}
                            className="h-8"
                            min={0}
                            max={30}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">لون النص</Label>
                          <Input
                            type="color"
                            value={sectionSettings.tableTerm?.color || '#1a1a2e'}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              tableTerm: { ...(s.tableTerm || DEFAULT_TABLE_TERM), color: e.target.value }
                            }))}
                            className="h-8 w-full"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">الإزاحة الأفقية X (px)</Label>
                          <Input
                            type="number"
                            value={sectionSettings.tableTerm?.positionX ?? 0}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              tableTerm: { ...(s.tableTerm || DEFAULT_TABLE_TERM), positionX: Number(e.target.value) }
                            }))}
                            className="h-8"
                            min={-500}
                            max={500}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">الإزاحة الرأسية Y (px)</Label>
                          <Input
                            type="number"
                            value={sectionSettings.tableTerm?.positionY ?? 0}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              tableTerm: { ...(s.tableTerm || DEFAULT_TABLE_TERM), positionY: Number(e.target.value) }
                            }))}
                            className="h-8"
                            min={-100}
                            max={100}
                          />
                        </div>
                      </div>
                      
                      {/* Gold Line Controls for Table Term */}
                      <div className="pt-2 border-t space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">الخط الذهبي خلف البند</Label>
                          <Switch
                            checked={sectionSettings.tableTerm?.goldLine?.visible !== false}
                            onCheckedChange={(checked) => setSectionSettings(s => ({
                              ...s,
                              tableTerm: { 
                                ...(s.tableTerm || DEFAULT_TABLE_TERM), 
                                goldLine: { ...(s.tableTerm?.goldLine || DEFAULT_GOLD_LINE), visible: checked }
                              }
                            }))}
                          />
                        </div>
                        {sectionSettings.tableTerm?.goldLine?.visible !== false && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">ارتفاع الخط (%)</Label>
                              <Input
                                type="number"
                                value={sectionSettings.tableTerm?.goldLine?.heightPercent || 30}
                                onChange={(e) => setSectionSettings(s => ({
                                  ...s,
                                  tableTerm: { 
                                    ...(s.tableTerm || DEFAULT_TABLE_TERM), 
                                    goldLine: { ...(s.tableTerm?.goldLine || DEFAULT_GOLD_LINE), heightPercent: Number(e.target.value) }
                                  }
                                }))}
                                className="h-8"
                                min={5}
                                max={100}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">لون الخط</Label>
                              <Input
                                type="color"
                                value={sectionSettings.tableTerm?.goldLine?.color || '#D4AF37'}
                                onChange={(e) => setSectionSettings(s => ({
                                  ...s,
                                  tableTerm: { 
                                    ...(s.tableTerm || DEFAULT_TABLE_TERM), 
                                    goldLine: { ...(s.tableTerm?.goldLine || DEFAULT_GOLD_LINE), color: e.target.value }
                                  }
                                }))}
                                className="h-8 w-full"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Table Position Settings */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">موقع الجدول من الأعلى (mm)</Label>
                    <Input
                      type="number"
                      value={sectionSettings.tableSettings.topPosition}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, topPosition: Number(e.target.value) }
                      }))}
                      className="h-8"
                      step={0.5}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">ارتفاع صف الرأس (mm)</Label>
                    <Input
                      type="number"
                      value={sectionSettings.tableSettings.headerRowHeight || 14}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, headerRowHeight: Number(e.target.value) }
                      }))}
                      className="h-8"
                      step={1}
                      min={5}
                      max={50}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ارتفاع الصف (mm)</Label>
                    <Input
                      type="number"
                      value={sectionSettings.tableSettings.rowHeight || 12}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, rowHeight: Number(e.target.value) }
                      }))}
                      className="h-8"
                      step={1}
                      min={5}
                      max={50}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">padding الخلايا (px)</Label>
                    <Input
                      type="number"
                      value={sectionSettings.tableSettings.cellPadding || 4}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, cellPadding: Number(e.target.value) }
                      }))}
                      className="h-8"
                      step={1}
                      min={0}
                      max={20}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">بداية الجدول من اليمين %</Label>
                    <Input
                      type="number"
                      value={sectionSettings.tableSettings.rightPosition}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, rightPosition: Number(e.target.value) }
                      }))}
                      className="h-8"
                      min={0}
                      max={30}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">نهاية الجدول من اليسار %</Label>
                    <Input
                      type="number"
                      value={sectionSettings.tableSettings.leftPosition}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, leftPosition: Number(e.target.value) }
                      }))}
                      className="h-8"
                      min={0}
                      max={30}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">عرض الجدول %</Label>
                    <Input
                      type="number"
                      value={sectionSettings.tableSettings.tableWidth}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, tableWidth: Number(e.target.value) }
                      }))}
                      className="h-8"
                      min={50}
                      max={100}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">أقصى عدد صفوف</Label>
                    <Input
                      type="number"
                      value={sectionSettings.tableSettings.maxRows}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, maxRows: Number(e.target.value) }
                      }))}
                      className="h-8"
                      min={1}
                      max={20}
                    />
                  </div>
                </div>

                {/* Font Settings */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <Label className="text-xs">حجم خط الرأس</Label>
                    <Input
                      type="number"
                      value={sectionSettings.tableSettings.headerFontSize || 11}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, headerFontSize: Number(e.target.value) }
                      }))}
                      className="h-8"
                      min={6}
                      max={24}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">حجم خط الخلايا</Label>
                    <Input
                      type="number"
                      value={sectionSettings.tableSettings.fontSize || 10}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, fontSize: Number(e.target.value) }
                      }))}
                      className="h-8"
                      min={6}
                      max={24}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">وزن خط الرأس</Label>
                    <select
                      value={sectionSettings.tableSettings.headerFontWeight || 'bold'}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, headerFontWeight: e.target.value }
                      }))}
                      className="h-8 w-full rounded border bg-background px-2 text-xs"
                    >
                      <option value="normal">عادي</option>
                      <option value="bold">عريض</option>
                      <option value="600">شبه عريض</option>
                      <option value="800">عريض جداً</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">وزن خط الخلايا</Label>
                    <select
                      value={sectionSettings.tableSettings.fontWeight || 'normal'}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, fontWeight: e.target.value }
                      }))}
                      className="h-8 w-full rounded border bg-background px-2 text-xs"
                    >
                      <option value="normal">عادي</option>
                      <option value="bold">عريض</option>
                      <option value="600">شبه عريض</option>
                    </select>
                  </div>
                </div>

                {/* Text Alignment */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">محاذاة نص الرأس</Label>
                    <select
                      value={sectionSettings.tableSettings.headerTextAlign || 'center'}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, headerTextAlign: e.target.value as any }
                      }))}
                      className="h-8 w-full rounded border bg-background px-2 text-xs"
                    >
                      <option value="right">يمين</option>
                      <option value="center">وسط</option>
                      <option value="left">يسار</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">محاذاة نص الخلايا</Label>
                    <select
                      value={sectionSettings.tableSettings.cellTextAlign || 'center'}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, cellTextAlign: e.target.value as any }
                      }))}
                      className="h-8 w-full rounded border bg-background px-2 text-xs"
                    >
                      <option value="right">يمين</option>
                      <option value="center">وسط</option>
                      <option value="left">يسار</option>
                    </select>
                  </div>
                </div>

                {/* Table Styling */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <Label className="text-xs">خلفية الرأس</Label>
                    <Input
                      type="color"
                      value={sectionSettings.tableSettings.headerBgColor}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, headerBgColor: e.target.value }
                      }))}
                      className="h-8 w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">لون نص الرأس</Label>
                    <Input
                      type="color"
                      value={sectionSettings.tableSettings.headerTextColor}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, headerTextColor: e.target.value }
                      }))}
                      className="h-8 w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">لون الحدود</Label>
                    <Input
                      type="color"
                      value={sectionSettings.tableSettings.borderColor}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, borderColor: e.target.value }
                      }))}
                      className="h-8 w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">سمك الحدود (px)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      value={sectionSettings.tableSettings.borderWidth ?? 1}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, borderWidth: parseFloat(e.target.value) || 1 }
                      }))}
                      className="h-8 w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">لون الصفوف المتناوبة</Label>
                    <Input
                      type="color"
                      value={sectionSettings.tableSettings.alternateRowColor}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, alternateRowColor: e.target.value }
                      }))}
                      className="h-8 w-full"
                    />
                  </div>
                </div>

                {/* Highlighted Columns Selection */}
                <div className="pt-2 border-t">
                  <Label className="text-xs mb-2 block">الأعمدة ذات اللون المميز</Label>
                  <div className="flex flex-wrap gap-2">
                    {sectionSettings.tableSettings.columns.map(col => (
                      <label key={col.key} className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={(sectionSettings.tableSettings.highlightedColumns || ['index']).includes(col.key)}
                          onChange={(e) => {
                            const currentHighlighted = sectionSettings.tableSettings.highlightedColumns || ['index'];
                            setSectionSettings(s => ({
                              ...s,
                              tableSettings: {
                                ...s.tableSettings,
                                highlightedColumns: e.target.checked
                                  ? [...currentHighlighted, col.key]
                                  : currentHighlighted.filter(k => k !== col.key)
                              }
                            }));
                          }}
                          className="h-3 w-3"
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Highlighted Column Styling */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <Label className="text-xs">خلفية الأعمدة المميزة</Label>
                    <Input
                      type="color"
                      value={sectionSettings.tableSettings.highlightedColumnBgColor}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, highlightedColumnBgColor: e.target.value }
                      }))}
                      className="h-8 w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">لون نص الأعمدة المميزة</Label>
                    <Input
                      type="color"
                      value={sectionSettings.tableSettings.highlightedColumnTextColor}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, highlightedColumnTextColor: e.target.value }
                      }))}
                      className="h-8 w-full"
                    />
                  </div>
                </div>

                {/* Cell Text Color */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">لون نص الخلايا العادية</Label>
                    <Input
                      type="color"
                      value={sectionSettings.tableSettings.cellTextColor}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, cellTextColor: e.target.value }
                      }))}
                      className="h-8 w-full"
                    />
                  </div>
                </div>

                {/* QR Code Colors */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <Label className="text-xs">لون QR الأمامي</Label>
                    <Input
                      type="color"
                      value={sectionSettings.tableSettings.qrForegroundColor || '#000000'}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, qrForegroundColor: e.target.value }
                      }))}
                      className="h-8 w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">لون QR الخلفية</Label>
                    <Input
                      type="color"
                      value={sectionSettings.tableSettings.qrBackgroundColor || '#ffffff'}
                      onChange={(e) => setSectionSettings(s => ({
                        ...s,
                        tableSettings: { ...s.tableSettings, qrBackgroundColor: e.target.value }
                      }))}
                      className="h-8 w-full"
                    />
                  </div>
                </div>

                {/* إعدادات عرض التخفيض */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">إعدادات عرض التخفيض</Label>
                    <Switch
                      checked={sectionSettings.discountDisplay?.enabled ?? true}
                      onCheckedChange={(checked) => setSectionSettings(s => ({
                        ...s,
                        discountDisplay: { ...(s.discountDisplay || DEFAULT_DISCOUNT_DISPLAY), enabled: checked }
                      }))}
                    />
                  </div>
                  
                  {sectionSettings.discountDisplay?.enabled && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <Switch
                          checked={sectionSettings.discountDisplay?.showOriginalPrice ?? true}
                          onCheckedChange={(checked) => setSectionSettings(s => ({
                            ...s,
                            discountDisplay: { ...(s.discountDisplay || DEFAULT_DISCOUNT_DISPLAY), showOriginalPrice: checked }
                          }))}
                        />
                        <Label className="text-xs">إظهار السعر الأصلي مشطوب</Label>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">حجم السعر الأصلي (px)</Label>
                          <Input
                            type="number"
                            value={sectionSettings.discountDisplay?.originalPriceFontSize || 18}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              discountDisplay: { ...(s.discountDisplay || DEFAULT_DISCOUNT_DISPLAY), originalPriceFontSize: Number(e.target.value) }
                            }))}
                            className="h-8"
                            min={10}
                            max={30}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">حجم السعر بعد التخفيض (px)</Label>
                          <Input
                            type="number"
                            value={sectionSettings.discountDisplay?.discountedPriceFontSize || 24}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              discountDisplay: { ...(s.discountDisplay || DEFAULT_DISCOUNT_DISPLAY), discountedPriceFontSize: Number(e.target.value) }
                            }))}
                            className="h-8"
                            min={10}
                            max={40}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div>
                          <Label className="text-xs">لون السعر الأصلي</Label>
                          <Input
                            type="color"
                            value={sectionSettings.discountDisplay?.originalPriceColor || '#888888'}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              discountDisplay: { ...(s.discountDisplay || DEFAULT_DISCOUNT_DISPLAY), originalPriceColor: e.target.value }
                            }))}
                            className="h-8 w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">لون السعر الجديد</Label>
                          <Input
                            type="color"
                            value={sectionSettings.discountDisplay?.discountedPriceColor || '#000000'}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              discountDisplay: { ...(s.discountDisplay || DEFAULT_DISCOUNT_DISPLAY), discountedPriceColor: e.target.value }
                            }))}
                            className="h-8 w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">لون خط الشطب</Label>
                          <Input
                            type="color"
                            value={sectionSettings.discountDisplay?.strikethroughColor || '#cc0000'}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              discountDisplay: { ...(s.discountDisplay || DEFAULT_DISCOUNT_DISPLAY), strikethroughColor: e.target.value }
                            }))}
                            className="h-8 w-full"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label className="text-xs">سمك خط الشطب (px)</Label>
                          <Input
                            type="number"
                            value={sectionSettings.discountDisplay?.strikethroughWidth || 2}
                            onChange={(e) => setSectionSettings(s => ({
                              ...s,
                              discountDisplay: { ...(s.discountDisplay || DEFAULT_DISCOUNT_DISPLAY), strikethroughWidth: Number(e.target.value) }
                            }))}
                            className="h-8"
                            min={1}
                            max={5}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* إعدادات الصور والـ QR الافتراضية */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      إعدادات اللوحات الناقصة
                    </Label>
                  </div>
                  
                  <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">
                      هذه الإعدادات تُستخدم للوحات التي ليس لها صورة أو إحداثيات GPS
                    </p>
                    
                    {/* استخدام الصورة الافتراضية */}
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">استخدام صورة افتراضية للوحات بدون صور</Label>
                      <Switch
                        checked={sectionSettings.fallbackSettings?.useDefaultImage ?? true}
                        onCheckedChange={(checked) => setSectionSettings(s => ({
                          ...s,
                          fallbackSettings: { ...(s.fallbackSettings || DEFAULT_FALLBACK_SETTINGS), useDefaultImage: checked }
                        }))}
                      />
                    </div>
                    
                    {sectionSettings.fallbackSettings?.useDefaultImage !== false && (
                      <div>
                        <Label className="text-xs">رابط الصورة الافتراضية</Label>
                        <Input
                          value={sectionSettings.fallbackSettings?.defaultImageUrl || '/logofaresgold.svg'}
                          onChange={(e) => setSectionSettings(s => ({
                            ...s,
                            fallbackSettings: { ...(s.fallbackSettings || DEFAULT_FALLBACK_SETTINGS), defaultImageUrl: e.target.value }
                          }))}
                          className="h-8 text-xs"
                          dir="ltr"
                          placeholder="/logofaresgold.svg"
                        />
                      </div>
                    )}
                    
                    {/* استخدام QR افتراضي */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Label className="text-xs">استخدام رابط قوقل ماب افتراضي</Label>
                      <Switch
                        checked={sectionSettings.fallbackSettings?.useDefaultQR ?? true}
                        onCheckedChange={(checked) => setSectionSettings(s => ({
                          ...s,
                          fallbackSettings: { ...(s.fallbackSettings || DEFAULT_FALLBACK_SETTINGS), useDefaultQR: checked }
                        }))}
                      />
                    </div>
                    
                    {sectionSettings.fallbackSettings?.useDefaultQR !== false && (
                      <div>
                        <Label className="text-xs">رابط قوقل ماب الافتراضي</Label>
                        <Input
                          value={sectionSettings.fallbackSettings?.defaultGoogleMapsUrl || 'https://www.google.com/maps?q=32.8872,13.1913'}
                          onChange={(e) => setSectionSettings(s => ({
                            ...s,
                            fallbackSettings: { ...(s.fallbackSettings || DEFAULT_FALLBACK_SETTINGS), defaultGoogleMapsUrl: e.target.value }
                          }))}
                          className="h-8 text-xs"
                          dir="ltr"
                          placeholder="https://www.google.com/maps?q=..."
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          يُستخدم لتوليد QR code للوحات التي ليس لها إحداثيات
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <Label className="text-sm font-medium mb-2 block">إدارة الأعمدة (اسحب للترتيب)</Label>
                  <ScrollArea className="h-[calc(100vh-500px)]">
                    <div className="space-y-2 pr-2">
                      {sectionSettings.tableSettings.columns.map((col, idx) => (
                        <div 
                          key={col.key}
                          className={`p-2 rounded-lg border ${col.visible ? 'bg-muted/30' : 'bg-muted/10 opacity-60'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {/* Reorder buttons */}
                              <div className="flex flex-col gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 p-0"
                                  onClick={() => moveColumn(col.key, 'up')}
                                  disabled={idx === 0}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 p-0"
                                  onClick={() => moveColumn(col.key, 'down')}
                                  disabled={idx === sectionSettings.tableSettings.columns.length - 1}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              </div>
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <Switch
                                checked={col.visible}
                                onCheckedChange={(v) => updateColumnSetting(col.key, 'visible', v)}
                              />
                              <span className="font-medium text-xs">{col.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px]">{idx + 1}</Badge>
                              <Badge variant="outline" className="text-[10px]">{col.key}</Badge>
                            </div>
                          </div>
                          
                          {col.visible && (
                            <div className="space-y-2 mt-2">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-[10px]">اسم العمود</Label>
                                  <Input
                                    value={col.label}
                                    onChange={(e) => updateColumnSetting(col.key, 'label', e.target.value)}
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">العرض %</Label>
                                  <Input
                                    type="number"
                                    value={col.width}
                                    onChange={(e) => updateColumnSetting(col.key, 'width', Number(e.target.value))}
                                    className="h-7 text-xs"
                                    min={3}
                                    max={50}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">المحاذاة</Label>
                                  <Select
                                    value={col.textAlign ?? '__inherit__'}
                                    onValueChange={(v) =>
                                      updateColumnSetting(
                                        col.key,
                                        'textAlign',
                                        v === '__inherit__' ? undefined : (v as any)
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__inherit__">حسب الجدول</SelectItem>
                                      <SelectItem value="right">يمين</SelectItem>
                                      <SelectItem value="center">وسط</SelectItem>
                                      <SelectItem value="left">يسار</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <Label className="text-[10px]">حجم الخط</Label>
                                  <Input
                                    type="number"
                                    value={col.fontSize || 26}
                                    onChange={(e) => updateColumnSetting(col.key, 'fontSize', Number(e.target.value))}
                                    className="h-7 text-xs"
                                    min={8}
                                    max={48}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">خط الرأس</Label>
                                  <Input
                                    type="number"
                                    value={col.headerFontSize || 28}
                                    onChange={(e) => updateColumnSetting(col.key, 'headerFontSize', Number(e.target.value))}
                                    className="h-7 text-xs"
                                    min={8}
                                    max={48}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">التباعد (px)</Label>
                                  <Input
                                    type="number"
                                    value={col.padding ?? 2}
                                    onChange={(e) => updateColumnSetting(col.key, 'padding', Number(e.target.value))}
                                    className="h-7 text-xs"
                                    min={0}
                                    max={20}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px]">ارتفاع السطر</Label>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={col.lineHeight ?? 1.3}
                                    onChange={(e) => updateColumnSetting(col.key, 'lineHeight', Number(e.target.value))}
                                    className="h-7 text-xs"
                                    min={1}
                                    max={3}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Background Selection for Table Page */}
                <div className="pt-2 border-t space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    خلفية جدول اللوحات
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableBackgrounds.map((bg) => (
                      <div
                        key={bg.url}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          tableBackgroundUrl === bg.url 
                            ? 'border-primary bg-primary/10 ring-2 ring-primary' 
                            : 'border-muted hover:border-primary/50'
                        }`}
                        onClick={() => setTableBackgroundUrl(bg.url)}
                      >
                        <img 
                          src={bg.url} 
                          alt={bg.name} 
                          className="w-full h-16 object-cover rounded mb-1"
                        />
                        <p className="text-xs text-center">{bg.name}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      placeholder="أو أدخل رابط صورة مخصصة..."
                      value={tableBackgroundUrl.startsWith('/') ? '' : tableBackgroundUrl}
                      onChange={(e) => setTableBackgroundUrl(e.target.value || '/bgc2.svg')}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* No-Stamp Background Settings */}
                <div className="pt-2 border-t space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    خلفية بدون ختم - الصفحة الأولى
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableBackgrounds.map((bg) => (
                      <div
                        key={bg.url}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          noStampBgUrl === bg.url 
                            ? 'border-primary bg-primary/10 ring-2 ring-primary' 
                            : 'border-muted hover:border-primary/50'
                        }`}
                        onClick={() => setNoStampBgUrl(bg.url)}
                      >
                        <img 
                          src={bg.url} 
                          alt={bg.name} 
                          className="w-full h-16 object-cover rounded mb-1"
                        />
                        <p className="text-xs text-center">{bg.name}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      placeholder="أو أدخل رابط صورة مخصصة..."
                      value={noStampBgUrl.startsWith('/') ? '' : noStampBgUrl}
                      onChange={(e) => setNoStampBgUrl(e.target.value || '/bgc1not.svg')}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    خلفية بدون ختم - جدول اللوحات
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableBackgrounds.map((bg) => (
                      <div
                        key={bg.url}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          noStampTableBgUrl === bg.url 
                            ? 'border-primary bg-primary/10 ring-2 ring-primary' 
                            : 'border-muted hover:border-primary/50'
                        }`}
                        onClick={() => setNoStampTableBgUrl(bg.url)}
                      >
                        <img 
                          src={bg.url} 
                          alt={bg.name} 
                          className="w-full h-16 object-cover rounded mb-1"
                        />
                        <p className="text-xs text-center">{bg.name}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      placeholder="أو أدخل رابط صورة مخصصة..."
                      value={noStampTableBgUrl.startsWith('/') ? '' : noStampTableBgUrl}
                      onChange={(e) => setNoStampTableBgUrl(e.target.value || '/bgc2.svg')}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground pt-2 border-t">
                  يمكنك إظهار/إخفاء الأعمدة وتغيير أسمائها وعرضها
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Term Dialog */}
      <UIDialog.Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <UIDialog.DialogContent className="max-w-md">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة بند جديد</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              أدخل بيانات البند الجديد
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>مفتاح البند (بالإنجليزية)</Label>
              <Input
                value={newTerm.term_key || ''}
                onChange={(e) => setNewTerm({ ...newTerm, term_key: e.target.value })}
                placeholder="مثال: clause_seven"
                dir="ltr"
              />
            </div>
            
            <div>
              <Label>عنوان البند</Label>
              <Input
                value={newTerm.term_title || ''}
                onChange={(e) => setNewTerm({ ...newTerm, term_title: e.target.value })}
                placeholder="مثال: البند السابع"
              />
            </div>
            
            <div>
              <Label>محتوى البند</Label>
              <Textarea
                value={newTerm.term_content || ''}
                onChange={(e) => setNewTerm({ ...newTerm, term_content: e.target.value })}
                placeholder="محتوى البند..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>حجم الخط</Label>
                <Input
                  type="number"
                  value={newTerm.font_size || 42}
                  onChange={(e) => setNewTerm({ ...newTerm, font_size: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>الموقع الرأسي (Y)</Label>
                <Input
                  type="number"
                  value={newTerm.position_y || 0}
                  onChange={(e) => setNewTerm({ ...newTerm, position_y: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddTerm} disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              إضافة
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>
    </div>
  );
}
