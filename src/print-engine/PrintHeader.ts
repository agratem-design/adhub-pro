/**
 * PrintHeader
 * يولد HTML الهيدر الموحد باستخدام unifiedHeaderHtml
 */

import { PrintTheme, DocumentHeaderData } from './types';
import { unifiedHeaderHtml, type UnifiedPrintStyles } from '@/lib/unifiedPrintFragments';

export function generatePrintHeader(
  theme: PrintTheme,
  headerData: DocumentHeaderData,
  logoDataUri: string
): string {
  const detailsHtml = headerData.additionalDetails
    ?.map(detail => `<div><strong>${detail.label}:</strong> ${detail.value}</div>`)
    .join('') || '';

  const styles: UnifiedPrintStyles = {
    primaryColor: theme.primaryColor,
    secondaryColor: theme.secondaryColor,
    logoSize: parseInt(theme.logoSize) || 200,
    headerFontSize: parseInt(theme.headerFontSize) || 14,
    showLogo: theme.showLogo,
    showCompanyName: theme.showCompanyName,
    showCompanySubtitle: theme.showCompanySubtitle,
    showCompanyAddress: theme.showCompanyAddress,
    showCompanyPhone: theme.showCompanyContact,
    companyName: theme.companyName,
    companySubtitle: theme.companySubtitle,
    companyAddress: theme.companyAddress,
    companyPhone: theme.companyPhone,
  };

  return unifiedHeaderHtml({
    styles,
    fullLogoUrl: logoDataUri,
    metaLinesHtml: `
      <div><strong>الرقم:</strong> ${headerData.documentNumber}</div>
      <div><strong>التاريخ:</strong> ${headerData.date}</div>
      ${detailsHtml}
    `,
    titleAr: headerData.titleAr,
    titleEn: headerData.titleEn,
  });
}
