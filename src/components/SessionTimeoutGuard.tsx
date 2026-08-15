import React, { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export const SessionTimeoutGuard: React.FC = () => {
  const wasAuthenticatedRef = useRef<boolean>(false);

  useEffect(() => {
    // Check initial session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      wasAuthenticatedRef.current = !!session;
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        wasAuthenticatedRef.current = true;
      } else if (event === 'SIGNED_OUT') {
        if (wasAuthenticatedRef.current) {
          wasAuthenticatedRef.current = false;
          toast.info('تم تسجيل الخروج', {
            description: 'انتهت جلسة تسجيل الدخول الخاصة بك أو تم تسجيل الخروج بنجاح.',
            icon: <ShieldAlert className="w-5 h-5 text-amber-500" />,
            duration: 5000,
          });
        }
      } else if (event === 'TOKEN_REFRESHED') {
        wasAuthenticatedRef.current = !!session;
        console.log('[Auth] Access token renewed successfully');
      } else if (event === 'USER_UPDATED') {
        toast.success('تم تحديث بيانات الحساب', {
          icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
          duration: 3000,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
};
