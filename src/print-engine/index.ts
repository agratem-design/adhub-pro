/**
 * Print Engine - نظام الطباعة الموحد
 * 
 * ⚠️ جميع الفواتير والكشوفات يجب أن تستخدم هذا النظام حصرياً
 * ❌ ممنوع استخدام أي مكون طباعة آخر
 */

// Types
export * from './types';

// Theme
export { resolvePrintTheme } from './PrintThemeResolver';
export { usePrintTheme } from './usePrintTheme';

// CSS Generator
export { generatePrintCSS } from './generatePrintCSS';

// HTML Generators
export { generatePrintHeader } from './PrintHeader';
export { generatePrintFooter } from './PrintFooter';
export { generatePartySection } from './PrintPartySection';
export { generatePrintDocument, openPrintWindow } from './PrintDocument';

// ✅ Master Layout - نظام التصميم الموحد
export { 
  generateMasterLayout, 
  openMasterPrintWindow,
  type TableColumn,
  type TableRow,
  type TotalsItem,
  type MasterLayoutOptions
} from './MasterLayout';

// ✅ NEW: Universal Print System - نظام الطباعة الجديد
export * from './universal';

// Utilities
export {
  loadLogoAsDataUri,
  formatArabicNumber,
  formatDate,
  formatDateTime,
  numberToArabicWords
} from './utils';
