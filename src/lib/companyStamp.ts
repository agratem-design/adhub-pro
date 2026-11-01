export interface CompanyStampSettings {
  visible: boolean;
  x: number;
  y: number;
  width: number;
}

export const DEFAULT_COMPANY_STAMP: CompanyStampSettings = { visible: true, x: 1604, y: 3060, width: 300 };

export function companyStampPosition(settings?: Partial<CompanyStampSettings>) {
  // Upgrade the previous default while preserving explicitly customized layouts.
  if (settings?.width === 420 && settings.x === 1544 && settings.y === 3000) {
    settings = { ...settings, x: 1604, y: 3060, width: 300 };
  }
  const finite = (n: number | undefined, fallback: number, min: number, max: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  const width = finite(settings?.width, DEFAULT_COMPANY_STAMP.width, 100, 700);
  return {
    visible: settings?.visible ?? true,
    width,
    x: finite(settings?.x, DEFAULT_COMPANY_STAMP.x, 0, 2480 - width),
    y: finite(settings?.y, DEFAULT_COMPANY_STAMP.y, 0, 3508 - width),
  };
}
