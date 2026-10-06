/** Isolate the preview from application typography, using the print document's fonts and reset. */
export function buildMunicipalityPreviewDocument(content: string, baseUrl: string): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
    @font-face{font-family:'Manrope';src:url('${baseUrl}/Manrope-Medium.otf') format('opentype');font-weight:500;}
    @font-face{font-family:'Manrope-Bold';src:url('${baseUrl}/Manrope-Bold.otf') format('opentype');font-weight:700;}
    @font-face{font-family:'Doran';src:url('${baseUrl}/Doran-Medium.otf') format('opentype');font-weight:500;}
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:210mm;height:297mm;margin:0;padding:0;overflow:hidden;background:white;}
    body{font-family:'Doran',Arial,sans-serif;direction:rtl;color:#000;}
  </style></head><body>${content}</body></html>`;
}
