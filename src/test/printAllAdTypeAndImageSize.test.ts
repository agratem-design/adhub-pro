import { describe, it, expect } from 'vitest';

describe('طباعة الكل - خيارات نوع الإعلان وحجم الصورة عند استبعاد التصاميم', () => {
  it('يجب أن تكون ميزة إخفاء نوع الإعلان غير مفعلة افتراضياً (false)', () => {
    const defaultHideAdType = false;
    expect(defaultHideAdType).toBe(false);
  });

  it('حساب عنوان أمر التركيب: يحذف نوع الإعلان عند تفعيل خيار إخفاء نوع الإعلان', () => {
    const getInstallationTitle = (hideAdType: boolean, adType?: string, taskName?: string) => {
      const cleanAdType = !hideAdType ? (adType || taskName || '').replace(/^نوع\s*الإعلان\s*:\s*/, '').trim() : '';
      return cleanAdType ? `أمر تركيب (${cleanAdType})` : 'أمر تركيب';
    };

    // مع تعطيل الإخفاء
    expect(getInstallationTitle(false, 'بيبسي')).toBe('أمر تركيب (بيبسي)');
    expect(getInstallationTitle(false, 'نوع الإعلان: كوكاكولا')).toBe('أمر تركيب (كوكاكولا)');

    // مع تفعيل الإخفاء
    expect(getInstallationTitle(true, 'بيبسي')).toBe('أمر تركيب');
    expect(getInstallationTitle(true, 'نوع الإعلان: كوكاكولا')).toBe('أمر تركيب');
  });

  it('حساب أبعاد حاوية الصورة: تتوسع الصورة تلقائياً لملء مساحة التصاميم عند استبعاد التصاميم', () => {
    const calculateImageDimensions = (
      isDesignsIncluded: boolean,
      settings: { main_image_height?: string; main_image_width?: string; installed_image_height?: string }
    ) => {
      const allowedImageHeight = isDesignsIncluded
        ? (settings.installed_image_height || '85mm')
        : `${Math.max(parseFloat(settings.main_image_height || '140'), 140)}mm`;

      const maxAllowedWidth = isDesignsIncluded
        ? ((settings.main_image_width && parseFloat(settings.main_image_width) > 190) ? settings.main_image_width : '190mm')
        : '190mm';

      return { allowedImageHeight, maxAllowedWidth };
    };

    // حالة وجود التصاميم
    const withDesigns = calculateImageDimensions(true, {
      installed_image_height: '85mm',
      main_image_height: '106mm',
      main_image_width: '111mm'
    });
    expect(withDesigns.allowedImageHeight).toBe('85mm');

    // حالة عدم تضمين التصاميم (تتوسع الصورة إلى مساحة التصاميم على الأقل 140 مم وبعرض 190 مم)
    const withoutDesigns = calculateImageDimensions(false, {
      installed_image_height: '85mm',
      main_image_height: '106mm',
      main_image_width: '111mm'
    });
    expect(withoutDesigns.allowedImageHeight).toBe('140mm');
    expect(withoutDesigns.maxAllowedWidth).toBe('190mm');

    // إذا كانت الإعدادات المخصصة أكبر من 140 مم، تُحترم القيمة الأكبر
    const customLarge = calculateImageDimensions(false, {
      installed_image_height: '85mm',
      main_image_height: '150mm',
      main_image_width: '180mm'
    });
    expect(customLarge.allowedImageHeight).toBe('150mm');
    expect(customLarge.maxAllowedWidth).toBe('190mm');
  });

  it('تسميات التصاميم وخلايا الجدول تخفي نوع الإعلان عند تفعيل hideAdType', () => {
    const getDesignLabel = (showDesignName: boolean, adType: string, hideAdType: boolean, fallback: string) => {
      return (showDesignName && adType && !hideAdType) ? adType : fallback;
    };

    expect(getDesignLabel(true, 'حملة الصيف', false, 'التصميم')).toBe('حملة الصيف');
    expect(getDesignLabel(true, 'حملة الصيف', true, 'التصميم')).toBe('التصميم');

    const getTableCellAd = (rawAd: string, hideAdType: boolean) => {
      return !hideAdType ? rawAd.replace(/^نوع\s*الإعلان\s*:\s*/, '').trim() : '';
    };

    expect(getTableCellAd('نوع الإعلان: منتج جديد', false)).toBe('منتج جديد');
    expect(getTableCellAd('نوع الإعلان: منتج جديد', true)).toBe('');
  });
});
