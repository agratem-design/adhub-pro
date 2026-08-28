const { app, BrowserWindow, ipcMain, shell, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

app.commandLine.appendSwitch('disable-gpu-sandbox');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1020,
    height: 780,
    minWidth: 840,
    minHeight: 600,
    title: 'رافع ملفات Google Drive - Google Drive Uploader',
    backgroundColor: '#0a0b12',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
    icon: path.join(__dirname, 'drive_icon.ico'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: false });
  });
}

// Window control IPC handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize-toggle', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow.maximize();
    return true;
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('set-always-on-top', (event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(!!flag);
    return mainWindow.isAlwaysOnTop();
  }
  return false;
});

ipcMain.handle('open-external-url', async (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('copy-to-clipboard', (event, text) => {
  if (typeof text === 'string') {
    clipboard.writeText(text);
    return true;
  }
  return false;
});

// Powerful Clipboard reader for Electron
ipcMain.handle('read-clipboard-file', async () => {
  try {
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      const pngBuffer = image.toPNG();
      const base64 = pngBuffer.toString('base64');
      return {
        name: `screenshot_${Date.now()}.png`,
        size: pngBuffer.length,
        type: 'image/png',
        base64: base64,
      };
    }

    const text = clipboard.readText();
    if (text) {
      const cleanPath = text.replace(/^"|"$/g, '').trim();
      if (fs.existsSync(cleanPath)) {
        const stats = fs.statSync(cleanPath);
        if (stats.isFile()) {
          const buffer = fs.readFileSync(cleanPath);
          const ext = path.extname(cleanPath).toLowerCase();
          let mimeType = 'application/octet-stream';
          if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
          else if (ext === '.png') mimeType = 'image/png';
          else if (ext === '.webp') mimeType = 'image/webp';
          else if (ext === '.pdf') mimeType = 'application/pdf';
          else if (['.xlsx', '.xls'].includes(ext)) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

          return {
            name: path.basename(cleanPath),
            size: stats.size,
            type: mimeType,
            base64: buffer.toString('base64'),
          };
        }
      }
    }
  } catch (e) {
    console.error('Error reading clipboard in electron:', e);
  }
  return null;
});

ipcMain.handle('select-files-dialog', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: 'اختر الملفات للرفع إلى Google Drive',
    buttonLabel: 'إضافة للرفع',
  });
  if (result.canceled || !result.filePaths) return [];
  
  const filesData = [];
  for (const filePath of result.filePaths) {
    try {
      const stats = fs.statSync(filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      
      let mimeType = 'application/octet-stream';
      if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.svg') mimeType = 'image/svg+xml';
      else if (ext === '.pdf') mimeType = 'application/pdf';
      else if (['.xlsx', '.xls'].includes(ext)) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      else if (['.docx', '.doc'].includes(ext)) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (ext === '.zip') mimeType = 'application/zip';
      else if (ext === '.txt') mimeType = 'text/plain';

      filesData.push({
        name: fileName,
        size: stats.size,
        type: mimeType,
        base64: base64,
        path: filePath,
      });
    } catch (e) {
      console.error('Error reading file:', filePath, e);
    }
  }
  return filesData;
});

/**
 * Bulletproof Native HTTPS Uploader for Google Apps Script
 * Handles Google 302 redirect with GET method and clean JSON return
 */
function uploadToGoogleDriveNative(targetUrl, payload, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const postData = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    function makeRequest(currentUrl, isRedirect = false, redirectsLeft = maxRedirects) {
      if (redirectsLeft <= 0) {
        return reject(new Error('Too many redirects'));
      }

      const parsed = new URL(currentUrl);
      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: isRedirect ? 'GET' : 'POST',
        headers: isRedirect ? {
          'User-Agent': 'GoogleDrive-Uploader/1.0',
          'Accept': 'application/json, text/plain, */*'
        } : {
          'Content-Type': 'text/plain;charset=utf-8',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'GoogleDrive-Uploader/1.0',
          'Accept': 'application/json, text/plain, */*'
        },
        timeout: 120000
      };

      const req = client.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let nextUrl = res.headers.location;
          if (nextUrl.startsWith('/')) {
            nextUrl = parsed.origin + nextUrl;
          }
          res.resume();
          return makeRequest(nextUrl, true, redirectsLeft - 1);
        }

        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const parsedJson = JSON.parse(body);
            resolve(parsedJson);
          } catch (e) {
            if (body.includes('<html') || body.includes('<!DOCTYPE')) {
              reject(new Error('استجاب سيرفر Google بصفحة HTML بدلاً من JSON: ' + body.replace(/<[^>]*>?/gm, '').substring(0, 150).trim()));
            } else {
              reject(new Error('استجابة غير صالحة من Google: ' + body.substring(0, 150)));
            }
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('انتهت مهلة الاتصال مع Google Apps Script (Timeout)'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (!isRedirect) {
        req.write(postData);
      }
      req.end();
    }

    makeRequest(targetUrl, false, maxRedirects);
  });
}

// IPC handler for uploading files directly via native Node HTTPS
ipcMain.handle('upload-to-google-drive', async (event, { scriptUrl, payload }) => {
  try {
    const result = await uploadToGoogleDriveNative(scriptUrl, payload);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err.message || 'فشل الاتصال مع سيرفر Google' };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
