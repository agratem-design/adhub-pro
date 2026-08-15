/**
 * Print Engine Types
 * أنواع نظام الطباعة الموحد
 */

export type DirectionType = 'rtl' | 'ltr';
export type AlignmentType = 'right' | 'center' | 'left';

/**
 * PrintTheme - الثيم المحسوب من الإعدادات
 * يُستخدم مباشرة في المكونات بدون أي تحويل إضافي
 */
export interface PrintTheme {
  // الاتجاه
  direction: DirectionType;
  textAlign: AlignmentType;
  
  // Flex - Header Layout
  flexDirection: 'row' | 'row-reverse' | 'column';
  alignItems: 'flex-start' | 'center' | 'flex-end';
  justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  headerDirection: 'row' | 'column';
  logoPositionOrder: number;
  headerSwap: boolean;
  
  // الألوان - بدون defaults، تأتي كما هي من Redux
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headerBgColor: string;
  headerTextColor: string;
  
  // ✅ ألوان الجدول
  tableHeaderBgColor: string;
  tableHeaderTextColor: string;
  tableBorderColor: string;
  tableRowEvenColor: string;
  tableRowOddColor: string;
  
  // ✅ إعدادات صندوق الإجماليات الموحد
  totalsBoxBgColor: string;
  totalsBoxTextColor: string;
  totalsBoxBorderColor: string;
  totalsBoxBorderRadius: number;
  totalsTitleFontSize: number;
  totalsValueFontSize: number;
  
  // الخطوط
  fontFamily: string;
  titleFontSize: string;
  headerFontSize: string;
  bodyFontSize: string;
  
  // الشعار
  showLogo: boolean;
  logoPath: string;
  logoSize: string;
  
  // الفوتر
  showFooter: boolean;
  footerText: string;
  showPageNumber: boolean;
  footerTextAlign: AlignmentType;
  
  // ✅ التحكم الدقيق في عناصر معلومات الشركة
  showCompanyName: boolean;
  showCompanySubtitle: boolean;
  showCompanyAddress: boolean;
  showCompanyContact: boolean;
  
  // معلومات الشركة
  companyName: string;
  companySubtitle: string;
  companyAddress: string;
  companyPhone: string;
  
  // المسافات
  pageMargins: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  headerMarginBottom: string;
}

/**
 * DocumentHeaderData - بيانات الهيدر
 */
export interface DocumentHeaderData {
  titleEn: string;
  titleAr: string;
  documentNumber: string;
  date: string;
  additionalDetails?: { label: string; value: string }[];
}

/**
 * PartyData - بيانات الطرف (عميل/مورد)
 */
export interface PartyData {
  title: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  id?: string;
  additionalFields?: { label: string; value: string }[];
}

/**
 * PrintDocumentProps - خصائص مكون PrintDocument
 */
export interface PrintDocumentProps {
  title: string;
  headerData: DocumentHeaderData;
  partyData?: PartyData;
  children: React.ReactNode;
  onPrint?: () => void;
}
