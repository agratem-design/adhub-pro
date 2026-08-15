import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

interface ExportContractReviewOptions {
  contract: any; // contract object returned by getContractWithBillboards
}

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseBillboardPrices(raw: any): any[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findPriceEntry(prices: any[], billboardId: any) {
  const idStr = String(billboardId);
  return prices.find(
    (p: any) =>
      String(p.billboardId ?? p.billboard_id ?? p.ID ?? p.id ?? '') === idStr,
  );
}

export async function exportContractReviewExcel({ contract }: ExportContractReviewOptions) {
  const contractNumber = contract.Contract_Number ?? contract['Contract Number'] ?? contract.id;
  const customerName = contract.customer_name || contract['Customer Name'] || '';
  const billboards: any[] = contract.billboards || [];
  const billboardPrices = parseBillboardPrices(contract.billboard_prices);

  // Contract-level flags
  const installationEnabled =
    contract.installation_enabled !== false &&
    contract.installation_enabled !== 0 &&
    contract.installation_enabled !== 'false';
  const printEnabled = !!(contract.print_cost_enabled || contract.printing_enabled);
  const includePrintInPrice = !!(contract.include_print_in_price ?? contract.print_included_in_price);
  const includeInstallInPrice = !!(contract.include_installation_in_price ?? contract.installation_included_in_price);
  const totalDiscount = num(contract.Discount ?? contract.discount);

  // ===== Sheet 1: Active billboards =====
  const activeHeaders = [
    'اسم اللوحة', 'المقاس', 'البلدية', 'أقرب نقطة دالة', 'عدد الأوجه', 'نوع الإعلان',
    'السعر قبل الخصم', 'قيمة الخصم', 'السعر بعد الخصم',
    'سعر التركيب', 'سعر الطباعة',
    'تركيب مضمّن؟', 'طباعة مضمّنة؟',
    'الإجمالي النهائي للوحة', 'ملاحظات',
  ];

  let totalBefore = 0;
  let totalDiscountSum = 0;
  let totalAfter = 0;
  let totalInstall = 0;
  let totalPrint = 0;
  let totalFinal = 0;

  const activeRows = billboards.map((b: any) => {
    const bid = b.ID ?? b.id;
    const entry = findPriceEntry(billboardPrices, bid) || {};
    const isReplacement = !!entry.isReplacement || !!entry.is_replacement;

    const baseBefore = num(entry.baseRentalPrice ?? entry.base_rental_price ?? entry.priceBeforeDiscount ?? b.Price ?? b.price);
    const discount = num(entry.discountPerBillboard ?? entry.discount);
    const afterDiscount = num(entry.netRentalAfterDiscount ?? entry.net_after_discount ?? Math.max(0, baseBefore - discount));
    const install = installationEnabled ? num(entry.installationPrice ?? entry.installation_price ?? b.installation_price) : 0;
    const print = printEnabled ? num(entry.printCost ?? entry.print_cost ?? b.print_cost) : 0;
    const finalTotal = num(entry.totalForBoard ?? entry.total_for_board ?? (
      afterDiscount + (printEnabled && !includePrintInPrice ? print : 0) + (installationEnabled && !includeInstallInPrice ? install : 0)
    ));

    totalBefore += baseBefore;
    totalDiscountSum += discount;
    totalAfter += afterDiscount;
    totalInstall += install;
    totalPrint += print;
    totalFinal += finalTotal;

    return [
      b.Billboard_Name || b.name || bid || '',
      b.Size || b.size || '',
      b.Municipality || b.municipality || '',
      b.Nearest_Landmark || b.nearest_landmark || '',
      b.Faces_Count || b.faces_count || b.Faces || '',
      b.Ad_Type || b.ad_type || contract['Ad Type'] || '',
      baseBefore,
      discount,
      afterDiscount,
      install,
      print,
      installationEnabled ? (includeInstallInPrice ? 'نعم' : 'لا') : '—',
      printEnabled ? (includePrintInPrice ? 'نعم' : 'لا') : '—',
      finalTotal,
      isReplacement ? 'لوحة بديلة' : '',
    ];
  });

  // Totals row
  activeRows.push([
    'الإجمالي', '', '', '', '', '',
    totalBefore, totalDiscountSum, totalAfter, totalInstall, totalPrint, '', '', totalFinal, '',
  ]);

  const wsActive = XLSX.utils.aoa_to_sheet([activeHeaders, ...activeRows]);
  wsActive['!cols'] = [
    { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 14 },
    { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 14 },
  ];

  // ===== Sheet 2: Paused billboards =====
  const pausedHeaders = [
    'اسم اللوحة', 'تاريخ الإيقاف',
    'السعر الكامل قبل الإيقاف', 'السعر الصافي بعد خصم العقد',
    'المبلغ المستهلك', 'مبلغ الاسترداد', 'استرداد يدوي', 'ملاحظات',
  ];
  let pausedRows: any[][] = [];
  let totalPausedRefund = 0;
  let totalPausedConsumed = 0;
  try {
    const { data: paused } = await supabase
      .from('paused_billboards' as any)
      .select('*')
      .eq('contract_number', Number(contractNumber))
      .order('pause_date', { ascending: false });
    pausedRows = (paused || []).map((p: any) => {
      const consumed = num(p.consumed_amount);
      const refund = p.manual_refund != null ? num(p.manual_refund) : num(p.refund_amount);
      totalPausedConsumed += consumed;
      totalPausedRefund += refund;
      return [
        p.billboard_name || p.billboard_id,
        p.pause_date || '',
        num(p.full_price ?? p.price_before_discount ?? p.original_price),
        num(p.net_after_discount ?? p.net_rent),
        consumed,
        num(p.refund_amount),
        p.manual_refund != null ? num(p.manual_refund) : '',
        p.notes || '',
      ];
    });
    if (pausedRows.length > 0) {
      pausedRows.push(['الإجمالي', '', '', '', totalPausedConsumed, totalPausedRefund, '', '']);
    }
  } catch (err) {
    console.warn('[exportContractReviewExcel] failed to load paused billboards:', err);
  }
  const wsPaused = XLSX.utils.aoa_to_sheet([
    pausedHeaders,
    ...(pausedRows.length > 0 ? pausedRows : [['لا توجد لوحات موقوفة', '', '', '', '', '', '', '']]),
  ]);
  wsPaused['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 28 },
  ];

  // ===== Sheet 3: Replacements =====
  const replHeaders = [
    'اللوحة الموقوفة الأصلية', 'اللوحة البديلة',
    'المبلغ المخصص للبديلة', 'تاريخ الاستبدال', 'ملاحظات',
  ];
  let replRows: any[][] = [];
  try {
    const { data: repl } = await supabase
      .from('paused_billboard_replacements' as any)
      .select('*, paused_billboards!inner(billboard_name, billboard_id)')
      .eq('contract_number', Number(contractNumber))
      .order('created_at', { ascending: false });
    replRows = (repl || []).map((r: any) => [
      r.paused_billboards?.billboard_name || r.paused_billboards?.billboard_id || '',
      r.replacement_billboard_id || '',
      num(r.allocated_amount),
      r.created_at ? new Date(r.created_at).toLocaleDateString('ar-LY') : '',
      r.notes || '',
    ]);
  } catch (err) {
    console.warn('[exportContractReviewExcel] failed to load replacements:', err);
  }
  const wsRepl = XLSX.utils.aoa_to_sheet([
    replHeaders,
    ...(replRows.length > 0 ? replRows : [['لا توجد لوحات بديلة', '', '', '', '']]),
  ]);
  wsRepl['!cols'] = [
    { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 28 },
  ];

  // ===== Sheet 4: Summary =====
  const contractTotal = num(contract.total_cost ?? contract['Total']);
  const rentCost = num(contract.rent_cost ?? contract['Total Rent']);
  const installCost = num(contract.installation_cost ?? contract['Installation Cost']);
  const printCost = num(contract.print_cost ?? contract['Print Cost']);
  const paidAmount = num(contract['Total Paid'] ?? contract.total_paid ?? contract.paid_amount);
  const remainingAmount = num(contract['Remaining'] ?? contract.remaining ?? Math.max(0, contractTotal - paidAmount));

  const summaryRows: any[][] = [
    ['البند', 'القيمة'],
    ['رقم العقد', contractNumber],
    ['اسم الزبون', customerName],
    ['نوع الإعلان', contract['Ad Type'] || contract.ad_type || ''],
    ['تاريخ البداية', contract.start_date || ''],
    ['تاريخ النهاية', contract.end_date || ''],
    [],
    ['إجمالي السعر قبل الخصم (مجموع اللوحات)', totalBefore],
    ['إجمالي الخصم الموزع على اللوحات', totalDiscountSum],
    ['إجمالي السعر بعد الخصم', totalAfter],
    ['الخصم الكلي للعقد (من الحقل)', totalDiscount],
    [],
    ['تكلفة الإيجار المحفوظة في العقد', rentCost],
    ['تكلفة التركيب الإجمالية', installCost],
    ['تكلفة الطباعة الإجمالية', printCost],
    ['إجمالي العقد النهائي (Total)', contractTotal],
    [],
    ['المدفوع', paidAmount],
    ['المتبقي', remainingAmount],
    [],
    ['التركيب مفعّل؟', installationEnabled ? 'نعم' : 'لا'],
    ['الطباعة مفعّلة؟', printEnabled ? 'نعم' : 'لا'],
    ['التركيب مضمّن في السعر؟', installationEnabled ? (includeInstallInPrice ? 'نعم' : 'لا') : '—'],
    ['الطباعة مضمّنة في السعر؟', printEnabled ? (includePrintInPrice ? 'نعم' : 'لا') : '—'],
    [],
    ['عدد اللوحات النشطة', billboards.length],
    ['عدد اللوحات الموقوفة', Math.max(0, pausedRows.length - (pausedRows.length > 0 ? 1 : 0))],
    ['عدد اللوحات البديلة', replRows.length],
    ['إجمالي استرداد الإيقاف', totalPausedRefund],
    ['إجمالي المستهلك من اللوحات الموقوفة', totalPausedConsumed],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 40 }, { wch: 24 }];

  // ===== Build workbook =====
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص العقد');
  XLSX.utils.book_append_sheet(wb, wsActive, 'اللوحات النشطة');
  XLSX.utils.book_append_sheet(wb, wsPaused, 'اللوحات الموقوفة');
  XLSX.utils.book_append_sheet(wb, wsRepl, 'اللوحات البديلة');

  const fileName = `مراجعة_العقد_${contractNumber}.xlsx`;
  XLSX.writeFile(wb, fileName);
}