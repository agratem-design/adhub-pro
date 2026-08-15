import React from 'react';
import {
  Phone,
  Globe,
  MapPin,
  Mail,
  MessageSquare,
  Star,
  Check,
  Heart,
  Info,
  Sparkles,
  Smile,
  Instagram,
  Facebook,
  Twitter,
  Gift,
  Award,
} from 'lucide-react';
import { CanvasElement } from './types';

// ====================== ICONS MAPPER ======================
export const iconMap: Record<string, React.ComponentType<any>> = {
  'phone': Phone,
  'globe': Globe,
  'map-pin': MapPin,
  'mail': Mail,
  'message': MessageSquare,
  'star': Star,
  'check': Check,
  'heart': Heart,
  'info': Info,
  'sparkles': Sparkles,
  'smile': Smile,
  'instagram': Instagram,
  'facebook': Facebook,
  'twitter': Twitter,
  'gift': Gift,
  'award': Award,
};

export const renderLucideIcon = (name: string, color: string, size: number) => {
  const IconComponent = iconMap[name.toLowerCase()] || Sparkles;
  return React.createElement(IconComponent, { color, size });
};

// ====================== LIGHT LEAK OVERLAY IMAGES ======================
export const LIGHT_LEAK_OVERLAYS = [
  '/light-leaks/cd13d52a7d7454fcad5b6a3d6a5fff33.jpg', // 0  — warm red/cyan gradient fill
  '/light-leaks/ec96abeabadc5505aab5271b4e96f6e8.jpg', // 1  — diagonal amber/blue streak
  '/light-leaks/c4cd1b9e9411cfabd9fdc4bfba201b34.jpg', // 2  — chrome liquid glass
  '/light-leaks/02562c86483e0ae3b82b04e52befe53e.jpg', // 3  — subtle diagonal rainbow lines
  '/light-leaks/99269a605df1298ea51bee9312d7e96d.jpg', // 4  — scattered rainbow prisms on black
  '/light-leaks/8a54f9dfc01162f53d9fb8a6523912a0.jpg', // 5  — scattered rainbow prisms similar
  '/light-leaks/eae47f0b7f639cb66febd7f1fdba6cc6.jpg', // 6  — bold diagonal rainbow streaks
  '/light-leaks/5044f3a2de00815de44f7ccf9daed3ec.jpg', // 7  — subtle teal glow spots
  '/light-leaks/0e214f17fd1a30a1b41380ab15621693.jpg', // 8  — soft light leak
  '/light-leaks/3e0328f4500cf0eed282c1d56fb43154.jpg', // 9  — light leak variant
  '/light-leaks/3ea3e8dc4e428915cf6d2b56bd6f4f98.jpg', // 10 — light leak variant
  '/light-leaks/447cbd35ab35f43c076030b979d50466.jpg', // 11 — light leak variant
  '/light-leaks/45913395ca2fb343f931960aa35f3729.jpg', // 12 — light leak variant
  '/light-leaks/5d47b66704914926bb37502761bc5231.jpg', // 13 — light leak variant
  '/light-leaks/ed738e6861f1d6136a71f57215d4026e.jpg', // 14 — light leak variant
  '/light-leaks/e6012ef48dda989ebf3a69e93ceb704e.jpg', // 15 — light leak variant
  '/light-leaks/c1714d1c99e828ee3c87d5cdffadd4d0.jpg', // 16 — light leak variant
  '/light-leaks/29a80e174ed66071d541fade00010f3e.jpg', // 17 — light leak variant
  '/light-leaks/0f71b038f3f3133eaf7b03aaf6d91a38.jpg', // 18 — light leak variant
  '/light-leaks/215619fdf905128a44dc7a3d937c063c.jpg', // 19 — light leak variant
  '/light-leaks/a7c6c7133f69177b10f0d3d08e1f6f4c.jpg', // 20 — light leak variant
  '/light-leaks/f942835f8caa9c20cdf94ffb9575f897.jpg', // 21 — light leak variant
  '/light-leaks/fe0d8bd554a949ad70cc7b557b459953.jpg', // 22 — light leak variant
];

// ====================== DEFAULT TEMPLATE CONFIG ======================
export const DEFAULT_CANVAS_WIDTH = 1500;
export const DEFAULT_CANVAS_HEIGHT = 2000;

export const DEFAULT_IMAGE_STYLE = {
  x: 0,
  y: 0,
  width: 1500,
  height: 1600,
  borderRadius: 0,
  borderWidth: 0,
  borderColor: '#ffffff',
  shadow: false,
  objectFit: 'cover',
};

export const DEFAULT_GLASS_PANEL = {
  visible: true,
  x: 0,
  y: 1600,
  width: 1500,
  height: 280,
  opacity: 0.92,
  blur: 15,
  borderRadius: 0,
  borderWidth: 2,
  borderColor: '#ffffff20',
  backgroundColor: '#1a1a2e',
  shadow: false,
};

export const DEFAULT_LOCATION_STRIP = {
  visible: true,
  height: 120,
  backgroundColor: '#c9a84c',
  textColor: '#1a1a2e',
  fontSize: 32,
  opacity: 0.9,
  blur: 10,
  borderWidth: 0,
  borderColor: '#ffffff20',
  borderRadius: 0,
};

export const DEFAULT_TEXT_ELEMENTS: CanvasElement[] = [
  // Left Section: Company Logo & Subtitle
  { id: 'company_logo', type: 'image', label: 'شعار الشركة', textKey: 'company_logo', visible: true, fontSize: 12, fontColor: '', fontWeight: 'normal', alignment: 'center', x: 180, y: 40, url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50 10 L80 25 L80 55 C80 75 50 90 50 90 C50 90 20 75 20 55 L20 25 Z" fill="none" stroke="%23c9a84c" stroke-width="4" /><path d="M50 20 L70 32 L70 52 C70 67 50 78 50 78 C50 78 30 67 30 52 L30 32 Z" fill="%23c9a84c" opacity="0.3" /><text x="50" y="58" font-size="22" font-weight="bold" fill="%23c9a84c" text-anchor="middle" font-family="sans-serif">AD</text></svg>', width: 120, height: 120, borderRadius: 0, parentStrip: 'panel' },
  { id: 'company_subtitle', type: 'text', label: 'الوصف', textKey: 'company_subtitle', visible: false, fontSize: 16, fontColor: '#b0b0b0', fontWeight: '400', alignment: 'center', x: 180, y: 170, parentStrip: 'panel', fontFamily: "'Cairo', sans-serif" },
  // Center-Left: Campaign
  { id: 'campaign_label', type: 'text', label: 'عنوان الحملة', textKey: 'campaign_label', visible: true, fontSize: 20, fontColor: '#b0b0b0', fontWeight: '400', alignment: 'center', x: 660, y: 40, parentStrip: 'panel', fontFamily: "'Cairo', sans-serif" },
  { id: 'client_name', type: 'text', label: 'شعار الحملة', textKey: 'customer_name', visible: true, fontSize: 32, fontColor: '#ffffff', fontWeight: '700', alignment: 'center', x: 660, y: 105, parentStrip: 'panel', fontFamily: "'Cairo', sans-serif", customText: 'إعلانك بارز مع الفارس' },
  { id: 'ad_type', type: 'text', label: 'نوع الإعلان', textKey: 'ad_type', visible: true, fontSize: 22, fontColor: '#c9a84c', fontWeight: '600', alignment: 'center', x: 660, y: 175, parentStrip: 'panel', fontFamily: "'Cairo', sans-serif" },
  // Center-Right: Size
  { id: 'size_label', type: 'text', label: 'المقاس', textKey: 'size_label', visible: true, fontSize: 20, fontColor: '#b0b0b0', fontWeight: '400', alignment: 'center', x: 1035, y: 60, parentStrip: 'panel', fontFamily: "'Cairo', sans-serif" },
  { id: 'size', type: 'text', label: 'المقاس', textKey: 'size', visible: true, fontSize: 48, fontColor: '#ffffff', fontWeight: '700', alignment: 'center', x: 1035, y: 120, parentStrip: 'panel', fontFamily: "'Montserrat', sans-serif" },
  // Right: Contact
  { id: 'phone', type: 'text', label: 'الهاتف', textKey: 'phone', visible: true, fontSize: 22, fontColor: '#ffffff', fontWeight: '600', alignment: 'right', x: 1470, y: 60, parentStrip: 'panel', icon: 'phone', iconColor: '#1a1a2e', iconSize: 16, iconBackground: true, iconBgColor: '#c9a84c', fontFamily: "'Montserrat', sans-serif" },
  { id: 'website', type: 'text', label: 'الموقع', textKey: 'website', visible: true, fontSize: 22, fontColor: '#c9a84c', fontWeight: '600', alignment: 'right', x: 1470, y: 110, parentStrip: 'panel', icon: 'globe', iconColor: '#1a1a2e', iconSize: 16, iconBackground: true, iconBgColor: '#c9a84c', fontFamily: "'Montserrat', sans-serif" },
  // Location strip texts
  { id: 'municipality_region', type: 'text', label: 'البلدية + المنطقة', textKey: 'municipality_region', visible: true, fontSize: 28, fontColor: '#1a1a2e', fontWeight: '700', alignment: 'center', x: 750, y: 25, parentStrip: 'location', parts: { separator: ' - ', municipality: { fontSize: 30, fontWeight: '700' }, region: { fontSize: 24, fontWeight: '600' } } },
  { id: 'landmark', type: 'text', label: 'أقرب نقطة', textKey: 'landmark', visible: true, fontSize: 20, fontColor: '#4a4a6a', fontWeight: '400', alignment: 'center', x: 750, y: 85, parentStrip: 'location' },
];

let cachedFontEmbedCSS = '';
let isFetchingFonts = false;

export const fetchFontAsBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch font from ${url}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
};

export const getStudioFontEmbedCSS = async (): Promise<string> => {
  if (cachedFontEmbedCSS) return cachedFontEmbedCSS;
  if (isFetchingFonts) {
    while (isFetchingFonts) {
      await new Promise(r => setTimeout(r, 100));
    }
    return cachedFontEmbedCSS;
  }

  isFetchingFonts = true;
  try {
    let css = '';

    // 1. Local Doran fonts
    try {
      const doranReg = await fetchFontAsBase64('/Doran-Regular.otf');
      const doranBold = await fetchFontAsBase64('/Doran-Bold.otf');
      const doranMedium = await fetchFontAsBase64('/Doran-Medium.otf');
      
      css += `
        @font-face {
          font-family: 'Doran';
          src: url('${doranReg}') format('opentype');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Doran';
          src: url('${doranBold}') format('opentype');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Doran';
          src: url('${doranMedium}') format('opentype');
          font-weight: 500;
          font-style: normal;
          font-display: swap;
        }
      `;
    } catch (e) {
      console.error('Failed to inline local Doran fonts:', e);
    }

    // 2. Local Manrope fonts
    try {
      const manropeReg = await fetchFontAsBase64('/Manrope-Regular.otf');
      const manropeBold = await fetchFontAsBase64('/Manrope-Bold.otf');

      css += `
        @font-face {
          font-family: 'Manrope';
          src: url('${manropeReg}') format('opentype');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Manrope';
          src: url('${manropeBold}') format('opentype');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
      `;
    } catch (e) {
      console.error('Failed to inline local Manrope fonts:', e);
    }

    // 3. Google Fonts
    try {
      const googleFontsUrl = "https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Tajawal:wght@300;400;500;700;900&family=Almarai:wght@300;400;700;800&family=Amiri:wght@400;700&family=Scheherazade+New:wght@400;700&family=Montserrat:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap";
      const res = await fetch(googleFontsUrl);
      if (res.ok) {
        let googleCss = await res.text();
        const urlMatches = Array.from(googleCss.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g));
        const fontUrlToBase64 = new Map<string, string>();
        await Promise.all(urlMatches.map(async (match) => {
          const fontUrl = match[1];
          if (!fontUrlToBase64.has(fontUrl)) {
            try {
              const b64 = await fetchFontAsBase64(fontUrl);
              fontUrlToBase64.set(fontUrl, b64);
            } catch (err) {
              console.warn(`Failed to inline Google Font file: ${fontUrl}`, err);
            }
          }
        }));

        for (const [fontUrl, b64] of fontUrlToBase64.entries()) {
          googleCss = googleCss.split(fontUrl).join(b64);
        }
        css += "\n" + googleCss;
      }
    } catch (e) {
      console.error('Failed to inline Google Fonts:', e);
    }

    cachedFontEmbedCSS = css;
  } finally {
    isFetchingFonts = false;
  }
  return cachedFontEmbedCSS;
};
