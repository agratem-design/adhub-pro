import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// الأنواع والقيم الافتراضية من ContractTermsSettings
export interface TableColumnSettings {
  key: string;
  label: string;
  visible: boolean;
  width: number;
  fontSize?: number;
  headerFontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  padding?: number; // التباعد الداخلي للعمود
  lineHeight?: number; // ارتفاع السطر (مثل 1.2, 1.5, 2)
}

export interface TableSettings {
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
  cellTextAlign: string;
  headerTextAlign: string;
  columns: TableColumnSettings[];
  highlightedColumns: string[];
  highlightedColumnBgColor: string;
  highlightedColumnTextColor: string;
  cellTextColor: string;
  cellPadding: number;
  qrForegroundColor: string;
  qrBackgroundColor: string;
  cellTransparent?: boolean;
}

// إعدادات عرض التخفيض في الجدول
export interface DiscountDisplaySettings {
  enabled: boolean;
  showOriginalPrice: boolean;
  originalPriceFontSize: number;
  originalPriceColor: string;
  discountedPriceFontSize: number;
  discountedPriceColor: string;
  strikethroughColor: string;
  strikethroughWidth: number;
}

// إعدادات الصور والـ QR الافتراضية
export interface FallbackSettings {
  defaultImageUrl: string; // صورة افتراضية للوحات بدون صورة
  defaultGoogleMapsUrl: string; // رابط قوقل ماب افتراضي
  useDefaultImage: boolean; // استخدام الصورة الافتراضية
  useDefaultQR: boolean; // استخدام الـ QR الافتراضي
}

export interface GoldLineSettings {
  visible: boolean;
  heightPercent: number;
  color: string;
}

export interface TableTermSettings {
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

export interface PageSectionSettings {
  header: SectionPosition;
  date: SectionPosition;
 adType?: SectionPosition; // نوع الإعلان - جديد
  firstParty: SectionPosition;
  firstPartyData: FirstPartyData;
  secondParty: SectionPosition; // السطر الأول: اسم الشركة
  secondPartyCustomer?: SectionPosition; // السطر الثاني: اسم الزبون والهاتف
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
  tableBackgroundUrl?: string;
  discountDisplay?: DiscountDisplaySettings;
  fallbackSettings?: FallbackSettings; // إعدادات الصور والـ QR الافتراضية
}

export const DEFAULT_TABLE_COLUMNS: TableColumnSettings[] = [
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
  { key: 'location', label: 'GPS', visible: true, width: 9, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 },
];

export const DEFAULT_TABLE_SETTINGS: TableSettings = {
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
  cellTransparent: false,
};

export const DEFAULT_GOLD_LINE: GoldLineSettings = {
  visible: true,
  heightPercent: 30,
  color: '#D4AF37',
};

export const DEFAULT_TABLE_TERM: TableTermSettings = {
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

export const DEFAULT_DISCOUNT_DISPLAY: DiscountDisplaySettings = {
  enabled: true,
  showOriginalPrice: true,
  originalPriceFontSize: 18,
  originalPriceColor: '#888888',
  discountedPriceFontSize: 24,
  discountedPriceColor: '#000000',
  strikethroughColor: '#cc0000',
  strikethroughWidth: 2,
};

export const DEFAULT_FALLBACK_SETTINGS: FallbackSettings = {
  defaultImageUrl: '/logofaresgold.svg',
  defaultGoogleMapsUrl: 'https://www.google.com/maps?q=32.8872,13.1913', // طرابلس
  useDefaultImage: true,
  useDefaultQR: true,
};

// ✅ القيم الافتراضية موحدة مع صفحة الإعدادات (ContractTermsSettings)
// نظام الإحداثيات: x من اليمين، y من الأعلى (RTL)
export const DEFAULT_SECTION_SETTINGS: PageSectionSettings = {
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

export function useContractTemplateSettings() {
  return useQuery({
    queryKey: ['contract-template-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_template_settings')
        .select('*')
        .eq('setting_key', 'default')
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) {
        return {
          settings: DEFAULT_SECTION_SETTINGS,
          backgroundUrl: '/bgc1.svg',
          tableBackgroundUrl: '/bgc2.svg',
        };
      }
      
      const loadedSettings = data.setting_value as unknown as Partial<PageSectionSettings>;
      
      // دمج الأعمدة: احتفظ بالأعمدة المحفوظة وأضف أي أعمدة جديدة من الافتراضية
      let mergedColumns = DEFAULT_TABLE_COLUMNS;
      if (loadedSettings?.tableSettings?.columns) {
        const savedColumns = loadedSettings.tableSettings.columns;
        const savedColumnKeys = savedColumns.map(c => c.key);
        const newColumns = DEFAULT_TABLE_COLUMNS.filter(c => !savedColumnKeys.includes(c.key));
        mergedColumns = [...savedColumns, ...newColumns];
      }
      
      const mergedSettings: PageSectionSettings = {
        ...DEFAULT_SECTION_SETTINGS,
        ...loadedSettings,
        tableSettings: {
          ...DEFAULT_TABLE_SETTINGS,
          ...(loadedSettings?.tableSettings || {}),
          columns: mergedColumns,
        },
        tableTerm: {
          ...DEFAULT_TABLE_TERM,
          ...(loadedSettings?.tableTerm || {}),
        },
        discountDisplay: {
          ...DEFAULT_DISCOUNT_DISPLAY,
          ...(loadedSettings?.discountDisplay || {}),
        },
        fallbackSettings: {
          ...DEFAULT_FALLBACK_SETTINGS,
          ...(loadedSettings?.fallbackSettings || {}),
        },
      };
      
      const tableBackgroundUrl = (loadedSettings as any)?.tableBackgroundUrl || '/bgc2.svg';
      const noStampBgUrl = (loadedSettings as any)?.noStampBgUrl || '/bgc1not.svg';
      const noStampTableBgUrl = (loadedSettings as any)?.noStampTableBgUrl || '/bgc2.svg';
      
      return {
        settings: mergedSettings,
        backgroundUrl: data.background_url || '/bgc1.svg',
        tableBackgroundUrl,
        noStampBgUrl,
        noStampTableBgUrl,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
