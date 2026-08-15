import { PageSectionSettings } from '@/hooks/useContractTemplateSettings';

type TableTermSettings = NonNullable<PageSectionSettings['tableTerm']>;

interface BuildTableTermOptions {
  tableTerm: TableTermSettings;
  title: string;
  content: string;
  renderTarget?: 'preview' | 'pdf';
}

export interface BuiltTableTermResult {
  html: string;
  height: number;
}

export function buildTableTermHtml({ tableTerm, title, content, renderTarget = 'preview' }: BuildTableTermOptions): BuiltTableTermResult {
  const fontSize = tableTerm.fontSize || 14;
  const titleWeight = tableTerm.titleFontWeight || 'bold';
  const contentWeight = tableTerm.contentFontWeight || 'normal';
  const textColor = tableTerm.color || '#1a1a2e';
  const termWrapHeight = Math.max(fontSize * 2, 32);
  const goldHeightPct = tableTerm.goldLine?.heightPercent || 30;
  const goldColor = tableTerm.goldLine?.color || '#D4AF37';
  const showGold = tableTerm.goldLine?.visible !== false;

  const goldHeightPx = Math.max(2, Math.round(fontSize * (goldHeightPct / 100)));
  // ارتفاع وسطر صريحان للـ span حتى يتعامل html2canvas مع الإحداثيات بدقة.
  const lineBoxPx = Math.round(fontSize * 1.2);
   // إنزال إضافي يُطبّق فقط في تصدير PDF لأن html2canvas يرفع الخط قليلًا مقارنة بالمعاينة/طباعة المتصفح.
   const opticalOffsetMultiplier = renderTarget === 'pdf' ? 0.58 : 0.32;
   const opticalOffsetPx = Math.round(fontSize * opticalOffsetMultiplier);
  const goldTopPx = Math.round(lineBoxPx / 2 - goldHeightPx / 2 + opticalOffsetPx);

  const goldLineHtml = showGold
    ? `<span style="
        position: absolute;
        left: 0; right: 0;
        top: ${goldTopPx}px;
        height: ${goldHeightPx}px;
        background-color: ${goldColor};
        border-radius: 2px;
        z-index: 0;
        pointer-events: none;
      "></span>`
    : '';

  return {
    height: termWrapHeight,
    html: `
      <div style="
        text-align: center;
        font-family: 'Doran', sans-serif;
        direction: rtl;
        margin: 0; padding: 0;
        line-height: 1;
      ">
        <h2 style="
          font-size: ${fontSize}px;
          color: ${textColor};
          margin: 0;
          display: inline-block;
          line-height: ${lineBoxPx}px;
          vertical-align: middle;
        ">
          <span style="
            font-weight: ${titleWeight};
            position: relative;
            display: inline-block;
            height: ${lineBoxPx}px;
            line-height: ${lineBoxPx}px;
            vertical-align: middle;
          ">
            ${goldLineHtml}
            <span style="position: relative; z-index: 1;">${title}</span>
          </span>
          <span style="font-weight: ${contentWeight}; vertical-align: middle;"> ${content}</span>
        </h2>
      </div>
    `,
  };
}
