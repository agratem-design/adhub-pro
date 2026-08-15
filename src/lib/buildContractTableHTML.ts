import { 
  PageSectionSettings, 
  DEFAULT_SECTION_SETTINGS,
  TableColumnSettings
} from '@/hooks/useContractTemplateSettings';

interface BillboardData {
  id?: number | string;
  ID?: number;
  code?: string;
  Billboard_Name?: string;
  billboardName?: string;
  Municipality?: string;
  municipality?: string;
  District?: string;
  district?: string;
  Nearest_Landmark?: string;
  nearest_landmark?: string;
  name?: string;
  location?: string;
  Size?: string;
  size?: string;
  Faces_Count?: number;
  faces?: number;
  Price?: number;
  price?: number;
  contractPrice?: number;
  Image_URL?: string;
  image?: string;
  GPS_Coordinates?: string;
  coords?: string;
  GPS_Link?: string;
  gpsLink?: string;
}

interface BuildTableHTMLOptions {
  settings: PageSectionSettings;
  billboards: BillboardData[];
  backgroundUrl?: string;
  currencySymbol?: string;
  showHeader?: boolean;
  billboardPrices?: Record<string, number>;
}

// دالة لتحويل الأبعاد من mm إلى px للطباعة
const mmToPx = (mm: number): number => mm * 3.779528;

// دالة لتنسيق الأرقام بالعربية
const formatNumber = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const rounded = Math.round(Number(num) * 10) / 10;
  const [integerPart, decimalPart = '0'] = rounded.toString().split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${formattedInteger}.${decimalPart}`;
};

// دالة لاستخراج قيمة من كائن اللوحة
const getBillboardValue = (billboard: BillboardData, key: string): string => {
  switch (key) {
    case 'index':
      return ''; // سيتم ملؤها لاحقًا
    case 'image':
      return billboard.Image_URL || billboard.image || '';
    case 'code':
      return billboard.code || `TR-${String(billboard.ID || billboard.id || '').padStart(4, '0')}`;
    case 'billboardName':
      return billboard.Billboard_Name || billboard.billboardName || '';
    case 'municipality':
      return billboard.Municipality || billboard.municipality || '';
    case 'district':
      return billboard.District || billboard.district || '';
    case 'name':
    case 'location':
      return billboard.Nearest_Landmark || billboard.nearest_landmark || billboard.name || billboard.location || '';
    case 'size':
      return billboard.Size || billboard.size || '';
    case 'faces':
      return String(billboard.Faces_Count || billboard.faces || 2);
    case 'price':
      return ''; // سيتم حسابها لاحقًا
    default:
      return '';
  }
};

// دالة لبناء رأس الجدول
const buildTableHeader = (columns: TableColumnSettings[], settings: PageSectionSettings): string => {
  const visibleColumns = columns.filter(col => col.visible);
  const tableSettings = settings.tableSettings;
  
  return `
    <thead>
      <tr style="
        background: ${tableSettings.headerBgColor};
        height: ${tableSettings.headerRowHeight}mm;
      ">
        ${visibleColumns.map(col => `
          <th style="
            width: ${col.width}%;
            color: ${tableSettings.headerTextColor};
            font-size: ${col.headerFontSize || tableSettings.headerFontSize}px;
            font-weight: ${tableSettings.headerFontWeight};
            text-align: ${col.textAlign || tableSettings.headerTextAlign};
            border: 0.3mm solid ${tableSettings.borderColor};
            padding: ${tableSettings.cellPadding}mm;
          ">${col.label}</th>
        `).join('')}
      </tr>
    </thead>
  `;
};

// دالة لبناء صف اللوحة
const buildBillboardRow = (
  billboard: BillboardData, 
  index: number, 
  columns: TableColumnSettings[], 
  settings: PageSectionSettings,
  currencySymbol: string,
  billboardPrices?: Record<string, number>
): string => {
  const visibleColumns = columns.filter(col => col.visible);
  const tableSettings = settings.tableSettings;
  const isEven = index % 2 === 0;
  const rowBgColor = isEven ? tableSettings.alternateRowColor : '#ffffff';
  
  // حساب السعر
  const billboardId = String(billboard.ID || billboard.id || '');
  let price = billboard.contractPrice || billboard.Price || billboard.price || 0;
  if (billboardPrices && billboardPrices[billboardId]) {
    price = billboardPrices[billboardId];
  }
  
  // استخراج GPS
  let gpsCoords = billboard.GPS_Coordinates || billboard.coords || '';
  const gpsLink = billboard.GPS_Link || billboard.gpsLink || '';
  
  return `
    <tr style="
      height: ${tableSettings.rowHeight}mm;
      background: ${rowBgColor};
    ">
      ${visibleColumns.map(col => {
        const isHighlighted = tableSettings.highlightedColumns?.includes(col.key);
        const cellBgColor = isHighlighted ? tableSettings.highlightedColumnBgColor : rowBgColor;
        const cellTextColor = isHighlighted ? tableSettings.highlightedColumnTextColor : tableSettings.cellTextColor;
        
        let cellContent = '';
        
        switch (col.key) {
          case 'index':
            cellContent = String(index + 1);
            break;
          case 'image':
            const imageUrl = billboard.Image_URL || billboard.image || '';
            cellContent = imageUrl ? `<img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : '';
            break;
          case 'price':
            cellContent = `${formatNumber(price)} ${currencySymbol}`;
            break;
          case 'location':
            if (gpsLink || gpsCoords) {
              const href = gpsLink || `https://www.google.com/maps?q=${gpsCoords}`;
              cellContent = `<a href="${href}" target="_blank" style="color: #004aad; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></a>`;
            }
            break;
          default:
            cellContent = getBillboardValue(billboard, col.key);
        }
        
        return `
          <td style="
            background: ${cellBgColor};
            color: ${cellTextColor};
            font-size: ${col.fontSize || tableSettings.fontSize}px;
            text-align: ${col.textAlign || tableSettings.cellTextAlign};
            border: 0.3mm solid ${tableSettings.borderColor};
            padding: ${tableSettings.cellPadding}mm;
            vertical-align: middle;
          ">${cellContent}</td>
        `;
      }).join('')}
    </tr>
  `;
};

// دالة لبناء عنوان البند
const buildTableTermHeader = (settings: PageSectionSettings): string => {
  const tableTerm = settings.tableTerm;
  if (!tableTerm?.visible) return '';
  
  const goldLine = tableTerm.goldLine;
  const goldLineStyle = goldLine?.visible ? `
    position: relative;
  ` : '';
  
  const goldLineHtml = goldLine?.visible ? `
    <span style="
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      height: ${goldLine.heightPercent}%;
      background-color: ${goldLine.color};
      border-radius: 2px;
      z-index: 0;
    "></span>
  ` : '';
  
  return `
    <div style="
      text-align: center;
      margin-bottom: ${tableTerm.marginBottom}mm;
      font-family: Doran, sans-serif;
      direction: rtl;
      position: relative;
      left: ${tableTerm.positionX}px;
      top: ${tableTerm.positionY}px;
    ">
      <h2 style="
        font-size: ${tableTerm.fontSize}px;
        color: ${tableTerm.color};
        margin: 0;
        display: inline-block;
      ">
        <span style="
          font-weight: ${tableTerm.titleFontWeight};
          position: relative;
          display: inline-block;
          ${goldLineStyle}
        ">
          ${goldLineHtml}
          <span style="position: relative; z-index: 1;">${tableTerm.termTitle}</span>
        </span>
        <span style="font-weight: ${tableTerm.contentFontWeight};">
          ${tableTerm.termContent}
        </span>
      </h2>
    </div>
  `;
};

// الدالة الرئيسية لبناء HTML الجدول
export function buildBillboardsTableHTML(options: BuildTableHTMLOptions): string {
  const { 
    settings, 
    billboards, 
    backgroundUrl = '/bgc2.svg',
    currencySymbol = 'د.ل',
    showHeader = true,
    billboardPrices
  } = options;
  
  const tableSettings = settings.tableSettings;
  const columns = tableSettings.columns || [];
  
  // بناء صفوف اللوحات
  const billboardRows = billboards.map((billboard, index) => 
    buildBillboardRow(billboard, index, columns, settings, currencySymbol, billboardPrices)
  ).join('');
  
  return `
    <div class="template-container page" style="
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
    ">
      <img 
        src="${backgroundUrl}" 
        alt="خلفية جدول اللوحات" 
        style="
          position: absolute;
          top: 0;
          left: 0;
          width: 210mm;
          height: 297mm;
          object-fit: cover;
          z-index: 1;
        "
      />
      
      <div style="
        position: absolute;
        top: ${tableSettings.topPosition}mm;
        left: ${(100 - tableSettings.tableWidth) / 2}%;
        width: ${tableSettings.tableWidth}%;
        z-index: 20;
      ">
        ${showHeader ? buildTableTermHeader(settings) : ''}
        
        <table style="
          width: 100%;
          border-collapse: collapse;
          font-family: Doran, sans-serif;
          direction: rtl;
          table-layout: fixed;
          font-size: ${tableSettings.fontSize}px;
        ">
          ${buildTableHeader(columns, settings)}
          <tbody>
            ${billboardRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// دالة لبناء CSS للجدول (للاستخدام في الطباعة)
export function buildTableStyles(settings: PageSectionSettings): string {
  const tableSettings = settings.tableSettings;
  
  return `
    .table-area {
      position: absolute;
      top: ${tableSettings.topPosition}mm;
      left: ${(100 - tableSettings.tableWidth) / 2}%;
      width: ${tableSettings.tableWidth}%;
      z-index: 20;
    }
    
    .btable {
      width: 100%;
      border-collapse: collapse;
      border-spacing: 0;
      font-size: ${tableSettings.fontSize}px;
      font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif;
      table-layout: fixed;
      border: 0.2mm solid ${tableSettings.borderColor};
    }
    
    .btable tr {
      height: ${tableSettings.rowHeight}mm;
    }
    
    .btable th {
      background: ${tableSettings.headerBgColor};
      color: ${tableSettings.headerTextColor};
      font-weight: ${tableSettings.headerFontWeight};
      font-size: ${tableSettings.headerFontSize}px;
      height: ${tableSettings.headerRowHeight}mm;
      border: 0.2mm solid ${tableSettings.borderColor};
      padding: ${tableSettings.cellPadding}mm;
    }
    
    .btable td {
      border: 0.2mm solid ${tableSettings.borderColor};
      padding: ${tableSettings.cellPadding}mm;
      vertical-align: middle;
      text-align: ${tableSettings.cellTextAlign};
      color: ${tableSettings.cellTextColor};
    }
    
    .btable tr:nth-child(even) td:not(.highlighted) {
      background: ${tableSettings.alternateRowColor};
    }
    
    .btable tr:nth-child(odd) td:not(.highlighted) {
      background: white;
    }
    
    .btable td.highlighted {
      background: ${tableSettings.highlightedColumnBgColor};
      color: ${tableSettings.highlightedColumnTextColor};
    }
  `;
}

// تصدير الأنواع للاستخدام في الملفات الأخرى
export type { BillboardData, BuildTableHTMLOptions };
