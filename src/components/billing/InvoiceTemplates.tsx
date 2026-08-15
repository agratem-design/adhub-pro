/**
 * InvoiceTemplates.tsx - Thin Adapter Layer
 * 
 * ⚠️ This file is now a backward-compatible adapter that delegates
 * all HTML generation to the unified engine (src/lib/unifiedInvoiceBase.ts).
 * 
 * All hardcoded HTML/CSS has been removed. Print settings come from the database.
 */

import { generatePurchaseInvoiceHTML as _genPurchase } from '@/lib/purchaseInvoiceGenerator';
import type { PurchaseInvoiceData as UnifiedPurchaseData } from '@/lib/purchaseInvoiceGenerator';
import { generateSalesInvoiceHTML as _genSales } from '@/lib/salesInvoiceGenerator';
import type { SalesInvoiceData as UnifiedSalesData } from '@/lib/salesInvoiceGenerator';
import { generatePrintInvoiceHTML as _genPrint } from '@/lib/printInvoiceGenerator';
import type { PrintInvoiceData, PrintItem } from '@/lib/printInvoiceGenerator';
import { numberToArabicWords } from '@/lib/printUtils';

// =====================================================
// Re-exports for backward compatibility
// =====================================================
export { numberToArabicWords };
export type { PrintItem };

// =====================================================
// Legacy Interface: ModernInvoiceData (sales invoice)
// =====================================================
export interface ModernInvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  invoiceName?: string;
  invoiceTitleEn?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  totalAmount: number;
  totalInWords: string;
  notes?: string;
}

/**
 * generateModernInvoiceHTML - Legacy adapter
 * Delegates to the unified sales invoice generator
 */
export const generateModernInvoiceHTML = async (data: ModernInvoiceData): Promise<string> => {
  return _genSales({
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.date,
    invoiceName: data.invoiceName,
    customerName: data.customerName,
    items: data.items,
    totalAmount: data.totalAmount,
    notes: data.notes || (data.totalInWords ? `المبلغ بالكلمات: ${data.totalInWords}` : undefined),
  });
};

export const generateInvoiceHTML = generateModernInvoiceHTML;

// =====================================================
// Legacy Interface: ModernPrintInvoiceData (print invoice)
// =====================================================
export interface ModernPrintInvoiceData {
  invoiceNumber: string;
  invoiceType: string;
  invoiceDate: string;
  customerName: string;
  items: Array<{
    size: string;
    quantity: number | string;
    faces: number | string;
    totalFaces: number | string;
    width?: number | string;
    height?: number | string;
    area?: number | string;
    pricePerMeter?: number | string;
    totalPrice?: number | string;
  }>;
  totalAmount: number;
  notes?: string;
  printerName?: string;
  hidePrices?: boolean;
  showNotes?: boolean;
  isReinstallation?: boolean;
}

/**
 * generateModernPrintInvoiceHTML - Legacy adapter
 * Delegates to the unified print invoice generator
 */
export const generateModernPrintInvoiceHTML = async (data: ModernPrintInvoiceData): Promise<string> => {
  // Map legacy items to unified PrintItem format
  const mappedItems: PrintItem[] = (data.items || [])
    .filter(item => item.size) // skip empty rows
    .map(item => ({
      size: String(item.size),
      quantity: Number(item.quantity) || 0,
      faces: Number(item.faces) || 0,
      totalFaces: Number(item.totalFaces) || 0,
      area: Number(item.area) || 0,
      pricePerMeter: Number(item.pricePerMeter) || 0,
      totalArea: (Number(item.area) || 0) * (Number(item.totalFaces) || 0),
      totalPrice: Number(item.totalPrice) || 0,
      width: Number(item.width) || 0,
      height: Number(item.height) || 0,
    }));

  const subtotal = mappedItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const printData: PrintInvoiceData = {
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate,
    customerName: data.customerName,
    items: mappedItems,
    currency: { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
    subtotal: subtotal,
    totalAmount: data.totalAmount,
    notes: data.showNotes !== false ? data.notes : undefined,
    printerForDisplay: data.hidePrices,
    isReinstallation: data.isReinstallation,
    autoPrint: true,
  };

  return _genPrint(printData);
};

// =====================================================
// Legacy Interface: PurchaseInvoiceData
// =====================================================
export interface PurchaseInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  invoiceName?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    total: number;
    image_url?: string;
    width?: number | null;
    height?: number | null;
    depth?: number | null;
  }>;
  discount?: number;
  totalAmount: number;
  notes?: string;
}

/**
 * generatePurchaseInvoiceHTML - Legacy adapter
 * Delegates to the unified purchase invoice generator
 */
export const generatePurchaseInvoiceHTML = async (data: PurchaseInvoiceData): Promise<string> => {
  return _genPurchase({
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate,
    invoiceName: data.invoiceName,
    supplierName: data.customerName,
    items: data.items,
    discount: data.discount,
    totalAmount: data.totalAmount,
    notes: data.notes,
    autoPrint: true,
  });
};

/**
 * generateSalesInvoiceHTML - Legacy adapter
 * Delegates to the unified sales invoice generator
 */
export const generateSalesInvoiceHTML = async (data: PurchaseInvoiceData): Promise<string> => {
  return _genSales({
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate,
    invoiceName: data.invoiceName || 'فاتورة مبيعات',
    customerName: data.customerName,
    items: data.items,
    discount: data.discount,
    totalAmount: data.totalAmount,
    notes: data.notes,
    autoPrint: true,
  });
};
