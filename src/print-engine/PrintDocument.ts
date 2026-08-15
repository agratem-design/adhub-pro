/**
 * PrintDocument
 * المكون الرئيسي لتوليد HTML المستند الكامل
 * 
 * ⚠️ هذا هو المكون الوحيد المسموح به للطباعة
 */

import { PrintTheme, DocumentHeaderData, PartyData } from './types';
import { generatePrintCSS } from './generatePrintCSS';
import { generatePrintHeader } from './PrintHeader';
import { generatePrintFooter } from './PrintFooter';
import { generatePartySection } from './PrintPartySection';

export interface PrintDocumentOptions {
  theme: PrintTheme;
  title: string;
  headerData: DocumentHeaderData;
  logoDataUri: string;
  partyData?: PartyData;
  bodyContent: string;
}

/**
 * generatePrintDocument - يولد HTML الكامل للطباعة
 * 
 * ❌ ممنوع الطباعة خارج هذه الدالة
 */
export function generatePrintDocument(options: PrintDocumentOptions): string {
  const { theme, title, headerData, logoDataUri, partyData, bodyContent } = options;
  
  return `
    <!DOCTYPE html>
    <html dir="${theme.direction}" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        ${generatePrintCSS(theme)}
      </style>
    </head>
    <body dir="${theme.direction}" style="font-family: '${theme.fontFamily}', 'Noto Sans Arabic', sans-serif;">
      <div class="print-container">
        ${generatePrintHeader(theme, headerData, logoDataUri)}
        ${partyData ? generatePartySection(partyData) : ''}
        ${bodyContent}
        ${generatePrintFooter(theme)}
      </div>
      
      <script>
        window.addEventListener('load', function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 500);
        });
      </script>
    </body>
    </html>
  `;
}

/**
 * openPrintWindow - يفتح معاينة الطباعة في حوار منبثق داخل الصفحة
 */
export async function openPrintWindow(htmlContent: string, filename: string): Promise<void> {
  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  showPrintPreview(htmlContent, filename);
}
