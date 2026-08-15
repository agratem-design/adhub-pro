import { MergedInvoiceStyles, hexToRgba } from '@/hooks/useInvoiceTemplateSettings';

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  contractNumber?: string;
  customer: {
    name: string;
    company?: string;
    phone?: string;
    address?: string;
  };
  items: {
    description: string;
    size?: string;
    qty: number;
    faces?: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  discount?: number;
  discountReason?: string;
  total: number;
  notes?: string;
  period?: string;
}

export const generateStyledInvoiceHTML = (
  data: InvoiceData,
  styles: MergedInvoiceStyles,
  title: string = 'فاتورة'
): string => {
  const bdr = `${(styles as any).tableBorderWidth || 1}px ${(styles as any).tableBorderStyle || 'solid'} ${styles.tableBorderColor}`;
  const itemsRows = data.items.map((item, idx) => `
    <tr style="background-color: ${hexToRgba(idx % 2 === 0 ? styles.tableRowEvenColor : styles.tableRowOddColor, styles.tableRowOpacity)};">
      <td style="padding: 12px 8px; border: ${bdr}; text-align: center; color: ${styles.tableTextColor};">${idx + 1}</td>
      <td style="padding: 12px 8px; border: ${bdr}; text-align: center; color: ${styles.tableTextColor};">${item.description}</td>
      ${item.size ? `<td style="padding: 12px 8px; border: ${bdr}; text-align: center; color: ${styles.tableTextColor};">${item.size}</td>` : ''}
      <td style="padding: 12px 8px; border: ${bdr}; text-align: center; color: ${styles.tableTextColor};">${item.qty}</td>
      ${item.faces !== undefined ? `<td style="padding: 12px 8px; border: ${bdr}; text-align: center; color: ${styles.tableTextColor};">${item.faces}</td>` : ''}
      <td style="padding: 12px 8px; border: ${bdr}; text-align: center; color: ${styles.tableTextColor};">${item.unitPrice.toLocaleString()} د.ل</td>
      <td style="padding: 12px 8px; border: ${bdr}; text-align: center; color: ${styles.tableTextColor}; font-weight: bold;">${item.total.toLocaleString()} د.ل</td>
    </tr>
  `).join('');

  const hasSize = data.items.some(i => i.size);
  const hasFaces = data.items.some(i => i.faces !== undefined);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${data.invoiceNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: '${styles.fontFamily}', 'Noto Sans Arabic', Arial, sans-serif;
      background: #fff;
      color: #333;
      direction: rtl;
      font-size: ${styles.bodyFontSize}px;
      line-height: 1.6;
    }
    
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm;
      background: #fff;
      position: relative;
    }
    
    ${styles.backgroundImage ? `
    .invoice-container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url('${styles.backgroundImage}');
      background-size: ${styles.backgroundScale}%;
      background-position: ${styles.backgroundPosX}% ${styles.backgroundPosY}%;
      background-repeat: no-repeat;
      opacity: ${styles.backgroundOpacity / 100};
      pointer-events: none;
      z-index: 0;
    }
    ` : ''}
    
    .content {
      position: relative;
      z-index: 1;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid ${styles.primaryColor};
    }
    
    .header-left {
      text-align: left;
      direction: ltr;
    }
    
    .header-right {
      text-align: right;
      display: flex;
      align-items: flex-start;
      gap: 15px;
    }
    
    .invoice-title {
      font-size: 28px;
      font-weight: bold;
      font-family: 'Manrope', sans-serif;
      letter-spacing: 2px;
    }
    
    .invoice-meta {
      font-size: 11px;
      color: #666;
      margin-top: 8px;
      line-height: 1.6;
    }
    
    .company-info {
      font-size: 11px;
      color: #666;
      line-height: 1.6;
    }
    
    .company-address {
      font-weight: bold;
      color: #333;
      margin-bottom: 4px;
    }
    
    .logo {
      height: 50px;
      object-fit: contain;
    }
    
    .customer-section {
      background-color: ${hexToRgba(styles.primaryColor, 8)};
      border-right: 4px solid ${styles.primaryColor};
      padding: 15px 20px;
      margin-bottom: 20px;
    }
    
    .customer-title {
      font-size: ${styles.headerFontSize}px;
      font-weight: bold;
      color: ${styles.primaryColor};
      margin-bottom: 10px;
      text-align: center;
    }
    
    .customer-info {
      line-height: 1.8;
    }
    
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    .table th {
      padding: 12px 8px;
      background-color: ${styles.tableHeaderBgColor};
      color: ${styles.tableHeaderTextColor};
      border: ${(styles as any).tableBorderWidth || 1}px ${(styles as any).tableBorderStyle || 'solid'} ${styles.tableBorderColor};
      text-align: center;
    }
    
    .totals-section {
      margin-top: 30px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    
    .discount-row {
      color: #d9534f;
    }
    
    .grand-total {
      display: flex;
      justify-content: space-between;
      padding: 15px 20px;
      margin-top: 15px;
      background-color: ${styles.primaryColor};
      color: #fff;
      font-size: ${styles.headerFontSize + 4}px;
      font-weight: bold;
    }
    
    .notes-section {
      margin-top: 20px;
      padding: 15px;
      background-color: #f9f9f9;
      border-radius: 4px;
      line-height: 1.8;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid ${styles.tableBorderColor};
      color: ${styles.footerTextColor};
      font-size: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="content">
      ${styles.showHeader ? `
      <div class="header">
        <div class="header-left">
          <div class="invoice-title">INVOICE</div>
          <div class="invoice-meta">
            رقم الفاتورة: ${data.invoiceNumber}<br>
            التاريخ: ${data.date}
            ${data.contractNumber ? `<br>رقم العقد: ${data.contractNumber}` : ''}
          </div>
        </div>
        <div class="header-right">
          ${styles.showCompanyInfo ? `
          <div class="company-info">
            <div class="company-address">${styles.companyAddress}</div>
            هاتف: ${styles.companyPhone}
          </div>
          ` : ''}
          ${styles.showLogo ? `<img src="${styles.logoPath}" alt="Logo" class="logo">` : ''}
        </div>
      </div>
      ` : ''}
      
      <div class="customer-section">
        <div class="customer-title">بيانات العميل</div>
        <div class="customer-info">
          <div><strong>الاسم:</strong> ${data.customer.name}</div>
          ${data.customer.company ? `<div><strong>الشركة:</strong> ${data.customer.company}</div>` : ''}
          ${data.customer.phone ? `<div><strong>الهاتف:</strong> ${data.customer.phone}</div>` : ''}
          ${data.period ? `<div><strong>مدة العقد:</strong> ${data.period}</div>` : ''}
        </div>
      </div>
      
      <table class="table">
        <thead>
          <tr>
            <th>م</th>
            <th>الوصف</th>
            ${hasSize ? '<th>المقاس</th>' : ''}
            <th>الكمية</th>
            ${hasFaces ? '<th>عدد الأوجه</th>' : ''}
            <th>السعر/الوحدة</th>
            <th>المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
      
      <div class="totals-section">
        <div class="total-row">
          <span><strong>المجموع الفرعي:</strong></span>
          <span>${data.subtotal.toLocaleString()} د.ل</span>
        </div>
        ${data.discount ? `
        <div class="total-row discount-row">
          <span>خصم${data.discountReason ? ` (${data.discountReason})` : ''}:</span>
          <span>- ${data.discount.toLocaleString()} د.ل</span>
        </div>
        ` : ''}
        <div class="grand-total">
          <span>المجموع الإجمالي:</span>
          <span>${data.total.toLocaleString()} د.ل</span>
        </div>
      </div>
      
      ${data.notes ? `
      <div class="notes-section">
        <div><strong>ملاحظات:</strong></div>
        <div>${data.notes}</div>
      </div>
      ` : ''}
      
      ${styles.showFooter ? `
      <div class="footer">
        <span>شكراً لتعاملكم معنا</span>
        ${styles.showPageNumber ? '<span>صفحة 1 من 1</span>' : ''}
      </div>
      ` : ''}
    </div>
  </div>
  
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;
};

export const generateStyledReceiptHTML = (
  data: {
    receiptNumber: string;
    date: string;
    customerName: string;
    amount: number;
    amountInWords: string;
    paymentMethod?: string;
    reference?: string;
    notes?: string;
    contractNumber?: string;
    remainingBalance?: number;
  },
  styles: MergedInvoiceStyles
): string => {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إيصال قبض - ${data.receiptNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: '${styles.fontFamily}', 'Noto Sans Arabic', Arial, sans-serif;
      background: #fff;
      color: #333;
      direction: rtl;
      font-size: ${styles.bodyFontSize}px;
    }
    
    .receipt-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm;
      position: relative;
    }
    
    ${styles.backgroundImage ? `
    .receipt-container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url('${styles.backgroundImage}');
      background-size: ${styles.backgroundScale}%;
      background-position: ${styles.backgroundPosX}% ${styles.backgroundPosY}%;
      background-repeat: no-repeat;
      opacity: ${styles.backgroundOpacity / 100};
      pointer-events: none;
      z-index: 0;
    }
    ` : ''}
    
    .content {
      position: relative;
      z-index: 1;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 2px solid ${styles.primaryColor};
    }
    
    .title-section {
      text-align: center;
      flex: 1;
    }
    
    .receipt-title {
      font-size: ${styles.titleFontSize}px;
      font-weight: bold;
      color: ${styles.primaryColor};
      margin-bottom: 10px;
    }
    
    .receipt-number {
      font-size: ${styles.headerFontSize}px;
      color: #666;
    }
    
    .logo {
      height: 60px;
      object-fit: contain;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .info-box {
      background: ${hexToRgba(styles.primaryColor, 8)};
      border-right: 4px solid ${styles.primaryColor};
      padding: 15px 20px;
    }
    
    .info-title {
      font-size: ${styles.headerFontSize}px;
      font-weight: bold;
      color: ${styles.primaryColor};
      margin-bottom: 10px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    
    .info-row:last-child {
      border-bottom: none;
    }
    
    .amount-section {
      background: ${styles.primaryColor};
      color: #fff;
      padding: 30px;
      text-align: center;
      margin: 30px 0;
    }
    
    .amount-label {
      font-size: ${styles.headerFontSize}px;
      margin-bottom: 10px;
    }
    
    .amount-value {
      font-size: ${styles.titleFontSize + 10}px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .amount-words {
      font-size: ${styles.bodyFontSize}px;
      opacity: 0.9;
    }
    
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 50px;
    }
    
    .signature-box {
      text-align: center;
      padding: 20px;
      border: 2px dashed ${styles.primaryColor};
    }
    
    .signature-label {
      font-weight: bold;
      color: ${styles.primaryColor};
      margin-bottom: 40px;
    }
    
    .signature-line {
      border-top: 1px solid #333;
      margin-top: 30px;
      padding-top: 10px;
      font-size: 12px;
      color: #666;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid ${styles.tableBorderColor};
      color: ${styles.footerTextColor};
      font-size: 10px;
      text-align: center;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="content">
      ${styles.showHeader ? `
      <div class="header">
        ${styles.showLogo ? `<img src="${styles.logoPath}" alt="Logo" class="logo">` : '<div></div>'}
        <div class="title-section">
          <div class="receipt-title">إيصال قبض</div>
          <div class="receipt-number">رقم: ${data.receiptNumber} | التاريخ: ${data.date}</div>
        </div>
        <div></div>
      </div>
      ` : ''}
      
      <div class="info-grid">
        <div class="info-box">
          <div class="info-title">بيانات الإيصال</div>
          <div class="info-row">
            <span>رقم الإيصال:</span>
            <strong>${data.receiptNumber}</strong>
          </div>
          <div class="info-row">
            <span>التاريخ:</span>
            <strong>${data.date}</strong>
          </div>
          ${data.paymentMethod ? `
          <div class="info-row">
            <span>طريقة الدفع:</span>
            <strong>${data.paymentMethod}</strong>
          </div>
          ` : ''}
        </div>
        
        <div class="info-box">
          <div class="info-title">بيانات العميل</div>
          <div class="info-row">
            <span>اسم العميل:</span>
            <strong>${data.customerName}</strong>
          </div>
          ${data.contractNumber ? `
          <div class="info-row">
            <span>رقم العقد:</span>
            <strong>${data.contractNumber}</strong>
          </div>
          ` : ''}
          ${data.remainingBalance !== undefined ? `
          <div class="info-row">
            <span>الرصيد المتبقي:</span>
            <strong>${data.remainingBalance.toLocaleString()} د.ل</strong>
          </div>
          ` : ''}
        </div>
      </div>
      
      <div class="amount-section">
        <div class="amount-label">المبلغ المستلم</div>
        <div class="amount-value">${data.amount.toLocaleString()} د.ل</div>
        <div class="amount-words">${data.amountInWords}</div>
      </div>
      
      <div class="signatures">
        <div class="signature-box">
          <div class="signature-label">توقيع المستلم</div>
          <div class="signature-line">التوقيع</div>
        </div>
        <div class="signature-box">
          <div class="signature-label">ختم الشركة</div>
          <div class="signature-line">الختم</div>
        </div>
      </div>
      
      ${styles.showFooter ? `
      <div class="footer">
        <div>شكراً لتعاملكم معنا</div>
        <div style="margin-top: 5px; font-size: 9px;">
          ${styles.companyName} - ${styles.companyAddress} - هاتف: ${styles.companyPhone}
        </div>
      </div>
      ` : ''}
    </div>
  </div>
  
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;
};