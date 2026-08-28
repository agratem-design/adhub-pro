/**
 * Google Drive Desktop Uploader Engine
 * Enhanced with Native IPC Uploads, Clean Base64 Parser, Clipboard Paste (Ctrl+V) & Script Code Exporter
 */

(function () {
  'use strict';

  // Default configuration
  const DEFAULT_SETTINGS = {
    scriptUrl: 'https://script.google.com/macros/s/AKfycbw-RN9EpZzCAyuFlV32sRgT_c-plrDgz7nuvO-h1Kf1blhABst6NnCwFCImpFpql-Zw/exec',
    autoCopy: true,
    concurrency: 2,
    defaultFolder: 'general',
  };

  const APPS_SCRIPT_SOURCE = `function doPost(e) {
  try {
    var MAIN_FOLDER_ID = "1slgjSJK29P5JtqNRGyAfkfCh4buspZVF";
    var data = JSON.parse(e.postData.contents);

    var mimeType = data.type || "image/jpeg";
    var fileName = data.name || "file";
    var blob = Utilities.newBlob(
      Utilities.base64Decode(data.file), 
      mimeType, 
      fileName
    );

    // 1. الوصول للمجلد الرئيسي وإنشاء المجلدات الفرعية إن لزم الأمر
    var currentFolder = DriveApp.getFolderById(MAIN_FOLDER_ID);
    if (data.folder) {
      var folderNames = data.folder.split('/');
      for (var i = 0; i < folderNames.length; i++) {
        var folderName = folderNames[i].trim();
        if (folderName !== "") {
          var folders = currentFolder.getFoldersByName(folderName);
          if (folders.hasNext()) {
            currentFolder = folders.next();
          } else {
            currentFolder = currentFolder.createFolder(folderName);
          }
        }
      }
    }

    // 2. 🔄 ميزة الاستبدال السحري (Overwrite) للحفاظ على نفس الرابط
    var existingFiles = currentFolder.getFilesByName(fileName);
    var file;
    var fileId = "";
    var isUpdated = false;

    if (existingFiles.hasNext()) {
      // ✅ الملف موجود: نقوم بتحديث محتواه من الداخل دون تغيير الـ ID
      file = existingFiles.next();
      fileId = file.getId();
      
      var token = ScriptApp.getOAuthToken();
      var updateUrl = "https://www.googleapis.com/upload/drive/v3/files/" + fileId + "?uploadType=media";
      
      var options = {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": mimeType
        },
        payload: blob.getBytes(),
        muteHttpExceptions: true
      };
      
      // إرسال البيانات الجديدة للملف القديم
      UrlFetchApp.fetch(updateUrl, options);
      isUpdated = true;
      
    } else {
      // 🆕 الملف غير موجود: نقوم بإنشاء ملف جديد
      file = currentFolder.createFile(blob);
      fileId = file.getId();
      
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (err) {
        console.log("Sharing error: " + err);
      }
    }

    // 3. 🖼️ تحديد الرابط النهائي (lh3 للصور، وتنزيل مباشر للملفات)
    var finalUrl = "";
    
    if (mimeType.indexOf("image") !== -1) {
      // إيقاف السكربت ثانيتين لضمان توليد سيرفرات جوجل لرابط lh3
      Utilities.sleep(2000); 
      try {
        var thumbUrl = file.getThumbnailLink();
        if (thumbUrl) {
          finalUrl = thumbUrl.replace(/\\=s\\d+/, "=s2048"); // الحصول على أقصى جودة
        } else {
          finalUrl = "https://drive.google.com/uc?id=" + fileId;
        }
      } catch (thumbErr) {
        finalUrl = "https://drive.google.com/uc?id=" + fileId;
      }
    } else {
      // للملفات غير الصور (مثل Excel و PDF)
      finalUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
    }

    // 4. إرجاع النتيجة للواجهة
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        url: finalUrl,
        fileId: fileId,
        updated: isUpdated // سيعطيك true إذا تم استبدال ملف قديم
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}

function forceAllPermissions() {
  DriveApp.getFiles(); // لإجبار جوجل على طلب صلاحية Drive
  UrlFetchApp.fetch("https://www.google.com"); // لإجبار جوجل على طلب صلاحية الاتصال الخارجي
}`;

  // State
  let settings = loadSettings();
  let uploadQueue = [];
  let historyList = loadHistory();
  let isAlwaysOnTop = false;
  let activeUploadsCount = 0;

  // DOM Elements
  const el = {
    // Views & Tabs
    tabUploader: document.getElementById('tab-uploader-btn'),
    tabHistory: document.getElementById('tab-history-btn'),
    tabSettings: document.getElementById('tab-settings-btn'),
    viewUploader: document.getElementById('view-uploader'),
    viewHistory: document.getElementById('view-history'),
    viewSettings: document.getElementById('view-settings'),
    historyBadge: document.getElementById('history-badge'),

    // Window Controls
    btnPin: document.getElementById('btn-pin'),
    pinIcon: document.getElementById('pin-icon'),
    btnMinimize: document.getElementById('btn-minimize'),
    btnMaximize: document.getElementById('btn-maximize'),
    btnClose: document.getElementById('btn-close'),

    // Uploader Controls
    selectFolder: document.getElementById('select-folder'),
    inputCustomFolder: document.getElementById('input-custom-folder'),
    btnSelectFiles: document.getElementById('btn-select-files'),
    btnPasteClipboard: document.getElementById('btn-paste-clipboard'),
    fileInput: document.getElementById('file-input'),
    dropZone: document.getElementById('drop-zone'),

    // Queue & Actions
    queueHeader: document.getElementById('queue-header'),
    queueCount: document.getElementById('queue-count'),
    filesList: document.getElementById('files-list'),
    btnCopyAll: document.getElementById('btn-copy-all'),
    btnClearCompleted: document.getElementById('btn-clear-completed'),
    batchProgressContainer: document.getElementById('batch-progress-container'),
    batchProgressBar: document.getElementById('batch-progress-bar'),
    batchProgressStatus: document.getElementById('batch-progress-status'),
    batchProgressPercent: document.getElementById('batch-progress-percent'),

    // History View
    historyList: document.getElementById('history-list'),
    historySearch: document.getElementById('history-search'),
    btnExportHistory: document.getElementById('btn-export-history'),
    btnClearHistory: document.getElementById('btn-clear-history'),

    // Settings View
    settingScriptUrl: document.getElementById('setting-script-url'),
    settingAutoCopy: document.getElementById('setting-auto-copy'),
    settingConcurrency: document.getElementById('setting-concurrency'),
    btnTestScript: document.getElementById('btn-test-script'),
    testScriptResult: document.getElementById('test-script-result'),
    btnResetSettings: document.getElementById('btn-reset-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnCopyScriptCode: document.getElementById('btn-copy-script-code'),
    linkOpenDrive: document.getElementById('link-open-drive'),
    linkOpenGas: document.getElementById('link-open-gas'),

    // Footer & Notifications
    footerStatusText: document.getElementById('footer-status-text'),
    toastContainer: document.getElementById('toast-container'),
  };

  // Initialize App
  init();

  function init() {
    setupWindowControls();
    setupNavigation();
    setupDropZone();
    setupUploaderControls();
    setupClipboardPaste();
    setupHistory();
    setupSettings();
    renderHistory();
    updateHistoryBadge();
  }

  // -------------------------------------------------------------
  // 1. Settings & Persistence
  // -------------------------------------------------------------
  function loadSettings() {
    try {
      const saved = localStorage.getItem('gdrive_uploader_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettingsToStorage() {
    try {
      localStorage.setItem('gdrive_uploader_settings', JSON.stringify(settings));
    } catch (e) {}
  }

  function loadHistory() {
    try {
      const saved = localStorage.getItem('gdrive_uploader_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistoryToStorage() {
    try {
      localStorage.setItem('gdrive_uploader_history', JSON.stringify(historyList.slice(0, 100)));
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // 2. Window Controls (Electron IPC)
  // -------------------------------------------------------------
  function setupWindowControls() {
    if (window.electronAPI) {
      el.btnMinimize?.addEventListener('click', () => window.electronAPI.minimize());
      el.btnMaximize?.addEventListener('click', () => window.electronAPI.maximizeToggle());
      el.btnClose?.addEventListener('click', () => window.electronAPI.close());
      
      el.btnPin?.addEventListener('click', async () => {
        isAlwaysOnTop = !isAlwaysOnTop;
        await window.electronAPI.setAlwaysOnTop(isAlwaysOnTop);
        if (isAlwaysOnTop) {
          el.btnPin.classList.add('bg-[#d6ac40]/20', 'text-[#d6ac40]');
          showToast('تم تثبيت النافذة في المقدمة', 'info');
        } else {
          el.btnPin.classList.remove('bg-[#d6ac40]/20', 'text-[#d6ac40]');
          showToast('تم إلغاء تثبيت النافذة', 'info');
        }
      });
    } else {
      if (el.btnMinimize) el.btnMinimize.style.display = 'none';
      if (el.btnMaximize) el.btnMaximize.style.display = 'none';
      if (el.btnClose) el.btnClose.style.display = 'none';
      if (el.btnPin) el.btnPin.style.display = 'none';
    }
  }

  // -------------------------------------------------------------
  // 3. Navigation Tabs
  // -------------------------------------------------------------
  function setupNavigation() {
    const tabs = [
      { btn: el.tabUploader, view: el.viewUploader },
      { btn: el.tabHistory, view: el.viewHistory },
      { btn: el.tabSettings, view: el.viewSettings },
    ];

    tabs.forEach(({ btn, view }) => {
      btn?.addEventListener('click', () => {
        tabs.forEach(t => {
          t.btn?.classList.remove('active');
          t.btn?.classList.add('text-slate-400');
          t.view?.classList.add('hidden');
        });
        btn.classList.add('active');
        btn.classList.remove('text-slate-400');
        view.classList.remove('hidden');
      });
    });
  }

  // -------------------------------------------------------------
  // 4. Drag & Drop and File Selection
  // -------------------------------------------------------------
  function setupDropZone() {
    ['dragenter', 'dragover'].forEach(eventName => {
      el.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropZone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      el.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropZone.classList.remove('drag-active');
      });
    });

    el.dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        handleFilesSelected(Array.from(files));
      }
    });

    el.dropZone.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      triggerFilePicker();
    });
  }

  function setupUploaderControls() {
    el.selectFolder?.addEventListener('change', () => {
      if (el.selectFolder.value === 'custom') {
        el.inputCustomFolder.classList.remove('hidden');
        el.inputCustomFolder.focus();
      } else {
        el.inputCustomFolder.classList.add('hidden');
      }
    });

    el.btnSelectFiles?.addEventListener('click', () => {
      triggerFilePicker();
    });

    el.fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFilesSelected(Array.from(e.target.files));
        el.fileInput.value = '';
      }
    });

    el.btnCopyAll?.addEventListener('click', copyAllCompletedLinks);
    el.btnClearCompleted?.addEventListener('click', clearCompletedQueue);
  }

  // -------------------------------------------------------------
  // 5. Native & Browser Clipboard Paste (Ctrl+V)
  // -------------------------------------------------------------
  function setupClipboardPaste() {
    el.btnPasteClipboard?.addEventListener('click', async () => {
      await handlePasteFromClipboard();
    });

    window.addEventListener('paste', async (e) => {
      const isInputFocused = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
      const items = e.clipboardData?.items;
      
      let hasImageOrFile = false;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file') {
            hasImageOrFile = true;
            break;
          }
        }
      }

      if (isInputFocused && !hasImageOrFile) {
        return;
      }

      e.preventDefault();
      await handlePasteFromClipboard(e);
    });
  }

  async function handlePasteFromClipboard(pasteEvent = null) {
    if (window.electronAPI?.readClipboardFile) {
      try {
        const item = await window.electronAPI.readClipboardFile();
        if (item && item.base64) {
          addElectronFilesToQueue([item]);
          showToast(`تم التقاط ${item.name} من الحافظة وبدء الرفع`, 'success');
          return;
        }
      } catch (e) {
        console.error('Electron clipboard error:', e);
      }
    }

    const files = [];
    if (pasteEvent && pasteEvent.clipboardData?.items) {
      const items = pasteEvent.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            const ext = file.type.split('/')[1] || 'png';
            const renamed = new File([file], `screenshot_${Date.now()}.${ext}`, { type: file.type });
            files.push(renamed);
          }
        }
      }
    } else if (navigator.clipboard?.read) {
      try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const ext = type.split('/')[1] || 'png';
              const file = new File([blob], `screenshot_${Date.now()}.${ext}`, { type: type });
              files.push(file);
            }
          }
        }
      } catch (err) {
        console.warn('Browser clipboard read failed:', err);
      }
    }

    if (files.length > 0) {
      handleFilesSelected(files);
      showToast(`تم التقاط ${files.length} ملف من الحافظة وبدء الرفع`, 'success');
    } else {
      showToast('لا توجد صورة في الحافظة. التقط لقطة شاشة ثم اضغط لصق.', 'info');
    }
  }

  async function triggerFilePicker() {
    if (window.electronAPI?.selectFiles) {
      const filesData = await window.electronAPI.selectFiles();
      if (filesData && filesData.length > 0) {
        addElectronFilesToQueue(filesData);
      }
    } else {
      el.fileInput.click();
    }
  }

  function getSelectedFolder() {
    if (el.selectFolder.value === 'custom') {
      return el.inputCustomFolder.value.trim() || 'general';
    }
    return el.selectFolder.value || 'general';
  }

  function cleanBase64String(str) {
    if (!str) return '';
    let cleaned = String(str).trim();
    if (cleaned.includes(',') && cleaned.startsWith('data:')) {
      cleaned = cleaned.split(',')[1];
    }
    return cleaned.replace(/\s/g, '');
  }

  // -------------------------------------------------------------
  // 6. Queue Engine & Native / Fetch Upload Handling
  // -------------------------------------------------------------
  async function handleFilesSelected(files) {
    const targetFolder = getSelectedFolder();

    for (const file of files) {
      const queueItem = {
        id: 'upload_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        file: file,
        folder: targetFolder,
        status: 'pending',
        progress: 0,
        directUrl: '',
        downloadUrl: '',
        viewUrl: '',
        fileId: '',
        previewUrl: null,
        errorMsg: '',
      };

      if (file.type.startsWith('image/')) {
        queueItem.previewUrl = URL.createObjectURL(file);
      }

      uploadQueue.unshift(queueItem);
    }

    renderQueue();
    processQueue();
  }

  function addElectronFilesToQueue(filesData) {
    const targetFolder = getSelectedFolder();

    for (const item of filesData) {
      const queueItem = {
        id: 'upload_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        name: item.name,
        size: item.size,
        type: item.type,
        base64: cleanBase64String(item.base64),
        folder: targetFolder,
        status: 'pending',
        progress: 0,
        directUrl: '',
        downloadUrl: '',
        viewUrl: '',
        fileId: '',
        previewUrl: item.type.startsWith('image/') ? `data:${item.type};base64,${item.base64}` : null,
        errorMsg: '',
      };

      uploadQueue.unshift(queueItem);
    }

    renderQueue();
    processQueue();
  }

  async function processQueue() {
    const pendingItems = uploadQueue.filter(i => i.status === 'pending');
    if (pendingItems.length === 0 && activeUploadsCount === 0) {
      updateBatchProgress();
      return;
    }

    const maxConcurrency = Number(settings.concurrency) || 2;
    while (activeUploadsCount < maxConcurrency) {
      const nextItem = uploadQueue.find(i => i.status === 'pending');
      if (!nextItem) break;
      
      activeUploadsCount++;
      uploadSingleItem(nextItem).finally(() => {
        activeUploadsCount--;
        processQueue();
      });
    }

    updateBatchProgress();
  }

  async function uploadSingleItem(item) {
    item.status = 'uploading';
    item.progress = 5;
    renderQueue();
    updateBatchProgress();

    const progressTimer = setInterval(() => {
      if (item.progress < 30) item.progress += 4;
      else if (item.progress < 60) item.progress += 2;
      else if (item.progress < 85) item.progress += 1;
      else if (item.progress < 95) item.progress += 0.2;
      updateItemProgressUI(item);
      updateBatchProgress();
    }, 300);

    try {
      let rawBase64 = item.base64;
      if (!rawBase64 && item.file) {
        rawBase64 = await fileToBase64(item.file);
      }

      const base64String = cleanBase64String(rawBase64);
      if (!base64String) {
        throw new Error('تعذر قراءة بيانات الملف');
      }

      const sizeKB = Math.round((base64String.length * 3) / 4 / 1024);
      if (sizeKB > 25 * 1024) {
        throw new Error(`حجم الملف كبير (${(sizeKB / 1024).toFixed(1)} MB). الحد الأقصى عبر Google Apps Script هو 25 ميجابايت.`);
      }

      const scriptUrl = settings.scriptUrl || DEFAULT_SETTINGS.scriptUrl;

      const payload = {
        file: base64String,
        name: item.name,
        type: item.type,
        folder: item.folder || 'general',
      };

      let result = null;

      if (window.electronAPI?.uploadToGoogleDrive) {
        const response = await window.electronAPI.uploadToGoogleDrive({ scriptUrl, payload });
        if (!response.ok) {
          throw new Error(response.error || 'فشل الرفع عبر المحرك الأصلي');
        }
        result = response.data;
      } else {
        const response = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow',
          body: JSON.stringify(payload),
        });
        result = await response.json();
      }

      clearInterval(progressTimer);

      if (result && (result.url || result.fileId || result.id || result.success)) {
        const rawUrl = result.url || '';
        const fileId = result.fileId || result.id || extractGoogleDriveId(rawUrl);

        item.fileId = fileId;
        item.status = 'completed';
        item.progress = 100;

        const isImage = item.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(item.name);
        
        if (isImage && fileId) {
          item.directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
          item.viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
          item.downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        } else if (fileId) {
          item.directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          item.downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          item.viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
        } else {
          item.directUrl = rawUrl;
          item.downloadUrl = rawUrl;
          item.viewUrl = rawUrl;
        }

        addToHistory({
          id: item.id,
          name: item.name,
          size: item.size,
          type: item.type,
          folder: item.folder,
          directUrl: item.directUrl,
          downloadUrl: item.downloadUrl,
          viewUrl: item.viewUrl,
          fileId: item.fileId,
          timestamp: new Date().toISOString(),
          isImage: isImage,
          isUpdated: !!result.updated,
        });

        if (settings.autoCopy && item.directUrl) {
          copyText(item.directUrl, false);
          showToast(`تم رفع ${item.name} ${result.updated ? '(تم تحديث الملف القديم بنفس الرابط)' : ''} ونسخ الرابط المباشر`, 'success');
        } else {
          showToast(`تم رفع ${item.name} بنجاح ${result.updated ? '(استبدال ذكي)' : ''}`, 'success');
        }

      } else {
        throw new Error(result?.error || result?.message || 'فشل رفع الملف إلى Google Drive');
      }

    } catch (err) {
      clearInterval(progressTimer);
      item.status = 'error';
      item.progress = 0;
      item.errorMsg = err.message || 'حدث خطأ أثناء الرفع';
      showToast(`فشل رفع ${item.name}: ${item.errorMsg}`, 'error');
    }

    renderQueue();
    updateBatchProgress();
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        let base64 = reader.result;
        resolve(base64);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  function extractGoogleDriveId(url) {
    if (!url) return '';
    const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (ucMatch) return ucMatch[1];
    const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) return fileMatch[1];
    return '';
  }

  // -------------------------------------------------------------
  // 7. Queue UI Rendering
  // -------------------------------------------------------------
  function renderQueue() {
    if (uploadQueue.length === 0) {
      el.queueHeader?.classList.add('hidden');
      el.filesList.innerHTML = '';
      el.footerStatusText.textContent = 'جاهز للرفع';
      return;
    }

    el.queueHeader?.classList.remove('hidden');
    el.queueCount.textContent = uploadQueue.length;

    const completedCount = uploadQueue.filter(i => i.status === 'completed').length;
    const uploadingCount = uploadQueue.filter(i => i.status === 'uploading').length;

    if (uploadingCount > 0) {
      el.footerStatusText.textContent = `جاري رفع ${uploadingCount} ملف... (${completedCount}/${uploadQueue.length} مكتمل)`;
    } else if (completedCount === uploadQueue.length) {
      el.footerStatusText.textContent = `تم الانتهاء من جميع الملفات (${completedCount} ملف بنجاح)`;
    }

    el.filesList.innerHTML = uploadQueue.map(item => createQueueCardHTML(item)).join('');
    attachQueueCardEvents();
  }

  function updateItemProgressUI(item) {
    const card = document.getElementById(`card-${item.id}`);
    if (!card) return;
    const progressBar = card.querySelector('.progress-fill');
    const percentText = card.querySelector('.item-progress-percent');
    if (progressBar) progressBar.style.width = `${Math.round(item.progress)}%`;
    if (percentText) percentText.textContent = `${Math.round(item.progress)}%`;
  }

  function updateBatchProgress() {
    const uploadingItems = uploadQueue.filter(i => i.status === 'uploading' || i.status === 'pending');
    if (uploadingItems.length === 0 || uploadQueue.length === 0) {
      el.batchProgressContainer?.classList.add('hidden');
      return;
    }

    el.batchProgressContainer?.classList.remove('hidden');
    const completedItems = uploadQueue.filter(i => i.status === 'completed').length;
    const totalItems = uploadQueue.length;
    const totalProgress = uploadQueue.reduce((acc, curr) => acc + (curr.progress || 0), 0) / totalItems;

    el.batchProgressPercent.textContent = `${Math.round(totalProgress)}%`;
    el.batchProgressBar.style.width = `${totalProgress}%`;
    el.batchProgressStatus.textContent = `جاري الرفع: تم إكمال ${completedItems} من ${totalItems} ملفات`;
  }

  function createQueueCardHTML(item) {
    const isImage = item.type.startsWith('image/');
    const isCompleted = item.status === 'completed';
    const isUploading = item.status === 'uploading';
    const isError = item.status === 'error';

    const formattedSize = formatBytes(item.size);

    return `
      <div id="card-${item.id}" class="card-item ${isCompleted ? 'completed' : isError ? 'error' : ''}">
        <div class="flex items-center justify-between gap-3">
          
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-11 h-11 rounded-lg bg-[#111320] border border-[#282d47] flex items-center justify-center overflow-hidden flex-shrink-0">
              ${isImage && item.previewUrl ? `
                <img src="${item.previewUrl}" class="w-full h-full object-cover" alt="Preview">
              ` : `
                <svg class="w-5 h-5 text-[#d6ac40]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              `}
            </div>
            
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-xs font-bold text-slate-100 truncate" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</p>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#111320] border border-[#282d47] text-slate-400">${formattedSize}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-[#d6ac40]/10 text-[#d6ac40] font-mono">${escapeHtml(item.folder)}</span>
              </div>
              
              <div class="flex items-center gap-2 mt-1">
                ${isCompleted ? `
                  <span class="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <svg class="w-3.5 h-3.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>تم الرفع بنجاح</span>
                  </span>
                ` : isUploading ? `
                  <span class="flex items-center gap-1 text-[11px] text-[#d6ac40] font-medium">
                    <span class="w-2 h-2 rounded-full bg-[#d6ac40] animate-pulse"></span>
                    <span>جاري الرفع... (<span class="item-progress-percent font-mono">${Math.round(item.progress)}%</span>)</span>
                  </span>
                ` : isError ? `
                  <span class="flex items-center gap-1 text-[11px] text-red-400 font-medium truncate" title="${escapeHtml(item.errorMsg)}">
                    <svg class="w-3.5 h-3.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>${escapeHtml(item.errorMsg)}</span>
                  </span>
                ` : `
                  <span class="text-[11px] text-slate-500">في قائمة الانتظار...</span>
                `}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 flex-shrink-0">
            ${isError ? `
              <button class="btn-retry btn-dark text-red-400 hover:text-red-300" data-id="${item.id}">
                <svg class="w-3.5 h-3.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                <span>إعادة المحاولة</span>
              </button>
            ` : ''}

            <button class="btn-remove-item window-btn hover:text-red-400" data-id="${item.id}" title="حذف من القائمة">
              <svg class="w-3.5 h-3.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

        </div>

        ${isUploading ? `
          <div class="progress-track mt-1">
            <div class="progress-fill" style="width: ${Math.round(item.progress)}%"></div>
          </div>
        ` : ''}

        ${isCompleted ? `
          <div class="flex flex-wrap items-center justify-between gap-2 bg-[#111320] p-2 rounded-lg border border-[#282d47] mt-1">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="text-[10px] text-[#d6ac40] font-bold bg-[#d6ac40]/10 px-1.5 py-0.5 rounded border border-[#d6ac40]/20 flex-shrink-0">
                ${isImage ? 'رابط CDN مباشر' : 'رابط تحميل مباشر'}
              </span>
              <input type="text" readonly value="${escapeHtml(item.directUrl)}" class="bg-transparent text-[11px] font-mono text-slate-300 focus:outline-none w-full truncate select-all" dir="ltr">
            </div>

            <div class="flex items-center gap-1 flex-shrink-0">
              <button class="btn-copy-direct btn-gold text-[11px] py-1 px-2.5" data-url="${escapeHtml(item.directUrl)}">
                <svg class="w-3 h-3" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                <span>نسخ الرابط</span>
              </button>
              
              <button class="btn-copy-markdown btn-dark text-[11px] py-1 px-2" data-url="${escapeHtml(item.directUrl)}" data-name="${escapeHtml(item.name)}" data-isimage="${isImage}" title="نسخ كود Markdown">
                MD
              </button>

              <button class="btn-copy-html btn-dark text-[11px] py-1 px-2" data-url="${escapeHtml(item.directUrl)}" data-name="${escapeHtml(item.name)}" data-isimage="${isImage}" title="نسخ كود HTML">
                HTML
              </button>

              <button class="btn-open-link btn-dark text-[11px] p-1.5" data-url="${escapeHtml(item.directUrl)}" title="فتح الرابط في المتصفح">
                <svg class="w-3.5 h-3.5 text-[#d6ac40]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </button>
            </div>
          </div>
        ` : ''}

      </div>
    `;
  }

  function attachQueueCardEvents() {
    document.querySelectorAll('.btn-copy-direct').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        copyText(url);
        showToast('تم نسخ الرابط المباشر إلى الحافظة', 'success');
      });
    });

    document.querySelectorAll('.btn-copy-markdown').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        const name = btn.dataset.name;
        const isImage = btn.dataset.isimage === 'true';
        const md = isImage ? `![${name}](${url})` : `[${name}](${url})`;
        copyText(md);
        showToast('تم نسخ كود Markdown', 'success');
      });
    });

    document.querySelectorAll('.btn-copy-html').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        const name = btn.dataset.name;
        const isImage = btn.dataset.isimage === 'true';
        const html = isImage ? `<img src="${url}" alt="${name}" />` : `<a href="${url}" target="_blank">${name}</a>`;
        copyText(html);
        showToast('تم نسخ كود HTML', 'success');
      });
    });

    document.querySelectorAll('.btn-open-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        openExternalLink(url);
      });
    });

    document.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        uploadQueue = uploadQueue.filter(i => i.id !== id);
        renderQueue();
        updateBatchProgress();
      });
    });

    document.querySelectorAll('.btn-retry').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = uploadQueue.find(i => i.id === id);
        if (item) {
          item.status = 'pending';
          item.progress = 0;
          item.errorMsg = '';
          renderQueue();
          processQueue();
        }
      });
    });
  }

  function copyAllCompletedLinks() {
    const completedItems = uploadQueue.filter(i => i.status === 'completed' && i.directUrl);
    if (completedItems.length === 0) {
      showToast('لا توجد ملفات مكتملة لنسخ روابطها', 'info');
      return;
    }

    const linksText = completedItems.map(i => i.directUrl).join('\n');
    copyText(linksText);
    showToast(`تم نسخ ${completedItems.length} روابط مجمعة إلى الحافظة`, 'success');
  }

  function clearCompletedQueue() {
    uploadQueue = uploadQueue.filter(i => i.status !== 'completed');
    renderQueue();
    updateBatchProgress();
    showToast('تم مسح الملفات المكتملة من القائمة', 'info');
  }

  // -------------------------------------------------------------
  // 8. History Management
  // -------------------------------------------------------------
  function setupHistory() {
    el.historySearch?.addEventListener('input', () => {
      renderHistory();
    });

    el.btnExportHistory?.addEventListener('click', () => {
      if (historyList.length === 0) {
        showToast('السجل فارغ لا توجد روابط للتصدير', 'info');
        return;
      }
      const text = historyList.map(h => `${h.name}\t${h.folder}\t${h.directUrl}\t${h.timestamp}`).join('\n');
      copyText(text);
      showToast('تم نسخ جدول السجل بالكامل إلى الحافظة', 'success');
    });

    el.btnClearHistory?.addEventListener('click', () => {
      if (confirm('هل أنت متأكد من رغبتك في مسح سجل الرفع بالكامل؟')) {
        historyList = [];
        saveHistoryToStorage();
        renderHistory();
        updateHistoryBadge();
        showToast('تم مسح سجل الرفع', 'info');
      }
    });
  }

  function addToHistory(entry) {
    historyList.unshift(entry);
    if (historyList.length > 100) historyList = historyList.slice(0, 100);
    saveHistoryToStorage();
    renderHistory();
    updateHistoryBadge();
  }

  function updateHistoryBadge() {
    if (el.historyBadge) {
      el.historyBadge.textContent = historyList.length;
    }
  }

  function renderHistory() {
    if (!el.historyList) return;

    const searchTerm = (el.historySearch?.value || '').trim().toLowerCase();
    const filtered = historyList.filter(h => 
      !searchTerm || 
      h.name.toLowerCase().includes(searchTerm) || 
      (h.folder && h.folder.toLowerCase().includes(searchTerm))
    );

    if (filtered.length === 0) {
      el.historyList.innerHTML = `
        <div class="text-center py-12 text-slate-500 bg-[#16192a]/50 rounded-xl border border-[#282d47]">
          <svg class="w-10 h-10 mx-auto text-slate-600 mb-2" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p class="text-xs">لا توجد ملفات في السجل حالياً</p>
        </div>
      `;
      return;
    }

    el.historyList.innerHTML = filtered.map(h => `
      <div class="card-item hover:border-[#d6ac40]/40 flex-row items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="w-9 h-9 rounded-lg bg-[#111320] border border-[#282d47] flex items-center justify-center overflow-hidden flex-shrink-0">
            ${h.isImage ? `
              <img src="${h.directUrl}" class="w-full h-full object-cover" onerror="this.src=''" alt="Img">
            ` : `
              <svg class="w-4 h-4 text-[#d6ac40]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            `}
          </div>

          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-slate-200 truncate" title="${escapeHtml(h.name)}">${escapeHtml(h.name)}</p>
            <div class="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
              <span>${formatBytes(h.size)}</span>
              <span>•</span>
              <span class="text-[#d6ac40]">${escapeHtml(h.folder || 'general')}</span>
              <span>•</span>
              <span>${new Date(h.timestamp).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-shrink-0">
          <button class="btn-copy-history btn-dark text-xs py-1 px-2.5" data-url="${escapeHtml(h.directUrl)}">
            <svg class="w-3.5 h-3.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>نسخ</span>
          </button>
          
          <button class="btn-open-history btn-dark p-1.5" data-url="${escapeHtml(h.directUrl)}" title="فتح الرابط">
            <svg class="w-3.5 h-3.5 text-[#d6ac40]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.btn-copy-history').forEach(btn => {
      btn.addEventListener('click', () => {
        copyText(btn.dataset.url);
        showToast('تم نسخ الرابط المباشر إلى الحافظة', 'success');
      });
    });

    document.querySelectorAll('.btn-open-history').forEach(btn => {
      btn.addEventListener('click', () => {
        openExternalLink(btn.dataset.url);
      });
    });
  }

  // -------------------------------------------------------------
  // 9. Settings View & Script Exporter
  // -------------------------------------------------------------
  function setupSettings() {
    if (el.settingScriptUrl) el.settingScriptUrl.value = settings.scriptUrl || DEFAULT_SETTINGS.scriptUrl;
    if (el.settingAutoCopy) el.settingAutoCopy.checked = !!settings.autoCopy;
    if (el.settingConcurrency) el.settingConcurrency.value = String(settings.concurrency || 2);

    el.btnSaveSettings?.addEventListener('click', () => {
      settings.scriptUrl = el.settingScriptUrl.value.trim() || DEFAULT_SETTINGS.scriptUrl;
      settings.autoCopy = el.settingAutoCopy.checked;
      settings.concurrency = Number(el.settingConcurrency.value) || 2;
      saveSettingsToStorage();
      showToast('تم حفظ الإعدادات بنجاح', 'success');
    });

    el.btnResetSettings?.addEventListener('click', () => {
      settings = { ...DEFAULT_SETTINGS };
      el.settingScriptUrl.value = settings.scriptUrl;
      el.settingAutoCopy.checked = settings.autoCopy;
      el.settingConcurrency.value = String(settings.concurrency);
      saveSettingsToStorage();
      showToast('تمت استعادة الإعدادات الافتراضية', 'info');
    });

    // Copy Apps Script Code Button
    el.btnCopyScriptCode?.addEventListener('click', () => {
      copyText(APPS_SCRIPT_SOURCE);
      showToast('تم نسخ كود Google Apps Script بالكامل إلى الحافظة', 'success');
    });

    // Links to Google Drive and Apps Script
    el.linkOpenDrive?.addEventListener('click', (e) => {
      e.preventDefault();
      openExternalLink('https://drive.google.com');
    });

    el.linkOpenGas?.addEventListener('click', (e) => {
      e.preventDefault();
      openExternalLink('https://script.new');
    });

    el.btnTestScript?.addEventListener('click', async () => {
      const url = el.settingScriptUrl.value.trim();
      if (!url) {
        showToast('يرجى كتابة رابط Google Apps Script أولاً', 'error');
        return;
      }

      el.testScriptResult.classList.remove('hidden', 'text-emerald-400', 'text-red-400');
      el.testScriptResult.classList.add('text-[#d6ac40]');
      el.testScriptResult.textContent = 'جاري اختبار الاتصال بسيرفر Google Apps Script...';

      try {
        const payload = {
          file: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          name: 'ping_test.png',
          type: 'image/png',
          folder: 'test',
        };

        let result = null;
        if (window.electronAPI?.uploadToGoogleDrive) {
          const res = await window.electronAPI.uploadToGoogleDrive({ scriptUrl: url, payload });
          if (!res.ok) throw new Error(res.error);
          result = res.data;
        } else {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            redirect: 'follow',
            body: JSON.stringify(payload),
          });
          result = await res.json();
        }

        if (result && (result.url || result.fileId || result.success)) {
          el.testScriptResult.classList.remove('text-[#d6ac40]');
          el.testScriptResult.classList.add('text-emerald-400');
          el.testScriptResult.textContent = 'الاتصال ناجح تماماً! السيرفر يستقبل الملفات ويولد الروابط بنجاح.';
        } else {
          throw new Error(result?.error || 'استجاب السيرفر ولكن بتنسيق غير متوقع');
        }
      } catch (err) {
        el.testScriptResult.classList.remove('text-[#d6ac40]');
        el.testScriptResult.classList.add('text-red-400');
        el.testScriptResult.textContent = `فشل اختبار الاتصال: ${err.message}`;
      }
    });
  }

  // -------------------------------------------------------------
  // 10. Helpers & Utilities
  // -------------------------------------------------------------
  function copyText(text, notify = true) {
    if (!text) return;
    if (window.electronAPI?.copyToClipboard) {
      window.electronAPI.copyToClipboard(text);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  }

  function openExternalLink(url) {
    if (!url) return;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  function showToast(message, type = 'info') {
    if (!el.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-item pointer-events-auto bg-[#16192a] border ${
      type === 'success' ? 'border-emerald-500/50 text-emerald-300' :
      type === 'error' ? 'border-red-500/50 text-red-300' :
      'border-[#d6ac40]/50 text-[#f4c25a]'
    } px-3.5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-medium backdrop-blur-md`;

    const iconSvg = type === 'success' ? `
      <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    ` : type === 'error' ? `
      <svg class="w-4 h-4 text-red-400 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    ` : `
      <svg class="w-4 h-4 text-[#d6ac40] flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
    `;

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
