// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Database,
  Cloud,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  FileDown,
  FolderOpen,
  RefreshCw,
  Server,
  KeyRound,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  Play,
  Square,
  Cpu,
  UploadCloud,
  DownloadCloud,
  ArrowUpDown,
  Layers,
  Sparkles,
  Zap,
  Check,
  X,
  Shield,
} from 'lucide-react';
import {
  isOfflineMode,
  getOfflineSettings,
  setOfflineMode,
  DEFAULT_LOCAL_URL,
  DEFAULT_LOCAL_KEY,
  DEFAULT_CLOUD_URL,
} from '@/integrations/supabase/client';
import { syncLocalToCloud, syncCloudToLocal, SyncProgressData } from '@/services/dataSyncService';
import { ImageCacheManager } from './ImageCacheManager';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BackupItem {
  fileName: string;
  filePath: string;
  fileSizeKB: number;
  fileSizeMB: string;
  createdAt: string;
  modifiedAt: string;
  type: 'online' | 'local';
  typeLabel: string;
  format: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFirstRun?: boolean;
}

export function DatabaseModeModal({ open, onOpenChange, isFirstRun = false }: Props) {
  const currentSettings = getOfflineSettings();
  const [selectedMode, setSelectedMode] = useState<'cloud' | 'local'>(isOfflineMode ? 'local' : 'cloud');
  const [localUrl, setLocalUrl] = useState(currentSettings.localUrl || DEFAULT_LOCAL_URL);
  const [localKey, setLocalKey] = useState(currentSettings.localKey || DEFAULT_LOCAL_KEY);
  
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(null);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ percent: number; message: string; stage?: string } | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  // Local Docker & Supabase Stack automation states
  const [stackStatus, setStackStatus] = useState<{ dockerRunning: boolean; supabaseRunning: boolean } | null>(null);
  const [isStartingStack, setIsStartingStack] = useState(false);
  const [stackProgress, setStackProgress] = useState<{ percent: number; message: string } | null>(null);

  // Synchronization states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncType, setSyncType] = useState<'upload' | 'download' | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgressData | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('adhub_last_cloud_sync_time') : null
  );

  const isDesktop = typeof window !== 'undefined' && !!(window as any).desktopAPI;

  // Load available backups from desktop service
  const loadBackups = async () => {
    if (!isDesktop) return;
    setLoadingBackups(true);
    try {
      const res = await (window as any).desktopAPI.listBackups();
      if (res.success && Array.isArray(res.backups)) {
        setBackups(res.backups);
        if (res.backups.length > 0 && !selectedBackup) {
          setSelectedBackup(res.backups[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load local backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  // Check Docker & Supabase Local stack status
  const checkStackStatus = async () => {
    if (!isDesktop || !(window as any).desktopAPI.getLocalStackStatus) return;
    try {
      const status = await (window as any).desktopAPI.getLocalStackStatus();
      setStackStatus(status);
    } catch (e) {
      console.error('Stack status check error:', e);
    }
  };

  useEffect(() => {
    if (open) {
      setSelectedMode(isOfflineMode ? 'local' : 'cloud');
      loadBackups();
      checkStackStatus();
      setLastSyncTime(localStorage.getItem('adhub_last_cloud_sync_time'));
      setRestoreSuccess(false);
      setRestoreProgress(null);
    }
  }, [open]);

  // Listen to desktop progress events
  useEffect(() => {
    if (!isDesktop) return;
    const unsubscribeRestore = (window as any).desktopAPI.onRestoreProgress?.((data: any) => {
      setRestoreProgress({
        percent: data.percent || 50,
        message: data.message || 'جاري المعالجة...',
        stage: data.stage,
      });
    });

    const unsubscribeStack = (window as any).desktopAPI.onLocalStackProgress?.((data: any) => {
      setStackProgress({
        percent: data.percent || 50,
        message: data.message || 'جاري تجهيز السيرفر...',
      });
    });

    const unsubscribeStatus = (window as any).desktopAPI.onLocalStackStatus?.((data: any) => {
      setStackStatus({
        dockerRunning: !!data.dockerRunning,
        supabaseRunning: !!data.supabaseRunning,
      });
    });

    return () => {
      if (typeof unsubscribeRestore === 'function') unsubscribeRestore();
      if (typeof unsubscribeStack === 'function') unsubscribeStack();
      if (typeof unsubscribeStatus === 'function') unsubscribeStatus();
    };
  }, [isDesktop]);

  // Launch Docker & Supabase local stack
  const handleStartLocalStack = async () => {
    if (!isDesktop) {
      toast.error('هذه الميزة متاحة في تطبيق سطح المكتب فقط');
      return;
    }

    setIsStartingStack(true);
    setStackProgress({ percent: 10, message: 'بدء تشغيل محرك Docker وسيرفر Supabase...' });

    try {
      const res = await (window as any).desktopAPI.startLocalStack();
      if (res.success) {
        toast.success('تم تشغيل Docker وسيرفر Supabase المحلي بنجاح!');
        setStackProgress({ percent: 100, message: 'السيرفر جاهز للعمل ✅' });
        await checkStackStatus();
      } else {
        throw new Error(res.error || 'تعذر تشغيل السيرفر المحلي');
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء تشغيل السيرفر');
    } finally {
      setIsStartingStack(false);
    }
  };

  // Stop local stack
  const handleStopLocalStack = async () => {
    if (!isDesktop) return;
    try {
      toast.info('جاري إيقاف السيرفر المحلي...');
      await (window as any).desktopAPI.stopLocalStack();
      toast.success('تم إيقاف السيرفر المحلي');
      await checkStackStatus();
    } catch (err: any) {
      toast.error('فشل إيقاف السيرفر');
    }
  };

  // Trigger Local-to-Cloud Sync (Upload)
  const handleSyncLocalToCloud = async () => {
    setIsSyncing(true);
    setSyncType('upload');
    setSyncProgress(null);

    try {
      const result = await syncLocalToCloud((prog) => {
        setSyncProgress(prog);
      });

      if (result.success) {
        toast.success(`اكتملت المزامنة بنجاح! تم رفع وتحديث ${result.totalSyncedRows} سجل إلى السحابة.`);
        setLastSyncTime(result.timestamp);
      } else {
        toast.error(result.error || 'فشلت عملية المزامنة إلى السحابة');
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء المزامنة');
    } finally {
      setIsSyncing(false);
    }
  };

  // Trigger Cloud-to-Local Sync (Download / Pull)
  const handleSyncCloudToLocal = async () => {
    setIsSyncing(true);
    setSyncType('download');
    setSyncProgress(null);

    try {
      const result = await syncCloudToLocal((prog) => {
        setSyncProgress(prog);
      });

      if (result.success) {
        toast.success(`تم تحديث البيانات المحلية بنجاح! (${result.totalSyncedRows} سجل).`);
        setLastSyncTime(result.timestamp);
      } else {
        toast.error(result.error || 'فشلت عملية سحب البيانات من السحابة');
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء المزامنة');
    } finally {
      setIsSyncing(false);
    }
  };

  // Select custom backup file via Explorer dialog
  const handleBrowseFile = async () => {
    if (!isDesktop) return;
    try {
      const res = await (window as any).desktopAPI.selectBackupFile();
      if (res.success && res.backup) {
        setBackups((prev) => [res.backup, ...prev.filter((b) => b.filePath !== res.backup.filePath)]);
        setSelectedBackup(res.backup);
        toast.success(`تم اختيار الملف: ${res.backup.fileName}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل اختيار الملف');
    }
  };

  // Open backups folder
  const handleOpenFolder = async () => {
    if (!isDesktop) return;
    try {
      await (window as any).desktopAPI.openBackupsFolder();
    } catch (err: any) {
      toast.error('تعذر فتح المجلد');
    }
  };

  // Execute restore & switch to local DB mode
  const handleInstallAndSwitchToLocal = async () => {
    if (!selectedBackup) {
      toast.error('يرجى تحديد ملف النسخة الاحتياطية أولاً');
      return;
    }

    setIsRestoring(true);
    setRestoreSuccess(false);
    setRestoreProgress({ percent: 15, message: 'جاري تنظيف وإعادة تهيئة قاعدة البيانات من الصفر (Clean Reset)...' });

    try {
      if (isDesktop) {
        const res = await (window as any).desktopAPI.restoreBackup({
          filePath: selectedBackup.filePath,
          localConfig: {
            host: '127.0.0.1',
            port: 54322,
            dbname: 'postgres',
            user: 'postgres',
            password: 'postgres',
          },
        });

        if (!res.success) {
          throw new Error(res.error || 'فشلت عملية استعادة النسخة الاحتياطية');
        }
      }

      setRestoreSuccess(true);
      setRestoreProgress({ percent: 100, message: 'تم تركيب النسخة الاحتياطية بالكامل بنجاح! جاري تنشيط الوضع المحلي...' });
      toast.success('تم تركيب قاعدة البيانات بنجاح! جاري تحويل النظام للوضع المحلي...');

      setTimeout(() => {
        setOfflineMode(true, localUrl, localKey, selectedBackup.fileName);
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء تركيب النسخة');
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  // Switch to Cloud mode
  const handleSwitchToCloud = () => {
    toast.success('جاري التبديل إلى قاعدة البيانات السحابية (Supabase Cloud)...');
    setTimeout(() => {
      setOfflineMode(false);
    }, 500);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      dir="rtl"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-950 text-slate-100 border-2 border-primary/40 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full Modal Restore Progress Overlay */}
        {isRestoring && (
          <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
            <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border-2 border-primary/50 shadow-2xl space-y-5">
              <div className="flex justify-center">
                {restoreSuccess ? (
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-bounce">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center relative">
                    <Database className="w-8 h-8" />
                    <Loader2 className="w-10 h-10 animate-spin absolute text-primary/60" />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-black text-white">
                  {restoreSuccess ? 'اكتمل تركيب قاعدة البيانات بنجاح!' : 'جاري استعادة وتركيب النسخة الاحتياطية...'}
                </h3>
                <p className="text-xs text-slate-300 font-mono">
                  {selectedBackup?.fileName} ({selectedBackup?.fileSizeMB} MB)
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-primary truncate max-w-[280px]">
                    {restoreProgress?.message || 'جاري استيراد البيانات...'}
                  </span>
                  <span className="font-mono text-primary font-black text-sm">
                    {restoreProgress?.percent || 20}%
                  </span>
                </div>
                <Progress value={restoreProgress?.percent || 20} className="h-2.5 bg-slate-800" />
              </div>

              <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-center gap-1.5 border-t border-slate-800">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span>إعادة بناء المخطط من الصفر وضبط صلاحيات الـ API المحلي تلقائياً</span>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                إدارة قاعدة البيانات والمزامنة السحابية
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                التبديل بين السحابي والمحلي، ومزامنة التعديلات بدون تعارضات، واستعادة النسخ الاحتياطية
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-semibold px-2.5 py-1',
                isOfflineMode
                  ? 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                  : 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
              )}
            >
              {isOfflineMode ? (
                <span className="flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5" /> نسخة محلية (Offline)
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" /> نسخة سحابية (Online)
                </span>
              )}
            </Badge>

            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto bg-slate-950">
          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 gap-3">
            {/* Cloud Option */}
            <div
              onClick={() => setSelectedMode('cloud')}
              className={cn(
                'p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2',
                selectedMode === 'cloud'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-md'
                  : 'border-slate-800 bg-slate-900/60 hover:border-emerald-500/40'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  قاعدة البيانات السحابية (Online)
                </div>
                {selectedMode === 'cloud' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-slate-400">
                الاتصال المباشر مع سيرفر Supabase السحابي، مزامنة تلقائية لجميع البيانات الحية.
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-sans font-medium">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>السيرفر السحابي المركزي (مشفر ومحمي)</span>
              </div>
            </div>

            {/* Local Option */}
            <div
              onClick={() => setSelectedMode('local')}
              className={cn(
                'p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2',
                selectedMode === 'local'
                  ? 'border-primary bg-primary/10 shadow-md'
                  : 'border-slate-800 bg-slate-900/60 hover:border-primary/40'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <HardDrive className="w-4 h-4 text-primary" />
                  قاعدة البيانات المحلية (Offline)
                </div>
                {selectedMode === 'local' && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </div>
              <p className="text-[11px] text-slate-400">
                العمل المستقل محلياً على هذا الجهاز بدون الحاجة لإنترنت عبر استعادة نسخة احتياطية.
              </p>
              <div className="text-[10px] text-slate-400 font-mono truncate" dir="ltr">
                {localUrl}
              </div>
            </div>
          </div>

          {/* Conflict-Free Smart Sync Section */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/20 text-primary">
                  <ArrowUpDown className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">المزامنة الذكية بدون تعارضات (Smart Sync)</h4>
                  <p className="text-[10px] text-slate-400">
                    نقل وتحديث العقود واللوحات والمدفوعات بين المحلي والسحابي بأسلوب دمج ذكي (UPSERT)
                  </p>
                </div>
              </div>
              {lastSyncTime && (
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>آخر مزامنة: {new Date(lastSyncTime).toLocaleDateString('ar-LY')} {new Date(lastSyncTime).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncLocalToCloud}
                disabled={isSyncing}
                className="h-9 text-xs font-bold gap-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 bg-slate-900"
              >
                {isSyncing && syncType === 'upload' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري رفع التعديلات إلى السحابة...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 text-emerald-400" />
                    <span>مزامنة التعديلات المحلية ⬅️ السحابة (رفع)</span>
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncCloudToLocal}
                disabled={isSyncing}
                className="h-9 text-xs font-bold gap-2 border-blue-500/40 text-blue-400 hover:bg-blue-500/20 bg-slate-900"
              >
                {isSyncing && syncType === 'download' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري سحب التحديثات...</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud className="w-4 h-4 text-blue-400" />
                    <span>تحديث البيانات من السحابة ➡️ المحلي (تنزيل)</span>
                  </>
                )}
              </Button>
            </div>

            {/* Sync Progress Bar */}
            {isSyncing && syncProgress && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 mt-2">
                <div className="flex justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    {syncProgress.message}
                  </span>
                  <span className="text-primary">{syncProgress.percent}%</span>
                </div>
                <Progress value={syncProgress.percent} className="h-1.5 bg-slate-800" />
              </div>
            )}
          </div>

          {/* Image Cache Downloader Manager */}
          <div className="pt-1">
            <ImageCacheManager className="bg-slate-950/70 border-slate-800 text-slate-100" />
          </div>

          {/* Local Mode Details & Stack Automation */}
          {selectedMode === 'local' && (
            <div className="space-y-3.5 pt-1">
              {/* Docker & Supabase Local Engine Automation Card */}
              {isDesktop && (
                <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-white">
                        محرك التشغيل المحلي (Docker & Supabase Engine):
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] gap-1 bg-slate-900 border-slate-700 text-slate-200">
                        Docker:
                        <span className={cn('w-2 h-2 rounded-full inline-block', stackStatus?.dockerRunning ? 'bg-emerald-400' : 'bg-red-500')} />
                        {stackStatus?.dockerRunning ? 'يعمل' : 'متوقف'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1 bg-slate-900 border-slate-700 text-slate-200">
                        Supabase:
                        <span className={cn('w-2 h-2 rounded-full inline-block', stackStatus?.supabaseRunning ? 'bg-emerald-400' : 'bg-red-500')} />
                        {stackStatus?.supabaseRunning ? 'جاهز' : 'متوقف'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      يقوم هذا الزر بتشغيل Docker وحاويات Supabase المحلية تلقائياً بنقرة واحدة.
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {stackStatus?.supabaseRunning ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleStopLocalStack}
                          className="h-8 text-xs text-red-400 border-red-500/30 hover:bg-red-500/20 bg-slate-900"
                        >
                          <Square className="w-3.5 h-3.5 ml-1" />
                          إيقاف السيرفر
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleStartLocalStack}
                          disabled={isStartingStack}
                          className="h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {isStartingStack ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />
                              جاري التشغيل...
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 ml-1 fill-current" />
                              تشغيل Docker و Supabase تلقائياً
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {isStartingStack && stackProgress && (
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-primary/30 space-y-1.5 mt-2">
                      <div className="flex justify-between text-[11px] text-primary font-bold">
                        <span>{stackProgress.message}</span>
                        <span>{stackProgress.percent}%</span>
                      </div>
                      <Progress value={stackProgress.percent} className="h-1.5 bg-slate-800" />
                    </div>
                  )}
                </div>
              )}

              {/* Backups Card */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileDown className="w-4 h-4 text-primary" />
                      النسخ الاحتياطية المتوفرة للاستعادة (.dump / .sql):
                    </Label>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      اختر ملف النسخة وسيقوم النظام بتركيبه وإعادة بناء قاعدة البيانات المحلية من الصفر
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadBackups}
                      disabled={loadingBackups}
                      className="h-7 text-[11px] px-2.5 bg-slate-900 border-slate-700 text-slate-200 hover:text-white"
                    >
                      <RefreshCw className={cn('w-3 h-3 ml-1', loadingBackups && 'animate-spin')} />
                      تحديث
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBrowseFile}
                      className="h-7 text-[11px] px-2.5 bg-slate-900 border-slate-700 text-slate-200 hover:text-white"
                    >
                      <FolderOpen className="w-3 h-3 ml-1" />
                      استعراض ملف...
                    </Button>
                  </div>
                </div>

                {/* Backups List */}
                <ScrollArea className="h-44 pr-1">
                  {backups.length === 0 ? (
                    <div className="h-36 flex flex-col items-center justify-center gap-1.5 text-slate-400 text-xs">
                      <AlertCircle className="w-6 h-6 text-slate-500" />
                      <span>لم يتم العثور على نسخ احتياطية في مجلد المستندات</span>
                      <Button variant="link" size="sm" onClick={handleBrowseFile} className="text-xs text-primary">
                        انقر لاختيار ملف نسخة احتياطية من جهازك
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {backups.map((b) => {
                        const isPicked = selectedBackup?.filePath === b.filePath;
                        return (
                          <div
                            key={b.filePath}
                            onClick={() => setSelectedBackup(b)}
                            className={cn(
                              'p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3',
                              isPicked
                                ? 'border-primary bg-primary/20 shadow-md ring-1 ring-primary'
                                : 'border-slate-800 bg-slate-950 hover:bg-slate-800/60'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={cn(
                                'p-2 rounded-md shrink-0',
                                b.type === 'online' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                              )}>
                                <Database className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <strong className="text-xs text-white truncate">{b.fileName}</strong>
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      'text-[9px] px-1.5 py-0 shrink-0 font-medium',
                                      b.type === 'online'
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                        : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                    )}
                                  >
                                    {b.typeLabel}
                                  </Badge>
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>الحجم: {b.fileSizeMB} MB</span>
                                  <span>•</span>
                                  <span>الصيغة: {b.format}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {new Date(b.modifiedAt).toLocaleString('ar-LY')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <Badge variant={isPicked ? 'default' : 'outline'} className="text-[10px] shrink-0 font-bold">
                              {isPicked ? '✓ محددة للتثبيت' : 'اختيار'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Prominent Action Banner when a backup is picked */}
                {selectedBackup && (
                  <div className="p-3 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        النسخة الجاهزة للتركيب: <span className="text-primary font-bold">{selectedBackup.fileName}</span>
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        سيتم مسح المخطط المحلي وإعادة بنائه وتعبئته بالكامل من هذا الملف ({selectedBackup.fileSizeMB} MB).
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleInstallAndSwitchToLocal}
                      disabled={isRestoring}
                      className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs gap-1.5 shadow-lg"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>تركيب هذه النسخة الآن</span>
                    </Button>
                  </div>
                )}

                {/* Local Server Config */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Server className="w-3 h-3 text-primary" />
                      عنوان سيرفر Supabase المحلي:
                    </Label>
                    <Input
                      value={localUrl}
                      onChange={(e) => setLocalUrl(e.target.value)}
                      className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-slate-200"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-400 flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-primary" />
                      مفتاح Anon Key المحلي:
                    </Label>
                    <Input
                      value={localKey}
                      onChange={(e) => setLocalKey(e.target.value)}
                      className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-slate-200"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isRestoring || isSyncing} className="text-slate-400 hover:text-white">
            إغلاق
          </Button>

          {selectedMode === 'cloud' ? (
            <Button
              size="sm"
              onClick={handleSwitchToCloud}
              disabled={!isOfflineMode}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <Cloud className="w-4 h-4 ml-1.5" />
              {isOfflineMode ? 'تفعيل وضع أونلاين (Cloud)' : 'الوضع السحابي مفعل حالياً'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleInstallAndSwitchToLocal}
              disabled={!selectedBackup || isRestoring}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-1.5" />
                  <span>جاري تركيب النسخة...</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 ml-1.5" />
                  <span>تركيب النسخة وتشغيل الوضع المحلي</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
