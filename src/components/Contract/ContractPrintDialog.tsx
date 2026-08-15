import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { ContractData } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';

interface ContractPrintDialogProps {
  contract: ContractData;
  trigger?: React.ReactNode;
}

export function ContractPrintDialog({ contract, trigger }: ContractPrintDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [sizeOrderMap, setSizeOrderMap] = useState<{ [key: string]: number }>({});

  // Fetch size order data from database
  useEffect(() => {
    const fetchSizeData = async () => {
      try {
        const { data: sizesData, error } = await supabase
          .from('sizes')
          .select('name, sort_order')
          .order('sort_order', { ascending: true });

        if (!error && sizesData) {
          const orderMap: { [key: string]: number } = {};
          sizesData.forEach(size => {
            orderMap[size.name] = size.sort_order || 999;
          });
          setSizeOrderMap(orderMap);
          console.log('Size order map loaded:', orderMap);
        } else {
          console.warn('Failed to load size data:', error);
        }
      } catch (error) {
        console.error('Error fetching size data:', error);
      }
    };

    fetchSizeData();
  }, []);

  // Function to get billboard image from contract
  const getBillboardImage = (contract: ContractData): string => {
    if (!contract?.billboards || contract.billboards.length === 0) {
      return '';
    }
    
    for (const billboard of contract.billboards) {
      const image = billboard.image || billboard.Image || billboard.billboard_image || (billboard as any).Image_URL || (billboard as any)['@IMAGE'] || (billboard as any).image_url;
      if (image && typeof image === 'string' && image.trim() !== '') {
        return image;
      }
    }
    
    return '';
  };

  // Function to extract contract data
  const extractContractData = (contract: ContractData) => {
    const contractNumber = contract.Contract_Number || contract.id || '';
    const customerName = contract.customer_name || contract['Customer Name'] || '';
    const adType = contract.ad_type || contract['Ad Type'] || 'عقد إيجار لوحات إعلانية';
    const startDate = contract.start_date || contract['Contract Date'] || '';
    const endDate = contract.end_date || contract['End Date'] || '';
    const totalCost = contract.rent_cost || contract['Total Rent'] || 0;
    
    // Calculate duration in days
    let duration = '';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      duration = `${durationDays}`;
    }
    
    // Format price
    const formattedPrice = `${totalCost.toLocaleString('ar-LY')}`;
    
    // Format dates
    const formattedStartDate = startDate ? new Date(startDate).toLocaleDateString('ar-LY-u-nu-latn') : new Date().toLocaleDateString('ar-LY-u-nu-latn');
    const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('ar-LY-u-nu-latn') : '';
    
    // Get year from start date
    const year = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
    
    // Get billboard count
    const billboardCount = contract.billboards ? contract.billboards.length : 0;
    const billboardInfo = billboardCount > 0 ? ` (${billboardCount} لوحة إعلانية)` : '';
    
    return {
      contractNumber: contractNumber.toString(),
      customerName: customerName,
      adType: adType + billboardInfo,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      price: formattedPrice,
      duration: duration,
      year: year.toString(),
      companyName: '',
      phoneNumber: contract.phoneNumber || '',
      billboardImage: getBillboardImage(contract)
    };
  };

  const handlePrintContract = async () => {
    const docTitle = `عقد_إيجار_${contract.Contract_Number || contract.id || ''}`;
    const printWindow = preparePrintWindow(docTitle);

    try {
      setIsGenerating(true);

      // Extract contract data
      const contractData = extractContractData(contract);

      // Normalize billboards and build table pages for printing
      const billboards: any[] = Array.isArray(contract.billboards) ? contract.billboards : [];

      // Get contract dates for billboards
      const contractStartDate = contract.start_date || contract['Contract Date'] || '';
      const contractEndDate = contract.end_date || contract['End Date'] || '';
      
      // Format date helper
      const formatDateForPrint = (dateStr: string): string => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return dateStr;
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        } catch {
          return dateStr;
        }
      };

      const normalizeBillboard = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const image = String(
          b.image ?? b.Image ?? b.billboard_image ?? b.Image_URL ?? b['@IMAGE'] ?? b.image_url ?? b.imageUrl ?? ''
        );
        const municipality = String(b.Municipality ?? b.municipality ?? b.City_Council ?? b.city_council ?? '');
        const district = String(b.District ?? b.district ?? b.Area ?? b.area ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.Location ?? '');
        const size = String(b.Size ?? b.size ?? b['Billboard size'] ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b['Number of Faces'] ?? '');
        const priceVal = b.Price ?? b.rent ?? b.Rent_Price ?? b.Rent ?? b.rent_cost ?? b['Total Rent'];
        const price =
          typeof priceVal === 'number'
            ? `${priceVal.toLocaleString('ar-LY')} د.ل`
            : (typeof priceVal === 'string' && priceVal.trim() !== '' ? priceVal : '');
        
        // Get end date - ALWAYS use contract end date for consistency
        const endDateRaw = contractEndDate || b.Rent_End_Date || b.rent_end_date || b.end_date || '';
        const endDate = endDateRaw ? formatDateForPrint(endDateRaw) : '';
        
        // Calculate days count using contract dates
        const startDateRaw = contractStartDate || b.Rent_Start_Date || b.rent_start_date || b.start_date || '';
        let daysCount = '';
        if (startDateRaw && endDateRaw) {
          const start = new Date(startDateRaw);
          const end = new Date(endDateRaw);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            daysCount = days > 0 ? String(days) : '';
          }
        }
        // Fallback to existing days count if calculation failed
        if (!daysCount) {
          daysCount = b.Days_Count ?? b.days_count ?? (contract as any).Duration ?? '';
        }
        
        let coords: string = String(
          b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? ''
        );
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '#';
        
        // Add sort order for sorting
        const sortOrder = sizeOrderMap[size] || 999;
        
        return { id, image, municipality, district, landmark, size, faces, price, endDate, daysCount, mapLink, sortOrder };
      };

      const normalizedRows = billboards.map(normalizeBillboard);
      
      // ✅ FIXED: Sort billboards by sort_order from sizes table
      normalizedRows.sort((a, b) => a.sortOrder - b.sortOrder);
      console.log('Billboards sorted by size order:', normalizedRows.map(r => ({ size: r.size, sortOrder: r.sortOrder })));
      
      const ROWS_PER_PAGE = 12; // fits with image thumbnails comfortably

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
                <img src="/bgc2.jpg" alt="خلفية جدول اللوحات" class="template-image" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:6%" />
                      <col style="width:12%" />
                      <col style="width:10%" />
                      <col style="width:10%" />
                      <col style="width:16%" />
                      <col style="width:8%" />
                      <col style="width:6%" />
                      <col style="width:8%" />
                      <col style="width:10%" />
                      <col style="width:7%" />
                      <col style="width:7%" />
                    </colgroup>
                    <tbody>
                      ${rows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-num">${r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td>${r.price}</td>
                            <td>${r.endDate}</td>
                            <td>${r.daysCount}</td>
                            <td>${r.mapLink !== '#' ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `)
            .join('')
        : '';

      // Create HTML content for printing using the main6 design
      const installationEnabled = (contract as any).installation_enabled !== false && (contract as any).installation_enabled !== 0 && (contract as any).installation_enabled !== 'false';
      const printEnabled = (contract as any).print_cost_enabled === true || (contract as any).print_cost_enabled === 1 || (contract as any).print_cost_enabled === 'true';
      const flagsHtml = `
          <span style="display:inline-block; padding:6px 12px; border-radius:8px; background:#eef6ff; color:#0b63c5; margin-left:8px;">${installationEnabled ? 'مع التركيب' : 'بدون تركيب'}</span>
          <span style="display:inline-block; padding:6px 12px; border-radius:8px; background:#f5f5f5; color:#444;">${printEnabled ? 'شاملة الطباعة' : 'غير شاملة الطباعة'}</span>
        `;

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>عقد إيجار لوحات إعلانية</title>
           <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            @page { size: A4 portrait; margin: 0; }

            body {
              font-family: 'Noto Sans Arabic', 'Doran', Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
              overflow-x: hidden;
              margin: 0;
              padding: 0;
              font-size: 0; /* collapse whitespace between inline-block elements */
            }

            .template-container {
              position: relative;
              width: 210mm;
              height: 297mm;
              display: block;
              overflow: hidden;
              margin: 0;
              padding: 0;
              page-break-after: always;
              font-size: 16px; /* restore font-size */
            }
            .template-container:last-child {
              page-break-after: avoid;
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

            /* Table overlay area for bgc2 pages */
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

            .controls {
              position: fixed;
              bottom: 20px;
              left: 50%;
              transform: translateX(-50%);
              z-index: 9999;
            }

            @media print {
              .template-container {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                page-break-inside: avoid;
              }
              .template-container:last-child {
                page-break-after: avoid !important;
              }
              .controls {
                display: none !important;
              }
            }

            button {
              padding: 10px 20px;
              font-size: 16px;
              background-color: #0066cc;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="template-container">
            <!-- Background image -->
            <img src="/contract-template.png" alt="الإشعار الأصلي" class="template-image" />

            <!-- Overlay SVG -->
            <svg
              class="overlay-svg"
              viewBox="0 0 2480 3508"
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
            >
              <!-- Header: إجراً لمواقع إعلانية رقم: 1098 سنة -->
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
                إيجار لمواقع إعلانية رقم: ${contractData.contractNumber} سنة ${contractData.year}
              </text>

              <!-- التاريخ: -->
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
                التاريخ: ${contractData.startDate}
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
                نوع الإعلان: ${contractData.adType}.
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
                style="direction: rtl; text-align: center"
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
                style="direction: rtl; text-align: center"
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
                style="direction: rtl; text-align: center"
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
                style="direction: rtl; text-align: center"
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
                style="direction: rtl; text-align: center"
              >
                ${contractData.customerName}.
              </text>
              <text
                x="1970"
                y="1440"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                يمثلها السيد علي عمار هاتف: ${contractData.phoneNumber}.
              </text>

              <!-- المقدمة -->
              <text
                x="2250"
                y="1660"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
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
                style="direction: rtl; text-align: center"
              >
                نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:
              </text>

              <!-- البند الأول -->
              <text
                x="2240"
                y="1800"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الأول:
              </text>
              <text
                x="1190"
                y="1730"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدي مدة العقد من التاريخ .
              </text>
              <text
                x="2095"
                y="1790"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                المذكور في المادة السادسة
              </text>

              <!-- البند الثاني -->
              <text
                x="2230"
                y="1975"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الثاني:
              </text>
              <text
                x="1170"
                y="1905"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                يلتزم الطرف الأول بتعبئة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل .
              </text>
              <text
                x="1850"
                y="1965"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                الأخير تكاليف التغيير الناتجة عن الأحوال الجوية أو الحوادث.
              </text>

              <!-- البند الثالث -->
              <text
                x="2225"
                y="2150"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الثالث:
              </text>
              <text
                x="1240"
                y="2080"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات، يتم نقل الإعلان إلى موقع بديل، ويتولى الطرف الأول
              </text>
              <text
                x="1890"
                y="2140"
                font-family="Doran, sans-serif"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                الحصول على الموافقات اللازمة من الجهات ذات العلاقة.
              </text>

              <!-- البند الرابع -->
              <text
                x="2235"
                y="2325"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند الرابع:
              </text>
              <text
                x="1190"
                y="2255"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                لايجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ بحق.
              </text>
              <text
                x="1530"
                y="2315"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                استغلال المساحات في المناسبات الوطنية و الانتخابات مع تعويض الطرف الثاني بفترة بديلة.
              </text>

              <!-- البند الخامس – contract amount -->
              <text
                x="560"
                y="2425"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="end"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                قيمة العقد ${contractData.price} دينار ليبي بدون طباعة، دفع عند توقيع العقد والنصف الآخر بعد
              </text>
              <text
                x="1640"
                y="2485"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                التركيب، وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.
              </text>

              <!-- البند السادس – duration -->
              <text
                x="2210"
                y="2675"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند السادس:
              </text>
              <text
                x="1150"
                y="2605"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                مدة العقد ${contractData.duration} يومًا تبدأ من ${contractData.startDate} وتنتهي في ${contractData.endDate}، ويجوز تجديده برضى الطرفين قبل
              </text>
              <text
                x="1800"
                y="2665"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                انتهائه بمدة لا تقل عن 15 يومًا وفق شروط يتم الاتفاق عليها .
              </text>

              <!-- البند السابع -->
              <text
                x="2220"
                y="2830"
                font-family="Doran, sans-serif"
                font-weight="bold"
                font-size="42"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                البند السابع:
              </text>
              <text
                x="1150"
                y="2760"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                في حال حدوث خلاف بين الطرفين يتم حلّه وديًا، وإذا تعذر ذلك يُعين طرفان محاميان لتسوية النزاع بقرار نهائي
              </text>
              <text
                x="2200"
                y="2820"
                font-family="Doran, sans-serif"
                font-size="46"
                fill="#000"
                text-anchor="middle"
                dominant-baseline="middle"
                style="direction: rtl; text-align: center"
              >
                وملزم للطرفين.
              </text>
            </svg>
          </div>
          ${tablePagesHtml}
          <div class="controls">
            <button onclick="window.print()">طباعة</button>
          </div>
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
      console.error('Error opening print window:', error);
      alert('حدث خطأ أثناء فتح نافذة الطباعة: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            طباعة العقد
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>طباعة عقد إيجار اللوحات الإعلانية</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>سيتم فتح العقد في نافذة جديدة بالمتصفح مع إمكانية الطباعة المباشرة.</p>
            <p className="mt-2">العقد يحتوي على:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>تفاصيل العقد والعميل</li>
              <li>خلفية مصممة للطباعة بنفس تصميم main6</li>
              <li>خط Doran العربي الأنيق</li>
              <li>ترتيب اللوحات حسب المقاس من قاعدة البيانات</li>
            </ul>
          </div>
          
          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button
              onClick={handlePrintContract}
              disabled={isGenerating}
              className="flex items-center"
            >
              <Printer className="h-4 w-4 ml-2" />
              {isGenerating ? 'جاري التحضير...' : 'فتح للطباعة'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}