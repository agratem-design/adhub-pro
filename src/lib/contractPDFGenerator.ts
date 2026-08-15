// مولد PDF للعقود مع دعم كامل للغة العربية والخلفيات

interface ContractPDFData {
  contractNumber: string;
  customerName: string;
  adType?: string;
  startDate: string;
  endDate?: string;
  price: string;
  duration?: string;
  year: string;
  phoneNumber?: string;
  billboards?: any[];
  useInstallationImage?: boolean; // استخدام صور التركيب الفعلية بدلاً من الصور الافتراضية
}

/**
 * توليد HTML للعقد مع دعم كامل للعربية
 */
export async function generateContractHTML(data: ContractPDFData): Promise<string> {
  const {
    contractNumber,
    customerName,
    adType = 'عقد إيجار لوحات إعلانية',
    startDate,
    endDate = '',
    price,
    duration = '',
    year,
    phoneNumber = '',
    billboards = [],
    useInstallationImage = false
  } = data;

  // الحصول على صورة اللوحة (إما من التركيب أو الصورة الافتراضية)
  let billboardImage = '';
  
  if (useInstallationImage && billboards && billboards.length > 0) {
    // جلب صورة التركيب الفعلية من installation_task_items
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      for (const billboard of billboards) {
        const billboardId = billboard.ID || billboard.id;
        if (!billboardId) continue;
        
        // جلب آخر صورة تركيب مكتملة للوجه الأمامي
        const { data: installationData, error } = await supabase
          .from('installation_task_items')
          .select('installed_image_face_a_url')
          .eq('billboard_id', billboardId)
          .eq('status', 'completed')
          .not('installed_image_face_a_url', 'is', null)
          .order('installation_date', { ascending: false })
          .limit(1)
          .single();
        
        if (!error && installationData?.installed_image_face_a_url) {
          billboardImage = installationData.installed_image_face_a_url;
          break;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch installation image:', error);
    }
  }
  
  // إذا لم نجد صورة تركيب أو لم يتم تفعيل الخيار، استخدم الصورة الافتراضية
  if (!billboardImage && billboards && billboards.length > 0) {
    for (const billboard of billboards) {
      const img = billboard.image || billboard.Image || billboard.Image_URL || billboard.image_url;
      if (img && typeof img === 'string' && img.trim() !== '') {
        billboardImage = img;
        break;
      }
    }
  }

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>عقد إيجار لوحات إعلانية - ${contractNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: 'Noto Sans Arabic', Arial, sans-serif;
      direction: rtl;
      text-align: right;
      background: white;
      color: #000;
      font-size: 16px;
      line-height: 1.6;
    }

    .page {
      position: relative;
      width: 210mm;
      height: 297mm;
      margin: 0;
      background: white;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child {
      page-break-after: avoid;
    }

    .background-image {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
    }

    .content {
      position: relative;
      z-index: 1;
      padding: 60px 40px;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
    }

    .logo {
      width: 150px;
      height: auto;
      margin-bottom: 20px;
    }

    .contract-title {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 10px;
    }

    .contract-number {
      font-size: 20px;
      font-weight: 600;
      color: #555;
    }

    .section {
      margin-bottom: 25px;
      padding: 15px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 8px;
    }

    .section-title {
      font-size: 20px;
      font-weight: 700;
      color: #2c5aa0;
      margin-bottom: 12px;
      border-bottom: 2px solid #2c5aa0;
      padding-bottom: 8px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .info-label {
      font-weight: 600;
      color: #333;
      min-width: 150px;
    }

    .info-value {
      color: #555;
      text-align: left;
    }

    .billboard-image-container {
      margin-top: 30px;
      text-align: center;
    }

    .billboard-image {
      max-width: 100%;
      max-height: 400px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .footer {
      position: absolute;
      bottom: 30px;
      left: 40px;
      right: 40px;
      text-align: center;
      font-size: 14px;
      color: #666;
      border-top: 2px solid #2c5aa0;
      padding-top: 15px;
    }

    .company-info {
      margin-top: 10px;
      font-size: 12px;
      color: #888;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      
      .page {
        margin: 0;
        border: none;
        box-shadow: none;
      }
      
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- صورة الخلفية -->
    <img src="/contract-template.png" alt="خلفية العقد" class="background-image" onerror="this.style.display='none'">
    
    <div class="content">
      <!-- الترويسة -->
      <div class="header">
        <img src="/logofaresgold.svg" alt="شعار الشركة" class="logo" onerror="this.style.display='none'">
        <h1 class="contract-title">عقد إيجار لوحات إعلانية</h1>
        <p class="contract-number">رقم العقد: ${contractNumber} - سنة ${year}</p>
      </div>

      <!-- معلومات العقد الأساسية -->
      <div class="section">
        <h2 class="section-title">معلومات العقد</h2>
        <div class="info-row">
          <span class="info-label">اسم العميل:</span>
          <span class="info-value">${customerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">نوع الإعلان:</span>
          <span class="info-value">${adType}</span>
        </div>
        <div class="info-row">
          <span class="info-label">تاريخ البداية:</span>
          <span class="info-value">${startDate}</span>
        </div>
        ${endDate ? `
        <div class="info-row">
          <span class="info-label">تاريخ النهاية:</span>
          <span class="info-value">${endDate}</span>
        </div>
        ` : ''}
        ${duration ? `
        <div class="info-row">
          <span class="info-label">المدة:</span>
          <span class="info-value">${duration} يوم</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">القيمة الإجمالية:</span>
          <span class="info-value"><strong>${price}</strong></span>
        </div>
        ${phoneNumber ? `
        <div class="info-row">
          <span class="info-label">رقم الهاتف:</span>
          <span class="info-value">${phoneNumber}</span>
        </div>
        ` : ''}
      </div>

      ${billboards && billboards.length > 0 ? `
      <!-- معلومات اللوحات -->
      <div class="section">
        <h2 class="section-title">اللوحات الإعلانية</h2>
        <div class="info-row">
          <span class="info-label">عدد اللوحات:</span>
          <span class="info-value">${billboards.length} لوحة</span>
        </div>
      </div>
      ` : ''}

      ${billboardImage ? `
      <!-- صورة اللوحة -->
      <div class="billboard-image-container">
        <img src="${billboardImage}" alt="صورة اللوحة الإعلانية" class="billboard-image">
      </div>
      ` : ''}
    </div>

    <!-- الذيل -->
    <div class="footer" style="direction: rtl; text-align: center; border-top: 3px solid #D4AF37; padding-top: 15px; margin-top: 30px;">
      <!-- Footer content from settings -->
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * فتح PDF في نافذة جديدة للطباعة أو الحفظ
 */
export async function openContractPDF(data: ContractPDFData): Promise<Window | null> {
  const htmlContent = await generateContractHTML(data);
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return null;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // الانتظار حتى يتم تحميل الصور ثم الطباعة
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return printWindow;
}

/**
 * تنزيل PDF مباشرة (يتطلب دعم المتصفح للطباعة إلى PDF)
 */
export async function downloadContractPDF(data: ContractPDFData, filename?: string): Promise<void> {
  const printWindow = await openContractPDF(data);
  
  if (!printWindow) {
    throw new Error('فشل فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.');
  }

  // تعيين اسم الملف المقترح للتنزيل
  const suggestedFilename = filename || `عقد-${data.contractNumber}.pdf`;
  printWindow.document.title = suggestedFilename;
}
