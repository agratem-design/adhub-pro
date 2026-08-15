import React, { useState, useEffect } from 'react';
import { Cloud, HardDrive, CheckCircle2, AlertCircle, RefreshCw, FolderOpen } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DesktopBackupProgress } from '@/types/desktop';

export function SidebarBackupWidget() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [backupStatus, setBackupStatus] = useState<DesktopBackupProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.desktopAPI) return;
    setIsDesktop(true);

    const cleanup = window.desktopAPI.onBackupStatus((progress) => {
      setBackupStatus(progress);
      if (progress.stage === 'dumping' || progress.stage === 'uploading') {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    });

    return () => {
      cleanup();
    };
  }, []);

  if (!isDesktop) return null;

  const handleOpenFolder = () => {
    window.desktopAPI?.openBackupsFolder();
  };

  const handleManualTrigger = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning || !window.desktopAPI) return;
    setIsRunning(true);
    setBackupStatus({
      stage: 'dumping',
      percent: 5,
      message: 'بدء النسخ الاحتياطي...',
    });
    try {
      await window.desktopAPI.triggerBackup();
    } catch (e) {
      setIsRunning(false);
    }
  };

  const percent = backupStatus?.percent || (isRunning ? 20 : 100);
  const stage = backupStatus?.stage || 'complete';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-2 rounded-xl bg-sidebar-accent/40 border border-sidebar-border/30 text-right space-y-1.5 transition-all text-sidebar-foreground select-none">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
            ) : stage === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
            ) : (
              <Cloud className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            )}
            <span className="text-[11px] font-bold truncate leading-none">
              {isRunning
                ? stage === 'dumping'
                  ? 'سحب الجداول...'
                  : 'رفع لـ Drive...'
                : stage === 'complete'
                ? 'النسخ السحابي مفعل'
                : 'النسخ الاحتياطي'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isRunning && (
              <span className="font-mono text-[10px] text-amber-500 font-bold">
                {percent}%
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleManualTrigger}
                  disabled={isRunning}
                  className="p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-primary transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={cn("w-3 h-3", isRunning && "animate-spin")} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">أخذ نسخة احتياطية ورفعها الآن</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleOpenFolder}
                  className="p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-primary transition-colors"
                >
                  <FolderOpen className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">فتح مجلد النسخ الاحتياطية على جهازك</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Progress Bar (Always visible or when active) */}
        {isRunning ? (
          <div className="space-y-1">
            <Progress
              value={percent}
              className={cn(
                "h-1.5 rounded-full bg-sidebar-border/40",
                stage === 'dumping' ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500"
              )}
            />
            <p className="text-[9px] text-sidebar-foreground/60 truncate leading-none">
              {backupStatus?.message || 'جاري المعالجة في الخلفية...'}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[9px] text-sidebar-foreground/50">
            <span>Google Drive + محلي</span>
            {backupStatus?.fileSizeMB && (
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                {backupStatus.fileSizeMB} MB
              </span>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
