import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase, isOfflineMode, getOfflineSettings, setOfflineMode } from '@/integrations/supabase/client';
import { imageToBase64 } from '@/utils/imageResolver';
import JSZip from 'jszip';
import { 
  Download, 
  Database, 
  Image, 
  Settings, 
  Terminal, 
  Cloud, 
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileDown,
  Wifi,
  WifiOff
} from 'lucide-react';

// Tables to export (in order for proper foreign key handling)
const TABLES_TO_EXPORT = [
  'billboard_levels',
  'billboard_faces',
  'billboard_types',
  'sizes',
  'customers',
  'friend_companies',
  'partners',
  'installation_teams',
  'printers',
  'roles',
  'employees',
  'Contract',
  'billboards',
  'billboard_history',
  'billboard_extensions',
  'billboard_cost_centers',
  'installation_tasks',
  'installation_task_items',
  'print_tasks',
  'cutout_tasks',
  'composite_tasks',
  'printed_invoices',
  'print_invoices_standalone',
  'customer_payments',
  'activity_log',
  'system_settings',
  'base_prices',
  'category_factors',
  'installation_print_pricing',
];

// Image fields to download
const IMAGE_FIELDS = [
  { table: 'billboards', fields: ['Image_URL', 'design_face_a', 'design_face_b'] },
  { table: 'installation_task_items', fields: ['design_face_a', 'design_face_b', 'installed_image_face_a_url', 'installed_image_face_b_url'] },
  { table: 'printed_invoices', fields: ['design_face_a_path', 'design_face_b_path'] },
  { table: 'billboard_history', fields: ['design_face_a_url', 'design_face_b_url', 'installed_image_face_a_url', 'installed_image_face_b_url'] },
];

// Fetch all rows from a table with pagination (bypasses 1000-row limit)
const fetchAllRows = async (tableName: string): Promise<any[]> => {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName as any)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    hasMore = data.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allData;
};

const escapeSQL = (value: any): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
};

const generateInsertSQL = (tableName: string, data: any[]): string => {
  if (!data || data.length === 0) return `-- No data for ${tableName}\n`;
  
  const columns = Object.keys(data[0]);
  const lines: string[] = [`-- Data for table: ${tableName}`, `-- Total rows: ${data.length}`, ''];
  
  for (const row of data) {
    const values = columns.map(col => escapeSQL(row[col]));
    lines.push(`INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`);
  }
  
  return lines.join('\n') + '\n\n';
};

export default function OfflineSetup() {
  const settings = getOfflineSettings();
  const [localUrl, setLocalUrl] = useState(settings.localUrl);
  const [localKey, setLocalKey] = useState(settings.localKey);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingImages, setIsDownloadingImages] = useState(false);
  const [isCachingImages, setIsCachingImages] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [imageProgress, setImageProgress] = useState(0);
  const [cacheProgress, setCacheProgress] = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [exportedTables, setExportedTables] = useState<string[]>([]);

  // Export all data as SQL
  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportedTables([]);
    
    try {
      const zip = new JSZip();
      let allSQL = `-- Billboard System Full Database Export\n-- Generated: ${new Date().toISOString()}\n-- Mode: PostgreSQL Compatible\n\n`;
      allSQL += `SET session_replication_role = 'replica';\n\n`;
      
      for (let i = 0; i < TABLES_TO_EXPORT.length; i++) {
        const tableName = TABLES_TO_EXPORT[i];
        setExportProgress(Math.round((i / TABLES_TO_EXPORT.length) * 100));
        
        try {
          const data = await fetchAllRows(tableName);
          
          if (data && data.length > 0) {
            const tableSQL = generateInsertSQL(tableName, data);
            allSQL += tableSQL;
            zip.file(`data/${tableName}.sql`, tableSQL);
            setExportedTables(prev => [...prev, `${tableName} (${data.length} rows)`]);
          } else {
            allSQL += `-- No data for ${tableName}\n\n`;
          }
        } catch (e) {
          console.warn(`Failed to export ${tableName}:`, e);
        }
      }
      
      allSQL += `\nSET session_replication_role = 'origin';\n`;
      allSQL += `\n-- Reset sequences\n`;
      allSQL += `SELECT setval('billboards_id_seq', COALESCE((SELECT MAX("ID") FROM billboards), 1), true);\n`;
      allSQL += `SELECT setval('"Contract_id_seq"', COALESCE((SELECT MAX("Contract_Number") FROM "Contract"), 1), true);\n`;
      
      zip.file('full_data_import.sql', allSQL);
      
      // Add restore instructions
      const instructions = `# تعليمات استعادة البيانات

## الخطوات:

1. تأكد من تشغيل Supabase CLI محلياً:
   \`\`\`bash
   supabase start
   \`\`\`

2. استعد الـ Schema أولاً:
   \`\`\`bash
   psql -U postgres -d postgres -h localhost -p 54322 -f database_full_restore.sql
   \`\`\`

3. استعد البيانات:
   \`\`\`bash
   psql -U postgres -d postgres -h localhost -p 54322 -f full_data_import.sql
   \`\`\`

## ملاحظات:
- كلمة المرور الافتراضية: postgres
- API URL: http://localhost:54321
- Database URL: postgresql://postgres:postgres@localhost:54322/postgres
`;
      zip.file('README.md', instructions);
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billboard_data_export_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      setExportProgress(100);
      toast.success('تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('فشل في تصدير البيانات');
    } finally {
      setIsExporting(false);
    }
  }, []);

  // Cache all images as base64 and generate SQL file for local import
  const handleCacheImages = useCallback(async () => {
    setIsCachingImages(true);
    setCacheProgress(0);
    setCachedCount(0);
    
    try {
      // Collect all image URLs from known tables
      const imageUrls: { table: string; field: string; url: string }[] = [];
      
      for (const config of IMAGE_FIELDS) {
        try {
          const data = await fetchAllRows(config.table);
          if (data && Array.isArray(data)) {
            for (const row of data as Record<string, any>[]) {
              for (const field of config.fields) {
                const url = row[field];
                if (url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('https'))) {
                  imageUrls.push({ table: config.table, field, url });
                }
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch from ${config.table}:`, e);
        }
      }
      
      // Remove duplicates
      const uniqueUrls = [...new Map(imageUrls.map(item => [item.url, item])).values()];
      setTotalImages(uniqueUrls.length);
      toast.info(`جاري تحميل ${uniqueUrls.length} صورة بالجودة الكاملة...`);
      
      let cached = 0;
      const sqlStatements: string[] = [
        `-- Image Cache Data for Offline Use`,
        `-- Generated: ${new Date().toISOString()}`,
        `-- Total images: ${uniqueUrls.length}`,
        `-- Quality: 100% (no compression)`,
        '',
      ];
      
      for (let i = 0; i < uniqueUrls.length; i++) {
        const { url } = uniqueUrls[i];
        setCacheProgress(Math.round((i / uniqueUrls.length) * 100));
        
        // Convert to base64 (full quality, no compression)
        const result = await imageToBase64(url);
        if (result) {
          const escapedUrl = url.replace(/'/g, "''");
          const escapedBase64 = result.base64.replace(/'/g, "''");
          sqlStatements.push(
            `INSERT INTO "image_cache" ("original_url", "base64_data", "mime_type", "file_size") VALUES ('${escapedUrl}', '${escapedBase64}', '${result.mimeType}', ${result.size}) ON CONFLICT ("original_url") DO UPDATE SET "base64_data" = EXCLUDED."base64_data", "mime_type" = EXCLUDED."mime_type", "file_size" = EXCLUDED."file_size";`
          );
          cached++;
          setCachedCount(cached);
        }
      }
      
      // Download as SQL file
      const sqlContent = sqlStatements.join('\n');
      const blob = new Blob([sqlContent], { type: 'text/sql;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `image_cache_${new Date().toISOString().split('T')[0]}.sql`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      
      setCacheProgress(100);
      toast.success(`تم تجهيز ${cached} صورة - تم تنزيل ملف SQL للاستيراد المحلي`);
    } catch (error) {
      console.error('Cache error:', error);
      toast.error('فشل في تخزين الصور');
    } finally {
      setIsCachingImages(false);
    }
  }, []);

  // Download all images
  const handleDownloadImages = useCallback(async () => {
    setIsDownloadingImages(true);
    setImageProgress(0);
    
    try {
      const zip = new JSZip();
      const imageUrls: { table: string; field: string; url: string; id: string }[] = [];
      const urlMappings: { original: string; local: string }[] = [];
      
      // Collect all image URLs
      for (const config of IMAGE_FIELDS) {
        try {
          const data = await fetchAllRows(config.table);
          if (data && Array.isArray(data)) {
            for (const row of data as Record<string, any>[]) {
              const id = row['ID'] || row['id'] || row['Contract_Number'] || 'unknown';
              for (const field of config.fields) {
                const url = row[field];
                if (url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('//'))) {
                  imageUrls.push({ table: config.table, field, url, id: String(id) });
                }
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch images from ${config.table}:`, e);
        }
      }
      
      toast.info(`جاري تحميل ${imageUrls.length} صورة...`);
      
    // Download images and build manifest
      const manifest: Record<string, string> = {};
      
      for (let i = 0; i < imageUrls.length; i++) {
        const { table, field, url, id } = imageUrls[i];
        setImageProgress(Math.round((i / imageUrls.length) * 100));
        
        try {
          const response = await fetch(url);
          if (response.ok) {
            const blob = await response.blob();
            const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
            const filename = `${table}/${id}_${field}.${ext}`;
            zip.file(filename, blob);
            urlMappings.push({ original: url, local: `/image/${filename}` });
            // Record in manifest: original URL → relative path inside zip
            manifest[url] = filename;
          }
        } catch (e) {
          console.warn(`Failed to download: ${url}`);
        }
      }
      
      // Add manifest.json to zip root (same format as DS manifest)
      zip.file('manifest.json', JSON.stringify({ version: 1, entries: manifest }, null, 2));
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `billboard_images_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      
      setImageProgress(100);
      toast.success(`تم تحميل ${urlMappings.length} صورة بنجاح`);
    } catch (error) {
      console.error('Image download error:', error);
      toast.error('فشل في تحميل الصور');
    } finally {
      setIsDownloadingImages(false);
    }
  }, []);

  // Download Windows setup scripts
  const handleDownloadScripts = useCallback(() => {
    // PowerShell script
    const ps1Content = `# Billboard System - Local Setup Script (PowerShell)
# Run as Administrator

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Billboard System - Local Environment Setup  " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Please run this script as Administrator!" -ForegroundColor Red
    exit 1
}

# Create project directory
$projectDir = "C:\\billboard-local"
Write-Host "Creating project directory: $projectDir" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $projectDir | Out-Null
Set-Location $projectDir

# Check for winget
$wingetPath = Get-Command winget -ErrorAction SilentlyContinue
if (-not $wingetPath) {
    Write-Host "winget not found. Please install App Installer from Microsoft Store." -ForegroundColor Red
    exit 1
}

# Install Supabase CLI
Write-Host ""
Write-Host "[1/3] Installing Supabase CLI..." -ForegroundColor Green
winget install Supabase.CLI --accept-source-agreements --accept-package-agreements

# Install Docker Desktop (required for Supabase local)
Write-Host ""
Write-Host "[2/3] Checking Docker Desktop..." -ForegroundColor Green
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "Installing Docker Desktop..." -ForegroundColor Yellow
    winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
    Write-Host "Please restart your computer after Docker installation and run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 0
}

# Initialize Supabase project
Write-Host ""
Write-Host "[3/3] Initializing Supabase local project..." -ForegroundColor Green
supabase init

Write-Host ""
Write-Host "Starting Supabase services..." -ForegroundColor Yellow
supabase start

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  Setup Complete!                              " -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "API URL:      http://localhost:54321" -ForegroundColor Cyan
Write-Host "Database URL: postgresql://postgres:postgres@localhost:54322/postgres" -ForegroundColor Cyan
Write-Host "Studio URL:   http://localhost:54323" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy your database_full_restore.sql to $projectDir"
Write-Host "2. Run: psql -U postgres -d postgres -h localhost -p 54322 -f database_full_restore.sql"
Write-Host "3. Copy full_data_import.sql to $projectDir"
Write-Host "4. Run: psql -U postgres -d postgres -h localhost -p 54322 -f full_data_import.sql"
Write-Host ""
Read-Host "Press Enter to exit"
`;

    // Batch script
    const batContent = `@echo off
REM Billboard System - Local Setup Script (Batch)
REM Run as Administrator

echo ===============================================
echo   Billboard System - Local Environment Setup
echo ===============================================
echo.

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Please run this script as Administrator!
    pause
    exit /b 1
)

REM Create project directory
set PROJECT_DIR=C:\\billboard-local
echo Creating project directory: %PROJECT_DIR%
mkdir "%PROJECT_DIR%" 2>nul
cd /d "%PROJECT_DIR%"

echo.
echo [1/3] Installing Supabase CLI...
winget install Supabase.CLI --accept-source-agreements --accept-package-agreements

echo.
echo [2/3] Checking Docker...
docker --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing Docker Desktop...
    winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
    echo Please restart your computer after Docker installation and run this script again.
    pause
    exit /b 0
)

echo.
echo [3/3] Initializing Supabase local project...
call supabase init
call supabase start

echo.
echo ===============================================
echo   Setup Complete!
echo ===============================================
echo.
echo API URL:      http://localhost:54321
echo Database URL: postgresql://postgres:postgres@localhost:54322/postgres
echo Studio URL:   http://localhost:54323
echo.
echo Next steps:
echo 1. Copy your database_full_restore.sql to %PROJECT_DIR%
echo 2. Run: psql -U postgres -d postgres -h localhost -p 54322 -f database_full_restore.sql
echo 3. Copy full_data_import.sql to %PROJECT_DIR%
echo 4. Run: psql -U postgres -d postgres -h localhost -p 54322 -f full_data_import.sql
echo.
pause
`;

    // Create ZIP with both scripts
    const zip = new JSZip();
    zip.file('setup-windows.ps1', ps1Content);
    zip.file('setup-windows.bat', batContent);
    zip.file('README.txt', `Billboard System - Windows Setup Scripts

الملفات المرفقة:
- setup-windows.ps1: سكربت PowerShell (موصى به)
- setup-windows.bat: سكربت Batch

طريقة التشغيل:
1. انقر بزر الماوس الأيمن على الملف
2. اختر "Run as Administrator" أو "تشغيل كمسؤول"
3. اتبع التعليمات على الشاشة

المتطلبات:
- Windows 10/11
- Docker Desktop
- اتصال بالإنترنت (للتثبيت الأولي فقط)
`);

    zip.generateAsync({ type: 'blob' }).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'billboard_windows_setup.zip';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('تم تحميل سكربتات الإعداد');
    });
  }, []);

  const handleToggleMode = () => {
    if (!isOfflineMode) {
      // Switching to offline - show warning
      if (!confirm('هل أنت متأكد من التبديل إلى الوضع المحلي؟\n\nتأكد من:\n1. تنزيل البيانات أولاً\n2. تشغيل Supabase CLI محلياً\n3. استعادة قاعدة البيانات')) {
        return;
      }
    }
    setOfflineMode(!isOfflineMode, localUrl, localKey);
  };

  return (
    <div className="container mx-auto py-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">إعداد الوضع المحلي</h1>
          <p className="text-muted-foreground">تهجير البيانات والتبديل بين Supabase Cloud و PostgreSQL محلي</p>
        </div>
        <Badge variant={isOfflineMode ? 'secondary' : 'default'} className="mr-auto">
          {isOfflineMode ? (
            <><WifiOff className="h-3 w-3 ml-1" /> وضع أوفلاين</>
          ) : (
            <><Wifi className="h-3 w-3 ml-1" /> متصل بـ Cloud</>
          )}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Section A: Data Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              تصدير البيانات
            </CardTitle>
            <CardDescription>
              تنزيل جميع البيانات من Supabase كملف SQL قابل للاستيراد في PostgreSQL محلي
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isExporting && (
              <div className="space-y-2">
                <Progress value={exportProgress} />
                <p className="text-sm text-muted-foreground">جاري التصدير... {exportProgress}%</p>
                {exportedTables.length > 0 && (
                  <div className="max-h-32 overflow-y-auto text-xs bg-muted p-2 rounded">
                    {exportedTables.map((t, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button onClick={handleExportData} disabled={isExporting} className="w-full">
              {isExporting ? (
                <><Loader2 className="h-4 w-4 ml-2 animate-spin" /> جاري التصدير...</>
              ) : (
                <><FileDown className="h-4 w-4 ml-2" /> تنزيل كل البيانات (SQL)</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Section B: Image Download */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              تحميل الصور
            </CardTitle>
            <CardDescription>
              تحميل جميع الصور المرفقة في قاعدة البيانات للعمل في الوضع المحلي
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isDownloadingImages && (
              <div className="space-y-2">
                <Progress value={imageProgress} />
                <p className="text-sm text-muted-foreground">جاري التحميل... {imageProgress}%</p>
              </div>
            )}
            <Button onClick={handleDownloadImages} disabled={isDownloadingImages} variant="outline" className="w-full">
              {isDownloadingImages ? (
                <><Loader2 className="h-4 w-4 ml-2 animate-spin" /> جاري التحميل...</>
              ) : (
                <><Image className="h-4 w-4 ml-2" /> تحميل جميع الصور (ZIP)</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Section B2: Cache Images in Database */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              تخزين الصور في القاعدة
            </CardTitle>
            <CardDescription>
              تحويل الصور إلى base64 وتخزينها داخل قاعدة البيانات للعمل أوفلاين بدون ملفات خارجية
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCachingImages && (
              <div className="space-y-2">
                <Progress value={cacheProgress} />
                <p className="text-sm text-muted-foreground">
                  جاري التخزين... {cachedCount}/{totalImages} صورة ({cacheProgress}%)
                </p>
              </div>
            )}
            <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg space-y-1">
              <p>• يتم تحميل الصور بجودة 100% بدون أي ضغط</p>
              <p>• يتم تنزيل ملف SQL لاستيراده في القاعدة المحلية فقط</p>
              <p>• لا يتم رفع أي شيء إلى Supabase Cloud</p>
              <p>• في الوضع الأوفلاين يتم استدعاؤها تلقائياً بدل الروابط</p>
            </div>
            <Button onClick={handleCacheImages} disabled={isCachingImages} className="w-full">
              {isCachingImages ? (
                <><Loader2 className="h-4 w-4 ml-2 animate-spin" /> جاري التحميل...</>
              ) : (
                <><Database className="h-4 w-4 ml-2" /> تنزيل ملف SQL للصور (جودة كاملة)</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Section C: Mode Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              التبديل بين الأوضاع
            </CardTitle>
            <CardDescription>
              التبديل بين Supabase Cloud و PostgreSQL المحلي
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                {isOfflineMode ? (
                  <HardDrive className="h-6 w-6 text-orange-500" />
                ) : (
                  <Cloud className="h-6 w-6 text-blue-500" />
                )}
                <div>
                  <p className="font-medium">
                    {isOfflineMode ? 'PostgreSQL محلي' : 'Supabase Cloud'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isOfflineMode ? localUrl : '🔒 اتصال سحابي مشفر وآمن'}
                  </p>
                </div>
              </div>
              <Switch checked={isOfflineMode} onCheckedChange={handleToggleMode} />
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>URL المحلي</Label>
                <Input
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  placeholder="http://localhost:54321"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <Label>API Key المحلي</Label>
                <Input
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  dir="ltr"
                  type="password"
                />
              </div>
            </div>

            {!isOfflineMode && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">تنبيه قبل التبديل</p>
                  <p>تأكد من تنزيل البيانات والصور أولاً، وتشغيل Supabase CLI محلياً.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section D: Windows Scripts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              سكربتات Windows
            </CardTitle>
            <CardDescription>
              سكربتات إعداد البيئة المحلية تلقائياً على Windows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>السكربت يقوم بـ:</p>
              <ul className="list-disc list-inside mr-4 space-y-1">
                <li>تثبيت Supabase CLI</li>
                <li>تثبيت Docker Desktop</li>
                <li>تهيئة مشروع Supabase محلي</li>
                <li>تشغيل الخدمات المحلية</li>
              </ul>
            </div>
            <Button onClick={handleDownloadScripts} variant="outline" className="w-full">
              <Terminal className="h-4 w-4 ml-2" />
              تنزيل سكربتات الإعداد (.ps1 + .bat)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Guide */}
      <Card>
        <CardHeader>
          <CardTitle>خطوات الإعداد</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 justify-center">
            {[
              { step: 1, label: 'تنزيل البيانات', icon: Download },
              { step: 2, label: 'تحميل الصور', icon: Image },
              { step: 3, label: 'تنزيل السكربت', icon: Terminal },
              { step: 4, label: 'تشغيل السكربت', icon: Settings },
              { step: 5, label: 'استعادة DB', icon: Database },
              { step: 6, label: 'تبديل الوضع', icon: HardDrive },
            ].map(({ step, label, icon: Icon }, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs text-center">{label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className="w-8 h-0.5 bg-border mt-[-20px]" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
