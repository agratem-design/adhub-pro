/**
 * Desktop Automated Backup Service for AdHub Pro
 * - Executes silent pg_dump for ALL Supabase Database tables
 * - Emits real-time progress percentages (0% -> 100%)
 * - Saves local copy to Documents/AdHub_Backups
 * - Uploads copy to active Google Drive Apps Script endpoint
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

// Load Centralized Database Connection Config
let databaseJson = {};
try {
  const cfgPath = path.join(__dirname, 'databaseConfig.json');
  if (fs.existsSync(cfgPath)) {
    databaseJson = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
} catch (e) {
  console.warn('Failed to parse databaseConfig.json:', e.message);
}

const DB_CONFIG = {
  host: databaseJson.cloud?.host || 'aws-1-eu-north-1.pooler.supabase.com',
  port: databaseJson.cloud?.port || '5432',
  user: databaseJson.cloud?.user || 'postgres.atqjaiebixuzomrfwilu',
  dbname: databaseJson.cloud?.dbname || 'postgres',
  password: databaseJson.cloud?.password || 'Zer4oBi57gZ',
  supabaseUrl: databaseJson.cloud?.url || 'https://atqjaiebixuzomrfwilu.supabase.co',
  supabaseAnonKey: databaseJson.cloud?.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTkxOTcsImV4cCI6MjA3Mjc3NTE5N30.OGAQFsAl1Eo1tmPZ93VZoSL5tO2FYZa_szeRvUmoj-4',
  defaultDriveScriptUrl: 'https://script.google.com/macros/s/AKfycbw-RN9EpZzCAyuFlV32sRgT_c-plrDgz7nuvO-h1Kf1blhABst6NnCwFCImpFpql-Zw/exec',
};

const LOCAL_DB_CONFIG = {
  host: databaseJson.local?.host || '127.0.0.1',
  port: databaseJson.local?.port || '54322',
  user: databaseJson.local?.user || 'postgres',
  password: databaseJson.local?.password || 'postgres',
  dbname: databaseJson.local?.dbname || 'postgres',
};

/**
 * Finds the pg_dump executable on Windows
 */
function findPgDumpPath() {
  const commonPaths = [
    'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
    'C:\\Program Files (x86)\\PostgreSQL\\18\\bin\\pg_dump.exe',
    'C:\\Program Files (x86)\\PostgreSQL\\17\\bin\\pg_dump.exe',
    'C:\\Program Files (x86)\\PostgreSQL\\16\\bin\\pg_dump.exe',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Check if available in PATH
  try {
    const whereResult = execSync('where pg_dump', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (whereResult) {
      const firstPath = whereResult.split(/\r?\n/)[0];
      if (fs.existsSync(firstPath)) return firstPath;
    }
  } catch (e) {
    // Ignore PATH search errors
  }

  return null;
}

/**
 * Generates formatted backup filename: FARES-BILB_YYYY-MM-DD_HH-mm-ss.dump
 */
function generateBackupFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `FARES-BILB_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.dump`;
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a backup file has already been generated today
 */
function hasBackupForToday() {
  const dir = getBackupDirectory();
  if (!fs.existsSync(dir)) return false;

  const todayStr = getTodayDateString();
  const files = fs.readdirSync(dir);

  return files.some(f => f.includes(todayStr) && (f.endsWith('.dump') || f.endsWith('.sql')));
}

/**
 * Gets the local backup directory
 */
function getBackupDirectory() {
  const dir = path.join(os.homedir(), 'Documents', 'AdHub_Backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Fetches the active Google Drive Apps Script URL from Supabase system_settings
 */
async function fetchActiveDriveScriptUrl() {
  try {
    const url = `${DB_CONFIG.supabaseUrl}/rest/v1/system_settings?setting_key=eq.google_drive_script_url&select=setting_value`;
    const response = await fetch(url, {
      headers: {
        'apikey': DB_CONFIG.supabaseAnonKey,
        'Authorization': `Bearer ${DB_CONFIG.supabaseAnonKey}`,
      },
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0 && data[0].setting_value) {
        return data[0].setting_value;
      }
    }
  } catch (e) {
    console.error('Failed to fetch dynamic script URL, using fallback:', e);
  }
  return DB_CONFIG.defaultDriveScriptUrl;
}

/**
 * Uploads a file to Google Drive via Apps Script using fetch
 */
async function uploadToGoogleDrive(scriptUrl, base64Data, fileName) {
  const payload = {
    file: base64Data,
    name: fileName,
    type: 'application/octet-stream',
    folder: 'database-backups',
  };

  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    redirect: 'follow',
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  try {
    const json = JSON.parse(text);
    if (json.success || json.url || json.fileId) {
      return json.url || `https://drive.google.com/open?id=${json.fileId}`;
    }
    if (json.error) throw new Error(json.error);
  } catch (parseErr) {
    if (response.ok) {
      return 'تم الرفع إلى Google Drive بنجاح';
    }
  }

  throw new Error(`استجابة غير متوقعة من Google Drive: ${text.substring(0, 150)}`);
}

/**
 * Main function: Run full pg_dump and upload to Google Drive with progress
 * @param {Function} onProgress - Callback for status updates
 */
async function performBackup(onProgress = () => {}) {
  const pgDumpPath = findPgDumpPath();
  if (!pgDumpPath) {
    const errorMsg = 'لم يتم العثور على أداة pg_dump.exe على الجهاز (يرجى التأكد من تثبيت PostgreSQL)';
    onProgress({ stage: 'error', percent: 0, message: errorMsg });
    return { success: false, error: errorMsg };
  }

  const backupDir = getBackupDirectory();
  const fileName = generateBackupFileName();
  const fullPath = path.join(backupDir, fileName);
  const tempPath = path.join(backupDir, `${fileName}.tmp`);

  let currentPercent = 10;
  onProgress({
    stage: 'dumping',
    percent: currentPercent,
    message: 'جاري الاتصال وسحب الجداول من قاعدة البيانات (Supabase)...',
    fileName,
  });

  // Simulated smooth progression during pg_dump extraction (10% -> 50%)
  const dumpTimer = setInterval(() => {
    if (currentPercent < 48) {
      currentPercent += 2;
      onProgress({
        stage: 'dumping',
        percent: currentPercent,
        message: `جاري سحب وضغط بيانات الجداول... (${currentPercent}%)`,
        fileName,
      });
    }
  }, 1000);

  const env = {
    ...process.env,
    PGPASSWORD: DB_CONFIG.password,
  };

  const args = [
    '-h', DB_CONFIG.host,
    '-U', DB_CONFIG.user,
    '-p', DB_CONFIG.port,
    '-F', 'c',
    '-b',
    '-f', tempPath,
    DB_CONFIG.dbname,
  ];

  return new Promise((resolve) => {
    let stderrOutput = '';
    const child = spawn(pgDumpPath, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

    child.stderr.on('data', (chunk) => {
      stderrOutput += chunk.toString();
    });

    const cleanupTemp = () => {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (err) {
        console.warn('Temp cleanup warning:', err.message);
      }
    };

    child.on('error', (err) => {
      clearInterval(dumpTimer);
      delete env.PGPASSWORD;
      cleanupTemp();
      const errMsg = `خطأ أثناء تشغيل pg_dump: ${err.message}`;
      onProgress({ stage: 'error', percent: 0, message: errMsg });
      resolve({ success: false, error: errMsg });
    });

    child.on('close', async (code) => {
      clearInterval(dumpTimer);
      delete env.PGPASSWORD;

      if (code !== 0) {
        cleanupTemp();
        console.error('pg_dump exited with error:', code, stderrOutput);
        const errMsg = `فشل إنشاء النسخة الاحتياطية (رمز الخطأ: ${code}) - تم إلغاء وحذف الملف غير المكتمل`;
        onProgress({ stage: 'error', percent: 0, message: errMsg, details: stderrOutput });
        return resolve({ success: false, error: errMsg, details: stderrOutput });
      }

      if (!fs.existsSync(tempPath)) {
        const errMsg = 'فشل العثور على ملف النسخة الاحتياطية المؤقت';
        onProgress({ stage: 'error', percent: 0, message: errMsg });
        return resolve({ success: false, error: errMsg });
      }

      const tempStats = fs.statSync(tempPath);
      // Validate minimum size - an interrupted or empty dump is invalid
      if (tempStats.size < 1024) {
        cleanupTemp();
        const errMsg = 'النسخة الاحتياطية فارغة أو لم تكتمل بالشكل الصحيح - تم حذف الملف التالف';
        onProgress({ stage: 'error', percent: 0, message: errMsg });
        return resolve({ success: false, error: errMsg });
      }

      // Rename temp file to final .dump now that we are 100% sure it completed successfully
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        fs.renameSync(tempPath, fullPath);
      } catch (renameErr) {
        cleanupTemp();
        const errMsg = `خطأ أثناء حفظ ملف النسخة النهائي: ${renameErr.message}`;
        onProgress({ stage: 'error', percent: 0, message: errMsg });
        return resolve({ success: false, error: errMsg });
      }

      const stats = fs.statSync(fullPath);
      const fileSizeKB = Math.round(stats.size / 1024);
      const fileSizeMB = (fileSizeKB / 1024).toFixed(2);

      currentPercent = 55;
      onProgress({
        stage: 'uploading',
        percent: currentPercent,
        message: `تم حفظ النسخة محلياً بنجاح وتأكيد اكتمالها (${fileSizeMB} MB). جاري إرسالها إلى Google Drive...`,
        fileName,
        localPath: fullPath,
        fileSizeKB,
        fileSizeMB,
      });

      // Smooth upload progression (55% -> 92%)
      const uploadTimer = setInterval(() => {
        if (currentPercent < 92) {
          currentPercent += 3;
          onProgress({
            stage: 'uploading',
            percent: currentPercent,
            message: `جاري رفع النسخة إلى Google Drive (${fileSizeMB} MB)... ${currentPercent}%`,
            fileName,
            localPath: fullPath,
            fileSizeKB,
            fileSizeMB,
          });
        }
      }, 500);

      // Upload to Google Drive
      let driveUrl = null;
      let driveError = null;

      try {
        if (fileSizeKB > 25 * 1024) {
          driveError = 'حجم الملف أكبر من 25MB (تم حفظ النسخة محلياً بنجاح في مجلد المستندات)';
        } else {
          const scriptUrl = await fetchActiveDriveScriptUrl();
          const fileBuffer = fs.readFileSync(fullPath);
          const base64Data = fileBuffer.toString('base64');
          driveUrl = await uploadToGoogleDrive(scriptUrl, base64Data, fileName);
        }
      } catch (uploadErr) {
        console.error('Drive upload failed:', uploadErr);
        driveError = uploadErr.message || 'فشل الرفع إلى Google Drive';
      } finally {
        clearInterval(uploadTimer);
      }

      const finalResult = {
        success: true,
        fileName,
        localPath: fullPath,
        fileSizeKB,
        fileSizeMB,
        driveUrl,
        driveError,
        timestamp: new Date().toISOString(),
      };

      if (driveUrl) {
        onProgress({
          stage: 'complete',
          percent: 100,
          message: `تم إنشاء النسخة الاحتياطية الكاملة (${fileSizeMB} MB) ورفعها إلى Google Drive بنجاح ✅`,
          ...finalResult,
        });
      } else {
        onProgress({
          stage: 'warning',
          percent: 100,
          message: `تم حفظ النسخة محلياً بنجاح (${fileSizeMB} MB) ✅ ولكن تعذر الرفع إلى Google Drive (${driveError})`,
          ...finalResult,
        });
      }

      resolve(finalResult);
    });
  });
}

/**
 * Finds the psql executable on Windows
 */
function findPsqlPath() {
  const commonPaths = [
    'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe',
    'C:\\Program Files (x86)\\PostgreSQL\\18\\bin\\psql.exe',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  try {
    const whereResult = execSync('where psql', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (whereResult) {
      const firstPath = whereResult.split(/\r?\n/)[0];
      if (fs.existsSync(firstPath)) return firstPath;
    }
  } catch (e) {}

  return null;
}

/**
 * Finds the pg_restore executable on Windows
 */
function findPgRestorePath() {
  const commonPaths = [
    'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_restore.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_restore.exe',
    'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_restore.exe',
    'C:\\Program Files (x86)\\PostgreSQL\\18\\bin\\pg_restore.exe',
    'C:\\Program Files (x86)\\PostgreSQL\\17\\bin\\pg_restore.exe',
    'C:\\Program Files (x86)\\PostgreSQL\\16\\bin\\pg_restore.exe',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  try {
    const whereResult = execSync('where pg_restore', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (whereResult) {
      const firstPath = whereResult.split(/\r?\n/)[0];
      if (fs.existsSync(firstPath)) return firstPath;
    }
  } catch (e) {}

  return null;
}

/**
 * Lists all available backup files from local directory
 */
function listAvailableBackups() {
  const dir = getBackupDirectory();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir);
  const backups = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    // Auto-clean any leftover temporary or interrupted files
    if (file.endsWith('.tmp')) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
      continue;
    }

    if (file.endsWith('.dump') || file.endsWith('.sql') || file.endsWith('.zip')) {
      try {
        const stats = fs.statSync(filePath);
        // Automatically delete and skip 0-byte or corrupted partial files (< 1KB)
        if (stats.size < 1024) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {}
          continue;
        }

        const isCloudSnapshot = file.startsWith('FARES-BILB') || file.toLowerCase().includes('cloud') || file.toLowerCase().includes('online');
        backups.push({
          fileName: file,
          filePath,
          fileSizeKB: Math.round(stats.size / 1024),
          fileSizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          createdAt: stats.birthtime || stats.mtime,
          modifiedAt: stats.mtime,
          type: isCloudSnapshot ? 'online' : 'local',
          typeLabel: isCloudSnapshot ? 'نسخة سحابية (Online Backup)' : 'نسخة محلية (Local Backup)',
          format: path.extname(file).replace('.', '').toUpperCase(),
        });
      } catch (e) {
        console.error('Error reading backup file stats:', e);
      }
    }
  }

  return backups.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
}

/**
 * Restores a backup file (.dump or .sql) to a local PostgreSQL/Supabase database cleanly from scratch
 */
async function restoreBackupToLocal(filePath, localConfig = {}, onProgress = () => {}) {
  const pgRestore = findPgRestorePath();
  const psql = findPsqlPath();
  const host = localConfig.host || '127.0.0.1';
  const port = localConfig.port || '54322';
  const dbname = localConfig.dbname || 'postgres';
  const user = localConfig.user || 'postgres';
  const password = localConfig.password || 'postgres';

  if (!fs.existsSync(filePath)) {
    throw new Error(`الملف المحدد غير موجود: ${filePath}`);
  }

  const isSqlFile = filePath.toLowerCase().endsWith('.sql');

  return new Promise((resolve, reject) => {
    const env = { ...process.env, PGPASSWORD: password };

    onProgress({ stage: 'restoring', percent: 25, message: 'جاري استعادة الجداول والبيانات من النسخة الاحتياطية بصلاحيات الأدمن الكاملة...' });

    let child;

    if (isSqlFile) {
      if (!psql) {
        return reject(new Error('أداة psql غير متوفرة لتنفيذ ملف SQL.'));
      }
      const args = [
        '--host', host,
        '--port', String(port),
        '--username', user,
        '--dbname', dbname,
        '-f', filePath,
      ];
      child = spawn(psql, args, { env });
    } else {
      if (!pgRestore) {
        return reject(new Error('أداة pg_restore غير موجودة في مسار PostgreSQL.'));
      }
      const args = [
        '--host', host,
        '--port', String(port),
        '--username', user,
        '--dbname', dbname,
        '--clean',
        '--if-exists',
        '--no-owner',
        filePath,
      ];
      child = spawn(pgRestore, args, { env });
    }

    child.stdout.on('data', (data) => {
      onProgress({ stage: 'restoring', percent: 65, message: `جاري استعادة الجداول والبيانات: ${data.toString().slice(0, 80)}` });
    });

    child.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('restoring') || msg.includes('table') || msg.includes('copy') || msg.includes('data')) {
        onProgress({ stage: 'restoring', percent: 80, message: `جاري استيراد البيانات...` });
      }
    });

    child.on('close', (code) => {
      // Exit code 0 or 1 from pg_restore is considered successful (1 indicates non-fatal warnings)
      if (code === 0 || code === 1) {
        onProgress({ stage: 'permissions', percent: 90, message: 'جاري ضبط الصلاحيات وإعادة فهرسة الـ API المحلي...' });

        // Step 3: Grant all permissions to Supabase roles, disable RLS, and reload schema
        try {
          if (psql) {
            const sqlFile = path.join(__dirname, 'post_restore.sql');
            if (fs.existsSync(sqlFile)) {
              execSync(`"${psql}" -h ${host} -p ${port} -U ${user} -d ${dbname} -f "${sqlFile}"`, {
                env,
                stdio: 'ignore',
                timeout: 15000,
              });
            }
          }
        } catch (postErr) {
          console.warn('Post-restore permissions warning:', postErr.message);
        }

        onProgress({ stage: 'complete', percent: 100, message: 'تم تركيب النسخة الاحتياطية بالكامل ومطابقتها من الصفر بنجاح ✅' });
        resolve({ success: true, code, filePath });
      } else {
        reject(new Error(`فشلت عملية الاستعادة (كود الخروج: ${code})`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = {
  performBackup,
  getBackupDirectory,
  findPgDumpPath,
  findPgRestorePath,
  findPsqlPath,
  listAvailableBackups,
  restoreBackupToLocal,
  hasBackupForToday,
  getTodayDateString,
};
