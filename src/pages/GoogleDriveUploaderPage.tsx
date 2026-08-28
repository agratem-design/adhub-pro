import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  CloudUpload, 
  Copy, 
  ExternalLink, 
  FileText, 
  Check, 
  Trash2, 
  RefreshCw, 
  Settings, 
  History, 
  Folder, 
  CheckCircle2, 
  AlertCircle, 
  Download,
  Search,
  Code,
  Image as ImageIcon,
  Monitor,
  CheckCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface UploadItem {
  id: string;
  name: string;
  size: number;
  type: string;
  folder: string;
  file?: File;
  base64?: string;
  previewUrl?: string | null;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  directUrl: string;
  downloadUrl: string;
  viewUrl: string;
  fileId: string;
  errorMsg?: string;
  isImage: boolean;
  isUpdated?: boolean;
}

interface HistoryItem {
  id: string;
  name: string;
  size: number;
  type: string;
  folder: string;
  directUrl: string;
  downloadUrl: string;
  viewUrl: string;
  fileId: string;
  timestamp: string;
  isImage: boolean;
  isUpdated?: boolean;
}

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw-RN9EpZzCAyuFlV32sRgT_c-plrDgz7nuvO-h1Kf1blhABst6NnCwFCImpFpql-Zw/exec';

const APPS_SCRIPT_CODE = `function doPost(e) {
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

export default function GoogleDriveUploaderPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'settings'>('upload');
  const [targetFolder, setTargetFolder] = useState<string>('general');
  const [customFolder, setCustomFolder] = useState<string>('');
  const [scriptUrl, setScriptUrl] = useState<string>(DEFAULT_SCRIPT_URL);
  const [autoCopy, setAutoCopy] = useState<boolean>(true);
  const [concurrency, setConcurrency] = useState<number>(2);
  const [isTestingScript, setIsTestingScript] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [isDragActive, setIsDragActive] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadsCountRef = useRef<number>(0);

  // Load saved settings & history
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('gdrive_uploader_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const savedSettings = localStorage.getItem('gdrive_uploader_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.scriptUrl) setScriptUrl(parsed.scriptUrl);
        if (parsed.autoCopy !== undefined) setAutoCopy(parsed.autoCopy);
        if (parsed.concurrency) setConcurrency(parsed.concurrency);
      } else {
        supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'google_drive_script_url')
          .maybeSingle()
          .then(({ data }) => {
            if (data?.setting_value) setScriptUrl(data.setting_value);
          });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem('gdrive_uploader_history', JSON.stringify(newHistory.slice(0, 100)));
    } catch (e) {}
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('gdrive_uploader_settings', JSON.stringify({ scriptUrl, autoCopy, concurrency }));
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (e) {
      toast.error('تعذر حفظ الإعدادات');
    }
  };

  const cleanBase64 = (str: string) => {
    if (!str) return '';
    let cleaned = str.trim();
    if (cleaned.includes(',') && cleaned.startsWith('data:')) {
      cleaned = cleaned.split(',')[1];
    }
    return cleaned.replace(/\s/g, '');
  };

  // Process Files selection
  const handleFiles = useCallback((files: File[]) => {
    const folder = targetFolder === 'custom' ? (customFolder.trim() || 'general') : targetFolder;

    const newItems: UploadItem[] = files.map(file => {
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
      return {
        id: 'upload_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        folder: folder,
        file: file,
        previewUrl: isImg ? URL.createObjectURL(file) : null,
        status: 'pending',
        progress: 0,
        directUrl: '',
        downloadUrl: '',
        viewUrl: '',
        fileId: '',
        isImage: isImg,
      };
    });

    setQueue(prev => [...newItems, ...prev]);
  }, [targetFolder, customFolder]);

  // Drag & drop handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Global paste handler (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            const ext = file.type.split('/')[1] || 'png';
            const renamed = new File([file], `screenshot_${Date.now()}.${ext}`, { type: file.type });
            pastedFiles.push(renamed);
          }
        }
      }

      if (pastedFiles.length > 0) {
        handleFiles(pastedFiles);
        toast.info(`تم التقاط ${pastedFiles.length} ملف من الحافظة`);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFiles]);

  // Upload Queue Worker
  useEffect(() => {
    const pendingItem = queue.find(i => i.status === 'pending');
    if (!pendingItem || activeUploadsCountRef.current >= concurrency) return;

    activeUploadsCountRef.current += 1;

    const uploadItem = async (item: UploadItem) => {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading', progress: 10 } : q));

      let progressInterval: any;
      try {
        let base64 = item.base64;
        if (!base64 && item.file) {
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const res = reader.result as string;
              resolve(res);
            };
            reader.onerror = reject;
            reader.readAsDataURL(item.file!);
          });
        }

        const cleanedB64 = cleanBase64(base64 || '');
        if (!cleanedB64) throw new Error('تعذر قراءة محتوى الملف');

        const sizeKB = Math.round((cleanedB64.length * 3) / 4 / 1024);
        if (sizeKB > 25 * 1024) {
          throw new Error(`حجم الملف كبير (${(sizeKB / 1024).toFixed(1)} MB). الحد الأقصى عبر Drive Script هو 25MB.`);
        }

        let currentPct = 15;
        progressInterval = setInterval(() => {
          if (currentPct < 40) currentPct += 4;
          else if (currentPct < 75) currentPct += 2;
          else if (currentPct < 90) currentPct += 0.5;
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: currentPct } : q));
        }, 300);

        const response = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow',
          body: JSON.stringify({
            file: cleanedB64,
            name: item.name,
            type: item.type,
            folder: item.folder || 'general',
          }),
        });

        clearInterval(progressInterval);

        const result = await response.json();

        if (response.ok && (result?.url || result?.fileId || result?.id || result?.success)) {
          const rawUrl = result.url || '';
          let fileId = result.fileId || result.id || '';
          if (!fileId && rawUrl) {
            const ucMatch = rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (ucMatch) fileId = ucMatch[1];
            const fileMatch = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (fileMatch) fileId = fileMatch[1];
          }

          let directUrl = rawUrl;
          let downloadUrl = rawUrl;
          let viewUrl = rawUrl;

          if (item.isImage && fileId) {
            directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
            viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
            downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          } else if (fileId) {
            directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
            downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
            viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
          }

          setQueue(prev => prev.map(q => q.id === item.id ? {
            ...q,
            status: 'completed',
            progress: 100,
            directUrl,
            downloadUrl,
            viewUrl,
            fileId,
            isUpdated: !!result.updated,
          } : q));

          const historyEntry: HistoryItem = {
            id: item.id,
            name: item.name,
            size: item.size,
            type: item.type,
            folder: item.folder,
            directUrl,
            downloadUrl,
            viewUrl,
            fileId,
            timestamp: new Date().toISOString(),
            isImage: item.isImage,
            isUpdated: !!result.updated,
          };
          setHistory(prev => [historyEntry, ...prev.slice(0, 99)]);
          saveHistory([historyEntry, ...history.slice(0, 99)]);

          if (autoCopy && directUrl) {
            navigator.clipboard.writeText(directUrl);
            toast.success(`تم رفع ${item.name} ${result.updated ? '(تم تحديث الملف القديم)' : ''} ونسخ الرابط المباشر`);
          } else {
            toast.success(`تم رفع ${item.name} بنجاح`);
          }

        } else {
          throw new Error(result?.error || result?.message || 'فشل الرفع إلى Google Drive');
        }

      } catch (err: any) {
        clearInterval(progressInterval);
        setQueue(prev => prev.map(q => q.id === item.id ? {
          ...q,
          status: 'error',
          progress: 0,
          errorMsg: err.message || 'فشل الرفع',
        } : q));
        toast.error(`خطأ أثناء رفع ${item.name}: ${err.message}`);
      } finally {
        activeUploadsCountRef.current = Math.max(0, activeUploadsCountRef.current - 1);
      }
    };

    uploadItem(pendingItem);
  }, [queue, concurrency, scriptUrl, autoCopy, history]);

  // Copy helpers
  const copyToClipboard = (text: string, label: string = 'الرابط المباشر') => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label} إلى الحافظة`);
  };

  const copyAllCompleted = () => {
    const completed = queue.filter(q => q.status === 'completed' && q.directUrl);
    if (completed.length === 0) {
      toast.info('لا توجد ملفات مكتملة للنسخ');
      return;
    }
    const allLinks = completed.map(c => c.directUrl).join('\n');
    copyToClipboard(allLinks, `${completed.length} روابط`);
  };

  const clearCompleted = () => {
    setQueue(prev => prev.filter(q => q.status !== 'completed'));
    toast.info('تم مسح الملفات المكتملة');
  };

  const retryItem = (id: string) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'pending', progress: 0, errorMsg: undefined } : q));
  };

  const removeItem = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const handleTestScript = async () => {
    if (!scriptUrl) return;
    setIsTestingScript(true);
    setTestResult(null);
    try {
      const res = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({
          file: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          name: 'ping_test.png',
          type: 'image/png',
          folder: 'test',
        }),
      });
      const data = await res.json();
      if (res.ok && (data.url || data.fileId || data.success)) {
        setTestResult({ ok: true, msg: 'الاتصال ناجح! الخدمة تعمل وجاهزة لاستقبال الملفات وتوليد الروابط.' });
      } else {
        throw new Error(data.error || 'استجابة غير صالحة');
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: `فشل الاتصال: ${err.message}` });
    } finally {
      setIsTestingScript(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const totalItems = queue.length;
  const completedItems = queue.filter(q => q.status === 'completed').length;
  const isUploadingActive = queue.some(q => q.status === 'uploading' || q.status === 'pending');
  const overallProgress = totalItems > 0 ? (queue.reduce((acc, curr) => acc + curr.progress, 0) / totalItems) : 0;

  const filteredHistory = history.filter(h => 
    !historySearch.trim() || 
    h.name.toLowerCase().includes(historySearch.toLowerCase()) || 
    h.folder.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card border border-primary/20 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-inner">
            <CloudUpload className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              رافع ملفات Google Drive الذكي
              <Badge variant="outline" className="border-primary/40 text-primary text-xs font-mono">
                CDN Direct Link
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              رفع فائق السرعة للصور والملفات مع توليد الروابط المباشرة القابلة للمشاركة والمعاينة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-muted text-foreground text-xs py-1.5 px-3 flex items-center gap-1.5 border border-border">
            <Monitor className="w-3.5 h-3.5 text-primary" />
            <span>متوفر كتطبيق مستقل للكمبيوتر (.exe)</span>
          </Badge>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="bg-card border border-border p-1 rounded-xl">
          <TabsTrigger value="upload" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-bold">
            <CloudUpload className="w-3.5 h-3.5" />
            <span>الرفع المباشر</span>
            {queue.length > 0 && (
              <span className="bg-primary/20 text-primary px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                {queue.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-bold">
            <History className="w-3.5 h-3.5" />
            <span>السجل</span>
            <span className="bg-muted text-muted-foreground px-1.5 py-0.2 rounded-full text-[10px] font-mono">
              {history.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-bold">
            <Settings className="w-3.5 h-3.5" />
            <span>الإعدادات والسكربت</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: UPLOAD */}
        <TabsContent value="upload" className="space-y-4">
          
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3.5 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-primary" />
                <span>مجلد الوجهة:</span>
              </Label>
              <Select value={targetFolder} onValueChange={setTargetFolder}>
                <SelectTrigger className="w-48 h-8 text-xs border-border bg-background">
                  <SelectValue placeholder="اختر المجلد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">عام (general)</SelectItem>
                  <SelectItem value="images">صور (images)</SelectItem>
                  <SelectItem value="documents">مستندات (documents)</SelectItem>
                  <SelectItem value="designs">تصاميم (designs)</SelectItem>
                  <SelectItem value="files">ملفات متنوعة (files)</SelectItem>
                  <SelectItem value="custom">مجلد مخصص...</SelectItem>
                </SelectContent>
              </Select>
              {targetFolder === 'custom' && (
                <Input
                  type="text"
                  placeholder="اسم المجلد المخصص..."
                  value={customFolder}
                  onChange={e => setCustomFolder(e.target.value)}
                  className="h-8 text-xs w-40"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-bold cursor-pointer"
                onClick={async () => {
                  try {
                    if (navigator.clipboard?.read) {
                      const clipboardItems = await navigator.clipboard.read();
                      const files: File[] = [];
                      for (const item of clipboardItems) {
                        for (const type of item.types) {
                          if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            const ext = type.split('/')[1] || 'png';
                            files.push(new File([blob], `screenshot_${Date.now()}.${ext}`, { type }));
                          }
                        }
                      }
                      if (files.length > 0) {
                        handleFiles(files);
                        toast.success(`تم لصق ${files.length} صورة من الحافظة`);
                        return;
                      }
                    }
                    toast.info('اضغط Ctrl+V في أي مكان للصق الصور الملتقطة من الحافظة');
                  } catch (e) {
                    toast.info('اضغط Ctrl+V للصق من الحافظة');
                  }
                }}
                title="لصق صورة أو لقطة شاشة من الحافظة (Ctrl+V)"
              >
                <Copy className="w-3.5 h-3.5 ml-1.5" />
                <span>لصق من الحافظة (Ctrl+V)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <CloudUpload className="w-3.5 h-3.5 ml-1.5" />
                <span>استعراض ملفات</span>
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
              isDragActive 
                ? 'border-primary bg-primary/10 scale-[1.005]' 
                : 'border-border/80 hover:border-primary/60 bg-card/50 hover:bg-primary/5'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <CloudUpload className="w-7 h-7" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-foreground">
                اسحب وأفلت الصور والملفات هنا، أو اضغط لاختيارها من جهازك
              </p>
              <p className="text-xs text-muted-foreground">
                يدعم رفع صور متعددة، ميزة الاستبدال الذكي للملفات بنفس الرابط، ولصق لقطات الشاشة (Ctrl+V)
              </p>
            </div>
          </div>

          {/* Overall Batch Progress */}
          {isUploadingActive && (
            <Card className="border-primary/30 shadow-md">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    <span>جاري رفع الملفات: تم إكمال {completedItems} من {totalItems}</span>
                  </div>
                  <span className="font-mono font-bold text-primary">{Math.round(overallProgress)}%</span>
                </div>
                <Progress value={overallProgress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Queue List Header & Actions */}
          {queue.length > 0 && (
            <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <span>قائمة الملفات</span>
                <Badge variant="outline" className="font-mono text-[11px]">{queue.length}</Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={copyAllCompleted}
                  className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 ml-1.5" />
                  <span>نسخ جميع الروابط</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCompleted}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 ml-1.5" />
                  <span>مسح المكتمل</span>
                </Button>
              </div>
            </div>
          )}

          {/* Queue Items */}
          <div className="space-y-2.5">
            {queue.map(item => (
              <Card key={item.id} className={`transition-all ${item.status === 'completed' ? 'border-primary/40 bg-card' : item.status === 'error' ? 'border-destructive/40' : 'border-border'}`}>
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.isImage && item.previewUrl ? (
                          <img src={item.previewUrl} className="w-full h-full object-cover" alt="Preview" />
                        ) : (
                          <FileText className="w-5 h-5 text-primary" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground truncate" title={item.name}>{item.name}</p>
                          <Badge variant="secondary" className="text-[10px] font-mono py-0">{formatBytes(item.size)}</Badge>
                          <Badge variant="outline" className="text-[10px] font-mono py-0 text-primary border-primary/30">{item.folder}</Badge>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          {item.status === 'completed' ? (
                            <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تم الرفع بنجاح {item.isUpdated ? '(استبدال ذكي)' : ''}</span>
                            </span>
                          ) : item.status === 'uploading' ? (
                            <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
                              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                              <span>جاري الرفع... ({Math.round(item.progress)}%)</span>
                            </span>
                          ) : item.status === 'error' ? (
                            <span className="flex items-center gap-1 text-[11px] text-destructive font-medium truncate" title={item.errorMsg}>
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{item.errorMsg}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">بانتظار الرفع...</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.status === 'error' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retryItem(item.id)}
                          className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <RefreshCw className="w-3.5 h-3.5 ml-1" />
                          <span>إعادة المحاولة</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                  </div>

                  {item.status === 'uploading' && (
                    <Progress value={item.progress} className="h-1.5" />
                  )}

                  {item.status === 'completed' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/60 p-2 rounded-lg border border-border/80">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Badge variant="default" className="text-[10px] bg-primary/20 text-primary border border-primary/30 flex-shrink-0">
                          {item.isImage ? 'رابط CDN مباشر' : 'رابط تحميل مباشر'}
                        </Badge>
                        <Input
                          readOnly
                          value={item.directUrl}
                          className="h-7 text-[11px] font-mono bg-transparent border-0 focus-visible:ring-0 p-0 text-foreground truncate select-all"
                          dir="ltr"
                        />
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => copyToClipboard(item.directUrl, 'الرابط المباشر')}
                          className="h-7 text-xs bg-primary text-primary-foreground font-bold hover:bg-primary/90 cursor-pointer"
                        >
                          <Copy className="w-3 h-3 ml-1" />
                          <span>نسخ</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const md = item.isImage ? `![${item.name}](${item.directUrl})` : `[${item.name}](${item.directUrl})`;
                            copyToClipboard(md, 'كود Markdown');
                          }}
                          className="h-7 text-[11px] px-2"
                          title="نسخ كود Markdown"
                        >
                          MD
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const html = item.isImage ? `<img src="${item.directUrl}" alt="${item.name}" />` : `<a href="${item.directUrl}">${item.name}</a>`;
                            copyToClipboard(html, 'كود HTML');
                          }}
                          className="h-7 text-[11px] px-2"
                          title="نسخ كود HTML"
                        >
                          HTML
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(item.directUrl, '_blank')}
                          className="h-7 w-7 text-primary"
                          title="فتح في نافذة جديدة"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            ))}
          </div>

        </TabsContent>

        {/* TAB 2: HISTORY */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="بحث في السجل..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0"
              />
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (window.confirm('هل تريد مسح سجل الرفع؟')) {
                  saveHistory([]);
                  toast.info('تم مسح السجل');
                }
              }}
              className="h-8 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5 ml-1.5" />
              <span>مسح السجل</span>
            </Button>
          </div>

          <div className="space-y-2">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">لا توجد ملفات في السجل</p>
              </div>
            ) : (
              filteredHistory.map(h => (
                <div key={h.id} className="bg-card border border-border p-3 rounded-xl flex items-center justify-between gap-3 hover:border-primary/40 transition-all">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                      {h.isImage ? (
                        <img src={h.directUrl} className="w-full h-full object-cover" alt="Img" />
                      ) : (
                        <FileText className="w-4 h-4 text-primary" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate" title={h.name}>{h.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-mono">
                        <span>{formatBytes(h.size)}</span>
                        <span>•</span>
                        <span className="text-primary">{h.folder}</span>
                        <span>•</span>
                        <span>{new Date(h.timestamp).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(h.directUrl, 'الرابط المباشر')}
                      className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Copy className="w-3 h-3 ml-1" />
                      <span>نسخ</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(h.directUrl, '_blank')}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 3: SETTINGS & SCRIPT */}
        <TabsContent value="settings" className="space-y-5 max-w-3xl mx-auto">
          
          {/* Script URL Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <span>إعدادات رابط خدمة Google Apps Script</span>
              </CardTitle>
              <CardDescription className="text-xs">
                تهيئة رابط الـ Web App المنشور على حسابك في Google Apps Script لاستقبال الملفات وتوليد الروابط
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">رابط Web App Script URL:</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    dir="ltr"
                    value={scriptUrl}
                    onChange={e => setScriptUrl(e.target.value)}
                    className="text-xs font-mono"
                    placeholder="https://script.google.com/macros/s/.../exec"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestScript}
                    disabled={isTestingScript}
                    className="border-primary/40 text-primary hover:bg-primary/10 text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ml-1.5 ${isTestingScript ? 'animate-spin' : ''}`} />
                    <span>فحص الاتصال</span>
                  </Button>
                </div>
                {testResult && (
                  <p className={`text-xs ${testResult.ok ? 'text-emerald-500' : 'text-destructive'}`}>
                    {testResult.msg}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <div>
                  <p className="text-xs font-bold text-foreground">النسخ التلقائي للرابط</p>
                  <p className="text-[11px] text-muted-foreground">نسخ الرابط المباشر إلى الحافظة فور انتهاء الرفع مباشرة</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoCopy}
                  onChange={e => setAutoCopy(e.target.checked)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <div>
                  <p className="text-xs font-bold text-foreground">تزامن الرفع</p>
                  <p className="text-[11px] text-muted-foreground">عدد الملفات المرفوعة بالتوازي في نفس اللحظة</p>
                </div>
                <Select value={String(concurrency)} onValueChange={v => setConcurrency(Number(v))}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 ملف</SelectItem>
                    <SelectItem value="2">2 ملفين</SelectItem>
                    <SelectItem value="3">3 ملفات</SelectItem>
                    <SelectItem value="4">4 ملفات</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setScriptUrl(DEFAULT_SCRIPT_URL)} className="text-xs">
                  الافتراضي
                </Button>
                <Button size="sm" onClick={saveSettings} className="text-xs bg-primary text-primary-foreground font-bold">
                  حفظ الإعدادات
                </Button>
              </div>

            </CardContent>
          </Card>

          {/* Apps Script Code & Setup Instructions */}
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-500" />
                  <span>كود Google Apps Script المعتمد</span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  انسخ هذا الكود وانشره كتطبيق ويب (Web App) في Google Drive الخاص بك
                </CardDescription>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(APPS_SCRIPT_CODE);
                  toast.success('تم نسخ كود Google Apps Script بالكامل');
                }}
                className="text-xs bg-primary text-primary-foreground font-bold"
              >
                <Copy className="w-3.5 h-3.5 ml-1.5" />
                <span>نسخ كود السكربت</span>
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              
              {/* Step by step guide */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-2 text-xs">
                <p className="font-bold text-primary flex items-center gap-1.5">
                  <CheckCheck className="w-4 h-4" />
                  <span>خطوات نشر السكربت على Google Drive:</span>
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-[11.5px] text-muted-foreground leading-relaxed mr-1">
                  <li>افتح <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold">Google Drive</a> وأنشئ مجلداً جديداً لاستقبال الملفات، ثم افتحه وانسخ معرف المجلد (Folder ID) من شريط العنوان.</li>
                  <li>ضع الـ ID المنسوخ مكان قيمة <code className="bg-muted px-1 py-0.5 rounded text-amber-500 font-mono">MAIN_FOLDER_ID</code> في السطر الثالث من الكود.</li>
                  <li>افتح <a href="https://script.new" target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold">Google Apps Script (script.new)</a> والصق الكود بالكامل، ثم اضغط على حفظ.</li>
                  <li>من قائمة الدوال في الأعلى، اختر الدالة <code className="bg-muted px-1 py-0.5 rounded text-emerald-500 font-mono">forceAllPermissions</code> واضغط <strong>Run (تشغيل)</strong> لمنح الصلاحيات لحسابك.</li>
                  <li>اضغط على <strong>Deploy (نشر)</strong> في الزاوية العلوية ثم <strong>New deployment (نشر جديد)</strong>.</li>
                  <li>اضغط على الترس واختر <strong>Web app</strong>، واضبط <strong>Who has access</strong> على: <strong>Anyone</strong>.</li>
                  <li>اضغط <strong>Deploy</strong> وانسخ رابط الـ <strong>Web app URL</strong> المنتهي بـ <code className="text-amber-500 font-mono">/exec</code> والصقه في حقل الإعدادات أعلاه.</li>
                </ol>
              </div>

              {/* Code display */}
              <div className="relative bg-muted rounded-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2 bg-background border-b border-border text-[11px] font-mono text-muted-foreground">
                  <span>Code.gs</span>
                  <span className="text-emerald-500">JavaScript</span>
                </div>
                <pre className="p-3.5 text-[11px] font-mono text-foreground overflow-x-auto max-h-64 custom-scrollbar leading-relaxed select-text" dir="ltr">
                  <code>{APPS_SCRIPT_CODE}</code>
                </pre>
              </div>

            </CardContent>
          </Card>

        </TabsContent>

      </Tabs>

    </div>
  );
}
