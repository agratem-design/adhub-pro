// @ts-nocheck
import { useState, useEffect } from 'react';
import { Download, Upload, Database, AlertCircle, CheckCircle2, FileText, FolderArchive, FileDown, Eye, EyeOff, Terminal, Play, Trash2, RefreshCw, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { ImageCacheManager } from '@/components/database/ImageCacheManager';
import { toast } from 'sonner';
import JSZip from 'jszip';

interface TableInfo {
  table_name: string;
  row_count: number;
}

export default function DatabaseBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState('');
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [exportFormat, setExportFormat] = useState<'supabase' | 'mysql'>('supabase');
  const [exportMethod, setExportMethod] = useState<'single_sql' | 'zip_archive'>('single_sql');
  const [includeSchema, setIncludeSchema] = useState(true);

  // --- Windows pg_dump backup states ---
  const [dbPassword, setDbPassword] = useState(() => {
    return sessionStorage.getItem('supabase_backup_pgpassword') || '';
  });
  const [savePasswordInBrowser, setSavePasswordInBrowser] = useState(() => {
    return sessionStorage.getItem('supabase_backup_save_pwd') === 'true';
  });
  const [backupPrefix, setBackupPrefix] = useState('FARES-BILB');
  const [showPassword, setShowPassword] = useState(false);

  // --- Show tables section ---
  const [showTables, setShowTables] = useState(false);

  // --- Desktop Backup Live Progress ---
  const [desktopBackupStatus, setDesktopBackupStatus] = useState<{
    stage?: 'dumping' | 'uploading' | 'complete' | 'warning' | 'error';
    percent?: number;
    message?: string;
    fileName?: string;
    fileSizeMB?: string;
    driveUrl?: string | null;
    timestamp?: string;
  } | null>(null);

  useEffect(() => {
    if (!window.desktopAPI?.onBackupStatus) return;
    const cleanup = window.desktopAPI.onBackupStatus((progress) => {
      setDesktopBackupStatus(progress);
    });
    return () => cleanup();
  }, []);

  // ════════════════════════════════════════
  //          PASSWORD MANAGEMENT
  // ════════════════════════════════════════

  const handleSavePasswordConfig = () => {
    if (savePasswordInBrowser && dbPassword) {
      sessionStorage.setItem('supabase_backup_pgpassword', dbPassword);
      sessionStorage.setItem('supabase_backup_save_pwd', 'true');
      toast.success('تم حفظ كلمة المرور مؤقتاً لجلسة العمل الحالية');
    } else {
      sessionStorage.removeItem('supabase_backup_pgpassword');
      sessionStorage.setItem('supabase_backup_save_pwd', 'false');
      toast.info('تم إلغاء حفظ كلمة المرور');
    }
  };

  const handleClearPassword = () => {
    setDbPassword('');
    sessionStorage.removeItem('supabase_backup_pgpassword');
    localStorage.removeItem('supabase_backup_pgpassword');
    toast.success('تم مسح كلمة المرور');
  };

  // ════════════════════════════════════════
  //      WINDOWS BATCH SCRIPT GENERATOR
  // ════════════════════════════════════════

  const handleDownloadBackupScript = () => {
    const batContent = `@echo off
:: 1. إعداد كلمة المرور (للاتصال التلقائي)
set PGPASSWORD=${dbPassword || 'YOUR_PASSWORD_HERE'}

:: 2. إعداد التاريخ والوقت بتنسيق مناسب
set "datestr=%date:~10,4%-%date:~4,2%-%date:~7,2%"
set "timestr=%time:~0,2%-%time:~3,2%-%time:~6,2%"
:: استبدال المسافات بصفر (للساعات قبل العاشرة صباحاً)
set "timestr=%timestr: =0%"

:: 3. تحديد اسم الملف (يبدأ بـ ${backupPrefix}) والمسار الحالي
set "BACKUP_NAME=${backupPrefix}_%datestr%_%timestr%.dump"
set "FULL_PATH=%~dp0%BACKUP_NAME%"

echo ========================================================
echo [STARTING] Backup process for Supabase...
echo Destination: %BACKUP_NAME%
echo Host: aws-1-eu-north-1.pooler.supabase.com
echo ========================================================

:: 4. تنفيذ أمر pg_dump مع الإعدادات المطلوبة
"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe" -h aws-1-eu-north-1.pooler.supabase.com -U "postgres.atqjaiebixuzomrfwilu" -p 6543 -F c -b -v -f "%FULL_PATH%" postgres

echo.
echo ========================================================
echo [SUCCESS] Backup Completed!
echo Opening folder and selecting the file...
echo ========================================================

:: 5. فتح المجلد وتحديد الملف الجديد تلقائياً
explorer.exe /select,"%FULL_PATH%"

:: 6. مسح كلمة المرور من الذاكرة للأمان
set PGPASSWORD=
pause
`;

    const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `run-supabase-backup.bat`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (savePasswordInBrowser && dbPassword) {
      sessionStorage.setItem('supabase_backup_pgpassword', dbPassword);
      sessionStorage.setItem('supabase_backup_save_pwd', 'true');
    }

    toast.success('تم تحميل ملف السكربت run-supabase-backup.bat بنجاح!');
  };

  const handleDownloadBackupScriptUnix = () => {
    const shContent = `#!/bin/bash
# 1. إعداد كلمة المرور (للاتصال التلقائي)
export PGPASSWORD="${dbPassword || 'YOUR_PASSWORD_HERE'}"

# 2. إعداد التاريخ والوقت بتنسيق مناسب
datestr=$(date +%Y-%m-%d)
timestr=$(date +%H-%M-%S)

# 3. تحديد اسم الملف والمسار
BACKUP_NAME="${backupPrefix}_\${datestr}_\${timestr}.dump"
FULL_PATH="./\${BACKUP_NAME}"

echo "========================================================"
echo "[STARTING] Backup process for Supabase (macOS/Linux)..."
echo "Destination: \${BACKUP_NAME}"
echo "Host: aws-1-eu-north-1.pooler.supabase.com"
echo "========================================================"

# 4. تنفيذ أمر pg_dump مع الإعدادات المطلوبة
pg_dump -h aws-1-eu-north-1.pooler.supabase.com -U "postgres.atqjaiebixuzomrfwilu" -p 6543 -F c -b -v -f "\${FULL_PATH}" postgres

echo ""
echo "========================================================"
echo "[SUCCESS] Backup Completed!"
echo "File saved to: \${FULL_PATH}"
echo "========================================================"

# 5. مسح كلمة المرور من الذاكرة للأمان
unset PGPASSWORD
`;

    const blob = new Blob([shContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `run-supabase-backup.sh`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (savePasswordInBrowser && dbPassword) {
      sessionStorage.setItem('supabase_backup_pgpassword', dbPassword);
      sessionStorage.setItem('supabase_backup_save_pwd', 'true');
    }

    toast.success('تم تحميل ملف السكربت run-supabase-backup.sh بنجاح!');
  };

  // ════════════════════════════════════════
  //            TABLE LOADING
  // ════════════════════════════════════════

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    const allTables = [
      'Contract', 'account_closures', 'billboard_faces', 'billboard_history',
      'billboard_levels', 'billboard_types', 'billboards', 'booking_requests',
      'cleanup_logs', 'composite_tasks', 'custody_accounts', 'custody_expenses',
      'custody_transactions', 'customer_general_discounts', 'customer_payments',
      'customer_purchases', 'customers', 'cutout_task_items', 'cutout_tasks',
      'employee_advances', 'employee_contracts', 'employee_deductions',
      'employee_manual_tasks', 'employees', 'expense_categories', 'expenses',
      'expenses_flags', 'expenses_withdrawals', 'friend_billboard_rentals',
      'friend_companies', 'installation_print_pricing', 'installation_task_items',
      'installation_tasks', 'installation_team_accounts', 'installation_teams',
      'invoice_items', 'invoices', 'levels', 'maintenance_history',
      'management_phones', 'messaging_api_settings', 'messaging_settings',
      'municipalities', 'municipality_stickers_settings', 'offers', 'partners',
      'payments_salary', 'payroll_items', 'payroll_runs', 'period_closures',
      'pricing', 'pricing_categories', 'print_installation_pricing',
      'print_invoice_payments', 'print_task_items', 'print_tasks',
      'printed_invoices', 'printers', 'profiles', 'purchase_invoice_items',
      'purchase_invoice_payments', 'purchase_invoices', 'removal_task_items',
      'removal_tasks', 'report_items', 'reports', 'sales_invoice_payments',
      'sales_invoices', 'shared_billboards', 'shared_transactions', 'sizes',
      'system_settings', 'task_designs', 'tasks', 'template_settings',
      'timesheets', 'user_permissions', 'user_roles', 'users', 'withdrawals'
    ];
    
    const promises = allTables.map(async (tableName) => {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          return { table_name: tableName, row_count: count || 0 };
        }
        return null;
      } catch (err) {
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    const validTables = results.filter((t): t is TableInfo => t !== null);
    validTables.sort((a, b) => b.row_count - a.row_count);
    
    setTables(validTables);
    toast.success(`تم العثور على ${validTables.length} جدول`);
  };

  // ════════════════════════════════════════
  //            SCHEMA & SQL GENERATION
  // ════════════════════════════════════════

  const tableSchemaCache: Record<string, any[]> = {};

  const fetchTableSchema = async (tableName: string): Promise<any[]> => {
    if (tableSchemaCache[tableName]) return tableSchemaCache[tableName];
    try {
      const { data, error } = await supabase.rpc('get_table_schema', { p_table_name: tableName });
      if (error || !data) return [];
      tableSchemaCache[tableName] = data;
      return data;
    } catch (err) {
      return [];
    }
  };

  const inferColumnType = (value: any, columnName?: string, schemaInfo?: any[]): string => {
    if (schemaInfo && columnName) {
      const colSchema = schemaInfo.find(c => c.column_name === columnName);
      if (colSchema) return colSchema.data_type.toUpperCase();
    }
    if (value === null || value === undefined) return 'TEXT';
    if (typeof value === 'boolean') return 'BOOLEAN';
    if (typeof value === 'number') return Number.isInteger(value) ? 'BIGINT' : 'NUMERIC';
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'DATE';
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'TIMESTAMP WITH TIME ZONE';
      if (value.length === 36 && value.includes('-')) return 'UUID';
      return 'TEXT';
    }
    if (Array.isArray(value)) return 'JSONB';
    if (typeof value === 'object') return 'JSONB';
    return 'TEXT';
  };

  const generateCreateTableFromData = async (tableName: string, data: any[], format: 'supabase' | 'mysql'): Promise<string> => {
    if (!data || data.length === 0) return '';
    const quote = format === 'mysql' ? '`' : '"';
    const sample = data[0];
    const columns = Object.keys(sample);
    const schemaInfo = await fetchTableSchema(tableName);
    const primaryKeys = schemaInfo.filter(c => c.is_primary).map(c => c.column_name);
    
    const columnDefs = columns.map(col => {
      const colSchema = schemaInfo.find(c => c.column_name === col);
      let dataType = colSchema ? colSchema.data_type.toUpperCase() : inferColumnType(sample[col], col, schemaInfo);
      if (dataType.includes('CHARACTER VARYING')) dataType = 'TEXT';
      if (dataType === 'ARRAY') dataType = 'JSONB';
      
      if (format === 'mysql') {
        const typeMap: Record<string, string> = {
          'TEXT': 'TEXT', 'BIGINT': 'BIGINT', 'INTEGER': 'INT', 'NUMERIC': 'DECIMAL(15,2)',
          'DOUBLE PRECISION': 'DOUBLE', 'BOOLEAN': 'TINYINT(1)',
          'TIMESTAMP WITH TIME ZONE': 'DATETIME', 'TIMESTAMP': 'DATETIME', 'DATE': 'DATE',
          'UUID': 'VARCHAR(36)', 'JSONB': 'JSON', 'JSON': 'JSON'
        };
        dataType = typeMap[dataType] || 'TEXT';
      }
      
      let constraints = '';
      if (colSchema) {
        if (colSchema.is_nullable === 'NO' && !primaryKeys.includes(col)) constraints += ' NOT NULL';
        if (colSchema.column_default && format === 'supabase') {
          let defaultVal = colSchema.column_default;
          if (!defaultVal.includes('nextval')) constraints += ` DEFAULT ${defaultVal}`;
        }
      }
      return `  ${quote}${col}${quote} ${dataType}${constraints}`;
    }).join(',\n');

    const pkDef = primaryKeys.length > 0 ? `,\n  PRIMARY KEY (${primaryKeys.map(pk => `${quote}${pk}${quote}`).join(', ')})` : '';
    if (format === 'mysql') {
      return `CREATE TABLE IF NOT EXISTS ${quote}${tableName}${quote} (\n${columnDefs}${pkDef}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`;
    }
    return `CREATE TABLE IF NOT EXISTS public.${quote}${tableName}${quote} (\n${columnDefs}${pkDef}\n);\n`;
  };

  const generateInsertBatches = async (tableName: string, data: any[], format: 'supabase' | 'mysql', batchSize = 100): Promise<string[]> => {
    if (!data || data.length === 0) return [];
    const quote = format === 'mysql' ? '`' : '"';
    const batches: string[] = [];
    const schemaInfo = await fetchTableSchema(tableName);
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const columns = Object.keys(batch[0]);
      const columnList = columns.map(c => `${quote}${c}${quote}`).join(', ');
      
      const valuesList = batch.map(row => {
        const values = columns.map(col => {
          const val = row[col];
          const colSchema = schemaInfo.find(c => c.column_name === col);
          const dataType = colSchema?.data_type?.toLowerCase() || '';
          
          if (val === null || val === undefined) return 'NULL';
          if (dataType === 'jsonb' || dataType === 'json' || dataType === 'array') {
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            return `'${String(val).replace(/'/g, "''")}'::jsonb`;
          }
          if (dataType === 'uuid') {
            return typeof val === 'string' && val.length === 36 ? `'${val}'::uuid` : 'NULL';
          }
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (typeof val === 'boolean') return format === 'mysql' ? (val ? '1' : '0') : val.toString();
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
          return val.toString();
        });
        return `(${values.join(', ')})`;
      }).join(',\n');
      
      const tableRef = format === 'mysql' ? `${quote}${tableName}${quote}` : `public.${quote}${tableName}${quote}`;
      batches.push(`INSERT INTO ${tableRef} (${columnList}) VALUES\n${valuesList};\n`);
    }
    return batches;
  };

  // ════════════════════════════════════════
  //      DIRECT DOWNLOAD (BROWSER BACKUP)
  // ════════════════════════════════════════

  const exportDatabase = async () => {
    setIsExporting(true);
    setProgress(0);
    
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const totalTables = tables.length;
      
      const independentTables = ['profiles', 'user_roles', 'user_permissions', 'sizes', 
        'billboard_types', 'billboard_faces', 'billboard_levels', 
        'municipalities', 'expense_categories', 'customers', 'printers', 'friend_companies', 
        'partners', 'employees', 'installation_teams'];
      
      const sortedTables = [...tables].sort((a, b) => {
        const aIndex = independentTables.indexOf(a.table_name);
        const bIndex = independentTables.indexOf(b.table_name);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return 0;
      });

      if (exportMethod === 'zip_archive') {
        const zip = new JSZip();
        let readmeContent = `# نسخة احتياطية لقاعدة البيانات\n\n`;
        readmeContent += `- تاريخ الإنشاء: ${new Date().toISOString()}\n`;
        readmeContent += `- النوع: ${exportFormat === 'mysql' ? 'MySQL' : 'PostgreSQL/Supabase'}\n`;
        readmeContent += `- عدد الجداول: ${tables.length}\n\n`;
        readmeContent += `## الجداول المضمنة:\n\n`;
        
        const dataFolder = zip.folder('data');
        
        for (let i = 0; i < sortedTables.length; i++) {
          const tableInfo = sortedTables[i];
          const tableName = tableInfo.table_name;
          setCurrentTable(tableName);
          setProgress(Math.round(((i + 1) / totalTables) * 100));
          
          try {
            const { data, error } = await supabase.from(tableName).select('*');
            if (error) continue;
            
            if (data && data.length > 0) {
              let tableContent = `-- الجدول: ${tableName}\n-- عدد السجلات: ${data.length}\n-- تاريخ التصدير: ${new Date().toISOString()}\n\n`;
              if (includeSchema) {
                tableContent += await generateCreateTableFromData(tableName, data, exportFormat);
                tableContent += '\n';
              }
              const batches = await generateInsertBatches(tableName, data, exportFormat, 50);
              batches.forEach((batch, idx) => {
                tableContent += `-- دفعة ${idx + 1} من ${batches.length}\n${batch}\n`;
              });
              const fileName = `${String(i + 1).padStart(2, '0')}_${tableName}.sql`;
              dataFolder?.file(fileName, tableContent);
              readmeContent += `- ${fileName} (${data.length} سجل)\n`;
            }
          } catch (err) {
            console.warn(`خطأ في تصدير ${tableName}:`, err);
          }
        }
        
        zip.file('README.md', readmeContent);
        
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `database-backup-${exportFormat}-${timestamp}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Combined single SQL file
        let combinedSql = `-- نسخة احتياطية لقاعدة البيانات كاملة\n`;
        combinedSql += `-- تاريخ الإنشاء: ${new Date().toLocaleString('ar-SA')}\n`;
        combinedSql += `-- النوع: ${exportFormat === 'mysql' ? 'MySQL' : 'PostgreSQL/Supabase'}\n`;
        combinedSql += `-- عدد الجداول المضمنة: ${tables.length}\n`;
        combinedSql += `-- تم التصدير عبر متصفح الويب\n`;
        combinedSql += `\n`;
        
        if (exportFormat === 'supabase') {
          combinedSql += `-- إعدادات الجلسة للنسخة الاحتياطية لـ PostgreSQL\n`;
          combinedSql += `SET statement_timeout = 0;\n`;
          combinedSql += `SET lock_timeout = 0;\n`;
          combinedSql += `SET client_encoding = 'UTF8';\n`;
          combinedSql += `SET standard_conforming_strings = on;\n`;
          combinedSql += `SET check_function_bodies = false;\n`;
          combinedSql += `SET xmloption = content;\n`;
          combinedSql += `SET client_min_messages = warning;\n`;
          combinedSql += `SET row_security = off;\n\n`;
        } else {
          combinedSql += `-- إعدادات الجلسة للنسخة الاحتياطية لـ MySQL\n`;
          combinedSql += `SET FOREIGN_KEY_CHECKS = 0;\n`;
          combinedSql += `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`;
          combinedSql += `SET time_zone = "+00:00";\n\n`;
        }

        for (let i = 0; i < sortedTables.length; i++) {
          const tableInfo = sortedTables[i];
          const tableName = tableInfo.table_name;
          setCurrentTable(tableName);
          setProgress(Math.round(((i + 1) / totalTables) * 100));
          
          try {
            const { data, error } = await supabase.from(tableName).select('*');
            if (error) continue;
            
            if (data && data.length > 0) {
              combinedSql += `-- ════════════════════════════════════════════════\n`;
              combinedSql += `-- الجدول: ${tableName} | عدد السجلات: ${data.length}\n`;
              combinedSql += `-- ════════════════════════════════════════════════\n\n`;
              
              if (includeSchema) {
                combinedSql += await generateCreateTableFromData(tableName, data, exportFormat);
                combinedSql += '\n';
              }
              
              const batches = await generateInsertBatches(tableName, data, exportFormat, 50);
              batches.forEach((batch) => {
                combinedSql += batch + '\n';
              });
              
              combinedSql += '\n';
            }
          } catch (err) {
            console.warn(`خطأ في تصدير ${tableName}:`, err);
          }
        }
        
        if (exportFormat === 'mysql') {
          combinedSql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
        }

        const blob = new Blob([combinedSql], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `database-backup-${exportFormat}-${timestamp}.sql`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      setLastBackup(new Date());
      toast.success(`تم تنزيل النسخة الاحتياطية بنجاح (${tables.length} جدول)`);
    } catch (error) {
      console.error('خطأ:', error);
      toast.error('فشل في إنشاء النسخة الاحتياطية');
    } finally {
      setIsExporting(false);
      setProgress(0);
      setCurrentTable('');
    }
  };

  const exportSingleTable = async (tableName: string) => {
    try {
      toast.info(`جاري تصدير ${tableName}...`);
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) { toast.error(`فشل تصدير ${tableName}`); return; }
      if (!data || data.length === 0) { toast.info(`الجدول ${tableName} فارغ`); return; }
      
      let content = `-- الجدول: ${tableName}\n-- عدد السجلات: ${data.length}\n-- تاريخ التصدير: ${new Date().toISOString()}\n\n`;
      if (includeSchema) { content += await generateCreateTableFromData(tableName, data, exportFormat) + '\n'; }
      const batches = await generateInsertBatches(tableName, data, exportFormat, 50);
      batches.forEach((batch, idx) => { content += `-- دفعة ${idx + 1} من ${batches.length}\n${batch}\n`; });
      
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tableName}-${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`تم تصدير ${tableName} (${data.length} سجل)`);
    } catch (error) {
      toast.error(`فشل تصدير ${tableName}`);
    }
  };

  // ════════════════════════════════════════
  //      DIRECT RESTORE (UPLOAD BACKUP)
  // ════════════════════════════════════════

  const importDatabase = async (file: File) => {
    setIsImporting(true);
    setProgress(0);
    
    try {
      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const sqlFiles = Object.keys(zip.files).filter(name => name.endsWith('.sql') && name.includes('/')).sort();
        toast.info(`تم العثور على ${sqlFiles.length} ملف SQL`);
        
        let allContent = '';
        for (const fileName of sqlFiles) {
          const content = await zip.files[fileName].async('string');
          allContent += `\n-- ===== ${fileName} =====\n${content}\n`;
        }
        await navigator.clipboard.writeText(allContent);
        toast.success('تم نسخ جميع ملفات SQL للحافظة — الصقها في SQL Editor');
        return;
      }
      
      const text = await file.text();
      if (file.name.endsWith('.sql')) {
        await navigator.clipboard.writeText(text);
        toast.success('تم نسخ محتوى SQL للحافظة — الصقه في SQL Editor');
        return;
      }
      
      // JSON import
      const backup = JSON.parse(text);
      if (!backup.tables || !backup.timestamp) throw new Error('ملف غير صالح');

      const tableNames = Object.keys(backup.tables);
      let imported = 0, failed = 0;
      
      for (let i = 0; i < tableNames.length; i++) {
        const tableName = tableNames[i];
        const tableData = backup.tables[tableName];
        setProgress(Math.round(((i + 1) / tableNames.length) * 100));
        if (!Array.isArray(tableData) || tableData.length === 0) continue;

        try {
          await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          const { error } = await supabase.from(tableName).insert(tableData);
          if (error) { failed++; } else { imported++; }
        } catch { failed++; }
      }

      if (imported > 0) {
        toast.success(`تم استيراد ${imported} جدول${failed > 0 ? ` (فشل ${failed})` : ''}`);
        await loadTables();
      } else {
        toast.error('فشل في استيراد البيانات');
      }
    } catch (error) {
      console.error(error);
      toast.error('فشل في استيراد النسخة الاحتياطية');
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json') && !file.name.endsWith('.sql') && !file.name.endsWith('.zip')) {
        toast.error('يجب اختيار ملف JSON أو SQL أو ZIP');
        return;
      }
      importDatabase(file);
    }
  };

  // ════════════════════════════════════════
  //                RENDER
  // ════════════════════════════════════════

  const totalRecords = tables.reduce((sum, t) => sum + t.row_count, 0);

  return (
    <div className="container mx-auto p-6 max-w-5xl text-right" dir="rtl">
      
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">النسخ الاحتياطي لقاعدة البيانات</h1>
          <p className="text-muted-foreground text-sm">إنشاء واستعادة نسخ احتياطية كاملة من قاعدة بيانات Supabase (PostgreSQL)</p>
        </div>
      </div>

      {/* ════════════════════════════════════════ */}
      {/*  SECTION 0: Desktop Automated Backup     */}
      {/* ════════════════════════════════════════ */}
      {typeof window !== 'undefined' && window.desktopAPI && (
        <Card className="border-amber-500/40 shadow-xl bg-gradient-to-r from-amber-500/10 via-background to-emerald-500/10 mb-6 border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <HardDrive className="h-5 w-5" />
                النسخ الاحتياطي التلقائي لبرنامج سطح المكتب (AdHub Desktop)
              </CardTitle>
              <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                مفعل تلقائياً عند فتح البرنامج
              </span>
            </div>
            <CardDescription className="text-xs text-foreground/80">
              يقوم البرنامج بأخذ نسخة احتياطية صامتة لقاعدة البيانات عبر أداة <code className="font-mono bg-muted px-1 rounded">pg_dump</code> وحفظها في مجلد المستندات ورفعها مباشرة إلى Google Drive دون تدخل منك.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Live Progress Bar Section */}
            {desktopBackupStatus && (
              <div className="space-y-2 border border-amber-500/20 p-3.5 rounded-xl bg-background/80 shadow-inner">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2">
                    {desktopBackupStatus.stage === 'complete' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {desktopBackupStatus.stage === 'uploading' && <HardDrive className="w-4 h-4 text-blue-500 animate-pulse" />}
                    {desktopBackupStatus.stage === 'dumping' && <Database className="w-4 h-4 text-amber-500 animate-pulse" />}
                    {desktopBackupStatus.stage === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
                    <span>{desktopBackupStatus.message}</span>
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 bg-muted rounded-full">
                    {desktopBackupStatus.percent || 0}%
                  </span>
                </div>
                
                <Progress 
                  value={desktopBackupStatus.percent || (desktopBackupStatus.stage === 'complete' ? 100 : 10)} 
                  className={`h-2.5 rounded-full ${
                    desktopBackupStatus.stage === 'complete' 
                      ? '[&>div]:bg-emerald-500' 
                      : desktopBackupStatus.stage === 'uploading' 
                      ? '[&>div]:bg-blue-500' 
                      : '[&>div]:bg-amber-500'
                  }`} 
                />

                {desktopBackupStatus.fileName && (
                  <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                    <span>الملف: <code className="font-mono">{desktopBackupStatus.fileName}</code></span>
                    {desktopBackupStatus.fileSizeMB && <span>الحجم: {desktopBackupStatus.fileSizeMB} MB</span>}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={async () => {
                  if (!window.desktopAPI) return;
                  setDesktopBackupStatus({
                    stage: 'dumping',
                    percent: 5,
                    message: 'بدء النسخ الاحتياطي والرفع إلى Google Drive...',
                  });
                  toast.info('بدء عملية النسخ والرفع إلى Google Drive...');
                  const res = await window.desktopAPI.triggerBackup();
                  if (!res.success && res.error) {
                    toast.error(res.error);
                  }
                }}
                className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs h-10 gap-2 flex-1 min-w-[200px]"
              >
                <Play className="h-4 w-4" />
                أخذ نسخة احتياطية كاملة ورفعها الآن
              </Button>

              <Button
                variant="outline"
                onClick={async () => {
                  if (window.desktopAPI) {
                    await window.desktopAPI.openBackupsFolder();
                  }
                }}
                className="border-amber-500/30 hover:bg-amber-500/10 text-xs font-bold h-10 gap-2"
              >
                <FolderArchive className="h-4 w-4 text-amber-600" />
                فتح مجلد النسخ الاحتياطية على جهازك
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════ */}
      {/*  SECTION 1: Quick Actions — Download & Upload */}
      {/* ════════════════════════════════════════ */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">

        {/* ──── Direct Download ──── */}
        <Card className="border-green-500/30 shadow-lg bg-gradient-to-br from-green-500/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-5 w-5 text-green-600" />
              تنزيل نسخة احتياطية فوراً
            </CardTitle>
            <CardDescription className="text-xs">
              تنزيل جميع الجداول كملف استعلامات موحد أو أرشيف ZIP مضغوط مباشرة من المتصفح
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground">تنسيق الاستعلامات:</span>
                  <Select value={exportFormat} onValueChange={(v: 'supabase' | 'mysql') => setExportFormat(v)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supabase" className="text-xs">PostgreSQL (Supabase)</SelectItem>
                      <SelectItem value="mysql" className="text-xs">MySQL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground">هيكل ملف التنزيل:</span>
                  <Select value={exportMethod} onValueChange={(v: 'single_sql' | 'zip_archive') => setExportMethod(v)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_sql" className="text-xs">ملف SQL موحد (.sql)</SelectItem>
                      <SelectItem value="zip_archive" className="text-xs">أرشيف مضغوط (.zip)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 mt-1">
                <Checkbox id="includeSchema" checked={includeSchema} onCheckedChange={(c) => setIncludeSchema(c as boolean)} />
                <label htmlFor="includeSchema" className="text-[10px] cursor-pointer font-bold">تضمين أوامر إنشاء الجداول (CREATE TABLE)</label>
              </div>
            </div>

            {isExporting && (
              <div className="space-y-1.5 border p-2.5 rounded-lg bg-muted/30">
                <div className="flex justify-between text-[11px] font-bold">
                  <span>تصدير: {currentTable}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            <Button
              onClick={exportDatabase}
              disabled={isExporting || tables.length === 0}
              className="w-full text-xs font-bold h-10 gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {exportMethod === 'single_sql' ? <FileDown className="h-4 w-4" /> : <FolderArchive className="h-4 w-4" />}
              {isExporting ? `جاري التصدير... ${progress}%` : `تنزيل نسخة كاملة (${tables.length} جدول — ${totalRecords.toLocaleString()} سجل)`}
            </Button>

            {lastBackup && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                آخر تنزيل: {lastBackup.toLocaleString('ar-SA')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ──── Direct Upload / Restore ──── */}
        <Card className="border-blue-500/30 shadow-lg bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5 text-blue-600" />
              رفع واستعادة نسخة احتياطية
            </CardTitle>
            <CardDescription className="text-xs">
              رفع ملف نسخة احتياطية (ZIP / SQL / JSON) لاستعادة البيانات مباشرة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isImporting && (
              <div className="space-y-1.5 border p-2.5 rounded-lg bg-muted/30">
                <div className="flex justify-between text-[11px] font-bold">
                  <span>جاري المعالجة...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            <div className="border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-xl p-5 text-center hover:bg-blue-50/30 dark:hover:bg-blue-950/30 transition-colors">
              <Upload className="h-8 w-8 mx-auto mb-2 text-blue-400" />
              <p className="text-[11px] text-muted-foreground mb-2 font-semibold">
                اسحب وأسقط الملف هنا أو اضغط للاختيار
              </p>
              <label htmlFor="backup-file">
                <Button asChild variant="outline" size="sm" className="h-8 text-xs border-blue-300" disabled={isExporting || isImporting}>
                  <span className="cursor-pointer gap-1.5"><Upload className="h-3.5 w-3.5" /> اختيار ملف</span>
                </Button>
              </label>
              <input id="backup-file" type="file" accept=".json,.sql,.zip" onChange={handleFileUpload} className="hidden" disabled={isExporting || isImporting} />
            </div>

            <div className="text-[10px] text-muted-foreground space-y-0.5 bg-muted/30 p-2.5 rounded-lg">
              <p>• <strong>ZIP:</strong> يتم نسخ الملفات إلى الحافظة للصقها في SQL Editor</p>
              <p>• <strong>SQL:</strong> يتم نسخ المحتوى إلى الحافظة مباشرة</p>
              <p>• <strong>JSON:</strong> يتم استعادة البيانات تلقائياً في قاعدة البيانات</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ════════════════════════════════════════ */}
      {/*  SECTION 2: Script Generator */}
      {/* ════════════════════════════════════════ */}
      <Card className="border-muted shadow-lg mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            سكربت النسخ الاحتياطي للأجهزة (pg_dump)
          </CardTitle>
          <CardDescription className="text-xs">
            توليد سكربت تنفيذي (.bat أو .sh) يقوم باستدعاء pg_dump تلقائياً لتصدير نسخة احتياطية كاملة (.dump) بدون قيود حجم
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">كلمة مرور قاعدة البيانات (PGPASSWORD)</Label>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="أدخل كلمة المرور..." 
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  className="pr-3 pl-10 text-xs font-mono"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">بادئة اسم ملف النسخة</Label>
              <Input placeholder="FARES-BILB" value={backupPrefix} onChange={(e) => setBackupPrefix(e.target.value)} className="text-xs font-mono" />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-b py-3">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold cursor-pointer" htmlFor="save-pwd-switch">حفظ كلمة المرور مؤقتاً في الجلسة</Label>
              <p className="text-[10px] text-muted-foreground">تخزين كلمة المرور أثناء جلسة العمل الحالية لتسهيل التنزيل</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="save-pwd-switch" 
                checked={savePasswordInBrowser} 
                onCheckedChange={(checked) => {
                  setSavePasswordInBrowser(checked);
                  if (!checked) {
                    sessionStorage.removeItem('supabase_backup_pgpassword');
                    localStorage.removeItem('supabase_backup_pgpassword');
                  }
                  sessionStorage.setItem('supabase_backup_save_pwd', checked.toString());
                }} 
              />
              <Button variant="ghost" size="sm" onClick={handleSavePasswordConfig} className="text-[10px] h-7 px-2">تطبيق</Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDownloadBackupScript} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold gap-2 text-xs h-10">
              <Play className="h-4 w-4" />
              توليد سكربت Windows (.bat)
            </Button>
            <Button onClick={handleDownloadBackupScriptUnix} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 text-xs h-10">
              <Terminal className="h-4 w-4" />
              توليد سكربت macOS/Linux (.sh)
            </Button>
            <Button variant="outline" onClick={handleClearPassword} className="text-destructive border-destructive/20 hover:bg-destructive/5 text-xs font-semibold h-10 gap-2 shrink-0">
              <Trash2 className="h-4 w-4" />
              مسح كلمة المرور
            </Button>
          </div>

          <Alert className="border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20">
            <Terminal className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed space-y-1.5 w-full">
 <p className="font-bold"> خطوات الاستخدام:</p>
              <div className="grid gap-4 md:grid-cols-2 mt-1">
                <div>
                  <p className="font-bold text-emerald-700 dark:text-emerald-300">لـ Windows (.bat):</p>
                  <ol className="list-decimal list-inside space-y-0.5 font-medium text-[10px]">
                    <li>حمّل السكربت في المجلد المطلوب</li>
                    <li>انقر نقراً مزدوجاً لتشغيله</li>
                    <li>يبحث تلقائياً عن مسار <code className="font-mono bg-amber-100/50 dark:bg-amber-900/30 px-1 rounded">pg_dump.exe</code> ويحفظ الملف</li>
                  </ol>
                </div>
                <div>
                  <p className="font-bold text-blue-700 dark:text-blue-300">لـ macOS / Linux (.sh):</p>
                  <ol className="list-decimal list-inside space-y-0.5 font-medium text-[10px]">
                    <li>حمّل السكربت في المجلد المطلوب</li>
                    <li>افتح Terminal واكتب: <code className="font-mono bg-amber-100/50 dark:bg-amber-900/30 px-1 rounded">chmod +x run-supabase-backup.sh</code></li>
                    <li>شغله بالأمر: <code className="font-mono bg-amber-100/50 dark:bg-amber-900/30 px-1 rounded">./run-supabase-backup.sh</code></li>
                  </ol>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════ */}
      {/*  SECTION 3: Image Cache Manager          */}
      {/* ════════════════════════════════════════ */}
      <ImageCacheManager className="mb-6" />

      {/* ════════════════════════════════════════ */}
      {/*  SECTION 4: Tables List (collapsible)    */}
      {/* ════════════════════════════════════════ */}
      <Card className="border-muted shadow-sm">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              الجداول المكتشفة ({tables.length}) — {totalRecords.toLocaleString()} سجل إجمالي
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={loadTables} variant="outline" size="sm" className="h-7 text-[10px] gap-1">
                <RefreshCw className="h-3 w-3" /> تحديث
              </Button>
              <Button onClick={() => setShowTables(!showTables)} variant="ghost" size="sm" className="h-7 text-[10px]">
                {showTables ? 'إخفاء' : 'عرض الجداول'}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showTables && (
          <CardContent className="pt-0">
            <p className="text-[10px] text-muted-foreground mb-3">اضغط على أي جدول لتنزيله منفرداً كملف SQL</p>
            {tables.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 text-xs">جاري التحميل...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                {tables.map((table) => (
                  <button
                    key={table.table_name}
                    onClick={() => exportSingleTable(table.table_name)}
                    className="text-[11px] px-2.5 py-2 bg-muted/40 rounded-md text-right hover:bg-accent transition-colors cursor-pointer border border-transparent hover:border-muted flex flex-col"
                  >
                    <div className="font-bold flex items-center gap-1 truncate">
                      <FileDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                      {table.table_name}
                    </div>
                    {table.row_count > 0 && (
                      <div className="text-[9px] text-muted-foreground mt-0.5">{table.row_count.toLocaleString()} سجل</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
