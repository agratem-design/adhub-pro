import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X } from 'lucide-react';
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml, formatDateForPrint } from '@/lib/unifiedInvoiceBase';

interface FriendRentalReceiptPrintDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rental: any;
  customerName: string;
}

const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimalPart) return `${formattedInteger}.${decimalPart}`;
  return formattedInteger;
};

export default function FriendRentalReceiptPrintDialog({ 
  open, 
  onOpenChange, 
  rental, 
  customerName 
}: FriendRentalReceiptPrintDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [billboardData, setBillboardData] = useState<any>(null);
  const [installationData, setInstallationData] = useState<any>(null);

  const loadBillboardData = async () => {
    if (!rental?.billboard_id) return;

    try {
      // Load billboard data
      const { data: billboard, error: billboardError } = await supabase
        .from('billboards')
        .select('*')
        .eq('ID', rental.billboard_id)
        .single();

      if (!billboardError && billboard) {
        setBillboardData(billboard);

        // Load installation task data for this billboard and contract
        const { data: installationTask } = await supabase
          .from('installation_tasks')
          .select(`
            *,
            installation_task_items!inner(*)
          `)
          .eq('contract_id', rental.contract_number)
          .single();

        if (installationTask) {
          const items = (installationTask as any).installation_task_items || [];
          const billboardItem = items.find((item: any) => item.billboard_id === rental.billboard_id);
          
          if (billboardItem) {
            setInstallationData(billboardItem);
          }
        }
      }
    } catch (error) {
      console.error('Error loading billboard data:', error);
    }
  };

  useEffect(() => {
    if (open && rental) {
      loadBillboardData();
    }
  }, [open, rental]);

  const handlePrintReceipt = async () => {
    if (!rental) {
      toast.error('لا توجد بيانات للطباعة');
      return;
    }

    setIsGenerating(true);
    
    try {
      // جلب إعدادات القالب المحفوظة
      const styles = await getMergedInvoiceStylesAsync('friend_rental');
      const baseUrl = window.location.origin;
      const logoUrl = styles.logoPath || '/logofaresgold.svg';
      const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;
      
      // No popup test needed

      const receiptDate = formatDateForPrint(new Date().toISOString(), styles.showHijriDate);
      const receiptNumber = `FR-${Date.now()}`;
      
      const billboardName = billboardData?.Billboard_Name || `لوحة ${rental.billboard_id}`;
      const billboardSize = billboardData?.Size || 'غير محدد';
      const rentalCost = Number(rental.friend_rental_cost || 0);
      const startDate = formatDateForPrint(rental.start_date, styles.showHijriDate);
      const endDate = formatDateForPrint(rental.end_date, styles.showHijriDate);
      
      const installationDate = installationData?.installation_date 
        ? formatDateForPrint(installationData.installation_date, styles.showHijriDate)
        : 'غير محدد';
      
      const designImage = installationData?.design_face_a || billboardData?.design_face_a;
      const installedImage = installationData?.installed_image_face_a_url;

      const metaLinesHtml = `
        <div><strong>رقم الفاتورة:</strong> ${receiptNumber}</div>
        <div><strong>التاريخ:</strong> ${receiptDate}</div>
      `;

      const headerHtml = unifiedHeaderHtml({
        styles,
        fullLogoUrl,
        metaLinesHtml,
        titleAr: 'إيصال إيجار شريك',
        titleEn: 'FRIEND RENTAL'
      });

      const footerHtml = unifiedFooterHtml(styles, 'صفحة 1 من 1');

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>فاتورة إيجار لوحة - ${billboardName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Manrope'; src: url('${baseUrl}/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            html, body {
              width: 210mm;
              height: 297mm;
              font-family: 'Noto Sans Arabic', Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
              font-size: 11px;
              line-height: 1.3;
              overflow: hidden;
            }
            
            .receipt-container {
              width: 210mm;
              min-height: 297mm;
              padding: 12mm;
              display: flex;
              flex-direction: column;
            }
            
            ${unifiedHeaderFooterCss(styles)}
            
            .customer-section {
              background: ${styles.primaryColor}10;
              padding: 15px;
              margin: 20px 0;
              border-radius: 8px;
              border: ${styles.tableBorderWidth || 1}px ${styles.tableBorderStyle || 'solid'} ${styles.tableBorderColor};
            }
            
            .customer-title {
              font-size: 14px;
              font-weight: bold;
              color: ${styles.primaryColor};
              margin-bottom: 10px;
            }
            
            .customer-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            
            .customer-field {
              display: flex;
              justify-content: space-between;
            }
            
            .field-label { font-weight: bold; color: ${styles.customerSectionTextColor}; }
            .field-value { color: #212529; }
            
            .billboard-images {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin: 20px 0;
            }
            
            .image-container { text-align: center; }
            
            .image-label {
              font-size: 14px;
              font-weight: bold;
              color: ${styles.primaryColor};
              margin-bottom: 8px;
            }
            
            .billboard-image {
              width: 100%;
              height: 200px;
              object-fit: cover;
              border-radius: 8px;
              border: 2px solid ${styles.tableBorderColor};
            }
            
            .details-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            
            .details-table th, .details-table td {
              border: ${styles.tableBorderWidth || 1}px ${styles.tableBorderStyle || 'solid'} ${styles.tableBorderColor};
              padding: 10px;
              text-align: center;
            }
            
            .details-table th {
              background: ${styles.primaryColor}15;
              font-weight: bold;
              color: ${styles.primaryColor};
            }
            
            .amount-section {
              background: ${styles.primaryColor};
              color: white;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: center;
            }
            
            .amount-label { font-size: 16px; margin-bottom: 10px; }
            .amount-value { font-size: 32px; font-weight: bold; }
            
            .content-area { flex: 1; }
            
            @media print {
              html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; }
              @page { size: A4; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            ${headerHtml}
            
            <div class="content-area">
              <div class="customer-section">
                <div class="customer-title">معلومات العميل</div>
                <div class="customer-details">
                  <div class="customer-field">
                    <span class="field-label">اسم العميل:</span>
                    <span class="field-value">${customerName}</span>
                  </div>
                  <div class="customer-field">
                    <span class="field-label">رقم العقد:</span>
                    <span class="field-value">#${rental.contract_number}</span>
                  </div>
                </div>
              </div>

              <table class="details-table">
                <thead>
                  <tr>
                    <th>اسم اللوحة</th>
                    <th>المقاس</th>
                    <th>تاريخ البدء</th>
                    <th>تاريخ الانتهاء</th>
                    <th>تاريخ التركيب</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${billboardName}</td>
                    <td>${billboardSize}</td>
                    <td>${startDate}</td>
                    <td>${endDate}</td>
                    <td>${installationDate}</td>
                  </tr>
                </tbody>
              </table>

              ${(designImage || installedImage) ? `
                <div class="billboard-images">
                  ${designImage ? `
                    <div class="image-container">
                      <div class="image-label">التصميم</div>
                      <img src="${designImage}" alt="تصميم اللوحة" class="billboard-image" />
                    </div>
                  ` : ''}
                  ${installedImage ? `
                    <div class="image-container">
                      <div class="image-label">صورة التركيب</div>
                      <img src="${installedImage}" alt="صورة التركيب" class="billboard-image" />
                    </div>
                  ` : ''}
                </div>
              ` : ''}

              <div class="amount-section">
                <div class="amount-label">إجمالي تكلفة الإيجار</div>
                <div class="amount-value">${formatArabicNumber(rentalCost)} د.ل</div>
              </div>

              ${rental.notes ? `
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 1px solid #ffc107;">
                  <div style="font-weight: bold; margin-bottom: 5px;">ملاحظات:</div>
                  <div>${rental.notes}</div>
                </div>
              ` : ''}
            </div>

            ${footerHtml}
          </div>
        </body>
        </html>
      `;

      const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
      showPrintPreview(htmlContent, `فاتورة إيجار شريك - ${customerName}`, 'billing-receipts');
      
      toast.success('تم إعداد الفاتورة للطباعة');
      
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('حدث خطأ أثناء إعداد الفاتورة');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="max-w-lg bg-card border-border">
        <UIDialog.DialogHeader className="border-b border-border pb-4">
          <UIDialog.DialogTitle className="text-lg font-bold text-primary text-right">
            طباعة فاتورة إيجار لوحة
          </UIDialog.DialogTitle>
        </UIDialog.DialogHeader>
        
        <div className="py-6 space-y-4">
          <div className="bg-accent/10 border border-primary/30 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">اللوحة:</span>
                <span>{billboardData?.Billboard_Name || `لوحة ${rental?.billboard_id}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">المقاس:</span>
                <span>{billboardData?.Size || 'غير محدد'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">رقم العقد:</span>
                <span>#{rental?.contract_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">المبلغ:</span>
                <span className="font-bold text-primary">
                  {formatArabicNumber(Number(rental?.friend_rental_cost || 0))} د.ل
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
              className="border-border"
            >
              <X className="h-4 w-4 ml-2" />
              إلغاء
            </Button>
            <Button
              onClick={handlePrintReceipt}
              disabled={isGenerating}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Printer className="h-4 w-4 ml-2" />
              {isGenerating ? 'جاري التحضير...' : 'طباعة'}
            </Button>
          </div>
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
