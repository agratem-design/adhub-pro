/**
 * Unified Invoice Settings - Single Source of Truth
 * يعتمد فقط على print_settings عبر الجسر (invoicePrintSettingsBridge)
 * لا يوجد فولباك للنظام القديم
 */
import { supabase } from '@/integrations/supabase/client';
import {
  SharedInvoiceSettings,
  IndividualInvoiceSettings,
  AllInvoiceSettings,
  DEFAULT_SHARED_SETTINGS,
  DEFAULT_INDIVIDUAL_SETTINGS,
  InvoiceTemplateType,
  INVOICE_TEMPLATES,
} from '@/types/invoice-templates';
import { fetchPrintSettingsForInvoice, clearPrintSettingsBridgeCache } from '@/utils/invoicePrintSettingsBridge';

// Cache for merged styles per document type
let mergedCache: Record<string, any> = {};
let mergedCacheTime = 0;
const CACHE_TTL = 60000;

/**
 * Prefetch print settings (call early in app lifecycle)
 */
export async function prefetchInvoiceSettings(): Promise<void> {
  try {
    // Prefetch the most common document types
    const commonTypes: InvoiceTemplateType[] = ['contract', 'receipt', 'account_statement', 'composite_task'];
    await Promise.all(commonTypes.map(type => fetchPrintSettingsForInvoice(type)));
  } catch (e) {
    console.log('Prefetch print settings: using defaults');
  }
}

/**
 * Clear all caches
 */
export function clearInvoiceSettingsCache(): void {
  mergedCache = {};
  mergedCacheTime = 0;
  clearPrintSettingsBridgeCache();
}

/**
 * Get merged styles for a specific invoice type (ASYNC - primary method)
 * Uses print_settings as the SINGLE source of truth
 */
export async function getMergedInvoiceStylesAsync(type: InvoiceTemplateType) {
  // Check cache
  if (mergedCache[type] && Date.now() - mergedCacheTime < CACHE_TTL) {
    return mergedCache[type];
  }

  try {
    const result = await fetchPrintSettingsForInvoice(type);
    if (result && Object.keys(result).length > 3) {
      mergedCache[type] = result;
      mergedCacheTime = Date.now();
      return result;
    }
  } catch (e) {
    console.log('Could not fetch print_settings for', type);
  }

  // Return defaults (no legacy fallback)
  const defaults = buildDefaults();
  mergedCache[type] = defaults;
  mergedCacheTime = Date.now();
  return defaults;
}

/**
 * Sync version - returns cached or defaults (no DB call)
 */
export function getMergedInvoiceStyles(type: InvoiceTemplateType) {
  if (mergedCache[type]) return mergedCache[type];
  return buildDefaults();
}

/**
 * Build default merged settings
 */
function buildDefaults() {
  const shared = DEFAULT_SHARED_SETTINGS;
  const individual = DEFAULT_INDIVIDUAL_SETTINGS;

  return {
    companyName: shared.companyName,
    companySubtitle: shared.companySubtitle,
    companyAddress: shared.companyAddress,
    companyPhone: shared.companyPhone,
    logoPath: shared.logoPath,
    logoSize: shared.logoSize,
    showLogo: shared.showLogo,
    showFooter: shared.showFooter,
    showPageNumber: shared.showPageNumber,
    footerText: shared.footerText,
    footerAlignment: shared.footerAlignment,
    footerBgColor: shared.footerBgColor,
    footerTextColor: shared.footerTextColor,
    fontFamily: shared.fontFamily,
    showCompanyName: shared.showCompanyName,
    showCompanySubtitle: shared.showCompanySubtitle,
    showCompanyAddress: shared.showCompanyAddress,
    showCompanyPhone: shared.showCompanyPhone,
    showTaxId: shared.showTaxId,
    showEmail: shared.showEmail,
    showWebsite: shared.showWebsite,
    companyTaxId: shared.companyTaxId,
    companyEmail: shared.companyEmail,
    companyWebsite: shared.companyWebsite,
    showCompanyInfo: shared.showCompanyInfo,
    showContactInfo: shared.showContactInfo,
    contactInfoFontSize: shared.contactInfoFontSize,
    headerMarginBottom: shared.headerMarginBottom,
    pageMarginTop: shared.pageMarginTop,
    pageMarginBottom: shared.pageMarginBottom,
    pageMarginLeft: shared.pageMarginLeft,
    pageMarginRight: shared.pageMarginRight,
    backgroundImage: shared.backgroundImage,
    backgroundOpacity: shared.backgroundOpacity,

    primaryColor: individual.primaryColor,
    secondaryColor: individual.secondaryColor,
    accentColor: individual.accentColor,
    tableHeaderBgColor: individual.tableHeaderBgColor,
    tableHeaderTextColor: individual.tableHeaderTextColor,
    tableBorderColor: individual.tableBorderColor,
    tableRowEvenColor: individual.tableRowEvenColor,
    tableRowOddColor: individual.tableRowOddColor,
    tableTextColor: individual.tableTextColor,
    tableRowOpacity: individual.tableRowOpacity,
    customerSectionBgColor: individual.customerSectionBgColor,
    customerSectionBorderColor: individual.customerSectionBorderColor,
    customerSectionTitleColor: individual.customerSectionTitleColor,
    customerSectionTextColor: individual.customerSectionTextColor,
    subtotalBgColor: individual.subtotalBgColor,
    subtotalTextColor: individual.subtotalTextColor,
    totalBgColor: individual.totalBgColor,
    totalTextColor: individual.totalTextColor,
    notesBgColor: individual.notesBgColor,
    notesTextColor: individual.notesTextColor,
    notesBorderColor: individual.notesBorderColor,
    titleFontSize: individual.titleFontSize,
    headerFontSize: individual.headerFontSize,
    bodyFontSize: individual.bodyFontSize,
    showHeader: individual.showHeader,
    showCustomerSection: individual.showCustomerSection,
    showNotesSection: individual.showNotesSection,
    showItemsSection: individual.showItemsSection,
    showTotalsSection: individual.showTotalsSection,
  };
}

// Helper function to convert hex to rgba
export function hexToRgba(hex: string, opacity: number): string {
  if (!hex || hex === 'transparent') return 'transparent';
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
  } catch {
    return hex;
  }
}
