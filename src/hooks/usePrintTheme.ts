/**
 * usePrintTheme Hook
 * يوفر إعدادات الطباعة من المتجر
 */

import { usePrintSettingsByType } from '@/store/printSettingsStore';
import { DocumentType } from '@/types/document-types';
import { PrintSettings } from '@/types/print-settings';

interface UsePrintThemeResult {
  settings: PrintSettings;
  isLoading: boolean;
}

/**
 * usePrintTheme - Hook للحصول على إعدادات الطباعة
 */
export function usePrintTheme(documentType: DocumentType): UsePrintThemeResult {
  const { settings, isLoading } = usePrintSettingsByType(documentType);
  return { settings, isLoading };
}
