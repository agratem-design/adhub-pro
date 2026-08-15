/**
 * PrintFooter
 * يولد HTML الفوتر الموحد
 */

import { PrintTheme } from './types';

export function generatePrintFooter(theme: PrintTheme): string {
  if (!theme.showFooter) return '';
  
  return `
    <div class="print-footer">
      <div>${theme.footerText || 'شكراً لتعاملكم معنا | Thank you for your business'}</div>
      <div>هذا مستند إلكتروني ولا يحتاج إلى ختم أو توقيع</div>
    </div>
  `;
}
