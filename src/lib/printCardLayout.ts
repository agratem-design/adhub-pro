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

export function resolvePrintCardLayout(settings: Record<string, any>, options: {
  hasDesigns: boolean; pairedImages: boolean; dimensionLabels: boolean; size?: string;
}) {
  const s = settings;
  const locationTop = clamp(printLengthMm(s.location_info_top, 233, 297), 210, 249);
  const dimensions = String(options.size || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  const portraitDesign = dimensions.length >= 2 && dimensions[1] > dimensions[0];
  // Tall designs need their own vertical space rather than a narrow thumbnail strip.
  const designsTop = clamp(Math.min(printLengthMm(s.designs_top, 178, 297),
    portraitDesign ? locationTop - 72 : locationTop - 15), 155, locationTop - 15);
  const requestedTop = printLengthMm(options.pairedImages ? s.installed_images_top : s.main_image_top, 88, 297);
  const imageTop = clamp(requestedTop, 76, options.hasDesigns ? designsTop - 25 : locationTop - 30);
  const imageEnd = options.hasDesigns ? designsTop - 5 : locationTop - 6;
  const requestedHeight = options.hasDesigns
    ? printLengthMm(options.pairedImages ? s.installed_image_height : s.main_image_height, 85, 297)
    : Math.max(printLengthMm(s.main_image_height, 140, 297), 140);
  const imageHeight = clamp(requestedHeight, 20, imageEnd - imageTop);
  const imageCenter = clamp(printLengthMm(options.pairedImages ? s.installed_images_left : s.main_image_left, 105), 30, 180);
  const requestedWidth = options.pairedImages ? printLengthMm(s.installed_images_width, 180) : 190;
  const imageWidth = Math.min(requestedWidth, 2 * Math.min(imageCenter - 10, 200 - imageCenter));
  const designsLeft = clamp(printLengthMm(s.designs_left, 16), 10, 40);
  const designsWidth = clamp(printLengthMm(s.designs_width, 178), 50, 200 - designsLeft);
  const designHeight = clamp(Math.max(printLengthMm(s.design_image_height, 42, 297), portraitDesign ? 60 : 0), 5, locationTop - designsTop - 9);
  const nameCenter = clamp(printLengthMm(s.billboard_name_left, 33) + printLengthMm(s.billboard_name_offset_x, 0), 25, 185);
  const nameRight = nameCenter < 48 ? 48 : 200;
  const nameWidth = Math.min(65, 2 * Math.min(nameCenter - 10, nameRight - nameCenter));
  const sizeTop = clamp(printLengthMm(s.size_top, 52, 297), 46, 60);
  const sizeCenter = clamp(printLengthMm(s.size_left, 132) + printLengthMm(s.size_offset_x, 0), 31, 179);
  const sizeFontMm = printLengthMm(s.size_font_size, 10);
  const facesOffset = printLengthMm(s.faces_count_top, 11, 297);
  // Older defaults use an absolute top; saved templates also use a small relative offset.
  const facesTop = Math.max(facesOffset <= 25 ? sizeTop + facesOffset : facesOffset,
    sizeTop + sizeFontMm * 1.15 + (options.dimensionLabels ? 4 : 0) + 1);
  const addressBox = (prefix: string) => {
    const requestedLeft = printLengthMm(s[`${prefix}_left`], 0) + printLengthMm(s[`${prefix}_offset_x`], 0);
    const right = clamp(requestedLeft + printLengthMm(s[`${prefix}_width`], 150), 100, 150);
    const left = clamp(requestedLeft, 10, right - 40);
    return { left, width: right - left };
  };
  return { imageTop, imageHeight, imageCenter, imageWidth, locationTop, designsTop,
    designsLeft, designsWidth, designHeight, nameCenter, nameWidth, sizeCenter, sizeTop, facesTop,
    location: addressBox('location_info'), landmark: addressBox('landmark_info') };
}

/** Run after fonts load, for both browser printing and the PDF iframe. */
export function fitPrintCardText(doc: Document) {
  const mm = 96 / 25.4;
  const view = doc.defaultView;
  if (!view) return;
  doc.querySelectorAll<HTMLElement>('.page').forEach(page => {
    const size = page.querySelector<HTMLElement>('.size');
    const name = page.querySelector<HTMLElement>('.billboard-name');
    const contract = page.querySelector<HTMLElement>('.contract-number');
    const date = page.querySelector<HTMLElement>('.installation-date');
    const fit = (element: HTMLElement | null, height: number) => {
      if (!element) return;
      element.style.overflowWrap = 'anywhere';
      let font = parseFloat(view.getComputedStyle(element).fontSize);
      while ((element.scrollHeight > height || element.scrollWidth > element.clientWidth + 1) && font > 9) {
        element.style.fontSize = `${--font}px`;
      }
    };
    if (contract && size) {
      contract.style.width = '85mm';
      contract.style.maxWidth = '85mm';
      contract.style.textAlign = 'right';
      const sizeTop = parseFloat(size.style.top);
      const requestedTop = parseFloat(contract.style.top);
      fit(contract, Math.max(4, sizeTop - requestedTop - 2) * mm);
    }
    if (date) {
      date.style.maxWidth = '85mm';
      fit(date, 7 * mm);
    }
    fit(name, 7 * mm);
    if (name && name.scrollHeight > 7 * mm && size) {
      name.style.top = `${parseFloat(size.style.top) - 2}mm`;
      fit(name, 13 * mm);
    }
    const details = page.querySelector<HTMLElement>('.print-details');
    fit(details, 8 * mm);
    const team = page.querySelector<HTMLElement>('.print-type');
    const imageArea = page.querySelector<HTMLElement>('.installed-images-container, .image-container');
    let contentTop = details ? parseFloat(details.style.top) + details.getBoundingClientRect().height / mm + 1 : 0;
    if (team && contentTop) {
      team.style.top = `${Math.max(parseFloat(team.style.top), contentTop)}mm`;
      contentTop = parseFloat(team.style.top) + team.getBoundingClientRect().height / mm + 2;
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
      status.style.top = `${parseFloat(name.style.top) + name.getBoundingClientRect().height / mm + 1}mm`;
    }
    const faces = page.querySelector<HTMLElement>('.faces-count');
    if (size && faces) {
      // Center the two lines as one unit inside the template's size box.
      const anchor = parseFloat(size.dataset.anchorTop || size.style.top);
      size.dataset.anchorTop = String(anchor);
      size.style.lineHeight = '1';
      faces.style.lineHeight = '1.2';
      faces.style.fontSize = `${Math.min(12, parseFloat(view.getComputedStyle(faces).fontSize))}px`;
      let font = Math.min(32, parseFloat(view.getComputedStyle(size).fontSize));
      size.style.fontSize = `${font}px`;
      const gap = 1 * mm;
      while ((size.getBoundingClientRect().height + faces.getBoundingClientRect().height + gap > 13 * mm
        || size.scrollWidth > size.clientWidth + 1) && font > 16) {
        size.style.fontSize = `${--font}px`;
      }
      const total = size.getBoundingClientRect().height + faces.getBoundingClientRect().height + gap;
      // The template border ends at 68mm: leave clearance for Arabic glyph descenders.
      const center = Math.min(58, Math.max(57, anchor + 5));
      const top = Math.min(center - total / mm / 2, 64 - total / mm);
      size.style.top = `${top}mm`;
      faces.style.top = `${top + size.getBoundingClientRect().height / mm + 1}mm`;
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
    const location = page.querySelector<HTMLElement>('.location-info');
    const landmark = page.querySelector<HTMLElement>('.landmark-info');
    fit(location, 6 * mm);
    fit(landmark, 7 * mm);
    const designs = page.querySelector<HTMLElement>('.designs-section');
    if (designs && location) {
      const room = (parseFloat(location.style.top) - parseFloat(designs.style.top) - 3) * mm;
      const labels = Array.from(designs.querySelectorAll<HTMLElement>('.design-label'));
      labels.forEach(label => fit(label, 8 * mm));
      const labelHeight = Math.max(0, ...labels.map(label => label.getBoundingClientRect().height));
      labels.forEach(label => { label.style.minHeight = `${labelHeight}px`; });
      const imageHeight = Math.max(0, room - labelHeight - 2 * mm);
      alignImages(designs, '.design-image', Math.min(parseFloat(view.getComputedStyle(designs.querySelector('.design-image')!).maxHeight) || imageHeight, imageHeight));
      designs.querySelectorAll<HTMLElement>('.design-image').forEach(img => {
        img.style.maxHeight = `${Math.min(parseFloat(view.getComputedStyle(img).maxHeight) || imageHeight, imageHeight)}px`;
      });
    }
  });
}
