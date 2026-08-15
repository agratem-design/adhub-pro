import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';

interface PrintFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: {
    municipality: string;
    city: string;
    size: string;
    status: string;
    adType: string;
  };
  setFilters: (filters: any) => void;
  billboards: any[];
  isContractExpired: (endDate: string | null) => boolean;
  billboardMunicipalities: string[];
  cities: string[];
  billboardSizes: string[];
  uniqueAdTypes: string[];
}

export const PrintFiltersDialog: React.FC<PrintFiltersDialogProps> = ({
  open,
  onOpenChange,
  filters,
  setFilters,
  billboards,
  isContractExpired,
  billboardMunicipalities,
  cities,
  billboardSizes,
  uniqueAdTypes
}) => {
  // Print available billboards function with filters
  const printAvailableBillboards = (withLogo: boolean) => {
    try {
      // Filter available billboards first - exclude removed billboards
      let availableBillboards = billboards.filter((billboard: any) => {
        const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
        const statusLower = statusValue.toLowerCase();
        const maintenanceStatus = String(billboard.maintenance_status ?? '').trim();
        const maintenanceType = String(billboard.maintenance_type ?? '').trim();
        const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
        const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
        
        // ✅ استبعاد اللوحات المُزالة أو التي تحتاج إزالة أو لم يتم تركيبها
        if (statusValue === 'إزالة' || statusValue === 'ازالة' || 
            statusLower === 'removed' || maintenanceStatus === 'removed' ||
            maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب' ||
            maintenanceType.includes('إزالة') || maintenanceType.includes('ازالة') ||
            maintenanceType === 'تحتاج إزالة' || maintenanceType === 'تمت الإزالة' ||
            maintenanceType === 'لم يتم التركيب') {
          return false;
        }
        
        return (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
      });

      // Apply print filters
      availableBillboards = availableBillboards.filter((billboard: any) => {
        const matchesMunicipality = filters.municipality === 'all' || 
          (billboard.Municipality || billboard.municipality || '') === filters.municipality;
        
        const matchesCity = filters.city === 'all' || 
          (billboard.City || billboard.city || '') === filters.city;
        
        const matchesSize = filters.size === 'all' || 
          (billboard.Size || billboard.size || '') === filters.size;
        
        const matchesStatus = filters.status === 'all' || 
          (filters.status === 'متاح' && ((billboard.Status || billboard.status || '').toLowerCase() === 'available' || (billboard.Status || billboard.status || '') === 'متاح')) ||
          (filters.status === 'منتهي' && isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date));
        
        const matchesAdType = filters.adType === 'all' || 
          (billboard.Ad_Type || billboard.adType || '') === filters.adType;

        return matchesMunicipality && matchesCity && matchesSize && matchesStatus && matchesAdType;
      });

      if (availableBillboards.length === 0) {
        toast.info('لا توجد لوحات متاحة تطابق المعايير المحددة للطباعة');
        return;
      }

      const docTitle = 'تقرير_اللوحات_المتاحة';
      const printWindow = preparePrintWindow(docTitle);

      const norm = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const name = String(b.Billboard_Name ?? b.name ?? id);
        
        // Use dual image source system
        const imageName = b.image_name || b.Image_Name;
        const imageUrl = b.Image_URL || b.image || b.billboard_image;
        const image = imageName ? `/image/${imageName}` : (imageUrl || '');
        
        const municipality = String(b.Municipality ?? b.municipality ?? b.City_Council ?? b.city_council ?? '');
        const district = String(b.District ?? b.district ?? b.Area ?? b.area ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.Location ?? '');
        const size = String(b.Size ?? b.size ?? b['Billboard size'] ?? '');
        const faces = String(b.Faces_Count ?? b.faces_count ?? b.faces ?? b.Number_of_Faces ?? b.Faces ?? b['Number of Faces'] ?? '');
        let coords: string = String(b.GPS_Coordinates ?? b.gps_coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude; 
          const lng = b.Longitude ?? b.lng ?? b.longitude; 
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
        return { id, name, image, municipality, district, landmark, size, faces, mapLink };
      };

      const normalized = availableBillboards.map(norm);
      const START_Y = 63.53;
      const ROW_H = 13.818;
      const PAGE_H = 297;
      const ROWS_PER_PAGE = Math.max(1, Math.floor((PAGE_H - START_Y) / ROW_H));

      const tablePagesHtml = normalized.length
        ? normalized
            .reduce((acc: any[][], r, i) => { const p = Math.floor(i / ROWS_PER_PAGE); (acc[p] ||= []).push(r); return acc; }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/mt1.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load mt1.svg')" />
                ${withLogo ? `<img src="/logofaresgold.svg" alt="شعار" class="logo" />` : ''}
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:40mm" />
                      <col style="width:18mm" />
                      <col style="width:18mm" />
                      <col style="width:20mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-name">${r.name || r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
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

      const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>اللوحات الإعلانية المتاحة</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }
            * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
            html, body { width: 100% !important; height: 100% !important; overflow: hidden; font-family: 'Noto Sans Arabic','Doran','Arial Unicode MS',Arial,sans-serif; direction: rtl; text-align: right; background: #fff; color: #000; }
            .template-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: block; }
            .template-image { position: absolute; inset: 0; width: 100% !important; height: 100% !important; object-fit: cover; object-position: center; z-index: 1; display: block; }
            .logo { position: absolute; top: 8mm; left: 12mm; width: 60mm; height: auto; z-index: 15; }
            .page { page-break-after: always; page-break-inside: avoid; }
            .table-area { position: absolute; top: 63.53mm; left: 12.8765mm; right: 12.8765mm; z-index: 20; }
            .btable { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 8px; font-family: 'Doran','Noto Sans Arabic','Arial Unicode MS',Arial,sans-serif; table-layout: fixed; border: 0.2mm solid #000; }
            .btable tr { height: 13.818mm; }
            .btable td { border: 0.2mm solid #000; padding: 0 1mm; vertical-align: middle; text-align: center; background: transparent; color: #000; white-space: normal; word-break: break-word; overflow: hidden; }
            
            /* Enhanced image styling */
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
            
            @media print { 
              html, body { width: 210mm !important; min-height: 297mm !important; height: auto !important; margin:0 !important; padding:0 !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .template-container { width: 210mm !important; height: 297mm !important; position: relative !important; }
              .template-image { width: 210mm !important; height: 297mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4; margin: 0 !important; padding: 0 !important; } 
              .controls{display:none!important}
              
              /* Enhanced print styling for page breaks */
              .btable tr:nth-of-type(14n) {
                page-break-after: always;
              }
            }
            .controls{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99}
            .controls button{padding:8px 14px;border:0;border-radius:6px;background:#0066cc;color:#fff;cursor:pointer}
          </style>
        </head>
        <body>
          ${tablePagesHtml}
          <div class="controls"><button onclick="window.print()">طباعة</button></div>
        </body>
        </html>`;

      writePrintWindow(printWindow, html, {
        title: docTitle,
        landscape: false,
        showDownloadPdf: true,
        showShare: true,
        autoPrint: true,
      });

      toast.success(`تم تحضير ${availableBillboards.length} لوحة متاحة للطباعة`);
    } catch (error) {
      console.error('Error printing available billboards:', error);
      toast.error('فشل في طباعة اللوحات المتاحة');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            خيارات طباعة اللوحات المتاحة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>البلدية</Label>
            <Select value={filters.municipality} onValueChange={(v) => setFilters(prev => ({ ...prev, municipality: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="اختر البلدية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع البلديات</SelectItem>
                {billboardMunicipalities.filter(m => m && String(m).trim()).map((m) => (
                  <SelectItem key={String(m)} value={String(m)}>{String(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>المدينة</Label>
            <Select value={filters.city} onValueChange={(v) => setFilters(prev => ({ ...prev, city: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المدينة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المدن</SelectItem>
                {cities.filter(c => c && String(c).trim()).map((c) => (
                  <SelectItem key={String(c)} value={String(c)}>{String(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>الحجم</Label>
            <Select value={filters.size} onValueChange={(v) => setFilters(prev => ({ ...prev, size: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الحجم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأحجام</SelectItem>
                {billboardSizes.filter(s => s && String(s).trim()).map((s) => (
                  <SelectItem key={String(s)} value={String(s)}>{String(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>الحالة</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="متاح">متاح</SelectItem>
                <SelectItem value="منتهي">منتهي الصلاحية</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>نوع الإعلان</Label>
            <Select value={filters.adType} onValueChange={(v) => setFilters(prev => ({ ...prev, adType: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="اختر نوع الإعلان" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                {uniqueAdTypes.filter(t => t && String(t).trim()).map((t) => (
                  <SelectItem key={String(t)} value={String(t)}>{String(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={() => {
            onOpenChange(false);
            printAvailableBillboards(true);
          }} className="gap-2">
            <Printer className="h-4 w-4" />
            طباعة مع الشعار
          </Button>
          <Button variant="secondary" onClick={() => {
            onOpenChange(false);
            printAvailableBillboards(false);
          }} className="gap-2">
            <Printer className="h-4 w-4" />
            طباعة بدون الشعار
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
