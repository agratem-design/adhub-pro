/**
 * AppThemeLoader
 * مكون يُحمَّل مرة واحدة عند بدء التطبيق لجلب وتطبيق إعدادات الثيم (الألوان والخط) فوراً
 * بدون هذا المكون، لن يُطبَّق الخط المحفوظ إلا عند زيارة صفحة إعدادات المظهر
 */

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { applySiteColors } from '@/lib/siteTheme';

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
  applySiteColors(data);

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
    } else {
      applyColorsToDocument(cachedThemeData || {});
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          applyColorsToDocument(cachedThemeData || {});
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
