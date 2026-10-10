import { describe, expect, it } from 'vitest';
import { applySiteColors, contrast, hexToHsl, themeVariables } from '@/lib/siteTheme';

const parse = (value: string) => {
  const [h, s, l] = value.replaceAll('%', '').split(' ').map(Number);
  return { h, s, l };
};

describe('application theme contrast and mode changes', () => {
  it.each(['#d6ac40', '#C6922A', '#ffffff', '#111111', '#2D6BFF'])('keeps buttons and primary labels readable for %s in both modes', color => {
    for (const dark of [false, true]) {
      const variables = themeVariables({ primary_color: color }, dark);
      expect(contrast(parse(variables['--primary']), parse(variables['--primary-foreground']))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parse(variables['--primary-text']), dark ? { h: 30, s: 6, l: 6 } : parse(variables['--background']))).toBeGreaterThanOrEqual(4.5);
      expect(variables['--sidebar-primary-foreground']).toBe(variables['--primary-foreground']);
    }
  });

  it('clears custom light surfaces in dark mode and restores them on returning to light', () => {
    const data = { primary_color: '#C6922A', background_color: '#fdfbf7', accent_color: '#f5e6c8' };
    document.documentElement.classList.remove('dark');
    applySiteColors(data);
    const light = document.documentElement.style.getPropertyValue('--background');
    document.documentElement.classList.add('dark');
    applySiteColors(data);
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--sidebar-accent')).toBe('');
    document.documentElement.classList.remove('dark');
    applySiteColors(data);
    expect(document.documentElement.style.getPropertyValue('--background')).toBe(light);
  });

  it('retains readable content when saved text colors have insufficient contrast', () => {
    const variables = themeVariables({ text_color: '#eeeeee', background_color: '#ffffff', secondary_color: '#eeeeee' }, false);
    expect(contrast(parse(variables['--foreground']), hexToHsl('#ffffff'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parse(variables['--secondary-foreground']), parse(variables['--secondary']))).toBeGreaterThanOrEqual(4.5);
  });
});
