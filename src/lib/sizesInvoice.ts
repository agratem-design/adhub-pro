import { renderToStaticMarkup } from 'react-dom/server';
import { renderSizesInvoiceTable } from '@/components/print-design/SizesInvoiceTable';
import { DEFAULT_PRINT_SETTINGS, type PrintSettings } from '@/types/print-settings';
import { DOCUMENT_TYPES } from '@/types/document-types';
import { mapPrintSettingsToInvoiceStyles } from '@/utils/invoicePrintSettingsBridge';
import { resolveInvoiceStyles, formatDateForPrint } from '@/lib/unifiedInvoiceBase';
import { createMeasurementsConfigFromSettings, generateMeasurementsHTML } from '@/lib/printMeasurements';

export interface SizeItem { sizeName: string; widthMeters: number; heightMeters: number; actualWidth?: number; actualHeight?: number; facesCount: number; quantity: number; areaPerFace: number; totalArea: number; sortOrder: number }
export type SizeDimensions = Record<string, { width: number; height: number; print_size?: string | null; sort_order?: number | null }>;
const normalizeSize = (value: unknown) => String(value ?? '').normalize('NFKC').replace(/[٠-٩]/g, char => String('٠١٢٣٤٥٦٧٨٩'.indexOf(char))).replace(/[۰-۹]/g, char => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(char))).replace(/[xX*×]/g, '×').replace(/\s/g, '').toLowerCase();
const parseDimensions = (val: unknown): { width: number; height: number } | null => {
  if (!val || typeof val !== 'string') return null;
  const match = normalizeSize(val).match(/(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const w = parseFloat(match[1]);
  const h = parseFloat(match[2]);
  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null;
  return { width: w, height: h };
};
const idsFrom = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String); } catch {}
  return value.split(',').map(id => id.trim()).filter(Boolean);
};

export function prepareSizesInvoiceContracts(contracts: any[]) {
  const billboards: any[] = [];
  const names = new Set<string>();
  const contractNumbers: string[] = [];
  contracts.forEach(contract => {
    contractNumbers.push(String(contract.Contract_Number ?? contract.id));
    const name = contract.customer_name || contract['Customer Name'];
    if (name) names.add(name);
    const single = new Set(idsFrom(contract.single_face_billboards));
    (contract.billboards || []).forEach((billboard: any) => {
      const id = String(billboard.ID ?? billboard.id);
      billboards.push(single.has(id) ? { ...billboard, Faces_Count: 1, faces_count: 1 } : billboard);
    });
  });
  return { billboards, contractNumbers, customerName: Array.from(names).join('، ') || 'العقود المختارة' };
}

export function summarizeSizesInvoice(billboards: any[], dimensions: SizeDimensions) {
  const normalized = new Map(Object.entries(dimensions).map(([name, size]) => [normalizeSize(name), size]));
  const groups = new Map<string, SizeItem>();
  const missingSizes = new Set<string>();
  billboards.forEach(billboard => {
    const sizeName = String(billboard.Size || billboard.size || 'غير محدد');
    const rawFaces = Number(billboard.Faces_Count ?? billboard.faces_count ?? billboard.Faces ?? billboard.faces ?? 1);
    const facesCount = Number.isFinite(rawFaces) && rawFaces > 0 ? Math.max(1, Math.floor(rawFaces)) : 1;

    const stored = normalized.get(normalizeSize(sizeName));

    // 1. المقاس الفعلي لكل مقاس (الحساب المالي والمساحي يتم على المقاس الفعلي للإعلان)
    let actualWidth = Number(stored?.width) > 0
      ? Number(stored!.width)
      : (Number(billboard.Width ?? billboard.width) > 0 ? Number(billboard.Width ?? billboard.width) : 0);
    let actualHeight = Number(stored?.height) > 0
      ? Number(stored!.height)
      : (Number(billboard.Height ?? billboard.height) > 0 ? Number(billboard.Height ?? billboard.height) : 0);

    if (!actualWidth || !actualHeight) {
      const parsedActual = parseDimensions(sizeName);
      if (parsedActual) {
        actualWidth = parsedActual.width;
        actualHeight = parsedActual.height;
      } else if (sizeName.includes('سوسيت') || sizeName.toLowerCase().includes('sucette')) {
        actualWidth = 1.0;
        actualHeight = 2.0;
      }
    }

    // 2. أبعاد مقاس الطباعة لعرضها في عامودي العرض والارتفاع المطلوبين للإنتاج
    const billboardPrint = parseDimensions(billboard.print_size);
    const storedPrint = parseDimensions(stored?.print_size);

    let widthMeters = 0;
    let heightMeters = 0;

    if (billboardPrint) {
      widthMeters = billboardPrint.width;
      heightMeters = billboardPrint.height;
    } else if (storedPrint) {
      widthMeters = storedPrint.width;
      heightMeters = storedPrint.height;
    } else if (actualWidth > 0 && actualHeight > 0) {
      widthMeters = actualWidth;
      heightMeters = actualHeight;
    }

    if (!actualWidth || !actualHeight) {
      actualWidth = widthMeters;
      actualHeight = heightMeters;
    }

    if (!widthMeters || !heightMeters || !actualWidth || !actualHeight) {
      missingSizes.add(sizeName);
    }

    let sortOrder = typeof billboard.sort_order === 'number'
      ? billboard.sort_order
      : (typeof stored?.sort_order === 'number' ? stored.sort_order : 999);

    if (sortOrder === 999) {
      for (const [, dim] of normalized.entries()) {
        if (dim.width === widthMeters && dim.height === heightMeters && typeof dim.sort_order === 'number') {
          sortOrder = dim.sort_order;
          break;
        }
      }
    }

    // حساب المساحة على المقاس الفعلي
    const areaPerFace = actualWidth * actualHeight;
    const key = JSON.stringify([normalizeSize(sizeName), facesCount, widthMeters, heightMeters, areaPerFace]);
    const group = groups.get(key) || {
      sizeName,
      widthMeters,
      heightMeters,
      actualWidth,
      actualHeight,
      facesCount,
      quantity: 0,
      areaPerFace,
      totalArea: 0,
      sortOrder
    };
    group.quantity += 1;
    group.totalArea = group.areaPerFace * group.facesCount * group.quantity;
    groups.set(key, group);
  });
  const items = Array.from(groups.values()).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    if (a.facesCount !== b.facesCount) {
      return a.facesCount - b.facesCount;
    }
    return b.quantity - a.quantity || a.sizeName.localeCompare(b.sizeName, 'ar');
  });
  return { items, totalBillboards: billboards.length, totalArea: items.reduce((sum, item) => sum + item.totalArea, 0), missingSizes: Array.from(missingSizes) };
}

export async function buildSizesInvoiceHTML(settings: Partial<PrintSettings>, options: { billboards: any[]; dimensions: SizeDimensions; customerName: string; contractNumbers: string[]; separateFaces?: boolean; date?: string }): Promise<string> {
  const full = { ...DEFAULT_PRINT_SETTINGS, ...settings, document_type: DOCUMENT_TYPES.MEASUREMENTS_INVOICE };
  const rawTitleAr = full.document_title_ar?.trim();
  const resolvedTitleAr = (!rawTitleAr || rawTitleAr === 'كشف الحساب' || rawTitleAr === 'كشف حساب' || rawTitleAr === 'كشف المقاسات' || rawTitleAr === 'فاتورة المقاسات')
    ? 'كشف مقاسات الطباعة'
    : rawTitleAr;
  const resolvedTitleEn = full.document_title_en?.trim() || 'SIZES STATEMENT';
  const fullWithResolvedTitles = {
    ...full,
    document_title_ar: resolvedTitleAr,
    document_title_en: resolvedTitleEn,
  };
  const t = await resolveInvoiceStyles('sizes_invoice', { titleAr: resolvedTitleAr, titleEn: resolvedTitleEn }, mapPrintSettingsToInvoiceStyles(fullWithResolvedTitles));
  const summary = summarizeSizesInvoice(options.billboards, options.dimensions);
  const groups = options.separateFaces === false ? [{ title: 'مقاسات الطباعة', items: summary.items }] : [
    { title: 'مقاسات الطباعة (وجه واحد)', items: summary.items.filter(item => item.facesCount === 1) },
    { title: 'مقاسات الطباعة (متعدد الأوجه)', items: summary.items.filter(item => item.facesCount > 1) },
  ].filter(group => group.items.length);
  const tokens = { primaryColor: t.primaryColor, secondaryColor: t.secondaryColor, headerFontSize: t.headerFontSize, bodyFontSize: t.bodyFontSize, tableText: t.tableText, tableHeaderBg: t.tableHeaderBg, tableHeaderText: t.tableHeaderText, tableBorder: t.tableBorder, tableRowEven: t.tableRowEven, tableRowOdd: t.tableRowOdd, tableRowOpacity: t.tableRowOpacity / 100, subtotalText: t.subtotalText, subtotalBg: t.subtotalBg, totalBg: t.totalBg, totalText: t.totalText, totalBillboards: summary.totalBillboards, totalArea: summary.totalArea, hasMissingSizes: summary.missingSizes.length > 0, sizesSettings: { showDimensions: true, showFacesCount: true, showAreaPerFace: true, showTotalArea: true }, individual: { showTotalsSection: true } };
  const tables = groups.map((group, index) => renderToStaticMarkup(renderSizesInvoiceTable(group.items, group.title, index === groups.length - 1, tokens))).join('');
  const notes = summary.missingSizes.length ? `تعذّر تحديد أبعاد المقاسات: ${summary.missingSizes.join('، ')}. إجمالي المساحة محسوب للمقاسات المعروفة فقط.` : '';
  const config = createMeasurementsConfigFromSettings(fullWithResolvedTitles);
  if (config.officialStyles) config.officialStyles.invoiceTitleEn = t.invoiceTitleEn || resolvedTitleEn;
  if (notes) config.notes.enabled = true;
  const finalTitleAr = (!t.invoiceTitleAr || t.invoiceTitleAr === 'كشف الحساب' || t.invoiceTitleAr === 'كشف حساب' || t.invoiceTitleAr === 'كشف المقاسات' || t.invoiceTitleAr === 'فاتورة المقاسات')
    ? resolvedTitleAr
    : t.invoiceTitleAr;
  return generateMeasurementsHTML({ config, documentData: { title: finalTitleAr, date: formatDateForPrint(options.date || new Date().toISOString(), t.showHijriDate), additionalInfo: [{ label: 'أرقام العقود', value: options.contractNumbers.join('، ') }] }, partyData: { title: 'العميل', name: options.customerName }, statisticsCards: [{ label: 'لوحة', value: summary.totalBillboards, unit: '' }], columns: [], rows: [], notes, headerSwap: full.header_swap }).replace(/<table class="measurements-table">[\s\S]*?<\/table>/, tables);
}
