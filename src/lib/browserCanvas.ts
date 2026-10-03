import { toCanvas } from 'html-to-image';

export interface BrowserCanvasOptions {
  scale?: number; width?: number; height?: number; backgroundColor?: string | null;
  [key: string]: unknown;
}

/** Browser SVG rendering followed by Canvas 2D, without a separate HTML layout engine. */
export default async function browserCanvas(element: HTMLElement, options: BrowserCanvasOptions = {}): Promise<HTMLCanvasElement> {
  await element.ownerDocument.fonts?.ready;
  const rect = element.getBoundingClientRect();
  const width = options.width || rect.width || element.scrollWidth;
  const height = options.height || Math.max(rect.height, element.scrollHeight);
  const ratio = Math.min(options.scale || 2, 16384 / Math.max(width, height), Math.sqrt(64_000_000 / (width * height)));
  if (!(width > 0 && height > 0)) throw new Error('لا توجد مساحة قابلة للتصدير');
  return toCanvas(element, {
    width, height, pixelRatio: ratio,
    backgroundColor: options.backgroundColor || undefined,
    includeQueryParams: true,
    style: { margin: '0', transform: 'none', visibility: 'visible' },
  });
}
