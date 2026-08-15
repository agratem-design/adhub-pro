import { describe, it, expect } from 'vitest';
import { smartArabicMatch, normalizeArabic } from '../lib/arabicSearch';

describe('Arabic Search & Normalization Engine', () => {
  it('correctly normalizes different forms of Alef (أ, إ, آ, ا)', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد');
    expect(normalizeArabic('إبراهيم')).toBe('ابراهيم');
    expect(normalizeArabic('آدم')).toBe('ادم');
  });

  it('correctly normalizes Taa Marbuta and Haa (ة, ه) and Yaa (ي, ى)', () => {
    expect(normalizeArabic('مكتبة')).toBe('مكتبه');
    expect(normalizeArabic('مستشفى')).toBe('مستشفي');
  });

  it('smartArabicMatch matches queries regardless of diacritics or letter variations', () => {
    expect(smartArabicMatch(['شركة الفارس الذهبي', 'الدعاية والإعلان'], 'الفارس')).toBe(true);
    expect(smartArabicMatch(['مؤسسة الإتقان للطباعة'], 'الاتقان')).toBe(true);
    expect(smartArabicMatch(['طرابلس', 'زاوية الدهماني'], 'الدهمانى')).toBe(true);
  });
});
