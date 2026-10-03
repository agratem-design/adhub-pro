import { jsPDF } from 'jspdf';
import browserCanvas from './browserCanvas';

/** Chain-compatible migration for older export callers. Uses browser Canvas 2D. */
export default function browserPdf() {
  let element: HTMLElement;
  let options: any = {};
  const render = async () => {
    if (!element) throw new Error('لا يوجد مستند للتصدير');
    const canvas = await browserCanvas(element, options.canvas || {});
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', ...options.jsPDF });
    const rawMargin = options.margin || 0;
    const margin = typeof rawMargin === 'number'
      ? [rawMargin, rawMargin, rawMargin, rawMargin]
      : rawMargin.length === 2 ? [rawMargin[0], rawMargin[1], rawMargin[0], rawMargin[1]] : rawMargin;
    const width = pdf.internal.pageSize.getWidth() - margin[1] - margin[3];
    const pageHeight = pdf.internal.pageSize.getHeight() - margin[0] - margin[2];
    const pixelHeight = Math.max(1, Math.floor(pageHeight * canvas.width / width));
    for (let y = 0; y < canvas.height; y += pixelHeight) {
      if (y) pdf.addPage();
      const slice = document.createElement('canvas');
      slice.width = canvas.width; slice.height = Math.min(pixelHeight, canvas.height - y);
      slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin[3], margin[0], width, slice.height * width / canvas.width);
    }
    return pdf;
  };
  const worker = {
    set(value: any) { options = value; return worker; },
    from(value: HTMLElement) { element = value; return worker; },
    async save(filename?: string) { (await render()).save(filename || options.filename || 'document.pdf'); },
    async outputPdf(type: 'blob') { return (await render()).output(type); },
    async output(type: 'blob' | 'dataurlstring'): Promise<any> { return (await render()).output(type as 'blob'); },
  };
  return worker;
}
