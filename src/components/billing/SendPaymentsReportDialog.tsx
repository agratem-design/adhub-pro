import { useState, useEffect, useMemo } from 'react';
import { formatAmount } from '@/lib/formatUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, FileText, MessageCircle, ExternalLink } from 'lucide-react';
import { useSendTextly } from '@/hooks/useSendTextly';
import { useToast } from '@/hooks/use-toast';
import { addWeeks, addMonths, format, parseISO, isAfter, isBefore, isEqual } from 'date-fns';
import { ManagementPhoneManager, fetchManagementPhones } from '@/components/shared/ManagementPhoneManager';
import type { ManagementPhone } from '@/components/shared/ManagementPhoneManager';

interface Payment {
  id: string;
  customer_name: string;
  amount: number;
  paid_at: string;
  method: string;
  entry_type: string;
  contract_number: number | null;
  notes: string;
}

interface SendPaymentsReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payments: Payment[];
}

type PeriodType = 'week' | 'two_weeks' | 'month';

const openWhatsApp = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
};

const methodLabels: Record<string, string> = {
  cash: 'نقدي',
  bank_transfer: 'تحويل بنكي',
  check: 'شيك',
  credit_card: 'بطاقة',
  other: 'أخرى',
};

export function SendPaymentsReportDialog({ open, onOpenChange, payments }: SendPaymentsReportDialogProps) {
  const { toast } = useToast();
  const textly = useSendTextly();

  const [period, setPeriod] = useState<PeriodType>('week');
  const [phones, setPhones] = useState<ManagementPhone[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [sendMethod, setSendMethod] = useState<'textly' | 'whatsapp'>('whatsapp');
  const [sending, setSending] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    fetchManagementPhones().then(data => {
      setPhones(data);
      setSelectedPhones(data.map(p => p.id));
    });
  }, [open]);

  const filteredPayments = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let startDate: Date;
    switch (period) {
      case 'week': startDate = addWeeks(today, -1); break;
      case 'two_weeks': startDate = addWeeks(today, -2); break;
      case 'month': startDate = addMonths(today, -1); break;
    }
    startDate.setHours(0, 0, 0, 0);

    return payments.filter(p => {
      if (!p.paid_at) return false;
      const d = parseISO(p.paid_at);
      return (isAfter(d, startDate) || isEqual(d, startDate)) && (isBefore(d, today) || isEqual(d, today));
    });
  }, [payments, period]);

  const groupedByCustomer = useMemo(() => {
    const map: Record<string, { customerName: string; items: Payment[]; total: number }> = {};
    filteredPayments.forEach(p => {
      const key = p.customer_name || 'غير محدد';
      if (!map[key]) map[key] = { customerName: key, items: [], total: 0 };
      map[key].items.push(p);
      map[key].total += p.amount;
    });
    return map;
  }, [filteredPayments]);

  const totalAmount = filteredPayments.reduce((s, p) => s + p.amount, 0);
  const totalCount = filteredPayments.length;

  const reportMessage = useMemo(() => {
    const periodLabels = { week: 'أسبوع', two_weeks: 'أسبوعين', month: 'شهر' };
    const today = format(new Date(), 'yyyy/MM/dd');

    let msg = `*تقرير الدفعات والإيصالات خلال ${periodLabels[period]}*\n`;
    msg += `تاريخ التقرير: ${today}\n`;
    msg += `إجمالي المعاملات: ${totalCount}\n`;
    msg += `إجمالي المبالغ: ${formatAmount(totalAmount)} د.ل\n`;
    msg += `---------------\n\n`;

    if (totalCount === 0) {
      msg += `لا توجد دفعات أو إيصالات خلال هذه الفترة`;
    } else {
      const groups = Object.values(groupedByCustomer);
      groups.forEach((group, gi) => {
        msg += `*العميل: ${group.customerName}*\n`;
        group.items.forEach((item, i) => {
          const typeLabel = item.entry_type === 'receipt' ? 'إيصال' : 'دفعة';
          const methodLabel = methodLabels[item.method] || item.method || '';
          const date = item.paid_at ? format(parseISO(item.paid_at), 'yyyy/MM/dd') : '';
          msg += `${i + 1}. ${typeLabel} - ${formatAmount(item.amount)} د.ل - ${date}`;
          if (methodLabel) msg += ` - ${methodLabel}`;
          if (item.contract_number) msg += ` - عقد #${item.contract_number}`;
          msg += `\n`;
        });
        msg += `إجمالي العميل: ${formatAmount(group.total)} د.ل\n`;
        if (gi < groups.length - 1) msg += `\n---------------\n\n`;
      });

      msg += `\n---------------\n`;
      msg += `*الإجمالي: ${totalCount} معاملة - ${formatAmount(totalAmount)} د.ل*`;
    }

    return msg;
  }, [filteredPayments, groupedByCustomer, period, totalCount, totalAmount]);

  const handleSend = async () => {
    const message = customMessage.trim() || reportMessage;

    if (selectedPhones.length === 0) {
      toast({ title: 'خطأ', description: 'اختر رقم واحد على الأقل', variant: 'destructive' });
      return;
    }

    if (sendMethod === 'whatsapp') {
      for (const phoneId of selectedPhones) {
        const phone = phones.find(p => p.id === phoneId);
        if (phone) openWhatsApp(phone.phone_number, message);
      }
      toast({ title: 'تم', description: 'تم فتح واتساب للأرقام المحددة' });
      onOpenChange(false);
      return;
    }

    setSending(true);
    let successCount = 0;
    for (const phoneId of selectedPhones) {
      const phone = phones.find(p => p.id === phoneId);
      if (!phone) continue;
      if (await textly.sendMessage({ phone: phone.phone_number, message })) successCount++;
    }
    setSending(false);

    if (successCount > 0) {
      toast({ title: 'تم الإرسال', description: `تم إرسال التقرير إلى ${successCount} رقم بنجاح` });
      onOpenChange(false);
    }
  };

  const periodLabels = { week: 'أسبوع', two_weeks: 'أسبوعين', month: 'شهر' };
  const periodOptions: PeriodType[] = ['week', 'two_weeks', 'month'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            إرسال تقرير الدفعات والإيصالات
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Period Selection */}
          <div className="flex gap-2">
            {periodOptions.map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setCustomMessage(''); }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  period === p
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center">
              <div className="text-2xl font-bold text-primary">{totalCount}</div>
              <div className="text-xs text-muted-foreground mt-1">معاملة</div>
            </div>
            <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-4 text-center">
              <div className="text-lg font-bold text-foreground">{formatAmount(totalAmount)} د.ل</div>
              <div className="text-xs text-muted-foreground mt-1">إجمالي المبالغ</div>
            </div>
          </div>

          {/* Customer breakdown */}
          {totalCount > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">المعاملات حسب العملاء</span>
                <Badge variant="default">{Object.keys(groupedByCustomer).length} عميل</Badge>
              </div>
              <ScrollArea className="max-h-44">
                <div className="space-y-2 text-xs">
                  {Object.values(groupedByCustomer).map((group, gi) => (
                    <div key={gi} className="border-b border-border/30 pb-2 last:border-0">
                      <div className="font-semibold text-sm mb-1">
                        {group.customerName} ({group.items.length} معاملة - {formatAmount(group.total)} د.ل)
                      </div>
                      {group.items.map((item) => {
                        const typeLabel = item.entry_type === 'receipt' ? 'إيصال' : 'دفعة';
                        return (
                          <div key={item.id} className="flex justify-between items-center py-0.5 pr-3">
                            <span>{typeLabel} - {formatAmount(item.amount)} د.ل</span>
                            <span className="text-muted-foreground">{item.paid_at ? format(parseISO(item.paid_at), 'yyyy/MM/dd') : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Send Method */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">طريقة الإرسال</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSendMethod('whatsapp')}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                  sendMethod === 'whatsapp'
                    ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </button>
              <button
                onClick={() => setSendMethod('textly')}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                  sendMethod === 'textly'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Send className="h-4 w-4" />
                Textly
              </button>
            </div>
          </div>

          {/* Phone Selection */}
          <ManagementPhoneManager
            phones={phones}
            onPhonesChange={(newPhones) => {
              setPhones(newPhones);
              setSelectedPhones(newPhones.map(p => p.id));
            }}
            selectedPhones={selectedPhones}
            onSelectedPhonesChange={setSelectedPhones}
            onWhatsAppClick={(p) => openWhatsApp(p.phone_number, customMessage.trim() || reportMessage)}
            title="أرقام الإدارة والمشرف"
          />

          {/* Message Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">نص التقرير (يمكنك التعديل)</Label>
            <Textarea
              value={customMessage || reportMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={7}
              className="text-xs font-mono"
              dir="rtl"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            onClick={handleSend}
            disabled={sending || selectedPhones.length === 0}
            className={`gap-2 ${sendMethod === 'whatsapp' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sendMethod === 'whatsapp' ? <MessageCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {sendMethod === 'whatsapp' ? 'فتح واتساب' : 'إرسال التقرير'}
            {sendMethod === 'whatsapp' && <ExternalLink className="h-3 w-3" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
