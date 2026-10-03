import { buildSizesInvoiceHTML } from '@/lib/sizesInvoice';
import { DEFAULT_PRINT_SETTINGS, type PrintSettings } from '@/types/print-settings';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_INFO, type DocumentType } from '@/types/document-types';
import { mapPrintSettingsToInvoiceStyles } from '@/utils/invoicePrintSettingsBridge';
import { resolveInvoiceStyles } from '@/lib/unifiedInvoiceBase';
import { generateSalesInvoiceHTML } from '@/lib/salesInvoiceGenerator';
import { generatePurchaseInvoiceHTML } from '@/lib/purchaseInvoiceGenerator';
import { generateContractInvoiceHTML } from '@/lib/contractInvoiceGenerator';
import { generateQuoteHTML } from '@/lib/quoteGenerator';
import { generatePrintInvoiceHTML } from '@/lib/printInvoiceGenerator';
import { generateAccountStatementHTML } from '@/lib/accountStatementGenerator';
import { generateOverdueNoticeHTML } from '@/lib/overdueNoticeGenerator';
import { buildCutoutTaskHTML } from '@/lib/cutoutTaskPrintGenerator';
import { buildPrintTaskHTML } from '@/lib/printTaskPrintGenerator';
import { buildUnifiedReceiptPrintOptions } from '@/components/billing/UnifiedReceiptPrint';
import { buildTeamReceiptHTML } from '@/components/teams/TeamPaymentReceiptDialog';
import { buildExpenseReceiptHTML } from '@/components/billing/ExpenseReceiptPrintDialog';
import { buildFriendReceiptHTML } from '@/components/billing/FriendRentalReceiptPrintDialog';
import { generateStatementHTML } from '@/components/custody/CustodyStatementPrint';
import { generateInvoiceHTML } from '@/components/composite-tasks/CompositeTaskInvoicePrint';
import { createMeasurementsConfigFromSettings, generateMeasurementsHTML } from '@/lib/printMeasurements';

// These fixtures are deliberately separate from production data. Each route uses
// the renderer used by the corresponding real print action, with unsaved styles.
async function renderPrintTemplatePreview(settings: Omit<PrintSettings, 'document_type'>, type: DocumentType): Promise<string> {
  const full = { ...DEFAULT_PRINT_SETTINGS, ...settings, document_type: type };
  const mapped = mapPrintSettingsToInvoiceStyles(full);
  const t = await resolveInvoiceStyles('sales_invoice', { titleAr: full.document_title_ar || DOCUMENT_TYPE_INFO[type].nameAr, titleEn: full.document_title_en || DOCUMENT_TYPE_INFO[type].nameEn }, mapped);
  const styles = mapped as any;
  const date = '2026-10-01';
  const customer = 'عميل تجريبي';
  const currency = { code: 'LYD', symbol: 'د.ل', name: 'دينار ليبي', writtenName: 'دينار ليبي' };
  const basic = { invoiceNumber: 'PREVIEW-001', invoiceDate: date, customerName: customer, customerCompany: 'شركة المثال التجارية', totalAmount: 1200, autoPrint: false };
  const items = [{ description: 'لوحة إعلانية تجريبية', quantity: 2, unit: 'لوحة', unitPrice: 600, total: 1200 }];
  const task = { id: 'preview', contract_id: 1170, customer_name: customer, status: 'pending', total_quantity: 2, unit_cost: 600, total_cost: 1200, due_date: date, completed_at: null, created_at: date, total_area: 24, price_per_meter: 50 };
  const taskItem = { id: 'preview', billboard_id: 1, description: 'لوحة تجريبية', quantity: 2, unit_cost: 600, total_cost: 1200, customer_unit_price: 600, customer_total_price: 1200, cutout_quantity: 1, cutout_image_url: null, billboard_name: 'لوحة تجريبية', billboard_size: '4 × 3', width: 4, height: 3, area: 12, design_face_a: null, design_face_b: null };
  switch (type) {
    case DOCUMENT_TYPES.PAYMENT_RECEIPT:
      return generateMeasurementsHTML(buildUnifiedReceiptPrintOptions(full, {
        payment: { id: 'preview', amount: 12500, paid_at: date, method: 'نقدي', distributed_payment_id: 'preview' },
        customerData: { id: 'preview', name: customer, company: 'شركة المثال التجارية' }, currency,
        distributedContracts: [{ contractNumber: '1170', adType: 'لوحة إعلانية', amount: 10000, total: 19000, totalPaid: 10000, remaining: 9000 }, { contractNumber: '1171', adType: 'لوحة إعلانية', amount: 2500, total: 3700, totalPaid: 2500, remaining: 1200 }],
        balanceInfo: { totalPaid: 12500, remainingBalance: 10200 },
      }));
    case DOCUMENT_TYPES.CUT_TASK: return buildCutoutTaskHTML(styles, task, [taskItem], 'مصنع تجريبي');
    case DOCUMENT_TYPES.PRINT_TASK: return buildPrintTaskHTML(styles, task, [taskItem], 'مطبعة تجريبية');
    case DOCUMENT_TYPES.SALES_INVOICE: return generateSalesInvoiceHTML({ ...basic, items }, t);
    case DOCUMENT_TYPES.PURCHASE_INVOICE: return generatePurchaseInvoiceHTML({ ...basic, supplierName: 'مورد تجريبي', items }, t);
    case DOCUMENT_TYPES.CONTRACT_INVOICE: return generateContractInvoiceHTML({ ...basic, contractId: 1170, currencySymbol: currency.symbol, currencyWrittenName: currency.name, items: [{ size: '4 × 3', faces: 2, billboardCount: 2, unitPrice: 600, totalPrice: 1200 }], totalBillboards: 2, grandTotal: 1200 }, t);
    case DOCUMENT_TYPES.QUOTATION: return generateQuoteHTML({ contractNumber: 'PREVIEW-001', date: new Date(date), adType: 'لوحات إعلانية', clientName: customer, clientRep: 'ممثل العميل', clientPhone: '0910000000', companyName: full.company_name, companyAddress: full.company_address, companyRep: 'ممثل الشركة', iban: '', durationMonths: 3, grandTotal: 1200, items: [{ index: 1, mapUrl: '', city: 'طرابلس', municipality: 'طرابلس', landmark: 'موقع تجريبي', size: '4 × 3', facesCount: '2', endDate: date, price: 1200, imageUrl: '' }], autoPrint: false }, t);
    case DOCUMENT_TYPES.PRINT_SERVICE_INVOICE: return generatePrintInvoiceHTML({ ...basic, currency, subtotal: 1200, items: [{ size: '4 × 3', quantity: 2, faces: 1, totalFaces: 2, area: 12, pricePerMeter: 50, totalArea: 24, totalPrice: 1200, width: 4, height: 3 }] }, t);
    case DOCUMENT_TYPES.ACCOUNT_STATEMENT: return generateAccountStatementHTML({ customerData: { id: 'preview', name: customer }, currency, transactions: [{ date, reference: 'عقد #1170', description: 'قيمة عقد تجريبي', debit: 19000, credit: 0, balance: 19000 }, { date, reference: 'إيصال PREVIEW-001', description: 'دفعة مستلمة', debit: 0, credit: 12500, balance: 6500 }], statistics: { totalContracts: 1 }, autoPrint: false }, t);
    case DOCUMENT_TYPES.LATE_NOTICE: return generateOverdueNoticeHTML({ customerName: customer, contractNumber: 1170, installmentNumber: 1, dueDate: date, amount: 1200, overdueDays: 15, autoPrint: false }, t);
    case DOCUMENT_TYPES.TEAM_PAYMENT_RECEIPT: return buildTeamReceiptHTML(styles, { amount: 1200, paid_at: date, billboards: [{ billboard_name: 'لوحة تجريبية', size: '4 × 3', amount: 1200, contract_id: 1170 }] }, 'فريق تركيب تجريبي');
    case DOCUMENT_TYPES.FRIEND_RENT_RECEIPT: return buildFriendReceiptHTML(styles, { billboard_id: 1, friend_rental_cost: 1200, contract_number: 1170, start_date: date, end_date: '2026-12-31', contract_id: 1170 }, customer, { Billboard_Name: 'لوحة تجريبية', Size: '4 × 3' }, null);
    case DOCUMENT_TYPES.EXPENSE_INVOICE: return buildExpenseReceiptHTML(styles, { expense_date: date, receipt_number: 'PREVIEW-001', amount: 1200, description: 'مصروفات تشغيل تجريبية', category: 'تشغيل', recipient_name: 'مستفيد تجريبي', payment_method: 'cash' });
    case DOCUMENT_TYPES.CUSTODY_STATEMENT: return generateStatementHTML({ account_number: 'PREVIEW-001', employee: { name: 'موظف تجريبي', position: 'مشرف' }, assigned_date: date, initial_amount: 2000, current_balance: 1500 }, [], [{ expense_date: date, amount: 500, description: 'مصروف تجريبي', expense_category: 'تشغيل', receipt_number: 'PREVIEW-002' }], styles);
    case DOCUMENT_TYPES.INSTALLATION_INVOICE:
    case DOCUMENT_TYPES.CUSTOMER_INVOICE:
    case DOCUMENT_TYPES.COMBINED_TASK: {
      const installationOnly = type === DOCUMENT_TYPES.INSTALLATION_INVOICE;
      return generateInvoiceHTML({ ...task, task_number: 'PREVIEW-001', invoice_date: date, customer_print_cost: installationOnly ? 0 : 1200, customer_installation_cost: 500, customer_cutout_cost: installationOnly ? 0 : 300, customer_total: installationOnly ? 500 : 2000 } as any, { print: installationOnly ? null : { print_task_items: [taskItem], customer_price_per_meter: 50 }, installationItems: [{ ...taskItem, customer_installation_cost: 500 }], billboardSizes: {}, totalCutouts: installationOnly ? 0 : 2 }, true, t.fullLogoUrl, 'detailed', styles, styles);
    }
    case DOCUMENT_TYPES.MEASUREMENTS_INVOICE: return buildSizesInvoiceHTML(full, { billboards: [{ Size: '4 × 3', Faces_Count: 2 }, { Size: '4 × 3', Faces_Count: 2 }], dimensions: { '4 × 3': { width: 4, height: 3 } }, customerName: customer, contractNumbers: ['1170'], date });
  }
}

export async function buildPrintTemplatePreview(settings: Omit<PrintSettings, 'document_type'>, type: DocumentType): Promise<string> {
  const html = await renderPrintTemplatePreview(settings, type);
  return html.replace(/<script[^>]*>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi, '');
}
