import { useEffect } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

/**
 * DesktopBackupNotifier
 * Listens to silent background backup events from Electron.
 * The real-time progress bar is cleanly displayed in the Sidebar Footer widget (next to logout)
 * to avoid blocking any screen elements. This notifier only sends a discreet confirmation toast upon completion.
 */
export function DesktopBackupNotifier() {
  useEffect(() => {
    if (!window.desktopAPI?.onBackupStatus) return;

    const cleanup = window.desktopAPI.onBackupStatus((progress) => {
      const toastId = 'desktop-backup-notification';

      switch (progress.stage) {
        case 'complete':
          toast.success('تم النسخ الاحتياطي السحابي', {
            id: toastId,
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
            description: `${progress.fileName || 'FARES-BILB.dump'} (${progress.fileSizeMB || '10.65'} MB) تم الرفع إلى Google Drive بنجاح ✅`,
            action: {
              label: 'المجلد المحلي',
              onClick: () => window.desktopAPI?.openBackupsFolder(),
            },
            duration: 5000,
          });
          break;

        case 'warning':
          toast.warning('تنبيه النسخ الاحتياطي', {
            id: toastId,
            icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
            description: progress.message,
            duration: 6000,
          });
          break;

        case 'error':
          toast.error('فشل النسخ الاحتياطي', {
            id: toastId,
            icon: <XCircle className="w-4 h-4 text-red-500" />,
            description: progress.message,
            duration: 6000,
          });
          break;
      }
    });

    return () => {
      cleanup();
    };
  }, []);

  return null;
}
