/**
 * Unified Invoice Renderer
 * يقوم بتطبيق إعدادات القوالب المحفوظة على جميع الفواتير
 */
import React from 'react';
import { useInvoiceTemplateSettings, hexToRgba, MergedInvoiceStyles } from '@/hooks/useInvoiceTemplateSettings';
import { InvoiceTemplateType, SharedInvoiceSettings } from '@/types/invoice-templates';

export interface UnifiedInvoiceData {
  invoiceType: InvoiceTemplateType;
  invoiceNumber?: string;
  invoiceDate: string;
  customerName: string;
  customerCompany?: string;
  customerPhone?: string;
  title?: string; // عنوان مخصص للفاتورة
  children: React.ReactNode; // محتوى الفاتورة (الجدول والعناصر)
  totalsSection?: React.ReactNode; // قسم المجاميع
  notesSection?: React.ReactNode; // قسم الملاحظات
}

interface Props {
  data: UnifiedInvoiceData;
  printRef?: React.RefObject<HTMLDivElement>;
}

export function UnifiedInvoiceRenderer({ data, printRef }: Props) {
  const { sharedSettings, getIndividualSettings, getMergedStyles, isLoading } = useInvoiceTemplateSettings();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const styles = getMergedStyles(data.invoiceType);
  const individualSettings = getIndividualSettings(data.invoiceType);

  const fontBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = sharedSettings.logoPath || '/logofaresgold.svg';
  const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${fontBaseUrl}${logoUrl}`;

  const template = getInvoiceTemplate(data.invoiceType);
  const title = data.title || template?.label || 'فاتورة';

  return (
    <div 
      ref={printRef}
      style={{
        direction: 'rtl',
        fontFamily: sharedSettings.fontFamily || 'Doran, Manrope, system-ui, sans-serif',
        backgroundColor: '#fff',
        color: styles.customerSectionTextColor || '#111827',
        minHeight: '297mm',
        width: '210mm',
        margin: '0 auto',
        padding: `${sharedSettings.pageMarginTop || 15}mm ${sharedSettings.pageMarginRight || 15}mm ${sharedSettings.pageMarginBottom || 15}mm ${sharedSettings.pageMarginLeft || 15}mm`,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Image */}
      {sharedSettings.backgroundImage && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${sharedSettings.backgroundImage.startsWith('http') ? sharedSettings.backgroundImage : `${fontBaseUrl}${sharedSettings.backgroundImage}`})`,
            backgroundPosition: `${sharedSettings.backgroundPosX || 50}% ${sharedSettings.backgroundPosY || 50}%`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${sharedSettings.backgroundScale || 100}%`,
            opacity: (sharedSettings.backgroundOpacity || 10) / 100,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* Content Container */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        {styles.showHeader && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: `2px solid ${styles.primaryColor}`,
            }}
          >
            {/* Logo Section */}
            <div style={{ textAlign: sharedSettings.logoPosition === 'left' ? 'left' : 'right' }}>
              {sharedSettings.showLogo && (
                <img
                  src={fullLogoUrl}
                  alt="Logo"
                  style={{
                    maxWidth: `${sharedSettings.logoSize || 120}px`,
                    height: 'auto',
                  }}
                />
              )}
              {/* Contact Info */}
              {sharedSettings.showContactInfo && (
                <div
                  style={{
                    fontSize: `${sharedSettings.contactInfoFontSize || 10}px`,
                    color: styles.customerSectionTextColor,
                    lineHeight: 1.6,
                    marginTop: '8px',
                    textAlign: (sharedSettings as any).contactInfoAlignment || 'center',
                  }}
                >
                  {sharedSettings.companyAddress && <div>{sharedSettings.companyAddress}</div>}
                  {sharedSettings.companyPhone && <div>هاتف: {sharedSettings.companyPhone}</div>}
                </div>
              )}
            </div>

            {/* Title & Company Info */}
            <div style={{ textAlign: sharedSettings.logoPosition === 'left' ? 'right' : 'left' }}>
              <div
                style={{
                  fontSize: `${styles.titleFontSize || 24}px`,
                  fontWeight: 'bold',
                  color: styles.primaryColor,
                }}
              >
                {title}
              </div>
              {sharedSettings.showCompanyInfo && (
                <div style={{ marginTop: '4px' }}>
                  {sharedSettings.showCompanyName && (
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: styles.customerSectionTextColor,
                      }}
                    >
                      {sharedSettings.companyName}
                    </div>
                  )}
                  {sharedSettings.showCompanySubtitle && sharedSettings.companySubtitle && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#6b7280',
                      }}
                    >
                      {sharedSettings.companySubtitle}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Customer Info Section */}
        <div
          style={{
            backgroundColor: hexToRgba(styles.customerSectionBgColor, 50),
            border: `1px solid ${styles.customerSectionBorderColor}`,
            borderRight: `4px solid ${styles.primaryColor}`,
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontWeight: 'bold', color: styles.customerSectionTitleColor }}>العميل: </span>
              <span style={{ color: styles.customerSectionTextColor }}>{data.customerName}</span>
              {data.customerCompany && (
                <span style={{ color: '#6b7280', marginRight: '8px' }}>({data.customerCompany})</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              {data.invoiceNumber && (
                <div>
                  <span style={{ color: '#6b7280' }}>رقم الفاتورة: </span>
                  <span style={{ fontWeight: 'bold' }}>{data.invoiceNumber}</span>
                </div>
              )}
              <div>
                <span style={{ color: '#6b7280' }}>التاريخ: </span>
                <span>{new Date(data.invoiceDate).toLocaleDateString('ar-LY')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content (Table, Items, etc.) */}
        <div>{data.children}</div>

        {/* Totals Section */}
        {data.totalsSection && (
          <div style={{ marginTop: '16px' }}>{data.totalsSection}</div>
        )}

        {/* Notes Section */}
        {data.notesSection && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: hexToRgba(styles.notesBgColor, 50),
              border: `1px solid ${styles.notesBorderColor}`,
              borderRadius: '6px',
              color: styles.notesTextColor,
            }}
          >
            {data.notesSection}
          </div>
        )}

        {/* Footer */}
        {sharedSettings.showFooter && (
          <div
            style={{
              position: 'absolute',
              bottom: `${sharedSettings.footerPosition || 10}mm`,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: '11px',
              color: sharedSettings.footerTextColor || '#6b7280',
              borderTop: '1px dashed #e5e7eb',
              paddingTop: '12px',
            }}
          >
            {sharedSettings.footerText || 'شكراً لتعاملكم معنا'}
            {sharedSettings.showPageNumber && (
              <div style={{ marginTop: '4px', fontSize: '10px' }}>صفحة 1 من 1</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to get template info
function getInvoiceTemplate(type: InvoiceTemplateType) {
  const templates: Record<string, { label: string }> = {
    contract: { label: 'فاتورة عقد' },
    print_invoice: { label: 'فاتورة طباعة' },
    receipt: { label: 'إيصال دفع' },
    sales_invoice: { label: 'فاتورة مبيعات' },
    purchase_invoice: { label: 'فاتورة مشتريات' },
    payment_statement: { label: 'كشف مدفوعات' },
    print_task: { label: 'فاتورة مهمة طباعة' },
    cutout_task: { label: 'فاتورة مهمة قص' },
    account_statement: { label: 'كشف حساب' },
    quote: { label: 'عرض سعر' },
  };
  return templates[type];
}

// Export styles getter for use in HTML generation
export function getInvoiceStyles(
  sharedSettings: SharedInvoiceSettings,
  styles: MergedInvoiceStyles
): string {
  const fontBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  return `
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');
    @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Bold.otf') format('opentype'); font-weight: 700; }
    @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Regular.otf') format('opentype'); font-weight: 400; }

    :root {
      --primary: ${styles.primaryColor};
      --secondary: ${styles.secondaryColor};
      --accent: ${styles.accentColor};
      --bg: #ffffff;
      --muted: #f8fafc;
      --border: #e6eef2;
      --text: ${styles.customerSectionTextColor};
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: ${sharedSettings.fontFamily || 'Doran, Manrope, system-ui, sans-serif'};
      direction: rtl;
      background: var(--bg);
      color: var(--text);
    }

    .invoice-container {
      max-width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: ${sharedSettings.pageMarginTop || 15}mm ${sharedSettings.pageMarginRight || 15}mm ${sharedSettings.pageMarginBottom || 15}mm ${sharedSettings.pageMarginLeft || 15}mm;
      background: var(--bg);
      position: relative;
      box-sizing: border-box;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--primary);
    }

    .logo img {
      max-width: ${sharedSettings.logoSize || 120}px;
      height: auto;
    }

    .title {
      font-size: ${styles.titleFontSize || 24}px;
      font-weight: bold;
      color: var(--primary);
    }

    .customer-info {
      background: ${hexToRgba(styles.customerSectionBgColor, 50)};
      border: 1px solid ${styles.customerSectionBorderColor};
      border-right: 4px solid var(--primary);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }

    thead th {
      background: ${styles.tableHeaderBgColor};
      color: ${styles.tableHeaderTextColor};
      padding: 10px 8px;
      text-align: center;
      font-weight: 700;
      font-size: ${styles.headerFontSize || 12}px;
    }

    tbody td {
      border: ${(styles as any).tableBorderWidth || 1}px ${(styles as any).tableBorderStyle || 'solid'} ${styles.tableBorderColor};
      padding: 10px;
      text-align: center;
      font-size: ${styles.bodyFontSize || 11}px;
      color: ${styles.tableTextColor};
    }

    tbody tr:nth-child(even) {
      background: ${hexToRgba(styles.tableRowEvenColor, styles.tableRowOpacity)};
    }

    tbody tr:nth-child(odd) {
      background: ${hexToRgba(styles.tableRowOddColor, styles.tableRowOpacity)};
    }

    .totals {
      margin-top: 16px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: 4px;
    }

    .subtotal-row {
      background: ${hexToRgba(styles.subtotalBgColor, 50)};
      color: ${styles.subtotalTextColor};
    }

    .discount-row {
      color: ${styles.discountTextColor};
    }

    .grand-total-row {
      background: ${styles.totalBgColor};
      color: ${styles.totalTextColor};
      font-weight: bold;
      font-size: 16px;
    }

    .notes {
      margin-top: 16px;
      padding: 12px;
      background: ${hexToRgba(styles.notesBgColor, 50)};
      border: 1px solid ${styles.notesBorderColor};
      border-radius: 6px;
      color: ${styles.notesTextColor};
    }

    .footer {
      position: absolute;
      bottom: ${sharedSettings.footerPosition || 10}mm;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 11px;
      color: ${sharedSettings.footerTextColor || '#6b7280'};
      border-top: 1px dashed #e5e7eb;
      padding-top: 12px;
    }

    @media print {
      html, body { background: white; }
      .invoice-container { margin: 0; padding: 8mm; border: none; }
      @page { size: A4; margin: 10mm; }
    }
  `;
}

export default UnifiedInvoiceRenderer;
