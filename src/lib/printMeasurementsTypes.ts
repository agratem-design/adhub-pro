/**
 * Universal Print System - Configuration Types
 * نظام الطباعة الموحد - أنواع الإعدادات
 */

export type PositionAlignment = 'left' | 'center' | 'right';
export type Direction = 'rtl' | 'ltr';

/**
 * PrintConfig - Complete configuration for print layout
 * إعدادات الطباعة الكاملة
 */
export interface PrintConfig {
  // === Page Settings ===
  page: {
    direction: Direction;
    width: string;
    minHeight: string;
    padding: {
      top: string;
      right: string;
      bottom: string;
      left: string;
    };
    backgroundColor: string;
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
  };

  // === Header Control ===
  header: {
    enabled: boolean;
    height: string;
    backgroundColor: string;
    padding: string;
    marginBottom: string;
    borderBottom: string;
    
    // Logo positioning (absolute control)
    logo: {
      enabled: boolean;
      url: string;
      width: string;
      height: string;
      positionX: string; // CSS value: '20px', '10%', etc.
      positionY: string;
      objectFit: 'contain' | 'cover' | 'fill';
    };
    
    // Title positioning (absolute control)
    title: {
      enabled: boolean;
      text: string;
      fontSize: string;
      fontWeight: string;
      color: string;
      alignment: PositionAlignment;
      positionX: string;
      positionY: string;
    };
    
    // Subtitle
    subtitle: {
      enabled: boolean;
      text: string;
      fontSize: string;
      color: string;
    };
    
    // Document info (number, date)
    documentInfo: {
      enabled: boolean;
      alignment: PositionAlignment;
      fontSize: string;
      color: string;
    };
  };

  // === Company Info Section ===
  companyInfo: {
    enabled: boolean;
    name: string;
    subtitle: string;
    address: string;
    phone: string;
    fontSize: string;
    color: string;
    alignment: PositionAlignment;
  };

  // === Party Info Section (Customer/Supplier) ===
  partyInfo: {
    enabled: boolean;
    backgroundColor: string;
    borderColor: string;
    borderRadius: string;
    padding: string;
    marginBottom: string;
    titleFontSize: string;
    titleColor: string;
    contentFontSize: string;
    contentColor: string;
  };

  // === Table Styling ===
  table: {
    width: string;
    borderCollapse: 'collapse' | 'separate';
    borderSpacing: string;
    marginBottom: string;
    
    // Header row
    header: {
      backgroundColor: string;
      textColor: string;
      fontSize: string;
      fontWeight: string;
      padding: string;
      borderColor: string;
      textAlign: PositionAlignment;
    };
    
    // Body rows
    body: {
      fontSize: string;
      padding: string;
      borderColor: string;
      oddRowBackground: string;
      evenRowBackground: string;
      textColor: string;
    };
    
    // Borders
    border: {
      width: string;
      style: 'solid' | 'dashed' | 'dotted' | 'none';
      color: string;
    };
  };

  // === Totals/Summary Section (inside tfoot) ===
  totals: {
    enabled: boolean;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    borderRadius: string;
    padding: string;
    titleFontSize: string;
    titleFontWeight: string;
    valueFontSize: string;
    valueFontWeight: string;
    alignment: PositionAlignment;
  };

  // === Footer ===
  footer: {
    enabled: boolean;
    text: string;
    fontSize: string;
    color: string;
    alignment: PositionAlignment;
    borderTop: string;
    padding: string;
    marginTop: string;
    showPageNumber: boolean;
    pageNumberFormat: string; // e.g., "صفحة {page}"
  };

  // === Notes Section ===
  notes: {
    enabled: boolean;
    title: string;
    content: string;
    fontSize: string;
    color: string;
    backgroundColor: string;
    borderColor: string;
    padding: string;
    marginTop: string;
  };
}

/**
 * Column definition for dynamic tables
 */
export interface PrintColumn {
  key: string;
  header: string;
  width?: string;
  align?: PositionAlignment;
  format?: (value: any) => string;
}

/**
 * Totals item for summary section
 */
export interface PrintTotalsItem {
  label: string;
  value: string | number;
  highlight?: boolean;
  bold?: boolean;
}

/**
 * Document header data
 */
export interface PrintDocumentData {
  title: string;
  documentNumber?: string;
  documentNumberLabel?: string;
  date?: string;
  additionalInfo?: { label: string; value: string }[];
}

/**
 * Party (customer/supplier) data
 */
export interface PrintPartyData {
  title: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  additionalFields?: { label: string; value: string }[];
}

/**
 * Props for UniversalPrintLayout component
 */
export interface UniversalPrintLayoutProps {
  config: PrintConfig;
  documentData: PrintDocumentData;
  partyData?: PrintPartyData;
  columns: PrintColumn[];
  rows: Record<string, any>[];
  totals?: PrintTotalsItem[];
  totalsTitle?: string;
  notes?: string;
  className?: string;
}

/**
 * Default configuration factory
 */
export const createDefaultPrintConfig = (): PrintConfig => ({
  page: {
    direction: 'rtl',
    width: '210mm',
    minHeight: '297mm',
    padding: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    backgroundColor: '#ffffff',
    fontFamily: 'Cairo, Tajawal, sans-serif',
    fontSize: '12px',
    lineHeight: '1.6',
  },
  header: {
    enabled: true,
    height: '100px',
    backgroundColor: 'transparent',
    padding: '10px 0',
    marginBottom: '20px',
    borderBottom: '2px solid #e5e7eb',
    logo: {
      enabled: true,
      url: '/logo.png',
      width: '80px',
      height: 'auto',
      positionX: '0',
      positionY: '0',
      objectFit: 'contain',
    },
    title: {
      enabled: true,
      text: 'Document Title',
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#1f2937',
      alignment: 'center',
      positionX: '50%',
      positionY: '50%',
    },
    subtitle: {
      enabled: false,
      text: '',
      fontSize: '14px',
      color: '#6b7280',
    },
    documentInfo: {
      enabled: true,
      alignment: 'left',
      fontSize: '12px',
      color: '#374151',
    },
  },
  companyInfo: {
    enabled: true,
    name: 'Company Name',
    subtitle: '',
    address: '',
    phone: '',
    fontSize: '11px',
    color: '#6b7280',
    alignment: 'right',
  },
  partyInfo: {
    enabled: true,
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '20px',
    titleFontSize: '14px',
    titleColor: '#1f2937',
    contentFontSize: '12px',
    contentColor: '#374151',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    borderSpacing: '0',
    marginBottom: '0',
    header: {
      backgroundColor: '#1f2937',
      textColor: '#ffffff',
      fontSize: '12px',
      fontWeight: 'bold',
      padding: '10px 8px',
      borderColor: '#1f2937',
      textAlign: 'center',
    },
    body: {
      fontSize: '11px',
      padding: '8px',
      borderColor: '#e5e7eb',
      oddRowBackground: '#ffffff',
      evenRowBackground: '#f9fafb',
      textColor: '#374151',
    },
    border: {
      width: '1px',
      style: 'solid',
      color: '#e5e7eb',
    },
  },
  totals: {
    enabled: true,
    backgroundColor: '#f3f4f6',
    textColor: '#1f2937',
    borderColor: '#e5e7eb',
    borderRadius: '0',
    padding: '12px',
    titleFontSize: '12px',
    titleFontWeight: 'bold',
    valueFontSize: '14px',
    valueFontWeight: 'bold',
    alignment: 'left',
  },
  footer: {
    enabled: true,
    text: '',
    fontSize: '10px',
    color: '#9ca3af',
    alignment: 'center',
    borderTop: '1px solid #e5e7eb',
    padding: '10px 0',
    marginTop: '20px',
    showPageNumber: true,
    pageNumberFormat: 'صفحة {page}',
  },
  notes: {
    enabled: false,
    title: 'ملاحظات',
    content: '',
    fontSize: '11px',
    color: '#6b7280',
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    padding: '10px',
    marginTop: '15px',
  },
});
