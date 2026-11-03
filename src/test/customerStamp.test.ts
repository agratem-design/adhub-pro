import { describe, expect, it } from 'vitest';
import { companyStampPosition } from '@/lib/companyStamp';
import { renderCustomerStamp } from '@/lib/customerStamp';

const stamp = { stamp_enabled: true, stamp_image: 'data:image/png;base64,YQ==' };
describe('customer contract stamp', () => {
  it('embeds an enabled stamp at the second party position', () => {
    expect(renderCustomerStamp(stamp)).toContain('x="360" y="3060"');
    expect(renderCustomerStamp(stamp)).toContain(stamp.stamp_image);
  });
  it('omits disabled, missing, unsafe stamps and offers', () => {
    expect(renderCustomerStamp()).toBe('');
    expect(renderCustomerStamp({ ...stamp, stamp_enabled: false })).toBe('');
    expect(renderCustomerStamp({ ...stamp, stamp_image: 'javascript:alert(1)' })).toBe('');
    expect(renderCustomerStamp(stamp, true)).toBe('');
  });
  it('uses the second party box even for legacy custom coordinates', () => {
    expect(renderCustomerStamp({ ...stamp, stamp_x: 9999, stamp_y: -10, stamp_width: 500 })).toContain('x="360" y="3060" width="300"');
  });
});


describe('compact company stamp', () => {
  it('reduces both new and previously saved default layouts', () => {
    expect(companyStampPosition()).toMatchObject({ x: 1780, y: 3060, width: 300 });
    expect(companyStampPosition({ visible: true, x: 1604, y: 3060, width: 300 })).toEqual(companyStampPosition());
    expect(companyStampPosition({ visible: true, x: 1544, y: 3000, width: 420 })).toEqual(companyStampPosition());
    expect(companyStampPosition({ visible: false, x: 1544, y: 3000, width: 420 }).visible).toBe(false);
  });
  it('preserves a customized company stamp layout', () => {
    expect(companyStampPosition({ x: 1500, y: 2900, width: 350 })).toMatchObject({ x: 1500, y: 2900, width: 350 });
  });
});
