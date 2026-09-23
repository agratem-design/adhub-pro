// ══════════════════════════════════════════════════════════════════════════════
// 📁 locationStripPresets.ts - جاهزية خلفيات أشرطة اللوحات PNG/SVG وأنماط الكتابات
// ══════════════════════════════════════════════════════════════════════════════

export interface LocationStripPreset {
  id: string;
  name: string;
  description: string;
  imageUrl: string; // Vector SVG / PNG Data URL
  previewGradient: string;
  recommendedTextColor: string;
  recommendedTextColorTheme: string;
  defaultHeight: number;
  objectFit: 'fill' | 'cover' | 'contain';
}

export interface LocationTextColorTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  description: string;
  previewColors: [string, string];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. خلفيات أشرطة جاهزة فاخرة (Built-in High-Res Luxury PNG/SVG Presets)
// ─────────────────────────────────────────────────────────────────────────────

export const LOCATION_STRIP_PRESETS: LocationStripPreset[] = [
  {
    id: 'royal_gold_ribbon',
    name: 'الذهب الملكي المشطوف',
    description: 'شريط أسود فاخر مع حافة علوية مذهبة ثلاثية الأبعاد وبروز معدني',
    previewGradient: 'linear-gradient(135deg, #07080a 0%, #171a22 50%, #07080a 100%)',
    recommendedTextColor: '#ffffff',
    recommendedTextColorTheme: 'royal_gold',
    defaultHeight: 120,
    objectFit: 'fill',
    imageUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 160" width="1920" height="160" preserveAspectRatio="none">
      <defs>
        <linearGradient id="stripBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="%230b0d12"/>
          <stop offset="50%" stop-color="%23121620"/>
          <stop offset="100%" stop-color="%2306070a"/>
        </linearGradient>
        <linearGradient id="goldBevel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="%23a37c28"/>
          <stop offset="15%" stop-color="%23f7df96"/>
          <stop offset="50%" stop-color="%23d6ac40"/>
          <stop offset="85%" stop-color="%23faeec5"/>
          <stop offset="100%" stop-color="%238f691c"/>
        </linearGradient>
        <linearGradient id="goldGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="%23d6ac40" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="%23d6ac40" stop-opacity="0"/>
        </linearGradient>
        <filter id="glow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="%23d6ac40" flood-opacity="0.4"/>
        </filter>
      </defs>
      <rect width="1920" height="160" fill="url(%23stripBg)"/>
      <rect width="1920" height="30" fill="url(%23goldGlow)"/>
      <!-- Top Beveled Gold Bar -->
      <rect y="0" width="1920" height="6" fill="url(%23goldBevel)" filter="url(%23glow)"/>
      <line x1="0" y1="9" x2="1920" y2="9" stroke="%23d6ac40" stroke-opacity="0.25" stroke-width="1"/>
      <!-- Metallic Corner Bracket Right -->
      <polygon points="1880,10 1910,10 1910,40 1904,40 1904,16 1880,16" fill="url(%23goldBevel)"/>
      <!-- Metallic Corner Bracket Left -->
      <polygon points="40,10 10,10 10,40 16,40 16,16 40,16" fill="url(%23goldBevel)"/>
      <!-- Subtle Bottom Gold Line -->
      <line x1="0" y1="156" x2="1920" y2="156" stroke="url(%23goldBevel)" stroke-opacity="0.5" stroke-width="2"/>
    </svg>`,
  },
  {
    id: 'smoked_glass_gold',
    name: 'الزجاج الدخاني والكريستال',
    description: 'شريط زجاجي مدخن داكن مع إطار ذهبي مزدوج ناعم ولمعان كريستالي',
    previewGradient: 'linear-gradient(180deg, rgba(20,24,33,0.85) 0%, rgba(10,12,18,0.95) 100%)',
    recommendedTextColor: '#ffffff',
    recommendedTextColorTheme: 'pure_white',
    defaultHeight: 120,
    objectFit: 'fill',
    imageUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 160" width="1920" height="160" preserveAspectRatio="none">
      <defs>
        <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="%23171b26" stop-opacity="0.88"/>
          <stop offset="100%" stop-color="%23090b10" stop-opacity="0.96"/>
        </linearGradient>
        <linearGradient id="goldStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="%23ffffff" stop-opacity="0.1"/>
          <stop offset="30%" stop-color="%23f7df96"/>
          <stop offset="50%" stop-color="%23d6ac40"/>
          <stop offset="70%" stop-color="%23f7df96"/>
          <stop offset="100%" stop-color="%23ffffff" stop-opacity="0.1"/>
        </linearGradient>
      </defs>
      <rect width="1920" height="160" fill="url(%23glassGrad)"/>
      <!-- Upper Double Frame -->
      <line x1="20" y1="4" x2="1900" y2="4" stroke="url(%23goldStroke)" stroke-width="3"/>
      <line x1="60" y1="10" x2="1860" y2="10" stroke="%23ffffff" stroke-opacity="0.15" stroke-width="1"/>
      <!-- Soft Ambient Center Glow -->
      <ellipse cx="960" cy="80" rx="600" ry="60" fill="%23d6ac40" fill-opacity="0.04"/>
      <!-- Bottom Hairline -->
      <line x1="20" y1="156" x2="1900" y2="156" stroke="url(%23goldStroke)" stroke-opacity="0.6" stroke-width="1.5"/>
    </svg>`,
  },
  {
    id: 'brushed_imperial_gold',
    name: 'الذهب الخالص المصقول',
    description: 'شريط معدني ذهبي بارز وفاخر مع حواف كونتراست عميقة',
    previewGradient: 'linear-gradient(90deg, #b8860b 0%, #ffd700 50%, #b8860b 100%)',
    recommendedTextColor: '#0f172a',
    recommendedTextColorTheme: 'obsidian_charcoal',
    defaultHeight: 110,
    objectFit: 'fill',
    imageUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 160" width="1920" height="160" preserveAspectRatio="none">
      <defs>
        <linearGradient id="goldBar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="%239a7322"/>
          <stop offset="15%" stop-color="%23d6ac40"/>
          <stop offset="35%" stop-color="%23fae8b4"/>
          <stop offset="50%" stop-color="%23d6ac40"/>
          <stop offset="70%" stop-color="%23fdedc9"/>
          <stop offset="85%" stop-color="%23c29832"/>
          <stop offset="100%" stop-color="%238a6318"/>
        </linearGradient>
      </defs>
      <rect width="1920" height="160" fill="url(%23goldBar)"/>
      <!-- Subtle top inner shadow -->
      <rect y="0" width="1920" height="8" fill="%23ffffff" fill-opacity="0.35"/>
      <rect y="152" width="1920" height="8" fill="%23000000" fill-opacity="0.35"/>
      <line x1="0" y1="16" x2="1920" y2="16" stroke="%23ffffff" stroke-opacity="0.3" stroke-width="1"/>
      <line x1="0" y1="144" x2="1920" y2="144" stroke="%23000000" stroke-opacity="0.2" stroke-width="1"/>
    </svg>`,
  },
  {
    id: 'carbon_gold_horizon',
    name: 'الكربون الداكن والميتاليك',
    description: 'خلفية داكنة فخمة مع حواف مذهبة وأركان هندسية أنيقة',
    previewGradient: 'linear-gradient(135deg, #11141a 0%, #1e2430 100%)',
    recommendedTextColor: '#ffffff',
    recommendedTextColorTheme: 'royal_gold',
    defaultHeight: 125,
    objectFit: 'fill',
    imageUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 160" width="1920" height="160" preserveAspectRatio="none">
      <defs>
        <linearGradient id="darkCarbon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="%23131720"/>
          <stop offset="100%" stop-color="%23090c12"/>
        </linearGradient>
        <linearGradient id="goldH" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="%23d6ac40" stop-opacity="0"/>
          <stop offset="15%" stop-color="%23d6ac40"/>
          <stop offset="50%" stop-color="%23fae8b4"/>
          <stop offset="85%" stop-color="%23d6ac40"/>
          <stop offset="100%" stop-color="%23d6ac40" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="1920" height="160" fill="url(%23darkCarbon)"/>
      <line x1="0" y1="3" x2="1920" y2="3" stroke="url(%23goldH)" stroke-width="5"/>
      <line x1="0" y1="8" x2="1920" y2="8" stroke="%23d6ac40" stroke-opacity="0.3" stroke-width="1"/>
      <line x1="0" y1="157" x2="1920" y2="157" stroke="url(%23goldH)" stroke-width="2"/>
    </svg>`,
  },
  {
    id: 'light_stone_gold',
    name: 'الحجر الكريمي الفاخر',
    description: 'شريط كريمي فاتح مع شريط ذهبي سفلي وتفاصيل داكنة فخمة',
    previewGradient: 'linear-gradient(180deg, #f7f4ee 0%, #ece5d8 100%)',
    recommendedTextColor: '#1d1d1f',
    recommendedTextColorTheme: 'obsidian_charcoal',
    defaultHeight: 115,
    objectFit: 'fill',
    imageUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 160" width="1920" height="160" preserveAspectRatio="none">
      <defs>
        <linearGradient id="creamStone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="%23f9f7f2"/>
          <stop offset="100%" stop-color="%23e8e1d3"/>
        </linearGradient>
        <linearGradient id="stoneGold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="%23c29832"/>
          <stop offset="50%" stop-color="%23e5c065"/>
          <stop offset="100%" stop-color="%23a88024"/>
        </linearGradient>
      </defs>
      <rect width="1920" height="160" fill="url(%23creamStone)"/>
      <rect y="0" width="1920" height="4" fill="url(%23stoneGold)"/>
      <line x1="0" y1="155" x2="1920" y2="155" stroke="url(%23stoneGold)" stroke-width="2"/>
    </svg>`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. أنماط ألوان الكتابات السريعة (One-Click Text Color Themes)
// ─────────────────────────────────────────────────────────────────────────────

export const LOCATION_TEXT_COLOR_THEMES: LocationTextColorTheme[] = [
  {
    id: 'royal_gold',
    name: 'الملكي (أبيض وذهبي)',
    primaryColor: '#ffffff',
    secondaryColor: '#d6ac40',
    description: 'عناوين بيضاء ناصعة وتفاصيل ذهبية لامعة',
    previewColors: ['#ffffff', '#d6ac40'],
  },
  {
    id: 'pure_gold',
    name: 'الذهبي المونوكروم',
    primaryColor: '#f8df8c',
    secondaryColor: '#d6ac40',
    description: 'تدرج الذهب الكامل للأشرطة السوداء الفاخرة',
    previewColors: ['#f8df8c', '#d6ac40'],
  },
  {
    id: 'pure_white',
    name: 'الأبيض الناصع',
    primaryColor: '#ffffff',
    secondaryColor: '#cbd5e1',
    description: 'أبيض ناصع مع تدرج سيلفر ووضوح فائق',
    previewColors: ['#ffffff', '#cbd5e1'],
  },
  {
    id: 'obsidian_charcoal',
    name: 'الفحم الداكن',
    primaryColor: '#0f172a',
    secondaryColor: '#475569',
    description: 'كتابات داكنة ممتازة للأشرطة الذهبية والفاتحة',
    previewColors: ['#0f172a', '#475569'],
  },
  {
    id: 'executive_cyan',
    name: 'الأزرق التنفيذي',
    primaryColor: '#ffffff',
    secondaryColor: '#38bdf8',
    description: 'أبيض ناصع مع تفاصيل سماوية تقنية راقية',
    previewColors: ['#ffffff', '#38bdf8'],
  },
  {
    id: 'emerald_knight',
    name: 'الزمردي الفاخر',
    primaryColor: '#ffffff',
    secondaryColor: '#34d399',
    description: 'أبيض وتفاصيل خضراء زمردية تبرز هوية الإعلان',
    previewColors: ['#ffffff', '#34d399'],
  },
];
