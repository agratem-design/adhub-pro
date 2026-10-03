import { renderOperationalTaskTable } from './unifiedInvoiceBody';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml, formatDateForPrint } from '@/lib/unifiedInvoiceBase';
import type { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
type MergedInvoiceStyles = Awaited<ReturnType<typeof getMergedInvoiceStylesAsync>>;
import { hexToRgba } from '@/hooks/useInvoiceSettingsSync';
export interface CutoutTask {
  id: string;
  contract_id: number;
  customer_name: string | null;
  status: string;
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CutoutTaskItem {
  id: string;
  billboard_id: number;
  description: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  cutout_image_url: string | null;
  billboard_name?: string;
  billboard_image?: string;
  billboard_size?: string;
}


export function buildCutoutTaskHTML(styles: MergedInvoiceStyles, task: CutoutTask, items: CutoutTaskItem[], printerName: string): string {
    const baseUrl = window.location.origin;
    const logoUrl = styles.logoPath || '/logofaresgold.svg';
    const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;

    const cutoutMetaHtml = `<strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-LY')}<br/><strong>رقم العقد:</strong> ${task.contract_id || 'غير محدد'}`;
    const cutoutFooterText = `${styles.footerText || 'شكراً لتعاملكم معنا'}<br/>هذه الفاتورة تم إنشاؤها تلقائياً من نظام إدارة اللوحات الإعلانية`;
    const cutoutStyles = { ...styles, footerText: cutoutFooterText };

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>فاتورة قص مجسمات</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html, body {
            width: 210mm;
            font-family: ${styles.fontFamily || "'Noto Sans Arabic', Arial, sans-serif"};
            direction: rtl;
            text-align: right;
            background: white;
            color: ${styles.customerSectionTextColor};
            font-size: ${styles.bodyFontSize}px;
            line-height: 1.4;
          }

          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          .invoice-container {
            padding: ${styles.pageMarginTop}mm ${styles.pageMarginRight}mm ${styles.pageMarginBottom}mm ${styles.pageMarginLeft}mm;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 25px;
            border-bottom: 3px solid ${styles.primaryColor};
            padding-bottom: 20px;
          }

          ${unifiedHeaderFooterCss(cutoutStyles)}

          .invoice-info {
            text-align: left;
            direction: ltr;
          }

          .invoice-title {
            font-size: ${styles.titleFontSize}px;
            font-weight: bold;
            color: ${styles.primaryColor};
            margin-bottom: 8px;
          }

          .invoice-subtitle {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
          }

          .invoice-details {
            font-size: ${styles.bodyFontSize}px;
            color: #666;
            line-height: 1.6;
          }

          .company-logo {
            max-width: ${styles.logoSize}px;
            height: auto;
          }

          .contact-info {
            font-size: ${styles.contactInfoFontSize}px;
            color: #666;
            margin-top: 8px;
            text-align: ${styles.contactInfoAlignment};
          }

          .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 25px;
            background: ${hexToRgba(styles.customerSectionBgColor, 50)};
            padding: 18px;
            border-radius: 10px;
            border: 2px solid ${styles.primaryColor};
          }

          .info-box {
            background: white;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid ${styles.tableBorderColor};
          }

          .info-label {
            font-size: 11px;
            color: ${styles.primaryColor};
            font-weight: bold;
            margin-bottom: 5px;
          }

          .info-value {
            font-size: 14px;
            font-weight: bold;
            color: #000;
          }

          .items-section {
            margin-bottom: 25px;
          }

          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: ${styles.primaryColor};
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid ${styles.tableBorderColor || styles.primaryColor};
          }

          .items-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }

          .item-card {
            border: 2px solid ${styles.tableBorderColor || '#e5e5e5'};
            border-radius: 10px;
            overflow: hidden;
            background: white;
          }

          .item-image {
            width: 100%;
            height: 120px;
            object-fit: cover;
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .item-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .no-image {
            color: #999;
            font-size: 11px;
          }

          .item-content {
            padding: 12px;
          }

          .item-name {
            font-weight: bold;
            font-size: 13px;
            margin-bottom: 8px;
            color: #333;
          }

          .item-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            font-size: 11px;
          }

          .item-detail {
            display: flex;
            justify-content: space-between;
          }

          .item-detail-label {
            color: #666;
          }

          .item-detail-value {
            font-weight: bold;
            color: ${styles.primaryColor};
          }

          .cutout-preview {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed ${styles.tableBorderColor || '#e5e5e5'};
          }

          .cutout-preview img {
            max-width: 60px;
            max-height: 60px;
            border-radius: 6px;
            border: 1px solid ${styles.tableBorderColor || '#e5e5e5'};
          }

          .summary-section {
            background: ${styles.totalBgColor || styles.primaryColor};
            color: ${styles.totalTextColor || '#ffffff'};
            padding: 20px;
            border-radius: 12px;
            margin-top: 25px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 15px;
          }

          .summary-item {
            text-align: center;
            background: rgba(255,255,255,0.15);
            padding: 12px;
            border-radius: 8px;
          }

          .summary-label {
            font-size: 11px;
            opacity: 0.9;
            margin-bottom: 5px;
          }

          .summary-value {
            font-size: 18px;
            font-weight: bold;
          }

          .total-amount {
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            padding: 15px;
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
          }

          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #666;
            padding-top: 15px;
            border-top: 1px solid #ddd;
          }

          @media print {
            html, body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          ${unifiedHeaderHtml({
            styles: cutoutStyles,
            fullLogoUrl,
            metaLinesHtml: cutoutMetaHtml,
            titleAr: styles.invoiceTitle || 'فاتورة قص',
            titleEn: styles.invoiceTitleEn || 'CUTOUT INVOICE',
          })}

          <div class="info-section">
            <div class="info-box">
              <div class="info-label">المطبعة / المصنع</div>
              <div class="info-value">${printerName}</div>
            </div>
            <div class="info-box">
              <div class="info-label">العميل</div>
              <div class="info-value">${task.customer_name || 'غير محدد'}</div>
            </div>
            <div class="info-box">
              <div class="info-label">الحالة</div>
              <div class="info-value">${task.status === 'completed' ? 'مكتمل' : task.status === 'pending' ? 'معلق' : task.status}</div>
            </div>
            <div class="info-box">
              <div class="info-label">تاريخ الإنشاء</div>
              <div class="info-value">${new Date(task.created_at).toLocaleDateString('ar-LY')}</div>
            </div>
          </div>

          <div class="items-section">
            <div class="section-title">تفاصيل المجسمات (${items.length} لوحة)</div>
            ${renderOperationalTaskTable(items, 'cut')}
          </div>

          <div class="summary-section">
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">عدد اللوحات</div>
                <div class="summary-value">${items.length}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">إجمالي المجسمات</div>
                <div class="summary-value">${task.total_quantity}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">سعر الوحدة</div>
                <div class="summary-value">${task.unit_cost} د.ل</div>
              </div>
            </div>
            <div class="total-amount">
              الإجمالي: ${task.total_cost.toLocaleString()} دينار ليبي
            </div>
          </div>

          ${unifiedFooterHtml(cutoutStyles)}
        </div>
      </body>
      </html>
    `;


  return htmlContent;
}
