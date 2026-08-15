import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { StickerSettings } from './MunicipalityStickerSettings';

interface StickerItem {
  sequence_number: number;
  billboard_name?: string;
  image_url?: string | null;
  latitude: number | null;
  longitude: number | null;
  nearest_landmark: string;
  location_text: string;
  size: string;
  municipality?: string;
}

export async function printStickers(
  items: StickerItem[],
  settings: StickerSettings,
  municipalityName: string,
) {
  if (items.length === 0) {
    toast.error('لا توجد لوحات للطباعة');
    return;
  }

  toast.info('جاري تجهيز الملصقات...');

  // Fetch municipality logo from DB if not overridden
  let muniLogoUrl = settings.municipalityLogoUrl;
  if (!muniLogoUrl && municipalityName) {
    try {
      const { data } = await supabase
        .from('municipalities')
        .select('logo_url')
        .eq('name', municipalityName)
        .maybeSingle();
      if (data?.logo_url) muniLogoUrl = data.logo_url;
    } catch { /* skip */ }
  }

  const w = settings.stickerWidth;
  const h = settings.stickerHeight;
  const sorted = [...items].sort((a, b) => a.sequence_number - b.sequence_number);

  const pages: string[] = [];

  for (const item of sorted) {
    const num = String(item.sequence_number).padStart(3, '0');
    const coords = item.latitude && item.longitude ? `${item.latitude},${item.longitude}` : '';

    // Generate QR
    let qrDataUrl = '';
    if (settings.showQrCode && coords) {
      const qrContent = [
        `رقم: ${item.sequence_number}`,
        item.nearest_landmark ? `أقرب نقطة: ${item.nearest_landmark}` : '',
        `https://www.google.com/maps?q=${encodeURIComponent(coords)}`,
      ].filter(Boolean).join('\n');
      try {
        qrDataUrl = await QRCode.toDataURL(qrContent, { width: settings.qrSizePx, margin: 1 });
      } catch { /* skip */ }
    }

    // Logo positions - use saved percentages
    const companyStyle = `top: ${settings.companyLogoTopPercent}%; left: ${settings.companyLogoLeftPercent}%;`;
    const muniStyle = `top: ${settings.municipalityLogoTopPercent}%; left: ${settings.municipalityLogoLeftPercent}%;`;

    // QR position - use saved percentages
    const qrPosStyle = `top: ${settings.qrTopPercent}%; left: ${settings.qrLeftPercent}%;`;

    // Contact section (opposite side of QR)
    const contactSide = settings.qrLeftPercent > 50 ? 'left: 5%' : 'right: 5%';

    pages.push(`
      <div class="sticker" style="width:${w}cm; height:${h}cm;">
        <div class="sticker-bg"></div>
        
        ${/* Company logo */''}
        ${settings.showCompanyLogo && settings.companyLogoUrl ? `
          <img src="${settings.companyLogoUrl}" class="logo-img" style="${companyStyle} width:${settings.companyLogoWidth}px;" onerror="this.style.display='none'" />
        ` : ''}

        ${/* Municipality logo */''}
        ${settings.showMunicipalityLogo && muniLogoUrl ? `
          <img src="${muniLogoUrl}" class="logo-img" style="${muniStyle} width:${settings.municipalityLogoWidth}px;" onerror="this.style.display='none'" />
        ` : ''}

        ${/* Municipality name */''}
        ${settings.showMunicipalityName && municipalityName ? `
          <div class="muni-name" style="font-size:${settings.municipalityNameFontSize}px; top:${settings.municipalityNameTopPercent}%; left:${settings.municipalityNameLeftPercent}%; color:${settings.municipalityNameColor};">
            بلدية ${municipalityName}
          </div>
        ` : ''}

        ${/* Billboard number */''}
        <div class="billboard-number" style="top:${settings.numberTopPercent}%; font-size:${settings.numberFontSize}px; color:${settings.numberColor};">
          ${num}
        </div>

        ${/* Billboard image */''}
        ${settings.showBillboardImage && item.image_url ? `
          <div class="billboard-image" style="top:${settings.imageTopPercent}%; width:${settings.imageWidthPercent}%; height:${settings.imageHeightPercent}%;">
            <img src="${item.image_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentElement.style.display='none'" />
          </div>
        ` : ''}

        ${/* QR Code */''}
        ${qrDataUrl ? `
          <div class="qr-box" style="${qrPosStyle}; width:${settings.qrSizePx}px; padding:${settings.qrPadding ?? 10}px; background:rgba(30,30,30,${(settings.qrBgOpacity ?? 85) / 100});">
            <img src="${qrDataUrl}" alt="QR" style="width:100%;height:auto;border-radius:8px;" />
          </div>
        ` : ''}

        ${/* Contact info */''}
        ${settings.showContactInfo ? `
          <div class="contact-box" style="${contactSide}; bottom: 5%;">
            ${settings.contactFacebook ? `
              <div class="contact-row">
                <div class="contact-icon fb">f</div>
                <div>
                  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Facebook</div>
                  <div style="font-size:11px;font-weight:800;direction:ltr;">${settings.contactFacebook}</div>
                </div>
              </div>
            ` : ''}
            ${settings.contactPhone ? `
              <div class="contact-row">
 <div class="contact-icon phone"></div>
                <div>
                  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Contact</div>
                  <div style="font-size:13px;font-weight:800;direction:ltr;">${settings.contactPhone}</div>
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${/* Landmark */''}
        ${settings.showLandmark && item.nearest_landmark ? `
          <div class="landmark-text" style="bottom:${settings.landmarkBottomPercent}%; left:${settings.landmarkLeftPercent}%; font-size:${settings.landmarkFontSize}px; color:${settings.landmarkColor ?? '#666'};">${item.nearest_landmark}${item.municipality ? ' - ' + item.municipality : ''}</div>
        ` : ''}

        ${(settings.showSizeLabel ?? true) && item.size ? `
          <div class="size-label" style="top:${settings.sizeLabelTopPercent ?? 25}%; left:${settings.sizeLabelLeftPercent ?? 50}%; font-size:${settings.sizeLabelFontSize ?? 14}px; color:${settings.sizeLabelColor ?? '#555'};">${item.size}</div>
        ` : ''}
      </div>
    `);
  }

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>ملصقات - ${sorted.length} لوحة</title>
  <style>
    @font-face { font-family:'Manrope'; src:url('/Manrope-Bold.otf') format('opentype'); font-weight:700; }
    @font-face { font-family:'Doran'; src:url('/Doran-Bold.otf') format('opentype'); font-weight:700; }
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { background:#e0e0e0; font-family:'Doran','Noto Sans Arabic',Arial,sans-serif; }
    .sticker {
      position:relative; overflow:hidden; margin:0 auto;
      border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.15);
      page-break-after:always; page-break-inside:avoid;
    }
    .sticker:last-child { page-break-after:auto; }
    .sticker-bg {
      position:absolute; top:0; left:0; right:0; bottom:0;
      background-color:${settings.backgroundColor};
      ${settings.backgroundUrl ? `background-image:url('${settings.backgroundUrl}'); background-size:cover; background-position:center;` : ''}
      z-index:0;
    }
    .logo-img { position:absolute; z-index:5; height:auto; object-fit:contain; }
    .muni-name {
      position:absolute; transform:translateX(-50%);
      z-index:5; font-weight:700; white-space:nowrap;
      text-align:center; width:60%;
    }
    .billboard-number {
      position:absolute; left:50%; transform:translate(-50%,-50%);
      z-index:5; font-weight:900; text-align:center;
      font-family:'Manrope','Arial Black',sans-serif;
      line-height:1; letter-spacing:-2px;
    }
    .billboard-image {
      position:absolute; left:50%; transform:translateX(-50%);
      z-index:5; overflow:hidden;
    }
    .qr-box {
      position:absolute; z-index:5; transform:translate(-50%,-50%);
      background:rgba(30,30,30,0.85); padding:10px; border-radius:12px;
    }
    .contact-box { position:absolute; z-index:5; display:flex; flex-direction:column; gap:6px; }
    .contact-row { display:flex; align-items:center; gap:8px; color:#222; }
    .contact-icon {
      width:32px; height:32px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-weight:900; font-size:16px; color:white; flex-shrink:0;
    }
    .contact-icon.fb { background:#1877f2; font-family:Arial; }
    .contact-icon.phone { background:#333; font-size:18px; }
    .landmark-text {
      position:absolute; transform:translateX(-50%);
      z-index:5; color:#666; text-align:center;
      padding:2px 12px;
      max-width:90%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .size-label {
      position:absolute; transform:translateX(-50%);
      z-index:5; text-align:center; font-weight:700;
      white-space:nowrap;
    }
    @page { size:${w}cm ${h}cm; margin:0; padding:0; }
    @media print {
      html,body { background:white; margin:0; padding:0; width:${w}cm; height:${h}cm; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
      .sticker { margin:0; padding:0; box-shadow:none; border-radius:0; width:${w}cm!important; height:${h}cm!important; }
    }
  </style>
</head>
<body>
  ${pages.join('\n')}
  <script>
    window.onload = function() { setTimeout(function(){ window.print(); }, 800); };
  </script>
</body>
</html>`;

  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  showPrintPreview(html, `ملصقات بلدية (${sorted.length})`);
  toast.success(`تم تحضير ${sorted.length} ملصق للطباعة`);
}
