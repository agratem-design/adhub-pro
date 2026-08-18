/**
 * AccountStatementPrint - كشف الحساب الموحد
 * ✅ تستخدم القاعدة الموحدة (unifiedInvoiceBase) + fetchPrintSettingsForInvoice
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { generateAccountStatementHTML } from '@/lib/accountStatementGenerator';
import type { AccountStatementData } from '@/lib/accountStatementGenerator';
import type { CanonicalCustomerLedgerResult } from '@/lib/canonicalCustomerLedger';

export interface PrintAccountStatementOptions {
  customerData: {
    id: string;
    name: string;
    company?: string;
    phone?: string;
    email?: string;
  };
  ledgerResult: CanonicalCustomerLedgerResult;
  mode?: 'simple' | 'detailed';
  currency: {
    code: string;
    symbol: string;
    writtenName: string;
  };
  startDate?: string;
  endDate?: string;
  hidePaymentDistribution?: boolean;
  hideStopAdjustments?: boolean;
}

export async function printAccountStatement(
  _theme: any,
  options: PrintAccountStatementOptions
): Promise<void> {
  const data: AccountStatementData = {
    customerData: options.customerData,
    ledgerResult: options.ledgerResult,
    mode: options.mode || 'simple',
    currency: options.currency,
    startDate: options.startDate,
    endDate: options.endDate,
    hidePaymentDistribution: options.hidePaymentDistribution,
    hideStopAdjustments: options.hideStopAdjustments,
  };

  const html = await generateAccountStatementHTML(data);
  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  const modeLabel = options.mode === 'detailed' ? ' تفصيلي' : '';
  showPrintPreview(
    html,
    `كشف حساب${modeLabel} - ${options.customerData.name}${options.startDate && options.endDate ? ` (${options.startDate} إلى ${options.endDate})` : ''}`,
    'billing-statements'
  );
  toast.success(`تم فتح كشف الحساب${modeLabel} للطباعة بنجاح بعملة ${options.currency.code}!`);
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
