// أنواع قوالب الفواتير المتوفرة في النظام

export type InvoiceTemplateType = 
  | 'contract' // فاتورة العقد
  | 'receipt' // إيصال الدفع
  | 'print_invoice' // فاتورة الطباعة
  | 'sales_invoice' // فاتورة المبيعات
  | 'purchase_invoice' // فاتورة المشتريات
  | 'custody' // كشف العهدة
  | 'expenses' // فاتورة المصاريف
  | 'installation' // فاتورة التركيب
  | 'team_payment' // إيصال دفع الفريق
  | 'offer' // العروض
  | 'account_statement' // كشف الحساب
  | 'overdue_notice' // إشعار متأخرات
  | 'friend_rental' // إيصال إيجار الشركات الصديقة
  | 'print_task' // فاتورة مهمة الطباعة
  | 'cutout_task' // فاتورة مهمة القص
  | 'composite_task' // المهام المجمعة (طباعة + تركيب + قص)
  | 'customer_invoice' // فاتورة الزبون
  | 'sizes_invoice'; // فاتورة المقاسات

// تعريف الأقسام المختلفة لكل نوع فاتورة
export type InvoiceSectionType = 
  | 'header' // الهيدر
  | 'customer' // بيانات العميل
  | 'billboards' // اللوحات
  | 'items' // العناصر/المنتجات
  | 'services' // الخدمات
  | 'transactions' // الحركات المالية
  | 'totals' // المجاميع
  | 'notes' // الملاحظات
  | 'payment_info' // معلومات الدفع
  | 'signatures' // التوقيعات
  | 'team_info' // معلومات الفريق
  | 'custody_info' // معلومات العهدة
  | 'balance_summary'; // ملخص الرصيد

// تعريف القسم
export interface InvoiceSectionConfig {
  id: InvoiceSectionType;
  name: string;
  nameEn: string;
  icon: string;
  enabled: boolean;
}

// الأقسام المتاحة لكل نوع فاتورة
export const TEMPLATE_SECTIONS: Record<InvoiceTemplateType, InvoiceSectionType[]> = {
  contract: ['header', 'customer', 'billboards', 'totals', 'notes', 'signatures'],
  receipt: ['header', 'customer', 'payment_info', 'notes'],
  print_invoice: ['header', 'customer', 'items', 'totals', 'notes'],
  sales_invoice: ['header', 'customer', 'items', 'totals', 'notes'],
  purchase_invoice: ['header', 'customer', 'items', 'totals', 'notes'],
  custody: ['header', 'custody_info', 'transactions', 'balance_summary', 'notes'],
  expenses: ['header', 'items', 'totals', 'notes'],
  installation: ['header', 'customer', 'billboards', 'services', 'totals', 'notes', 'team_info'],
  team_payment: ['header', 'team_info', 'payment_info', 'notes'],
  offer: ['header', 'customer', 'billboards', 'totals', 'notes'],
  account_statement: ['header', 'customer', 'transactions', 'balance_summary'],
  overdue_notice: ['header', 'customer', 'transactions', 'balance_summary', 'notes'],
  friend_rental: ['header', 'customer', 'billboards', 'payment_info', 'notes'],
  print_task: ['header', 'customer', 'items', 'totals', 'notes'],
  cutout_task: ['header', 'customer', 'items', 'totals', 'notes'],
  composite_task: ['header', 'customer', 'items', 'services', 'totals', 'notes'],
  customer_invoice: ['header', 'customer', 'items', 'totals', 'notes'],
  sizes_invoice: ['header', 'customer', 'items', 'totals', 'notes'],
};
export const SECTION_INFO: Record<InvoiceSectionType, { name: string; nameEn: string; icon: string }> = {
  header: { name: 'الهيدر', nameEn: 'Header', icon: 'Layout' },
  customer: { name: 'بيانات العميل', nameEn: 'Customer Info', icon: 'User' },
  billboards: { name: 'اللوحات الإعلانية', nameEn: 'Billboards', icon: 'Image' },
  items: { name: 'العناصر/المنتجات', nameEn: 'Items', icon: 'Package' },
  services: { name: 'الخدمات', nameEn: 'Services', icon: 'Wrench' },
  transactions: { name: 'الحركات المالية', nameEn: 'Transactions', icon: 'ArrowLeftRight' },
  totals: { name: 'المجاميع', nameEn: 'Totals', icon: 'Calculator' },
  notes: { name: 'الملاحظات', nameEn: 'Notes', icon: 'FileText' },
  payment_info: { name: 'معلومات الدفع', nameEn: 'Payment Info', icon: 'CreditCard' },
  signatures: { name: 'التوقيعات', nameEn: 'Signatures', icon: 'PenTool' },
  team_info: { name: 'معلومات الفريق', nameEn: 'Team Info', icon: 'Users' },
  custody_info: { name: 'معلومات العهدة', nameEn: 'Custody Info', icon: 'Wallet' },
  balance_summary: { name: 'ملخص الرصيد', nameEn: 'Balance Summary', icon: 'BarChart2' },
};

export interface InvoiceTemplateInfo {
  id: InvoiceTemplateType;
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  category: 'contracts' | 'payments' | 'invoices' | 'reports';
  sections: InvoiceSectionType[];
}

export const INVOICE_TEMPLATES: InvoiceTemplateInfo[] = [
  {
    id: 'contract',
    name: 'فاتورة العقد',
    nameEn: 'Contract Invoice',
    description: 'الفاتورة الرئيسية للعقود',
    icon: 'FileText',
    category: 'contracts',
    sections: TEMPLATE_SECTIONS.contract
  },
  {
    id: 'receipt',
    name: 'إيصال الدفع',
    nameEn: 'Payment Receipt',
    description: 'إيصال استلام الدفعات',
    icon: 'Receipt',
    category: 'payments',
    sections: TEMPLATE_SECTIONS.receipt
  },
  {
    id: 'print_invoice',
    name: 'فاتورة الطباعة',
    nameEn: 'Print Invoice',
    description: 'فاتورة خدمات الطباعة',
    icon: 'Printer',
    category: 'invoices',
    sections: TEMPLATE_SECTIONS.print_invoice
  },
  {
    id: 'sales_invoice',
    name: 'فاتورة المبيعات',
    nameEn: 'Sales Invoice',
    description: 'فاتورة المبيعات العامة',
    icon: 'ShoppingCart',
    category: 'invoices',
    sections: TEMPLATE_SECTIONS.sales_invoice
  },
  {
    id: 'purchase_invoice',
    name: 'فاتورة المشتريات',
    nameEn: 'Purchase Invoice',
    description: 'فاتورة المشتريات',
    icon: 'Package',
    category: 'invoices',
    sections: TEMPLATE_SECTIONS.purchase_invoice
  },
  {
    id: 'custody',
    name: 'كشف العهدة',
    nameEn: 'Custody Statement',
    description: 'كشف حساب العهدة',
    icon: 'Wallet',
    category: 'reports',
    sections: TEMPLATE_SECTIONS.custody
  },
  {
    id: 'expenses',
    name: 'فاتورة المصاريف',
    nameEn: 'Expenses Invoice',
    description: 'تقرير المصاريف',
    icon: 'CreditCard',
    category: 'invoices',
    sections: TEMPLATE_SECTIONS.expenses
  },
  {
    id: 'installation',
    name: 'فاتورة التركيب',
    nameEn: 'Installation Invoice',
    description: 'فاتورة خدمات التركيب',
    icon: 'Wrench',
    category: 'invoices',
    sections: TEMPLATE_SECTIONS.installation
  },
  {
    id: 'team_payment',
    name: 'إيصال دفع الفريق',
    nameEn: 'Team Payment Receipt',
    description: 'إيصال دفع الفريق',
    icon: 'Users',
    category: 'payments',
    sections: TEMPLATE_SECTIONS.team_payment
  },
  {
    id: 'offer',
    name: 'العروض',
    nameEn: 'Offer',
    description: 'عروض الأسعار',
    icon: 'Tag',
    category: 'contracts',
    sections: TEMPLATE_SECTIONS.offer
  },
  {
    id: 'account_statement',
    name: 'كشف الحساب',
    nameEn: 'Account Statement',
    description: 'كشف حساب العميل',
    icon: 'ClipboardList',
    category: 'reports',
    sections: TEMPLATE_SECTIONS.account_statement
  },
  {
    id: 'overdue_notice',
    name: 'إشعار متأخرات',
    nameEn: 'Overdue Notice',
    description: 'إشعار الدفعات المتأخرة',
    icon: 'AlertTriangle',
    category: 'reports',
    sections: TEMPLATE_SECTIONS.overdue_notice
  },
  {
    id: 'friend_rental',
    name: 'إيصال إيجار صديق',
    nameEn: 'Friend Rental Receipt',
    description: 'إيصال إيجار الشركات الصديقة',
    icon: 'Building2',
    category: 'payments',
    sections: TEMPLATE_SECTIONS.friend_rental
  },
  {
    id: 'print_task',
    name: 'فاتورة مهمة طباعة',
    nameEn: 'Print Task Invoice',
    description: 'فاتورة مهمة الطباعة للمطبعة',
    icon: 'Printer',
    category: 'invoices',
    sections: TEMPLATE_SECTIONS.print_task
  },
  {
    id: 'cutout_task',
    name: 'فاتورة مهمة قص',
    nameEn: 'Cutout Task Invoice',
    description: 'فاتورة مهمة قص المجسمات',
    icon: 'Scissors',
    category: 'invoices',
    sections: TEMPLATE_SECTIONS.cutout_task
  },
  {
    id: 'composite_task',
    name: 'المهام المجمعة',
    nameEn: 'Composite Task Invoice',
    description: 'فاتورة المهام المجمعة (طباعة + تركيب + قص)',
    icon: 'Layers',
    category: 'invoices',
    sections: TEMPLATE_SECTIONS.composite_task
  },
  {
    id: 'customer_invoice',
    name: 'فاتورة الزبون',
    nameEn: 'Customer Invoice',
    description: 'فاتورة طباعة خاصة بالزبون',
    icon: 'UserCheck',
    category: 'invoices',
    sections: TEMPLATE_SECTIONS.customer_invoice
  },
  {
    id: 'sizes_invoice',
    name: 'فاتورة المقاسات',
    nameEn: 'Sizes Invoice',
    description: 'فاتورة مقاسات اللوحات من العقود',
    icon: 'Ruler',
    category: 'invoices',
    sections: TEMPLATE_SECTIONS.sizes_invoice
  }
];

// الشعارات المتاحة
export const AVAILABLE_LOGOS = [
  { id: 'logofaresgold', path: '/logofaresgold.svg', name: 'الشعار الذهبي' },
  { id: 'logofares', path: '/logofares.svg', name: 'الشعار الأساسي' },
  { id: 'logofares2', path: '/logofares2.svg', name: 'الشعار 2' },
  { id: 'logo-symbol', path: '/logo-symbol.svg', name: 'الرمز فقط' },
  { id: 'new-logo', path: '/new-logo.svg', name: 'الشعار الجديد' },
];

// الخلفيات المتاحة
export const AVAILABLE_BACKGROUNDS = [
  { id: 'none', path: '', name: 'بدون خلفية' },
  { id: 'bgc1', path: '/bgc1.svg', name: 'خلفية 1' },
  { id: 'bgc2', path: '/bgc2.svg', name: 'خلفية 2' },
  { id: 'ipg', path: '/ipg.svg', name: 'خلفية 3' },
  { id: 'price-bg', path: '/price-bg.svg', name: 'خلفية السعر' },
];

// خيارات المحاذاة
export type AlignmentOption = 'right' | 'center' | 'left';

// الإعدادات المشتركة لجميع الفواتير (الهيدر والخلفية)
export interface SharedInvoiceSettings {
  // معلومات الشركة
  companyName: string;
  companySubtitle: string;
  companyAddress: string;
  companyPhone: string;
  companyTaxId: string;
  companyEmail: string;
  companyWebsite: string;
  logoPath: string;
  
  // إعدادات الشعار
  logoSize: number;
  logoPosition: AlignmentOption;
  
  // إعدادات معلومات الاتصال (تحت الشعار)
  showContactInfo: boolean;
  contactInfoFontSize: number;
  contactInfoAlignment: 'left' | 'center' | 'right';
  
  // ألوان الهيدر
  headerBgColor: string;
  headerTextColor: string;
  headerBgOpacity: number;
  headerAlignment: AlignmentOption;
  
  // عنوان الفاتورة (مثل INVOICE)
  invoiceTitle: string;
  invoiceTitleEn: string;
  showInvoiceTitle: boolean;
  invoiceTitleAlignment: AlignmentOption;
  invoiceTitleFontSize: number;
  
  // خلفية
  backgroundImage: string;
  backgroundOpacity: number;
  backgroundScale: number;
  backgroundPosX: number;
  backgroundPosY: number;
  
  // خطوط عامة
  fontFamily: string;
  
  // عناصر الهيدر
  showLogo: boolean;
  showCompanyInfo: boolean;
  showCompanyName: boolean;
  showCompanySubtitle: boolean;
  showCompanyAddress: boolean;
  showCompanyPhone: boolean;
  showTaxId: boolean;
  showEmail: boolean;
  showWebsite: boolean;
  
  // إعدادات الفوتر
  showFooter: boolean;
  showPageNumber: boolean;
  footerText: string;
  footerAlignment: AlignmentOption;
  footerBgColor: string;
  footerTextColor: string;
  
  // مواضع العناصر (المسافات)
  headerMarginBottom: number;
  footerPosition: number;
  contentBottomSpacing: number;
  pageMarginTop: number;
  pageMarginBottom: number;
  pageMarginLeft: number;
  pageMarginRight: number;
}

// الإعدادات الخاصة بكل فاتورة
export interface IndividualInvoiceSettings {
  // ألوان رئيسية
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  
  // ألوان قسم العميل
  customerSectionBgColor: string;
  customerSectionBorderColor: string;
  customerSectionTitleColor: string;
  customerSectionTextColor: string;
  customerSectionAlignment: AlignmentOption;
  
  // ألوان الجدول
  tableBorderColor: string;
  tableHeaderBgColor: string;
  tableHeaderTextColor: string;
  tableRowEvenColor: string;
  tableRowOddColor: string;
  tableTextColor: string;
  tableRowOpacity: number;
  
  // ✅ خصائص حجم وتنسيق الجدول
  tableHeaderFontSize: number;
  tableHeaderPadding: string;
  tableHeaderFontWeight: string;
  tableBodyFontSize: number;
  tableBodyPadding: string;
  tableColumnMinWidth: number;
  tableLineHeight: number;
  
  // ألوان قسم المجاميع
  subtotalBgColor: string;
  subtotalTextColor: string;
  discountTextColor: string;
  totalBgColor: string;
  totalTextColor: string;
  totalsAlignment: AlignmentOption;
  
  // ألوان قسم الملاحظات
  notesBgColor: string;
  notesTextColor: string;
  notesBorderColor: string;
  notesAlignment: AlignmentOption;
  
  // أحجام الخطوط
  titleFontSize: number;
  headerFontSize: number;
  bodyFontSize: number;
  
  // إظهار/إخفاء الأقسام بناءً على النوع
  showHeader: boolean;
  showCustomerSection: boolean;
  showNotesSection: boolean;
  showBillboardsSection: boolean;
  showItemsSection: boolean;
  showServicesSection: boolean;
  showTransactionsSection: boolean;
  showTotalsSection: boolean;
  showPaymentInfoSection: boolean;
  showSignaturesSection: boolean;
  showTeamInfoSection: boolean;
  showCustodyInfoSection: boolean;
  showBalanceSummarySection: boolean;
  
  // إعدادات قسم الدفع
  paymentSectionBgColor: string;
  paymentSectionBorderColor: string;
  paymentSectionTitleColor: string;
  paymentSectionTextColor: string;
  
  // إعدادات قسم التوقيعات
  signaturesSectionBgColor: string;
  signaturesSectionBorderColor: string;
  signaturesSectionTextColor: string;
  signatureLineColor: string;
  
  // إعدادات قسم الفريق
  teamSectionBgColor: string;
  teamSectionBorderColor: string;
  teamSectionTitleColor: string;
  teamSectionTextColor: string;
  
  // إعدادات قسم العهدة
  custodySectionBgColor: string;
  custodySectionBorderColor: string;
  custodySectionTitleColor: string;
  custodySectionTextColor: string;
  
  // إعدادات ملخص الرصيد
  balanceSummaryBgColor: string;
  balanceSummaryBorderColor: string;
  balanceSummaryTitleColor: string;
  balanceSummaryTextColor: string;
  balanceSummaryPositiveColor: string;
  balanceSummaryNegativeColor: string;
  
  // إعدادات قسم اللوحات
  billboardsSectionBgColor: string;
  billboardsSectionBorderColor: string;
  billboardsSectionTitleColor: string;
  
  // إعدادات قسم الخدمات
  servicesSectionBgColor: string;
  servicesSectionBorderColor: string;
  servicesSectionTitleColor: string;
  
  // إعدادات قسم الحركات المالية
  transactionsSectionBgColor: string;
  transactionsSectionBorderColor: string;
  transactionsSectionTitleColor: string;
  transactionsSectionTextColor: string;
  
  // ✅ عنوان مخصص لكل نوع فاتورة (يتجاوز العنوان الافتراضي)
  customTitleAr: string;
  customTitleEn: string;
}

export const DEFAULT_SHARED_SETTINGS: SharedInvoiceSettings = {
  // مهم: بدون نصوص افتراضية داخل الهيدر (يظهر فقط إذا أدخل المستخدم بياناته)
  companyName: '',
  companySubtitle: '',
  companyAddress: '',
  companyPhone: '',
  companyTaxId: '',
  companyEmail: '',
  companyWebsite: '',
  logoPath: '/logofares.svg',

  logoSize: 180,
  logoPosition: 'right',

  showContactInfo: false,
  contactInfoFontSize: 10,
  contactInfoAlignment: 'center',

  headerBgColor: 'transparent',
  headerTextColor: '#1a1a2e',
  headerBgOpacity: 100,
  headerAlignment: 'right',

  invoiceTitle: 'فاتورة',
  invoiceTitleEn: 'INVOICE',
  showInvoiceTitle: true,
  invoiceTitleAlignment: 'left',
  invoiceTitleFontSize: 28,

  backgroundImage: '',
  backgroundOpacity: 100,
  backgroundScale: 100,
  backgroundPosX: 50,
  backgroundPosY: 50,

  fontFamily: 'Doran',

  showLogo: true,
  showCompanyInfo: true,
  showCompanyName: true,
  showCompanySubtitle: true,
  showCompanyAddress: true,
  showCompanyPhone: true,
  showTaxId: false,
  showEmail: false,
  showWebsite: false,

  showFooter: true,
  showPageNumber: true,
  footerText: 'شكراً لتعاملكم معنا',
  footerAlignment: 'center',
  footerBgColor: 'transparent',
  footerTextColor: '#666666',

  headerMarginBottom: 20,
  footerPosition: 15,
  contentBottomSpacing: 25,
  pageMarginTop: 15,
  pageMarginBottom: 15,
  pageMarginLeft: 15,
  pageMarginRight: 15,
};


export const DEFAULT_INDIVIDUAL_SETTINGS: IndividualInvoiceSettings = {
  // ✅ ألوان رسمية (أسود/رمادي) - مستوحاة من كشف الحساب
  primaryColor: '#000000',
  secondaryColor: '#333333',
  accentColor: '#e8e8e8',
  
  customerSectionBgColor: '#f8f9fa',
  customerSectionBorderColor: '#000000',
  customerSectionTitleColor: '#000000',
  customerSectionTextColor: '#333333',
  customerSectionAlignment: 'center',
  
  tableBorderColor: '#cccccc',
  tableHeaderBgColor: '#000000',
  tableHeaderTextColor: '#ffffff',
  tableRowEvenColor: '#f8f9fa',
  tableRowOddColor: '#ffffff',
  tableTextColor: '#333333',
  tableRowOpacity: 100,
  
  // ✅ خصائص حجم وتنسيق الجدول
  tableHeaderFontSize: 12,
  tableHeaderPadding: '12px 8px',
  tableHeaderFontWeight: 'bold',
  tableBodyFontSize: 12,
  tableBodyPadding: '12px 8px',
  tableColumnMinWidth: 40,
  tableLineHeight: 1.4,
  
  subtotalBgColor: 'transparent',
  subtotalTextColor: '#333333',
  discountTextColor: '#d9534f',
  totalBgColor: '#000000',
  totalTextColor: '#ffffff',
  totalsAlignment: 'right',
  
  notesBgColor: '#f9f9f9',
  notesTextColor: '#333333',
  notesBorderColor: '#dddddd',
  notesAlignment: 'right',
  
  titleFontSize: 24,
  headerFontSize: 14,
  bodyFontSize: 12,
  
  showHeader: true,
  showCustomerSection: true,
  showNotesSection: true,
  showBillboardsSection: true,
  showItemsSection: true,
  showServicesSection: true,
  showTransactionsSection: true,
  showTotalsSection: true,
  showPaymentInfoSection: true,
  showSignaturesSection: true,
  showTeamInfoSection: true,
  showCustodyInfoSection: true,
  showBalanceSummarySection: true,
  
  paymentSectionBgColor: '#e8f5e9',
  paymentSectionBorderColor: '#4caf50',
  paymentSectionTitleColor: '#2e7d32',
  paymentSectionTextColor: '#333333',
  
  signaturesSectionBgColor: 'transparent',
  signaturesSectionBorderColor: '#999999',
  signaturesSectionTextColor: '#333333',
  signatureLineColor: '#333333',
  
  teamSectionBgColor: '#e3f2fd',
  teamSectionBorderColor: '#2196f3',
  teamSectionTitleColor: '#1565c0',
  teamSectionTextColor: '#333333',
  
  custodySectionBgColor: '#fff3e0',
  custodySectionBorderColor: '#ff9800',
  custodySectionTitleColor: '#e65100',
  custodySectionTextColor: '#333333',
  
  balanceSummaryBgColor: '#f5f5f5',
  balanceSummaryBorderColor: '#999999',
  balanceSummaryTitleColor: '#1a1a2e',
  balanceSummaryTextColor: '#333333',
  balanceSummaryPositiveColor: '#4caf50',
  balanceSummaryNegativeColor: '#f44336',
  
  billboardsSectionBgColor: '#f8f9fa',
  billboardsSectionBorderColor: '#1a1a2e',
  billboardsSectionTitleColor: '#1a1a2e',
  
  servicesSectionBgColor: '#f3e5f5',
  servicesSectionBorderColor: '#9c27b0',
  servicesSectionTitleColor: '#7b1fa2',
  
  transactionsSectionBgColor: '#fafafa',
  transactionsSectionBorderColor: '#1a1a2e',
  transactionsSectionTitleColor: '#1a1a2e',
  transactionsSectionTextColor: '#333333',
  
  // عنوان مخصص (فارغ = استخدام العنوان الافتراضي)
  customTitleAr: '',
  customTitleEn: '',
};

// الإعدادات الكاملة للنظام
export interface AllInvoiceSettings {
  shared: SharedInvoiceSettings;
  individual: Record<InvoiceTemplateType, IndividualInvoiceSettings>;
}

// دالة مساعدة للحصول على الإعدادات المدمجة
export function getMergedSettings(
  shared: SharedInvoiceSettings,
  individual: IndividualInvoiceSettings
) {
  return {
    ...shared,
    ...individual,
  };
}

// الحصول على الأقسام المتاحة لنوع فاتورة معين
export function getTemplateSections(templateType: InvoiceTemplateType): InvoiceSectionType[] {
  return TEMPLATE_SECTIONS[templateType] || [];
}

// التحقق من أن قسم معين متاح لنوع فاتورة
export function hasSection(templateType: InvoiceTemplateType, section: InvoiceSectionType): boolean {
  return TEMPLATE_SECTIONS[templateType]?.includes(section) || false;
}

// تصنيفات الفواتير
export const TEMPLATE_CATEGORIES = {
  contracts: { name: 'العقود والعروض', icon: 'FileText' },
  payments: { name: 'الإيصالات والدفعات', icon: 'Receipt' },
  invoices: { name: 'الفواتير', icon: 'FileSpreadsheet' },
  reports: { name: 'التقارير والكشوفات', icon: 'ClipboardList' },
} as const;

// عناوين الفواتير المختلفة
export const INVOICE_TITLES: Record<InvoiceTemplateType, { ar: string; en: string }> = {
  contract: { ar: 'فاتورة عقد', en: 'CONTRACT INVOICE' },
  receipt: { ar: 'إيصال استلام', en: 'PAYMENT RECEIPT' },
  print_invoice: { ar: 'فاتورة طباعة', en: 'PRINT INVOICE' },
  sales_invoice: { ar: 'فاتورة مبيعات', en: 'SALES INVOICE' },
  purchase_invoice: { ar: 'فاتورة مشتريات', en: 'PURCHASE INVOICE' },
  custody: { ar: 'كشف عهدة', en: 'CUSTODY STATEMENT' },
  expenses: { ar: 'فاتورة مصاريف', en: 'EXPENSES INVOICE' },
  installation: { ar: 'فاتورة تركيب', en: 'INSTALLATION INVOICE' },
  team_payment: { ar: 'إيصال دفع فريق', en: 'TEAM PAYMENT' },
  offer: { ar: 'عرض سعر', en: 'PRICE OFFER' },
  account_statement: { ar: 'كشف حساب', en: 'ACCOUNT STATEMENT' },
  overdue_notice: { ar: 'إشعار متأخرات', en: 'OVERDUE NOTICE' },
  friend_rental: { ar: 'إيصال إيجار', en: 'RENTAL RECEIPT' },
  print_task: { ar: 'فاتورة مهمة طباعة', en: 'PRINT TASK' },
  cutout_task: { ar: 'فاتورة مهمة قص', en: 'CUTOUT TASK' },
  composite_task: { ar: 'المهام المجمعة', en: 'COMPOSITE TASK' },
  customer_invoice: { ar: 'فاتورة الزبون', en: 'CUSTOMER INVOICE' },
  sizes_invoice: { ar: 'فاتورة المقاسات', en: 'SIZES INVOICE' },
};
