/**
 * Unified pin generator for all admin maps.
 * Design inspired by reference: size-colored teardrop body, status-colored inner core disc,
 * bold short label inside.
 */
import { getBillboardStatus, getSizeColor } from '@/hooks/useMapMarkers';

export interface UnifiedPinResult {
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

// Helper to darken/lighten colors
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount))
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
}

const shortLabelFor = (billboard: any): string => {
  if (billboard?.Status === 'temp_adding' || billboard?.status === 'temp_adding') {
    return '+';
  }
  const size = String(billboard?.Size || billboard?.size || '')
    .trim()
    .replace(/\s+/g, '')
    .replace('×', 'x')
    .replace('*', 'x');
  if (size) return size.slice(0, 5);
  return '·';
};

export function createUnifiedPin(billboard: any, isSelected = false): UnifiedPinResult {
  const status = getBillboardStatus(billboard);
  const isHidden = billboard?.is_visible_in_available === false;
  const isTemp = billboard?.Status === 'temp_adding' || billboard?.status === 'temp_adding';
  
  // Status colors matching standard conventions (for the central ring stroke)
  let statusColor = '#ef4444' // Default: Red (Rented/Reserved)
  let glow = '239,68,68'
  
  if (isTemp) {
    statusColor = '#06b6d4'; // Cyan core for temporary adding pin
    glow = '6,182,212';
  } else if (isHidden) {
    statusColor = '#94a3b8'
    glow = '148,163,184'
  } else if (status.label === 'متاحة' || status.label === 'متاح') {
    statusColor = '#22c55e'
    glow = '34,197,94'
  } else if (status.label === 'محجوزة' || status.label === 'محجوز' || status.label === 'قريباً' || status.label === 'مؤجرة' || status.label === 'مؤجر') {
    statusColor = '#ef4444' // Red (Reserved and rented are combined)
    glow = '239,68,68'
  } else if (status.label === 'صيانة' || status.label === 'تحتاج صيانة' || status.label === 'قيد الصيانة' || status.label === 'متضررة اللوحة') {
    statusColor = '#f59e0b' // Orange for maintenance
    glow = '245,158,11'
  } else if (status.label === 'إزالة') {
    statusColor = '#808080'
    glow = '128,128,128'
  } else if (status.label === 'خارج الخدمة') {
    statusColor = '#4b5563'
    glow = '75,85,99'
  }

  const showSeq = billboard?.sequence_number !== undefined && billboard?.sequence_number !== 999999;
  
  // Inside the pin core: always show size label (standard size behavior)
  const label = shortLabelFor(billboard);
  
  // Decide top badge content: in organizer show sequence number (e.g. "#1"), in normal mode show ad type
  const adTypeStr = String(
    billboard?.new_ad_type ||
    billboard?.contract?.['Ad Type'] ||
    billboard?.contract?.ad_type ||
    (Array.isArray(billboard?.contracts) && (billboard.contracts[0]?.['Ad Type'] || billboard.contracts[0]?.ad_type)) ||
    billboard?.Ad_Type ||
    billboard?.ad_type ||
    billboard?.adType ||
    billboard?.AdType ||
    ''
  ).trim();
  const topBadgeText = showSeq ? `#${billboard.sequence_number}` : adTypeStr;
  const showTopBadge = showSeq ? true : !!adTypeStr;
  const displayTopBadge = topBadgeText.length > 14 ? topBadgeText.slice(0, 12) + '..' : topBadgeText;

  // Size color resolving - body of the pin represents size color (dynamic)
  const sizeStr = billboard?.Size || billboard?.size || ''
  const sizeColor = getSizeColor(sizeStr);
  const start = isTemp ? '#6366f1' : sizeColor.bg; // Indigo body for temporary pin
  const end = isTemp ? '#4f46e5' : adjustColor(sizeColor.bg, -35);

  const W = isSelected ? 66 : 52;
  const H = isSelected ? 82 : 66;
  const cx = W / 2;
  const topPad = showTopBadge ? 16 : 4;
  const r = isSelected ? 23 : 19;
  const innerR = r - 4.5;
  const headCy = topPad + r;
  const tipY = H - 2;

  // teardrop path: circle blended into pointer
  const tailControl = r * 0.55;
  const path = `M ${cx - r} ${headCy}
    A ${r} ${r} 0 1 1 ${cx + r} ${headCy}
    C ${cx + r} ${headCy + tailControl}, ${cx + 4} ${tipY - 6}, ${cx} ${tipY}
    C ${cx - 4} ${tipY - 6}, ${cx - r} ${headCy + tailControl}, ${cx - r} ${headCy} Z`;

  const uid = `u${Math.abs((Number(billboard?.ID || billboard?.id || 0) * 31 + label.length) | 0)}`;

  const isFaded = billboard?.isFaded || billboard?.faded;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="b${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${start}"/>
        <stop offset="100%" stop-color="${end}"/>
      </linearGradient>
      <radialGradient id="g${uid}" cx="35%" cy="30%" r="60%">
        <stop offset="0%" stop-color="white" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </radialGradient>
      <filter id="s${uid}" x="-40%" y="-20%" width="180%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${isSelected ? 'rgba(245,158,11,0.75)' : 'rgba(0,0,0,0.45)'}"/>
      </filter>
    </defs>
    <g opacity="${isFaded ? '0.35' : '1'}">
      <!-- Pulsing Gold Ring when Selected -->
      ${isSelected ? `
        <circle cx="${cx}" cy="${headCy}" r="${r + 4}" fill="none" stroke="#f59e0b" stroke-width="2.5" opacity="0.85">
          <animate attributeName="r" values="${r + 3};${r + 11};${r + 3}" dur="1.6s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.6s" repeatCount="indefinite"/>
        </circle>` : ''}

      <ellipse cx="${cx}" cy="${tipY + 0.5}" rx="${r * 0.55}" ry="2.2" fill="rgba(0,0,0,0.3)"/>
      ${showTopBadge ? `
        <g>
          <rect x="${cx - 28}" y="0" width="56" height="14" rx="7" fill="#0a0a14" stroke="${isSelected ? '#f59e0b' : '#d6ac40'}" stroke-width="${isSelected ? '1.5' : '1'}"/>
          <text x="${cx}" y="10" text-anchor="middle" font-family="'Tajawal','Manrope',sans-serif" font-size="8.5" font-weight="900" fill="${isSelected ? '#fbbf24' : '#f4c25a'}">${displayTopBadge}</text>
        </g>` : ''}
      <g filter="url(#s${uid})" opacity="${isHidden ? '0.7' : '1'}">
        <path d="${path}" fill="url(#b${uid})" stroke="${isSelected ? '#fbbf24' : 'white'}" stroke-width="${isSelected ? 3.2 : 1.6}"/>
        <path d="${path}" fill="url(#g${uid})"/>
        <!-- Inner core (white fill with thick status-colored stroke border ring) -->
        <circle cx="${cx}" cy="${headCy}" r="${innerR}" fill="#ffffff" stroke="${statusColor}" stroke-width="${isSelected ? 3.4 : 2.8}"/>
        <text x="${cx}" y="${headCy + 3.4}" text-anchor="middle" font-family="'Manrope','Tajawal',sans-serif" font-size="${innerR > 11 ? 9.5 : 8.5}" font-weight="900" fill="#0f172a" letter-spacing="0.1">${label}</text>
      </g>
      ${status.label === 'متاحة' || status.label === 'متاح' ? `
        <circle cx="${cx}" cy="${headCy}" r="${r}" fill="none" stroke="rgba(${glow},0.5)" stroke-width="1.5">
          <animate attributeName="r" values="${r};${r + 6};${r}" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite"/>
        </circle>` : ''}
      ${isSelected ? `
        <circle cx="${cx + r - 3}" cy="${topPad + 3}" r="7.5" fill="#10b981" stroke="#ffffff" stroke-width="1.8"/>
        <path d="M ${cx + r - 7} ${topPad + 3} l 2.5 2.5 l 5 -5" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    </g>
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    width: W,
    height: H,
    anchorX: W / 2,
    anchorY: tipY,
  };
}

export function createUnifiedClusterSvg(count: number, size = 50): string {
  const display = count > 999 ? '999+' : count > 99 ? '99+' : String(count);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 50 50">
    <defs>
      <radialGradient id="cg" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#f4c25a"/>
        <stop offset="100%" stop-color="#b8860b"/>
      </radialGradient>
      <filter id="cs" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.5)"/>
      </filter>
    </defs>
    <g filter="url(#cs)">
      <circle cx="25" cy="25" r="23" fill="url(#cg)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
      <circle cx="25" cy="25" r="16" fill="#0a0f1a"/>
      <text x="25" y="29" text-anchor="middle" font-family="'Manrope','Tajawal',sans-serif" font-size="13" font-weight="900" fill="#f4c25a">${display}</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
