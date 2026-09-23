// Lightweight dominant color palette extractor.
// Loads an image into a small canvas, samples pixels, quantizes via a
// 4-bit-per-channel histogram and returns the most common colors as hex.

const toHex = (n: number) => {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  return v.toString(16).padStart(2, '0');
};

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexLuminance(hex: string): number {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function hexSaturation(hex: string): number {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

export async function extractImagePalette(url: string, count = 6): Promise<string[]> {
  if (!url) return [];
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve([]);
    img.onload = () => {
      try {
        const W = 96;
        const H = Math.max(16, Math.round((img.naturalHeight / Math.max(1, img.naturalWidth)) * W));
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve([]);
        ctx.drawImage(img, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;

        // 4-bit-per-channel histogram (4096 bins)
        const bins = new Map<number, { r: number; g: number; b: number; n: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 200) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          // skip near-white & near-black noise so we get meaningful brand colors
          const lum = (r + g + b) / 3;
          if (lum > 245 || lum < 8) continue;
          const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
          const cur = bins.get(key);
          if (cur) { cur.r += r; cur.g += g; cur.b += b; cur.n += 1; }
          else bins.set(key, { r, g, b, n: 1 });
        }

        const sorted = Array.from(bins.values()).sort((a, b) => {
          const ah = rgbToHex(a.r / a.n, a.g / a.n, a.b / a.n);
          const bh = rgbToHex(b.r / b.n, b.g / b.n, b.b / b.n);
          const aLum = hexLuminance(ah);
          const bLum = hexLuminance(bh);
          const aScore = a.n * (0.45 + hexSaturation(ah) * 1.8) * (0.75 + Math.abs(aLum - 0.5));
          const bScore = b.n * (0.45 + hexSaturation(bh) * 1.8) * (0.75 + Math.abs(bLum - 0.5));
          return bScore - aScore;
        });
        const palette: string[] = [];
        for (const c of sorted) {
          const hex = rgbToHex(c.r / c.n, c.g / c.n, c.b / c.n);
          // dedupe close colors
          if (palette.some((p) => colorDistance(p, hex) < 28)) continue;
          palette.push(hex);
          if (palette.length >= count) break;
        }
        resolve(palette);
      } catch {
        resolve([]);
      }
    };
    img.src = url;
  });
}

function colorDistance(a: string, b: string): number {
  const pa = a.replace('#', '');
  const pb = b.replace('#', '');
  const ar = parseInt(pa.substring(0, 2), 16), ag = parseInt(pa.substring(2, 4), 16), ab = parseInt(pa.substring(4, 6), 16);
  const br = parseInt(pb.substring(0, 2), 16), bg = parseInt(pb.substring(2, 4), 16), bb = parseInt(pb.substring(4, 6), 16);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

/** Pick a darker color from the palette suitable as a glow base (low luminance). */
export function pickGlowColor(palette: string[]): string | null {
  if (!palette.length) return null;
  const sorted = [...palette].sort((a, b) => hexLuminance(a) - hexLuminance(b));
  return sorted[0];
}

/** Pick the most saturated/brightest color suitable as an accent. */
export function pickAccentColor(palette: string[]): string | null {
  if (!palette.length) return null;
  const sorted = [...palette].sort((a, b) => {
    const aLum = hexLuminance(a);
    const bLum = hexLuminance(b);
    const aScore = hexSaturation(a) * 2 + (aLum > 0.22 && aLum < 0.82 ? 0.8 : 0) - Math.abs(aLum - 0.55);
    const bScore = hexSaturation(b) * 2 + (bLum > 0.22 && bLum < 0.82 ? 0.8 : 0) - Math.abs(bLum - 0.55);
    return bScore - aScore;
  });
  return sorted[0] ?? null;
}

/** Pick a secondary readable color that differs from the accent. */
export function pickSecondaryColor(palette: string[], accent?: string | null): string | null {
  if (!palette.length) return null;
  const candidates = palette.filter((c) => !accent || colorDistance(c, accent) > 42);
  const sorted = (candidates.length ? candidates : palette).sort((a, b) => {
    const aLum = hexLuminance(a);
    const bLum = hexLuminance(b);
    const aScore = (aLum > 0.55 ? 1.2 : 0) + hexSaturation(a) * 0.7 + aLum;
    const bScore = (bLum > 0.55 ? 1.2 : 0) + hexSaturation(b) * 0.7 + bLum;
    return bScore - aScore;
  });
  return sorted[0] ?? null;
}

/** Convert an alpha 0..1 to a 2-char hex suffix for use in `#RRGGBB${aa}`. */
export function alphaToHex(a: number): string {
  const v = Math.max(0, Math.min(1, a));
  return Math.round(v * 255).toString(16).padStart(2, '0');
}

// ─── Smart Role-Based Color Pickers ────────────────────────────────────────

/**
 * Mix a hex color toward white or black by `t` (0 = original, 1 = full target).
 */
function blendHex(hex: string, target: '#ffffff' | '#000000', t: number): string {
  const m = hex.replace('#', '');
  const tr = target === '#ffffff' ? 255 : 0;
  const r = Math.round(parseInt(m.substring(0, 2), 16) * (1 - t) + tr * t);
  const g = Math.round(parseInt(m.substring(2, 4), 16) * (1 - t) + tr * t);
  const b = Math.round(parseInt(m.substring(4, 6), 16) * (1 - t) + tr * t);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Pick the best color for the MAIN TITLE (campaign name).
 * Prefers light/bright colors for readability on dark templates.
 * Falls back to near-white if palette is all dark.
 */
export function pickTitleColor(palette: string[]): string {
  if (!palette.length) return '#ffffff';
  // Sort by luminance descending — brightest first
  const sorted = [...palette].sort((a, b) => hexLuminance(b) - hexLuminance(a));
  // Prefer colors with luminance > 0.6 (light enough to read)
  const bright = sorted.find(c => hexLuminance(c) > 0.6);
  if (bright) return bright;
  // If none bright enough, lighten the brightest one
  return blendHex(sorted[0], '#ffffff', 0.5);
}

/**
 * Pick the best color for the KICKER (small top label / "حملة إعلانية لـ").
 * Prefers vivid, mid-luminance colors — should feel energetic but not garish.
 */
export function pickKickerColor(palette: string[], accent: string): string {
  if (!palette.length) return accent;
  const candidates = [...palette].sort((a, b) => {
    const aScore = hexSaturation(a) * 1.5 + (hexLuminance(a) > 0.35 && hexLuminance(a) < 0.78 ? 1 : 0);
    const bScore = hexSaturation(b) * 1.5 + (hexLuminance(b) > 0.35 && hexLuminance(b) < 0.78 ? 1 : 0);
    return bScore - aScore;
  });
  // Prefer a color that's different from title (avoid clashing)
  const vivid = candidates.find(c => hexSaturation(c) > 0.3 && hexLuminance(c) > 0.3);
  return vivid || accent;
}

/**
 * Pick the best color for the TAGLINE pill / badge background.
 * Should be the warmest, most saturated color — calls-to-action feel.
 */
export function pickTaglineColor(palette: string[], accent: string): string {
  if (!palette.length) return accent;
  const sorted = [...palette].sort((a, b) => {
    const aLum = hexLuminance(a);
    const bLum = hexLuminance(b);
    // Favor warm hues and high saturation in a safe mid-luminance range
    const aScore = hexSaturation(a) * 2.5 + (aLum > 0.25 && aLum < 0.72 ? 0.8 : 0);
    const bScore = hexSaturation(b) * 2.5 + (bLum > 0.25 && bLum < 0.72 ? 0.8 : 0);
    return bScore - aScore;
  });
  return sorted[0] || accent;
}

/**
 * Pick the best color for the BRAND NAME label at the top.
 * Should be readable and authoritative — prefer mid-bright with good saturation.
 */
export function pickBrandNameColor(palette: string[], accent: string): string {
  if (!palette.length) return accent;
  // Similar to accent logic but biased toward golden / warm tones
  const sorted = [...palette].sort((a, b) => {
    const aLum = hexLuminance(a);
    const bLum = hexLuminance(b);
    const aScore = hexSaturation(a) * 1.8 + (aLum > 0.4 && aLum < 0.85 ? 1.2 : 0);
    const bScore = hexSaturation(b) * 1.8 + (bLum > 0.4 && bLum < 0.85 ? 1.2 : 0);
    return bScore - aScore;
  });
  return sorted[0] || accent;
}

/**
 * Build a complete role-mapped color assignment from a palette.
 * Returns all the element-level color decisions in one call.
 */
export function buildCoverColorRoles(palette: string[]): {
  accent: string;
  secondary: string;
  glow: string;
  kicker: string;
  campaignName: string;
  tagline: string;
  badge: string;
  footerRight: string;
  brandName: string;
} {
  if (!palette.length) {
    const fallback = '#d6ac40';
    return { accent: fallback, secondary: '#ffffff', glow: '#000000', kicker: fallback, campaignName: '#ffffff', tagline: fallback, badge: fallback, footerRight: fallback, brandName: fallback };
  }

  const accent = pickAccentColor(palette) || palette[0];
  const glow = pickGlowColor(palette) || '#000000';
  const title = pickTitleColor(palette);
  const kicker = pickKickerColor(palette, accent);
  const tagline = pickTaglineColor(palette, accent);
  const brand = pickBrandNameColor(palette, accent);
  // Footer right: slightly lighter than accent if possible
  const secondary = pickSecondaryColor(palette, accent) || '#ffffff';
  const footerRight = pickKickerColor(palette, secondary);

  return {
    accent,
    secondary,
    glow,
    kicker,
    campaignName: title,
    tagline,
    badge: secondary,
    footerRight,
    brandName: brand,
  };
}