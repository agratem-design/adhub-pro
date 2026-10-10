/** A4 card geometry, in millimetres. Keep image and design areas above the address. */
export function printLengthMm(value: unknown, fallback: number, axis = 210): number {
  const text = String(value ?? '').trim();
  const number = parseFloat(text);
  if (!Number.isFinite(number)) return fallback;
  if (text.endsWith('%')) return number * axis / 100;
  if (text.endsWith('px')) return number * 25.4 / 96;
  if (text.endsWith('pt')) return number * 25.4 / 72;
  return number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * مناطق الخلفية الافتراضية (ipg.svg) بالمليمتر — الجزء الفارغ من كل إطار.
 * كل عنصر يتحرك بالإعدادات داخل منطقته ولا يخرج منها.
 */
export const PRINT_TEMPLATE_ZONES = {
  header: { left: 12, right: 198, top: 37, bottom: 49 },
  name: { left: 15, right: 50, top: 51, bottom: 67 },
  size: { left: 117, right: 150, top: 51, bottom: 67 },
  image: { left: 10, right: 200, top: 70, bottom: 228 },
  location: { left: 15, right: 150, top: 231, bottom: 249 },
  qr: { left: 64, right: 94, top: 254, bottom: 285 },
} as const;

/** هل الخلفية هي القالب الافتراضي الذي بُنيت عليه المناطق؟ */
export function isTemplateBackground(url?: string | null): boolean {
  const u = String(url || '').trim();
  return !u || /(^|\/)ipg\.svg(\?|#|$)/i.test(u);
}

export function resolvePrintCardLayout(settings: Record<string, any>, options: {
  hasDesigns: boolean; pairedImages: boolean; dimensionLabels: boolean; size?: string;
  /** تقييد العناصر بمناطق الخلفية الافتراضية */
  templateZones?: boolean;
}) {
  const s = settings;
  const Z = PRINT_TEMPLATE_ZONES;
  const zones = options.templateZones !== false;
  const dimensions = String(options.size || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  const portraitDesign = dimensions.length >= 2 && dimensions[1] > dimensions[0];

  // البلدية وأقرب معلم داخل إطار «مكان المساحة»
  const locationTop = zones
    ? clamp(printLengthMm(s.location_info_top, 235, 297), Z.location.top + 1, Z.location.bottom - 12)
    : clamp(printLengthMm(s.location_info_top, 233, 297), 120, 285);
  const landmarkTop = zones
    ? clamp(printLengthMm(s.landmark_info_top, locationTop + 7, 297), locationTop + 5, Z.location.bottom - 6)
    : clamp(printLengthMm(s.landmark_info_top, locationTop + 7, 297), locationTop + 3, 290);
  const contentBottom = zones ? Z.image.bottom : locationTop - 3;

  // التصاميم: فوق إطار العنوان، والطولية تأخذ مساحة رأسية كافية
  const requestedDesignsTop = printLengthMm(s.designs_top, 178, 297);
  const designsTop = clamp(Math.min(requestedDesignsTop, portraitDesign ? contentBottom - 62 : contentBottom - 20),
    zones ? Z.image.top + 20 : 40, contentBottom - 20);
  const designHeight = clamp(Math.max(printLengthMm(s.design_image_height, 42, 297), portraitDesign ? 60 : 0),
    10, Math.max(10, contentBottom - designsTop - 9));
  const designsLeft = zones
    ? clamp(printLengthMm(s.designs_left, 16), Z.image.left, Z.image.right - 40)
    : clamp(printLengthMm(s.designs_left, 16), 0, 180);
  const designsWidth = clamp(printLengthMm(s.designs_width, 178), 40, (zones ? Z.image.right : 210) - designsLeft);

  // الصورة: من أعلى منطقة الصور حتى التصاميم (أو حتى إطار العنوان)
  const requestedTop = printLengthMm(options.pairedImages ? s.installed_images_top : s.main_image_top, 88, 297);
  const imageFloor = options.hasDesigns ? designsTop - 3 : contentBottom;
  const imageTop = clamp(requestedTop, zones ? Z.image.top : 20, imageFloor - 20);
  const requestedHeight = options.hasDesigns
    ? printLengthMm(options.pairedImages ? s.installed_image_height : s.main_image_height, 85, 297)
    : printLengthMm(s.main_image_height, 140, 297);
  const imageHeight = clamp(requestedHeight, 20, Math.max(20, imageFloor - imageTop));
  const imageCenter = clamp(printLengthMm(options.pairedImages ? s.installed_images_left : s.main_image_left, 105), 25, 185);
  const requestedWidth = options.pairedImages ? printLengthMm(s.installed_images_width, 180) : 190;
  const imageWidth = Math.max(30, Math.min(requestedWidth,
    2 * Math.min(imageCenter - (zones ? Z.image.left : 3), (zones ? Z.image.right : 207) - imageCenter)));

  // اسم اللوحة: داخل الجزء الفارغ من إطار «رقم المساحة»
  const nameWidth = zones ? Z.name.right - Z.name.left - 1 : 65;
  const nameCenter = zones
    ? (Z.name.left + Z.name.right) / 2
    : clamp(printLengthMm(s.billboard_name_left, 33) + printLengthMm(s.billboard_name_offset_x, 0), 10, 200);
  const nameTop = zones
    ? clamp(printLengthMm(s.billboard_name_top, 56, 297), Z.name.top, Z.name.bottom - 6)
    : printLengthMm(s.billboard_name_top, 56, 297);

  // المقاس وعدد الأوجه: داخل الجزء الفارغ من إطار «مقاس المساحة»
  const sizeWidth = zones ? Z.size.right - Z.size.left - 1 : 42;
  const sizeCenter = zones
    ? (Z.size.left + Z.size.right) / 2
    : clamp(printLengthMm(s.size_left, 132) + printLengthMm(s.size_offset_x, 0), 21, 189);
  const facesCenter = zones ? sizeCenter : clamp(sizeCenter + printLengthMm(s.faces_count_offset_x, 0), 21, 189);
  const sizeTop = zones
    ? clamp(printLengthMm(s.size_top, 52, 297), Z.size.top, Z.size.bottom - 8)
    : clamp(printLengthMm(s.size_top, 52, 297), 5, 285);
  const sizeFontMm = printLengthMm(s.size_font_size, 10);
  const facesOffset = printLengthMm(s.faces_count_top, 11, 297);
  // القيم القديمة موضع مطلق؛ والقوالب الحالية إزاحة تحت المقاس
  const facesTop = Math.max(facesOffset <= 25 ? sizeTop + facesOffset : facesOffset,
    sizeTop + sizeFontMm * 1.05 + (options.dimensionLabels ? 4 : 0) + 0.5);

  const addressBox = (prefix: string) => {
    const requestedLeft = printLengthMm(s[`${prefix}_left`], 0) + printLengthMm(s[`${prefix}_offset_x`], 0);
    const minLeft = zones ? Z.location.left : 10;
    const maxRight = zones ? Z.location.right : 200;
    const left = clamp(requestedLeft, minLeft, maxRight - 30);
    const right = clamp(requestedLeft + printLengthMm(s[`${prefix}_width`], 150), left + 30, maxRight);
    return { left, width: right - left };
  };

  // رقم العقد وتاريخ التركيب: في الشريط أسفل الشعار والعنوان
  const contractTop = zones
    ? clamp(printLengthMm(s.contract_number_top, 41, 297), Z.header.top, Z.header.bottom - 5)
    : printLengthMm(s.contract_number_top, 41, 297);
  const dateTop = zones
    ? clamp(printLengthMm(s.installation_date_top, 42, 297), Z.header.top, Z.header.bottom - 5)
    : printLengthMm(s.installation_date_top, 42, 297);

  // QR داخل إطاره
  const qrSize = zones
    ? clamp(printLengthMm(s.qr_size, 26), 15, Math.min(Z.qr.right - Z.qr.left, Z.qr.bottom - Z.qr.top))
    : printLengthMm(s.qr_size, 26);
  const qrTop = zones ? clamp(printLengthMm(s.qr_top, 257, 297), Z.qr.top, Z.qr.bottom - qrSize) : printLengthMm(s.qr_top, 257, 297);
  const qrLeft = zones ? clamp(printLengthMm(s.qr_left, 67), Z.qr.left, Z.qr.right - qrSize) : printLengthMm(s.qr_left, 67);

  return { imageTop, imageHeight, imageCenter, imageWidth, locationTop, landmarkTop, designsTop,
    designsLeft, designsWidth, designHeight, nameCenter, nameWidth, nameTop, sizeCenter, sizeWidth, sizeTop,
    facesTop, facesCenter, contractTop, dateTop, qrTop, qrLeft, qrSize, zones,
    location: addressBox('location_info'), landmark: addressBox('landmark_info') };
}

/**
 * Run after fonts load, for both browser printing and the PDF iframe.
 * يُحقن كنص داخل صفحة الطباعة، لذلك يجب أن يبقى مستقلاً بلا أي مراجع خارجية.
 */
export function fitPrintCardText(doc: Document) {
  const mm = 96 / 25.4;
  const view = doc.defaultView;
  if (!view) return;
  doc.querySelectorAll<HTMLElement>('.page').forEach(page => {
    const zoned = page.getAttribute('data-template-zones') === '1';
    const ZN = { name: [51, 67], size: [51, 67], header: [37, 49], location: [231, 249] };
    const size = page.querySelector<HTMLElement>('.size');
    const name = page.querySelector<HTMLElement>('.billboard-name');
    const contract = page.querySelector<HTMLElement>('.contract-number');
    const date = page.querySelector<HTMLElement>('.installation-date');
    const fit = (element: HTMLElement | null, height: number) => {
      if (!element) return;
      element.style.overflowWrap = 'anywhere';
      let font = parseFloat(view.getComputedStyle(element).fontSize);
      while ((element.scrollHeight > height || element.scrollWidth > element.clientWidth + 1) && font > 8) {
        element.style.fontSize = `${--font}px`;
      }
    };
    const heightMm = (el: HTMLElement) => el.getBoundingClientRect().height / mm;

    // رقم العقد وتاريخ التركيب
    if (contract) {
      contract.style.textAlign = 'right';
      if (zoned) {
        fit(contract, Math.max(4, ZN.header[1] - parseFloat(contract.style.top)) * mm);
      } else if (size) {
        fit(contract, Math.max(4, parseFloat(size.style.top) - parseFloat(contract.style.top) - 2) * mm);
      }
    }
    if (date) {
      date.style.maxWidth = '85mm';
      fit(date, (zoned ? Math.max(4, ZN.header[1] - parseFloat(date.style.top)) : 7) * mm);
    }

    // اسم اللوحة: بالحجم المختار، ويُصغَّر فقط ليبقى داخل إطاره
    if (name) {
      const anchor = parseFloat(name.dataset.anchorTop || name.style.top);
      name.dataset.anchorTop = String(anchor);
      if (zoned) {
        fit(name, (ZN.name[1] - ZN.name[0] - 1) * mm);
        const top = Math.min(Math.max(anchor, ZN.name[0] + 0.5), ZN.name[1] - 0.5 - heightMm(name));
        name.style.top = `${Math.max(ZN.name[0], top)}mm`;
      } else {
        const line = Math.max(7 * mm, parseFloat(view.getComputedStyle(name).fontSize) * 1.35);
        fit(name, line);
        if (name.scrollHeight > line && size) {
          name.style.top = `${parseFloat(size.style.top) - 2}mm`;
          fit(name, line * 1.9);
        }
      }
    }

    const details = page.querySelector<HTMLElement>('.print-details');
    fit(details, 8 * mm);
    const team = page.querySelector<HTMLElement>('.print-type');
    const imageArea = page.querySelector<HTMLElement>('.installed-images-container, .image-container');
    let contentTop = details ? parseFloat(details.style.top) + heightMm(details) + 1 : 0;
    if (team && contentTop) {
      team.style.top = `${Math.max(parseFloat(team.style.top), contentTop)}mm`;
      contentTop = parseFloat(team.style.top) + heightMm(team) + 2;
    }
    if (imageArea && contentTop > parseFloat(imageArea.style.top)) {
      const bottom = parseFloat(imageArea.style.top) + parseFloat(imageArea.style.height);
      imageArea.style.top = `${contentTop}mm`;
      imageArea.style.height = `${Math.max(20, bottom - contentTop)}mm`;
      imageArea.style.maxHeight = imageArea.style.height;
      imageArea.style.setProperty('--installed-image-height', imageArea.style.height);
    }
    const status = page.querySelector<HTMLElement>('.billboard-status');
    if (name && status) {
      status.style.top = `${parseFloat(name.style.top) + heightMm(name) + 1}mm`;
    }

    // المقاس وعدد الأوجه: كتلة واحدة داخل إطار المقاس
    const faces = page.querySelector<HTMLElement>('.faces-count');
    if (size && faces) {
      const anchor = parseFloat(size.dataset.anchorTop || size.style.top);
      size.dataset.anchorTop = String(anchor);
      const facesAnchor = parseFloat(faces.dataset.anchorTop || faces.style.top);
      faces.dataset.anchorTop = String(facesAnchor);
      size.style.lineHeight = '1';
      faces.style.lineHeight = '1.2';
      let font = parseFloat(view.getComputedStyle(size).fontSize);
      let facesFont = parseFloat(view.getComputedStyle(faces).fontSize);
      const gapMm = Math.min(4, Math.max(0.5, facesAnchor - anchor - heightMm(size)));
      if (zoned) {
        const room = ZN.size[1] - ZN.size[0] - 1;
        while ((heightMm(size) + heightMm(faces) + gapMm > room || size.scrollWidth > size.clientWidth + 1) && font > 12) {
          size.style.fontSize = `${--font}px`;
          if (heightMm(size) + heightMm(faces) + gapMm > room && facesFont > 9) faces.style.fontSize = `${--facesFont}px`;
        }
        const total = heightMm(size) + heightMm(faces) + gapMm;
        const top = Math.min(Math.max(anchor, ZN.size[0] + 0.5), ZN.size[1] - 0.5 - total);
        size.style.top = `${top}mm`;
        faces.style.top = `${top + heightMm(size) + gapMm}mm`;
      } else {
        while (size.scrollWidth > size.clientWidth + 1 && font > 12) size.style.fontSize = `${--font}px`;
        const sizeBottom = parseFloat(size.style.top) + heightMm(size) + 0.5;
        faces.style.top = `${Math.max(facesAnchor, sizeBottom)}mm`;
      }
    }

    // Give both faces the same rendered height, including mixed image ratios.
    const alignImages = (container: HTMLElement | null, selector: string, maxHeight: number) => {
      if (!container) return;
      const images = Array.from(container.querySelectorAll<HTMLImageElement>(selector));
      if (!images.length) return;
      const height = Math.min(maxHeight, ...images.map(img => {
        const width = img.parentElement?.clientWidth || container.clientWidth;
        return img.naturalWidth && img.naturalHeight ? width * img.naturalHeight / img.naturalWidth : maxHeight;
      }));
      images.forEach(img => {
        img.style.height = `${Math.max(1, height)}px`;
        img.style.width = 'auto';
        img.style.maxWidth = '100%';
      });
    };
    if (imageArea?.classList.contains('installed-images-container')) {
      alignImages(imageArea, '.installed-image', Math.max(1, imageArea.clientHeight - 6 * mm));
    }

    // البلدية وأقرب معلم: سطر لكل منهما داخل إطار «مكان المساحة» دون تداخل
    const location = page.querySelector<HTMLElement>('.location-info');
    const landmark = page.querySelector<HTMLElement>('.landmark-info');
    fit(location, 6 * mm);
    fit(landmark, 7 * mm);
    if (zoned && location && landmark) {
      const locBottom = parseFloat(location.style.top) + heightMm(location) + 0.5;
      const landTop = Math.max(parseFloat(landmark.style.top), locBottom);
      landmark.style.top = `${Math.min(landTop, ZN.location[1] - 0.5 - heightMm(landmark))}mm`;
    }

    const designs = page.querySelector<HTMLElement>('.designs-section');
    if (designs) {
      const limit = zoned ? 228 : (location ? parseFloat(location.style.top) : 280);
      const room = (limit - parseFloat(designs.style.top) - 3) * mm;
      const labels = Array.from(designs.querySelectorAll<HTMLElement>('.design-label'));
      labels.forEach(label => fit(label, 8 * mm));
      const labelHeight = Math.max(0, ...labels.map(label => label.getBoundingClientRect().height));
      labels.forEach(label => { label.style.minHeight = `${labelHeight}px`; });
      const imageHeight = Math.max(0, room - labelHeight - 2 * mm);
      const first = designs.querySelector<HTMLElement>('.design-image');
      if (first) {
        alignImages(designs, '.design-image', Math.min(parseFloat(view.getComputedStyle(first).maxHeight) || imageHeight, imageHeight));
        designs.querySelectorAll<HTMLElement>('.design-image').forEach(img => {
          img.style.maxHeight = `${Math.min(parseFloat(view.getComputedStyle(img).maxHeight) || imageHeight, imageHeight)}px`;
        });
      }
    }
  });
}
