import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GoogleCalendarConfig {
  scriptUrl: string;
  emails: string[];
  reminders: number[]; // In minutes, e.g. [1440, 4320] for 1 day, 3 days
  syncContracts: boolean;
  syncInstallments: boolean;
  syncContractStarts: boolean;
  autoSync: boolean;
  lastSync: string | null;
}

export interface GoogleCalendarEvent {
  id: string;
  tag: string;
  type: 'installment' | 'contract_end' | 'contract_start';
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD
  allDay: boolean;
  location?: string;
  contractNumber: number;
  customerName: string;
  customerId?: string | null;
  amount?: number;
  daysRemainingOrOverdue: number; // Positive = overdue, Negative = days remaining
  isOverdue: boolean;
  statusText: string;
}

export interface SyncResult {
  success: boolean;
  createdCount: number;
  updatedCount: number;
  totalProcessed: number;
  error?: string;
}

const DEFAULT_CONFIG: GoogleCalendarConfig = {
  scriptUrl: '',
  emails: [],
  reminders: [1440, 4320], // 1 day and 3 days before
  syncContracts: true,
  syncInstallments: true,
  syncContractStarts: false,
  autoSync: false,
  lastSync: null,
};

const SETTINGS_KEYS = {
  SCRIPT_URL: 'google_calendar_script_url',
  EMAILS: 'google_calendar_emails',
  REMINDERS: 'google_calendar_reminders',
  SYNC_CONTRACTS: 'google_calendar_sync_contracts',
  SYNC_INSTALLMENTS: 'google_calendar_sync_installments',
  SYNC_STARTS: 'google_calendar_sync_starts',
  AUTO_SYNC: 'google_calendar_auto_sync',
  LAST_SYNC: 'google_calendar_last_sync',
};

/**
 * Load Google Calendar configuration from database (system_settings) or localStorage fallback
 */
export async function getCalendarConfig(): Promise<GoogleCalendarConfig> {
  const config: GoogleCalendarConfig = { ...DEFAULT_CONFIG };

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', Object.values(SETTINGS_KEYS));

    if (!error && data && data.length > 0) {
      const map = new Map<string, string>();
      data.forEach(row => {
        if (row.setting_key && row.setting_value !== null) {
          map.set(row.setting_key, row.setting_value);
        }
      });

      if (map.has(SETTINGS_KEYS.SCRIPT_URL)) {
        config.scriptUrl = map.get(SETTINGS_KEYS.SCRIPT_URL) || '';
      }
      if (map.has(SETTINGS_KEYS.EMAILS)) {
        const rawEmails = map.get(SETTINGS_KEYS.EMAILS) || '';
        try {
          config.emails = JSON.parse(rawEmails);
        } catch {
          config.emails = rawEmails.split(',').map(e => e.trim()).filter(Boolean);
        }
      }
      if (map.has(SETTINGS_KEYS.REMINDERS)) {
        try {
          config.reminders = JSON.parse(map.get(SETTINGS_KEYS.REMINDERS) || '[1440, 4320]');
        } catch {
          config.reminders = [1440, 4320];
        }
      }
      if (map.has(SETTINGS_KEYS.SYNC_CONTRACTS)) {
        config.syncContracts = map.get(SETTINGS_KEYS.SYNC_CONTRACTS) === 'true';
      }
      if (map.has(SETTINGS_KEYS.SYNC_INSTALLMENTS)) {
        config.syncInstallments = map.get(SETTINGS_KEYS.SYNC_INSTALLMENTS) !== 'false';
      }
      if (map.has(SETTINGS_KEYS.SYNC_STARTS)) {
        config.syncContractStarts = map.get(SETTINGS_KEYS.SYNC_STARTS) === 'true';
      }
      if (map.has(SETTINGS_KEYS.AUTO_SYNC)) {
        config.autoSync = map.get(SETTINGS_KEYS.AUTO_SYNC) === 'true';
      }
      if (map.has(SETTINGS_KEYS.LAST_SYNC)) {
        config.lastSync = map.get(SETTINGS_KEYS.LAST_SYNC) || null;
      }

      return config;
    }
  } catch (err) {
    console.warn('Failed to load Google Calendar settings from database, checking localStorage:', err);
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('adhub_google_calendar_config');
      if (local) {
        return { ...config, ...JSON.parse(local) };
      }
    } catch {}
  }

  return config;
}

/**
 * Save Google Calendar configuration to database and localStorage
 */
export async function saveCalendarConfig(config: GoogleCalendarConfig): Promise<boolean> {
  const rows = [
    { setting_key: SETTINGS_KEYS.SCRIPT_URL, setting_value: config.scriptUrl },
    { setting_key: SETTINGS_KEYS.EMAILS, setting_value: JSON.stringify(config.emails) },
    { setting_key: SETTINGS_KEYS.REMINDERS, setting_value: JSON.stringify(config.reminders) },
    { setting_key: SETTINGS_KEYS.SYNC_CONTRACTS, setting_value: config.syncContracts ? 'true' : 'false' },
    { setting_key: SETTINGS_KEYS.SYNC_INSTALLMENTS, setting_value: config.syncInstallments ? 'true' : 'false' },
    { setting_key: SETTINGS_KEYS.SYNC_STARTS, setting_value: config.syncContractStarts ? 'true' : 'false' },
    { setting_key: SETTINGS_KEYS.AUTO_SYNC, setting_value: config.autoSync ? 'true' : 'false' },
    { setting_key: SETTINGS_KEYS.LAST_SYNC, setting_value: config.lastSync || '' },
  ];

  if (typeof window !== 'undefined') {
    localStorage.setItem('adhub_google_calendar_config', JSON.stringify(config));
  }

  try {
    for (const row of rows) {
      await supabase
        .from('system_settings')
        .upsert(row, { onConflict: 'setting_key' });
    }
    return true;
  } catch (err) {
    console.error('Error saving Google Calendar settings to database:', err);
    return false;
  }
}

/**
 * Extract calendar events from contracts and payment records
 */
export function extractCalendarEvents(
  contracts: any[],
  payments: any[],
  config: Partial<GoogleCalendarConfig> = {}
): GoogleCalendarEvent[] {
  const events: GoogleCalendarEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group payments by contract number
  const paymentsByContract = new Map<number, number>();
  payments.forEach((p: any) => {
    const amt = Number(p.amount) || 0;
    if (amt <= 0 || !p.contract_number) return;
    const cNum = Number(p.contract_number);
    if (!isNaN(cNum)) {
      paymentsByContract.set(cNum, (paymentsByContract.get(cNum) || 0) + amt);
    }
  });

  for (const contract of contracts) {
    const contractNumber = Number(contract.Contract_Number);
    if (isNaN(contractNumber)) continue;

    const customerName = contract['Customer Name'] || 'عميل غير محدد';
    const totalContractPaid = paymentsByContract.get(contractNumber) || 0;
    const contractTotal = Number(contract.Total) || 0;
    const adType = contract['Ad Type'] || '';
    const startDateStr = contract['Start Date'] || contract['Contract Date'];
    const endDateStr = contract['End Date'];

    // 1. Installments Events
    if (config.syncInstallments !== false) {
      let installments: any[] = [];
      if (typeof contract.installments_data === 'string') {
        try {
          installments = JSON.parse(contract.installments_data);
        } catch {}
      } else if (Array.isArray(contract.installments_data)) {
        installments = contract.installments_data;
      }

      if (installments && installments.length > 0) {
        // Sort installments by dueDate
        const sortedInstallments = [...installments]
          .filter(i => i && i.dueDate)
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        let runningPaid = totalContractPaid;

        sortedInstallments.forEach((inst, index) => {
          const installmentAmount = Number(inst.amount) || 0;
          const allocated = Math.min(installmentAmount, Math.max(0, runningPaid));
          runningPaid -= allocated;
          const remainingForInstallment = Math.max(0, installmentAmount - allocated);

          // We only create calendar alert events for installments that have remaining due balance
          if (remainingForInstallment > 0) {
            const dueDate = new Date(inst.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const diffTime = today.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const isOverdue = diffDays > 0;

            const instLabel = inst.description || `الدفعة رقم ${index + 1}`;
            const title = `استحقاق دفعة: ${customerName} (عقد #${contractNumber})`;
            const description = [
              `تنبيه استحقاق دفعة مالية`,
              `--------------------------------`,
              `العميل: ${customerName}`,
              `رقم العقد: #${contractNumber}`,
              `بيان الدفعة: ${instLabel}`,
              `المبلغ المستحق: ${remainingForInstallment.toLocaleString()} د.ل`,
              `إجمالي الدفعة: ${installmentAmount.toLocaleString()} د.ل`,
              `المدفوع من العقد: ${totalContractPaid.toLocaleString()} د.ل من إجمالي ${contractTotal.toLocaleString()} د.ل`,
              `تاريخ الاستحقاق: ${inst.dueDate}`,
              adType ? `نوع الإعلان: ${adType}` : '',
              isOverdue ? `الحالة: متأخرة منذ ${diffDays} يوم` : `الحالة: قادمة (متبقي ${Math.abs(diffDays)} يوم)`,
            ].filter(Boolean).join('\n');

            events.push({
              id: `inst-${contractNumber}-${index}`,
              tag: `[ADHUB:C${contractNumber}:INST${index + 1}]`,
              type: 'installment',
              title,
              description,
              startDate: inst.dueDate,
              allDay: true,
              contractNumber,
              customerName,
              customerId: contract.customer_id,
              amount: remainingForInstallment,
              daysRemainingOrOverdue: diffDays,
              isOverdue,
              statusText: isOverdue ? `متأخرة ${diffDays} يوم` : `متبقي ${Math.abs(diffDays)} يوم`,
            });
          }
        });
      } else {
        // Fallback for contract without installments if remaining balance exists
        const remainingTotal = Math.max(0, contractTotal - totalContractPaid);
        if (remainingTotal > 0 && startDateStr) {
          const startDate = new Date(startDateStr);
          const dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + 15);
          dueDate.setHours(0, 0, 0, 0);
          const dueDateStr = dueDate.toISOString().split('T')[0];

          const diffTime = today.getTime() - dueDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const isOverdue = diffDays > 0;

          events.push({
            id: `inst-${contractNumber}-single`,
            tag: `[ADHUB:C${contractNumber}:FULL]`,
            type: 'installment',
            title: `استحقاق عقد: ${customerName} (عقد #${contractNumber})`,
            description: [
              `تنبيه استحقاق دفعة العقد الإجمالية`,
              `--------------------------------`,
              `العميل: ${customerName}`,
              `رقم العقد: #${contractNumber}`,
              `المبلغ المتبقي: ${remainingTotal.toLocaleString()} د.ل`,
              `إجمالي العقد: ${contractTotal.toLocaleString()} د.ل`,
              `تاريخ الاستحقاق المفترض: ${dueDateStr}`,
            ].join('\n'),
            startDate: dueDateStr,
            allDay: true,
            contractNumber,
            customerName,
            customerId: contract.customer_id,
            amount: remainingTotal,
            daysRemainingOrOverdue: diffDays,
            isOverdue,
            statusText: isOverdue ? `متأخرة ${diffDays} يوم` : `متبقي ${Math.abs(diffDays)} يوم`,
          });
        }
      }
    }

    // 2. Contract End Date Event
    if (config.syncContracts !== false && endDateStr) {
      const endDate = new Date(endDateStr);
      endDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - endDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isExpired = diffDays > 0;

      const title = `انتهاء عقد: ${customerName} (عقد #${contractNumber})`;
      const description = [
        `تنبيه موعد انتهاء عقد إعلاني`,
        `--------------------------------`,
        `العميل: ${customerName}`,
        `رقم العقد: #${contractNumber}`,
        `تاريخ الانتهاء: ${endDateStr}`,
        `إجمالي العقد: ${contractTotal.toLocaleString()} د.ل`,
        adType ? `نوع الإعلان: ${adType}` : '',
        isExpired ? `الحالة: انتهى منذ ${diffDays} يوم` : `الحالة: ينتهي بعد ${Math.abs(diffDays)} يوم`,
      ].filter(Boolean).join('\n');

      events.push({
        id: `contract-end-${contractNumber}`,
        tag: `[ADHUB:C${contractNumber}:EXPIRY]`,
        type: 'contract_end',
        title,
        description,
        startDate: endDateStr,
        allDay: true,
        contractNumber,
        customerName,
        customerId: contract.customer_id,
        amount: contractTotal,
        daysRemainingOrOverdue: diffDays,
        isOverdue: isExpired,
        statusText: isExpired ? `منتهي منذ ${diffDays} يوم` : `ينتهي بعد ${Math.abs(diffDays)} يوم`,
      });
    }

    // 3. Contract Start Date Event (Optional)
    if (config.syncContractStarts === true && startDateStr) {
      const startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isPast = diffDays > 0;

      const title = `بدء عقد: ${customerName} (عقد #${contractNumber})`;
      const description = [
        `تنبيه موعد بدء سريان عقد إعلاني`,
        `--------------------------------`,
        `العميل: ${customerName}`,
        `رقم العقد: #${contractNumber}`,
        `تاريخ البدء: ${startDateStr}`,
        `تاريخ الانتهاء: ${endDateStr || 'غير محدد'}`,
        `إجمالي العقد: ${contractTotal.toLocaleString()} د.ل`,
      ].join('\n');

      events.push({
        id: `contract-start-${contractNumber}`,
        tag: `[ADHUB:C${contractNumber}:START]`,
        type: 'contract_start',
        title,
        description,
        startDate: startDateStr,
        allDay: true,
        contractNumber,
        customerName,
        customerId: contract.customer_id,
        amount: contractTotal,
        daysRemainingOrOverdue: diffDays,
        isOverdue: false,
        statusText: isPast ? `بدأ منذ ${diffDays} يوم` : `يبدأ بعد ${Math.abs(diffDays)} يوم`,
      });
    }
  }

  // Sort events chronologically by startDate
  return events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

/**
 * Generate a 1-click Google Calendar web link for an event with guests (emails)
 */
export function generateGoogleCalendarWebUrl(
  event: {
    title: string;
    description: string;
    startDate: string;
    endDate?: string;
    location?: string;
  },
  guestEmails: string[] = []
): string {
  const formattedStart = event.startDate.replace(/-/g, '');
  // For all-day events, Google Calendar expects end date as the following day (exclusive)
  let formattedEnd = formattedStart;
  if (event.endDate) {
    const end = new Date(event.endDate);
    end.setDate(end.getDate() + 1);
    formattedEnd = end.toISOString().split('T')[0].replace(/-/g, '');
  } else {
    const nextDay = new Date(event.startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    formattedEnd = nextDay.toISOString().split('T')[0].replace(/-/g, '');
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formattedStart}/${formattedEnd}`,
    details: event.description,
    location: event.location || 'الفارس الذهبي للدعاية والإعلان',
  });

  if (guestEmails.length > 0) {
    params.set('add', guestEmails.join(','));
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Send events to Google Apps Script Webhook
 */
export async function syncEventsToGoogleCalendar(
  config: GoogleCalendarConfig,
  events: GoogleCalendarEvent[]
): Promise<SyncResult> {
  if (!config.scriptUrl || !config.scriptUrl.startsWith('https://script.google.com/')) {
    throw new Error('يرجى إدخال رابط Google Apps Script Web App صالح');
  }

  const payload = {
    action: 'sync',
    events: events.map(e => ({
      tag: e.tag,
      title: e.title,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate || e.startDate,
      allDay: e.allDay,
      location: e.location || 'الفارس الذهبي للدعاية والإعلان',
    })),
    emails: config.emails,
    reminders: config.reminders,
  };

  const response = await fetch(config.scriptUrl, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`استجابة غير صحيحة من سكريبت جوجل (${response.status})`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'حدث خطأ أثناء المزامنة في سكريبت جوجل');
  }

  // Update last sync time in config
  const updatedConfig = { ...config, lastSync: new Date().toISOString() };
  await saveCalendarConfig(updatedConfig);

  return {
    success: true,
    createdCount: result.createdCount || 0,
    updatedCount: result.updatedCount || 0,
    totalProcessed: events.length,
  };
}

/**
 * Send a test calendar event to verify Google Apps Script connection & email delivery
 */
export async function sendTestGoogleCalendarAlert(
  config: GoogleCalendarConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.scriptUrl || !config.scriptUrl.startsWith('https://script.google.com/')) {
    throw new Error('يرجى حفظ رابط Google Apps Script أولاً');
  }

  if (config.emails.length === 0) {
    throw new Error('يرجى إضافة إيميل واحد على الأقل لتلقي التنبيه');
  }

  const payload = {
    action: 'test',
    emails: config.emails,
  };

  const response = await fetch(config.scriptUrl, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`استجابة غير صحيحة من سكريبت جوجل (${response.status})`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'فشل إرسال الحدث التجريبي');
  }

  return {
    success: true,
    message: result.message || `تم إرسال حدث تجريبي بنجاح إلى: ${config.emails.join(', ')}`,
  };
}

/**
 * Generate iCalendar (.ics) string for offline export or URL subscription
 */
export function generateICalendarContent(
  events: GoogleCalendarEvent[],
  emails: string[] = [],
  reminders: number[] = [1440, 4320]
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const dtStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AdHub Pro//Google Calendar Integration//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:مواعيد العقود والدفعات - الفارس الذهبي',
    'X-WR-TIMEZONE:Africa/Tripoli',
  ];

  events.forEach(event => {
    const startDateClean = event.startDate.replace(/-/g, '');
    const nextDay = new Date(event.startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDateClean = nextDay.toISOString().split('T')[0].replace(/-/g, '');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.tag.replace(/[^a-zA-Z0-9]/g, '') || event.id}@adhub-pro.ly`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${startDateClean}`);
    lines.push(`DTEND;VALUE=DATE:${endDateClean}`);
    lines.push(`SUMMARY:${event.title.replace(/\n/g, ' ')}`);
    lines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
    lines.push('LOCATION:الفارس الذهبي للدعاية والإعلان');
    lines.push('STATUS:CONFIRMED');

    // Add attendees
    emails.forEach(email => {
      lines.push(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${email}:mailto:${email}`);
    });

    // Add reminders (VALARM)
    reminders.forEach(min => {
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-PT${min}M`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:تنبيه: ${event.title}`);
      lines.push('END:VALARM');

      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-PT${min}M`);
      lines.push('ACTION:EMAIL');
      lines.push(`SUMMARY:تنبيه AdHub: ${event.title}`);
      lines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
      emails.forEach(email => {
        lines.push(`ATTENDEE:mailto:${email}`);
      });
      lines.push('END:VALARM');
    });

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Trigger download of .ics calendar file
 */
export function downloadICalendarFile(
  events: GoogleCalendarEvent[],
  emails: string[] = [],
  reminders: number[] = [1440, 4320],
  filename: string = 'adhub-calendar-alerts.ics'
): void {
  const content = generateICalendarContent(events, emails, reminders);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Complete Google Apps Script template for deployment
 */
export function getAppsScriptSourceCode(): string {
  return `/**
 * سكريبت ربط مواعيد العقود ودفعات AdHub بـ Google Calendar
 * الفارس الذهبي للدعاية والإعلان
 *
 * تعليمات النشر:
 * 1. افتح https://script.google.com
 * 2. اضغط "مشروع جديد" (New project)
 * 3. امسح الكود القديم والصق هذا الكود بالكامل
 * 4. اضغط "نشر" (Deploy) -> "توزيع جديد" (New deployment)
 * 5. اختر نوع التوزيع: "تطبيق ويب" (Web app)
 * 6. اضبط الصلاحيات:
 *    - Execute as: Me (حسابي)
 *    - Who has access: Anyone (أي شخص)
 * 7. اضغط Deploy وامنح الأذونات، ثم انسخ رابط الويب (Web App URL)
 * 8. الصق الرابط في صفحة إعدادات تقويم جوجل في لوحة AdHub
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ success: false, error: 'No data provided' });
    }

    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'sync';
    var emails = data.emails || [];
    var calendar = CalendarApp.getDefaultCalendar();

    // 1. اختبار الاتصال وإرسال إشعار تجريبي
    if (action === 'test') {
      var now = new Date();
      var testDate = new Date(now.getTime() + 60 * 60 * 1000); // بعد ساعة واحدة
      var guestsString = emails.filter(function(em) { return em && em.indexOf('@') !== -1; }).join(',');

      var testEvent = calendar.createEvent(
        'تجربة اتصال تقويم الفارس الذهبي - AdHub',
        now,
        testDate,
        {
          description: 'تم إرسال هذا الإشعار التجريبي للتأكد من نجاح ربط تنبيهات العقود والدفعات مع Google Calendar.\\n\\nالإيميلات المستلمة: ' + emails.join(', '),
          guests: guestsString,
          sendInvites: guestsString.length > 0
        }
      );

      testEvent.addPopupReminder(15);
      testEvent.addEmailReminder(15);

      return responseJSON({
        success: true,
        message: 'تم إنشاء حدث تجريبي بنجاح وإرسال الدعوة إلى: ' + emails.join(', '),
        eventId: testEvent.getId()
      });
    }

    // 2. مزامنة الأحداث (الدفعات والعقود)
    var events = data.events || [];
    var reminders = data.reminders || [1440, 4320]; // 1 يوم و 3 أيام افتراضياً
    var createdCount = 0;
    var updatedCount = 0;
    var validEmails = emails.filter(function(em) { return em && em.indexOf('@') !== -1; });
    var guestsString = validEmails.join(',');

    for (var i = 0; i < events.length; i++) {
      var item = events[i];
      var tag = item.tag || '';
      var startDateParts = item.startDate.split('-');
      var startDate = new Date(parseInt(startDateParts[0]), parseInt(startDateParts[1]) - 1, parseInt(startDateParts[2]));

      // البحث عن حدث موجود مسبقاً بنفس العلامة (Tag) لمنع التكرار
      var existingEvent = null;
      if (tag) {
        var searchRangeStart = new Date(startDate.getTime() - 45 * 24 * 60 * 60 * 1000);
        var searchRangeEnd = new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000);
        var foundEvents = calendar.getEvents(searchRangeStart, searchRangeEnd, { search: tag });
        if (foundEvents && foundEvents.length > 0) {
          existingEvent = foundEvents[0];
        }
      }

      var fullDescription = (item.description || '') + '\\n\\n' + tag;

      if (existingEvent) {
        // تحديث الحدث القائم
        existingEvent.setTitle(item.title);
        existingEvent.setDescription(fullDescription);
        if (item.location) existingEvent.setLocation(item.location);
        existingEvent.setAllDayDate(startDate);
        setupRemindersAndGuests(existingEvent, reminders, validEmails);
        updatedCount++;
      } else {
        // إنشاء حدث جديد
        var newEvent = calendar.createAllDayEvent(item.title, startDate, {
          description: fullDescription,
          location: item.location || 'الفارس الذهبي للدعاية والإعلان',
          guests: guestsString,
          sendInvites: guestsString.length > 0
        });
        setupRemindersAndGuests(newEvent, reminders, validEmails);
        createdCount++;
      }
    }

    return responseJSON({
      success: true,
      createdCount: createdCount,
      updatedCount: updatedCount,
      totalProcessed: events.length
    });

  } catch (error) {
    return responseJSON({
      success: false,
      error: error.toString()
    });
  }
}

function setupRemindersAndGuests(event, reminders, emails) {
  try {
    event.removeAllReminders();
    for (var r = 0; r < reminders.length; r++) {
      event.addPopupReminder(reminders[r]);
      event.addEmailReminder(reminders[r]);
    }
  } catch (e) {}

  try {
    for (var g = 0; g < emails.length; g++) {
      event.addGuest(emails[g].trim());
    }
  } catch (e) {}
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
}
