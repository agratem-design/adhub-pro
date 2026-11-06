import { usePersistedState } from '@/hooks/usePersistedState';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowRight, CalendarClock, ChevronDown, FileText, HandCoins, Loader2, MoreHorizontal, Pencil, Phone,
  Plus, Printer, Receipt, Send, Trash2, Wallet,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { buildCanonicalCustomerLedger, formatLedgerDate } from '@/lib/canonicalCustomerLedger';
import { CASH_TYPES, contractPaid, loadCustomerAccount, resolveCustomerId, round2 } from '@/services/customerAccount';
import {
  addAccountPayment, addBulkContractPayment, addContractPayment, addDebt, deleteDistributedPayment, deletePayment, updatePayment,
} from '@/services/customerPaymentOps';
import { supabase } from '@/integrations/supabase/client';

import { PaymentSection } from '@/components/billing/PaymentSection';
import { EnhancedDistributePaymentDialog } from '@/components/billing/EnhancedDistributePaymentDialog';
import ReceiptPrintDialog from '@/components/billing/ReceiptPrintDialog';
import AccountStatementDialog from '@/components/billing/AccountStatementDialog';
import { SendAccountStatementDialog } from '@/components/customers/SendAccountStatementDialog';
import { UnpaidContractsDialog } from '@/components/billing/UnpaidContractsDialog';
import { CustomerAlertsSyncDialog } from '@/components/customers/CustomerAlertsSyncDialog';
import { FriendCompanyManager } from '@/components/customers/FriendCompanyManager';
import ModernPrintInvoiceDialog from '@/components/billing/ModernPrintInvoiceDialog';
import { SalesInvoiceDialog } from '@/components/billing/SalesInvoiceDialog';
import { PurchaseInvoiceDialog } from '@/components/billing/PurchaseInvoiceDialog';
import { PrintInvoicePaymentDialog } from '@/components/billing/PrintInvoicePaymentDialog';
import { SalesSection } from '@/components/billing/SalesSection';
import { PurchaseInvoicesSection } from '@/components/billing/PurchaseInvoicesSection';
import GeneralDiscountsSection from '@/components/billing/GeneralDiscountsSection';
import { FriendRentalsGroupedSection } from '@/components/billing/FriendRentalsGroupedSection';
import { CompositeTasksList } from '@/components/composite-tasks/CompositeTasksList';
import { ContractCard } from '@/components/customer-account/ContractCard';
import { mergeCompositeOperations, operationKeyOf } from '@/lib/compositeCosts';
import { compositeTaskLabel } from '@/lib/compositeTaskLabel';

// ─────────────────────────── أدوات عرض ───────────────────────────
const fmt = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const METHODS = ['نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمان', 'أخرى'];

type TabKey = 'contracts' | 'payments' | 'invoices' | 'composite' | 'friend' | 'discounts' | 'ledger';

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'debt' | 'credit' | 'muted'; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 truncate text-lg font-bold tabular-nums', tone === 'debt' && 'text-destructive', tone === 'credit' && 'text-emerald-500')}>{value}</p>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// ───────────────────── نافذة دفعة / دين بسيطة ─────────────────────
type MoneyDialogMode = { kind: 'contract'; contractNumber: number; remaining: number } | { kind: 'account' } | { kind: 'debt' } | { kind: 'bulk'; contracts: { number: number; remaining: number }[] } | { kind: 'edit'; payment: any };

function MoneyDialog({ mode, onClose, onSubmit }: {
  mode: MoneyDialogMode | null;
  onClose: () => void;
  onSubmit: (v: { amount: number; method: string; reference: string; notes: string; date: string }) => Promise<void>;
}) {
  const editing = mode?.kind === 'edit' ? mode.payment : null;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('نقدي');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState('');
  const key = mode ? JSON.stringify(mode.kind === 'edit' ? mode.payment.id : mode) : '';
  if (key !== lastKey) {
    setLastKey(key);
    setAmount(editing ? String(editing.amount ?? '') : mode?.kind === 'contract' && mode.remaining > 0 ? String(round2(mode.remaining)) : '');
    setMethod(editing?.method || 'نقدي');
    setReference(editing?.reference || '');
    setNotes(editing?.notes || '');
    setDate(editing?.paid_at ? String(editing.paid_at).slice(0, 10) : today());
  }
  if (!mode) return null;
  const title = mode.kind === 'contract' ? `دفعة على العقد #${mode.contractNumber}`
    : mode.kind === 'account' ? 'دفعة على الحساب'
    : mode.kind === 'debt' ? 'دين سابق على الزبون'
    : mode.kind === 'bulk' ? `تحصيل على ${mode.contracts.length} عقود`
    : 'تعديل دفعة';
  const hint = mode.kind === 'contract' ? `المتبقي على العقد: ${fmt(mode.remaining)} د.ل`
    : mode.kind === 'bulk' ? `إجمالي المتبقي: ${fmt(mode.contracts.reduce((s, c) => s + c.remaining, 0))} د.ل — يوزَّع المبلغ بنسبة متبقي كل عقد`
    : mode.kind === 'account' ? 'تبقى رصيداً للزبون حتى توزّعها على العقود والفواتير'
    : mode.kind === 'edit' && (editing?.sales_invoice_id || editing?.printed_invoice_id || editing?.composite_task_id || editing?.purchase_invoice_id)
      ? 'تعديل المبلغ يحدّث المدفوع في الفاتورة أو المهمة المرتبطة تلقائياً' : undefined;
  const submit = async () => {
    const v = Number(amount);
    if (!(v > 0)) { toast.error('أدخل مبلغاً صحيحاً أكبر من صفر'); return; }
    setSaving(true);
    try {
      await onSubmit({ amount: v, method, reference, notes, date });
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'فشل الحفظ');
    } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle className="text-right text-base">{title}</DialogTitle></DialogHeader>
        {hint && <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{hint}</p>}
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>المبلغ (د.ل)</Label><Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></div>
            <div className="space-y-1.5"><Label>التاريخ</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
          {mode.kind !== 'debt' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>طريقة الدفع</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[...new Set([...METHODS, method])].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>المرجع</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="رقم الشيك أو التحويل" /></div>
            </div>
          )}
          <div className="space-y-1.5"><Label>ملاحظات</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />}حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────── الصفحة ───────────────────────────────
export default function CustomerAccount() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm: systemConfirm } = useSystemDialog();

  const idParam = params.get('id');
  const nameParam = params.get('name');
  const { data: customerId, isLoading: resolving } = useQuery({
    queryKey: ['customer-account-id', idParam, nameParam],
    queryFn: () => resolveCustomerId(idParam, nameParam),
  });
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['customer-account', customerId],
    queryFn: () => loadCustomerAccount(customerId!),
    enabled: !!customerId,
    staleTime: 30_000,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['customer-account', customerId] });
    await refetch();
  };

  const [tab, setTab] = usePersistedState<TabKey>('customerAccount.tab', 'contracts');
  const [invoiceTab, setInvoiceTab] = usePersistedState<'printed' | 'sales' | 'purchase'>('customerAccount.invoiceTab', 'printed');
  const [contractFilter, setContractFilter] = usePersistedState<'all' | 'unpaid' | 'active'>('customerAccount.contractFilter', 'all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showCollection, setShowCollection] = useState(false);
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');

  // نوافذ
  const [money, setMoney] = useState<MoneyDialogMode | null>(null);
  const [distribute, setDistribute] = useState<{ contracts?: number[]; amount?: number | null; sourceId?: string | null } | null>(null);
  const [editGroup, setEditGroup] = useState<{ id: string; payments: any[] } | null>(null);
  const [friendUse, setFriendUse] = useState<any | null>(null);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [printDialog, setPrintDialog] = useState<{ invoice: any | null; preview?: boolean; auto?: boolean; forPrinter?: boolean } | null>(null);
  const [printContracts, setPrintContracts] = useState<string[]>([]);
  const [salesOpen, setSalesOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [printPayment, setPrintPayment] = useState<any | null>(null);
  const [printedOpenOnly, setPrintedOpenOnly] = usePersistedState<boolean>('customerAccount.printedOpenOnly', false);

  // ── الحسابات: مصدر واحد هو دفتر الأستاذ الموحد ──
  const ledger = useMemo(() => data ? buildCanonicalCustomerLedger(data.ledgerSources, { hidePaymentDistribution: true }) : null, [data]);
  const ledgerView = useMemo(() => data ? buildCanonicalCustomerLedger(data.ledgerSources, { startDate: ledgerFrom, endDate: ledgerTo, hidePaymentDistribution: true }) : null, [data, ledgerFrom, ledgerTo]);
  const totals = ledger?.totals;

  const contractRows = useMemo(() => {
    if (!data) return [];
    const t = today();
    return data.contracts.map(c => {
      const total = Number(c.Total ?? c['Total Rent'] ?? 0) || 0;
      const paid = contractPaid(data.payments, c.Contract_Number);
      const end = String(c['End Date'] || '').slice(0, 10);
      return {
        raw: c, number: Number(c.Contract_Number), adType: c['Ad Type'] || '', start: String(c['Contract Date'] || '').slice(0, 10), end,
        active: !!end && end >= t, total, paid, remaining: round2(total - paid),
        boards: Number(c.billboards_count) || String(c.billboard_ids || '').split(',').filter(Boolean).length,
      };
    });
  }, [data]);
  const visibleContracts = contractRows.filter(c =>
    contractFilter === 'all' || (contractFilter === 'unpaid' ? c.remaining > 0.01 : c.active));
  const overdueContracts = contractRows.filter(c => !c.active && c.remaining > 0.01);

  const listedPayments = useMemo(() => (data?.payments || []).filter(p => !['invoice', 'purchase_invoice', 'printed_invoice'].includes(p.entry_type)), [data]);
  const unallocated = useMemo(() => (data?.payments || []).filter(p =>
    CASH_TYPES.has(p.entry_type) && !p.contract_number && !p.sales_invoice_id && !p.printed_invoice_id && !p.purchase_invoice_id && !p.composite_task_id), [data]);
  const unallocatedTotal = unallocated.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const printedRows = useMemo(() => (data?.printedInvoices || []).map(inv => {
    const total = Number(inv.total_amount ?? inv.print_cost ?? 0) || 0;
    const paid = Number(inv.paid_amount) || 0;
    const nums = Array.isArray(inv.contract_numbers) ? inv.contract_numbers : String(inv.contract_numbers || inv.contract_number || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    return { inv, total, paid, remaining: Math.max(0, round2(total - paid)), contracts: nums };
  }), [data]);

  // ── أين المتبقي؟ كل عقد/فاتورة/مهمة عليها مبلغ ──
  const debtItems = useMemo(() => {
    if (!data) return [] as { key: string; kind: string; label: string; sub?: string; remaining: number; contract?: number }[];
    const items: { key: string; kind: string; label: string; sub?: string; remaining: number; contract?: number }[] = [];
    contractRows.filter(r => r.remaining > 0.01).forEach(r => items.push({ key: `c${r.number}`, kind: 'عقد', label: `عقد #${r.number}`, sub: r.adType || undefined, remaining: r.remaining, contract: r.number }));
    printedRows.filter(r => r.remaining > 0.01 && !r.inv.included_in_contract).forEach(r => items.push({ key: `p${r.inv.id}`, kind: 'طباعة', label: `فاتورة طباعة #${r.inv.invoice_number || ''}`, sub: r.contracts.length ? `عقود ${r.contracts.join('، ')}` : undefined, remaining: r.remaining }));
    (data.salesInvoices || []).forEach((i: any) => {
      const rem = round2((Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0));
      if (rem > 0.01) items.push({ key: `s${i.id}`, kind: 'مبيعات', label: `فاتورة مبيعات #${i.invoice_number || ''}`, sub: i.invoice_name || undefined, remaining: rem });
    });
    mergeCompositeOperations((data.compositeTasks || []) as any[], (t: any) => operationKeyOf(t, t.operation_id)).forEach((t: any) => {
      const rem = round2((Number(t.customer_total) || 0) - (Number(t.paid_amount) || 0));
      if (rem <= 0.01) return;
      let label = 'أمر عمل';
      try { label = compositeTaskLabel(t); } catch { /* fallback */ }
      items.push({ key: `t${t.id}`, kind: 'أمر عمل', label, sub: t.contract_id ? `عقد #${t.contract_id}` : undefined, remaining: rem });
    });
    return items.sort((a, b) => b.remaining - a.remaining);
  }, [data, contractRows, printedRows]);
  const [showAllDebts, setShowAllDebts] = useState(false);

  // ── ملخص الفواتير: المستحق على الطباعة والمبيعات، والمحصَّل، ورصيد المشتريات المتاح للاستخدام كدفعة ──
  const invoiceSummary = useMemo(() => {
    const salesRows = (data?.salesInvoices || []).map((i: any) => {
      const total = Number(i.total_amount) || 0;
      const paid = Number(i.paid_amount) || 0;
      return { total, paid, remaining: Math.max(0, round2(total - paid)) };
    });
    const debtRows = [...printedRows, ...salesRows];
    const open = debtRows.filter(r => r.remaining > 0.01).length;
    const due = debtRows.reduce((s, r) => s + r.remaining, 0);
    const collected = debtRows.reduce((s, r) => s + r.paid, 0);
    const purchaseCredit = (data?.purchaseInvoices || []).reduce((s: number, i: any) => s + Math.max(0, round2((Number(i.total_amount) || 0) - (Number(i.used_as_payment) || 0))), 0);
    return { open, due: round2(due), collected: round2(collected), purchaseCredit: round2(purchaseCredit) };
  }, [data, printedRows]);

  // ── عمليات ──
  const runOp = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); toast.success(ok); await refresh(); }
    catch (e: any) { toast.error(e?.message || 'فشلت العملية'); }
  };
  const friendCompanyId = data?.customer?.linked_friend_company_id || null;
  const customerName = data?.customer?.name || nameParam || '';
  const base = () => ({ customerId: customerId!, customerName });

  const onDeleteReceipt = async (id: string) => {
    if (!await systemConfirm({ title: 'حذف الدفعة', message: 'تُحذف الدفعة ويُعكس أثرها على الفاتورة أو المهمة المرتبطة. متابعة؟', variant: 'destructive', confirmText: 'حذف' })) return;
    await runOp(() => deletePayment(id, friendCompanyId), 'حُذفت الدفعة');
  };
  const onDeleteGroup = async (groupId: string) => {
    if (!await systemConfirm({ title: 'حذف الدفعة الموزعة', message: 'تُحذف كل أجزاء الدفعة مع العهد والسلف والسحوبات المرتبطة بها. متابعة؟', variant: 'destructive', confirmText: 'حذف' })) return;
    await runOp(() => deleteDistributedPayment(groupId, friendCompanyId), 'حُذفت الدفعة الموزعة');
  };
  const onDistributeUnallocated = (p: any) => {
    if (p.distributed_payment_id) {
      const group = (data?.payments || []).filter(x => x.distributed_payment_id === p.distributed_payment_id);
      setEditGroup({ id: p.distributed_payment_id, payments: group.length ? group : [p] });
    } else setDistribute({ amount: Number(p.amount) || 0, sourceId: p.id });
  };
  const onDeletePrinted = async (inv: any) => {
    if ((Number(inv.paid_amount) || 0) > 0) { toast.error('على الفاتورة دفعات — احذف دفعاتها أولاً'); return; }
    if (!await systemConfirm({ title: 'حذف فاتورة الطباعة', message: `حذف الفاتورة ${inv.invoice_number || ''}؟`, variant: 'destructive', confirmText: 'حذف' })) return;
    await runOp(async () => {
      const { error } = await supabase.from('printed_invoices').delete().eq('id', inv.id);
      if (error) throw new Error(error.message);
    }, 'حُذفت الفاتورة');
  };

  // ── حالات التحميل ──
  if (resolving || (customerId && isLoading)) {
    return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />جارٍ تحميل حساب الزبون…</div>;
  }
  if (!customerId) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-20 text-center" dir="rtl">
        <p className="text-sm text-muted-foreground">لم يُعثر على الزبون{nameParam ? ` «${nameParam}»` : ''}، أو يوجد أكثر من زبون بنفس الاسم.</p>
        <Button variant="outline" onClick={() => navigate('/admin/customers')}>العودة لقائمة الزبائن</Button>
      </div>
    );
  }
  if (error || !data || !ledger || !totals) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-20 text-center" dir="rtl">
        <p className="text-sm text-destructive">{(error as any)?.message || 'تعذّر تحميل البيانات'}</p>
        <Button variant="outline" onClick={() => refetch()}>إعادة المحاولة</Button>
      </div>
    );
  }

  const c = data.customer;
  const balance = totals.finalBalance;
  const reductions = totals.totalNonCashAdjustments;
  const tabs: { key: TabKey; label: string; count?: number; show?: boolean }[] = [
    { key: 'contracts', label: 'العقود', count: data.contracts.length },
    { key: 'payments', label: 'الدفعات', count: listedPayments.length },
    { key: 'invoices', label: 'الفواتير', count: data.printedInvoices.length + data.salesInvoices.length + data.purchaseInvoices.length },
    { key: 'composite', label: 'أوامر العمل', count: data.compositeTasks.length },
    { key: 'friend', label: 'الشركة الصديقة', count: data.friendRentals.length, show: !!friendCompanyId },
    { key: 'discounts', label: 'الخصومات', count: data.generalDiscounts.length },
    { key: 'ledger', label: 'كشف الحساب' },
  ];

  return (
    <div className="min-h-full bg-background" dir="rtl">
      {/* ── الرأس ── */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2.5" onClick={() => navigate('/admin/customers')}><ArrowRight className="h-4 w-4" />الزبائن</Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-bold text-primary">{(c.name || '؟').trim().charAt(0)}</div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{c.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-foreground" dir="ltr"><Phone className="h-3 w-3" />{c.phone}</a>}
              {c.company && <span>· {c.company}</span>}
              {c.is_customer !== false && <span className="rounded bg-muted px-1.5 py-0.5">زبون</span>}
              {c.is_supplier && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-500">مورد</span>}
              {friendCompanyId && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-500">شركة صديقة{data.friendCompanyName ? `: ${data.friendCompanyName}` : ''}</span>}
              {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-9 gap-1.5" onClick={() => setDistribute({})}><HandCoins className="h-4 w-4" />تسجيل دفعة</Button>
            <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setStatementOpen(true)}><FileText className="h-4 w-4" />كشف حساب</Button>
            <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setSendOpen(true)}><Send className="h-4 w-4" />إرسال كشف</Button>
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9 gap-1.5')}><Plus className="h-4 w-4" />جديد<ChevronDown className="h-3.5 w-3.5" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-right">
                <DropdownMenuItem onClick={() => setMoney({ kind: 'account' })}><Wallet className="ml-2 h-4 w-4" />دفعة على الحساب</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMoney({ kind: 'debt' })}><Receipt className="ml-2 h-4 w-4" />دين سابق</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setPrintContracts(data.contracts[0] ? [String(data.contracts[0].Contract_Number)] : []); setPrintDialog({ invoice: null }); }}><Printer className="ml-2 h-4 w-4" />فاتورة طباعة</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSalesOpen(true)}><FileText className="ml-2 h-4 w-4" />فاتورة مبيعات</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPurchaseOpen(true)}><FileText className="ml-2 h-4 w-4" />فاتورة مشتريات</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9 w-9 p-0')} aria-label="المزيد"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 text-right">
                <DropdownMenuItem onClick={() => setUnpaidOpen(true)}><AlertTriangle className="ml-2 h-4 w-4" />العقود غير المسددة</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAlertsOpen(true)}><CalendarClock className="ml-2 h-4 w-4" />التنبيهات والتقويم</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/admin/customer-billing?id=${customerId}&name=${encodeURIComponent(c.name || '')}`)}>فتح الصفحة القديمة</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <FriendCompanyManager customerId={customerId} customerName={c.name} linkedFriendCompanyId={friendCompanyId} onUpdate={refresh} />
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4 lg:p-6">
        {/* ── الرصيد ── */}
        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,3fr)]">
          <div className={cn('rounded-xl border p-4', balance > 0.01 ? 'border-destructive/40 bg-destructive/5' : 'border-emerald-500/40 bg-emerald-500/5')}>
            <p className="text-xs text-muted-foreground">{balance > 0.01 ? 'المتبقي على الزبون' : balance < -0.01 ? 'رصيد دائن للزبون' : 'الحساب مسدد'}</p>
            <p className={cn('mt-1 text-3xl font-bold tabular-nums', balance > 0.01 ? 'text-destructive' : 'text-emerald-500')}>{fmt(Math.abs(balance))} <span className="text-sm font-normal text-muted-foreground">د.ل</span></p>
            <Progress value={totals.repaymentPercentage} className="mt-3 h-1.5" />
            <p className="mt-1.5 text-xs text-muted-foreground">نسبة السداد {Math.round(totals.repaymentPercentage)}% (النقد + الخصومات والمقاصات ÷ المستحقات)</p>
            {debtItems.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-border/60 pt-2">
                <p className="text-xs font-semibold text-muted-foreground">المتبقي موزّع على:</p>
                {(showAllDebts ? debtItems : debtItems.slice(0, 5)).map(d => (
                  <div key={d.key} className="flex items-center gap-2 text-xs">
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{d.kind}</span>
                    <span className="min-w-0 flex-1 truncate" title={d.sub}>{d.label}{d.sub ? <span className="text-muted-foreground"> · {d.sub}</span> : null}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-destructive">{fmt(d.remaining)}</span>
                    {d.contract && <button type="button" className="shrink-0 text-primary hover:underline" onClick={() => setMoney({ kind: 'contract', contractNumber: d.contract!, remaining: d.remaining })}>دفعة</button>}
                  </div>
                ))}
                {debtItems.length > 5 && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowAllDebts(v => !v)}>{showAllDebts ? 'إخفاء' : `عرض الكل (${debtItems.length})`}</button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="إجمالي المستحقات" value={fmt(totals.totalCustomerCharges)} hint={
              <span className="flex flex-wrap gap-x-2">
                <span>عقود {fmt(totals.debtBreakdown.contracts)}</span>
                {totals.debtBreakdown.compositeTasks > 0 && <span>مهام {fmt(totals.debtBreakdown.compositeTasks)}</span>}
                {totals.debtBreakdown.printedInvoices > 0 && <span>طباعة {fmt(totals.debtBreakdown.printedInvoices)}</span>}
                {totals.debtBreakdown.salesInvoices > 0 && <span>مبيعات {fmt(totals.debtBreakdown.salesInvoices)}</span>}
                {totals.debtBreakdown.otherDebts > 0 && <span>أخرى {fmt(totals.debtBreakdown.otherDebts)}</span>}
              </span>} />
            <Stat label="المدفوع نقداً" value={fmt(totals.cashPayments)} tone="credit" />
            <Stat label="خصومات ومقاصات" value={fmt(reductions)} tone="muted" hint={
              <span className="flex flex-wrap gap-x-2">
                {totals.generalDiscounts > 0 && <span>خصم {fmt(totals.generalDiscounts)}</span>}
                {totals.purchaseOffsets > 0 && <span>مشتريات {fmt(totals.purchaseOffsets)}</span>}
                {totals.friendCompanyOffsets > 0 && <span>إيجارات صديقة {fmt(totals.friendCompanyOffsets)}</span>}
                {totals.otherNonCashCredits > 0 && <span>أخرى {fmt(totals.otherNonCashCredits)}</span>}
                {reductions === 0 && <span>لا يوجد</span>}
              </span>} />
            <Stat label="عقود سارية" value={`${contractRows.filter(r => r.active).length} من ${contractRows.length}`} />
            <Stat label="دفعات غير موزعة" value={fmt(unallocatedTotal)} tone={unallocatedTotal > 0 ? 'credit' : 'muted'} hint={unallocated.length ? `${unallocated.length} دفعة` : 'لا يوجد'} />
            <Stat label="عقود منتهية غير مسددة" value={String(overdueContracts.length)} tone={overdueContracts.length ? 'debt' : 'muted'} hint={overdueContracts.length ? `${fmt(overdueContracts.reduce((s, r) => s + r.remaining, 0))} د.ل` : undefined} />
          </div>
        </section>

        {unallocated.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-2.5 text-sm">
            <Wallet className="h-4 w-4 text-emerald-500" />
            <span>دفعات على الحساب لم توزَّع بعد: <b className="tabular-nums">{fmt(unallocatedTotal)} د.ل</b></span>
            <span className="mr-auto flex flex-wrap gap-1.5">
              {unallocated.slice(0, 4).map(p => (
                <Button key={p.id} size="sm" variant="outline" className="h-8 text-xs" onClick={() => onDistributeUnallocated(p)}>توزيع {fmt(Number(p.amount))}</Button>
              ))}
            </span>
          </div>
        )}

        {/* ── التبويبات ── */}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border" role="tablist">
          {tabs.filter(t => t.show !== false).map(t => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cn('-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors', tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t.label}{t.count != null && <span className="mr-1.5 rounded bg-muted px-1.5 text-xs tabular-nums">{t.count}</span>}
            </button>
          ))}
        </nav>

        {tab === 'contracts' && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
                {([['all', 'الكل'], ['unpaid', 'غير المسددة'], ['active', 'السارية']] as const).map(([k, l]) => (
                  <button key={k} role="radio" aria-checked={contractFilter === k} onClick={() => setContractFilter(k)}
                    className={cn('h-8 rounded-md px-3 text-xs font-semibold', contractFilter === k ? 'bg-card shadow-sm ring-1 ring-primary/40' : 'text-muted-foreground hover:text-foreground')}>{l}</button>
                ))}
              </div>
              {selected.size > 0 && (
                <span className="mr-auto flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{selected.size} محدد</span>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setMoney({ kind: 'bulk', contracts: contractRows.filter(r => selected.has(r.number)).map(r => ({ number: r.number, remaining: r.remaining })) })}>تحصيل المحدد</Button>
                  <Button size="sm" className="h-8" onClick={() => setDistribute({ contracts: [...selected] })}>توزيع دفعة عليها</Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>إلغاء</Button>
                </span>
              )}
            </div>
            {visibleContracts.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                <label className="flex items-center gap-2"><input type="checkbox" aria-label="تحديد الكل" checked={visibleContracts.every(r => selected.has(r.number))}
                  onChange={e => setSelected(e.target.checked ? new Set(visibleContracts.map(r => r.number)) : new Set())} />تحديد الكل</label>
                <span>القيمة <b className="tabular-nums">{fmt(visibleContracts.reduce((s, r) => s + r.total, 0))}</b></span>
                <span>المدفوع <b className="tabular-nums text-emerald-600">{fmt(visibleContracts.reduce((s, r) => s + r.paid, 0))}</b></span>
                <span>المتبقي <b className="tabular-nums text-destructive">{fmt(visibleContracts.reduce((s, r) => s + Math.max(0, r.remaining), 0))}</b></span>
              </div>
            )}
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {visibleContracts.map(r => (
                <ContractCard key={r.number} r={r} fmt={fmt} selected={selected.has(r.number)}
                  onToggle={on => setSelected(s => { const n = new Set(s); on ? n.add(r.number) : n.delete(r.number); return n; })}
                  onPay={() => setMoney({ kind: 'contract', contractNumber: r.number, remaining: r.remaining })}
                  onEdit={() => navigate(`/admin/contracts/edit?contract=${r.number}`)} />
              ))}
              {!visibleContracts.length && <div className="col-span-full rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">لا توجد عقود</div>}
            </div>
          </section>
        )}

        {tab === 'payments' && (
          <section className="space-y-3">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showCollection} onChange={e => setShowCollection(e.target.checked)} />إظهار تفاصيل التحصيل (الوسيط والعمولة)
            </label>
            <PaymentSection
              payments={listedPayments as any}
              onEditReceipt={(p: any) => setMoney({ kind: 'edit', payment: p })}
              onDeleteReceipt={onDeleteReceipt}
              onPrintReceipt={(p: any) => setReceipt(p)}
              onAddDebt={() => setMoney({ kind: 'debt' })}
              onAddAccountPayment={() => setMoney({ kind: 'account' })}
              onDeleteDistributedPayment={onDeleteGroup}
              onEditDistributedPayment={(id: string, payments: any[]) => setEditGroup({ id, payments })}
              onDistributePayment={onDistributeUnallocated}
              showCollectionDetails={showCollection}
              totalRemainingDebt={balance}
              contracts={data.contracts}
              onRefresh={refresh}
              customerId={customerId}
            />
          </section>
        )}

        {tab === 'invoices' && (
          <section className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Stat label="المستحق على الفواتير" value={fmt(invoiceSummary.due)} tone={invoiceSummary.due > 0.01 ? 'debt' : 'muted'}
                hint={invoiceSummary.open ? `${invoiceSummary.open} فاتورة غير مسددة بالكامل` : 'كل الفواتير مسددة'} />
              <Stat label="المحصَّل على الفواتير" value={fmt(invoiceSummary.collected)} tone="credit" hint="طباعة ومبيعات" />
              <Stat label="رصيد مشتريات متاح" value={fmt(invoiceSummary.purchaseCredit)} tone={invoiceSummary.purchaseCredit > 0.01 ? 'credit' : 'muted'}
                hint={invoiceSummary.purchaseCredit > 0.01 ? 'يمكن استخدامه كدفعة من تبويب المشتريات' : 'لا يوجد'} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" className="flex w-fit gap-1 rounded-lg border border-border bg-muted/30 p-1">
              {([['printed', `الطباعة (${data.printedInvoices.length})`], ['sales', `المبيعات (${data.salesInvoices.length})`], ['purchase', `المشتريات (${data.purchaseInvoices.length})`]] as const).map(([k, l]) => (
                <button key={k} role="radio" aria-checked={invoiceTab === k} onClick={() => setInvoiceTab(k)}
                  className={cn('h-8 rounded-md px-3 text-xs font-semibold', invoiceTab === k ? 'bg-card shadow-sm ring-1 ring-primary/40' : 'text-muted-foreground hover:text-foreground')}>{l}</button>
              ))}
            </div>
            {invoiceTab === 'printed' && (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                <input type="checkbox" checked={printedOpenOnly} onChange={e => setPrintedOpenOnly(e.target.checked)} className="accent-primary" />غير المسددة فقط
              </label>
            )}
            </div>
            {invoiceTab === 'printed' && (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-right font-medium">الفاتورة</th>
                      <th className="px-3 py-2 text-right font-medium">العقود</th>
                      <th className="px-3 py-2 text-left font-medium">الإجمالي</th>
                      <th className="px-3 py-2 text-left font-medium">المدفوع</th>
                      <th className="px-3 py-2 text-left font-medium">المتبقي</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {printedRows.filter(r => !printedOpenOnly || r.remaining > 0.01).map(({ inv, total, paid, remaining, contracts }) => (
                      <tr key={inv.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <div className="font-semibold">{inv.invoice_number || '—'}</div>
                          <div className="text-xs text-muted-foreground">{String(inv.invoice_date || inv.created_at || '').slice(0, 10)}{inv.included_in_contract ? ' · ضمن العقد' : ''}</div>
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums">{contracts.length ? contracts.map((n: string) => `#${n}`).join('، ') : '—'}</td>
                        <td className="px-3 py-2 text-left tabular-nums">{fmt(total)}</td>
                        <td className="px-3 py-2 text-left tabular-nums text-emerald-500">{fmt(paid)}</td>
                        <td className={cn('px-3 py-2 text-left font-semibold tabular-nums', remaining > 0.01 ? 'text-destructive' : 'text-muted-foreground')}>{remaining > 0.01 ? fmt(remaining) : 'مسددة'}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            {remaining > 0.01 && !inv.included_in_contract && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPrintPayment(inv)}>دفعة</Button>}
                            <DropdownMenu>
                              <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-8 p-0')} aria-label="إجراءات الفاتورة"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 text-right">
                                <DropdownMenuItem onClick={() => { setPrintContracts(contracts); setPrintDialog({ invoice: inv, preview: true, auto: true }); }}><Printer className="ml-2 h-4 w-4" />طباعة</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setPrintContracts(contracts); setPrintDialog({ invoice: inv, preview: true, auto: true, forPrinter: true }); }}><Printer className="ml-2 h-4 w-4" />نسخة المطبعة</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setPrintContracts(contracts); setPrintDialog({ invoice: inv }); }}><Pencil className="ml-2 h-4 w-4" />تعديل</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeletePrinted(inv)}><Trash2 className="ml-2 h-4 w-4" />حذف</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!printedRows.length && <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">لا توجد فواتير طباعة</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {invoiceTab === 'sales' && <SalesSection embedded customerId={customerId} invoices={data.salesInvoices} onRefresh={refresh} />}
            {invoiceTab === 'purchase' && <PurchaseInvoicesSection customerId={customerId} customerName={c.name} invoices={data.purchaseInvoices as any} onRefresh={refresh} />}
          </section>
        )}

        {tab === 'composite' && <CompositeTasksList customerId={customerId} />}

        {tab === 'friend' && friendCompanyId && (
          <FriendRentalsGroupedSection
            friendBillboardRentals={data.friendRentals as any}
            customerName={c.name}
            contracts={data.contracts}
            customerId={customerId}
            payments={data.payments}
            onUpdate={refresh}
            onUseAsPayment={(rentals: any[]) => {
              const cost = rentals.reduce((s, r) => s + (Number(r.friend_rental_cost) || 0), 0);
              const used = rentals.reduce((s, r) => s + (Number(r.used_as_payment) || 0), 0);
              if (cost - used <= 0.01) { toast.info('هذه الإيجارات مستخدمة بالكامل'); return; }
              setFriendUse({ ...rentals[0], friend_rental_cost: cost, used_as_payment: used, _groupRentals: rentals });
            }}
          />
        )}

        {tab === 'discounts' && <GeneralDiscountsSection customerId={customerId} customerName={c.name} onDiscountChange={refresh} />}

        {tab === 'ledger' && ledgerView && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label className="text-xs">من</Label><Input type="date" className="h-9 w-40" value={ledgerFrom} onChange={e => setLedgerFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">إلى</Label><Input type="date" className="h-9 w-40" value={ledgerTo} onChange={e => setLedgerTo(e.target.value)} /></div>
              {(ledgerFrom || ledgerTo) && <Button variant="ghost" size="sm" className="h-9" onClick={() => { setLedgerFrom(''); setLedgerTo(''); }}>كل الفترات</Button>}
              <Button variant="outline" size="sm" className="mr-auto h-9 gap-1.5" onClick={() => setStatementOpen(true)}><Printer className="h-4 w-4" />طباعة الكشف</Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">التاريخ</th>
                    <th className="px-3 py-2 text-right font-medium">البيان</th>
                    <th className="px-3 py-2 text-left font-medium">مدين</th>
                    <th className="px-3 py-2 text-left font-medium">دائن</th>
                    <th className="px-3 py-2 text-left font-medium">الرصيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(ledgerFrom || ledgerTo) && (
                    <tr className="bg-muted/20 text-xs"><td className="px-3 py-2" colSpan={4}>رصيد مرحَّل</td><td className="px-3 py-2 text-left font-semibold tabular-nums">{fmt(ledgerView.openingBalance)}</td></tr>
                  )}
                  {ledgerView.displayedEntries.filter(e => !e.isInformationalOnly).map(e => (
                    <tr key={e.id} className="hover:bg-muted/20">
                      <td dir="ltr" className="whitespace-nowrap px-3 py-2 text-center text-xs tabular-nums text-muted-foreground">{formatLedgerDate(e.date)}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{e.description}</div>
                        {(e.subtitle || e.reference) && <div className="text-xs text-muted-foreground">{e.subtitle || e.reference}</div>}
                      </td>
                      <td className="px-3 py-2 text-left tabular-nums">{e.displayCharge ? fmt(e.displayCharge) : ''}</td>
                      <td className="px-3 py-2 text-left tabular-nums text-emerald-500">{e.displayReduction ? fmt(e.displayReduction) : ''}</td>
                      <td className={cn('px-3 py-2 text-left font-semibold tabular-nums', e.runningBalance > 0.01 ? 'text-destructive' : 'text-emerald-500')}>{fmt(e.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-muted/20 text-sm font-semibold">
                  <tr><td colSpan={4} className="px-3 py-2">الرصيد في نهاية الفترة</td><td className="px-3 py-2 text-left tabular-nums">{fmt(ledgerView.endingBalance)}</td></tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* ── النوافذ ── */}
      <MoneyDialog
        mode={money}
        onClose={() => setMoney(null)}
        onSubmit={async v => {
          if (!money) return;
          const input = { ...base(), ...v };
          if (money.kind === 'contract') await addContractPayment({ ...input, contractNumber: money.contractNumber });
          else if (money.kind === 'account') await addAccountPayment(input);
          else if (money.kind === 'debt') await addDebt(input);
          else if (money.kind === 'bulk') { await addBulkContractPayment({ ...input, contracts: money.contracts }); setSelected(new Set()); }
          else if (money.kind === 'edit') await updatePayment(money.payment.id, { amount: v.amount, method: v.method, reference: v.reference, paid_at: v.date, notes: v.notes });
          toast.success('تم الحفظ');
          await refresh();
        }}
      />

      <EnhancedDistributePaymentDialog
        open={!!distribute}
        onOpenChange={o => { if (!o) setDistribute(null); }}
        customerId={customerId}
        customerName={c.name}
        onSuccess={refresh}
        preSelectedContractIds={distribute?.contracts || []}
        preFilledAmount={distribute?.amount ?? null}
        sourceAccountPaymentId={distribute?.sourceId ?? null}
      />
      <EnhancedDistributePaymentDialog
        open={!!editGroup}
        onOpenChange={o => { if (!o) setEditGroup(null); }}
        customerId={customerId}
        customerName={c.name}
        onSuccess={refresh}
        editMode
        editingDistributedPaymentId={editGroup?.id ?? null}
        editingPayments={editGroup?.payments || []}
      />
      {friendUse && (
        <EnhancedDistributePaymentDialog
          open
          onOpenChange={o => { if (!o) setFriendUse(null); }}
          customerId={customerId}
          customerName={c.name}
          onSuccess={refresh}
          friendRental={friendUse}
        />
      )}

      {receipt && <ReceiptPrintDialog open onOpenChange={o => !o && setReceipt(null)} payment={receipt} customerName={c.name} />}
      <AccountStatementDialog open={statementOpen} onOpenChange={setStatementOpen} customerId={customerId} customerName={c.name} initialStartDate={ledgerFrom} initialEndDate={ledgerTo} />
      <SendAccountStatementDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        customer={{
          id: customerId, name: c.name, phone: c.phone || '', company: c.company || '',
          contractsCount: data.contracts.length,
          totalRent: totals.debtBreakdown.contracts,
          totalPaid: totals.cashPayments,
          accountBalance: balance,
          remaining: balance,
        } as any}
      />
      <UnpaidContractsDialog
        open={unpaidOpen}
        onOpenChange={setUnpaidOpen}
        contracts={data.contracts}
        getContractPayments={n => contractPaid(data.payments, n)}
        getContractRemaining={ct => round2((Number(ct.Total ?? (ct as any)['Total Rent'] ?? 0) || 0) - contractPaid(data.payments, ct.Contract_Number))}
      />
      <CustomerAlertsSyncDialog open={alertsOpen} onOpenChange={setAlertsOpen} customerId={customerId} customerName={c.name} initialEmail={c.email} onEmailUpdated={() => refresh()} />

      {printDialog && (
        <ModernPrintInvoiceDialog
          open
          onClose={() => setPrintDialog(null)}
          customerId={customerId}
          customerName={c.name}
          customerPhone={c.phone || ''}
          contracts={data.contracts}
          selectedContracts={printContracts}
          onSelectContracts={setPrintContracts}
          printItems={[]}
          onUpdatePrintItem={() => {}}
          onRemoveItem={() => {}}
          includeAccountBalance={false}
          onIncludeAccountBalance={() => {}}
          accountPayments={0}
          onPrintInvoice={() => {}}
          onSaveInvoice={() => { setPrintDialog(null); refresh(); }}
          initialInvoice={printDialog.invoice}
          openToPreview={printDialog.preview}
          autoPrint={printDialog.auto}
          autoPrintForPrinter={printDialog.forPrinter}
        />
      )}
      <SalesInvoiceDialog open={salesOpen} onOpenChange={setSalesOpen} customerId={customerId} customerName={c.name} onSuccess={refresh} />
      <PurchaseInvoiceDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} customerId={customerId} customerName={c.name} onSuccess={refresh} />
      <PrintInvoicePaymentDialog open={!!printPayment} onOpenChange={o => !o && setPrintPayment(null)} invoice={printPayment} customerId={customerId} onPaymentAdded={refresh} />
    </div>
  );
}
