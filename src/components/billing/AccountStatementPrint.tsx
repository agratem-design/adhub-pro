/**
 * AccountStatementPrint - كشف الحساب الموحد
 * ✅ تستخدم القاعدة الموحدة (unifiedInvoiceBase) + fetchPrintSettingsForInvoice
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { generateAccountStatementHTML } from '@/lib/accountStatementGenerator';
import type { AccountStatementData } from '@/lib/accountStatementGenerator';

export interface PrintAccountStatementOptions {
  customerData: {
    id: string;
    name: string;
    company?: string;
    phone?: string;
    email?: string;
  };
  transactions: Array<{
    date: string;
    description: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
    notes: string;
    type: string;
    itemTotal?: number | null;
    itemRemaining?: number | null;
    sourceInvoice?: string | null;
    adType?: string | null;
    distributedPaymentId?: string | null;
    distributedPaymentTotal?: number | null;
  }>;
  statistics: {
    totalContracts: number;
    activeContracts: number;
    totalDebits: number;
    totalCredits: number;
    balance: number;
    totalPayments: number;
  };
  currency: {
    code: string;
    symbol: string;
    writtenName: string;
  };
  startDate?: string;
  endDate?: string;
  hidePaymentDistribution?: boolean;
}

export async function printAccountStatement(
  _theme: any,
  options: PrintAccountStatementOptions
): Promise<void> {
  const data: AccountStatementData = {
    customerData: options.customerData,
    transactions: options.transactions,
    statistics: options.statistics,
    currency: options.currency,
    startDate: options.startDate,
    endDate: options.endDate,
    hidePaymentDistribution: options.hidePaymentDistribution,
  };

  const html = await generateAccountStatementHTML(data);
  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  showPrintPreview(html, `كشف حساب ${options.customerData.name}${options.startDate && options.endDate ? ` - ${options.startDate} إلى ${options.endDate}` : ''}`, 'billing-statements');
  toast.success(`تم فتح كشف الحساب للطباعة بنجاح بعملة ${options.currency.code}!`);
}

export function useAccountStatementPrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const print = async (options: PrintAccountStatementOptions) => {
    setIsPrinting(true);
    try {
      await printAccountStatement(null, options);
    } catch (error) {
      console.error('Error printing account statement:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting, isLoading: false };
}
