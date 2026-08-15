/**
 * UnifiedReceiptPrint - طباعة إيصال موحد
 * 
 * ✅ نفس تصميم كشف الحساب (BLACK/GRAY formal theme)
 * ✅ Logo: /logofaresgold.svg (101px)
 * ✅ Compact A4-friendly layout
 * ✅ جدول العقود الموزعة
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatArabicNumber } from '@/lib/printUtils';
import { DOCUMENT_TYPES } from '@/types/document-types';
import { PrintSettings, DEFAULT_PRINT_SETTINGS } from '@/types/print-settings';
import {
  PrintColumn,
  PrintTotalsItem,
  PrintPartyData,
  PrintDocumentData,
  createMeasurementsConfigFromSettings,
  openMeasurementsPrintWindow,
  MeasurementsHTMLOptions,
} from '@/lib/printMeasurements';

interface PaymentData {
  id: string;
  amount: number;
  paid_at: string;
  method?: string;
  reference?: string;
  notes?: string;
  contract_number?: number | null;
  collector_name?: string;
  receiver_name?: string;
  delivery_location?: string;
  source_bank?: string;
  destination_bank?: string;
  transfer_reference?: string;
  transfer_image_url?: string;
  distributed_payment_id?: string;
  /** نص مصدر المقايضة (مثلاً: عنوان فاتورة المشتريات أو نوع إعلان العقد المستخدم) */
  barter_source?: string;
}

interface CustomerData {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
}

interface Currency {
  code: string;
  symbol: string;
  name: string;
  writtenName: string;
}

interface DistributedContract {
  contractNumber: string;
  adType: string;
  amount?: number;
  total?: number | string | null;
  totalPaid?: number | string | null;
  remaining?: number | string | null;
  // New fields for composite tasks and sales invoices
  entityType?: 'contract' | 'composite_task' | 'sales_invoice' | 'printed_invoice';
  compositeTaskType?: string; // 'طباعة_تركيب' | 'طباعة_قص_تركيب' | etc.
}

export interface PrintUnifiedReceiptOptions {
  payment: PaymentData;
  customerData: CustomerData;
  currency: Currency;
  distributedContracts?: DistributedContract[];
  balanceInfo?: {
    remainingBalance: number;
    totalPaid: number;
  };
}

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
};

// === MAIN PRINT FUNCTION ===
export async function printUnifiedReceipt(
  settingsOrTheme: any,
  options: PrintUnifiedReceiptOptions
): Promise<void> {
  const { payment, customerData, currency, distributedContracts = [], balanceInfo } = options;

  const receiptDate = formatDate(new Date().toISOString());
  const receiptNumber = `REC-${Date.now()}`;
  const paymentDate = payment.paid_at ? formatDate(payment.paid_at) : receiptDate;
  
  // Check if distributed payment
  const isDistributed = distributedContracts.length > 0 || !!payment.distributed_payment_id;

  // ✅ Use saved settings from print_settings table
  const config = createMeasurementsConfigFromSettings(settingsOrTheme);

  // Build additional info for header (فقط التواريخ الأساسية)
  const additionalInfo: { label: string; value: string }[] = [
    { label: 'تاريخ الإيصال', value: receiptDate },
    { label: 'تاريخ الدفعة', value: paymentDate },
  ];

  // Document header
  const documentData: PrintDocumentData = {
    title: `إيصال استلام: ${customerData.name}`,
    documentNumberLabel: 'رقم الإيصال',
    documentNumber: receiptNumber,
    date: '',
    additionalInfo,
  };

  // Customer data
  const partyData: PrintPartyData = {
    title: 'بيانات العميل',
    name: customerData.name,
    company: customerData.company,
    phone: customerData.phone,
  };

  // Build table columns and rows
  let columns: PrintColumn[];
  let rows: Record<string, any>[];

  // Build payment details section (shown for all payment types)
  const paymentDetailsRows: Record<string, any>[] = [];
  
  // Payment method details
  paymentDetailsRows.push({ label: 'طريقة الدفع', value: payment.method || 'نقدي' });

  // ✅ إظهار مصدر المقايضة (عنوان فاتورة المشتريات أو نوع إعلان العقد) عند الدفع بمقايضة
  if (payment.barter_source && payment.barter_source.trim()) {
    paymentDetailsRows.push({ label: 'مصدر المقايضة', value: payment.barter_source });
  }

  if (payment.reference) {
    paymentDetailsRows.push({ label: 'رقم العملية / المرجع', value: payment.reference });
  }
  if (payment.transfer_reference) {
    paymentDetailsRows.push({ label: 'رقم الحوالة', value: payment.transfer_reference });
  }
  if (payment.source_bank) {
    paymentDetailsRows.push({ label: 'المصرف المحول منه', value: payment.source_bank });
  }
  if (payment.destination_bank) {
    paymentDetailsRows.push({ label: 'المصرف المحول إليه', value: payment.destination_bank });
  }
  if (payment.collector_name) {
    paymentDetailsRows.push({ label: 'المحصل', value: payment.collector_name });
  }
  if (payment.receiver_name) {
    paymentDetailsRows.push({ label: 'المستلم', value: payment.receiver_name });
  }
  if (payment.delivery_location) {
    paymentDetailsRows.push({ label: 'موقع التسليم', value: payment.delivery_location });
  }

  if (isDistributed && distributedContracts.length > 0) {
    // Distributed payment - show contracts/tasks/invoices + remaining
    columns = [
      { key: 'index', header: '#', width: '8%', align: 'center' },
      { key: 'reference', header: 'المرجع', width: '18%', align: 'center' },
      { key: 'description', header: 'البيان', width: '32%', align: 'right' },
      { key: 'amount', header: 'المسدد', width: '20%', align: 'center' },
      { key: 'remaining', header: 'المتبقي', width: '22%', align: 'center' },
    ];

    rows = distributedContracts.map((contract, index) => {
      // Determine reference and description based on entity type
      let reference = contract.contractNumber;
      let description = contract.adType || 'لوحة إعلانية';
      
      if (contract.entityType === 'composite_task') {
        reference = 'مهمة';
        // استخدم الوصف المبني من المكونات الفعلية (طباعة + قص + تركيب)
        description = contract.compositeTaskType || contract.adType || 'مهمة مجمعة';
      } else if (contract.entityType === 'sales_invoice') {
        reference = 'فاتورة مبيعات';
        // استخدم عنوان الفاتورة (invoice_name) أو الوصف المرسل
        description = contract.adType || 'مبيعات';
      } else if (contract.entityType === 'printed_invoice') {
        reference = 'فاتورة طباعة';
        description = contract.adType || 'طباعة';
      } else {
        // Default to contract
        reference = `عقد ${contract.contractNumber}`;
      }
      
      return {
        index: index + 1,
        reference,
        description,
        amount: typeof contract.amount === 'number'
          ? `${currency.symbol} ${formatArabicNumber(contract.amount)}`
          : '—',
        remaining:
          contract.remaining === null || contract.remaining === undefined || contract.remaining === ''
            ? '—'
            : typeof contract.remaining === 'number'
              ? `${currency.symbol} ${formatArabicNumber(contract.remaining)}`
              : String(contract.remaining),
      };
    });
  } else {
    // Single payment - show payment details as table
    columns = [
      { key: 'label', header: 'البيان', width: '40%', align: 'right' },
      { key: 'value', header: 'القيمة', width: '60%', align: 'center' },
    ];

    rows = [
      { label: 'رقم العقد', value: payment.contract_number || 'غير محدد' },
      { label: 'تاريخ الدفعة', value: paymentDate },
      ...paymentDetailsRows,
    ];
  }

  // Totals
  const totals: PrintTotalsItem[] = [
    {
      label: 'المبلغ المستلم',
      value: `${currency.symbol} ${formatArabicNumber(payment.amount)}`,
      bold: true,
      highlight: true,
    }
  ];

  // Add total paid if available
  if (balanceInfo && balanceInfo.totalPaid > 0) {
    totals.push({
      label: 'إجمالي المسدد',
      value: `${currency.symbol} ${formatArabicNumber(balanceInfo.totalPaid)}`,
      bold: false,
    });
  }

  if (balanceInfo) {
    const normalizedRemainingBalance = Math.abs(balanceInfo.remainingBalance) < 0.01 ? 0 : balanceInfo.remainingBalance;
    const balanceLabel = normalizedRemainingBalance > 0 
      ? 'المتبقي من إجمالي الديون' 
      : normalizedRemainingBalance < 0 
        ? 'رصيد دائن للعميل' 
 : 'مسدد بالكامل ';
    
    totals.push({
      label: balanceLabel,
      value: `${currency.symbol} ${formatArabicNumber(Math.abs(normalizedRemainingBalance))}`,
      bold: true,
      highlight: normalizedRemainingBalance <= 0,
    });
  }

  // Statistics cards - count by entity type
  const contractCount = distributedContracts.filter(c => !c.entityType || c.entityType === 'contract').length;
  const compositeTaskCount = distributedContracts.filter(c => c.entityType === 'composite_task').length;
  const salesInvoiceCount = distributedContracts.filter(c => c.entityType === 'sales_invoice').length;
  const printedInvoiceCount = distributedContracts.filter(c => c.entityType === 'printed_invoice').length;
  
  const statisticsCards: { label: string; value: number; unit: string }[] = [];
  if (isDistributed) {
    if (contractCount > 0) statisticsCards.push({ label: 'عقد', value: contractCount, unit: '' });
    if (compositeTaskCount > 0) statisticsCards.push({ label: 'مهمة', value: compositeTaskCount, unit: '' });
    if (salesInvoiceCount > 0) statisticsCards.push({ label: 'فاتورة مبيعات', value: salesInvoiceCount, unit: '' });
    if (printedInvoiceCount > 0) statisticsCards.push({ label: 'فاتورة طباعة', value: printedInvoiceCount, unit: '' });
  }

  // Build notes (الملاحظات فقط بدون المبلغ بالكلمات)
  let notesText = '';
  
  // ✅ إضافة الملاحظات إذا وجدت
  if (payment.notes && payment.notes.trim()) {
    notesText = payment.notes;
  }

  // تمرير تفاصيل السداد كجدول منفصل (يظهر فوق جدول العقود)
  const paymentDetailsTable = isDistributed && paymentDetailsRows.length > 0
    ? paymentDetailsRows.map(row => ({ label: row.label, value: String(row.value) }))
    : undefined;

  // Build transfer image HTML if available (supports multiple images)
  let additionalContent = '';
  if (payment.transfer_image_url) {
    const showImage = settingsOrTheme.show_transfer_image !== false;
    
    if (showImage) {
      // Parse URLs - support both single string and JSON array
      let imageUrls: string[] = [];
      try {
        const parsed = JSON.parse(payment.transfer_image_url);
        if (Array.isArray(parsed)) imageUrls = parsed.filter(Boolean);
      } catch {
        imageUrls = [payment.transfer_image_url];
      }

      if (imageUrls.length > 0) {
        // Smaller sizes to fit on one page: max 80mm height per image, grid for multiple
        const singleMaxH = imageUrls.length === 1 ? 80 : 55;
        const singleMaxW = imageUrls.length === 1 ? 100 : 70;
        
        const imagesHtml = imageUrls.map((url, i) => `
          <img src="${url}" alt="إيصال الدفع ${i + 1}" 
            style="max-width: ${singleMaxW}mm; max-height: ${singleMaxH}mm; width: auto; height: auto; border-radius: 6px; border: 1px solid #bfdbfe; display: inline-block; margin: 4px;" 
            onerror="this.style.display='none'" />
        `).join('');

        additionalContent = `
          <div style="margin: 10px 0; page-break-inside: avoid;">
            <div style="background: #f0f7ff; border: 2px solid #3b82f6; border-radius: 10px; padding: 10px; text-align: center;">
              <div style="font-size: 13px; font-weight: 700; color: #1e40af; margin-bottom: 8px;">
 مرفق: صورة إيصال الدفع${imageUrls.length > 1 ? ` (${imageUrls.length})` : ''}
              </div>
              ${imagesHtml}
            </div>
          </div>
        `;
      }
    }
  }

  const printOptions: MeasurementsHTMLOptions = {
    config,
    documentData,
    partyData,
    columns,
    rows,
    totals,
    totalsTitle: 'ملخص الدفعة',
    notes: notesText,
    statisticsCards,
    paymentDetailsTable,
    additionalContent: additionalContent || undefined,
    headerSwap: settingsOrTheme.header_swap ?? false,
  };

  openMeasurementsPrintWindow(printOptions, `إيصال استلام: ${customerData.name} • ${receiptNumber}`, undefined, customerData.phone);
  toast.success('تم فتح الإيصال للطباعة');
}

// === Extract distributed contracts from payment notes ===
export async function extractDistributedContracts(payment: PaymentData): Promise<DistributedContract[]> {
  const distributedContractsMatch = payment.notes?.match(/دفعة موزعة على (\d+) عقود: ([\d,\s]+)/);
  
  if (!distributedContractsMatch) return [];
  
  const contractNumbers = distributedContractsMatch[2].split(',').map((c: string) => c.trim());
  
  // Fetch contract details
  try {
    const { data: contracts } = await supabase
      .from('Contract')
      .select('Contract_Number, "Ad Type"')
      .in('Contract_Number', contractNumbers.map(Number));
    
    if (contracts) {
      return contractNumbers.map(num => ({
        contractNumber: num,
        adType: contracts.find((c: any) => c.Contract_Number === Number(num))?.['Ad Type'] || 'لوحة إعلانية',
      }));
    }
  } catch (e) {
    console.error('Error fetching contracts:', e);
  }
  
  return contractNumbers.map(num => ({
    contractNumber: num,
    adType: 'لوحة إعلانية',
  }));
}

// === HOOK - Fetches settings from print_settings table ===
export function useUnifiedReceiptPrint() {
  const [isPrinting, setIsPrinting] = useState(false);
  const [settings, setSettings] = useState<Partial<PrintSettings> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on first use
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('print_settings')
          .select('*')
          .eq('document_type', DOCUMENT_TYPES.PAYMENT_RECEIPT)
          .maybeSingle();
        
        if (data) {
          setSettings(data as any);
        } else {
          // Fallback: try first available settings
          const { data: fallback } = await supabase
            .from('print_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
          setSettings((fallback as any) || DEFAULT_PRINT_SETTINGS);
        }
      } catch {
        setSettings(DEFAULT_PRINT_SETTINGS as any);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const print = async (options: PrintUnifiedReceiptOptions) => {
    if (isLoading) {
      toast.error('جاري تحميل إعدادات الطباعة...');
      return;
    }

    setIsPrinting(true);
    try {
      await printUnifiedReceipt(settings || DEFAULT_PRINT_SETTINGS, options);
    } catch (error) {
      console.error('Error printing receipt:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting };
}
