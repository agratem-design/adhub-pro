import { useState, useEffect, useRef, useCallback } from 'react';
import { replaceImageUrlsInHtml } from '@/utils/offlineImageInterceptor';
import { getDSFallbackScript } from '@/utils/printDSFallbackScript';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Printer, X, Download, Maximize2, Minimize2, Stamp, FileText, Loader2, CloudUpload, MessageCircle, Send, Ruler } from 'lucide-react';
import { iframeToPdfBlob } from '@/utils/pdfHelpers';
import { downloadPdfBlob, uploadPdfBlobToDrive, uploadPdfBlobAndSendWhatsApp } from '@/utils/pdfDriveWhatsApp';
import { preparePrintWindow, writePrintWindow, formatCleanDisplayTitle, formatWindowsSafeFileName } from '@/utils/printWindowHelper';
import { toast } from 'sonner';

interface PrintJob {
  html: string;
  title?: string;
  driveFolder?: string;
  phone?: string;
}

// Global event name
export const PRINT_PREVIEW_EVENT = 'app:print-preview';

// Helper to trigger print preview from anywhere
export function showPrintPreview(html: string, title?: string, driveFolder?: string, phone?: string) {
  window.dispatchEvent(
    new CustomEvent(PRINT_PREVIEW_EVENT, { detail: { html, title, driveFolder, phone } })
  );
}

export function PrintPreviewDialog() {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<PrintJob | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [showTotalMeters, setShowTotalMeters] = useState(false);
  const [hideInvoiceDate, setHideInvoiceDate] = useState(false);
  const [hideRentalNotes, setHideRentalNotes] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDriveUploading, setIsDriveUploading] = useState(false);
  const [isWhatsAppSending, setIsWhatsAppSending] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const hasTotalMetersRow = job?.html?.includes('total-meters-row') ?? false;
  const hasRentalNotes = job?.html?.includes('invoice-rental-notes') ?? false;
  const hasInvoiceDate = job?.html?.includes('invoice-meta') ?? false;

  const handleEvent = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as PrintJob;
    setJob(detail);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(PRINT_PREVIEW_EVENT, handleEvent);
    return () => window.removeEventListener(PRINT_PREVIEW_EVENT, handleEvent);
  }, [handleEvent]);

  // Auto-fill phone from job data
  useEffect(() => {
    if (job?.phone) {
      setWhatsAppPhone(job.phone);
    }
  }, [job]);

  // Strip auto-print scripts & toggle signature/meters visibility in HTML
  const getProcessedHtml = useCallback((html: string, showSig: boolean, showMeters: boolean, hidDate: boolean, hidNotes: boolean) => {
    let processed = replaceImageUrlsInHtml(html);
    processed = processed
      .replace(/<script[^>]*>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi, '')
      .replace(/onload\s*=\s*["'][^"']*window\.print\(\)[^"']*["']/gi, '');
    processed = processed.replace('</head>', getDSFallbackScript() + '<style>html, body { overflow-y: visible !important; height: auto !important; }</style></head>');
    if (!showSig) {
      processed = processed.replace('</head>', '<style>.signature-stamp-section { display: none !important; }</style></head>');
    }
    if (showMeters) {
      processed = processed.replace('</head>', '<style>.total-meters-row { display: table-row !important; }</style></head>');
    }
    if (hidDate) {
      processed = processed.replace('</head>', '<style>.invoice-meta { display: none !important; }</style></head>');
    }
    if (hidNotes) {
      processed = processed.replace('</head>', '<style>.invoice-rental-notes { display: none !important; }</style></head>');
    }
    return processed;
  }, []);

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (!doc || !win) return;

      const updateHeight = () => {
        if (!iframe || !doc) return;
        const bodyHeight = doc.body?.scrollHeight || 0;
        const htmlHeight = doc.documentElement?.scrollHeight || 0;
        const contentHeight = Math.max(bodyHeight, htmlHeight);
        if (contentHeight > 0) {
          iframe.style.height = `${contentHeight + 20}px`;
        }
      };

      updateHeight();
      setTimeout(updateHeight, 150);
      setTimeout(updateHeight, 600);

      // Forward wheel events from iframe window to parent ScrollArea viewport
      const handleIframeWheel = (e: WheelEvent) => {
        const viewport = iframe.closest('[data-radix-scroll-area-viewport]') || iframe.closest('.overflow-y-auto') || iframe.parentElement;
        if (viewport) {
          viewport.scrollTop += e.deltaY;
        }
      };

      win.removeEventListener('wheel', handleIframeWheel);
      win.addEventListener('wheel', handleIframeWheel, { passive: true });

      if (doc.body && typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => updateHeight());
        observer.observe(doc.body);
      }
    } catch (err) {
      console.warn('Iframe setup error:', err);
    }
  }, []);

  const iframeSrcDoc = open && job ? getProcessedHtml(job.html, showSignature, showTotalMeters, hideInvoiceDate, hideRentalNotes) : undefined;

  const cleanTitle = formatCleanDisplayTitle(job?.title);

  const getCleanPdfFileName = () => {
    return (cleanTitle || 'document')
      .replace(/[\\/:*?"<>|#]/g, '-')
      .replace(/\s*•\s*/g, ' - ')
      .replace(/\s+/g, ' ')
      .replace(/-+/g, '-')
      .trim() + '.pdf';
  };

  const handlePrint = () => {
    const safeName = formatWindowsSafeFileName(cleanTitle || 'مستند');
    if (iframeRef.current?.contentWindow) {
      try {
        const prevTitle = document.title;
        document.title = safeName;
        if (iframeRef.current.contentDocument) {
          iframeRef.current.contentDocument.title = safeName;
        }
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        setTimeout(() => { document.title = prevTitle; }, 2000);
        return;
      } catch (e) {
        console.warn('Direct iframe print error, falling back:', e);
      }
    }

    if (!job?.html) return;
    const processedHtml = getProcessedHtml(job.html, showSignature, showTotalMeters, hideInvoiceDate, hideRentalNotes);
    const title = safeName;
    const isLandscape = Boolean(
      processedHtml.includes('size: landscape') ||
      processedHtml.includes('size: A4 landscape') ||
      processedHtml.includes('class="landscape"') ||
      processedHtml.includes('data-orientation="landscape"')
    );
    const printWindow = preparePrintWindow(title);
    writePrintWindow(printWindow, processedHtml, {
      title,
      landscape: isLandscape,
      showDownloadPdf: true,
      showShare: true,
      autoPrint: false,
    });
  };

  // دالة موحدة لإنتاج Blob متطابق 100% لجميع العمليات (التحميل، الرفع، والواتساب)
  const getUnifiedPdfBlob = async (): Promise<{ pdfBlob: Blob; fileName: string }> => {
    const fileName = getCleanPdfFileName();
    if (!iframeRef.current) {
      throw new Error('لا يمكن الوصول إلى معاينة المستند');
    }
    const isLandscape = Boolean(
      job?.html?.includes('size: landscape') ||
      job?.html?.includes('size: A4 landscape') ||
      job?.html?.includes('class="landscape"') ||
      job?.html?.includes('data-orientation="landscape"')
    );
    const pdfBlob = await iframeToPdfBlob(iframeRef.current, fileName, {
      marginMm: [0, 0, 0, 0],
      landscape: isLandscape,
    });
    return { pdfBlob, fileName };
  };

  const handleDownloadPdf = async () => {
    if (!iframeRef.current && !job?.html) return;
    setIsPdfLoading(true);
    try {
      const { pdfBlob, fileName } = await getUnifiedPdfBlob();
      downloadPdfBlob(pdfBlob, fileName);
      toast.success('تم تحميل PDF بنجاح');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('فشل تحميل PDF');
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handleSavePdf = handleDownloadPdf;

  const handleUploadToDrive = async () => {
    if (!iframeRef.current && !job?.html) return;
    const folder = job?.driveFolder || 'documents';
    setIsDriveUploading(true);
    try {
      const { pdfBlob, fileName } = await getUnifiedPdfBlob();
      await uploadPdfBlobToDrive({ pdfBlob, fileName, driveFolder: folder });
      toast.success('تم رفع الملف إلى المجلد بنجاح');
    } catch (err) {
      console.error('Drive upload failed:', err);
      toast.error('فشل رفع الملف');
    } finally {
      setIsDriveUploading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if ((!iframeRef.current && !job?.html) || !whatsAppPhone.trim()) {
      toast.error('يرجى إدخال رقم الهاتف');
      return;
    }
    const folder = job?.driveFolder || 'documents';
    setIsWhatsAppSending(true);
    try {
      const { pdfBlob, fileName } = await getUnifiedPdfBlob();
      await uploadPdfBlobAndSendWhatsApp({
        pdfBlob,
        fileName,
        driveFolder: folder,
        phone: whatsAppPhone,
        message: `مستند: ${cleanTitle || 'مستند'}\n\n`,
      });
      toast.success('تم الإرسال عبر واتساب بنجاح');
      setWhatsAppOpen(false);
    } catch (err) {
      console.error('WhatsApp send failed:', err);
      toast.error('فشل الإرسال عبر واتساب');
    } finally {
      setIsWhatsAppSending(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setJob(null);
    setFullscreen(false);
    setShowSignature(false);
    setShowTotalMeters(false);
    setHideInvoiceDate(false);
    setHideRentalNotes(false);
    setWhatsAppPhone('');
    setWhatsAppOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className={`p-0 gap-0 overflow-hidden flex flex-col [&>button]:hidden ${fullscreen
          ? 'max-w-[100vw] w-[100vw] h-[100dvh] max-h-[100dvh] rounded-none'
          : 'max-w-5xl w-full h-[100dvh] max-h-[100dvh] sm:h-[95vh] sm:max-h-[95vh]'
          }`}
        dir="rtl"
      >
        <DialogHeader className="p-3 sm:p-4 border-b bg-gradient-to-l from-primary/5 to-background shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <FileText className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-sm sm:text-base font-bold text-foreground truncate" title={cleanTitle}>
                  {cleanTitle || 'معاينة الطباعة'}
                </DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>معاينة المستند قبل الطباعة</DialogDescription>
                </VisuallyHidden>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
              <Button 
                onClick={handlePrint} 
                className="gap-2 bg-[#d6ac40] hover:bg-[#c59b35] text-black font-bold h-9 px-4 rounded-xl shadow-md cursor-pointer transition-all border-none" 
                size="sm"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">طباعة</span>
              </Button>

              <Button 
                variant="outline" 
                className="gap-2 h-9 px-4 rounded-xl cursor-pointer border-border/80 hover:bg-accent" 
                size="sm" 
                onClick={handleDownloadPdf} 
                disabled={isPdfLoading}
              >
                {isPdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-emerald-500" />}
                <span className="hidden sm:inline">تحميل PDF</span>
              </Button>

              <Button 
                variant="outline" 
                className="gap-2 h-9 px-4 rounded-xl cursor-pointer border-border/80 hover:bg-accent" 
                size="sm" 
                onClick={handleUploadToDrive} 
                disabled={isDriveUploading}
              >
                {isDriveUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4 text-blue-500" />}
                <span className="hidden sm:inline">رفع للمجلد</span>
              </Button>

              {job?.phone ? (
                <Button 
                  variant="outline" 
                  className="gap-2 border-green-500/30 text-green-500 hover:bg-green-500/10 h-9 px-4 rounded-xl cursor-pointer" 
                  size="sm" 
                  onClick={handleSendWhatsApp} 
                  disabled={isWhatsAppSending}
                >
                  {isWhatsAppSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  <span className="hidden sm:inline">واتساب</span>
                </Button>
              ) : (
                <Popover open={whatsAppOpen} onOpenChange={setWhatsAppOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="gap-2 border-green-500/30 text-green-500 hover:bg-green-500/10 h-9 px-4 rounded-xl cursor-pointer" 
                      size="sm"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">واتساب</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 z-[9999]" align="end" dir="rtl">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">رقم الهاتف للواتساب</Label>
                      <Input value={whatsAppPhone} onChange={(e) => setWhatsAppPhone(e.target.value)} placeholder="مثال: 218912345678" dir="ltr" className="text-left" />
                      <Button onClick={handleSendWhatsApp} disabled={isWhatsAppSending || !whatsAppPhone.trim()} className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg" size="sm">
                        {isWhatsAppSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        إرسال المستند
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              <div className="h-6 w-px bg-border/85 mx-1"></div>

              <Button variant="ghost" size="icon" onClick={() => setFullscreen(!fullscreen)} className="h-9 w-9 rounded-xl hover:bg-accent cursor-pointer">
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              <Button variant="ghost" size="icon" onClick={handleClose} className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive cursor-pointer">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 pt-3 border-t border-border/40 text-sm bg-muted/20 p-2.5 rounded-xl">
            <span className="text-xs font-semibold text-muted-foreground">خيارات العرض والطباعة:</span>
            
            <div className="flex items-center gap-2">
              <Switch id="print-signature-toggle" checked={showSignature} onCheckedChange={setShowSignature} />
              <Label htmlFor="print-signature-toggle" className="text-xs cursor-pointer whitespace-nowrap flex items-center gap-1 select-none font-medium">
                <Stamp className="h-3.5 w-3.5 text-amber-500" />
                <span>إدراج الختم والتوقيع</span>
              </Label>
            </div>

            {hasTotalMetersRow && (
              <div className="flex items-center gap-2">
                <Switch id="print-meters-toggle" checked={showTotalMeters} onCheckedChange={setShowTotalMeters} />
                <Label htmlFor="print-meters-toggle" className="text-xs cursor-pointer whitespace-nowrap flex items-center gap-1 select-none font-medium">
                  <Ruler className="h-3.5 w-3.5 text-blue-500" />
                  <span>إظهار إجمالي الأمتار</span>
                </Label>
              </div>
            )}

            {hasInvoiceDate && (
              <div className="flex items-center gap-2">
                <Switch id="print-hide-date" checked={hideInvoiceDate} onCheckedChange={setHideInvoiceDate} />
                <Label htmlFor="print-hide-date" className="text-xs cursor-pointer whitespace-nowrap select-none font-medium">
                  <span>إخفاء التاريخ</span>
                </Label>
              </div>
            )}

            {hasRentalNotes && (
              <div className="flex items-center gap-2">
                <Switch id="print-hide-notes" checked={hideRentalNotes} onCheckedChange={setHideRentalNotes} />
                <Label htmlFor="print-hide-notes" className="text-xs cursor-pointer whitespace-nowrap select-none font-medium">
                  <span>إخفاء الملاحظات</span>
                </Label>
              </div>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="bg-muted/30 flex items-start justify-center p-2 sm:p-6 min-h-full">
            <iframe
              ref={iframeRef}
              srcDoc={iframeSrcDoc}
              onLoad={handleIframeLoad}
              className="bg-white shadow-xl rounded-lg w-full border-0"
              style={{
                maxWidth: fullscreen ? '900px' : '794px',
                minHeight: fullscreen ? 'calc(100dvh - 80px)' : 'calc(100dvh - 120px)',
              }}
              title="print-preview"
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
