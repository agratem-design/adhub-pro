import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Download, Printer } from 'lucide-react';
import { getMergedInvoiceStylesAsync, hexToRgba } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml, formatDateForPrint } from '@/lib/unifiedInvoiceBase';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';
interface ContractInvoiceDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: any;
}

// ✅ Currency options
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£', writtenName: 'جنيه إسترليني' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', writtenName: 'ريال سعودي' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', writtenName: 'درهم إماراتي' },
];

export default function ContractInvoiceDialog({ open, onOpenChange, contract }: ContractInvoiceDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [customerData, setCustomerData] = useState<{
    name: string;
    company: string | null;
    phone: string | null;
  } | null>(null);

  // Get currency information from contract
  const getCurrencyInfo = () => {
    const currencyCode = contract?.contract_currency || 'LYD';
    const currency = CURRENCIES.find(c => c.code === currencyCode);
    return {
      code: currencyCode,
      symbol: currency?.symbol || 'د.ل',
      name: currency?.name || 'دينار ليبي',
      writtenName: currency?.writtenName || 'دينار ليبي'
    };
  };

  // Load customer data when dialog opens
  useEffect(() => {
    if (open && contract) {
      loadCustomerData();
    }
  }, [open, contract]);

  const loadCustomerData = async () => {
    try {
      const customerId = contract?.customer_id;
      const customerName = contract?.customer_name || contract?.['Customer Name'] || '';
      
      if (customerId) {
        const { data, error } = await supabase
          .from('customers')
          .select('name, company, phone')
          .eq('id', customerId)
          .single();
        
        if (!error && data) {
          setCustomerData({
            name: data.name || customerName,
            company: data.company,
            phone: data.phone
          });
          return;
        }
      }
      
      // Fallback: try to find customer by name
      if (customerName) {
        const { data, error } = await supabase
          .from('customers')
          .select('name, company, phone')
          .ilike('name', customerName)
          .limit(1)
          .single();
        
        if (!error && data) {
          setCustomerData({
            name: data.name || customerName,
            company: data.company,
            phone: data.phone
          });
          return;
        }
      }
      
      // Final fallback: use contract data only
      setCustomerData({
        name: customerName,
        company: null,
        phone: null
      });
      
    } catch (error) {
      console.error('Error loading customer data:', error);
      setCustomerData({
        name: contract?.customer_name || contract?.['Customer Name'] || '',
        company: null,
        phone: null
      });
    }
  };

  // Generate invoice HTML (shared function)
  const generateInvoiceHTML = async () => {
    if (!contract || !customerData) {
      throw new Error('لا توجد بيانات عقد أو عميل');
    }

    // ✅ جلب إعدادات القالب المحفوظة (async) من النظام الموحد
    const styles = await getMergedInvoiceStylesAsync('contract');
    const baseUrl = window.location.origin;
    const logoUrl = styles.logoPath || '/logofaresgold.svg';

    const currencyInfo = getCurrencyInfo();
    const currentDate = formatDateForPrint(new Date().toISOString(), styles.showHijriDate);
    
    // Get billboards data
    let billboardsToShow = [];
    const billboardIds = contract?.billboard_ids;
    if (billboardIds) {
      try {
        const idsArray = typeof billboardIds === 'string' 
          ? billboardIds.split(',').map(id => id.trim()).filter(Boolean)
          : Array.isArray(billboardIds) ? billboardIds : [];

        if (idsArray.length > 0) {
          const { data: billboardsData, error } = await supabase
            .from('billboards')
            .select('*')
            .in('ID', idsArray);

          if (!error && billboardsData && billboardsData.length > 0) {
            billboardsToShow = billboardsData;
          }
        }
      } catch (e) {
        console.warn('Failed to parse billboard_ids:', e);
      }
    }

    // Get billboard prices from contract
    let billboardPrices = {};
    if (contract?.billboard_prices) {
      try {
        const pricesData = typeof contract.billboard_prices === 'string' 
          ? JSON.parse(contract.billboard_prices) 
          : contract.billboard_prices;
        
        if (Array.isArray(pricesData)) {
          billboardPrices = pricesData.reduce((acc, item) => {
            acc[item.billboardId] = item.contractPrice;
            return acc;
          }, {});
        }
      } catch (e) {
        console.warn('Failed to parse billboard_prices:', e);
      }
    }

    // Prepare invoice items
    const invoiceItems = billboardsToShow.map(b => {
      const id = String(b.ID || b.id);
      const name = b.Billboard_Name || b.name || `لوحة ${id}`;
      const size = b.Size || b.size || '';
      const location = b.Nearest_Landmark || b.location || b.Municipality || '';
      const quantity = 1;
      const unitPrice = billboardPrices[id] || 0;
      const total = quantity * unitPrice;

      return {
        description: `${name} - ${size}${location ? ` - ${location}` : ''}`,
        quantity,
        unitPrice: unitPrice.toLocaleString('ar-LY'),
        total: total.toLocaleString('ar-LY')
      };
    });

    const finalTotal = contract?.Total || contract?.total_cost || 0;
    const printCostEnabled = Boolean(contract?.print_cost_enabled);
    const printCostText = printCostEnabled ? 'شاملة تكاليف الطباعة' : 'غير شاملة تكاليف الطباعة';

    // ✅ استخراج الألوان من النظام الموحد
    const pc = styles.primaryColor || '#D4AF37';
    const sc = styles.secondaryColor || '#1a1a2e';
    const thBg = styles.tableHeaderBgColor || pc;
    const thText = styles.tableHeaderTextColor || '#ffffff';
    const tBorder = styles.tableBorderColor || '#eee';
    const rowEven = styles.tableRowEvenColor || '#f8f9fa';
    const rowOdd = styles.tableRowOddColor || '#ffffff';
    const tableText = styles.tableTextColor || '#333333';
    const custBg = styles.customerSectionBgColor || '#f8f9fa';
    const custBorder = styles.customerSectionBorderColor || pc;
    const custTitle = styles.customerSectionTitleColor || pc;
    const custText = styles.customerSectionTextColor || '#555';
    const totalBg = styles.totalBgColor || pc;
    const totalText = styles.totalTextColor || '#ffffff';
    const fontFamily = styles.fontFamily || 'Doran';
    const titleFontSize = styles.titleFontSize || 24;
    const headerFontSize = styles.headerFontSize || 14;
    const bodyFontSize = styles.bodyFontSize || 12;
    const pageMarginTop = styles.pageMarginTop || 15;
    const pageMarginBottom = styles.pageMarginBottom || 15;
    const pageMarginLeft = styles.pageMarginLeft || 15;
    const pageMarginRight = styles.pageMarginRight || 15;

    // Generate invoice HTML
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>فاتورة عقد ${contract?.id || ''}</title>
        <style>
          @font-face { font-family: 'Doran'; src: url('${baseUrl}/Doran-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Doran'; src: url('${baseUrl}/Doran-Bold.otf') format('opentype'); font-weight: 700; }
          @font-face { font-family: 'Manrope'; src: url('${baseUrl}/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Manrope'; src: url('${baseUrl}/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          body {
            font-family: '${fontFamily}', 'Noto Sans Arabic', Arial, sans-serif;
            direction: rtl;
            background: white;
            color: ${tableText};
            line-height: 1.6;
          }
          
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            padding: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm;
            background: white;
          }
          
          ${unifiedHeaderFooterCss(styles)}
          
          .invoice-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
          }
          
          .client-info, .invoice-info {
            background: ${custBg};
            padding: 20px;
            border-radius: 8px;
            border-right: 4px solid ${custBorder};
          }
          
          .section-title {
            font-size: ${headerFontSize}px;
            font-weight: bold;
            color: ${custTitle};
            margin-bottom: 15px;
            padding-bottom: 5px;
            border-bottom: 1px solid ${custBorder};
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: ${bodyFontSize}px;
          }
          
          .info-label {
            font-weight: bold;
            color: ${custText};
          }
          
          .info-value {
            color: ${tableText};
          }
          
          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          
          .invoice-table th {
            background: ${thBg};
            color: ${thText};
            padding: 15px 10px;
            text-align: center;
            font-weight: bold;
            font-size: ${bodyFontSize}px;
          }
          
          .invoice-table td {
            padding: 12px 10px;
            text-align: center;
            border-bottom: 1px solid ${tBorder};
            font-size: ${bodyFontSize}px;
            color: ${tableText};
          }
          
          .invoice-table tbody tr:nth-child(even) {
            background-color: ${rowEven};
          }
          
          .invoice-table tbody tr:nth-child(odd) {
            background-color: ${rowOdd};
          }
          
          .description-cell {
            text-align: right !important;
            max-width: 300px;
          }
          
          .invoice-summary {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
          }
          
          .summary-table {
            width: 300px;
            border-collapse: collapse;
          }
          
          .summary-table td {
            padding: 10px 15px;
            border: 1px solid ${tBorder};
            font-size: ${bodyFontSize}px;
          }
          
          .summary-table .label {
            background: ${rowEven};
            font-weight: bold;
            text-align: right;
            width: 60%;
          }
          
          .summary-table .value {
            text-align: center;
            font-weight: bold;
          }
          
          .total-row-summary {
            background: ${totalBg} !important;
            color: ${totalText} !important;
            font-size: ${headerFontSize}px !important;
            font-weight: bold !important;
          }
          
          .total-row-summary td {
            color: ${totalText} !important;
          }
          
          .invoice-footer-section {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid ${pc};
            text-align: center;
          }
          
          .footer-note {
            background: ${custBg};
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: ${bodyFontSize}px;
            color: ${custText};
            border-right: 4px solid ${pc};
          }
          
          .company-stamp {
            margin-top: 30px;
            text-align: center;
          }
          
          .stamp-circle {
            width: 120px;
            height: 120px;
            border: 3px solid ${pc};
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            color: ${pc};
            text-align: center;
            line-height: 1.2;
          }
          
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .invoice-container {
              max-width: none;
              margin: 0;
              padding: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm;
            }
            @page {
              size: A4;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
 <!-- Header from unified system -->
          ${unifiedHeaderHtml({
            styles,
            fullLogoUrl: styles.showLogo !== false ? (styles.logoPath ? `${baseUrl}${styles.logoPath}` : `${baseUrl}/logofaresgold.svg`) : `${baseUrl}/logofaresgold.svg`,
            metaLinesHtml: `
              <div><strong>التاريخ:</strong> ${currentDate}</div>
              <div><strong>رقم العقد:</strong> ${contract?.id || contract?.Contract_Number || ''}</div>
            `,
            titleAr: 'فاتورة مبيعات',
            titleEn: 'SALES INVOICE',
          })}

          <!-- Invoice Details -->
          <div class="invoice-details">
            <div class="client-info">
              <div class="section-title">المطلوب من السادة:</div>
              <div class="info-row">
                <span class="info-label">اسم العميل:</span>
                <span class="info-value">${customerData.name}</span>
              </div>
              ${customerData.company ? `
              <div class="info-row">
                <span class="info-label">الشركة:</span>
                <span class="info-value">${customerData.company}</span>
              </div>
              ` : ''}
              ${customerData.phone ? `
              <div class="info-row">
                <span class="info-label">الهاتف:</span>
                <span class="info-value">${customerData.phone}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="invoice-info">
              <div class="section-title">بيانات الفاتورة:</div>
              <div class="info-row">
                <span class="info-label">التاريخ:</span>
                <span class="info-value">${currentDate}</span>
              </div>
              <div class="info-row">
                <span class="info-label">رقم العقد:</span>
                <span class="info-value">${contract?.id || contract?.Contract_Number || ''}</span>
              </div>
              <div class="info-row">
                <span class="info-label">العملة:</span>
                <span class="info-value">${currencyInfo.name}</span>
              </div>
            </div>
          </div>

          <!-- Invoice Table -->
          <table class="invoice-table">
            <thead>
              <tr>
                <th style="width: 15%">الإجمالي بـ${currencyInfo.symbol}</th>
                <th style="width: 15%">سعر الوحدة بـ${currencyInfo.symbol}</th>
                <th style="width: 10%">الكمية</th>
                <th style="width: 60%">البيــــــان</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceItems.map(item => `
                <tr>
                  <td>${item.total}</td>
                  <td>${item.unitPrice}</td>
                  <td>${item.quantity}</td>
                  <td class="description-cell">${item.description}</td>
                </tr>
              `).join('')}
              ${Array.from({ length: Math.max(0, 10 - invoiceItems.length) }, () => `
                <tr>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Summary -->
          <div class="invoice-summary">
            <table class="summary-table">
              <tr class="total-row-summary">
                <td class="label">الإجمالي بـ${currencyInfo.symbol}</td>
                <td class="value">${finalTotal.toLocaleString('ar-LY')}</td>
              </tr>
            </table>
          </div>

          <!-- Footer -->
          <div class="invoice-footer-section">
            <div class="footer-note">
              <strong>ملاحظة:</strong> هذه الفاتورة خاصة بعقد إيجار اللوحات الإعلانية ${printCostText}
            </div>
            
            <div class="company-stamp">
              <div class="stamp-circle">
                الختــــم
              </div>
            </div>
          </div>

 <!-- Footer from unified system -->
          ${unifiedFooterHtml(styles)}
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintInvoice = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للطباعة');
      return;
    }

    const docTitle = `فاتورة_عقد_${contract.Contract_Number || contract.id}`;
    const printWindow = preparePrintWindow(docTitle);
    setIsGenerating(true);
    
    try {
      const invoiceHtml = await generateInvoiceHTML();
      
      writePrintWindow(printWindow, invoiceHtml, {
        title: docTitle,
        landscape: false,
        showDownloadPdf: true,
        showShare: true,
        autoPrint: true,
      });

      const currencyInfo = getCurrencyInfo();
      toast.success(`تم فتح فاتورة العقد للطباعة بعملة ${currencyInfo.name}!`);
      onOpenChange(false);

    } catch (error) {
      console.error('Error in handlePrintInvoice:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير الفاتورة للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للتحميل');
      return;
    }

    setIsDownloading(true);
    toast.info('جاري إنشاء ملف PDF...');
    
    try {
      const invoiceHtml = await generateInvoiceHTML();
      const currencyInfo = getCurrencyInfo();
      const contractNumber = contract?.id || contract?.Contract_Number || 'unknown';

      // ======= 🎯 جزئية تحميل فاتورة العقد =======
      const jsPDF = (await import('jspdf')).jsPDF;
      const html2canvas = (await import('html2canvas')).default;

      // ======= 🔧 إعداد عنصر الفاتورة =======
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.height = '297mm';
      container.style.fontFamily = 'Noto Sans Arabic, Doran, Arial, sans-serif';
      container.style.direction = 'rtl';
      container.innerHTML = invoiceHtml;
      
      document.body.appendChild(container);

      // انتظار تحميل المحتوى
      await new Promise(resolve => setTimeout(resolve, 2000));

      // ======= 🎨 تحويل إلى PDF =======
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const invoicePage = container.querySelector('body, .invoice-content, .page') as HTMLElement || container;
      
      const canvas = await html2canvas(invoicePage, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);

      // ======= 💾 حفظ الفاتورة =======
      pdf.save(`فاتورة_عقد_${contractNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      // تنظيف
      document.body.removeChild(container);

      toast.success(`تم تحميل فاتورة العقد بنجاح بعملة ${currencyInfo.name}!`);
      onOpenChange(false);
    } catch (error) {
      console.error('خطأ في تحميل PDF:', error);
      toast.error('حدث خطأ أثناء تحميل PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const currencyInfo = getCurrencyInfo();

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="max-w-lg">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle>طباعة فاتورة العقد</UIDialog.DialogTitle>
        </UIDialog.DialogHeader>
        
        <div className="space-y-4">
          {(isGenerating || isDownloading) ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-semibold">
                {isGenerating ? 'جاري تحضير الفاتورة للطباعة...' : 'جاري تحضير ملف PDF...'}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                {isGenerating ? 'يتم تحميل بيانات العميل وتحضير الفاتورة' : 'يتم إنشاء ملف PDF بتصميم احترافي'}
              </p>
            </div>
          ) : (
            <>
              {/* Currency display */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{currencyInfo.symbol}</div>
                  <div>
                    <div className="font-semibold text-blue-800">عملة الفاتورة: {currencyInfo.name}</div>
                    <div className="text-sm text-blue-600">
                      ستطبع الفاتورة بالعملة المحددة في العقد
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">معاينة بيانات الفاتورة:</h3>
                <div className="text-sm space-y-1">
                  <p><strong>رقم العقد:</strong> {contract?.id || contract?.Contract_Number || 'غير محدد'}</p>
                  <p><strong>العميل:</strong> {customerData?.name || 'غير محدد'}</p>
                  {customerData?.company && (
                    <p><strong>الشركة:</strong> {customerData.company}</p>
                  )}
                  <p><strong>المبلغ الإجمالي:</strong> {(contract?.Total || 0).toLocaleString('ar-LY')} {currencyInfo.symbol}</p>
                  <p><strong>عدد اللوحات:</strong> {contract?.billboards_count || 0}</p>
                </div>
              </div>

              <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
 ستطبع الفاتورة بتصميم احترافي مع تفاصيل اللوحات والأسعار بنفس التنسيق الذي يظهر في نافذة الطباعة
              </div>

              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={isDownloading}
                >
                  إغلاق
                </Button>
                <Button 
                  onClick={handleDownloadPDF}
                  variant="secondary"
                  disabled={isDownloading}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  تحميل PDF
                </Button>
                <Button 
                  onClick={handlePrintInvoice}
                  disabled={isDownloading}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  طباعة الفاتورة
                </Button>
              </div>
            </>
          )}
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
