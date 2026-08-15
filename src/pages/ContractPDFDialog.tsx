import React, { useEffect, useState } from 'react';
import { generateContractInvoiceHTML, ContractInvoiceData } from '@/lib/contractInvoiceGenerator';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X, Download, Eye, Send } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
import { useContractTemplateSettings, DEFAULT_SECTION_SETTINGS } from '@/hooks/useContractTemplateSettings';
import { ContractPDFPreview } from '@/components/contracts/ContractPDFPreview';
import { ContractPDFSummary } from '@/components/contracts/ContractPDFSummary';
import { ContractPDFActions } from '@/components/contracts/ContractPDFActions';
import {
  renderAllBillboardsTablePages,
  renderBillboardsTablePage,
  BillboardRowData,
  solidFillDataUri,
} from '@/lib/contractTableRenderer';
import {
  generateUnifiedPrintHTML,
  openUnifiedPrintWindow,
  BillboardPrintData as UnifiedBillboardData,
  ContractTerm as UnifiedContractTerm
} from '@/lib/unifiedContractPrint';
import { Installment, generatePaymentsClauseText } from '@/utils/paymentGrouping';
import { numberToArabicWords } from '@/lib/printUtils';
import { preparePrintWindow, writePrintWindow, openPrintDirectly } from '@/utils/printWindowHelper';

interface ContractPDFDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: any;
  liveBillboardPrices?: any[];
}

// ✅ تنسيق تاريخ DD/MM/YYYY للعرض داخل نص البند الخامس
const formatDateForDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
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

/**
 * ✅ البند الخامس: صيغة الدفعات المطلوبة
 * - لا نبدأ السطر برقم (لمنع مشكلة RTL)
 * - نفصل "دفعة أولى" دائماً ثم نجمع المتكرر بعد ذلك فقط
 */
const formatPaymentsClauseText = (
  installmentsData: string | null,
  currencySymbol: string,
  currencyWrittenName: string
): string => {
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

    return generatePaymentsClauseText(installments, currencySymbol, currencyWrittenName);
  } catch (e) {
    console.error('Error parsing installments:', e);
    return 'دفعة واحدة عند التوقيع';
  }
};

// ✅ HTML للمعاينة فقط
const formatPaymentsSummary = (installmentsData: string | null, currencySymbol: string, currencyWrittenName: string): string => {
  return formatPaymentsClauseText(installmentsData, currencySymbol, currencyWrittenName);
};

// ✅ نسخة للطباعة SVG (بدون HTML)
const formatPaymentsSummaryPlain = (installmentsData: string | null, currencySymbol: string, currencyWrittenName: string): string => {
  return formatPaymentsClauseText(installmentsData, currencySymbol, currencyWrittenName);
};

// ✅ NEW: Currency options with written names in Arabic
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£', writtenName: 'جنيه إسترليني' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', writtenName: 'ريال سعودي' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', writtenName: 'درهم إماراتي' },
];

/**
 * ✅ بناء عنوان وصفي منسق وشامل للعقد بفصل تام للعناصر
 * مثال: [عقد 1294 (118-26)] - [إعلان] - [محمد فتحي البهلول] - [1×(13×5) + 1×(12×4) + 2×(10×4) + 1×(3×8-T) + 1×(8×3) + 2×(4×3)] - [48,000 د.ل]
 */
function buildContractPdfTitle(params: {
  contractNumber: string | number;
  yearlyCode?: string;
  adType: string;
  customerName: string;
  customerCompany?: string;
  billboards: { size: string }[];
  currencySymbol: string;
  totalAmount?: number;
  isOffer?: boolean;
}): string {
  const { contractNumber, yearlyCode, adType, customerName, customerCompany, billboards, currencySymbol, totalAmount, isOffer } = params;

  // ملخص مقاسات شامل ودقيق: عدد اللوحات من كل مقاس بتنسيق واضح يمنع تداخل الأرقام
  const sizeCounts: Record<string, number> = {};
  billboards.forEach(b => {
    const raw = b.size?.trim();
    if (!raw) return;
    const s = raw.replace(/x/gi, '×').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
    if (s) {
      sizeCounts[s] = (sizeCounts[s] || 0) + 1;
    }
  });

  const distinctSizes = Object.entries(sizeCounts);
  let sizesSummary = '';
  if (distinctSizes.length > 0) {
    sizesSummary = distinctSizes
      .map(([sz, count]) => `${count}×(${sz})`)
      .join(' + ');
  } else if (billboards.length > 0) {
    sizesSummary = `${billboards.length} لوحة`;
  }

  const prefix = isOffer ? 'عرض' : 'عقد';
  const cleanYearly = yearlyCode ? ` (${yearlyCode.replace(/[/_]/g, '-')})` : '';

  // تنسيق المبلغ الإجمالي مع رمز العملة
  let totalFormatted = '';
  const numTotal = Number(totalAmount || 0);
  if (numTotal > 0) {
    totalFormatted = `${Math.round(numTotal).toLocaleString('en-US')} ${currencySymbol || 'د.ل'}`;
  } else if (currencySymbol) {
    totalFormatted = currencySymbol;
  }

  // دمج اسم العميل والشركة بدون تكرار
  const rawCust = (customerName || '').trim();
  const rawComp = (customerCompany || '').trim();
  const clientDisplay = rawComp && rawComp !== rawCust && rawCust
    ? `${rawCust} - ${rawComp}`
    : (rawCust || rawComp);

  const cleanAdType = (adType || '').trim();

  // تغليف كل عنصر داخل أقواس مربعة واضحة لضمان الفصل التام
  const parts = [
    `[${prefix} ${contractNumber}${cleanYearly}]`,
    cleanAdType ? `[${cleanAdType}]` : '',
    clientDisplay ? `[${clientDisplay}]` : '',
    sizesSummary ? `[${sizesSummary}]` : '',
    totalFormatted ? `[${totalFormatted}]` : '',
  ].filter(Boolean);

  return parts.join(' - ');
}

/**
 * بناء اسم ملف PDF للعقد - بدون رموز غير مسموحة في أنظمة التشغيل وبفصل واضح
 */
function buildContractPdfFileName(params: {
  contractNumber: string | number;
  yearlyCode?: string;
  adType: string;
  customerName: string;
  customerCompany?: string;
  billboards: { size: string }[];
  currencySymbol: string;
  totalAmount?: number;
  isOffer?: boolean;
}): string {
  const title = buildContractPdfTitle(params);
  // تنظيف الأحرف غير المسموح بها في أسماء الملفات وجعل الفواصل قياسية
  const safeName = title
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/_+/g, ' ')
    .trim();
  return `${safeName}.pdf`;
}

// ✅ FIXED: Custom number formatting function for Arabic locale with proper thousands separator
const formatArabicNumber = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';

  // ✅ تقريب لرقم واحد بعد الفاصلة العشرية
  const rounded = Math.round(Number(num) * 10) / 10;

  const [integerPart, decimalPart] = rounded.toString().split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // إذا كان الرقم صحيحاً (بدون كسر) لا نعرض الفاصلة العشرية
  if (!decimalPart || decimalPart === '0') {
    return formattedInteger;
  }

  return `${formattedInteger}.${decimalPart}`;
};

// ✅ Helper function to wrap LTR content (English text, numbers, phone numbers) for proper RTL display
const wrapLTRContent = (text: string): string => {
  if (!text) return '';

  // Wrap phone numbers with LTR marks
  // Match phone patterns like 0912612255, +218912612255, etc.
  let result = text.replace(
    /(\+?\d[\d\s\-()]{6,})/g,
    '<span class="phone-number">$1</span>'
  );

  // Wrap English text (sequences of Latin characters)
  result = result.replace(
    /([a-zA-Z][a-zA-Z0-9\s\-_.]*[a-zA-Z0-9]|[a-zA-Z])/g,
    '<span class="english-text">$1</span>'
  );

  return result;
};

// ✅ SVG helper: isolate Latin runs as LTR tspans inside RTL text
const wrapSvgLTRRuns = (text: string): string => {
  if (!text) return '';
  return text.replace(
    /([A-Za-z0-9][A-Za-z0-9\s\-_.&()\/+]*)/g,
    '<tspan direction="ltr" unicode-bidi="embed">$1</tspan>'
  );
};

// ✅ Text measurement (matches ContractTermsSettings preview behavior)
const __textMeasureCache = new Map<string, number>();
let __textMeasureCtx: CanvasRenderingContext2D | null = null;

function measureTextWidthPx(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: string | number = 400
): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.5;

  const key = `${fontFamily}|${fontWeight}|${fontSize}|${text}`;
  const cached = __textMeasureCache.get(key);
  if (cached != null) return cached;

  if (!__textMeasureCtx) {
    const canvas = document.createElement('canvas');
    __textMeasureCtx = canvas.getContext('2d');
  }

  if (!__textMeasureCtx) return text.length * fontSize * 0.5;

  __textMeasureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const width = __textMeasureCtx.measureText(text).width;
  __textMeasureCache.set(key, width);
  return width;
}

// ✅ Interface for contract terms
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
}

export default function ContractPDFDialog({ open, onOpenChange, contract, liveBillboardPrices }: ContractPDFDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [printMode, setPrintMode] = useState<'auto' | 'manual'>('auto');
  const [useInstallationImages, setUseInstallationImages] = useState(false);
  const [withStamp, setWithStamp] = useState(true); // مع ختم افتراضياً
  const [customerData, setCustomerData] = useState<{
    name: string;
    company: string | null;
    phone: string | null;
  } | null>(null);
  // دالة لجلب بيانات المقاسات والبلديات والمستويات
  const [sizesData, setSizesData] = useState<any[]>([]);
  const [municipalitiesData, setMunicipalitiesData] = useState<any[]>([]);
  const [levelsData, setLevelsData] = useState<any[]>([]);
  // ✅ NEW: Contract terms from database
  const [contractTerms, setContractTerms] = useState<ContractTerm[]>([]);

  // ✅ NEW: Preview states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHTML, setPreviewHTML] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [yearlyContractCode, setYearlyContractCode] = useState('');
  const [sizesSummary, setSizesSummary] = useState<{ size: string; count: number }[]>([]);

  // WhatsApp sending
  const { sendMessage, loading: sendingWhatsApp } = useSendWhatsApp();

  // ✅ جلب إعدادات القالب من قاعدة البيانات
  const { data: templateData } = useContractTemplateSettings();
  const templateSettings = templateData?.settings || DEFAULT_SECTION_SETTINGS;
  const templateBgUrl = templateData?.backgroundUrl || '/bgc1.svg';
  const tableBgUrl = templateData?.tableBackgroundUrl || '/bgc2.svg';
  const configuredNoStampBgUrl = templateData?.noStampBgUrl || '/bgc1not.svg';
  const configuredNoStampTableBgUrl = templateData?.noStampTableBgUrl || '/bgc2.svg';

  // ✅ جلب بنود العقد من قاعدة البيانات
  const loadContractTerms = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_terms')
        .select('*')
        .eq('is_active', true)
        .order('term_order', { ascending: true });

      if (!error && data) {
        setContractTerms(data);
      }
    } catch (error) {
      console.error('Error loading contract terms:', error);
    }
  };

  useEffect(() => {
    if (open) {
      loadContractTerms();
    }
  }, [open]);

  // ✅ تحميل كود العقد السنوي عند فتح الحوار
  useEffect(() => {
    const loadYearlyCode = async () => {
      const contractDate = contract?.start_date || contract?.['Contract Date'];
      if (!contractDate) {
        setYearlyContractCode('');
        return;
      }

      const cDate = new Date(contractDate);
      if (isNaN(cDate.getTime())) {
        setYearlyContractCode('');
        return;
      }

      const cYear = cDate.getFullYear();
      const yearShort = cYear.toString().slice(-2);

      try {
        const startOfYear = `${cYear}-01-01`;
        const endOfYear = `${cYear}-12-31`;

        const { data: yearContracts } = await supabase
          .from('Contract')
          .select('Contract_Number, "Contract Date"')
          .gte('"Contract Date"', startOfYear)
          .lte('"Contract Date"', endOfYear)
          .order('Contract_Number', { ascending: true });

        if (yearContracts && yearContracts.length > 0) {
          const currentContractNum = contract?.Contract_Number || contract?.id;
          const order = yearContracts.findIndex(c => c.Contract_Number === currentContractNum) + 1;
          if (order > 0) {
            setYearlyContractCode(`${order}/${yearShort}`);
            return;
          }
        }

        const contractNum = parseInt(String(contract?.Contract_Number || contract?.id || '0'));
        setYearlyContractCode(`${contractNum}/${yearShort}`);
      } catch (error) {
        console.error('Error getting yearly code:', error);
        setYearlyContractCode('');
      }
    };

    if (open && contract) {
      loadYearlyCode();
    }
  }, [open, contract]);

  const loadSortingData = async () => {
    try {
      const [sizesRes, municipalitiesRes, levelsRes] = await Promise.all([
        supabase.from('sizes').select('*'),
        supabase.from('municipalities').select('*'),
        supabase.from('billboard_levels').select('*')
      ]);

      if (!sizesRes.error && Array.isArray(sizesRes.data)) {
        setSizesData(sizesRes.data);
      }
      if (!municipalitiesRes.error && Array.isArray(municipalitiesRes.data)) {
        setMunicipalitiesData(municipalitiesRes.data);
      }
      if (!levelsRes.error && Array.isArray(levelsRes.data)) {
        setLevelsData(levelsRes.data);
      }
    } catch (error) {
      console.error('Error loading sorting data:', error);
    }
  };

  useEffect(() => {
    if (open) {
      loadSortingData();
    }
  }, [open]);

  // ✅ حساب ملخص المقاسات عند فتح الحوار
  useEffect(() => {
    const calculateSizesSummary = async () => {
      if (!open || !contract) return;

      try {
        // جلب بيانات اللوحات
        const billboardIds = contract?.billboard_ids;
        let billboards: any[] = [];

        if (billboardIds) {
          const idsArray = typeof billboardIds === 'string'
            ? billboardIds.split(',').map(id => id.trim()).filter(Boolean)
            : Array.isArray(billboardIds) ? billboardIds : [];

          if (idsArray.length > 0) {
            const { data } = await supabase
              .from('billboards')
              .select('Size')
              .in('ID', idsArray);

            if (data) billboards = data;
          }
        }

        // إذا لم نجد لوحات، استخدم البيانات المحفوظة
        if (billboards.length === 0 && contract?.billboards) {
          billboards = Array.isArray(contract.billboards) ? contract.billboards : [];
        }

        // حساب ملخص المقاسات
        const sizeCounts: Record<string, number> = {};
        billboards.forEach((b: any) => {
          const size = b.Size || b.size || 'غير محدد';
          sizeCounts[size] = (sizeCounts[size] || 0) + 1;
        });

        const summary = Object.entries(sizeCounts).map(([size, count]) => ({
          size: size.replace(/x/gi, '×'),
          count
        }));

        setSizesSummary(summary);
      } catch (error) {
        console.error('Error calculating sizes summary:', error);
        setSizesSummary([]);
      }
    };

    calculateSizesSummary();
  }, [open, contract]);

  // ✅ REFACTORED: Get currency information from contract
  const getCurrencyInfo = () => {
    const currencyCode = contract?.contract_currency || 'LYD';
    const currency = CURRENCIES.find(c => c.code === currencyCode);
    return {
      code: currencyCode,
      symbol: currency?.symbol || 'د.ل',
      name: currency?.name || 'دينار ليبي',
      writtenName: currency?.writtenName || 'دينار ليبي'
    };
  };

  // ✅ REFACTORED: Get discount information from contract - استخراج معلومات التخفيض من جميع المصادر الممكنة
  const getDiscountInfo = () => {
    const currencyInfo = getCurrencyInfo();
    const contractAny = contract as any;

    // البحث في جميع الحقول المحتملة للتخفيض
    let discountNum = 0;

    // 1. حقل Discount المباشر (من حفظ العقد)
    if (contractAny?.Discount !== undefined && contractAny?.Discount !== null) {
      discountNum = Number(contractAny.Discount);
    } else if (contractAny?.discount !== undefined && contractAny?.discount !== null) {
      discountNum = Number(contractAny.discount);
    }

    // 2. حساب التخفيض من level_discounts إذا كان موجوداً ولم يكن هناك تخفيض مباشر
    if (discountNum === 0 && contractAny?.level_discounts && typeof contractAny.level_discounts === 'object') {
      const levelDiscounts = contractAny.level_discounts as Record<string, number>;
      const billboards = contract?.billboards || [];

      if (billboards.length > 0 && Object.keys(levelDiscounts).length > 0) {
        let totalDiscountAmount = 0;

        billboards.forEach((billboard: any) => {
          const level = billboard.level || billboard.Level || billboard.billboard_level || '';
          const discountPercent = levelDiscounts[level] || 0;
          const billboardPrice = Number(billboard.price_after_discount || billboard.total_price || billboard.price || 0);

          if (discountPercent > 0 && billboardPrice > 0) {
            // إعادة حساب السعر الأصلي قبل الخصم
            const originalPrice = billboardPrice / (1 - discountPercent / 100);
            totalDiscountAmount += originalPrice - billboardPrice;
          }
        });

        discountNum = totalDiscountAmount;
      }
    }

    // 3. حساب التخفيض من الفرق بين السعر الكلي والمجموع
    if (discountNum === 0 && contract?.billboards && contract.billboards.length > 0) {
      const billboardsTotal = contract.billboards.reduce((sum: number, b: any) => {
        return sum + Number(b.total_price_before_discount || b.price_before_discount || 0);
      }, 0);

      const totalCost = Number(contract?.rent_cost || contract?.['Total Rent'] || (contractAny)?.Total || 0);

      if (billboardsTotal > 0 && billboardsTotal > totalCost) {
        discountNum = billboardsTotal - totalCost;
      }
    }

    // ✅ التحقق من أن الخصم ليس تكلفة الطباعة
    const printCostEnabled = Boolean(
      contractAny?.print_cost_enabled === true ||
      contractAny?.print_cost_enabled === 1 ||
      contractAny?.print_cost_enabled === 'true' ||
      contractAny?.print_cost_enabled === '1'
    );
    const printCost = Number(contractAny?.print_cost ?? 0);

    // إذا الخصم يساوي تكلفة الطباعة، لا نعتبره خصماً
    if (printCostEnabled && printCost > 0 && !Number.isNaN(discountNum) && discountNum === printCost) {
      return null;
    }

    if (discountNum === 0 || Number.isNaN(discountNum)) {
      return null; // No discount
    }

    // لا نقرب - نحافظ على القيمة كما هي من قاعدة البيانات

    return {
      type: 'fixed',
      value: discountNum,
      display: formatArabicNumber(discountNum),
      text: `${formatArabicNumber(discountNum)} ${currencyInfo.writtenName}`,
    };
  };

  // ✅ REFACTORED: Load customer data
  const loadCustomerData = async () => {
    try {
      const customerId = contract?.customer_id;
      const customerName = contract?.customer_name || contract?.['Customer Name'] || '';

      if (customerId) {
        // Try to get customer data by ID first
        const { data, error } = await supabase
          .from('customers')
          .select('name, company, phone')
          .eq('id', customerId)
          .single();

        if (!error && data) {
          setCustomerData({
            name: data.name || customerName,
            company: data.company,
            phone: data.phone
          });
          return;
        }
      }

      // Fallback: try to find customer by name
      if (customerName) {
        const { data, error } = await supabase
          .from('customers')
          .select('name, company, phone')
          .ilike('name', customerName)
          .limit(1)
          .single();

        if (!error && data) {
          setCustomerData({
            name: data.name || customerName,
            company: data.company,
            phone: data.phone
          });
          return;
        }
      }

      // Final fallback: use contract data only
      setCustomerData({
        name: customerName,
        company: contract?.Company || null,
        phone: contract?.Phone || null
      });

    } catch (error) {
      console.error('Error loading customer data:', error);
      // Use contract data as fallback
      setCustomerData({
        name: contract?.customer_name || contract?.['Customer Name'] || '',
        company: contract?.Company || null,
        phone: contract?.Phone || null
      });
    }
  };

  // Load customer data when dialog opens
  useEffect(() => {
    if (open && contract) {
      loadCustomerData();
    }
  }, [open, contract]);
  // ✅ حساب ترتيب العقد في السنة (مشترك بين جميع الدوال)
  const getYearlyCode = async (): Promise<string> => {
    const contractDate = contract?.start_date || contract?.['Contract Date'];
    if (!contractDate) return '';
    const cDate = new Date(contractDate);
    if (isNaN(cDate.getTime())) return '';
    const cYear = cDate.getFullYear();
    const yearShort = cYear.toString().slice(-2);

    try {
      const startOfYear = `${cYear}-01-01`;
      const endOfYear = `${cYear}-12-31`;

      const { data: yearContracts } = await supabase
        .from('Contract')
        .select('Contract_Number, "Contract Date"')
        .gte('"Contract Date"', startOfYear)
        .lte('"Contract Date"', endOfYear)
        .order('Contract_Number', { ascending: true });

      if (yearContracts && yearContracts.length > 0) {
        const currentContractNum = contract?.Contract_Number || contract?.id;
        const order = yearContracts.findIndex(c => c.Contract_Number === currentContractNum) + 1;
        if (order > 0) {
          return `${order}/${yearShort}`;
        }
      }

      const contractNum = parseInt(String(contract?.Contract_Number || contract?.id || '0'));
      return `${contractNum}/${yearShort}`;
    } catch (error) {
      console.error('Error getting yearly code:', error);
      const contractNum = parseInt(String(contract?.Contract_Number || contract?.id || '0'));
      return `${contractNum}/${yearShort}`;
    }
  };

  // ✅ بناء عنوان وصفي مشترك لجميع دوال الطباعة/المعاينة/التحميل
  const buildDescriptiveTitle = async (overridePrefix?: string): Promise<string> => {
    const yearlyCode = await getYearlyCode();
    const adType = contract?.ad_type || contract?.['Ad Type'] || '';
    const adTypeValue = adType;
    const isOfferByAdType = /^عرض(\s|سعر|$)/.test(adTypeValue.trim());
    const isOffer = contract?.is_offer === true || isOfferByAdType || !contract?.Contract_Number || contract?.offer_number;
    const contractNumber = isOffer ? (contract?.offer_number || contract?.id || '') : (contract?.id || contract?.Contract_Number || '');
    const customerName = customerData?.name || contract?.customer_name || contract?.['Customer Name'] || '';
    const currencyInfo = getCurrencyInfo();

    // جلب التكلفة الإجمالية من كافة الحقول الممكنة
    let totalAmount = Number(
      contract?.Total ??
      contract?.['Total Rent'] ??
      contract?.total_cost ??
      contract?.total_amount ??
      contract?.rent_cost ??
      contract?.total ??
      contract?.price ??
      0
    );

    // جلب مقاسات اللوحات
    let billboardsToShow = await getBillboardsData();
    if (!billboardsToShow || billboardsToShow.length === 0) {
      if (contract?.billboards && Array.isArray(contract.billboards)) {
        billboardsToShow = contract.billboards;
      }
    }

    const billboards = (billboardsToShow || []).map((b: any) => ({
      size: String(b.Size ?? b.size ?? b.dimensions ?? '')
    }));

    // إذا كانت التكلفة الإجمالية 0، احتسابها من مجموع أسعار اللوحات
    if (totalAmount === 0 && billboardsToShow && billboardsToShow.length > 0) {
      const sumPrices = billboardsToShow.reduce((sum: number, b: any) => {
        const p = Number(b.Price ?? b.price ?? b.rent ?? b.Rent_Price ?? b.total_price ?? 0);
        return sum + p;
      }, 0);
      if (sumPrices > 0) {
        totalAmount = sumPrices;
      }
    }

    const effectivePrefix = overridePrefix || (isOffer ? 'عرض' : 'عقد');

    return buildContractPdfTitle({
      contractNumber,
      yearlyCode,
      adType: adType || (isOffer ? 'عرض سعر' : 'عقد إيجار'),
      customerName,
      customerCompany: customerData?.company || contract?.Company || '',
      billboards,
      currencySymbol: currencyInfo.symbol || currencyInfo.name || 'د.ل',
      totalAmount,
      isOffer: effectivePrefix.includes('عرض'),
    });
  };

  // ✅ REFACTORED: Calculate contract details
  const calculateContractDetails = () => {
    const startDate = contract?.start_date || contract?.['Contract Date'];
    const endDate = contract?.end_date || contract?.['End Date'];
    const currencyInfo = getCurrencyInfo();

    // ✅ FIXED: استخدم Total مباشرة لأنه يحتوي على السعر بالعملة المحولة
    const finalTotal = contract?.Total || contract?.total_cost || 0;
    const rentalCost = contract?.['Total Rent'] || contract?.rent_cost || 0;
    const installationCost = contract?.installation_cost || 0;

    let duration = '';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      duration = `${days}`;
    }

    // ✅ FIXED: Format dates with Arabic month names
    const formatArabicDate = (dateString: string): string => {
      if (!dateString) return '';

      const date = new Date(dateString);
      const arabicMonths = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];

      const day = date.getDate();
      const month = arabicMonths[date.getMonth()];
      const year = date.getFullYear();

      return `${day} ${month} ${year}`;
    };

    return {
      finalTotal: formatArabicNumber(finalTotal),
      rentalCost: formatArabicNumber(rentalCost),
      installationCost: formatArabicNumber(installationCost),
      duration,
      startDate: startDate ? formatArabicDate(startDate) : '',
      endDate: endDate ? formatArabicDate(endDate) : '',
      currencyInfo
    };
  };

  // ✅ Helper to get the correct rent end date for a billboard in this contract/offer context
  const getBillboardRentEndDate = (b: any, contractEndDate: string) => {
    const getValidValue = (val: any) => val && val !== '0' && val !== 0 ? String(val) : '';
    const isOffer = contract?.is_offer === true || contract?.offer_number || !contract?.Contract_Number;
    const isSpecialRow = !!(b as any)._paused || !!(b as any)._replacement || !!b.isReplacement;
    
    let rent_end_date_base = '';
    if (isOffer) {
      rent_end_date_base = contractEndDate || '';
    } else if (isSpecialRow) {
      rent_end_date_base = getValidValue(b.Rent_End_Date) || getValidValue(b.rent_end_date) || getValidValue(b.end_date) || contractEndDate || '';
    } else {
      rent_end_date_base = contractEndDate || '';
    }
    
    return (b as any)._paused ? `${rent_end_date_base} (موقوفة)` : rent_end_date_base;
  };

  // Helper to map and normalize a billboard for printing/PDF
  const mapBillboardForPrint = (b: any, billboardPrices: Record<string, any>): UnifiedBillboardData => {
    const id = String(b.ID ?? b.id ?? b.code ?? '');
    const currencyInfo = getCurrencyInfo();
    const contractDetails = calculateContractDetails();

    let image = '';
    if (b.image) {
      image = String(b.image);
    } else if (b.Image_URL) {
      image = String(b.Image_URL);
    }

    const historicalPrice = billboardPrices[id] ?? billboardPrices[Number(id)];
    let price = '';
    let priceNum = 0;
    if (historicalPrice !== undefined && historicalPrice !== null) {
      const num = Number(historicalPrice);
      if (!isNaN(num) && num > 0) {
        price = `${formatArabicNumber(num)} ${currencyInfo.symbol}`;
        priceNum = num;
      }
    } else {
      const fallbackPrice = getSmartFallbackPrice(id, b);
      if (fallbackPrice > 0) {
        price = `${formatArabicNumber(fallbackPrice)} ${currencyInfo.symbol}`;
        priceNum = fallbackPrice;
      }
    }

    let originalPrice = '';
    let hasDiscount = false;
    let origPriceNumResolved = 0;
    let customStartDate = '';
    let customEndDate = '';
    let customStartDateReason = '';
    let isEndDateCustom = false;

    try {
      if (contract?.billboard_prices) {
        const pricesData = typeof contract.billboard_prices === 'string'
          ? JSON.parse(contract.billboard_prices)
          : contract.billboard_prices;
        if (Array.isArray(pricesData)) {
          const priceItem = pricesData.find((item: any) => String(item.billboardId || item.billboard_id || '') === id);
          if (priceItem) {
            origPriceNumResolved = Number(priceItem.priceBeforeDiscount ?? priceItem.basePriceBeforeDiscount ?? 0);
            if (priceItem.startDate) customStartDate = priceItem.startDate;
            if (priceItem.endDate) {
              customEndDate = priceItem.endDate;
              const contractMainEndDate = contract?.['End Date'] || contract?.end_date || '';
              if (contractMainEndDate && priceItem.endDate !== contractMainEndDate) {
                isEndDateCustom = true;
              }
            }
            if (priceItem.startDateReason) customStartDateReason = priceItem.startDateReason;
          }
        }
      }
    } catch (e) {
      console.error('Error parsing billboard prices in helper:', e);
    }

    // Paused billboards: use captured original (full) price as "before discount"
    if ((b as any)._paused && (!origPriceNumResolved || origPriceNumResolved <= 0)) {
      const op = Number((b as any)._paused_original_price);
      if (Number.isFinite(op) && op > 0) origPriceNumResolved = op;
    }
    if (origPriceNumResolved > 0 && origPriceNumResolved > priceNum) {
      originalPrice = `${formatArabicNumber(origPriceNumResolved)} ${currencyInfo.symbol}`;
      hasDiscount = true;
    }

    // Paused billboards: also show net (after-discount, pre-pause) as middle strikethrough
    let prePausePrice = '';
    if ((b as any)._paused) {
      const np = Number((b as any)._paused_net_price);
      if (Number.isFinite(np) && np > 0 && np !== priceNum && np !== origPriceNumResolved) {
        prePausePrice = `${formatArabicNumber(np)} ${currencyInfo.symbol}`;
      }
    }

    let coords = String(b.GPS_Coordinates ?? b.coords ?? '');
    const gpsLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : (b.GPS_Link || '');

    // Get end date - priority to customEndDate
    const rent_end_date = customEndDate || getBillboardRentEndDate(b, contractDetails.endDate || '');
    
    // Get duration days - priority to custom dates duration
    let duration_days = contractDetails.duration || '';
    if (customStartDate && customEndDate) {
      try {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (days > 0) duration_days = String(days);
        }
      } catch (e) {
        console.error('Error calculating custom duration:', e);
      }
    }

    // Replacement row: override price with allocated amount and end date
    if ((b as any)._replacement) {
      const _alloc = Number((b as any)._replacement_allocated) || 0;
      if (_alloc > 0) { price = `${formatArabicNumber(_alloc)} ${currencyInfo.symbol}`; }
    }

    return {
      id,
      code: b.code || `TR-${String(b.ID || b.id || '').padStart(4, '0')}`,
      billboardName: b.Billboard_Name || b.billboardName || '',
      image,
      municipality: b.Municipality || b.municipality || '',
      district: b.District || b.district || '',
      landmark: b.Nearest_Landmark || b.nearest_landmark || '',
      size: b.Size || b.size || '',
      faces: String(b.Faces_Count || b.faces || '2'),
      price,
      originalPrice,
      hasDiscount,
      prePausePrice,
      gpsLink,
      rent_end_date,
      duration_days,
      isReplacement: !!(b as any)._replacement,
      replacementStartDate: (b as any)._replacement_start_date,
      replacedBillboardName: (b as any)._replacement_paused_name,
      isEndDateCustom,
      customStartDate,
      customEndDate,
      customStartDateReason,
    };
  };

  // ✅ REFACTORED: Get payment installments from installments_data
  const getPaymentInstallments = () => {
    const payments = [];
    const currencyInfo = getCurrencyInfo();

    // ✅ PRIORITY 1: Try to get installments from installments_data first (new dynamic system)
    if (contract?.installments_data) {
      try {
        const installmentsData = typeof contract.installments_data === 'string'
          ? JSON.parse(contract.installments_data)
          : contract.installments_data;

        if (Array.isArray(installmentsData) && installmentsData.length > 0) {
          return installmentsData.map((installment, index) => {
            // Format due date with Arabic month names
            const formatArabicDate = (dateString: string): string => {
              if (!dateString) return '';

              const date = new Date(dateString);
              const arabicMonths = [
                'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
              ];

              const day = date.getDate();
              const month = arabicMonths[date.getMonth()];
              const year = date.getFullYear();

              return `${day} ${month} ${year}`;
            };

            return {
              number: index + 1,
              amount: formatArabicNumber(Number(installment.amount || 0)),
              description: installment.description || `الدفعة ${index + 1}`,
              paymentType: installment.paymentType || 'شهري',
              dueDate: installment.dueDate ? formatArabicDate(installment.dueDate) : '',
              currencySymbol: currencyInfo.symbol,
              currencyWrittenName: currencyInfo.writtenName
            };
          });
        }
      } catch (e) {
        console.warn('Failed to parse installments_data:', e);
      }
    }

    // ✅ FALLBACK: Use old payment columns if no installments_data
    const payment1 = contract?.['Payment 1'] || 0;
    const payment2 = contract?.['Payment 2'] || 0;
    const payment3 = contract?.['Payment 3'] || 0;

    if (payment1 > 0) {
      payments.push({
        number: 1,
        amount: formatArabicNumber(Number(payment1)),
        description: 'الدفعة الأولى',
        paymentType: 'عند التوقيع',
        dueDate: '',
        currencySymbol: currencyInfo.symbol,
        currencyWrittenName: currencyInfo.writtenName
      });
    }

    if (payment2 > 0) {
      payments.push({
        number: 2,
        amount: formatArabicNumber(Number(payment2)),
        description: 'الدفعة الثانية',
        paymentType: 'شهري',
        dueDate: '',
        currencySymbol: currencyInfo.symbol,
        currencyWrittenName: currencyInfo.writtenName
      });
    }

    if (payment3 > 0) {
      payments.push({
        number: 3,
        amount: formatArabicNumber(Number(payment3)),
        description: 'الدفعة الثالثة',
        paymentType: 'شهري',
        dueDate: '',
        currencySymbol: currencyInfo.symbol,
        currencyWrittenName: currencyInfo.writtenName
      });
    }

    return payments;
  };

  // ✅ REFACTORED: Get billboards data from various sources with installation images option
  const getBillboardsData = async () => {
    let billboardsToShow = [];

    // Try to get billboards from billboard_ids column
    const billboardIds = contract?.billboard_ids;
    if (billboardIds) {
      try {
        const idsArray = typeof billboardIds === 'string'
          ? billboardIds.split(',').map(id => id.trim()).filter(Boolean)
          : Array.isArray(billboardIds) ? billboardIds : [];

        if (idsArray.length > 0) {
          const { data: billboardsData, error } = await supabase
            .from('billboards')
            .select('*')
            .in('ID', idsArray);

          if (!error && billboardsData && billboardsData.length > 0) {
            billboardsToShow = billboardsData;

            // ✅ NEW: إذا كان useInstallationImages مفعل، جلب صور التركيب الفعلية
            if (useInstallationImages) {
              for (let billboard of billboardsToShow) {
                try {
                  const { data: installationData, error: installError } = await supabase
                    .from('installation_task_items')
                    .select('installed_image_face_a_url, installation_date')
                    .eq('billboard_id', billboard.ID)
                    .eq('status', 'completed')
                    .not('installed_image_face_a_url', 'is', null)
                    .order('installation_date', { ascending: false })
                    .limit(1)
                    .single();

                  if (!installError && installationData?.installed_image_face_a_url) {
                    console.log(`✅ استخدام صورة التركيب للوحة ${billboard.ID}:`, installationData.installed_image_face_a_url);
                    // ✅ FIX: Update both Image_URL and image_name to force the new image to be used
                    billboard.Image_URL = installationData.installed_image_face_a_url;
                    billboard.image_name = null; // Clear image_name so Image_URL is used
                    billboard.image = installationData.installed_image_face_a_url;
                  }
                } catch (error) {
                  console.warn(`فشل جلب صورة التركيب للوحة ${billboard.ID}:`, error);
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse billboard_ids:', e);
      }
    }

    // Fallback to existing billboards relation or saved data
    if (billboardsToShow.length === 0) {
      const dbRows: any[] = Array.isArray(contract?.billboards) ? contract.billboards : [];
      let srcRows: any[] = dbRows;
      if (!srcRows.length) {
        try {
          const saved = (contract as any)?.saved_billboards_data ?? (contract as any)?.billboards_data ?? '[]';
          const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
          if (Array.isArray(parsed)) srcRows = parsed;
        } catch (e) {
          console.warn('Failed to parse saved billboards data:', e);
        }
      }
      billboardsToShow = srcRows;
    }

    // تطبيق single_face_billboards: إذا كانت اللوحة محددة كوجه واحد، نعدّل Faces_Count
    const singleFaceRaw = (contract as any)?.single_face_billboards;
    if (singleFaceRaw) {
      try {
        const ids = typeof singleFaceRaw === 'string' ? JSON.parse(singleFaceRaw) : singleFaceRaw;
        if (Array.isArray(ids)) {
          const singleFaceSet = new Set(ids.map(String));
          billboardsToShow = billboardsToShow.map((b: any) => {
            const bId = String(b.ID || b.id || '');
            if (singleFaceSet.has(bId)) {
              return { ...b, Faces_Count: 1, faces_count: 1 };
            }
            return b;
          });
        }
      } catch { }
    }

    // Append paused billboards (kept in contract for record + showing pause date)
    try {
      const cn = (contract as any)?.Contract_Number ?? (contract as any)?.['Contract Number'];
      if (cn) {
        const { data: paused } = await supabase
          .from('paused_billboards' as any)
          .select('*')
          .eq('contract_number', Number(cn));
        if (Array.isArray(paused) && paused.length > 0) {
          // Fetch replacements for this contract
          const { data: replacements } = await supabase
            .from('paused_billboard_replacements' as any)
            .select('*')
            .eq('contract_number', Number(cn));
          const replByPausedId = new Map<string, any>();
          const replBillboardIds: number[] = [];
          (replacements || []).forEach((r: any) => {
            replByPausedId.set(String(r.paused_billboard_id), r);
            if (r.replacement_billboard_id) replBillboardIds.push(Number(r.replacement_billboard_id));
          });
          let replBbMap = new Map<string, any>();
          if (replBillboardIds.length > 0) {
            const { data: replBbs } = await supabase
              .from('billboards')
              .select('*')
              .in('ID', replBillboardIds);
            replBbMap = new Map((replBbs || []).map((b: any) => [String(b.ID), b]));
          }
          const pausedIds = paused.map((p: any) => p.billboard_id);
          const { data: pausedBbs } = await supabase
            .from('billboards')
            .select('*')
            .in('ID', pausedIds);
          const bbMap = new Map((pausedBbs || []).map((b: any) => [String(b.ID), b]));
          const existingIds = new Set(billboardsToShow.map((b: any) => String(b.ID || b.id || '')));
          // Compute contract discount % for fallback when net_rent is missing
          const rawDiscount = Number(
            (contract as any)?.discount ??
            (contract as any)?.discount_percent ??
            (contract as any)?.['Discount'] ?? 0
          );
          const totalRentForPct = Number(
            (contract as any)?.['Total Rent'] ?? (contract as any)?.rent_cost ?? 0
          );
          // If discount looks like an absolute amount (> 100 or > total rent), convert to %
          let contractDiscountPct = 0;
          if (rawDiscount > 0) {
            if (rawDiscount <= 100 && totalRentForPct > 0 && rawDiscount < totalRentForPct) {
              // Could be either; treat <=100 as percentage
              contractDiscountPct = rawDiscount;
            } else if (totalRentForPct > 0) {
              const beforeDiscount = totalRentForPct + rawDiscount;
              contractDiscountPct = beforeDiscount > 0 ? (rawDiscount / beforeDiscount) * 100 : 0;
            } else {
              contractDiscountPct = rawDiscount <= 100 ? rawDiscount : 0;
            }
          }

          // Build a map of billboardId → priceBeforeDiscount from the contract's
          // saved billboard_prices snapshot. This is the SAME source the selected
          // billboards use to render the strikethrough "before discount" price.
          const priceBeforeDiscountMap = new Map<string, number>();
          const netAfterDiscountMap = new Map<string, number>();
          try {
            const raw = (contract as any)?.billboard_prices;
            const arr = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
            if (Array.isArray(arr)) {
              arr.forEach((it: any) => {
                const id = String(it.billboardId ?? it.billboard_id ?? it.ID ?? it.id ?? '');
                if (!id) return;
                const before = Number(it.priceBeforeDiscount ?? it.basePriceBeforeDiscount ?? it.baseRental ?? 0);
                if (before > 0) priceBeforeDiscountMap.set(id, before);
                const after = Number(it.finalPrice ?? it.priceAfterDiscount ?? it.netRentalAfterDiscount ?? 0);
                if (after > 0) netAfterDiscountMap.set(id, after);
              });
            }
          } catch {}

          paused.forEach((p: any) => {
            const base = bbMap.get(String(p.billboard_id)) || {
              ID: p.billboard_id,
              Billboard_Name: p.billboard_name,
            };
            // Final price added to the contract for this paused billboard
            // = consumed_amount (the portion charged for the period before pause).
            // Falls back to (net_rent - refund_amount) for older rows, then to net_rent.
            const consumed = Number((p as any).consumed_amount);
            const netRent = Number((p as any).net_rent);
            const refund = Number((p as any).refund_amount);
            const originalPrice = Number((p as any).original_price);
            const fullPriceVal = Number((p as any).full_price);
            // ✅ NEW: dedicated columns persisted from PausedBillboardCard auto-sync
            const dbBefore = Number((p as any).price_before_discount);
            const dbNetAfter = Number((p as any).net_after_discount);
            const catalogPrice = Number((base as any).Price ?? (base as any).price ?? (base as any).rent ?? 0);
            const bbIdStr = String(p.billboard_id);
            const snapBefore = priceBeforeDiscountMap.get(bbIdStr) || 0;
            // ✅ Original price BEFORE any discount — prefer dedicated column, then
            // contract's saved snapshot, then catalog price, then legacy fields.
            const originalBeforeDiscount =
              (Number.isFinite(dbBefore) && dbBefore > 0) ? dbBefore :
              (snapBefore > 0) ? snapBefore :
              (Number.isFinite(catalogPrice) && catalogPrice > 0) ? catalogPrice :
              (Number.isFinite(originalPrice) && originalPrice > 0) ? originalPrice : 0;
            // Middle strikethrough = "Final Total" before pause (totalForBoard).
            // Prefer dedicated column, then contract snapshot's finalPrice,
            // then full_price, then derive from original×(1-discount%).
            const snapAfter = netAfterDiscountMap.get(bbIdStr) || 0;
            const netAfterContractDiscount =
              (Number.isFinite(dbNetAfter) && dbNetAfter > 0) ? dbNetAfter :
              (snapAfter > 0) ? snapAfter :
              (Number.isFinite(fullPriceVal) && fullPriceVal > 0) ? fullPriceVal :
              (Number.isFinite(netRent) && netRent > 0 && netRent !== originalBeforeDiscount) ? netRent :
              (originalBeforeDiscount > 0 && contractDiscountPct > 0
                ? originalBeforeDiscount * (1 - contractDiscountPct / 100)
                : 0);
            let pausedPrice = 0;
            if (Number.isFinite(consumed) && consumed > 0) {
              pausedPrice = consumed;
            } else if (Number.isFinite(fullPriceVal) && fullPriceVal > 0 && Number.isFinite(refund) && refund > 0) {
              pausedPrice = Math.max(0, fullPriceVal - refund);
            } else if (Number.isFinite(fullPriceVal) && fullPriceVal > 0) {
              pausedPrice = fullPriceVal;
            } else if (netAfterContractDiscount > 0) {
              pausedPrice = netAfterContractDiscount;
            }
            const pausedRowProps: any = {
              _paused: true,
              _pause_date: p.pause_date,
              _paused_price: pausedPrice > 0 ? pausedPrice : undefined,
              _paused_original_price: originalBeforeDiscount > 0 ? originalBeforeDiscount : undefined,
              _paused_net_price: netAfterContractDiscount > 0 ? netAfterContractDiscount : undefined,
              // Override end date with pause date so it shows in the end-date column
              Rent_End_Date: p.pause_date || (base as any).Rent_End_Date,
            };
            // If the paused billboard somehow still exists in billboard_ids
            // (legacy data), tag the existing row in-place so it shows the
            // "موقوفة" badge + paused price instead of duplicating.
            const existingPausedIdx = billboardsToShow.findIndex(
              (b: any) => String(b.ID || b.id || '') === String(p.billboard_id),
            );
            if (existingPausedIdx >= 0) {
              billboardsToShow[existingPausedIdx] = {
                ...billboardsToShow[existingPausedIdx],
                ...pausedRowProps,
              };
            } else {
              billboardsToShow.push({ ...base, ...pausedRowProps });
            }

            // Replacement: if the replacement billboard is already in the
            // selected list (new flow), tag the existing row with the
            // replacement metadata so the renderer shows the "بديلة" badge
            // and start-date without duplicating. Otherwise (legacy rows)
            // push a fresh row right after the paused one.
            const repl = replByPausedId.get(String(p.id));
            if (repl) {
              const replIdStr = String(repl.replacement_billboard_id);
              const existingIdx = billboardsToShow.findIndex(
                (b: any) => String(b.ID || b.id || '') === replIdStr,
              );
              if (existingIdx >= 0) {
                billboardsToShow[existingIdx] = {
                  ...billboardsToShow[existingIdx],
                  _replacement: true,
                  _replacement_start_date: repl.start_date,
                  _replacement_end_date: repl.end_date,
                  _replacement_allocated: Number(repl.allocated_amount) || 0,
                  _replacement_paused_name: base.Billboard_Name || p.billboard_name,
                  Rent_Start_Date: repl.start_date,
                  Rent_End_Date: repl.end_date,
                };
              } else {
                const replBb = replBbMap.get(replIdStr) || {
                  ID: repl.replacement_billboard_id,
                  Billboard_Name: repl.replacement_billboard_name,
                };
                billboardsToShow.push({
                  ...replBb,
                  _replacement: true,
                  _replacement_start_date: repl.start_date,
                  _replacement_end_date: repl.end_date,
                  _replacement_allocated: Number(repl.allocated_amount) || 0,
                  _replacement_paused_name: base.Billboard_Name || p.billboard_name,
                  Rent_Start_Date: repl.start_date,
                  Rent_End_Date: repl.end_date,
                });
              }
            }
          });

          // 🛡️ Safety net: ensure ANY row whose ID matches a replacement_billboard_id
          // is tagged, even if it didn't go through the paused loop above
          // (mismatched paused_id mapping, legacy data, etc.).
          const pausedNameById = new Map<string, string>(
            (paused || []).map((p: any) => [String(p.id), String(p.billboard_name || `#${p.billboard_id}`)]),
          );
          (replacements || []).forEach((r: any) => {
            const replIdStr = String(r.replacement_billboard_id);
            const pausedName = pausedNameById.get(String(r.paused_billboard_id)) || '';
            const idx = billboardsToShow.findIndex(
              (b: any) => String(b.ID || b.id || '') === replIdStr,
            );
            if (idx >= 0) {
              const existing: any = billboardsToShow[idx];
              if (!existing._replacement) {
                billboardsToShow[idx] = {
                  ...existing,
                  _replacement: true,
                  _replacement_start_date: r.start_date,
                  _replacement_end_date: r.end_date,
                  _replacement_allocated: Number(r.allocated_amount) || 0,
                  _replacement_paused_name: pausedName,
                  Rent_Start_Date: r.start_date,
                  Rent_End_Date: r.end_date,
                };
              } else if (!existing._replacement_paused_name && pausedName) {
                billboardsToShow[idx]._replacement_paused_name = pausedName;
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to append paused billboards:', e);
    }

    return billboardsToShow;
  };

  // ✅ REFACTORED: Get billboard prices from contract (FIXED: handle all possible key formats)
  const smartRoundPrintPrice = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    const roundedInt = Math.round(value);
    const nearestHundred = Math.round(roundedInt / 100) * 100;
    return Math.abs(roundedInt - nearestHundred) <= 6 ? nearestHundred : roundedInt;
  };

  const getBillboardPrices = () => {
    let billboardPrices: Record<string, number> = {};
    const sourcePrices = Array.isArray(liveBillboardPrices) && liveBillboardPrices.length > 0
      ? liveBillboardPrices
      : contract?.billboard_prices;

    // Check print/installation settings to determine extra vs included costs
    const includePrint = Boolean(
      contract?.include_print_in_billboard_price === true ||
      contract?.include_print_in_billboard_price === 1 ||
      contract?.include_print_in_billboard_price === 'true' ||
      contract?.include_print_in_billboard_price === '1'
    );
    const includeInstall = Boolean(
      contract?.include_installation_in_price === true ||
      contract?.include_installation_in_price === 1 ||
      contract?.include_installation_in_price === 'true' ||
      contract?.include_installation_in_price === '1'
    );
    const printCostEnabled = Boolean(
      contract?.print_cost_enabled === true ||
      contract?.print_cost_enabled === 1 ||
      contract?.print_cost_enabled === 'true' ||
      contract?.print_cost_enabled === '1'
    );
    const installationEnabled = Boolean(
      contract?.installation_enabled === true ||
      contract?.installation_enabled === 1 ||
      contract?.installation_enabled === 'true' ||
      contract?.installation_enabled === '1'
    );

    if (sourcePrices) {
      try {
        const pricesData = typeof sourcePrices === 'string'
          ? JSON.parse(sourcePrices)
          : sourcePrices;

        if (Array.isArray(pricesData)) {
          // ✅ FIX: Support multiple ID and price field names
          pricesData.forEach((item: any) => {
            const id = String(item.billboardId ?? item.billboard_id ?? item.ID ?? item.id ?? '');
            if (!id) return;

            // Try multiple price fields in order of preference
            const originalFinalPrice = item.finalPrice ?? item.netRentalAfterDiscount ?? item.priceAfterDiscount ??
              item.calculatedPrice ?? item.price ??
              item.contractPrice ?? item.priceBeforeDiscount ??
              item.billboard_rent_price ?? item.billboardPrice ?? 0;
            
            let price = Number(originalFinalPrice);

            // ✅ Dynamic recalculation to bypass database clamping bugs on older contracts
            const baseRental = Number(item.basePriceBeforeDiscount ?? item.baseRental ?? item.priceBeforeDiscount ?? item.contractPrice ?? 0);
            const discount = Number(item.discountPerBillboard ?? 0);
            const extraPrint = (printCostEnabled && !includePrint) ? Number(item.printCost ?? item.includedPrintCost ?? 0) : 0;
            const extraInstall = (installationEnabled && !includeInstall) ? Number(item.installationCost ?? item.includedInstallCost ?? 0) : 0;

            const recalculatedPrice = Math.max(0, baseRental - discount) + extraPrint + extraInstall;

            // If we have valid baseRental and discount fields, prefer the recalculated price
            if (item.basePriceBeforeDiscount !== undefined || item.baseRental !== undefined || item.priceBeforeDiscount !== undefined) {
              price = recalculatedPrice;
            }

            if (!Number.isNaN(price)) {
              const normalizedPrice = smartRoundPrintPrice(price);
              billboardPrices[id] = normalizedPrice;
              // Also store with number key if the ID is numeric
              if (!isNaN(Number(id))) {
                billboardPrices[Number(id)] = normalizedPrice;
              }
            }
          });
          console.log('✅ Loaded billboard prices (with dual keys):', billboardPrices);
        }
      } catch (e) {
        console.warn('Failed to parse billboard_prices:', e);
      }
    }
    return billboardPrices;
  };

  // Merge paused billboards' net_rent into the price map so print tables
  // show the same discounted rent as the billboard cards.
  const mergePausedPrices = (
    billboardPrices: Record<string, number>,
    billboardsToShow: any[]
  ): Record<string, number> => {
    if (!Array.isArray(billboardsToShow)) return billboardPrices;
    billboardsToShow.forEach((b: any) => {
      if (!b?._paused) return;
      const price = Number(b._paused_price);
      if (!Number.isFinite(price) || price <= 0) return;
      const id = String(b.ID ?? b.id ?? '');
      if (!id) return;
      const normalized = smartRoundPrintPrice(price);
      billboardPrices[id] = normalized;
      if (!isNaN(Number(id))) {
        (billboardPrices as any)[Number(id)] = normalized;
      }
    });
    return billboardPrices;
  };

  // ✅ Smart fallback: derive per-billboard price from Total Rent when billboard_prices is missing
  const getSmartFallbackPrice = (billboardId: string, billboard: any): number => {
    // First try: derive from Total Rent / billboard count
    const totalRent = Number(contract?.['Total Rent'] || contract?.rent_cost || 0);
    const billboardCount = contract?.billboards_count ||
      (contract?.billboard_ids ? String(contract.billboard_ids).split(',').filter(Boolean).length : 0);

    if (totalRent > 0 && billboardCount > 0) {
      const derivedPrice = totalRent / billboardCount;
      console.log(`⚠️ Smart fallback for billboard ${billboardId}: Total Rent (${totalRent}) / count (${billboardCount}) = ${derivedPrice}`);
      return derivedPrice;
    }

    // Last resort: billboard's catalog price
    const priceVal = billboard.Price ?? billboard.price ?? billboard.rent ?? billboard.Rent_Price ?? billboard.rent_cost ?? billboard['Total Rent'] ?? 0;
    const num = Number(priceVal);
    if (!isNaN(num) && num > 0) {
      console.warn(`⚠️ Last resort fallback for billboard ${billboardId}: using catalog price ${num}`);
      return num;
    }

    return 0;
  };

  // ✅ REFACTORED: Calculate billboard pricing with print cost (NO INSTALLATION COST)
  const calculateBillboardPricing = (billboardsToShow: any[], billboardPrices: any) => {
    const printCostEnabled = Boolean(
      contract?.print_cost_enabled === true ||
      contract?.print_cost_enabled === 1 ||
      contract?.print_cost_enabled === "true" ||
      contract?.print_cost_enabled === "1"
    );

    const printPricePerMeter = Number(contract?.print_price_per_meter || 0);
    console.log('Print cost settings:', { printCostEnabled, printPricePerMeter });

    const groupedBillboards = {};
    let subtotal = 0;

    billboardsToShow.forEach((billboard) => {
      const id = String(billboard.ID ?? billboard.id ?? billboard.code ?? '');
      const size = String(billboard.Size ?? billboard.size ?? 'غير محدد');
      const faces = Number(billboard.Faces ?? billboard.faces ?? billboard.Number_of_Faces ?? billboard.Faces_Count ?? billboard.faces_count ?? 1);

      // ✅ STEP 1: Get BASE RENT PRICE (without any print cost)
      let baseRentPrice = 0;
      const historicalPrice = billboardPrices[id];

      if (historicalPrice !== undefined && historicalPrice !== null && historicalPrice !== '') {
        const parsedPrice = Number(historicalPrice);
        if (!isNaN(parsedPrice)) {
          baseRentPrice = parsedPrice;
        }
      } else {
        // ✅ Smart fallback: derive from Total Rent / billboard count instead of catalog price
        baseRentPrice = getSmartFallbackPrice(id, billboard);
      }

      // ✅ STEP 2: Calculate PRINT COST based on faces and billboard size
      let printCostForBillboard = 0;
      if (printCostEnabled && printPricePerMeter > 0) {
        // Extract dimensions from size (e.g., "12×4" -> 12 * 4 = 48 square meters)
        const sizeMatch = size.match(/(\d+)×(\d+)/);
        if (sizeMatch) {
          const width = Number(sizeMatch[1]);
          const height = Number(sizeMatch[2]);
          const areaPerFace = width * height;
          // ✅ CRITICAL: Print cost = area per face × number of faces × price per meter
          printCostForBillboard = areaPerFace * faces * printPricePerMeter;
          console.log(`✅ Billboard ${id}: ${width}×${height} = ${areaPerFace}m² × ${faces} faces × ${printPricePerMeter}/m² = ${printCostForBillboard} print cost`);
        }
      }

      // ✅ STEP 3: TOTAL PRICE = BASE RENT + PRINT COST (NO INSTALLATION COST)
      const totalPricePerBillboard = baseRentPrice + printCostForBillboard;

      console.log(`✅ Billboard ${id} Final Calculation:`);
      console.log(`   - Base rent: ${baseRentPrice}`);
      console.log(`   - Print cost: ${printCostForBillboard} (${faces} faces)`);
      console.log(`   - Total: ${totalPricePerBillboard}`);

      // ✅ STEP 4: Group by size AND faces for proper display
      const groupKey = `${size}_${faces}وجه`;
      subtotal += totalPricePerBillboard;

      if (!groupedBillboards[groupKey]) {
        groupedBillboards[groupKey] = {
          size: size,
          faces: faces,
          billboardCount: 0,
          unitPrice: totalPricePerBillboard, // This includes rent + print cost only
          totalPrice: 0,
          baseRentPrice: baseRentPrice,
          printCostPerUnit: printCostForBillboard
        };
      }

      // Count billboards (each billboard = 1)
      groupedBillboards[groupKey].billboardCount += 1;
      groupedBillboards[groupKey].totalPrice += totalPricePerBillboard;
    });


    return { groupedBillboards: Object.values(groupedBillboards), subtotal };
  };

  // ✅ Helper: build unified invoice data for all 3 functions
  const buildContractInvoiceData = async (opts?: { autoPrint?: boolean }): Promise<{ html: string }> => {
    const contractDetails = calculateContractDetails();
    const currencyInfo = getCurrencyInfo();
    const discountInfo = getDiscountInfo();

    const billboardsToShow = await getBillboardsData();
    const billboardPrices = getBillboardPrices();
      mergePausedPrices(billboardPrices, billboardsToShow);
    const { groupedBillboards, subtotal: billboardSubtotal } = calculateBillboardPricing(billboardsToShow, billboardPrices);

    const contractTotal = Number(contract?.Total ?? contract?.total_cost ?? 0);
    const operatingFee = Number(contract?.fee ?? 0);
    const rentCost = Number(contract?.['Total Rent'] ?? contract?.rent_cost ?? billboardSubtotal);
    const installationCost = Number(contract?.installation_cost ?? 0);
    const printCost = Number(contract?.print_cost ?? 0);

    // contractTotal (from Contract.Total) already includes the operating fee,
    // so only add operatingFee when falling back to component-based calculation
    const subtotal = contractTotal > 0 ? contractTotal : rentCost + installationCost + printCost;
    const grandTotal = contractTotal > 0 ? contractTotal : subtotal + operatingFee;

    let discountAmount = 0;
    if (discountInfo) {
      discountAmount = discountInfo.type === 'percentage'
        ? (rentCost * discountInfo.value / 100)
        : discountInfo.value;
    }

    const totalBillboards = groupedBillboards.reduce((sum: number, item: any) => sum + (item.billboardCount || 0), 0);
    const invoiceDate = new Date().toLocaleDateString('ar-LY');
    const invoiceNumber = `INV-${contract?.id || Date.now()}`;
    const printCostEnabled = Boolean(
      contract?.print_cost_enabled === true || contract?.print_cost_enabled === 1 ||
      contract?.print_cost_enabled === "true" || contract?.print_cost_enabled === "1"
    );

    const invoiceData: ContractInvoiceData = {
      invoiceNumber,
      invoiceDate,
      contractId: contract?.id || 'غير محدد',
      customerName: customerData.name,
      customerCompany: customerData.company,
      customerPhone: customerData.phone,
      contractStartDate: contractDetails.startDate,
      contractEndDate: contractDetails.endDate,
      contractDuration: contractDetails.duration,
      currencySymbol: currencyInfo.symbol,
      currencyWrittenName: currencyInfo.writtenName,
      items: groupedBillboards as any[],
      totalBillboards: totalBillboards as number,
      grandTotal,
      discountInfo,
      discountAmount,
      rentCost,
      operatingFee: operatingFee > 0 ? operatingFee : undefined,
      printCostEnabled,
      autoPrint: opts?.autoPrint,
    };

    const html = await generateContractInvoiceHTML(invoiceData);
    return { html };
  };

  // ✅ Preview Invoice
  const handlePreviewInvoice = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للمعاينة');
      return;
    }
    setIsGenerating(true);
    try {
      const { html } = await buildContractInvoiceData();
      setPreviewHTML(html);
      setPreviewTitle(`معاينة فاتورة العقد ${contract?.id}`);
      setPreviewOpen(true);
      toast.success('تم تحضير معاينة الفاتورة');
    } catch (error) {
      console.error('Error in handlePreviewInvoice:', error);
      toast.error('حدث خطأ أثناء تحضير معاينة الفاتورة');
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ Download Invoice PDF
  const handleDownloadInvoicePDF = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل لتحميل PDF');
      return;
    }
    setIsGenerating(true);
    try {
      toast.info('جاري إنشاء ملف PDF للفاتورة...');
      const { html } = await buildContractInvoiceData();

      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '210mm';
      iframe.style.height = '297mm';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('فشل في إنشاء iframe');

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      await new Promise((resolve) => {
        if (iframe.contentWindow) {
          iframe.contentWindow.addEventListener('load', () => setTimeout(resolve, 1500));
        } else {
          setTimeout(resolve, 1500);
        }
      });

      const fileName = `فاتورة_عقد_${contract?.id}_${new Date().toISOString().slice(0, 10)}`;
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `${fileName}.pdf`,
        image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false, backgroundColor: '#ffffff', foreignObjectRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as 'portrait', compress: true }
      };

      await html2pdf().set(opt).from(iframeDoc.body).save();
      document.body.removeChild(iframe);
      toast.success('تم تحميل ملف PDF للفاتورة بنجاح!');
    } catch (error) {
      console.error('Error in handleDownloadInvoicePDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء إنشاء PDF: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ Print Invoice
  const handlePrintInvoice = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للطباعة');
      return;
    }
    setIsGenerating(true);
    try {
      const { html } = await buildContractInvoiceData();
      const invoiceTitle = await buildDescriptiveTitle('فاتورة');
      openPrintDirectly(html, { title: invoiceTitle, autoPrint: false });
      toast.success(`تم فتح فاتورة العقد للطباعة بنجاح!`);
      if (printMode === 'auto') {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error in handlePrintInvoice:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير الفاتورة للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ REFACTORED: Contract printing function (NO INSTALLATION COST)
  const handlePrintContract = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للطباعة');
      return;
    }

    setIsGenerating(true);

    try {
      const contractDetails = calculateContractDetails();
      const paymentInstallments = getPaymentInstallments();
      const year = contract?.['Contract Date'] ? new Date(contract['Contract Date']).getFullYear() : (contract?.start_date ? new Date(contract.start_date).getFullYear() : new Date().getFullYear());
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();

      // ✅ Check if this is an offer (not a contract)
      // Use regex to match standalone "عرض" or "عرض سعر" at start, not inside words like "معرض"
      const adTypeValue = contract?.['Ad Type'] || contract?.ad_type || '';
      const isOfferByAdType = /^عرض(\s|سعر|$)/.test(adTypeValue.trim());
      const isOffer = contract?.is_offer === true ||
        isOfferByAdType ||
        !contract?.Contract_Number ||
        contract?.offer_number;

      // Extract all contract data automatically (NO INSTALLATION COST)
      const contractData = {
        contractNumber: isOffer ? (contract?.offer_number || contract?.id || '') : (contract?.id || contract?.Contract_Number || ''),
        customerName: customerData.name,
        customerCompany: customerData.company || '',
        customerPhone: customerData.phone || '',
        adType: contract?.ad_type || contract?.['Ad Type'] || (isOffer ? 'عرض سعر' : 'عقد إيجار لوحات إعلانية'),
        startDate: contractDetails.startDate,
        endDate: contractDetails.endDate,
        finalTotal: contractDetails.finalTotal,
        rentalCost: contractDetails.rentalCost,
        duration: contractDetails.duration,
        year: year.toString(),
        companyName: '',
        phoneNumber: '',
        payments: paymentInstallments,
        currencyInfo: currencyInfo,
        discountInfo: discountInfo,
 isOffer: isOffer // Flag to indicate if this is an offer
      };

      // Get billboards data
      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();
      mergePausedPrices(billboardPrices, billboardsToShow);

      const norm = (b: any) => {
        const id = String(b.ID ?? b.id ?? b.code ?? '');

        // ✅ FIX: Enhanced image handling - prioritize updated installation images
        let image = '';
        // First check if billboard has an updated image (from installation_task_items)
        if (b.image) {
          image = String(b.image);
        } else if (b.Image_URL) {
          image = String(b.Image_URL);
        } else {
          // Fall back to image_name if no direct URL
          const imageName = b.image_name || b.Image_Name;
          const imageUrl = b.billboard_image || b.imageUrl || b.img;
          image = imageName ? `/image/${imageName}` : (imageUrl || '');
        }

        const municipality = String(b.Municipality ?? b.municipality ?? b.city ?? '');
        const district = String(b.District ?? b.district ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.landmark ?? '');
        const size = String(b.Size ?? b.size ?? '');
        const level = String(b.Level ?? b.level ?? b.Category_Level ?? b.category_level ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b.Faces_Count ?? b.faces_count ?? '1');

        // ✅ FIX: Use historical price from billboard_prices column with proper ID matching
        let price = '';

        // الحصول على السعر قبل الخصم من بيانات العقد إن وجد
        let originalPriceBeforeDiscount: number | null = null;
        try {
          if (contract?.billboard_prices) {
            const pricesData = typeof contract.billboard_prices === 'string'
              ? JSON.parse(contract.billboard_prices)
              : contract.billboard_prices;
            if (Array.isArray(pricesData)) {
              const priceItem = pricesData.find((item: any) => String(item.billboardId) === id);
              if (priceItem && priceItem.priceBeforeDiscount != null) {
                originalPriceBeforeDiscount = Number(priceItem.priceBeforeDiscount);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse billboard_prices for original price:', e);
        }
        // For paused billboards, use the captured original (full) price as "before discount"
        if ((b as any)._paused && (originalPriceBeforeDiscount == null || originalPriceBeforeDiscount <= 0)) {
          const op = Number((b as any)._paused_original_price);
          if (Number.isFinite(op) && op > 0) originalPriceBeforeDiscount = op;
        }

        // Try to get price using different ID formats
        const historicalPrice = billboardPrices[id] ?? billboardPrices[Number(id)];

        if (historicalPrice !== undefined && historicalPrice !== null && String(historicalPrice) !== '') {
          const num = Number(historicalPrice);
          if (!isNaN(num) && num > 0) {
            // ✅ FIXED: إظهار السعر قبل الخصم فقط إذا كان مختلفاً عن السعر النهائي
            if (originalPriceBeforeDiscount && originalPriceBeforeDiscount > 0 && originalPriceBeforeDiscount !== num) {
              // السعر قبل الخصم مختلف عن السعر النهائي - اعرض كلاهما
              price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">${formatArabicNumber(num)}</span> <span class=\"currency\">${currencyInfo.symbol}</span><br/><span class=\"original-price\" style=\"font-size:8px;\">(قبل الخصم: <span class=\"num\">${formatArabicNumber(originalPriceBeforeDiscount)}</span> <span class=\"currency\">${currencyInfo.symbol}</span>)</span></span>`;
            } else {
              // السعر قبل الخصم مساوي للسعر النهائي أو غير موجود - اعرض السعر فقط
              price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">${formatArabicNumber(num)}</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
            }
            console.log(`✅ Using historical price for billboard ${id}: ${num} ${currencyInfo.symbol}`);
          } else {
            price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">0</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
            console.warn(`⚠️ Invalid historical price for billboard ${id}: ${historicalPrice}`);
          }
        } else {
          // ✅ Smart fallback: derive from Total Rent / billboard count
          const fallbackPrice = getSmartFallbackPrice(id, b);
          if (fallbackPrice > 0) {
            price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">${formatArabicNumber(fallbackPrice)}</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
          } else {
            price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">0</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
          }
        }

        // ✅ FIX: Use same logic as ContractTermsSettings preview
        const rent_end_date = getBillboardRentEndDate(b, contractDetails.endDate || '');

        // ✅ FIX: مدة اللوحات تعتمد على تواريخ العقد (المصدر الوحيد للحقيقة)
        // لا نعتمد على Days_Count المخزن في جدول اللوحات لأنه قد لا يتزامن بعد تعديل مدة العقد
        const duration_days = contractDetails.duration || '';

        // باقي الحقول
        let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : (b.GPS_Link || '');
        const billboardName = String(b.Billboard_Name || '');

        const _replacement = !!(b as any)._replacement;
        const _replacement_start_date = (b as any)._replacement_start_date || '';
        const _replacement_paused_name = (b as any)._replacement_paused_name || '';
        return { id, billboardName, image, municipality, district, landmark, size, level, faces, price, rent_end_date, duration_days, mapLink, _replacement, _replacement_start_date, _replacement_paused_name };
      };

      // ربط كل لوحة ببيانات الترتيب (المقاس ثم البلدية ثم المستوى)
      const normalized = billboardsToShow.map(norm);
      const normalizedWithSortRanks = normalized.map((billboard) => {
        const sizeObj = sizesData.find(sz => sz.name === billboard.size);
        const municipalityObj = municipalitiesData.find(m => m.name === billboard.municipality);
        const levelObj = levelsData.find(l => l.level_code === billboard.level);
        return {
          ...billboard,
          size_order: sizeObj ? sizeObj.sort_order ?? 999 : 999,
          municipality_order: municipalityObj ? municipalityObj.sort_order ?? 999 : 999,
          level_order: levelObj ? levelObj.sort_order ?? 999 : 999,
        };
      });
      // ترتيب اللوحات: المقاس أولاً، ثم البلدية، ثم المستوى
      const sortedBillboards = normalizedWithSortRanks.sort((a, b) => {
        if (a.size_order !== b.size_order) return a.size_order - b.size_order;
        if (a.municipality_order !== b.municipality_order) return a.municipality_order - b.municipality_order;
        return a.level_order - b.level_order;
      });
      const ROWS_PER_PAGE = templateSettings.tableSettings.maxRows || 12;

      // تحويل اللوحات إلى صيغة BillboardRowData للاستخدام مع المُعالج المشترك
      const billboardRowData: BillboardRowData[] = sortedBillboards.map(b => ({
        id: b.id,
        billboardName: b.billboardName,
        image: b.image,
        municipality: b.municipality,
        district: b.district,
        landmark: b.landmark,
        size: b.size,
        level: b.level,
        faces: b.faces,
        price: b.price,
        rent_end_date: b.rent_end_date,
        duration_days: b.duration_days,
        mapLink: b.mapLink,
        isReplacement: (b as any)._replacement,
        replacementStartDate: (b as any)._replacement_start_date,
        replacedBillboardName: (b as any)._replacement_paused_name,
      }));

      // ✅ Native Chrome Pagination: Let the table flow naturally across pages.
      // No JS pagination - Chrome's print engine handles page breaks better than any JS measurement.
      const tablePagesHtml = sortedBillboards.length
        ? (() => {
          // Generate a SINGLE page container with ALL rows - Chrome will auto-paginate
          const allRowsHtml = renderBillboardsTablePage({
            settings: templateSettings,
            billboards: billboardRowData,
            tableBgUrl,
            pageIndex: 0,
            rowsPerPage: billboardRowData.length, // ALL rows in one table
            showTableTerm: true,
          });

          return allRowsHtml;
        })()
        : '';

      // ✅ FIXED: Check if print cost is enabled correctly - read from database
      const printCostEnabled = Boolean(
        contract?.print_cost_enabled === true ||
        contract?.print_cost_enabled === 1 ||
        contract?.print_cost_enabled === "true" ||
        contract?.print_cost_enabled === "1"
      );

      console.log('Print cost enabled check:', {
        raw_value: contract?.print_cost_enabled,
        type: typeof contract?.print_cost_enabled,
        enabled: printCostEnabled
      });

      // ✅ استخدام النسخة النظيفة للطباعة SVG
      const paymentsHtml = formatPaymentsSummaryPlain(contract?.installments_data, currencyInfo.symbol, currencyInfo.writtenName);

      // ✅ عنوان وصفي للعقد
      const pdfTitle = await buildDescriptiveTitle();

      // ✅ FIXED: Enhanced HTML content with proper A4 dimensions and layout
      // ✅ CRITICAL FIX: Use dir="ltr" on HTML to avoid SVG coordinate conflicts
      // SVG elements handle text direction internally via text-anchor and explicit positioning
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="ltr" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <base href="${window.location.origin}/" />
          <title>${pdfTitle}</title>
          <style>
            /* Enhanced font loading with fallbacks */
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700;900&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');

            @font-face { 
              font-family: 'Doran'; 
              src: url('${window.location.origin}/Doran-Regular.otf') format('opentype'); 
              font-weight: 400; 
              font-style: normal; 
              font-display: swap; 
            }
            @font-face { 
              font-family: 'Doran'; 
              src: url('${window.location.origin}/Doran-Bold.otf') format('opentype'); 
              font-weight: 700; 
              font-style: normal; 
              font-display: swap; 
            }

            @page { size: A4; margin: 0; }

            /* ✅ FIXED: Proper A4 page setup with ltr for SVG compatibility */
            * { 
              margin: 0 !important; 
              padding: 0 !important; 
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            html, body { 
              width: 100% !important; 
              min-height: 100vh;
              margin: 0 !important;
              padding: 0 !important;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
              direction: ltr; 
              background: #181b22; 
              color: #000; 
              font-size: 14px;
              line-height: 1.6;
              -webkit-font-smoothing: antialiased;
              text-rendering: optimizeLegibility;
            }

            /* ✅ Native Chrome Print Pagination - NO scaling, NO JS pagination */
            @media print {
              html, body {
                width: 210mm !important;
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
              }
            }
            
            .template-container { 
              position: relative; 
              width: 210mm !important; 
              height: 297mm;
              display: block; 
              page-break-inside: avoid;
              page-break-after: always;
            }

            .template-container:last-child,
            .page:last-child {
              page-break-after: avoid !important;
            }

            /* ✅ For the FIRST page (contract terms) - fixed height */
            .template-container.first-page {
              height: 297mm !important;
              overflow: hidden;
            }

            /* ✅ For TABLE pages - allow natural height flow for Chrome pagination */
            .template-container.table-page {
              overflow: hidden;
              page-break-after: avoid;
            }
            
            .template-image { 
              position: absolute; 
              top: 0; 
              left: 0; 
              width: 210mm !important; 
              height: 297mm !important; 
              object-fit: cover; 
              object-position: center; 
              z-index: 1; 
              display: block; 
            }
            
            .overlay-svg { 
              position: absolute; 
              top: 0; 
              left: 0; 
              width: 210mm !important; 
              height: 297mm !important; 
              z-index: 10; 
              pointer-events: none; 
            }
            
            .page { 
              position: relative;
              width: 210mm !important;
              min-height: 297mm;
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            /* ✅ NATIVE CHROME PRINT PAGINATION for tables */
            .table-area { 
              position: relative; /* NOT absolute - allow natural flow */
              width: 100%;
              z-index: 20; 
            }
            
            .btable { 
              width: 100% !important; 
              border-collapse: collapse; 
              border-spacing: 0; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
              table-layout: fixed !important;
            }

            /* ✅ Chrome native table pagination */
            .btable thead {
              display: table-header-group !important; /* Repeat header on each page */
            }

            .btable tbody {
              display: table-row-group !important;
            }

            .btable tr {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            
            .btable th {
              vertical-align: middle;
            }
            
            .btable td { 
              vertical-align: middle; 
              white-space: normal; 
              word-break: break-word; 
              overflow: hidden; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
            }

            @media print {
              .btable thead {
                display: table-header-group !important;
              }
              .btable tr {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
              .table-area {
                position: relative !important;
              }
            }
            
            .btable tr { 
              /* height is set inline */
            }
            
            .btable th {
              vertical-align: middle;
            }
            
            .btable td { 
              vertical-align: middle; 
              white-space: normal; 
              word-break: break-word; 
              overflow: hidden; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
            }
            
            /* QR code styling */
            .qr-code-cell {
              padding: 1mm !important;
              cursor: pointer;
            }
            
            .qr-code-cell img {
              width: 11mm;
              height: 11mm;
              display: block;
              margin: 0 auto;
              cursor: pointer;
            }
            
            .c-img img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              object-position: center;
              border: none;
              border-radius: 0;
              display: block;
              background: none;
            }

            .btable td.c-img {
              width: 15.5mm;
              height: 15.5mm;
              padding: 0;
              overflow: hidden;
            }

            .btable td.c-img img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              object-position: center;
              display: block;
            }

            .c-num { 
              text-align: center; 
              font-weight: 700; 
            }
            
            .btable a { 
              color: #004aad; 
              text-decoration: none; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
            }

            /* Dynamic clause positioning - now controlled via template settings */
            .dynamic-clause {
              position: absolute;
              left: 20mm;
              right: 13mm;
              z-index: 15;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
              color: #000;
              text-align: right;
              direction: rtl;
              line-height: 1.6;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }

            .clause-header {
              font-weight: 800 !important;
            }

            .clause-content {
              font-weight: 400 !important;
            }

            /* ✅ FIXED: CSS positioning for right-aligned Arabic text with proper bidi handling */
            .right-aligned-text {
              position: absolute;
              right: 13mm;
              z-index: 15;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
              color: #000;
              text-align: right;
              direction: rtl;
              unicode-bidi: plaintext;
            }

            /* ✅ FIX: Proper handling for mixed RTL/LTR content */
            .ltr-text {
              direction: ltr;
              unicode-bidi: embed;
              display: inline;
            }

            /* ✅ FIX: Phone numbers and English text should be LTR in RTL context */
            .phone-number, .english-text {
              direction: ltr;
              unicode-bidi: isolate;
              display: inline;
            }

            /* ✅ Ensure all table colors print correctly */
            table, thead, tbody, tr, th, td {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            th, td {
              background-color: inherit !important;
            }

            /* ✅ FIXED: Proper print media queries */
            @media print {
              html, body { 
                width: 210mm !important; 
                min-height: 297mm !important; 
                height: auto !important; 
                margin: 0 !important; 
                padding: 0 !important; 
                overflow: visible !important; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
                color-adjust: exact;
              }
              
              .template-container { 
                width: 210mm !important; 
                height: 297mm !important; 
                position: relative !important; 
                page-break-inside: avoid;
                page-break-after: always;
              }
              .template-container:last-child,
              .page:last-child {
                page-break-after: avoid !important;
              }
              
              .template-image, .overlay-svg { 
                width: 210mm !important; 
                height: 297mm !important; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
                color-adjust: exact;
              }
              
              .page { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
                color-adjust: exact;
                page-break-inside: avoid;
              }

              .btable tr:nth-of-type(12n) {
                page-break-after: always;
              }
              
              @page { 
                size: A4 portrait; 
                margin: 0 !important; 
                padding: 0 !important; 
              }
            }
            
            /* Loading and error handling */
            .loading-message {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: rgba(0,0,0,0.8);
              color: white;
              padding: 20px;
              border-radius: 5px;
              z-index: 1000;
              font-family: 'Noto Sans Arabic', Arial, sans-serif;
            }
          </style>
        </head>
        <body>
          <div id="loadingMessage" class="loading-message">جاري تحميل ${contractData.isOffer ? 'العرض' : 'العقد'}...</div>
          
          <div class="template-container first-page page">
            <img src="${templateBgUrl}" alt="${contractData.isOffer ? 'عرض سعر' : 'عقد إيجار لوحات إعلانية'}" class="template-image" 
                 onerror="console.warn('Failed to load contract template image')" />
                   onerror="console.warn('Failed to load contract template image')" />
            <svg class="overlay-svg" viewBox="0 0 2480 3508" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
              ${templateSettings.header.visible ? `
              <text x="${templateSettings.header.x}" y="${templateSettings.header.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.header.fontSize}" fill="#000" text-anchor="${templateSettings.header.textAlign || 'end'}" dominant-baseline="middle" style="direction: rtl; text-align: right">${contractData.isOffer ? `عرض سعر رقم: ${contractData.contractNumber} - صالح لمدة 24 ساعة` : `عقد إيجار مواقع إعلانية رقم: ${contractData.contractNumber} سنة ${contractData.year}`}</text>
              ` : ''}
               ${templateSettings.date.visible ? `
               <text x="${templateSettings.date.x}" y="${templateSettings.date.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.date.fontSize}" fill="#000" text-anchor="middle" dominant-baseline="middle">التاريخ: ${contractData.startDate}</text>
               <text x="${templateSettings.date.x}" y="${templateSettings.date.y + (templateSettings.date.fontSize || 42) * 1.3}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.date.fontSize}" fill="#000" text-anchor="middle" dominant-baseline="middle">الموافق: ${(() => { try { const rawDate = contract?.start_date || contract?.['Contract Date']; const d = rawDate ? new Date(rawDate) : new Date(); if (isNaN(d.getTime())) return ''; const f = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { calendar: 'islamic-umalqura', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Tripoli' }).format(d); return f.includes('هـ') ? f : f + ' هـ'; } catch { return ''; } })()}</text>
               ` : ''}
               
               ${templateSettings.adType?.visible ? `
               <text x="${templateSettings.adType.x}" y="${templateSettings.adType.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.adType.fontSize}" fill="#1a1a2e" text-anchor="start" dominant-baseline="middle" direction="rtl" style="unicode-bidi: plaintext;">نوع الإعلان: ${contractData.adType || 'غير محدد'}</text>
               ` : ''}

               ${templateSettings.firstParty.visible ? `
               <text x="${templateSettings.firstParty.x}" y="${templateSettings.firstParty.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.firstParty.fontSize + 4}" fill="#000" text-anchor="${templateSettings.firstParty.textAlign || 'end'}" dominant-baseline="middle">الطرف الأول: ${templateSettings.firstPartyData.companyName}، ${templateSettings.firstPartyData.address}</text>
               <text x="${templateSettings.firstParty.x}" y="${templateSettings.firstParty.y + (templateSettings.firstParty.lineSpacing || 50)}" font-family="Doran, sans-serif" font-size="${templateSettings.firstParty.fontSize}" fill="#000" text-anchor="${templateSettings.firstParty.textAlign || 'end'}" dominant-baseline="middle">${templateSettings.firstPartyData.representative}</text>
               ` : ''}
              
              ${contractTerms.length > 0 ? (() => {
          let currentY = templateSettings.termsStartY;
          const termsX = templateSettings.termsStartX;
          const termsWidth = templateSettings.termsWidth || 2000;
          const charsPerLine = Math.floor(termsWidth / 28);
          const lineHeight = 55;
          const goldLineSettings = templateSettings.termsGoldLine || { visible: true, heightPercent: 30, color: '#D4AF37' };

          // دالة لتقسيم النص إلى أسطر لتقدير الارتفاع الكلي للبند
          const wrapText = (text: string, maxChars: number): string[] => {
            const words = text.split(' ');
            const lines: string[] = [];
            let currentLine = '';

            words.forEach((word) => {
              if ((currentLine + ' ' + word).length > maxChars) {
                if (currentLine) lines.push(currentLine.trim());
                currentLine = word;
              } else {
                currentLine += ' ' + word;
              }
            });

            if (currentLine) lines.push(currentLine.trim());
            return lines;
          };

          // دالة لاستبدال المتغيرات في محتوى البند
          const discountInfo = getDiscountInfo();
          const discountText = discountInfo ? `بعد خصم ${discountInfo.display} ${currencyInfo.writtenName}` : '';

          const replaceVariables = (text: string): string => {
            const installationEnabled = contract?.installation_enabled !== false && contract?.installation_enabled !== 0;
            const printCostEnabled = Boolean(
              contract?.print_cost_enabled === true ||
              contract?.print_cost_enabled === 1 ||
              contract?.print_cost_enabled === "true" ||
              contract?.print_cost_enabled === "1"
            );
            const inclusionParts: string[] = [];
            if (installationEnabled) { inclusionParts.push('شامل التركيب'); } else { inclusionParts.push('غير شامل التركيب'); }
            if (printCostEnabled) { inclusionParts.push('شامل الطباعة'); } else { inclusionParts.push('غير شامل الطباعة'); }
            const inclusionText = inclusionParts.join(' و');

            let result = text
              .replace(/{duration}/g, contractData.duration)
              .replace(/{startDate}/g, contractData.startDate)
              .replace(/{endDate}/g, contractData.endDate)
              .replace(/{customerName}/g, contractData.customerName)
              .replace(/{contractNumber}/g, contractData.contractNumber)
              .replace(/{totalAmount}/g, contractDetails.finalTotal)
              .replace(/{discount}/g, discountText)
              .replace(/{currency}/g, currencyInfo.writtenName)
              .replace(/{billboardsCount}/g, String(sortedBillboards.length))
              .replace(/{inclusionText}/g, inclusionText)
              .replace(/{payments}/g, paymentsHtml);

            result = result.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
            return result;
          };

          return contractTerms.map((term) => {
            const termY = currentY;
            const fontSize = term.font_size || 42;

            const titleText = term.term_title + ':';
            const contentText = replaceVariables(term.term_content);
            const fullText = titleText + ' ' + contentText;
            
            // تقدير الارتفاع بناء على عدد الأسطر
            const contentLines = wrapText(fullText, charsPerLine);
            const termHeight = contentLines.length * lineHeight;

            // تحديث موقع البند التالي
            currentY = termY + termHeight + (templateSettings.termsSpacing || 40);

            const goldColor = goldLineSettings.color || '#D4AF37';
            const titleWeight = templateSettings.termsTitleWeight || 'bold';
            const contentWeight = templateSettings.termsContentWeight || 'normal';

            const foX = termsX - termsWidth;

            // بناء خلفية الخط الذهبي خلف العنوان فقط (بنسبة ارتفاع ديناميكية)
            const heightPercent = goldLineSettings.heightPercent || 30;
            const insetPercent = (100 - heightPercent) / 2;
            const goldHighlight = goldLineSettings.visible 
              ? `<span style="position: absolute; inset: ${insetPercent}% 0 ${insetPercent}% 0; background-color: ${goldColor}; z-index: -1; border-radius: 2px; width: 100%;"></span>`
              : '';

            const titleSpan = `<span style="position: relative; display: inline-block; z-index: 1; margin-left: 6px;">
              ${goldHighlight}
              <span style="position: relative; z-index: 2; font-weight: ${titleWeight === 'bold' || titleWeight === '800' ? 800 : 700}; padding: 0 4px;">${titleText}</span>
            </span>`;

            // استخدام text-align: justify لجعل نهايات السطور متوازنة وعلى نفس المستوى
            const htmlContent = `
              <div xmlns="http://www.w3.org/1999/xhtml" style="direction: rtl; text-align: justify; text-justify: inter-word; font-family: Doran, 'Noto Sans Arabic', sans-serif; font-size: ${fontSize}px; line-height: ${lineHeight}px; color: #000; font-weight: ${contentWeight === 'bold' ? 'bold' : 'normal'};">
                ${titleSpan}${contentText}
              </div>
            `;

            return `<foreignObject x="${foX}" y="${termY}" width="${termsWidth}" height="${termHeight + 10}">
              ${htmlContent}
            </foreignObject>`;
          }).join('');
        })() : ''}

              ${templateSettings.secondParty.visible ? `
               <text x="${templateSettings.secondParty.x}" y="${templateSettings.secondParty.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.secondParty.fontSize + 4}" fill="#000" text-anchor="${templateSettings.secondParty.textAlign || 'end'}" dominant-baseline="middle" direction="rtl">الطرف الثاني، ${wrapSvgLTRRuns(contractData.customerCompany || contractData.customerName)}</text>
               <text x="${templateSettings.secondParty.x}" y="${templateSettings.secondParty.y + 50}" font-family="Doran, sans-serif" font-size="${templateSettings.secondParty.fontSize}" fill="#000" text-anchor="${templateSettings.secondParty.textAlign || 'end'}" dominant-baseline="middle" direction="rtl">يمثلها السيد ${wrapSvgLTRRuns(contractData.customerName)}${contractData.customerCompany ? ` (${wrapSvgLTRRuns(contractData.customerCompany)})` : ''} - هاتف: <tspan direction="ltr" unicode-bidi="embed">${contractData.customerPhone || 'غير محدد'}</tspan></text>
              ` : ''}
            </svg>
          </div>

          ${tablePagesHtml}
        </body>
        </html>
      `;

      const printWindow = preparePrintWindow(pdfTitle);
      writePrintWindow(printWindow, htmlContent, { title: pdfTitle, autoPrint: false });

      toast.success(`تم فتح العقد للطباعة بنجاح بعملة ${currencyInfo.name}!`);

      // Only close dialog if in auto mode
      if (printMode === 'auto') {
        onOpenChange(false);
      }

    } catch (error) {
      console.error('Error in handlePrintContract:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير العقد للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ Preview Contract HTML before PDF generation using generateUnifiedPrintHTML
  const handlePreviewContract = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للمعاينة');
      return;
    }

    setIsGenerating(true);
    try {
      toast.info('جاري تحضير معاينة العقد...');

      const contractDetails = calculateContractDetails();
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();
      const year = contract?.['Contract Date'] ? new Date(contract['Contract Date']).getFullYear() : (contract?.start_date ? new Date(contract.start_date).getFullYear() : new Date().getFullYear());

      const adTypeValue = contract?.['Ad Type'] || contract?.ad_type || '';
      const isOfferByAdType = /^عرض(\s|سعر|$)/.test(adTypeValue.trim());
      const isOffer = contract?.is_offer === true ||
        isOfferByAdType ||
        !contract?.Contract_Number ||
        contract?.offer_number;

      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();
      mergePausedPrices(billboardPrices, billboardsToShow);

      const normalizedBillboards: UnifiedBillboardData[] = billboardsToShow.map((b: any) => 
        mapBillboardForPrint(b, billboardPrices)
      );

      const sortedBillboards = normalizedBillboards.sort((a, b) => {
        const sizeA = sizesData.find(s => s.name === a.size)?.sort_order ?? 999;
        const sizeB = sizesData.find(s => s.name === b.size)?.sort_order ?? 999;
        if (sizeA !== sizeB) return sizeA - sizeB;
        const munA = municipalitiesData.find(m => m.name === a.municipality)?.sort_order ?? 999;
        const munB = municipalitiesData.find(m => m.name === b.municipality)?.sort_order ?? 999;
        return munA - munB;
      });

      const printCostEnabled = Boolean(
        contract?.print_cost_enabled === true ||
        contract?.print_cost_enabled === 1 ||
        contract?.print_cost_enabled === "true" ||
        contract?.print_cost_enabled === "1"
      );

      const installationEnabled = contract?.installation_enabled !== false && contract?.installation_enabled !== 0;
      const paymentsSummary = formatPaymentsSummary(contract?.installments_data, currencyInfo.symbol, currencyInfo.writtenName);
      const paymentsText = `${paymentsSummary.replace(/<br>/g, ' ')}`;

      const unifiedTerms: UnifiedContractTerm[] = contractTerms.map(t => ({
        id: t.id,
        term_title: t.term_title,
        term_content: t.term_content,
        term_order: t.term_order,
        is_active: t.is_active,
        font_size: t.font_size,
      }));

      const billboardsCount = contract?.billboards_count || (contract?.billboard_ids ? contract.billboard_ids.split(',').length : sortedBillboards.length);
      const rawStartDate = contract?.start_date || contract?.['Contract Date'] || '';

      const htmlContent = await generateUnifiedPrintHTML({
        settings: templateSettings,
        contractData: {
          contractNumber: isOffer ? (contract?.offer_number || contract?.id || '') : (contract?.id || contract?.Contract_Number || ''),
          yearlyCode: await getYearlyCode(),
          year: year.toString(),
          startDate: contractDetails.startDate,
          endDate: contractDetails.endDate,
          rawStartDate,
          duration: contractDetails.duration,
          customerName: customerData.name,
          customerCompany: customerData.company || '',
          customerPhone: customerData.phone || '',
          isOffer,
          adType: contract?.ad_type || contract?.['Ad Type'] || (isOffer ? 'عرض سعر' : 'عقد إيجار'),
          billboardsCount,
          currencyName: currencyInfo.name,
        },
        terms: unifiedTerms,
        billboards: sortedBillboards,
        templateBgUrl: templateBgUrl,
        noStampBgUrl: !withStamp ? configuredNoStampBgUrl : undefined,
        tableBgUrl: tableBgUrl,
        noStampTableBgUrl: !withStamp ? configuredNoStampTableBgUrl : undefined,
        currencyInfo: {
          symbol: currencyInfo.symbol,
          writtenName: currencyInfo.writtenName,
        },
        contractDetails: {
          finalTotal: contractDetails.finalTotal,
          rentalCost: contractDetails.rentalCost,
          installationCost: contractDetails.installationCost,
          duration: contractDetails.duration,
          discount: discountInfo ? `بعد خصم ${discountInfo.text}` : '',
          installationEnabled: installationEnabled,
          printCostEnabled: printCostEnabled,
        },
        paymentsHtml: paymentsText,
        renderTarget: 'preview',
      });

      setPreviewHTML(htmlContent);
      const descriptiveTitle = await buildDescriptiveTitle();
      setPreviewTitle(descriptiveTitle);
      setPreviewOpen(true);
      toast.success('تم تحضير معاينة العقد');

    } catch (error) {
      console.error('Error in handlePreviewContract:', error);
      toast.error('حدث خطأ أثناء تحضير معاينة العقد');
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ UNIFIED: Download Contract PDF using generateUnifiedPrintHTML (same as WhatsApp & Print)
  const handleDownloadContractPDF = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للتحميل');
      return;
    }

    setIsGenerating(true);

    try {
      toast.info('جاري إنشاء ملف PDF للعقد...');

      // ===== استخدام نفس منطق handleSendContractWhatsApp بالكامل =====
      const contractDetails = calculateContractDetails();
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();
      const year = contract?.['Contract Date'] ? new Date(contract['Contract Date']).getFullYear() : (contract?.start_date ? new Date(contract.start_date).getFullYear() : new Date().getFullYear());

      const adTypeValue = contract?.['Ad Type'] || contract?.ad_type || '';
      const isOfferByAdType = /^عرض(\s|سعر|$)/.test(adTypeValue.trim());
      const isOffer = contract?.is_offer === true ||
        isOfferByAdType ||
        !contract?.Contract_Number ||
        contract?.offer_number;

      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();
      mergePausedPrices(billboardPrices, billboardsToShow);

      const normalizedBillboards: UnifiedBillboardData[] = billboardsToShow.map((b: any) => 
        mapBillboardForPrint(b, billboardPrices)
      );

      const sortedBillboards = normalizedBillboards.sort((a, b) => {
        const sizeA = sizesData.find(s => s.name === a.size)?.sort_order ?? 999;
        const sizeB = sizesData.find(s => s.name === b.size)?.sort_order ?? 999;
        if (sizeA !== sizeB) return sizeA - sizeB;
        const munA = municipalitiesData.find(m => m.name === a.municipality)?.sort_order ?? 999;
        const munB = municipalitiesData.find(m => m.name === b.municipality)?.sort_order ?? 999;
        return munA - munB;
      });

      const printCostEnabled = Boolean(
        contract?.print_cost_enabled === true ||
        contract?.print_cost_enabled === 1 ||
        contract?.print_cost_enabled === "true" ||
        contract?.print_cost_enabled === "1"
      );

      const installationEnabled = contract?.installation_enabled !== false && contract?.installation_enabled !== 0;
      const paymentsSummary = formatPaymentsSummary(contract?.installments_data, currencyInfo.symbol, currencyInfo.writtenName);
      const paymentsText = `${paymentsSummary.replace(/<br>/g, ' ')}`;

      const unifiedTerms: UnifiedContractTerm[] = contractTerms.map(t => ({
        id: t.id,
        term_title: t.term_title,
        term_content: t.term_content,
        term_order: t.term_order,
        is_active: t.is_active,
        font_size: t.font_size,
      }));

      const billboardsCount = contract?.billboards_count || (contract?.billboard_ids ? contract.billboard_ids.split(',').length : sortedBillboards.length);
      const rawStartDate = contract?.start_date || contract?.['Contract Date'] || '';

      const htmlContent = await generateUnifiedPrintHTML({
        settings: templateSettings,
        contractData: {
          contractNumber: isOffer ? (contract?.offer_number || contract?.id || '') : (contract?.id || contract?.Contract_Number || ''),
          yearlyCode: await getYearlyCode(),
          year: year.toString(),
          startDate: contractDetails.startDate,
          endDate: contractDetails.endDate,
          rawStartDate,
          duration: contractDetails.duration,
          customerName: customerData.name,
          customerCompany: customerData.company || '',
          customerPhone: customerData.phone || '',
          isOffer,
          adType: contract?.ad_type || contract?.['Ad Type'] || (isOffer ? 'عرض سعر' : 'عقد إيجار'),
          billboardsCount,
          currencyName: currencyInfo.name,
        },
        terms: unifiedTerms,
        billboards: sortedBillboards,
        templateBgUrl: templateBgUrl,
        noStampBgUrl: !withStamp ? configuredNoStampBgUrl : undefined,
        tableBgUrl: tableBgUrl,
        noStampTableBgUrl: !withStamp ? configuredNoStampTableBgUrl : undefined,
        currencyInfo: {
          symbol: currencyInfo.symbol,
          writtenName: currencyInfo.writtenName,
        },
        contractDetails: {
          finalTotal: contractDetails.finalTotal,
          rentalCost: contractDetails.rentalCost,
          installationCost: contractDetails.installationCost,
          duration: contractDetails.duration,
          discount: discountInfo ? `بعد خصم ${discountInfo.text}` : '',
          installationEnabled: installationEnabled,
          printCostEnabled: printCostEnabled,
        },
        paymentsHtml: paymentsText,
        renderTarget: 'pdf',
      });

      // ======= فتح نافذة طباعة جديدة =======
      // ======= تحويل HTML إلى PDF تلقائياً باستخدام html2canvas + jsPDF =======
      const DESIGN_W_PX = 2480;
      const DESIGN_H_PX = 3508;

      const iframe = document.createElement('iframe');
      iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${DESIGN_W_PX}px;height:auto;border:none;visibility:hidden;`;
      document.body.appendChild(iframe);

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error('Failed to create iframe document');

        iframeDoc.open();
        const cleanHtml = htmlContent.replace(/<script[\s\S]*?<\/script>/gi, '');
        iframeDoc.write(cleanHtml);
        iframeDoc.close();

        const overrideStyle = iframeDoc.createElement('style');
        overrideStyle.innerHTML = `
          html {
            width: ${DESIGN_W_PX}px !important;
            max-width: ${DESIGN_W_PX}px !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          body {
            width: ${DESIGN_W_PX}px !important;
            max-width: ${DESIGN_W_PX}px !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .print-page {
            width: ${DESIGN_W_PX}px !important;
            height: ${DESIGN_H_PX}px !important;
            max-width: none !important;
            max-height: none !important;
            overflow: hidden !important;
          }
          .print-page .contract-preview-container,
          .contract-preview-container {
            transform: none !important;
            zoom: 1 !important;
            -webkit-transform: none !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: auto !important;
            width: ${DESIGN_W_PX}px !important;
            height: ${DESIGN_H_PX}px !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .template-container, .print-page {
            display: block !important;
            page-break-after: always !important;
            break-after: page !important;
          }
        `;
        iframeDoc.head.appendChild(overrideStyle);

        await new Promise<void>((resolve) => {
          let doneOnce = false;
          const done = () => {
            if (doneOnce) return;
            doneOnce = true;
            resolve();
          };
          if (iframe.contentWindow) {
            iframe.contentWindow.addEventListener('load', done, { once: true });
          }
          setTimeout(done, 3000);
        });

        try { await (iframeDoc as any).fonts?.ready; } catch { }

        // Wait for images
        const images = Array.from(iframeDoc.getElementsByTagName('img'));
        await Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            });
          })
        );

        // Collect pages
        let pageElements = Array.from(iframeDoc.querySelectorAll('.print-page')) as HTMLElement[];
        if (pageElements.length === 0) {
          pageElements = Array.from(iframeDoc.querySelectorAll('.template-container')) as HTMLElement[];
        }
        if (pageElements.length === 0) {
          throw new Error('لم يتم العثور على صفحات العقد داخل القالب');
        }

        const { jsPDF: JSPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;

        const pdf = new JSPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const A4_W_MM = 210;
        const A4_H_MM = 297;

        for (let i = 0; i < pageElements.length; i++) {
          const page = pageElements[i];
          const renderTarget = (page.querySelector('.contract-preview-container') as HTMLElement | null) || page;

          renderTarget.style.width = `${DESIGN_W_PX}px`;
          renderTarget.style.height = `${DESIGN_H_PX}px`;
          renderTarget.style.overflow = 'visible';
          renderTarget.style.display = 'block';
          renderTarget.style.transform = 'none';
          renderTarget.style.zoom = '1';

          const canvas = await html2canvas(renderTarget, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            foreignObjectRendering: false,
            width: DESIGN_W_PX,
            height: DESIGN_H_PX,
            windowWidth: DESIGN_W_PX,
            windowHeight: DESIGN_H_PX,
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.98);
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, A4_H_MM);

          // Add clickable QR code link annotations for table pages (i > 0)
          if (i > 0) {
            const qrLinks = renderTarget.querySelectorAll('a[href]');
            qrLinks.forEach((link) => {
              const href = link.getAttribute('href');
              if (!href) return;
              const rect = link.getBoundingClientRect();
              const containerRect = renderTarget.getBoundingClientRect();
              // Convert pixel position to mm on A4
              const xMm = ((rect.left - containerRect.left) / DESIGN_W_PX) * A4_W_MM;
              const yMm = ((rect.top - containerRect.top) / DESIGN_H_PX) * A4_H_MM;
              const wMm = (rect.width / DESIGN_W_PX) * A4_W_MM;
              const hMm = (rect.height / DESIGN_H_PX) * A4_H_MM;
              if (wMm > 0 && hMm > 0) {
                pdf.link(xMm, yMm, wMm, hMm, { url: href });
              }
            });
          }
        }

        // حفظ PDF تلقائياً بالاسم الوصفي
        const descriptiveTitle = await buildDescriptiveTitle();
        const pdfFileName = descriptiveTitle.replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
        pdf.save(pdfFileName);

        toast.success('تم تحميل ملف PDF بنجاح');
        onOpenChange(false);
      } finally {
        document.body.removeChild(iframe);
      }

    } catch (error) {
      console.error('Error downloading contract PDF:', error);
      toast.error('حدث خطأ أثناء تحميل العقد: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ Send contract via WhatsApp with PDF upload to Google Drive
  // Uses the SAME HTML generation logic as handleDownloadContractPDF to avoid blank PDFs
  const handleSendContractWhatsApp = async () => {
    if (!customerData?.phone) {
      toast.error('لا يوجد رقم هاتف للزبون');
      return;
    }

    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل');
      return;
    }

    try {
      setIsGenerating(true);
      toast.info('جاري تحضير العقد وإرساله عبر واتساب...');

      // ===== استخدام نفس منطق handleUnifiedPrint بالكامل =====
      const contractDetails = calculateContractDetails();
      const paymentInstallments = getPaymentInstallments();
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();
      const year = contract?.['Contract Date'] ? new Date(contract['Contract Date']).getFullYear() : (contract?.start_date ? new Date(contract.start_date).getFullYear() : new Date().getFullYear());

      const adTypeValue = contract?.['Ad Type'] || contract?.ad_type || '';
      const isOfferByAdType = /^عرض(\s|سعر|$)/.test(adTypeValue.trim());
      const isOffer = contract?.is_offer === true ||
        isOfferByAdType ||
        !contract?.Contract_Number ||
        contract?.offer_number;

      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();
      mergePausedPrices(billboardPrices, billboardsToShow);

      const normalizedBillboards: UnifiedBillboardData[] = billboardsToShow.map((b: any) => 
        mapBillboardForPrint(b, billboardPrices)
      );

      const sortedBillboards = normalizedBillboards.sort((a, b) => {
        const sizeA = sizesData.find(s => s.name === a.size)?.sort_order ?? 999;
        const sizeB = sizesData.find(s => s.name === b.size)?.sort_order ?? 999;
        if (sizeA !== sizeB) return sizeA - sizeB;
        const munA = municipalitiesData.find(m => m.name === a.municipality)?.sort_order ?? 999;
        const munB = municipalitiesData.find(m => m.name === b.municipality)?.sort_order ?? 999;
        return munA - munB;
      });

      const printCostEnabled = Boolean(
        contract?.print_cost_enabled === true ||
        contract?.print_cost_enabled === 1 ||
        contract?.print_cost_enabled === "true" ||
        contract?.print_cost_enabled === "1"
      );

      const installationEnabled = contract?.installation_enabled !== false && contract?.installation_enabled !== 0;
      const paymentsSummary = formatPaymentsSummary(contract?.installments_data, currencyInfo.symbol, currencyInfo.writtenName);
      const paymentsText = `${paymentsSummary.replace(/<br>/g, ' ')}`;

      const unifiedTerms: UnifiedContractTerm[] = contractTerms.map(t => ({
        id: t.id,
        term_title: t.term_title,
        term_content: t.term_content,
        term_order: t.term_order,
        is_active: t.is_active,
        font_size: t.font_size,
      }));

      const billboardsCount = contract?.billboards_count || (contract?.billboard_ids ? contract.billboard_ids.split(',').length : sortedBillboards.length);
      const rawStartDate = contract?.start_date || contract?.['Contract Date'] || '';

      const htmlContent = await generateUnifiedPrintHTML({
        settings: templateSettings,
        contractData: {
          contractNumber: isOffer ? (contract?.offer_number || contract?.id || '') : (contract?.id || contract?.Contract_Number || ''),
          yearlyCode: await getYearlyCode(),
          year: year.toString(),
          startDate: contractDetails.startDate,
          endDate: contractDetails.endDate,
          rawStartDate,
          duration: contractDetails.duration,
          customerName: customerData.name,
          customerCompany: customerData.company || '',
          customerPhone: customerData.phone || '',
          isOffer,
          adType: contract?.ad_type || contract?.['Ad Type'] || (isOffer ? 'عرض سعر' : 'عقد إيجار'),
          billboardsCount,
          currencyName: currencyInfo.name,
        },
        terms: unifiedTerms,
        billboards: sortedBillboards,
        templateBgUrl: templateBgUrl,
        noStampBgUrl: !withStamp ? configuredNoStampBgUrl : undefined,
        tableBgUrl: tableBgUrl,
        noStampTableBgUrl: !withStamp ? configuredNoStampTableBgUrl : undefined,
        currencyInfo: {
          symbol: currencyInfo.symbol,
          writtenName: currencyInfo.writtenName,
        },
        contractDetails: {
          finalTotal: contractDetails.finalTotal,
          rentalCost: contractDetails.rentalCost,
          installationCost: contractDetails.installationCost,
          duration: contractDetails.duration,
          discount: discountInfo ? `بعد خصم ${discountInfo.text}` : '',
          installationEnabled: installationEnabled,
          printCostEnabled: printCostEnabled,
        },
        paymentsHtml: paymentsText,
        renderTarget: 'pdf',
      });

      // تحويل HTML إلى PDF ورفعه إلى Google Drive — التقاط كل صفحة منفصلة
      const iframe = document.createElement('iframe');
      // العرض يطابق دقة التصميم الأصلية (2480px) حتى يعمل html2canvas بدون تصغير
      const DESIGN_W_PX = 2480;
      const DESIGN_H_PX = 3508;
      iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${DESIGN_W_PX}px;height:auto;border:none;visibility:hidden;`;
      document.body.appendChild(iframe);
      let pdfBlob: Blob;

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error('Failed to create iframe document');

        iframeDoc.open();
        const cleanHtmlWA = htmlContent.replace(/<script[\s\S]*?<\/script>/gi, '');
        iframeDoc.write(cleanHtmlWA);
        iframeDoc.close();

        const overrideStyle = iframeDoc.createElement('style');
        overrideStyle.innerHTML = `
          html {
            width: ${DESIGN_W_PX}px !important;
            max-width: ${DESIGN_W_PX}px !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          body {
            width: ${DESIGN_W_PX}px !important;
            max-width: ${DESIGN_W_PX}px !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .print-page {
            width: ${DESIGN_W_PX}px !important;
            height: ${DESIGN_H_PX}px !important;
            max-width: none !important;
            max-height: none !important;
            overflow: hidden !important;
          }
          .print-page .contract-preview-container,
          .contract-preview-container {
            transform: none !important;
            zoom: 1 !important;
            -webkit-transform: none !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: auto !important;
            width: ${DESIGN_W_PX}px !important;
            height: ${DESIGN_H_PX}px !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .template-container, .print-page {
            display: block !important;
            page-break-after: always !important;
            break-after: page !important;
          }
        `;
        iframeDoc.head.appendChild(overrideStyle);

        await new Promise<void>((resolve) => {
          let doneOnce = false;
          const done = () => {
            if (doneOnce) return;
            doneOnce = true;
            resolve();
          };
          if (iframe.contentWindow) {
            iframe.contentWindow.addEventListener('load', done, { once: true });
          }
          setTimeout(done, 3000);
        });

        try { await (iframeDoc as any).fonts?.ready; } catch { }

        // Wait for images inside the iframe
        const images = Array.from(iframeDoc.getElementsByTagName('img'));
        await Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            });
          })
        );

        // Collect all pages — support both .print-page (new) and .template-container (legacy)
        let pageElements = Array.from(
          iframeDoc.querySelectorAll('.print-page')
        ) as HTMLElement[];
        if (pageElements.length === 0) {
          pageElements = Array.from(
            iframeDoc.querySelectorAll('.template-container')
          ) as HTMLElement[];
        }

        if (pageElements.length === 0) {
          throw new Error('لم يتم العثور على صفحات العقد داخل القالب');
        }

        // Use html2canvas for each page separately, then stitch into jsPDF
        const { jsPDF: JSPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;

        const pdf = new JSPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const A4_W_MM = 210;
        const A4_H_MM = 297;

        for (let i = 0; i < pageElements.length; i++) {
          const page = pageElements[i];
          const renderTarget = (page.querySelector('.contract-preview-container') as HTMLElement | null) || page;

          renderTarget.style.width = `${DESIGN_W_PX}px`;
          renderTarget.style.height = `${DESIGN_H_PX}px`;
          renderTarget.style.overflow = 'visible';
          renderTarget.style.display = 'block';
          renderTarget.style.transform = 'none';
          renderTarget.style.zoom = '1';

          const canvas = await html2canvas(renderTarget, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            foreignObjectRendering: false,
            width: DESIGN_W_PX,
            height: DESIGN_H_PX,
            windowWidth: DESIGN_W_PX,
            windowHeight: DESIGN_H_PX,
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.98);

          if (i > 0) {
            pdf.addPage();
          }

          pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, A4_H_MM);

          // Add clickable QR code link annotations for table pages (i > 0)
          if (i > 0) {
            const qrLinks = renderTarget.querySelectorAll('a[href]');
            qrLinks.forEach((link) => {
              const href = link.getAttribute('href');
              if (!href) return;
              const rect = link.getBoundingClientRect();
              const containerRect = renderTarget.getBoundingClientRect();
              const xMm = ((rect.left - containerRect.left) / DESIGN_W_PX) * A4_W_MM;
              const yMm = ((rect.top - containerRect.top) / DESIGN_H_PX) * A4_H_MM;
              const wMm = (rect.width / DESIGN_W_PX) * A4_W_MM;
              const hMm = (rect.height / DESIGN_H_PX) * A4_H_MM;
              if (wMm > 0 && hMm > 0) {
                pdf.link(xMm, yMm, wMm, hMm, { url: href });
              }
            });
          }
        }

        pdfBlob = pdf.output('blob');
      } finally {
        document.body.removeChild(iframe);
      }

      // تحويل blob إلى base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(pdfBlob);
      });
      const base64Data = await base64Promise;

      // رفع PDF إلى Google Drive
      const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
      const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
      const progress = createUploadProgressTracker();
      const descriptiveTitle = await buildDescriptiveTitle();
      const pdfFileName = descriptiveTitle.replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
      const contractNumber = contract?.Contract_Number || contract?.id || '';
      const pdfUrl = await uploadFileToGoogleDrive(base64Data, pdfFileName, 'application/pdf', 'contracts', false, progress);

      // إرسال رسالة واتساب مع رابط PDF
      const message = `مرحباً ${customerData.name}،\n\nنرسل لك عقد رقم ${contractNumber}.\n\nرابط العقد:\n${pdfUrl}\n\nيرجى مراجعة العقد المرفق.\n\nشكراً لك.`;

      // فتح واتساب مباشرة مع الرابط
      const phone = customerData.phone.replace(/[^0-9+]/g, '');
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      toast.success('تم رفع العقد وفتح واتساب بنجاح');
    } catch (error) {
      console.error('Error sending contract via WhatsApp:', error);
      toast.error('حدث خطأ أثناء إرسال العقد: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ Upload contract PDF to Google Drive (without WhatsApp)
  const handleUploadContractToDrive = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للرفع');
      return;
    }

    try {
      setIsGenerating(true);
      // using isGenerating as loading indicator
      toast.info('جاري رفع العقد إلى Google Drive...');

      // نفس منطق handleSendContractWhatsApp لتوليد PDF
      const contractDetails = calculateContractDetails();
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();
      const year = contract?.['Contract Date'] ? new Date(contract['Contract Date']).getFullYear() : (contract?.start_date ? new Date(contract.start_date).getFullYear() : new Date().getFullYear());
      const adTypeValue = contract?.['Ad Type'] || contract?.ad_type || '';
      const isOfferByAdType = /^عرض(\s|سعر|$)/.test(adTypeValue.trim());
      const isOffer = contract?.is_offer === true || isOfferByAdType || !contract?.Contract_Number || contract?.offer_number;

      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();
      mergePausedPrices(billboardPrices, billboardsToShow);

      const normalizedBillboards: UnifiedBillboardData[] = billboardsToShow.map((b: any) => 
        mapBillboardForPrint(b, billboardPrices)
      );

      const sortedBillboards = normalizedBillboards.sort((a, b) => {
        const sizeA = sizesData.find(s => s.name === a.size)?.sort_order ?? 999;
        const sizeB = sizesData.find(s => s.name === b.size)?.sort_order ?? 999;
        if (sizeA !== sizeB) return sizeA - sizeB;
        const munA = municipalitiesData.find(m => m.name === a.municipality)?.sort_order ?? 999;
        const munB = municipalitiesData.find(m => m.name === b.municipality)?.sort_order ?? 999;
        return munA - munB;
      });

      const printCostEnabled = Boolean(contract?.print_cost_enabled === true || contract?.print_cost_enabled === 1 || contract?.print_cost_enabled === "true" || contract?.print_cost_enabled === "1");
      const installationEnabled = contract?.installation_enabled !== false && contract?.installation_enabled !== 0;
      const paymentsSummary = formatPaymentsSummary(contract?.installments_data, currencyInfo.symbol, currencyInfo.writtenName);
      const paymentsText = `${paymentsSummary.replace(/<br>/g, ' ')}`;
      const unifiedTerms: UnifiedContractTerm[] = contractTerms.map(t => ({ id: t.id, term_title: t.term_title, term_content: t.term_content, term_order: t.term_order, is_active: t.is_active, font_size: t.font_size }));
      const billboardsCount = contract?.billboards_count || (contract?.billboard_ids ? contract.billboard_ids.split(',').length : sortedBillboards.length);
      const rawStartDate = contract?.start_date || contract?.['Contract Date'] || '';

      const htmlContent = await generateUnifiedPrintHTML({
        settings: templateSettings,
        contractData: {
          contractNumber: isOffer ? (contract?.offer_number || contract?.id || '') : (contract?.id || contract?.Contract_Number || ''),
          yearlyCode: await getYearlyCode(), year: year.toString(),
          startDate: contractDetails.startDate, endDate: contractDetails.endDate, rawStartDate,
          duration: contractDetails.duration,
          customerName: customerData.name, customerCompany: customerData.company || '', customerPhone: customerData.phone || '',
          isOffer, adType: contract?.ad_type || contract?.['Ad Type'] || (isOffer ? 'عرض سعر' : 'عقد إيجار'),
          billboardsCount, currencyName: currencyInfo.name,
        },
        terms: unifiedTerms, billboards: sortedBillboards,
        templateBgUrl: templateBgUrl,
        noStampBgUrl: !withStamp ? configuredNoStampBgUrl : undefined,
        tableBgUrl: tableBgUrl,
        noStampTableBgUrl: !withStamp ? configuredNoStampTableBgUrl : undefined,
        currencyInfo: { symbol: currencyInfo.symbol, writtenName: currencyInfo.writtenName },
        contractDetails: {
          finalTotal: contractDetails.finalTotal, rentalCost: contractDetails.rentalCost,
          installationCost: contractDetails.installationCost, duration: contractDetails.duration,
          discount: discountInfo ? `بعد خصم ${discountInfo.text}` : '',
          installationEnabled, printCostEnabled,
        },
        paymentsHtml: paymentsText,
        renderTarget: 'pdf',
      });

      // توليد PDF
      const DESIGN_W_PX = 2480;
      const DESIGN_H_PX = 3508;
      const iframe = document.createElement('iframe');
      iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${DESIGN_W_PX}px;height:auto;border:none;visibility:hidden;`;
      document.body.appendChild(iframe);

      let pdfBlob: Blob;
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error('Failed to create iframe document');
        iframeDoc.open();
        iframeDoc.write(htmlContent.replace(/<script[\s\S]*?<\/script>/gi, ''));
        iframeDoc.close();

        const overrideStyle = iframeDoc.createElement('style');
        overrideStyle.innerHTML = `
          html, body { width: ${DESIGN_W_PX}px !important; max-width: ${DESIGN_W_PX}px !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          .print-page { width: ${DESIGN_W_PX}px !important; height: ${DESIGN_H_PX}px !important; max-width: none !important; max-height: none !important; overflow: hidden !important; }
          .print-page .contract-preview-container, .contract-preview-container { transform: none !important; zoom: 1 !important; position: absolute !important; top: 0 !important; left: 0 !important; width: ${DESIGN_W_PX}px !important; height: ${DESIGN_H_PX}px !important; max-width: none !important; }
          .template-container, .print-page { display: block !important; page-break-after: always !important; }
        `;
        iframeDoc.head.appendChild(overrideStyle);

        await new Promise<void>((resolve) => { let done = false; const fin = () => { if (done) return; done = true; resolve(); }; if (iframe.contentWindow) iframe.contentWindow.addEventListener('load', fin, { once: true }); setTimeout(fin, 3000); });
        try { await (iframeDoc as any).fonts?.ready; } catch { }
        const images = Array.from(iframeDoc.getElementsByTagName('img'));
        await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); })));

        let pageElements = Array.from(iframeDoc.querySelectorAll('.print-page')) as HTMLElement[];
        if (pageElements.length === 0) pageElements = Array.from(iframeDoc.querySelectorAll('.template-container')) as HTMLElement[];
        if (pageElements.length === 0) throw new Error('لم يتم العثور على صفحات العقد');

        const { jsPDF: JSPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;
        const pdf = new JSPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const A4_W_MM = 210, A4_H_MM = 297;

        for (let i = 0; i < pageElements.length; i++) {
          const page = pageElements[i];
          const renderTarget = (page.querySelector('.contract-preview-container') as HTMLElement | null) || page;
          renderTarget.style.width = `${DESIGN_W_PX}px`;
          renderTarget.style.height = `${DESIGN_H_PX}px`;
          renderTarget.style.overflow = 'visible';
          renderTarget.style.display = 'block';
          renderTarget.style.transform = 'none';
          renderTarget.style.zoom = '1';

          const canvas = await html2canvas(renderTarget, { scale: 2, useCORS: true, allowTaint: true, logging: false, backgroundColor: '#ffffff', foreignObjectRendering: false, width: DESIGN_W_PX, height: DESIGN_H_PX, windowWidth: DESIGN_W_PX, windowHeight: DESIGN_H_PX });
          const imgData = canvas.toDataURL('image/jpeg', 0.98);
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, A4_H_MM);
        }

        pdfBlob = pdf.output('blob');
      } finally {
        document.body.removeChild(iframe);
      }

      // تحويل وإرسال
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => { reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.readAsDataURL(pdfBlob); });

      const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
      const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
      const progress = createUploadProgressTracker();
      const descriptiveTitle = await buildDescriptiveTitle();
      const pdfFileName = descriptiveTitle.replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
      const pdfUrl = await uploadFileToGoogleDrive(base64Data, pdfFileName, 'application/pdf', 'contracts', false, progress);

      toast.success('تم رفع العقد إلى Google Drive بنجاح');
      console.log('📁 Contract uploaded to Drive:', pdfUrl);
    } catch (error) {
      console.error('Error uploading contract to Drive:', error);
      toast.error('حدث خطأ أثناء رفع العقد: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
      // done
    }
  };

  // ✅ NEW: Send invoice via WhatsApp
  const handleSendInvoiceWhatsApp = async () => {
    if (!customerData?.phone) {
      toast.error('لا يوجد رقم هاتف للزبون');
      return;
    }

    try {
      setIsGenerating(true);

      const contractData = {
        contractNumber: contract?.Contract_Number || contract?.id || '',
        customerName: customerData?.name || contract?.customer_name || '',
      };

      const message = `مرحباً،\n\nنرسل لك ملف PDF للفاتورة الخاصة بالعقد رقم ${contractData.contractNumber}.\n\nشكراً لك.`;

      const success = await sendMessage({
        phone: customerData.phone,
        message: message
      });

      if (success) {
        toast.success('تم إرسال الفاتورة عبر واتساب بنجاح');
      }
    } catch (error) {
      console.error('Error sending invoice via WhatsApp:', error);
      toast.error('حدث خطأ أثناء إرسال الفاتورة');
    } finally {
      setIsGenerating(false);
    }
  };


  // ✅ NEW: Unified Print - يستخدم نفس بنية المعاينة من إعدادات القالب
  const handleUnifiedPrint = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للطباعة');
      return;
    }

    setIsGenerating(true);

    try {
      const contractDetails = calculateContractDetails();
      const paymentInstallments = getPaymentInstallments();
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();
      const year = contract?.['Contract Date'] ? new Date(contract['Contract Date']).getFullYear() : (contract?.start_date ? new Date(contract.start_date).getFullYear() : new Date().getFullYear());

      // ✅ Use regex to match standalone "عرض" or "عرض سعر" at start, not inside words like "معرض"
      const adTypeValue = contract?.['Ad Type'] || contract?.ad_type || '';
      const isOfferByAdType = /^عرض(\s|سعر|$)/.test(adTypeValue.trim());
      const isOffer = contract?.is_offer === true ||
        isOfferByAdType ||
        !contract?.Contract_Number ||
        contract?.offer_number;

      // Get billboards data
      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();
      mergePausedPrices(billboardPrices, billboardsToShow);

      // Normalize billboards
      const normalizedBillboards: UnifiedBillboardData[] = billboardsToShow.map((b: any) => 
        mapBillboardForPrint(b, billboardPrices)
      );

      // Sort billboards
      const sortedBillboards = normalizedBillboards.sort((a, b) => {
        const sizeA = sizesData.find(s => s.name === a.size)?.sort_order ?? 999;
        const sizeB = sizesData.find(s => s.name === b.size)?.sort_order ?? 999;
        if (sizeA !== sizeB) return sizeA - sizeB;
        const munA = municipalitiesData.find(m => m.name === a.municipality)?.sort_order ?? 999;
        const munB = municipalitiesData.find(m => m.name === b.municipality)?.sort_order ?? 999;
        return munA - munB;
      });

      // Build payments HTML
      const printCostEnabled = Boolean(
        contract?.print_cost_enabled === true ||
        contract?.print_cost_enabled === 1 ||
        contract?.print_cost_enabled === "true" ||
        contract?.print_cost_enabled === "1"
      );

      const finalTotalAmount = contract?.Total || contract?.total_cost || 0;
      const installationEnabled = contract?.installation_enabled !== false && contract?.installation_enabled !== 0;
      const installationText = installationEnabled ? 'مع التركيب' : 'غير شامل التركيب';
      const printCostText = printCostEnabled ? 'شاملة تكاليف الطباعة' : 'غير شاملة تكاليف الطباعة';
      const discountText = discountInfo ? ` بعد خصم ${discountInfo.text}` : '';

      // ✅ صيغة البند الخامس للدفعات (دفعة أولى ... ثم ...)
      const paymentsSummary = formatPaymentsSummary(contract?.installments_data, currencyInfo.symbol, currencyInfo.writtenName);
      // ✅ نص يُحقن في {payments} - متصل بدون فراغات
      const paymentsText = `${paymentsSummary.replace(/<br>/g, ' ')}`;
      // ✅ نسخة HTML للمعاينة فقط
      const paymentsHtml = paymentsSummary;

      // Convert contract terms
      const unifiedTerms: UnifiedContractTerm[] = contractTerms.map(t => ({
        id: t.id,
        term_title: t.term_title,
        term_content: t.term_content,
        term_order: t.term_order,
        is_active: t.is_active,
        font_size: t.font_size,
      }));

      // Generate unified print HTML
      const billboardsCount = contract?.billboards_count || (contract?.billboard_ids ? contract.billboard_ids.split(',').length : sortedBillboards.length);

      // استخدام getYearlyCode المشتركة (معرّفة أعلى المكوّن)

      const rawStartDate = contract?.start_date || contract?.['Contract Date'] || '';
      const htmlContent = await generateUnifiedPrintHTML({
        settings: templateSettings,
        contractData: {
          contractNumber: isOffer ? (contract?.offer_number || contract?.id || '') : (contract?.id || contract?.Contract_Number || ''),
          yearlyCode: await getYearlyCode(),
          year: year.toString(),
          startDate: contractDetails.startDate,
          endDate: contractDetails.endDate,
          rawStartDate, // ISO date for Hijri conversion
          duration: contractDetails.duration,
          customerName: customerData.name,
          customerCompany: customerData.company || '',
          customerPhone: customerData.phone || '',
          isOffer,
          adType: contract?.ad_type || contract?.['Ad Type'] || (isOffer ? 'عرض سعر' : 'عقد إيجار'),
          billboardsCount,
          currencyName: currencyInfo.name,
        },
        terms: unifiedTerms,
        billboards: sortedBillboards,
        templateBgUrl: templateBgUrl,
        noStampBgUrl: !withStamp ? configuredNoStampBgUrl : undefined,
        tableBgUrl: tableBgUrl,
        noStampTableBgUrl: !withStamp ? configuredNoStampTableBgUrl : undefined,
        currencyInfo: {
          symbol: currencyInfo.symbol,
          writtenName: currencyInfo.writtenName,
        },
        contractDetails: {
          finalTotal: contractDetails.finalTotal,
          rentalCost: contractDetails.rentalCost,
          installationCost: contractDetails.installationCost,
          duration: contractDetails.duration,
 discount: discountInfo ? `بعد خصم ${discountInfo.text}` : '', // تمرير نص الخصم
 installationEnabled: installationEnabled, // تمرير حالة التركيب
 printCostEnabled: printCostEnabled, // تمرير حالة الطباعة
        },
        paymentsHtml: paymentsText, // استخدام النسخة النظيفة بدون HTML للطباعة
      });

      // Open print window with descriptive title
      const unifiedTitle = await buildDescriptiveTitle();
      openUnifiedPrintWindow(htmlContent, unifiedTitle);
      toast.success('تم فتح نافذة الطباعة الجديدة');

      if (printMode === 'auto') {
        onOpenChange(false);
      }

    } catch (error) {
      console.error('Error in handleUnifiedPrint:', error);
      toast.error('حدث خطأ أثناء تحضير الطباعة');
    } finally {
      setIsGenerating(false);
    }
  };

  const contractDetails = calculateContractDetails();
  const paymentInstallments = getPaymentInstallments();
  const currencyInfo = getCurrencyInfo();
  const discountInfo = getDiscountInfo();

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[70vh] overflow-hidden p-0 bg-gradient-to-br from-background via-background to-primary/5 border-primary/20">
        <UIDialog.DialogTitle className="sr-only">عقد #{contract?.Contract_Number || contract?.id}</UIDialog.DialogTitle>
        <div className="flex flex-col h-full max-h-[70vh]">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-primary via-primary to-primary-glow p-3 text-primary-foreground">
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Printer className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">عقد #{contract?.Contract_Number || contract?.id}{yearlyContractCode ? ` (${yearlyContractCode})` : ''} • {contract?.['Ad Type'] || 'غير محدد'}</h2>
                  <p className="text-xs text-primary-foreground/80">{customerData?.name || 'غير محدد'} • {contract?.billboards_count || contract?.billboard_ids?.split(',').length || 1} لوحة • {currencyInfo.name}</p>
                </div>
              </div>
            </div>
            <UIDialog.DialogClose className="absolute left-2 top-2 rounded-full w-6 h-6 flex items-center justify-center bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors">
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">إغلاق</span>
            </UIDialog.DialogClose>
          </div>

          {/* Content - Compact */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap'); .num { font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial !important; font-variant-numeric: tabular-nums; font-weight:700; direction:ltr; display:inline-block; text-align:left;} .currency { font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif !important; color:#000; font-weight:700; margin-left:6px; display:inline-block;}`}</style>

            {/* Compact Summary */}
            {isGenerating ? (
              <div className="text-center py-8">
                <div className="relative mx-auto w-12 h-12">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
                  <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                    <Printer className="h-5 w-5 text-primary-foreground animate-pulse" />
                  </div>
                </div>
                <p className="text-sm font-medium mt-3 text-foreground">جاري تحضير العقد...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Total & Duration Row */}
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl bg-gradient-to-br from-primary via-primary to-primary-glow p-3 text-primary-foreground">
                    <p className="text-xs text-primary-foreground/80">المجموع</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold" style={{ direction: 'ltr', display: 'inline-block' }}>{contractDetails.finalTotal}</span>
                      <span className="text-sm">{currencyInfo.symbol}</span>
                    </div>
                  </div>
                  <div className="flex-1 rounded-xl bg-card border p-3">
                    <p className="text-xs text-muted-foreground">المدة</p>
                    <p className="text-2xl font-bold">{contractDetails.duration} <span className="text-sm font-normal">يوم</span></p>
                  </div>
                </div>

                {/* Customer & Contract Info Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-card border p-2.5">
                    <p className="text-xs text-muted-foreground mb-1">العميل</p>
                    <p className="font-medium text-sm truncate">{customerData?.name || 'غير محدد'}</p>
                    {customerData?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{customerData.phone}</p>}
                  </div>
                  <div className="rounded-lg bg-card border p-2.5">
                    <p className="text-xs text-muted-foreground mb-1">الفترة</p>
                    <p className="text-xs">{contractDetails.startDate}</p>
                    <p className="text-xs">{contractDetails.endDate}</p>
                  </div>
                </div>

                {/* Payments - With Dates */}
                {paymentInstallments.length > 0 && (
                  <div className="rounded-lg bg-card border p-2.5">
                    <p className="text-xs text-muted-foreground mb-2">الدفعات ({paymentInstallments.length})</p>
                    <div className="space-y-1.5">
                      {paymentInstallments.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-muted/50 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{p.number}</span>
                            <span className="font-medium">{p.amount} {p.currencySymbol}</span>
                          </div>
                          {p.dueDate && (
                            <span className="text-muted-foreground text-[10px]">{p.dueDate}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

 {/* ملخص المقاسات */}
                {sizesSummary.length > 0 && (
                  <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/50 p-2.5">
                    <p className="text-xs text-muted-foreground mb-2">المقاسات ({sizesSummary.reduce((sum, s) => sum + s.count, 0)} لوحة)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sizesSummary.map((item, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-gray-800 text-xs font-medium shadow-sm border"
                        >
                          <span className="text-primary font-bold">{item.count}</span>
                          <span className="text-muted-foreground">×</span>
                          <span dir="ltr">{item.size}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contract Details Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">العملة</p>
                    <p className="text-xs font-bold">{currencyInfo.name}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">التركيب</p>
 <p className="text-xs font-bold">{contract?.installation_enabled ? ' مشمول' : ' غير مشمول'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">الطباعة</p>
 <p className="text-xs font-bold">{contract?.print_cost_enabled === 'yes' ? ' مشمول' : ' غير مشمول'}</p>
                  </div>
                </div>

                {/* Print Options - Compact */}
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useInstallationImages}
                      onChange={(e) => setUseInstallationImages(e.target.checked)}
                      className="w-3.5 h-3.5 text-primary focus:ring-primary rounded"
                    />
                    <span className="text-xs">صور التركيب الفعلية</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <ContractPDFActions
            isGenerating={isGenerating}
            sendingWhatsApp={sendingWhatsApp}
            hasPhone={!!customerData?.phone}
            printMode={printMode}
            withStamp={withStamp}
            onWithStampChange={setWithStamp}
            onPrintInvoice={handlePrintInvoice}
            onPreviewInvoice={handlePreviewInvoice}
            onDownloadInvoice={handleDownloadInvoicePDF}
            onSendInvoiceWhatsApp={handleSendInvoiceWhatsApp}
            onPrintContract={handlePrintContract}
            onPreviewContract={handlePreviewContract}
            onDownloadContract={handleDownloadContractPDF}
            onSendContractWhatsApp={handleSendContractWhatsApp}
            onUnifiedPrint={handleUnifiedPrint}
            onUploadToDrive={handleUploadContractToDrive}
          />
        </div>
      </UIDialog.DialogContent>

      {/* Preview Dialog */}
      <ContractPDFPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={previewTitle}
        html={previewHTML}
      />
    </UIDialog.Dialog>
  );
}