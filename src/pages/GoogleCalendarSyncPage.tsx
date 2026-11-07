import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Calendar, 
  Mail, 
  Bell, 
  Clock, 
  DollarSign, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  ExternalLink, 
  Download, 
  RefreshCw, 
  Send, 
  Copy, 
  Trash2, 
  Plus, 
  Settings, 
  Search, 
  Code, 
  Check, 
  Sparkles,
  Link as LinkIcon,
  HelpCircle,
  ShieldCheck,
  X,
  Receipt,
  Image as ImageIcon,
  Wrench
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ImageViewer } from '@/components/shared/ImageViewer';
import { CustomerAlertsSyncDialog } from '@/components/customers/CustomerAlertsSyncDialog';
import { 
  getCalendarRetrySeconds,
  loadCalendarRecords,
  getCalendarConfig, 
  saveCalendarConfig, 
  extractCalendarEvents, 
  buildContractDesignsMap,
  formatAlertTimeArabic,
  syncEventsToGoogleCalendar,
  syncEventsAutoContinue,
  filterChangedCalendarEvents,
  resetCalendarSyncMemory,
  cleanOldGoogleCalendarEvents,
  sendTestGoogleCalendarAlert, 
  generateGoogleCalendarWebUrl, 
  downloadICalendarFile, 
  getAppsScriptSourceCode,
  getCalendarSyncLog,
  addCalendarSyncLog,
  clearCalendarSyncLog,
  type CalendarSyncLogEntry,
  type SyncResult,
  type GoogleCalendarConfig,
  type GoogleCalendarEvent
} from '@/services/googleCalendarService';

export default function GoogleCalendarSyncPage() {
  const [config, setConfig] = useState<GoogleCalendarConfig>({
    scriptUrl: '',
    emails: [],
    reminders: [1440, 4320],
    alertTime: '12:00',
    syncContracts: true,
    syncInstallments: true,
    syncContractStarts: true,
    syncInvoices: true,
    activeAndUpcomingOnly: true,
    autoSync: false,
    lastSync: null,
  });

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setRetrySeconds(getCalendarRetrySeconds(config.scriptUrl)), 1000);
    return () => window.clearInterval(timer);
  }, [config.scriptUrl]);
  const [cleaningOld, setCleaningOld] = useState(false);
  const [syncingSingleId, setSyncingSingleId] = useState<string | null>(null);
  const [testingAlert, setTestingAlert] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Email input state
  const [newEmail, setNewEmail] = useState('');

  // Events & Data state
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [contractsData, setContractsData] = useState<any[]>([]);
  const [paymentsData, setPaymentsData] = useState<any[]>([]);
  const [invoicesData, setInvoicesData] = useState<any[]>([]);
  const [installationsData, setInstallationsData] = useState<any[]>([]);
  const [customersData, setCustomersData] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters & Search (Defaulting to upcoming appointments only)
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'installment' | 'contract_end' | 'contract_start' | 'invoice'>('all');
  const [scopeFilter, setScopeFilter] = useState<'upcoming_only' | 'active_and_upcoming' | 'overdue' | 'all'>('active_and_upcoming');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  // فلتر الزبون: المفتاح = معرف الزبون أو name:<الاسم>
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [waitSeconds, setWaitSeconds] = useState(0);
  const stopSyncRef = useRef(false);
  const [customerDialog, setCustomerDialog] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [syncLog, setSyncLog] = useState<CalendarSyncLogEntry[]>(() => getCalendarSyncLog());
  useEffect(() => {
    const refresh = () => setSyncLog(getCalendarSyncLog());
    window.addEventListener('gcal-sync-log', refresh);
    return () => window.removeEventListener('gcal-sync-log', refresh);
  }, []);

  // Preview Design Dialog state
  const [previewDesign, setPreviewDesign] = useState<{ url: string; title: string; contractNumber?: number } | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; batch: number; totalBatches: number } | null>(null);
  const [resumeState, setResumeState] = useState<{
    events: GoogleCalendarEvent[];
    startIndex: number;
    totalSynced: number;
    totalTarget: number;
  } | null>(null);

  const [compositeDesignsMap, setCompositeDesignsMap] = useState<Map<number, string[]>>(new Map());

  // Load initial settings and events
  useEffect(() => {
    loadSettingsAndData();
  }, []);

  const loadSettingsAndData = async () => {
    try {
      setLoading(true);
      const loadedConfig = await getCalendarConfig();
      setConfig(loadedConfig);
      await fetchContractsAndComputeEvents(loadedConfig);
    } catch (err) {
      console.error('Error loading calendar data:', err);
      toast.error('حدث خطأ أثناء تحميل بيانات تقويم جوجل');
    } finally {
      setLoading(false);
    }
  };

  const fetchContractsAndComputeEvents = async (activeConfig: GoogleCalendarConfig) => {
    try {
      setLoadingEvents(true);
      setLoadError(null);
      const { contracts, payments, invoices, installations, customers, compositeTasks, taskDesigns, directInstallationTasks } = await loadCalendarRecords();

      const designsMap = buildContractDesignsMap(compositeTasks, taskDesigns, directInstallationTasks);
      setCompositeDesignsMap(designsMap);

      setContractsData(contracts);
      setPaymentsData(payments);
      setInvoicesData(invoices || []);
      setInstallationsData(installations || []);
      setCustomersData(customers || []);

      // Extract all calendar events into memory (allowing instant switching between active scope and archive)
      const computedEvents = extractCalendarEvents(
        contracts,
        payments,
        {
          ...activeConfig,
          activeAndUpcomingOnly: false,
        },
        invoices || [],
        installations || [],
        customers || [],
        designsMap
      );
      setEvents(computedEvents);
    } catch (err: any) {
      console.error('Error computing events:', err);
      setEvents([]);
      setContractsData([]);
      setPaymentsData([]);
      setInvoicesData([]);
      setInstallationsData([]);
      setLoadError(
        err?.message?.includes('column') || err?.message?.includes('does not exist')
          ? 'خطأ في حقول استعلام العقود. تم تحديث الحقول وتصحيحها.'
          : 'تعذّر تحميل العقود أو الدفعات أو الفواتير. يرجى التحقق من الاتصال وإعادة المحاولة.'
      );
    } finally {
      setLoadingEvents(false);
    }
  };

  // Add recipient email
  const handleAddEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;

    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      toast.error('يرجى إدخال عنوان بريد إلكتروني صحيح');
      return;
    }

    if (config.emails.includes(trimmed)) {
      toast.warning('هذا البريد مضاف بالفعل');
      return;
    }

    const updated = { ...config, emails: [...config.emails, trimmed] };
    setConfig(updated);
    setNewEmail('');
  };

  // Remove recipient email
  const handleRemoveEmail = (emailToRemove: string) => {
    const updated = {
      ...config,
      emails: config.emails.filter(e => e !== emailToRemove),
    };
    setConfig(updated);
  };

  // Toggle reminder timing (minutes)
  const toggleReminder = (minutes: number) => {
    const exists = config.reminders.includes(minutes);
    const updatedReminders = exists
      ? config.reminders.filter(m => m !== minutes)
      : [...config.reminders, minutes].sort((a, b) => b - a);
    setConfig({ ...config, reminders: updatedReminders });
  };

  // Save settings
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const success = await saveCalendarConfig(config);
      if (success) {
        toast.success('تم حفظ إعدادات تقويم جوجل والتنبيهات بنجاح');
        if (contractsData.length > 0 || invoicesData.length > 0) {
          const computedEvents = extractCalendarEvents(
            contractsData,
            paymentsData,
            {
              ...config,
              activeAndUpcomingOnly: false,
            },
            invoicesData,
            installationsData,
            customersData,
            compositeDesignsMap
          );
          setEvents(computedEvents);
        }
      } else {
        toast.error('فشل حفظ الإعدادات');
      }
    } catch (err: any) {
      toast.error('خطأ: ' + (err.message || 'فشل الحفظ'));
    } finally {
      setSavingSettings(false);
    }
  };

  // Test Alert
  const handleSendTestAlert = async () => {
    if (!config.scriptUrl) {
      toast.error('يرجى إدخال رابط Webhook الخاص بـ Google Apps Script أولاً');
      return;
    }
    if (config.emails.length === 0) {
      toast.error('يرجى إضافة إيميل واحد على الأقل لتلقي التنبيه التجريبي');
      return;
    }

    try {
      setTestingAlert(true);
      const res = await sendTestGoogleCalendarAlert(config);
      toast.success(res.message);
    } catch (err: any) {
      toast.error('فشل إرسال التنبيه التجريبي: ' + (err.message || 'تأكد من إعدادات السكريبت'));
    } finally {
      setTestingAlert(false);
    }
  };

  // Primary sync action: Upcoming only (or filtered month) + delete old & duplicates
  const handleSyncUpcoming = async (customStartIndex?: number) => {
    if (!config.scriptUrl) {
      toast.error('يرجى ربط رابط Google Apps Script Webhook في الإعدادات أولاً لإتمام المزامنة التلقائية');
      return;
    }

    // Determine upcoming events: if current filter is upcoming_only, use filteredEvents; otherwise filter directly to upcoming & month
    let eventsToSync = typeof customStartIndex === 'number' && resumeState ? resumeState.events : scopeFilter === 'upcoming_only'
      ? filteredEvents
      : events.filter(e => {
          const matchScope = e.isContractActive && !e.isOverdue;
          const matchMonth = monthFilter === 'all' || (e.startDate && e.startDate.startsWith(monthFilter));
          const matchCustomer = customerFilter === 'all' || customerKeyOf(e) === customerFilter;
          return matchScope && matchMonth && matchCustomer;
        });

    if (eventsToSync.length === 0) {
      toast.warning('لا توجد مواعيد قادمة للمزامنة في النطاق المحدد حالياً');
      return;
    }

    const startIndex = typeof customStartIndex === 'number' ? customStartIndex : 0;
    // مزامنة تزايدية: أرسل الجديد والمتغير فقط (الاستئناف يكمل نفس القائمة)
    if (startIndex === 0 && !(typeof customStartIndex === 'number' && resumeState)) {
      const changed = filterChangedCalendarEvents(config, eventsToSync);
      if (!changed.length) { toast.success('كل المواعيد محدّثة في تقويم Google — لا تغييرات منذ آخر مزامنة'); return; }
      if (changed.length < eventsToSync.length) toast.info(`سيتم إرسال ${changed.length} موعداً جديداً أو متغيراً فقط من أصل ${eventsToSync.length}`);
      eventsToSync = changed;
    }

    try {
      setSyncingAll(true);
      setSyncProgress({
        current: startIndex,
        total: eventsToSync.length,
        batch: Math.floor(startIndex / 5) + 1,
        totalBatches: Math.ceil(eventsToSync.length / 5),
      });

      stopSyncRef.current = false;
      const res = await syncEventsAutoContinue(
        config,
        eventsToSync,
        undefined,
        {
          cleanOld: false,
          batchSize: 5,
          delayMs: 3000,
          startIndex,
          onWait: setWaitSeconds,
          shouldStop: () => stopSyncRef.current,
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

      const failedList = res.failed || [];
      const sentCount = Math.max(0, (res.lastProcessedIndex ?? res.totalProcessed) - startIndex - failedList.length);
      addCalendarSyncLog({
        source: selectedCustomer ? `مزامنة الزبون ${selectedCustomer.name}` : 'مزامنة جماعية',
        ok: res.success && !failedList.length, sent: sentCount, total: eventsToSync.length - startIndex,
        error: res.error, failed: failedList,
      });
      if (failedList.length) {
        toast.error(`فشل إرسال ${failedList.length} موعد وتم تخطيها — راجع «سجل الإرسال والأخطاء». أول سبب: ${failedList[0].error}`, { duration: 12000 });
      }
      if (!res.success) {
        const nextIdx = res.lastProcessedIndex ?? startIndex;
        setResumeState({ events: eventsToSync, startIndex: nextIdx, totalSynced: nextIdx, totalTarget: eventsToSync.length });
        toast.warning(`توقف الإرسال عند ${nextIdx} من ${eventsToSync.length}. ${res.error || ''} اضغط «استئناف المزامنة» للمتابعة.`, { duration: 14000 });
      } else {
        setResumeState(null);
        const cleanMsg = res.deletedCount && res.deletedCount > 0 ? `، وحذف ${res.deletedCount} موعد قديم ومكرر من التقويم` : '';
        const monthLabel = monthFilter !== 'all' ? ` لشهر ${availableMonths.find(m => m.key === monthFilter)?.label || monthFilter}` : '';
        if (sentCount > 0) toast.success(`تمت مزامنة ${sentCount} موعد بنجاح مع تقويم Google${monthLabel}${cleanMsg}!`);
        setConfig(prev => ({ ...prev, lastSync: new Date().toISOString() }));
      }
    } finally {
      setSyncingAll(false);
      setSyncProgress(null);
      setWaitSeconds(0);
    }
  };

  // Resume paused sync from last processed index
  const handleResumeSync = () => {
    if (!resumeState) return;
    handleSyncUpcoming(resumeState.startIndex);
  };

  // Clean old & duplicate events from Google Calendar
  const handleCleanOldEvents = async () => {
    if (!config.scriptUrl) {
      toast.error('يرجى ربط رابط Google Apps Script Webhook في الإعدادات أولاً');
      return;
    }

    try {
      setCleaningOld(true);
      const res = await cleanOldGoogleCalendarEvents(config);
      resetCalendarSyncMemory(config); // بعد التنظيف تُعاد مزامنة كل المواعيد في المرة القادمة
      toast.success(res.message);
    } catch (err: any) {
      toast.error('فشل تنظيف التقويم: ' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setCleaningOld(false);
    }
  };

  // Sync a single event
  const handleSyncSingle = async (eventItem: GoogleCalendarEvent) => {
    if (!config.scriptUrl) {
      toast.error('يرجى إعداد رابط Webhook في تبويب الإعدادات أولاً');
      return;
    }

    try {
      setSyncingSingleId(eventItem.id);
      const res = await syncEventsToGoogleCalendar(config, [eventItem], undefined, { cleanOld: false });
      if (!res.success) throw new Error(res.error || 'توقفت المزامنة مؤقتًا');
      if (res.failed?.length) throw new Error(res.failed[0].error);
      addCalendarSyncLog({ source: `موعد: ${eventItem.title}`, ok: true, sent: 1, total: 1 });
      toast.success(`تمت مزامنة الموعد بنجاح في تقويم جوجل`);
    } catch (err: any) {
      addCalendarSyncLog({ source: `موعد: ${eventItem.title}`, ok: false, sent: 0, total: 1, error: err?.message, failed: [{ tag: eventItem.tag, title: eventItem.title, customerName: eventItem.customerName, error: err?.message || '' }] });
      toast.error('خطأ: ' + (err.message || 'فشلت المزامنة'));
    } finally {
      setSyncingSingleId(null);
    }
  };

  // One-click Google Calendar web link
  const handleOpenGoogleCalendarWeb = (eventItem: GoogleCalendarEvent) => {
    const url = generateGoogleCalendarWebUrl(
      {
        title: eventItem.title,
        description: eventItem.description,
        startDate: eventItem.startDate,
        endDate: eventItem.endDate,
        location: eventItem.location,
      },
      config.emails
    );
    window.open(url, '_blank');
  };

  // Download .ics for filtered events
  const handleDownloadICS = () => {
    if (filteredEvents.length === 0) {
      toast.warning('لا توجد مواعيد للتصدير حالياً');
      return;
    }
    downloadICalendarFile(filteredEvents, config.emails, config.reminders);
    toast.success(`تم تنزيل ملف التقويم (.ics) لـ ${filteredEvents.length} موعد ساري وقادم بنجاح`);
  };

  // Copy code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(getAppsScriptSourceCode());
    setCopiedCode(true);
    toast.success('تم نسخ كود سكريبت جوجل إلى الحافظة');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Available Months for Month-by-Month Filter & Sync
  const availableMonths = useMemo(() => {
    const monthMap = new Map<string, { key: string; label: string; count: number; upcomingCount: number }>();
    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    events.forEach(e => {
      if (!e.startDate) return;
      const ym = e.startDate.substring(0, 7);
      if (!ym || ym.length < 7) return;

      const [yearStr, monthStr] = ym.split('-');
      const mNum = parseInt(monthStr, 10);
      const mName = arabicMonths[mNum - 1] || monthStr;
      const label = `${mName} ${yearStr}`;

      const existing = monthMap.get(ym) || { key: ym, label, count: 0, upcomingCount: 0 };
      existing.count += 1;
      if (!e.isOverdue && e.isContractActive) {
        existing.upcomingCount += 1;
      }
      monthMap.set(ym, existing);
    });

    return Array.from(monthMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [events]);

  const customerKeyOf = (e: GoogleCalendarEvent) => (e.customerId ? String(e.customerId) : 'name:' + (e.customerName || '').trim());
  const customerOptions = useMemo(() => {
    const map = new Map<string, { key: string; name: string; email?: string; count: number }>();
    events.forEach(e => {
      if (!e.isContractActive) return;
      const key = customerKeyOf(e);
      const cur = map.get(key) || { key, name: e.customerName || 'بدون اسم', email: e.customerEmail, count: 0 };
      cur.count += 1;
      if (!cur.email && e.customerEmail) cur.email = e.customerEmail;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [events]);
  const selectedCustomer = customerOptions.find(c => c.key === customerFilter) || null;

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter(e => {
      // Search
      const matchSearch =
        !query ||
        e.customerName.toLowerCase().includes(query) ||
        (e.contractNumber ? String(e.contractNumber).includes(query) : false) ||
        (e.invoiceNumber ? String(e.invoiceNumber).includes(query) : false) ||
        (e.adType ? e.adType.toLowerCase().includes(query) : false) ||
        (e.firstInstallationDate ? e.firstInstallationDate.includes(query) : false) ||
        e.title.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query);

      // Type filter
      const matchType = typeFilter === 'all' || e.type === typeFilter;

      // Scope filter: focus strictly on active & upcoming by default
      let matchScope = true;
      if (scopeFilter === 'active_and_upcoming') {
        if (!e.isContractActive) {
          matchScope = false;
        } else if (e.type === 'contract_start') {
          matchScope = e.daysRemainingOrOverdue <= 0;
        } else if (e.type === 'contract_end') {
          matchScope = !e.isOverdue;
        } else {
          matchScope = true;
        }
      } else if (scopeFilter === 'upcoming_only') {
        matchScope = !e.isOverdue && e.isContractActive;
      } else if (scopeFilter === 'overdue') {
        matchScope = e.isOverdue && e.isContractActive;
      } else if (scopeFilter === 'all') {
        matchScope = true;
      }

      // Month filter
      const matchMonth = monthFilter === 'all' || (e.startDate && e.startDate.startsWith(monthFilter));

      const matchCustomer = customerFilter === 'all' || customerKeyOf(e) === customerFilter;

      return matchSearch && matchType && matchScope && matchMonth && matchCustomer;
    });
  }, [events, searchQuery, typeFilter, scopeFilter, monthFilter, customerFilter]);

  // Statistics
  const stats = useMemo(() => {
    const activeAndUpcoming = events.filter(e => {
      if (!e.isContractActive) return false;
      if (e.type === 'contract_start') return e.daysRemainingOrOverdue <= 0;
      if (e.type === 'contract_end') return !e.isOverdue;
      return true; // installment & invoice
    });
    const activeInstallments = events.filter(e => e.type === 'installment' && e.isContractActive);
    const activeInvoices = events.filter(e => e.type === 'invoice' && e.isContractActive);
    const activeContractEnds = events.filter(e => e.type === 'contract_end' && e.isContractActive && !e.isOverdue);
    const activeContractStarts = events.filter(e => e.type === 'contract_start' && e.isContractActive && e.daysRemainingOrOverdue <= 0);
    const activeOverdue = events.filter(e => e.isOverdue && e.isContractActive);
    const strictlyUpcoming = events.filter(e => !e.isOverdue && e.isContractActive);

    const installmentsDueAmount = activeInstallments.reduce((sum, e) => sum + (e.amount || 0), 0);
    const invoicesDueAmount = activeInvoices.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalDueAmount = installmentsDueAmount + invoicesDueAmount;

    return {
      activeTotal: activeAndUpcoming.length,
      allTotal: events.length,
      upcomingCount: strictlyUpcoming.length,
      installmentsCount: activeInstallments.length,
      invoicesCount: activeInvoices.length,
      contractEndsCount: activeContractEnds.length,
      contractStartsCount: activeContractStarts.length,
      overdueCount: activeOverdue.length,
      installmentsDueAmount,
      invoicesDueAmount,
      totalDueAmount,
      emailsCount: config.emails.length,
    };
  }, [events, config.emails]);

  return (
    <div dir="rtl" className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ربط تقويم جوجل وتنبيهات المواعيد</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                تنبيهات استحقاق الدفعات ومواعيد العقود السارية والقادمة عبر Google Calendar
              </p>
            </div>
          </div>
        </div>

        {/* Status Indicators & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {config.scriptUrl ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 py-1 px-2.5 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              الربط البرمجي نشط
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 py-1 px-2.5 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              بانتظار إدخال رابط Webhook
            </Badge>
          )}

          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 py-1 px-2.5 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            السارية والقادمة فقط
          </Badge>

          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 py-1 px-2.5 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            {config.emails.length} إيميل تنبيه
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSettingsAndData()}
            disabled={loadingEvents}
            className="cursor-pointer gap-1.5 transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 ${loadingEvents ? 'animate-spin' : ''}`} />
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active & Upcoming */}
        <Card className="border border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">المواعيد السارية والقادمة</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{stats.activeTotal}</div>
            <p className="text-xs text-muted-foreground mt-1">
              من أصل {stats.allTotal} موعد مسجل في النظام
            </p>
          </CardContent>
        </Card>

        {/* Active Installments & Due Amount */}
        <Card className="border border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">دفعات العقود المستحقة</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{stats.installmentsCount}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              إجمالي مستحق: {stats.installmentsDueAmount.toLocaleString()} د.ل
            </p>
          </CardContent>
        </Card>

        {/* Sales Invoices */}
        <Card className="border border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">فواتير المبيعات المستحقة</CardTitle>
            <Receipt className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{stats.invoicesCount}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              إجمالي مستحق: {stats.invoicesDueAmount.toLocaleString()} د.ل
            </p>
          </CardContent>
        </Card>

        {/* Total Due Amount */}
        <Card className="border border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المبالغ المستحقة للتحصيل</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-primary">
              {stats.totalDueAmount.toLocaleString()} <span className="text-xs font-normal">د.ل</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.overdueCount} موعد ومستحق يحتاج المتابعة
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="schedule" className="w-full space-y-4">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="schedule" className="cursor-pointer gap-2">
            <Calendar className="h-4 w-4" />
            جدول المواعيد والمزامنة
          </TabsTrigger>
          <TabsTrigger value="settings" className="cursor-pointer gap-2">
            <Settings className="h-4 w-4" />
            الإعدادات والإيميلات
          </TabsTrigger>
          <TabsTrigger value="guide" className="cursor-pointer gap-2">
            <Code className="h-4 w-4" />
            دليل وكود السكريبت
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SCHEDULE & SYNC */}
        <TabsContent value="schedule" className="space-y-4">
          {retrySeconds > 0 && !syncingAll && <div role="status" className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">المزامنة متوقفة مؤقتًا لتخفيف الطلبات. إعادة المحاولة متاحة بعد {retrySeconds} ثانية. هذا عداد تهدئة للتطبيق ولا يضمن انتهاء قيد Google.</div>}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    مواعيد الدفعات والعقود للتنبيه في تقويم جوجل
                  </CardTitle>
                  <CardDescription className="mt-1">
                    يمكنك مزامنة المواعيد دفعة واحدة إلى Google Calendar أو إضافة أي موعد بنقرة زر واحدة
                  </CardDescription>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => handleSyncUpcoming()}
                    disabled={retrySeconds > 0 || loading || loadingEvents || syncingAll || filteredEvents.length === 0}
                    className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
                    title={
                      monthFilter !== 'all'
                        ? `مزامنة مواعيد شهر ${availableMonths.find(m => m.key === monthFilter)?.label || monthFilter} فقط`
                        : "مزامنة المواعيد القادمة فقط مع حذف أي مواعيد قديمة ومكررة تلقائياً"
                    }
                  >
                    <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
                    {syncingAll && waitSeconds > 0
                      ? `انتظار قيد Google ${waitSeconds} ث ثم يكمل تلقائياً (${syncProgress?.current ?? 0}/${syncProgress?.total ?? 0})`
                      : syncProgress
                      ? `جاري المزامنة (${syncProgress.current}/${syncProgress.total} - دفعة ${syncProgress.batch} من ${syncProgress.totalBatches})...`
                      : monthFilter !== 'all'
                      ? `مزامنة شهر ${availableMonths.find(m => m.key === monthFilter)?.label || monthFilter} (${filteredEvents.length} موعد)`
                      : `مزامنة القادمة فقط (${stats.upcomingCount}) مع تقويم Google`}
                  </Button>

                  {syncingAll && (
                    <Button variant="destructive" size="sm" className="cursor-pointer" onClick={() => { stopSyncRef.current = true; }}>
                      إيقاف الإرسال
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={handleCleanOldEvents}
                    disabled={retrySeconds > 0 || loading || syncingAll || cleaningOld}
                    className="cursor-pointer gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                    title="حذف جميع مواعيد AdHub القديمة المنتهية والمكررة من تقويم Google"
                  >
                    <Trash2 className={`h-4 w-4 ${cleaningOld ? 'animate-spin' : ''}`} />
                    {cleaningOld ? 'جاري التنظيف...' : 'تنظيف وحذف المواعيد القديمة'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleDownloadICS}
                    disabled={filteredEvents.length === 0}
                    className="cursor-pointer gap-2 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    تحميل ملف تقويم (.ics)
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => window.open('https://calendar.google.com', '_blank')}
                    className="cursor-pointer gap-2 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    فتح Google Calendar
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Resume Synced Banner when paused by Google Rate Limits */}
              {resumeState && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        توقفت المزامنة مؤقتاً لحماية الحساب من كوتة Google
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        تمت مزامنة {resumeState.totalSynced} موعد بنجاح. المتبقي: {resumeState.totalTarget - resumeState.startIndex} موعد بدءاً من المواعيد التالية (الأشهر القادمة حتى 2027).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={handleResumeSync}
                      disabled={syncingAll || retrySeconds > 0}
                      className="cursor-pointer gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
                      استئناف المزامنة للمتبقي ({resumeState.totalTarget - resumeState.startIndex})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setResumeState(null)}
                      className="cursor-pointer h-7 text-xs text-muted-foreground"
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              )}
              {/* Filter & Search Bar */}
              <div className="flex flex-col gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/60">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث باسم العميل، رقم العقد، أو بيان الموعد..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pr-9"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute left-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Customer filter + send to customer */}
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="فلتر الزبون"
                      value={customerFilter}
                      onChange={e => setCustomerFilter(e.target.value)}
                      className="h-9 min-w-0 max-w-[220px] rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="all">كل الزبائن ({customerOptions.length})</option>
                      {customerOptions.map(c => (
                        <option key={c.key} value={c.key}>{c.name} ({c.count}){c.email ? '' : ' — بلا بريد'}</option>
                      ))}
                    </select>
                    {selectedCustomer && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer gap-1.5 shrink-0"
                        onClick={() => setCustomerDialog({ id: selectedCustomer.key, name: selectedCustomer.name, email: selectedCustomer.email })}
                        title="إرسال مواعيد هذا الزبون إلى تقويمه مع دعوة على بريده"
                      >
                        <Send className="h-3.5 w-3.5" />
                        إرسال للزبون
                      </Button>
                    )}
                  </div>

                  {/* Scope Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 border rounded-lg p-1 bg-background">
                    <Button
                      variant={scopeFilter === 'upcoming_only' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setScopeFilter('upcoming_only')}
                      className="cursor-pointer h-7 text-xs px-2.5 gap-1 text-emerald-600 dark:text-emerald-400"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      القادمة فقط ({stats.upcomingCount})
                    </Button>
                    <Button
                      variant={scopeFilter === 'active_and_upcoming' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setScopeFilter('active_and_upcoming')}
                      className="cursor-pointer h-7 text-xs px-2.5 gap-1"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      السارية والقادمة ({stats.activeTotal})
                    </Button>
                    <Button
                      variant={scopeFilter === 'overdue' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setScopeFilter('overdue')}
                      className="cursor-pointer h-7 text-xs px-2.5 text-amber-600 dark:text-amber-400"
                    >
                      المستحقة والمتأخرة ({stats.overdueCount})
                    </Button>
                    <Button
                      variant={scopeFilter === 'all' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setScopeFilter('all')}
                      className="cursor-pointer h-7 text-xs px-2.5 text-muted-foreground"
                    >
                      الأرشيف الشامل ({events.length})
                    </Button>
                  </div>
                </div>

                {/* Type Filter Pills & Quick Reset */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground ml-1">نوع الموعد:</span>
                    <Button
                      variant={typeFilter === 'all' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setTypeFilter('all')}
                      className="cursor-pointer h-6 text-xs px-2"
                    >
                      الكل ({events.length})
                    </Button>
                    <Button
                      variant={typeFilter === 'installment' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setTypeFilter('installment')}
                      className="cursor-pointer h-6 text-xs px-2 gap-1 text-emerald-600 dark:text-emerald-400"
                    >
                      <DollarSign className="h-3 w-3" />
                      استحقاق الدفعات ({stats.installmentsCount})
                    </Button>
                    <Button
                      variant={typeFilter === 'contract_end' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setTypeFilter('contract_end')}
                      className="cursor-pointer h-6 text-xs px-2 gap-1 text-amber-600 dark:text-amber-400"
                    >
                      <Clock className="h-3 w-3" />
                      انتهاء العقود ({stats.contractEndsCount})
                    </Button>
                    {config.syncContractStarts && (
                      <Button
                        variant={typeFilter === 'contract_start' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setTypeFilter('contract_start')}
                        className="cursor-pointer h-6 text-xs px-2 gap-1 text-blue-600 dark:text-blue-400"
                      >
                        <FileText className="h-3 w-3" />
                        بدء العقود ({stats.contractStartsCount})
                      </Button>
                    )}
                    {config.syncInvoices !== false && (
                      <Button
                        variant={typeFilter === 'invoice' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setTypeFilter('invoice')}
                        className="cursor-pointer h-6 text-xs px-2 gap-1 text-purple-600 dark:text-purple-400"
                      >
                        <Receipt className="h-3 w-3" />
                        فواتير المبيعات ({stats.invoicesCount})
                      </Button>
                    )}
                  </div>

                  {(searchQuery || typeFilter !== 'all' || scopeFilter !== 'active_and_upcoming' || monthFilter !== 'all' || customerFilter !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setTypeFilter('all');
                        setScopeFilter('active_and_upcoming');
                        setMonthFilter('all');
                        setCustomerFilter('all');
                      }}
                      className="cursor-pointer h-6 text-xs text-muted-foreground hover:text-foreground gap-1"
                    >
                      <X className="h-3 w-3" />
                      إعادة ضبط الفلاتر
                    </Button>
                  )}
                </div>

                {/* Month-by-Month Filter Row (Supports 2026 & 2027) */}
                {availableMonths.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                    <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5">
                      <span className="text-xs text-muted-foreground ml-1 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        فلترة حسب الشهر:
                      </span>
                      <Button
                        variant={monthFilter === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setMonthFilter('all')}
                        className="cursor-pointer h-6 text-xs px-2"
                      >
                        كل الأشهر ({events.length})
                      </Button>
                      {availableMonths.map(m => {
                        const is2027 = m.key.startsWith('2027');
                        const isSelected = monthFilter === m.key;
                        const countDisplay = scopeFilter === 'upcoming_only' ? m.upcomingCount : m.count;
                        return (
                          <Button
                            key={m.key}
                            variant={isSelected ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setMonthFilter(m.key)}
                            className={`cursor-pointer h-6 text-xs px-2 gap-1 transition-colors ${
                              isSelected
                                ? ''
                                : is2027
                                ? 'text-primary hover:bg-primary/10 border border-primary/20'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title={`مواعيد ${m.label} (${countDisplay} موعد)`}
                          >
                            {m.label}
                            <span className="text-[10px] opacity-80">({countDisplay})</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Events Table */}
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-right">نوع الموعد</TableHead>
                      <TableHead className="text-right">رقم السجل / العقد</TableHead>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">نوع الإعلان</TableHead>
                      <TableHead className="text-right">تاريخ الاستحقاق / الموعد</TableHead>
                      <TableHead className="text-right">المبلغ المستحق</TableHead>
                      <TableHead className="text-right">تاريخ التركيب الأول</TableHead>
                      <TableHead className="text-center">رابط التصميم</TableHead>
                      <TableHead className="text-right">الحالة والسريان</TableHead>
                      <TableHead className="text-center w-52">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading || loadingEvents ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                          جاري استخراج مواعيد العقود والدفعات السارية والقادمة...
                        </TableCell>
                      </TableRow>
                    ) : loadError ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-10">
                          <div role="alert" className="space-y-3 text-destructive">
                            <AlertCircle className="h-7 w-7 mx-auto" />
                            <p>{loadError}</p>
                            <Button variant="outline" onClick={loadSettingsAndData} className="cursor-pointer transition-all duration-200">إعادة المحاولة</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                          <Calendar className="h-9 w-9 mx-auto mb-3 text-primary/70" />
                          <p className="font-medium text-foreground">
                            {events.length > 0
                              ? 'لا توجد مواعيد تطابق الفلاتر المحددة حالياً'
                              : contractsData.length === 0
                              ? 'لا توجد عقود مسجلة في النظام لعرض مواعيدها'
                              : 'لا توجد مواعيد سارية أو قادمة قابلة للتنبيه'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">
                            {events.length > 0 && scopeFilter === 'active_and_upcoming'
                              ? 'قد تكون كافة المواعيد مسددة بالكامل أو عقودها منتهية تاريخياً. يمكنك مراجعة الأرشيف الشامل أو إعادة ضبط الفلاتر.'
                              : 'تُعرض الدفعات غير المسددة ومواعيد العقود والفواتير السارية والقادمة تلقائياً.'}
                          </p>
                          <div className="flex items-center justify-center gap-2 mt-4">
                            {events.length > 0 && scopeFilter === 'active_and_upcoming' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setScopeFilter('all')}
                                className="cursor-pointer text-xs transition-colors"
                              >
                                عرض الأرشيف الشامل (مع المنتهية)
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSearchQuery('');
                                setTypeFilter('all');
                                setScopeFilter('active_and_upcoming');
                              }}
                              className="cursor-pointer text-xs transition-colors"
                            >
                              إعادة ضبط الفلاتر
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEvents.map(event => (
                        <TableRow key={event.id} className="hover:bg-muted/30 transition-colors">
                          {/* Type */}
                          <TableCell>
                            {event.type === 'installment' ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 font-normal">
                                <DollarSign className="h-3 w-3" />
                                استحقاق دفعة
                              </Badge>
                            ) : event.type === 'contract_end' ? (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 font-normal">
                                <Clock className="h-3 w-3" />
                                انتهاء عقد
                              </Badge>
                            ) : event.type === 'contract_start' ? (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1 font-normal">
                                <FileText className="h-3 w-3" />
                                بدء عقد
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 gap-1 font-normal">
                                <Receipt className="h-3 w-3" />
                                فاتورة مبيعات
                              </Badge>
                            )}
                          </TableCell>

                          {/* Record / Contract # */}
                          <TableCell className="font-mono font-semibold">
                            {event.type === 'invoice' ? (
                              <span className="text-purple-600 dark:text-purple-400">فاتورة #{event.invoiceNumber}</span>
                            ) : (
                              <span>#{event.contractNumber}</span>
                            )}
                          </TableCell>

                          {/* Customer */}
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{event.customerName}</span>
                              {event.customerEmail ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5" dir="ltr">
                                  <Mail className="h-3 w-3 text-primary/70 shrink-0" />
                                  <span className="truncate max-w-[160px]" title={event.customerEmail}>{event.customerEmail}</span>
                                </span>
                              ) : null}
                            </div>
                          </TableCell>

                          {/* Ad Type */}
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{event.adType || 'غير محدد'}</span>
                          </TableCell>

                          {/* Date & Alert Time */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 font-mono text-sm font-medium">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                {event.startDate}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock className="h-3 w-3 text-primary/70" />
                                <span>{formatAlertTimeArabic(event.alertTime || config.alertTime || '12:00')}</span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Amount */}
                          <TableCell>
                            {event.amount && event.amount > 0 ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground font-mono">
                                  {event.amount.toLocaleString()} د.ل
                                </span>
                                {event.totalAmount ? (
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    من إجمالي {event.totalAmount.toLocaleString()} د.ل
                                  </span>
                                ) : event.type !== 'installment' ? (
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    متبقي بذمة العقد
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-normal gap-1">
                                <Check className="h-3 w-3" />
                                مسدد بالكامل
                              </Badge>
                            )}
                          </TableCell>

                          {/* First Installation Date */}
                          <TableCell>
                            {event.firstInstallationDate ? (
                              <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                                <Wrench className="h-3.5 w-3.5 text-amber-500/80" />
                                <span>{event.firstInstallationDate}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          {/* Design Link & Direct Preview */}
                          <TableCell className="text-center">
                            {event.designUrl ? (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPreviewDesign({
                                    url: event.designUrl!,
                                    title: `تصميم ${event.type === 'invoice' ? `فاتورة #${event.invoiceNumber}` : `عقد #${event.contractNumber}`} - ${event.customerName}`
                                  })}
                                  className="relative group w-10 h-10 rounded-lg border-2 border-primary/20 overflow-hidden bg-muted/40 flex items-center justify-center cursor-pointer hover:border-primary hover:shadow-sm transition-all shrink-0"
                                  title="معاينة صورة التصميم المباشرة"
                                >
                                  <img
                                    src={event.designUrl}
                                    alt="التصميم المعتمد"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                  <ImageIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </button>
                                <a
                                  href={event.designUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                                  title="فتح رابط التصميم المباشر"
                                >
                                  <span>عرض</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">لا يوجد تصميم</span>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <div className="flex flex-col gap-1 items-start">
                              {event.isOverdue ? (
                                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs font-normal">
                                  {event.statusText}
                                </Badge>
                              ) : event.daysRemainingOrOverdue === 0 ? (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs font-normal">
                                  {event.statusText}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-normal">
                                  {event.statusText}
                                </Badge>
                              )}

                              {event.type === 'invoice' ? (
                                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px] font-normal">
                                  {event.isContractActive ? 'فاتورة مستحقة' : 'مسددة'}
                                </Badge>
                              ) : event.isContractActive ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-normal gap-1">
                                  <ShieldCheck className="h-2.5 w-2.5" />
                                  عقد ساري
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] font-normal">
                                  منتهي تاريخياً
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell>
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1-Click Add to Google Calendar Web Link */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenGoogleCalendarWeb(event)}
                                className="cursor-pointer h-8 text-xs gap-1 border-primary/30 hover:border-primary text-primary hover:bg-primary/10 transition-colors"
                                title="إضافة الموعد مباشرة لتقويم Google مع إشعار الإيميلات"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                إضافة لتقويم Google
                              </Button>

                              {/* Sync via Webhook */}
                              {config.scriptUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSyncSingle(event)}
                                  disabled={retrySeconds > 0 || syncingAll || syncingSingleId !== null}
                                  className="cursor-pointer h-8 px-2 text-xs hover:bg-muted"
                                  title="مزامنة فورية عبر سكريبت جوجل"
                                >
                                  <RefreshCw className={`h-3.5 w-3.5 ${syncingSingleId === event.id ? 'animate-spin text-primary' : ''}`} />
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

              {/* Footer info */}
              <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground pt-2 gap-2">
                <div>
                  {loading || loadingEvents
                    ? 'جاري تحميل البيانات...'
                    : loadError
                    ? 'البيانات غير متاحة'
                    : `عرض ${filteredEvents.length} من أصل ${stats.activeTotal} موعد ساري وقادم (إجمالي المسجل: ${events.length}) · ${contractsData.length} عقد · ${invoicesData.length} فاتورة`}
                </div>
                {config.lastSync && (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    آخر مزامنة ناجحة: {new Date(config.lastSync).toLocaleString('ar-LY')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* سجل الإرسال والأخطاء */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  سجل الإرسال والأخطاء
                  {syncLog.some(l => !l.ok) && <Badge variant="destructive">{syncLog.filter(l => !l.ok).length} فشل</Badge>}
                </CardTitle>
                {syncLog.length > 0 && (
                  <Button variant="ghost" size="sm" className="cursor-pointer h-7 text-xs" onClick={clearCalendarSyncLog}>مسح السجل</Button>
                )}
              </div>
              <CardDescription>آخر عمليات الإرسال على هذا الجهاز. المواعيد الفاشلة لا تُعلَّم كمُرسلة، فتُعاد تلقائيًا في المزامنة القادمة.</CardDescription>
            </CardHeader>
            <CardContent>
              {syncLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد عمليات إرسال مسجلة بعد.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {syncLog.map((l, i) => (
                    <div key={i} className={`rounded-lg border p-2.5 text-sm ${l.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/40 bg-destructive/5'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold flex items-center gap-1.5">
                          {l.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                          {l.source}
                        </span>
                        <span className="text-xs text-muted-foreground">{new Date(l.at).toLocaleString('ar-LY')} · أُرسل {Math.max(0, l.sent)} من {l.total}</span>
                      </div>
                      {l.error && <p className="mt-1 text-xs text-destructive break-words">{l.error}</p>}
                      {!!l.failed?.length && (
                        <ul className="mt-1.5 space-y-1 text-xs">
                          {l.failed.map((f, j) => (
                            <li key={j} className="break-words"><span className="font-medium">{f.title}</span>{f.customerName ? ` — ${f.customerName}` : ''}: <span className="text-muted-foreground">{f.error}</span></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: SETTINGS & EMAILS */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Emails & Alerts Box */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  إيميلات استلام التنبيهات والدعوات
                </CardTitle>
                <CardDescription>
                  أضف إيميل واحد أو أكثر من إيميل لإرسال إشعارات Google Calendar ودعوات المواعيد إليهم تلقائياً
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Email Input */}
                <div className="space-y-2">
                  <Label>إضافة بريد إلكتروني جديد</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="finance@company.com"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmail();
                        }
                      }}
                      className="font-mono"
                    />
                    <Button onClick={handleAddEmail} className="cursor-pointer gap-1.5 shrink-0">
                      <Plus className="h-4 w-4" />
                      إضافة
                    </Button>
                  </div>
                </div>

                {/* Connected Emails List */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs text-muted-foreground">الإيميلات المربوطة حالياً ({config.emails.length})</Label>
                  {config.emails.length === 0 ? (
                    <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
                      لم يتم إضافة أي إيميل حتى الآن. يرجى إضافة إيميل لتصلك التنبيهات.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {config.emails.map(email => (
                        <Badge
                          key={email}
                          variant="secondary"
                          className="pl-2 pr-3 py-1.5 text-sm font-mono flex items-center gap-2 border"
                        >
                          <Mail className="h-3.5 w-3.5 text-primary" />
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEmail(email)}
                            className="cursor-pointer text-muted-foreground hover:text-destructive transition-colors ml-1"
                            title="حذف هذا الإيميل"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reminder Timing Checkboxes */}
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-sm font-bold flex items-center gap-1.5">
                    <Bell className="h-4 w-4 text-primary" />
                    مواعيد إرسال التنبيه قبل الحدث
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { minutes: 10080, label: 'قبل أسبوع (7 أيام)' },
                      { minutes: 4320, label: 'قبل 3 أيام' },
                      { minutes: 1440, label: 'قبل يوم واحد (24 ساعة)' },
                      { minutes: 0, label: 'في نفس يوم الموعد' },
                    ].map(item => (
                      <div
                        key={item.minutes}
                        onClick={() => toggleReminder(item.minutes)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          config.reminders.includes(item.minutes)
                            ? 'bg-primary/10 border-primary/40 text-foreground'
                            : 'bg-muted/20 hover:bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        <Checkbox checked={config.reminders.includes(item.minutes)} />
                        <span className="text-xs font-medium">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alert Hour Selector */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      ساعة التنبيه اليومي في تقويم Google
                    </Label>
                    <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/20">
                      {formatAlertTimeArabic(config.alertTime || '12:00')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    التوقيت الافتراضي هو الساعة 12:00 ظهراً / مساءً. يتم جدولة المواعيد وإرسال التنبيهات للهاتف والإيميل في هذا الوقت المحدد.
                  </p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <Input
                      type="time"
                      value={config.alertTime || '12:00'}
                      onChange={e => setConfig({ ...config, alertTime: e.target.value || '12:00' })}
                      className="font-mono w-40 text-sm"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { time: '12:00', label: '12:00 ظهراً (الافتراضي)' },
                        { time: '09:00', label: '09:00 صباحاً' },
                        { time: '10:00', label: '10:00 صباحاً' },
                        { time: '14:00', label: '02:00 مساءً' },
                        { time: '17:00', label: '05:00 مساءً' },
                      ].map(preset => (
                        <Button
                          key={preset.time}
                          type="button"
                          variant={(config.alertTime || '12:00') === preset.time ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setConfig({ ...config, alertTime: preset.time })}
                          className="cursor-pointer h-8 text-xs px-2.5"
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Test Alert Button */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={handleSendTestAlert}
                    disabled={testingAlert || config.emails.length === 0}
                    className="w-full cursor-pointer gap-2 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Send className={`h-4 w-4 ${testingAlert ? 'animate-spin' : ''}`} />
                    إرسال حدث تجريبي واختبار التنبيه للإيميلات الآن
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Google Apps Script & Sync Settings Box */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-primary" />
                  رابط Webhook وخيارات المزامنة
                </CardTitle>
                <CardDescription>
                  رابط تطبيق الويب الخاص بـ Google Apps Script الذي يقوم بإنشاء وتحديث الأحداث في تقويم جوجل
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Script URL Input */}
                <div className="space-y-2">
                  <Label htmlFor="scriptUrl">رابط Google Apps Script Web App URL</Label>
                  <Input
                    id="scriptUrl"
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    value={config.scriptUrl}
                    onChange={e => setConfig({ ...config, scriptUrl: e.target.value.trim() })}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    يمكنك الحصول على الرابط عبر نشر الكود الموضح في تبويب "دليل وكود السكريبت".
                  </p>
                </div>

                {/* Sync Event Types */}
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 border-primary/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm cursor-pointer font-semibold flex items-center gap-1.5" htmlFor="activeAndUpcomingOnly">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        حصر المزامنة في المواعيد السارية والقادمة فقط
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        تجاهل العقود المنتهية تاريخياً لتفادي ملء تقويم Google بمواعيد وأحداث قديمة
                      </p>
                    </div>
                    <Switch
                      id="activeAndUpcomingOnly"
                      checked={config.activeAndUpcomingOnly !== false}
                      onCheckedChange={checked => setConfig({ ...config, activeAndUpcomingOnly: checked })}
                    />
                  </div>

                  <Label className="text-sm font-bold pt-1">أنواع المواعيد المراد مزامنتها</Label>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm cursor-pointer" htmlFor="syncInstallments">
                        مواعيد استحقاق دفعات العقود
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        إنشاء تنبيهات وتذكيرات لمواعيد الأقساط غير المسددة
                      </p>
                    </div>
                    <Switch
                      id="syncInstallments"
                      checked={config.syncInstallments}
                      onCheckedChange={checked => setConfig({ ...config, syncInstallments: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm cursor-pointer" htmlFor="syncContracts">
                        مواعيد انتهاء العقود الإعلانية
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        إنشاء تنبيهات لمواعيد نهاية العقود لمتابعة التجديد أو الإزالة
                      </p>
                    </div>
                    <Switch
                      id="syncContracts"
                      checked={config.syncContracts}
                      onCheckedChange={checked => setConfig({ ...config, syncContracts: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm cursor-pointer" htmlFor="syncContractStarts">
                        مواعيد بدء سريان العقود
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        إنشاء تنبيهات لمواعيد بدء العقود ومتابعة التركيب
                      </p>
                    </div>
                    <Switch
                      id="syncContractStarts"
                      checked={config.syncContractStarts}
                      onCheckedChange={checked => setConfig({ ...config, syncContractStarts: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm cursor-pointer" htmlFor="syncInvoices">
                        مواعيد استحقاق فواتير المبيعات
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        إنشاء تنبيهات لمواعيد فواتير المبيعات غير المسددة أو المتأخرة
                      </p>
                    </div>
                    <Switch
                      id="syncInvoices"
                      checked={config.syncInvoices !== false}
                      onCheckedChange={checked => setConfig({ ...config, syncInvoices: checked })}
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="w-full cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Check className={`h-4 w-4 ${savingSettings ? 'animate-spin' : ''}`} />
                    حفظ كافة الإعدادات
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: GUIDE & CODE */}
        <TabsContent value="guide" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Code className="h-5 w-5 text-primary" />
                    دليل ربط Google Apps Script لتقويم Google
                  </CardTitle>
                  <CardDescription className="mt-1">
                    خطوات سريعة لنشر سكريبت مجاني وآمن يربط نظام AdHub بحسابك في Google Calendar
                  </CardDescription>
                </div>
                <Button
                  onClick={handleCopyCode}
                  variant="outline"
                  className="cursor-pointer gap-2 border-primary/30 text-primary"
                >
                  {copiedCode ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  {copiedCode ? 'تم نسخ الكود!' : 'نسخ كود السكريبت'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Steps */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border bg-card space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-xs">1</span>
                    فتح سكريبت جوجل
                  </div>
                  <p className="text-xs text-muted-foreground">
                    توجه إلى موقع{' '}
                    <a
                      href="https://script.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline font-medium"
                    >
                      script.google.com
                    </a>{' '}
                    واضغط على زر <strong>"مشروع جديد" (New project)</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-xl border bg-card space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-xs">2</span>
                    لصق الكود
                  </div>
                  <p className="text-xs text-muted-foreground">
                    امسح أي كود موجود في الملف الافتراضي <code>Code.gs</code> ثم الصق الكود الموضح بالأسفل كاملاً.
                  </p>
                </div>

                <div className="p-4 rounded-xl border bg-card space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-xs">3</span>
                    نشر كتطبيق ويب
                  </div>
                  <p className="text-xs text-muted-foreground">
                    اضغط <strong>Deploy</strong> ثم <strong>New deployment</strong>، اختر <strong>Web app</strong>، واجعل Execute as: <strong>Me</strong>، و Who has access: <strong>Anyone</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-xl border bg-card space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-xs">4</span>
                    نسخ الرابط
                  </div>
                  <p className="text-xs text-muted-foreground">
                    انسخ رابط تطبيق الويب (Web App URL) والصقه في خانة رابط Webhook بتبويب "الإعدادات والإيميلات" واضغط حفظ.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <h3 className="font-bold flex items-center gap-2"><ImageIcon className="h-5 w-5 text-primary" />تنبيهات بريد تحتوي صورة التصميم</h3>
                <p className="text-sm leading-7">يرسل السكريبت رسالة منفصلة لكل مستلم، تحتوي صورة التصميم داخل البريد وبيانات العميل والموعد والمبلغ. تبقى مواعيد Google Calendar وتنبيهاته الحالية مفعّلة.</p>
                <ol className="list-decimal list-inside text-sm space-y-2 leading-7">
                  <li>انسخ الكود الكامل أدناه إلى مشروع Google Apps Script واحفظه.</li>
                  <li>لإرسال دعوات الزبون للمواعيد التي زومنت سابقًا: فعّل Google Calendar API في مشروع Google Cloud المرتبط بالسكربت، ثم انشر إصدارًا جديدًا وأعد المزامنة من نافذة الزبون.</li>
                  <li>اضبط المنطقة الزمنية للمشروع والتقويم على <code dir="ltr">Africa/Tripoli</code>.</li>
                  <li>من قائمة الدوال اختر <code dir="ltr">enableDesignEmailReminders</code> واضغط «تشغيل» مرة واحدة، ثم وافق على صلاحيات البريد والتقويم وجلب الصور.</li>
                  <li>انشر نسخة جديدة من تطبيق الويب، ثم أعد مزامنة المواعيد المطلوبة من هذه الصفحة لتسجيل بيانات صورها.</li>
                </ol>
                <p className="text-xs text-muted-foreground leading-6">تُفحص المواعيد كل خمس دقائق وفق أوقات التذكير المختارة، وقد يتأخر التنفيذ بحسب Google. لا تُرسل تذكيرات سبق وقتها أول مزامنة. عند غياب الصورة أو تعذّر تحميلها تُرسل بيانات الموعد مع توضيح ذلك. للإيقاف شغّل <code dir="ltr">disableDesignEmailReminders</code>. يجب إعادة المزامنة عند تعديل المبلغ أو التصميم؛ وتُلغى التنبيهات الخاصة بموعد عند حذفه من التقويم.</p>
                <p className="text-xs text-muted-foreground">الرسائل تخضع لحصة إرسال حساب Google. تظهر أخطاء الإرسال في «عمليات التنفيذ» داخل Apps Script؛ ولا يُعاد إرسال محاولة غير مؤكدة تلقائيًا لتجنب التكرار.</p>
              </div>

              {/* Code Viewer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>ملف الكود: GoogleCalendarSync.gs</span>
                  <button
                    onClick={handleCopyCode}
                    className="cursor-pointer text-primary hover:underline flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    نسخ كامل الكود
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-muted/60 text-foreground font-mono text-xs overflow-x-auto border max-h-96">
                  {getAppsScriptSourceCode()}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {customerDialog && (
        <CustomerAlertsSyncDialog
          open={!!customerDialog}
          onOpenChange={open => { if (!open) setCustomerDialog(null); }}
          customerId={customerDialog.id}
          customerName={customerDialog.name}
          initialEmail={customerDialog.email}
        />
      )}

      {/* Design Preview Dialog */}
      {previewDesign && <ImageViewer images={[{ src: previewDesign.url }]} onClose={() => setPreviewDesign(null)} title="" />}
    </div>
  );
}
