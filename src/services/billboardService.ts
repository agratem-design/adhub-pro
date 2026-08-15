// @ts-nocheck
import * as XLSX from 'xlsx';
import { Billboard } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { isBillboardAvailable } from '@/utils/contractUtils';

// Placeholder images for billboards when no image URL is provided
const PLACEHOLDER_IMAGES = [
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%236366f1" width="400" height="300"/><text x="200" y="150" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">Billboard Highway</text></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%2308b981" width="400" height="300"/><text x="200" y="150" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">Billboard City</text></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%230ea5e9" width="400" height="300"/><text x="200" y="150" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">Billboard Coastal</text></svg>'
];

// تطبيع أحجام اللوحات لتكون متوافقة مع مفاتيح التسعير
const normalizeBillboardSize = (size: string): string => {
  if (!size) return '4x12';

  const raw = size.toString().trim();

  // إذا كان النص لا يحتوي على أرقام (مثل "سوسيت") نُرجعه كما هو
  if (!/\d/.test(raw)) {
    return raw;
  }

  // Match dimensions with optional suffix: "2.5X4", "3X8-T", "12x4", "3X6 -4F"
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return raw;

  const a = parseFloat(match[1]);
  const b = parseFloat(match[2]);
  const suffix = match[3] ? match[3].trim() : '';

  // Smaller dimension first for consistency
  const [small, large] = a <= b ? [a, b] : [b, a];
  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toString();
  const base = `${fmt(small)}x${fmt(large)}`;
  if (!suffix) return base;
  const cleanSuffix = suffix.startsWith('-') ? suffix : `-${suffix}`;
  return `${base}${cleanSuffix}`;
};

function parseDateFlexible(input: string): Date | null {
  if (!input) return null;
  const s = input.trim();
  // ISO like 2025-01-31
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  // DD-MM-YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const y = parseInt(m[3], 10);
    if (!Number.isNaN(d) && !Number.isNaN(mo) && !Number.isNaN(y)) {
      return new Date(y, mo, d);
    }
  }
  return null;
}

function normalizeStatus(input: string | null | undefined): Billboard['status'] {
  if (!input) return 'available';
  const s = String(input).trim().toLowerCase();
  if (['available', 'متاح'].includes(s)) return 'available';
  if (['rented', 'مؤجر', 'مؤجرة', 'محجوز'].includes(s)) return 'rented';
  if (['maintenance', 'صيانة'].includes(s)) return 'maintenance';
  return 'available';
}

// معالجة بيانات اللوحة من Supabase
function processBillboardFromSupabase(row: any, index: number): Billboard {
  const id = row['ID'] ?? row['id'] ?? row['Id'] ?? `billboard-${index + 1}`;
  const name = row['Billboard_Name'] ?? row['name'] ?? row['لوحة'] ?? `لوحة ${index + 1}`;
  const location = row['Nearest_Landmark'] ?? row['District'] ?? row['Municipality'] ?? row['City'] ?? '';
  const municipality = row['Municipality'] ?? row['municipality'] ?? '';
  const district = row['District'] ?? row['district'] ?? '';
  const city = row['City'] ?? row['city'] ?? 'طرابلس';
  const rawSize = row['Size'] ?? row['المقاس مع الدغاية'] ?? row['Order_Size'] ?? '12X4';
  const size = normalizeBillboardSize(rawSize);
  const sizeId = row['size_id'] ?? row['Size_ID'] ?? null;
  const coordinates = row['GPS_Coordinates'] ?? row['GPS'] ?? '';
  const level = row['Level'] ?? row['Category_Level'] ?? 'A';
  const status = normalizeStatus(row['Status']);
  const contractNumber = row['Contract_Number'] ?? '';
  const clientName = row['Customer_Name'] ?? '';
  const expiryDate = row['Rent_End_Date'] ?? '';
  const adType = row['Ad_Type'] ?? '';
  const daysCount = row['Days_Count'];
  const friendCompanyId = row['friend_company_id'] ?? row['friend_company'] ?? null;
  const friendCompanies = row['friend_companies'] ?? null;
  
  // Partnership data
  const isPartnership = row['is_partnership'] === true;
  const partnerCompanies = row['partner_companies'] ?? [];
  const capital = Number(row['capital']) || 0;
  const capitalRemaining = Number(row['capital_remaining'] ?? row['capital']) || 0;

  let nearExpiry = false;
  let remainingDays: number | undefined = undefined;
  let finalStatus = status;

  if (expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = parseDateFlexible(expiryDate) || new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    remainingDays = Number.isFinite(diffDays) ? diffDays : undefined;
    if (typeof remainingDays === 'number' && remainingDays <= 20 && remainingDays > 0) {
      nearExpiry = true;
    }
    if (typeof remainingDays === 'number' && remainingDays <= 0) {
      // Contract expired — mark as available
      finalStatus = 'available';
      remainingDays = 0;
    } else if (typeof remainingDays === 'number' && remainingDays > 0 && contractNumber) {
      // Contract still active — mark as rented regardless of Status field
      finalStatus = 'rented';
    }
  } else if (typeof daysCount === 'number') {
    remainingDays = daysCount;
    if (remainingDays <= 20 && remainingDays > 0) nearExpiry = true;
  }

  let imageUrl = row['Image_URL'] ?? row['@IMAGE'] ?? '';
  if (!imageUrl) {
    imageUrl = PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length];
  }

  const gpsLink = row['GPS_Link'] ?? row['GPS_Link_Click'] ?? (coordinates ? `https://www.google.com/maps?q=${coordinates}` : undefined);

  const priceRaw = row['Price'] ?? row['price'];
  const price = typeof priceRaw === 'number' ? priceRaw : parseInt(String(priceRaw || '').replace(/[^\d]/g, ''), 10) || 3000;
  const installationPrice = Math.round(price * 0.2);

  return {
    // Legacy fields required by Billboard interface
    ID: Number(id),
    Billboard_Name: String(name),
    City: String(city),
    District: String(district || ''),
    Size: size,
    size_id: sizeId,
    Size_ID: sizeId,
    Status: finalStatus,
    Price: String(price),
    Level: String(row['Level'] || 'standard'),
    Image_URL: String(row['Image_URL'] || row['@IMAGE'] || ''),
    GPS_Coordinates: String(coordinates || ''),
    GPS_Link: gpsLink || '',
    Nearest_Landmark: String(location),
    Faces_Count: String(row['Faces_Count'] || '1'),
    Municipality: String(municipality || ''),
    Contract_Number: contractNumber || null,
    Rent_Start_Date: row['Rent_Start_Date'] || null,
    Rent_End_Date: expiryDate || null,
    rent_end_date: expiryDate || null,
    Customer_Name: clientName || null,
    Ad_Type: adType || null,
    friend_company_id: friendCompanyId,
    friend_companies: friendCompanies,
    
    // Visibility
    is_visible_in_available: row['is_visible_in_available'] ?? null,
    
    // App-level normalized fields
    id: String(id),
    name: String(name),
    location: String(location),
    size,
    price,
    installationPrice,
    status: finalStatus,
    city: String(city),
    district: String(district || ''),
    municipality: String(municipality || ''),
    coordinates: String(coordinates || ''),
    description: `لوحة إعلانية ${size} في ${municipality || location}`,
    image: imageUrl,
    contractNumber: contractNumber || undefined,
    clientName: clientName || undefined,
    expiryDate: expiryDate || undefined,
    rentEndDate: expiryDate || undefined,
    nearExpiry,
    remainingDays,
    adType: adType || undefined,
    level: String(level),
    // Partnership data
    is_partnership: isPartnership,
    partner_companies: partnerCompanies,
    capital: capital,
    capital_remaining: capitalRemaining,
  };
}

export async function loadBillboards(): Promise<Billboard[]> {
  try {
    const { data: rows, error: dbError } = await supabase
      .from('billboards')
      .select('*')
      .order('ID', { ascending: true });

    if (!dbError && Array.isArray(rows) && rows.length > 0) {
      return rows.map((row: any, index: number) => processBillboardFromSupabase(row, index));
    }

    if (dbError) {
      console.warn('[Service] تعذر جلب اللوحات من Supabase:', dbError.message);
    } else {
      console.log('[Service] جدول billboards فارغ');
    }

    return [];

  } catch (error) {
    console.error('[Service] خطأ في تحميل البيانات من Supabase:', error);
    return [];
  }
}

export function getAvailableBillboards(billboards: Billboard[]): Billboard[] {
  return billboards.filter(b => isBillboardAvailable(b));
}

export function getBillboardsByCity(billboards: Billboard[], city: string): Billboard[] {
  return billboards.filter(b => b.city === city);
}

import { normalizeArabic, queryTokens } from '@/lib/utils';

export function searchBillboards(billboards: Billboard[], query: string): Billboard[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return billboards;
  return billboards.filter((b) => {
    const parts = [
      (b as any).Billboard_Name,
      b.name,
      (b as any).Nearest_Landmark,
      b.location,
      (b as any).Municipality,
      b.municipality,
      (b as any).District,
      b.district,
      (b as any).City,
      b.city,
      b.size,
      b.level,
      b.id,
      b.contractNumber,
      b.clientName,
      b.adType,
    ].filter(Boolean) as Array<string | number>;
    const haystack = normalizeArabic(parts.join(' '));
    return tokens.every((t) => haystack.includes(t));
  });
}

// Sync available billboards to Google Sheets
export async function syncAvailableBillboardsToGoogleSheets(
  billboards: Billboard[],
  isContractExpired: (endDate: string | null) => boolean
): Promise<void> {
  try {
    // Get the Google Sheets URL from settings
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'google_sheets_url')
      .maybeSingle();

    if (settingsError || !settings?.setting_value) {
      throw new Error('لم يتم تكوين رابط Google Sheets. يرجى تحديثه في إعدادات النظام.');
    }

    // Filter available billboards
    const availableBillboards = billboards.filter((billboard: Billboard) => isBillboardAvailable(billboard));

    if (availableBillboards.length === 0) {
      throw new Error('لا توجد لوحات متاحة للمزامنة');
    }

    // Prepare data for Google Sheets in CSV format
    const headers = ['ر.م', 'اسم لوحة', 'مدينة', 'البلدية', 'منطقة', 'اقرب نقطة دالة', 'حجم', 'مستوى', 'احداثي - GPS', 'عدد الاوجه', '@IMAGE', 'image_url'];
    
    const rows = availableBillboards.map((billboard: Billboard, index: number) => {
      const billboardName = (billboard as any).Billboard_Name || billboard.name || '';
      const imageFileName = billboardName ? `${billboardName}.jpg` : ((billboard as any).image_name || '');
      
      return [
        (billboard as any).ID || billboard.id || '',
        billboardName,
        (billboard as any).City || billboard.city || '',
        (billboard as any).Municipality || billboard.municipality || '',
        (billboard as any).District || billboard.district || '',
        (billboard as any).Nearest_Landmark || billboard.location || '',
        (billboard as any).Size || billboard.size || '',
        (billboard as any).Level || billboard.level || '',
        (billboard as any).GPS_Coordinates || billboard.coordinates || '',
        (billboard as any).Faces_Count || '1',
        imageFileName,
        (billboard as any).Image_URL || billboard.image || ''
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const webhookUrl = settings?.setting_value?.trim();
    if (webhookUrl && (webhookUrl.startsWith('http://') || webhookUrl.startsWith('https://'))) {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_billboards',
          total: availableBillboards.length,
          csv: csvContent,
          rows: rows,
        }),
      });
      if (!response.ok) {
        throw new Error(`فشلت المزامنة مع Webhook Google Sheets (رمز الاستجابة: ${response.status})`);
      }
      return;
    }

    throw new Error('لم يتم إعداد رابط Webhook لخدمة Google Sheets في إعدادات النظام. يرجى استخدام زر "تصدير المتاح Excel" كبديل ممتاز.');
  } catch (error: any) {
    console.error('Error syncing to Google Sheets:', error);
    throw error;
  }
}
