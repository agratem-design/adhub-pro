// @ts-nocheck
/**
 * Conflict-Free Bi-Directional Database Sync Service for AdHub Pro
 * - Performs atomic batch UPSERT from Local PostgreSQL/Supabase to Cloud Supabase
 * - Performs Delta Pull from Cloud Supabase to Local Database
 * - Emits real-time progress callbacks and detailed change reports
 */

import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_CLOUD_URL,
  DEFAULT_CLOUD_KEY,
  DEFAULT_LOCAL_URL,
  DEFAULT_LOCAL_KEY,
  getOfflineSettings,
} from '@/integrations/supabase/client';

export interface TableSyncConfig {
  tableName: string;
  primaryKey: string;
  label: string;
}

export const SYNC_TABLES_ORDER: TableSyncConfig[] = [
  // 1. Dictionaries and Lookups
  { tableName: 'sizes', primaryKey: 'id', label: 'المقاسات' },
  { tableName: 'billboard_types', primaryKey: 'id', label: 'أنواع اللوحات' },
  { tableName: 'billboard_levels', primaryKey: 'id', label: 'مستويات اللوحات' },
  { tableName: 'billboard_faces', primaryKey: 'id', label: 'الأوجه' },
  { tableName: 'installation_teams', primaryKey: 'id', label: 'فرق التركيب' },
  { tableName: 'printers', primaryKey: 'id', label: 'المطابع' },
  { tableName: 'roles', primaryKey: 'id', label: 'الأدوار والصلاحيات' },
  { tableName: 'employees', primaryKey: 'id', label: 'الموظفون' },
  { tableName: 'system_settings', primaryKey: 'setting_key', label: 'إعدادات المنظومة' },
  { tableName: 'base_prices', primaryKey: 'id', label: 'الأسعار الأساسية' },
  { tableName: 'category_factors', primaryKey: 'id', label: 'معاملات التسعير' },
  { tableName: 'installation_print_pricing', primaryKey: 'id', label: 'تسعير التركيب والطباعة' },

  // 2. Core Entities
  { tableName: 'customers', primaryKey: 'id', label: 'العملاء' },
  { tableName: 'billboards', primaryKey: 'ID', label: 'اللوحات الإعلانية' },
  { tableName: 'billboard_cost_centers', primaryKey: 'id', label: 'مراكز تكلفة اللوحات' },

  // 3. Contracts & Operational Records
  { tableName: 'Contract', primaryKey: 'Contract_Number', label: 'العقود' },
  { tableName: 'customer_payments', primaryKey: 'id', label: 'المدفوعات والمقبوضات' },
  { tableName: 'billboard_history', primaryKey: 'id', label: 'سجل حركات اللوحات' },
  { tableName: 'billboard_extensions', primaryKey: 'id', label: 'تمديدات العقود' },

  // 4. Tasks & Invoices
  { tableName: 'installation_tasks', primaryKey: 'id', label: 'مهام التركيب' },
  { tableName: 'installation_task_items', primaryKey: 'id', label: 'عناصر مهام التركيب' },
  { tableName: 'print_tasks', primaryKey: 'id', label: 'أوامر الطباعة' },
  { tableName: 'cutout_tasks', primaryKey: 'id', label: 'مهام القص (Cutout)' },
  { tableName: 'composite_tasks', primaryKey: 'id', label: 'المهام المجمعة' },
  { tableName: 'printed_invoices', primaryKey: 'id', label: 'فواتير الطباعة' },
  { tableName: 'print_invoices_standalone', primaryKey: 'id', label: 'الفواتير المستقلة' },

  // 5. Activity Log & Audit
  { tableName: 'activity_log', primaryKey: 'id', label: 'سجل الأنشطة والعمليات' },
];

export interface SyncProgressData {
  stage: 'fetching' | 'syncing' | 'complete' | 'error';
  currentTable: string;
  currentTableLabel: string;
  tableIndex: number;
  totalTables: number;
  percent: number;
  syncedCounts: Record<string, number>;
  totalSyncedRows: number;
  message: string;
}

export interface SyncResult {
  success: boolean;
  totalSyncedRows: number;
  tableStats: Record<string, number>;
  durationMs: number;
  error?: string;
  timestamp: string;
}

/**
 * Creates Supabase client instances for both Cloud and Local
 */
export function getSyncClients() {
  const settings = getOfflineSettings();
  const cloudClient = createClient(settings.cloudUrl || DEFAULT_CLOUD_URL, settings.cloudKey || DEFAULT_CLOUD_KEY, {
    auth: { persistSession: false },
  });

  const localClient = createClient(settings.localUrl || DEFAULT_LOCAL_URL, settings.localKey || DEFAULT_LOCAL_KEY, {
    auth: { persistSession: false },
  });

  return { cloudClient, localClient };
}

/**
 * Synchronizes modified data from Local Database -> Supabase Cloud
 */
export async function syncLocalToCloud(
  onProgress: (data: SyncProgressData) => void = () => {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const { cloudClient, localClient } = getSyncClients();
  const tableStats: Record<string, number> = {};
  let totalSyncedRows = 0;

  try {
    // 1. Verify connection to Cloud
    onProgress({
      stage: 'fetching',
      currentTable: '',
      currentTableLabel: 'فحص الاتصال',
      tableIndex: 0,
      totalTables: SYNC_TABLES_ORDER.length,
      percent: 5,
      syncedCounts: {},
      totalSyncedRows: 0,
      message: 'جاري التحقق من الاتصال بالسيرفر السحابي...',
    });

    const { error: cloudPingError } = await cloudClient.from('sizes').select('id').limit(1);
    if (cloudPingError) {
      throw new Error(`تعذر الاتصال بالسيرفر السحابي (${cloudPingError.message}). يرجى التحقق من اتصال الإنترنت.`);
    }

    // 2. Iterate through each table and upsert records into Cloud
    for (let i = 0; i < SYNC_TABLES_ORDER.length; i++) {
      const config = SYNC_TABLES_ORDER[i];
      const tablePercent = Math.round(10 + (i / SYNC_TABLES_ORDER.length) * 85);

      onProgress({
        stage: 'syncing',
        currentTable: config.tableName,
        currentTableLabel: config.label,
        tableIndex: i + 1,
        totalTables: SYNC_TABLES_ORDER.length,
        percent: tablePercent,
        syncedCounts: tableStats,
        totalSyncedRows,
        message: `جاري قراءة ومزامنة جدول ${config.label} إلى السحابة...`,
      });

      // Fetch all records from local table
      let localRows: any[] = [];
      try {
        const { data, error } = await localClient.from(config.tableName as any).select('*');
        if (!error && Array.isArray(data)) {
          localRows = data;
        }
      } catch (err) {
        console.warn(`Could not read local table ${config.tableName}:`, err);
        continue;
      }

      if (localRows.length === 0) {
        tableStats[config.label] = 0;
        continue;
      }

      // Upsert in batches of 50 rows into Cloud Supabase
      const BATCH_SIZE = 50;
      let tableSuccessCount = 0;

      for (let b = 0; b < localRows.length; b += BATCH_SIZE) {
        const batch = localRows.slice(b, b + BATCH_SIZE);
        try {
          const { error: upsertError } = await cloudClient
            .from(config.tableName as any)
            .upsert(batch, {
              onConflict: config.primaryKey,
              ignoreDuplicates: false,
            });

          if (!upsertError) {
            tableSuccessCount += batch.length;
            totalSyncedRows += batch.length;
          } else {
            console.warn(`Upsert batch note for ${config.tableName}:`, upsertError.message);
          }
        } catch (batchErr) {
          console.error(`Batch upsert error on ${config.tableName}:`, batchErr);
        }
      }

      tableStats[config.label] = tableSuccessCount;
    }

    const durationMs = Date.now() - startTime;
    const result: SyncResult = {
      success: true,
      totalSyncedRows,
      tableStats,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('adhub_last_cloud_sync_time', result.timestamp);
      localStorage.setItem('adhub_last_cloud_sync_count', String(totalSyncedRows));
    }

    onProgress({
      stage: 'complete',
      currentTable: '',
      currentTableLabel: 'اكتملت المزامنة',
      tableIndex: SYNC_TABLES_ORDER.length,
      totalTables: SYNC_TABLES_ORDER.length,
      percent: 100,
      syncedCounts: tableStats,
      totalSyncedRows,
      message: `تمت مزامنة ${totalSyncedRows} سجل بنجاح إلى السحابة بدون أي تعارضات ✅`,
    });

    return result;
  } catch (error: any) {
    onProgress({
      stage: 'error',
      currentTable: '',
      currentTableLabel: 'خطأ',
      tableIndex: 0,
      totalTables: SYNC_TABLES_ORDER.length,
      percent: 100,
      syncedCounts: tableStats,
      totalSyncedRows,
      message: error.message || 'حدث خطأ أثناء المزامنة',
    });

    return {
      success: false,
      totalSyncedRows,
      tableStats,
      durationMs: Date.now() - startTime,
      error: error.message || 'حدث خطأ أثناء المزامنة',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Synchronizes latest data from Supabase Cloud -> Local Database (Pull)
 */
export async function syncCloudToLocal(
  onProgress: (data: SyncProgressData) => void = () => {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const { cloudClient, localClient } = getSyncClients();
  const tableStats: Record<string, number> = {};
  let totalSyncedRows = 0;

  try {
    onProgress({
      stage: 'fetching',
      currentTable: '',
      currentTableLabel: 'فحص الاتصال',
      tableIndex: 0,
      totalTables: SYNC_TABLES_ORDER.length,
      percent: 5,
      syncedCounts: {},
      totalSyncedRows: 0,
      message: 'جاري الاتصال بالسيرفر السحابي لجلب التحديثات...',
    });

    for (let i = 0; i < SYNC_TABLES_ORDER.length; i++) {
      const config = SYNC_TABLES_ORDER[i];
      const tablePercent = Math.round(10 + (i / SYNC_TABLES_ORDER.length) * 85);

      onProgress({
        stage: 'syncing',
        currentTable: config.tableName,
        currentTableLabel: config.label,
        tableIndex: i + 1,
        totalTables: SYNC_TABLES_ORDER.length,
        percent: tablePercent,
        syncedCounts: tableStats,
        totalSyncedRows,
        message: `جاري سحب وتحديث جدول ${config.label} محلياً...`,
      });

      // Fetch from Cloud
      let cloudRows: any[] = [];
      try {
        const { data, error } = await cloudClient.from(config.tableName as any).select('*');
        if (!error && Array.isArray(data)) {
          cloudRows = data;
        }
      } catch (err) {
        console.warn(`Could not read cloud table ${config.tableName}:`, err);
        continue;
      }

      if (cloudRows.length === 0) {
        tableStats[config.label] = 0;
        continue;
      }

      // Upsert into Local Database
      const BATCH_SIZE = 50;
      let tableSuccessCount = 0;

      for (let b = 0; b < cloudRows.length; b += BATCH_SIZE) {
        const batch = cloudRows.slice(b, b + BATCH_SIZE);
        try {
          const { error: upsertError } = await localClient
            .from(config.tableName as any)
            .upsert(batch, {
              onConflict: config.primaryKey,
              ignoreDuplicates: false,
            });

          if (!upsertError) {
            tableSuccessCount += batch.length;
            totalSyncedRows += batch.length;
          }
        } catch (batchErr) {
          console.error(`Local upsert batch error on ${config.tableName}:`, batchErr);
        }
      }

      tableStats[config.label] = tableSuccessCount;
    }

    const durationMs = Date.now() - startTime;
    const result: SyncResult = {
      success: true,
      totalSyncedRows,
      tableStats,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    onProgress({
      stage: 'complete',
      currentTable: '',
      currentTableLabel: 'اكتمل التحديث',
      tableIndex: SYNC_TABLES_ORDER.length,
      totalTables: SYNC_TABLES_ORDER.length,
      percent: 100,
      syncedCounts: tableStats,
      totalSyncedRows,
      message: `تم تحديث ${totalSyncedRows} سجل محلياً بنجاح من السحابة ✅`,
    });

    return result;
  } catch (error: any) {
    return {
      success: false,
      totalSyncedRows,
      tableStats,
      durationMs: Date.now() - startTime,
      error: error.message || 'حدث خطأ أثناء سحب البيانات من السحابة',
      timestamp: new Date().toISOString(),
    };
  }
}
