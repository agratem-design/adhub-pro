import { describe, expect, it } from 'vitest';
import { resolveMunicipalityPhotoArea } from '../utils/municipalityPhoto';

describe('municipality original photo area', () => {
  it('enlarges a narrow photo area without reaching the address', () => {
    const area = resolveMunicipalityPhotoArea({ main_image_top: '90mm', main_image_left: '50%', main_image_width: '120mm', main_image_height: '99mm', location_info_top: '233mm' });
    expect(area.width).toBe(190);
    expect(area.height).toBe(138);
    expect(area.top + area.height).toBe(228);
  });
  it('keeps shifted photos within the page margins and honours the address boundary', () => {
    const area = resolveMunicipalityPhotoArea({ main_image_top: '85mm', main_image_left: '40mm', location_info_top: '210mm' });
    expect(area.center - area.width / 2).toBeGreaterThanOrEqual(10);
    expect(area.center + area.width / 2).toBeLessThanOrEqual(200);
    expect(area.top + area.height).toBe(205);
  });
});
