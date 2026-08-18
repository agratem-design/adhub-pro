import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { isBillboardAvailable, isBillboardBlockedFromAvailability, isContractExpired } from '@/utils/contractUtils';
import { addExtraSheets } from '@/utils/excelExportSheets';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';
import { resolveBillboardAvailability, normalizeDateOnly } from '@/services/billboardAvailabilityService';

type ActiveContractInfo = {
  contractNumber: string | number;
  startDate: string;
  endDate: string;
  customerName: string;
  adType: string;
};
let activeContractMap: Map<string, ActiveContractInfo> = new Map();
let allContractsCache: any[] = [];

async function loadActiveContractsByBillboard(): Promise<Map<string, ActiveContractInfo>> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('Contract')
      .select('Contract_Number, "Contract Date", "End Date", "Customer Name", "Ad Type", billboard_ids, billboard_prices, billboards_released')
      .order('Contract_Number', { ascending: false });

    if (error) throw error;

    allContractsCache = data || [];
    const map = new Map<string, ActiveContractInfo>();

    (data || []).forEach((c: any) => {
      const contractStatus = String(c.Status || c.status || '').trim().toLowerCase();
      if (contractStatus === 'canceled' || contractStatus === 'ملغي' || c.billboards_released === true) {
        return;
      }

      const ids = String(c.billboard_ids || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      let billboardPricesParsed: any[] = [];
      if (c.billboard_prices) {
        try {
          billboardPricesParsed = typeof c.billboard_prices === 'string'
            ? JSON.parse(c.billboard_prices)
            : c.billboard_prices;
        } catch (e) {
          console.warn('Failed to parse billboard_prices in loadActiveContracts:', e);
        }
      }

      ids.forEach((id) => {
        let customStart = '';
        let customEnd = '';
        if (Array.isArray(billboardPricesParsed)) {
          const match = billboardPricesParsed.find((p: any) => String(p.billboardId || p.billboard_id || '') === id);
          if (match) {
            if (match.startDate) customStart = match.startDate;
            if (match.endDate) customEnd = match.endDate;
          }
        }

        const info: ActiveContractInfo = {
          contractNumber: c.Contract_Number,
          startDate: customStart || c['Contract Date'] || '',
          endDate: customEnd || c['End Date'] || '',
          customerName: c['Customer Name'] || '',
          adType: c['Ad Type'] || '',
        };

        const existing = map.get(id);
        if (!existing || (info.endDate && info.endDate > existing.endDate)) {
          map.set(id, info);
        }
      });
    });
    activeContractMap = map;
    return map;
  } catch (e) {
    console.error('Failed to load active contracts map:', e);
    activeContractMap = new Map();
    allContractsCache = [];
    return activeContractMap;
  }
}

function getActiveContractForBillboard(billboard: any): ActiveContractInfo | undefined {
  const id = String(billboard?.ID ?? billboard?.id ?? '').trim();
  if (!id) return undefined;
  const info = activeContractMap.get(id);
  if (info && info.endDate && isContractExpired(info.endDate)) {
    return undefined;
  }
  return info;
}


export const useBillboardExport = () => {
  // ✅ NEW: Get size order from database
  const getSizeOrderFromDB = async (): Promise<{ [key: string]: number }> => {
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('name, sort_order')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      
      const sizeOrderMap: { [key: string]: number } = {};
      data?.forEach((size, index) => {
        sizeOrderMap[size.name] = size.sort_order || (index + 1);
      });
      
      return sizeOrderMap;
    } catch (error) {
      console.error('Error loading size order from database:', error);
      // Fallback to hardcoded order
      return {
        '13*5': 1, '13x5': 1, '13×5': 1, '5*13': 1, '5x13': 1, '5×13': 1,
        '12*4': 2, '12x4': 2, '12×4': 2, '4*12': 2, '4x12': 2, '4×12': 2,
        '10*4': 3, '10x4': 3, '10×4': 3, '4*10': 3, '4x10': 3, '4×10': 3,
        '8*3': 4, '8x3': 4, '8×3': 4, '3*8': 4, '3x8': 4, '3×8': 4,
        '6*3': 5, '6x3': 5, '6×3': 5, '3*6': 5, '3x6': 5, '3×6': 5,
        '4*3': 6, '4x3': 6, '4×3': 6, '3*4': 6, '3x4': 6, '3×4': 6
      };
    }
  };

  // ✅ NEW: Get municipality order from database
  const getMunicipalityOrderFromDB = async (): Promise<{ [key: string]: number }> => {
    try {
      const { data, error } = await supabase
        .from('municipalities')
        .select('name, sort_order')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      
      const municipalityOrderMap: { [key: string]: number } = {};
      data?.forEach((m, index) => {
        municipalityOrderMap[m.name] = m.sort_order || (index + 1);
      });
      
      return municipalityOrderMap;
    } catch (error) {
      console.error('Error loading municipality order from database:', error);
      return {};
    }
  };

  // ✅ UPDATED: Sort billboards by database municipality AND size order
  const sortBillboardsBySize = async (billboards: any[]): Promise<any[]> => {
    const sizeOrderMap = await getSizeOrderFromDB();
    const municipalityOrderMap = await getMunicipalityOrderFromDB();
    
    return [...billboards].sort((a, b) => {
      const sizeA = a.Size || a.size || '';
      const sizeB = b.Size || b.size || '';
      
      const orderA = sizeOrderMap[sizeA] || 999;
      const orderB = sizeOrderMap[sizeB] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      const munA = a.Municipality || a.municipality || '';
      const munB = b.Municipality || b.municipality || '';
      
      const munOrderA = municipalityOrderMap[munA] || 999;
      const munOrderB = municipalityOrderMap[munB] || 999;
      
      if (munOrderA !== munOrderB) {
        return munOrderA - munOrderB;
      }
      
      // If same size order, sort by billboard ID
      const idA = a.ID || a.id || 0;
      const idB = b.ID || b.id || 0;
      return idA - idB;
    });
  };

  // ✅ Get current customer name from active contracts.
  // Prefers the cached active contract map (latest non-expired End Date) so loan contracts
  // that were written most recently don't override the real owner.
  const getCurrentCustomerName = async (billboard: any): Promise<string> => {
    try {
      const cached = getActiveContractForBillboard(billboard);
      if (cached?.customerName) return cached.customerName;

      const billboardId = billboard.ID || billboard.id;
      if (!billboardId) return billboard.Customer_Name || billboard.clientName || '';

      const todayStr = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('Contract')
        .select('"Customer Name", "End Date"')
        .or(`billboard_ids.ilike."%,${billboardId},%",billboard_ids.ilike."${billboardId},%",billboard_ids.ilike."%,${billboardId}",billboard_ids.eq.${billboardId}`)
        .gte('End Date', todayStr)
        .order('End Date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return billboard.Customer_Name || billboard.clientName || '';
      }

      return (data[0] as any)['Customer Name'] || billboard.Customer_Name || billboard.clientName || '';
    } catch (error) {
      console.error('Error getting current customer name:', error);
      return billboard.Customer_Name || billboard.clientName || '';
    }
  };

  // ✅ Get current ad type from active contracts (same loan-safe logic as customer name).
  const getCurrentAdType = async (billboard: any): Promise<string> => {
    try {
      const cached = getActiveContractForBillboard(billboard);
      if (cached?.adType) return cached.adType;

      const billboardId = billboard.ID || billboard.id;
      if (!billboardId) return billboard.Ad_Type || billboard.adType || '';

      const todayStr = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('Contract')
        .select('"Ad Type", ad_type, "End Date"')
        .or(`billboard_ids.ilike."%,${billboardId},%",billboard_ids.ilike."${billboardId},%",billboard_ids.ilike."%,${billboardId}",billboard_ids.eq.${billboardId}`)
        .gte('End Date', todayStr)
        .order('End Date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        // Fallback: fetch most recent contract regardless of end date
        const { data: fallbackData } = await supabase
          .from('Contract')
          .select('"Ad Type", ad_type, "End Date"')
          .or(`billboard_ids.ilike."%,${billboardId},%",billboard_ids.ilike."${billboardId},%",billboard_ids.ilike."%,${billboardId}",billboard_ids.eq.${billboardId}`)
          .order('End Date', { ascending: false })
          .limit(1);

        if (fallbackData && fallbackData.length > 0) {
          const adType = (fallbackData[0] as any)['Ad Type'] || (fallbackData[0] as any).ad_type || '';
          if (adType) return adType;
        }
        return billboard.Ad_Type || billboard.adType || '';
      }

      const activeAdType = (data[0] as any)['Ad Type'] || (data[0] as any).ad_type || '';
      return activeAdType || billboard.Ad_Type || billboard.adType || '';
    } catch (error) {
      console.error('Error getting current ad type:', error);
      return billboard.Ad_Type || billboard.adType || '';
    }
  };


  // ✅ UPDATED: Export to Excel function with database size ordering and updated customer/ad type data
  const exportToExcel = async (billboards: any[]) => {
    try {
      toast.info('جاري تحضير ملف Excel...');
      await loadActiveContractsByBillboard();
      
      // ✅ Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(billboards);
      
      // ✅ NEW: Get updated customer names and ad types for each billboard
      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any) => ({
          'رقم اللوحة': billboard.ID || billboard.id || '',
          'اسم اللوحة': billboard.Billboard_Name || billboard.name || '',
          'المدينة': billboard.City || billboard.city || '',
          'البلدية': billboard.Municipality || billboard.municipality || '',
          'المنطقة': billboard.District || billboard.district || '',
          'أقرب معلم': billboard.Nearest_Landmark || billboard.location || '',
          'المقاس': billboard.Size || billboard.size || '',
          'المستوى': billboard.Level || billboard.level || '',
          'الحالة': billboard.Status || billboard.status || '',
          'رقم العقد': billboard.Contract_Number || billboard.contractNumber || '',
 'اسم العميل': await getCurrentCustomerName(billboard), // Updated from contracts
 'نوع الإعلان': await getCurrentAdType(billboard), // Updated from contracts
          'تاريخ بداية الإيجار': billboard.Rent_Start_Date || billboard.rent_start_date || '',
          'تاريخ نهاية الإيجار': billboard.Rent_End_Date || billboard.rent_end_date || '',
          'لوحة شراكة': billboard.is_partnership ? 'نعم' : 'لا',
          'الشركات المشاركة': Array.isArray(billboard.partner_companies) 
            ? billboard.partner_companies.join(', ') 
            : billboard.partner_companies || '',
          'رأس المال': billboard.capital || 0,
          'المتبقي من رأس المال': billboard.capital_remaining || 0,
          'إحداثيات GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
          'عدد الأوجه': billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces || '',
          'نوع اللوحة': billboard.billboard_type || '',
          'اسم ملف الصورة': billboard.image_name || '',
          'رابط الصورة': billboard.Image_URL || billboard.image || ''
        }))
      );

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
        { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
        { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 25 }
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'اللوحات الإعلانية');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `اللوحات_الإعلانية_مرتبة_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel مرتب حسب المقاس: ${filename}`);
      console.log('✅ Excel exported with database size ordering and updated contract data');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // ✅ UPDATED: Export available billboards to Excel function with database size ordering
  const exportAvailableToExcel = async (billboards: any[], isContractExpired: (endDate: string | null) => boolean) => {
    try {
      toast.info('جاري تحضير ملف Excel للوحات المتاحة...');
      await loadActiveContractsByBillboard();
      
      // Filter available billboards with centralized availability logic
      const availableBillboards = filterAvailableBillboards(billboards, isContractExpired);

      if (availableBillboards.length === 0) {
        toast.warning('لا توجد لوحات متاحة للتصدير');
        return;
      }

      // ✅ Sort available billboards by database size order
      const sortedAvailableBillboards = await sortBillboardsBySize(availableBillboards);

      // Helper function to convert face count to text
      const getFaceCountText = (facesCount: any): string => {
        switch (String(facesCount)) {
          case '1': return 'وجه واحد';
          case '2': return 'وجهين';
          case '3': return 'ثلاثة أوجه';
          case '4': return 'أربعة أوجه';
          default: return facesCount || 'غير محدد';
        }
      };

      // Prepare data for export
      const exportData = sortedAvailableBillboards.map((billboard: any, index: number) => {
        // Generate image filename: Billboard_Name + .jpg
        const billboardName = billboard.Billboard_Name || billboard.name || '';
        const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
        
        return {
          'ر.م': billboard.ID || billboard.id || '',
          'اسم لوحة': billboardName,
          'الفئة': billboard.Level || billboard.level || billboard.Category_Level || '',
          'مدينة': billboard.City || billboard.city || '',
          'البلدية': billboard.Municipality || billboard.municipality || '',
          'منطقة': billboard.District || billboard.district || '',
          'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
          'ID الحجم': billboard.size_id || '',
          'حجم': billboard.Size || billboard.size || '',
          'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
          'نوع اللوحة': billboard.billboard_type || 'غير محدد',
          'عدد الاوجه': getFaceCountText(billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces),
          'الترتيب مقاس': index + 1,
          '@IMAGE': imageFileName,
          'image_url': normalizeGoogleImageUrl(billboard.Image_URL || billboard.image || '')
        };
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 8 },  // ر.م
        { wch: 15 }, // اسم لوحة
        { wch: 8 },  // الفئة
        { wch: 12 }, // مدينة
        { wch: 15 }, // البلدية
        { wch: 12 }, // منطقة
        { wch: 20 }, // اقرب نقطة دالة
        { wch: 10 }, // ID الحجم
        { wch: 10 }, // حجم
        { wch: 20 }, // احداثي - GPS
        { wch: 15 }, // نوع اللوحة
        { wch: 15 }, // عدد الاوجه
        { wch: 12 }, // الترتيب مقاس
        { wch: 20 }, // @IMAGE
        { wch: 30 }  // image_url
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'اللوحات المتاحة');

      // Add extra sheets (pricing, slides, companies)
      await addExtraSheets(wb);

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `اللوحات_المتاحة_مرتبة_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel مرتب: ${filename} (${availableBillboards.length} لوحة متاحة)`);
      console.log('✅ Available billboards Excel exported with database size ordering');
    } catch (error) {
      console.error('Error exporting available billboards to Excel:', error);
      toast.error('فشل في تصدير ملف Excel للوحات المتاحة');
    }
  };

  // ✅ Get contract dates — prefers the active (non-expired) contract for the billboard,
  // so loan contracts don't shadow the real owner contract dates.
  const getContractDates = async (billboard: any): Promise<{ startDate: string; endDate: string }> => {
    try {
      const cached = getActiveContractForBillboard(billboard);
      if (cached) {
        return { startDate: cached.startDate || '', endDate: cached.endDate || '' };
      }

      const billboardId = billboard.ID || billboard.id;
      if (!billboardId) {
        return {
          startDate: billboard.Rent_Start_Date || billboard.rent_start_date || '',
          endDate: billboard.Rent_End_Date || billboard.rent_end_date || ''
        };
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('Contract')
        .select('"Contract Date", "End Date", billboard_prices')
        .or(`billboard_ids.ilike."%,${billboardId},%",billboard_ids.ilike."${billboardId},%",billboard_ids.ilike."%,${billboardId}",billboard_ids.eq.${billboardId}`)
        .gte('End Date', todayStr)
        .order('End Date', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const contract = data[0] as any;
        let customStart = '';
        let customEnd = '';
        if (contract.billboard_prices) {
          try {
            const prices = typeof contract.billboard_prices === 'string'
              ? JSON.parse(contract.billboard_prices)
              : contract.billboard_prices;
            if (Array.isArray(prices)) {
              const match = prices.find((p: any) => String(p.billboardId || p.billboard_id || '') === String(billboardId));
              if (match) {
                if (match.startDate) customStart = match.startDate;
                if (match.endDate) customEnd = match.endDate;
              }
            }
          } catch {}
        }
        return {
          startDate: customStart || contract['Contract Date'] || '',
          endDate: customEnd || contract['End Date'] || ''
        };
      }

      return {
        startDate: billboard.Rent_Start_Date || billboard.rent_start_date || '',
        endDate: billboard.Rent_End_Date || billboard.rent_end_date || ''
      };
    } catch (error) {
      console.error('Error getting contract dates:', error);
      return {
        startDate: billboard.Rent_Start_Date || billboard.rent_start_date || '',
        endDate: billboard.Rent_End_Date || billboard.rent_end_date || ''
      };
    }
  };


  // ✅ UPDATED: Export follow-up billboards to Excel function with database size ordering and updated data
  const exportFollowUpToExcel = async (billboards: any[]) => {
    try {
      toast.info('جاري تحضير ملف Excel للمتابعة...');
      await loadActiveContractsByBillboard();
      
      // ✅ Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(billboards);
      
      // ✅ Get updated customer names, ad types, and contract dates for each billboard
      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any) => {
          const contractDates = await getContractDates(billboard);
          const customerName = await getCurrentCustomerName(billboard);
          const adType = await getCurrentAdType(billboard);
          
          return {
            'رقم اللوحة': billboard.ID || billboard.id || '',
            'اسم اللوحة': billboard.Billboard_Name || billboard.name || '',
            'المدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'المنطقة': billboard.District || billboard.district || '',
            'أقرب معلم': billboard.Nearest_Landmark || billboard.location || '',
            'المقاس': billboard.Size || billboard.size || '',
            'المستوى': billboard.Level || billboard.level || '',
            'إحداثيات GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'عدد الأوجه': billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces || '',
            'نوع اللوحة': billboard.billboard_type || '',
            'اسم العميل': customerName,
            'نوع الإعلان': adType,
            'تاريخ بداية العقد': contractDates.startDate,
            'تاريخ انتهاء العقد': contractDates.endDate,
            'اسم ملف الصورة': billboard.image_name || '',
            'رابط الصورة': billboard.Image_URL || billboard.image || '',
            'تصميم الوجه الأمامي': billboard.design_face_a || '',
            'تصميم الوجه الخلفي': billboard.design_face_b || '',
          };
        })
      );

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
        { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, 
        { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 25 },
        { wch: 40 }, { wch: 40 }
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'اللوحات للمتابعة');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `اللوحات_المتابعة_مرتبة_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel للمتابعة مرتب: ${filename} (${billboards.length} لوحة)`);
      console.log('✅ Follow-up billboards Excel exported with customer names, ad types, and contract dates');
    } catch (error) {
      console.error('Error exporting follow-up billboards to Excel:', error);
      toast.error('فشل في تصدير ملف Excel للمتابعة');
    }
  };

  // ✅ UPDATED: Export billboards needing re-photography with GPS coordinates (only those marked)
  const exportRePhotographyToExcel = async (billboards: any[]) => {
    try {
      toast.info('جاري تحضير ملف Excel للوحات التي تحتاج إعادة تصوير...');
      await loadActiveContractsByBillboard();
      
      // Filter only billboards marked for re-photography
      const markedBillboards = billboards.filter((billboard: any) => 
        billboard.needs_rephotography === true
      );

      if (markedBillboards.length === 0) {
        toast.warning('لا توجد لوحات محددة لإعادة التصوير');
        return;
      }
      
      // ✅ Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(markedBillboards);
      
      const exportData = sortedBillboards.map((billboard: any) => ({
        'رقم اللوحة': billboard.ID || billboard.id || '',
        'اسم اللوحة': billboard.Billboard_Name || billboard.name || '',
        'المدينة': billboard.City || billboard.city || '',
        'البلدية': billboard.Municipality || billboard.municipality || '',
        'المنطقة': billboard.District || billboard.district || '',
        'أقرب معلم': billboard.Nearest_Landmark || billboard.location || '',
        'المقاس': billboard.Size || billboard.size || '',
        'إحداثيات GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
        'رابط الصورة الحالية': billboard.Image_URL || billboard.image || '',
        'ملاحظات': 'تحتاج إعادة تصوير'
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
        { wch: 10 }, { wch: 25 }, { wch: 30 }, { wch: 20 }
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'لوحات تحتاج إعادة تصوير');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `لوحات_إعادة_تصوير_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel: ${filename} (${markedBillboards.length} لوحة)`);
      console.log('✅ Re-photography billboards Excel exported with GPS coordinates');
    } catch (error) {
      console.error('Error exporting re-photography billboards to Excel:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // ✅ NEW: Export all billboards with rent end date only (without customer info or ad type)
  const exportAllWithEndDate = async (billboards: any[]) => {
    try {
      toast.info('جاري تحضير ملف Excel لجميع اللوحات مع تاريخ الانتهاء...');
      await loadActiveContractsByBillboard();
      
      // Filter out removed billboards
      const activeBillboards = billboards.filter((billboard: any) => {
        const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
        const statusLower = statusValue.toLowerCase();
        const maintenanceStatus = String(billboard.maintenance_status ?? '').trim();
        
        // Exclude removed billboards
        if (statusValue === 'إزالة' || statusValue === 'ازالة' || statusLower === 'removed') {
          return false;
        }
        if (maintenanceStatus === 'removed' || 
            maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || 
            maintenanceStatus === 'تمت الإزالة' ||
            maintenanceStatus === 'لم يتم التركيب') {
          return false;
        }
        return true;
      });

      if (activeBillboards.length === 0) {
        toast.warning('لا توجد لوحات للتصدير');
        return;
      }

      // Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(activeBillboards);

      // Get contract dates for each billboard
      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any, index: number) => {
          const contractDates = await getContractDates(billboard);
          const billboardName = billboard.Billboard_Name || billboard.name || '';
          const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
          
          return {
            'ر.م': billboard.ID || billboard.id || '',
            'اسم لوحة': billboardName,
            'مدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'منطقة': billboard.District || billboard.district || '',
            'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
            'حجم': billboard.Size || billboard.size || '',
            'مستوى': billboard.Level || billboard.level || '',
            'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'عدد الاوجه': billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces || '',
            'تاريخ انتهاء الإيجار': contractDates.endDate || '',
            'الترتيب مقاس': index + 1,
            '@IMAGE': imageFileName,
            'image_url': normalizeGoogleImageUrl(billboard.Image_URL || billboard.image || '')
          };
        })
      );

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 8 },  // ر.م
        { wch: 15 }, // اسم لوحة
        { wch: 12 }, // مدينة
        { wch: 15 }, // البلدية
        { wch: 12 }, // منطقة
        { wch: 20 }, // اقرب نقطة دالة
        { wch: 10 }, // حجم
        { wch: 8 },  // مستوى
        { wch: 20 }, // احداثي - GPS
        { wch: 12 }, // عدد الاوجه
        { wch: 18 }, // تاريخ انتهاء الإيجار
        { wch: 12 }, // الترتيب مقاس
        { wch: 20 }, // @IMAGE
        { wch: 30 }  // image_url
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'جميع اللوحات');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `جميع_اللوحات_مع_تاريخ_الانتهاء_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel: ${filename} (${activeBillboards.length} لوحة)`);
      console.log('✅ All billboards with end date Excel exported');
    } catch (error) {
      console.error('Error exporting all billboards with end date:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // ✅ NEW: Export available billboards + those becoming available in N months (default 4)
  const exportAvailableAndUpcoming = async (billboards: any[], isContractExpired: (endDate: string | null) => boolean, monthsAhead: number = 4) => {
    try {
      const months = Math.max(1, Math.floor(Number(monthsAhead) || 4));
      toast.info(`جاري تحضير ملف Excel للوحات المتاحة والقادمة (${months} ${months === 1 ? 'شهر' : months === 2 ? 'شهرين' : months <= 10 ? 'أشهر' : 'شهراً'})...`);
      await loadActiveContractsByBillboard();
      
      const fourMonthsFromNow = new Date();
      fourMonthsFromNow.setMonth(fourMonthsFromNow.getMonth() + months);
      
      // Filter billboards: available now OR will become available within N months
      const filteredBillboards = billboards.filter((billboard: any) =>
        isAvailableOrUpcomingForExport(billboard, fourMonthsFromNow, isContractExpired)
      );

      if (filteredBillboards.length === 0) {
        toast.warning('لا توجد لوحات للتصدير');
        return;
      }

      // Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(filteredBillboards);

      // Helper function to convert face count to text
      const getFaceCountText = (facesCount: any): string => {
        switch (String(facesCount)) {
          case '1': return 'وجه واحد';
          case '2': return 'وجهين';
          case '3': return 'ثلاثة أوجه';
          case '4': return 'أربعة أوجه';
          default: return facesCount || 'غير محدد';
        }
      };

      // Get contract dates for each billboard using unified availability engine
      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any, index: number) => {
          const res = resolveBillboardAvailability(billboard, allContractsCache, { upcomingMonthsWindow: months });
          const billboardName = billboard.Billboard_Name || billboard.name || '';
          const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
          
          let endDateDisplay = '';
          if (res.operationalStatus === 'RENTED' && res.currentRentEndDate) {
            endDateDisplay = new Date(res.currentRentEndDate).toLocaleDateString('ar-LY');
          }
          
          return {
            'ر.م': billboard.ID || billboard.id || '',
            'اسم لوحة': billboardName,
            'مدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'منطقة': billboard.District || billboard.district || '',
            'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
            'حجم': billboard.Size || billboard.size || '',
            'مستوى': billboard.Level || billboard.level || '',
            'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'نوع اللوحة': billboard.billboard_type || 'غير محدد',
            'عدد الاوجه': getFaceCountText(billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces),
            'تاريخ انتهاء الإيجار': endDateDisplay,
            'متاح اعتباراً من': res.availableFrom ? new Date(res.availableFrom).toLocaleDateString('ar-LY') : 'متاح الآن',
            'الحالة': res.statusLabelArabic,
            'الترتيب مقاس': index + 1,
            '@IMAGE': imageFileName,
            'image_url': normalizeGoogleImageUrl(billboard.Image_URL || billboard.image || '')
          };
        })
      );

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 8 },  // ر.م
        { wch: 15 }, // اسم لوحة
        { wch: 12 }, // مدينة
        { wch: 15 }, // البلدية
        { wch: 12 }, // منطقة
        { wch: 20 }, // اقرب نقطة دالة
        { wch: 10 }, // حجم
        { wch: 8 },  // مستوى
        { wch: 20 }, // احداثي - GPS
        { wch: 15 }, // نوع اللوحة
        { wch: 15 }, // عدد الاوجه
        { wch: 18 }, // تاريخ انتهاء الإيجار
        { wch: 15 }, // الحالة
        { wch: 12 }, // الترتيب مقاس
        { wch: 20 }, // @IMAGE
        { wch: 30 }  // image_url
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'المتاحة والقادمة');

      // Add extra sheets (pricing, slides, companies)
      await addExtraSheets(wb);

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `اللوحات_المتاحة_والقادمة_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel: ${filename} (${filteredBillboards.length} لوحة)`);
      console.log('✅ Available and upcoming billboards Excel exported');
    } catch (error) {
      console.error('Error exporting available and upcoming billboards:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // ✅ NEW: Export available billboards + billboards from selected contracts
  const exportAvailableWithContracts = async (
    billboards: any[], 
    isContractExpired: (endDate: string | null) => boolean,
    selectedContractIds: number[],
    hideEndDateContractIds: number[] = []
  ) => {
    try {
      toast.info('جاري تحضير ملف Excel...');
      await loadActiveContractsByBillboard();

      // Get billboards from selected contracts with end dates
      let contractBillboardIds: string[] = [];
      let contractEndDates: { [billboardId: string]: string } = {};
      let billboardToContract: { [billboardId: string]: number } = {};
      
      if (selectedContractIds.length > 0) {
        const { data: contractsData, error } = await supabase
          .from('Contract')
          .select('Contract_Number, billboard_ids, "End Date", billboard_prices')
          .in('Contract_Number', selectedContractIds);

        if (!error && contractsData) {
          contractsData.forEach((contract: any) => {
            if (contract.billboard_ids) {
              const ids = String(contract.billboard_ids).split(',').map(id => id.trim()).filter(id => id);
              contractBillboardIds.push(...ids);
              
              let billboardPricesParsed: any[] = [];
              if (contract.billboard_prices) {
                try {
                  billboardPricesParsed = typeof contract.billboard_prices === 'string'
                    ? JSON.parse(contract.billboard_prices)
                    : contract.billboard_prices;
                } catch {}
              }

              ids.forEach(id => {
                billboardToContract[id] = contract.Contract_Number;
                let customEnd = '';
                if (Array.isArray(billboardPricesParsed)) {
                  const match = billboardPricesParsed.find((p: any) => String(p.billboardId || p.billboard_id || '') === id);
                  if (match && match.endDate) {
                    customEnd = match.endDate;
                  }
                }
                contractEndDates[id] = customEnd || contract['End Date'] || '';
              });
            }
          });
        }
      }

      // Filter available billboards + billboards from selected contracts
      const filteredBillboards = billboards.filter((billboard: any) => {
        const billboardId = String(billboard.ID || billboard.id);
        
        if (contractBillboardIds.includes(billboardId)) {
          return true;
        }

        return isAvailableForAvailableExports(billboard);
      });

      if (filteredBillboards.length === 0) {
        toast.warning('لا توجد لوحات للتصدير');
        return;
      }

      const sortedBillboards = await sortBillboardsBySize(filteredBillboards);

      const getFaceCountText = (facesCount: any): string => {
        switch (String(facesCount)) {
          case '1': return 'وجه واحد';
          case '2': return 'وجهين';
          case '3': return 'ثلاثة أوجه';
          case '4': return 'أربعة أوجه';
          default: return facesCount || 'غير محدد';
        }
      };

      const exportData = sortedBillboards.map((billboard: any, index: number) => {
        const billboardName = billboard.Billboard_Name || billboard.name || '';
        const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
        const billboardId = String(billboard.ID || billboard.id);
        const isFromContract = contractBillboardIds.includes(billboardId);
        const isAvailableNow = isAvailableForAvailableExports(billboard);
        const isForcedVisible = (billboard.is_visible_in_available === true);
        
        // Get end date for this billboard's contract
        let endDateDisplay = '';
        if (isFromContract && !isForcedVisible) {
          const contractNumber = billboardToContract[billboardId];
          // Only show end date if contract is NOT in hideEndDateContractIds
          if (contractNumber && !hideEndDateContractIds.includes(contractNumber)) {
            const endDate = contractEndDates[billboardId];
            if (endDate) {
              endDateDisplay = new Date(endDate).toLocaleDateString('ar-LY');
            }
          }
        }
        
        return {
          'ر.م': billboard.ID || billboard.id || '',
          'اسم لوحة': billboardName,
          'الفئة': billboard.Level || billboard.level || billboard.Category_Level || '',
          'مدينة': billboard.City || billboard.city || '',
          'البلدية': billboard.Municipality || billboard.municipality || '',
          'منطقة': billboard.District || billboard.district || '',
          'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
          'حجم': billboard.Size || billboard.size || '',
          'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
          'نوع اللوحة': billboard.billboard_type || 'غير محدد',
          'عدد الاوجه': getFaceCountText(billboard.Faces_Count || billboard.faces_count),
          'تاريخ الانتهاء': endDateDisplay,
          'المصدر': isFromContract ? 'عقد محدد' : 'متاح',
          'الترتيب مقاس': index + 1,
          '@IMAGE': imageFileName,
          'image_url': normalizeGoogleImageUrl(billboard.Image_URL || billboard.image || '')
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      const colWidths = [
        { wch: 8 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 15 },
        { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 30 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'المتاح مع العقود');
      await addExtraSheets(wb);

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `المتاح_مع_عقود_محددة_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل: ${filename} (${filteredBillboards.length} لوحة)`);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // ✅ NEW: Export available + upcoming + selected contracts (billboards without end date)
  const exportAvailableAndUpcomingWithContracts = async (
    billboards: any[], 
    isContractExpired: (endDate: string | null) => boolean,
    selectedContractIds: number[],
    hideEndDateContractIds: number[] = [],
    monthsAhead: number = 4
  ) => {
    try {
      toast.info('جاري تحضير ملف Excel للمتاح والقادمة مع عقود محددة...');
      await loadActiveContractsByBillboard();

      const months = Math.max(1, Math.floor(Number(monthsAhead) || 4));
      const fourMonthsFromNow = new Date();
      fourMonthsFromNow.setMonth(fourMonthsFromNow.getMonth() + months);

      // Get billboards from selected contracts with end dates
      let contractBillboardIds: string[] = [];
      let contractEndDates: { [billboardId: string]: string } = {};
      let billboardToContract: { [billboardId: string]: number } = {};
      
      if (selectedContractIds.length > 0) {
        const { data: contractsData, error } = await supabase
          .from('Contract')
          .select('Contract_Number, billboard_ids, "End Date", billboard_prices')
          .in('Contract_Number', selectedContractIds);

        if (!error && contractsData) {
          contractsData.forEach((contract: any) => {
            if (contract.billboard_ids) {
              const ids = String(contract.billboard_ids).split(',').map(id => id.trim()).filter(id => id);
              contractBillboardIds.push(...ids);
              
              let billboardPricesParsed: any[] = [];
              if (contract.billboard_prices) {
                try {
                  billboardPricesParsed = typeof contract.billboard_prices === 'string'
                    ? JSON.parse(contract.billboard_prices)
                    : contract.billboard_prices;
                } catch {}
              }

              ids.forEach(id => {
                billboardToContract[id] = contract.Contract_Number;
                let customEnd = '';
                if (Array.isArray(billboardPricesParsed)) {
                  const match = billboardPricesParsed.find((p: any) => String(p.billboardId || p.billboard_id || '') === id);
                  if (match && match.endDate) {
                    customEnd = match.endDate;
                  }
                }
                contractEndDates[id] = customEnd || contract['End Date'] || '';
              });
            }
          });
        }
      }

      // Filter: available + upcoming (4 months) + selected contracts
      const filteredBillboards = billboards.filter((billboard: any) => {
        const billboardId = String(billboard.ID || billboard.id);
        
        if (contractBillboardIds.includes(billboardId)) {
          return true;
        }

        return isAvailableOrUpcomingForExport(billboard, fourMonthsFromNow, isContractExpired);
      });

      if (filteredBillboards.length === 0) {
        toast.warning('لا توجد لوحات للتصدير');
        return;
      }

      const sortedBillboards = await sortBillboardsBySize(filteredBillboards);

      const getFaceCountText = (facesCount: any): string => {
        switch (String(facesCount)) {
          case '1': return 'وجه واحد';
          case '2': return 'وجهين';
          case '3': return 'ثلاثة أوجه';
          case '4': return 'أربعة أوجه';
          default: return facesCount || 'غير محدد';
        }
      };

      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any, index: number) => {
          const billboardName = billboard.Billboard_Name || billboard.name || '';
          const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
          const billboardId = String(billboard.ID || billboard.id);
          const isFromContract = contractBillboardIds.includes(billboardId);
          const isAvailableNow = isAvailableForAvailableExports(billboard);
          const isForcedVisible = (billboard.is_visible_in_available === true);
          
          // Get contract dates
          let endDateDisplay = '';
          if (isFromContract && !isForcedVisible) {
            // For selected contracts, show end date only if NOT in hideEndDateContractIds
            const contractNumber = billboardToContract[billboardId];
            if (contractNumber && !hideEndDateContractIds.includes(contractNumber)) {
              const endDate = contractEndDates[billboardId];
              if (endDate) {
                endDateDisplay = new Date(endDate).toLocaleDateString('ar-LY');
              }
            }
          } else if (!isForcedVisible) {
            // For upcoming billboards, get contract dates
            const contractDates = await getContractDates(billboard);
            endDateDisplay = contractDates.endDate || '';
          }
          
          // Determine source/status
          let source = 'متاح الآن';
          if (isFromContract) {
            source = 'عقد محدد';
          } else if (!isAvailableNow && !isForcedVisible) {
            source = 'ستتاح قريباً';
          }
          
          return {
            'ر.م': billboard.ID || billboard.id || '',
            'اسم لوحة': billboardName,
            'الفئة': billboard.Level || billboard.level || billboard.Category_Level || '',
            'مدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'منطقة': billboard.District || billboard.district || '',
            'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
            'ID الحجم': billboard.size_id || '',
            'حجم': billboard.Size || billboard.size || '',
            'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'نوع اللوحة': billboard.billboard_type || 'غير محدد',
            'عدد الاوجه': getFaceCountText(billboard.Faces_Count || billboard.faces_count),
            'تاريخ انتهاء الإيجار': endDateDisplay, // Empty for selected contracts
            'الحالة': source,
            'الترتيب مقاس': index + 1,
            '@IMAGE': imageFileName,
            'image_url': normalizeGoogleImageUrl(billboard.Image_URL || billboard.image || '')
          };
        })
      );

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      const colWidths = [
        { wch: 8 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 15 },
        { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 15 },
        { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 30 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'المتاح والقادمة مع العقود');
      await addExtraSheets(wb);

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `المتاح_والقادمة_مع_عقود_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل: ${filename} (${filteredBillboards.length} لوحة)`);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // ✅ Helper: convert data rows to tab-separated clipboard text
  const copyDataToClipboard = async (headers: string[], rows: string[][], label: string) => {
    const text = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    await navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${rows.length} ${label} إلى الحافظة`);
  };

  // ✅ Helper: face count text
  const getFaceCountText = (facesCount: any): string => {
    switch (String(facesCount)) {
      case '1': return 'وجه واحد';
      case '2': return 'وجهين';
      case '3': return 'ثلاثة أوجه';
      case '4': return 'أربعة أوجه';
      default: return facesCount || 'غير محدد';
    }
  };

  // ✅ Helpers: centralized availability logic for exports/copy
  function isExcludedBillboard(billboard: any): boolean {
    return isBillboardBlockedFromAvailability(billboard);
  }

  function isAvailableForAvailableExports(billboard: any): boolean {
    const res = resolveBillboardAvailability(billboard, allContractsCache);
    return res.isMarketingVisible && (res.operationalStatus === 'AVAILABLE' || res.marketingVisibility === 'FORCE_SHOW');
  }

  function filterAvailableBillboards(
    billboards: any[],
    _isContractExpired: (endDate: string | null) => boolean
  ) {
    return billboards.filter((billboard: any) => isAvailableForAvailableExports(billboard));
  }

  function hasActiveContractForExport(
    billboard: any,
    isContractExpired: (endDate: string | null) => boolean
  ): boolean {
    const res = resolveBillboardAvailability(billboard, allContractsCache);
    return res.operationalStatus === 'RENTED';
  }

  function isAvailableOrUpcomingForExport(
    billboard: any,
    _fourMonthsFromNow?: Date,
    _isContractExpired?: (endDate: string | null) => boolean,
    monthsAhead: number = 4
  ): boolean {
    const res = resolveBillboardAvailability(billboard, allContractsCache, { upcomingMonthsWindow: monthsAhead });
    return res.isMarketingVisible;
  }


  // ✅ Copy available billboards to clipboard (matches Excel export columns exactly)
  const copyAvailableToClipboard = async (billboards: any[], isContractExpired: (endDate: string | null) => boolean) => {
    try {
      toast.info('جاري نسخ بيانات اللوحات المتاحة...');
      await loadActiveContractsByBillboard();
      const available = filterAvailableBillboards(billboards, isContractExpired);
      if (available.length === 0) { toast.warning('لا توجد لوحات متاحة للنسخ'); return; }
      const sorted = await sortBillboardsBySize(available);
      const headers = ['ر.م', 'اسم لوحة', 'الفئة', 'مدينة', 'البلدية', 'منطقة', 'اقرب نقطة دالة', 'ID الحجم', 'حجم', 'احداثي - GPS', 'نوع اللوحة', 'عدد الاوجه', 'الترتيب مقاس', '@IMAGE', 'image_url'];
      const rows = sorted.map((b: any, index: number) => {
        const billboardName = b.Billboard_Name || b.name || '';
        const imageFileName = billboardName ? `${billboardName}.jpg` : (b.image_name || '');
        return [
          b.ID || b.id || '', billboardName, b.Level || b.level || b.Category_Level || '',
          b.City || b.city || '', b.Municipality || b.municipality || '', b.District || b.district || '',
          b.Nearest_Landmark || b.location || '', b.size_id || '', b.Size || b.size || '',
          b.GPS_Coordinates || b.gps_coordinates || '', b.billboard_type || 'غير محدد',
          getFaceCountText(b.Faces_Count || b.faces_count || b.faces || b.Number_of_Faces || b.Faces),
          String(index + 1), imageFileName, b.Image_URL || b.image || '',
        ];
      });
      await copyDataToClipboard(headers, rows, 'لوحة متاحة');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('فشل في نسخ البيانات إلى الحافظة');
    }
  };

  // ✅ Copy all billboards to clipboard (matches Excel export)
  const copyAllToClipboard = async (billboards: any[]) => {
    try {
      toast.info('جاري نسخ جميع اللوحات...');
      await loadActiveContractsByBillboard();
      const sorted = await sortBillboardsBySize(billboards);
      const headers = ['رقم اللوحة', 'اسم اللوحة', 'المدينة', 'البلدية', 'المنطقة', 'أقرب معلم', 'المقاس', 'المستوى', 'الحالة', 'رقم العقد', 'اسم العميل', 'نوع الإعلان', 'تاريخ بداية الإيجار', 'تاريخ نهاية الإيجار', 'لوحة شراكة', 'الشركات المشاركة', 'رأس المال', 'المتبقي من رأس المال', 'إحداثيات GPS', 'عدد الأوجه', 'نوع اللوحة', 'اسم ملف الصورة', 'رابط الصورة'];
      const rows = await Promise.all(sorted.map(async (b: any) => [
        b.ID || b.id || '', b.Billboard_Name || b.name || '', b.City || b.city || '',
        b.Municipality || b.municipality || '', b.District || b.district || '',
        b.Nearest_Landmark || b.location || '', b.Size || b.size || '', b.Level || b.level || '',
        b.Status || b.status || '', b.Contract_Number || b.contractNumber || '',
        await getCurrentCustomerName(b), await getCurrentAdType(b),
        b.Rent_Start_Date || b.rent_start_date || '', b.Rent_End_Date || b.rent_end_date || '',
        b.is_partnership ? 'نعم' : 'لا',
        Array.isArray(b.partner_companies) ? b.partner_companies.join(', ') : b.partner_companies || '',
        b.capital || 0, b.capital_remaining || 0,
        b.GPS_Coordinates || b.gps_coordinates || '',
        b.Faces_Count || b.faces_count || b.faces || '', b.billboard_type || '',
        b.image_name || '', b.Image_URL || b.image || '',
      ]));
      await copyDataToClipboard(headers, rows, 'لوحة');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('فشل في نسخ البيانات إلى الحافظة');
    }
  };

  // ✅ Copy available + upcoming (4 months) to clipboard (matches Excel export)
  const copyAvailableAndUpcomingToClipboard = async (billboards: any[], isContractExpired: (endDate: string | null) => boolean, monthsAhead: number = 4) => {
    try {
      toast.info('جاري نسخ اللوحات المتاحة والقادمة...');
      await loadActiveContractsByBillboard();
      const months = Math.max(1, Math.floor(Number(monthsAhead) || 4));
      const fourMonthsFromNow = new Date();
      fourMonthsFromNow.setMonth(fourMonthsFromNow.getMonth() + months);

      const filtered = billboards.filter((billboard: any) =>
        isAvailableOrUpcomingForExport(billboard, fourMonthsFromNow, isContractExpired)
      );
      
      if (filtered.length === 0) { toast.warning('لا توجد لوحات للنسخ'); return; }
      const sorted = await sortBillboardsBySize(filtered);
      const headers = ['ر.م', 'اسم لوحة', 'مدينة', 'البلدية', 'منطقة', 'اقرب نقطة دالة', 'حجم', 'مستوى', 'احداثي - GPS', 'نوع اللوحة', 'عدد الاوجه', 'تاريخ انتهاء الإيجار', 'الحالة', 'الترتيب مقاس', '@IMAGE', 'image_url'];
      const rows = await Promise.all(sorted.map(async (b: any, index: number) => {
        const contractDates = await getContractDates(b);
        const hasActive = hasActiveContractForExport(b, isContractExpired);
        const isForcedVisible = (b.is_visible_in_available === true);
        const billboardName = b.Billboard_Name || b.name || '';
        const imageFileName = billboardName ? `${billboardName}.jpg` : (b.image_name || '');
        const endDateDisplay = isForcedVisible ? '' : (hasActive ? (contractDates.endDate || '') : '');
        return [
          b.ID || b.id || '', billboardName, b.City || b.city || '',
          b.Municipality || b.municipality || '', b.District || b.district || '',
          b.Nearest_Landmark || b.location || '', b.Size || b.size || '', b.Level || b.level || '',
          b.GPS_Coordinates || b.gps_coordinates || '', b.billboard_type || 'غير محدد',
          getFaceCountText(b.Faces_Count || b.faces_count || b.faces || b.Number_of_Faces || b.Faces),
          endDateDisplay, isForcedVisible ? 'متاح الآن' : (hasActive ? 'ستتاح قريباً' : 'متاح الآن'),
          String(index + 1), imageFileName, b.Image_URL || b.image || '',
        ];
      }));
      await copyDataToClipboard(headers, rows, 'لوحة');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('فشل في نسخ البيانات إلى الحافظة');
    }
  };

  // ✅ Copy all with end date to clipboard (matches Excel export)
  const copyAllWithEndDateToClipboard = async (billboards: any[]) => {
    try {
      toast.info('جاري نسخ اللوحات مع تاريخ الانتهاء...');
      await loadActiveContractsByBillboard();
      const active = billboards.filter((b: any) => !isExcludedBillboard(b));
      if (active.length === 0) { toast.warning('لا توجد لوحات للنسخ'); return; }
      const sorted = await sortBillboardsBySize(active);
      const headers = ['ر.م', 'اسم لوحة', 'مدينة', 'البلدية', 'منطقة', 'اقرب نقطة دالة', 'حجم', 'مستوى', 'احداثي - GPS', 'عدد الاوجه', 'تاريخ انتهاء الإيجار', 'الترتيب مقاس', '@IMAGE', 'image_url'];
      const rows = await Promise.all(sorted.map(async (b: any, index: number) => {
        const contractDates = await getContractDates(b);
        const billboardName = b.Billboard_Name || b.name || '';
        const imageFileName = billboardName ? `${billboardName}.jpg` : (b.image_name || '');
        return [
          b.ID || b.id || '', billboardName, b.City || b.city || '',
          b.Municipality || b.municipality || '', b.District || b.district || '',
          b.Nearest_Landmark || b.location || '', b.Size || b.size || '', b.Level || b.level || '',
          b.GPS_Coordinates || b.gps_coordinates || '',
          b.Faces_Count || b.faces_count || b.faces || '', contractDates.endDate || '',
          String(index + 1), imageFileName, b.Image_URL || b.image || '',
        ];
      }));
      await copyDataToClipboard(headers, rows, 'لوحة');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('فشل في نسخ البيانات إلى الحافظة');
    }
  };

  // ✅ Copy follow-up billboards to clipboard (matches Excel export)
  const copyFollowUpToClipboard = async (billboards: any[]) => {
    try {
      toast.info('جاري نسخ بيانات المتابعة...');
      await loadActiveContractsByBillboard();
      const sorted = await sortBillboardsBySize(billboards);
      const headers = ['رقم اللوحة', 'اسم اللوحة', 'المدينة', 'البلدية', 'المنطقة', 'أقرب معلم', 'المقاس', 'المستوى', 'إحداثيات GPS', 'عدد الأوجه', 'نوع اللوحة', 'اسم العميل', 'نوع الإعلان', 'تاريخ بداية العقد', 'تاريخ انتهاء العقد', 'اسم ملف الصورة', 'رابط الصورة'];
      const rows = await Promise.all(sorted.map(async (b: any) => {
        const contractDates = await getContractDates(b);
        return [
          b.ID || b.id || '', b.Billboard_Name || b.name || '', b.City || b.city || '',
          b.Municipality || b.municipality || '', b.District || b.district || '',
          b.Nearest_Landmark || b.location || '', b.Size || b.size || '', b.Level || b.level || '',
          b.GPS_Coordinates || b.gps_coordinates || '',
          b.Faces_Count || b.faces_count || b.faces || '', b.billboard_type || '',
          await getCurrentCustomerName(b), await getCurrentAdType(b),
          contractDates.startDate, contractDates.endDate,
          b.image_name || '', b.Image_URL || b.image || '',
        ];
      }));
      await copyDataToClipboard(headers, rows, 'لوحة');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('فشل في نسخ البيانات إلى الحافظة');
    }
  };

  // ✅ Upload available billboards Excel to Google Drive
  const uploadAvailableToSite = async (billboards: any[], isContractExpired: (endDate: string | null) => boolean) => {
    try {
      toast.info('جاري رفع ملف اللوحات المتاحة إلى الموقع...');
      await loadActiveContractsByBillboard();
      
      const availableBillboards = filterAvailableBillboards(billboards, isContractExpired);
      if (availableBillboards.length === 0) {
        toast.warning('لا توجد لوحات متاحة للرفع');
        return;
      }

      const sortedAvailableBillboards = await sortBillboardsBySize(availableBillboards);
      const getFaceCountText = (facesCount: any): string => {
        switch (String(facesCount)) {
          case '1': return 'وجه واحد';
          case '2': return 'وجهين';
          case '3': return 'ثلاثة أوجه';
          case '4': return 'أربعة أوجه';
          default: return facesCount || 'غير محدد';
        }
      };

      const exportData = sortedAvailableBillboards.map((billboard: any, index: number) => {
        const billboardName = billboard.Billboard_Name || billboard.name || '';
        const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
        return {
          'ر.م': billboard.ID || billboard.id || '',
          'اسم لوحة': billboardName,
          'الفئة': billboard.Level || billboard.level || billboard.Category_Level || '',
          'مدينة': billboard.City || billboard.city || '',
          'البلدية': billboard.Municipality || billboard.municipality || '',
          'منطقة': billboard.District || billboard.district || '',
          'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
          'ID الحجم': billboard.size_id || '',
          'حجم': billboard.Size || billboard.size || '',
          'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
          'نوع اللوحة': billboard.billboard_type || 'غير محدد',
          'عدد الاوجه': getFaceCountText(billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Number_of_Faces || billboard.Faces),
          'الترتيب مقاس': index + 1,
          '@IMAGE': imageFileName,
          'image_url': normalizeGoogleImageUrl(billboard.Image_URL || billboard.image || '')
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 8 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 15 },
        { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 20 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'اللوحات المتاحة');

      // Add extra sheets (pricing, slides, companies)
      await addExtraSheets(wb);

      // Convert to base64
      const wbOut = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      
      const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
      const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
      const progress = createUploadProgressTracker();
      const url = await uploadFileToGoogleDrive(
        wbOut,
        'billboards.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'billboard-exports',
        true,
        progress
      );
      
      toast.success(`تم رفع ملف اللوحات المتاحة إلى الموقع بنجاح (${availableBillboards.length} لوحة)`);
      console.log('✅ Available billboards uploaded to Google Drive:', url);
    } catch (error) {
      console.error('Error uploading available billboards to site:', error);
      toast.error('فشل في رفع الملف إلى الموقع');
    }
  };

  // ✅ Upload available + upcoming billboards Excel to Google Drive
  const uploadAvailableAndUpcomingToSite = async (billboards: any[], isContractExpired: (endDate: string | null) => boolean, monthsAhead: number = 4) => {
    try {
      toast.info('جاري رفع ملف اللوحات المتاحة والقادمة إلى الموقع...');
      await loadActiveContractsByBillboard();
      
      const months = Math.max(1, Math.floor(Number(monthsAhead) || 4));
      const fourMonthsFromNow = new Date();
      fourMonthsFromNow.setMonth(fourMonthsFromNow.getMonth() + months);
      
      const filteredBillboards = billboards.filter((billboard: any) =>
        isAvailableOrUpcomingForExport(billboard, fourMonthsFromNow, isContractExpired)
      );

      if (filteredBillboards.length === 0) {
        toast.warning('لا توجد لوحات للرفع');
        return;
      }

      const sortedBillboards = await sortBillboardsBySize(filteredBillboards);
      const getFaceCountText = (facesCount: any): string => {
        switch (String(facesCount)) {
          case '1': return 'وجه واحد';
          case '2': return 'وجهين';
          case '3': return 'ثلاثة أوجه';
          case '4': return 'أربعة أوجه';
          default: return facesCount || 'غير محدد';
        }
      };

      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any, index: number) => {
          const contractDates = await getContractDates(billboard);
          const billboardName = billboard.Billboard_Name || billboard.name || '';
          const imageFileName = billboardName ? `${billboardName}.jpg` : (billboard.image_name || '');
          const hasActive = hasActiveContractForExport(billboard, isContractExpired);
          const isForcedVisible = (billboard.is_visible_in_available === true);
          const endDateDisplay = isForcedVisible ? '' : (hasActive ? (contractDates.endDate || '') : '');
          
          return {
            'ر.م': billboard.ID || billboard.id || '',
            'اسم لوحة': billboardName,
            'مدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'منطقة': billboard.District || billboard.district || '',
            'اقرب نقطة دالة': billboard.Nearest_Landmark || billboard.location || '',
            'حجم': billboard.Size || billboard.size || '',
            'مستوى': billboard.Level || billboard.level || '',
            'احداثي - GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'نوع اللوحة': billboard.billboard_type || 'غير محدد',
            'عدد الاوجه': getFaceCountText(billboard.Faces_Count || billboard.faces_count),
            'تاريخ الانتهاء': endDateDisplay,
            'الحالة': isForcedVisible ? 'متاح الآن' : (hasActive ? 'ستتاح قريباً' : 'متاح الآن'),
            'الترتيب مقاس': index + 1,
            '@IMAGE': imageFileName,
            'image_url': normalizeGoogleImageUrl(billboard.Image_URL || billboard.image || '')
          };
        })
      );

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
        { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 15 },
        { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'المتاح والقادمة');

      // Add extra sheets (pricing, slides, companies)
      await addExtraSheets(wb);

      const wbOut = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      
      const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
      const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
      const p2 = createUploadProgressTracker();
      const url = await uploadFileToGoogleDrive(
        wbOut,
        'billboards.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'billboard-exports',
        true,
        p2
      );
      
      toast.success(`تم رفع ملف اللوحات المتاحة والقادمة إلى الموقع بنجاح (${filteredBillboards.length} لوحة)`);
      console.log('✅ Available+upcoming billboards uploaded to Google Drive:', url);
    } catch (error) {
      console.error('Error uploading available+upcoming billboards to site:', error);
      toast.error('فشل في رفع الملف إلى الموقع');
    }
  };

  // ✅ Upload follow-up billboards Excel to Google Drive
  const uploadFollowUpToSite = async (billboards: any[]) => {
    try {
      toast.info('جاري رفع ملف المتابعة إلى الموقع...');
      await loadActiveContractsByBillboard();
      
      const sortedBillboards = await sortBillboardsBySize(billboards);
      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any) => {
          const contractDates = await getContractDates(billboard);
          const customerName = await getCurrentCustomerName(billboard);
          const adType = await getCurrentAdType(billboard);
          return {
            'رقم اللوحة': billboard.ID || billboard.id || '',
            'اسم اللوحة': billboard.Billboard_Name || billboard.name || '',
            'المدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'المنطقة': billboard.District || billboard.district || '',
            'أقرب معلم': billboard.Nearest_Landmark || billboard.location || '',
            'المقاس': billboard.Size || billboard.size || '',
            'المستوى': billboard.Level || billboard.level || '',
            'إحداثيات GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'عدد الأوجه': billboard.Faces_Count || billboard.faces_count || '',
            'نوع اللوحة': billboard.billboard_type || '',
            'اسم العميل': customerName,
            'نوع الإعلان': adType,
            'تاريخ بداية العقد': contractDates.startDate,
            'تاريخ انتهاء العقد': contractDates.endDate,
            'رابط الصورة': billboard.Image_URL || billboard.image || '',
          };
        })
      );

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
        { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 25 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'المتابعة');
      await addExtraSheets(wb);

      const wbOut = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
      const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
      const p3 = createUploadProgressTracker();
      const url = await uploadFileToGoogleDrive(wbOut, 'follow-up.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'billboard-exports', true, p3);
      
      toast.success(`تم رفع ملف المتابعة إلى الموقع بنجاح (${billboards.length} لوحة)`);
      console.log('✅ Follow-up billboards uploaded to Google Drive:', url);
    } catch (error) {
      console.error('Error uploading follow-up to site:', error);
      toast.error('فشل في رفع ملف المتابعة إلى الموقع');
    }
  };

  // ✅ Upload all billboards Excel to Google Drive
  const uploadAllToSite = async (billboards: any[]) => {
    try {
      toast.info('جاري رفع ملف جميع اللوحات إلى الموقع...');
      await loadActiveContractsByBillboard();
      
      const sortedBillboards = await sortBillboardsBySize(billboards);
      const exportData = await Promise.all(
        sortedBillboards.map(async (billboard: any) => {
          const contractDates = await getContractDates(billboard);
          const customerName = await getCurrentCustomerName(billboard);
          const adType = await getCurrentAdType(billboard);
          return {
            'رقم اللوحة': billboard.ID || billboard.id || '',
            'اسم اللوحة': billboard.Billboard_Name || billboard.name || '',
            'المدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'المنطقة': billboard.District || billboard.district || '',
            'أقرب معلم': billboard.Nearest_Landmark || billboard.location || '',
            'المقاس': billboard.Size || billboard.size || '',
            'المستوى': billboard.Level || billboard.level || '',
            'الحالة': billboard.Status || billboard.status || '',
            'رقم العقد': billboard.Contract_Number || billboard.contractNumber || '',
            'اسم العميل': customerName,
            'نوع الإعلان': adType,
            'تاريخ بداية الإيجار': contractDates.startDate,
            'تاريخ نهاية الإيجار': contractDates.endDate,
            'إحداثيات GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'عدد الأوجه': billboard.Faces_Count || billboard.faces_count || '',
            'نوع اللوحة': billboard.billboard_type || '',
            'رابط الصورة': billboard.Image_URL || billboard.image || '',
          };
        })
      );

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
        { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
        { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 25 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'جميع اللوحات');
      await addExtraSheets(wb);

      const wbOut = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
      const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
      const p4 = createUploadProgressTracker();
      const url = await uploadFileToGoogleDrive(wbOut, 'all-billboards.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'billboard-exports', true, p4);
      
      toast.success(`تم رفع ملف جميع اللوحات إلى الموقع بنجاح (${billboards.length} لوحة)`);
      console.log('✅ All billboards uploaded to Google Drive:', url);
    } catch (error) {
      console.error('Error uploading all billboards to site:', error);
      toast.error('فشل في رفع ملف جميع اللوحات إلى الموقع');
    }
  };

  // ✅ Export Municipality Billboards to Excel
  const exportMunicipalityToExcel = async (billboards: any[], excludeHidden: boolean, selectedMunicipality: string) => {
    try {
      toast.info('جاري تحضير ملف Excel للوحات البلدية...');
      await loadActiveContractsByBillboard();
      
      // ✅ Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(billboards);
      
      // ✅ Filter: Exclude hidden from available if excludeHidden is true & filter by municipality
      const filteredBillboards = sortedBillboards.filter((billboard: any) => {
        // Filter by municipality if not "all"
        if (selectedMunicipality && selectedMunicipality !== 'all') {
          const mVal = String(billboard.Municipality || billboard.municipality || '').trim();
          if (mVal !== selectedMunicipality.trim()) {
            return false;
          }
        }

        const isAvailable = isBillboardAvailable(billboard);
        const isHidden = (billboard.is_visible_in_available === false) || 
                         (billboard.Status === 'مخفي' || billboard.status === 'مخفي') ||
                         (billboard.maintenance_status === 'hidden' || billboard.maintenance_status === 'مخفي');
                         
        if (excludeHidden && isAvailable && isHidden) {
          return false;
        }
        return true;
      });

      if (filteredBillboards.length === 0) {
        toast.warning('لا توجد لوحات للتصدير');
        return;
      }

      // Prepare data for export
      const exportData = await Promise.all(
        filteredBillboards.map(async (billboard: any) => {
          const billboardName = billboard.Billboard_Name || billboard.name || '';
          
          return {
            'رقم اللوحة': billboard.ID || billboard.id || '',
            'اسم اللوحة': billboardName,
            'المدينة': billboard.City || billboard.city || '',
            'البلدية': billboard.Municipality || billboard.municipality || '',
            'المنطقة': billboard.District || billboard.district || '',
            'أقرب معلم': billboard.Nearest_Landmark || billboard.location || '',
            'المقاس': billboard.Size || billboard.size || '',
            'الحالة': billboard.Status || billboard.status || '',
            'إحداثيات GPS': billboard.GPS_Coordinates || billboard.gps_coordinates || '',
            'رابط صورة اللوحة': normalizeGoogleImageUrl(billboard.Image_URL || billboard.image || ''),
            'رابط صورة الإعلان (أمام)': billboard.design_face_a || '',
            'رابط صورة الإعلان (خلف)': billboard.design_face_b || ''
          };
        })
      );

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // رقم اللوحة
        { wch: 20 }, // اسم اللوحة
        { wch: 12 }, // المدينة
        { wch: 15 }, // البلدية
        { wch: 15 }, // المنطقة
        { wch: 20 }, // أقرب معلم
        { wch: 10 }, // المقاس
        { wch: 12 }, // الحالة
        { wch: 25 }, // إحداثيات GPS
        { wch: 35 }, // رابط صورة اللوحة
        { wch: 35 }, // رابط صورة الإعلان (أمام)
        { wch: 35 }  // رابط صورة الإعلان (خلف)
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'لوحات البلدية');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const mName = selectedMunicipality !== 'all' ? `${selectedMunicipality}_` : '';
      const filename = `لوحات_البلدية_${mName}${excludeHidden ? 'مستبعد_المخفي_' : ''}${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      toast.success(`تم تنزيل ملف Excel لوحات البلدية: ${filename}`);
      console.log('✅ Municipality billboards Excel exported');
    } catch (error) {
      console.error('Error exporting municipality billboards to Excel:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  return {
    exportToExcel,
    exportAvailableToExcel,
    exportMunicipalityToExcel,
    copyAvailableToClipboard,
    copyAllToClipboard,
    copyAvailableAndUpcomingToClipboard,
    copyAllWithEndDateToClipboard,
    copyFollowUpToClipboard,
    exportAllWithEndDate,
    exportAvailableAndUpcoming,
    exportFollowUpToExcel,
    exportRePhotographyToExcel,
    exportAvailableWithContracts,
    exportAvailableAndUpcomingWithContracts,
    uploadAvailableToSite,
    uploadAvailableAndUpcomingToSite,
    uploadFollowUpToSite,
    uploadAllToSite,
    // ✅ Export utility functions
    getSizeOrderFromDB,
    sortBillboardsBySize,
    getCurrentCustomerName,
    getCurrentAdType,
    getContractDates
  };
};