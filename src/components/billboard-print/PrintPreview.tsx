import { useState, useEffect, useRef, useMemo } from 'react';
import { PrintCustomizationSettings } from '@/hooks/usePrintCustomization';
import QRCode from 'qrcode';
import DOMPurify from 'dompurify';
import { supabase } from '@/integrations/supabase/client';
import { formatFacesCountArabic } from '@/lib/utils';

interface BillboardData {
  ID: number;
  Billboard_Name?: string;
  Size?: string;
  Faces_Count?: number;
  Municipality?: string;
  District?: string;
  Nearest_Landmark?: string;
  Image_URL?: string;
  GPS_Coordinates?: string;
  GPS_Link?: string;
  has_cutout?: boolean;
  design_face_a?: string;
  design_face_b?: string;
  cutout_image_url?: string;
  installed_image_url?: string;
  installed_image_face_a_url?: string;
  installed_image_face_b_url?: string;
  installation_date?: string;
  faces_to_install?: number;
  maintenance_status?: string;
}

interface PrintPreviewProps {
  settings: PrintCustomizationSettings;
  billboard?: BillboardData | null;
  contractNumber?: number;
  customerName?: string;
  adType?: string;
  previewTarget?: 'customer' | 'team' | 'installation';
  scale?: number;
  selectedElement?: string | null;
  onElementClick?: (elementKey: string) => void;
  hideBackground?: boolean;
  backgroundUrl?: string;
  includeDesigns?: boolean;
  teamName?: string;
}

/**
 * PrintPreview - معاينة موحدة تستخدم نفس HTML المستخدم في الطباعة الفعلية
 * يعتمد على إعدادات usePrintCustomization (جدول billboard_print_customization)
 */
export function PrintPreview({
  settings: s,
  billboard,
  contractNumber,
  customerName,
  adType,
  previewTarget = 'team',
  scale = 0.4,
  selectedElement,
  onElementClick,
  hideBackground = false,
  backgroundUrl = '/ipg.svg',
  includeDesigns = true,
  teamName = '',
}: PrintPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('maintenance_statuses').select('name,label');
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.name] = s.label || s.name; });
      setStatusLabels(map);
    })();
  }, []);

  // توليد QR Code
  useEffect(() => {
    const generateQR = async () => {
      if (!billboard?.GPS_Link && !billboard?.GPS_Coordinates) {
        setQrCodeUrl('');
        return;
      }
      try {
        const qrContent = billboard.GPS_Link || 
          `https://www.google.com/maps?q=${billboard.GPS_Coordinates}`;
        const url = await QRCode.toDataURL(qrContent, { width: 200, margin: 1 });
        setQrCodeUrl(url);
      } catch (err) {
        console.error('QR generation failed:', err);
      }
    };
    generateQR();
  }, [billboard]);

  // Smart face logic
  const faceLogic = useMemo(() => {
    if (!billboard) return { showFaceB: false, effectiveDesignA: null, effectiveDesignB: null, effectiveInstalledA: null, effectiveInstalledB: null, mainImage: '', hasDesigns: false, statusFlags: { noDesign: false, singleDesign: false, singleFaceInstall: false } };
    
    const facesCount = billboard.Faces_Count || 1;
    const facesToInstall = billboard.faces_to_install ?? facesCount;
    const isSingleFaceInstall = facesCount > 1 && facesToInstall === 1;
    const effectiveFaces = isSingleFaceInstall ? 1 : facesCount;
    const isSingleFace = effectiveFaces === 1;
    
    const hasDesignA = !!billboard.design_face_a;
    const hasDesignB = !!billboard.design_face_b;
    const hasInstalledA = !!billboard.installed_image_face_a_url;
    const hasInstalledB = !!billboard.installed_image_face_b_url;
    
    const showFaceB = !isSingleFace;
    const effectiveDesignA = hasDesignA ? billboard.design_face_a : null;
    const effectiveDesignB = showFaceB && hasDesignB ? billboard.design_face_b : null;
    const effectiveInstalledA = hasInstalledA ? billboard.installed_image_face_a_url : null;
    const effectiveInstalledB = showFaceB && hasInstalledB ? billboard.installed_image_face_b_url : null;
    
    const mainImage = (effectiveInstalledA && !effectiveInstalledB) 
      ? effectiveInstalledA 
      : (billboard.Image_URL || '');
    
    const hasDesigns = !!(effectiveDesignA || effectiveDesignB);
    
    // Status flags
    const noDesign = !hasDesignA && !hasDesignB;
    const singleDesign = (hasDesignA && !hasDesignB) || (!hasDesignA && hasDesignB);
    
    return { showFaceB, effectiveDesignA, effectiveDesignB, effectiveInstalledA, effectiveInstalledB, mainImage, hasDesigns, statusFlags: { noDesign, singleDesign, singleFaceInstall: isSingleFaceInstall } };
  }, [billboard]);

  // بناء HTML مطابق 100% للطباعة الفعلية
  const pageHTML = useMemo(() => {
    if (!billboard) return '';
    
    const { effectiveDesignA, effectiveDesignB, effectiveInstalledA, effectiveInstalledB, mainImage, hasDesigns, statusFlags } = faceLogic;
    
    const name = billboard.Billboard_Name || `لوحة ${billboard.ID}`;
    const municipality = billboard.Municipality || '';
    const district = billboard.District || '';
    const landmark = billboard.Nearest_Landmark || '';
    const size = billboard.Size || '';
    const facesCount = billboard.Faces_Count || 1;
    const municipalityDistrict = [municipality, district].filter(Boolean).join(' - ') || '—';
    
    const installationDate = billboard.installation_date 
      ? new Date(billboard.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : '';
    
    const itemAdType = adType || '';
    const itemContractNumber = contractNumber || '';

    // highlight selected element
    const hl = (key: string) => selectedElement === key ? 'outline: 2px dashed #3b82f6; outline-offset: 2px; cursor: pointer;' : 'cursor: pointer;';

    let html = `<div class="page">`;
    
    if (!hideBackground) {
      html += `<div class="background" style="background-image: url('${backgroundUrl}');"></div>`;
    }

    // Helper: offset for right-anchored fields (adjust right value)
    const rightOffset = (rightVal: string, offsetX?: string) =>
      offsetX && offsetX !== '0mm' && offsetX !== '0' ? `calc(${rightVal} - ${offsetX})` : rightVal;
    // Helper: offset for centered fixed-width fields (inject into calc)
    const centerOffset = (offsetX?: string) =>
      offsetX && offsetX !== '0mm' && offsetX !== '0' ? ` + ${offsetX}` : '';

    // رقم العقد ونوع الإعلان
    html += `
      <div class="absolute-field contract-number" data-element-key="contractNumber" style="top: ${s.contract_number_top}; right: ${rightOffset(s.contract_number_right, s.contract_number_offset_x)}; font-size: ${s.contract_number_font_size}; font-weight: ${s.contract_number_font_weight}; color: ${s.contract_number_color}; max-width: 60%; overflow: hidden; text-overflow: ellipsis; ${hl('contractNumber')}">
        عقد رقم: ${itemContractNumber}${itemAdType ? ' - نوع الإعلان: ' + itemAdType : ''}
      </div>
    `;

    // تاريخ التركيب
    if (installationDate) {
      html += `
        <div class="absolute-field installation-date" data-element-key="installationDate" style="top: ${s.installation_date_top}; right: ${rightOffset(s.installation_date_right, s.installation_date_offset_x)}; font-family: '${s.primary_font}', Arial, sans-serif; font-size: ${s.installation_date_font_size}; font-weight: 400; ${hl('installationDate')}">
          تاريخ التركيب: ${installationDate}
        </div>
      `;
    }

    // اسم اللوحة
    html += `
      <div class="absolute-field billboard-name" data-element-key="billboardName" style="top: ${s.billboard_name_top}; left: calc(${s.billboard_name_left} - 60mm${centerOffset(s.billboard_name_offset_x)}); width: 120mm; text-align: center; font-size: ${s.billboard_name_font_size}; font-weight: ${s.billboard_name_font_weight}; color: ${s.billboard_name_color}; ${hl('billboardName')}">
        ${name}
      </div>
    `;

    // حالة اللوحة أسفل الاسم
    const mStatusKey = (billboard.maintenance_status || '').toString().trim();
    const showBillboardStatus = (s as any).billboard_status_enabled === 'true' && mStatusKey;
    if (showBillboardStatus) {
      const statusLabel = statusLabels[mStatusKey] || mStatusKey;
      const statusFontSize = (s as any).billboard_status_font_size || '14px';
      const statusOffsetY = (s as any).billboard_status_offset_y || '6mm';
      html += `
        <div class="absolute-field billboard-status" data-element-key="billboardStatus" style="top: calc(${s.billboard_name_top} + ${s.billboard_name_font_size} + ${statusOffsetY}); left: calc(${s.billboard_name_left} - 60mm${centerOffset(s.billboard_name_offset_x)}); width: 120mm; text-align: center; font-size: ${statusFontSize}; font-weight: 600; color: #000; ${hl('billboardStatus')}">
          ${statusLabel}
        </div>
      `;
    }

    // المقاس
    html += `
      <div class="absolute-field size" data-element-key="size" style="top: ${s.size_top}; left: calc(${s.size_left} - 40mm${centerOffset(s.size_offset_x)}); width: 80mm; text-align: center; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight}; color: ${s.size_color}; ${hl('size')}">
        ${size}
      </div>
    `;

    // عدد الأوجه - يتبع موضع المقاس أفقياً، ويُزاح أسفله بمقدار faces_count_top
    html += `
      <div class="absolute-field faces-count" data-element-key="facesCount" style="top: calc(${s.size_top} + ${s.faces_count_top}); left: calc(${s.size_left} - 40mm${centerOffset(s.size_offset_x)}); width: 80mm; text-align: center; font-size: ${s.faces_count_font_size}; color: ${s.faces_count_color}; ${hl('facesCount')}">
        ${billboard.has_cutout ? 'مجسم - ' : ''}${formatFacesCountArabic(facesCount)}
      </div>
    `;

    // نوع الطباعة (فريق التركيب)
    if (previewTarget === 'installation') {
      html += `
        <div class="absolute-field print-type" data-element-key="teamName" style="top: ${s.team_name_top}; right: ${rightOffset(s.team_name_right, s.team_name_offset_x)}; font-size: ${s.team_name_font_size}; color: #000; font-weight: ${s.team_name_font_weight}; ${hl('teamName')}">
          فريق التركيب: ${teamName || 'فريق التركيب'}
        </div>
      `;
    }

    // صور التركيب / صورة اللوحة
    if (effectiveInstalledA && effectiveInstalledB) {
      html += `
        <div class="absolute-field" data-element-key="installedImages" style="top: ${s.installed_images_top}; left: calc(${s.installed_images_left} - ${s.installed_images_width} / 2); width: ${s.installed_images_width}; display: flex; gap: ${s.installed_images_gap}; ${hl('installedImages')}">
          <div style="flex: 1; text-align: center;">
            <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">التركيب - الوجه الأمامي</div>
            <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <img src="${effectiveInstalledA}" alt="التركيب - الوجه الأمامي" style="max-width: 100%; max-height: 100%; width: auto; height: auto; display: block;" />
            </div>
          </div>
          <div style="flex: 1; text-align: center;">
            <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">التركيب - الوجه الخلفي</div>
            <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <img src="${effectiveInstalledB}" alt="التركيب - الوجه الخلفي" style="max-width: 100%; max-height: 100%; width: auto; height: auto; display: block;" />
            </div>
          </div>
        </div>
      `;
    } else if (effectiveInstalledA) {
      html += `
        <div class="absolute-field image-container" data-element-key="mainImage" style="top: ${s.main_image_top}; left: calc(${s.main_image_left} - ${s.main_image_width} / 2); width: ${s.main_image_width}; height: ${includeDesigns && hasDesigns ? s.installed_image_height : s.main_image_height}; ${hl('mainImage')}">
          <img src="${effectiveInstalledA}" alt="صورة التركيب" class="billboard-image" />
        </div>
      `;
    } else if (mainImage) {
      html += `
        <div class="absolute-field image-container" data-element-key="mainImage" style="top: ${s.main_image_top}; left: calc(${s.main_image_left} - ${s.main_image_width} / 2); width: ${s.main_image_width}; height: ${includeDesigns && hasDesigns ? s.installed_image_height : s.main_image_height}; ${hl('mainImage')}">
          <img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" />
        </div>
      `;
    }

    // البلدية - الحي
    html += `
      <div class="absolute-field location-info" data-element-key="locationInfo" style="top: ${s.location_info_top}; left: calc(${s.location_info_left || '0mm'} + ${s.location_info_offset_x || '0mm'}); width: ${s.location_info_width}; font-size: ${s.location_info_font_size}; color: ${s.location_info_color}; text-align: ${s.location_info_alignment}; ${hl('locationInfo')}">
        ${municipalityDistrict}
      </div>
    `;

    // أقرب معلم
    html += `
      <div class="absolute-field landmark-info" data-element-key="landmarkInfo" style="top: ${s.landmark_info_top}; left: calc(${s.landmark_info_left || '0mm'} + ${s.landmark_info_offset_x || '0mm'}); width: ${s.landmark_info_width}; font-size: ${s.landmark_info_font_size}; color: ${s.landmark_info_color}; text-align: ${s.landmark_info_alignment}; ${hl('landmarkInfo')}">
        ${landmark || '—'}
      </div>
    `;

    // QR Code
    if (qrCodeUrl) {
      html += `
        <div class="absolute-field qr-container" data-element-key="qrCode" style="top: ${s.qr_top}; left: ${s.qr_left}; width: ${s.qr_size}; height: ${s.qr_size}; ${hl('qrCode')}">
          <img src="${qrCodeUrl}" alt="QR" class="qr-code" />
        </div>
      `;
    }

    // التصاميم
    if (includeDesigns && hasDesigns) {
      html += `
        <div class="absolute-field designs-section" data-element-key="designs" style="top: ${s.designs_top}; left: ${s.designs_left}; width: ${s.designs_width}; display: flex; flex-direction: row; gap: ${s.designs_gap}; align-items: flex-start; justify-content: center; ${hl('designs')}">
          ${effectiveDesignA ? `
            <div class="design-item" ${!effectiveDesignB ? 'style="max-width: 60%;"' : ''}>
              <div class="design-label">${effectiveDesignB ? 'تصميم الوجه الأمامي' : 'التصميم'}</div>
              <img src="${effectiveDesignA}" alt="التصميم" class="design-image" style="max-height: ${s.design_image_height};" />
            </div>
          ` : ''}
          ${effectiveDesignB ? `
            <div class="design-item" ${!effectiveDesignA ? 'style="max-width: 60%;"' : ''}>
              <div class="design-label">${effectiveDesignA ? 'تصميم الوجه الخلفي' : 'التصميم'}</div>
              <img src="${effectiveDesignB}" alt="التصميم" class="design-image" style="max-height: ${s.design_image_height};" />
            </div>
          ` : ''}
        </div>
      `;
    }

    // شارات الحالة (بدون تصميم / تصميم واحد / وجه واحد)
    const statusBadges: string[] = [];
    if (statusFlags.noDesign) {
 statusBadges.push(`<span class="status-badge status-no-design" data-element-key="statusBadges" style="${hl('statusBadges')}"> بدون تصميم</span>`);
    }
    if (statusFlags.singleDesign) {
      statusBadges.push(`<span class="status-badge status-single-design" data-element-key="statusBadges" style="${hl('statusBadges')}">◐ تصميم واحد</span>`);
    }
    if (statusFlags.singleFaceInstall) {
      statusBadges.push(`<span class="status-badge status-single-face" data-element-key="statusBadges" style="${hl('statusBadges')}">① تركيب وجه واحد</span>`);
    }
    
    if (statusBadges.length > 0 && s.status_badges_show !== 'false') {
      html += `
        <div class="absolute-field status-badges-container" data-element-key="statusBadges" style="top: ${s.status_badges_top || '75mm'}; left: ${s.status_badges_left || '50%'}; transform: translateX(-50%); display: flex; gap: 4mm; justify-content: center; z-index: 10; ${hl('statusBadges')}">
          ${statusBadges.join('')}
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }, [billboard, s, qrCodeUrl, faceLogic, selectedElement, hideBackground, backgroundUrl, includeDesigns, previewTarget, teamName, contractNumber, adType, statusLabels]);

  // CSS مطابق 100% للطباعة الفعلية
  const fullHTML = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <style>
          @font-face {
            font-family: 'Doran';
            src: url('/Doran-Medium.otf') format('opentype');
            font-weight: 500;
          }
          @font-face {
            font-family: 'Doran';
            src: url('/Doran-Bold.otf') format('opentype');
            font-weight: 700;
          }
          @font-face {
            font-family: 'Manrope';
            src: url('/Manrope-Medium.otf') format('opentype');
            font-weight: 500;
          }
          @font-face {
            font-family: 'Manrope';
            src: url('/Manrope-Bold.otf') format('opentype');
            font-weight: 700;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            font-family: '${s.primary_font}', Arial, sans-serif;
            direction: rtl;
            background: transparent;
            color: #000;
            overflow: hidden;
          }
          .page {
            position: relative;
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          .background {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-size: 210mm 297mm;
            background-repeat: no-repeat;
            z-index: 0;
          }
          .absolute-field {
            position: absolute;
            z-index: 5;
            color: #000;
            font-family: '${s.primary_font}', Arial, sans-serif;
          }
          .billboard-name {
            font-family: '${s.primary_font}', Arial, sans-serif;
          }
          .size {
            font-family: '${s.secondary_font}', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .print-size-container { display: inline-flex; align-items: center; justify-content: center; gap: 0.12em; direction: rtl; color: inherit; white-space: nowrap; }
          .print-dim-col { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; color: inherit; }
          .print-dim-label { font-size: 0.6em; opacity: 0.8; margin-bottom: 2px; }
          .print-dim-value { font-weight: inherit; }
          .print-dim-separator { margin: 0 0.1em; opacity: 0.7; }
          .contract-number {
            font-family: '${s.primary_font}', Arial, sans-serif;
          }
          .location-info, .landmark-info {
            font-family: '${s.primary_font}', Arial, sans-serif;
          }
          .image-container {
            overflow: hidden;
            background: rgba(255,255,255,0.8);
            border: 3px solid #000;
            border-radius: 0 0 0 8px;
          }
          .billboard-image {
            width: 100%; height: 100%;
            object-fit: contain;
            display: block;
          }
          .qr-code {
            width: 100%; height: 100%;
            object-fit: contain;
          }
          .designs-section { flex-wrap: wrap; }
          .design-item {
            flex: 1;
            min-width: 70mm;
            text-align: center;
          }
          .design-label {
            font-family: '${s.primary_font}', Arial, sans-serif;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 4px;
            color: #333;
          }
          .design-image {
            width: 100%;
            height: auto;
            object-fit: contain;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .status-badges-container {
            font-family: '${s.primary_font}', Arial, sans-serif;
          }
          .status-badge {
            display: inline-block;
            padding: 2mm 4mm;
            border-radius: 4px;
            font-size: ${s.status_badges_font_size || '11px'};
            font-weight: 600;
            white-space: nowrap;
          }
          .status-no-design {
            background: #fef2f2;
            color: #dc2626;
            border: 1px solid #fca5a5;
          }
          .status-single-design {
            background: #fffbeb;
            color: #d97706;
            border: 1px solid #fcd34d;
          }
          .status-single-face {
            background: #eff6ff;
            color: #2563eb;
            border: 1px solid #93c5fd;
          }
          [data-element-key]:hover {
            outline: 2px dashed #93c5fd !important;
            outline-offset: 2px !important;
          }
        </style>
      </head>
      <body>${pageHTML}</body>
      </html>
    `;
  }, [pageHTML, s.primary_font, s.secondary_font]);

  // كتابة HTML في iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    
    const doc = iframe.contentDocument;
    if (!doc) return;
    
    doc.open();
    doc.write(fullHTML);
    doc.close();

    // إضافة event listener للنقر على العناصر
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const el = target.closest('[data-element-key]');
      if (el && onElementClick) {
        onElementClick(el.getAttribute('data-element-key')!);
      }
    };
    
    doc.addEventListener('click', handleClick);
    return () => {
      doc.removeEventListener('click', handleClick);
    };
  }, [fullHTML, onElementClick]);

  return (
    <div 
      className="relative overflow-hidden bg-muted/30 rounded-lg border"
      style={{ 
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <iframe
        ref={iframeRef}
        title="print-preview"
        style={{
          width: '210mm',
          height: '297mm',
          border: 'none',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          background: 'white',
        }}
      />
    </div>
  );
}