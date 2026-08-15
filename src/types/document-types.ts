/**
 * مرجع مركزي إلزامي لجميع أنواع المستندات في النظام
 * ⚠️ ممنوع استخدام أي String مباشر خارج هذا المرجع
 */

// =====================================================
// تعريف أنواع المستندات (Document Types Registry)
// =====================================================

export const DOCUMENT_TYPES = {
  // الفواتير والعقود
  CONTRACT_INVOICE: 'contract_invoice',
  QUOTATION: 'quotation',
  
  // الإيصالات والدفعات
  PAYMENT_RECEIPT: 'payment_receipt',
  TEAM_PAYMENT_RECEIPT: 'team_payment_receipt',
  FRIEND_RENT_RECEIPT: 'friend_rent_receipt',
  
  // الفواتير التشغيلية
  SALES_INVOICE: 'sales_invoice',
  PURCHASE_INVOICE: 'purchase_invoice',
  EXPENSE_INVOICE: 'expense_invoice',
  PRINT_SERVICE_INVOICE: 'print_service_invoice',
  INSTALLATION_INVOICE: 'installation_invoice',
  PRINT_TASK: 'print_task',
  CUT_TASK: 'cut_task',
  COMBINED_TASK: 'combined_task',
  CUSTOMER_INVOICE: 'customer_invoice',
  MEASUREMENTS_INVOICE: 'measurements_invoice',
  
  // التقارير والكشوفات
  ACCOUNT_STATEMENT: 'account_statement',
  CUSTODY_STATEMENT: 'custody_statement',
  LATE_NOTICE: 'late_notice',
} as const;

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

// =====================================================
// معلومات كل نوع مستند
// =====================================================

export interface DocumentTypeInfo {
  id: DocumentType;
  nameAr: string;
  nameEn: string;
  description: string;
  category: 'contracts' | 'payments' | 'operations' | 'reports';
  icon: string;
}

export const DOCUMENT_TYPE_INFO: Record<DocumentType, DocumentTypeInfo> = {
  // الفواتير والعقود
  [DOCUMENT_TYPES.CONTRACT_INVOICE]: {
    id: DOCUMENT_TYPES.CONTRACT_INVOICE,
    nameAr: 'فاتورة العقد',
    nameEn: 'Contract Invoice',
    description: 'الفاتورة الرئيسية للعقود',
    category: 'contracts',
    icon: 'FileText',
  },
  [DOCUMENT_TYPES.QUOTATION]: {
    id: DOCUMENT_TYPES.QUOTATION,
    nameAr: 'عرض السعر',
    nameEn: 'Quotation',
    description: 'عروض الأسعار',
    category: 'contracts',
    icon: 'Tag',
  },
  
  // الإيصالات والدفعات
  [DOCUMENT_TYPES.PAYMENT_RECEIPT]: {
    id: DOCUMENT_TYPES.PAYMENT_RECEIPT,
    nameAr: 'إيصال الدفع',
    nameEn: 'Payment Receipt',
    description: 'إيصال استلام الدفعات',
    category: 'payments',
    icon: 'Receipt',
  },
  [DOCUMENT_TYPES.TEAM_PAYMENT_RECEIPT]: {
    id: DOCUMENT_TYPES.TEAM_PAYMENT_RECEIPT,
    nameAr: 'إيصال دفع الفريق',
    nameEn: 'Team Payment Receipt',
    description: 'إيصال دفع فريق التركيب',
    category: 'payments',
    icon: 'Users',
  },
  [DOCUMENT_TYPES.FRIEND_RENT_RECEIPT]: {
    id: DOCUMENT_TYPES.FRIEND_RENT_RECEIPT,
    nameAr: 'إيصال إيجار صديق',
    nameEn: 'Friend Rental Receipt',
    description: 'إيصال إيجار الشركات الصديقة',
    category: 'payments',
    icon: 'Building2',
  },
  
  // الفواتير التشغيلية
  [DOCUMENT_TYPES.SALES_INVOICE]: {
    id: DOCUMENT_TYPES.SALES_INVOICE,
    nameAr: 'فاتورة المبيعات',
    nameEn: 'Sales Invoice',
    description: 'فاتورة المبيعات العامة',
    category: 'operations',
    icon: 'ShoppingCart',
  },
  [DOCUMENT_TYPES.PURCHASE_INVOICE]: {
    id: DOCUMENT_TYPES.PURCHASE_INVOICE,
    nameAr: 'فاتورة المشتريات',
    nameEn: 'Purchase Invoice',
    description: 'فاتورة المشتريات',
    category: 'operations',
    icon: 'Package',
  },
  [DOCUMENT_TYPES.EXPENSE_INVOICE]: {
    id: DOCUMENT_TYPES.EXPENSE_INVOICE,
    nameAr: 'فاتورة المصاريف',
    nameEn: 'Expense Invoice',
    description: 'تقرير المصاريف',
    category: 'operations',
    icon: 'CreditCard',
  },
  [DOCUMENT_TYPES.PRINT_SERVICE_INVOICE]: {
    id: DOCUMENT_TYPES.PRINT_SERVICE_INVOICE,
    nameAr: 'فاتورة الطباعة',
    nameEn: 'Print Service Invoice',
    description: 'فاتورة خدمات الطباعة',
    category: 'operations',
    icon: 'Printer',
  },
  [DOCUMENT_TYPES.INSTALLATION_INVOICE]: {
    id: DOCUMENT_TYPES.INSTALLATION_INVOICE,
    nameAr: 'فاتورة التركيب',
    nameEn: 'Installation Invoice',
    description: 'فاتورة خدمات التركيب',
    category: 'operations',
    icon: 'Wrench',
  },
  [DOCUMENT_TYPES.PRINT_TASK]: {
    id: DOCUMENT_TYPES.PRINT_TASK,
    nameAr: 'فاتورة مهمة طباعة',
    nameEn: 'Print Task Invoice',
    description: 'فاتورة مهمة الطباعة للمطبعة',
    category: 'operations',
    icon: 'Printer',
  },
  [DOCUMENT_TYPES.CUT_TASK]: {
    id: DOCUMENT_TYPES.CUT_TASK,
    nameAr: 'فاتورة مهمة قص',
    nameEn: 'Cut Task Invoice',
    description: 'فاتورة مهمة قص المجسمات',
    category: 'operations',
    icon: 'Scissors',
  },
  [DOCUMENT_TYPES.COMBINED_TASK]: {
    id: DOCUMENT_TYPES.COMBINED_TASK,
    nameAr: 'المهام المجمعة',
    nameEn: 'Combined Task Invoice',
    description: 'فاتورة المهام المجمعة (طباعة + تركيب + قص)',
    category: 'operations',
    icon: 'Layers',
  },
  [DOCUMENT_TYPES.CUSTOMER_INVOICE]: {
    id: DOCUMENT_TYPES.CUSTOMER_INVOICE,
    nameAr: 'فاتورة الزبون',
    nameEn: 'Customer Invoice',
    description: 'فاتورة طباعة خاصة بالزبون',
    category: 'operations',
    icon: 'UserCheck',
  },
  [DOCUMENT_TYPES.MEASUREMENTS_INVOICE]: {
    id: DOCUMENT_TYPES.MEASUREMENTS_INVOICE,
    nameAr: 'فاتورة المقاسات',
    nameEn: 'Measurements Invoice',
    description: 'فاتورة مقاسات اللوحات من العقود',
    category: 'operations',
    icon: 'Ruler',
  },
  
  // التقارير والكشوفات
  [DOCUMENT_TYPES.ACCOUNT_STATEMENT]: {
    id: DOCUMENT_TYPES.ACCOUNT_STATEMENT,
    nameAr: 'كشف الحساب',
    nameEn: 'Account Statement',
    description: 'كشف حساب العميل',
    category: 'reports',
    icon: 'ClipboardList',
  },
  [DOCUMENT_TYPES.CUSTODY_STATEMENT]: {
    id: DOCUMENT_TYPES.CUSTODY_STATEMENT,
    nameAr: 'كشف العهدة',
    nameEn: 'Custody Statement',
    description: 'كشف حساب العهدة',
    category: 'reports',
    icon: 'Wallet',
  },
  [DOCUMENT_TYPES.LATE_NOTICE]: {
    id: DOCUMENT_TYPES.LATE_NOTICE,
    nameAr: 'إشعار متأخرات',
    nameEn: 'Late Notice',
    description: 'إشعار الدفعات المتأخرة',
    category: 'reports',
    icon: 'AlertTriangle',
  },
};

// =====================================================
// تصنيفات المستندات
// =====================================================

export const DOCUMENT_CATEGORIES = {
  contracts: { nameAr: 'العقود والعروض', nameEn: 'Contracts & Quotes', icon: 'FileText' },
  payments: { nameAr: 'الإيصالات والدفعات', nameEn: 'Receipts & Payments', icon: 'Receipt' },
  operations: { nameAr: 'الفواتير التشغيلية', nameEn: 'Operational Invoices', icon: 'FileSpreadsheet' },
  reports: { nameAr: 'التقارير والكشوفات', nameEn: 'Reports & Statements', icon: 'ClipboardList' },
} as const;

// =====================================================
// دوال مساعدة
// =====================================================

/**
 * التحقق من صحة نوع المستند
 */
export function isValidDocumentType(type: string): type is DocumentType {
  return Object.values(DOCUMENT_TYPES).includes(type as DocumentType);
}

/**
 * الحصول على معلومات نوع المستند
 */
export function getDocumentTypeInfo(type: DocumentType): DocumentTypeInfo {
  return DOCUMENT_TYPE_INFO[type];
}

/**
 * الحصول على جميع المستندات حسب الفئة
 */
export function getDocumentsByCategory(category: keyof typeof DOCUMENT_CATEGORIES): DocumentTypeInfo[] {
  return Object.values(DOCUMENT_TYPE_INFO).filter(doc => doc.category === category);
}

/**
 * الحصول على قائمة جميع أنواع المستندات
 */
export function getAllDocumentTypes(): DocumentTypeInfo[] {
  return Object.values(DOCUMENT_TYPE_INFO);
}
