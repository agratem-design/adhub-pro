// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, FileText, Calendar, MessageCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSendTextly } from '@/hooks/useSendTextly';
import { useToast } from '@/hooks/use-toast';
import { addWeeks, addMonths, format, parseISO, isAfter, isBefore, isEqual } from 'date-fns';
import { ManagementPhoneManager, fetchManagementPhones } from '@/components/shared/ManagementPhoneManager';
import type { ManagementPhone } from '@/components/shared/ManagementPhoneManager';

interface ManagementPhone {
  id: string;
  phone_number: string;
  label: string | null;
  is_active: boolean;
}

interface SendContractReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: any[];
}

type PeriodType = 'week' | 'two_weeks' | 'month';
type ReportType = 'new' | 'expiring';

const openWhatsApp = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
};

export function SendContractReportDialog({ open, onOpenChange, contracts }: SendContractReportDialogProps) {
  const { toast } = useToast();
  const textly = useSendTextly();

  const [reportType, setReportType] = useState<ReportType>('new');
  const [period, setPeriod] = useState<PeriodType>('week');
  const [phones, setPhones] = useState<ManagementPhone[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [sendMethod, setSendMethod] = useState<'textly' | 'whatsapp'>('whatsapp');
  const [sending, setSending] = useState(false);
  const [customMessage, setCustomMessage] = useState('');


  useEffect(() => {
    if (!open) return;
    fetchPhones();
  }, [open]);

  const fetchPhones = async () => {
    const data = await fetchManagementPhones();
    setPhones(data);
    setSelectedPhones(data.map(p => p.id));
  };

  // Filter contracts by period and report type
  const filteredContracts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let endDate: Date;
    switch (period) {
      case 'week': endDate = addWeeks(today, 1); break;
      case 'two_weeks': endDate = addWeeks(today, 2); break;
      case 'month': endDate = addMonths(today, 1); break;
    }

    if (reportType === 'new') {
      let startDate: Date;
      switch (period) {
        case 'week': startDate = addWeeks(today, -1); break;
        case 'two_weeks': startDate = addWeeks(today, -2); break;
        case 'month': startDate = addMonths(today, -1); break;
      }
      return contracts.filter(c => {
        const contractDate = c['Contract Date'] || c.contract_date;
        if (!contractDate) return false;
        const d = parseISO(contractDate);
        return (isAfter(d, startDate) || isEqual(d, startDate)) && (isBefore(d, today) || isEqual(d, today));
      });
    }

    return contracts.filter(c => {
      const contractEnd = c['End Date'] || c.end_date;
      if (!contractEnd) return false;
      const d = parseISO(contractEnd);
      return (isAfter(d, today) || isEqual(d, today)) && (isBefore(d, endDate) || isEqual(d, endDate));
    });
  }, [contracts, period, reportType]);

  const totalValue = useMemo(() => 
    filteredContracts.reduce((sum, c) => sum + (c.Total || c.total || 0), 0),
    [filteredContracts]
  );

  // Build report message
  const reportMessage = useMemo(() => {
    const periodLabels = { week: 'أسبوع', two_weeks: 'أسبوعين', month: 'شهر' };
    const today = format(new Date(), 'yyyy/MM/dd');
    const typeLabel = reportType === 'new' ? 'الجديدة' : 'المنتهية';
    
    let msg = `*تقرير العقود ${typeLabel} خلال ${periodLabels[period]}*\n`;
    msg += `تاريخ التقرير: ${today}\n`;
    msg += `عدد العقود: ${filteredContracts.length}\n`;
    msg += `---------------\n\n`;

    if (filteredContracts.length === 0) {
      msg += `لا توجد عقود ${typeLabel} خلال هذه الفترة`;
    } else {
      filteredContracts.forEach((c, i) => {
        const dateField = reportType === 'new' 
          ? (c['Contract Date'] || c.contract_date || '')
          : (c['End Date'] || c.end_date || '');
        const customerName = c['Customer Name'] || c.customer_name || 'غير محدد';
        const contractNum = c.Contract_Number || c.contract_number || '';
        const adType = c['Ad Type'] || c.ad_type || '';
        const total = c.Total || c.total || 0;
        const dateLabel = reportType === 'new' ? 'تاريخ البداية' : 'تاريخ الانتهاء';

        msg += `${i + 1}. عقد رقم: *${contractNum}*${adType ? ` - نوع الإعلان: ${adType}` : ''}\n`;
        msg += `   العميل: ${customerName}\n`;
        msg += `   ${dateLabel}: ${dateField}\n`;
        msg += `   القيمة: ${total?.toLocaleString()} د.ل\n`;
        if (i < filteredContracts.length - 1) msg += '\n';
      });

      msg += `\n---------------\n`;
      msg += `*إجمالي القيمة: ${totalValue.toLocaleString()} د.ل*`;
    }

    return msg;
  }, [filteredContracts, period, reportType, totalValue]);


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

    // Textly
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
            إرسال تقرير العقود
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Report Type Tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setReportType('new'); setCustomMessage(''); }}
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all ${
                reportType === 'new'
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted/50'
              }`}
            >
              <FileText className="h-4 w-4" />
              العقود الجديدة
            </button>
            <button
              onClick={() => { setReportType('expiring'); setCustomMessage(''); }}
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all ${
                reportType === 'expiring'
                  ? 'border-destructive bg-destructive/10 text-destructive shadow-sm'
                  : 'border-border bg-background text-muted-foreground hover:border-destructive/30 hover:bg-muted/50'
              }`}
            >
              <Calendar className="h-4 w-4" />
              العقود المنتهية
            </button>
          </div>

          {/* Period Selection - Styled Buttons */}
          <div className="flex gap-2">
            {periodOptions.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
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

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl border-2 p-4 text-center transition-all ${
              reportType === 'new' ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'
            }`}>
              <div className={`text-2xl font-bold ${reportType === 'new' ? 'text-primary' : 'text-destructive'}`}>
                {filteredContracts.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {reportType === 'new' ? 'عقد جديد' : 'عقد منتهي'}
              </div>
            </div>
            <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{totalValue.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">إجمالي القيمة (د.ل)</div>
            </div>
          </div>

          {/* Filtered Contracts List */}
          {filteredContracts.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {reportType === 'new' ? 'العقود الجديدة' : 'العقود المنتهية'} خلال {periodLabels[period]}
                </span>
                <Badge variant={reportType === 'new' ? 'default' : 'destructive'}>
                  {filteredContracts.length} عقد
                </Badge>
              </div>
              <ScrollArea className="max-h-36">
                <div className="space-y-1 text-xs">
                  {filteredContracts.map(c => (
                    <div key={c.Contract_Number || c.id} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
                      <span className="font-medium">عقد #{c.Contract_Number} - {c['Customer Name'] || 'غير محدد'}</span>
                      <span className="text-muted-foreground">
                        {reportType === 'new' ? (c['Contract Date'] || '') : (c['End Date'] || '')}
                      </span>
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

          {/* Phone Selection + Management */}
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
