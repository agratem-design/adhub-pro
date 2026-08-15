/**
 * PurchaseInvoicePrint - فاتورة المشتريات الموحدة
 * ✅ تستخدم القاعدة الموحدة (unifiedInvoiceBase) + fetchPrintSettingsForInvoice
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { generatePurchaseInvoiceHTML } from '@/lib/purchaseInvoiceGenerator';
import type { PurchaseInvoiceData } from '@/lib/purchaseInvoiceGenerator';

export type { PurchaseInvoiceData };

export async function printPurchaseInvoice(data: PurchaseInvoiceData): Promise<void> {
  const html = await generatePurchaseInvoiceHTML(data);
  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  showPrintPreview(html, `فاتورة_مشتريات_${data.invoiceNumber}`, 'billing-invoices');
  toast.success('تم فتح الفاتورة للطباعة بنجاح!');
}

export function usePurchaseInvoicePrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const print = async (data: PurchaseInvoiceData) => {
    setIsPrinting(true);
    try {
      await printPurchaseInvoice(data);
    } catch (error) {
      console.error('Error printing purchase invoice:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting, isLoading: false };
}
