import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Printer, Loader2, X, History, Table, Eye } from 'lucide-react';
import { formatGregorianDate } from '@/lib/utils';
import DOMPurify from 'dompurify';
import { 
  resolveInvoiceStyles, 
  generateBaseCSS, 
  generateHeaderHTML, 
  generateCustomerHTML, 
  generateFooterHTML, 
  wrapInDocument,
  type ResolvedPrintStyles 
} from '@/lib/unifiedInvoiceBase';

interface HistoryRecord {
  id: string;
  contract_number: number;
  customer_name: string;
  ad_type: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  rent_amount: number;
  discount_amount?: number;
  discount_percentage?: number;
  installation_date: string;
  installation_cost?: number;
  billboard_rent_price?: number;
  total_before_discount?: number;
  design_face_a_url?: string;
  design_face_b_url?: string;
  installed_image_face_a_url?: string;
  installed_image_face_b_url?: string;
  team_name?: string;
  notes?: string;
  print_cost?: number;
  include_installation_in_price?: boolean;
  include_print_in_price?: boolean;
  pricing_category?: string;
  pricing_mode?: string;
  task_type?: string;
}

interface BillboardHistoryPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboardId: number;
  billboardName: string;
  history: HistoryRecord[];
  totalRentals: number;
  totalRevenue: number;
  totalDays: number;
}

export function BillboardHistoryPrintDialog({
  open,
  onOpenChange,
  billboardId,
  billboardName,
  history,
  totalRentals,
  totalRevenue,
  totalDays
}: BillboardHistoryPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedStyles, setResolvedStyles] = useState<ResolvedPrintStyles | null>(null);

  // Column visibility options
  const [showContractNumber, setShowContractNumber] = useState(true);
  const [showCustomerName, setShowCustomerName] = useState(true);
  const [showAdType, setShowAdType] = useState(true);
  const [showDates, setShowDates] = useState(true);
  const [showDuration, setShowDuration] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showInstallation, setShowInstallation] = useState(true);
  const [showPrint, setShowPrint] = useState(true);
  const [showTeam, setShowTeam] = useState(false);
  const [showInstallationImages, setShowInstallationImages] = useState(true);
  const [showDesignImages, setShowDesignImages] = useState(true);

  // Load settings from unified invoice system
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const styles = await resolveInvoiceStyles('sizes_invoice', {
          titleAr: 'تقرير تاريخ اللوحة',
          titleEn: 'BILLBOARD HISTORY'
        });
        setResolvedStyles(styles);
      } catch (e) {
        console.error('Error loading print settings:', e);
        toast.error('خطأ أثناء تحميل إعدادات الطباعة الموحدة');
      } finally {
        setIsLoading(false);
      }
    };

    if (open) {
      loadData();
    }
  }, [open]);

  // Calculate label column span dynamically
  const labelColSpan = 1 
    + (showContractNumber ? 1 : 0)
    + (showCustomerName ? 1 : 0)
    + (showAdType ? 1 : 0)
    + (showDates ? 2 : 0) // start_date and end_date
    + (showDuration ? 1 : 0)
    + (showDiscount ? 1 : 0)
    + (showInstallation ? 1 : 0)
    + (showPrint ? 1 : 0);

  const generateTableHTML = (t: ResolvedPrintStyles) => {
    const totalRowHtml = t.raw.showTotalsSection !== false ? `
      <tr class="grand-total-row">
        <td colspan="${labelColSpan}" class="totals-label">
          الإجمالي (${totalRentals} تأجير - ${totalDays} يوم)
        </td>
        ${showPrices ? `
          <td class="totals-value">
            <span class="num">${totalRevenue.toLocaleString()}</span> د.ل
          </td>
        ` : ''}
        ${showTeam ? `<td></td>` : ''}
        ${showInstallationImages ? `<td></td>` : ''}
        ${showDesignImages ? `<td></td>` : ''}
      </tr>
    ` : '';

    const rowsHtml = history.map((record, idx) => {
      const isCurrent = record.id.toString().startsWith('current-');
      const hasInstallationImages = record.installed_image_face_a_url || record.installed_image_face_b_url;
      const hasDesignImages = record.design_face_a_url || record.design_face_b_url;

      return `
        <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}" style="${isCurrent ? 'background-color: #dcfce7 !important;' : ''}">
          <td>${idx + 1}</td>
          ${showContractNumber ? `
            <td style="font-weight: 600;">
              ${record.contract_number}
              ${isCurrent ? `<span style="display:inline-block;padding:1px 5px;border-radius:4px;border:2px solid ${t.primaryColor};color:${t.primaryColor};font-size:8px;font-weight:bold;margin-right:4px;">حالي</span>` : ''}
              ${record.task_type === 'reinstallation'
                ? `<span style="display:inline-block;padding:1px 5px;border-radius:4px;background:#f59e0b;color:#fff;font-size:8px;font-weight:bold;margin-right:4px;">إعادة تركيب</span>`
                : `<span style="display:inline-block;padding:1px 5px;border-radius:4px;background:#6366f1;color:#fff;font-size:8px;font-weight:bold;margin-right:4px;">تركيب أولي</span>`
              }
            </td>
          ` : ''}
          ${showCustomerName ? `<td>${record.customer_name || '-'}</td>` : ''}
          ${showAdType ? `<td>${record.ad_type || '-'}</td>` : ''}
          ${showDates ? `
            <td dir="ltr" class="num" style="font-size: 10px; text-align: center;">${formatGregorianDate(record.start_date)}</td>
            <td dir="ltr" class="num" style="font-size: 10px; text-align: center;">${formatGregorianDate(record.end_date)}</td>
          ` : ''}
          ${showDuration ? `
            <td>
              <span style="display:inline-block;padding:3px 8px;border-radius:20px;background-color:${t.primaryColor}20;color:${t.primaryColor};font-family:'Manrope',sans-serif;font-weight:bold;font-size:10px;">
                ${record.duration_days} يوم
              </span>
            </td>
          ` : ''}
          ${showDiscount ? `
            <td class="num">
              ${record.discount_amount ? Number(record.discount_amount).toLocaleString() : '-'}
              ${record.discount_percentage ? `<span style="font-size:9px;opacity:0.7;"><br/>(${record.discount_percentage.toFixed(1)}%)</span>` : ''}
            </td>
          ` : ''}
          ${showInstallation ? `
            <td style="color:${t.primaryColor};font-weight:bold;" class="num">
              ${record.installation_cost ? Number(record.installation_cost).toLocaleString() : '-'}
 ${record.include_installation_in_price ? `<span style="color:#10b981;margin-right:2px;"></span>` : ''}
            </td>
          ` : ''}
          ${showPrint ? `
            <td class="num">
              ${record.print_cost ? Number(record.print_cost).toLocaleString() : '-'}
 ${record.include_print_in_price ? `<span style="color:#10b981;margin-right:2px;"></span>` : ''}
            </td>
          ` : ''}
          ${showPrices ? `
            <td style="color:${t.primaryColor};font-weight:bold;" class="num">
              ${Number(record.rent_amount || 0).toLocaleString()}
            </td>
          ` : ''}
          ${showTeam ? `<td>${record.team_name || '-'}</td>` : ''}
          ${showInstallationImages ? `
            <td style="padding:0;height:100px;vertical-align:middle;">
              ${hasInstallationImages ? `
                <div style="display:flex;gap:4px;justify-content:center;align-items:center;height:100%;padding:4px;">
                  ${record.installed_image_face_a_url ? `<img src="${record.installed_image_face_a_url}" alt="تركيب أ" style="max-width:70px;height:90px;object-fit:contain;" />` : ''}
                  ${record.installed_image_face_b_url ? `<img src="${record.installed_image_face_b_url}" alt="تركيب ب" style="max-width:70px;height:90px;object-fit:contain;" />` : ''}
                </div>
              ` : '<span style="color:#999;font-size:10px;">-</span>'}
            </td>
          ` : ''}
          ${showDesignImages ? `
            <td style="padding:0;height:100px;vertical-align:middle;">
              ${hasDesignImages ? `
                <div style="display:flex;flex-direction:column;gap:4px;justify-content:center;align-items:stretch;height:100%;padding:4px;">
                  ${record.design_face_a_url ? `<img src="${record.design_face_a_url}" alt="تصميم أ" style="width:100%;height:42px;object-fit:contain;" />` : ''}
                  ${record.design_face_b_url ? `<img src="${record.design_face_b_url}" alt="تصميم ب" style="width:100%;height:42px;object-fit:contain;" />` : ''}
                </div>
              ` : '<span style="color:#999;font-size:10px;">-</span>'}
            </td>
          ` : ''}
        </tr>
      `;
    }).join('');

    return `
      <div style="margin-bottom: 20px;">
        <div class="section-header" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid ${t.primaryColor};">
          <span style="font-size:${t.headerFontSize}px;font-weight:bold;color:${t.primaryColor};">سجل التأجيرات</span>
          <span style="font-size:${t.bodyFontSize}px;color:${t.tableText};opacity:0.7;margin-right:auto;">(${history.length} سجل)</span>
        </div>
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:4%">#</th>
              ${showContractNumber ? `<th>العقد</th>` : ''}
              ${showCustomerName ? `<th>الزبون</th>` : ''}
              ${showAdType ? `<th>الإعلان</th>` : ''}
              ${showDates ? `
                <th>البداية</th>
                <th>النهاية</th>
              ` : ''}
              ${showDuration ? `<th>المدة</th>` : ''}
              ${showDiscount ? `<th>الخصم</th>` : ''}
              ${showInstallation ? `<th>التركيب</th>` : ''}
              ${showPrint ? `<th>الطباعة</th>` : ''}
              ${showPrices ? `<th>المبلغ</th>` : ''}
              ${showTeam ? `<th>الفريق</th>` : ''}
              ${showInstallationImages ? `<th>صور التركيب</th>` : ''}
              ${showDesignImages ? `<th>التصميم</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${totalRowHtml}
          </tbody>
        </table>
      </div>
    `;
  };

  const handlePrint = () => {
    if (!resolvedStyles) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('فشل فتح نافذة الطباعة (الرجاء تفعيل النوافذ المنبثقة)');
      return;
    }

    const tableHtml = generateTableHTML(resolvedStyles);
    const statsCards = `
      <div class="stat-card">
        <div class="stat-value">${totalRentals}</div>
        <div class="stat-label">تأجير</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalDays}</div>
        <div class="stat-label">يوم</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalRevenue.toLocaleString()}</div>
        <div class="stat-label">إيرادات</div>
      </div>
    `;

    const customerHtml = generateCustomerHTML(resolvedStyles, {
      label: 'تقرير تاريخ اللوحة',
      name: billboardName,
      statsCards: statsCards
    });

    const metaHtml = `
      التاريخ: <span class="num" dir="ltr">${formatGregorianDate(new Date())}</span><br/>
      اللوحة: <span>${billboardName}</span> (معرف #${billboardId})
    `;

    // Landscape print overrides
    const extraCSS = `
      @media print {
        @page {
          size: A4 landscape !important;
          margin: 8mm 10mm 8mm 10mm !important;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
        }
      }
      .paper {
        width: 297mm !important;
        min-height: 210mm !important;
        box-shadow: none !important;
        border: none !important;
        overflow: visible !important;
      }
    `;

    const fullHTML = wrapInDocument(resolvedStyles, {
      title: `تقرير تاريخ اللوحة - ${billboardName}`,
      headerMetaHtml: metaHtml,
      customerHtml: customerHtml,
      bodyContent: tableHtml,
      extraCSS: extraCSS,
      autoPrint: true,
      showSignature: false
    });

    printWindow.document.open();
    printWindow.document.write(fullHTML);
    printWindow.document.close();
  };

  if (isLoading || !resolvedStyles) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statsCardsHtml = `
    <div class="stat-card">
      <div class="stat-value">${totalRentals}</div>
      <div class="stat-label">تأجير</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalDays}</div>
      <div class="stat-label">يوم</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalRevenue.toLocaleString()}</div>
      <div class="stat-label">إيرادات</div>
    </div>
  `;

  const customerHtml = generateCustomerHTML(resolvedStyles, {
    label: 'تقرير تاريخ اللوحة',
    name: billboardName,
    statsCards: statsCardsHtml
  });

  const metaHtml = `
    التاريخ: <span class="num" dir="ltr">${formatGregorianDate(new Date())}</span><br/>
    اللوحة: <span>${billboardName}</span> (معرف #${billboardId})
  `;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] p-0 flex flex-col overflow-hidden bg-card border border-border shadow-2xl rounded-2xl">
        <Tabs defaultValue="preview" className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="p-4 border-b bg-gradient-to-l from-primary/5 to-background flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <History className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">خيارات ومعاينة تقرير اللوحة</DialogTitle>
                  <p className="text-xs text-muted-foreground">{billboardName} - {totalRentals} تأجير</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TabsList className="h-9">
                  <TabsTrigger value="columns" className="text-xs px-3">
                    <Table className="h-3.5 w-3.5 ml-1" />
                    الأعمدة
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs px-3">
                    <Eye className="h-3.5 w-3.5 ml-1" />
                    معاينة
                  </TabsTrigger>
                </TabsList>
                <Button onClick={handlePrint} className="gap-2 font-bold px-4 rounded-xl">
                  <Printer className="h-4 w-4" />
                  طباعة
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-xl h-9 w-9">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <TabsContent value="columns" className="flex-1 overflow-auto p-5 m-0 bg-muted/10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showContractNumber" className="text-sm font-semibold cursor-pointer">رقم العقد</Label>
                <Switch id="showContractNumber" checked={showContractNumber} onCheckedChange={setShowContractNumber} />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showCustomerName" className="text-sm font-semibold cursor-pointer">الزبون</Label>
                <Switch id="showCustomerName" checked={showCustomerName} onCheckedChange={setShowCustomerName} />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showAdType" className="text-sm font-semibold cursor-pointer">نوع الإعلان</Label>
                <Switch id="showAdType" checked={showAdType} onCheckedChange={setShowAdType} />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showDates" className="text-sm font-semibold cursor-pointer">التواريخ</Label>
                <Switch id="showDates" checked={showDates} onCheckedChange={setShowDates} />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showDuration" className="text-sm font-semibold cursor-pointer">المدة</Label>
                <Switch id="showDuration" checked={showDuration} onCheckedChange={setShowDuration} />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showPrices" className="text-sm font-semibold cursor-pointer">المبلغ</Label>
                <Switch id="showPrices" checked={showPrices} onCheckedChange={setShowPrices} />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showDiscount" className="text-sm font-semibold cursor-pointer">الخصم</Label>
                <Switch id="showDiscount" checked={showDiscount} onCheckedChange={setShowDiscount} />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showInstallation" className="text-sm font-semibold cursor-pointer">التركيب</Label>
                <Switch id="showInstallation" checked={showInstallation} onCheckedChange={setShowInstallation} />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showPrint" className="text-sm font-semibold cursor-pointer">الطباعة</Label>
                <Switch id="showPrint" checked={showPrint} onCheckedChange={setShowPrint} />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showTeam" className="text-sm font-semibold cursor-pointer">الفريق</Label>
                <Switch id="showTeam" checked={showTeam} onCheckedChange={setShowTeam} />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showInstallationImages" className="text-sm font-semibold cursor-pointer">صور التركيب</Label>
                <Switch id="showInstallationImages" checked={showInstallationImages} onCheckedChange={setShowInstallationImages} />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-xl shadow-sm">
                <Label htmlFor="showDesignImages" className="text-sm font-semibold cursor-pointer">صور التصميم</Label>
                <Switch id="showDesignImages" checked={showDesignImages} onCheckedChange={setShowDesignImages} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-hidden m-0 p-0 flex flex-col bg-muted/30">
            <ScrollArea className="flex-1">
              <div className="p-6 flex justify-center items-start min-h-full">
                <div
                  ref={printRef}
                  className="bg-white shadow-xl border border-border/40"
                  style={{
                    width: '297mm',
                    minHeight: '210mm',
                    backgroundColor: '#fff',
                    fontFamily: `${resolvedStyles.fontFamily || 'Doran'}, 'Noto Sans Arabic', Arial, sans-serif`,
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    paddingTop: `${resolvedStyles.pageMarginTop || 15}mm`,
                    paddingBottom: `${resolvedStyles.pageMarginBottom || 15}mm`,
                    paddingLeft: `${resolvedStyles.pageMarginLeft || 15}mm`,
                    paddingRight: `${resolvedStyles.pageMarginRight || 15}mm`,
                    direction: 'rtl',
                    color: resolvedStyles.tableText,
                  }}
                >
                  {/* Inject base CSS */}
                  <style dangerouslySetInnerHTML={{ __html: generateBaseCSS(resolvedStyles) }} />

                  {/* Override paper style for preview inside the dialog scroll box */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    .paper {
                      width: 100% !important;
                      min-height: auto !important;
                      box-shadow: none !important;
                      border: none !important;
                      padding: 0 !important;
                      background: transparent !important;
                    }
                    .items-table td, .items-table th {
                      padding: 8px 6px !important;
                    }
                  ` }} />

                  {/* Background Layer */}
                  {resolvedStyles.bgImageUrl && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundImage: `url(${resolvedStyles.bgImageUrl})`,
                        backgroundSize: `${resolvedStyles.raw.backgroundScale || 100}%`,
                        backgroundPosition: `${resolvedStyles.raw.backgroundPosX || 50}% ${resolvedStyles.raw.backgroundPosY || 50}%`,
                        backgroundRepeat: 'no-repeat',
                        opacity: (resolvedStyles.backgroundOpacity || 10) / 100,
                        pointerEvents: 'none',
                        zIndex: 0,
                      }}
                    />
                  )}

                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ flex: 1, paddingBottom: `${resolvedStyles.contentBottomSpacing || 25}mm` }}>
                      {/* Unified Header */}
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generateHeaderHTML(resolvedStyles, metaHtml)) }} />

                      {/* Unified Billboard Stats */}
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(customerHtml) }} />

                      {/* Dynamic Table */}
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generateTableHTML(resolvedStyles)) }} />
                    </div>
                    
                    {/* Unified Footer */}
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generateFooterHTML(resolvedStyles)) }} />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
