// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InstallationPDFDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: any;
}

interface InstallationTeam {
  id: string;
  team_name: string;
  sizes: string[];
  sizes_ids?: string[];
}

const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';

  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }

  return formattedInteger;
};

export default function InstallationPDFDialog({ open, onOpenChange, contract }: InstallationPDFDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [printMode, setPrintMode] = useState<'auto' | 'manual'>('auto');
  const [customerData, setCustomerData] = useState<{
    name: string;
    company: string | null;
    phone: string | null;
  } | null>(null);
  const [installationTeams, setInstallationTeams] = useState<InstallationTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  const loadInstallationTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('installation_teams')
        .select('*')
        .order('team_name', { ascending: true });

      if (error) throw error;

      if (data) {
        const teams = data.map((team: any) => ({
          id: String(team.id ?? team.team_id ?? team.team_name ?? ''),
          team_name: String(team.team_name ?? ''),
          sizes: Array.isArray(team.sizes) ? team.sizes : [],
          sizes_ids: Array.isArray(team.sizes_ids) ? team.sizes_ids.map((x: any) => String(x)) : undefined,
        })).filter((t: any) => t.id);
        setInstallationTeams(teams);
      }
    } catch (error) {
      const msg = (error as any)?.message || JSON.stringify(error);
      console.error('Error loading installation teams:', msg);
      toast.error('خطأ في تحميل فرق التركيب');
    }
  };

  const loadCustomerData = async () => {
    try {
      const customerId = contract?.customer_id;
      const customerName = contract?.customer_name || contract?.['Customer Name'] || '';

      if (customerId) {
        const { data, error } = await supabase
          .from('customers')
          .select('name, company, phone')
          .eq('id', customerId)
          .single();

        if (!error && data) {
          setCustomerData({
            name: data.name || customerName,
            company: data.company,
            phone: data.phone
          });
          return;
        }
      }

      if (customerName) {
        const { data, error } = await supabase
          .from('customers')
          .select('name, company, phone')
          .ilike('name', customerName)
          .limit(1)
          .single();

        if (!error && data) {
          setCustomerData({
            name: data.name || customerName,
            company: data.company,
            phone: data.phone
          });
          return;
        }
      }

      setCustomerData({
        name: customerName,
        company: null,
        phone: null
      });

    } catch (error) {
      console.error('Error loading customer data:', error);
      setCustomerData({
        name: contract?.customer_name || contract?.['Customer Name'] || '',
        company: null,
        phone: null
      });
    }
  };

  useEffect(() => {
    if (open && contract) {
      loadCustomerData();
      loadInstallationTeams();
    }
  }, [open, contract]);

  const calculateContractDetails = () => {
    const startDate = contract?.start_date || contract?.['Contract Date'];
    const endDate = contract?.end_date || contract?.['End Date'];

    let duration = '';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      duration = `${days}`;
    }

    const formatArabicDate = (dateString: string): string => {
      if (!dateString) return '';

      const date = new Date(dateString);
      const arabicMonths = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];

      const day = date.getDate();
      const month = arabicMonths[date.getMonth()];
      const year = date.getFullYear();

      return `${day} ${month} ${year}`;
    };

    return {
      duration,
      startDate: startDate ? formatArabicDate(startDate) : '',
      endDate: endDate ? formatArabicDate(endDate) : ''
    };
  };

  const getBillboardsData = async () => {
    // 1) Try contract_boards + join data via separate queries (robust to missing FK)
    const contractId = String(contract?.id ?? contract?.Contract_ID ?? contract?.Contract_Number ?? '');
    try {
      if (contractId) {
        const { data: cbRows, error: cbErr } = await supabase
          .from('contract_boards')
          .select('*')
          .eq('contract_id', contractId);
        if (cbErr) throw cbErr;
        if (Array.isArray(cbRows) && cbRows.length > 0) {
          const billboardIds = Array.from(new Set(cbRows.map((r: any) => String(r.billboard_id)).filter(Boolean)));
          const sizeIds = Array.from(new Set(cbRows.map((r: any) => String(r.size_id)).filter(Boolean)));

          const [billRes, sizeRes] = await Promise.all([
            billboardIds.length
              ? supabase.from('billboards').select('*').in('ID', billboardIds)
              : Promise.resolve({ data: [], error: null } as any),
            sizeIds.length
              ? supabase.from('sizes').select('id,name,width,height').in('id', sizeIds)
              : Promise.resolve({ data: [], error: null } as any),
          ]);

          const boards = (billRes.data || []) as any[];
          const sizes = (sizeRes.data || []) as any[];
          const boardsById = new Map(boards.map((b: any) => [String(b.ID ?? b.id), b] as const));
          const sizesById = new Map(sizes.map((s: any) => [String(s.id), s] as const));

          const merged = cbRows.map((row: any) => {
            const bb = boardsById.get(String(row.billboard_id)) || {};
            const sz = sizesById.get(String(row.size_id)) || {};
            const width = sz?.width != null ? String(sz.width) : '';
            const height = sz?.height != null ? String(sz.height) : '';
            const sizeText = width && height ? `${width}x${height}` : (String(bb.Size ?? bb.size ?? '') || '');
            return {
              // fields consumed by norm()
              ID: row.billboard_id ?? bb.ID ?? bb.id,
              Billboard_Name: bb.Billboard_Name ?? bb.name ?? row.billboard_code ?? row.billboard_name ?? '',
              Municipality: bb.Municipality ?? bb.city ?? '',
              District: bb.District ?? bb.district ?? '',
              Nearest_Landmark: bb.Nearest_Landmark ?? bb.location ?? bb.landmark ?? '',
              Size: sizeText,
              Faces: bb.Number_of_Faces ?? bb.Faces ?? bb.faces_count ?? 1,
              ad_type: row.ad_type ?? row.Ad_Type ?? 'غير محدد',
              Image_URL: bb.Image_URL ?? bb.image ?? bb.billboard_image ?? bb.image_url ?? '',
              face_a_image: row.face_a_image ?? '',
              face_b_image: row.face_b_image ?? '',
              GPS_Coordinates: bb.GPS_Coordinates ?? '',
              Latitude: bb.Latitude ?? null,
              Longitude: bb.Longitude ?? null,
              // extra for filtering by sizes_ids
              size_id: row.size_id ? String(row.size_id) : undefined,
            };
          });

          return merged;
        }
      }
    } catch (e) {
      console.warn('contract_boards lookup failed or empty; will fallback:', (e as any)?.message || e);
    }

    // 2) Fallbacks: billboard_ids, embedded billboards, saved_billboards_data
    let billboardsToShow: any[] = [];

    const billboardIds = contract?.billboard_ids;
    if (billboardIds) {
      try {
        const idsArray = typeof billboardIds === 'string'
          ? billboardIds.split(',').map((id: string) => id.trim()).filter(Boolean)
          : Array.isArray(billboardIds) ? billboardIds : [];

        if (idsArray.length > 0) {
          const { data: billboardsData, error } = await supabase
            .from('billboards')
            .select('*')
            .in('ID', idsArray);

          if (!error && billboardsData && billboardsData.length > 0) {
            billboardsToShow = billboardsData;
          }
        }
      } catch (e) {
        console.warn('Failed to parse billboard_ids:', e);
      }
    }

    if (billboardsToShow.length === 0) {
      const dbRows: any[] = Array.isArray(contract?.billboards) ? contract.billboards : [];
      let srcRows: any[] = dbRows;
      if (!srcRows.length) {
        try {
          const saved = (contract as any)?.saved_billboards_data ?? (contract as any)?.billboards_data ?? '[]';
          const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
          if (Array.isArray(parsed)) srcRows = parsed;
        } catch (e) {
          console.warn('Failed to parse saved billboards data:', e);
        }
      }
      billboardsToShow = srcRows;
    }

    return billboardsToShow;
  };

  const handlePrintInstallation = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للطباعة');
      return;
    }

    setIsGenerating(true);

    try {
      const testWindow = window.open('', '_blank', 'width=1,height=1');
      if (!testWindow || testWindow.closed || typeof testWindow.closed === 'undefined') {
        toast.error('يرجى السماح بالنوافذ المنبثقة في المتصفح لتمكين الطباعة');
        setIsGenerating(false);
        return;
      }
      testWindow.close();

      const contractDetails = calculateContractDetails();
      const year = new Date().getFullYear();

      const contractData = {
        contractNumber: contract?.id || contract?.Contract_Number || '',
        customerName: customerData.name,
        customerCompany: customerData.company || '',
        customerPhone: customerData.phone || '',
        adType: contract?.ad_type || contract?.['Ad Type'] || 'عقد إيجار لوحات إعلانية',
        startDate: contractDetails.startDate,
        endDate: contractDetails.endDate,
        duration: contractDetails.duration,
        year: year.toString(),
        companyName: '',
        phoneNumber: ''
      };

      let billboardsToShow = await getBillboardsData();

      if (selectedTeamId) {
        const selectedTeam = installationTeams.find(t => t.id === selectedTeamId);
        if (selectedTeam) {
          if (selectedTeam.sizes_ids && selectedTeam.sizes_ids.length > 0) {
            billboardsToShow = billboardsToShow.filter((billboard: any) => {
              const sid = String(billboard.size_id ?? '');
              return sid && selectedTeam.sizes_ids!.includes(sid);
            });
          } else if (selectedTeam.sizes && selectedTeam.sizes.length > 0) {
            billboardsToShow = billboardsToShow.filter((billboard: any) => {
              const size = String(billboard.Size ?? billboard.size ?? '');
              return selectedTeam.sizes!.includes(size);
            });
          }
        }
      }

      // Get contract ad type as fallback
      const contractAdType = contract?.ad_type || contract?.['Ad Type'] || '';

      const norm = (b: any) => {
        const id = String(b.ID ?? b.id ?? b.code ?? '');

        const imageName = b.image_name || b.Image_Name;
        const imageUrl = b.Image_URL || b.image || b.billboard_image || b.imageUrl || b.img;
        const image = imageName ? `/image/${imageName}` : (imageUrl || '');

        const faceAImageName = b.face_a_image_name || b.Face_A_Image_Name;
        const faceAImageUrl = b.face_a_image || b.Face_A_Image || b.faceAImage;
        const faceAImage = faceAImageName ? `/image/${faceAImageName}` : (faceAImageUrl || image || '');

        const faceBImageName = b.face_b_image_name || b.Face_B_Image_Name;
        const faceBImageUrl = b.face_b_image || b.Face_B_Image || b.faceBImage;
        const faceBImage = faceBImageName ? `/image/${faceBImageName}` : (faceBImageUrl || '');

        const municipality = String(b.Municipality ?? b.municipality ?? b.city ?? '');
        const district = String(b.District ?? b.district ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.landmark ?? '');
        const size = String(b.Size ?? b.size ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b.Faces_Count ?? b.faces_count ?? '1');
        
        // Use contract ad type as fallback if billboard ad type is empty
        const billboardAdType = b.ad_type || b.Ad_Type || '';
        const adType = billboardAdType || contractAdType || 'غير محدد';

        let rent_end_date = '';
        if (b.end_date || b['End Date']) {
          try {
            rent_end_date = new Date(b.end_date || b['End Date']).toLocaleDateString('ar-LY');
          } catch (e) {
            rent_end_date = contractDetails.endDate;
          }
        } else {
          rent_end_date = contractDetails.endDate;
        }

        let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : (b.GPS_Link || '');
        const name = String(b.Billboard_Name ?? b.name ?? b.code ?? id);

        return { id, name, faceAImage, faceBImage, municipality, district, landmark, size, faces, adType, rent_end_date, mapLink };
      };

      const normalized = billboardsToShow.map(norm);
      const ROWS_PER_PAGE = 12;

      const tablePagesHtml = normalized.length
        ? normalized
            .reduce((acc: any[][], r, i) => {
              const p = Math.floor(i / ROWS_PER_PAGE);
              (acc[p] ||= []).push(r);
              return acc;
            }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/bgc2.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load bgc2.svg')" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:18mm" />
                      <col style="width:14mm" />
                      <col style="width:14mm" />
                      <col style="width:14mm" />
                      <col style="width:35mm" />
                      <col style="width:12mm" />
                      <col style="width:15mm" />
                      <col style="width:20mm" />
                      <col style="width:20mm" />
                      <col style="width:15mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-name" style="background-color: #E8CC64;">${r.name || r.id}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td>${r.adType}</td>
                            <td class="c-img">${r.faceAImage ? `<img src="${r.faceAImage}" alt="��لوجه A" onerror="this.style.display='none'" />` : ''}</td>
                            <td class="c-img">${r.faceBImage ? `<img src="${r.faceBImage}" alt="الوجه B" onerror="this.style.display='none'" />` : '—'}</td>
                            <td>${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
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

      const pdfTitle = `تركيب عقد ${contractData.contractNumber} - ${contractData.customerName}`;
      const selectedTeamName = selectedTeamId ? installationTeams.find(t => t.id === selectedTeamId)?.team_name || 'الكل' : 'الكل';

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${pdfTitle}</title>
          <style>
            /* Preload fonts inline for faster loading */
            @font-face {
              font-family: 'Noto Sans Arabic';
              src: url('https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyvuQ.woff2') format('woff2');
              font-weight: 400;
              font-style: normal;
              font-display: swap;
            }
            @font-face {
              font-family: 'Noto Sans Arabic';
              src: url('https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCf9W2vdQ.woff2') format('woff2');
              font-weight: 700;
              font-style: normal;
              font-display: swap;
            }

            * {
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box;
            }

            html, body {
              width: 210mm !important;
              min-height: 297mm !important;
              font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              overflow-x: hidden;
            }

            .template-container {
              position: relative;
              width: 210mm !important;
              height: 297mm !important;
              overflow: hidden;
              display: block;
              page-break-inside: avoid;
            }

            .template-image {
              position: absolute;
              top: 0;
              left: 0;
              width: 210mm !important;
              height: 297mm !important;
              object-fit: cover;
              object-position: center;
              z-index: 1;
              display: block;
            }

            .page {
              page-break-after: always;
              page-break-inside: avoid;
            }

            .table-area {
              position: absolute;
              top: 63.53mm;
              left: calc(105mm - 92.1235mm);
              width: 184.247mm;
              z-index: 20;
            }

            .btable {
              width: 100%;
              border-collapse: collapse;
              border-spacing: 0;
              font-size: 8px;
              font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
              table-layout: fixed;
              border: 0.2mm solid #000;
            }

            .btable tr {
              height: 13.818mm;
            }

            .btable td {
              border: 0.2mm solid #000;
              padding: 0 1mm;
              vertical-align: middle;
              text-align: center;
              background: transparent;
              color: #000;
              white-space: normal;
              word-break: break-word;
              overflow: hidden;
              font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
            }

            .c-img img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              object-position: center;
              border: none;
              border-radius: 0;
              display: block;
              background: none;
            }

            .btable td.c-img {
              width: 15.5mm;
              height: 15.5mm;
              padding: 0;
              overflow: hidden;
            }

            .btable td.c-img img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              object-position: center;
              display: block;
            }

            .c-num {
              text-align: center;
              font-weight: 700;
            }

            .btable a {
              color: #004aad;
              text-decoration: none;
              font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
            }

            .header-info {
              position: absolute;
              top: 20mm;
              right: 13mm;
              z-index: 15;
              font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
              font-size: 14px;
              color: #000;
              text-align: right;
              direction: rtl;
              line-height: 1.8;
            }

            .header-info strong {
              font-weight: 700;
            }

            @media print {
              html, body {
                width: 210mm !important;
                min-height: 297mm !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
              }

              .template-container {
                width: 210mm !important;
                height: 297mm !important;
                position: relative !important;
                page-break-inside: avoid;
              }

              .template-image {
                width: 210mm !important;
                height: 297mm !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
              }

              .page {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
                page-break-inside: avoid;
              }

              .btable tr:nth-of-type(12n) {
                page-break-after: always;
              }

              @page {
                size: A4 portrait;
                margin: 0 !important;
                padding: 0 !important;
              }
            }

            .loading-message {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: rgba(0,0,0,0.8);
              color: white;
              padding: 20px;
              border-radius: 5px;
              z-index: 1000;
              font-family: 'Noto Sans Arabic', Arial, sans-serif;
            }
          </style>
        </head>
        <body>
          <div id="loadingMessage" class="loading-message">جاري تحميل بيانات التركيب...</div>

          <div class="template-container page">
            <img src="/bgc2.svg" alt="نموذج التركيب" class="template-image"
                 onerror="console.warn('Failed to load installation template image')" />

            <div class="header-info">
              <div><strong>عقد رقم:</strong> ${contractData.contractNumber}</div>
              <div><strong>العميل:</strong> ${contractData.customerName}</div>
              ${contractData.customerCompany ? `<div><strong>الشركة:</strong> ${contractData.customerCompany}</div>` : ''}
              <div><strong>التاريخ:</strong> ${contractData.startDate}</div>
              <div><strong>الفرقة:</strong> ${selectedTeamName}</div>
            </div>
          </div>

          ${tablePagesHtml}

          <script>
            let printAttempts = 0;
            const maxPrintAttempts = 3;

            function hideLoadingMessage() {
              const loading = document.getElementById('loadingMessage');
              if (loading) {
                loading.style.display = 'none';
              }
            }

            function attemptPrint() {
              try {
                if (printAttempts < maxPrintAttempts) {
                  printAttempts++;
                  window.focus();
                  window.print();
                }
              } catch (error) {
                console.error('Print error:', error);
                if (printAttempts < maxPrintAttempts) {
                  setTimeout(attemptPrint, 1000);
                }
              }
            }

            window.addEventListener('load', function() {
              hideLoadingMessage();
              setTimeout(attemptPrint, 400);
            });

            setTimeout(function() {
              hideLoadingMessage();
              if (printAttempts === 0) {
                attemptPrint();
              }
            }, 1000);

            document.addEventListener('DOMContentLoaded', function() {
              const images = document.querySelectorAll('img');
              images.forEach(img => {
                img.addEventListener('error', function() {
                  console.warn('Image failed to load:', this.src);
                });
              });
            });
          </script>
        </body>
        </html>
      `;

      const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no';
      const printWindow = window.open('', '_blank', windowFeatures);

      if (!printWindow) {
        throw new Error('فشل في فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح والسماح بالنوافذ المنبثقة.');
      }

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      const handlePrintWindowError = (error: any) => {
        console.error('Print window error:', error);
        toast.error('حدث خطأ في نافذة الطباعة. يرجى المحاولة مرة أخرى.');
      };

      printWindow.addEventListener('error', handlePrintWindowError);

      const checkWindowClosed = () => {
        if (printWindow.closed) {
          console.log('Print window was closed');
        }
      };

      setTimeout(checkWindowClosed, 5000);

      toast.success('تم فتح نموذج التركيب للطباعة بنجاح!');

      if (printMode === 'auto') {
        onOpenChange(false);
      }

    } catch (error) {
      console.error('Error in handlePrintInstallation:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير نموذج التركيب للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const contractDetails = calculateContractDetails();

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="expenses-dialog-content">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle>طباعة التركيب</UIDialog.DialogTitle>
          <UIDialog.DialogClose className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">إغلاق</span>
          </UIDialog.DialogClose>
        </UIDialog.DialogHeader>

        <div className="space-y-6">
          {isGenerating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-semibold">جاري تحضير نموذج التركيب للطباعة...</p>
              <p className="text-sm text-gray-600 mt-2">يتم تحميل بيانات اللوحات وتحضير التخطيط</p>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-card to-primary/10 p-4 rounded-lg border border-primary/30">
                <h3 className="font-semibold mb-2 text-primary">اختيار فرقة التركيب:</h3>
                <Select value={selectedTeamId} onValueChange={(v) => setSelectedTeamId(v === '__all__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر فرقة التركيب (اختياري)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">الكل</SelectItem>
                    {installationTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.team_name} ({team.sizes.length} مقاس)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTeamId && (
                  <p className="text-xs text-muted-foreground mt-2">
                    سيتم عرض اللوحات التي تطابق مقاسات الفرقة المختارة فقط
                  </p>
                )}
              </div>

              <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20">
                <h3 className="font-semibold mb-2 text-primary">معاينة بيانات العقد:</h3>
                <div className="text-sm space-y-1">
                  <p><strong>رقم العقد:</strong> {contract?.id || contract?.Contract_Number || 'غير محدد'}</p>
                  <p><strong>العميل:</strong> {customerData?.name || 'غير محدد'}</p>
                  {customerData?.company && (
                    <p><strong>الشركة:</strong> {customerData.company}</p>
                  )}
                  {customerData?.phone && (
                    <p><strong>الهاتف:</strong> {customerData.phone}</p>
                  )}
                  <p><strong>مدة العقد:</strong> {contractDetails.duration} يوم</p>
                  <p><strong>تاريخ البداية:</strong> {contractDetails.startDate}</p>
                  <p><strong>تاريخ النهاية:</strong> {contractDetails.endDate}</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-card to-primary/10 p-4 rounded-lg border border-primary/30">
                <h4 className="font-medium mb-3 text-primary">خيارات الطباعة:</h4>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 space-x-reverse cursor-pointer">
                    <input
                      type="radio"
                      name="printMode"
                      value="auto"
                      checked={printMode === 'auto'}
                      onChange={(e) => setPrintMode(e.target.value as 'auto')}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm">طباعة تلقائية</span>
                  </label>
                  <label className="flex items-center space-x-3 space-x-reverse cursor-pointer">
                    <input
                      type="radio"
                      name="printMode"
                      value="manual"
                      checked={printMode === 'manual'}
                      onChange={(e) => setPrintMode(e.target.value as 'manual')}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm">طباعة يدوية</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-primary/30 hover:bg-primary/10"
                >
                  إغلاق
                </Button>
                <Button
                  onClick={handlePrintInstallation}
                  className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
                  disabled={isGenerating}
                >
                  <Printer className="h-4 w-4 ml-2" />
                  {printMode === 'auto' ? 'طباعة تلق��ئية' : 'معاينة وطباعة'}
                </Button>
              </div>
            </>
          )}
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
