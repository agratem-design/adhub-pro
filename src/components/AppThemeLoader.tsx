/**
 * AppThemeLoader
 * مكون يُحمَّل مرة واحدة عند بدء التطبيق لجلب وتطبيق إعدادات الثيم (الألوان والخط) فوراً
 * بدون هذا المكون، لن يُطبَّق الخط المحفوظ إلا عند زيارة صفحة إعدادات المظهر
 */

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// إعدادات الثيم الافتراضية
const DEFAULT_FONT = 'Doran';

// كاش مُشترك لتجنب طلبات متعددة
let themeApplied = false;
let cachedThemeData: Record<string, string> | null = null;

function applyFontToDocument(fontFamily: string) {
  const font = fontFamily || DEFAULT_FONT;
  document.body.style.fontFamily = `'${font}', 'Cairo', 'Tajawal', sans-serif`;
  document.documentElement.style.setProperty(
    '--app-font-family',
    `'${font}', 'Cairo', 'Tajawal', sans-serif`
  );
}

function applyColorsToDocument(data: Record<string, string>) {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');

  function hexToHsl(hex: string): { h: number; s: number; l: number } {
    hex = hex.replace('#', '');
    if (hex.length !== 6) return { h: 0, s: 0, l: 50 };
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
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
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  const fmt = (c: { h: number; s: number; l: number }) => `${c.h} ${c.s}% ${c.l}%`;

  if (data.primary_color) {
    const primary = hexToHsl(data.primary_color);
    root.style.setProperty('--primary', fmt(primary));
    root.style.setProperty('--primary-glow', `${primary.h} ${Math.min(primary.s + 5, 100)}% ${Math.min(primary.l + 10, 100)}%`);
    root.style.setProperty('--ring', fmt(primary));
    root.style.setProperty('--sidebar-primary', fmt(primary));
    root.style.setProperty('--sidebar-ring', fmt(primary));
    root.style.setProperty('--yellow', fmt(primary));
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${fmt(primary)}) 0%, hsl(${primary.h} ${Math.max(primary.s - 8, 0)}% ${Math.max(primary.l - 6, 0)}%) 100%)`);
    root.style.setProperty('--shadow-gold', `0 6px 20px -6px hsl(${fmt(primary)} / 0.15)`);
    root.style.setProperty('--shadow-luxury', `0 8px 30px -8px hsl(${fmt(primary)} / 0.2)`);
    root.style.setProperty('--shadow-hover', `0 6px 16px -4px hsl(${fmt(primary)} / 0.14)`);
  }

  if (!isDark) {
    if (data.secondary_color) {
      const s = hexToHsl(data.secondary_color);
      root.style.setProperty('--secondary', fmt(s));
    }
    if (data.accent_color) {
      const a = hexToHsl(data.accent_color);
      root.style.setProperty('--accent', fmt(a));
    }
    if (data.muted_color) {
      const m = hexToHsl(data.muted_color);
      root.style.setProperty('--muted', fmt(m));
    }
    if (data.background_color) {
      const bg = hexToHsl(data.background_color);
      root.style.setProperty('--background', fmt(bg));
    }
    if (data.text_color) {
      const t = hexToHsl(data.text_color);
      root.style.setProperty('--foreground', fmt(t));
      root.style.setProperty('--card-foreground', fmt(t));
      root.style.setProperty('--popover-foreground', fmt(t));
    }
    if (data.border_color) {
      const b = hexToHsl(data.border_color);
      root.style.setProperty('--border', fmt(b));
      root.style.setProperty('--input', fmt(b));
    }
  }

  // Favicon
  if (data.favicon_url) {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (link) link.href = data.favicon_url;
  }
}

export function AppThemeLoader() {
  useEffect(() => {
    // ✅ Force RTL globally on document elements (bulletproof fix)
    const forceRtl = () => {
      const root = document.documentElement;
      const body = document.body;
      if (root) {
        if (root.getAttribute('dir') !== 'rtl') {
          root.setAttribute('dir', 'rtl');
        }
        if (root.style.direction !== 'rtl') {
          root.style.direction = 'rtl';
        }
      }
      if (body) {
        if (body.getAttribute('dir') !== 'rtl') {
          body.setAttribute('dir', 'rtl');
        }
        if (body.style.direction !== 'rtl') {
          body.style.direction = 'rtl';
        }
      }
    };

    forceRtl();

    const dirObserver = new MutationObserver(() => {
      forceRtl();
    });

    dirObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dir', 'style'] });
    if (document.body) {
      dirObserver.observe(document.body, { attributes: true, attributeFilter: ['dir', 'style'] });
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          dirObserver.observe(document.body, { attributes: true, attributeFilter: ['dir', 'style'] });
        }
        forceRtl();
      });
    }

    const loadTheme = async () => {
      try {
        const { data, error } = await supabase
          .from('site_theme_settings')
          .select('primary_color, secondary_color, background_color, text_color, border_color, accent_color, muted_color, logo_url, favicon_url, site_font_family')
          .eq('setting_key', 'default')
          .maybeSingle();

        if (error || !data) return;

        cachedThemeData = data as Record<string, string>;

        // تطبيق الخط
        applyFontToDocument((data as any).site_font_family || DEFAULT_FONT);

        // تطبيق الألوان
        applyColorsToDocument(cachedThemeData);

        themeApplied = true;
      } catch {
        // فشل بصمت — سيتم استخدام القيم الافتراضية
      }
    };

    if (!themeApplied) {
      loadTheme();
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const root = document.documentElement;
          const isDark = root.classList.contains('dark');
          if (isDark) {
            // Clear light-mode inline style overrides so dark-mode CSS variables from index.css take effect
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
          } else {
            // Re-apply light-mode custom colors from cache
            if (cachedThemeData) {
              applyColorsToDocument(cachedThemeData);
            }
          }
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => {
      dirObserver.disconnect();
      observer.disconnect();
    };
  }, []);

  // هذا المكون لا يُصيِّر أي شيء في DOM
  return null;
}

// إعادة تعيين الكاش عند تغيير الثيم (تُستدعى من SiteAppearance عند الحفظ)
export function invalidateThemeCache(newData?: Record<string, string>) {
  themeApplied = false;
  if (newData) {
    cachedThemeData = newData;
    themeApplied = true;
  }
}
