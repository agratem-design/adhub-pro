/**
 * Universal Print System - Barrel Export
 * نظام الطباعة الموحد - تصدير المكونات
 */

// Types
export * from './types';

// CSS Generator
export { 
  generateDynamicStyles, 
  injectPrintStyles, 
  removePrintStyles 
} from './generateDynamicStyles';

// Main Component
export { 
  UniversalPrintLayout,
  default as UniversalPrintLayoutDefault 
} from './UniversalPrintLayout';

// Print Hook & Utilities
export { 
  usePrint,
  generatePrintHTML,
  openUniversalPrintWindow 
} from './usePrint';

// Measurements Config (SizesInvoice Style)
export {
  createMeasurementsConfig,
  createMeasurementsConfigFromSettings,
  mapPrintThemeToMeasurementsConfig,
  type MeasurementsThemeSettings
} from './measurementsConfig';

// Measurements HTML Generator
export {
  generateMeasurementsHTML,
  generateMeasurementsCSS,
  openMeasurementsPrintWindow,
  type MeasurementsHTMLOptions
} from './generateMeasurementsHTML';
