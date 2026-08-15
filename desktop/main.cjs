/**
 * Electron Main Process for AdHub Pro
 * - Uses custom 'app://' protocol to ensure 100% accurate asset & logo loading
 * - Native High-Quality Save-as-PDF & Print support (Google Chrome style)
 * - Manages Windows native app window
 * - Coordinates silent background Supabase pg_dump & Google Drive upload
 * - Handles IPC communication
 */

const { app, BrowserWindow, ipcMain, shell, Menu, protocol, net, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const http = require('http');
const { performBackup, getBackupDirectory, findPgDumpPath, findPgRestorePath, listAvailableBackups, restoreBackupToLocal, hasBackupForToday, getTodayDateString } = require('./backupService.cjs');
const { startLocalSupabaseStack, stopLocalSupabaseStack, ensureLocalStackRunning, getLocalStackStatus } = require('./localServerService.cjs');

// Enable Chromium's built-in Google Chrome Print Preview with "Save as PDF" destination
app.commandLine.appendSwitch('enable-print-preview');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
let mainWindow = null;
let lastBackupResult = null;
let isBackingUp = false;

let staticServer = null;
let staticServerPort = 0;

function logToFile(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    let logDir = process.env.APPDATA ? path.join(process.env.APPDATA, 'adhub-pro') : 'C:\\Users\\p';
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'adhub_debug.log'), line);
  } catch(e) {}
  console.log(line.trim());
}

process.on('uncaughtException', (err) => {
  logToFile(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`);
});

process.on('unhandledRejection', (reason) => {
  logToFile(`UNHANDLED REJECTION: ${reason}`);
});

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function startStaticServer(distPath) {
  return new Promise((resolve) => {
    const MIME = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      '.webp': 'image/webp',
    };

    staticServer = http.createServer((req, res) => {
      try {
        let pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
        if (pathname.startsWith('/')) pathname = pathname.slice(1);
        if (!pathname) pathname = 'index.html';

        let targetPath = path.join(distPath, pathname);
        if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
          targetPath = path.join(distPath, 'index.html');
        }

        const ext = path.extname(targetPath).toLowerCase();
        const contentType = MIME[ext] || 'application/octet-stream';
        const fileContent = fs.readFileSync(targetPath);

        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        });
        res.end(fileContent);
      } catch (err) {
        try {
          const indexContent = fs.readFileSync(path.join(distPath, 'index.html'));
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(indexContent);
        } catch (e) {
          res.writeHead(500);
          res.end('Error loading AdHub');
        }
      }
    });

    staticServer.listen(0, '127.0.0.1', () => {
      staticServerPort = staticServer.address().port;
      logToFile(`[Static Server] Running at http://127.0.0.1:${staticServerPort}`);
      resolve(staticServerPort);
    });

    staticServer.on('error', (e) => {
      logToFile(`[Static Server] Error: ${e.message}`);
      resolve(0);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: 'الفارس الذهبي للدعاية - AdHub Pro',
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      devTools: true,
    },
    show: false,
    backgroundColor: '#0f172a',
  });

  // Remove standard top menu bar for clean modern look
  Menu.setApplicationMenu(null);

  // Show window when content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Capture renderer console messages to file
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logToFile(`[Renderer L${level}] ${message} (${sourceId}:${line})`);
  });

  // Log load errors if any occur
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logToFile(`[Load Failed] Code: ${errorCode} - ${errorDescription} (${validatedURL})`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logToFile(`[Renderer Process Gone] Reason: ${details.reason}, Code: ${details.exitCode}`);
  });

  // Open target URL in dev, or local production server
  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    logToFile(`Loading dev URL: ${process.env.VITE_DEV_SERVER_URL}`);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (staticServerPort > 0) {
    const localUrl = `http://127.0.0.1:${staticServerPort}/index.html`;
    logToFile(`Loading production local server: ${localUrl}`);
    mainWindow.loadURL(localUrl);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    logToFile(`Loading fallback file: ${indexPath}`);
    mainWindow.loadFile(indexPath);
  }

  // Handle external links and print popups
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith('http:') || targetUrl.startsWith('https:')) {
      shell.openExternal(targetUrl);
      return { action: 'deny' };
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1200,
        height: 850,
        icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          webSecurity: false,
        },
      },
    };
  });

  // Automatically trigger silent backup 5 seconds after launch
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      runAutoBackup();
    }, 5000);
  });
}

/**
 * Runs the automated background backup at most ONCE per day
 */
async function runAutoBackup(force = false) {
  if (isBackingUp) return;

  const todayStr = getTodayDateString();
  const stateFilePath = path.join(app.getPath('userData'), 'backup_state.json');

  let state = {};
  try {
    if (fs.existsSync(stateFilePath)) {
      state = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    }
  } catch (e) {}

  // Check if a backup was already created today (either in state file or in directory)
  if (!force && (state.lastBackupDate === todayStr || hasBackupForToday())) {
    console.log(`[AdHub Backup] تم تخطي النسخ التلقائي: توجد نسخة احتياطية سابقة لهذا اليوم (${todayStr}).`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:backup-status', {
        stage: 'skipped',
        percent: 100,
        message: `النسخة الاحتياطية لليوم (${todayStr}) جاهزة بالفعل ✅`,
      });
    }
    return;
  }

  isBackingUp = true;
  try {
    const result = await performBackup((progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:backup-status', progress);
      }
    });
    lastBackupResult = result;

    if (result && result.success) {
      try {
        fs.writeFileSync(
          stateFilePath,
          JSON.stringify({ lastBackupDate: todayStr, lastBackupTime: new Date().toISOString() }, null, 2)
        );
      } catch (e) {}
    }
  } catch (err) {
    console.error('Auto backup execution error:', err);
  } finally {
    isBackingUp = false;
  }
}

// ---- IPC Handlers ----

// Manual Backup Trigger from UI (Force immediate backup)
ipcMain.handle('desktop:trigger-backup', async () => {
  if (isBackingUp) {
    return { success: false, error: 'النسخ الاحتياطي جاري تنفيذه بالفعل...' };
  }
  isBackingUp = true;
  try {
    const result = await performBackup((progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:backup-status', progress);
      }
    });
    lastBackupResult = result;

    if (result && result.success) {
      try {
        const todayStr = getTodayDateString();
        const stateFilePath = path.join(app.getPath('userData'), 'backup_state.json');
        fs.writeFileSync(
          stateFilePath,
          JSON.stringify({ lastBackupDate: todayStr, lastBackupTime: new Date().toISOString() }, null, 2)
        );
      } catch (e) {}
    }

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    isBackingUp = false;
  }
});

// Open Local Backups Folder
ipcMain.handle('desktop:open-backups-folder', async () => {
  const dir = getBackupDirectory();
  await shell.openPath(dir);
  return { success: true, path: dir };
});

// List Available Local Backups
ipcMain.handle('desktop:list-backups', async () => {
  try {
    const list = listAvailableBackups();
    return { success: true, backups: list };
  } catch (err) {
    return { success: false, error: err.message, backups: [] };
  }
});

// Select Backup File Dialog
ipcMain.handle('desktop:select-backup-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'تحديد ملف النسخة الاحتياطية',
    defaultPath: getBackupDirectory(),
    filters: [
      { name: 'AdHub Backups (*.dump, *.sql, *.zip)', extensions: ['dump', 'sql', 'zip'] },
      { name: 'All Files (*.*)', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false, canceled: true };
  }

  const filePath = result.filePaths[0];
  const stats = fs.statSync(filePath);
  const fileName = path.basename(filePath);
  const isCloudSnapshot = fileName.startsWith('FARES-BILB') || fileName.toLowerCase().includes('cloud') || fileName.toLowerCase().includes('online');

  return {
    success: true,
    backup: {
      fileName,
      filePath,
      fileSizeKB: Math.round(stats.size / 1024),
      fileSizeMB: (stats.size / (1024 * 1024)).toFixed(2),
      createdAt: stats.birthtime || stats.mtime,
      modifiedAt: stats.mtime,
      type: isCloudSnapshot ? 'online' : 'local',
      typeLabel: isCloudSnapshot ? 'نسخة سحابية (Online Backup)' : 'نسخة محلية (Local Backup)',
      format: path.extname(fileName).replace('.', '').toUpperCase(),
    }
  };
});

// Restore Backup to Local PostgreSQL/Supabase Database
ipcMain.handle('desktop:restore-backup', async (event, { filePath, localConfig }) => {
  try {
    const result = await restoreBackupToLocal(filePath, localConfig, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:restore-progress', progress);
      }
    });
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Local Supabase Stack Status
ipcMain.handle('desktop:get-local-stack-status', async () => {
  return await getLocalStackStatus();
});

// Ensure Local Supabase Stack is running (Auto-Detect and Auto-Start)
ipcMain.handle('desktop:ensure-local-stack-running', async () => {
  try {
    const result = await ensureLocalStackRunning((progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:local-stack-progress', progress);
      }
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:local-stack-status', result);
    }
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Start Local Supabase Stack (Docker + Supabase start)
ipcMain.handle('desktop:start-local-stack', async () => {
  try {
    const result = await startLocalSupabaseStack((progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:local-stack-progress', progress);
      }
    });
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Stop Local Supabase Stack
ipcMain.handle('desktop:stop-local-stack', async () => {
  try {
    const result = await stopLocalSupabaseStack((progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:local-stack-progress', progress);
      }
    });
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// App Info
ipcMain.handle('desktop:get-app-info', async () => {
  const pgDumpFound = !!findPgDumpPath();
  const pgRestoreFound = !!findPgRestorePath();
  return {
    version: app.getVersion(),
    name: app.getName(),
    isPackaged: app.isPackaged,
    backupDir: getBackupDirectory(),
    pgDumpFound,
    pgRestoreFound,
    lastBackup: lastBackupResult,
  };
});

// Native Save-As-PDF (like Google Chrome PDF Export)
ipcMain.handle('desktop:save-as-pdf', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return { success: false, error: 'نافذة غير موجودة' };

  try {
    const pdfData = await event.sender.printToPDF({
      printBackground: true,
      landscape: options.landscape || false,
      pageSize: options.pageSize || 'A4',
      preferCSSPageSize: true,
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    });

    const cleanTitle = (options.title || 'document')
      .replace(/[\/:*?"<>|]/g, '-')
      .replace(/\.pdf$/i, '')
      .trim() + '.pdf';

    const saveResult = await dialog.showSaveDialog(win, {
      title: 'حفظ المستند بصيغة PDF',
      defaultPath: path.join(app.getPath('downloads'), cleanTitle),
      filters: [{ name: 'ملفات PDF (*.pdf)', extensions: ['pdf'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(saveResult.filePath, pdfData);
    return { success: true, filePath: saveResult.filePath };
  } catch (err) {
    console.error('printToPDF error:', err);
    return { success: false, error: err.message };
  }
});

// Native Print Document
ipcMain.handle('desktop:print-document', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return { success: false, error: 'نافذة غير موجودة' };

  event.sender.print({
    silent: options.silent || false,
    printBackground: options.printBackground !== undefined ? options.printBackground : true,
    deviceName: options.deviceName || '',
  });

  return { success: true };
});

// Common MIME types for app protocol
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.webp': 'image/webp',
};

// App Lifecycle
app.whenReady().then(async () => {
  const distPath = path.join(__dirname, '..', 'dist');

  // Start local static server in packaged / production app
  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  if (!isDev) {
    await startStaticServer(distPath);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
