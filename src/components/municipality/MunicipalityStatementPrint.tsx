import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BillboardDetail {
  bbId: number;
  bbName: string;
  imageUrl: string;
  landmark: string;
  endDate: string;
  startDate: string;
  durationMonths: number;
  revenue: number;
  installation: number;
  print: number;
  net: number;
  designA: string;
  designB: string;
  installedImageA: string;
  installedImageB: string;
  size: string;
  facesCount: number;
}

interface ContractGroup {
  contractNumber: number;
  customerName: string;
  adType: string;
  billboards: BillboardDetail[];
}

interface MunicipalityStatementProps {
  municipalityName: string;
  contractGroups: ContractGroup[];
  stats: {
    totalBillboards: number;
    rentedBillboards: number;
    totalRevenue: number;
    totalInstallation: number;
    totalPrint: number;
    netRevenue: number;
  };
}

const MunicipalityStatementPrint = ({ municipalityName, contractGroups, stats }: MunicipalityStatementProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCosts, setShowCosts] = useState(true);
  const [showTotalOnly, setShowTotalOnly] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  const [showDesign, setShowDesign] = useState(true);

  const handlePrint = async () => {
    setLoading(true);
    setDialogOpen(false);
    toast.info('جاري تجهيز الكشف...');

    try {
      let logoPath = '';
      let fontFamily = 'Doran';
      let footerText = 'شكراً لتعاملكم معنا';
      try {
        const { getMergedInvoiceStylesAsync } = await import('@/hooks/useInvoiceSettingsSync');
        const styles = await getMergedInvoiceStylesAsync('account_statement');
        if (styles) {
          logoPath = styles.showLogo !== false ? (styles.logoPath || '') : '';
          fontFamily = styles.fontFamily || 'Doran';
          footerText = styles.footerText || footerText;
        }
      } catch { /* defaults */ }

      const today = new Date().toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' });
      const baseUrl = window.location.origin;
      const fullLogoUrl = logoPath ? (logoPath.startsWith('http') ? logoPath : `${baseUrl}${logoPath}`) : '';

      const contractSections = contractGroups.map((cg, cIdx) => {
        const contractTotal = cg.billboards.reduce((s, b) => s + b.revenue, 0);
        const contractInstall = cg.billboards.reduce((s, b) => s + b.installation, 0);
        const contractPrint = cg.billboards.reduce((s, b) => s + b.print, 0);

        const tableRows = cg.billboards.map((item, idx) => `
          <tr style="background-color:${idx % 2 === 0 ? '#f5f5f5' : '#ffffff'};">
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;vertical-align:middle;">${idx + 1}</td>
            <td style="padding:4px;border:1px solid #ccc;text-align:center;vertical-align:middle;">
              ${item.imageUrl ? `<img src="${item.imageUrl}" alt="صورة" style="width:100%;max-height:55px;object-fit:contain;border-radius:4px;" onerror="this.style.display='none'" />` : '<span style="color:#999;font-size:8px;">—</span>'}
            </td>
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-weight:bold;font-size:9px;vertical-align:middle;">
              ${item.bbName}
              ${item.landmark ? `<div style="font-size:7px;color:#888;margin-top:2px;">${item.landmark}</div>` : ''}
            </td>
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:9px;vertical-align:middle;">
              <div style="font-weight:bold;">${item.size || '—'}</div>
              <div style="font-size:8px;color:#555;margin-top:2px;">
                ${item.facesCount === 1 ? 'وجه واحد' : item.facesCount === 2 ? 'وجهين' : (item.facesCount || 1) + ' أوجه'}
              </div>
            </td>
            ${showDesign ? `
            <td style="padding:2px;border:1px solid #ccc;text-align:center;vertical-align:middle;">
              <div style="display:flex;flex-direction:column;gap:2px;align-items:center;">
                ${item.designA ? `<img src="${item.designA}" alt="تصميم" style="width:100%;max-height:${item.facesCount >= 2 ? '35px' : '50px'};object-fit:contain;" onerror="this.style.display='none'" />` : ''}
                ${item.designB && item.facesCount >= 2 ? `<img src="${item.designB}" alt="تصميم خلفي" style="width:100%;max-height:35px;object-fit:contain;" onerror="this.style.display='none'" />` : ''}
                ${!item.designA && !item.designB ? '<span style="color:#999;font-size:8px;">—</span>' : ''}
              </div>
            </td>
            <td style="padding:2px;border:1px solid #ccc;text-align:center;vertical-align:middle;">
              <div style="display:flex;flex-direction:column;gap:2px;align-items:center;">
                ${item.installedImageA ? `<img src="${item.installedImageA}" alt="صورة تركيب" style="width:100%;max-height:${item.installedImageB ? '35px' : '50px'};object-fit:contain;border-radius:3px;" onerror="this.style.display='none'" />` : ''}
                ${item.installedImageB ? `<img src="${item.installedImageB}" alt="صورة تركيب خلفي" style="width:100%;max-height:35px;object-fit:contain;border-radius:3px;" onerror="this.style.display='none'" />` : ''}
                ${!item.installedImageA && !item.installedImageB ? '<span style="color:#999;font-size:8px;">—</span>' : ''}
              </div>
            </td>` : ''}
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:9px;vertical-align:middle;">${item.startDate || '—'}</td>
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:9px;vertical-align:middle;">${item.endDate || '—'}</td>
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:9px;font-weight:bold;vertical-align:middle;">
              ${item.durationMonths > 0 ? item.durationMonths + ' شهر' : '—'}
            </td>
            ${showCosts ? (showTotalOnly ? `
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-family:Manrope;font-weight:bold;font-size:9px;background:#e5e5e5;vertical-align:middle;">
              ${(item.revenue + item.installation + item.print) > 0 ? (item.revenue + item.installation + item.print).toLocaleString() + ' د.ل' : '—'}
            </td>` : `
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-family:Manrope;font-weight:bold;font-size:9px;background:#e5e5e5;vertical-align:middle;">
              ${item.revenue > 0 ? item.revenue.toLocaleString() + ' د.ل' : '—'}
            </td>
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-family:Manrope;font-size:9px;vertical-align:middle;">
              ${item.print > 0 ? item.print.toLocaleString() + ' د.ل' : '—'}
            </td>
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-family:Manrope;font-size:9px;vertical-align:middle;">
              ${item.installation > 0 ? item.installation.toLocaleString() + ' د.ل' : '—'}
            </td>`) : ''}
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:9px;vertical-align:middle;">
              <span style="background:${item.endDate && new Date(item.endDate) >= new Date() ? '#dcfce7' : '#fef3c7'};color:${item.endDate && new Date(item.endDate) >= new Date() ? '#166534' : '#92400e'};padding:2px 8px;border-radius:4px;">
                ${item.endDate && new Date(item.endDate) >= new Date() ? 'نشط' : 'منتهي'}
              </span>
            </td>
          </tr>
        `).join('');

        return `
          ${cIdx > 0 ? '<div style="margin:20px 0;border-top:3px dashed #ccc;"></div>' : ''}
          <div style="background:linear-gradient(135deg, #f5f5f5, #ffffff);padding:12px 16px;margin-bottom:12px;border-radius:8px;border-right:5px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:16px;font-weight:bold;color:#1a1a1a;">
                عقد #${cg.contractNumber}
              </div>
              <div style="font-size:12px;color:#666;margin-top:2px;">
                ${cg.customerName ? `<span style="margin-left:12px;">العميل: <strong>${cg.customerName}</strong></span>` : ''}
                ${cg.adType && cg.adType !== '—' ? `<span>نوع الإعلان: <strong>${cg.adType}</strong></span>` : ''}
                <span style="margin-right:12px;">${cg.billboards.length} لوحات</span>
              </div>
            </div>
            ${showCosts ? `<div style="text-align:center;">
              <div style="font-size:18px;font-weight:bold;color:#1a1a1a;font-family:Manrope;">${showTotalOnly ? (contractTotal + contractInstall + contractPrint).toLocaleString() : contractTotal.toLocaleString()}</div>
              <div style="font-size:10px;color:#666;">د.ل${showTotalOnly ? ' إجمالي' : ''}</div>
            </div>` : ''}
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px;">
            <thead>
              <tr style="background-color:#1a1a1a;">
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;width:4%;">#</th>
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;width:9%;">صورة اللوحة</th>
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;">اللوحة</th>
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;">المقاس</th>
                ${showDesign ? `
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;width:9%;">التصميم</th>
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;width:9%;">صورة التركيب</th>` : ''}
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;">بداية الإيجار</th>
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;">نهاية الإيجار</th>
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;">المدة</th>
                ${showCosts ? (showTotalOnly ? `
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;">الإجمالي</th>` : `
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;">الإيجار</th>
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;">الطباعة</th>
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;">التركيب</th>`) : ''}
                <th style="padding:8px 4px;color:#fff;border:1px solid #1a1a1a;text-align:center;">الحالة</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            ${showCosts ? `
            <tfoot>
              <tr style="background-color:#1a1a1a;font-weight:bold;">
                <td colspan="${showDesign ? 9 : 7}" style="padding:10px 6px;border:1px solid #1a1a1a;text-align:center;color:#fff;font-size:11px;">إجمالي عقد #${cg.contractNumber}</td>
                ${showTotalOnly ? `
                <td style="padding:10px 6px;border:1px solid #1a1a1a;text-align:center;font-family:Manrope;font-weight:bold;color:#fff;font-size:11px;">${(contractTotal + contractInstall + contractPrint).toLocaleString()} د.ل</td>` : `
                <td style="padding:10px 6px;border:1px solid #1a1a1a;text-align:center;font-family:Manrope;font-weight:bold;color:#fff;font-size:11px;">${contractTotal.toLocaleString()} د.ل</td>
                <td style="padding:10px 6px;border:1px solid #1a1a1a;text-align:center;font-family:Manrope;color:#fff;font-size:10px;">${contractPrint.toLocaleString()}</td>
                <td style="padding:10px 6px;border:1px solid #1a1a1a;text-align:center;font-family:Manrope;color:#fff;font-size:10px;">${contractInstall.toLocaleString()}</td>`}
                <td style="border:1px solid #1a1a1a;background-color:#1a1a1a;"></td>
              </tr>
            </tfoot>` : ''}
          </table>
        `;
      }).join('');

      const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>كشف بلدية ${municipalityName}</title>
          <style>
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
            @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
            @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
            * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
            html,body { font-family:'${fontFamily}','Noto Sans Arabic',Arial,sans-serif; direction:rtl; background:white; color:#000; font-size:10px; }
            .print-container { width:297mm; min-height:210mm; padding:12mm; background:#fff; margin:0 auto; }
            @media print { @page { size:A4 landscape; margin:12mm; } .print-container { width:100%; min-height:auto; padding:0; } }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:15px;border-bottom:3px solid #1a1a1a;">
              <div style="flex:1;">
                <h1 style="font-size:28px;font-weight:bold;color:#1a1a1a;margin-bottom:8px;">كشف لوحات بلدية ${municipalityName}</h1>
                <div style="font-size:12px;color:#666;line-height:1.8;">
                  <div>التاريخ: ${today}</div>
                </div>
              </div>
              ${fullLogoUrl ? `<img src="${fullLogoUrl}" style="height:90px;object-fit:contain;" onerror="this.style.display='none'" />` : ''}
            </div>

            <div style="background:linear-gradient(135deg, #f5f5f5, #ffffff);padding:20px;margin-bottom:24px;border-radius:12px;border-right:5px solid #1a1a1a;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-size:14px;color:#666;margin-bottom:4px;">بلدية</div>
                  <div style="font-size:26px;font-weight:bold;color:#1a1a1a;">${municipalityName}</div>
                </div>
                <div style="display:flex;gap:24px;">
                  <div style="text-align:center;">
                    <div style="font-size:24px;font-weight:bold;color:#1a1a1a;font-family:Manrope;">${stats.totalBillboards}</div>
                    <div style="font-size:12px;color:#666;">لوحة</div>
                  </div>
                  <div style="text-align:center;">
                    <div style="font-size:24px;font-weight:bold;color:#1a1a1a;font-family:Manrope;">${stats.rentedBillboards}</div>
                    <div style="font-size:12px;color:#666;">مؤجرة</div>
                  </div>
                  <div style="text-align:center;">
                    <div style="font-size:24px;font-weight:bold;color:#1a1a1a;font-family:Manrope;">${contractGroups.length}</div>
                    <div style="font-size:12px;color:#666;">عقد</div>
                  </div>
                  ${showCosts ? `<div style="text-align:center;">
                    <div style="font-size:24px;font-weight:bold;color:#D4AF37;font-family:Manrope;">${stats.totalRevenue.toLocaleString()}</div>
                    <div style="font-size:12px;color:#666;">د.ل إيجار</div>
                  </div>` : ''}
                </div>
              </div>
            </div>

            ${contractSections}

            ${showCosts ? `
            <div style="background:linear-gradient(135deg, #1a1a1a, #333333);padding:20px;text-align:center;border-radius:8px;margin-top:20px;">
              <div style="font-size:14px;color:#fff;opacity:0.9;margin-bottom:6px;">الإجمالي</div>
              <div style="font-size:28px;font-weight:bold;color:#D4AF37;font-family:Manrope;">
                ${(stats.totalRevenue + stats.totalInstallation + stats.totalPrint).toLocaleString()}
                <span style="font-size:16px;margin-right:8px;">دينار ليبي</span>
              </div>
              ${!showTotalOnly ? `<div style="display:flex;justify-content:center;gap:30px;margin-top:8px;font-size:11px;">
                <span style="color:#93c5fd;">إيجار: ${stats.totalRevenue.toLocaleString()} د.ل</span>
                <span style="color:#fca5a5;">تركيب: ${stats.totalInstallation.toLocaleString()} د.ل</span>
                <span style="color:#fde68a;">طباعة: ${stats.totalPrint.toLocaleString()} د.ل</span>
              </div>` : ''}
            </div>` : ''}

            ${showStamp ? `
            <div style="margin-top:40px;padding-top:20px;border-top:2px dashed #ccc;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div style="flex:1;text-align:center;padding-left:20px;">
                  <div style="font-size:14px;font-weight:bold;color:#333;margin-bottom:60px;">الختم</div>
                  <div style="border-top:2px solid #333;width:120px;margin:0 auto;"></div>
                </div>
                <div style="flex:1;text-align:center;padding-right:20px;">
                  <div style="font-size:14px;font-weight:bold;color:#333;margin-bottom:60px;">التوقيع</div>
                  <div style="border-top:2px solid #333;width:120px;margin:0 auto;"></div>
                </div>
              </div>
            </div>` : ''}

            <div style="margin-top:30px;padding-top:15px;border-top:1px solid #1a1a1a;text-align:center;font-size:10px;color:#666;">
              ${footerText}
            </div>
          </div>
        </body>
        </html>
      `;

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 800);
      }
    } catch (err) {
      console.error(err);
      toast.error('خطأ في تجهيز الكشف');
    }
    setLoading(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
        title="طباعة كشف البلدية"
      >
        <Printer className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>طباعة كشف بلدية {municipalityName}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">تحديد الخيارات المطلوبة لطباعة كشف اللوحات للبلدية</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={showDesign} onCheckedChange={(v) => setShowDesign(!!v)} />
              <span className="text-sm">إظهار التصاميم</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={showCosts} onCheckedChange={(v) => { setShowCosts(!!v); if (!v) setShowTotalOnly(false); }} />
              <span className="text-sm">إظهار التكاليف</span>
            </label>
            {showCosts && (
              <label className="flex items-center gap-2 cursor-pointer mr-6">
                <Checkbox checked={showTotalOnly} onCheckedChange={(v) => setShowTotalOnly(!!v)} />
                <span className="text-sm">إجمالي فقط (بدون تفصيل)</span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={showStamp} onCheckedChange={(v) => setShowStamp(!!v)} />
              <span className="text-sm">الختم والتوقيع</span>
            </label>
          </div>
          <DialogFooter>
            <Button onClick={handlePrint} disabled={loading} className="gap-2">
              <Printer className="h-4 w-4" />
              طباعة الكشف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MunicipalityStatementPrint;
