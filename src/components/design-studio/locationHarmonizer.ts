// 📁 locationHarmonizer.ts - نظام التناغم اللوني واستخراج ألوان الخلفية وضبط موضع النصوص
import { extractImagePalette, hexLuminance, rgbToHex } from '@/utils/extractImagePalette';
import { CanvasElement } from './types';

export interface HarmonizedColors {
  primary: string;
  municipality: string;
  region: string;
  landmark: string;
  pin: string;
  separator: string;
  capsuleBg: string;
  capsuleBorder: string;
}

// Convert Hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Samples the central area of an image to determine whether the ribbon/card center is light or dark.
 */
export async function detectImageCenterLuminance(imageUrl: string): Promise<'light' | 'dark'> {
  if (!imageUrl) return 'dark';
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve('dark');
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve('dark');

        // Draw center 50% of the image
        ctx.drawImage(img, 0, 0, 64, 64);
        const data = ctx.getImageData(16, 16, 32, 32).data;
        let totalLum = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 50) continue; // transparent pixel
          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          totalLum += 0.299 * r + 0.587 * g + 0.114 * b;
          count++;
        }

        if (count === 0) return resolve('dark');
        const avgLum = totalLum / count;
        resolve(avgLum > 0.5 ? 'light' : 'dark');
      } catch {
        resolve('dark');
      }
    };
    img.src = imageUrl;
  });
}

/**
 * Given a primary color and background luminance type, generates a complete set of harmonized colors.
 */
export function generateHarmoniousColors(
  primaryHex: string,
  bgType: 'light' | 'dark' = 'light'
): HarmonizedColors {
  const { h, s, l } = hexToHsl(primaryHex);

  if (bgType === 'light') {
    // For light backgrounds (like cream, white or light gold):
    // Primary title text should be dark and crisp (L ~ 22-30) but saturated with the chosen hue
    const municipality = hslToHex(h, Math.max(30, s), Math.min(28, Math.max(14, l > 45 ? 24 : l)));
    // Region text should be a rich warm accent (e.g. shifted hue or slightly lighter gold/bronze)
    const region = hslToHex((h + 20) % 360, Math.min(85, s + 10), 38);
    // Landmark text: subtle darker tint
    const landmark = hslToHex(h, Math.max(20, s - 15), 32);
    // Pin icon
    const pin = primaryHex;
    // Separator
    const separator = hslToHex((h + 30) % 360, 80, 42);
    // Pill capsule (semi-translucent light or dark)
    const capsuleBg = 'rgba(255, 255, 255, 0.85)';
    const capsuleBorder = `1px solid ${hslToHex(h, s, 50)}60`;

    return {
      primary: primaryHex,
      municipality,
      region,
      landmark,
      pin,
      separator,
      capsuleBg,
      capsuleBorder,
    };
  } else {
    // For dark backgrounds (black, charcoal, dark green, dark blue):
    // Primary title text should be bright (L ~ 88-96)
    const municipality = hslToHex(h, Math.min(80, s), Math.max(88, l < 50 ? 92 : l));
    // Region text: rich golden or bright accent
    const region = hslToHex(45, 90, 65); // Warm royal gold
    // Landmark text: soft white/light tint
    const landmark = hslToHex(h, Math.max(15, s - 20), 82);
    const pin = primaryHex;
    const separator = hslToHex(45, 90, 65);
    const capsuleBg = 'rgba(12, 14, 20, 0.85)';
    const capsuleBorder = `1px solid ${hslToHex(45, 90, 60)}70`;

    return {
      primary: primaryHex,
      municipality,
      region,
      landmark,
      pin,
      separator,
      capsuleBg,
      capsuleBorder,
    };
  }
}

/**
 * Automatically analyzes an image URL, extracts its palette, determines center luminance,
 * and produces harmonized colors ready to apply.
 */
export async function autoHarmonizeFromImageUrl(
  imageUrl: string
): Promise<{ colors: HarmonizedColors; palette: string[]; bgType: 'light' | 'dark' }> {
  const [palette, bgType] = await Promise.all([
    extractImagePalette(imageUrl, 8),
    detectImageCenterLuminance(imageUrl),
  ]);

  // Pick the most representative dominant color from palette as primary
  let chosenPrimary = '#d6ac40';
  if (palette.length > 0) {
    // Prefer saturated colors
    const sorted = [...palette].sort((a, b) => {
      const aHsl = hexToHsl(a);
      const bHsl = hexToHsl(b);
      return bHsl.s - aHsl.s;
    });
    chosenPrimary = sorted[0];
  }

  const colors = generateHarmoniousColors(chosenPrimary, bgType);
  return { colors, palette, bgType };
}

/**
 * Vertically aligns or offsets all location texts inside the location strip.
/**
 * Vertically aligns or offsets all location texts inside the location strip.
 * Can center them, align to top/bottom, or shift with a custom Y offset.
 * Calculates dynamic line spacing so texts NEVER overflow the bottom of the strip.
 */
export function alignLocationTextsVertically(
  elements: CanvasElement[],
  stripHeight: number,
  mode: 'top' | 'center' | 'bottom' | number,
  customSpacing?: number
): CanvasElement[] {
  const locIds = ['municipality_region', 'landmark'];
  const locElements = elements.filter(
    (el) => el.parentStrip === 'location' || locIds.includes(el.id)
  );

  if (locElements.length === 0) return elements;

  // Dynamic line spacing: snug 32-38px so both lines always fit comfortably in stripHeight
  const lineSpacing = customSpacing !== undefined
    ? customSpacing
    : Math.min(38, Math.max(26, Math.round(stripHeight * 0.30)));

  let targetBaseY = 20;

  if (typeof mode === 'number') {
    // Mode is direct Y coordinate for the first line (clamped safely)
    targetBaseY = Math.max(4, Math.min(stripHeight - lineSpacing - 22, mode));
  } else if (mode === 'top') {
    targetBaseY = Math.max(8, Math.round(stripHeight * 0.10));
  } else if (mode === 'center') {
    // Center the combined 2-line bounding box in the middle of stripHeight
    targetBaseY = Math.max(6, Math.round((stripHeight - lineSpacing - 22) / 2));
  } else if (mode === 'bottom') {
    targetBaseY = Math.max(12, stripHeight - lineSpacing - 28);
  }

  return elements.map((el) => {
    if (el.id === 'municipality_region') {
      return { ...el, y: targetBaseY };
    }
    if (el.id === 'landmark') {
      // Ensure landmark stays strictly inside stripHeight with safe bottom margin
      const landmarkY = Math.min(stripHeight - 22, targetBaseY + lineSpacing);
      return { ...el, y: landmarkY };
    }
    return el;
  });
}
