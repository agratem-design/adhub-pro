import { CALENDAR_INVITATIONS_SCRIPT } from './googleCalendarInvitationsScript';
import { DESIGN_EMAIL_SCRIPT } from './googleCalendarDesignEmailScript';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GoogleCalendarConfig {
  scriptUrl: string;
  emails: string[];
  reminders: number[]; // In minutes, e.g. [1440, 4320] for 1 day, 3 days
  alertTime?: string; // Default '12:00' (12:00 PM / ظهرًا)
  syncContracts: boolean;
  syncInstallments: boolean;
  syncContractStarts: boolean;
  syncInvoices: boolean; // Sync sales invoices
  activeAndUpcomingOnly?: boolean; // Only sync and alert active contracts & upcoming appointments
  autoSync: boolean;
  lastSync: string | null;
}

export interface GoogleCalendarEvent {
  id: string;
  tag: string;
  type: 'installment' | 'contract_end' | 'contract_start' | 'invoice';
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD
  allDay: boolean;
  alertTime?: string; // e.g. '12:00'
  location?: string;
  contractNumber?: number;
  invoiceNumber?: string;
  /** عنوان الفاتورة إن وُجد (invoice_name) */
  invoiceName?: string;
  /** الخدمة الفعلية من بنود الفاتورة (طباعة / تركيب / قص)، مثل «طباعة وتركيب» */
  serviceLabel?: string;
  invoiceId?: string;
  customerName: string;
  customerId?: string | null;
  customerEmail?: string;
  amount?: number;
  totalAmount?: number;
  paidAmount?: number;
  adType?: string;
  designUrl?: string;
  firstInstallationDate?: string;
  daysRemainingOrOverdue: number; // Positive = overdue, Negative = days remaining
  isOverdue: boolean;
  isContractActive: boolean;
  statusText: string;
}

export interface SyncResult {
  success: boolean;
  createdCount: number;
  updatedCount: number;
  deletedCount?: number;
  totalProcessed: number;
  error?: string;
  rateLimited?: boolean;
  lastProcessedIndex?: number;
  /** مواعيد فشل إرسالها مع السبب (لا تُعلَّم كمُرسلة فتُعاد في المزامنة القادمة) */
  failed?: CalendarSyncFailure[];
}

export interface CalendarSyncFailure { tag?: string; title: string; customerName?: string; error: string }

export interface SyncOptions {
  sendInvites?: boolean;
  cleanOld?: boolean;
  batchSize?: number;
  delayMs?: number;
  startIndex?: number;
  onProgress?: (progress: { currentBatch: number; totalBatches: number; processed: number; total: number }) => void;
}

const DEFAULT_CONFIG: GoogleCalendarConfig = {
  scriptUrl: '',
  emails: [],
  reminders: [1440, 4320], // 1 day and 3 days before
  alertTime: '12:00', // Default 12:00 PM (12:00 ظهرًا / مساءً)
  syncContracts: true,
  syncInstallments: true,
  syncContractStarts: true,
  syncInvoices: true,
  activeAndUpcomingOnly: true,
  autoSync: false,
  lastSync: null,
};

/** Read every page; never present a failed or truncated request as an empty schedule. */
export async function loadCalendarRecords() {
  async function readPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
    const rows: T[] = [];
    const pageSize = 500;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await fetchPage(from, from + pageSize - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) return rows;
    }
  }
  const [contracts, payments] = await Promise.all([
    readPages((from, to) => supabase.from('Contract')
      .select('Contract_Number, "Customer Name", customer_id, installments_data, Total, "Ad Type", "End Date", "Contract Date", design_data, billboard_ids')
      .order('Contract_Number').range(from, to)),
    readPages((from, to) => supabase.from('customer_payments')
      .select('contract_number, customer_id, customer_name, amount, paid_at, entry_type')
      .in('entry_type', ['payment', 'receipt', 'account_payment'])
      .order('id').range(from, to)),
  ]);

  let invoices: any[] = [];
  try {
    invoices = await readPages((from, to) => supabase.from('sales_invoices')
      .select('id, invoice_number, invoice_name, invoice_date, customer_id, customer_name, total_amount, paid_amount, remaining_amount, paid, notes, items')
      .order('invoice_date', { ascending: false }).range(from, to));
  } catch (e) {
    console.warn('Could not read sales_invoices:', e);
  }

  let installations: any[] = [];
  try {
    installations = await readPages((from, to) => supabase.from('installation_team_accounts')
      .select('contract_id, installation_date')
      .order('installation_date', { ascending: true }).range(from, to));
  } catch (e) {
    console.warn('Could not read installation_team_accounts:', e);
  }

  let customers: any[] = [];
  try {
    customers = await readPages((from, to) => supabase.from('customers')
      .select('id, name, email, phone, company')
      .order('id').range(from, to));
  } catch (e) {
    console.warn('Could not read customers:', e);
  }

  let compositeTasks: any[] = [];
  try {
    compositeTasks = await readPages((from, to) => supabase.from('composite_tasks')
      .select('id, contract_id, installation_task_id')
      .range(from, to));
  } catch (e) {
    console.warn('Could not read composite_tasks:', e);
  }

  let taskDesigns: any[] = [];
  try {
    taskDesigns = await readPages((from, to) => supabase.from('task_designs')
      .select('task_id, design_face_a_url, design_face_b_url, cutout_image_url')
      .range(from, to));
  } catch (e) {
    console.warn('Could not read task_designs:', e);
  }

  let directInstallationTasks: any[] = [];
  try {
    directInstallationTasks = await readPages((from, to) => supabase.from('installation_tasks')
      .select('id, contract_id')
      .range(from, to));
  } catch (e) {
    console.warn('Could not read installation_tasks:', e);
  }

  return { contracts, payments, invoices, installations, customers, compositeTasks, taskDesigns, directInstallationTasks };
}

const SETTINGS_KEYS = {
  SCRIPT_URL: 'google_calendar_script_url',
  EMAILS: 'google_calendar_emails',
  REMINDERS: 'google_calendar_reminders',
  ALERT_TIME: 'google_calendar_alert_time',
  SYNC_CONTRACTS: 'google_calendar_sync_contracts',
  SYNC_INSTALLMENTS: 'google_calendar_sync_installments',
  SYNC_STARTS: 'google_calendar_sync_starts',
  SYNC_INVOICES: 'google_calendar_sync_invoices',
  SYNC_ACTIVE_ONLY: 'google_calendar_sync_active_only',
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
      if (map.has(SETTINGS_KEYS.ALERT_TIME)) {
        config.alertTime = map.get(SETTINGS_KEYS.ALERT_TIME) || '12:00';
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
      if (map.has(SETTINGS_KEYS.SYNC_INVOICES)) {
        config.syncInvoices = map.get(SETTINGS_KEYS.SYNC_INVOICES) !== 'false';
      }
      if (map.has(SETTINGS_KEYS.SYNC_ACTIVE_ONLY)) {
        config.activeAndUpcomingOnly = map.get(SETTINGS_KEYS.SYNC_ACTIVE_ONLY) !== 'false';
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
    { setting_key: SETTINGS_KEYS.ALERT_TIME, setting_value: config.alertTime || '12:00' },
    { setting_key: SETTINGS_KEYS.SYNC_CONTRACTS, setting_value: config.syncContracts ? 'true' : 'false' },
    { setting_key: SETTINGS_KEYS.SYNC_INSTALLMENTS, setting_value: config.syncInstallments ? 'true' : 'false' },
    { setting_key: SETTINGS_KEYS.SYNC_STARTS, setting_value: config.syncContractStarts ? 'true' : 'false' },
    { setting_key: SETTINGS_KEYS.SYNC_INVOICES, setting_value: config.syncInvoices !== false ? 'true' : 'false' },
    { setting_key: SETTINGS_KEYS.SYNC_ACTIVE_ONLY, setting_value: config.activeAndUpcomingOnly !== false ? 'true' : 'false' },
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
 * Safely extract design images from a contract's design_data
 */
/**
 * Safely extract design images from a contract's design_data and additional composite sources
 */
export function extractDesignUrlsFromContract(contract: any, additionalUrls?: string[]): string[] {
  const images: string[] = [];
  const addImage = (url: unknown) => {
    if (typeof url === 'string') {
      const trimmed = url.trim();
      if (
        trimmed &&
        (trimmed.startsWith('http') || trimmed.startsWith('/') || trimmed.startsWith('data:')) &&
        !images.includes(trimmed)
      ) {
        images.push(trimmed);
      }
    }
  };

  const raw = contract?.design_data;
  if (raw) {
    try {
      let parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch {}
      }
      if (Array.isArray(parsed)) {
        parsed.forEach((d: any) => {
          addImage(d?.designFaceA || d?.faceA || d?.design_face_a || d?.design_face_a_url || d?.designFaceAUrl);
          addImage(d?.designFaceB || d?.faceB || d?.design_face_b || d?.design_face_b_url || d?.designFaceBUrl);
          addImage(d?.url || d?.imageUrl || d?.image_url);
        });
      } else if (parsed && typeof parsed === 'object') {
        addImage(parsed?.designFaceA || parsed?.faceA || parsed?.design_face_a || parsed?.design_face_a_url || parsed?.designFaceAUrl);
        addImage(parsed?.designFaceB || parsed?.faceB || parsed?.design_face_b || parsed?.design_face_b_url || parsed?.designFaceBUrl);
        addImage(parsed?.url || parsed?.imageUrl || parsed?.image_url);
      }
    } catch {}
  }

  if (Array.isArray(additionalUrls)) {
    additionalUrls.forEach(addImage);
  }

  return images;
}

/**
 * Build contract number to design images mapping from composite tasks and task designs
 */
export function buildContractDesignsMap(
  compositeTasks: any[] = [],
  taskDesigns: any[] = [],
  directInstallationTasks: any[] = []
): Map<number, string[]> {
  const designsByTaskId = new Map<string | number, string[]>();
  const addImage = (taskId: string | number, url: unknown) => {
    if (typeof url === 'string') {
      const trimmed = url.trim();
      if (
        trimmed &&
        (trimmed.startsWith('http') || trimmed.startsWith('/') || trimmed.startsWith('data:'))
      ) {
        const list = designsByTaskId.get(taskId) || [];
        if (!list.includes(trimmed)) {
          list.push(trimmed);
          designsByTaskId.set(taskId, list);
        }
      }
    }
  };

  taskDesigns.forEach(td => {
    const tid = td.task_id;
    if (!tid) return;
    addImage(tid, td.design_face_a_url);
    addImage(tid, td.design_face_b_url);
    addImage(tid, td.cutout_image_url);
  });

  const contractMap = new Map<number, string[]>();
  const appendToContract = (cNum: number, urls: string[]) => {
    if (isNaN(cNum) || !urls || urls.length === 0) return;
    const existing = contractMap.get(cNum) || [];
    urls.forEach(u => {
      if (!existing.includes(u)) existing.push(u);
    });
    contractMap.set(cNum, existing);
  };

  // Direct installation tasks (contract_id -> task_id)
  directInstallationTasks.forEach(task => {
    const cNum = Number(task.contract_id);
    const tid = task.id;
    if (!isNaN(cNum) && tid && designsByTaskId.has(tid)) {
      appendToContract(cNum, designsByTaskId.get(tid) || []);
    }
  });

  // Composite tasks (contract_id -> installation_task_id)
  compositeTasks.forEach(ct => {
    const cNum = Number(ct.contract_id);
    const instId = ct.installation_task_id;
    if (!isNaN(cNum) && instId && designsByTaskId.has(instId)) {
      appendToContract(cNum, designsByTaskId.get(instId) || []);
    }
  });

  return contractMap;
}

/**
 * Format alert time in Arabic (e.g. '12:00' -> '12:00 ظهرًا')
 */
export function formatAlertTimeArabic(timeStr: string = '12:00'): string {
  const [hStr, mStr] = (timeStr || '12:00').split(':');
  const hour = parseInt(hStr, 10);
  const min = parseInt(mStr || '0', 10);
  const isPM = hour >= 12;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const pad = (n: number) => String(n).padStart(2, '0');
  const period = hour === 12 ? 'ظهرًا' : isPM ? 'مساءً' : 'صباحًا';
  return `${pad(h12)}:${pad(min)} ${period}`;
}

/**
 * Extract calendar events from contracts, payment records, invoices, installation tasks, and composite tasks
 */
/**
 * الخدمة الفعلية لفاتورة مبيعات من بنودها (نص حر، لأن الفاتورة لا تحمل نوع خدمة):
 * «طباعة وتركيب» إذا ورد الاثنان في البنود. تُرجع undefined إن لم تُعرف الخدمة من البنود.
 */
export function serviceLabelFromItems(items: unknown): string | undefined {
  let list: any[] = [];
  try {
    list = typeof items === 'string' ? JSON.parse(items) : Array.isArray(items) ? items : [];
  } catch {
    return undefined;
  }
  const text = list.map(item => Object.values(item || {}).map(v => String(v ?? '')).join(' ')).join(' ');
  const parts = [
    /طباعة/.test(text) && 'طباعة',
    /تركيب/.test(text) && 'تركيب',
    /(^|\s)قص(\s|$)/.test(text) && 'قص',
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(' و') : undefined;
}

export function extractCalendarEvents(
  contracts: any[],
  payments: any[],
  config: Partial<GoogleCalendarConfig> = {},
  invoices: any[] = [],
  installations: any[] = [],
  customers: any[] = [],
  compositeDesigns?: Map<number, string[]> | { compositeTasks?: any[]; taskDesigns?: any[]; directInstallationTasks?: any[] }
): GoogleCalendarEvent[] {
  const events: GoogleCalendarEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeAndUpcomingOnly = config.activeAndUpcomingOnly !== false;
  const alertTime = config.alertTime || '12:00';
  const formattedAlertTime = formatAlertTimeArabic(alertTime);

  // Build composite designs map if provided
  let compositeDesignsMap: Map<number, string[]> | undefined;
  if (compositeDesigns instanceof Map) {
    compositeDesignsMap = compositeDesigns;
  } else if (compositeDesigns && typeof compositeDesigns === 'object') {
    compositeDesignsMap = buildContractDesignsMap(
      compositeDesigns.compositeTasks || [],
      compositeDesigns.taskDesigns || [],
      compositeDesigns.directInstallationTasks || []
    );
  }

  // 1. Group payments by contract number
  const paymentsByContract = new Map<number, number>();
  payments.forEach((p: any) => {
    const amt = Number(p.amount) || 0;
    if (amt <= 0) return;
    const cNum = Number(p.contract_number ?? p.Contract_Number ?? p.contract_id);
    if (!isNaN(cNum)) {
      paymentsByContract.set(cNum, (paymentsByContract.get(cNum) || 0) + amt);
    }
  });

  // 2. Map earliest installation date by contract_id
  const firstInstallDateByContract = new Map<number, string>();
  if (Array.isArray(installations)) {
    installations.forEach((inst: any) => {
      const cNum = Number(inst.contract_id ?? inst.Contract_Number);
      const instDate = inst.installation_date || inst.created_at?.split('T')[0];
      if (!isNaN(cNum) && instDate && Number.isFinite(Date.parse(instDate))) {
        const existing = firstInstallDateByContract.get(cNum);
        if (!existing || new Date(instDate).getTime() < new Date(existing).getTime()) {
          firstInstallDateByContract.set(cNum, instDate);
        }
      }
    });
  }

  // 3. Map customer email by ID and name
  const customerEmailById = new Map<string, string>();
  const customerEmailByName = new Map<string, string>();
  if (Array.isArray(customers)) {
    customers.forEach((c: any) => {
      const email = typeof c.email === 'string' ? c.email.trim() : '';
      if (email && email.includes('@')) {
        if (c.id) customerEmailById.set(String(c.id), email);
        if (c.name) customerEmailByName.set(String(c.name).trim().toLowerCase(), email);
      }
    });
  }

  // 4. Process contracts
  for (const contract of contracts) {
    const contractNumber = Number(
      contract.Contract_Number ??
      contract.contract_number ??
      contract['Contract Number'] ??
      contract.id
    );
    if (isNaN(contractNumber)) continue;

    const customerName =
      contract['Customer Name'] ||
      contract.customer_name ||
      contract.Customer_Name ||
      'عميل غير محدد';

    const customerEmail =
      (contract.customer_id ? customerEmailById.get(String(contract.customer_id)) : undefined) ||
      (customerName ? customerEmailByName.get(customerName.trim().toLowerCase()) : undefined) ||
      contract.customer_email ||
      contract.email ||
      undefined;

    const totalContractPaid =
      paymentsByContract.get(contractNumber) ??
      (contract.actual_paid != null ? Number(contract.actual_paid) : 0);

    const contractTotal = Number(
      contract.Total ??
      contract.total_cost ??
      contract['Total Cost']
    ) || 0;

    const remainingContractBalance = Math.max(0, contractTotal - totalContractPaid);
    const isContractFullyPaid = contractTotal > 0 && remainingContractBalance <= 0;

    const adType =
      contract['Ad Type'] ||
      contract.ad_type ||
      contract.Ad_Type ||
      '';

    const startDateStr =
      contract['Contract Date'] ||
      contract.start_date ||
      contract.contract_date ||
      contract['Start Date'] ||
      '';

    const endDateStr =
      contract['End Date'] ||
      contract.end_date ||
      contract.EndDate ||
      '';

    // First installation date
    const firstInstallationDate = firstInstallDateByContract.get(contractNumber) || startDateStr || undefined;

    // Design URL: extract from design_data and composite tasks
    const compositeUrls = compositeDesignsMap?.get(contractNumber) || [];
    const designUrls = extractDesignUrlsFromContract(contract, compositeUrls);
    const designUrl = designUrls.length > 0
      ? designUrls[0]
      : undefined;

    // Formatted design display section with direct HTML image and high-res link
    const designDisplaySection = designUrl
      ? [
          `--------------------------------`,
          `صورة التصميم المعتمد:`,
          `<img src="${designUrl}" alt="تصميم العقد" width="450" style="max-width:100%; border-radius:8px; border:1px solid #cbd5e1; display:block; margin:8px 0;" />`,
          `رابط التصميم المباشر: ${designUrl}`,
        ].join('\n')
      : '';

    // Determine contract active status
    let isContractExpired = false;
    if (endDateStr && Number.isFinite(Date.parse(endDateStr))) {
      const endD = new Date(endDateStr);
      endD.setHours(0, 0, 0, 0);
      isContractExpired = endD.getTime() < today.getTime();
    } else if (startDateStr && Number.isFinite(Date.parse(startDateStr))) {
      const startD = new Date(startDateStr);
      startD.setHours(0, 0, 0, 0);
      const diffStartDays = Math.ceil((today.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));

      const durationStr = String(contract.Duration || contract.duration || '').trim();
      let durationDays = 365;
      if (durationStr) {
        const parenMatch = durationStr.match(/\((\d+)\)/);
        const numMatch = durationStr.match(/(\d+)/);
        if (parenMatch) {
          durationDays = parseInt(parenMatch[1], 10);
        } else if (durationStr.includes('شهر ونصف') || durationStr.includes('شهر ونص')) {
          durationDays = 45;
        } else if (durationStr.includes('شهرين') || durationStr.includes('شهران')) {
          durationDays = 60;
        } else if (durationStr.includes('شهر واحد') || durationStr.includes('شهر')) {
          durationDays = 30;
        } else if (durationStr.includes('3 أشهر') || durationStr.includes('3 شهور')) {
          durationDays = 90;
        } else if (durationStr.includes('6 أشهر') || durationStr.includes('6 شهور')) {
          durationDays = 180;
        } else if (durationStr.includes('سنة')) {
          durationDays = 365;
        } else if (numMatch) {
          durationDays = parseInt(numMatch[1], 10);
        }
      }

      if (diffStartDays > durationDays || (diffStartDays > 0 && isContractFullyPaid) || diffStartDays > 365) {
        isContractExpired = true;
      }
    } else {
      isContractExpired = true;
    }
    const isContractActive = !isContractExpired;

    // If active and upcoming only: skip expired contracts entirely
    if (activeAndUpcomingOnly && isContractExpired) {
      continue;
    }

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

      if (Array.isArray(installments) && installments.length > 0) {
        const sortedInstallments = [...installments]
          .filter(i => {
            const d = i?.dueDate || i?.due_date || i?.date;
            return d && Number.isFinite(Date.parse(d));
          })
          .sort((a, b) => {
            const da = new Date(a.dueDate || a.due_date || a.date).getTime();
            const db = new Date(b.dueDate || b.due_date || b.date).getTime();
            return da - db;
          });

        let runningPaid = totalContractPaid;

        sortedInstallments.forEach((inst, index) => {
          const rawDueDate = inst.dueDate || inst.due_date || inst.date;
          const installmentAmount = Number(inst.amount ?? inst.value) || 0;
          const allocated = Math.min(installmentAmount, Math.max(0, runningPaid));
          runningPaid -= allocated;
          const remainingForInstallment = Math.max(0, installmentAmount - allocated);

          if (remainingForInstallment > 0) {
            const dueDate = new Date(rawDueDate);
            dueDate.setHours(0, 0, 0, 0);
            const diffTime = today.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const isOverdue = diffDays > 0;

            const instLabel = inst.description || inst.label || `الدفعة رقم ${index + 1}`;
            const title = `استحقاق دفعة: ${customerName} (عقد #${contractNumber}) - ${remainingForInstallment.toLocaleString()} د.ل`;
            const description = [
              `تنبيه استحقاق دفعة مالية`,
              `--------------------------------`,
              `العميل: ${customerName}`,
              `رقم العقد: #${contractNumber}`,
              `نوع الإعلان: ${adType || 'غير محدد'}`,
              `بيان الدفعة: ${instLabel}`,
              `المبلغ المستحق للدفعة: ${remainingForInstallment.toLocaleString()} د.ل`,
              `إجمالي الدفعة: ${installmentAmount.toLocaleString()} د.ل`,
              `تاريخ الاستحقاق: ${rawDueDate}`,
              `ساعة التنبيه: ${alertTime} (${formattedAlertTime})`,
              customerEmail ? `البريد الإلكتروني للعميل: ${customerEmail}` : '',
              firstInstallationDate ? `تاريخ التركيب الأول: ${firstInstallationDate}` : '',
              designDisplaySection,
              `إجمالي العقد: ${contractTotal.toLocaleString()} د.ل`,
              `المدفوع من العقد: ${totalContractPaid.toLocaleString()} د.ل`,
              `المتبقي الإجمالي: ${remainingContractBalance.toLocaleString()} د.ل`,
              isOverdue ? `الحالة: متأخرة منذ ${diffDays} يوم` : (diffDays === 0 ? `الحالة: تستحق اليوم` : `الحالة: قادمة (متبقي ${Math.abs(diffDays)} يوم)`),
            ].filter(Boolean).join('\n');

            events.push({
              id: `inst-${contractNumber}-${index}`,
              tag: `[ADHUB:C${contractNumber}:INST${index + 1}]`,
              type: 'installment',
              title,
              description,
              startDate: rawDueDate,
              allDay: false,
              alertTime,
              contractNumber,
              customerName,
              customerId: contract.customer_id,
              customerEmail,
              amount: remainingForInstallment,
              adType,
              designUrl,
              firstInstallationDate,
              daysRemainingOrOverdue: diffDays,
              isOverdue,
              isContractActive,
              statusText: isOverdue ? `متأخرة ${diffDays} يوم` : (diffDays === 0 ? `تستحق اليوم` : `متبقي ${Math.abs(diffDays)} يوم`),
            });
          }
        });
      } else {
        const remainingTotal = Math.max(0, contractTotal - totalContractPaid);
        if (remainingTotal > 0 && startDateStr && Number.isFinite(Date.parse(startDateStr))) {
          const startDate = new Date(startDateStr);
          const dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + 15);
          dueDate.setHours(0, 0, 0, 0);
          const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;

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
              customerEmail ? `البريد الإلكتروني للعميل: ${customerEmail}` : '',
              `نوع الإعلان: ${adType || 'غير محدد'}`,
              `المبلغ المتبقي: ${remainingTotal.toLocaleString()} د.ل`,
              `إجمالي العقد: ${contractTotal.toLocaleString()} د.ل`,
              `تاريخ الاستحقاق المفترض: ${dueDateStr}`,
              `ساعة التنبيه: ${alertTime} (${formattedAlertTime})`,
              firstInstallationDate ? `تاريخ التركيب الأول: ${firstInstallationDate}` : '',
              designDisplaySection,
              isOverdue ? `الحالة: متأخرة منذ ${diffDays} يوم` : (diffDays === 0 ? `الحالة: تستحق اليوم` : `الحالة: قادمة (متبقي ${Math.abs(diffDays)} يوم)`),
            ].filter(Boolean).join('\n'),
            startDate: dueDateStr,
            allDay: false,
            alertTime,
            contractNumber,
            customerName,
            customerId: contract.customer_id,
            customerEmail,
            amount: remainingTotal,
            adType,
            designUrl,
            firstInstallationDate,
            daysRemainingOrOverdue: diffDays,
            isOverdue,
            isContractActive,
            statusText: isOverdue ? `متأخرة ${diffDays} يوم` : (diffDays === 0 ? `تستحق اليوم` : `متبقي ${Math.abs(diffDays)} يوم`),
          });
        }
      }
    }

    // 2. Contract End Date Event
    if (config.syncContracts !== false && endDateStr && Number.isFinite(Date.parse(endDateStr))) {
      const endDate = new Date(endDateStr);
      endDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - endDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isExpired = diffDays > 0;

      if (!isExpired || !activeAndUpcomingOnly) {
        const title = `انتهاء عقد: ${customerName} (عقد #${contractNumber}) - ${adType || 'إعلانات'}`;
        const description = [
          `تنبيه موعد انتهاء عقد إعلاني`,
          `--------------------------------`,
          `العميل: ${customerName}`,
          `رقم العقد: #${contractNumber}`,
          customerEmail ? `البريد الإلكتروني للعميل: ${customerEmail}` : '',
          `نوع الإعلان: ${adType || 'غير محدد'}`,
          `تاريخ البدء: ${startDateStr || 'غير محدد'}`,
          `تاريخ الانتهاء: ${endDateStr}`,
          `ساعة التنبيه: ${alertTime} (${formattedAlertTime})`,
          firstInstallationDate ? `تاريخ التركيب الأول: ${firstInstallationDate}` : '',
          designDisplaySection,
          `إجمالي العقد: ${contractTotal.toLocaleString()} د.ل`,
          `المدفوع: ${totalContractPaid.toLocaleString()} د.ل`,
          `المبلغ المتبقي: ${remainingContractBalance.toLocaleString()} د.ل`,
          isContractFullyPaid ? `حالة السداد: مسدد بالكامل` : `المتبقي للسداد: ${remainingContractBalance.toLocaleString()} د.ل`,
          isExpired ? `الحالة: انتهى منذ ${diffDays} يوم` : (diffDays === 0 ? `الحالة: ينتهي اليوم` : `الحالة: ينتهي بعد ${Math.abs(diffDays)} يوم`),
        ].filter(Boolean).join('\n');

        events.push({
          id: `contract-end-${contractNumber}`,
          tag: `[ADHUB:C${contractNumber}:EXPIRY]`,
          type: 'contract_end',
          title,
          description,
          startDate: endDateStr,
          allDay: false,
          alertTime,
          contractNumber,
          customerName,
          customerId: contract.customer_id,
          customerEmail,
          amount: remainingContractBalance,
          adType,
          designUrl,
          firstInstallationDate,
          daysRemainingOrOverdue: diffDays,
          isOverdue: isExpired,
          isContractActive: !isExpired,
          statusText: isExpired ? `منتهي منذ ${diffDays} يوم` : (diffDays === 0 ? `ينتهي اليوم` : `ينتهي بعد ${Math.abs(diffDays)} يوم`),
        });
      }
    }

    // 3. Contract Start Date Event
    if (config.syncContractStarts !== false && startDateStr && Number.isFinite(Date.parse(startDateStr))) {
      const startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isPast = diffDays > 0;

      // In activeAndUpcomingOnly mode, past contract starts (diffDays > 0) must NEVER be included
      if (!isPast || !activeAndUpcomingOnly) {
        const title = `بدء عقد: ${customerName} (عقد #${contractNumber}) - ${adType || 'إعلانات'}`;
        const description = [
          `تنبيه موعد بدء سريان عقد إعلاني`,
          `--------------------------------`,
          `العميل: ${customerName}`,
          `رقم العقد: #${contractNumber}`,
          customerEmail ? `البريد الإلكتروني للعميل: ${customerEmail}` : '',
          `نوع الإعلان: ${adType || 'غير محدد'}`,
          `تاريخ البدء: ${startDateStr}`,
          `تاريخ الانتهاء: ${endDateStr || 'غير محدد'}`,
          `ساعة التنبيه: ${alertTime} (${formattedAlertTime})`,
          firstInstallationDate ? `تاريخ التركيب الأول: ${firstInstallationDate}` : `تاريخ التركيب: ${startDateStr}`,
          designDisplaySection,
          `إجمالي العقد: ${contractTotal.toLocaleString()} د.ل`,
          `المدفوع: ${totalContractPaid.toLocaleString()} د.ل`,
          `المتبقي الإجمالي: ${remainingContractBalance.toLocaleString()} د.ل`,
          isContractFullyPaid ? `حالة السداد: مسدد بالكامل` : `المتبقي للسداد: ${remainingContractBalance.toLocaleString()} د.ل`,
          isPast ? `الحالة: بدأ منذ ${diffDays} يوم` : (diffDays === 0 ? `الحالة: يبدأ اليوم` : `الحالة: يبدأ بعد ${Math.abs(diffDays)} يوم`),
        ].filter(Boolean).join('\n');

        events.push({
          id: `contract-start-${contractNumber}`,
          tag: `[ADHUB:C${contractNumber}:START]`,
          type: 'contract_start',
          title,
          description,
          startDate: startDateStr,
          allDay: false,
          alertTime,
          contractNumber,
          customerName,
          customerId: contract.customer_id,
          customerEmail,
          amount: remainingContractBalance,
          adType,
          designUrl,
          firstInstallationDate,
          daysRemainingOrOverdue: diffDays,
          isOverdue: isPast,
          isContractActive,
          statusText: isPast ? `بدأ منذ ${diffDays} يوم` : (diffDays === 0 ? `يبدأ اليوم` : `يبدأ بعد ${Math.abs(diffDays)} يوم`),
        });
      }
    }
  }

  // 4. Sales Invoices Events
  if (config.syncInvoices !== false && Array.isArray(invoices) && invoices.length > 0) {
    invoices.forEach((inv: any) => {
      const invNum = String(inv.invoice_number || inv.id || '');
      if (!invNum) return;

      const customerName = inv.customer_name || 'عميل غير محدد';
      const invoiceDateStr = inv.invoice_date || inv.created_at?.split('T')[0] || '';
      if (!invoiceDateStr || !Number.isFinite(Date.parse(invoiceDateStr))) return;

      const customerEmail =
        (inv.customer_id ? customerEmailById.get(String(inv.customer_id)) : undefined) ||
        (customerName ? customerEmailByName.get(customerName.trim().toLowerCase()) : undefined) ||
        inv.customer_email ||
        inv.email ||
        undefined;

      const totalAmount = Number(inv.total_amount) || 0;
      const paidAmount = Number(inv.paid_amount) || 0;
      const remainingAmount = inv.remaining_amount != null
        ? Number(inv.remaining_amount)
        : Math.max(0, totalAmount - paidAmount);

      const isPaid = inv.paid === true || (totalAmount > 0 && remainingAmount <= 0);

      // Skip fully paid invoices if active and upcoming only
      if (activeAndUpcomingOnly && isPaid) return;

      const invDate = new Date(invoiceDateStr);
      invDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - invDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isOverdue = diffDays > 0;

      const title = `استحقاق فاتورة: ${customerName} (فاتورة #${invNum}) - ${remainingAmount.toLocaleString()} د.ل`;
      const description = [
        `تنبيه استحقاق فاتورة مبيعات`,
        `--------------------------------`,
        `العميل: ${customerName}`,
        `رقم الفاتورة: #${invNum}`,
        customerEmail ? `البريد الإلكتروني للعميل: ${customerEmail}` : '',
        `نوع المعاملة: فاتورة مبيعات`,
        `المبلغ المستحق: ${remainingAmount.toLocaleString()} د.ل`,
        `إجمالي الفاتورة: ${totalAmount.toLocaleString()} د.ل`,
        `المدفوع من الفاتورة: ${paidAmount.toLocaleString()} د.ل`,
        `تاريخ الفاتورة: ${invoiceDateStr}`,
        `ساعة التنبيه: ${alertTime} (${formattedAlertTime})`,
        isPaid ? `حالة السداد: مسددة بالكامل` : `المتبقي للسداد: ${remainingAmount.toLocaleString()} د.ل`,
        isOverdue ? `الحالة: متأخرة منذ ${diffDays} يوم` : (diffDays === 0 ? `الحالة: تستحق اليوم` : `الحالة: قادمة (متبقي ${Math.abs(diffDays)} يوم)`),
        inv.notes ? `ملاحظات: ${inv.notes}` : '',
      ].filter(Boolean).join('\n');

      events.push({
        id: `inv-${invNum}`,
        tag: `[ADHUB:INV:${invNum}]`,
        type: 'invoice',
        title,
        description,
        startDate: invoiceDateStr,
        allDay: false,
        alertTime,
        invoiceNumber: invNum,
        invoiceName: inv.invoice_name || undefined,
        serviceLabel: serviceLabelFromItems(inv.items),
        invoiceId: inv.id,
        customerName,
        customerId: inv.customer_id,
        customerEmail,
        amount: remainingAmount,
        totalAmount,
        paidAmount,
        adType: 'فاتورة مبيعات',
        daysRemainingOrOverdue: diffDays,
        isOverdue,
        isContractActive: !isPaid,
        statusText: isOverdue ? `متأخرة ${diffDays} يوم` : (diffDays === 0 ? `تستحق اليوم` : `متبقي ${Math.abs(diffDays)} يوم`),
      });
    });
  }

  // Sort events chronologically by startDate
  return events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

/**
 * Generate a 1-click Google Calendar web link for an event with guests (emails) and scheduled alert time
 */
export function generateGoogleCalendarWebUrl(
  event: {
    title: string;
    description: string;
    startDate: string;
    endDate?: string;
    alertTime?: string;
    allDay?: boolean;
    location?: string;
    customerEmail?: string;
  },
  guestEmails: string[] = []
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const formattedStart = event.startDate.replace(/-/g, '');

  let datesParam = '';
  if (event.allDay === true && !event.alertTime) {
    // For all-day events, Google Calendar expects end date as the following day (exclusive)
    const baseDate = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
    baseDate.setDate(baseDate.getDate() + 1);
    const formattedEnd = `${baseDate.getFullYear()}${pad(baseDate.getMonth() + 1)}${pad(baseDate.getDate())}`;
    datesParam = `${formattedStart}/${formattedEnd}`;
  } else {
    // Timed event based on alertTime (default 12:00 PM)
    const timeStr = event.alertTime || '12:00';
    const [hStr, mStr] = timeStr.split(':');
    const hour = parseInt(hStr, 10) || 12;
    const min = parseInt(mStr, 10) || 0;
    const endHour = (hour + 1) % 24;

    const startT = `${pad(hour)}${pad(min)}00`;
    const endT = `${pad(endHour)}${pad(min)}00`;
    datesParam = `${formattedStart}T${startT}/${formattedStart}T${endT}`;
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: datesParam,
    details: event.description,
    location: event.location || 'الفارس الذهبي للدعاية والإعلان',
  });

  const allGuests = Array.from(
    new Set([
      ...guestEmails,
      ...(event.customerEmail ? [event.customerEmail] : []),
    ])
  ).filter(e => e && e.includes('@'));

  if (allGuests.length > 0) {
    params.set('add', allGuests.join(','));
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* ── تشخيص أخطاء الإرسال وترجمتها لسبب واضح ── */
export function explainCalendarError(raw: string): string {
  const m = String(raw || '');
  if (isCalendarRateLimit(m)) return formatGoogleRateLimitError(m);
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m))
    return 'تعذر الوصول إلى سكريبت Google: تأكد من الاتصال بالإنترنت، وأن الرابط ينتهي بـ /exec، وأن النشر مضبوط على «Who has access: Anyone».';
  if (/action not allowed/i.test(m)) return 'رفض Google إضافة الضيوف لهذا الموعد (Action not allowed) — غالبًا بريد غير صالح أو تجاوز حد الدعوات اليومي.';
  if (/invalid argument.*guest|invalid email|invalid.*email/i.test(m)) return 'بريد إلكتروني غير صالح ضمن المستلمين أو بريد الزبون. ' + m;
  if (/authorization|not have permission|لا يملك|صلاحي/i.test(m)) return 'السكريبت يحتاج إعادة منح الصلاحيات: افتحه في script.google.com، شغّل أي دالة واقبل الصلاحيات، ثم انشر نسخة جديدة. ' + m;
  if (/calendar api|has not been used|is disabled/i.test(m)) return 'خدمة Google Calendar API غير مفعّلة في مشروع السكريبت (مطلوبة لإرسال دعوات الزبون). ' + m;
  return m;
}

const CAL_LOG_KEY = 'gcal-sync-log';
export interface CalendarSyncLogEntry { at: string; source: string; ok: boolean; sent: number; total: number; error?: string; failed?: CalendarSyncFailure[] }
export function getCalendarSyncLog(): CalendarSyncLogEntry[] {
  try { return JSON.parse(localStorage.getItem(CAL_LOG_KEY) || '[]') || []; } catch { return []; }
}
export function addCalendarSyncLog(entry: Omit<CalendarSyncLogEntry, 'at'>) {
  try {
    const list = [{ ...entry, at: new Date().toISOString() }, ...getCalendarSyncLog()].slice(0, 40);
    localStorage.setItem(CAL_LOG_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('gcal-sync-log'));
  } catch { /* التخزين غير متاح */ }
}
export function clearCalendarSyncLog() {
  try { localStorage.removeItem(CAL_LOG_KEY); window.dispatchEvent(new Event('gcal-sync-log')); } catch { /* ignore */ }
}

/** طلب للسكريبت مع رسائل واضحة عند انقطاع الشبكة أو رجوع صفحة دخول بدل JSON */
async function postToCalendarScript(url: string, payload: unknown): Promise<{ status: number; ok: boolean; data: any }> {
  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
  } catch (e: any) {
    throw new Error(explainCalendarError(e?.message || 'Failed to fetch'));
  }
  if (response.status === 429) return { status: 429, ok: false, data: { success: false, rateLimited: true, error: 'Google Rate Limit' } };
  if (typeof response.text !== 'function') return { status: response.status, ok: response.ok, data: await response.json() };
  const text = await response.text();
  try {
    return { status: response.status, ok: response.ok, data: JSON.parse(text) };
  } catch {
    if (/<html|<!doctype/i.test(text)) {
      throw new Error(/doPost|Script function not found/i.test(text)
        ? 'السكريبت المنشور لا يحتوي دالة doPost: الصق كود التقويم كاملاً وانشر نسخة جديدة.'
        : 'رجع Google صفحة ويب بدل الرد (' + response.status + '): النشر غالبًا ليس «Anyone» أو الرابط لنسخة قديمة/محذوفة. أعد النشر وانسخ رابط /exec الجديد.');
    }
    throw new Error('استجابة غير صحيحة من سكريبت جوجل (' + response.status + ')');
  }
}

function isCalendarRateLimit(message: string) {
  return /rate.?limit|too many|quota|كبيرًا جدًا|الحد الأقصى/i.test(message);
}
function formatGoogleRateLimitError(message: string): string {
  return isCalendarRateLimit(message)
    ? 'وصل حساب Google إلى حد العمليات (Google Rate Limit). تم إيقاف المزامنة مؤقتًا؛ مدة رفع القيد تحددها Google وقد تختلف. استأنف لاحقًا دون تكرار الضغط.'
    : message;
}
const calendarBackoff = new Map<string, { until: number; attempts: number }>();
const calendarRequests = new Set<string>();
export function getCalendarRetrySeconds(url: string) {
  return Math.max(0, Math.ceil(((calendarBackoff.get(url)?.until || 0) - Date.now()) / 1000));
}
function pauseCalendarSync(url: string) {
  const attempts = (calendarBackoff.get(url)?.attempts || 0) + 1;
  calendarBackoff.set(url, { attempts, until: Date.now() + Math.min(900000, 60000 * 2 ** Math.min(attempts - 1, 4)) });
}
/* ── مزامنة تزايدية: لا يُرسل إلا الموعد الجديد أو المتغير منذ آخر مزامنة ناجحة ── */
const SYNCED_KEY = (url: string) => `gcal-synced:${url}`;
export function calendarEventFingerprint(e: GoogleCalendarEvent, config: GoogleCalendarConfig): string {
  const raw = [e.tag, e.title, e.description, e.startDate, e.endDate || '', e.amount ?? '', e.alertTime || config.alertTime || '', e.designUrl || '', e.customerEmail || '', (config.reminders || []).join(','), (config.emails || []).join(',')].join('|');
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  return String(h);
}
function readSynced(url: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SYNCED_KEY(url)) || '{}') || {}; } catch { return {}; }
}
function markEventsSynced(config: GoogleCalendarConfig, events: GoogleCalendarEvent[]) {
  try {
    const map = readSynced(config.scriptUrl);
    events.forEach(e => { map[e.tag || e.id] = calendarEventFingerprint(e, config); });
    localStorage.setItem(SYNCED_KEY(config.scriptUrl), JSON.stringify(map));
  } catch { /* التخزين غير متاح: تُرسل كل المواعيد كما في السابق */ }
}
/** المواعيد الجديدة أو التي تغيرت (العنوان/التاريخ/المبلغ/التنبيه...) منذ آخر مزامنة */
export function filterChangedCalendarEvents(config: GoogleCalendarConfig, events: GoogleCalendarEvent[]): GoogleCalendarEvent[] {
  const map = readSynced(config.scriptUrl);
  return events.filter(e => map[e.tag || e.id] !== calendarEventFingerprint(e, config));
}
export function resetCalendarSyncMemory(config: GoogleCalendarConfig) {
  try { localStorage.removeItem(SYNCED_KEY(config.scriptUrl)); } catch { /* ignore */ }
}

export async function syncEventsToGoogleCalendar(config: GoogleCalendarConfig, events: GoogleCalendarEvent[], targetEmails?: string[], options?: SyncOptions): Promise<SyncResult> {
  if (calendarRequests.has(config.scriptUrl)) throw new Error('توجد مزامنة قيد التنفيذ. انتظر اكتمالها.');
  if (getCalendarRetrySeconds(config.scriptUrl)) throw new Error('يرجى الانتظار ' + getCalendarRetrySeconds(config.scriptUrl) + ' ثانية قبل إعادة محاولة المزامنة.');
  calendarRequests.add(config.scriptUrl);
  try { return await performCalendarSync(config, events, targetEmails, options); }
  finally { calendarRequests.delete(config.scriptUrl); }
}

/**
 * Send events to Google Apps Script Webhook with safe chunking and rate-limit handling
 */
async function performCalendarSync(
  config: GoogleCalendarConfig,
  events: GoogleCalendarEvent[],
  targetEmails?: string[],
  options?: SyncOptions
): Promise<SyncResult> {
  if (!config.scriptUrl || !config.scriptUrl.startsWith('https://script.google.com/')) {
    throw new Error('يرجى إدخال رابط Google Apps Script Web App صالح');
  }

  // Shared recipients are company recipients only; each customer belongs to their own event.
  const combinedEmails = Array.from(new Set([...(targetEmails || []), ...config.emails]))
    .filter(em => em && em.includes('@'));

  const startIndex = options?.startIndex || 0;
  const activeEvents = startIndex > 0 ? events.slice(startIndex) : events;
  if (activeEvents.length === 0) {
    return {
      success: true,
      createdCount: 0,
      updatedCount: 0,
      deletedCount: 0,
      totalProcessed: events.length,
    };
  }

  const BATCH_SIZE = Math.max(1, Math.min(15, Math.floor(options?.batchSize || 5)));
  const delayBetweenBatches = options?.delayMs ?? 2500;

  // Chunk large lists into gentle batches to protect Google Calendar quotas
  const batches: GoogleCalendarEvent[][] = [];
  for (let i = 0; i < activeEvents.length; i += BATCH_SIZE) {
    batches.push(activeEvents.slice(i, i + BATCH_SIZE));
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;
  let totalProcessed = 0;
  const failedAll: CalendarSyncFailure[] = [];

  for (let bIndex = 0; bIndex < batches.length; bIndex++) {
    const batchEvents = batches[bIndex];
    const isFirstBatch = bIndex === 0 && startIndex === 0;

    options?.onProgress?.({
      currentBatch: bIndex + 1,
      totalBatches: batches.length,
      processed: startIndex + totalProcessed,
      total: events.length,
    });

    const payload = {
      action: 'sync',
      sendInvites: options?.sendInvites === true,
      cleanOld: isFirstBatch ? (options?.cleanOld ?? false) : false,
      events: batchEvents.map(e => ({
        customerEmail: e.customerEmail,
        designUrl: e.designUrl,
        customerName: e.customerName,
        reference: e.contractNumber ?? e.invoiceNumber ?? '',
        amount: e.amount,
        tag: e.tag,
        title: e.title,
        description: e.description,
        startDate: e.startDate,
        endDate: e.endDate || e.startDate,
        allDay: false,
        alertTime: e.alertTime || config.alertTime || '12:00',
        location: e.location || 'الفارس الذهبي للدعاية والإعلان',
      })),
      emails: combinedEmails,
      reminders: config.reminders,
    };

    const { status, ok, data: result } = await postToCalendarScript(config.scriptUrl, payload);
    if (!ok && !result.rateLimited && !isCalendarRateLimit(result.error || '')) {
      throw new Error('استجابة غير صحيحة من سكريبت جوجل (' + status + ')');
    }
    if (!result.success) {
      const errStr = result.error || '';
      const isRate = result.rateLimited || isCalendarRateLimit(errStr);
      if (isRate) {
        pauseCalendarSync(config.scriptUrl);
        const partial = Math.min(batchEvents.length, Math.max(0, Number(result.totalProcessed) || 0));
        totalProcessed += partial;
        totalCreated += Number(result.createdCount) || 0;
        totalUpdated += Number(result.updatedCount) || 0;
        totalDeleted += Number(result.deletedCount) || 0;
        return {
          success: false,
          createdCount: totalCreated,
          updatedCount: totalUpdated,
          deletedCount: totalDeleted,
          totalProcessed: startIndex + totalProcessed,
          rateLimited: true,
          lastProcessedIndex: startIndex + totalProcessed,
          error: formatGoogleRateLimitError(errStr),
        };
      }
      // السكريبت القديم يتوقف عند أول موعد فاشل: احفظ ما نجح قبله وسمِّ الموعد المسبب
      const done = Math.min(batchEvents.length, Math.max(0, Number(result.totalProcessed) || 0));
      if (done) markEventsSynced(config, batchEvents.slice(0, done));
      const bad = batchEvents[done];
      const reason = explainCalendarError(errStr || 'حدث خطأ أثناء المزامنة في سكريبت جوجل');
      const err = new Error(bad ? `فشل عند الموعد «${bad.title}»${bad.customerName ? ' — ' + bad.customerName : ''}: ${reason}` : reason) as Error & { syncResult?: SyncResult };
      err.syncResult = {
        success: false, createdCount: totalCreated + (Number(result.createdCount) || 0), updatedCount: totalUpdated + (Number(result.updatedCount) || 0),
        deletedCount: totalDeleted, totalProcessed: startIndex + totalProcessed + done, lastProcessedIndex: startIndex + totalProcessed + done, error: reason,
        failed: bad ? [{ tag: bad.tag, title: bad.title, customerName: bad.customerName, error: reason }] : [],
      };
      throw err;
    }

    if (options?.sendInvites && result.invitationsSupported !== true) throw new Error('السكريبت المنشور قديم: حدّث كود التقويم وانشر إصدارًا جديدًا لتفعيل إرسال دعوات الزبون.');
    totalCreated += result.createdCount || 0;
    totalUpdated += result.updatedCount || 0;
    totalDeleted += result.deletedCount || 0;
    totalProcessed += batchEvents.length;
    // السكريبت الجديد يكمل بعد الموعد الفاشل ويُرجع قائمة failed: لا تُعلَّم كمُرسلة
    const batchFailed: CalendarSyncFailure[] = Array.isArray(result.failed) ? result.failed.map((f: any) => {
      const ev = batchEvents.find(e => e.tag && e.tag === f.tag);
      return { tag: f.tag, title: f.title || ev?.title || '', customerName: ev?.customerName, error: explainCalendarError(f.error || '') };
    }) : [];
    failedAll.push(...batchFailed);
    const failedTags = new Set(batchFailed.map(f => f.tag).filter(Boolean));
    markEventsSynced(config, batchEvents.filter(e => !failedTags.has(e.tag)));

    options?.onProgress?.({
      currentBatch: bIndex + 1,
      totalBatches: batches.length,
      processed: startIndex + totalProcessed,
      total: events.length,
    });

    // Polite pause between batches
    if (bIndex < batches.length - 1) {
      await new Promise(r => setTimeout(r, delayBetweenBatches));
    }
  }

  calendarBackoff.delete(config.scriptUrl);
  const updatedConfig = { ...config, lastSync: new Date().toISOString() };
  await saveCalendarConfig(updatedConfig);

  return {
    success: true,
    createdCount: totalCreated,
    updatedCount: totalUpdated,
    deletedCount: totalDeleted,
    totalProcessed: events.length,
    failed: failedAll,
  };
}

/**
 * Clean old past events and duplicates from Google Calendar via webhook
 */
export async function cleanOldGoogleCalendarEvents(
  config: GoogleCalendarConfig
): Promise<{ success: boolean; deletedCount: number; message: string }> {
  if (!config.scriptUrl || !config.scriptUrl.startsWith('https://script.google.com/')) {
    throw new Error('يرجى حفظ رابط Google Apps Script أولاً');
  }

  const payload = {
    action: 'clean_old',
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
    throw new Error(formatGoogleRateLimitError(result.error || 'فشل تنظيف المواعيد القديمة'));
  }

  return {
    success: true,
    deletedCount: result.deletedCount || 0,
    message: result.message || `تم تنظيف وحذف ${result.deletedCount || 0} موعد قديم ومكرر من تقويم Google بنجاح`,
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

  const { status, ok, data: result } = await postToCalendarScript(config.scriptUrl, payload);
  if (!ok) throw new Error(`استجابة غير صحيحة من سكريبت جوجل (${status})`);
  if (!result.success) {
    throw new Error(explainCalendarError(result.error || 'فشل إرسال الحدث التجريبي'));
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
    const timeStr = event.alertTime || '12:00';
    const [hStr, mStr] = timeStr.split(':');
    const hour = String(parseInt(hStr, 10) || 12).padStart(2, '0');
    const min = String(parseInt(mStr, 10) || 0).padStart(2, '0');
    const endHour = String(((parseInt(hStr, 10) || 12) + 1) % 24).padStart(2, '0');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.tag.replace(/[^a-zA-Z0-9]/g, '') || event.id}@adhub-pro.ly`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${startDateClean}T${hour}${min}00`);
    lines.push(`DTEND:${startDateClean}T${endHour}${min}00`);
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
 * المميزات المتطورة:
 * 1. مزامنة ذكية وهادئة تراعي كوتة وحدود تقويم جوجل (Google Calendar Quota Protection)
 * 2. تخطي تلقائي للمواعيد غير المتغيرة لتوفير عمليات الـ API وتجنب الحظر المؤقت
 * 3. حذف هادئ ومقنن للمواعيد القديمة والمكررة (بحد أقصى آمن مع فواصل زمنية)
 * 4. إرسال دعوات الزبون عند طلبها فقط، وتجنب تكرار الدعوة للمستلمين أنفسهم
 * 5. دعم كامل لتنبيهات مسؤولي الشركة وبريد العميل
 *
 * تعليمات النشر:
 * 1. افتح https://script.google.com
 * 2. اضغط "مشروع جديد" (New project) أو افتح مشروعك الحالي
 * 3. امسح الكود القديم والصق هذا الكود بالكامل
 * 4. اضغط "نشر" (Deploy) -> "إدارة عمليات النشر" (Manage deployments) -> "نسخة جديدة" (New version)
 * 5. تأكد من ضبط الصلاحيات:
 *    - Execute as: Me (حسابي)
 *    - Who has access: Anyone (أي شخص)
 * 6. انسخ رابط الويب (Web App URL) والصقه في صفحة إعدادات تقويم جوجل في لوحة AdHub
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
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    // 1. اختبار الاتصال
    if (action === 'test') {
      var testDate = new Date(now.getTime() + 60 * 60 * 1000);
      var guestsString = emails.filter(function(em) { return em && em.indexOf('@') !== -1; }).join(',');

      var testEvent = calendar.createEvent(
        'تجربة اتصال تقويم الفارس الذهبي - AdHub',
        now,
        testDate,
        {
          description: 'تم إرسال هذا الإشعار التجريبي للتأكد من نجاح ربط تنبيهات العقود والدفعات مع Google Calendar.\\n\\nالإيميلات المستلمة: ' + emails.join(', '),
          guests: guestsString,
          sendInvites: false
        }
      );

      testEvent.addPopupReminder(15);
      testEvent.addEmailReminder(15);

      return responseJSON({
        success: true,
        message: 'تم إنشاء حدث تجريبي بنجاح في تقويم Google: ' + emails.join(', '),
        eventId: testEvent.getId()
      });
    }

    // 2. تنظيف وحذف المواعيد القديمة والمكررة بحذر
    if (action === 'clean_old') {
      var cleanedCount = purgePastAndDuplicateAdHubEvents(calendar, todayStart, null, 25);
      return responseJSON({
        success: true,
        deletedCount: cleanedCount,
        message: 'تم تنظيف وحذف ' + cleanedCount + ' موعد قديم ومكرر من تقويم Google بنجاح'
      });
    }

    // 3. مزامنة الأحداث القادمة مع حماية الكوتة
    var events = data.events || [];
    var reminders = data.reminders || [1440, 4320];
    var processedCount = 0;
    var failed = [];
    var createdCount = 0;
    var updatedCount = 0;
    var deletedCount = 0;
    var validEmails = emails.filter(function(em) { return em && em.indexOf('@') !== -1; });
    var guestsString = validEmails.join(',');

    // بناء قائمة وسوم المواعيد الواردة
    var incomingTagsMap = {};
    for (var t = 0; t < events.length; t++) {
      if (events[t].tag) {
        incomingTagsMap[events[t].tag] = true;
      }
    }

    // خطوة 1: حذف المواعيد القديمة والمكررة بمعدل آمن ومحدود (بحد أقصى 15 موعد في كل طلب)
    if (data.cleanOld === true) {
      deletedCount += purgePastAndDuplicateAdHubEvents(calendar, todayStart, incomingTagsMap, 15);
    }

    // خطوة 2: مزامنة المواعيد القادمة وتحديثها فقط عند التغيير
    for (var i = 0; i < events.length; i++) {
      var item = events[i];
      try {
        var eventEmails = validEmails.slice();
        if (item.customerEmail && item.customerEmail.indexOf('@') !== -1 && eventEmails.indexOf(item.customerEmail) === -1) eventEmails.push(item.customerEmail);
        var eventGuestsString = eventEmails.join(',');
        var tag = item.tag || '';
        var startDateParts = item.startDate.split('-');
        var startDate = new Date(parseInt(startDateParts[0]), parseInt(startDateParts[1]) - 1, parseInt(startDateParts[2]));

        var existingEvent = null;
        if (tag) {
          var searchRangeStart = new Date(startDate.getTime() - 45 * 24 * 60 * 60 * 1000);
          var searchRangeEnd = new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000);
          var foundEvents = calendar.getEvents(searchRangeStart, searchRangeEnd, { search: tag });
          if (foundEvents && foundEvents.length > 0) {
            existingEvent = foundEvents[0];
            // حذف أي نسخ مكررة إضافية من نفس الموعد بهدوء
            for (var d = 1; d < foundEvents.length && d <= 3; d++) {
              try {
                foundEvents[d].deleteEvent();
                deletedCount++;
                Utilities.sleep(120);
              } catch (delErr) {}
            }
          }
        }

        var reminderSignature = JSON.stringify({ reminders: reminders, emails: eventEmails });
        var fullDescription = (item.description || '') + '\\n\\n' + tag + '\\n[ADHUB:SETTINGS:' + reminderSignature + ']';

        // ضبط وقت التنبيه بدقة (افتراضياً الساعة 12:00 ظهراً)
        var alertTime = item.alertTime || '12:00';
        var timeParts = alertTime.split(':');
        var hours = parseInt(timeParts[0], 10);
        if (isNaN(hours)) hours = 12;
        var minutes = parseInt(timeParts[1], 10);
        if (isNaN(minutes)) minutes = 0;
        var eventStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), hours, minutes, 0);
        var eventEnd = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), hours + 1, minutes, 0);

        if (existingEvent) {
          // التحقق من وجود تغيير فعلي قبل استدعاء Google API لتوفير الكوتة
          var curTitle = existingEvent.getTitle();
          var curDesc = existingEvent.getDescription();
          if (curTitle !== item.title || curDesc !== fullDescription || existingEvent.getStartTime().getTime() !== eventStart.getTime() || existingEvent.getEndTime().getTime() !== eventEnd.getTime() || existingEvent.getLocation() !== (item.location || '')) {
            try {
              existingEvent.setTitle(item.title);
              existingEvent.setDescription(fullDescription);
              if (item.location) existingEvent.setLocation(item.location);
              existingEvent.setTime(eventStart, eventEnd);
              setupRemindersAndGuests(existingEvent, reminders, eventEmails);
              updatedCount++;
              Utilities.sleep(120);
            } catch (updateErr) {
              throw updateErr;
            }
          }
        } else {
          // إنشاء موعد جديد مع حماية ضد تقييد دعوات الضيوف
          var newEvent = null;
          try {
            newEvent = calendar.createEvent(item.title, eventStart, eventEnd, {
              description: fullDescription,
              location: item.location || 'الفارس الذهبي للدعاية والإعلان',
              guests: eventGuestsString,
              sendInvites: data.sendInvites === true
            });
            if (data.sendInvites === true) newEvent.setTag('adhubInvited', invitationSignature(eventEmails));
            setupRemindersAndGuests(newEvent, reminders, eventEmails);
            createdCount++;
            Utilities.sleep(140);
          } catch (createErr) {
            if (data.sendInvites === true || isRateLimitError(createErr)) throw createErr;
            // إذا كان سبب الخطأ تقييد Google للضيوف (Action not allowed)، يتم إنشاء الموعد بدون ضيوف
            try {
              newEvent = calendar.createEvent(item.title, eventStart, eventEnd, {
                description: fullDescription,
                location: item.location || 'الفارس الذهبي للدعاية والإعلان'
              });
              setupRemindersAndGuests(newEvent, reminders, []);
              createdCount++;
              Utilities.sleep(140);
            } catch (fallbackErr) {
              throw fallbackErr;
            }
          }
        }
        if (data.sendInvites === true && existingEvent) sendExistingInvitations(calendar, existingEvent, eventEmails);
        if (!existingEvent && !newEvent) throw new Error('لم يتم إنشاء الموعد');
        try {
          registerDesignEmail(existingEvent || newEvent, item, reminders, eventEmails);
        } catch (regErr) {}
        processedCount++;
      } catch (itemErr) {
        // حد Google يوقف الدفعة؛ أي خطأ آخر يُسجَّل لهذا الموعد ونكمل الباقي
        if (isRateLimitError(itemErr)) throw itemErr;
        failed.push({ tag: item.tag || '', title: item.title || '', error: String(itemErr) });
        processedCount++;
      }
    }

    return responseJSON({
      success: true,
      createdCount: createdCount,
      updatedCount: updatedCount,
      deletedCount: deletedCount,
      totalProcessed: processedCount,
      failed: failed,
      invitationsSupported: true
    });

  } catch (error) {
    var errString = error.toString();
    var isRateLimit = isRateLimitError(error);

    return responseJSON({
      success: false,
      rateLimited: isRateLimit,
      totalProcessed: processedCount || 0,
      createdCount: createdCount || 0,
      updatedCount: updatedCount || 0,
      deletedCount: deletedCount || 0,
      error: isRateLimit
        ? 'وصل الحساب إلى حد عمليات Google Calendar. انتظر ثم استأنف؛ مدة رفع القيد تحددها Google وليست ثابتة.'
        : errString
    });
  }
}

function isRateLimitError(err) {
  if (!err) return false;
  return /rate.?limit|too many|quota|كبيرًا جدًا|الحد الأقصى/i.test(err.toString());
}

/**
 * دالة حذف المواعيد القديمة السابقة لليوم وحذف النسخ المكررة مع حماية صارمة للكوتة
 */
function purgePastAndDuplicateAdHubEvents(calendar, todayStart, validUpcomingTagsMap, maxLimit) {
  var count = 0;
  var limit = maxLimit || 20;
  try {
    // 1. البحث في الماضي القريب (آخر 30 يوماً فقط بدلاً من 180 يوماً لتجنب إغراق الخادم)
    var pastSearchStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    var pastEvents = calendar.getEvents(pastSearchStart, todayStart, { search: 'ADHUB' });
    for (var p = 0; p < pastEvents.length && count < limit; p++) {
      try {
        var pDesc = pastEvents[p].getDescription() || '';
        var pTitle = pastEvents[p].getTitle() || '';
        if (pDesc.indexOf('ADHUB') !== -1 || pTitle.indexOf('AdHub') !== -1 || pDesc.indexOf('[ADHUB:') !== -1) {
          pastEvents[p].deleteEvent();
          count++;
          Utilities.sleep(120);
        }
      } catch (e1) {
        if (isRateLimitError(e1)) return count;
      }
    }

    // 2. تنظيف المواعيد المكررة في الأيام القادمة فقط (تغطية عام كامل حتى 365 يوماً)
    if (count < limit) {
      var futureSearchEnd = new Date(todayStart.getTime() + 365 * 24 * 60 * 60 * 1000);
      var upcomingEvents = calendar.getEvents(todayStart, futureSearchEnd, { search: 'ADHUB' });
      var seenTags = {};
      for (var u = 0; u < upcomingEvents.length && count < limit; u++) {
        try {
          var uDesc = upcomingEvents[u].getDescription() || '';
          var tagMatch = uDesc.match(/\\[ADHUB:[^\\]]+\\]/);
          if (tagMatch && tagMatch[0]) {
            var tag = tagMatch[0];
            // حذف النسخ المكررة من نفس الوسم
            if (seenTags[tag]) {
              upcomingEvents[u].deleteEvent();
              count++;
              Utilities.sleep(120);
            } else {
              seenTags[tag] = true;
            }
          }
        } catch (e2) {
          if (isRateLimitError(e2)) return count;
        }
      }
    }
  } catch (err) {}
  return count;
}

function setupRemindersAndGuests(event, reminders, emails) {
  var desired = reminders.filter(function(n) { return n >= 5 && n <= 40320; }).sort(function(a, b) { return a - b; });
  var popups = event.getPopupReminders().sort(function(a, b) { return a - b; });
  var mail = event.getEmailReminders().sort(function(a, b) { return a - b; });
  if (JSON.stringify(popups) !== JSON.stringify(desired) || JSON.stringify(mail) !== JSON.stringify(desired)) {
    event.removeAllReminders();
    for (var r = 0; r < desired.length; r++) {
      event.addPopupReminder(desired[r]);
      event.addEmailReminder(desired[r]);
    }
  }
  var currentGuests = event.getGuestList().map(function(g) { return g.getEmail().toLowerCase(); });
  for (var g = 0; g < emails.length; g++) {
    var email = emails[g].trim().toLowerCase();
    if (currentGuests.indexOf(email) === -1) { event.addGuest(email); currentGuests.push(email); }
  }
}

${CALENDAR_INVITATIONS_SCRIPT}

${DESIGN_EMAIL_SCRIPT}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
}

/**
 * Save or update customer alert email in customers table
 */
export async function updateCustomerAlertEmail(customerId: string, email: string): Promise<boolean> {
  const cleanEmail = email.trim();
  const { error } = await supabase
    .from('customers')
    .update({ email: cleanEmail || null })
    .eq('id', customerId);

  if (error) {
    console.error('Failed to update customer alert email:', error);
    throw error;
  }
  return true;
}
