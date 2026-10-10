import { useState, useEffect, useMemo } from 'react';
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
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  getCalendarConfig, 
  saveCalendarConfig, 
  extractCalendarEvents, 
  syncEventsToGoogleCalendar, 
  sendTestGoogleCalendarAlert, 
  generateGoogleCalendarWebUrl, 
  downloadICalendarFile, 
  getAppsScriptSourceCode,
  type GoogleCalendarConfig,
  type GoogleCalendarEvent
} from '@/services/googleCalendarService';

export default function GoogleCalendarSyncPage() {
  const [config, setConfig] = useState<GoogleCalendarConfig>({
    scriptUrl: '',
    emails: [],
    reminders: [1440, 4320],
    syncContracts: true,
    syncInstallments: true,
    syncContractStarts: false,
    autoSync: false,
    lastSync: null,
  });

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingSingleId, setSyncingSingleId] = useState<string | null>(null);
  const [testingAlert, setTestingAlert] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Email input state
  const [newEmail, setNewEmail] = useState('');

  // Events & Data state
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [contractsData, setContractsData] = useState<any[]>([]);
  const [paymentsData, setPaymentsData] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'installment' | 'contract_end' | 'contract_start'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'upcoming'>('all');

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

      const [contractsRes, paymentsRes] = await Promise.all([
        supabase
          .from('Contract')
          .select('Contract_Number, "Customer Name", customer_id, installments_data, Total, "Ad Type", "Start Date", "End Date", "Contract Date"'),
        supabase
          .from('customer_payments')
          .select('contract_number, customer_id, customer_name, amount, paid_at, entry_type')
          .in('entry_type', ['payment', 'receipt', 'account_payment']),
      ]);

      if (contractsRes.error) {
        console.error('Error fetching contracts:', contractsRes.error);
        return;
      }

      const contracts = contractsRes.data || [];
      const payments = paymentsRes.data || [];

      setContractsData(contracts);
      setPaymentsData(payments);

      const computedEvents = extractCalendarEvents(contracts, payments, activeConfig);
      setEvents(computedEvents);
    } catch (err) {
      console.error('Error computing events:', err);
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
        // Recompute events in case toggles changed
        if (contractsData.length > 0) {
          const computedEvents = extractCalendarEvents(contractsData, paymentsData, config);
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

  // Bulk sync all filtered/selected events
  const handleSyncAll = async () => {
    if (!config.scriptUrl) {
      toast.error('يرجى ربط رابط Google Apps Script Webhook في الإعدادات أولاً لإتمام المزامنة التلقائية');
      return;
    }

    if (events.length === 0) {
      toast.warning('لا توجد مواعيد للمزامنة حالياً');
      return;
    }

    try {
      setSyncingAll(true);
      const res = await syncEventsToGoogleCalendar(config, events);
      toast.success(`تمت المزامنة بنجاح! تم إنشاء ${res.createdCount} حدث جديد وتحديث ${res.updatedCount} حدث.`);
      setConfig(prev => ({ ...prev, lastSync: new Date().toISOString() }));
    } catch (err: any) {
      toast.error('فشل المزامنة مع تقويم جوجل: ' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setSyncingAll(false);
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
      const res = await syncEventsToGoogleCalendar(config, [eventItem]);
      toast.success(`تمت مزامنة الموعد بنجاح في تقويم جوجل`);
    } catch (err: any) {
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

  // Download .ics
  const handleDownloadICS = () => {
    if (events.length === 0) {
      toast.warning('لا توجد مواعيد للتصدير');
      return;
    }
    downloadICalendarFile(events, config.emails, config.reminders);
    toast.success('تم تنزيل ملف التقويم (.ics) بنجاح');
  };

  // Copy code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(getAppsScriptSourceCode());
    setCopiedCode(true);
    toast.success('تم نسخ كود سكريبت جوجل إلى الحافظة');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter(e => {
      // Search
      const matchSearch =
        !query ||
        e.customerName.toLowerCase().includes(query) ||
        String(e.contractNumber).includes(query) ||
        e.title.toLowerCase().includes(query);

      // Type filter
      const matchType = typeFilter === 'all' || e.type === typeFilter;

      // Status filter
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'overdue' && e.isOverdue) ||
        (statusFilter === 'upcoming' && !e.isOverdue);

      return matchSearch && matchType && matchStatus;
    });
  }, [events, searchQuery, typeFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const installmentEvents = events.filter(e => e.type === 'installment');
    const contractEndEvents = events.filter(e => e.type === 'contract_end');
    const overdueEvents = events.filter(e => e.isOverdue);
    const totalDueAmount = installmentEvents.reduce((sum, e) => sum + (e.amount || 0), 0);

    return {
      total: events.length,
      installmentsCount: installmentEvents.length,
      contractEndsCount: contractEndEvents.length,
      overdueCount: overdueEvents.length,
      totalDueAmount,
      emailsCount: config.emails.length,
    };
  }, [events, config.emails]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
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
                تنبيهات استحقاق الدفعات ومواعيد العقود لإيميل معين أو عدة إيميلات عبر Google Calendar
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

          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 py-1 px-2.5 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            {config.emails.length} إيميل تنبيه
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSettingsAndData()}
            disabled={loadingEvents}
            className="cursor-pointer gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loadingEvents ? 'animate-spin' : ''}`} />
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Events */}
        <Card className="border border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المواعيد المستخرجة</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              مواعيد العقود والدفعات القابلة للتنبيه
            </p>
          </CardContent>
        </Card>

        {/* Installments & Due Amount */}
        <Card className="border border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">دفعات العقود المستحقة</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.installmentsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              إجمالي مبالغ: {stats.totalDueAmount.toLocaleString()} د.ل
            </p>
          </CardContent>
        </Card>

        {/* Contract Expirations */}
        <Card className="border border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">مواعيد انتهاء العقود</CardTitle>
            <FileText className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.contractEndsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              عقود تتطلب المتابعة والتجديد
            </p>
          </CardContent>
        </Card>

        {/* Notification Emails */}
        <Card className="border border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">إيميلات التنبيه المسجلة</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.emailsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              تستقبل إشعارات ودعوات التقويم مباشرة
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
                    onClick={handleSyncAll}
                    disabled={syncingAll || events.length === 0}
                    className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
                    مزامنة الكل مع تقويم Google
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleDownloadICS}
                    disabled={events.length === 0}
                    className="cursor-pointer gap-2"
                  >
                    <Download className="h-4 w-4" />
                    تحميل ملف تقويم (.ics)
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => window.open('https://calendar.google.com', '_blank')}
                    className="cursor-pointer gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    فتح Google Calendar
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-muted/30 p-3 rounded-lg border">
                <div className="relative w-full md:w-80">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث باسم العميل أو رقم العقد..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pr-9"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {/* Type Filter Pills */}
                  <div className="flex items-center gap-1 border rounded-lg p-1 bg-background">
                    <Button
                      variant={typeFilter === 'all' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setTypeFilter('all')}
                      className="cursor-pointer h-7 text-xs px-2.5"
                    >
                      الكل ({events.length})
                    </Button>
                    <Button
                      variant={typeFilter === 'installment' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setTypeFilter('installment')}
                      className="cursor-pointer h-7 text-xs px-2.5"
                    >
                      الدفعات ({stats.installmentsCount})
                    </Button>
                    <Button
                      variant={typeFilter === 'contract_end' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setTypeFilter('contract_end')}
                      className="cursor-pointer h-7 text-xs px-2.5"
                    >
                      انتهاء العقود ({stats.contractEndsCount})
                    </Button>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1 border rounded-lg p-1 bg-background">
                    <Button
                      variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setStatusFilter('all')}
                      className="cursor-pointer h-7 text-xs px-2.5"
                    >
                      جميع الحالات
                    </Button>
                    <Button
                      variant={statusFilter === 'overdue' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setStatusFilter('overdue')}
                      className="cursor-pointer h-7 text-xs px-2.5 text-amber-600"
                    >
                      المتأخرة ({stats.overdueCount})
                    </Button>
                    <Button
                      variant={statusFilter === 'upcoming' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setStatusFilter('upcoming')}
                      className="cursor-pointer h-7 text-xs px-2.5 text-emerald-600"
                    >
                      القادمة ({events.length - stats.overdueCount})
                    </Button>
                  </div>
                </div>
              </div>

              {/* Events Table */}
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-right">نوع الموعد</TableHead>
                      <TableHead className="text-right">رقم العقد</TableHead>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                      <TableHead className="text-right">المبلغ المستحق</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-center w-52">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingEvents ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                          جاري استخراج مواعيد العقود والدفعات...
                        </TableCell>
                      </TableRow>
                    ) : filteredEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          لا توجد مواعيد تطابق الفلاتر المحددة
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEvents.map(event => (
                        <TableRow key={event.id} className="hover:bg-muted/30">
                          {/* Type */}
                          <TableCell>
                            {event.type === 'installment' ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
                                <DollarSign className="h-3 w-3" />
                                استحقاق دفعة
                              </Badge>
                            ) : event.type === 'contract_end' ? (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1">
                                <Clock className="h-3 w-3" />
                                انتهاء عقد
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
                                <FileText className="h-3 w-3" />
                                بدء عقد
                              </Badge>
                            )}
                          </TableCell>

                          {/* Contract # */}
                          <TableCell className="font-semibold">
                            #{event.contractNumber}
                          </TableCell>

                          {/* Customer */}
                          <TableCell>
                            <span className="font-medium text-foreground">{event.customerName}</span>
                          </TableCell>

                          {/* Date */}
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-mono text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {event.startDate}
                            </div>
                          </TableCell>

                          {/* Amount */}
                          <TableCell>
                            {event.amount ? (
                              <span className="font-bold text-foreground">
                                {event.amount.toLocaleString()} د.ل
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            {event.isOverdue ? (
                              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                                {event.statusText}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                                {event.statusText}
                              </Badge>
                            )}
                          </TableCell>

                          {/* Actions */}
                          <TableCell>
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1-Click Add to Google Calendar Web Link */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenGoogleCalendarWeb(event)}
                                className="cursor-pointer h-8 text-xs gap-1 border-primary/30 hover:border-primary text-primary"
                                title="إضافة الموعد مباشرة لتقويم جوجل مع إشعار الإيميلات"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                إضافة لتقويم جوجل
                              </Button>

                              {/* Sync via Webhook */}
                              {config.scriptUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSyncSingle(event)}
                                  disabled={syncingSingleId === event.id}
                                  className="cursor-pointer h-8 px-2 text-xs"
                                  title="مزامنة عبر سكريبت جوجل"
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
                  عرض {filteredEvents.length} من أصل {events.length} موعد
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
                  <Label className="text-sm font-bold">أنواع المواعيد المراد مزامنتها</Label>

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
    </div>
  );
}
