import { useState, useEffect, useCallback } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invalidateThemeCache } from '@/components/AppThemeLoader';

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
  primary_color: '#C6922A',
  secondary_color: '#F5F5F5',
  background_color: '#FDFBF7',
  text_color: '#1F1F1F',
  border_color: '#D9D9D9',
  accent_color: '#F5E6C8',
  muted_color: '#F0F0F0',
  site_font_family: 'Doran',
};

// HEX → HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace('#', '');
  if (hex.length !== 6) return { h: 0, s: 0, l: 50 };
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

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
  const isDark = root.classList.contains('dark');

  const primary = hexToHsl(theme.primary_color);

  const fmt = (c: { h: number; s: number; l: number }) => `${c.h} ${c.s}% ${c.l}%`;

  // Only apply primary-derived variables (safe in both modes)
  root.style.setProperty('--primary', fmt(primary));
  root.style.setProperty('--primary-glow', `${primary.h} ${Math.min(primary.s + 5, 100)}% ${Math.min(primary.l + 10, 100)}%`);
  root.style.setProperty('--ring', fmt(primary));
  root.style.setProperty('--sidebar-primary', fmt(primary));
  root.style.setProperty('--sidebar-ring', fmt(primary));
  root.style.setProperty('--yellow', fmt(primary));

  // Gradients & shadows (primary-based, safe in both modes)
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${fmt(primary)}) 0%, hsl(${primary.h} ${Math.max(primary.s - 8, 0)}% ${Math.max(primary.l - 6, 0)}%) 100%)`);
  root.style.setProperty('--shadow-gold', `0 6px 20px -6px hsl(${fmt(primary)} / 0.15)`);
  root.style.setProperty('--shadow-luxury', `0 8px 30px -8px hsl(${fmt(primary)} / 0.2)`);
  root.style.setProperty('--shadow-hover', `0 6px 16px -4px hsl(${fmt(primary)} / 0.14)`);

  // Only apply secondary/background/text colors in light mode to avoid overriding dark mode
  if (!isDark) {
    const secondary = hexToHsl(theme.secondary_color);
    const accent = hexToHsl(theme.accent_color);
    const muted = hexToHsl(theme.muted_color);
    const background = hexToHsl(theme.background_color);
    const text = hexToHsl(theme.text_color);
    const border = hexToHsl(theme.border_color);

    root.style.setProperty('--secondary', fmt(secondary));
    root.style.setProperty('--secondary-foreground', `${secondary.h} ${Math.min(secondary.s + 10, 100)}% 18%`);
    root.style.setProperty('--accent', fmt(accent));
    root.style.setProperty('--accent-foreground', `${accent.h} ${Math.min(accent.s + 20, 100)}% 22%`);
    root.style.setProperty('--muted', fmt(muted));
    root.style.setProperty('--muted-foreground', `${muted.h} ${muted.s}% 35%`);
    root.style.setProperty('--background', fmt(background));
    root.style.setProperty('--foreground', fmt(text));
    root.style.setProperty('--border', fmt(border));
    root.style.setProperty('--input', fmt(border));
    root.style.setProperty('--card', `0 0% 100%`);
    root.style.setProperty('--card-foreground', fmt(text));
    root.style.setProperty('--popover', `0 0% 100%`);
    root.style.setProperty('--popover-foreground', fmt(text));
  } else {
    // Clear inline overrides so dark mode styles from index.css can apply
    root.style.removeProperty('--secondary');
    root.style.removeProperty('--secondary-foreground');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-foreground');
    root.style.removeProperty('--muted');
    root.style.removeProperty('--muted-foreground');
    root.style.removeProperty('--background');
    root.style.removeProperty('--foreground');
    root.style.removeProperty('--border');
    root.style.removeProperty('--input');
    root.style.removeProperty('--card');
    root.style.removeProperty('--card-foreground');
    root.style.removeProperty('--popover');
    root.style.removeProperty('--popover-foreground');
  }

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
