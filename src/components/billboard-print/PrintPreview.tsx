import { useState, useEffect, useRef, useMemo } from 'react';
import { PrintCustomizationSettings } from '@/hooks/usePrintCustomization';
import QRCode from 'qrcode';
import DOMPurify from 'dompurify';
import { supabase } from '@/integrations/supabase/client';
import { formatFacesCountArabic } from '@/lib/utils';
import { resolvePrintCardLayout, fitPrintCardText, isTemplateBackground } from '@/lib/printCardLayout';

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
  /** نص «الإعلان السابق» للمعاينة (كما يظهر عند تفعيله في طباعة الكل) */
  previousAd?: string;
  /** عرض مصغّر بحجم ثابت (لعرض جميع الحالات) */
  compact?: boolean;
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
  previousAd = '',
  compact = false,
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

  // ✅ بناء HTML بنفس منطق «طباعة الكل» حرفياً: نفس حساب المواقع (resolvePrintCardLayout) ونفس الأنماط
  const pageHTML = useMemo(() => {
    if (!billboard) return '';
    const { effectiveDesignA, effectiveDesignB, effectiveInstalledA, effectiveInstalledB, mainImage, hasDesigns } = faceLogic;

    const name = billboard.Billboard_Name || `لوحة ${billboard.ID}`;
    const municipalityDistrict = [billboard.Municipality || '', billboard.District || ''].filter(Boolean).join(' - ') || '—';
    const landmark = billboard.Nearest_Landmark || '';
    const size = billboard.Size || '';
    const facesCount = billboard.Faces_Count || 1;
    const installationDate = billboard.installation_date
      ? new Date(billboard.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : '';
    const contractInfoText = [
      contractNumber ? `عقد رقم: ${contractNumber}` : '',
      customerName ? `الزبون: ${customerName}` : '',
      adType ? `نوع الإعلان: ${adType}` : '',
    ].filter(Boolean).join(' - ');

    const hl = (key: string) => selectedElement === key ? 'outline: 2px dashed #3b82f6; outline-offset: 2px; cursor: pointer;' : 'cursor: pointer;';
    const toCssLength = (value?: string) => {
      const raw = String(value ?? '').trim();
      if (!raw) return '0mm';
      if (/^-?\d+(\.\d+)?$/.test(raw)) return `${raw}mm`;
      return raw;
    };
    const sizeHtml = (() => {
      const nums = String(size).match(/\d+(?:\.\d+)?/g) || [];
      if (nums.length < 2) return size;
      const [l, w] = nums;
      const labels = (s as any).show_size_dimension_labels === 'true';
      return `<div class="print-size-container"><div class="print-dim-col">${labels ? '<div class="print-dim-label">طول</div>' : ''}<div class="print-dim-value">${l}</div></div><div class="print-dim-separator">×</div><div class="print-dim-col">${labels ? '<div class="print-dim-label">عرض</div>' : ''}<div class="print-dim-value">${w}</div></div></div>`;
    })();

    const isDesignsIncluded = Boolean(includeDesigns && hasDesigns);
    const pairedImages = Boolean(effectiveInstalledA && effectiveInstalledB);
    const layout = resolvePrintCardLayout(s as any, {
      templateZones: isTemplateBackground(backgroundUrl),
      hasDesigns: isDesignsIncluded,
      pairedImages,
      dimensionLabels: (s as any).show_size_dimension_labels === 'true',
      size,
    });
    const allowedImageHeight = `${layout.imageHeight}mm`;
    const maxAllowedWidth = `${layout.imageWidth}mm`;
    const singleImage = effectiveInstalledA && !effectiveInstalledB ? effectiveInstalledA : mainImage;

    const mStatusKey = (billboard.maintenance_status || '').toString().trim();
    const showBillboardStatus = (s as any).billboard_status_enabled === 'true' && mStatusKey;
    const statusFontSize = (s as any).billboard_status_font_size || '14px';
    const statusOffsetY = (s as any).billboard_status_offset_y || '6mm';
    const gap = (s as any).installed_images_gap || '5mm';

    let html = `<div class="page" data-template-zones="${layout.zones ? '1' : '0'}">`;
    if (!hideBackground) html += `<div class="background"><img src="${backgroundUrl}" alt="" /></div>`;

    if (contractInfoText) {
      html += `<div class="absolute-field contract-number" data-element-key="contractNumber" style="top: ${layout.contractTop}mm; right: ${s.contract_number_right}; left: auto; width: 85mm; max-width: 85mm; font-size: ${s.contract_number_font_size}; font-weight: ${s.contract_number_font_weight}; color: ${s.contract_number_color}; text-align: right; overflow-wrap: anywhere; ${s.contract_number_offset_x && s.contract_number_offset_x !== '0mm' ? `margin-right: ${s.contract_number_offset_x};` : ''} ${hl('contractNumber')}"><div>${contractInfoText}</div></div>`;
    }
    // الإعلان السابق — نفس موضعه في طباعة الكل (العناصر تحته تُزاح تلقائياً فلا تتداخل)
    if (previousAd) {
      html += `<div class="absolute-field print-details" data-element-key="previousAd" style="top: 74mm; left: 12mm; width: 138mm; font-size: 12px; line-height: 1.3; text-align: right; ${hl('previousAd')}"><div class="previous-ad-row">الإعلان السابق: ${previousAd}</div></div>`;
    }
    if (installationDate) {
      html += `<div class="absolute-field installation-date" data-element-key="installationDate" style="top: ${layout.dateTop}mm; right: ${s.installation_date_right}; font-family: '${s.primary_font}', Arial, sans-serif; font-size: ${s.installation_date_font_size}; font-weight: ${(s as any).installation_date_font_weight || '400'}; color: ${(s as any).installation_date_color || '#000'}; text-align: ${(s as any).installation_date_alignment || 'right'}; ${s.installation_date_offset_x && s.installation_date_offset_x !== '0mm' ? `margin-right: ${s.installation_date_offset_x};` : ''} ${hl('installationDate')}">تاريخ التركيب: ${installationDate}</div>`;
    }
    html += `<div class="absolute-field billboard-name" data-element-key="billboardName" style="top: ${layout.nameTop}mm; left: ${layout.nameCenter - layout.nameWidth / 2}mm; width: ${layout.nameWidth}mm; text-align: ${(s as any).billboard_name_alignment || 'center'}; font-size: ${s.billboard_name_font_size}; font-weight: ${s.billboard_name_font_weight}; color: ${s.billboard_name_color}; ${hl('billboardName')}">${name}</div>`;
    if (showBillboardStatus) {
      html += `<div class="absolute-field billboard-status" data-element-key="billboardStatus" style="top: calc(${toCssLength(s.billboard_name_top)} + ${s.billboard_name_font_size} + ${toCssLength(statusOffsetY)}); left: ${layout.nameCenter - layout.nameWidth / 2}mm; width: ${layout.nameWidth}mm; text-align: ${(s as any).billboard_name_alignment || 'center'}; font-size: ${statusFontSize}; font-weight: 600; color: #b91c1c; ${hl('billboardStatus')}">${statusLabels[mStatusKey] || mStatusKey}</div>`;
    }
    html += `<div class="absolute-field size" data-element-key="size" style="top: ${layout.sizeTop}mm; left: ${layout.sizeCenter - layout.sizeWidth / 2}mm; width: ${layout.sizeWidth}mm; text-align: center; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight}; color: ${s.size_color}; ${hl('size')}">${sizeHtml}</div>`;
    html += `<div class="absolute-field faces-count" data-element-key="facesCount" style="top: ${layout.facesTop}mm; left: ${layout.facesCenter - layout.sizeWidth / 2}mm; width: ${layout.sizeWidth}mm; text-align: center; font-size: ${s.faces_count_font_size}; color: ${s.faces_count_color}; font-weight: 600; ${hl('facesCount')}">${billboard.has_cutout ? 'مجسم - ' : ''}${formatFacesCountArabic(facesCount)}</div>`;
    if (previewTarget === 'installation') {
      html += `<div class="absolute-field print-type" data-element-key="teamName" style="top: ${s.team_name_top}; right: ${s.team_name_right}; font-size: ${s.team_name_font_size}; color: ${(s as any).team_name_color || '#000'}; font-weight: ${s.team_name_font_weight}; text-align: ${(s as any).team_name_alignment || 'right'}; ${s.team_name_offset_x && s.team_name_offset_x !== '0mm' ? `margin-right: ${s.team_name_offset_x};` : ''} ${hl('teamName')}">فريق التركيب: ${teamName || 'فريق التركيب'}</div>`;
    }
    if (pairedImages) {
      const col = (src: string, label: string) => `<div class="installed-image-column" style="flex: 1; max-width: calc(50% - (${gap} / 2)); height: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;"><div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 2mm;">${label}</div><div class="installed-image-box" style="height: 100%; max-height: ${allowedImageHeight}; width: 100%; display: flex; align-items: center; justify-content: center;"><img src="${src}" alt="${label}" class="billboard-image installed-image" style="max-height: ${allowedImageHeight}; max-width: 100%; width: auto; height: auto; object-fit: contain; display: block; margin: 0 auto;" /></div></div>`;
      html += `<div class="absolute-field installed-images-container" data-element-key="installedImages" style="top: ${layout.imageTop}mm; left: ${layout.imageCenter}mm; transform: translateX(-50%); width: ${maxAllowedWidth}; --installed-image-height: ${allowedImageHeight}; height: ${allowedImageHeight}; max-height: ${allowedImageHeight}; display: flex; gap: ${gap}; justify-content: center; align-items: center; ${hl('installedImages')}">${col(effectiveInstalledA!, 'الوجه الأمامي')}${col(effectiveInstalledB!, 'الوجه الخلفي')}</div>`;
    } else {
      const inner = singleImage
        ? `<img src="${singleImage}" alt="صورة اللوحة" class="billboard-image" style="max-height: ${allowedImageHeight}; max-width: ${maxAllowedWidth}; width: auto; height: auto; object-fit: contain; display: block;" />`
        : `<div class="pin-fallback" style="width: ${(s as any).main_image_width || '120mm'}; height: ${allowedImageHeight};"><div style="font-size: 13px; color: #999;">لا توجد صورة</div></div>`;
      html += `<div class="absolute-field image-container" data-element-key="mainImage" style="top: ${layout.imageTop}mm; left: ${layout.imageCenter}mm; transform: translateX(-50%); width: ${maxAllowedWidth}; height: ${allowedImageHeight}; max-height: ${allowedImageHeight}; display: flex; align-items: center; justify-content: center; ${hl('mainImage')}">${inner}</div>`;
    }
    html += `<div class="absolute-field location-info" data-element-key="locationInfo" style="top: ${layout.locationTop}mm; left: ${layout.location.left}mm; width: ${layout.location.width}mm; font-size: ${s.location_info_font_size}; color: ${s.location_info_color}; text-align: ${s.location_info_alignment}; ${hl('locationInfo')}">${municipalityDistrict}</div>`;
    html += `<div class="absolute-field landmark-info" data-element-key="landmarkInfo" style="top: ${layout.landmarkTop}mm; left: ${layout.landmark.left}mm; width: ${layout.landmark.width}mm; font-size: ${s.landmark_info_font_size}; color: ${s.landmark_info_color}; text-align: ${s.landmark_info_alignment}; ${hl('landmarkInfo')}">${landmark || '—'}</div>`;
    if (qrCodeUrl) {
      html += `<div class="absolute-field qr-container" data-element-key="qrCode" style="top: ${layout.qrTop}mm; left: ${layout.qrLeft}mm; width: ${layout.qrSize}mm; height: ${layout.qrSize}mm; ${hl('qrCode')}"><img src="${qrCodeUrl}" alt="QR" class="qr-code" /></div>`;
    }
    if (isDesignsIncluded) {
      html += `<div class="absolute-field designs-section" data-element-key="designs" style="top: ${layout.designsTop}mm; left: ${layout.designsLeft}mm; width: ${layout.designsWidth}mm; --design-height: ${layout.designHeight}mm; display: flex; gap: ${s.designs_gap}; align-items: flex-start; ${hl('designs')}">
        ${effectiveDesignA ? `<div class="design-item"><div class="design-label">تصميم الوجه الأمامي</div><img src="${effectiveDesignA}" alt="تصميم الوجه الأمامي" class="design-image" style="max-height: var(--design-height);" /></div>` : ''}
        ${effectiveDesignB ? `<div class="design-item"><div class="design-label">تصميم الوجه الخلفي</div><img src="${effectiveDesignB}" alt="تصميم الوجه الخلفي" class="design-image" style="max-height: var(--design-height);" /></div>` : ''}
      </div>`;
    }
    html += `</div>`;
    return html;
  }, [billboard, s, qrCodeUrl, faceLogic, selectedElement, hideBackground, backgroundUrl, includeDesigns, previewTarget, teamName, contractNumber, customerName, adType, statusLabels, previousAd]);

  // ✅ نفس أنماط «طباعة الكل»
  const fullHTML = useMemo(() => `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <style>
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Medium.otf') format('opentype'); font-weight: 500; font-display: block; }
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; font-display: block; }
          @font-face { font-family: 'Doran'; src: url('/Doran-Medium.otf') format('opentype'); font-weight: 500; font-display: block; }
          @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; font-display: block; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { font-family: 'Doran', Arial, sans-serif; direction: rtl; background: white; color: #000; margin: 0; padding: 0; overflow: hidden; }
          .page { position: relative; width: 210mm; height: 297mm; margin: 0 auto; overflow: hidden; }
          .background { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
          .background img { width: 100%; height: 100%; object-fit: fill; display: block; }
          .absolute-field { position: absolute; z-index: 5; color: #000; font-family: 'Doran', Arial, sans-serif; text-rendering: geometricPrecision; -webkit-font-smoothing: antialiased; line-height: 1.2; }
          .billboard-name { font-family: 'Doran', Arial, sans-serif; font-size: 20px; font-weight: 500; color: #333; line-height: 1.2; }
          .size { font-family: 'Manrope', Arial, sans-serif; font-size: 41px; font-weight: 700; line-height: 1.1; display: flex; justify-content: center; align-items: center; }
          .faces-count { line-height: 1.3; }
          .print-size-container { display: inline-flex; align-items: center; justify-content: center; gap: 0.12em; direction: rtl; color: inherit; white-space: nowrap; }
          .print-dim-col { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; color: inherit; }
          .print-dim-label { font-family: 'Doran', sans-serif; font-size: 9px; margin-bottom: 1mm; }
          .print-dim-value { font-weight: inherit; }
          .print-dim-separator { margin: 0 0.1em; opacity: 0.7; }
          .contract-number { font-family: 'Doran', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 1.2; }
          .location-info, .landmark-info { font-family: 'Doran', Arial, sans-serif; font-size: 16px; line-height: 1.2; }
          .image-container { overflow: visible; background: transparent; border: none; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
          .installed-images-container { overflow: visible; background: transparent; border: none; box-sizing: border-box; }
          .installed-images-container .installed-image-column { min-width: 0; height: auto !important; max-height: 100%; justify-content: flex-start; }
          .installed-images-container .installed-image-box { height: auto !important; max-height: calc(100% - 6mm) !important; flex: 0 1 auto; min-height: 0; }
          .installed-images-container .installed-image { max-height: calc(var(--installed-image-height, 85mm) - 6mm) !important; }
          .billboard-image, .installed-image { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; border: 2px solid #000; border-radius: 8px; box-sizing: border-box; }
          .qr-code { width: 100%; height: 100%; object-fit: contain; }
          .pin-fallback { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8f9fa; border: 2px dashed #ccc; border-radius: 8px; }
          .designs-section { flex-wrap: nowrap; justify-content: center; overflow: hidden; }
          .design-item { flex: 1 1 0; min-width: 0; text-align: center; display: flex; flex-direction: column; align-items: center; }
          .design-label { font-family: 'Doran', Arial, sans-serif; font-size: 12px; font-weight: 500; margin-bottom: 2mm; color: #333; line-height: 1.3; white-space: normal; overflow-wrap: anywhere; max-width: 100%; min-height: 4mm; }
          .design-image { max-width: 100%; max-height: 42mm; width: auto; height: auto; object-fit: contain; border: 2px solid #000; border-radius: 8px; box-sizing: border-box; display: block; margin: 0 auto; }
          [data-element-key]:hover { outline: 2px dashed #93c5fd !important; outline-offset: 2px !important; }
        </style>
      </head>
      <body>${pageHTML}</body>
      </html>
    `, [pageHTML]);

  // كتابة HTML في iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    
    const doc = iframe.contentDocument;
    if (!doc) return;
    
    doc.open();
    doc.write(fullHTML);
    doc.close();
    // نفس تصغير النصوص الطويلة المستخدم في الطباعة الفعلية
    const runFit = () => { try { fitPrintCardText(doc); } catch { /* ignore */ } };
    (doc as any).fonts?.ready?.then(runFit).catch(runFit);
    setTimeout(runFit, 400);

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

  if (compact) {
    const w = 793.7 * scale, h = 1122.5 * scale;
    return (
      <div className="relative overflow-hidden rounded-md border bg-white" style={{ width: w, height: h }}>
        <iframe ref={iframeRef} title="print-preview-case"
          style={{ position: 'absolute', top: 0, left: 0, width: '210mm', height: '297mm', border: 'none', transform: `scale(${scale})`, transformOrigin: 'top left', background: 'white', pointerEvents: 'none' }} />
      </div>
    );
  }

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