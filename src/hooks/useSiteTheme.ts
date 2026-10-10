import { useState, useEffect, useCallback } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invalidateThemeCache } from '@/components/AppThemeLoader';
import { applySiteColors, hexToHsl } from '@/lib/siteTheme';

export interface SiteThemeSettings {
  id?: string;
  setting_key: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  border_color: string;
  accent_color: string;
  muted_color: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  site_font_family?: string | null;
}

const defaultTheme: SiteThemeSettings = {
  setting_key: 'default',
  primary_color: '#d6ac40',
  secondary_color: '#f3f1ed',
  background_color: '#faf9f6',
  text_color: '#211f1b',
  border_color: '#ddd8ce',
  accent_color: '#f6eed7',
  muted_color: '#f3f1ed',
  site_font_family: 'Doran',
};

// توليد ألوان فرعية من اللون الرئيسي
export function generateThemeFromPrimary(primaryHex: string): Partial<SiteThemeSettings> {
  const p = hexToHsl(primaryHex);
  
  return {
    primary_color: primaryHex,
    secondary_color: hslToHex(p.h, Math.max(p.s - 70, 0), 96),
    accent_color: hslToHex(p.h, Math.max(p.s - 30, 10), 93),
    muted_color: hslToHex(p.h, Math.max(p.s - 75, 0), 94),
    border_color: hslToHex(p.h, Math.max(p.s - 70, 0), 85),
    background_color: hslToHex(p.h, Math.max(p.s - 55, 5), 98),
    text_color: hslToHex(0, 0, 12),
  };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// تطبيق CSS Variables على المتغيرات الفعلية
function applyThemeVariables(theme: SiteThemeSettings) {
  const root = document.documentElement;
  applySiteColors(theme);

  // Font Family — apply to body immediately
  const fontFamily = theme.site_font_family || 'Doran';
  document.body.style.fontFamily = `'${fontFamily}', 'Cairo', 'Tajawal', sans-serif`;
  root.style.setProperty('--app-font-family', `'${fontFamily}', 'Cairo', 'Tajawal', sans-serif`);

  // Favicon
  if (theme.favicon_url) {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (link) {
      link.href = theme.favicon_url;
    }
  }
}

export function useSiteTheme() {
  const { confirm: systemConfirm } = useSystemDialog();
  const [theme, setTheme] = useState<SiteThemeSettings>(defaultTheme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTheme = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('site_theme_settings')
        .select('*')
        .eq('setting_key', 'default')
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings found, use defaults
        }
        return;
      }

      if (data) {
        const loadedTheme = { ...defaultTheme, ...data } as SiteThemeSettings;
        setTheme(loadedTheme);
        applyThemeVariables(loadedTheme);
      }
    } catch (error) {
      // Silent fail, use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  const saveTheme = useCallback(async (newTheme: Partial<SiteThemeSettings>) => {
    try {
      setSaving(true);
      const updatedTheme = { ...theme, ...newTheme };

      const { error } = await supabase
        .from('site_theme_settings')
        .upsert({
          ...updatedTheme,
          setting_key: 'default',
          updated_at: new Date().toISOString()
        } as any, {
          onConflict: 'setting_key'
        });

      if (error) {
        toast.error('فشل حفظ إعدادات السمة');
        return false;
      }

      setTheme(updatedTheme);
      applyThemeVariables(updatedTheme);
      invalidateThemeCache(updatedTheme as any);
      toast.success('تم حفظ إعدادات السمة بنجاح');
      return true;
    } catch (error) {
      toast.error('خطأ في حفظ إعدادات السمة');
      return false;
    } finally {
      setSaving(false);
    }
  }, [theme]);

  const updateThemeSetting = useCallback((key: keyof SiteThemeSettings, value: string) => {
    const newTheme = { ...theme, [key]: value };
    setTheme(newTheme);
    applyThemeVariables(newTheme);
    invalidateThemeCache(newTheme as any);
  }, [theme]);

  const resetToDefaults = useCallback(async () => {
    const confirmed = await systemConfirm({ title: 'إعادة تعيين', message: 'هل تريد إعادة ألوان السمة للوضع الافتراضي؟', confirmText: 'إعادة تعيين' });
    if (confirmed) {
      await saveTheme(defaultTheme);
    }
  }, [saveTheme, systemConfirm]);

  useEffect(() => {
    fetchTheme();
  }, [fetchTheme]);

  return {
    theme,
    loading,
    saving,
    updateThemeSetting,
    saveTheme,
    resetToDefaults,
    refetch: fetchTheme
  };
}

export { defaultTheme };
