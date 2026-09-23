// 📁 textBackgroundPresets.ts - قوالب خلفيات النصوص السريعة (كبسولات وشارات النصوص)
import { CanvasElement } from './types';

export interface TextBackgroundPreset {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  bgColor: string;
  textColor?: string;
  borderColor?: string;
  borderRadius?: number;
  paddingX?: number;
  paddingY?: number;
  blur?: number;
  previewBg: string;
  previewBorder: string;
  previewTextColor: string;
}

export const TEXT_BACKGROUND_PRESETS: TextBackgroundPreset[] = [
  {
    id: 'none',
    name: 'بدون خلفية',
    description: 'نص حر بدون أي خلفية أو إطار',
    enabled: false,
    bgColor: 'transparent',
    borderColor: 'none',
    borderRadius: 0,
    paddingX: 0,
    paddingY: 0,
    blur: 0,
    previewBg: 'rgba(255, 255, 255, 0.05)',
    previewBorder: '1px dashed rgba(255, 255, 255, 0.2)',
    previewTextColor: '#94a3b8',
  },
  {
    id: 'black-gold',
    name: 'كبسولة سوداء وذهب',
    description: 'خلفية فحم داكنة مع إطار ذهبي ملكي بارز',
    enabled: true,
    bgColor: 'rgba(12, 14, 20, 0.88)',
    textColor: '#d6ac40',
    borderColor: '1px solid rgba(214, 172, 64, 0.65)',
    borderRadius: 8,
    paddingX: 12,
    paddingY: 4,
    blur: 4,
    previewBg: 'rgba(12, 14, 20, 0.95)',
    previewBorder: '1px solid #d6ac40',
    previewTextColor: '#d6ac40',
  },
  {
    id: 'pure-gold',
    name: 'ذهب إمبراطوري',
    description: 'خلفية ذهبية كاملة مع نص داكن عالي الفخامة',
    enabled: true,
    bgColor: '#d6ac40',
    textColor: '#0a0a0f',
    borderColor: '1px solid #ffd700',
    borderRadius: 8,
    paddingX: 12,
    paddingY: 4,
    blur: 0,
    previewBg: '#d6ac40',
    previewBorder: '1px solid #ffd700',
    previewTextColor: '#0a0a0f',
  },
  {
    id: 'frosted-glass',
    name: 'زجاج دخاني بلور',
    description: 'تأثير زجاجي شفاف شبه ضبابي مع حد كريستالي',
    enabled: true,
    bgColor: 'rgba(255, 255, 255, 0.14)',
    textColor: '#ffffff',
    borderColor: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    paddingX: 12,
    paddingY: 4,
    blur: 10,
    previewBg: 'rgba(255, 255, 255, 0.15)',
    previewBorder: '1px solid rgba(255, 255, 255, 0.4)',
    previewTextColor: '#ffffff',
  },
  {
    id: 'high-contrast',
    name: 'فحم عالي التباين',
    description: 'أسود داكن عميق لقراءة فائقة الوضوح فوق أي صورة',
    enabled: true,
    bgColor: 'rgba(0, 0, 0, 0.92)',
    textColor: '#ffffff',
    borderColor: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: 6,
    paddingX: 10,
    paddingY: 4,
    blur: 0,
    previewBg: 'rgba(0, 0, 0, 0.95)',
    previewBorder: '1px solid rgba(255, 255, 255, 0.2)',
    previewTextColor: '#ffffff',
  },
  {
    id: 'crisp-white',
    name: 'شارة بيضاء ناصعة',
    description: 'خلفية بيضاء نقية مع نص داكن متباين',
    enabled: true,
    bgColor: '#ffffff',
    textColor: '#0f172a',
    borderColor: '1px solid rgba(0, 0, 0, 0.15)',
    borderRadius: 8,
    paddingX: 12,
    paddingY: 4,
    blur: 0,
    previewBg: '#ffffff',
    previewBorder: '1px solid rgba(0, 0, 0, 0.2)',
    previewTextColor: '#0f172a',
  },
  {
    id: 'emerald-gold',
    name: 'زمردي ملكي',
    description: 'خلفية زمردية فاخرة مع تطعيم بالذهب الملكي',
    enabled: true,
    bgColor: 'rgba(6, 78, 59, 0.92)',
    textColor: '#fef08a',
    borderColor: '1px solid rgba(214, 172, 64, 0.55)',
    borderRadius: 8,
    paddingX: 12,
    paddingY: 4,
    blur: 0,
    previewBg: 'rgba(6, 78, 59, 0.95)',
    previewBorder: '1px solid #d6ac40',
    previewTextColor: '#fef08a',
  },
];

/**
 * Applies a text background preset to a single element
 */
export function applyTextBackgroundToElement(
  el: CanvasElement,
  preset: TextBackgroundPreset,
  applyTextColor = false
): CanvasElement {
  const updated: CanvasElement = {
    ...el,
    textBackground: preset.enabled,
    textBgColor: preset.bgColor,
    textBgBorder: preset.borderColor,
    textBgRadius: preset.borderRadius,
    textBgPaddingX: preset.paddingX,
    textBgPaddingY: preset.paddingY,
    textBgBlur: preset.blur,
  };

  if (applyTextColor && preset.textColor) {
    updated.fontColor = preset.textColor;
    if (updated.parts) {
      updated.parts = {
        ...updated.parts,
        municipality: { ...(updated.parts.municipality || {}), fontColor: preset.textColor },
        region: { ...(updated.parts.region || {}), fontColor: preset.textColor },
      };
    }
  }

  return updated;
}
