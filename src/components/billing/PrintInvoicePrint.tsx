/**
 * PrintInvoicePrint - فاتورة الطباعة الموحدة
 * ✅ تستخدم القاعدة الموحدة (unifiedInvoiceBase) + fetchPrintSettingsForInvoice
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { generatePrintInvoiceHTML } from '@/lib/printInvoiceGenerator';
import type { PrintInvoiceData, PrintItem } from '@/lib/printInvoiceGenerator';

export type { PrintInvoiceData, PrintItem };

export async function printPrintInvoice(data: PrintInvoiceData): Promise<void> {
  const html = await generatePrintInvoiceHTML(data);
  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  showPrintPreview(html, `فاتورة_طباعة_${data.invoiceNumber}`, 'billing-invoices');
  toast.success('تم فتح الفاتورة للطباعة بنجاح!');
}

export function usePrintInvoicePrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const print = async (data: PrintInvoiceData) => {
    setIsPrinting(true);
    try {
      await printPrintInvoice(data);
    } catch (error) {
      console.error('Error printing print invoice:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting, isLoading: false };
}
