/**
 * Helper to calculate billboard dimensions and area in square meters.
 * Handles numeric sizes (e.g., "12x4", "2.5x4", "3X8-T"), database sizes,
 * and textual names such as "سوسيت", "societ", "soussette", "mupi".
 */

export interface BillboardDimensions {
  width: number;
  height: number;
  area: number; // area per single face in square meters (width * height)
}

/**
 * Returns dimensions (width, height, single-face area) for a billboard or size string.
 *
 * Priority:
 * 1. Explicit actual_width & actual_height on the billboard object.
 * 2. Lookup in sizeDimensionsMap (by size_id, Number(size_id), String(size_id), or size name).
 * 3. Textual names for "سوسيت" / "societ" / "soussette" / "mupi" (standard 1.00m × 2.00m = 2 m² per face).
 * 4. Regex parsing from size string: "12x4", "2.5x4", "3X8-T", "4*12", "4×12", etc.
 */
export function getBillboardDimensions(
  billboardOrSize: any,
  sizeDimensionsMap?: Map<string | number, { width: number; height: number }> | null
): BillboardDimensions {
  if (!billboardOrSize) return { width: 0, height: 0, area: 0 };

  let size = '';
  let sizeId: any = null;

  if (typeof billboardOrSize === 'string') {
    size = billboardOrSize.trim();
  } else if (typeof billboardOrSize === 'object') {
    size = String(billboardOrSize.Size || billboardOrSize.size || billboardOrSize.Order_Size || '').trim();
    sizeId = billboardOrSize.size_id ?? billboardOrSize.Size_ID ?? billboardOrSize.sizeId;

    const actW = parseFloat(String(billboardOrSize.actual_width ?? ''));
    const actH = parseFloat(String(billboardOrSize.actual_height ?? ''));
    if (!isNaN(actW) && !isNaN(actH) && actW > 0 && actH > 0) {
      return { width: actW, height: actH, area: actW * actH };
    }
  }

  // 2. Check sizeDimensionsMap if provided
  if (sizeDimensionsMap) {
    if (sizeId != null && sizeId !== '') {
      const byNum = sizeDimensionsMap.get(Number(sizeId));
      if (byNum && byNum.width > 0 && byNum.height > 0) {
        return { width: byNum.width, height: byNum.height, area: byNum.width * byNum.height };
      }
      const byStr = sizeDimensionsMap.get(String(sizeId));
      if (byStr && byStr.width > 0 && byStr.height > 0) {
        return { width: byStr.width, height: byStr.height, area: byStr.width * byStr.height };
      }
    }
    if (size) {
      const byName = sizeDimensionsMap.get(size) || sizeDimensionsMap.get(size.toLowerCase());
      if (byName && byName.width > 0 && byName.height > 0) {
        return { width: byName.width, height: byName.height, area: byName.width * byName.height };
      }
    }
  }

  // 3. Special handling for "سوسيت" / "societ" / "soussette" / "mupi":
  // In the DB sizes table (id=34) and standard advertising: 1.00m width × 2.00m height (2 m² per face)
  const lower = size.toLowerCase();
  if (lower.includes('سوسيت') || lower.includes('societ') || lower.includes('soussette') || lower.includes('mupi')) {
    return { width: 1, height: 2, area: 2 };
  }

  // 4. Regex match for dimensions: "12x4", "2.5x4", "3X8-T", "4*12", "4×12"
  const match = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\*\-]\s*(\d+(?:[.,]\d+)?)/);
  if (match) {
    const w = parseFloat(match[1].replace(',', '.'));
    const h = parseFloat(match[2].replace(',', '.'));
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      return { width: w, height: h, area: w * h };
    }
  }

  return { width: 0, height: 0, area: 0 };
}
