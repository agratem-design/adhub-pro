import type { FieldPhoto } from '@/hooks/useFieldPhotos';
import { supabase } from '@/integrations/supabase/client';

// SVG Icons as inline strings (colorable, no emoji)
const SVG_CAMERA = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
const SVG_CALENDAR = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;
const SVG_SMARTPHONE = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>`;
const SVG_MAP_PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
const SVG_CIRCLE = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
const SVG_SEARCH = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;
const SVG_COPY = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const SVG_ARROW_UP = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6" stroke="#3b82f6" stroke-width="2"><path d="M12 2l7 14H5z"/></svg>`;
const SVG_DIRECTION = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
const SVG_RULER = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>`;

// Global handler for inline slider updates safely via central client
if (typeof window !== 'undefined') {
  (window as any).__updateFieldPhotoOrbit = async (photoId: string, meters: number) => {
    const lbl = document.getElementById(`orbit-val-${photoId}`);
    if (lbl) {
      lbl.textContent = `${meters}m`;
      lbl.style.color = '#eab308';
    }
    try {
      const { error } = await supabase
        .from('field_photos' as any)
        .update({ orbit_radius_meters: meters })
        .eq('id', photoId);

      if (error) throw error;
      if (lbl) {
        lbl.style.color = '#22c55e';
        lbl.textContent = `${meters}m ✓`;
      }
    } catch (err) {
      console.error('Orbit update failed:', err);
      if (lbl) {
        lbl.style.color = '#ef4444';
        lbl.textContent = `${meters}m ✗`;
      }
    }
  };
}

/** Convert Hindi/Arabic-Indic digits to English digits */
function toEnglishDigits(str: string): string {
  return str
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0));
}

/** Format date as Gregorian + Hijri with English digits */
function formatDualDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const gregorian = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const hijri = toEnglishDigits(
      date.toLocaleDateString('ar-SA', { calendar: 'islamic', year: 'numeric', month: 'short', day: 'numeric' } as Intl.DateTimeFormatOptions)
    );
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${gregorian}<br/><span style="color:#f59e0b;font-size:10px;">${hijri}</span> ${time}`;
  } catch {
    return dateStr;
  }
}

/**
 * Create a circular photo marker icon as a data URL
 */
export function createCircularPhotoIcon(photoUrl: string, size: number = 48): Promise<string> {
  return new Promise((resolve) => {
    if (!photoUrl) {
      resolve(fallbackIcon(size));
      return;
    }

    const canvas = document.createElement('canvas');
    const borderWidth = 3;
    const totalSize = size + borderWidth * 2;
    canvas.width = totalSize;
    canvas.height = totalSize;
    const ctx = canvas.getContext('2d')!;

    const tryLoad = (useCors: boolean) => {
      const img = new Image();
      if (useCors) img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        ctx.beginPath();
        ctx.arc(totalSize / 2, totalSize / 2, totalSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(totalSize / 2, totalSize / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();

        const aspectRatio = img.width / img.height;
        let drawW = size, drawH = size;
        if (aspectRatio > 1) { drawH = size; drawW = size * aspectRatio; }
        else { drawW = size; drawH = size / aspectRatio; }
        const dx = (totalSize - drawW) / 2;
        const dy = (totalSize - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);

        try {
          resolve(canvas.toDataURL('image/png'));
        } catch {
          if (useCors) tryLoad(false);
          else resolve(fallbackIcon(size));
        }
      };
      img.onerror = () => {
        if (useCors) tryLoad(false);
        else resolve(fallbackIcon(size));
      };
      img.src = photoUrl;
    };

    tryLoad(true);
  });
}

function fallbackIcon(size: number): string {
  const borderWidth = 3;
  const totalSize = size + borderWidth * 2;
  const canvas = document.createElement('canvas');
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(totalSize / 2, totalSize / 2, totalSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(totalSize / 2, totalSize / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();
  // Draw a simple camera shape
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  const cx = totalSize / 2;
  const cy = totalSize / 2;
  const s = size * 0.18;
  ctx.beginPath();
  ctx.roundRect(cx - s * 1.4, cy - s * 0.6, s * 2.8, s * 1.8, 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.15, s * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  return canvas.toDataURL('image/png');
}

/** SVG camera icon HTML for use in divIcon fallback */
export const CAMERA_ICON_HTML = SVG_CAMERA;

/** SVG arrow icon HTML for direction markers */
export const ARROW_ICON_SVG = SVG_ARROW_UP;

/**
 * Build the HTML content for the photo info card (InfoWindow)
 */
export function buildPhotoInfoCard(photo: FieldPhoto): string {
  const directionArrow = photo.direction_degrees !== null
    ? `<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#3b82f620;border-radius:8px;font-size:12px;color:#3b82f6;">
        ${SVG_DIRECTION.replace('width="16"', 'width="14"').replace('height="16"', 'height="14"')}
        <span style="display:inline-block;transform:rotate(${photo.direction_degrees}deg);font-size:14px;">${SVG_ARROW_UP.replace('width="16"', 'width="12"').replace('height="16"', 'height="12"')}</span>
        ${Math.round(photo.direction_degrees!)}°
       </div>`
    : '';

  const deviceInfo = [photo.device_make, photo.device_model].filter(Boolean).join(' ') || 'Unknown';

  const capturedDate = photo.captured_at
    ? formatDualDate(photo.captured_at)
    : 'غير معروف';

  const zoomInfo = photo.zoom_ratio ? `${photo.zoom_ratio}x` : (photo.focal_length ? `${photo.focal_length}mm` : '');

  const safeFileName = (photo.file_name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');

  const orbitRadius = Number(photo.orbit_radius_meters) || (window as any).__globalOrbitRadius || 50;
  const photoId = photo.id;

  const coordsText = (photo.lat && photo.lng)
    ? `${Number(photo.lat).toFixed(6)}, ${Number(photo.lng).toFixed(6)}`
    : '';

  return `
    <div style="direction:rtl;font-family:Tahoma,Arial,sans-serif;width:300px;background:#1a1a2e;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
      <div style="position:relative;">
        <img src="${photo.bucket_url || ''}" style="width:100%;height:180px;object-fit:cover;" referrerpolicy="no-referrer" onerror="this.style.display='none'" />
        ${directionArrow ? `<div style="position:absolute;top:8px;left:8px;">${directionArrow}</div>` : ''}
        ${zoomInfo ? `<div style="position:absolute;top:8px;right:8px;background:#00000080;color:white;padding:2px 8px;border-radius:6px;font-size:11px;display:flex;align-items:center;gap:3px;">${SVG_SEARCH} ${zoomInfo}</div>` : ''}
      </div>
      <div style="padding:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:13px;font-weight:bold;color:#f5f5f5;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${safeFileName}">${safeFileName}</span>
          <button onclick="navigator.clipboard.writeText('${safeFileName}').then(function(){this.textContent='\\u2713';var b=this;setTimeout(function(){b.textContent='نسخ'},1500)}.bind(this))" 
                  style="background:#ffffff15;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:11px;color:white;transition:all 0.2s;display:flex;align-items:center;gap:4px;" 
                  title="نسخ اسم الصورة">${SVG_COPY} <span style="font-size:10px;">نسخ</span></button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;color:#a0a0b0;">
          <div style="display:flex;align-items:flex-start;gap:4px;grid-column:span 2;">
            ${SVG_CALENDAR}
            <span>${capturedDate}</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            ${SVG_SMARTPHONE}
            <span>${deviceInfo}</span>
          </div>
          ${coordsText ? `
          <div style="display:flex;align-items:center;gap:4px;">
            ${SVG_MAP_PIN}
            <span>${coordsText}</span>
          </div>` : ''}
        </div>
        <!-- Orbit radius calibration -->
        <div style="margin-top:10px;padding:8px;background:#ffffff08;border-radius:8px;">
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px;">
            ${SVG_RULER}
            <span style="font-size:11px;color:#8b5cf6;">قطر المدار</span>
            <span id="orbit-val-${photoId}" style="font-size:12px;color:#f5f5f5;font-weight:bold;margin-right:auto;">${Math.round(orbitRadius)}m</span>
          </div>
          <input type="range" min="10" max="500" step="5" value="${orbitRadius}" 
            id="orbit-slider-${photoId}"
            style="width:100%;accent-color:#8b5cf6;height:6px;cursor:pointer;"
            oninput="document.getElementById('orbit-val-${photoId}').textContent=this.value+'m';document.getElementById('orbit-val-${photoId}').style.color='#f5f5f5';window.dispatchEvent(new CustomEvent('orbit-radius-change',{detail:{photoId:'${photoId}',radius:Number(this.value)}}))"
            onchange="if(window.__updateFieldPhotoOrbit){window.__updateFieldPhotoOrbit('${photoId}', Number(this.value))}"
          />
          <div style="display:flex;justify-content:space-between;font-size:9px;color:#666;margin-top:2px;">
            <span>10m</span><span>500m</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Compute an endpoint given a start point, bearing (degrees), and distance (meters)
 */
export function computeDestination(
  lat: number, lng: number, bearingDeg: number, distanceMeters: number
): { lat: number; lng: number } {
  const R = 6371000;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const d = distanceMeters / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearingRad)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}
