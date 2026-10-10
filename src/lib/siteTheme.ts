/** Shared application palette: startup and appearance previews use the same rules. */
type Hsl = { h: number; s: number; l: number };
export type ThemeColors = Partial<Record<'primary_color' | 'secondary_color' | 'accent_color' | 'muted_color' | 'background_color' | 'text_color' | 'border_color', string>>;

export function hexToHsl(hex: string): Hsl {
  if (!/^#[\da-f]{6}$/i.test(hex)) return { h: 42, s: 67, l: 55 };
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round((d ? d / (1 - Math.abs(2 * l - 1)) : 0) * 100), l: Math.round(l * 100) };
}

function luminance({ h, s, l }: Hsl) {
  const a = s / 100 * Math.min(l / 100, 1 - l / 100);
  const channels = [0, 8, 4].map(n => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrast(a: Hsl, b: Hsl) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function readable(color: Hsl, surface: Hsl) {
  const result = { ...color };
  const step = luminance(surface) > 0.179 ? -1 : 1;
  while (contrast(result, surface) < 5 && (step < 0 ? result.l > 0 : result.l < 100)) result.l += step;
  return result;
}

const fmt = (c: Hsl) => `${c.h} ${c.s}% ${c.l}%`;
const lightTokens = ['secondary', 'secondary-foreground', 'accent', 'accent-foreground', 'muted', 'muted-foreground', 'background', 'foreground', 'border', 'input', 'card', 'card-foreground', 'popover', 'popover-foreground', 'sidebar-background', 'sidebar-foreground', 'sidebar-accent', 'sidebar-accent-foreground', 'sidebar-border', 'surface-1', 'surface-2', 'surface-3'];

export function themeVariables(data: ThemeColors, dark: boolean): Record<string, string> {
  const primary = hexToHsl(data.primary_color || '#d6ac40');
  const background = dark ? { h: 30, s: 6, l: 6 } : hexToHsl(data.background_color || '#faf9f6');
  const black = { h: 0, s: 0, l: 0 }, white = { h: 0, s: 0, l: 100 };
  const foreground = contrast(primary, black) >= contrast(primary, white) ? black : white;
  const primaryText = readable(primary, background);
  const variables: Record<string, string> = {
    '--primary': fmt(primary), '--primary-foreground': fmt(foreground), '--primary-text': fmt(primaryText),
    '--primary-glow': fmt({ ...primary, l: Math.min(primary.l + 10, 85) }),
    '--ring': fmt(primaryText), '--sidebar-primary': fmt(primary), '--sidebar-primary-foreground': fmt(foreground),
    '--sidebar-ring': fmt(primaryText), '--yellow': fmt(primaryText),
    '--gradient-primary': `linear-gradient(135deg, hsl(${fmt(primary)}) 0%, hsl(${fmt({ ...primary, l: Math.max(0, Math.min(100, primary.l + (foreground === black ? 3 : -3))) })}) 100%)`,
    '--shadow-gold': `0 6px 20px -6px hsl(${fmt(primary)} / 0.15)`,
    '--shadow-luxury': `0 8px 30px -8px hsl(${fmt(primary)} / 0.2)`,
    '--shadow-hover': `0 6px 16px -4px hsl(${fmt(primary)} / 0.14)`,
  };
  if (!dark) {
    const text = readable(hexToHsl(data.text_color || '#211f1b'), background);
    const secondary = hexToHsl(data.secondary_color || '#f3f1ed');
    const accent = hexToHsl(data.accent_color || '#f6eed7');
    const muted = hexToHsl(data.muted_color || '#f3f1ed');
    const border = hexToHsl(data.border_color || '#ddd8ce');
    Object.assign(variables, {
      '--background': fmt(background), '--foreground': fmt(text),
      '--secondary': fmt(secondary), '--secondary-foreground': fmt(readable(text, secondary)),
      '--accent': fmt(accent), '--accent-foreground': fmt(readable(primary, accent)),
      '--muted': fmt(muted), '--muted-foreground': fmt(readable({ h: muted.h, s: 6, l: 38 }, muted)),
      '--border': fmt(border), '--input': fmt(border), '--card': '0 0% 100%', '--popover': '0 0% 100%',
      '--card-foreground': fmt(readable(text, white)), '--popover-foreground': fmt(readable(text, white)),
      '--sidebar-background': '0 0% 100%', '--sidebar-foreground': fmt(readable(text, white)),
      '--sidebar-accent': fmt(accent), '--sidebar-accent-foreground': fmt(readable(primary, accent)),
      '--sidebar-border': fmt(border), '--surface-1': '0 0% 100%', '--surface-2': fmt(background), '--surface-3': fmt(muted),
    });
  }
  return variables;
}

export function applySiteColors(data: ThemeColors) {
  const root = document.documentElement;
  const dark = root.classList.contains('dark');
  if (dark) lightTokens.forEach(token => root.style.removeProperty(`--${token}`));
  Object.entries(themeVariables(data, dark)).forEach(([key, value]) => root.style.setProperty(key, value));
}
