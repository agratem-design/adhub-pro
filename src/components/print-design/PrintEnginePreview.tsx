import { useEffect, useState, useRef } from 'react';
import { PrintSettings } from '@/types/print-settings';
import { DocumentType } from '@/types/document-types';
import { buildPrintTemplatePreview } from '@/lib/printTemplatePreview';

interface PrintEnginePreviewProps {
  settings: Omit<PrintSettings, 'document_type'>;
  documentType: DocumentType;
  zoom: number;
}

export function PrintEnginePreview({ settings, documentType, zoom }: PrintEnginePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [paperHeight, setPaperHeight] = useState(1123);
  useEffect(() => {
    let cancelled = false;
    setPreviewError('');
    buildPrintTemplatePreview(settings, documentType).then(html => {
      if (!cancelled) setHtmlContent(html);
    }).catch(error => {
      console.error('Print template preview failed', error);
      if (!cancelled) { setHtmlContent(''); setPreviewError('تعذّر تحميل معاينة هذا المستند.'); }
    });
    return () => { cancelled = true; };
  }, [settings, documentType]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open(); doc.write(htmlContent); doc.close();
    const measure = () => setPaperHeight(Math.max(1123, doc.body?.scrollHeight || 0));
    const timer = window.setTimeout(measure, 100);
    doc.fonts?.ready.then(measure);
    const images = Array.from(doc.images);
    images.forEach(img => img.addEventListener('load', measure));
    return () => {
      window.clearTimeout(timer);
      images.forEach(img => img.removeEventListener('load', measure));
    };
  }, [htmlContent]);

  return (
    <div className="overflow-auto rounded-lg border bg-muted/40 p-3" style={{ height: 'calc(100vh - 330px)', minHeight: '320px' }}>
      {previewError && <p role="alert" className="rounded-lg border bg-background p-4 text-destructive">{previewError}</p>}
      <div className="relative mx-auto bg-white shadow-lg" style={{ width: `calc(210mm * ${zoom})`, height: `${paperHeight * zoom}px` }}>
        <div className="absolute top-0 left-0" style={{ width: '210mm', height: `${paperHeight}px`, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <iframe ref={iframeRef} className="h-full w-full border-0 bg-white" title="معاينة الطباعة" sandbox="allow-same-origin" style={{ pointerEvents: 'none' }} />
        </div>
      </div>
    </div>
  );
}
