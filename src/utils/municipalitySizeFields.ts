/** One renderer for municipality settings previews and the printed size box. */
export function buildMunicipalitySizeFields(
  settings: Record<string, any>, sizeHtml: string, facesLabel: string,
): string {
  const s = settings;
  const common = `position:absolute;left:${s.size_left};transform:translateX(-50%);width:70mm;display:flex;align-items:center;justify-content:center;text-align:center;z-index:5;margin:0;padding:0;line-height:1;`;
  return `
    <style>
      .municipality-size .print-size-container { display:inline-flex;align-items:center;justify-content:center;gap:0.12em;direction:rtl;color:inherit;white-space:nowrap; }
      .municipality-size .print-dim-col { display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;color:inherit; }
      .municipality-size .print-dim-label { font-size:0.45em;font-weight:700;margin-bottom:2px;letter-spacing:0.5px;color:inherit; }
      .municipality-size .print-dim-value { font-size:1em;font-weight:700;font-family:'${s.coords_font_family || 'Manrope'}',sans-serif;color:inherit; }
      .municipality-size .print-dim-separator { font-size:0.65em;margin-top:0.25em;font-weight:700;color:inherit;font-family:'${s.coords_font_family || 'Manrope'}',sans-serif; }
    </style>
    <div class="absolute-field municipality-size" style="${common}top:${s.size_top};font-size:${s.size_font_size};font-weight:${s.size_font_weight || '500'};color:${s.size_color};">${sizeHtml}</div>
    ${s.faces_count_show !== 'false' ? `<div class="absolute-field municipality-faces" style="${common}top:${s.faces_count_top || `calc(${s.size_top} + 8mm)`};font-size:${s.faces_count_font_size};font-weight:${s.faces_count_font_weight || '700'};color:${s.faces_count_color || '#000000'};font-family:'${s.faces_count_font_family || s.coords_font_family || 'Doran'}',sans-serif;">${facesLabel}</div>` : ''}
  `;
}
