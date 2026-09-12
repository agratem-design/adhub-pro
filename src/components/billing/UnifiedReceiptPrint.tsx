import { usePrintSettingsByType } from '@/store';
/**
 * UnifiedReceiptPrint - طباعة إيصال موحد
 * 
 * ✅ نفس تصميم كشف الحساب (BLACK/GRAY formal theme)
 * ✅ Logo: /logofaresgold.svg (101px)
 * ✅ Compact A4-friendly layout
 * ✅ جدول العقود الموزعة
 */

import { useState } from 'react';
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
  compositeTaskId?: string;
  installationTaskId?: string | null;
  contractNumber: string;
  adType: string;
  amount?: number;
  total?: number | string | null;
  totalPaid?: number | string | null;
  remaining?: number | string | null;
  // New fields for composite tasks and sales invoices
  entityType?: 'contract' | 'composite_task' | 'sales_invoice' | 'printed_invoice' | 'general_credit';
  compositeTaskType?: string; // 'طباعة_تركيب' | 'طباعة_قص_تركيب' | etc.
  teamName?: string;
  groupKey?: string;
  rawAdType?: string;
  taskComponents?: string;
  contractId?: number;
  reinstallationNumber?: number;
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

export function groupReceiptTasks(items: DistributedContract[]): DistributedContract[] {
  const distributedContracts: DistributedContract[] = [];
  const taskGroups = new Map<string, DistributedContract & { teams?: Set<string> }>();
  const countedTasks = new Set<string>();
  for (const item of items) {
    const key = item.entityType === 'composite_task'
      ? item.groupKey || item.installationTaskId || item.compositeTaskId : undefined;
    const existing = key ? taskGroups.get(key) : undefined;
    if (existing) {
      existing.amount = Number(existing.amount || 0) + Number(item.amount || 0);
      if (item.teamName) {
        existing.teams = existing.teams || new Set();
        existing.teams.add(item.teamName);
      }
      // A task can have multiple allocations in the same receipt; count its balance once.
      if (item.compositeTaskId && !countedTasks.has(item.compositeTaskId)) {
        for (const field of ['total', 'totalPaid', 'remaining'] as const) {
          existing[field] = existing[field] == null || item[field] == null
            ? null : Number(existing[field]) + Number(item[field]);
        }
      }
      const descriptions = new Set([existing.compositeTaskType, item.compositeTaskType].filter(Boolean));
      existing.compositeTaskType = [...descriptions].join(' / ');
      
      // ✅ لا يتم ذكر الفرق في الفاتورة الرسمية للزبون
      const cleanBase = (existing.rawAdType 
        ? (existing.rawAdType.includes('طباعة') || existing.rawAdType.includes('تركيب') ? existing.rawAdType : `${existing.rawAdType} (${existing.taskComponents || 'طباعة + تركيب'})`)
        : (existing.taskComponents || existing.adType)) || 'مهمة مجمعة';
      existing.adType = cleanBase.replace(/\s*—\s*(?:فرقة|دانة|فريق).*$/g, '').trim();

      const isFullyPaid = existing.remaining !== null && Number(existing.remaining) <= 0.01 && existing.total !== null && Number(existing.total) > 0;
      if (isFullyPaid && !existing.contractNumber.includes('(مسددة بالكامل)')) {
        existing.contractNumber = `${existing.contractNumber} (مسددة بالكامل)`;
      } else if (!isFullyPaid && existing.contractNumber.includes('(مسددة بالكامل)')) {
        existing.contractNumber = existing.contractNumber.replace(' (مسددة بالكامل)', '');
      }
    } else {
      const row = { ...item };
      // تنظيف البيان من أي أسماء فرق للزبون
      if (row.entityType === 'composite_task') {
        const cleanBase = (row.rawAdType 
          ? (row.rawAdType.includes('طباعة') || row.rawAdType.includes('تركيب') ? row.rawAdType : `${row.rawAdType} (${row.taskComponents || 'طباعة + تركيب'})`)
          : (row.taskComponents || row.adType)) || 'مهمة مجمعة';
        row.adType = cleanBase.replace(/\s*—\s*(?:فرقة|دانة|فريق).*$/g, '').trim();
      }
      if (item.teamName) {
        (row as any).teams = new Set([item.teamName]);
      }
      distributedContracts.push(row);
      if (key) taskGroups.set(key, row as any);
    }
    if (item.compositeTaskId) countedTasks.add(item.compositeTaskId);
  }

  // ✅ ترتيب منطقي للبنود: عقود أولاً ثم مهام مجمعة مرتبة ثم فواتير مبيعات ثم فواتير طباعة ثم الفائض
  distributedContracts.sort((a, b) => {
    const typeOrder = (c: DistributedContract) => {
      if (c.entityType === 'contract' && !c.contractNumber.includes('فائض') && c.contractNumber !== '—') return 1;
      if (c.entityType === 'composite_task') return 2;
      if (c.entityType === 'sales_invoice') return 3;
      if (c.entityType === 'printed_invoice') return 4;
      return 5; // general_credit / surplus
    };
    const orderA = typeOrder(a);
    const orderB = typeOrder(b);
    if (orderA !== orderB) return orderA - orderB;

    if (orderA === 1) {
      const numA = parseInt(a.contractNumber.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.contractNumber.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    }
    if (orderA === 2) {
      const cA = a.contractId || parseInt(a.contractNumber.match(/عقد #?(\d+)/)?.[1] || '0', 10);
      const cB = b.contractId || parseInt(b.contractNumber.match(/عقد #?(\d+)/)?.[1] || '0', 10);
      if (cA !== cB) return cA - cB;
      const rA = a.reinstallationNumber || parseInt(a.contractNumber.match(/إعادة تركيب(?: رقم)? (\d+)/)?.[1] || '0', 10);
      const rB = b.reinstallationNumber || parseInt(b.contractNumber.match(/إعادة تركيب(?: رقم)? (\d+)/)?.[1] || '0', 10);
      return rA - rB;
    }
    if (orderA === 3 || orderA === 4) {
      return a.contractNumber.localeCompare(b.contractNumber, undefined, { numeric: true });
    }
    return 0;
  });

  return distributedContracts;
}

// === MAIN PRINT FUNCTION ===
export async function printUnifiedReceipt(
  settingsOrTheme: any,
  options: PrintUnifiedReceiptOptions
): Promise<void> {
  const { payment, customerData, currency, balanceInfo } = options;
  const distributedContracts = groupReceiptTasks(options.distributedContracts || []);

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
    // Distributed payment - show contracts/tasks/invoices + total + paid + remaining
    columns = [
      { key: 'index', header: '#', width: '6%', align: 'center' },
      { key: 'reference', header: 'المرجع', width: '18%', align: 'center' },
      { key: 'description', header: 'البيان', width: '28%', align: 'right' },
      { key: 'total', header: 'القيمة الإجمالية', width: '16%', align: 'center' },
      { key: 'amount', header: 'المسدد', width: '16%', align: 'center' },
      { key: 'remaining', header: 'المتبقي', width: '16%', align: 'center' },
    ];

    rows = distributedContracts.map((contract, index) => {
      // Determine reference and description based on entity type
      let reference = contract.contractNumber;
      let description = contract.adType || 'لوحة إعلانية';
      
      if (contract.entityType === 'composite_task') {
        reference = contract.contractNumber || 'مهمة مجمعة';
        // البيان: نوع الإعلان مع مكونات المهمة (بدون أسماء الفرق للزبون)
        const cleanBase = (contract.rawAdType 
          ? (contract.rawAdType.includes('طباعة') || contract.rawAdType.includes('تركيب') ? contract.rawAdType : `${contract.rawAdType} (${contract.taskComponents || 'طباعة + تركيب'})`)
          : (contract.taskComponents || contract.adType || contract.compositeTaskType)) || 'مهمة مجمعة';
        description = cleanBase.replace(/\s*—\s*(?:فرقة|دانة|فريق).*$/g, '').trim();
      } else if (contract.entityType === 'sales_invoice') {
        reference = contract.contractNumber && contract.contractNumber !== '—'
          ? (contract.contractNumber.startsWith('فاتورة') ? contract.contractNumber : `فاتورة مبيعات #${contract.contractNumber}`)
          : 'فاتورة مبيعات';
        description = contract.adType || 'مبيعات';
      } else if (contract.entityType === 'printed_invoice') {
        reference = contract.contractNumber && contract.contractNumber !== '—'
          ? (contract.contractNumber.startsWith('فاتورة') ? contract.contractNumber : `فاتورة طباعة #${contract.contractNumber}`)
          : 'فاتورة طباعة';
        description = contract.adType || 'طباعة';
      } else if (contract.entityType === 'general_credit' || contract.contractNumber.includes('فائض') || contract.contractNumber === '—') {
        reference = 'رصيد فائض (غير موزع)';
        description = contract.adType?.replace(/^توزيع على.*?- /g, '') || 'فائض سداد متبقي في حساب العميل';
      } else {
        // Default to contract
        reference = contract.contractNumber.startsWith('عقد') ? contract.contractNumber : `عقد #${contract.contractNumber}`;
      }
      
      return {
        index: index + 1,
        reference,
        description,
        total:
          contract.entityType === 'general_credit' || contract.contractNumber.includes('فائض') || contract.total === null || contract.total === undefined || contract.total === ''
            ? '—'
            : typeof contract.total === 'number'
              ? `${currency.symbol} ${formatArabicNumber(contract.total)}`
              : String(contract.total),
        amount: typeof contract.amount === 'number'
          ? `${currency.symbol} ${formatArabicNumber(contract.amount)}`
          : '—',
        remaining:
          contract.entityType === 'general_credit' || contract.contractNumber.includes('فائض') || contract.remaining === null || contract.remaining === undefined || contract.remaining === ''
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
  const contractCount = distributedContracts.filter(c => (c.entityType === 'contract' || !c.entityType) && c.contractNumber && c.contractNumber !== '—' && !c.contractNumber.includes('فائض')).length;
  const compositeTaskCount = distributedContracts.filter(c => c.entityType === 'composite_task').length;
  const salesInvoiceCount = distributedContracts.filter(c => c.entityType === 'sales_invoice').length;
  const printedInvoiceCount = distributedContracts.filter(c => c.entityType === 'printed_invoice').length;
  const surplusCreditItem = distributedContracts.find(c => c.entityType === 'general_credit' || c.contractNumber.includes('فائض'));
  
  const statisticsCards: { label: string; value: number; unit: string }[] = [];
  if (isDistributed) {
    if (contractCount > 0) statisticsCards.push({ label: 'عقد', value: contractCount, unit: '' });
    if (compositeTaskCount > 0) statisticsCards.push({ label: 'مهمة', value: compositeTaskCount, unit: '' });
    if (salesInvoiceCount > 0) statisticsCards.push({ label: 'فاتورة مبيعات', value: salesInvoiceCount, unit: '' });
    if (printedInvoiceCount > 0) statisticsCards.push({ label: 'فاتورة طباعة', value: printedInvoiceCount, unit: '' });
    if (surplusCreditItem && Number(surplusCreditItem.amount) > 0) {
      statisticsCards.push({ label: 'فائض سداد', value: Number(surplusCreditItem.amount), unit: currency.symbol });
    }
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
      .select('Contract_Number, "Ad Type", Total, "Total Paid"')
      .in('Contract_Number', contractNumbers.map(Number));
    
    if (contracts) {
      return contractNumbers.map(num => {
        const c = contracts.find((item: any) => item.Contract_Number === Number(num));
        const total = c?.Total != null ? Number(c.Total) : null;
        const paid = c?.['Total Paid'] != null ? Number(c['Total Paid']) : null;
        const remaining = total != null && paid != null ? Math.max(0, total - paid) : null;
        return {
          contractNumber: num,
          adType: c?.['Ad Type'] || 'لوحة إعلانية',
          total,
          totalPaid: paid,
          remaining,
        };
      });
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
  const { settings, isLoading } = usePrintSettingsByType(DOCUMENT_TYPES.PAYMENT_RECEIPT);

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
