import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { History, Calendar, Wallet, Clock, Printer, Search, ChevronDown, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { formatGregorianDate } from '@/lib/utils';
import { BillboardHistoryPrintDialog } from './BillboardHistoryPrintDialog';
import { HistoryRecord, historyStatus, historyTotals, statusLabels } from './historyModel';

interface BillboardHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboardId: number;
  billboardName: string;
}

const money = (value?: number) => (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const date = (value?: string) => value ? formatGregorianDate(value) : 'غير محدد';
const interactive = 'cursor-pointer transition-all duration-200';
const statusColors = {
  current: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  upcoming: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  paused: 'bg-red-500/10 text-red-700 dark:text-red-400',
  completed: 'bg-muted text-muted-foreground',
};

export const BillboardHistoryDialog: React.FC<BillboardHistoryDialogProps> = ({ open, onOpenChange, billboardId, billboardName }) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const requestRef = useRef(0);

  const invalidateRequest = useCallback(() => { requestRef.current++; }, []);
  const loadHistory = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      // جلب السجلات التاريخية
      const { data: historyData, error: historyError } = await supabase
        .from('billboard_history')
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
        today.setHours(0, 0, 0, 0);
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
          let individualBillboardData: (NonNullable<HistoryRecord['individual_billboard_data']> & {
            billboardId?: number | string; priceBeforeDiscount?: number; contractPrice?: number;
            discountPerBillboard?: number; printCost?: number; installationCost?: number;
            pricingCategory?: string; pricingMode?: string;
          }) | null = null;
          
          if (contractData?.billboard_prices) {
            try {
              const prices = typeof contractData.billboard_prices === 'string' 
                ? JSON.parse(contractData.billboard_prices) 
                : contractData.billboard_prices;
              
              const billboardPriceData = Array.isArray(prices) 
                ? (prices as NonNullable<typeof individualBillboardData>[]).find(p => p && p.billboardId?.toString() === billboardId.toString())
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
                const design = designs[0] as { face_a_url?: string; faceAUrl?: string; face_b_url?: string; faceBUrl?: string };
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

      if (request !== requestRef.current) return;
      setHistory(allRecords);
    } catch (error: unknown) {
      console.error('Error loading history:', error);
      if (request === requestRef.current) { setLoadError(true); setHistory([]); toast.error('فشل تحميل السجل التاريخي'); }
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [billboardId]);

  useEffect(() => {
    if (open && billboardId) {
      setHistory([]); setQuery(''); setFilter('all'); setPrintDialogOpen(false); setSelectedImage(null);
      void loadHistory();
    }
    return invalidateRequest;
  }, [open, billboardId, loadHistory, invalidateRequest]);

  const totals = historyTotals(history);
  const filtered = history.filter(r => (filter === 'all' || historyStatus(r) === filter) &&
    [r.contract_number, r.customer_name, r.ad_type, r.notes, r.team_name].some(v => String(v ?? '').toLowerCase().includes(query.trim().toLowerCase())));
  const visibleTotals = historyTotals(filtered);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent dir="rtl" className="max-w-6xl h-[90dvh] p-0 flex flex-col gap-0 bg-background overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-border p-4 sm:p-6 pl-12 sm:pl-14 bg-primary/5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-xl bg-primary/10 p-3 text-primary"><History className="h-6 w-6" /></div>
                <div><DialogTitle className="text-xl sm:text-2xl font-bold">تاريخ اللوحة</DialogTitle>
                  <DialogDescription className="mt-1 break-words">{billboardName} · لوحة رقم {billboardId}</DialogDescription></div>
              </div>
              <Button className={`${interactive} gap-2 min-h-10`} disabled={loading || !filtered.length} onClick={() => setPrintDialogOpen(true)}>
                <Printer className="h-4 w-4" />معاينة وطباعة
              </Button>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 sm:px-6 shrink-0 border-b">
            {[
              { label: 'سجلات الحركة', value: totals.count, unit: 'سجل', Icon: History },
              { label: 'إجمالي قيمة السجلات', value: money(totals.revenue), unit: 'د.ل', Icon: Wallet },
              { label: 'مجموع مدد السجلات', value: totals.days, unit: 'يوم', Icon: Calendar },
              { label: 'السجلات الحالية', value: history.filter(r => historyStatus(r) === 'current').length, unit: 'سجل', Icon: Clock },
            ].map(({ label, value, unit, Icon }) => <div key={label} className="rounded-xl border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 text-primary shrink-0" />{label}</div>
              <div className="mt-2 font-bold text-lg sm:text-2xl break-words">{loading ? '—' : value} <span className="text-xs font-normal text-muted-foreground">{unit}</span></div>
            </div>)}
          </div>
          <div className="shrink-0 p-4 sm:px-6 border-b space-y-3">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input aria-label="البحث في تاريخ اللوحة" placeholder="ابحث بالعقد، الزبون، الإعلان أو الفريق…" value={query} onChange={e => setQuery(e.target.value)} className="pr-10 h-10" /></div>
              <Button variant="outline" size="icon" aria-label="تحديث السجل" disabled={loading} onClick={() => void loadHistory()} className={interactive}><RefreshCw className={`h-4 w-4 ${loading ? 'motion-safe:animate-spin' : ''}`} /></Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[['all', 'الكل'], ...Object.entries(statusLabels)].map(([key, label]) => <Button key={key} size="sm" variant={filter === key ? 'default' : 'outline'} aria-pressed={filter === key} onClick={() => setFilter(key)} className={`${interactive} min-h-10 rounded-full`}>{label}</Button>)}
              <span className="text-xs text-muted-foreground sm:mr-auto">{filtered.length} من {history.length} سجل</span>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3">
            {loading ? <div role="status" className="py-16 text-center text-muted-foreground"><RefreshCw className="mx-auto mb-3 h-7 w-7 text-primary motion-safe:animate-spin" />جاري تحميل تاريخ اللوحة…</div> : loadError ?
              <div role="alert" className="text-center py-16 space-y-4"><p>تعذر تحميل السجل. حاول مرة أخرى.</p><Button className={interactive} onClick={() => void loadHistory()}>إعادة المحاولة</Button></div> : !filtered.length ?
              <div className="rounded-xl border border-dashed text-center py-16"><History className="mx-auto h-10 w-10 text-muted-foreground mb-3" /><p className="font-bold">{history.length ? 'لا توجد نتائج مطابقة' : 'لا توجد سجلات لهذه اللوحة'}</p><p className="text-sm text-muted-foreground mt-2">{history.length ? 'غيّر البحث أو اختر حالة أخرى.' : 'ستظهر العقود وحركات التركيب هنا عند تسجيلها.'}</p></div> :
              filtered.map(record => {
                const status = historyStatus(record);
                const images = [
                  ['تصميم الوجه أ', record.design_face_a_url], ['تصميم الوجه ب', record.design_face_b_url],
                  ['تركيب الوجه أ', record.installed_image_face_a_url], ['تركيب الوجه ب', record.installed_image_face_b_url],
                ].filter(([, url]) => !!url);
                return <details key={record.id} className="group rounded-xl border bg-card open:border-primary/40">
                  <summary className={`${interactive} list-none p-4 hover:bg-muted/40 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-bold">عقد #{record.contract_number}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[status]}`}>{statusLabels[status]}</span>{record.task_type === 'reinstallation' && <span className="text-xs text-muted-foreground">إعادة تركيب</span>}</div>
                        <p className="mt-2 font-medium break-words">{record.customer_name || 'زبون غير مسجل'} <span className="text-sm text-muted-foreground">{record.ad_type ? `· ${record.ad_type}` : ''}</span></p>
                      </div><ChevronDown className="h-4 w-4 shrink-0 mt-1 text-muted-foreground group-open:rotate-180 transition-transform motion-reduce:transition-none" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"><span className="text-muted-foreground"><span dir="ltr">{date(record.start_date)}</span> — <span dir="ltr">{date(record.end_date)}</span></span><span>{record.duration_days || 0} يوم</span><span className="font-bold sm:mr-auto">{money(record.rent_amount)} د.ل</span></div>
                  </summary>
                  <div className="border-t p-4 space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      {[
                        ['قبل الخصم', money(record.total_before_discount ?? record.billboard_rent_price)], ['الخصم', money(record.discount_amount)],
                        ['صافي الإيجار', money(record.net_rental_amount ?? ((record.total_before_discount ?? record.billboard_rent_price ?? 0) - (record.discount_amount ?? 0)))],
                        ['التركيب', `${money(record.installation_cost)}${record.include_installation_in_price ? ' · مشمول' : ''}`],
                        ['الطباعة', `${money(record.print_cost)}${record.include_print_in_price ? ' · مشمولة' : ''}`],
                      ].map(([label, value]) => <div key={label} className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground mb-1">{label}</p><p className="font-semibold">{value} د.ل</p></div>)}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground"><span>التركيب: {date(record.installation_date)}</span>{record.team_name && <span>الفريق: {record.team_name}</span>}{record.pricing_category && <span>فئة التسعير: {record.pricing_category}</span>}</div>
                    {record.notes && <p className="text-sm rounded-lg border p-3 leading-7 whitespace-pre-wrap break-words">{record.notes}</p>}
                    {status === 'paused' && record.individual_billboard_data && <div className="text-sm rounded-lg bg-red-500/5 border border-red-500/20 p-3 leading-7">تاريخ الإيقاف: {date(record.individual_billboard_data.pauseDate || record.end_date)} · القيمة المستردة: {money(record.individual_billboard_data.refundAmount)} د.ل{record.individual_billboard_data.elapsedDays != null && <p>الأيام المنقضية: {record.individual_billboard_data.elapsedDays} من {record.individual_billboard_data.totalDays ?? record.duration_days} يوم</p>}</div>}
                    {images.length > 0 ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{images.map(([label, url]) => <button key={label} type="button" onClick={() => setSelectedImage(url!)} className={`${interactive} rounded-lg border overflow-hidden text-right hover:border-primary focus-visible:ring-2 focus-visible:ring-ring`}><img src={url} alt={label} loading="lazy" className="h-28 w-full object-contain bg-muted/30" /><span className="flex items-center gap-2 p-2 text-xs"><ImageIcon className="h-3 w-3 text-primary" />{label}</span></button>)}</div> : <p className="text-xs text-muted-foreground">لا توجد صور مسجلة لهذه الحركة.</p>}
                  </div>
                </details>;
              })}
          </div>
          <div className="shrink-0 border-t p-3 sm:px-6 flex flex-wrap justify-between items-center gap-2 bg-muted/20"><p className="text-xs text-muted-foreground">الطباعة تشمل النتائج الظاهرة حسب البحث والتصفية.</p><Button variant="outline" className={interactive} onClick={() => onOpenChange(false)}>إغلاق</Button></div>
        </DialogContent>
      </Dialog>
      <BillboardHistoryPrintDialog open={printDialogOpen && open} onOpenChange={setPrintDialogOpen} billboardId={billboardId} billboardName={billboardName} history={filtered} totalRentals={visibleTotals.count} totalRevenue={visibleTotals.revenue} totalDays={visibleTotals.days} />
      <Dialog open={!!selectedImage && open} onOpenChange={value => { if (!value) setSelectedImage(null); }}><DialogContent dir="rtl" className="max-w-4xl"><DialogHeader><DialogTitle>صور اللوحة</DialogTitle><DialogDescription>{billboardName}</DialogDescription></DialogHeader>{selectedImage && <img src={selectedImage} alt="صورة اللوحة مكبرة" className="max-h-[70dvh] w-full object-contain" />}</DialogContent></Dialog>
    </>
  );
};
