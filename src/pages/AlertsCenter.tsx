import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ChevronDown, Bell, CalendarClock, CalendarPlus, FileText, Loader2, MessageCircle, Receipt, RefreshCw, Search, Settings, Wallet, Check, Printer, BarChart3 } from 'lucide-react';
import {
  buildContractDesignsMap, extractCalendarEvents, filterChangedCalendarEvents, getCalendarConfig, loadCalendarRecords,
  syncEventsToGoogleCalendar, type GoogleCalendarEvent,
} from '@/services/googleCalendarService';
import { whatsappBrowserRequest } from '@/lib/whatsappBrowser';
import { supabase } from '@/integrations/supabase/client';
import { loadCustomerOverdueInvoices, type CustomerAccountOverdue } from '@/services/overdueInvoices';

/**
 * مركز تنبيهات الزبائن: الدفعات (الأقساط)، العقود (بداية/نهاية)، الفواتير — في صفحة واحدة.
 * الإرسال يدوي دائماً: لا شيء يُرسل إلا بضغطة المستخدم، ويمكن الإرسال لكل نوع على حدة.
 */
type Kind = 'payments' | 'contracts' | 'invoices';
const KIND_OF = (e: GoogleCalendarEvent): Kind => e.type === 'installment' ? 'payments' : e.type === 'invoice' ? 'invoices' : 'contracts';
const KINDS: { key: Kind; label: string; icon: any }[] = [
  { key: 'payments', label: 'الدفعات والفواتير المستحقة', icon: Wallet },
  { key: 'contracts', label: 'العقود', icon: FileText },
  { key: 'invoices', label: 'الفواتير', icon: Receipt },
];
const TYPE_LABEL: Record<GoogleCalendarEvent['type'], string> = {
  installment: 'قسط', contract_end: 'نهاية عقد', contract_start: 'بداية عقد', invoice: 'فاتورة',
};
const fmt = (n?: number) => `${Math.round(Number(n) || 0).toLocaleString('en-US')} د.ل`;
const dmy = (s?: string) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');

/** رقم ليبي بصيغة دولية لواتساب */
export function whatsappNumber(raw?: string | null): string | null {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '218' + d.slice(1);
  if (d.length === 9 && d.startsWith('9')) d = '218' + d;
  return d.length >= 11 ? d : null;
}

/* نص الرسائل بدون رموز تعبيرية: بعض أجهزة/إضافات واتساب تعرضها «�» */
const SIGN = '\n\nمع خالص الشكر والتقدير،\n*الفارس الذهبي للدعاية والإعلان*';
const greet = (name?: string) => `السلام عليكم ورحمة الله وبركاته،\nالسادة / *${name || 'عميلنا العزيز'}* المحترمين،\nتحية طيبة وبعد،\n`;
const daysAr = (n: number) => n === 1 ? 'يوم واحد' : n === 2 ? 'يومان' : n <= 10 ? `${n} أيام` : `${n} يوماً`;
const overdueText = (e: GoogleCalendarEvent) => e.isOverdue ? ` (متأخرة ${daysAr(e.daysRemainingOrOverdue)})` : e.daysRemainingOrOverdue === 0 ? ' (اليوم)' : '';
const dateCaption = (e: GoogleCalendarEvent) => e.type === 'invoice' ? 'تاريخ الفاتورة' : e.type === 'contract_end' ? 'تاريخ الانتهاء' : e.type === 'contract_start' ? 'تاريخ البدء' : 'تاريخ الاستحقاق';
/** عنوان البند في رسالة الزبون */
const messageTitle = (e: GoogleCalendarEvent) => {
  const ad = e.adType && e.type !== 'invoice' ? ` (${e.adType})` : '';
  if (e.type === 'installment') return `دفعة مستحقة على العقد رقم ${e.contractNumber}${ad}`;
  if (e.type === 'invoice') return invoiceMessageTitle(e);
  return alertLabel(e).replace(/ — .*$/, '') + ad;
};
/** عنوان الفاتورة في رسالة الزبون بدون رقمها: الخدمة الفعلية من البنود إن عُرفت، ثم عنوان الفاتورة */
const invoiceMessageTitle = (e: GoogleCalendarEvent) => {
  const contract = e.contractNumber ? ` — عقد #${e.contractNumber}` : '';
  const ad = e.adType ? ` (${e.adType})` : '';
  const base = e.invoiceName ? (e.invoiceName.startsWith('فاتورة') ? e.invoiceName : `فاتورة «${e.invoiceName}»`)
    : e.serviceLabel ? `فاتورة ${e.serviceLabel}`
    : 'فاتورة';
  return base + contract + ad;
};
const PAY_NOTE = 'وفي حال إتمام السداد، يُرجى اعتبار هذه الرسالة للعلم فقط، مع تزويدنا بما يفيد السداد لتحديث حسابكم لدينا. ويسعدنا تواصلكم معنا لأي استفسار.';

/** وصف مختصر للتنبيه: الفاتورة تظهر بعنوانها إن وُجد */
export function alertLabel(e: GoogleCalendarEvent): string {
  const ad = e.adType ? ` — ${e.adType}` : '';
  switch (e.type) {
    case 'installment': return `دفعة عقد #${e.contractNumber}${ad}`;
    case 'contract_end': return `انتهاء عقد #${e.contractNumber}${ad}`;
    case 'contract_start': return `بدء عقد #${e.contractNumber}${ad}`;
    default: {
      const num = e.invoiceNumber ? ` رقم ${e.invoiceNumber}` : '';
      const contract = e.contractNumber ? ` — عقد #${e.contractNumber}` : '';
      if (e.invoiceName?.startsWith('فاتورة')) return `${e.invoiceName}${num}${contract}`;
      return (e.invoiceName ? `فاتورة «${e.invoiceName}»${num}` : `فاتورة${num}`) + contract;
    }
  }
}

function messageFor(e: GoogleCalendarEvent): string {
  const head = greet(e.customerName);
  const date = `${dateCaption(e)}: ${dmy(e.startDate)}${overdueText(e)}`;
  const amount = e.amount ? `\nالمبلغ المستحق: *${fmt(e.amount)}*` : '';
  switch (e.type) {
    case 'installment':
    case 'invoice':
      return `${head}\nنود تذكيركم بالمستحق التالي على حسابكم لدينا:\n\n*${messageTitle(e)}*${amount}\n${date}\n\n${e.isOverdue ? 'نرجو التكرم بتسوية هذا المبلغ في أقرب وقت ممكن.' : 'نرجو التكرم بالسداد في الموعد المحدد.'}\n${PAY_NOTE}${SIGN}`;
    case 'contract_end':
      return `${head}\nنود إحاطتكم علماً بقرب انتهاء:\n\n*${messageTitle(e)}*\n${date}\n\nيسعدنا تجديد التعاقد معكم أو الإجابة عن أي استفسار.${SIGN}`;
    default:
      return `${head}\nنود إحاطتكم علماً بموعد:\n\n*${messageTitle(e)}*\n${date}\n\nشكراً لثقتكم بنا.${SIGN}`;
  }
}

/**
 * الفواتير غير المسددة خارج فواتير المبيعات: فواتير الطباعة وفواتير المهام (طباعة/تركيب/قص).
 * المبالغ من نفس مصدر صفحة «متأخرات الحسابات والفواتير» وكشف الحساب (loadCustomerOverdueInvoices)
 * حتى تتطابق الأرقام في كل مكان. الوسوم (tag) ثابتة كما هي لمزامنة التقويم.
 */
function buildTaskInvoiceEvents(customers: CustomerAccountOverdue[]): GoogleCalendarEvent[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const build = (o: { id: string; tag: string; number: string; name: string; date: string; customerId?: string | null; customerName?: string | null; amount: number; contract?: number | null; adType?: string }): GoogleCalendarEvent | null => {
    if (o.amount <= 0.5 || !o.date || !Number.isFinite(Date.parse(o.date))) return null;
    const d = new Date(o.date); d.setHours(0, 0, 0, 0);
    const diff = Math.ceil((today.getTime() - d.getTime()) / 86_400_000);
    return {
      id: o.id, tag: o.tag, type: 'invoice', title: `${o.name}: ${o.customerName || ''} - ${fmt(o.amount)}`,
      description: [`${o.name}${o.number ? ` رقم ${o.number}` : ''}`, `العميل: ${o.customerName || ''}`, o.contract ? `رقم العقد: #${o.contract}` : '', `المبلغ المتبقي: ${fmt(o.amount)}`].filter(Boolean).join('\n'),
      startDate: o.date.slice(0, 10), allDay: false,
      invoiceNumber: o.number, invoiceName: o.name, customerId: o.customerId, customerName: o.customerName || 'عميل غير محدد',
      contractNumber: o.contract ?? undefined, adType: o.adType || undefined, amount: o.amount, daysRemainingOrOverdue: diff, isOverdue: diff > 0, isContractActive: true,
      statusText: diff > 0 ? `متأخرة ${diff} يوم` : 'حديثة',
    };
  };
  const firstContract = (s: string | null) => {
    const n = Number(String(s || '').split(',')[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const events = customers.flatMap(c => c.invoices).map(inv => {
    if (inv.type === 'printed') {
      return build({
        id: `pinv-${inv.invoiceId}`, tag: `[ADHUB:PINV:${inv.invoiceId}]`, number: inv.invoiceNumber || '', name: 'فاتورة طباعة',
        date: inv.createdAt, customerId: inv.customerId, customerName: inv.customerName,
        amount: inv.amount, contract: firstContract(inv.contractNumber), adType: inv.adType,
      });
    }
    if (inv.type === 'composite') {
      return build({
        id: `ct-${inv.invoiceId}`, tag: `[ADHUB:CT:${inv.invoiceId}]`, number: (inv.invoiceNumber || '').replace(/^أمر عمل #/, ''), name: inv.invoiceTitle || 'فاتورة أعمال',
        date: inv.createdAt, customerId: inv.customerId, customerName: inv.customerName,
        amount: inv.amount, contract: firstContract(inv.contractNumber), adType: inv.adType,
      });
    }
    return null; // فواتير المبيعات تأتي من أحداث التقويم (وسومها INV)
  });
  return events.filter((e): e is GoogleCalendarEvent => !!e);
}

const customerKeyOf = (e: { customerId?: string | null; customerName?: string | null }) => String(e.customerId || e.customerName || '—');

/* سجل الإرسال اليدوي على هذا الجهاز (لمعرفة ما أُرسل) */
const SENT_KEY = 'alerts-center-sent';
const readSent = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}') || {}; } catch { return {}; } };
const markSent = (tags: string[]) => { try { const m = readSent(); const now = new Date().toISOString(); tags.forEach(t => { m[t] = now; }); localStorage.setItem(SENT_KEY, JSON.stringify(m)); } catch { /* ignore */ } };

export default function AlertsCenter() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [kind, setKind] = useState<Kind>('payments');
  const [range, setRange] = useState(params.get('range') || '30');
  const [q, setQ] = useState(params.get('customer') || '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendInvites, setSendInvites] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sentMap, setSentMap] = useState(readSent);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (k: string) => setOpenGroups(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const customerIdFilter = params.get('customerId');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['alerts-center'],
    staleTime: 60_000,
    queryFn: async () => {
      const [config, r, invoiceCustomers] = await Promise.all([getCalendarConfig(), loadCalendarRecords(), loadCustomerOverdueInvoices()]);
      const designs = buildContractDesignsMap(r.compositeTasks, r.taskDesigns, r.directInstallationTasks);
      // مبلغ كل فاتورة مبيعات غير مسددة كما في كشف الحساب؛ غير الموجودة مسددة أو مغطاة برصيد الحساب
      const salesDue = new Map<string, number>();
      invoiceCustomers.forEach(c => c.invoices.forEach(i => { if (i.type === 'sales') salesDue.set(i.invoiceId, i.amount); }));
      const calendarEvents = extractCalendarEvents(r.contracts, r.payments, { ...config, activeAndUpcomingOnly: false }, r.invoices || [], r.installations || [], r.customers || [], designs)
        .flatMap(e => {
          if (e.type !== 'invoice') return [e];
          const due = e.invoiceId ? salesDue.get(e.invoiceId) : undefined;
          return due != null && due > 0.5 ? [{ ...e, amount: due }] : [];
        });
      // الاسم الحالي من جدول الزبائن (الاسم المخزن في الفاتورة/العقد قد يكون قديماً)
      const currentNames = new Map<string, string>((r.customers || []).filter((c: any) => c.name).map((c: any) => [c.id, c.name]));
      const events = [...calendarEvents, ...buildTaskInvoiceEvents(invoiceCustomers)].map(e => {
        const name = e.customerId ? currentNames.get(e.customerId) : undefined;
        return name && name !== e.customerName ? { ...e, customerName: name } : e;
      });
      const phones = new Map<string, string>((r.customers || []).map((c: any) => [c.id, c.phone]));
      const companies = new Map<string, string>((r.customers || []).filter((c: any) => c.company?.trim()).map((c: any) => [c.id, c.company.trim()]));
      // المتبقي الفعلي على حساب الزبون (لتطابق الإجمالي مع كشف الحساب)
      const accountRemaining = new Map<string, number>();
      invoiceCustomers.forEach(c => { if (c.accountRemaining != null) accountRemaining.set(customerKeyOf(c), c.accountRemaining); });
      return { config, events, phones, companies, accountRemaining };
    },
  });

  const all = data?.events || [];
  const scoped = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter(e => {
      if (customerIdFilter && e.customerId !== customerIdFilter) return false;
      if (s && !String(e.customerName || '').toLowerCase().includes(s) && !String(e.contractNumber || '').includes(s) && !String(e.invoiceNumber || '').toLowerCase().includes(s)) return false;
      const d = e.daysRemainingOrOverdue; // موجب = متأخر، سالب = متبقٍ
      if (range === 'overdue') return e.isOverdue;
      if (range === 'all') return true;
      const days = Number(range);
      return e.isOverdue ? KIND_OF(e) !== 'contracts' : -d <= days;
    }).sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  }, [all, q, range, customerIdFilter]);
  const byKind = useMemo(() => {
    const m: Record<Kind, GoogleCalendarEvent[]> = { payments: [], contracts: [], invoices: [] };
    scoped.forEach(e => {
      const k = KIND_OF(e);
      m[k].push(e);
      // تبويب المستحقات يجمع الأقساط والفواتير معاً لكل زبون
      if (k === 'invoices') m.payments.push(e);
    });
    return m;
  }, [scoped]);
  const list = byKind[kind];
  const sel = list.filter(e => selected.has(e.tag || e.id));
  // تجميع حسب الزبون: الأكثر تأخراً أولاً
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; name: string; customerId?: string | null; items: GoogleCalendarEvent[] }>();
    list.forEach(e => {
      const k = e.customerId || e.customerName || '—';
      if (!m.has(k)) m.set(k, { key: k, name: e.customerName || '—', customerId: e.customerId, items: [] });
      m.get(k)!.items.push(e);
    });
    const score = (g: { items: GoogleCalendarEvent[] }) => g.items.filter(e => e.isOverdue).reduce((s2, e) => s2 + (Number(e.amount) || 0), 0);
    return [...m.values()].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'ar'));
  }, [list]);

  const toggleAll = (on: boolean) => setSelected(prev => {
    const n = new Set(prev);
    list.forEach(e => on ? n.add(e.tag || e.id) : n.delete(e.tag || e.id));
    return n;
  });

  const sendCalendar = async (events: GoogleCalendarEvent[]) => {
    if (!data?.config.scriptUrl) { toast.error('اربط تقويم Google أولاً من الإعدادات'); return; }
    const changed = filterChangedCalendarEvents(data.config, events);
    if (!changed.length) { toast.success('كل التنبيهات المحددة موجودة ومحدّثة في التقويم'); return; }
    setBusy('calendar');
    try {
      const res = await syncEventsToGoogleCalendar(data.config, changed, undefined, { sendInvites, batchSize: 5, delayMs: 2500 });
      if (res.rateLimited) toast.warning(`أُرسل ${res.totalProcessed} من ${changed.length}؛ توقف مؤقتاً بسبب حدود Google. أعد المحاولة بعد قليل وسيكمل الباقي فقط.`);
      else toast.success(`تمت مزامنة ${changed.length} تنبيه مع التقويم${sendInvites ? ' وإرسال دعوات للزبائن' : ''}`);
    } catch (e: any) { toast.error(e.message || 'فشل الإرسال للتقويم'); }
    finally { setBusy(null); }
  };

  const openWhatsApp = (e: GoogleCalendarEvent) => {
    const phone = whatsappNumber(data?.phones.get(String(e.customerId)));
    if (!phone) { toast.error(`لا يوجد رقم صالح للزبون ${e.customerName}`); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messageFor(e))}`, '_blank', 'noopener');
    markSent([e.tag || e.id]); setSentMap(readSent());
  };

  /** إجماليات الزبون مقيدة بالمتبقي الفعلي في كشف الحساب (رصيد، مقاصات، إيجارات صديقة) */
  const groupTotals = (items: GoogleCalendarEvent[]) => {
    const gross = items.reduce((s2, e) => s2 + (Number(e.amount) || 0), 0);
    const overdueGross = items.filter(e => e.isOverdue).reduce((s2, e) => s2 + (Number(e.amount) || 0), 0);
    const rem = items[0] ? data?.accountRemaining.get(customerKeyOf(items[0])) : undefined;
    const total = rem != null ? Math.max(0, Math.min(gross, rem)) : gross;
    return { gross, total, overdueTotal: Math.min(overdueGross, total), credit: gross - total };
  };

  /** رسالة واحدة للزبون تجمع كل تنبيهاته في التبويب الحالي (الدفعات والفواتير معاً) */
  const groupMessage = (items: GoogleCalendarEvent[]) => {
    const lines = items.map((e, i) => `*${i + 1}- ${messageTitle(e)}*${e.amount ? `\nالمبلغ: ${fmt(e.amount)}` : ''}\n${dateCaption(e)}: ${dmy(e.startDate)}${overdueText(e)}`);
    const { gross, total, overdueTotal, credit } = groupTotals(items);
    const creditLine = credit > 0.5 ? `\nالمجموع: ${fmt(gross)}\nيُخصم رصيد ومقاصات حسابكم: ${fmt(credit)}` : '';
    const totals = total ? `\n\n------------------------------${creditLine}\n*إجمالي المستحق: ${fmt(total)}*${overdueTotal && overdueTotal !== total ? `\nمنها متأخر السداد: *${fmt(overdueTotal)}*` : ''}` : '';
    return `${greet(items[0]?.customerName)}\nنود تذكيركم بالمستحقات التالية على حسابكم لدينا:\n\n${lines.join('\n\n')}${totals}\n\n${overdueTotal ? 'نرجو التكرم بتسوية المبالغ المتأخرة في أقرب وقت ممكن.' : 'نرجو التكرم بالسداد في المواعيد المحددة.'}\n${PAY_NOTE}${SIGN}`;
  };
  /** بند واحد بلا رصيد للخصم: رسالته المفصلة؛ غير ذلك رسالة مجمعة */
  const customerMessage = (items: GoogleCalendarEvent[]) =>
    items.length === 1 && groupTotals(items).credit <= 0.5 ? messageFor(items[0]) : groupMessage(items);
  const openWhatsAppGroup = (items: GoogleCalendarEvent[]) => {
    const phone = whatsappNumber(data?.phones.get(String(items[0]?.customerId)));
    if (!phone) { toast.error('لا يوجد رقم صالح لهذا الزبون'); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(customerMessage(items))}`, '_blank', 'noopener');
    markSent(items.map(e => e.tag || e.id)); setSentMap(readSent());
  };

  const prepareWhatsAppBatch = async (events: GoogleCalendarEvent[]) => {
    const byCustomer = new Map<string, GoogleCalendarEvent[]>();
    events.forEach(e => { const k = String(e.customerId || e.customerName); byCustomer.set(k, [...(byCustomer.get(k) || []), e]); });
    const recipients = [...byCustomer.values()].map(items => ({
      id: items.map(e => e.tag || e.id).join(','), name: items[0].customerName,
      phone: whatsappNumber(data?.phones.get(String(items[0].customerId))) || undefined,
      message: customerMessage(items),
    })).filter(r => r.phone);
    if (!recipients.length) { toast.error('لا توجد أرقام صالحة ضمن التحديد'); return; }
    setBusy('whatsapp');
    try {
      const res = await whatsappBrowserRequest('PREPARE', recipients);
      if (!res.ok) throw new Error(res.error || 'إضافة واتساب غير متصلة');
      toast.success(`جُهّزت ${recipients.length} رسالة (رسالة لكل زبون) في إضافة واتساب — راجعها وأرسلها من هناك`);
      markSent(recipients.flatMap(r => r.id.split(','))); setSentMap(readSent());
    } catch (e: any) { toast.error(e.message || 'تعذر التجهيز؛ استخدم زر واتساب لكل تنبيه'); }
    finally { setBusy(null); }
  };

  /** فاتورة المتأخرات للزبون: البنود المتأخرة ذات المبلغ + الإجمالي المتأخر بعد خصم رصيد الحساب */
  const printOverdueInvoice = async (items: GoogleCalendarEvent[]) => {
    const due = items.filter(e => (Number(e.amount) || 0) > 0.5);
    const overdue = due.filter(e => e.isOverdue);
    if (!overdue.length) { toast.info('لا توجد مبالغ متأخرة لهذا الزبون'); return; }
    const { overdueTotal } = groupTotals(due);
    const gross = overdue.reduce((s2, e) => s2 + (Number(e.amount) || 0), 0);
    setBusy('print');
    try {
      const { generateOverdueStatementHTML } = await import('@/lib/overdueNoticeGenerator');
      const html = await generateOverdueStatementHTML({
        customerName: items[0].customerName || '—',
        customerPhone: data?.phones.get(String(items[0].customerId)) || undefined,
        customerCompany: data?.companies.get(String(items[0].customerId)) || undefined,
        items: overdue.map(e => ({ label: messageTitle(e), kind: TYPE_LABEL[e.type], date: e.startDate, overdueDays: e.daysRemainingOrOverdue, amount: Number(e.amount) || 0 })),
        grossTotal: gross,
        total: overdueTotal,
        credit: gross - overdueTotal,
      });
      const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
      showPrintPreview(html, `فاتورة متأخرات - ${items[0].customerName || ''}`, 'billing-overdue', data?.phones.get(String(items[0].customerId)) || undefined);
    } catch (e: any) { toast.error(e.message || 'تعذر تجهيز فاتورة المتأخرات'); }
    finally { setBusy(null); }
  };

  const kpi = (k: Kind) => ({
    count: byKind[k].length,
    overdue: byKind[k].filter(e => e.isOverdue).length,
    amount: byKind[k].reduce((s, e) => s + (Number(e.amount) || 0), 0),
  });

  return (
    <div dir="rtl" className="space-y-4 p-4 text-right md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Bell className="h-6 w-6" />تنبيهات الزبائن</h1>
          <p className="text-sm text-muted-foreground">كل متأخرات ومستحقات الزبائن (الدفعات والفواتير) والعقود في مكان واحد — مع طباعة فاتورة المتأخرات لكل زبون</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/periodic-reports')}><BarChart3 className="h-4 w-4" />التقارير الأسبوعية والشهرية</Button>
          <Button variant="outline" onClick={() => navigate('/admin/google-calendar')}><Settings className="h-4 w-4" />إعدادات التقويم</Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />تحديث</Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {KINDS.map(k => {
          const v = kpi(k.key);
          return (
            <button key={k.key} type="button" onClick={() => setKind(k.key)}
              className={cn('rounded-xl border-2 bg-card p-4 text-right transition-colors', kind === k.key ? 'border-primary' : 'border-border hover:border-primary/40')}>
              <div className="flex items-center gap-2 text-sm font-semibold"><k.icon className="h-4 w-4" />{k.label}</div>
              <div className="mt-2 flex items-end justify-between">
                <div className="text-2xl font-bold tabular-nums">{v.count}</div>
                {v.overdue > 0 && <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs text-destructive">{v.overdue} متأخر</span>}
              </div>
              {k.key !== 'contracts' && <div className="text-xs tabular-nums text-muted-foreground">{fmt(v.amount)}</div>}
            </button>
          );
        })}
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="زبون، رقم عقد، رقم فاتورة" className="h-10 pr-9" />
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-10 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">خلال 7 أيام + المتأخر</SelectItem>
            <SelectItem value="30">خلال 30 يوماً + المتأخر</SelectItem>
            <SelectItem value="90">خلال 90 يوماً + المتأخر</SelectItem>
            <SelectItem value="overdue">المتأخر فقط</SelectItem>
            <SelectItem value="all">الكل</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Switch checked={sendInvites} onCheckedChange={setSendInvites} />دعوة الزبون بالبريد مع التقويم</label>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <span className="text-sm font-semibold">{KINDS.find(k => k.key === kind)!.label}:</span>
        <span className="text-sm text-muted-foreground">{sel.length ? `${sel.length} محدد` : `${list.length} تنبيه`}</span>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpenGroups(p => p.size ? new Set() : new Set(groups.map(g => g.key)))}>{openGroups.size ? 'طي الكل' : 'توسيع الكل'}</Button>
          <Button size="sm" disabled={!!busy || !(sel.length || list.length)} onClick={() => sendCalendar(sel.length ? sel : list)}>
            {busy === 'calendar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            إرسال {sel.length ? 'المحدد' : 'الكل'} للتقويم
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy || !(sel.length || list.length)} onClick={() => prepareWhatsAppBatch(sel.length ? sel : list)}>
            {busy === 'whatsapp' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            تجهيز {sel.length ? 'المحدد' : 'الكل'} في واتساب
          </Button>
        </div>
      </section>

      {error ? <div className="rounded-xl border border-destructive/40 p-6 text-center text-destructive">{(error as Error).message}</div>
        : isLoading ? <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        : !list.length ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد تنبيهات في هذا النطاق</div>
        : (
          <div className="space-y-3">
            {groups.map(g => {
              const keys = g.items.map(e => e.tag || e.id);
              const allSel = keys.every(k => selected.has(k));
              const phone = whatsappNumber(data?.phones.get(String(g.customerId)));
              const { total: totalAmt, overdueTotal: overdueAmt, credit } = groupTotals(g.items);
              return (
                <article key={g.key} className="overflow-hidden rounded-xl border border-border bg-card">
                  <header className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
                    <Checkbox aria-label={`تحديد تنبيهات ${g.name}`} checked={allSel} onCheckedChange={c => setSelected(p => { const n = new Set(p); keys.forEach(k => c ? n.add(k) : n.delete(k)); return n; })} />
                    <button type="button" aria-expanded={openGroups.has(g.key)} onClick={() => toggleGroup(g.key)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label={openGroups.has(g.key) ? 'طي' : 'توسيع'}>
                      <ChevronDown className={cn('h-4 w-4 transition-transform', openGroups.has(g.key) && 'rotate-180')} />
                    </button>
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleGroup(g.key)}>
                      <button type="button" className="text-base font-bold hover:underline" onClick={ev => { ev.stopPropagation(); g.customerId && navigate(`/admin/customer-account?id=${g.customerId}`); }}>{g.name}</button>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>{g.items.length} تنبيه</span>
                        {kind !== 'contracts' && <span className="tabular-nums">الإجمالي {fmt(totalAmt)}</span>}
                        {kind !== 'contracts' && credit > 0.5 && <span className="tabular-nums">مخصوم رصيد الحساب {fmt(credit)}</span>}
                        {overdueAmt > 0 && <span className="tabular-nums text-destructive">متأخر {fmt(overdueAmt)}</span>}
                        {!phone && <span>بدون رقم هاتف</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {kind !== 'contracts' && overdueAmt > 0 && <Button size="sm" variant="outline" className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10" disabled={!!busy} onClick={() => printOverdueInvoice(g.items)}><Printer className="h-3.5 w-3.5" />فاتورة المتأخرات</Button>}
                      <Button size="sm" variant="outline" className="h-8" disabled={!phone} onClick={() => openWhatsAppGroup(g.items)}><MessageCircle className="h-3.5 w-3.5" />رسالة واحدة بكل التنبيهات</Button>
                      <Button size="sm" variant="ghost" className="h-8" disabled={!!busy} onClick={() => sendCalendar(g.items)} aria-label="إرسال للتقويم"><CalendarClock className="h-3.5 w-3.5" /></Button>
                    </div>
                  </header>
                  {openGroups.has(g.key) && <ul className="divide-y divide-border">
                    {g.items.map(e => {
                      const key = e.tag || e.id;
                      const days = e.daysRemainingOrOverdue;
                      const sentAt = sentMap[key];
                      return (
                        <li key={key} className={cn('flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm', selected.has(key) && 'bg-primary/5')}>
                          <Checkbox aria-label="تحديد" checked={selected.has(key)} onCheckedChange={c => setSelected(p => { const n = new Set(p); c ? n.add(key) : n.delete(key); return n; })} />
                          <div className="w-28 tabular-nums">
                            <div className="font-semibold">{dmy(e.startDate)}</div>
                            <div className={cn('text-xs', e.isOverdue ? 'text-destructive' : days > -7 ? 'text-amber-600' : 'text-muted-foreground')}>{e.isOverdue ? `متأخر ${days} يوم` : days === 0 ? 'اليوم' : `بعد ${-days} يوم`}</div>
                          </div>
                          <div className="min-w-[160px] flex-1">
                            <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs">{TYPE_LABEL[e.type]}</span>
                            <b>{alertLabel(e).replace(/^(دفعة|انتهاء|بدء) /, '')}</b>
                          </div>
                          <div className="w-28 text-left font-semibold tabular-nums">{e.amount ? fmt(e.amount) : '—'}</div>
                          <div className="w-24 text-xs">{sentAt ? <span className="flex items-center gap-1 text-emerald-600"><Check className="h-3.5 w-3.5" />{dmy(sentAt)}</span> : <span className="text-muted-foreground">لم يُرسل</span>}</div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-8" disabled={!phone} onClick={() => openWhatsApp(e)}><MessageCircle className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-8" disabled={!!busy} onClick={() => sendCalendar([e])} aria-label="إرسال للتقويم"><CalendarClock className="h-3.5 w-3.5" /></Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>}
                </article>
              );
            })}
          </div>
        )}
    </div>
  );
}
