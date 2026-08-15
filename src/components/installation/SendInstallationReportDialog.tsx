// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
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

interface TaskDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
  design_order: number;
}

interface SendInstallationReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: any[];
  allTaskItems: any[];
  billboardById: Record<number, any>;
  teamById: Record<string, any>;
  contractById: Record<number, any>;
  designsByTask: Record<string, TaskDesign[]>;
}

type PeriodType = 'week' | 'two_weeks' | 'month';

const openWhatsApp = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
};

export function SendInstallationReportDialog({
  open, onOpenChange, tasks, allTaskItems, billboardById, teamById, contractById, designsByTask
}: SendInstallationReportDialogProps) {
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

  // Get completed task items within the period
  const completedItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate: Date;
    switch (period) {
      case 'week': startDate = addWeeks(today, -1); break;
      case 'two_weeks': startDate = addWeeks(today, -2); break;
      case 'month': startDate = addMonths(today, -1); break;
    }

    return allTaskItems.filter(item => {
      if (item.status !== 'completed') return false;
      if (!item.installation_date) return false;
      const d = parseISO(item.installation_date);
      return (isAfter(d, startDate) || isEqual(d, startDate)) && (isBefore(d, today) || isEqual(d, today));
    });
  }, [allTaskItems, period]);

  // Group by team
  const groupedByTeam = useMemo(() => {
    const map: Record<string, { teamName: string; items: any[] }> = {};

    completedItems.forEach(item => {
      const task = tasks.find(t => t.id === item.task_id);
      if (!task) return;
      const teamId = task.team_id;
      const teamName = teamById[teamId]?.team_name || 'غير محدد';

      if (!map[teamId]) map[teamId] = { teamName, items: [] };
      map[teamId].items.push({ ...item, task });
    });

    return map;
  }, [completedItems, tasks, teamById]);

  const totalCompleted = completedItems.length;

  // Build report message
  const reportMessage = useMemo(() => {
    const periodLabels = { week: 'أسبوع', two_weeks: 'أسبوعين', month: 'شهر' };
    const today = format(new Date(), 'yyyy/MM/dd');

    let msg = `*تقرير مهام التركيب المكتملة خلال ${periodLabels[period]}*\n`;
    msg += `تاريخ التقرير: ${today}\n`;
    msg += `إجمالي اللوحات المركبة: ${totalCompleted}\n`;
    msg += `---------------\n\n`;

    if (totalCompleted === 0) {
      msg += `لا توجد مهام تركيب مكتملة خلال هذه الفترة`;
    } else {
      const teamEntries = Object.values(groupedByTeam);
      teamEntries.forEach((group, gi) => {
        msg += `*فريق: ${group.teamName}*\n`;
        msg += `عدد اللوحات: ${group.items.length}\n\n`;

        group.items.forEach((item, i) => {
          const bb = billboardById[item.billboard_id];
          const contract = contractById[item.task?.contract_id];
          const designs = designsByTask[item.task_id] || [];
          const designName = designs.map(d => d.design_name).join(', ') || 'غير محدد';
          const adType = bb?.Ad_Type || contract?.['Ad Type'] || 'غير محدد';
          const landmark = bb?.Nearest_Landmark || 'غير محدد';
          const district = bb?.District || 'غير محدد';
          const municipality = bb?.Municipality || 'غير محدد';

          msg += `${i + 1}. لوحة #${item.billboard_id}`;
          if (bb?.Billboard_Name) msg += ` - ${bb.Billboard_Name}`;
          msg += `\n`;
          msg += `   - نوع الدعاية: ${adType}\n`;
          msg += `   - التصميم: ${designName}\n`;
          msg += `   - أقرب نقطة دالة: ${landmark}\n`;
          msg += `   - المنطقة: ${district}\n`;
          msg += `   - البلدية: ${municipality}\n`;
          if (item.installation_date) msg += `   - تاريخ التركيب: ${item.installation_date}\n`;
          if (i < group.items.length - 1) msg += '\n';
        });

        if (gi < teamEntries.length - 1) msg += '\n---------------\n\n';
      });

      msg += `\n---------------\n`;
      msg += `*الإجمالي: ${totalCompleted} لوحة مركبة*`;
    }

    return msg;
  }, [completedItems, groupedByTeam, period, totalCompleted, billboardById, contractById, designsByTask]);

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
            إرسال تقرير مهام التركيب
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
              <div className="text-2xl font-bold text-primary">{totalCompleted}</div>
              <div className="text-xs text-muted-foreground mt-1">لوحة مركبة</div>
            </div>
            <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{Object.keys(groupedByTeam).length}</div>
              <div className="text-xs text-muted-foreground mt-1">فرق عمل</div>
            </div>
          </div>

          {/* Teams breakdown */}
          {totalCompleted > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">اللوحات المركبة حسب الفرق</span>
                <Badge variant="default">{totalCompleted} لوحة</Badge>
              </div>
              <ScrollArea className="max-h-44">
                <div className="space-y-2 text-xs">
                  {Object.values(groupedByTeam).map((group, gi) => (
                    <div key={gi} className="border-b border-border/30 pb-2 last:border-0">
                      <div className="font-semibold text-sm mb-1">{group.teamName} ({group.items.length} لوحة)</div>
                      {group.items.map((item, i) => {
                        const bb = billboardById[item.billboard_id];
                        return (
                          <div key={item.id} className="flex justify-between items-center py-0.5 pr-3">
                            <span>لوحة #{item.billboard_id} {bb?.Billboard_Name ? `- ${bb.Billboard_Name}` : ''}</span>
                            <span className="text-muted-foreground">{item.installation_date || ''}</span>
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
