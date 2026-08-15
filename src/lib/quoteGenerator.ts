/**
 * Unified Quote/Offer Generator
 * يستخدم القاعدة الموحدة (unifiedInvoiceBase) + fetchPrintSettingsForInvoice
 */

import { resolveInvoiceStyles, formatNum, formatDateForPrint, generateHeaderHTML, generateFooterHTML, generateBaseCSS } from './unifiedInvoiceBase';
import type { ResolvedPrintStyles } from './unifiedInvoiceBase';
import { addMonths, format as fmt } from 'date-fns';

export interface QuoteItem {
  index: number;
  mapUrl: string;
  city: string;
  municipality: string;
  landmark: string;
  size: string;
  facesCount: string;
  endDate: string;
  price: number;
  imageUrl: string;
}

export interface QuoteData {
  contractNumber: string;
  date: Date;
  adType: string;
  clientName: string;
  clientRep: string;
  clientPhone: string;
  companyName: string;
  companyAddress: string;
  companyRep: string;
  iban: string;
  durationMonths: number;
  items: QuoteItem[];
  grandTotal: number;
  autoPrint?: boolean;
}

function formatCurrency(n: number): string {
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} د.ل`;
}

function buildTermsPage(t: ResolvedPrintStyles, data: QuoteData): string {
  const startDate = fmt(new Date(), 'yyyy/MM/dd');
  const endDate = fmt(addMonths(new Date(), data.durationMonths || 1), 'yyyy/MM/dd');

  return `
    <div class="terms-box">
      <p>نظراً لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:</p>
      <p><strong>البند الأول:</strong> يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدأ مدة العقد من التاريخ المذكور في المادة السادسة.</p>
      <p><strong>البند الثاني:</strong> يلتزم الطرف الأول بطباعة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل الأخير تكاليف التغيير الناتجة عن الأحوال الجوية أو الحوادث.</p>
      <p><strong>البند الثالث:</strong> في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات، يتم نقل الإعلان إلى موقع بديل، ويتولى الطرف الأول الحصول على الموافقات اللازمة من الجهات ذات العلاقة.</p>
      <p><strong>البند الرابع:</strong> لا يجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ بحق استغلال المساحات في المناسبات الوطنية والانتخابات مع تعويض الطرف الثاني بفترة بديلة.</p>
      <p><strong>البند الخامس:</strong> قيمة العرض الإجمالية: <strong style="color:${t.primaryColor}">${formatCurrency(data.grandTotal)}</strong>. تُدفع نصف القيمة عند توقيع العقد والنصف الآخر بعد التركيب، وإذا تأخر السداد عن 30 يوماً يحق للطرف الأول إعادة تأجير المساحات.</p>
      <p><strong>البند السادس:</strong> مدة العقد <strong>${data.durationMonths}</strong> شهراً تبدأ من <span class="num">${startDate}</span> وتنتهي في <span class="num">${endDate}</span> ويجوز تجديده برضى الطرفين.</p>
      <p><strong>البند السابع:</strong> في حال حدوث خلاف بين الطرفين يتم حله ودياً، وإذا تعذر ذلك يُعين طرفان محايدان لتسوية النزاع بقرار نهائي وملزم للطرفين.</p>
    </div>

    <div class="signatures">
      <div class="signature-block">
        <div>IBAN: <strong class="num">${data.iban}</strong></div>
      </div>
      <div class="signature-block">
        <div class="signature-line">الطرف الأول: ${data.companyRep}</div>
      </div>
      <div class="signature-block">
        <div class="signature-line">الطرف الثاني: ${data.clientRep} — هاتف: ${data.clientPhone}</div>
      </div>
    </div>
  `;
}

function buildItemsTable(t: ResolvedPrintStyles, data: QuoteData): string {
  const rows = data.items.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'even-row' : 'odd-row'}">
      <td>${item.index}</td>
      <td><a href="${item.mapUrl}" style="color:${t.primaryColor};text-decoration:underline;">اضغط هنا</a></td>
      <td>${item.city}</td>
      <td>${item.municipality}</td>
      <td>${item.landmark}</td>
      <td>${item.size}</td>
      <td>${item.facesCount}</td>
      <td class="num">${item.endDate}</td>
      <td style="color:${t.primaryColor};font-weight:bold;">${formatCurrency(item.price)}</td>
      <td><img src="${item.imageUrl || '/placeholder.svg'}" alt="bb" style="height:48px;border-radius:6px;object-fit:cover;"/></td>
    </tr>
  `).join('');

  return `
    <div class="section-title" style="color:${t.primaryColor};">المواقع المتفق عليها بين الطرفين</div>
    <table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>الموقع على الخريطة</th>
          <th>المدينة</th>
          <th>البلدية</th>
          <th>أقرب نقطة دالة</th>
          <th>المقاس</th>
          <th>عدد الوجوه</th>
          <th>تاريخ الانتهاء</th>
          <th>السعر</th>
          <th>صورة</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr class="grand-total-row">
          <td colspan="8" class="totals-label">الإجمالي</td>
          <td colspan="2" class="totals-value">${formatCurrency(data.grandTotal)}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

export async function generateQuoteHTML(data: QuoteData): Promise<string> {
  const t = await resolveInvoiceStyles('contract', {
    titleAr: 'عقد استئجار مساحات إعلانية',
    titleEn: 'ADVERTISING LEASE CONTRACT',
  });

  const fontBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const metaHtml = `
    التاريخ: <span class="num">${formatDateForPrint(data.date?.toISOString() || '', t.showHijriDate)}</span><br/>
    رقم العقد: <span class="num">${data.contractNumber}</span><br/>
    نوع الإعلان: ${data.adType}
  `;

  const extraCSS = `
    .terms-box {
      background: linear-gradient(135deg, ${t.customerBg}, #ffffff);
      border-right: 5px solid ${t.customerBorder};
      padding: 20px; margin-bottom: 20px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .terms-box p {
      margin: 8px 0; line-height: 1.9; font-size: ${t.bodyFontSize}px;
    }
    .section-title {
      font-weight: 800; font-size: 18px; margin: 12px 0 8px;
    }
    .items-table img { max-width: 80px; }
    .page-break { page-break-before: always; margin-top: 20px; }
  `;

  // Build two-page document
  const page1 = `
    <div class="customer-section">
      <div>
        <div class="customer-label">الطرف الثاني (المعلن)</div>
        <div class="customer-name-text">${data.clientName}</div>
        ${data.clientPhone ? `<div class="customer-detail">هاتف: ${data.clientPhone}</div>` : ''}
      </div>
      <div class="stats-cards">
        <div class="stat-card">
          <div class="stat-value">${data.items.length}</div>
          <div class="stat-label">موقع</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.durationMonths}</div>
          <div class="stat-label">شهر</div>
        </div>
      </div>
    </div>
    ${buildTermsPage(t, data)}
    <div class="page-break"></div>
    ${buildItemsTable(t, data)}
  `;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>عرض سعر - ${data.contractNumber}</title>
  <style>
    ${generateBaseCSS(t)}
    ${extraCSS}
  </style>
</head>
<body>
  <div class="paper">
    ${t.bgImageUrl ? '<div class="bg-layer"></div>' : ''}
    <div class="content">
      <div class="main-content">
        ${generateHeaderHTML(t, metaHtml)}
        ${page1}
      </div>
      ${generateFooterHTML(t)}
    </div>
  </div>
  ${data.autoPrint ? '<script>window.onload=function(){window.print();}</script>' : ''}
</body>
</html>`;
}
