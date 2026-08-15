import React, { useEffect, useState } from 'react';
import { getDSFallbackScript } from '@/utils/printDSFallbackScript';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FileText, Calendar, User, DollarSign, Clock, Printer, CheckCircle2,
  Image as ImageIcon, TrendingUp, BarChart3, Wallet, Tag, Wrench, Palette,
  ArrowLeft, AlertTriangle, Hammer, RefreshCw
} from 'lucide-react';
import { formatGregorianDate } from '@/lib/utils';

import { BillboardHistoryPrintDialog } from './BillboardHistoryPrintDialog';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';

interface BillboardHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboardId: number;
  billboardName: string;
}

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
  design_face_a_url: string;
  design_face_b_url: string;
  design_name: string;
  installed_image_face_a_url: string;
  installed_image_face_b_url: string;
  team_name: string;
  notes: string;
  created_at: string;
  print_cost?: number;
  include_installation_in_price?: boolean;
  include_print_in_price?: boolean;
  pricing_category?: string;
  pricing_mode?: string;
  contract_total?: number;
  contract_total_rent?: number;
  contract_discount?: number;
  individual_billboard_data?: any;
  net_rental_amount?: number;
  task_type?: string;
}

export const BillboardHistoryDialog: React.FC<BillboardHistoryDialogProps> = ({
  open,
  onOpenChange,
  billboardId,
  billboardName
}) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRentals, setTotalRentals] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  useEffect(() => {
    if (open && billboardId) {
      loadHistory();
    }
  }, [open, billboardId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      // جلب السجلات التاريخية
      const { data: historyData, error: historyError } = await supabase
        .from('billboard_history' as any)
        .select('*')
        .eq('billboard_id', billboardId)
        .order('start_date', { ascending: false });

      if (historyError) throw historyError;

      // جلب العقد الحالي النشط للوحة
      const { data: billboard, error: billboardError } = await supabase
        .from('billboards')
        .select('*')
        .eq('ID', billboardId)
        .single();

      if (billboardError && billboardError.code !== 'PGRST116') throw billboardError;

      let allRecords: HistoryRecord[] = (historyData || []) as unknown as HistoryRecord[];

      // إضافة العقد الحالي إذا كان موجوداً ونشطاً
      if (billboard?.Contract_Number && billboard?.Rent_Start_Date) {
        const endDate = billboard.Rent_End_Date ? new Date(billboard.Rent_End_Date) : null;
        const today = new Date();
        const isActive = !endDate || endDate >= today;

        if (isActive) {
          // إزالة التكرار - حذف العقد النشط من السجلات التاريخية
          allRecords = allRecords.filter(r => r.contract_number !== billboard.Contract_Number);

          const startDate = new Date(billboard.Rent_Start_Date);
          const durationDays = endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

          // جلب بيانات العقد الكاملة مع معلومات التركيب والطباعة
          const { data: contractData } = await supabase
            .from('Contract')
            .select('Total, "Total Rent", Discount, installation_cost, installation_enabled, design_data, billboard_ids, billboard_prices, print_cost, include_installation_in_price, include_print_in_billboard_price')
            .eq('Contract_Number', billboard.Contract_Number)
            .single();

          // حساب السعر الفردي للوحة
          const billboardIds = contractData?.billboard_ids ? contractData.billboard_ids.split(',').map((id: string) => id.trim()) : [];
          const billboardCount = billboardIds.length || 1;
          
          let individualPrice = 0;
          let individualDiscount = 0;
          let individualPrintCost = 0;
          let individualInstallationCost = 0;
          let pricingCategory = '';
          let pricingMode = '';
          let individualBillboardData: any = null;
          
          if (contractData?.billboard_prices) {
            try {
              const prices = typeof contractData.billboard_prices === 'string' 
                ? JSON.parse(contractData.billboard_prices) 
                : contractData.billboard_prices;
              
              const billboardPriceData = Array.isArray(prices) 
                ? prices.find((p: any) => p.billboardId?.toString() === billboardId.toString())
                : null;
              
              if (billboardPriceData) {
                individualBillboardData = billboardPriceData;
                individualPrice = billboardPriceData.priceBeforeDiscount || billboardPriceData.contractPrice || 0;
                individualDiscount = billboardPriceData.discountPerBillboard || 0;
                individualPrintCost = billboardPriceData.printCost || 0;
                individualInstallationCost = billboardPriceData.installationCost || 0;
                pricingCategory = billboardPriceData.pricingCategory || '';
                pricingMode = billboardPriceData.pricingMode || '';
              }
            } catch (e) {
              console.error('Error parsing billboard_prices:', e);
            }
          }
          
          if (individualPrice === 0) {
            const rentOnly = Math.max((contractData?.Total || 0) - (contractData?.installation_cost || 0), 0);
            individualPrice = rentOnly / billboardCount;
            individualDiscount = (contractData?.Discount || 0) / billboardCount;
            individualInstallationCost = ((contractData?.installation_enabled && contractData?.installation_cost) || 0) / billboardCount;
            individualPrintCost = (contractData?.print_cost || 0) / billboardCount;
          }

          const includeInstall = contractData?.include_installation_in_price || false;
          const includePrint = contractData?.include_print_in_billboard_price || false;

          // Rent amount logic: only add install/print costs if they are NOT included in the billboard price!
          const netRentalAmountValue = individualPrice - individualDiscount;
          let finalAmount = netRentalAmountValue;
          if (!includeInstall) {
            finalAmount += individualInstallationCost;
          }
          if (!includePrint) {
            finalAmount += individualPrintCost;
          }

          const discountPct = individualPrice > 0 ? (individualDiscount / individualPrice) * 100 : 0;

          // جلب التصاميم
          let designA = '';
          let designB = '';
          
          const { data: tasks } = await supabase
            .from('installation_tasks')
            .select('id')
            .eq('contract_id', billboard.Contract_Number);
          
          if (tasks?.length) {
            const { data: items } = await supabase
              .from('installation_task_items')
              .select('design_face_a, design_face_b, selected_design_id, installed_image_face_a_url, installed_image_face_b_url')
              .eq('billboard_id', billboardId)
              .in('task_id', tasks.map(t => t.id))
              .limit(1);
            
            if (items?.[0]) {
              designA = items[0].design_face_a || '';
              designB = items[0].design_face_b || '';
              
              if ((!designA || !designB) && items[0].selected_design_id) {
                const { data: designData } = await supabase
                  .from('task_designs')
                  .select('design_face_a_url, design_face_b_url')
                  .eq('id', items[0].selected_design_id)
                  .single();
                
                if (designData) {
                  designA = designData.design_face_a_url || designA;
                  designB = designData.design_face_b_url || designB;
                }
              }
            }
          }
          
          if (!designA && !designB) {
            designA = billboard.design_face_a || '';
            designB = billboard.design_face_b || '';
            
            if ((!designA || !designB) && contractData?.design_data) {
              const designs = Array.isArray(contractData.design_data) ? contractData.design_data : [contractData.design_data];
              if (designs[0] && typeof designs[0] === 'object') {
                const design = designs[0] as any;
                designA = design.face_a_url || design.faceAUrl || designA;
                designB = design.face_b_url || design.faceBUrl || designB;
              }
            }
          }

          // جلب صور التركيب
          let imgA = '', imgB = '';
          if (tasks?.length) {
            const { data: items } = await supabase.from('installation_task_items')
              .select('installed_image_face_a_url, installed_image_face_b_url')
              .eq('billboard_id', billboardId).in('task_id', tasks.map(t => t.id)).limit(1);
            if (items?.[0]) {
              imgA = items[0].installed_image_face_a_url || '';
              imgB = items[0].installed_image_face_b_url || '';
            }
          }

          const currentRecord: HistoryRecord = {
            id: `current-${billboard.Contract_Number}`,
            contract_number: billboard.Contract_Number,
            customer_name: billboard.Customer_Name || '',
            ad_type: billboard.Ad_Type || '',
            start_date: billboard.Rent_Start_Date,
            end_date: billboard.Rent_End_Date || '',
            duration_days: durationDays,
            rent_amount: finalAmount,
            discount_amount: individualDiscount,
            discount_percentage: discountPct,
            installation_date: billboard.Rent_Start_Date,
            installation_cost: individualInstallationCost,
            billboard_rent_price: billboard.Price || 0,
            total_before_discount: individualPrice,
            design_face_a_url: designA,
            design_face_b_url: designB,
            design_name: '',
            installed_image_face_a_url: imgA,
            installed_image_face_b_url: imgB,
            team_name: '',
            notes: individualBillboardData?.startDateReason
              ? `عقد حالي نشط — سبب تعديل البداية: ${individualBillboardData.startDateReason}`
              : 'عقد حالي نشط',
            created_at: new Date().toISOString(),
            print_cost: individualPrintCost,
            include_installation_in_price: includeInstall,
            include_print_in_price: includePrint,
            pricing_category: pricingCategory,
            pricing_mode: pricingMode,
            contract_total: contractData?.Total || 0,
            contract_total_rent: contractData?.['Total Rent'] || 0,
            contract_discount: contractData?.Discount || 0,
            individual_billboard_data: individualBillboardData,
            net_rental_amount: netRentalAmountValue
          };

          allRecords = [currentRecord, ...allRecords];
        }
      }

      setHistory(allRecords);
      
      // حساب الإحصائيات
      const rentalsCount = allRecords.length;
      const revenue = allRecords.reduce((sum, record) => sum + (Number(record.rent_amount) || 0), 0);
      const days = allRecords.reduce((sum, record) => sum + (record.duration_days || 0), 0);

      setTotalRentals(rentalsCount);
      setTotalRevenue(revenue);
      setTotalDays(days);
    } catch (error: any) {
      console.error('Error loading history:', error);
      toast.error('فشل تحميل السجل التاريخي');
    } finally {
      setLoading(false);
    }
  };

  // Deletion is permanently disabled to preserve complete audit trail.

  const printHistory = () => {
    try {
      const docTitle = `تقرير تاريخ اللوحة ${billboardName}`;
      const printWindow = preparePrintWindow(docTitle);

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>تقرير تاريخ اللوحة ${billboardName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              direction: rtl;
            }
            h1 {
              text-align: center;
              color: #333;
              margin-bottom: 30px;
            }
            .stats {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-bottom: 30px;
              padding: 20px;
              background: #f5f5f5;
              border-radius: 8px;
            }
            .stat-item {
              text-align: center;
            }
            .stat-label {
              color: #666;
              font-size: 14px;
              margin-bottom: 5px;
            }
            .stat-value {
              font-size: 24px;
              font-weight: bold;
              color: #333;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: right;
            }
            th {
              background-color: #4CAF50;
              color: white;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .badge {
              display: inline-block;
              padding: 4px 8px;
              background: #4CAF50;
              color: white;
              border-radius: 4px;
              font-size: 12px;
            }
            .images {
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
            }
            .images img {
              max-width: 100px;
              max-height: 100px;
              object-fit: cover;
              border-radius: 4px;
              border: 1px solid #ddd;
            }
            @media print {
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
          ${getDSFallbackScript()}
        </head>
        <body>
          <h1>تقرير تاريخ اللوحة: ${billboardName}</h1>
          
          <div class="stats">
            <div class="stat-item">
              <div class="stat-label">عدد مرات التأجير</div>
              <div class="stat-value">${totalRentals}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">إجمالي الإيرادات</div>
              <div class="stat-value">${totalRevenue.toLocaleString()} دينار</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">إجمالي أيام الإيجار</div>
              <div class="stat-value">${totalDays} يوم</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>رقم العقد</th>
                <th>اسم الزبون</th>
                <th>نوع الإعلان</th>
                <th>تاريخ البداية</th>
                <th>تاريخ النهاية</th>
                <th>المدة</th>
                <th>سعر اللوحة</th>
                <th>المبلغ قبل الخصم</th>
                <th>الخصم</th>
                <th>نسبة الخصم</th>
                <th>تكلفة التركيب</th>
                <th>تكلفة الطباعة</th>
                <th>التركيب ضمن السعر</th>
                <th>الطباعة ضمن السعر</th>
                <th>المبلغ النهائي</th>
                <th>الفريق</th>
                <th>فئة التسعير</th>
                <th>صور التصميم</th>
                <th>صور التركيب</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(record => `
                <tr>
                  <td>
                    ${record.contract_number || '-'}
                    ${record.id.toString().startsWith('current-') ? '<span class="badge">عقد حالي</span>' : ''}
                  </td>
                  <td>${record.customer_name || '-'}</td>
                  <td>${record.ad_type || '-'}</td>
                  <td dir="ltr">${formatGregorianDate(record.start_date)}</td>
                  <td dir="ltr">${formatGregorianDate(record.end_date)}</td>
                  <td>${record.duration_days || 0} يوم</td>
                  <td>${record.billboard_rent_price ? Number(record.billboard_rent_price).toLocaleString() + ' دينار' : '-'}</td>
                  <td>${record.total_before_discount ? Number(record.total_before_discount).toLocaleString() + ' دينار' : '-'}</td>
                  <td>${record.discount_amount ? Number(record.discount_amount).toLocaleString() + ' دينار' : '-'}</td>
                  <td>${record.discount_percentage ? Number(record.discount_percentage).toFixed(2) + '%' : '-'}</td>
                  <td>${record.installation_cost ? Number(record.installation_cost).toLocaleString() + ' دينار' : '-'}</td>
                  <td>${record.print_cost ? Number(record.print_cost).toLocaleString() + ' دينار' : '-'}</td>
 <td>${record.include_installation_in_price ? ' نعم' : '-'}</td>
 <td>${record.include_print_in_price ? ' نعم' : '-'}</td>
                  <td>${Number(record.rent_amount || 0).toLocaleString()} دينار</td>
                  <td>${record.team_name || '-'}</td>
                  <td>${record.pricing_category || '-'}</td>
                  <td>
                    <div class="images">
                      ${record.design_face_a_url ? `<img src="${record.design_face_a_url}" alt="تصميم وجه أ" onerror="this.onerror=null;this.src='/placeholder.svg'" />` : ''}
                      ${record.design_face_b_url ? `<img src="${record.design_face_b_url}" alt="تصميم وجه ب" onerror="this.onerror=null;this.src='/placeholder.svg'" />` : ''}
                      ${!record.design_face_a_url && !record.design_face_b_url ? '-' : ''}
                    </div>
                  </td>
                  <td>
                    <div class="images">
                      ${record.installed_image_face_a_url ? `<img src="${record.installed_image_face_a_url}" alt="تركيب وجه أ" onerror="this.onerror=null;this.src='/placeholder.svg'" />` : ''}
                      ${record.installed_image_face_b_url ? `<img src="${record.installed_image_face_b_url}" alt="تركيب وجه ب" onerror="this.onerror=null;this.src='/placeholder.svg'" />` : ''}
                      ${!record.installed_image_face_a_url && !record.installed_image_face_b_url ? '-' : ''}
                    </div>
                  </td>
                  <td>${record.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
              طباعة
            </button>
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

      toast.success('تم فتح نافذة الطباعة');
    } catch (error) {
      console.error('Print error:', error);
      toast.error('فشل فتح نافذة الطباعة');
    }
  };

  const isPaused = (record: HistoryRecord) =>
    record.notes?.includes('إيقاف') || record.individual_billboard_data?.type === 'pause';

  const avgPerDay = totalDays > 0 ? Math.round(totalRevenue / totalDays) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col bg-card border border-border/80 shadow-2xl p-0 rounded-2xl">
        {/* Header with beautiful styling */}
        <div className="flex items-center justify-between p-6 border-b border-border/60 bg-gradient-to-r from-muted/50 to-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 text-primary rounded-xl border border-primary/20">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black text-foreground tracking-tight">
                سجل حركة وتأجير اللوحة
              </DialogTitle>
              <div className="text-sm text-muted-foreground font-medium mt-0.5">
                اللوحة: <span className="font-bold text-foreground">{billboardName}</span> (معرف #{billboardId})
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPrintDialogOpen(true)}
              disabled={history.length === 0}
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 font-bold gap-2"
            >
              <Printer className="h-4 w-4" />
              طباعة السجل بالكامل
            </Button>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-muted/10 border-b border-border/50">
          {/* Card 1: Rentals Count */}
          <div className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent rounded-2xl p-4 border border-indigo-500/20 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl transform translate-x-4 -translate-y-4 transition-transform group-hover:scale-125" />
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold tracking-wider uppercase">مرات التأجير</span>
                <h4 className="text-3xl font-black text-foreground mt-1">{totalRentals}</h4>
              </div>
              <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Card 2: Total Revenue */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent rounded-2xl p-4 border border-emerald-500/20 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl transform translate-x-4 -translate-y-4 transition-transform group-hover:scale-125" />
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold tracking-wider uppercase">إجمالي العوائد المجمعة</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <h4 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{totalRevenue.toLocaleString()}</h4>
                  <span className="text-xs text-muted-foreground font-bold">د.ل</span>
                </div>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Card 3: Rental Days */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl p-4 border border-amber-500/20 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl transform translate-x-4 -translate-y-4 transition-transform group-hover:scale-125" />
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-bold tracking-wider uppercase">إجمالي أيام التشغيل</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <h4 className="text-3xl font-black text-amber-600 dark:text-amber-400">{totalDays}</h4>
                  <span className="text-xs text-muted-foreground font-bold">يوم</span>
                </div>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Card 4: Daily Average Rent */}
          <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent rounded-2xl p-4 border border-blue-500/20 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl transform translate-x-4 -translate-y-4 transition-transform group-hover:scale-125" />
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold tracking-wider uppercase">متوسط العائد اليومي</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <h4 className="text-3xl font-black text-blue-600 dark:text-blue-400">{avgPerDay.toLocaleString()}</h4>
                  <span className="text-xs text-muted-foreground font-bold">د.ل/يوم</span>
                </div>
              </div>
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Records Container */}
        <ScrollArea className="flex-1 overflow-y-auto bg-muted/5 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-bold">جاري تحميل السجل التاريخي...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 bg-card border border-dashed border-border rounded-2xl shadow-inner max-w-xl mx-auto mt-6">
              <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h5 className="text-lg font-bold text-foreground mb-1">لا يوجد سجلات حتى الآن</h5>
              <p className="text-sm text-muted-foreground">لم يتم إكمال أي مهام تركيب أو عقود سابقة لهذه اللوحة بعد.</p>
            </div>
          ) : (
            <div className="relative border-r-2 border-border/80 pr-6 mr-3 space-y-6">
              {history.map((record) => {
                const isCurrent = record.id.toString().startsWith('current-');
                const paused = isPaused(record);
                
                // Pricing calculations
                const priceBefore = record.total_before_discount || record.billboard_rent_price || 0;
                const discount = record.discount_amount || 0;
                const netRent = record.net_rental_amount || (priceBefore - discount);
                const install = record.installation_cost || 0;
                const print = record.print_cost || 0;
                const finalAmount = record.rent_amount || 0;
                
                // Paused metadata
                const refund = record.individual_billboard_data?.refundAmount || 0;
                const pauseDateStr = record.individual_billboard_data?.pauseDate || record.end_date;
                const elapsed = record.individual_billboard_data?.elapsedDays || 0;
                const totalD = record.individual_billboard_data?.totalDays || record.duration_days || 0;

                return (
                  <div key={record.id} className="relative group/timeline">
                    {/* Timeline Node Icon */}
                    <div className={`absolute top-6 -right-[35px] w-6 h-6 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${
                      isCurrent 
                        ? 'bg-emerald-500 border-emerald-100 dark:border-emerald-950 scale-125 shadow-glow-green' 
                        : paused 
                          ? 'bg-rose-500 border-rose-100 dark:border-rose-950 shadow-glow-red' 
                          : 'bg-muted-foreground/30 border-muted dark:border-muted/30 group-hover/timeline:bg-primary group-hover/timeline:border-primary/20'
                    }`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>

                    {/* Timeline Card */}
                    <div className={`rounded-2xl border transition-all duration-300 p-5 ${
                      isCurrent 
                        ? 'bg-gradient-to-br from-emerald-500/5 via-emerald-500/[0.01] to-card border-emerald-500/30 dark:border-emerald-500/20 shadow-sm shadow-emerald-500/5' 
                        : paused 
                          ? 'bg-gradient-to-br from-rose-500/5 via-rose-500/[0.01] to-card border-rose-500/30 dark:border-rose-500/20 shadow-sm shadow-rose-500/5' 
                          : 'bg-card border-border/80 hover:border-primary/30 hover:shadow-lg shadow-sm'
                    }`}>
                      {/* Row 1: Header */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-border/60">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl border ${
                            isCurrent 
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                              : paused 
                                ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' 
                                : 'bg-muted text-muted-foreground border-border/60'
                          }`}>
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-lg text-foreground tracking-tight">عقد رقم #{record.contract_number}</span>
                              {isCurrent && (
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] py-0 px-2 rounded-full font-bold">عقد نشط حالياً</Badge>
                              )}
                              {paused && (
                                <Badge className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] py-0 px-2 rounded-full font-bold">تم الإيقاف مبكراً</Badge>
                              )}
                              {record.task_type === 'reinstallation' ? (
                                <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] py-0 px-2 rounded-full font-bold gap-1 flex items-center">
                                  <RefreshCw className="h-2.5 w-2.5" />
                                  إعادة تركيب
                                </Badge>
                              ) : (
                                <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] py-0 px-2 rounded-full font-bold gap-1 flex items-center">
                                  <Hammer className="h-2.5 w-2.5" />
                                  تركيب أولي
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-0.5 font-semibold flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              {record.customer_name}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 self-end md:self-center">
                          <div className="text-left md:text-right">
                            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider block">القيمة النهائية للوحة</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-2xl font-black text-foreground">{finalAmount.toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground font-bold">د.ل</span>
                            </div>
                          </div>


                        </div>
                      </div>

                      {/* Row 2: Period & Duration Timeline */}
                      <div className="py-4 grid grid-cols-1 md:grid-cols-3 items-center gap-4 border-b border-dashed border-border/60">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4.5 w-4.5 text-muted-foreground" />
                          <div>
                            <span className="text-[10px] text-muted-foreground font-bold block">تاريخ بداية الإيجار</span>
                            <span className="text-sm font-extrabold text-foreground" dir="ltr">{formatGregorianDate(record.start_date)}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center px-4">
                          <div className="w-full flex items-center justify-between text-[10px] text-muted-foreground font-bold mb-1 px-1">
                            <span>البداية</span>
                            <span className="text-primary font-black bg-primary/10 rounded-full px-2 py-0.5">
                              {paused ? `${elapsed} من ${totalD} يوم` : `${record.duration_days} يوم`}
                            </span>
                            <span>النهاية</span>
                          </div>
                          <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`absolute top-0 right-0 h-full rounded-full ${paused ? 'bg-rose-500' : 'bg-primary'}`}
                              style={{ width: paused && totalD > 0 ? `${Math.min(100, (elapsed / totalD) * 100)}%` : '100%' }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 md:justify-end">
                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground font-bold block">تاريخ نهاية الإيجار {paused && '(الإيقاف)'}</span>
                            <span className="text-sm font-extrabold text-foreground" dir="ltr">{formatGregorianDate(paused ? pauseDateStr : record.end_date)}</span>
                          </div>
                          <Calendar className="h-4.5 w-4.5 text-muted-foreground" />
                        </div>
                      </div>

                      {/* Row 3: Financial Pricing Journey */}
                      <div className="py-5">
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider block mb-3">تفاصيل الحساب المالي للوحة</span>
                        
                        <div className="flex flex-wrap items-center gap-3">
                          {/* 1. Base Price */}
                          <div className="flex-1 min-w-[120px] p-3 bg-muted/30 border border-border/50 rounded-xl">
                            <span className="text-[10px] text-muted-foreground font-bold block">السعر الأساسي</span>
                            <span className="text-base font-black text-foreground">{priceBefore.toLocaleString()} د.ل</span>
                          </div>

                          {/* Minus Arrow */}
                          <div className="text-muted-foreground font-bold hidden sm:block">
                            <ArrowLeft className="h-4 w-4" />
                          </div>

                          {/* 2. Discount */}
                          <div className="flex-1 min-w-[120px] p-3 bg-orange-500/[0.03] border border-orange-500/10 rounded-xl">
                            <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold block">الخصم الممنوح</span>
                            <span className="text-base font-black text-orange-600 dark:text-orange-400">
                              {discount > 0 ? `-${discount.toLocaleString()} د.ل` : '0 د.ل'}
                              {discount > 0 && (
                                <span className="text-[10px] font-bold mr-1">({(record.discount_percentage || ((discount / (priceBefore || 1)) * 100)).toFixed(1)}%)</span>
                              )}
                            </span>
                          </div>

                          {/* Equal Arrow */}
                          <div className="text-muted-foreground font-bold hidden sm:block">
                            <ArrowLeft className="h-4 w-4" />
                          </div>

                          {/* 3. Net Rent */}
                          <div className="flex-1 min-w-[120px] p-3 bg-blue-500/[0.03] border border-blue-500/10 rounded-xl">
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold block">صافي الإيجار للوحة</span>
                            <span className="text-base font-black text-blue-600 dark:text-blue-400">{netRent.toLocaleString()} د.ل</span>
                          </div>

                          {/* Plus Arrow */}
                          <div className="text-muted-foreground font-bold hidden sm:block">
                            <ArrowLeft className="h-4 w-4" />
                          </div>

                          {/* 4. Installation & Printing */}
                          <div className="flex-1 min-w-[160px] p-3 bg-purple-500/[0.03] border border-purple-500/10 rounded-xl">
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block flex items-center gap-1">
                              تكاليف إضافية
                              {(record.include_installation_in_price || record.include_print_in_price) && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 border-purple-300 text-purple-600">
                                  {record.include_installation_in_price && record.include_print_in_price ? 'مشمولة بالكامل' : 'مشمول جزئياً'}
                                </Badge>
                              )}
                            </span>
                            <span className="text-sm font-black text-purple-600 dark:text-purple-400 block">
                              تركيب: {install > 0 ? `${install.toLocaleString()} د.ل ${record.include_installation_in_price ? '(مشمول)' : ''}` : record.include_installation_in_price ? '0 (مشمول)' : '0 د.ل'}
                            </span>
                            <span className="text-sm font-black text-purple-600 dark:text-purple-400 block mt-0.5">
                              طباعة: {print > 0 ? `${print.toLocaleString()} د.ل ${record.include_print_in_price ? '(مشمول)' : ''}` : record.include_print_in_price ? '0 (مشمول)' : '0 د.ل'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Row 4: Design and Installation Photos */}
                      {(record.design_face_a_url || record.design_face_b_url || record.installed_image_face_a_url || record.installed_image_face_b_url) && (
                        <div className="py-4 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Designs */}
                          {(record.design_face_a_url || record.design_face_b_url) && (
                            <div className="p-3 bg-muted/20 border border-border/40 rounded-xl">
                              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider block mb-2 flex items-center gap-1">
                                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                                صور التصميم الإعلاني المعتمد
                              </span>
                              <div className="flex gap-2.5">
                                {record.design_face_a_url && (
                                  <div className="relative group/img overflow-hidden rounded-lg border border-border bg-card">
                                    <img
                                      src={record.design_face_a_url}
                                      alt="وجه أ"
                                      className="w-20 h-20 object-cover cursor-pointer transition-transform duration-300 group-hover/img:scale-110"
                                      onClick={() => setSelectedImage(record.design_face_a_url)}
                                    />
                                    <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[8px] px-1.5 py-0.5 rounded font-black">وجه A</span>
                                  </div>
                                )}
                                {record.design_face_b_url && (
                                  <div className="relative group/img overflow-hidden rounded-lg border border-border bg-card">
                                    <img
                                      src={record.design_face_b_url}
                                      alt="وجه ب"
                                      className="w-20 h-20 object-cover cursor-pointer transition-transform duration-300 group-hover/img:scale-110"
                                      onClick={() => setSelectedImage(record.design_face_b_url)}
                                    />
                                    <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[8px] px-1.5 py-0.5 rounded font-black">وجه B</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Installation Photos */}
                          {(record.installed_image_face_a_url || record.installed_image_face_b_url) && (
                            <div className="p-3 bg-green-500/[0.02] border border-green-500/10 rounded-xl">
                              <span className="text-[10px] text-green-600 dark:text-green-400 font-black uppercase tracking-wider block mb-2 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                صور إثبات التركيب الميداني
                              </span>
                              <div className="flex gap-2.5">
                                {record.installed_image_face_a_url && (
                                  <div className="relative group/img overflow-hidden rounded-lg border border-border bg-card">
                                    <img
                                      src={record.installed_image_face_a_url}
                                      alt="تركيب أ"
                                      className="w-20 h-20 object-cover cursor-pointer transition-transform duration-300 group-hover/img:scale-110"
                                      onClick={() => setSelectedImage(record.installed_image_face_a_url)}
                                    />
                                    <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[8px] px-1.5 py-0.5 rounded font-black">وجه A</span>
                                  </div>
                                )}
                                {record.installed_image_face_b_url && (
                                  <div className="relative group/img overflow-hidden rounded-lg border border-border bg-card">
                                    <img
                                      src={record.installed_image_face_b_url}
                                      alt="تركيب ب"
                                      className="w-20 h-20 object-cover cursor-pointer transition-transform duration-300 group-hover/img:scale-110"
                                      onClick={() => setSelectedImage(record.installed_image_face_b_url)}
                                    />
                                    <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[8px] px-1.5 py-0.5 rounded font-black">وجه B</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Row 5: Paused warning detail or standard notes */}
                      {paused ? (
                        <div className="mt-4 p-4 bg-rose-500/[0.04] border border-rose-500/15 rounded-xl flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5 animate-pulse" />
                          <div className="text-sm">
                            <span className="font-extrabold text-rose-700 dark:text-rose-400 block mb-1">تفاصيل إيقاف اللوحة الاستثنائي</span>
                            <div className="text-muted-foreground leading-relaxed">
                              تم إيقاف تأجير هذه اللوحة بعد انقضاء <span className="font-bold text-foreground">{elapsed} يوم</span> فقط من العقد.
                              <span className="block mt-1">
 القيمة المالية المستردة/المخصومة للعقد: <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{refund.toLocaleString()} دينار ليبي</span>.
                              </span>
                              {record.notes && (
                                <span className="block mt-1 border-t border-rose-500/10 pt-1 text-xs font-semibold text-foreground">
                                  سبب الإيقاف: {record.notes.replace(/^إيقاف مبكر — /, '').replace(/^إيقاف: /, '')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        record.notes && record.notes !== 'عقد حالي نشط' && (
                          <div className="mt-4 p-3 bg-muted/40 border border-border/40 rounded-xl">
                            <span className="text-[10px] text-muted-foreground font-black block mb-1">الملاحظات المسجلة</span>
                            <p className="text-sm text-foreground leading-relaxed">{record.notes}</p>
                          </div>
                        )
                      )}

                      {/* Pricing category & team footer info */}
                      {(record.pricing_category || record.team_name) && (
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground pt-3 border-t border-border/40">
                          {record.pricing_category && (
                            <Badge variant="outline" className="text-[10px] gap-1 px-2.5 py-0.5 rounded-full border-border/80 bg-muted/10 font-bold">
                              <Palette className="h-3 w-3 text-muted-foreground" />
                              فئة التسعير: {record.pricing_category}
                            </Badge>
                          )}
                          {record.team_name && (
                            <Badge variant="outline" className="text-[10px] gap-1 px-2.5 py-0.5 rounded-full border-border/80 bg-muted/10 font-bold">
                              <User className="h-3 w-3 text-muted-foreground" />
                              فريق التركيب: {record.team_name}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer with close button */}
        <div className="flex justify-end p-5 border-t border-border/80 bg-muted/20">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="px-6 rounded-xl font-bold border-border/80 hover:bg-muted text-foreground"
          >
            إغلاق النافذة
          </Button>
        </div>
      </DialogContent>

      {/* نافذة طباعة التقرير المتقدمة */}
      <BillboardHistoryPrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        billboardId={billboardId}
        billboardName={billboardName}
        history={history}
        totalRentals={totalRentals}
        totalRevenue={totalRevenue}
        totalDays={totalDays}
      />



      {/* نافذة عرض الصورة */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>عرض الصورة</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center">
              <img
                src={selectedImage}
                alt="صورة مكبرة"
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};