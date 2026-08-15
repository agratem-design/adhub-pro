import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PwaUpdatePrompt: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      console.log('[PWA] Service worker updated to new version.');
      toast.info('تم تحديث تطبيق الفارس بنجاح', {
        description: 'أنت الآن تستخدم أحدث إصدار من النظام.',
        icon: <Sparkles className="w-5 h-5 text-amber-500" />,
        duration: 5000,
      });
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
};
