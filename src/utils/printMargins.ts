/**
 * Utility for parsing print sizes and calculating exact print margins (in meters and centimeters)
 * relative to the billboard advertising display dimensions.
 */

export interface PrintMarginCalculation {
  hasValidPrintSize: boolean;
  printWidth: number | null;
  printHeight: number | null;
  billboardWidth: number | null;
  billboardHeight: number | null;
  marginWidthMeters: number | null;
  marginHeightMeters: number | null;
  marginWidthCm: number | null;
  marginHeightCm: number | null;
  marginPerSideWidthCm: number | null;
  marginPerSideHeightCm: number | null;
  summaryText: string;
  shortSummary: string;
  isPositiveMargin: boolean;
}

/**
 * Extracts width and height from a string like "12.20 × 4.20", "12.2x4.2", "12 * 4"
 */
export function parseDimensionsString(dimStr: string | null | undefined): { width: number; height: number } | null {
  if (!dimStr || typeof dimStr !== 'string') return null;
  const cleaned = dimStr.trim();
  // Match two decimal or integer numbers separated by x, X, ×, *, or comma/slash
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:[xX×*,\/]|[\s]+(?=\d))\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const num1 = parseFloat(match[1]);
  const num2 = parseFloat(match[2]);
  if (isNaN(num1) || isNaN(num2) || num1 <= 0 || num2 <= 0) return null;

  return { width: num1, height: num2 };
}

/**
 * Resolves standard billboard display dimensions by name if width/height are not explicitly provided
 */
export function resolveDisplayDimensions(
  sizeName: string | null | undefined,
  explicitWidth?: number | null,
  explicitHeight?: number | null,
  sizesList?: Array<{ name: string; width?: number | string | null; height?: number | string | null }>
): { width: number | null; height: number | null } {
  const w = explicitWidth != null && !isNaN(Number(explicitWidth)) && Number(explicitWidth) > 0 ? Number(explicitWidth) : null;
  const h = explicitHeight != null && !isNaN(Number(explicitHeight)) && Number(explicitHeight) > 0 ? Number(explicitHeight) : null;
  if (w != null && h != null) return { width: w, height: h };

  if (sizeName && sizesList && sizesList.length > 0) {
    const matched = sizesList.find(s => s.name?.trim().toLowerCase() === sizeName.trim().toLowerCase());
    if (matched) {
      const mw = matched.width != null ? Number(matched.width) : null;
      const mh = matched.height != null ? Number(matched.height) : null;
      if (mw != null && mh != null && mw > 0 && mh > 0) {
        return { width: mw, height: mh };
      }
    }
  }

  if (sizeName) {
    const trimmed = sizeName.trim();
    if (trimmed.includes('سوسيت') || trimmed.toLowerCase().includes('sucette')) {
      return { width: 1.0, height: 2.0 };
    }
    const parsed = parseDimensionsString(trimmed);
    if (parsed) {
      // In outdoor billboard sizing like 12x4, width is 12 and height is 4
      return { width: parsed.width, height: parsed.height };
    }
  }

  return { width: null, height: null };
}

/**
 * Calculates print margins in meters and centimeters
 */
export function calculatePrintMargins(
  printSizeStr: string | null | undefined,
  billboardSizeName: string | null | undefined,
  billboardWidth?: number | null,
  billboardHeight?: number | null,
  sizesList?: Array<{ name: string; width?: number | string | null; height?: number | string | null }>
): PrintMarginCalculation {
  const display = resolveDisplayDimensions(billboardSizeName, billboardWidth, billboardHeight, sizesList);
  const parsedPrint = parseDimensionsString(printSizeStr);

  if (!parsedPrint) {
    return {
      hasValidPrintSize: false,
      printWidth: null,
      printHeight: null,
      billboardWidth: display.width,
      billboardHeight: display.height,
      marginWidthMeters: null,
      marginHeightMeters: null,
      marginWidthCm: null,
      marginHeightCm: null,
      marginPerSideWidthCm: null,
      marginPerSideHeightCm: null,
      summaryText: 'لم يُحدد مقاس الطباعة بالامتار',
      shortSummary: 'مقاس الطباعة غير محدد',
      isPositiveMargin: false,
    };
  }

  const pw = parsedPrint.width;
  const ph = parsedPrint.height;
  const bw = display.width;
  const bh = display.height;

  if (bw == null || bh == null) {
    return {
      hasValidPrintSize: true,
      printWidth: pw,
      printHeight: ph,
      billboardWidth: null,
      billboardHeight: null,
      marginWidthMeters: null,
      marginHeightMeters: null,
      marginWidthCm: null,
      marginHeightCm: null,
      marginPerSideWidthCm: null,
      marginPerSideHeightCm: null,
      summaryText: `مقاس الطباعة: ${pw.toFixed(2)} × ${ph.toFixed(2)} م`,
      shortSummary: `${pw.toFixed(2)} × ${ph.toFixed(2)} م`,
      isPositiveMargin: false,
    };
  }

  // Calculate difference
  const diffW = Math.round((pw - bw) * 1000) / 1000;
  const diffH = Math.round((ph - bh) * 1000) / 1000;
  const cmW = Math.round(diffW * 100);
  const cmH = Math.round(diffH * 100);
  const perSideW = Math.round((cmW / 2) * 10) / 10;
  const perSideH = Math.round((cmH / 2) * 10) / 10;

  const isPositive = cmW > 0 || cmH > 0;

  let summaryText = '';
  let shortSummary = '';

  if (cmW === 0 && cmH === 0) {
    summaryText = `مطابق لمقاس المساحة الإعلانية (${bw} × ${bh} م) بدون هوامش إضافية`;
    shortSummary = 'بدون هوامش (مطابق)';
  } else {
    const parts: string[] = [];
    const shortParts: string[] = [];

    if (cmW !== 0) {
      const signW = cmW > 0 ? '+' : '';
      parts.push(`العرض: ${signW}${cmW} سم (${signW}${perSideW} سم لكل جانب)`);
      shortParts.push(`عرض ${signW}${cmW}سم`);
    } else {
      parts.push('العرض: بدون هامش');
    }

    if (cmH !== 0) {
      const signH = cmH > 0 ? '+' : '';
      parts.push(`الارتفاع: ${signH}${cmH} سم (${signH}${perSideH} سم لكل جانب)`);
      shortParts.push(`ارتفاع ${signH}${cmH}سم`);
    } else {
      parts.push('الارتفاع: بدون هامش');
    }

    summaryText = `هوامش الطباعة: ${parts.join(' · ')}`;
    shortSummary = `هوامش: ${shortParts.join(' / ')}`;
  }

  return {
    hasValidPrintSize: true,
    printWidth: pw,
    printHeight: ph,
    billboardWidth: bw,
    billboardHeight: bh,
    marginWidthMeters: diffW,
    marginHeightMeters: diffH,
    marginWidthCm: cmW,
    marginHeightCm: cmH,
    marginPerSideWidthCm: perSideW,
    marginPerSideHeightCm: perSideH,
    summaryText,
    shortSummary,
    isPositiveMargin: isPositive,
  };
}
