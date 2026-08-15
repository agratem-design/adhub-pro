import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { WifiOff, Wifi } from 'lucide-react';

export const NetworkStatusNotifier: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('تمت استعادة الاتصال بالإنترنت', {
        description: 'جاري تحديث ومزامنة البيانات مع الخادم...',
        icon: <Wifi className="w-5 h-5 text-emerald-500" />,
        duration: 4000,
      });

      // Invalidate and refresh active queries smoothly
      queryClient.invalidateQueries();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('أنت تعمل بدون اتصال بالإنترنت', {
        description: 'تم تفعيل وضع القراءة المؤقتة لحين عودة الاتصال بالشبكة.',
        icon: <WifiOff className="w-5 h-5 text-amber-500" />,
        duration: 6000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  if (isOnline) return null;

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className="fixed bottom-3 right-3 left-3 md:left-auto md:w-96 z-50 bg-amber-500/90 text-amber-950 dark:bg-amber-600/95 dark:text-amber-50 px-4 py-2.5 rounded-xl shadow-xl backdrop-blur-md border border-amber-400/40 flex items-center justify-between gap-3 text-xs font-semibold animate-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-900 dark:text-amber-100" />
        <span>لا يوجد اتصال بالإنترنت (وضع عدم الاتصال نشط)</span>
      </div>
      <span className="text-[10px] opacity-80 shrink-0 bg-amber-900/10 dark:bg-black/20 px-2 py-0.5 rounded-md">
        تخزين محلي
      </span>
    </div>
  );
};
