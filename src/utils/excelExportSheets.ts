import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';

/**
 * Adds pricing, slides, companies, and cities sheets to an existing XLSX workbook.
 */
export async function addExtraSheets(wb: XLSX.WorkBook): Promise<void> {
  // Order: الأسعار → المدن → الشركات → السلايدات
  await addPricingSheet(wb);
  await addCitiesSheet(wb);
  await addCompaniesSheet(wb);
  await addSlidesSheet(wb);
}

async function addPricingSheet(wb: XLSX.WorkBook) {
  try {
    // ✅ يجلب الأسعار حصراً من صفحة "أسعار التصدير" (customer_category = 'شركات')
    // مطابقاً للقالب: billboard_level | الفترة | size_id | المقاس | شركات
    const { data, error } = await supabase
      .from('export_pricing')
      .select('size, billboard_level, one_month, "2_months", "3_months", "6_months", full_year, one_day')
      .eq('customer_category', 'شركات');

    if (error || !data || data.length === 0) return;

    // الفترات بنفس ترتيب القالب
    const periods: Array<{ key: string; label: string }> = [
      { key: 'one_month', label: 'شهرياً' },
      { key: '2_months', label: 'كل شهرين' },
      { key: '3_months', label: 'كل 3 أشهر' },
      { key: '6_months', label: 'كل 6 أشهر' },
      { key: 'full_year', label: 'سنوي' },
      { key: 'one_day', label: 'يومي' },
    ];

    // ترتيب المستويات: S ثم A ثم B ثم C ثم الباقي أبجدياً
    const levelOrder: Record<string, number> = { S: 1, A: 2, B: 3, C: 4 };
    const levels = Array.from(new Set(data.map((r: any) => r.billboard_level).filter(Boolean)))
      .sort((a, b) => (levelOrder[a as string] ?? 99) - (levelOrder[b as string] ?? 99) || String(a).localeCompare(String(b)));

    // جلب size_id الحقيقي وترتيب المقاسات من جدول sizes
    let sizeIdMap = new Map<string, number>();
    let sortedSizes: string[] = [];
    try {
      const { data: sizesData } = await supabase
        .from('sizes')
        .select('id, name, sort_order')
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (sizesData) {
        for (const s of sizesData as any[]) {
          if (s?.name) sizeIdMap.set(String(s.name).trim(), Number(s.id));
        }
      }
    } catch {}

    // المقاسات الموجودة فعلاً في البيانات، مرتبة حسب sort_order ثم الاسم
    const sizesInData = Array.from(new Set(data.map((r: any) => String(r.size || '').trim()).filter(Boolean)));
    sortedSizes = sizesInData.sort((a, b) => {
      const ia = sizeIdMap.get(a) ?? 9999;
      const ib = sizeIdMap.get(b) ?? 9999;
      return ia - ib || a.localeCompare(b);
    });

    // فهرسة: level|size → record
    const idx = new Map<string, any>();
    for (const r of data) {
      const k = `${r.billboard_level}|${String(r.size || '').trim()}`;
      idx.set(k, r);
    }

    // بناء الصفوف بنفس ترتيب القالب: لكل (مستوى × فترة × مقاس) صف
    const headers = ['billboard_level', 'الفترة', 'size_id', 'المقاس', 'شركات'];
    const rows: any[][] = [];

    let fallbackId = 1;
    const ensureSizeId = (sz: string): number => {
      if (sizeIdMap.has(sz)) return sizeIdMap.get(sz)!;
      sizeIdMap.set(sz, fallbackId++);
      return sizeIdMap.get(sz)!;
    };

    for (const level of levels) {
      for (const period of periods) {
        for (const size of sortedSizes) {
          const rec = idx.get(`${level}|${size}`);
          const val = rec ? rec[period.key] : null;
          rows.push([level, period.label, ensureSizeId(size), size, Number(val ?? 0)]);
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 16 }, // billboard_level
      { wch: 14 }, // الفترة
      { wch: 8 },  // size_id
      { wch: 14 }, // المقاس
      { wch: 12 }, // شركات
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'الأسعار');
  } catch (e) {
    console.error('Error adding pricing sheet:', e);
  }
}

async function addSlidesSheet(wb: XLSX.WorkBook) {
  try {
    const { data, error } = await supabase
      .from('export_slides').select('*').eq('is_active', true).order('sort_order');
    if (error || !data || data.length === 0) return;

    const headers = ['الترتيب', 'العنوان', 'رابط الصورة'];
    const rows = data.map((s: any) => [s.sort_order, s.title || '', normalizeGoogleImageUrl(s.image_url) || '']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, 'السلايدات');
  } catch (e) {
    console.error('Error adding slides sheet:', e);
  }
}

// استخراج اسم الملف من الـ URL أو من المسار
function extractImageName(url: string, fallback: string): string {
  if (!url) return fallback;
  try {
    // إذا كان رابط جوجل، استخدم fallback (لأن الرابط لا يحتوي امتداد واضح)
    const cleanUrl = url.split('?')[0].split('#')[0];
    const parts = cleanUrl.split('/');
    const last = parts[parts.length - 1];
    if (last && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(last)) {
      return last;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

async function addCompaniesSheet(wb: XLSX.WorkBook) {
  try {
    const { data, error } = await supabase
      .from('export_company_images').select('*').eq('is_active', true).order('sort_order');
    if (error || !data || data.length === 0) return;

    const headers = ['اسم الصورة', 'الرابط المباشر', 'صورة مصغرة', 'اسم العنصر', 'ترقيم'];
    const rows = data.map((c: any) => {
      const url = normalizeGoogleImageUrl(c.image_url) || '';
      const name = c.company_name || '';
      return [
        extractImageName(c.image_url || '', `${name}.jpg`),
        url,
        '',
        name,
        c.sort_order,
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 18 }, { wch: 60 }, { wch: 12 }, { wch: 20 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, 'الشركات');
  } catch (e) {
    console.error('Error adding companies sheet:', e);
  }
}

async function addCitiesSheet(wb: XLSX.WorkBook) {
  try {
    const { data, error } = await supabase
      .from('export_city_images').select('*').eq('is_active', true).order('sort_order');
    if (error || !data || data.length === 0) return;

    const headers = ['اسم الصورة', 'الرابط المباشر', 'صورة مصغرة', 'اسم العنصر', 'ترقيم'];
    const rows = data.map((c: any) => {
      const url = normalizeGoogleImageUrl(c.image_url) || '';
      const name = c.city_name || '';
      return [
        extractImageName(c.image_url || '', `${name}.jpg`),
        url,
        '',
        name,
        c.sort_order,
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 18 }, { wch: 60 }, { wch: 12 }, { wch: 20 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, 'المدن');
  } catch (e) {
    console.error('Error adding cities sheet:', e);
  }
}
