import { describe, expect, it } from 'vitest';
import { buildFactorPricingPrint } from '@/utils/factorPricingPrint';

const options = {
  type: 'single_city' as const, showComparison: true, origin: 'http://localhost', city: 'طرابلس', category: 'خاص', size: '12x4', level: 'all',
  prices: [{ size_name: '12x4', billboard_level: 'A', one_day: 100, one_month: 1000, two_months: 2000, three_months: 3000, six_months: 6000, full_year: 10000 }],
  municipalities: [{ municipality_name: 'طرابلس', factor: .8, is_active: true }],
  categories: [{ category_name: 'خاص', factor: .5, is_active: true }],
};
describe('factor pricing print', () => {
  it('compares the final price against its base and preserves zero factors', () => {
    const html = buildFactorPricingPrint(options);
    expect(html).toContain('4,000');
    expect(html).toContain('الأساس 10,000');
    const zero = buildFactorPricingPrint({ ...options, categories: [{ ...options.categories[0], factor: 0 }] });
    expect(zero).toContain('تخفيض 100%');
    expect(zero).not.toContain('>4,000<');
  });
  it('paginates price cards and refuses missing levels', () => {
    const html = buildFactorPricingPrint({ ...options, prices: Array.from({ length: 13 }, () => options.prices[0]) });
    expect(html.match(/class="page factor-sheet"/g)).toHaveLength(3);
    expect(() => buildFactorPricingPrint({ ...options, level: 'B' })).toThrow();
  });
  it('escapes names and does not invent a comparison base', () => {
    const html = buildFactorPricingPrint({ ...options, type: 'municipalities', size: 'missing', municipalities: [{ municipality_name: '<script>x</script>', factor: .8, is_active: true }] });
    expect(html).toContain('غير متوفر');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
