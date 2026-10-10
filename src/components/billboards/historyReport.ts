import { formatGregorianDate } from '@/lib/utils';
import { generateCustomerHTML, wrapInDocument, type ResolvedPrintStyles } from '@/lib/unifiedInvoiceBase';
import { escapeHistoryHTML as escape, historyImageURL, historyStatus, historyTotals, statusLabels, type HistoryRecord } from './historyModel';

export interface HistoryReportOptions {
  landscape: boolean; financial: boolean; costs: boolean; team: boolean;
  notes: boolean; installationImages: boolean; designImages: boolean;
}
const amount = (value?: number) => (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const date = (value?: string) => value ? escape(formatGregorianDate(value)) : 'غير محدد';

export function buildHistoryReport(styles: ResolvedPrintStyles, name: string, id: number, records: HistoryRecord[], options: HistoryReportOptions) {
  const totals = historyTotals(records);
  const columns = ['#', 'العقد / الحالة', 'الزبون / الإعلان', 'الفترة', 'المدة',
    ...(options.financial && options.costs ? ['الخصم', 'التركيب', 'الطباعة'] : []),
    ...(options.financial ? ['القيمة (د.ل)'] : []), ...(options.team ? ['الفريق'] : [])];
  const rows = records.map((r, index) => `<tr><td class="num">${index + 1}</td>
    <td><strong class="num">${escape(r.contract_number)}</strong><small>${statusLabels[historyStatus(r)]}${r.task_type === 'reinstallation' ? ' · إعادة تركيب' : ''}</small></td>
    <td><strong>${escape(r.customer_name || 'غير مسجل')}</strong><small>${escape(r.ad_type)}</small></td>
    <td><span dir="ltr">${date(r.start_date)}</span><small>إلى</small><span dir="ltr">${date(r.end_date)}</span></td>
    <td class="num">${Number(r.duration_days) || 0} يوم</td>
    ${options.financial && options.costs ? `<td class="num">${amount(r.discount_amount)}</td><td class="num">${amount(r.installation_cost)}${r.include_installation_in_price ? '<small>مشمول</small>' : ''}</td><td class="num">${amount(r.print_cost)}${r.include_print_in_price ? '<small>مشمولة</small>' : ''}</td>` : ''}
    ${options.financial ? `<td class="num"><strong>${amount(r.rent_amount)}</strong></td>` : ''}
    ${options.team ? `<td>${escape(r.team_name || '—')}</td>` : ''}</tr>`).join('');
  const attachments = records.map(r => {
    const images = [
      ...(options.designImages ? [['تصميم الوجه أ', r.design_face_a_url], ['تصميم الوجه ب', r.design_face_b_url]] : []),
      ...(options.installationImages ? [['تركيب الوجه أ', r.installed_image_face_a_url], ['تركيب الوجه ب', r.installed_image_face_b_url]] : []),
    ].map(([label, url]) => ({ label, url: historyImageURL(url) })).filter(image => image.url);
    const note = options.notes && r.notes ? `<p class="history-note">${escape(r.notes)}</p>` : '';
    if (!images.length && !note) return '';
    return `<section class="history-attachment"><h3>عقد #${escape(r.contract_number)} · ${escape(r.customer_name || 'غير مسجل')}</h3>${note}${images.length ? `<div class="history-images">${images.map(image => `<figure><img src="${image.url}" alt="${image.label}" /><figcaption>${image.label}</figcaption></figure>`).join('')}</div>` : ''}</section>`;
  }).join('');
  const stats = `<div class="stat-card"><div class="stat-value">${totals.count}</div><div class="stat-label">سجل حركة</div></div><div class="stat-card"><div class="stat-value">${totals.days}</div><div class="stat-label">مجموع مدد السجلات / يوم</div></div>${options.financial ? `<div class="stat-card"><div class="stat-value">${amount(totals.revenue)}</div><div class="stat-label">إجمالي قيمة السجلات / د.ل</div></div>` : ''}`;
  return wrapInDocument(styles, {
    title: escape(`تاريخ اللوحة - ${name}`),
    headerMetaHtml: `تاريخ التقرير: <span dir="ltr">${escape(formatGregorianDate(new Date()))}</span><br/>اللوحة رقم <span class="num">${id}</span>`,
    customerHtml: generateCustomerHTML(styles, { label: 'سجل حركة وتأجير اللوحة', name: escape(name), statsCards: stats }),
    bodyContent: `<div class="history-section-title">سجل العقود والحركات <span>${totals.count} سجل</span></div>
      <table class="items-table history-table"><thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${columns.length}">لا توجد سجلات</td></tr>`}</tbody></table>
      ${options.financial ? `<div class="history-total">إجمالي قيمة السجلات <strong class="num">${amount(totals.revenue)} د.ل</strong></div>` : ''}
      <p class="history-caption">المدد والقيم تخص السجلات المعروضة.${options.financial ? ' تكاليف الخدمات المشمولة لا تُضاف مرة أخرى إلى القيمة.' : ''}</p>
      ${attachments ? `<div class="history-section-title">تفاصيل وصور السجلات</div>${attachments}` : ''}`,
    showSignature: false, autoPrint: false,
    extraCSS: `
      .paper { width:${options.landscape ? '277' : '190'}mm; min-height:${options.landscape ? '190' : '277'}mm; padding:10mm; box-sizing:border-box; overflow:visible; }
      .paper .content, .paper .main-content { overflow:visible; }
      .history-section-title { display:flex; justify-content:space-between; border-bottom:2px solid ${styles.primaryColor}; padding:8px 0; margin:14px 0 10px; font-weight:700; font-size:14px; }
      .history-section-title span { font-weight:400; font-size:11px; }
      .history-table { table-layout:fixed; font-size:${options.landscape ? '11' : '10'}px; }
      .history-table th, .history-table td { padding:9px 5px; overflow-wrap:anywhere; vertical-align:middle; }
      .history-table th:first-child { width:5%; }
      .history-table small { display:block; font-size:9px; margin-top:4px; font-weight:400; }
      .history-total { display:flex; justify-content:space-between; padding:12px; background:#faf6e9; border:1px solid #dccb98; color:#292519; break-inside:avoid; }
      .history-caption { font-size:10px; color:#555; margin:10px 0 18px; line-height:1.7; }
      .history-attachment { border:1px solid #ddd; border-radius:8px; padding:12px; margin:12px 0; break-inside:avoid; }
      .history-attachment h3 { font-size:12px; margin:0 0 8px; }
      .history-note { font-size:11px; white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.7; }
      .history-images { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .history-images figure { margin:0; text-align:center; }
      .history-images img { width:100%; height:${options.landscape ? '42' : '50'}mm; object-fit:contain; }
      .history-images figcaption { font-size:10px; padding:4px; }
      @media print {
        @page { size:A4 ${options.landscape ? 'landscape' : 'portrait'}; margin:10mm; }
        html, body { width:auto!important; margin:0!important; padding:0!important; }
        .paper { width:100%!important; min-height:0!important; padding:0!important; margin:0!important; box-shadow:none!important; overflow:visible!important; }
        .history-table { overflow:visible!important; border-radius:0!important; }
        .history-table thead { display:table-header-group; }
        .history-table tr { break-inside:avoid; }
        .history-section-title { break-after:avoid; }
        .history-attachment { break-inside:auto; }
        .history-images figure { break-inside:avoid; }
      }
    `,
  });
}
