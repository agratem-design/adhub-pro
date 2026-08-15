import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  InvoiceTemplateType,
  SharedInvoiceSettings,
  IndividualInvoiceSettings,
  AllInvoiceSettings,
  DEFAULT_SHARED_SETTINGS,
  DEFAULT_INDIVIDUAL_SETTINGS,
  INVOICE_TEMPLATES,
} from '@/types/invoice-templates';

const SETTINGS_KEY = 'unified_invoice_templates_settings';

interface UseInvoiceTemplateSettingsReturn {
  isLoading: boolean;
  sharedSettings: SharedInvoiceSettings;
  getIndividualSettings: (type: InvoiceTemplateType) => IndividualInvoiceSettings;
  getMergedStyles: (type: InvoiceTemplateType) => MergedInvoiceStyles;
  refetch: () => Promise<void>;
}

// Merged styles for easy use in components
export interface MergedInvoiceStyles {
  // Company
  companyName: string;
  companySubtitle: string;
  companyAddress: string;
  companyPhone: string;
  logoPath: string;
  
  // Header
  headerBgColor: string;
  headerTextColor: string;
  headerBgOpacity: number;
  showLogo: boolean;
  showCompanyInfo: boolean;
  showHeader: boolean;
  showFooter: boolean;
  showPageNumber: boolean;
  
  // Background
  backgroundImage: string;
  backgroundOpacity: number;
  backgroundScale: number;
  backgroundPosX: number;
  backgroundPosY: number;
  
  // Fonts
  fontFamily: string;
  titleFontSize: number;
  headerFontSize: number;
  bodyFontSize: number;
  
  // Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  tableBorderColor: string;
  tableHeaderBgColor: string;
  tableHeaderTextColor: string;
  tableRowEvenColor: string;
  tableRowOddColor: string;
  tableTextColor: string;
  tableRowOpacity: number;
  
  // Customer section
  customerSectionBgColor: string;
  customerSectionBorderColor: string;
  customerSectionTitleColor: string;
  customerSectionTextColor: string;
  
  // Totals
  subtotalBgColor: string;
  subtotalTextColor: string;
  discountTextColor: string;
  totalBgColor: string;
  totalTextColor: string;
  
  // Notes
  notesBgColor: string;
  notesTextColor: string;
  notesBorderColor: string;
  
  // Footer from shared
  footerTextColor: string;
}

// Cache for settings to avoid repeated fetches
let cachedSettings: AllInvoiceSettings | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

export function useInvoiceTemplateSettings(): UseInvoiceTemplateSettingsReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [sharedSettings, setSharedSettings] = useState<SharedInvoiceSettings>(DEFAULT_SHARED_SETTINGS);
  const [individualSettings, setIndividualSettings] = useState<Record<InvoiceTemplateType, IndividualInvoiceSettings>>(() => {
    const init: Record<string, IndividualInvoiceSettings> = {};
    INVOICE_TEMPLATES.forEach(t => {
      init[t.id] = { ...DEFAULT_INDIVIDUAL_SETTINGS };
    });
    return init as Record<InvoiceTemplateType, IndividualInvoiceSettings>;
  });

  const fetchSettings = useCallback(async () => {
    // Use cache if available and not expired
    if (cachedSettings && Date.now() - lastFetchTime < CACHE_DURATION) {
      setSharedSettings(cachedSettings.shared);
      setIndividualSettings(cachedSettings.individual);
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', SETTINGS_KEY)
        .maybeSingle();

      if (data?.setting_value) {
        const saved: AllInvoiceSettings = JSON.parse(data.setting_value);
        
        if (saved.shared) {
          setSharedSettings({ ...DEFAULT_SHARED_SETTINGS, ...saved.shared });
        }
        
        if (saved.individual) {
          const merged: Record<string, IndividualInvoiceSettings> = {};
          INVOICE_TEMPLATES.forEach(t => {
            merged[t.id] = { 
              ...DEFAULT_INDIVIDUAL_SETTINGS, 
              ...(saved.individual[t.id] || {}) 
            };
          });
          setIndividualSettings(merged as Record<InvoiceTemplateType, IndividualInvoiceSettings>);
        }

        // Update cache
        cachedSettings = saved;
        lastFetchTime = Date.now();
      }
    } catch (e) {
      console.log('No saved invoice template settings found, using defaults');
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getIndividualSettings = useCallback((type: InvoiceTemplateType): IndividualInvoiceSettings => {
    return individualSettings[type] || DEFAULT_INDIVIDUAL_SETTINGS;
  }, [individualSettings]);

  const getMergedStyles = useCallback((type: InvoiceTemplateType): MergedInvoiceStyles => {
    const individual = getIndividualSettings(type);
    
    return {
      // Shared settings
      companyName: sharedSettings.companyName,
      companySubtitle: sharedSettings.companySubtitle,
      companyAddress: sharedSettings.companyAddress,
      companyPhone: sharedSettings.companyPhone,
      logoPath: sharedSettings.logoPath,
      headerBgColor: sharedSettings.headerBgColor,
      headerTextColor: sharedSettings.headerTextColor,
      headerBgOpacity: sharedSettings.headerBgOpacity,
      showLogo: sharedSettings.showLogo,
      showCompanyInfo: sharedSettings.showCompanyInfo,
      showFooter: sharedSettings.showFooter,
      showPageNumber: sharedSettings.showPageNumber,
      backgroundImage: sharedSettings.backgroundImage,
      backgroundOpacity: sharedSettings.backgroundOpacity,
      backgroundScale: sharedSettings.backgroundScale,
      backgroundPosX: sharedSettings.backgroundPosX,
      backgroundPosY: sharedSettings.backgroundPosY,
      fontFamily: sharedSettings.fontFamily,
      footerTextColor: sharedSettings.footerTextColor,
      
      // Individual settings
      primaryColor: individual.primaryColor,
      secondaryColor: individual.secondaryColor,
      accentColor: individual.accentColor,
      tableBorderColor: individual.tableBorderColor,
      tableHeaderBgColor: individual.tableHeaderBgColor,
      tableHeaderTextColor: individual.tableHeaderTextColor,
      tableRowEvenColor: individual.tableRowEvenColor,
      tableRowOddColor: individual.tableRowOddColor,
      tableTextColor: individual.tableTextColor,
      tableRowOpacity: individual.tableRowOpacity,
      titleFontSize: individual.titleFontSize,
      headerFontSize: individual.headerFontSize,
      bodyFontSize: individual.bodyFontSize,
      showHeader: individual.showHeader,
      
      // Customer section
      customerSectionBgColor: individual.customerSectionBgColor,
      customerSectionBorderColor: individual.customerSectionBorderColor,
      customerSectionTitleColor: individual.customerSectionTitleColor,
      customerSectionTextColor: individual.customerSectionTextColor,
      
      // Totals
      subtotalBgColor: individual.subtotalBgColor,
      subtotalTextColor: individual.subtotalTextColor,
      discountTextColor: individual.discountTextColor,
      totalBgColor: individual.totalBgColor,
      totalTextColor: individual.totalTextColor,
      
      // Notes
      notesBgColor: individual.notesBgColor,
      notesTextColor: individual.notesTextColor,
      notesBorderColor: individual.notesBorderColor,
    };
  }, [sharedSettings, getIndividualSettings]);

  return {
    isLoading,
    sharedSettings,
    getIndividualSettings,
    getMergedStyles,
    refetch: fetchSettings,
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

// Clear cache (call when settings are saved)
export function clearInvoiceSettingsCache(): void {
  cachedSettings = null;
  lastFetchTime = 0;
}
