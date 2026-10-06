import { printLengthMm } from '@/lib/printCardLayout';

/** Fill the space between the image heading and address, with a clear print margin. */
export function resolveMunicipalityPhotoArea(settings: Record<string, any>) {
  const locationTop = printLengthMm(settings.location_info_top, 233, 297);
  const top = Math.max(80, Math.min(printLengthMm(settings.main_image_top, 90, 297), locationTop - 25));
  const center = Math.max(30, Math.min(180, printLengthMm(settings.main_image_left, 105)));
  const width = Math.max(20, Math.min(190, 2 * Math.min(center - 10, 200 - center)));
  const height = Math.max(20, locationTop - top - 5);
  return { top, center, width, height };
}

/** Original photo treatment shared with the print-all card: no crop or stretching. */
export function buildMunicipalityPhoto(settings: Record<string, any>, url: string): string {
  const area = resolveMunicipalityPhotoArea(settings);
  return `<div class="absolute-field municipality-photo" style="position:absolute;top:${area.top}mm;left:${area.center}mm;transform:translateX(-50%);width:${area.width}mm;height:${area.height}mm;display:flex;align-items:center;justify-content:center;background:transparent;border:none;z-index:5;box-sizing:border-box;">
    <img src="${url}" alt="صورة اللوحة" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block;border:2px solid #000;border-radius:8px;box-sizing:border-box;" />
  </div>`;
}
