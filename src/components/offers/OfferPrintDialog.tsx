import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getMergedInvoiceStylesAsync, hexToRgba } from '@/hooks/useInvoiceSettingsSync';
import { useContractTemplateSettings, DEFAULT_SECTION_SETTINGS } from '@/hooks/useContractTemplateSettings';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';

interface OfferPrintDialogProps {
  offer: {
    offer_number?: number;
    customer_name: string;
    ad_type?: string;
    start_date: string;
    end_date?: string;
    total: number;
    discount?: number;
    billboards: any[];
    currency?: string;
    notes?: string;
    duration_months?: number;
  };
  trigger?: React.ReactNode;
}

const CURRENCIES: { [key: string]: string } = {
  'LYD': 'د.ل',
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'SAR': 'ر.س',
  'AED': 'د.إ',
};

export function OfferPrintDialog({ offer, trigger }: OfferPrintDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  
  // ✅ جلب إعدادات القالب من قاعدة البيانات
  const { data: templateData } = useContractTemplateSettings();
  const tableBgUrl = templateData?.tableBackgroundUrl || '/bgc2.svg';

  const getCurrencySymbol = (code?: string) => CURRENCIES[code || 'LYD'] || 'د.ل';

  const extractOfferData = () => {
    const offerNumber = offer.offer_number || Date.now().toString().slice(-6);
    const customerName = offer.customer_name || '';
    const adType = offer.ad_type || 'عرض سعر للوحات إعلانية';
    const startDate = offer.start_date || '';
    const endDate = offer.end_date || '';
    const totalCost = offer.total || 0;
    const currencySymbol = getCurrencySymbol(offer.currency);

    let duration = '';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      duration = `${durationDays}`;
    }

    const formattedPrice = `${totalCost.toLocaleString('ar-LY')}`;
    const formattedStartDate = startDate ? new Date(startDate).toLocaleDateString('ar-LY') : new Date().toLocaleDateString('ar-LY');
    const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('ar-LY') : '';
    const year = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
    const billboardCount = offer.billboards ? offer.billboards.length : 0;
    const billboardInfo = billboardCount > 0 ? ` (${billboardCount} لوحة إعلانية)` : '';

    return {
      offerNumber: offerNumber.toString(),
      customerName,
      adType: adType + billboardInfo,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      price: formattedPrice,
      duration,
      year: year.toString(),
      companyName: '',
      phoneNumber: '',
      currencySymbol,
    };
  };

  const handlePrintOffer = async () => {
    const offerData = extractOfferData();
    const docTitle = `عرض_سعر_${offerData.offerNumber}_${offerData.customerName}`;
    const printWindow = preparePrintWindow(docTitle);

    try {
      setIsGenerating(true);
      const billboards: any[] = Array.isArray(offer.billboards) ? offer.billboards : [];

      const normalizeBillboard = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const image = String(b.image ?? b.Image ?? b.Image_URL ?? b.image_url ?? '');
        const municipality = String(b.Municipality ?? b.municipality ?? '');
        const district = String(b.District ?? b.district ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? '');
        const size = String(b.Size ?? b.size ?? '');
        const faces = String(b.Faces_Count ?? b.faces ?? b.Faces ?? '2');
        const priceVal = b.contractPrice ?? b.price ?? b.Price ?? b.rent ?? 0;
        const price = typeof priceVal === 'number'
          ? `${priceVal.toLocaleString('ar-LY')} ${offerData.currencySymbol}`
          : priceVal;
        let coords = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? '');
        if (!coords || coords === 'undefined') {
          const lat = b.Latitude ?? b.lat;
          const lng = b.Longitude ?? b.lng;
          if (lat && lng) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '#';
        return { id, image, municipality, district, landmark, size, faces, price, mapLink };
      };

      const normalizedRows = billboards.map(normalizeBillboard);
      const ROWS_PER_PAGE = 12;

      const tablePagesHtml = normalizedRows.length
        ? normalizedRows
            .reduce((pages: any[][], row, idx) => {
              const p = Math.floor(idx / ROWS_PER_PAGE);
              if (!pages[p]) pages[p] = [];
              pages[p].push(row);
              return pages;
            }, [])
            .map((rows) => `
              <div class="template-container">
                <img src="${tableBgUrl}" alt="خلفية جدول اللوحات" class="template-image" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:8%" />
                      <col style="width:14%" />
                      <col style="width:12%" />
                      <col style="width:12%" />
                      <col style="width:18%" />
                      <col style="width:10%" />
                      <col style="width:8%" />
                      <col style="width:10%" />
                      <col style="width:8%" />
                    </colgroup>
                    <tbody>
                      ${rows.map((r) => `
                        <tr>
                          <td class="c-num">${r.id}</td>
                          <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" />` : ''}</td>
                          <td>${r.municipality}</td>
                          <td>${r.district}</td>
                          <td>${r.landmark}</td>
                          <td>${r.size}</td>
                          <td>${r.faces}</td>
                          <td>${r.price}</td>
                          <td>${r.mapLink !== '#' ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `).join('')
        : '';

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>عرض سعر لوحات إعلانية</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              font-family: 'Noto Sans Arabic', 'Doran', Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
              overflow-x: hidden;
            }

            .template-container {
              position: relative;
              width: 100%;
              aspect-ratio: 1191 / 1684;
              display: inline-block;
              overflow: hidden;
              margin: 20px auto;
              page-break-after: always;
            }

            .template-image,
            .overlay-svg {
              position: absolute;
              top: 0;
              left: 60px;
              width: 100%;
              height: 100%;
              object-fit: contain;
              z-index: 1;
            }

            .overlay-svg {
              z-index: 10;
              pointer-events: none;
            }

            .table-area {
              position: absolute;
              right: 140px;
              left: 140px;
              top: 500px;
              bottom: 310px;
              z-index: 20;
            }
            .btable { width: 100%; border-collapse: collapse; font-size: 26px; }
            .btable td { border: 1px solid #000; padding: 10px 8px; vertical-align: middle; }
            .c-img img { width: 120px; height: 70px; object-fit: cover; display: block; margin: 0 auto; }
            .c-num { text-align: center; font-weight: 700; }
            .btable a { color: #004aad; text-decoration: none; }

            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              @page {
                size: A4;
                margin: 0;
              }
              
              body {
                padding: 0;
                margin: 0;
                width: 210mm;
              }
              
              .template-container {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                page-break-after: always;
                page-break-inside: avoid;
              }
              
              .controls {
                display: none !important;
              }
            }

            .controls {
              margin-top: 20px;
              text-align: center;
            }

            button {
              padding: 10px 20px;
              font-size: 16px;
              background-color: #0066cc;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              margin: 0 5px;
            }
          </style>
        </head>
        <body>
          <div class="template-container">
            <img src="/contract-template.png" alt="قالب العرض" class="template-image" />

            <svg
              class="overlay-svg"
              viewBox="0 0 2480 3508"
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
            >
              <!-- Header: عرض سعر لمواقع إعلانية رقم -->
              <text
                x="1750"
                y="700"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="62"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                عرض سعر لمواقع إعلانية رقم: ${offerData.offerNumber} سنة ${offerData.year}
              </text>

              <!-- التاريخ -->
              <text
                x="440"
                y="700"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="62"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                التاريخ: ${offerData.startDate}
              </text>

              <!-- نوع الإعلان -->
              <text
                x="2050"
                y="915"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="62"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                نوع الإعلان: ${offerData.adType}.
              </text>

              <!-- الطرف الأول -->
              <text
                x="2220"
                y="1140"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                الطرف الأول:
              </text>
              <text
                x="1500"
                y="1140"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                <!-- Company info from settings -->
              </text>
              <text
                x="1960"
                y="1200"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                يمثلها السيد جمال أحمد زحيل (المدير العام).
              </text>

              <!-- الطرف الثاني -->
              <text
                x="2210"
                y="1380"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                الطرف الثاني:
              </text>
              <text
                x="1920"
                y="1380"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                ${offerData.customerName}.
              </text>
              <text
                x="1970"
                y="1440"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                هاتف: ${offerData.phoneNumber}.
              </text>

              <!-- المقدمة -->
              <text
                x="2250"
                y="1630"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                المقدمة:
              </text>
              <text
                x="1290"
                y="1630"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:
              </text>

              <!-- البند الأول -->
              <text x="2240" y="1715" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle">
                البند الأول:
              </text>
              <text x="1190" y="1715" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle">
                يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدأ مدة العقد من التاريخ .
              </text>
              <text x="2095" y="1775" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle">
                المذكور في المادة السادسة
              </text>

              <!-- البند الثاني -->
              <text x="2230" y="1890" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle">
                البند الثاني:
              </text>
              <text x="1170" y="1890" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle">
                يلتزم الطرف الأول بتعبئة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل .
              </text>
              <text x="1850" y="1950" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle">
                الأخير تكاليف التغيير الناتجة عن الأحوال الجوية أو الحوادث.
              </text>

              <!-- البند الثالث -->
              <text x="2225" y="2065" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle">
                البند الثالث:
              </text>
              <text x="1240" y="2065" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle">
                في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات، يتم نقل الإعلان إلى موقع بديل، ويتولى الطرف الأول
              </text>
              <text x="1890" y="2125" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle">
                الحصول على الموافقات اللازمة من الجهات ذات العلاقة.
              </text>

              <!-- البند الرابع -->
              <text x="2235" y="2240" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle">
                البند الرابع:
              </text>
              <text x="1190" y="2240" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle">
                لايجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ بحق.
              </text>
              <text x="1530" y="2300" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle">
                استغلال المساحات في المناسبات الوطنية والانتخابات مع تعويض الطرف الثاني بفترة بديلة.
              </text>

              <!-- البند الخامس – قيمة العرض -->
              <text x="560" y="2410" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="end" dominant-baseline="middle">
                قيمة العرض ${offerData.price} ${offerData.currencySymbol} بدون طباعة، دفع عند توقيع العقد والنصف الآخر بعد
              </text>
              <text x="1640" y="2470" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle">
                التركيب، وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.
              </text>

              <!-- البند السادس – المدة -->
              <text x="2210" y="2590" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle">
                البند السادس:
              </text>
              <text x="1150" y="2590" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle">
                مدة العرض ${offerData.duration} يومًا تبدأ من ${offerData.startDate} وتنتهي في ${offerData.endDate}، ويجوز تجديده برضى الطرفين قبل
              </text>
              <text x="1800" y="2650" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle">
                انتهائه بمدة لا تقل عن 15 يومًا وفق شروط يتم الاتفاق عليها.
              </text>

              <!-- البند السابع -->
              <text x="2220" y="2760" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle">
                البند السابع:
              </text>
              <text x="1150" y="2760" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle">
                في حال حدوث خلاف بين الطرفين يتم حلّه وديًا، وإذا تعذر ذلك يُعين طرفان محاميان لتسوية النزاع بقرار نهائي
              </text>
              <text x="2200" y="2820" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle">
                وملزم للطرفين.
              </text>
            </svg>

            <div class="controls">
              <button onclick="window.print()">طباعة</button>
            </div>
          </div>

          ${tablePagesHtml}
        </body>
        </html>
      `;

      writePrintWindow(printWindow, htmlContent, {
        title: docTitle,
        landscape: false,
        showDownloadPdf: true,
        showShare: true,
        autoPrint: true,
      });

    } catch (error) {
      console.error('Error printing offer:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>طباعة العرض</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-4">
          <div className="text-sm text-muted-foreground">
            <p>الزبون: <strong>{offer.customer_name}</strong></p>
            <p>عدد اللوحات: <strong>{offer.billboards?.length || 0}</strong></p>
            <p>الإجمالي: <strong>{offer.total?.toLocaleString('ar-LY')} {getCurrencySymbol(offer.currency)}</strong></p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrintOffer} disabled={isGenerating} className="flex-1">
              <Printer className="h-4 w-4 ml-2" />
              {isGenerating ? 'جاري الإعداد...' : 'طباعة العرض'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
