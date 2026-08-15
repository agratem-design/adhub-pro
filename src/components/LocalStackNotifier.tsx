// @ts-nocheck
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Cpu, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { isOfflineMode } from '@/integrations/supabase/client';

/**
 * LocalStackNotifier
 * In Offline Mode, automatically detects Docker & Supabase stack health on startup
 * and starts them seamlessly in the background with discreet feedback.
 */
export function LocalStackNotifier() {
  const isCheckedRef = useRef(false);

  useEffect(() => {
    if (!window.desktopAPI || !isOfflineMode || isCheckedRef.current) return;
    isCheckedRef.current = true;

    // Listen to live progress updates during auto-start
    let lastProgressToastId: string | number | null = null;

    const cleanupProgress = window.desktopAPI.onLocalStackProgress?.((progress) => {
      if (progress.stage === 'docker' || progress.stage === 'starting' || progress.stage === 'downloading') {
        if (!lastProgressToastId) {
          lastProgressToastId = toast.loading(progress.message, {
            id: 'local-stack-auto-status',
            duration: 10000,
          });
        } else {
          toast.loading(progress.message, {
            id: 'local-stack-auto-status',
            duration: 10000,
          });
        }
      } else if (progress.stage === 'complete') {
        toast.success('السيرفر المحلي متصل وجاهز للعمل ✅', {
          id: 'local-stack-auto-status',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
          description: 'تم التحقق من تشغيل محرك Docker و Supabase المحلي بنجاح (المنفذ 54321).',
          duration: 4000,
        });
      }
    });

    // Auto-detect and auto-start local stack on boot
    window.desktopAPI.ensureLocalStackRunning?.().then((res) => {
      if (res && res.alreadyRunning) {
        // Already active, no intrusive alert needed
        console.log('[LocalStack] Docker & Supabase are already running.');
      } else if (res && res.success) {
        toast.success('تم تشغيل السيرفر المحلي تلقائياً', {
          id: 'local-stack-auto-status',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
          description: 'محرك Docker و Supabase يعملان الآن بكفاءة.',
          duration: 4000,
        });
      } else if (res && !res.success) {
        toast.warning('محرك السيرفر المحلي متوقف', {
          id: 'local-stack-auto-status',
          icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
          description: res.error || 'يرجى التأكد من تشغيل برنامج Docker Desktop على جهازك.',
          duration: 7000,
          action: {
            label: 'إعادة المحاولة',
            onClick: () => window.desktopAPI?.startLocalStack?.(),
          },
        });
      }
    }).catch((err) => {
      console.warn('[LocalStack] Auto-start check warning:', err);
    });

    return () => {
      if (typeof cleanupProgress === 'function') cleanupProgress();
    };
  }, []);

  return null;
}

export default LocalStackNotifier;
