import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X, Receipt } from 'lucide-react';
import { showPrintPreview } from '@/components/print/PrintPreviewDialog';
import { getMergedInvoiceStylesAsync, hexToRgba } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml, formatDateForPrint } from '@/lib/unifiedInvoiceBase';
import { numberToArabicWords } from '@/lib/printUtils';
interface ReceiptPrintDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payment: any;
  customerName: string;
}

// ✅ العملات المدعومة
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£', writtenName: 'جنيه إسترليني' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', writtenName: 'ريال سعودي' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', writtenName: 'درهم إماراتي' },
];

// ✅ دالة تنسيق الأرقام العربية
const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
};

export default function ReceiptPrintDialog({ open, onOpenChange, payment, customerName }: ReceiptPrintDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCollectionDetails, setShowCollectionDetails] = useState(false);
  const [customerData, setCustomerData] = useState<{
    name: string;
    company: string | null;
    phone: string | null;
  } | null>(null);

  // ✅ الحصول على معلومات العملة
  const getCurrencyInfo = () => {
    const currencyCode = payment?.currency || 'LYD';
    const currency = CURRENCIES.find(c => c.code === currencyCode);
    return {
      code: currencyCode,
      symbol: currency?.symbol || 'د.ل',
      name: currency?.name || 'دينار ليبي',
      writtenName: currency?.writtenName || 'دينار ليبي'
    };
  };

  // ✅ تحميل بيانات العميل
  const loadCustomerData = async () => {
    try {
      const customerId = payment?.customer_id;
      
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
      
      // استخدام اسم العميل المرسل
      setCustomerData({
        name: customerName,
        company: null,
        phone: null
      });
      
    } catch (error) {
      console.error('Error loading customer data:', error);
      setCustomerData({
        name: customerName,
        company: null,
        phone: null
      });
    }
  };

  useEffect(() => {
    if (open && payment) {
      loadCustomerData();
    }
  }, [open, payment]);

  // ✅ حساب المتبقي من الديون في وقت الدفعة (وليس الوقت الحالي)
  const calculateRemainingBalance = async () => {
    try {
      const customerId = payment?.customer_id;
      if (!customerId) return null;

      // تاريخ الدفعة الحالية
      const paymentDate = payment?.paid_at ? new Date(payment.paid_at) : new Date();

      // جميع الدفعات حتى تاريخ هذه الدفعة (بما فيها)
      const { data: allPayments } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('customer_id', customerId)
        .lte('paid_at', paymentDate.toISOString());

      // العقود
      const { data: contracts } = await supabase
        .from('Contract')
        .select('*')
        .eq('customer_id', customerId);

      // فواتير المبيعات حتى تاريخ الدفعة
      const { data: salesInvoices } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .lte('invoice_date', paymentDate.toISOString().split('T')[0]);

      // فواتير الطباعة حتى تاريخ الدفعة
      const { data: printedInvoices } = await supabase
        .from('printed_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .lte('invoice_date', paymentDate.toISOString().split('T')[0]);

      // الخصومات النشطة حتى تاريخ الدفعة
      const { data: discounts } = await supabase
        .from('customer_general_discounts')
        .select('discount_value, applied_date')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .lte('applied_date', paymentDate.toISOString().split('T')[0]);
      const totalDiscounts = (discounts || []).reduce((sum, d: any) => sum + (Number(d.discount_value) || 0), 0);

      // المشتريات حتى تاريخ الدفعة
      const { data: purchaseInvoices } = await supabase
        .from('purchase_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .lte('purchase_date', paymentDate.toISOString().split('T')[0]);

      // ✅ المهام المجمعة
      const { data: compositeTasks } = await supabase
        .from('composite_tasks')
        .select('*')
        .eq('customer_id', customerId);

      // مهام الطباعة وقص الموتيف لفلترة فواتير الطباعة
      const [printTasksRes, cutoutTasksRes] = await Promise.all([
        supabase
          .from('print_tasks')
          .select('id, invoice_id, is_composite, installation_task_id, composite_task_id')
          .eq('customer_id', customerId),
        supabase
          .from('cutout_tasks' as any)
          .select('id, invoice_id, is_composite, installation_task_id')
          .eq('customer_id', customerId)
      ]);

      // ✅ استخدام الدالة الموحدة مع جميع المعاملات
      const { calculateTotalRemainingDebt, filterCompositeRelatedPrintedInvoices } = await import('./BillingUtils');
      
      const filteredPrintedInvoices = filterCompositeRelatedPrintedInvoices(
        printedInvoices || [],
        compositeTasks || [],
        printTasksRes.data || [],
        cutoutTasksRes.data || []
      );

      const remainingBalance = calculateTotalRemainingDebt(
        (contracts || []) as any[],
        (allPayments || []) as any[],
        salesInvoices || [],
        filteredPrintedInvoices,
        purchaseInvoices || [],
        totalDiscounts,
        compositeTasks || [],
        0 // لا نطرح إيجارات الصديقة من ديون الزبون في إيصال الاستلام
      );

      return {
        remainingBalance
      };
    } catch (error) {
      console.error('Error calculating general debt:', error);
      return null;
    }
  };

  // ✅ طباعة الإيصال
  const handlePrintReceipt = async () => {
    if (!payment || !customerData) {
      toast.error('لا توجد بيانات دفعة أو عميل للطباعة');
      return;
    }

    setIsGenerating(true);
    
    try {
      // No popup test needed - using inline dialog

      // حساب الرصيد المتبقي
      const balanceInfo = await calculateRemainingBalance();

      // قراءة معلومات الوسيط (العهدة/الموظف/السحوبات) من sessionStorage
      let intermediaryInfo: { custodyInfo?: any[]; employeeAdvances?: any[]; withdrawals?: any[]; showIntermediary?: boolean } | null = null;
      try {
        const storedInfo = sessionStorage.getItem('printReceiptIntermediaryInfo');
        if (storedInfo) {
          intermediaryInfo = JSON.parse(storedInfo);
          sessionStorage.removeItem('printReceiptIntermediaryInfo');
        }
      } catch (e) {
        console.error('Error parsing intermediary info:', e);
      }

      // استخراج معلومات المستلم (الموظف صاحب العهدة أو السلفة أو السحب)
      const custodyReceiverName = intermediaryInfo?.custodyInfo?.[0]?.employee_name || null;
      const employeeReceiverName = intermediaryInfo?.employeeAdvances?.[0]?.employee_name || null;
      const withdrawalReceiverName = intermediaryInfo?.withdrawals?.[0]?.receiver_name || null;
      const receiverName = custodyReceiverName || employeeReceiverName || withdrawalReceiverName || null;

      // استخراج معلومات العقود الموزعة من الملاحظات
      const distributedContractsMatch = payment.notes?.match(/دفعة موزعة على (\d+) عقود: ([\d,\s]+)/);
      const isDistributedPayment = !!distributedContractsMatch;
      const distributedContracts = distributedContractsMatch ? distributedContractsMatch[2].split(',').map((c: string) => c.trim()) : [];

      // ✅ تحديد نوع الدفعة ومصدرها
      const isCompositeTaskPayment = !!(payment as any).composite_task_id;
      const isSalesInvoicePayment = !!(payment as any).sales_invoice_id;
      const isPrintedInvoicePayment = !!(payment as any).printed_invoice_id;
      
      // جلب بيانات المهمة المجمعة
      let compositeTaskInfo: { task_type?: string; customer_total?: number } | null = null;
      if (isCompositeTaskPayment) {
        try {
          const { data } = await supabase
            .from('composite_tasks')
            .select('task_type, customer_total, contract_id')
            .eq('id', (payment as any).composite_task_id)
            .single();
          compositeTaskInfo = data;
        } catch (e) {
          console.error('Error fetching composite task:', e);
        }
      }

      // جلب بيانات فاتورة المبيعات
      let salesInvoiceInfo: { invoice_number?: string; notes?: string; total_amount?: number } | null = null;
      if (isSalesInvoicePayment) {
        try {
          const { data } = await supabase
            .from('sales_invoices')
            .select('invoice_number, notes, total_amount')
            .eq('id', (payment as any).sales_invoice_id)
            .single();
          salesInvoiceInfo = data;
        } catch (e) {
          console.error('Error fetching sales invoice:', e);
        }
      }

      // جلب بيانات فاتورة الطباعة
      let printedInvoiceInfo: { invoice_number?: string; total_amount?: number; printer_name?: string } | null = null;
      if (isPrintedInvoicePayment) {
        try {
          const { data } = await supabase
            .from('printed_invoices')
            .select('invoice_number, total_amount, printer_name')
            .eq('id', (payment as any).printed_invoice_id)
            .single();
          printedInvoiceInfo = data;
        } catch (e) {
          console.error('Error fetching printed invoice:', e);
        }
      }

      // جلب بيانات العقود لنوع الإعلان
      let contractsData: { [key: string]: string } = {};
      if (isDistributedPayment && distributedContracts.length > 0) {
        try {
          const { data: contracts } = await supabase
            .from('Contract')
            .select('Contract_Number, "Ad Type"')
            .in('Contract_Number', distributedContracts.map(Number));
          
          if (contracts) {
            contracts.forEach((c: any) => {
              contractsData[c.Contract_Number] = c['Ad Type'] || 'لوحة إعلانية';
            });
          }
        } catch (e) {
          console.error('Error fetching contracts data:', e);
        }
      }

      // ✅ تحديد البيان/الوصف للدفعة
      const getPaymentDescription = () => {
        if (isDistributedPayment) return `دفعة موزعة على ${distributedContracts.length} عقود`;
        if (isCompositeTaskPayment && compositeTaskInfo) {
          const taskTypeLabels: { [key: string]: string } = {
            'طباعة_تركيب': 'مهمة طباعة وتركيب',
            'طباعة_قص_تركيب': 'مهمة طباعة وقص وتركيب',
            'installation': 'مهمة تركيب',
            'print': 'مهمة طباعة'
          };
          return taskTypeLabels[compositeTaskInfo.task_type || ''] || 'مهمة مجمعة';
        }
        if (isSalesInvoicePayment && salesInvoiceInfo) {
          return `فاتورة مبيعات${salesInvoiceInfo.invoice_number ? ` رقم ${salesInvoiceInfo.invoice_number}` : ''}${salesInvoiceInfo.notes ? ` - ${salesInvoiceInfo.notes}` : ''}`;
        }
        if (isPrintedInvoicePayment && printedInvoiceInfo) {
          return `فاتورة طباعة${printedInvoiceInfo.invoice_number ? ` رقم ${printedInvoiceInfo.invoice_number}` : ''}${printedInvoiceInfo.printer_name ? ` - ${printedInvoiceInfo.printer_name}` : ''}`;
        }
        if (payment.contract_number) return `عقد رقم ${payment.contract_number}`;
        if (payment.entry_type === 'account_payment') return 'دفعة على الحساب العام';
        return 'دفعة';
      };

      // استخراج الملاحظات الأصلية بدون معلومات التوزيع والتكرارات
      let cleanNotes = payment.notes || '';
      // إزالة معلومات البنوك المتكررة
      cleanNotes = cleanNotes
        .replace(/(من:\s*[^|]+\s*\|\s*إلى:\s*[^|]+\s*\|\s*)+/g, '')
        .replace(/من:\s*[^|]+\s*\|\s*إلى:\s*[^|]+/g, '')
        .replace(/\|\s*\|/g, '|')
        .replace(/^\s*\|\s*/g, '')
        .replace(/\s*\|\s*$/g, '')
        .trim();
      
      if (isDistributedPayment) {
        // إزالة معلومات التوزيع من الملاحظات للعرض
        cleanNotes = cleanNotes.replace(/دفعة موزعة على \d+ عقود: [\d,\s]+\n*/g, '').trim();
        // إزالة معلومات العهدة والموظف
 cleanNotes = cleanNotes.replace(/ تم التحويل لعهدة مالية:[\s\S]*?(?=\n\n|$)/g, '').trim();
 cleanNotes = cleanNotes.replace(/ تم تسليم جزء للموظفين:[\s\S]*?(?=\n\n|$)/g, '').trim();
        cleanNotes = cleanNotes.replace(/ملاحظات:\s*/g, '').trim();
      }

      const currencyInfo = getCurrencyInfo();

      // ✅ جلب إعدادات القالب المحفوظة (async)
      const styles = await getMergedInvoiceStylesAsync('receipt');
      const fontBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const logoUrl = styles.logoPath || '/logofaresgold.svg';
      const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${fontBaseUrl}${logoUrl}`;

      const receiptDate = formatDateForPrint(new Date().toISOString(), styles.showHijriDate);
      const receiptNumber = `REC-${Date.now()}`;
      
      // تنسيق تاريخ الدفعة
      const paymentDate = payment.paid_at 
        ? formatDateForPrint(payment.paid_at, styles.showHijriDate)
        : receiptDate;

      const receiptHeaderMetaLinesHtml = `<div><strong>رقم الإيصال:</strong> ${receiptNumber}</div><div><strong>التاريخ:</strong> ${receiptDate}</div><div><strong>العملة:</strong> ${currencyInfo.name}</div>`;
      const receiptFooterTextHtml = `${styles.footerText || 'شكراً لتعاملكم معنا | Thank you for your business'}<br/>هذا إيصال إلكتروني ولا يحتاج إلى ختم أو توقيع إضافي`;
      const receiptPrintStyles = { ...styles, footerText: receiptFooterTextHtml };

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>إيصال استلام رقم ${receiptNumber}</title>
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
              font-family: ${styles.fontFamily || "'Noto Sans Arabic', Arial, sans-serif"};
              direction: rtl;
              text-align: right;
              background: white;
              color: ${styles.customerSectionTextColor};
              font-size: ${styles.bodyFontSize}px;
              line-height: 1.2;
              overflow: hidden;
            }
            
            .receipt-container {
              width: 210mm;
              height: 297mm;
              padding: ${styles.pageMarginTop}mm ${styles.pageMarginRight}mm ${styles.pageMarginBottom}mm ${styles.pageMarginLeft}mm;
              display: flex;
              flex-direction: column;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 20px;
              border-bottom: 2px solid ${styles.primaryColor};
              padding-bottom: 15px;
            }

            ${unifiedHeaderFooterCss(receiptPrintStyles)}
            
            .receipt-info {
              text-align: left;
              direction: ltr;
              order: 2;
            }
            
            .receipt-title {
              font-size: ${styles.titleFontSize}px;
              font-weight: bold;
              color: ${styles.primaryColor};
              margin-bottom: 6px;
            }
            
            .receipt-details {
              font-size: ${styles.bodyFontSize}px;
              color: #666;
              line-height: 1.4;
            }
            
            .company-info {
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              text-align: right;
              order: 1;
            }
            
            .company-logo {
              max-width: ${styles.logoSize}px;
              height: auto;
              object-fit: contain;
              margin-bottom: 4px;
              display: block;
              margin-right: 0;
            }
            
            .company-details {
              font-size: ${styles.contactInfoFontSize}px;
              color: #666;
              line-height: 1.4;
              font-weight: 400;
              text-align: ${styles.contactInfoAlignment};
            }
            
            .customer-info {
              background: ${hexToRgba(styles.customerSectionBgColor, 50)};
              padding: 10px;
              border-radius: 0;
              margin-bottom: 12px;
              border-right: 3px solid ${styles.primaryColor};
              border: 1px solid ${styles.customerSectionBorderColor};
            }
            
            .customer-title {
              font-size: ${styles.headerFontSize}px;
              font-weight: bold;
              margin-bottom: 6px;
              color: ${styles.customerSectionTitleColor};
            }
            
            .customer-details {
              font-size: ${styles.bodyFontSize}px;
              line-height: 1.4;
            }
            
            .payment-details {
              background: ${hexToRgba(styles.customerSectionBgColor, 30)};
              padding: 12px;
              border-radius: 6px;
              margin-bottom: 12px;
              border: 1px solid ${styles.tableBorderColor};
            }
            
            .payment-title {
              font-size: ${styles.headerFontSize}px;
              font-weight: bold;
              margin-bottom: 8px;
              color: ${styles.customerSectionTitleColor};
              text-align: center;
            }
            
            .payment-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              font-size: ${styles.bodyFontSize}px;
            }
            
            .payment-info div {
              padding: 6px;
              background: white;
              border-radius: 4px;
              border: 1px solid ${styles.tableBorderColor};
            }
            
            .payment-info strong {
              color: ${styles.customerSectionTitleColor};
              font-weight: bold;
            }
            
            .amount-section {
              margin-top: 12px;
              border-top: 2px solid ${styles.primaryColor};
              padding-top: 10px;
            }
            
            .amount-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px;
              font-size: 16px;
              font-weight: bold;
              background: ${styles.totalBgColor};
              color: ${styles.totalTextColor};
              padding: 12px;
              border-radius: 0;
              margin-top: 8px;
            }
            
            .currency {
              font-weight: bold;
              color: #FFD700;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
            }
            
            .amount-words {
              margin-top: 8px;
              font-size: ${styles.bodyFontSize}px;
              color: #666;
              text-align: center;
              font-style: italic;
            }
            
            .footer {
              margin-top: auto;
              text-align: center;
              font-size: 9px;
              color: ${styles.footerTextColor};
              border-top: 1px solid #ddd;
              padding-top: 10px;
            }
            
            .signature-section {
              margin-top: 15px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            
            .signature-box {
              text-align: center;
              border-top: 1px solid ${styles.primaryColor};
              padding-top: 6px;
              min-width: 100px;
            }
            
            .signature-name {
              margin-top: 6px;
              font-size: ${styles.bodyFontSize}px;
              color: #666;
              font-weight: normal;
            }
            
            @media print {
              html, body {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
              }
              
              .receipt-container {
                width: 210mm !important;
                height: 297mm !important;
                padding: 12mm !important;
              }
              
              @page {
                size: A4 portrait;
                margin: 0 !important;
                padding: 0 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            ${unifiedHeaderHtml({
              styles: receiptPrintStyles,
              fullLogoUrl,
              metaLinesHtml: receiptHeaderMetaLinesHtml,
              titleAr: 'إيصال قبض',
              titleEn: 'RECEIPT',
            })}
            
            <div class="payment-details">
              <div class="payment-title">بيانات عملية التحصيل والتسليم</div>
              <div class="payment-info">
                ${showCollectionDetails ? `
                <div>
                  <strong>المحصل (المستلم من الزبون):</strong><br>
                  ${payment.collector_name || 'غير محدد'}
                </div>
                <div>
                  <strong>المسلم له (المدير):</strong><br>
                  ${payment.receiver_name || 'غير محدد'}
                </div>
                <div>
                  <strong>مكان التسليم:</strong><br>
                  ${payment.delivery_location || 'غير محدد'}
                </div>
                <div>
                  <strong>نوع الدفع:</strong><br>
                  ${payment.method || 'نقدي'}
                </div>
                ` : `
                <div>
                  <strong>طريقة الدفع:</strong><br>
                  ${payment.method || 'نقدي'}
                </div>
                ${payment.method === 'تحويل بنكي' ? `
                ${payment.source_bank ? `
                <div>
                  <strong>المصرف المحول منه:</strong><br>
                  ${payment.source_bank}
                </div>
                ` : ''}
                ${payment.destination_bank ? `
                <div>
                  <strong>المصرف المحول إليه:</strong><br>
                  ${payment.destination_bank}
                </div>
                ` : ''}
                ${payment.transfer_reference ? `
                <div>
                  <strong>رقم العملية التحويلية:</strong><br>
                  ${payment.transfer_reference}
                </div>
                ` : ''}
                ` : ''}
                ${payment.method === 'شيك' && payment.reference ? `
                <div>
                  <strong>رقم الشيك:</strong><br>
                  ${payment.reference}
                </div>
                ` : ''}
                `}
              </div>
            </div>
            
            <div class="customer-info">
              <div class="customer-title">بيانات العميل</div>
              <div class="customer-details">
                <strong>الاسم:</strong> ${customerData.name}<br>
                ${customerData.company ? `<strong>الشركة:</strong> ${customerData.company}<br>` : ''}
                ${customerData.phone ? `<strong>الهاتف:</strong> ${customerData.phone}<br>` : ''}
              </div>
            </div>
            
            ${receiverName ? `
            <div class="customer-info" style="border-right-color: #000; background: #f8f9fa;">
              <div class="customer-title">المستلم</div>
              <div class="customer-details">
                <strong>اسم المستلم:</strong> ${receiverName}
              </div>
            </div>
            ` : ''}
            
            ${isDistributedPayment && distributedContracts.length > 0 ? `
            <div class="payment-details" style="border-color: #000; background: #f8f9fa;">
              <div class="payment-title">العقود الموزعة</div>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                  <tr style="background: #e5e7eb;">
                    <th style="padding: 8px; border: 1px solid #000; text-align: right;">رقم العقد</th>
                    <th style="padding: 8px; border: 1px solid #000; text-align: right;">نوع الإعلان</th>
                  </tr>
                </thead>
                <tbody>
                  ${distributedContracts.map((contractNum: string) => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #000; font-weight: bold;">${contractNum}</td>
                    <td style="padding: 8px; border: 1px solid #000;">${contractsData[contractNum] || 'لوحة إعلانية'}</td>
                  </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}
            
            <div class="payment-details">
              <div class="payment-title">تفاصيل الدفعة</div>
              <div class="payment-info">
                <div>
                  <strong>تاريخ الدفعة:</strong><br>
                  ${paymentDate}
                </div>
                <div>
                  <strong>البيان:</strong><br>
                  ${getPaymentDescription()}
                </div>
                ${payment.contract_number && !isDistributedPayment && !isCompositeTaskPayment && !isSalesInvoicePayment && !isPrintedInvoicePayment ? `
                <div>
                  <strong>رقم العقد:</strong><br>
                  ${payment.contract_number}
                </div>
                ` : ''}
                ${isCompositeTaskPayment && compositeTaskInfo ? `
                <div>
                  <strong>إجمالي المهمة:</strong><br>
                  ${formatArabicNumber(compositeTaskInfo.customer_total || 0)} ${currencyInfo.symbol}
                </div>
                ` : ''}
                ${isSalesInvoicePayment && salesInvoiceInfo ? `
                <div>
                  <strong>إجمالي الفاتورة:</strong><br>
                  ${formatArabicNumber(salesInvoiceInfo.total_amount || 0)} ${currencyInfo.symbol}
                </div>
                ` : ''}
                ${isPrintedInvoicePayment && printedInvoiceInfo ? `
                <div>
                  <strong>إجمالي فاتورة الطباعة:</strong><br>
                  ${formatArabicNumber(printedInvoiceInfo.total_amount || 0)} ${currencyInfo.symbol}
                </div>
                ` : ''}
                ${payment.reference ? `
                <div>
                  <strong>المرجع / رقم الشيك:</strong><br>
                  ${payment.reference}
                </div>
                ` : ''}
                ${cleanNotes ? `
                <div style="grid-column: 1 / -1;">
                  <strong>ملاحظات:</strong><br>
                  ${cleanNotes}
                </div>
                ` : ''}
              </div>
            </div>
            
            <div class="amount-section">
              <div class="amount-row">
                <span>المبلغ المستلم:</span>
                <span class="currency">${currencyInfo.symbol} ${formatArabicNumber(payment.amount || 0)}</span>
              </div>
              
              ${balanceInfo ? `
              <div class="amount-row" style="background: ${balanceInfo.remainingBalance > 0 ? '#7f1d1d' : '#065f46'}; margin-top: 15px;">
                <span>المتبقي من إجمالي الديون:</span>
                <span class="currency">${currencyInfo.symbol} ${formatArabicNumber(Math.abs(balanceInfo.remainingBalance))}${balanceInfo.remainingBalance < 0 ? ' (رصيد دائن)' : balanceInfo.remainingBalance === 0 ? ' (مسدد بالكامل)' : ''}</span>
              </div>
              ` : ''}
              
              <div class="amount-words">
                المبلغ بالكلمات: ${numberToArabicWords(payment.amount || 0)} ${currencyInfo.writtenName}
              </div>
            </div>
            
            <div class="signature-section">
              <div class="signature-box">
                <div>توقيع الدافع</div>
                <div class="signature-name">${customerData.name}</div>
              </div>
              ${receiverName ? `
              <div class="signature-box">
                <div>توقيع المستلم</div>
                <div class="signature-name">${receiverName}</div>
              </div>
              ` : ''}
            </div>
            
            ${unifiedFooterHtml(receiptPrintStyles)}
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

      // فتح معاينة الطباعة في حوار داخلي
      showPrintPreview(htmlContent, `إيصال استلام: ${customerData.name} • ${receiptNumber}`, 'billing-receipts', customerData.phone || '');

      toast.success(`تم فتح الإيصال للطباعة بنجاح بعملة ${currencyInfo.name}!`);
      onOpenChange(false);

    } catch (error) {
      console.error('Error in handlePrintReceipt:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير الإيصال للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const currencyInfo = getCurrencyInfo();

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="expenses-dialog-content">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            طباعة إيصال الاستلام
          </UIDialog.DialogTitle>
          <UIDialog.DialogClose className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">إغلاق</span>
          </UIDialog.DialogClose>
        </UIDialog.DialogHeader>
        
        <div className="space-y-6">
          {isGenerating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-semibold">جاري تحضير الإيصال للطباعة...</p>
              <p className="text-sm text-gray-600 mt-2">يتم تحميل بيانات العميل وتحضير التخطيط</p>
            </div>
          ) : (
            <>
              {/* معلومات العملة */}
              <div className="bg-gradient-to-br from-card to-primary/10 p-4 rounded-lg border border-primary/30">
                <div className="flex items-center gap-3">
                  <div className="text-2xl text-primary">{currencyInfo.symbol}</div>
                  <div>
                    <div className="font-semibold text-primary">عملة الدفعة: {currencyInfo.name}</div>
                    <div className="text-sm text-muted-foreground">
                      المبلغ سيظهر بكلمة "{currencyInfo.writtenName}" في الإيصال المطبوع
                    </div>
                  </div>
                </div>
              </div>

              {/* معاينة بيانات الإيصال */}
              <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20">
                <h3 className="font-semibold mb-2 text-primary">معاينة بيانات الإيصال:</h3>
                <div className="text-sm space-y-1">
                  <p><strong>العميل:</strong> {customerData?.name || 'غير محدد'}</p>
                  {customerData?.company && (
                    <p><strong>الشركة:</strong> {customerData.company}</p>
                  )}
                  {customerData?.phone && (
                    <p><strong>الهاتف:</strong> {customerData.phone}</p>
                  )}
                  <p><strong>المبلغ:</strong> {formatArabicNumber(payment?.amount || 0)} {currencyInfo.symbol}</p>
                  <p><strong>طريقة الدفع:</strong> {payment?.method || 'نقدي'}</p>
                  <p><strong>تاريخ الدفعة:</strong> {payment?.paid_at 
                    ? new Date(payment.paid_at).toLocaleDateString('ar-LY')
                    : new Date().toLocaleDateString('ar-LY')}</p>
                  {payment?.contract_id && (
                    <p><strong>رقم العقد:</strong> {payment.contract_id}</p>
                  )}
                  {payment?.notes && (
                    <p><strong>ملاحظات:</strong> {
                      (payment.notes || '')
                        .replace(/(من:\s*[^|]+\s*\|\s*إلى:\s*[^|]+\s*\|\s*)+/g, '')
                        .replace(/من:\s*[^|]+\s*\|\s*إلى:\s*[^|]+/g, '')
                        .replace(/\|\s*\|/g, '|')
                        .replace(/^\s*\|\s*/g, '')
                        .replace(/\s*\|\s*$/g, '')
                        .trim() || '—'
                    }</p>
                  )}
                </div>
              </div>

              {/* خيار إظهار بيانات التحصيل */}
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <input
                  type="checkbox"
                  id="showCollectionDetails"
                  checked={showCollectionDetails}
                  onChange={(e) => setShowCollectionDetails(e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                <label htmlFor="showCollectionDetails" className="cursor-pointer text-sm">
                  إظهار بيانات التحصيل عبر الوسيط (المحصل، المستلم، مكان التسليم)
                </label>
              </div>

              {/* أزرار العمليات */}
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="border-primary/30 hover:bg-primary/10"
                >
                  إغلاق
                </Button>
                <Button 
                  onClick={handlePrintReceipt}
                  className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
                  disabled={isGenerating}
                >
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة الإيصال
                </Button>
              </div>
            </>
          )}
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}