import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml, formatDateForPrint } from '@/lib/unifiedInvoiceBase';

interface PrintTaskItem {
  id: string;
  description: string;
  width: number;
  height: number;
  area: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  design_face_a: string | null;
  design_face_b: string | null;
  has_cutout?: boolean | null;
  cutout_quantity?: number;
  billboard_id?: number;
}

interface SizeInfo {
  width: number | null;
  height: number | null;
}

interface CustomerInvoiceProps {
  customerName: string;
  items: PrintTaskItem[];
  customerPrice: number;
  customerPricePerMeter?: number;
  designs: Array<{ url: string; face: 'a' | 'b' }>;
  modelLink?: string;
  cutoutCost?: number;
  cutoutPricePerUnit?: number;
}

export function CustomerInvoice({
  customerName,
  items,
  customerPrice,
  customerPricePerMeter = 20,
  designs,
  modelLink,
  cutoutCost = 0,
  cutoutPricePerUnit = 0
}: CustomerInvoiceProps) {
  const [billboardSizes, setBillboardSizes] = useState<Record<number, SizeInfo>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBillboardSizes();
  }, [items]);

  const loadBillboardSizes = async () => {
    const billboardIds = items
      .map(item => item.billboard_id)
      .filter((id): id is number => id != null);
    
    if (billboardIds.length === 0) return;
    
    setLoading(true);
    try {
      // جلب المقاسات من جدول sizes
      const { data: sizesData } = await supabase
        .from('sizes')
        .select('id, name, width, height');
      
      const sizesMap: Record<string, SizeInfo> = {};
      if (sizesData) {
        sizesData.forEach((size: any) => {
          sizesMap[size.name] = { width: size.width, height: size.height };
        });
      }
      
      // جلب بيانات اللوحات للحصول على أسماء المقاسات
      const { data: billboardsData } = await supabase
        .from('billboards')
        .select('ID, Size')
        .in('ID', billboardIds);
      
      const billboardSizesMap: Record<number, SizeInfo> = {};
      if (billboardsData) {
        billboardsData.forEach((b: any) => {
          const sizeInfo = sizesMap[b.Size];
          billboardSizesMap[b.ID] = sizeInfo || { width: null, height: null };
        });
      }
      
      setBillboardSizes(billboardSizesMap);
    } catch (error) {
      console.error('Error loading billboard sizes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {

    // جلب إعدادات القالب المحفوظة
    const styles = await getMergedInvoiceStylesAsync('customer_invoice');
    const baseUrl = window.location.origin;
    const logoUrl = styles.logoPath || '/logofaresgold.svg';
    const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;

    const invoiceNumber = `INV-${Date.now()}`;
    const invoiceDate = formatDateForPrint(new Date().toISOString(), styles.showHijriDate);

    const metaLinesHtml = `
      رقم الفاتورة: ${invoiceNumber}<br/>
      التاريخ: ${invoiceDate}
    `;

    const headerHtml = unifiedHeaderHtml({
      styles,
      fullLogoUrl,
      metaLinesHtml,
      titleEn: 'CUSTOMER INVOICE'
    });

    const footerHtml = unifiedFooterHtml(styles, 'صفحة 1 من 1');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>فاتورة الزبون</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
          @font-face { font-family: 'Manrope'; src: url('${baseUrl}/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
          @font-face { font-family: 'Doran'; src: url('${baseUrl}/Doran-Regular.otf') format('opentype'); font-weight: 400; }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html, body {
            width: 210mm;
            min-height: 297mm;
            font-family: '${styles.fontFamily || 'Doran'}', 'Noto Sans Arabic', Arial, sans-serif;
            direction: rtl;
            text-align: right;
            background: white;
            color: #000;
            font-size: ${styles.bodyFontSize || 11}px;
            line-height: 1.3;
          }
          
          @page {
            size: A4 portrait;
            margin: ${styles.pageMarginTop || 10}mm ${styles.pageMarginRight || 10}mm ${styles.pageMarginBottom || 10}mm ${styles.pageMarginLeft || 10}mm;
          }
          
          .invoice-container {
            width: 210mm;
            min-height: 297mm;
            padding: ${styles.pageMarginTop || 10}mm;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
          }
          
          ${unifiedHeaderFooterCss(styles)}
          
          .content-area {
            flex: 1;
          }
          
          .customer-section {
            background: ${styles.customerSectionBgColor || '#f8f9fa'};
            padding: 18px;
            border-radius: 8px;
            margin-bottom: 18px;
            border-right: 4px solid ${styles.customerSectionBorderColor || styles.primaryColor || '#D4AF37'};
          }

          .section-title {
            font-size: ${styles.headerFontSize || 14}px;
            font-weight: bold;
            color: ${styles.customerSectionTitleColor || styles.primaryColor || '#D4AF37'};
            margin-bottom: 12px;
            text-align: center;
          }

          .info-box {
            background: white;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid ${styles.tableBorderColor || '#ddd'};
            margin-bottom: 8px;
          }

          .info-label {
            font-size: 11px;
            color: ${styles.customerSectionTextColor || '#333'};
            font-weight: bold;
            margin-bottom: 4px;
          }

          .info-value {
            font-size: 13px;
            color: ${styles.customerSectionTextColor || '#333'};
          }

          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: ${styles.bodyFontSize || 11}px;
          }

          .items-table th {
            background: ${styles.tableHeaderBgColor || styles.primaryColor || '#D4AF37'};
            color: ${styles.tableHeaderTextColor || '#fff'};
            font-weight: bold;
            padding: 10px;
            text-align: center;
            border: ${styles.tableBorderWidth || 1}px ${styles.tableBorderStyle || 'solid'} ${styles.tableBorderColor || styles.primaryColor || '#D4AF37'};
          }

          .items-table td {
            padding: 8px;
            border: ${styles.tableBorderWidth || 1}px ${styles.tableBorderStyle || 'solid'} ${styles.tableBorderColor || '#ddd'};
            text-align: center;
            vertical-align: middle;
            color: ${styles.tableTextColor || '#333'};
          }

          .items-table tbody tr:nth-child(even) {
            background: ${styles.tableRowEvenColor || '#f8f9fa'};
          }
          
          .items-table tbody tr:nth-child(odd) {
            background: ${styles.tableRowOddColor || '#ffffff'};
          }

          .design-image {
            max-width: 60px;
            max-height: 60px;
            object-fit: contain;
            margin: 0 auto;
            display: block;
            border: 1px solid ${styles.tableBorderColor || '#ddd'};
            border-radius: 4px;
          }

          .summary-section {
            margin-top: auto;
            padding: 18px;
            background: ${styles.customerSectionBgColor || '#f8f9fa'};
            border: 2px solid ${styles.primaryColor || '#D4AF37'};
            border-radius: 8px;
          }

          .summary-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            background: white;
            border-radius: 4px;
            border: 1px solid ${styles.tableBorderColor || '#ddd'};
            margin-bottom: 8px;
          }

          .summary-label {
            font-weight: bold;
            font-size: 12px;
            color: ${styles.subtotalTextColor || '#333'};
          }

          .summary-value {
            font-weight: bold;
            font-size: 14px;
            color: ${styles.subtotalTextColor || '#333'};
          }

          .total-row {
            background: ${styles.totalBgColor || styles.primaryColor || '#D4AF37'};
            color: ${styles.totalTextColor || '#fff'};
            padding: 12px;
            text-align: center;
            border-radius: 6px;
            font-size: 16px;
            font-weight: bold;
            margin-top: 10px;
          }

          .designs-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-top: 10px;
          }

          .design-item {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 5px;
            text-align: center;
          }

          .design-item img {
            max-width: 100%;
            height: 80px;
            object-fit: contain;
          }

          .design-label {
            font-size: 10px;
            color: #666;
            margin-top: 4px;
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
          ${headerHtml}
          
          <div class="content-area">

          <div class="customer-section">
            <div class="section-title">بيانات العميل</div>
            <div class="info-box">
              <div class="info-label">اسم العميل:</div>
              <div class="info-value">${customerName || 'غير محدد'}</div>
            </div>
            ${modelLink ? `
            <div class="info-box">
              <div class="info-label">رابط المجسمات:</div>
              <div class="info-value" style="word-break: break-all; font-size: 10px;">${modelLink}</div>
            </div>
            ` : ''}
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 60px;">التصميم</th>
                <th style="width: 70px;">المقاس</th>
                <th style="width: 60px;">الكمية</th>
                <th style="width: 70px;">المساحة</th>
                <th style="width: 60px;">سعر المتر</th>
                <th style="width: 80px;">تكلفة الطباعة</th>
                <th style="width: 60px;">المجسمات</th>
                <th style="width: 70px;">تكلفة القص</th>
                <th style="width: 80px;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const totalArea = items.reduce((sum, item) => sum + (item.area * item.quantity), 0);
                const pricePerMeter = customerPricePerMeter || (totalArea > 0 ? customerPrice / totalArea : 0);
                
                // Build cutouts map by billboard_id
                const cutoutsByBillboard = new Map();
                items.forEach(item => {
                  if (item.has_cutout && item.cutout_quantity && item.billboard_id) {
                    if (!cutoutsByBillboard.has(item.billboard_id)) {
                      cutoutsByBillboard.set(item.billboard_id, {
                        count: item.cutout_quantity,
                        used: false
                      });
                    }
                  }
                });
                
                // Build rows with both faces
                const rows: string[] = [];
                items.forEach(item => {
                  // استخدام المقاسات الفعلية من جدول sizes إذا وجدت
                  const sizeInfo = item.billboard_id ? billboardSizes[item.billboard_id] : null;
                  const displayWidth = sizeInfo?.width || item.width;
                  const displayHeight = sizeInfo?.height || item.height;
                  
                  const itemTotalArea = item.area * item.quantity;
                  const printCost = itemTotalArea * pricePerMeter;
                  
                  // Check if this billboard has cutout and if we haven't shown it yet
                  const billboardCutout = cutoutsByBillboard.get(item.billboard_id);
                  const showCutout = billboardCutout && !billboardCutout.used;
                  
                  if (showCutout) {
                    billboardCutout.used = true; // Mark as used
                  }
                  
                  const cutoutCount = showCutout ? billboardCutout.count : 0;
                  const cutoutItemCost = showCutout ? (cutoutCount * (cutoutPricePerUnit || 0)) : 0;
                  
                  // If both faces exist, show them both in one row with cutout info only once
                  if (item.design_face_a && item.design_face_b) {
                    // Front face with cutout
                    const designImgA = '<img src="' + item.design_face_a + '" class="design-image" onerror="this.style.display=\'none\'" />';
                    rows.push(
                      '<tr>' +
                        '<td>' + designImgA + '<div style="font-size: 9px; color: #666; margin-top: 2px;">وجه أمامي</div></td>' +
                        '<td>' + displayWidth + '×' + displayHeight + ' م</td>' +
                        '<td><strong>×' + item.quantity + '</strong></td>' +
                        '<td>' + itemTotalArea.toFixed(2) + ' م²</td>' +
                        '<td>' + pricePerMeter.toFixed(2) + ' د.ل</td>' +
                        '<td><strong>' + printCost.toFixed(2) + ' د.ل</strong></td>' +
                        '<td>' + (showCutout ? '×' + cutoutCount : 'لا يوجد') + '</td>' +
                        '<td>' + (showCutout ? cutoutItemCost.toFixed(2) + ' د.ل' : '-') + '</td>' +
                        '<td><strong>' + (printCost + cutoutItemCost).toFixed(2) + ' د.ل</strong></td>' +
                      '</tr>'
                    );
                    
                    // Back face without cutout (already counted above)
                    const designImgB = '<img src="' + item.design_face_b + '" class="design-image" onerror="this.style.display=\'none\'" />';
                    rows.push(
                      '<tr>' +
                        '<td>' + designImgB + '<div style="font-size: 9px; color: #666; margin-top: 2px;">وجه خلفي</div></td>' +
                        '<td>' + displayWidth + '×' + displayHeight + ' م</td>' +
                        '<td><strong>×' + item.quantity + '</strong></td>' +
                        '<td>' + itemTotalArea.toFixed(2) + ' م²</td>' +
                        '<td>' + pricePerMeter.toFixed(2) + ' د.ل</td>' +
                        '<td><strong>' + printCost.toFixed(2) + ' د.ل</strong></td>' +
                        '<td>-</td>' +
                        '<td>-</td>' +
                        '<td><strong>' + printCost.toFixed(2) + ' د.ل</strong></td>' +
                      '</tr>'
                    );
                  } else if (item.design_face_a) {
                    // Only front face
                    const designImgA = '<img src="' + item.design_face_a + '" class="design-image" onerror="this.style.display=\'none\'" />';
                    rows.push(
                      '<tr>' +
                        '<td>' + designImgA + '</td>' +
                        '<td>' + displayWidth + '×' + displayHeight + ' م</td>' +
                        '<td><strong>×' + item.quantity + '</strong></td>' +
                        '<td>' + itemTotalArea.toFixed(2) + ' م²</td>' +
                        '<td>' + pricePerMeter.toFixed(2) + ' د.ل</td>' +
                        '<td><strong>' + printCost.toFixed(2) + ' د.ل</strong></td>' +
                        '<td>' + (showCutout ? '×' + cutoutCount : 'لا يوجد') + '</td>' +
                        '<td>' + (showCutout ? cutoutItemCost.toFixed(2) + ' د.ل' : '-') + '</td>' +
                        '<td><strong>' + (printCost + cutoutItemCost).toFixed(2) + ' د.ل</strong></td>' +
                      '</tr>'
                    );
                  } else if (item.design_face_b) {
                    // Only back face
                    const designImgB = '<img src="' + item.design_face_b + '" class="design-image" onerror="this.style.display=\'none\'" />';
                    rows.push(
                      '<tr>' +
                        '<td>' + designImgB + '</td>' +
                        '<td>' + displayWidth + '×' + displayHeight + ' م</td>' +
                        '<td><strong>×' + item.quantity + '</strong></td>' +
                        '<td>' + itemTotalArea.toFixed(2) + ' م²</td>' +
                        '<td>' + pricePerMeter.toFixed(2) + ' د.ل</td>' +
                        '<td><strong>' + printCost.toFixed(2) + ' د.ل</strong></td>' +
                        '<td>' + (showCutout ? '×' + cutoutCount : 'لا يوجد') + '</td>' +
                        '<td>' + (showCutout ? cutoutItemCost.toFixed(2) + ' د.ل' : '-') + '</td>' +
                        '<td><strong>' + (printCost + cutoutItemCost).toFixed(2) + ' د.ل</strong></td>' +
                      '</tr>'
                    );
                  }
                });
                
                return rows.join('');
              })()}
            </tbody>
          </table>
          
          <style>
            .design-image {
              max-width: 50px;
              max-height: 50px;
              object-fit: contain;
              margin: 0 auto;
              display: block;
              border: 1px solid #ddd;
              border-radius: 4px;
            }
          </style>

          ${designs && designs.length > 0 ? `
          <div class="customer-section">
            <div class="section-title">التصاميم المرفقة</div>
            <div class="designs-grid">
              ${designs.map((design, idx) => `
                <div class="design-item">
                  <img src="${design.url}" onerror="this.style.display='none'" />
                  <div class="design-label">${design.face === 'a' ? 'وجه أمامي' : 'وجه خلفي'}</div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <div class="summary-section">
            ${(() => {
              // حساب تكلفة القص من items
              const cutoutsMap = new Map();
              items.forEach(item => {
                if (item.has_cutout && item.cutout_quantity && item.billboard_id) {
                  cutoutsMap.set(item.billboard_id, item.cutout_quantity);
                }
              });
              const totalCutouts = Array.from(cutoutsMap.values()).reduce((sum, count) => sum + count, 0);
              const cutoutTotal = totalCutouts * (cutoutPricePerUnit || 0);
              const printTotal = items.reduce((sum, item) => sum + (item.area * item.quantity), 0) * (customerPricePerMeter || (items.reduce((sum, item) => sum + (item.area * item.quantity), 0) > 0 ? customerPrice / items.reduce((sum, item) => sum + (item.area * item.quantity), 0) : 0));
              
              return '<div class="summary-item"><span class="summary-label">تكلفة الطباعة (' + items.reduce((sum, item) => sum + (item.area * item.quantity), 0).toFixed(2) + ' م² × ' + (customerPricePerMeter || (items.reduce((sum, item) => sum + (item.area * item.quantity), 0) > 0 ? customerPrice / items.reduce((sum, item) => sum + (item.area * item.quantity), 0) : 0)).toFixed(2) + ')</span><span class="summary-value">' + printTotal.toLocaleString() + ' د.ل</span></div>' + 
              (totalCutouts > 0 && cutoutTotal > 0 ? '<div class="summary-item"><span class="summary-label">تكلفة القص (' + totalCutouts + ' مجسم × ' + (cutoutPricePerUnit || 0).toFixed(2) + ' د.ل)</span><span class="summary-value">' + cutoutTotal.toLocaleString() + ' د.ل</span></div>' : '');
            })()}
            <div class="total-row">
              الإجمالي المطلوب: ${customerPrice.toLocaleString()} دينار ليبي
            </div>
          </div>
          </div>

          ${footerHtml}
        </div>
      </body>
      </html>
    `;

    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(htmlContent, `فاتورة الزبون - ${customerName}`);
  };

  return (
    <Button onClick={handlePrint} className="gap-2 w-full" disabled={loading}>
      <Printer className="h-4 w-4" />
      {loading ? 'جاري التحميل...' : 'طباعة فاتورة الزبون'}
    </Button>
  );
}
