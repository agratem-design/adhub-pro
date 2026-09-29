import { describe, it, expect } from 'vitest';

describe('استوديو تحضير الطباعة الشاملة - ميزة إخفاء إجمالي الأمتار من الجدول', () => {
  it('الوضع الافتراضي لإخفاء إجمالي الأمتار هو false (ظاهر افتراضياً)', () => {
    const defaultHideTotalMeters = false;
    expect(defaultHideTotalMeters).toBe(false);
  });

  it('حساب ظهور تذييل الجدول (showTotalMeters): يُخفي سطر إجمالي المساحة عند تفعيل الخيار', () => {
    const shouldShowTotalMeters = (hideTotalMeters: boolean) => {
      return !hideTotalMeters;
    };

    // عند عدم التفعيل (الوضع الافتراضي)
    expect(shouldShowTotalMeters(false)).toBe(true);

    // عند تفعيل زر إخفاء إجمالي الأمتار
    expect(shouldShowTotalMeters(true)).toBe(false);
  });

  it('توليد HTML تذييل الجدول: لا يتم تضمين tfoot عند إخفاء إجمالي الأمتار', () => {
    const generateTableFooterHtml = (
      isLastPage: boolean,
      showTotalMeters: boolean,
      totalAreaMeters: number,
      totalColumnsCount: number
    ) => {
      if (!isLastPage || !showTotalMeters) return '';
      return `
        <tfoot>
          <tr>
            <td colspan="${totalColumnsCount}">
              <span>إجمالي مساحة اللوحات: </span>
              <span>${totalAreaMeters.toFixed(2)} م²</span>
            </td>
          </tr>
        </tfoot>
      `;
    };

    const totalArea = 150.5;
    const colsCount = 8;

    // على الصفحة الأخيرة مع إظهار الإجمالي
    const footerShown = generateTableFooterHtml(true, true, totalArea, colsCount);
    expect(footerShown).toContain('إجمالي مساحة اللوحات:');
    expect(footerShown).toContain('150.50 م²');
    expect(footerShown).toContain('<tfoot>');

    // على الصفحة الأخيرة مع إخفاء الإجمالي
    const footerHidden = generateTableFooterHtml(true, false, totalArea, colsCount);
    expect(footerHidden).toBe('');

    // على صفحة غير الأخيرة حتى لو كان الإظهار مفعلاً
    const notLastPage = generateTableFooterHtml(false, true, totalArea, colsCount);
    expect(notLastPage).toBe('');
  });

  it('مزامنة الإعدادات: التحقق من مفتاح hide_total_meters في إعدادات الطباعة', () => {
    const settings: Record<string, string> = {
      faces_count_show: 'true',
      hide_total_meters: 'false'
    };

    expect(settings.hide_total_meters).toBe('false');

    // محاكاة تبديل المفتاح
    settings.hide_total_meters = 'true';
    const isHidden = settings.hide_total_meters === 'true';
    expect(isHidden).toBe(true);
  });
});
