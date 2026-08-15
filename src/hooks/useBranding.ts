import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_LOGO = '/logofaresgold.svg';
const DEFAULT_FAVICON = '/favicon.ico';

interface BrandingData {
  logoUrl: string;
  faviconUrl: string;
  loading: boolean;
}

let cachedBranding: { logoUrl: string; faviconUrl: string } | null = null;

export function useBranding(): BrandingData {
  const [branding, setBranding] = useState<BrandingData>({
    logoUrl: cachedBranding?.logoUrl || DEFAULT_LOGO,
    faviconUrl: cachedBranding?.faviconUrl || DEFAULT_FAVICON,
    loading: !cachedBranding,
  });

  useEffect(() => {
    if (cachedBranding) return;

    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('site_theme_settings')
          .select('logo_url, favicon_url')
          .eq('setting_key', 'default')
          .maybeSingle();

        const result = {
          logoUrl: (data as any)?.logo_url || DEFAULT_LOGO,
          faviconUrl: (data as any)?.favicon_url || DEFAULT_FAVICON,
        };
        cachedBranding = result;
        setBranding({ ...result, loading: false });
      } catch {
        setBranding(prev => ({ ...prev, loading: false }));
      }
    };

    fetch();
  }, []);

  return branding;
}

// إعادة تعيين الكاش عند الحفظ
export function invalidateBrandingCache() {
  cachedBranding = null;
}
