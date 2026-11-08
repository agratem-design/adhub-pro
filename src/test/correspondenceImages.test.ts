import { describe, it, expect } from 'vitest';
import { parseImageLine, renderMarkup, serializeImageLine } from '@/services/correspondence';

describe('Correspondence inline images', () => {
  it('round-trips an image line with caption, width and alignment', () => {
    const line = serializeImageLine({ url: 'https://x.test/a.jpg', caption: 'اللوحة الأولى', width: 60, align: 'left' });
    expect(line).toBe('![اللوحة الأولى|60|left](https://x.test/a.jpg)');
    expect(parseImageLine(line)).toEqual({ url: 'https://x.test/a.jpg', caption: 'اللوحة الأولى', width: 60, align: 'left' });
  });

  it('uses defaults and ignores non-image lines', () => {
    expect(serializeImageLine({ url: 'https://x.test/a.jpg' })).toBe('![](https://x.test/a.jpg)');
    expect(parseImageLine('![](https://x.test/a.jpg)')).toMatchObject({ width: 75, align: 'center', caption: '' });
    expect(parseImageLine('نص عادي')).toBeNull();
    expect(parseImageLine('| a | b |')).toBeNull();
  });

  it('renders an image between paragraphs as a figure', () => {
    const html = renderMarkup('فقرة أولى\n\n![وصف|50](https://x.test/a.jpg)\n\nفقرة ثانية', 'https://app.test');
    const first = html.indexOf('فقرة أولى');
    const fig = html.indexOf('<figure');
    const second = html.indexOf('فقرة ثانية');
    expect(first).toBeGreaterThan(-1);
    expect(fig).toBeGreaterThan(first);
    expect(second).toBeGreaterThan(fig);
    expect(html).toContain('width:50%');
    expect(html).toContain('<figcaption>');
  });

  it('makes relative image URLs absolute when an origin is given', () => {
    expect(renderMarkup('![](/img/a.png)', 'https://app.test')).toContain('src="https://app.test/img/a.png"');
  });
});
