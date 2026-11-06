import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, X } from "lucide-react";
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import type { UnifiedPrintStyles } from '@/lib/unifiedInvoiceBase';
import { renderUnifiedDocument, escHtml, docMoney, docDate, type DocSection } from '@/lib/unifiedDocument';
import { loadCustomerOverdueInvoices, type UnpaidInvoice } from '@/services/overdueInvoices';

interface OverdueInstallment {
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  installmentAmount: number;
  dueDate: string;
  description: string;
  daysOverdue: number;
  installmentId?: string;
  adType?: string;
}

/** فاتورة غير مسددة (طباعة / مبيعات / أمر عمل) */
export type OverduePrintInvoice = Pick<UnpaidInvoice,
  'invoiceId' | 'amount' | 'createdAt' | 'daysOverdue' | 'adType' | 'invoiceNumber' | 'invoiceName' | 'invoiceTitle' | 'notes'
> & {
  type?: UnpaidInvoice['type'];
  contractNumber: string | number | null;
};

export interface OverduePrintCustomer {
  customerId: string | null;
  customerName: string;
  totalOverdue: number;
  overdueCount?: number;
  oldestDaysOverdue: number;
  installments: OverdueInstallment[];
  /** إن تُركت فارغة تُجلب فواتير الزبون غير المسددة تلقائياً */
  unpaidInvoices?: OverduePrintInvoice[];
  /** المتبقي الفعلي في كشف الحساب، إن عُرف */
  accountRemaining?: number;
}

interface OverduePaymentsPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerOverdue: OverduePrintCustomer;
}

const TYPE_LABEL: Record<string, string> = { sales: 'مبيعات', printed: 'طباعة', composite: 'أمر عمل' };

const invoiceTitle = (i: OverduePrintInvoice) => {
  if (i.type === 'sales') return i.invoiceName ? `فاتورة مبيعات — ${i.invoiceName}` : 'فاتورة مبيعات';
  if (i.type === 'printed') return i.notes ? `فاتورة طباعة (${i.notes})` : 'فاتورة طباعة';
  return i.invoiceTitle || 'فاتورة خدمات';
};

const contractsText = (c: string | number | null) =>
  c == null || c === '' ? '' : String(c).split(',').map(s => `#${s.trim()}`).join('، ');

export function OverduePaymentsPrintDialog({ open, onOpenChange, customerOverdue }: OverduePaymentsPrintDialogProps) {
  const [styles, setStyles] = useState<UnifiedPrintStyles | null>(null);
  const [fetched, setFetched] = useState<{ invoices: OverduePrintInvoice[]; accountRemaining?: number } | null>(null);
  const [loadingStyles, setLoadingStyles] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const given = customerOverdue.unpaidInvoices || [];
  const needFetch = given.length === 0;

  useEffect(() => {
    if (!open) return;
    setLoadingStyles(true);
    getMergedInvoiceStylesAsync('overdue_notice').then((s) => { setStyles(s); setLoadingStyles(false); });
  }, [open]);

  useEffect(() => {
    if (!open || !needFetch) { setFetched(null); return; }
    let cancelled = false;
    setLoadingInvoices(true);
    loadCustomerOverdueInvoices({ customerId: customerOverdue.customerId })
      .then(rows => {
        if (cancelled) return;
        const mine = rows.find(r => customerOverdue.customerId
          ? r.customerId === customerOverdue.customerId
          : r.customerName === customerOverdue.customerName);
        setFetched({ invoices: mine?.invoices || [], accountRemaining: mine?.accountRemaining });
      })
      .catch(err => { console.error('overdue print: load invoices', err); if (!cancelled) setFetched({ invoices: [] }); })
      .finally(() => { if (!cancelled) setLoadingInvoices(false); });
    return () => { cancelled = true; };
  }, [open, needFetch, customerOverdue.customerId, customerOverdue.customerName]);

  const invoices = useMemo(
    () => [...(needFetch ? fetched?.invoices || [] : given)].sort((a, b) => b.daysOverdue - a.daysOverdue),
    [needFetch, fetched, given],
  );

  const installmentsTotal = customerOverdue.installments.reduce((s, i) => s + i.installmentAmount, 0);
  const invoicesTotal = invoices.reduce((s, i) => s + i.amount, 0);
  const gross = installmentsTotal + invoicesTotal;
  const accountRemaining = customerOverdue.accountRemaining ?? fetched?.accountRemaining;
  // نفس منطق تنبيه الزبائن: الإجمالي لا يتجاوز المتبقي الفعلي في كشف الحساب
  const finalDue = !needFetch || invoices.length === 0
    ? customerOverdue.totalOverdue
    : accountRemaining != null
      ? Math.max(0, Math.min(gross, accountRemaining))
      : customerOverdue.totalOverdue + invoicesTotal;
  const creditApplied = Math.max(0, gross - finalDue);
  const oldestDays = Math.max(customerOverdue.oldestDaysOverdue, ...invoices.map(i => i.daysOverdue), 0);
  const itemsCount = customerOverdue.installments.length + invoices.length;

  const salesCount = invoices.filter(i => i.type === 'sales').length;
  const loading = loadingStyles || loadingInvoices;

  const formatDate = (d: string) => docDate(d);
  const money = (n: number) => docMoney(n);

  // ✅ المستند الموحد — نفس الكود لكل الفواتير والإيصالات، والألوان من إعدادات الطباعة
  const html = useMemo(() => {
    if (!styles) return '';
    const sections: DocSection[] = [];
    if (customerOverdue.installments.length) {
      sections.push({
        title: `أقساط العقود المتأخرة (${customerOverdue.installments.length})`,
        aside: money(installmentsTotal),
        columns: [
          { key: 'i', header: '#', width: '5%' },
          { key: 'contract', header: 'العقد', width: '13%' },
          { key: 'desc', header: 'البيان', align: 'right' },
          { key: 'ad', header: 'نوع الإعلان', width: '15%' },
          { key: 'due', header: 'الاستحقاق', width: '13%' },
          { key: 'days', header: 'التأخير', width: '10%' },
          { key: 'amt', header: 'المبلغ', width: '14%' },
        ],
        rows: customerOverdue.installments.map((i, idx) => ({
          i: idx + 1,
          contract: `#${i.contractNumber}`,
          desc: escHtml(i.description || 'قسط مستحق'),
          ad: escHtml(i.adType || '—'),
          due: formatDate(i.dueDate),
          days: `<span class="os-days">${i.daysOverdue} يوم</span>`,
          amt: `<span class="os-due">${money(i.installmentAmount)}</span>`,
        })),
      });
    }
    if (invoices.length) {
      sections.push({
        title: `الفواتير غير المسددة (${invoices.length})`,
        aside: money(invoicesTotal),
        columns: [
          { key: 'i', header: '#', width: '5%' },
          { key: 'type', header: 'النوع', width: '10%' },
          { key: 'inv', header: 'الفاتورة', align: 'right' },
          { key: 'contract', header: 'العقد / الإعلان', width: '14%' },
          { key: 'date', header: 'تاريخ الإصدار', width: '12%' },
          { key: 'days', header: 'التأخير', width: '10%' },
          { key: 'amt', header: 'المتبقي', width: '14%' },
        ],
        rows: invoices.map((inv, idx) => ({
          i: idx + 1,
          type: inv.type ? `<span class="os-tag ${inv.type}">${TYPE_LABEL[inv.type]}</span>` : '—',
          inv: `<div style="font-weight:800">${escHtml(invoiceTitle(inv))}</div>${inv.invoiceNumber ? `<div class="os-muted">${escHtml(inv.type === 'sales' ? `رقم ${inv.invoiceNumber}` : inv.invoiceNumber)}</div>` : ''}`,
          contract: `${contractsText(inv.contractNumber) || '—'}${inv.adType ? `<div class="os-muted">${escHtml(inv.adType)}</div>` : ''}`,
          date: formatDate(inv.createdAt),
          days: `<span class="os-days">${inv.daysOverdue} يوم</span>`,
          amt: `<span class="os-due">${money(inv.amount)}</span>`,
        })),
      });
    }
    if (!itemsCount && !loading) sections.push({ kind: 'html', html: '<p class="os-empty">لا توجد مستحقات متأخرة لهذا الزبون.</p>' });
    return renderUnifiedDocument(styles, {
      title: 'كشف المستحقات المتأخرة',
      subtitle: 'بيان تفصيلي بالأقساط والفواتير غير المسددة',
      pageTitle: `كشف المستحقات المتأخرة — ${customerOverdue.customerName}`,
      info: [
        { label: 'اسم الزبون', value: escHtml(customerOverdue.customerName) },
        { label: 'عدد البنود المتأخرة', value: itemsCount },
        { label: 'أقدم تأخير', value: `${oldestDays} يوم` },
        { label: 'تاريخ الإصدار', value: formatDate(new Date().toISOString()) },
      ],
      total: { label: 'إجمالي المستحق', value: money(finalDue) },
      sections,
      summary: creditApplied > 0.5 ? [
        { label: 'مجموع البنود', value: money(gross) },
        { label: 'يُخصم رصيد الحساب', value: `− ${money(creditApplied)}` },
        { label: 'المستحق', value: money(finalDue) },
      ] : undefined,
      notes: 'يُرجى تسديد المبالغ المستحقة في أقرب وقت ممكن، ولأي استفسار يرجى التواصل مع قسم الحسابات.',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styles, customerOverdue, invoices, finalDue, loading]);

  const handlePrint = async () => {
    if (!html) return;
    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(html, `كشف المستحقات المتأخرة — ${customerOverdue.customerName}`, 'billing-overdue');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <h2 className="text-lg font-bold">كشف المستحقات المتأخرة</h2>
            <p className="text-xs text-muted-foreground">
              {customerOverdue.installments.length} قسط · {invoices.length} فاتورة{salesCount ? ` (منها ${salesCount} مبيعات)` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrint} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}طباعة
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" size="icon" aria-label="إغلاق"><X className="h-4 w-4" /></Button>
          </div>
        </div>
        {html
          ? <iframe title="معاينة كشف المستحقات" srcDoc={html} className="w-full h-[70vh] rounded-lg border bg-white" />
          : <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      </DialogContent>
    </Dialog>
  );
}
