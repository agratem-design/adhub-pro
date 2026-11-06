import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowRightLeft, ChevronDown, DollarSign, Edit, Loader2, Lock, MoreHorizontal, Printer, ShoppingCart, Trash2, Undo2,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { deleteDistributedPayment, deletePayment } from '@/services/customerPaymentOps';
import { PurchaseInvoicePaymentDialog } from './PurchaseInvoicePaymentDialog';
import { PurchaseInvoiceEditDialog } from './PurchaseInvoiceEditDialog';
import { EnhancedDistributePaymentDialog } from './EnhancedDistributePaymentDialog';
import { generatePurchaseInvoiceHTML } from './InvoiceTemplates';
import {
  InvoiceItemsTable, InvoiceSummary, InvoiceToolbar, PaidStatus, fmtDate, fmtMoney, type InvoiceFilter,
} from './InvoiceListParts';

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  paid?: boolean;
  locked?: boolean;
  invoice_name: string | null;
  notes: string | null;
  used_as_payment?: number;
}

interface PurchaseInvoicesSectionProps {
  customerId: string;
  customerName: string;
  invoices: PurchaseInvoice[];
  onRefresh: () => void;
}

type ItemRow = { name: string; quantity: number; unit?: string; unitPrice: number; total: number };

export function PurchaseInvoicesSection({ customerId, customerName, invoices, onRefresh }: PurchaseInvoicesSectionProps) {
  const { confirm: systemConfirm } = useSystemDialog();
  const [payInvoice, setPayInvoice] = useState<PurchaseInvoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<PurchaseInvoice | null>(null);
  const [useInvoice, setUseInvoice] = useState<PurchaseInvoice | null>(null);
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemsById, setItemsById] = useState<Record<string, ItemRow[] | 'loading'>>({});

  const rows = useMemo(() => invoices
    .map(inv => {
      const total = Number(inv.total_amount) || 0;
      const paid = Number(inv.paid_amount) || 0;
      const used = Number(inv.used_as_payment) || 0;
      const settled = paid + used;
      const remaining = Math.max(0, total - settled);
      const isSettled = !!inv.paid || remaining <= 0.01;
      const available = Math.max(0, total - used);
      return { inv, total, paid, used, settled, remaining, isSettled, available };
    })
    .sort((a, b) => {
      if (a.isSettled !== b.isSettled) return a.isSettled ? 1 : -1;
      return String(b.inv.invoice_date || '').localeCompare(String(a.inv.invoice_date || ''));
    }), [invoices]);

  const counts = {
    all: rows.length,
    open: rows.filter(r => !r.isSettled).length,
    settled: rows.filter(r => r.isSettled).length,
  };

  const visible = rows.filter(r => {
    if (filter === 'open' && r.isSettled) return false;
    if (filter === 'settled' && !r.isSettled) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.inv.invoice_number, r.inv.invoice_name, r.inv.notes].some(v => String(v || '').toLowerCase().includes(q));
  });

  const totalAmount = rows.reduce((s, r) => s + r.total, 0);
  const totalSettled = rows.reduce((s, r) => s + Math.min(r.settled, r.total), 0);
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);
  const totalAvailable = rows.reduce((s, r) => s + r.available, 0);

  const loadItems = async (id: string) => {
    if (itemsById[id]) return;
    setItemsById(m => ({ ...m, [id]: 'loading' }));
    const { data, error } = await supabase
      .from('purchase_invoice_items').select('*').eq('invoice_id', id).order('created_at', { ascending: true });
    if (error) { toast.error('تعذّر تحميل بنود الفاتورة'); setItemsById(m => { const n = { ...m }; delete n[id]; return n; }); return; }
    setItemsById(m => ({
      ...m,
      [id]: (data || []).map((it: any) => ({
        name: it.item_name, quantity: Number(it.quantity) || 0, unit: it.unit,
        unitPrice: Number(it.unit_price) || 0, total: Number(it.total_price) || 0,
      })),
    }));
  };

  const toggle = (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next) loadItems(next);
  };

  /** التراجع عن استخدام فاتورة المشتريات كدفعة: يلغي كل الدفعات المربوطة بها ويعيد قيمتها إلى الرصيد المتاح */
  const handleUndoUse = async (invoice: PurchaseInvoice) => {
    const { data: list, error } = await supabase
      .from('customer_payments').select('id, distributed_payment_id').eq('purchase_invoice_id', invoice.id);
    if (error) { toast.error('تعذّر قراءة الدفعات المربوطة بالفاتورة'); return; }
    if (!list?.length) { toast.error('لا توجد دفعات مربوطة بهذه الفاتورة'); return; }
    const groups = [...new Set(list.map(r => r.distributed_payment_id).filter(Boolean))] as string[];
    const singles = list.filter(r => !r.distributed_payment_id);
    const groupNote = groups.length
      ? ' التوزيع يُلغى كاملاً، بما فيه أجزاؤه المربوطة بعقود أو فواتير أخرى، مع العهد والسلف والسحوبات المرتبطة به.'
      : '';
    const ok = await systemConfirm({
      title: 'التراجع عن استخدام الفاتورة كدفعة',
      message: `ستُلغى دفعات الفاتورة #${invoice.invoice_number} وتعود قيمتها إلى الرصيد المتاح.${groupNote} متابعة؟`,
      variant: 'destructive',
      confirmText: 'تراجع',
    });
    if (!ok) return;
    try {
      const { data: cust } = await supabase.from('customers').select('linked_friend_company_id').eq('id', customerId).maybeSingle();
      const friendId = (cust as any)?.linked_friend_company_id || null;
      for (const g of groups) await deleteDistributedPayment(g, friendId);
      for (const s of singles) await deletePayment(s.id, friendId);
      toast.success('تم التراجع عن استخدام الفاتورة كدفعة');
    } catch (e: any) {
      toast.error(e?.message || 'فشل التراجع');
    } finally {
      onRefresh();
    }
  };

  const handleAddPayment = (invoice: PurchaseInvoice) => {
    if (invoice.locked) { toast.error('لا يمكن إضافة دفعات لفاتورة مسددة بالكامل'); return; }
    setPayInvoice(invoice);
  };

  const handleUseAsPayment = (invoice: PurchaseInvoice) => {
    const availableCredit = Number(invoice.total_amount) - Number(invoice.used_as_payment || 0);
    if (availableCredit <= 0) { toast.error('لا يوجد رصيد متاح لاستخدامه كدفعة'); return; }
    setUseInvoice({ ...invoice, customer_id: invoice.customer_id || customerId, customer_name: invoice.customer_name || customerName });
  };

  const handlePrint = async (invoice: PurchaseInvoice) => {
    try {
      const { data: items, error } = await supabase
        .from('purchase_invoice_items').select('*').eq('invoice_id', invoice.id).order('created_at', { ascending: true });
      if (error) throw error;
      const html = await generatePurchaseInvoiceHTML({
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        customerName: invoice.customer_name,
        invoiceName: invoice.invoice_name || 'فاتورة مشتريات',
        items: (items || []).map((item: any) => ({
          description: item.item_name,
          quantity: item.quantity,
          unit: item.unit || '',
          unitPrice: item.unit_price,
          total: item.total_price,
          image_url: item.image_url || undefined,
        })),
        totalAmount: invoice.total_amount,
        notes: invoice.notes || undefined,
      } as any);
      const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
      showPrintPreview(html, `فاتورة مشتريات ${invoice.invoice_number} - ${invoice.customer_name}`, 'billing-invoices');
    } catch (error) {
      console.error('Error printing invoice:', error);
      toast.error('فشل طباعة الفاتورة');
    }
  };

  const handleDelete = async (invoice: PurchaseInvoice) => {
    const ok = await systemConfirm({
      title: 'حذف فاتورة المشتريات',
      message: `هل أنت متأكد من حذف الفاتورة #${invoice.invoice_number}؟ لا يمكن التراجع عن هذا الإجراء.`,
      variant: 'destructive',
      confirmText: 'حذف',
    });
    if (!ok) return;
    try {
      // 1. إلغاء ربط دفعات المقايضة المرتبطة بهذه الفاتورة
      await supabase.from('customer_payments').update({ purchase_invoice_id: null }).eq('purchase_invoice_id', invoice.id);
      // 2. حذف حركة فاتورة المشتريات (السالبة) من جدول customer_payments
      await supabase.from('customer_payments').delete()
        .eq('entry_type', 'purchase_invoice')
        .or(`purchase_invoice_id.eq.${invoice.id},notes.like.%${invoice.invoice_number}%`);
      // 3. حذف فاتورة المشتريات نفسها
      const { error } = await supabase.from('purchase_invoices').delete().eq('id', invoice.id);
      if (error) throw error;
      toast.success('تم حذف الفاتورة بنجاح');
      onRefresh();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('فشل حذف الفاتورة');
    }
  };

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-muted-foreground">
        <ShoppingCart className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">لا توجد فواتير مشتريات لهذا الزبون</p>
        <p className="mt-1 text-xs">فواتير المشتريات تسجّل ما اشتريناه من الزبون، ويمكن استخدامها كدفعة على حسابه</p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <InvoiceSummary total={totalAmount} paid={totalSettled} paidLabel="المسدد / المستخدم كدفعة" remaining={totalRemaining}
        extra={{ label: 'رصيد متاح للاستخدام', value: totalAvailable, tone: totalAvailable > 0.01 ? 'credit' : 'muted' }} />
      <InvoiceToolbar search={search} onSearch={setSearch} filter={filter} onFilter={setFilter} counts={counts} settledLabel="المسددة/المستخدمة" />

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 text-right font-medium">الفاتورة</th>
              <th className="px-3 py-2 text-right font-medium">التاريخ</th>
              <th className="px-3 py-2 text-left font-medium">الإجمالي</th>
              <th className="px-3 py-2 text-left font-medium">مسدد</th>
              <th className="px-3 py-2 text-left font-medium">كدفعة</th>
              <th className="px-3 py-2 text-left font-medium">متاح</th>
              <th className="px-3 py-2 text-right font-medium">الحالة</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map(({ inv, total, paid, used, settled, remaining, isSettled, available }) => {
              const open = expanded === inv.id;
              const items = itemsById[inv.id];
              return (
                <Fragment key={inv.id}>
                  <tr className={cn('hover:bg-muted/20', open && 'bg-muted/20')}>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => toggle(inv.id)} aria-expanded={open} aria-label="عرض البنود"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 font-semibold">
                        {inv.invoice_name || 'فاتورة مشتريات'}
                        {inv.locked && <Lock className="h-3 w-3 text-amber-500" aria-label="مقفلة" />}
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">#{inv.invoice_number}</div>
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{fmtDate(inv.invoice_date)}</td>
                    <td className="px-3 py-2 text-left font-semibold tabular-nums">{fmtMoney(total)}</td>
                    <td className="px-3 py-2 text-left tabular-nums">{paid > 0 ? fmtMoney(paid) : '—'}</td>
                    <td className="px-3 py-2 text-left tabular-nums text-emerald-600 dark:text-emerald-400">{used > 0 ? fmtMoney(used) : '—'}</td>
                    <td className={cn('px-3 py-2 text-left font-semibold tabular-nums', available > 0.01 ? 'text-primary' : 'text-muted-foreground')}>{available > 0.01 ? fmtMoney(available) : '—'}</td>
                    <td className="px-3 py-2">
                      <PaidStatus total={total} settled={isSettled ? total : settled} settledText={used >= total - 0.01 ? 'مستخدمة كدفعة' : 'مسددة'} />
                      {used > 0 && available > 0.01 && (
                        <div className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">فائض يحتاج توزيع</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {available > 0.01 && (
                          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => handleUseAsPayment(inv)}>
                            <ArrowRightLeft className="h-3.5 w-3.5" />كدفعة
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-8 p-0')} aria-label="إجراءات الفاتورة">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 text-right">
                            <DropdownMenuItem onClick={() => handlePrint(inv)}><Printer className="ml-2 h-4 w-4" />طباعة</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditInvoice(inv)}><Edit className="ml-2 h-4 w-4" />تعديل</DropdownMenuItem>
                            {!inv.locked && remaining > 0 && (
                              <DropdownMenuItem onClick={() => handleAddPayment(inv)}><DollarSign className="ml-2 h-4 w-4" />تسجيل سداد</DropdownMenuItem>
                            )}
                            {used > 0 && (
                              <DropdownMenuItem onClick={() => handleUndoUse(inv)}><Undo2 className="ml-2 h-4 w-4" />تراجع عن الاستخدام كدفعة</DropdownMenuItem>
                            )}
                            {!inv.locked && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(inv)}><Trash2 className="ml-2 h-4 w-4" />حذف</DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-muted/10">
                      <td />
                      <td colSpan={8} className="px-3 pb-3 pt-1">
                        <div className="rounded-lg border border-border bg-card p-2">
                          {items === 'loading' || !items
                            ? <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                            : <InvoiceItemsTable items={items} />}
                          {inv.notes && <div className="mt-2 border-t border-border/60 px-2 pt-2 text-xs text-muted-foreground">ملاحظات: {inv.notes}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!visible.length && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">لا توجد فواتير مطابقة</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <PurchaseInvoicePaymentDialog
        open={!!payInvoice}
        onOpenChange={(o) => { if (!o) setPayInvoice(null); }}
        invoice={payInvoice}
        customerId={customerId}
        onPaymentAdded={onRefresh}
      />
      <PurchaseInvoiceEditDialog
        open={!!editInvoice}
        onOpenChange={(o) => { if (!o) setEditInvoice(null); }}
        invoice={editInvoice}
        onSuccess={onRefresh}
      />
      {useInvoice && (
        <EnhancedDistributePaymentDialog
          open={!!useInvoice}
          onOpenChange={(o) => { if (!o) setUseInvoice(null); }}
          customerId={customerId}
          customerName={customerName}
          purchaseInvoice={{
            id: useInvoice.id,
            invoice_number: useInvoice.invoice_number,
            total_amount: useInvoice.total_amount,
            used_as_payment: useInvoice.used_as_payment || 0,
          }}
          onSuccess={onRefresh}
        />
      )}
    </section>
  );
}
