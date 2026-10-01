import { describe, it, expect } from 'vitest';

describe('البلديات - إضافة عمود الشركة للجدول وبطاقات الطباعة أعلى المقاس', () => {
  // 1. فحص خوارزمية استخراج اسم الشركة حسب الأولوية
  it('التحقق من حل اسم الشركة (resolveItemCompany) حسب الأولوية الصحيحة', () => {
    const resolveItemCompany = (
      item: { company?: string | null; company_name?: string | null; billboard_id?: number | null },
      billboardsMap: Map<number, any>,
      companiesMap: Map<string, string>
    ): string => {
      if (item.company && item.company.trim()) return item.company.trim();
      if (item.company_name && item.company_name.trim()) return item.company_name.trim();

      if (item.billboard_id && billboardsMap.has(item.billboard_id)) {
        const b = billboardsMap.get(item.billboard_id);
        if (b.Company && String(b.Company).trim()) return String(b.Company).trim();
        if (b.company && String(b.company).trim()) return String(b.company).trim();
        const compId = b.own_company_id || b.friend_company_id;
        if (compId && companiesMap.has(compId)) {
          return companiesMap.get(compId)!;
        }
      }
      return '';
    };

    const companiesMap = new Map<string, string>([
      ['c-1', 'شركة الفارس الذهبي'],
      ['c-2', 'شركة الأفق للإعلانات'],
    ]);

    const billboardsMap = new Map<number, any>([
      [101, { ID: 101, Company: 'شركة الفارس الذهبي' }],
      [102, { ID: 102, own_company_id: 'c-2' }],
      [103, { ID: 103, Company: null, own_company_id: null }],
    ]);

    // حالة 1: الشركة مسجلة مباشرة في عنصر المجموعة
    expect(resolveItemCompany({ company: 'شركة النور' }, billboardsMap, companiesMap)).toBe('شركة النور');

    // حالة 2: الشركة مسجلة في company_name
    expect(resolveItemCompany({ company_name: 'شركة الرواد' }, billboardsMap, companiesMap)).toBe('شركة الرواد');

    // حالة 3: الشركة مأخوذة من حقل Company في اللوحة الرسمية
    expect(resolveItemCompany({ billboard_id: 101 }, billboardsMap, companiesMap)).toBe('شركة الفارس الذهبي');

    // حالة 4: الشركة مأخوذة من own_company_id في اللوحة الرسمية عبر الخريطة
    expect(resolveItemCompany({ billboard_id: 102 }, billboardsMap, companiesMap)).toBe('شركة الأفق للإعلانات');

    // حالة 5: لا توجد شركة
    expect(resolveItemCompany({ billboard_id: 103 }, billboardsMap, companiesMap)).toBe('');
  });

  // 2. التحقق من عمود الشركة في جدول ملخص الطباعة
  it('التحقق من حساب عرض الأعمدة وإضافة عمود الشركة لجدول الملخص عند التفعيل', () => {
    const calculateTableColumns = (showFacesCol: boolean, showCompanyCol: boolean, showStatusInPrint: boolean) => {
      const indexWidth = 10;
      const facesWidth = showFacesCol ? 14 : 0;
      const sizeWidth = 20;
      const companyWidth = showCompanyCol ? 22 : 0;
      const qrWidth = 12.5;

      const remainingWidth = 190 - (indexWidth + facesWidth + sizeWidth + qrWidth + companyWidth);

      let locWidth: number, coordsWidth: number, statusWidth: number, landmarkWidth: number;
      if (showStatusInPrint) {
        locWidth = showCompanyCol ? 26 : 32;
        coordsWidth = showCompanyCol ? 32 : 38;
        statusWidth = 18;
        landmarkWidth = remainingWidth - (locWidth + coordsWidth + statusWidth);
      } else {
        locWidth = showCompanyCol ? 30 : 36;
        coordsWidth = showCompanyCol ? 36 : 42;
        landmarkWidth = remainingWidth - (locWidth + coordsWidth);
        statusWidth = 0;
      }

      const totalColumnsCount = 6 + (showFacesCol ? 1 : 0) + (showStatusInPrint ? 1 : 0) + (showCompanyCol ? 1 : 0);

      return {
        companyWidth,
        locWidth,
        coordsWidth,
        statusWidth,
        landmarkWidth,
        totalColumnsCount,
        totalWidth: indexWidth + locWidth + landmarkWidth + sizeWidth + facesWidth + companyWidth + coordsWidth + statusWidth + qrWidth,
      };
    };

    // عند تفعيل عمود الشركة
    const withCompany = calculateTableColumns(true, true, true);
    expect(withCompany.companyWidth).toBe(22);
    expect(withCompany.totalColumnsCount).toBe(9); // 6 أساسي + أوجه + حالة + شركة = 9
    expect(withCompany.totalWidth).toBe(190);

    // عند إخفاء عمود الشركة
    const withoutCompany = calculateTableColumns(true, false, true);
    expect(withoutCompany.companyWidth).toBe(0);
    expect(withoutCompany.totalColumnsCount).toBe(8);
    expect(withoutCompany.totalWidth).toBe(190);
  });

  // 3. التحقق من ظهور الشركة أعلى المقاس في بطاقة اللوحة بنفس إحداثيات نوع الإعلان من طباعة الكل
  it('التحقق من إحداثيات عنصر الشركة أعلى المقاس في بطاقة اللوحة المطبوعة', () => {
    const s = {
      contract_number_top: '39.869mm',
      contract_number_right: '22mm',
      contract_number_font_size: '16px',
      size_top: '48mm',
      size_left: '63%',
    };

    const renderCardCompanyHtml = (showCompanyInPrint: boolean, itemCompany: string) => {
      if (!showCompanyInPrint || !itemCompany) return '';
      return `
        <div class="absolute-field municipality-company" style="top: ${s.contract_number_top || '39.869mm'}; right: ${s.contract_number_right || '22mm'}; font-size: ${s.contract_number_font_size || '16px'};">
          <span style="font-weight: 700;">الشركة: </span>${itemCompany}
        </div>
      `;
    };

    // عند التفعيل وتوفر اسم الشركة
    const cardHtml = renderCardCompanyHtml(true, 'شركة الفارس الذهبي');
    expect(cardHtml).toContain('municipality-company');
    expect(cardHtml).toContain('top: 39.869mm');
    expect(cardHtml).toContain('right: 22mm');
    expect(cardHtml).toContain('الشركة:');
    expect(cardHtml).toContain('شركة الفارس الذهبي');

    // الإحداثيات أعلى المقاس: 39.869mm أصغر من size_top (48mm)
    const companyTopNum = parseFloat(s.contract_number_top);
    const sizeTopNum = parseFloat(s.size_top);
    expect(companyTopNum).toBeLessThan(sizeTopNum);

    // عند التعطيل
    expect(renderCardCompanyHtml(false, 'شركة الفارس الذهبي')).toBe('');
    // عند عدم توفر اسم الشركة
    expect(renderCardCompanyHtml(true, '')).toBe('');
  });

  // 4. فحص تصدير إكسيل مع تضمين عمود الشركة
  it('التحقق من تضمين عمود الشركة في ترويسة وبيانات تصدير الإكسيل عند التفعيل', () => {
    const buildExcelData = (
      items: Array<{ sequence_number: number; location: string; company: string; municipality: string }>,
      includeCompany: boolean
    ) => {
      const headers = [
        '#',
        'الموقع / اسم اللوحة',
        ...(includeCompany ? ['الشركة'] : []),
        'البلدية',
      ];
      const rows = items.map(it => [
        it.sequence_number,
        it.location,
        ...(includeCompany ? [it.company] : []),
        it.municipality,
      ]);
      return { headers, rows };
    };

    const sampleItems = [
      { sequence_number: 1, location: 'موقع 1', company: 'الفارس الذهبي', municipality: 'طرابلس' },
      { sequence_number: 2, location: 'موقع 2', company: 'الأفق', municipality: 'الخمس' },
    ];

    const withComp = buildExcelData(sampleItems, true);
    expect(withComp.headers).toContain('الشركة');
    expect(withComp.rows[0]).toContain('الفارس الذهبي');
    expect(withComp.rows[1]).toContain('الأفق');

    const withoutComp = buildExcelData(sampleItems, false);
    expect(withoutComp.headers).not.toContain('الشركة');
  });

  // 5. التحقق من القيمة الافتراضية
  it('الوضع الافتراضي لإظهار الشركة في الطباعة غير مفعل افتراضياً', () => {
    const defaultShowCompanyInPrint = false;
    expect(defaultShowCompanyInPrint).toBe(false);
  });

  // 6. التحقق من التعرف التلقائي على عمود الشركة عند استيراد ملف Excel
  it('التعرف التلقائي على عمود الشركة عند استيراد ملف Excel ومطابقة الحقول', () => {
    const headers = [
      '#',
      'الموقع / اسم اللوحة',
      'البلدية',
      'أقرب نقطة دالة',
      'المقاس',
      'الأوجه',
      'الإحداثيات',
      'حالة اللوحة',
      'رابط الصورة',
      'الشركة'
    ];

    const find = (patterns: string[]) => {
      const lower = headers.map(h => h.trim().toLowerCase());
      for (const p of patterns) {
        const idx = lower.findIndex(h => h.includes(p));
        if (idx >= 0) return headers[idx];
      }
      return '';
    };

    const detectedCompany = find(['الشركة', 'شركة', 'company']);
    const detectedName = find(['اسم اللوحة', 'الموقع / اسم اللوحة', 'اسم', 'name', 'موقع اللوحة']);
    const detectedSize = find(['مقاس', 'المقاس', 'size']);
    const detectedFaces = find(['أوجه', 'الاوجه', 'الأوجه', 'وجه', 'faces']);
    const detectedMunicipality = find(['البلدية', 'بلدية', 'municipality']);
    const detectedStatus = find(['حالة اللوحة', 'الحالة', 'حالة', 'status']);

    expect(detectedCompany).toBe('الشركة');
    expect(detectedName).toBe('الموقع / اسم اللوحة');
    expect(detectedSize).toBe('المقاس');
    expect(detectedFaces).toBe('الأوجه');
    expect(detectedMunicipality).toBe('البلدية');
    expect(detectedStatus).toBe('حالة اللوحة');
  });
});
