// Keep configured text colors when legible; pale gold backgrounds need dark ink.
export function readablePrintColor(background: string, foreground: string): string {
  const luminance = (color: string): number | null => {
    const hex = color.replace('#', '');
    if (!/^[\da-f]{3}$|^[\da-f]{6}$/i.test(hex)) return null;
    const full = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex;
    const rgb = [0, 2, 4].map(offset => {
      const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const bg = luminance(background), fg = luminance(foreground);
  if (bg === null || fg === null) return foreground;
  if ((Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05) >= 4.5) return foreground;
  return (bg + 0.05) / 0.05 >= 1.05 / (bg + 0.05) ? '#171717' : '#ffffff';
}
