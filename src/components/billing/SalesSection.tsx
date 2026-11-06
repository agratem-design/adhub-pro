import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, DollarSign, Edit, MoreHorizontal, Printer, ShoppingBag, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { generateSalesInvoiceHTML } from './InvoiceTemplates';
import { SalesInvoiceEditDialog } from './SalesInvoiceEditDialog';
import { SalesInvoicePaymentDialog } from './SalesInvoicePaymentDialog';
import {
  InvoiceItemsTable, InvoiceSummary, InvoiceToolbar, PaidStatus, fmtDate, fmtMoney, type InvoiceFilter,
} from './InvoiceListParts';

interface SalesSectionProps {
  customerId: string;
  invoices: any[];
  onRefresh: () => void;
  /** داخل تبويب له عنوانه بالفعل (صفحة الزبون) */
  embedded?: boolean;
}

const parseItems = (raw: any): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
};

export function SalesSection({ customerId, invoices, onRefresh, embedded = false }: SalesSectionProps) {
  const { confirm: systemConfirm } = useSystemDialog();
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [payInvoice, setPayInvoice] = useState<any>(null);
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => invoices
    .map(inv => {
      const total = Number(inv.total_amount) || 0;
      const paid = Number(inv.paid_amount) || 0;
      const remaining = Math.max(0, total - paid);
      return { inv, total, paid, remaining, isPaid: remaining <= 0.01, items: parseItems(inv.items) };
    })
    .sort((a, b) => {
      // غير المسددة أولاً ثم الأحدث
      if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
      return String(b.inv.invoice_date || b.inv.created_at || '').localeCompare(String(a.inv.invoice_date || a.inv.created_at || ''));
    }), [invoices]);

  const counts = {
    all: rows.length,
    open: rows.filter(r => !r.isPaid).length,
    settled: rows.filter(r => r.isPaid).length,
  };

  const visible = rows.filter(r => {
    if (filter === 'open' && r.isPaid) return false;
    if (filter === 'settled' && !r.isPaid) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.inv.invoice_number, r.inv.invoice_name, r.inv.notes].some(v => String(v || '').toLowerCase().includes(q));
  });

  const totalAmount = rows.reduce((s, r) => s + r.total, 0);
  const totalPaid = rows.reduce((s, r) => s + Math.min(r.paid, r.total), 0);
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);

  const handleDelete = async (invoice: any) => {
    const ok = await systemConfirm({
      title: 'حذف فاتورة المبيعات',
      message: `سيتم حذف الفاتورة #${invoice.invoice_number} والدفعات المرتبطة بها. متابعة؟`,
      variant: 'destructive',
      confirmText: 'حذف',
    });
    if (!ok) return;
    try {
      await supabase.from('customer_payments').delete().eq('sales_invoice_id', invoice.id);
      const { error } = await supabase.from('sales_invoices').delete().eq('id', invoice.id);
      if (error) throw error;
      toast.success('تم حذف الفاتورة بنجاح');
      onRefresh();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('فشل حذف الفاتورة');
    }
  };

  const handlePrint = async (invoice: any) => {
    const items = parseItems(invoice.items);
    const html = await generateSalesInvoiceHTML({
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      invoiceName: invoice.invoice_name || undefined,
      customerName: invoice.customer_name,
      items: items.map((item: any) => ({
        description: item.item_name,
        quantity: item.quantity,
        unit: item.unit || '',
        unitPrice: item.unit_price,
        total: item.total_price,
        image_url: item.image_url || undefined,
      })),
      discount: invoice.discount || 0,
      totalAmount: invoice.total_amount,
      notes: invoice.notes || undefined,
    } as any);
    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(html, `فاتورة مبيعات ${invoice.invoice_number}${invoice.invoice_name ? ' - ' + invoice.invoice_name : ''}`, 'billing-invoices');
  };

  return (
    <section className={cn('space-y-3', !embedded && 'mt-6 rounded-2xl border border-border bg-card p-4')}>
      {!embedded && (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold">فواتير المبيعات</h3>
            <p className="text-xs text-muted-foreground">{counts.all} فاتورة · {counts.settled} مسددة · {counts.open} مفتوحة</p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-muted-foreground">
          <ShoppingBag className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">لا توجد فواتير مبيعات لهذا الزبون</p>
        </div>
      ) : (
        <>
          <InvoiceSummary total={totalAmount} paid={totalPaid} remaining={totalRemaining} />
          <InvoiceToolbar search={search} onSearch={setSearch} filter={filter} onFilter={setFilter} counts={counts} />

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-3 py-2 text-right font-medium">الفاتورة</th>
                  <th className="px-3 py-2 text-right font-medium">التاريخ</th>
                  <th className="px-3 py-2 text-left font-medium">الإجمالي</th>
                  <th className="px-3 py-2 text-left font-medium">المدفوع</th>
                  <th className="px-3 py-2 text-left font-medium">المتبقي</th>
                  <th className="px-3 py-2 text-right font-medium">الحالة</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(({ inv, total, paid, remaining, isPaid, items }) => {
                  const open = expanded === inv.id;
                  return (
                    <Fragment key={inv.id}>
                      <tr className={cn('hover:bg-muted/20', open && 'bg-muted/20')}>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => setExpanded(open ? null : inv.id)}
                            aria-expanded={open} aria-label="عرض البنود"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold">{inv.invoice_name || 'فاتورة مبيعات'}</div>
                          <div className="text-xs tabular-nums text-muted-foreground">#{inv.invoice_number} · {items.length} بند</div>
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{fmtDate(inv.invoice_date || inv.created_at)}</td>
                        <td className="px-3 py-2 text-left font-semibold tabular-nums">{fmtMoney(total)}</td>
                        <td className="px-3 py-2 text-left tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(paid)}</td>
                        <td className={cn('px-3 py-2 text-left font-semibold tabular-nums', isPaid ? 'text-muted-foreground' : 'text-destructive')}>{isPaid ? '—' : fmtMoney(remaining)}</td>
                        <td className="px-3 py-2"><PaidStatus total={total} settled={paid} /></td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            {!isPaid && (
                              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setPayInvoice(inv)}>
                                <DollarSign className="h-3.5 w-3.5" />سداد
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-8 p-0')} aria-label="إجراءات الفاتورة">
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 text-right">
                                <DropdownMenuItem onClick={() => handlePrint(inv)}><Printer className="ml-2 h-4 w-4" />طباعة</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditInvoice(inv)}><Edit className="ml-2 h-4 w-4" />تعديل</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(inv)}><Trash2 className="ml-2 h-4 w-4" />حذف</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-muted/10">
                          <td />
                          <td colSpan={7} className="px-3 pb-3 pt-1">
                            <div className="rounded-lg border border-border bg-card p-2">
                              <InvoiceItemsTable items={items.map((it: any) => ({
                                name: it.item_name, quantity: Number(it.quantity) || 0, unit: it.unit,
                                unitPrice: Number(it.unit_price) || 0, total: Number(it.total_price) || 0,
                              }))} />
                              {(Number(inv.discount) > 0 || inv.notes) && (
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 px-2 pt-2 text-xs text-muted-foreground">
                                  {Number(inv.discount) > 0 && <span>الخصم: <b className="tabular-nums text-foreground">{fmtMoney(Number(inv.discount))} د.ل</b></span>}
                                  {inv.notes && <span>ملاحظات: {inv.notes}</span>}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {!visible.length && (
                  <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">لا توجد فواتير مطابقة</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SalesInvoiceEditDialog
        open={!!editInvoice}
        onOpenChange={(o) => { if (!o) setEditInvoice(null); }}
        invoice={editInvoice}
        onSuccess={onRefresh}
      />
      <SalesInvoicePaymentDialog
        open={!!payInvoice}
        onOpenChange={(o) => { if (!o) setPayInvoice(null); }}
        invoice={payInvoice}
        customerId={customerId}
        onPaymentAdded={onRefresh}
      />
    </section>
  );
}
