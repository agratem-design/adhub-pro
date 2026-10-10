/**
 * دبوس الخريطة الموحد لكل خرائط النظام.
 * لون الدبوس = حالة اللوحة (متاح أخضر، مؤجر أحمر، محجوز كهرماني، صيانة رمادي)،
 * وداخله قرص أبيض يحمل المقاس. التحديد = إطار ذهبي وحجم أكبر قليلاً، بلا حركات.
 */
import { getBillboardStatus } from '@/hooks/useMapMarkers';
import { statusKeyFromLabel, STATUS_PALETTE } from '@/lib/billboardStatusPalette';

export interface UnifiedPinResult {
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

const shortLabelFor = (billboard: any): string => {
  if (billboard?.Status === 'temp_adding' || billboard?.status === 'temp_adding') return '+';
  const size = String(billboard?.Size || billboard?.size || '')
    .trim().replace(/\s+/g, '').replace('×', 'x').replace('*', 'x');
  return size ? size.slice(0, 5) : '·';
};

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const pinCache = new Map<string, UnifiedPinResult>();
let pinSeq = 0;

export function createUnifiedPin(billboard: any, isSelected = false): UnifiedPinResult {
  const cacheKey = [
    getBillboardStatus(billboard).label, billboard?.is_visible_in_available === false ? 'h' : '',
    billboard?.Status === 'temp_adding' || billboard?.status === 'temp_adding' ? 't' : '',
    billboard?.organizerColor || '', billboard?.sequence_number ?? '', billboard?.isFaded || billboard?.faded ? 'f' : '',
    shortLabelFor(billboard), isSelected ? 's' : '',
  ].join('|');
  const cached = pinCache.get(cacheKey);
  if (cached) return cached;
  const built = buildUnifiedPin(billboard, isSelected);
  if (pinCache.size > 2000) pinCache.clear();
  pinCache.set(cacheKey, built);
  return built;
}

function buildUnifiedPin(billboard: any, isSelected = false): UnifiedPinResult {
  const status = getBillboardStatus(billboard);
  const isHidden = billboard?.is_visible_in_available === false;
  const isTemp = billboard?.Status === 'temp_adding' || billboard?.status === 'temp_adding';
  const customColor = typeof billboard?.organizerColor === 'string' && /^#[0-9a-f]{6}$/i.test(billboard.organizerColor) ? billboard.organizerColor : null;

  const key = statusKeyFromLabel(status.label);
  const body = customColor || (isTemp ? '#0891b2' : isHidden ? '#94a3b8' : STATUS_PALETTE[key].hex);

  const showSeq = billboard?.sequence_number !== undefined && billboard?.sequence_number !== 999999;
  const label = esc(shortLabelFor(billboard));
  const isFaded = billboard?.isFaded || billboard?.faded;

  const W = isSelected ? 50 : 42;
  const topPad = showSeq ? 15 : 3;
  const r = isSelected ? 19 : 16;
  const H = topPad + r * 2 + 14;
  const cx = W / 2;
  const headCy = topPad + r;
  const tipY = H - 2;
  const innerR = r - 4;
  const path = `M ${cx - r} ${headCy} A ${r} ${r} 0 1 1 ${cx + r} ${headCy} C ${cx + r} ${headCy + r * 0.6}, ${cx + 3} ${tipY - 5}, ${cx} ${tipY} C ${cx - 3} ${tipY - 5}, ${cx - r} ${headCy + r * 0.6}, ${cx - r} ${headCy} Z`;
  const uid = `p${(pinSeq++).toString(36)}`;
  const fontSize = label.length > 4 ? 7.5 : 8.5;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <filter id="${uid}" x="-40%" y="-20%" width="180%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.8" flood-color="rgba(0,0,0,0.45)"/>
      </filter>
    </defs>
    <g opacity="${isFaded ? '0.35' : isHidden ? '0.75' : '1'}">
      ${showSeq ? `<rect x="${cx - 16}" y="0" width="32" height="13" rx="6.5" fill="#0f172a" stroke="#d6ac40" stroke-width="1"/>
      <text x="${cx}" y="9.5" text-anchor="middle" font-family="'Manrope','Tajawal',sans-serif" font-size="8.5" font-weight="800" fill="#f4c25a">#${billboard.sequence_number}</text>` : ''}
      <g filter="url(#${uid})">
        <path d="${path}" fill="${body}" stroke="${isSelected ? '#f4c25a' : '#ffffff'}" stroke-width="${isSelected ? 3 : 1.5}"/>
        <circle cx="${cx}" cy="${headCy}" r="${innerR}" fill="#ffffff"/>
        <text x="${cx}" y="${headCy + 3}" text-anchor="middle" font-family="'Manrope','Tajawal',sans-serif" font-size="${fontSize}" font-weight="800" fill="#0f172a">${label}</text>
      </g>
      ${isSelected ? `<circle cx="${cx + r - 2}" cy="${topPad + 2}" r="6" fill="#f4c25a" stroke="#0f172a" stroke-width="1.2"/>
      <path d="M ${cx + r - 5} ${topPad + 2} l 2 2 l 4 -4" stroke="#0f172a" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    </g>
  </svg>`;

  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, width: W, height: H, anchorX: W / 2, anchorY: tipY };
}

export function createUnifiedClusterSvg(count: number, size = 44): string {
  const display = count > 999 ? '999+' : count > 99 ? '99+' : String(count);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 44 44">
    <defs><filter id="cs" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.45)"/></filter></defs>
    <g filter="url(#cs)">
      <circle cx="22" cy="22" r="20" fill="#0f172a" stroke="#d6ac40" stroke-width="2.5"/>
      <text x="22" y="26.5" text-anchor="middle" font-family="'Manrope','Tajawal',sans-serif" font-size="13" font-weight="800" fill="#f4c25a">${display}</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
