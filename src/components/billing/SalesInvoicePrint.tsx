/**
 * SalesInvoicePrint - فاتورة المبيعات الموحدة
 * ✅ تستخدم القاعدة الموحدة (unifiedInvoiceBase) + fetchPrintSettingsForInvoice
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { generateSalesInvoiceHTML } from '@/lib/salesInvoiceGenerator';
import type { SalesInvoiceData } from '@/lib/salesInvoiceGenerator';

export type { SalesInvoiceData };

export async function printSalesInvoice(data: SalesInvoiceData): Promise<void> {
  const html = await generateSalesInvoiceHTML(data);
  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  showPrintPreview(html, `فاتورة_مبيعات_${data.invoiceNumber}`, 'billing-invoices');
  toast.success('تم فتح الفاتورة للطباعة بنجاح!');
}

export function useSalesInvoicePrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const print = async (data: SalesInvoiceData) => {
    setIsPrinting(true);
    try {
      await printSalesInvoice(data);
    } catch (error) {
      console.error('Error printing sales invoice:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting, isLoading: false };
}
