import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface DesignGroup {
  design: string;
  face: 'a' | 'b';
  size: string;
  quantity: number;
  area: number;
  billboards: number[];
  width: number;
  height: number;
  hasCutout?: boolean;
  cutoutCount?: number;
  cutoutImageUrl?: string;
}

interface PrintTaskInvoiceProps {
  designGroups: DesignGroup[];
  pricePerMeter: number;
  cutoutPricePerUnit: number;
  printerName?: string;
  cutoutPrinterName?: string;
  totalArea: number;
  totalCutouts: number;
  showPrices?: boolean;
}

export function PrintTaskInvoice({
  designGroups,
  pricePerMeter,
  cutoutPricePerUnit,
  printerName,
  cutoutPrinterName,
  totalArea,
  totalCutouts,
  showPrices = true
}: PrintTaskInvoiceProps) {
  const printCost = totalArea * pricePerMeter;
  const cutoutsCost = totalCutouts * cutoutPricePerUnit;
  const totalCost = printCost + cutoutsCost;

  const handlePrint = async () => {

    const baseUrl = window.location.origin;
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>فاتورة مهمة طباعة</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html, body {
            width: 210mm;
            height: 297mm;
            font-family: 'Noto Sans Arabic', Arial, sans-serif;
            direction: rtl;
            text-align: right;
            background: white;
            color: #000;
            font-size: 10px;
            line-height: 1.2;
            overflow: hidden;
          }
          
          @page {
            size: A4 portrait;
            margin: 0;
          }
          
          .invoice-container {
            width: 210mm;
            min-height: 297mm;
            max-height: 297mm;
            padding: 6mm;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-sizing: border-box;
          }
          
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          
          .invoice-info {
            text-align: left;
            direction: ltr;
            order: 2;
          }
          
          .invoice-title {
            font-size: 24px;
            font-weight: bold;
            color: #000;
            margin-bottom: 8px;
          }
          
          .invoice-subtitle {
            font-size: 13px;
            color: #666;
            font-weight: bold;
            margin-bottom: 8px;
          }
          
          .invoice-details {
            font-size: 11px;
            color: #666;
            line-height: 1.5;
          }
          
          .company-info {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            text-align: right;
            order: 1;
          }
          
          .company-logo {
            max-width: 450px;
            height: auto;
            object-fit: contain;
            margin-bottom: 8px;
          }

          .printer-section {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 12px;
            border: 2px solid #000;
          }

          .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #000;
            margin-bottom: 8px;
            text-align: center;
          }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .info-box {
            background: white;
            padding: 6px;
            border-radius: 4px;
            border: 1px solid #ddd;
          }

          .info-label {
            font-size: 10px;
            color: #000;
            font-weight: bold;
            margin-bottom: 3px;
          }

          .info-value {
            font-size: 11px;
            color: #000;
          }

          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 10px;
          }

          .items-table th {
            background: #000;
            color: #fff;
            font-weight: bold;
            padding: 6px 4px;
            text-align: center;
            border: 1px solid #000;
            font-size: 10px;
          }

          .items-table td {
            padding: 6px 4px;
            border: 1px solid #ddd;
            text-align: center;
            vertical-align: middle;
            font-size: 9px;
          }

          .items-table tbody tr:nth-child(even) {
            background: #f8f9fa;
          }

          .design-image {
            max-width: 50px;
            max-height: 40px;
            object-fit: contain;
            margin: 0 auto;
            display: block;
            border: 1px solid #ddd;
            border-radius: 4px;
          }

          .cutout-badge {
            display: inline-block;
            background: #fee2e2;
            color: #dc2626;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 8px;
            font-weight: bold;
            margin-top: 3px;
          }

          .summary-section {
            margin-top: auto;
            padding: 12px;
            background: #f8f9fa;
            border: 2px solid #000;
            border-radius: 8px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 10px;
          }

          .summary-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px;
            background: white;
            border-radius: 4px;
            border: 1px solid #ddd;
          }

          .summary-label {
            font-weight: bold;
            font-size: 10px;
          }

          .summary-value {
            font-weight: bold;
            font-size: 12px;
            color: #000;
          }

          .total-row {
            grid-column: 1 / -1;
            background: #000;
            color: white;
            padding: 10px;
            text-align: center;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            margin-top: 8px;
          }

          .footer {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 2px solid #000;
            text-align: center;
            font-size: 10px;
            color: #666;
          }

          @media print {
            html, body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
              width: 210mm !important;
              height: 297mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }

            .invoice-container {
              width: 210mm !important;
              height: 297mm !important;
              padding: 8mm !important;
              box-sizing: border-box;
              page-break-after: avoid;
              overflow: hidden !important;
            }

            .items-table {
              page-break-inside: avoid;
              font-size: 9px !important;
            }
            
            .items-table td, .items-table th {
              padding: 4px !important;
            }
            
            .summary-section {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="company-info">
              <img src="${baseUrl}/logofaresgold.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
            </div>
            <div class="invoice-info">
              <div class="invoice-title">فاتورة طباعة</div>
              <div class="invoice-subtitle">Print Task Invoice</div>
              <div class="invoice-details">
                <div><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-LY')}</div>
                <div><strong>رقم الفاتورة:</strong> PT-${Date.now()}</div>
              </div>
            </div>
          </div>

          <div class="printer-section">
            <div class="section-title">معلومات المطبعة</div>
            <div class="info-grid">
              <div class="info-box">
                <div class="info-label">المطبعة الرئيسية:</div>
                <div class="info-value">${printerName || 'غير محدد'}</div>
              </div>
              ${totalCutouts > 0 ? `
              <div class="info-box">
                <div class="info-label">مطبعة المجسمات:</div>
                <div class="info-value">${cutoutPrinterName || printerName || 'غير محدد'}</div>
              </div>
              ` : ''}
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 60px;">التصميم</th>
                <th style="width: 100px;">المقاس</th>
                <th>الوجه</th>
                <th style="width: 70px;">مجسمات</th>
                <th style="width: 60px;">الكمية</th>
                <th style="width: 80px;">المساحة/وحدة</th>
                <th style="width: 90px;">إجمالي المساحة</th>
                ${showPrices ? '<th style="width: 90px;">تكلفة الطباعة</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${designGroups.map(group => `
                <tr>
                  <td>
                    ${group.design ? `<img src="${group.design}" class="design-image" onerror="this.style.display='none'" />` : '-'}
                    ${group.hasCutout && group.cutoutImageUrl ? `<br><img src="${group.cutoutImageUrl}" class="design-image" style="margin-top: 4px;" onerror="this.style.display='none'" />` : ''}
                  </td>
                  <td><strong>${group.size}</strong></td>
                  <td>${group.face === 'a' ? 'أمامي' : 'خلفي'}</td>
                  <td>${group.hasCutout ? '<span style="background: #fee2e2; color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">يحتوي على مجسم</span>' : '-'}</td>
                  <td><strong>×${group.quantity}</strong></td>
                  <td>${group.area.toFixed(2)} م²</td>
                  <td><strong>${(group.area * group.quantity).toFixed(2)} م²</strong></td>
                  ${showPrices ? `<td><strong>${(group.area * group.quantity * pricePerMeter).toFixed(2)} د.ل</strong></td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${showPrices && (printCost > 0 || cutoutsCost > 0) ? `
          <div class="summary-section">
            <div class="summary-grid">
              <div class="summary-item">
                <span class="summary-label">إجمالي المساحة:</span>
                <span class="summary-value">${totalArea.toFixed(2)} م²</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">سعر المتر:</span>
                <span class="summary-value">${pricePerMeter.toFixed(2)} د.ل</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">تكلفة الطباعة:</span>
                <span class="summary-value">${printCost.toFixed(2)} د.ل</span>
              </div>
              ${totalCutouts > 0 && cutoutsCost > 0 ? `
              <div class="summary-item">
                <span class="summary-label">عدد المجسمات:</span>
                <span class="summary-value">${totalCutouts}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">سعر المجسم:</span>
                <span class="summary-value">${cutoutPricePerUnit.toFixed(2)} د.ل</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">تكلفة المجسمات:</span>
                <span class="summary-value">${cutoutsCost.toFixed(2)} د.ل</span>
              </div>
              ` : ''}
            </div>
            <div class="total-row">
              الإجمالي الكلي: ${totalCost.toFixed(2)} دينار ليبي
            </div>
          </div>
          ` : ''}

          <div class="footer">
            <div><strong>شكراً لتعاملكم معنا</strong></div>
            <div>هذه الفاتورة تم إنشاؤها تلقائياً من نظام إدارة اللوحات</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(htmlContent, `فاتورة طباعة - ${printerName || ''}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">معاينة فاتورة الطباعة</h3>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          طباعة فاتورة المطبعة
        </Button>
      </div>
      
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="text-sm text-muted-foreground mb-2">
          سيتم طباعة فاتورة بصيغة A4 تحتوي على {designGroups.length} تصميم
        </div>
      </div>
    </div>
  );
}
