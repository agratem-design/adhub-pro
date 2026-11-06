import React, { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { ImageViewer } from '@/components/shared/ImageViewer';
import {
  Calendar,
  Bell,
  Mail,
  Check,
  Send,
  RefreshCw,
  ExternalLink,
  Download,
  AlertCircle,
  Clock,
  DollarSign,
  FileText,
  Receipt,
  ShieldCheck,
  Wrench,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import {
  GoogleCalendarConfig,
  GoogleCalendarEvent,
  getCalendarConfig,
  extractCalendarEvents,
  buildContractDesignsMap,
  formatAlertTimeArabic,
  generateGoogleCalendarWebUrl,
  syncEventsToGoogleCalendar,
  cleanOldGoogleCalendarEvents,
  downloadICalendarFile,
  updateCustomerAlertEmail,
  addCalendarSyncLog,
} from '@/services/googleCalendarService';

interface CustomerAlertsSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  initialEmail?: string | null;
  onEmailUpdated?: (newEmail: string) => void;
}

export function CustomerAlertsSyncDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  initialEmail,
  onEmailUpdated,
}: CustomerAlertsSyncDialogProps) {
  const [email, setEmail] = useState<string>(initialEmail || '');
  const [savingEmail, setSavingEmail] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [config, setConfig] = useState<GoogleCalendarConfig | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [syncingSingleId, setSyncingSingleId] = useState<string | null>(null);
  const [cleaningOld, setCleaningOld] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; batch: number; totalBatches: number } | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'upcoming_only' | 'active_and_upcoming' | 'overdue' | 'all'>('upcoming_only');
  const [previewDesign, setPreviewDesign] = useState<{ url: string; title: string } | null>(null);

  // Sync initial email when prop changes or dialog opens
  useEffect(() => {
    if (open) {
      setEmail(initialEmail || '');
      if (initialEmail) {
        setEmail(initialEmail);
      } else if (customerId && !customerId.startsWith('name:')) {
        // Fetch fresh email from customers table
        supabase
          .from('customers')
          .select('email')
          .eq('id', customerId)
          .single()
          .then(({ data }) => {
            if (data?.email) {
              setEmail(data.email);
            }
          });
      }
      loadCustomerCalendarData();
    }
  }, [open, customerId, initialEmail]);

  // Load calendar config & customer specific events
  const loadCustomerCalendarData = async () => {
    try {
      setLoadingEvents(true);
      const calendarConfig = await getCalendarConfig();
      setConfig(calendarConfig);

      // 1. Fetch customer's contracts
      let contractsQuery = supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, installments_data, Total, "Ad Type", "End Date", "Contract Date", design_data, billboard_ids');

      if (customerId && !customerId.startsWith('name:')) {
        contractsQuery = contractsQuery.eq('customer_id', customerId);
      } else if (customerName) {
        contractsQuery = contractsQuery.eq('Customer Name', customerName);
      }

      const { data: contractsData, error: contractsError } = await contractsQuery;
      if (contractsError) {
        throw contractsError;
      }

      // If queried by ID and returned 0, fallback to query by customer name
      let finalContracts = contractsData || [];
      if (finalContracts.length === 0 && customerName && customerId) {
        const { data: fallbackContracts } = await supabase
          .from('Contract')
          .select('Contract_Number, "Customer Name", customer_id, installments_data, Total, "Ad Type", "End Date", "Contract Date", design_data, billboard_ids')
          .eq('Customer Name', customerName);
        if (fallbackContracts && fallbackContracts.length > 0) {
          finalContracts = fallbackContracts;
        }
      }

      // 2. Fetch customer's payments
      let paymentsQuery = supabase
        .from('customer_payments')
        .select('contract_number, customer_id, customer_name, amount, paid_at, entry_type')
        .in('entry_type', ['payment', 'receipt', 'account_payment']);

      if (customerId && !customerId.startsWith('name:')) {
        paymentsQuery = paymentsQuery.eq('customer_id', customerId);
      } else if (customerName) {
        paymentsQuery = paymentsQuery.eq('customer_name', customerName);
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;
      if (paymentsError) throw paymentsError;

      // 3. Fetch customer's sales invoices
      let invoicesQuery = supabase
        .from('sales_invoices')
        .select('id, invoice_number, invoice_date, customer_id, customer_name, total_amount, paid_amount, remaining_amount, paid, notes');

      if (customerId && !customerId.startsWith('name:')) {
        invoicesQuery = invoicesQuery.eq('customer_id', customerId);
      } else if (customerName) {
        invoicesQuery = invoicesQuery.eq('customer_name', customerName);
      }

      const { data: invoicesData } = await invoicesQuery;

      // 4. Fetch installation dates, composite tasks, and designs for these contracts
      const contractIds = finalContracts.map(c => Number(c.Contract_Number)).filter(Boolean);
      let installationsData: any[] = [];
      let compositeTasksData: any[] = [];
      let taskDesignsData: any[] = [];
      let directInstallationTasksData: any[] = [];

      if (contractIds.length > 0) {
        const { data: instData } = await supabase
          .from('installation_team_accounts')
          .select('contract_id, installation_date')
          .in('contract_id', contractIds);
        installationsData = instData || [];

        try {
          const { data: compData } = await supabase
            .from('composite_tasks')
            .select('id, contract_id, installation_task_id')
            .in('contract_id', contractIds);
          compositeTasksData = compData || [];
        } catch (e) {
          console.warn('Could not read composite_tasks for customer:', e);
        }

        try {
          const { data: directData } = await supabase
            .from('installation_tasks')
            .select('id, contract_id')
            .in('contract_id', contractIds);
          directInstallationTasksData = directData || [];
        } catch (e) {
          console.warn('Could not read installation_tasks for customer:', e);
        }

        const allTaskIds = Array.from(new Set([
          ...compositeTasksData.map(c => c.installation_task_id).filter(Boolean),
          ...directInstallationTasksData.map(t => t.id).filter(Boolean),
        ]));

        if (allTaskIds.length > 0) {
          try {
            const { data: tdData } = await supabase
              .from('task_designs')
              .select('task_id, design_face_a_url, design_face_b_url, cutout_image_url')
              .in('task_id', allTaskIds);
            taskDesignsData = tdData || [];
          } catch (e) {
            console.warn('Could not read task_designs for customer:', e);
          }
        }
      }

      const customerDesignsMap = buildContractDesignsMap(
        compositeTasksData,
        taskDesignsData,
        directInstallationTasksData
      );

      // 5. Extract events for this customer
      const customerRecord = [{ id: customerId, name: customerName, email: email.trim() }];
      const extracted = extractCalendarEvents(
        finalContracts,
        paymentsData || [],
        {
          ...calendarConfig,
          activeAndUpcomingOnly: false, // load all to let user view both
        },
        invoicesData || [],
        installationsData,
        customerRecord,
        customerDesignsMap
      );

      // Force attach current email to events
      const updatedEvents = extracted.map(ev => ({
        ...ev,
        customerEmail: email.trim() || ev.customerEmail,
      }));

      setEvents(updatedEvents);
    } catch (err: any) {
      console.error('Failed to load customer calendar data:', err);
      setEvents([]);
      toast.error('تعذر تحميل مواعيد العميل: ' + (err instanceof Error ? err.message : String((err as any)?.message || err)));
    } finally {
      setLoadingEvents(false);
    }
  };

  // Save customer email
  const handleSaveEmail = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail && (!cleanEmail.includes('@') || !cleanEmail.includes('.'))) {
      toast.error('يرجى إدخال عنوان بريد إلكتروني صحيح للعميل');
      return;
    }

    if (!customerId || customerId.startsWith('name:')) {
      toast.warning('تعذّر العثور على معرّف العميل المسجل في قاعدة البيانات');
      return;
    }

    try {
      setSavingEmail(true);
      await updateCustomerAlertEmail(customerId, cleanEmail);
      toast.success('تم حفظ وتحديث إيميل تنبيهات العميل بنجاح');
      if (onEmailUpdated) {
        onEmailUpdated(cleanEmail);
      }
      // Update local events with new email
      setEvents(prev => prev.map(e => ({ ...e, customerEmail: cleanEmail })));
    } catch (err: any) {
      toast.error('فشل حفظ البريد الإلكتروني: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setSavingEmail(false);
    }
  };

  // 1-Click Google Calendar for a single event
  const handleOpenGoogleCalendarWeb = (eventItem: GoogleCalendarEvent) => {
    const cleanEmail = email.trim();
    const guestEmails = cleanEmail && cleanEmail.includes('@') ? [cleanEmail] : [];
    if (config?.emails) {
      guestEmails.push(...config.emails);
    }
    const url = generateGoogleCalendarWebUrl(eventItem, guestEmails);
    window.open(url, '_blank');
  };

  // Upcoming events for customer
  const upcomingEvents = useMemo(() => {
    return events.filter(e => e.isContractActive && !e.isOverdue);
  }, [events]);

  // Filtered events based on scopeFilter
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (scopeFilter === 'upcoming_only') {
        return e.isContractActive && !e.isOverdue;
      }
      if (scopeFilter === 'active_and_upcoming') {
        return e.isContractActive;
      }
      if (scopeFilter === 'overdue') {
        return e.isOverdue;
      }
      return true;
    });
  }, [events, scopeFilter]);

  // Bulk sync customer upcoming events via webhook (Upcoming Only + Clean Old & Duplicates)
  const handleSyncCustomerUpcomingEvents = async () => {
    if (!config?.scriptUrl) {
      toast.error('يرجى ربط رابط Google Apps Script Webhook في صفحة تقويم جوجل الرئيسية أولاً');
      return;
    }

    const eventsToSync = scopeFilter === 'upcoming_only'
      ? filteredEvents
      : events.filter(e => e.isContractActive && !e.isOverdue);

    if (eventsToSync.length === 0) {
      toast.warning('لا توجد مواعيد قادمة لهذا العميل للمزامنة');
      return;
    }

    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { toast.error('أدخل بريد الزبون الصحيح قبل إرسال مواعيده'); return; }
    const targetEmails = [cleanEmail];

    try {
      setSyncingAll(true);
      setSyncProgress({
        current: 0,
        total: eventsToSync.length,
        batch: 1,
        totalBatches: Math.ceil(eventsToSync.length / 15),
      });

      const res = await syncEventsToGoogleCalendar(
        config,
        eventsToSync.map(event => ({ ...event, customerEmail: cleanEmail })),
        targetEmails,
        {
          cleanOld: false,
          sendInvites: true,
          onProgress: (p) => {
            setSyncProgress({
              current: p.processed,
              total: p.total,
              batch: p.currentBatch,
              totalBatches: p.totalBatches,
            });
          },
        }
      );

      if (!res.success) throw new Error(`تمت معالجة ${res.totalProcessed || 0} من ${eventsToSync.length} موعد. ${res.error || 'توقفت المزامنة'}`);
      const failedList = res.failed || [];
      addCalendarSyncLog({ source: `إرسال للزبون ${customerName}`, ok: !failedList.length, sent: eventsToSync.length - failedList.length, total: eventsToSync.length, failed: failedList });
      if (failedList.length) {
        toast.error(`فشل إرسال ${failedList.length} موعد للزبون. السبب: ${failedList[0].error}`, { duration: 12000 });
        return;
      }
      const cleanMsg = res.deletedCount && res.deletedCount > 0 ? `، وحذف ${res.deletedCount} موعد قديم ومكرر` : '';
      toast.success(`تمت مزامنة ${eventsToSync.length} موعد قادم للعميل بنجاح مع تقويم Google${cleanMsg}!`);
    } catch (err: any) {
      addCalendarSyncLog({ source: `إرسال للزبون ${customerName}`, ok: false, sent: err?.syncResult?.totalProcessed || 0, total: eventsToSync.length, error: err?.message, failed: err?.syncResult?.failed });
      toast.error('فشل المزامنة مع تقويم جوجل: ' + (err.message || 'خطأ غير متوقع'), {
        duration: 9000,
      });
    } finally {
      setSyncingAll(false);
      setSyncProgress(null);
    }
  };

  // Clean old events from Google Calendar
  const handleCleanCustomerOldEvents = async () => {
    if (!config?.scriptUrl) {
      toast.error('يرجى ربط رابط Google Apps Script Webhook في صفحة تقويم جوجل أولاً');
      return;
    }

    try {
      setCleaningOld(true);
      const res = await cleanOldGoogleCalendarEvents(config);
      toast.success(res.message);
    } catch (err: any) {
      toast.error('فشل تنظيف التقويم: ' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setCleaningOld(false);
    }
  };

  // Sync single event via webhook
  const handleSyncSingleEvent = async (eventItem: GoogleCalendarEvent) => {
    if (!config?.scriptUrl) {
      toast.error('يرجى ضبط رابط Webhook في صفحة تقويم جوجل أولاً');
      return;
    }

    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { toast.error('أدخل بريد الزبون الصحيح قبل إرسال مواعيده'); return; }
    const targetEmails = [cleanEmail];

    try {
      setSyncingSingleId(eventItem.id);
      const result = await syncEventsToGoogleCalendar(config, [{ ...eventItem, customerEmail: cleanEmail }], targetEmails, { cleanOld: false, sendInvites: true });
      if (!result.success) throw new Error(result.error || 'توقفت المزامنة مؤقتًا');
      if (result.failed?.length) throw new Error(result.failed[0].error);
      toast.success(`تمت مزامنة الموعد بنجاح في تقويم Google`);
    } catch (err: any) {
      toast.error('فشلت المزامنة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setSyncingSingleId(null);
    }
  };

  // Download .ics for this customer
  const handleDownloadCustomerICS = () => {
    if (events.length === 0) {
      toast.warning('لا توجد مواعيد لهذا العميل للتصدير');
      return;
    }
    const cleanEmail = email.trim();
    const emailsList = cleanEmail && cleanEmail.includes('@') ? [cleanEmail] : [];
    downloadICalendarFile(
      events,
      emailsList,
      config?.reminders || [1440, 4320],
      `adhub-calendar-${customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_')}.ics`
    );
    toast.success('تم تنزيل ملف التقويم (.ics) الخاص بالعميل بنجاح');
  };

  // Statistics
  const stats = useMemo(() => {
    const activeEvents = events.filter(e => e.isContractActive);
    const installments = events.filter(e => e.type === 'installment' && e.isContractActive);
    const invoices = events.filter(e => e.type === 'invoice' && e.isContractActive);
    const totalDue = installments.reduce((sum, e) => sum + (e.amount || 0), 0) +
                     invoices.reduce((sum, e) => sum + (e.amount || 0), 0);
    const overdueCount = events.filter(e => e.isOverdue && e.isContractActive).length;

    return {
      totalEvents: events.length,
      upcomingCount: upcomingEvents.length,
      activeEventsCount: activeEvents.length,
      installmentsCount: installments.length,
      invoicesCount: invoices.length,
      totalDue,
      overdueCount,
    };
  }, [events, upcomingEvents]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <span>تنبيهات ومزامنة تقويم الزبون:</span>
                  <span className="text-primary">{customerName}</span>
                </DialogTitle>
                <DialogDescription className="mt-1">
                  ربط بريد العميل وإرسال دعوات وإشعارات Google Calendar لمواعيد العقود والدفعات والفواتير
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* 1. Customer Alert Email Card */}
            <Card className="border border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <Label htmlFor="customer-alert-email" className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Mail className="h-4 w-4 text-primary" />
                    البريد الإلكتروني للعميل لاستلام تنبيهات ودعوات التقويم
                  </Label>
                  {email ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs gap-1 self-start sm:self-auto font-mono">
                      <Check className="h-3 w-3" />
                      البريد مسجل
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs gap-1 self-start sm:self-auto">
                      <AlertCircle className="h-3 w-3" />
                      بانتظار إدخال البريد
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="customer-alert-email"
                      type="email"
                      placeholder="client@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="pr-9 font-mono bg-background"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveEmail();
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={handleSaveEmail}
                    disabled={savingEmail || !customerId || customerId.startsWith('name:')}
                    className="cursor-pointer gap-1.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Check className={`h-4 w-4 ${savingEmail ? 'animate-spin' : ''}`} />
                    حفظ البريد في حساب العميل
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  المزامنة ترسل دعوة إلى بريد الزبون عبر السكربت المحدّث. أما «إضافة لتقويم Google» فتفتح نموذج الموعد ويجب حفظه وإرسال الدعوة. قد يحتاج الزبون إلى قبول الدعوة لظهورها في تقويمه.
                </p>
              </CardContent>
            </Card>

            {/* 2. Customer KPIs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl border bg-card space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  المواعيد السارية
                </div>
                <div className="text-xl font-bold font-mono">{stats.activeEventsCount}</div>
                <div className="text-[11px] text-muted-foreground">من أصل {stats.totalEvents} مسجل</div>
              </div>

              <div className="p-3 rounded-xl border bg-card space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  دفعات العقود
                </div>
                <div className="text-xl font-bold font-mono">{stats.installmentsCount}</div>
                <div className="text-[11px] text-muted-foreground">أقساط بانتظار السداد</div>
              </div>

              <div className="p-3 rounded-xl border bg-card space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Receipt className="h-3.5 w-3.5 text-purple-500" />
                  فواتير المبيعات
                </div>
                <div className="text-xl font-bold font-mono">{stats.invoicesCount}</div>
                <div className="text-[11px] text-muted-foreground">فواتير مستحقة</div>
              </div>

              <div className="p-3 rounded-xl border bg-card space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  إجمالي المستحق
                </div>
                <div className="text-xl font-bold font-mono text-primary">
                  {stats.totalDue.toLocaleString()} <span className="text-xs font-normal">د.ل</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {stats.overdueCount > 0 ? `${stats.overdueCount} متأخرة` : 'لا توجد متأخرات'}
                </div>
              </div>
            </div>

            {/* 3. Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border bg-muted/20">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleSyncCustomerUpcomingEvents}
                  disabled={syncingAll || stats.upcomingCount === 0}
                  className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8"
                  title="مزامنة المواعيد القادمة فقط للعميل مع حذف أي مواعيد قديمة ومكررة تلقائياً"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
                  {syncProgress
                    ? `جاري المزامنة (${syncProgress.current}/${syncProgress.total} - دفعة ${syncProgress.batch} من ${syncProgress.totalBatches})...`
                    : `مزامنة القادمة فقط (${stats.upcomingCount}) مع تقويم Google`}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCleanCustomerOldEvents}
                  disabled={syncingAll || cleaningOld}
                  className="cursor-pointer gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 text-xs h-8"
                  title="تنظيف وحذف جميع مواعيد AdHub القديمة المنتهية والمكررة من تقويم Google"
                >
                  <Trash2 className={`h-3.5 w-3.5 ${cleaningOld ? 'animate-spin' : ''}`} />
                  {cleaningOld ? 'جاري التنظيف...' : 'تنظيف وحذف المواعيد القديمة'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCustomerICS}
                  disabled={events.length === 0}
                  className="cursor-pointer gap-1.5 text-xs h-8"
                  title="تنزيل ملف تقويم (.ics) خاص بمواعيد هذا العميل"
                >
                  <Download className="h-3.5 w-3.5" />
                  تحميل ملف تقويم (.ics)
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={loadCustomerCalendarData}
                disabled={loadingEvents}
                className="cursor-pointer gap-1 text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingEvents ? 'animate-spin' : ''}`} />
                تحديث
              </Button>
            </div>

            {/* Scope Filter Pills (Same as Main Calendar Page) */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted/40 border w-fit">
              <button
                type="button"
                onClick={() => setScopeFilter('upcoming_only')}
                className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  scopeFilter === 'upcoming_only'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                القادمة فقط ({stats.upcomingCount})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('active_and_upcoming')}
                className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  scopeFilter === 'active_and_upcoming'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                السارية والقادمة ({stats.activeEventsCount})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('overdue')}
                className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  scopeFilter === 'overdue'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                المتأخرات ({stats.overdueCount})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  scopeFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                جميع المواعيد ({stats.totalEvents})
              </button>
            </div>

            {/* 4. Customer Events Table */}
            <div className="border rounded-xl overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead className="text-right">نوع الموعد</TableHead>
                    <TableHead className="text-right">رقم السجل</TableHead>
                    <TableHead className="text-right">نوع الإعلان</TableHead>
                    <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                    <TableHead className="text-right">المبلغ المستحق</TableHead>
                    <TableHead className="text-right">تاريخ التركيب الأول</TableHead>
                    <TableHead className="text-center">التصميم</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEvents ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        جاري جلب واستخراج مواعيد العميل...
                      </TableCell>
                    </TableRow>
                  ) : filteredEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">
                        <Calendar className="h-7 w-7 mx-auto mb-2 text-muted-foreground/60" />
                        لا توجد مواعيد تطابق الفلتر المحدد لهذا العميل حالياً
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEvents.map(event => (
                      <TableRow key={event.id} className="hover:bg-muted/30 text-xs">
                        {/* Type */}
                        <TableCell>
                          {event.type === 'installment' ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px] gap-1 font-normal">
                              <DollarSign className="h-2.5 w-2.5" />
                              استحقاق دفعة
                            </Badge>
                          ) : event.type === 'contract_end' ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[11px] gap-1 font-normal">
                              <Clock className="h-2.5 w-2.5" />
                              انتهاء عقد
                            </Badge>
                          ) : event.type === 'contract_start' ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[11px] gap-1 font-normal">
                              <FileText className="h-2.5 w-2.5" />
                              بدء عقد
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[11px] gap-1 font-normal">
                              <Receipt className="h-2.5 w-2.5" />
                              فاتورة مبيعات
                            </Badge>
                          )}
                        </TableCell>

                        {/* Record # */}
                        <TableCell className="font-mono font-semibold">
                          {event.type === 'invoice' ? `فاتورة #${event.invoiceNumber}` : `#${event.contractNumber}`}
                        </TableCell>

                        {/* Ad Type */}
                        <TableCell>
                          <span className="text-muted-foreground">{event.adType || 'غير محدد'}</span>
                        </TableCell>

                        {/* Date & Alert Time */}
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 font-mono">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {event.startDate}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5 text-primary/70" />
                              <span>{formatAlertTimeArabic(event.alertTime || config?.alertTime || '12:00')}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Amount */}
                        <TableCell>
                          {event.amount && event.amount > 0 ? (
                            <span className="font-bold font-mono text-foreground">
                              {event.amount.toLocaleString()} د.ل
                            </span>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-normal gap-1">
                              <Check className="h-2.5 w-2.5" />
                              مسدد
                            </Badge>
                          )}
                        </TableCell>

                        {/* First Installation Date */}
                        <TableCell>
                          {event.firstInstallationDate ? (
                            <div className="flex items-center gap-1 font-mono text-muted-foreground text-[11px]">
                              <Wrench className="h-2.5 w-2.5 text-amber-500" />
                              <span>{event.firstInstallationDate}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Design thumbnail */}
                        <TableCell className="text-center">
                          {event.designUrl ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPreviewDesign({
                                  url: event.designUrl!,
                                  title: `تصميم ${event.type === 'invoice' ? `فاتورة #${event.invoiceNumber}` : `عقد #${event.contractNumber}`} - ${customerName}`
                                })}
                                className="w-8 h-8 rounded-lg border-2 border-primary/20 overflow-hidden bg-muted/40 inline-flex items-center justify-center cursor-pointer hover:border-primary hover:shadow-sm transition-all"
                                title="معاينة التصميم المباشرة"
                              >
                                <img
                                  src={event.designUrl}
                                  alt="تصميم"
                                  className="w-full h-full object-cover"
                                  onError={e => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                              <a
                                href={event.designUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-primary hover:underline"
                                title="عرض الرابط المباشر"
                              >
                                عرض
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">لا يوجد</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-normal ${
                              event.isOverdue
                                ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                : event.daysRemainingOrOverdue === 0
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            }`}
                          >
                            {event.statusText}
                          </Badge>
                        </TableCell>

                        {/* Actions */}
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenGoogleCalendarWeb(event)}
                              className="cursor-pointer h-7 text-[11px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                              title="إضافة الموعد لتقويم Google مع دعوة إيميل العميل"
                            >
                              <ExternalLink className="h-3 w-3" />
                              إضافة لتقويم Google
                            </Button>

                            {config?.scriptUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncSingleEvent(event)}
                                disabled={syncingSingleId === event.id}
                                className="cursor-pointer h-7 px-1.5 hover:bg-muted"
                                title="مزامنة فورية عبر سكريبت جوجل"
                              >
                                <RefreshCw className={`h-3 w-3 ${syncingSingleId === event.id ? 'animate-spin text-primary' : ''}`} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      {previewDesign && <ImageViewer images={[{ src: previewDesign.url }]} onClose={() => setPreviewDesign(null)} title="" />}
    </>
  );
}
