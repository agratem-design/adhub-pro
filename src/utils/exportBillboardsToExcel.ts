import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

interface BillboardExportData {
  billboardName: string;
  nearestLandmark: string;
  municipality: string;
  size: string;
  facesCount: string | number;
  billboardType: string;
  imageUrl: string;
  coordinates: string;
  customerName: string;
  adType: string;
  installedFaceA: string;
  installedFaceB: string;
  price?: string | number;
}

export interface ExportBillboardsOptions {
  contractNumber: string | number;
  billboards: any[];
  customerName?: string;
  includePrices?: boolean;
  isOffer?: boolean;
}

export async function exportBillboardsToExcel({
  contractNumber,
  billboards,
  customerName = '',
  includePrices = false,
  isOffer = false
}: ExportBillboardsOptions) {
  if (!billboards || billboards.length === 0) {
    throw new Error('لا توجد لوحات للتصدير');
  }

  // جلب صور التركيب لكل اللوحات دفعة واحدة
  const billboardIds = billboards
    .map((b) => Number(b.ID ?? b.id))
    .filter((id) => Number.isFinite(id));

  // جلب نوع الإعلان من العقد أو العرض كاحتياط (يكون عادةً فارغًا على اللوحة)
  let contractAdType = '';
  if (contractNumber) {
    try {
      if (isOffer) {
        const { data: offerRow } = await supabase
          .from('offers')
          .select('ad_type')
          .eq('offer_number', Number(contractNumber))
          .maybeSingle();
        contractAdType = (offerRow as any)?.ad_type || '';
      } else {
        const { data: contractRow } = await supabase
          .from('Contract')
          .select('"Ad Type"')
          .eq('Contract_Number', Number(contractNumber))
          .maybeSingle();
        contractAdType = (contractRow as any)?.['Ad Type'] || '';
      }
    } catch (err) {
      console.warn('[exportBillboardsToExcel] failed to fetch Ad Type:', err);
    }
  }

  const installedImagesMap = new Map<number, { faceA: string; faceB: string }>();
  if (billboardIds.length > 0) {
    try {
      const { data: items, error: itemsErr } = await supabase
        .from('installation_task_items')
        .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, created_at')
        .in('billboard_id', billboardIds)
        .order('created_at', { ascending: false });
      if (itemsErr) console.warn('[exportBillboardsToExcel] installation_task_items error:', itemsErr);

      if (items) {
        // اختر أول صف يحوي صوراً فعلية لكل لوحة (لا يتم تجاوزه بصف فارغ أحدث)
        for (const it of items as any[]) {
          const bid = Number(it.billboard_id);
          if (!Number.isFinite(bid)) continue;
          const existing = installedImagesMap.get(bid);
          if (existing && (existing.faceA || existing.faceB)) continue;
          const faceA = it.installed_image_face_a_url || '';
          const faceB = it.installed_image_face_b_url || '';
          if (!faceA && !faceB && existing) continue;
          installedImagesMap.set(bid, { faceA, faceB });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch installation images for export:', err);
    }

    // Fallback: billboard_history
    const missingIds = billboardIds.filter((id) => {
      const entry = installedImagesMap.get(id);
      return !entry || (!entry.faceA && !entry.faceB);
    });
    if (missingIds.length > 0) {
      try {
        const { data: histItems } = await supabase
          .from('billboard_history')
          .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, contract_number, updated_at')
          .in('billboard_id', missingIds)
          .order('updated_at', { ascending: false });

        if (histItems) {
          for (const h of histItems as any[]) {
            const bid = Number(h.billboard_id);
            if (!Number.isFinite(bid)) continue;
            const existing = installedImagesMap.get(bid);
            if (existing && (existing.faceA || existing.faceB)) continue;
            if (!h.installed_image_face_a_url && !h.installed_image_face_b_url) continue;
            installedImagesMap.set(bid, {
              faceA: h.installed_image_face_a_url || '',
              faceB: h.installed_image_face_b_url || '',
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch installation images from history:', err);
      }
    }

    // لوغ تشخيصي
    const finalMissing = billboardIds.filter((id) => {
      const entry = installedImagesMap.get(id);
      return !entry || (!entry.faceA && !entry.faceB);
    });
    console.info(
      `[exportBillboardsToExcel] صور التركيب: ${billboardIds.length - finalMissing.length}/${billboardIds.length} لوحة`,
      finalMissing.length > 0 ? { missingBillboardIds: finalMissing } : ''
    );
  }

  const exportData: BillboardExportData[] = billboards.map((billboard) => {
    const bid = Number(billboard.ID ?? billboard.id);
    const installed = installedImagesMap.get(bid) || { faceA: '', faceB: '' };

    const data: BillboardExportData = {
      billboardName: billboard.Billboard_Name || billboard.name || billboard.ID || billboard.id || '',
      nearestLandmark: billboard.Nearest_Landmark || billboard.nearest_landmark || billboard.location || '',
      municipality: billboard.Municipality || billboard.municipality || billboard.City || '',
      size: billboard.Size || billboard.size || '',
      facesCount: billboard.Faces_Count || billboard.faces_count || billboard.Faces || billboard.faces || '',
      billboardType: billboard.billboard_type || billboard.Ad_Type || billboard.ad_type || billboard.type || '',
      imageUrl: billboard.Image_URL || billboard.image_url || billboard.image || '',
      coordinates: billboard.GPS_Coordinates || billboard.coordinates || billboard.coords || '',
      customerName: customerName,
      adType: billboard.Ad_Type || billboard.ad_type || contractAdType || '',
      installedFaceA: installed.faceA,
      installedFaceB: installed.faceB,
    };

    if (includePrices && billboard.Price != null) {
      data.price = billboard.Price;
    }

    return data;
  });

  // إنشاء الأعمدة
  const headers: Record<string, string> = {
    billboardName: 'اسم اللوحة',
    nearestLandmark: 'أقرب نقطة دالة',
    municipality: 'البلدية',
    size: 'المقاس',
    facesCount: 'عدد الأوجه',
    billboardType: 'نوع اللوحة',
    imageUrl: 'رابط الصورة',
    coordinates: 'إحداثيات اللوحة',
    customerName: 'اسم الزبون',
    adType: 'نوع الإعلان',
    installedFaceA: 'رابط صورة التركيب - الوجه الأمامي',
    installedFaceB: 'رابط صورة التركيب - الوجه الخلفي',
  };

  if (includePrices) {
    headers.price = 'السعر';
  }

  // تحويل البيانات إلى صفوف
  const wsData = [
    Object.values(headers),
    ...exportData.map(row => Object.keys(headers).map(key => row[key as keyof BillboardExportData] || ''))
  ];

  // إنشاء ورقة العمل
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ضبط عرض الأعمدة
  const colWidths = [
    { wch: 20 }, // اسم اللوحة
    { wch: 25 }, // أقرب نقطة
    { wch: 15 }, // البلدية
    { wch: 12 }, // المقاس
    { wch: 12 }, // عدد الأوجه
    { wch: 15 }, // نوع اللوحة
    { wch: 35 }, // رابط الصورة
    { wch: 20 }, // الإحداثيات
    { wch: 20 }, // اسم الزبون
    { wch: 15 }, // نوع الإعلان
    { wch: 40 }, // رابط صورة التركيب - الوجه الأمامي
    { wch: 40 }, // رابط صورة التركيب - الوجه الخلفي
  ];

  if (includePrices) {
    colWidths.push({ wch: 12 }); // السعر
  }

  ws['!cols'] = colWidths;

  // إنشاء كتاب العمل
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'اللوحات');

  // تحديد اسم الملف
  const fileName = isOffer
    ? `لوحات_العرض_${contractNumber}${includePrices ? '_مع_الأسعار' : ''}.xlsx`
    : `لوحات_العقد_${contractNumber}${includePrices ? '_مع_الأسعار' : ''}.xlsx`;

  // حفظ الملف
  XLSX.writeFile(wb, fileName);
}
