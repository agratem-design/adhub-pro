import { usePersistedState } from '@/hooks/usePersistedState';
import { WhatsAppSendModesDialog } from "@/components/shared/WhatsAppSendModes";
import { openWhatsAppChat } from "@/components/shared/ManualWhatsAppQueue";
import { OverdueWorkspace } from '@/components/billing/OverdueWorkspace';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertCircle, Clock, DollarSign, User, CreditCard, Receipt, TrendingDown, MessageCircle, ArrowUpDown, Calendar, Search, Filter, CheckCircle, Loader2, Coins, Users, Send, Check, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
import { loadCustomerOverdueInvoices, type UnpaidInvoice, type CustomerAccountOverdue } from '@/services/overdueInvoices';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OverduePaymentsPrintDialog } from '@/components/billing/OverduePaymentsPrintDialog';


export default function AccountOverduePayments() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerAccountOverdue[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneMap, setPhoneMap] = useState<Map<string, string>>(new Map());
  const { sendMessage: sendWhatsApp } = useSendWhatsApp();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [whatsappChoiceDialog, setWhatsappChoiceDialog] = useState<{
    open: boolean;
    invoice: UnpaidInvoice | null;
    customer: CustomerAccountOverdue | null;
  }>({
    open: false,
    invoice: null,
    customer: null,
  });
  const [copied, setCopied] = useState(false);
  const [printCustomer, setPrintCustomer] = useState<CustomerAccountOverdue | null>(null);

  // فلاتر
  const [searchTerm, setSearchTerm] = usePersistedState('accountOverduePayments.searchTerm', '');
  const [minDays, setMinDays] = useState<number>(0);
  const [minAmount, setMinAmount] = useState<string>('');
  const [sortBy, setSortBy] = usePersistedState<'oldest' | 'newest'>('accountOverduePayments.sortBy', 'oldest');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const filteredResult = await loadCustomerOverdueInvoices();

      setCustomers(filteredResult);

      const customerIds = filteredResult.map(r => r.customerId).filter((x): x is string => !!x);

      const customerNames = filteredResult.filter(r => !r.customerId).map(r => r.customerName);
      const pm = new Map<string, string>();
      if (customerIds.length) {
        const { data: cs } = await supabase.from('customers').select('id, phone').in('id', customerIds);
        (cs || []).forEach((c: any) => { if (c.phone) pm.set(c.id, c.phone); });
      }
      if (customerNames.length) {
        const { data: cs } = await supabase.from('customers').select('name, phone').in('name', customerNames);
        (cs || []).forEach((c: any) => { if (c.phone) pm.set(c.name, c.phone); });
      }
      setPhoneMap(pm);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const sortedAndFiltered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const minAmt = parseFloat(minAmount || '0') || 0;
    
    const items = customers.filter(c =>
      (!term || c.customerName.toLowerCase().includes(term)) &&
      c.oldestDaysOverdue >= minDays &&
      c.totalOverdue >= minAmt
    );

    return [...items].sort((a, b) => {
      if (sortBy === 'oldest') {
        return b.oldestDaysOverdue - a.oldestDaysOverdue; // أقدم تأخير أولاً (رقم تأخير كبير)
      } else {
        return a.oldestDaysOverdue - b.oldestDaysOverdue; // أحدث تأخير أولاً (رقم تأخير صغير)
      }
    });
  }, [customers, searchTerm, minDays, minAmount, sortBy]);

  const totalAmount = sortedAndFiltered.reduce((s, c) => s + c.totalOverdue, 0);
  const totalInvoices = sortedAndFiltered.reduce((s, c) => s + c.invoicesCount, 0);

  const getPhone = (c: { customerId: string | null; customerName: string }) =>
    (c.customerId && phoneMap.get(c.customerId)) || phoneMap.get(c.customerName) || '';

  const formatPhone = (phone: string): string => {
    // Keep only numeric digits (strips spaces, hyphens, and invisible directional isolate characters)
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('09') && cleaned.length === 10) {
      cleaned = '218' + cleaned.substring(1);
    } else if (cleaned.startsWith('9') && cleaned.length === 9) {
      cleaned = '218' + cleaned;
    }
    return cleaned;
  };

  const generateWhatsAppLink = (phone: string, message: string): string => {
    return `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(message)}`;
  };

  const getInvoiceMessageText = (inv: UnpaidInvoice) => {
    const dateStr = new Date(inv.createdAt).toLocaleDateString('ar-LY');
    let typeName = 'فاتورة غير مسددة';
    let docRef = '';
    if (inv.type === 'printed') {
      typeName = 'فاتورة طباعة غير مسددة';
      if (inv.notes) typeName += ` (${inv.notes})`;
      if (inv.contractNumber) {
        docRef = inv.contractNumber.includes(',')
          ? `\n- عقود رقم: #${inv.contractNumber.split(',').join(', #')}`
          : `\n- عقد رقم: #${inv.contractNumber}`;
      }
      if (inv.adType) docRef += `\n- نوع الإعلان: ${inv.adType}`;
    } else if (inv.type === 'sales') {
      typeName = 'فاتورة مبيعات غير مسددة';
      if (inv.invoiceName) typeName += ` - ${inv.invoiceName}`;
      if (inv.notes) typeName += ` (${inv.notes})`;
      if (inv.invoiceNumber) docRef = `\n- رقم الفاتورة: ${inv.invoiceNumber}`;
    } else if (inv.type === 'composite') {
      typeName = `${inv.invoiceTitle || 'فاتورة خدمات'} غير مسددة`;
      if (inv.invoiceNumber) docRef = `\n- رقم الفاتورة / المهمة: ${inv.invoiceNumber}`;
      if (inv.contractNumber) {
        docRef += inv.contractNumber.includes(',')
          ? `\n- عقود رقم: #${inv.contractNumber.split(',').join(', #')}`
          : `\n- عقد رقم: #${inv.contractNumber}`;
      }
      if (inv.adType) docRef += `\n- نوع الإعلان: ${inv.adType}`;
    }
    return `السلام عليكم ورحمة الله وبركاته\n\nالسيد/ ${inv.customerName} المحترم،\n\nنود تذكيركم بـ ${typeName}:\n- تاريخ الإصدار: ${dateStr}\n- أيام التأخير: ${inv.daysOverdue} يوم\n- المبلغ: ${inv.amount.toLocaleString('en-US')} د.ل${docRef}\n\nنرجو المبادرة بالسداد.\n\nشكراً لتعاونكم.`;
  };

  const getComprehensiveMessageText = (customer: CustomerAccountOverdue) => {
    let invoiceDetails = '';
    customer.invoices.forEach((inv, index) => {
      const dateStr = new Date(inv.createdAt).toLocaleDateString('ar-LY');
      let typeName = '';
      let details = [];
      
      if (inv.type === 'printed') {
        typeName = 'فاتورة طباعة';
        if (inv.notes) typeName += ` (${inv.notes})`;
        if (inv.contractNumber) {
          details.push(inv.contractNumber.includes(',')
            ? `عقود #${inv.contractNumber.split(',').join(', #')}`
            : `عقد #${inv.contractNumber}`);
        }
      } else if (inv.type === 'sales') {
        typeName = 'فاتورة مبيعات';
        if (inv.invoiceName) typeName += ` - ${inv.invoiceName}`;
        if (inv.notes) typeName += ` (${inv.notes})`;
        if (inv.invoiceNumber) details.push(`رقم ${inv.invoiceNumber}`);
      } else if (inv.type === 'composite') {
        typeName = inv.invoiceTitle || 'فاتورة خدمات';
        if (inv.invoiceNumber) details.push(`${inv.invoiceNumber}`);
        if (inv.contractNumber) {
          details.push(inv.contractNumber.includes(',')
            ? `عقود #${inv.contractNumber.split(',').join(', #')}`
            : `عقد #${inv.contractNumber}`);
        }
      }
      
      if (inv.adType) {
        details.push(`نوع الإعلان: ${inv.adType}`);
      }
      
      const detailsStr = details.length ? ` (${details.join(' - ')})` : '';
      invoiceDetails += `${index + 1}. ${typeName}${detailsStr}:\n`;
      invoiceDetails += `   - تاريخ الإصدار: ${dateStr}\n`;
      invoiceDetails += `   - أيام التأخير: ${inv.daysOverdue} يوم\n`;
      invoiceDetails += `   - المبلغ المطلوب: ${inv.amount.toLocaleString('en-US')} د.ل\n\n`;
    });

    // عند وجود رصيد في حساب الزبون يكون المستحق أقل من مجموع الفواتير — نوضح الفرق حتى تتطابق الأرقام
    const invoicesSum = customer.invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const creditApplied = invoicesSum - customer.totalOverdue;
    if (creditApplied > 0.5) {
      invoiceDetails += `مجموع الفواتير: ${invoicesSum.toLocaleString('en-US')} د.ل\n`;
      invoiceDetails += `يُخصم رصيد حسابكم: ${creditApplied.toLocaleString('en-US')} د.ل\n`;
      invoiceDetails += `المستحق: ${customer.totalOverdue.toLocaleString('en-US')} د.ل\n\n`;
    }

    return `السلام عليكم ورحمة الله وبركاته\n\nالسيد/ ${customer.customerName} المحترم،\n\nنود تذكيركم بمتأخرات الحساب والفواتير غير المسددة طرفكم بقيمة إجمالية قدرها (${customer.totalOverdue.toLocaleString('en-US')} د.ل) وتفصيلها كالتالي:\n\n${invoiceDetails}نرجو التكرم بالمبادرة بسداد المبالغ المستحقة في أقرب وقت.\n\nشكراً لحسن تعاونكم.`;
  };

  const sendInvoiceWhatsApp = async (inv: UnpaidInvoice) => {
    const phone = getPhone(inv);
    if (!phone) { toast.error('لا يوجد رقم هاتف مسجل لهذا الزبون'); return; }
    setSendingId(inv.invoiceId);
    try {
      const message = getInvoiceMessageText(inv);
      await sendWhatsApp({ phone, message });
    } catch (e) {
      console.error(e);
    } finally {
      setSendingId(null);
    }
  };

  const sendComprehensiveWhatsApp = async (customer: CustomerAccountOverdue) => {
    const phone = getPhone(customer);
    if (!phone) { toast.error('لا يوجد رقم هاتف مسجل لهذا الزبون'); return; }
    const idKey = customer.customerId || customer.customerName;
    setSendingId(idKey);
    try {
      const message = getComprehensiveMessageText(customer);
      await sendWhatsApp({ phone, message });
    } catch (e) {
      console.error(e);
    } finally {
      setSendingId(null);
    }
  };

  const markItemPaid = async (item: UnpaidInvoice) => {
    try {
      if (item.type === 'printed') {
        const { error } = await supabase.from('printed_invoices').update({ paid: true }).eq('id', item.invoiceId);
        if (error) throw error;
      } else if (item.type === 'sales') {
        const { error } = await supabase
          .from('sales_invoices')
          .update({ paid: true, remaining_amount: 0 })
          .eq('id', item.invoiceId);
        if (error) throw error;
      } else if (item.type === 'composite') {
        const { data: ct, error: getError } = await supabase
          .from('composite_tasks')
          .select('customer_total, discount_amount')
          .eq('id', item.invoiceId)
          .single();
        if (getError) throw getError;
        
        const total = Number(ct.customer_total) || 0;
        const discount = Number(ct.discount_amount) || 0;
        const targetPaid = Math.max(0, total - discount);
        
        const { error } = await supabase
          .from('composite_tasks')
          .update({ paid_amount: targetPaid })
          .eq('id', item.invoiceId);
        if (error) throw error;
      }
      toast.success('تم تسديد البند بنجاح');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('خطأ في تسديد البند');
    }
  };

  const getUrgencyBadge = (days: number) => {
    if (days >= 90) {
      return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 font-semibold rounded-lg text-[10px] px-2.5 py-0.5">حرجة جداً (90+ يوم)</Badge>;
    } else if (days >= 30) {
      return <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 font-semibold rounded-lg text-[10px] px-2.5 py-0.5">متأخرة (30+ يوم)</Badge>;
    } else if (days >= 7) {
      return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 font-semibold rounded-lg text-[10px] px-2.5 py-0.5">تنبيه (7+ أيام)</Badge>;
    }
    return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 font-semibold rounded-lg text-[10px] px-2.5 py-0.5">حديثة ({days} يوم)</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-background">
        <div className="flex flex-col items-center gap-4">
          <Clock className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">جاري تحميل متأخرات الحسابات والفواتير...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <OverdueWorkspace title="الفواتير والحسابات المتأخرة" description="راجع فواتير الطباعة والمبيعات وخدمات التركيب والقص، مع المستحق الفعلي بعد احتساب رصيد الحساب." itemLabel="فواتير غير مسددة" totalAmount={totalAmount} totalItems={totalInvoices}
        headerAction={<WhatsAppSendModesDialog recipients={sortedAndFiltered.map(customer=>({id:customer.customerId||customer.customerName,name:customer.customerName,phone:getPhone(customer),message:getComprehensiveMessageText(customer)}))}/>}
        search={searchTerm} onSearch={setSearchTerm} minDays={minDays} onMinDays={setMinDays} minAmount={minAmount} onMinAmount={setMinAmount} sort={sortBy} onSort={setSortBy} onRefresh={loadData}
        customers={sortedAndFiltered.map(customer=>({key:customer.customerId || customer.customerName,name:customer.customerName,amount:customer.totalOverdue,count:customer.invoicesCount,days:customer.oldestDaysOverdue,phone:getPhone(customer),
          onAccount:()=>navigate(`/admin/customer-billing?${customer.customerId?`id=${customer.customerId}&`:''}name=${encodeURIComponent(customer.customerName)}`),
          onPrint:()=>setPrintCustomer(customer),
          onReminder:()=>setWhatsappChoiceDialog({open:true,invoice:null,customer}),reminderDisabled:sendingId===(customer.customerId||customer.customerName)||!getPhone(customer),
          extra:customer.invoices.reduce((sum,invoice)=>sum+invoice.amount,0)-customer.totalOverdue>0.5?<div className="rounded-lg border border-info/25 bg-info/5 p-3 text-xs"><p className="font-semibold">رصيد الحساب محسوب في المستحق</p><p className="mt-1 leading-relaxed text-muted-foreground">مجموع أرصدة الفواتير {customer.invoices.reduce((sum,invoice)=>sum+invoice.amount,0).toLocaleString('ar-LY')} د.ل، والمستحق بعد تسوية رصيد الحساب {customer.totalOverdue.toLocaleString('ar-LY')} د.ل.</p></div>:undefined,
          items:customer.invoices.slice().sort((a,b)=>b.daysOverdue-a.daysOverdue).map(invoice=>({key:`${invoice.type}-${invoice.invoiceId}`,
            title:invoice.type==='printed'?'فاتورة طباعة':invoice.type==='sales'?`فاتورة مبيعات ${invoice.invoiceNumber||''}`:`${invoice.invoiceTitle || 'فاتورة'} ${invoice.invoiceNumber?.replace(/^مهمة\s*/,'#')||''}`,
            subtitle:[invoice.invoiceName,invoice.adType,invoice.notes].filter(Boolean).join(' · '),contract:invoice.contractNumber?`عقد #${invoice.contractNumber.split(',').join('، #')}`:undefined,amount:invoice.amount,date:invoice.createdAt,dateLabel:'تاريخ الإصدار',amountLabel:'متبقي الفاتورة',days:invoice.daysOverdue,
            onSettle:()=>markItemPaid(invoice),onReminder:()=>setWhatsappChoiceDialog({open:true,invoice,customer:null}),reminderDisabled:sendingId===invoice.invoiceId||!getPhone(invoice),
          })),
        }))}/>

      {printCustomer && (
        <OverduePaymentsPrintDialog
          open={!!printCustomer}
          onOpenChange={(open) => { if (!open) setPrintCustomer(null); }}
          customerOverdue={{
            customerId: printCustomer.customerId,
            customerName: printCustomer.customerName,
            totalOverdue: printCustomer.totalOverdue,
            oldestDaysOverdue: printCustomer.oldestDaysOverdue,
            accountRemaining: printCustomer.accountRemaining,
            installments: [],
            unpaidInvoices: printCustomer.invoices,
          }}
        />
      )}

      {/* WhatsApp Choice Dialog */}
      <Dialog open={whatsappChoiceDialog.open} onOpenChange={(open) => {
        setWhatsappChoiceDialog({ open, invoice: open ? whatsappChoiceDialog.invoice : null, customer: open ? whatsappChoiceDialog.customer : null });
        setCopied(false);
      }}>
        <DialogContent className="sm:max-w-md border-0 shadow-2xl rounded-2xl overflow-hidden p-0 bg-background" dir="rtl">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
            <DialogHeader className="space-y-1 relative z-10">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-white">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                  <MessageCircle className="h-6 w-6 text-white animate-pulse" />
                </div>
                {whatsappChoiceDialog.invoice ? 'تنبيه الفاتورة المتأخرة' : 'تنبيه الحساب الموحد'}
              </DialogTitle>
              <p className="text-white/80 text-xs font-medium">إرسال إشعار تذكيري للزبون بمتأخرات الفواتير والخدمات</p>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-5">
            {(whatsappChoiceDialog.invoice || whatsappChoiceDialog.customer) && (() => {
              const inv = whatsappChoiceDialog.invoice;
              const customer = whatsappChoiceDialog.customer;
              
              const phone = inv ? getPhone(inv) : (customer ? getPhone(customer) : '');
              const messageText = inv ? getInvoiceMessageText(inv) : (customer ? getComprehensiveMessageText(customer) : '');
              const waLink = phone ? generateWhatsAppLink(phone, messageText) : '#';

              const handleManualClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                if (!phone) {
                  e.preventDefault();
                  toast.error('لا يوجد رقم هاتف مسجل لهذا الزبون');
                  return;
                }
                setWhatsappChoiceDialog({ open: false, invoice: null, customer: null });
              };

              const handleApiWhatsApp = async () => {
                setWhatsappChoiceDialog({ open: false, invoice: null, customer: null });
                if (inv) {
                  await sendInvoiceWhatsApp(inv);
                } else if (customer) {
                  await sendComprehensiveWhatsApp(customer);
                }
              };

              const handleCopyText = () => {
                navigator.clipboard.writeText(messageText);
                setCopied(true);
                toast.success('تم نسخ نص الرسالة بنجاح');
                setTimeout(() => setCopied(false), 2000);
              };

              return (
                <>
                  <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/40 border border-border/50 text-xs">
                    <div>
                      <span className="text-muted-foreground block mb-0.5">الزبون المستهدف</span>
                      <strong className="text-foreground text-sm block">{inv ? inv.customerName : (customer ? customer.customerName : '')}</strong>
                    </div>
                    <div className="text-left">
                      <span className="text-muted-foreground block mb-0.5">رقم الهاتف</span>
                      <strong className="text-foreground text-sm block">{phone || '—'}</strong>
                    </div>
                  </div>

                  <div className="space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-muted-foreground">معاينة نص الرسالة التذكيرية:</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1.5 px-2 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer rounded-lg border border-border/50"
                        onClick={handleCopyText}
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>نسخ النص</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <textarea
                      readOnly
                      value={messageText}
                      className="w-full min-h-[160px] text-xs p-4 rounded-xl border bg-muted/20 resize-none leading-relaxed focus-visible:outline-none focus:border-emerald-500 focus:bg-background transition-all duration-200 font-sans shadow-inner"
                      dir="rtl"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <Button
                      asChild
                      variant="outline"
                      className="h-16 flex items-center justify-start gap-4 border border-emerald-500/20 hover:border-emerald-500 bg-emerald-500/[0.01] hover:bg-emerald-500/[0.04] text-right px-4 cursor-pointer rounded-xl transition-all duration-200 shadow-sm"
                    >
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => { if (phone) { event.preventDefault(); openWhatsAppChat(phone, messageText); } handleManualClick(event); }}
                      >
                        <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                          <MessageCircle className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-foreground">إرسال يدوي (واتساب ويب / تطبيق)</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-sans">فتح محادثة مباشرة وتجهيز نص الرسالة للنسخ والتعديل قبل الإرسال</div>
                        </div>
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-16 flex items-center justify-start gap-4 border border-blue-500/20 hover:border-blue-500 bg-blue-500/[0.01] hover:bg-blue-500/[0.04] text-right px-4 rounded-xl cursor-pointer transition-all duration-200 shadow-sm"
                      onClick={handleApiWhatsApp}
                    >
                      <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <Send className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground">إرسال تلقائي (عبر منصة الربط API)</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-sans">إرسال الرسالة تلقائياً في الخلفية باستخدام منصة الربط المدمجة</div>
                      </div>
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

