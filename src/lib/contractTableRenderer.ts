/**
 * Shared billboards table renderer for contract printing
 * Matches the exact rendering logic from ContractTermsSettings.tsx
 */

import { PageSectionSettings, TableColumnSettings } from '@/hooks/useContractTemplateSettings';
import { buildTableTermHtml } from '@/lib/contractTableTerm';
import { formatLongArabicDate } from '@/lib/utils';

// SVG data URI for solid color backgrounds - ensures colors print correctly
export function solidFillDataUri(fill: string): string {
  const safeFill = (fill ?? "").toString().trim() || "#000000";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="100%" height="100%" fill="${safeFill}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface BillboardRowData {
  id: string;
  billboardName?: string;
  image?: string;
  municipality?: string;
  district?: string;
  landmark?: string;
  size?: string;
  level?: string;
  faces?: string | number;
  price?: string;
  rent_end_date?: string;
  duration_days?: string;
  mapLink?: string;
  ad_type?: string;
  status?: string;
  /** Custom per-billboard report note (overrides status column when present) */
  reportNote?: string;
  /** Mark this row as a replacement billboard for the preceding paused row */
  isReplacement?: boolean;
  /** Start date for the replacement (printed under the name) */
  replacementStartDate?: string;
  /** Name of the original paused billboard being replaced */
  replacedBillboardName?: string;
}


export interface RenderTableOptions {
  settings: PageSectionSettings;
  billboards: BillboardRowData[];
  tableBgUrl: string;
  pageIndex: number;
  rowsPerPage: number;
  currencySymbol?: string;
  showTableTerm?: boolean;
  renderTarget?: 'preview' | 'pdf';
}

/**
 * Generate header cell HTML with solidFillDataUri for guaranteed color printing
 */
function renderHeaderCell(
  col: TableColumnSettings, 
  tblSettings: PageSectionSettings['tableSettings'],
  borderWidthPx: string
): string {
  const isHighlighted = (tblSettings.highlightedColumns || ['index']).includes(col.key);
  const headerBg = isHighlighted 
    ? (tblSettings.highlightedColumnBgColor || '#1a1a2e')
    : tblSettings.headerBgColor;
  const headerFg = isHighlighted 
    ? (tblSettings.highlightedColumnTextColor || '#ffffff')
    : tblSettings.headerTextColor;

  // Use column-specific padding and lineHeight if available
  const headerPadding = col.padding !== undefined ? col.padding : tblSettings.cellPadding;
  const lineHeight = col.lineHeight !== undefined ? col.lineHeight : 1.3;
  
  return `
    <th style="
      width: ${col.width}%;
      background-color: ${headerBg};
      color: ${headerFg};
      padding: ${headerPadding}px;
      border: ${borderWidthPx} solid ${tblSettings.borderColor};
      font-size: ${col.headerFontSize || tblSettings.headerFontSize}px;
      font-weight: ${tblSettings.headerFontWeight || 'bold'};
      text-align: ${tblSettings.headerTextAlign || 'center'};
      vertical-align: middle;
      line-height: ${lineHeight};
      overflow: hidden;
      position: relative;
    ">
      <img src="${solidFillDataUri(headerBg)}" alt="" aria-hidden="true" style="
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 0;
        pointer-events: none;
      " />
      <span style="position: relative; z-index: 1;">${col.label}</span>
    </th>
  `;
}

/**
 * Generate cell content based on column type
 */
function getCellContent(
  col: TableColumnSettings, 
  row: BillboardRowData, 
  globalIndex: number,
  tblSettings: PageSectionSettings['tableSettings'],
  rowHeightPx: number
): string {
  const imgHeightPx = Math.max(rowHeightPx - 6, 20);
  const qrSizePx = Math.max(rowHeightPx - 8, 20);
  
  switch (col.key) {
    case 'index':
      return String(globalIndex + 1);
    case 'code': {
      const codeVal = row.id || '';
      if (row.isReplacement) {
        const replacedName = row.replacedBillboardName || '';
        return `
          <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
            <span style="display:inline-block; background:#1d4ed8; color:#fff; font-size:9px; font-weight:bold; padding:1px 6px; border-radius:8px;">بديلة</span>
            ${replacedName ? `<span style="font-size:9px; color:#1d4ed8; font-weight:bold;">بديلة عن: ${replacedName}</span>` : ''}
            <span>${codeVal}</span>
          </div>
        `;
      }
      return codeVal;
    }
    case 'image':
      if (!row.image) return '';
      return `<img src="${row.image}" alt="صورة اللوحة" onerror="this.style.display='none'" style="
        height: ${imgHeightPx}px;
        max-height: ${imgHeightPx}px;
        width: auto;
        object-fit: contain;
        display: block;
        margin: 0 auto;
      " />`;
    case 'billboardName': {
      const baseName = row.billboardName || '';
      if (row.isReplacement) {
        const replacedName = row.replacedBillboardName || '';
        return `
          <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
            <span style="display:inline-block; background:#1d4ed8; color:#fff; font-size:9px; font-weight:bold; padding:1px 6px; border-radius:8px;">بديلة</span>
            ${replacedName ? `<span style="font-size:9px; color:#1d4ed8; font-weight:bold;">بديلة عن: ${replacedName}</span>` : ''}
            <span>${baseName}</span>
          </div>
        `;
      }
      return baseName;
    }
    case 'municipality':
      return row.municipality || '';
    case 'district':
      return row.district || '';
    case 'name':
      return row.landmark || '';
    case 'size':
      return row.size || '';
    case 'faces': {
      const value = row.faces ?? '';
      const str = String(value);
      const isNumeric = typeof value === 'number' || /^\s*\d+\s*$/.test(str);
      return isNumeric ? `<span class="num">${str}</span>` : str;
    }
    case 'price':
      return row.price || '';
    case 'endDate': {
      const formattedEndDate = formatLongArabicDate(row.rent_end_date || '');
      const formattedReplacementStartDate = formatLongArabicDate(row.replacementStartDate || '');
      if (row.isReplacement && row.replacementStartDate) {
        return `
          <div style="display:flex; flex-direction:column; align-items:center; gap:1px;">
            <span style="font-size:0.85em;">من ${formattedReplacementStartDate || row.replacementStartDate}</span>
            <span>إلى ${formattedEndDate || row.rent_end_date || ''}</span>
          </div>
        `;
      }
      return formattedEndDate || row.rent_end_date || '';
    }
    case 'durationDays':
      return row.duration_days || '';
    case 'adType':
      return row.ad_type || '';
    case 'status':
      if (row.reportNote && row.reportNote.trim()) {
        const escaped = row.reportNote.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
        return `<div style="white-space:normal; text-align:center;">${escaped}</div>`;
      }
      return row.status || '';
    case 'location':
      if (!row.mapLink) return '';
      const qrFg = (tblSettings.qrForegroundColor || '#000000').replace('#', '');
      const qrBg = (tblSettings.qrBackgroundColor || '#ffffff').replace('#', '');
      return `<a href="${row.mapLink}" target="_blank" rel="noopener" style="display:block;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(row.mapLink)}&color=${qrFg}&bgcolor=${qrBg}" 
          alt="QR Code" 
          style="width:${qrSizePx}px; height:${qrSizePx}px; object-fit:contain; display:block; margin:0 auto;" />
      </a>`;
    default:
      return '';
  }
}

/**
 * Generate data cell HTML with solidFillDataUri for highlighted columns
 */
function renderDataCell(
  col: TableColumnSettings,
  row: BillboardRowData,
  globalIndex: number,
  rowIndex: number,
  tblSettings: PageSectionSettings['tableSettings'],
  borderWidthPx: string
): string {
  const isHighlighted = (tblSettings.highlightedColumns || ['index']).includes(col.key);
  const isEven = rowIndex % 2 === 0;
  const rowBgColor = tblSettings.cellTransparent 
    ? 'transparent' 
    : (isEven ? 'white' : tblSettings.alternateRowColor);
  const cellBg = isHighlighted 
    ? (tblSettings.cellTransparent ? 'transparent' : (tblSettings.highlightedColumnBgColor || '#1a1a2e')) 
    : rowBgColor;
  const cellTextColor = isHighlighted 
    ? (tblSettings.highlightedColumnTextColor || '#ffffff') 
    : (tblSettings.cellTextColor || '#000000');
  
  const rowHeightMm = tblSettings.rowHeight || 12;
  const rowHeightPx = rowHeightMm * 3.779;
  const cellContent = getCellContent(col, row, globalIndex, tblSettings, rowHeightPx);
  const noPadding = col.key === 'image' || col.key === 'location';
  
  // Use column-specific padding and lineHeight if available
  const cellPadding = col.padding !== undefined ? col.padding : tblSettings.cellPadding;
  const lineHeight = col.lineHeight !== undefined ? col.lineHeight : 1.3;
  
  return `
    <td style="
      background-color: ${cellBg};
      color: ${cellTextColor};
      font-size: ${col.fontSize || tblSettings.fontSize}px;
      font-weight: ${tblSettings.fontWeight || 'normal'};
      text-align: ${col.textAlign || tblSettings.cellTextAlign || 'center'};
      padding: ${noPadding ? '0' : (cellPadding + 'px')};
      border: ${borderWidthPx} solid ${tblSettings.borderColor};
      vertical-align: middle;
      line-height: ${lineHeight};
      white-space: normal;
      word-break: break-word;
      overflow: hidden;
      position: relative;
    ">
      ${isHighlighted ? `<img src="${solidFillDataUri(cellBg)}" alt="" aria-hidden="true" style="
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 0;
        pointer-events: none;
      " />` : ''}
      <div style="position: relative; z-index: 1;">${cellContent}</div>
    </td>
  `;
}

/**
 * Render billboards table HTML for a single page
 * Matches the exact rendering from ContractTermsSettings.tsx preview
 */
export function renderBillboardsTablePage(options: RenderTableOptions): string {
  const { settings, billboards, tableBgUrl, pageIndex, rowsPerPage, showTableTerm = true, renderTarget = 'preview' } = options;
  const tblSettings = settings.tableSettings;
  const tableTerm = settings.tableTerm;
  const visibleColumns = tblSettings.columns.filter(col => col.visible);
  const borderWidthPx = `${Math.max((tblSettings.borderWidth ?? 1) * 0.6, 0.5)}px`;
  
  // Table term header (first page only)
  let tableTermHtml = '';
  if (pageIndex === 0 && showTableTerm && tableTerm?.visible) {
    const termFontSize = tableTerm.fontSize || 14;
    const { html: termMarkup, height: termWrapHeight } = buildTableTermHtml({
      tableTerm,
      title: tableTerm.termTitle || 'البند الثامن:',
      content: tableTerm.termContent || 'المواقع المتفق عليها بين الطرفين',
      renderTarget,
    });
    
    tableTermHtml = `
      <div style="
        position: absolute;
        top: calc(${(tblSettings.topPosition - (tableTerm.marginBottom || 8) - 12)}mm + ${tableTerm.positionY ?? 0}px);
        left: calc(50% + ${tableTerm.positionX ?? 0}px);
        transform: translateX(-50%);
        font-family: 'Doran', 'Noto Sans Arabic', sans-serif;
        font-size: ${termFontSize}px;
        color: ${tableTerm.color || '#1a1a2e'};
        direction: rtl;
        z-index: 25;
        text-align: center;
        white-space: nowrap;
        height: ${termWrapHeight}px;
      ">
        ${termMarkup}
      </div>
    `;
  }
  // Header row
  const headerRow = visibleColumns.map(col => renderHeaderCell(col, tblSettings, borderWidthPx)).join('');
  
  // Data rows
  const dataRows = billboards.map((row, rowIndex) => {
    const globalIndex = pageIndex * rowsPerPage + rowIndex;
    const cells = visibleColumns.map(col => 
      renderDataCell(col, row, globalIndex, rowIndex, tblSettings, borderWidthPx)
    ).join('');
    
    return `<tr style="min-height: ${tblSettings.rowHeight}mm; height: auto;">${cells}</tr>`;
  }).join('');
  
  const tableLeftMargin = (100 - (tblSettings.tableWidth || 90)) / 2;
  
  return `
    <div class="template-container table-page page" style="
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: visible;
    ">
      <img src="${tableBgUrl}" alt="خلفية جدول اللوحات" style="
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transform: scale(1.5);
        transform-origin: center;
        z-index: 1;
      " onerror="console.warn('Failed to load table background')" />
      ${tableTermHtml}
      <div class="table-area" style="
        position: absolute;
        top: ${tblSettings.topPosition}mm;
        left: ${tableLeftMargin}%;
        width: ${tblSettings.tableWidth}%;
        z-index: 20;
      ">
        <table class="btable" dir="rtl" style="
          width: 100%;
          border-collapse: collapse;
          border-spacing: 0;
          font-size: ${tblSettings.fontSize}px;
          font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif;
          table-layout: fixed;
          border: ${borderWidthPx} solid ${tblSettings.borderColor};
        ">
          <colgroup>
            ${visibleColumns.map(col => `<col style="width: ${col.width}%;" />`).join('')}
          </colgroup>
          <thead>
            <tr style="height: ${tblSettings.headerRowHeight}mm;">
              ${headerRow}
            </tr>
          </thead>
          <tbody>
            ${dataRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Render all billboards table pages
 */
export function renderAllBillboardsTablePages(
  billboards: BillboardRowData[],
  settings: PageSectionSettings,
  tableBgUrl: string,
  rowsPerPage?: number
): string[] {
  const actualRowsPerPage = rowsPerPage || settings.tableSettings.maxRows || 12;

  if (billboards.length === 0) {
    return [];
  }

  // Split billboards into pages
  const pages: BillboardRowData[][] = [];
  for (let i = 0; i < billboards.length; i += actualRowsPerPage) {
    pages.push(billboards.slice(i, i + actualRowsPerPage));
  }

  // Render each page
  return pages.map((pageBillboards, pageIndex) =>
    renderBillboardsTablePage({
      settings,
      billboards: pageBillboards,
      tableBgUrl,
      pageIndex,
      rowsPerPage: actualRowsPerPage,
      showTableTerm: pageIndex === 0,
    })
  );
}

// =========================
// Preview-like renderer (2480x3508) — matches ContractTermsSettings Page 2
// =========================

const MM_TO_PX = 3.779;

function renderBillboardsTablePagePreviewLike(options: RenderTableOptions): string {
  const { settings, billboards, tableBgUrl, pageIndex, rowsPerPage, showTableTerm = true, renderTarget = 'preview' } = options;
  const tblSettings = settings.tableSettings;
  const tableTerm = settings.tableTerm;
  const visibleColumns = tblSettings.columns.filter((c) => c.visible);
  const borderWidthPx = `${Math.max((tblSettings.borderWidth ?? 1) * 0.6, 0.5)}px`;

  // Title above table (first page only) — like preview
  let tableTermHtml = '';
  if (pageIndex === 0 && showTableTerm && tableTerm?.visible !== false) {
    const termFontSize = tableTerm.fontSize || 14;
    const { html: termMarkup, height: termWrapHeight } = buildTableTermHtml({
      tableTerm,
      title: tableTerm.termTitle || 'البند الثامن:',
      content: tableTerm.termContent || 'المواقع المتفق عليها بين الطرفين',
      renderTarget,
    });

    tableTermHtml = `
      <div style="
        text-align: center;
        margin-bottom: ${(tableTerm.marginBottom || 8)}px;
        font-family: 'Doran', 'Noto Sans Arabic', sans-serif;
        direction: rtl;
        position: relative;
        left: ${(tableTerm.positionX ?? 0)}px;
        top: ${(tableTerm.positionY ?? 0)}px;
        height: ${termWrapHeight}px;
      ">
        ${termMarkup}
      </div>
    `;
  }

  const headerRow = visibleColumns.map((col) => {
    const isHighlighted = (tblSettings.highlightedColumns || ['index']).includes(col.key);
    const headerBg = isHighlighted ? (tblSettings.highlightedColumnBgColor || '#1a1a2e') : tblSettings.headerBgColor;
    const headerFg = isHighlighted ? (tblSettings.highlightedColumnTextColor || '#ffffff') : tblSettings.headerTextColor;
    const headerPadding = col.padding !== undefined ? col.padding : (tblSettings.cellPadding || 2);
    const lineHeight = col.lineHeight !== undefined ? col.lineHeight : 1.3;

    return `
      <th style="
        width: ${col.width}%;
        background-color: ${headerBg};
        color: ${headerFg};
        padding: ${headerPadding}px;
        border: ${borderWidthPx} solid ${tblSettings.borderColor};
        font-size: ${(col.headerFontSize || tblSettings.headerFontSize || 11)}px;
        font-weight: ${(tblSettings.headerFontWeight || 'bold')};
        text-align: ${(tblSettings.headerTextAlign || 'center')};
        vertical-align: middle;
        line-height: ${lineHeight};
        overflow: hidden;
        position: relative;
      ">
        <img src="${solidFillDataUri(headerBg)}" alt="" aria-hidden="true" style="
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
          pointer-events: none;
        " />
        <span style="position: relative; z-index: 1;">${col.label}</span>
      </th>
    `;
  }).join('');

  const rowHeightPx = (tblSettings.rowHeight || 12) * MM_TO_PX;

  const dataRows = billboards.map((row, rowIndex) => {
    const globalIndex = pageIndex * rowsPerPage + rowIndex;
    const isEven = rowIndex % 2 === 0;
    const rowBgColor = tblSettings.cellTransparent 
      ? 'transparent' 
      : (isEven ? 'white' : tblSettings.alternateRowColor);

    const cells = visibleColumns.map((col) => {
      const isHighlighted = (tblSettings.highlightedColumns || ['index']).includes(col.key);
      const cellBg = isHighlighted 
        ? (tblSettings.cellTransparent ? 'transparent' : (tblSettings.highlightedColumnBgColor || '#1a1a2e')) 
        : rowBgColor;
      const cellTextColor = isHighlighted ? (tblSettings.highlightedColumnTextColor || '#ffffff') : (tblSettings.cellTextColor || '#000000');
      const noPadding = col.key === 'image' || col.key === 'location';
      const cellContent = getCellContent(col, row, globalIndex, tblSettings, rowHeightPx);
      const cellPadding = col.padding !== undefined ? col.padding : (tblSettings.cellPadding || 2);
      const lineHeight = col.lineHeight !== undefined ? col.lineHeight : 1.3;

      return `
        <td style="
          background-color: ${cellBg};
          color: ${cellTextColor};
          font-size: ${(col.fontSize || tblSettings.fontSize || 10)}px;
          font-weight: ${(tblSettings.fontWeight || 'normal')};
          text-align: ${(col.textAlign || tblSettings.cellTextAlign || 'center')};
          padding: ${noPadding ? '0' : `${cellPadding}px`};
          border: ${borderWidthPx} solid ${tblSettings.borderColor};
          vertical-align: middle;
          line-height: ${lineHeight};
          white-space: normal;
          word-break: break-word;
          overflow: hidden;
          position: relative;
          height: ${rowHeightPx}px;
        ">
          ${isHighlighted ? `<img src="${solidFillDataUri(cellBg)}" alt="" aria-hidden="true" style="
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 0;
            pointer-events: none;
          " />` : ''}
          <div style="position: relative; z-index: 1;">${cellContent}</div>
        </td>
      `;
    }).join('');

    return `<tr style="height: ${rowHeightPx}px;">${cells}</tr>`;
  }).join('');

  const tableLeftMargin = (100 - (tblSettings.tableWidth || 90)) / 2;

  return `
    <div class="relative bg-white overflow-hidden contract-preview-container" style="width: 2480px; height: 3508px; position: relative; background-color: #ffffff;">
      ${tableBgUrl ? `<img src="${tableBgUrl}" alt="قالب جدول اللوحات" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;" />` : ''}
      <div style="
        position: absolute;
        top: ${(tblSettings.topPosition || 0) * MM_TO_PX}px;
        left: ${tableLeftMargin}%;
        width: ${(tblSettings.tableWidth || 90)}%;
        z-index: 20;
        overflow: hidden;
      ">
        ${tableTermHtml}
        <table class="border-collapse w-full" dir="rtl" style="
          font-size: ${(tblSettings.fontSize || 8)}px;
          font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif;
          direction: rtl;
          table-layout: fixed;
          border-collapse: collapse;
          width: 100%;
          border: ${borderWidthPx} solid ${tblSettings.borderColor};
          background-color: #ffffff;
        ">
          <colgroup>
            ${visibleColumns.map((col) => `<col style="width: ${col.width}%;" />`).join('')}
          </colgroup>
          <thead>
            <tr style="height: ${((tblSettings.headerRowHeight || 14) * MM_TO_PX)}px;">${headerRow}</tr>
          </thead>
          <tbody>${dataRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * فلترة الأعمدة بناءً على توفر البيانات
 * الأعمدة الاختيارية (السعر، المدة) تخفى إذا كانت فارغة
 * لكن الأعمدة التي يضيفها المستخدم يدوياً (endDate, adType, status) تبقى مرئية
 */
function filterColumnsBasedOnData(
  columns: PageSectionSettings['tableSettings']['columns'],
  billboards: BillboardRowData[]
): PageSectionSettings['tableSettings']['columns'] {
  // فقط السعر والمدة تخفى تلقائياً - الباقي يبقى كما اختاره المستخدم
  const autoHideColumns = ['price', 'durationDays'];
  
  return columns.map(col => {
    if (!autoHideColumns.includes(col.key)) {
      return col; // العمود يبقى كما هو (بما في ذلك endDate, adType, status)
    }
    
    // التحقق من وجود بيانات في هذا العمود
    const hasData = billboards.some(b => {
      switch (col.key) {
        case 'price':
          return b.price && b.price.trim() !== '';
        case 'durationDays':
          return b.duration_days && b.duration_days.trim() !== '';
        default:
          return false;
      }
    });
    
    // إذا لم توجد بيانات، نخفي العمود
    return { ...col, visible: col.visible && hasData };
  });
}

/**
 * إعادة توزيع عرض الأعمدة بعد الفلترة
 */
function redistributeColumnWidths(
  columns: PageSectionSettings['tableSettings']['columns']
): PageSectionSettings['tableSettings']['columns'] {
  const visibleColumns = columns.filter(c => c.visible);
  const hiddenColumns = columns.filter(c => !c.visible);
  
  if (hiddenColumns.length === 0) return columns;
  
  // حساب العرض المتاح للإضافة
  const totalHiddenWidth = hiddenColumns.reduce((sum, c) => sum + c.width, 0);
  const totalVisibleWidth = visibleColumns.reduce((sum, c) => sum + c.width, 0);
  
  // توزيع العرض بالتناسب على الأعمدة المرئية
  const scaleFactor = (totalVisibleWidth + totalHiddenWidth) / totalVisibleWidth;
  
  return columns.map(col => {
    if (!col.visible) return col;
    return { ...col, width: Math.round(col.width * scaleFactor * 100) / 100 };
  });
}

export function renderAllBillboardsTablePagesPreviewLike(
  billboards: BillboardRowData[],
  settings: PageSectionSettings,
  tableBgUrl: string,
  rowsPerPage?: number,
  showTableTerm: boolean = true
): string[] {
  const actualRowsPerPage = rowsPerPage || settings.tableSettings.maxRows || 12;

  if (billboards.length === 0) return [];

  // فلترة الأعمدة بناءً على توفر البيانات وإعادة توزيع العرض
  const filteredColumns = filterColumnsBasedOnData(settings.tableSettings.columns, billboards);
  const adjustedColumns = redistributeColumnWidths(filteredColumns);
  
  // إنشاء نسخة معدلة من الإعدادات
  const adjustedSettings: PageSectionSettings = {
    ...settings,
    tableSettings: {
      ...settings.tableSettings,
      columns: adjustedColumns
    }
  };

  const pages: BillboardRowData[][] = [];
  for (let i = 0; i < billboards.length; i += actualRowsPerPage) {
    pages.push(billboards.slice(i, i + actualRowsPerPage));
  }

  return pages.map((pageBillboards, pageIndex) =>
    renderBillboardsTablePagePreviewLike({
      settings: adjustedSettings,
      billboards: pageBillboards,
      tableBgUrl,
      pageIndex,
      rowsPerPage: actualRowsPerPage,
      showTableTerm: showTableTerm && pageIndex === 0,
    })
  );
}

/**
 * Inject a custom title block above the table on the first page only.
 * Used by the "Report" print mode in BillboardSelectionBar.
 */
export function injectReportTitleOnFirstPage(pages: string[], customTitle?: string): string[] {
  if (!customTitle || !customTitle.trim() || pages.length === 0) return pages;
  const safe = customTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const titleHtml = `
    <div style="
      position: absolute;
      top: 60px;
      left: 5%;
      width: 90%;
      z-index: 25;
      text-align: center;
      direction: rtl;
      font-family: 'Doran', 'Noto Sans Arabic', sans-serif;
      font-size: 56px;
      font-weight: 900;
      color: #1a1a2e;
      padding: 18px 24px;
      border-bottom: 3px solid #c9a84c;
      background: rgba(255,255,255,0.85);
      border-radius: 12px;
    ">${safe}</div>
  `;
  return pages.map((html, i) => {
    if (i !== 0) return html;
    return html.replace(/<div[^>]*class="[^"]*contract-preview-container[^"]*"[^>]*>/, (m) => `${m}${titleHtml}`);
  });
}


