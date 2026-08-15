/**
 * usePrintTheme Hook
 * يوفر PrintTheme جاهز للاستخدام من Redux
 */

import { useMemo } from 'react';
import { usePrintSettingsByType } from '@/store/printSettingsStore';
import { DocumentType } from '@/types/document-types';
import { PrintSettings } from '@/types/print-settings';
import { resolvePrintTheme } from './PrintThemeResolver';
import { PrintTheme } from './types';

interface UsePrintThemeResult {
  theme: PrintTheme;
  settings: PrintSettings;
  isLoading: boolean;
}

/**
 * usePrintTheme - Hook للحصول على ثيم الطباعة
 * 
 * @param documentType - نوع المستند
 * @returns { theme, settings, isLoading }
 */
export function usePrintTheme(documentType: DocumentType): UsePrintThemeResult {
  const { settings, isLoading } = usePrintSettingsByType(documentType);
  
  const theme = useMemo(() => {
    return resolvePrintTheme(settings);
  }, [settings]);
  
  return { theme, settings, isLoading };
}
