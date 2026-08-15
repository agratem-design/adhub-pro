import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, Loader2 } from 'lucide-react';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
import { toast } from 'sonner';
import { saveHtmlAsPdf } from '@/utils/pdfHelpers';

interface SendBillboardPDFWhatsAppProps {
  contractNumber: string | number;
  customerPhone?: string;
  billboards: any[];
  designData?: any[] | null;
  includeDesigns: boolean;
  printType: 'client' | 'installation';
  selectedTeam?: string;
  adType?: string;
}

export const SendBillboardPDFWhatsApp: React.FC<SendBillboardPDFWhatsAppProps> = ({
  contractNumber,
  customerPhone = '',
  billboards,
  designData,
  includeDesigns,
  printType,
  selectedTeam,
  adType
}) => {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(customerPhone);
  const [message, setMessage] = useState(`مرحباً،\n\nنرسل لك ملف PDF للوحات الإعلانية الخاصة بالعقد رقم ${contractNumber}.\n\nشكراً لك.`);
  const { sendMessage, loading } = useSendWhatsApp();
  const [generating, setGenerating] = useState(false);

  const generatePDFAndSend = async () => {
    if (!phone.trim()) {
      toast.error('يرجى إدخال رقم الهاتف');
      return;
    }

    try {
      setGenerating(true);

      // Generate the HTML for PDF
      const html = await generateBillboardHTML();

      // Create PDF blob
      const pdfBlob = await htmlToPDF(html);

      // Upload PDF to temporary location or convert to base64
      const base64PDF = await blobToBase64(pdfBlob);

      // Send via WhatsApp (you may need to adjust this based on your WhatsApp service capabilities)
      const success = await sendMessage({
        phone,
        message: `${message}\n\n[ملف PDF: ${billboards.length} لوحة]`
      });

      if (success) {
        toast.success('تم إرسال الرسالة بنجاح');
        setOpen(false);
      }
    } catch (error) {
      console.error('Error generating/sending PDF:', error);
      toast.error('حدث خطأ أثناء إنشاء أو إرسال ملف PDF');
    } finally {
      setGenerating(false);
    }
  };

  const generateBillboardHTML = async (): Promise<string> => {
    // Import QRCode dynamically
    const QRCode = (await import('qrcode')).default;

    const getDesignsForBillboard = (billboardId: number) => {
      if (!designData || !Array.isArray(designData)) return { faceA: null, faceB: null };
      const design = designData.find((d: any) => Number(d.billboardId) === billboardId);
      return {
        faceA: design?.faceA || null,
        faceB: design?.faceB || null
      };
    };

    const hasAnyDesigns = billboards.some((b: any) => {
      const designs = getDesignsForBillboard(b.ID || b.id);
      return designs.faceA || designs.faceB || b.design_face_a || b.design_face_b;
    });
    const imageHeight = includeDesigns && hasAnyDesigns ? '80mm' : '140mm';

    const pagesHtml = await Promise.all(
      billboards.map(async (billboard) => {
        const billboardId = billboard.ID || billboard.id;
        const name = billboard.Billboard_Name || billboard.name || `لوحة ${billboardId}`;
        const image = billboard.Image_URL || billboard.image || '';
        const municipality = billboard.Municipality || billboard.municipality || '';
        const district = billboard.District || billboard.district || '';
        const landmark = billboard.Nearest_Landmark || billboard.nearest_landmark || '';
        const size = billboard.Size || billboard.size || '';
        const coords = billboard.GPS_Coordinates || '';
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : 'https://www.google.com/maps?q=';

        const designs = getDesignsForBillboard(billboardId);
        const billboardDesignA = billboard.design_face_a || designs.faceA;
        const billboardDesignB = billboard.design_face_b || designs.faceB;

        let qrCodeDataURL = '';
        try {
          qrCodeDataURL = await QRCode.toDataURL(mapLink, { width: 100 });
        } catch (e) {
          console.warn('Failed to generate QR code:', e);
        }

        const municipalityDistrict = [municipality, district].filter(Boolean).join(' - ') || '—';
        const hasDesigns = billboardDesignA || billboardDesignB;

        return `
          <div class="page">
            <div class="background"></div>
            <div class="absolute-field contract-number" style="top: 39.869mm;right: 22mm;">
              عقد رقم: ${contractNumber}
            </div>
            ${adType ? `
              <div class="absolute-field ad-type" style="top: 40mm;right: 46mm;">
                نوع الإعلان: ${adType}
              </div>
            ` : ''}
            <div class="absolute-field billboard-name" style="top: 55.588mm;left: 15.5%;transform: translateX(-50%);width: 120mm;text-align: center;">
              ${name}
            </div>
            <div class="absolute-field size" style="top: 52mm;left: 63%;transform: translateX(-50%);width: 80mm;text-align: center;">
              ${size}
            </div>
            ${printType === 'installation' ? `
              <div class="absolute-field print-type" style="top: 45mm; right: 22mm; font-size: 14px; color: #d4af37; font-weight: bold;">
                فريق التركيب
              </div>
            ` : ''}
            ${image ? `
              <div class="absolute-field image-container" style="top: 90mm; left: 50%; transform: translateX(-50%); width: 120mm; height: ${imageHeight};">
                <img src="${image}" alt="صورة اللوحة" class="billboard-image" />
              </div>
            ` : ''}
            <div class="absolute-field location-info" style="top: 233mm;left: 0;width: 150mm;">
              ${municipalityDistrict}
            </div>
            <div class="absolute-field landmark-info" style="top: 241mm;left: 0mm;width: 150mm;">
              ${landmark || '—'}
            </div>
            ${qrCodeDataURL ? `
              <div class="absolute-field qr-container" style="top: 255mm; left: 65mm; width: 30mm; height: 30mm;">
                <img src="${qrCodeDataURL}" alt="QR" class="qr-code" />
              </div>
            ` : ''}
            ${includeDesigns && hasDesigns ? `
              <div class="absolute-field designs-section" style="top: 180mm; left: 20mm; width: 170mm; display: flex; gap: 10mm;">
                ${billboardDesignA ? `
                  <div class="design-item">
                    <div class="design-label">الوجه الأمامي</div>
                    <img src="${billboardDesignA}" alt="الوجه الأمامي" class="design-image" />
                  </div>
                ` : ''}
                ${billboardDesignB ? `
                  <div class="design-item">
                    <div class="design-label">الوجه الخلفي</div>
                    <img src="${billboardDesignB}" alt="الوجه الخلفي" class="design-image" />
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        `;
      })
    );

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>فاتورة تركيب - عقد ${contractNumber}</title>
        <style>
          @font-face {
            font-family: 'Manrope';
            src: url('/Manrope-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
          }
          @font-face {
            font-family: 'Doran';
            src: url('/Doran-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Doran', Arial, sans-serif;
            direction: rtl;
            background: white;
            color: #000;
            padding: 0;
            margin: 0;
          }
          .page {
            position: relative;
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            page-break-after: always;
            overflow: hidden;
          }
          .page:last-child { page-break-after: avoid; }
          .background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: url('/ipg.svg');
            background-size: 210mm 297mm;
            background-repeat: no-repeat;
            z-index: 0;
          }
          .absolute-field {
            position: absolute;
            z-index: 5;
            color: #000;
          }
          .billboard-name {
            font-family: 'Manrope', Arial, sans-serif;
            font-size: 20px;
            font-weight: 500;
            color: #333;
          }
          .size {
            font-family: 'Manrope', Arial, sans-serif;
            font-size: 41px;
            font-weight: 500;
          }
          .ad-type {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 30px;
            font-weight: 600;
            color: #000;
          }
          .contract-number {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 16px;
            font-weight: 500;
          }
          .location-info, .landmark-info {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 16px;
          }
          .image-container {
            overflow: hidden;
            background: rgba(255,255,255,0.8);
            border: 3px solid #000;
            border-radius: 0 0 0 8px;
          }
          .billboard-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }
          .qr-code {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .designs-section { flex-wrap: wrap; }
          .design-item {
            flex: 1;
            min-width: 70mm;
            text-align: center;
          }
          .design-label {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 4px;
            color: #333;
          }
          .design-image {
            width: 100%;
            max-height: 60mm;
            object-fit: contain;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          @page {
            size: A4;
            margin: 0;
          }
        </style>
      </head>
      <body>
        ${pagesHtml.join('\n')}
      </body>
      </html>
    `;
  };

  const htmlToPDF = async (html: string): Promise<Blob> => {
    // Use html2pdf library
    const html2pdf = (await import('html2pdf.js')).default;

    return new Promise((resolve, reject) => {
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `عقد_${contractNumber}_لوحات.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          foreignObjectRendering: true,
          letterRendering: true,
          width: 794,
          windowWidth: 794,
          onclone: (clonedDoc: Document) => {
            const s = clonedDoc.createElement('style');
            s.textContent = `* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; } tr, td, th, img, svg { page-break-inside: avoid !important; break-inside: avoid !important; } table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important; } .container, [class*="max-w-"] { max-width: none !important; }`;
            clonedDoc.head.appendChild(s);
          },
        },
        jsPDF: {
          unit: 'mm' as const,
          format: 'a4' as const,
          orientation: 'portrait' as const,
          compress: true,
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as any },
      };

      html2pdf()
        .set(opt)
        .from(html)
        .outputPdf('blob')
        .then((blob: Blob) => resolve(blob))
        .catch((error: any) => reject(error));
    });
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Send className="h-4 w-4" />
          إرسال PDF عبر واتساب
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>إرسال ملف PDF عبر واتساب</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input
              id="phone"
              placeholder="0912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">الرسالة</Label>
            <Textarea
              id="message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={generating || loading}
            >
              إلغاء
            </Button>
            <Button
              onClick={generatePDFAndSend}
              disabled={generating || loading}
              className="gap-2"
            >
              {(generating || loading) && <Loader2 className="h-4 w-4 animate-spin" />}
              إرسال
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
