import { describe, expect, it } from 'vitest';
import { buildMunicipalitySizeFields } from '../utils/municipalitySizeFields';

const settings = { size_top: '51mm', size_left: '62%', size_font_size: '36px', size_color: '#111',
  faces_count_top: '60mm', faces_count_font_size: '12px', coords_font_family: 'Manrope' };
describe('municipality size preview and print renderer', () => {
  it('uses the chosen positions and font sizes without moving or resizing fields', () => {
    const html = buildMunicipalitySizeFields(settings, '<span>3 × 4</span>', 'وجهين');
    expect(html).toContain('top:51mm;font-size:36px');
    expect(html).toContain('top:60mm;font-size:12px');
    expect(html).toContain('left:62%');
    expect(html).toContain('width:70mm');
    expect(html).toContain('وجهين');
  });
  it('keeps custom positions and the faces visibility setting', () => {
    const html = buildMunicipalitySizeFields({ ...settings, size_top: '80mm', size_left: '25%', faces_count_show: 'false' }, '8 × 3', 'وجهين');
    expect(html).toContain('top:80mm');
    expect(html).toContain('left:25%');
    expect(html).not.toContain('municipality-faces');
  });
});
