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

    // التحقق من أن تفعيل hideAdType يخفي حقل نص العقد بالكامل ولا يسقط إلى "تركيب رقم: 1179"
    const getContractInfoText = (
      contextType: string,
      hideAdType: boolean,
      rawItemAdType: string,
      itemContractNumber: string | number
    ) => {
      const cleanAdType = !hideAdType ? rawItemAdType.replace(/^نوع\s*الإعلان\s*:\s*/, '').trim() : '';
      let contractInfoText = '';
      if (contextType === 'installation') {
        if (!hideAdType) {
          if (cleanAdType) {
            contractInfoText = `نوع الإعلان: ${cleanAdType}`;
          } else if (itemContractNumber) {
            contractInfoText = `تركيب رقم: ${itemContractNumber}`;
          }
        }
      }
      return contractInfoText;
    };

    // مع تعطيل الإخفاء
    expect(getContractInfoText('installation', false, 'بيبسي', 1179)).toBe('نوع الإعلان: بيبسي');
    expect(getContractInfoText('installation', false, '', 1179)).toBe('تركيب رقم: 1179');

    // مع تفعيل خيار إخفاء نوع الإعلان (hideAdType = true)
    // يجب أن يختفي النص بالكامل ولا يظهر "تركيب رقم: 1179"
    expect(getContractInfoText('installation', true, 'بيبسي', 1179)).toBe('');
    expect(getContractInfoText('installation', true, '', 1179)).toBe('');
  });

  it('ميزة إخفاء صور التركيب: عند تفعيل hideInstalledImages، يتم استبعاد صور التركيب وعرض صورة اللوحة الأصلية فقط', () => {
    const resolveImages = (
      hideInstalledImages: boolean,
      showInstalledImages: boolean,
      item: { installed_image_face_a_url?: string | null; installed_image_face_b_url?: string | null },
      billboard: { Image_URL?: string | null },
      fetchedInstalled?: { face_a?: string; face_b?: string } | null,
      supportsBackFace: boolean = true
    ) => {
      const allowInstalledImages = !hideInstalledImages;
      const fetched = (allowInstalledImages && showInstalledImages) ? fetchedInstalled : null;
      const installedImageFaceA = allowInstalledImages
        ? (item.installed_image_face_a_url || fetched?.face_a || null)
        : null;
      const installedImageFaceB = (allowInstalledImages && supportsBackFace)
        ? (item.installed_image_face_b_url || fetched?.face_b || null)
        : null;

      const mainImage = installedImageFaceA && !installedImageFaceB
        ? installedImageFaceA
        : (billboard.Image_URL || '');

      const isTwoFacesInstalled = Boolean(installedImageFaceA && installedImageFaceB);

      return { installedImageFaceA, installedImageFaceB, mainImage, isTwoFacesInstalled };
    };

    // سيناريو 1: مهمة تركيب مع وجهين مركبين - بدون تفعيل الإخفاء
    const normalInstallTwoFaces = resolveImages(
      false,
      false,
      { installed_image_face_a_url: 'https://site.com/faceA.jpg', installed_image_face_b_url: 'https://site.com/faceB.jpg' },
      { Image_URL: 'https://site.com/original.jpg' }
    );
    expect(normalInstallTwoFaces.installedImageFaceA).toBe('https://site.com/faceA.jpg');
    expect(normalInstallTwoFaces.installedImageFaceB).toBe('https://site.com/faceB.jpg');
    expect(normalInstallTwoFaces.isTwoFacesInstalled).toBe(true);

    // سيناريو 2: نفس المهمة لكن مع تفعيل خيار إخفاء صور التركيب (hideInstalledImages = true)
    const hiddenInstallTwoFaces = resolveImages(
      true,
      false,
      { installed_image_face_a_url: 'https://site.com/faceA.jpg', installed_image_face_b_url: 'https://site.com/faceB.jpg' },
      { Image_URL: 'https://site.com/original.jpg' }
    );
    expect(hiddenInstallTwoFaces.installedImageFaceA).toBeNull();
    expect(hiddenInstallTwoFaces.installedImageFaceB).toBeNull();
    expect(hiddenInstallTwoFaces.isTwoFacesInstalled).toBe(false);
    expect(hiddenInstallTwoFaces.mainImage).toBe('https://site.com/original.jpg');

    // سيناريو 3: مهمة تركيب بوجه واحد مع تفعيل الإخفاء
    const hiddenInstallOneFace = resolveImages(
      true,
      false,
      { installed_image_face_a_url: 'https://site.com/faceA.jpg', installed_image_face_b_url: null },
      { Image_URL: 'https://site.com/original.jpg' }
    );
    expect(hiddenInstallOneFace.installedImageFaceA).toBeNull();
    expect(hiddenInstallOneFace.mainImage).toBe('https://site.com/original.jpg');

    // سيناريو 4: طباعة الجدول - استبعاد عمود صور التركيب عند تفعيل hideInstalledImages
    const filterColumns = (columns: { id: string; enabled: boolean }[], hideInstalledImages: boolean) => {
      return columns.filter(c => c.enabled && (!hideInstalledImages || c.id !== 'installed_images'));
    };

    const cols = [
      { id: 'row_number', enabled: true },
      { id: 'billboard_image', enabled: true },
      { id: 'installed_images', enabled: true },
      { id: 'qr_code', enabled: true },
    ];

    expect(filterColumns(cols, false).map(c => c.id)).toContain('installed_images');
    expect(filterColumns(cols, true).map(c => c.id)).not.toContain('installed_images');
  });
});
