import { describe, it, expect } from 'vitest';
import { resolvePrintCardLayout } from '@/lib/printCardLayout';
import { createPrintGeneratorFixture, cardSettings, tablePrintSettings } from './helpers/printGeneratorFixture';

describe('print card layout and actual option generators', () => {
  it('reserves space for designs and the address with and without paired images', () => {
    for (const hasDesigns of [true, false]) for (const pairedImages of [true, false]) {
      const layout = resolvePrintCardLayout(cardSettings, { hasDesigns, pairedImages, dimensionLabels: true });
      expect(layout.imageTop + layout.imageHeight).toBeLessThanOrEqual((hasDesigns ? layout.designsTop : layout.locationTop) - 5);
      expect(layout.designsTop + layout.designHeight + 9).toBeLessThanOrEqual(layout.locationTop);
      expect(layout.nameCenter - layout.nameWidth / 2).toBeGreaterThanOrEqual(10);
      expect(layout.facesTop).toBeLessThan(80);
    }
  });

  it('reserves a taller design area for 3 by 4 and keeps the size center within the page', () => {
    const settings = { ...cardSettings, designs_top: '194mm', design_image_height: '30mm',
      size_left: '63%', size_offset_x: '1mm', location_info_top: '233mm' };
    const portrait = resolvePrintCardLayout(settings, { hasDesigns: true, pairedImages: true, dimensionLabels: true, size: '3*4' });
    const landscape = resolvePrintCardLayout(settings, { hasDesigns: true, pairedImages: true, dimensionLabels: true, size: '4×3' });
    expect(portrait.designHeight).toBeGreaterThanOrEqual(60);
    expect(portrait.designsTop).toBeLessThan(landscape.designsTop);
    expect(portrait.imageTop + portrait.imageHeight).toBeLessThanOrEqual(portrait.designsTop - 5);
    expect(portrait.designsTop + portrait.designHeight + 9).toBeLessThanOrEqual(portrait.locationTop);
    expect(portrait.sizeCenter).toBe(133.3);
  });

  it('renders every combination of the card display options without missing references', async () => {
    const keys = ['includeDesigns', 'showDesignName', 'hideCustomerName', 'hideInstallDate', 'hideAdType',
      'hideInstalledImages', 'showPreviousAd', 'showSizeDimensionLabels', 'printCityInsteadOfMunicipality',
      'showBillboardStatusOpt', 'showTeamInContent'];
    for (let mask = 0; mask < 2 ** keys.length; mask++) {
      const flags = Object.fromEntries(keys.map((key, i) => [key, Boolean(mask & (1 << i))]));
      const html = await createPrintGeneratorFixture(flags).generatePrintHTML();
      expect(html).toContain('data-print-page');
      expect(html.includes('class="absolute-field designs-section"')).toBe(flags.includeDesigns);
      expect(html.includes('class="absolute-field installation-date"')).toBe(!flags.hideInstallDate);
      expect(html.includes('class="previous-ad-row"')).toBe(flags.showPreviousAd);
      expect(html.includes('class="print-dim-label"')).toBe(flags.showSizeDimensionLabels);
      expect(html.includes('class="absolute-field billboard-status"')).toBe(flags.showBillboardStatusOpt);
      expect(html.includes('class="absolute-field print-type"')).toBe(flags.showTeamInContent);
      expect(html.includes('العميل التجريبي')).toBe(!flags.hideCustomerName);
      expect(html.includes('حملة تجريبية طويلة')).toBe(!flags.hideAdType);
      expect(html.match(/class="absolute-field location-info"[^>]*>([\s\S]*?)<\/div>/)?.[1]).toContain(flags.printCityInsteadOfMunicipality ? 'طرابلس -' : 'طرابلس المركز');
      expect(html.includes('src="/photo-a.png"')).toBe(!flags.hideInstalledImages);
    }
  }, 30000);

  it('uses a lone back-face photo instead of silently reverting to the original', async () => {
    const fixture = createPrintGeneratorFixture();
    fixture.env.filteredItems[0].installed_image_face_a_url = null;
    const html = await fixture.generatePrintHTML();
    expect(html).toContain('src="/photo-b.png"');
    expect(html).not.toContain('src="/original.png"');
  });

  it('anchors ad type on the right before scripts or font fitting run', async () => {
    const html = await createPrintGeneratorFixture({ customSettings: { ...cardSettings, contract_number_alignment: 'left' } }).generatePrintHTML();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const header = doc.querySelector<HTMLElement>('.contract-number')!;
    expect(header.style.textAlign).toBe('right');
    expect(header.style.left).toBe('auto');
    expect(header.style.width).toBe('85mm');
    expect(header.style.right).toBe('22mm');
  });

  it('honours QR, dimension labels and one-face requests in table output', async () => {
    const fixture = createPrintGeneratorFixture({ showSizeDimensionLabels: true,
      tableSettings: { ...tablePrintSettings, show_qr_code: false } });
    fixture.env.filteredItems[0].faces_to_install = 1;
    const html = await fixture.generateTablePrintHTML();
    expect(html).not.toContain('src="/photo-b.png"');
    expect(html).not.toContain('src="/design-b.png"');
    expect(html).toContain('class="print-dim-label"');
    expect(html).not.toContain('data:image/png;base64,qr');
  });

  it('renders both document audiences and all supported contexts', async () => {
    for (const contextType of ['installation', 'removal', 'contract', 'offer']) {
      for (const printType of ['client', 'installation']) {
        const html = await createPrintGeneratorFixture({ contextType, printType, showTeamInContent: true }).generatePrintHTML();
        expect(html).toContain('data-print-page');
        expect(html.includes('class="absolute-field print-type"')).toBe(printType === 'installation');
      }
    }
  });

  it('retains fetched designs in auto-hidden table columns and honours date visibility', async () => {
    for (const hideInstallDate of [true, false]) for (const hideInstalledImages of [true, false]) {
      const fixture = createPrintGeneratorFixture({ hideInstallDate, hideInstalledImages,
        resolveBillboardDesigns: async () => ({ 1: { design_face_a: '/fetched-design.png' } }) });
      fixture.env.filteredItems[0].design_face_a = null;
      fixture.env.filteredItems[0].design_face_b = null;
      const doc = new DOMParser().parseFromString(await fixture.generateTablePrintHTML(), 'text/html');
      expect(doc.querySelector('img[src="/fetched-design.png"]')).not.toBeNull();
      expect(doc.querySelector('thead')?.textContent?.includes('تاريخ التركيب')).toBe(!hideInstallDate);
      expect(doc.querySelector('thead')?.textContent?.includes('صور التركيب')).toBe(!hideInstalledImages);
    }
  });

  it('paginates large rows inside portrait and landscape A4 pages', async () => {
    for (const page_orientation of ['portrait', 'landscape']) {
      const fixture = createPrintGeneratorFixture({ tableSettings: { ...tablePrintSettings, row_height: '40mm', page_orientation } });
      fixture.env.filteredItems = Array.from({ length: 20 }, () => ({ ...fixture.env.filteredItems[0] }));
      // Replace the captured array contents, since React state is captured by the generator.
      const run = createPrintGeneratorFixture({ ...fixture.env });
      const doc = new DOMParser().parseFromString(await run.generateTablePrintHTML(), 'text/html');
      expect(doc.querySelectorAll('.page').length).toBeGreaterThan(page_orientation === 'portrait' ? 3 : 4);
      expect(doc.querySelectorAll('tbody tr').length).toBe(20);
    }
  });
});
