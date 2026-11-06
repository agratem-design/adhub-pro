import { renderLetterHtml, type Letter, type LetterheadCompany, type LetterPrintMode, type RenderOptions } from '@/services/correspondence';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';

/**
 * طباعة عدة تقارير دورية دفعة واحدة.
 * كل تقرير يُقسَّم إلى صفحات بسكربت داخل مستنده، لذا يُرسم كل تقرير في إطار مخفي حتى يكتمل تقسيمه،
 * ثم تُجمع صفحاته الجاهزة (بأرقام صفحاته وتوقيعه) في مستند واحد بلا سكربت.
 */
function layoutInFrame(html: string, timeoutMs = 15000): Promise<string> {
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    // بعرض A4 الحقيقي حتى يكون التقسيم مطابقاً للطباعة
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;visibility:hidden;';
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      let pages = '';
      try { pages = frame.contentDocument?.getElementById('pages')?.innerHTML || ''; } catch { /* ignore */ }
      frame.remove();
      resolve(pages);
    };
    frame.onload = () => {
      const doc = frame.contentDocument;
      const fonts = (doc as any)?.fonts;
      // تحميل كل الخطوط فعلياً ثم إعادة التقسيم بها قبل أخذ الصفحات (وإلا قد يُقص آخر سطر في الصفحة)
      const loadAll = fonts ? Promise.all([...fonts].map((f: any) => f.load().catch(() => null))).then(() => fonts.ready) : Promise.resolve();
      loadAll.then(() => {
        try { frame.contentWindow?.dispatchEvent(new Event('load')); } catch { /* ignore */ }
        setTimeout(finish, 500);
      }, () => setTimeout(finish, 500));
    };
    setTimeout(finish, timeoutMs);
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

export async function printReportsBatch(company: LetterheadCompany, letters: Letter[], mode: LetterPrintMode, title: string, onProgress?: (done: number, total: number) => void, extra: Pick<RenderOptions, 'hideReference' | 'hideSign' | 'hideRecipient' | 'hideGreeting' | 'hideClosing'> = { hideSign: true, hideRecipient: true, hideGreeting: true, hideClosing: true }) {
  if (!letters.length) return;
  const w = preparePrintWindow(title);
  const origin = window.location.origin;
  const opts: RenderOptions = { mode, paginate: true, markup: true, ...extra };
  let head = '';
  const bodies: string[] = [];
  for (let i = 0; i < letters.length; i++) {
    const html = renderLetterHtml(company, letters[i], origin, opts);
    if (!head) head = (html.match(/<head>[\s\S]*?<\/head>/i) || [''])[0].replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
    bodies.push(await layoutInFrame(html));
    onProgress?.(i + 1, letters.length);
  }
  const doc = `<!doctype html><html dir="rtl" lang="ar">${head}<body>${bodies.filter(Boolean).join('\n')}</body></html>`;
  writePrintWindow(w, doc, { title, showDownloadPdf: true, showShare: true, autoPrint: false });
}
