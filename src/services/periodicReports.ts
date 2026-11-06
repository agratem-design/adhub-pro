import { supabase } from '@/integrations/supabase/client';

/** بادئة الرقم الإشاري للتقارير: تسلسل منفصل عن المراسلات (مثل FR1، FR2) */
export const reportPrefix = (companyPrefix?: string | null) => `${companyPrefix || ''}R`;

/** المسؤول الافتراضي عن التقارير الدورية */
export const REPORT_SIGNER = { name: 'عبدالمجيب قراطم', title: 'مسؤول التقارير' };

/* ───────────── الفترات ───────────── */

export type ReportPeriod = 'week' | '2weeks' | 'month' | '3months' | '6months' | 'year' | 'custom';

export const PERIODS: { id: ReportPeriod; label: string; title: string }[] = [
  { id: 'week', label: 'أسبوع', title: 'التقرير الأسبوعي' },
  { id: '2weeks', label: 'أسبوعان', title: 'تقرير الأسبوعين' },
  { id: 'month', label: 'شهر', title: 'التقرير الشهري' },
  { id: '3months', label: '3 أشهر', title: 'التقرير الربع سنوي' },
  { id: '6months', label: '6 أشهر', title: 'التقرير النصف سنوي' },
  { id: 'year', label: 'سنة', title: 'التقرير السنوي' },
  { id: 'custom', label: 'فترة مخصصة', title: 'تقرير الفترة' },
];

const DURING: Record<ReportPeriod, string> = {
  week: 'خلال هذا الأسبوع', '2weeks': 'خلال الأسبوعين الماضيين', month: 'خلال هذا الشهر',
  '3months': 'خلال الأشهر الثلاثة الماضية', '6months': 'خلال الأشهر الستة الماضية', year: 'خلال هذا العام', custom: 'خلال هذه الفترة',
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const addMonths = (s: string, n: number) => { const d = parse(s); d.setMonth(d.getMonth() + n); return iso(d); };
export const todayIso = () => iso(new Date());
export const dmy = (s: string) => s ? s.slice(0, 10).split('-').reverse().join('/') : '';

/** بداية الفترة لنهاية معطاة */
export function periodRange(period: ReportPeriod, end: string, customFrom?: string): { from: string; to: string } {
  switch (period) {
    case 'week': return { from: addDays(end, -6), to: end };
    case '2weeks': return { from: addDays(end, -13), to: end };
    case 'month': return { from: addDays(addMonths(end, -1), 1), to: end };
    case '3months': return { from: addDays(addMonths(end, -3), 1), to: end };
    case '6months': return { from: addDays(addMonths(end, -6), 1), to: end };
    case 'year': return { from: addDays(addMonths(end, -12), 1), to: end };
    default: return { from: customFrom || addDays(end, -6), to: end };
  }
}
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000) + 1;
/** الفترة السابقة المساوية في الطول (للمقارنة) */
export function previousRange(from: string, to: string) {
  const len = daysBetween(from, to);
  return { from: addDays(from, -len), to: addDays(from, -1) };
}

/* ───────────── البيانات ───────────── */

export interface ContractAdjustment { number: number; customer: string; adType: string; before: number; after: number; reportedFrom: string; reportedTo: string }

/* لقطة أرقام كل تقرير محفوظ: قيم العقود كما ذُكرت فيه، لمقارنة التقارير القادمة بها */
const SNAP_PREFIX = 'report_snapshot:';
type Snapshot = { to: string; contracts: Record<string, number> };

/** حفظ قيم العقود كما وردت في التقرير (العقود الجديدة + التعديلات المذكورة فيه) */
export async function saveReportSnapshot(letterId: string, data: ReportData) {
  const contracts: Record<string, number> = {};
  data.contracts.forEach(c => { contracts[c.number] = Math.round(c.total); });
  (data.adjustments || []).forEach(a => { contracts[a.number] = Math.round(a.after); });
  const value: Snapshot = { to: data.to, contracts };
  const { error } = await sb.from('system_settings').upsert([{ setting_key: SNAP_PREFIX + letterId, setting_value: JSON.stringify(value), setting_type: 'json', category: 'reports' }], { onConflict: 'setting_key' });
  if (error) console.warn('report snapshot:', error.message);
}

/** حذف لقطات أرقام تقارير حُذفت نهائياً */
export async function deleteReportSnapshots(letterIds: string[]) {
  for (let i = 0; i < letterIds.length; i += 100) {
    await sb.from('system_settings').delete().in('setting_key', letterIds.slice(i, i + 100).map(id => SNAP_PREFIX + id));
  }
}

/** قيم العقود من نص تقرير قديم بلا لقطة: «عقد رقم 1158 … بقيمة 5,000 د.ل» */
function parseReportContracts(body: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /عقد رقم (\d+)[^\n]*?بقيمة ([\d,]+(?:\.\d+)?) د\.ل/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(body || '')))) out[m[1]] = Number(m[2].replace(/,/g, ''));
  return out;
}

/** العقود التي تغيّرت قيمتها منذ آخر تقرير سابق ذكرها (قبل بداية الفترة) */
export async function loadContractAdjustments(from: string, reports: { id?: string; period_start?: string | null; period_end?: string | null; letter_date?: string; body: string; archived_at?: string | null }[]): Promise<ContractAdjustment[]> {
  const earlier = reports.filter(r => r.id && !r.archived_at && String(r.period_end || r.letter_date || '') < from)
    .sort((a, b) => String(a.period_end || a.letter_date).localeCompare(String(b.period_end || b.letter_date)));
  if (!earlier.length) return [];
  const snaps = new Map<string, Snapshot>();
  const rows = await all((a, b) => sb.from('system_settings').select('setting_key, setting_value').like('setting_key', `${SNAP_PREFIX}%`).range(a, b)).catch(() => [] as any[]);
  rows.forEach((r: any) => { try { snaps.set(String(r.setting_key).slice(SNAP_PREFIX.length), JSON.parse(r.setting_value)); } catch { /* ignore */ } });
  // آخر قيمة مذكورة لكل عقد (الأحدث يغلب)
  const last = new Map<number, { value: number; from: string; to: string }>();
  earlier.forEach(r => {
    const vals = snaps.get(r.id!)?.contracts || parseReportContracts(r.body);
    Object.entries(vals).forEach(([n, v]) => last.set(Number(n), { value: Number(v) || 0, from: String(r.period_start || ''), to: String(r.period_end || r.letter_date || '') }));
  });
  if (!last.size) return [];
  const current = await byIds('Contract', 'Contract_Number, "Customer Name", "Ad Type", Total, "Total Rent"', 'Contract_Number', [...last.keys()]);
  const out: ContractAdjustment[] = [];
  current.forEach((c: any) => {
    const n = Number(c.Contract_Number), prev = last.get(n);
    const now = Math.round(Number(c.Total) || Number(c['Total Rent']) || 0);
    if (prev && Math.abs(now - prev.value) >= 1) out.push({
      number: n, customer: c['Customer Name'] || '—', adType: String(c['Ad Type'] || '').replace(/\s+/g, ' ').trim(),
      before: prev.value, after: now, reportedFrom: prev.from, reportedTo: prev.to,
    });
  });
  return out.sort((a, b) => a.number - b.number);
}

export interface ReportData {
  from: string; to: string; prevFrom: string; prevTo: string;
  contracts: { number: number; customer: string; adType: string; start: string; end: string; total: number; boards: number }[];
  /** عقود وردت في تقارير سابقة وتغيّرت قيمتها بعدها (تُذكر في التقرير الجديد، والقديم يبقى كما هو) */
  adjustments?: ContractAdjustment[];
  prevContracts: { count: number; total: number };
  installs: { billboardId: number; name: string; size: string; city: string; date: string; reinstall: boolean; contract: number | null; customer: string }[];
  prevInstalls: number;
  removalsReferred: { billboardId: number; name: string; size: string; contract: number | null; customer: string; adType: string; done: boolean }[];
  /** اللوحات المنتظرة للإزالة (كل الفترات) حسب نوع الإعلان */
  removalsPendingByAd: { adType: string; n: number }[];
  removalsDone: number;
  removalsPendingAll: number;
  prevRemovals: number;
  payments: { amount: number; method: string; customer: string; company?: string; date: string; group: string }[];
  prevPayments: { total: number; count: number };
}

async function all<T = any>(build: (from: number, to: number) => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
async function byIds<T = any>(table: string, select: string, column: string, ids: any[]): Promise<T[]> {
  const uniq = [...new Set(ids.filter(v => v !== null && v !== undefined))];
  const out: T[] = [];
  for (let i = 0; i < uniq.length; i += 150) {
    const { data, error } = await (supabase.from(table as any) as any).select(select).in(column, uniq.slice(i, i + 150));
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
  }
  return out;
}
const sb = supabase as any;

export async function loadReportData(from: string, to: string): Promise<ReportData> {
  const prev = previousRange(from, to);
  const toTs = `${addDays(to, 1)}T00:00:00`;
  const fromTs = `${from}T00:00:00`;

  const [contracts, prevContracts, installItems, prevInstalls, removalRef, removalDone, prevRemovals, removalPendingAll, payments, prevPayments] = await Promise.all([
    all((a, b) => sb.from('Contract').select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", Total, "Total Rent", billboards_count, billboard_ids')
      .gte('Contract Date', from).lte('Contract Date', to).order('Contract Date').range(a, b)),
    all((a, b) => sb.from('Contract').select('Total, "Total Rent"').gte('Contract Date', prev.from).lte('Contract Date', prev.to).range(a, b)),
    all((a, b) => sb.from('installation_task_items').select('id, task_id, billboard_id, installation_date, status, reinstall_count')
      .eq('status', 'completed').gte('installation_date', from).lte('installation_date', to).range(a, b)),
    sb.from('installation_task_items').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('installation_date', prev.from).lte('installation_date', prev.to),
    all((a, b) => sb.from('removal_task_items').select('id, task_id, billboard_id, status, removal_date, created_at').gte('created_at', fromTs).lt('created_at', toTs).range(a, b)),
    sb.from('removal_task_items').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('removal_date', from).lte('removal_date', to),
    sb.from('removal_task_items').select('id', { count: 'exact', head: true }).gte('created_at', `${prev.from}T00:00:00`).lt('created_at', `${addDays(prev.to, 1)}T00:00:00`),
    // المنتظرة للإزالة كما كانت في نهاية الفترة (أُحيلت قبلها ولم تُزَل حتى نهايتها) — صحيح للتقارير القديمة أيضاً
    all((a, b) => sb.from('removal_task_items').select('id, task_id, billboard_id').lt('created_at', toTs).or(`status.neq.completed,removal_date.gt.${to}`).range(a, b)),
    all((a, b) => sb.from('customer_payments').select('id, amount, method, customer_name, customer_id, paid_at, distributed_payment_id, contract_number')
      .eq('entry_type', 'payment').gte('paid_at', from).lte('paid_at', to).range(a, b)),
    all((a, b) => sb.from('customer_payments').select('amount, distributed_payment_id, id').eq('entry_type', 'payment').gte('paid_at', prev.from).lte('paid_at', prev.to).range(a, b)),
  ]);

  // أوامر التركيب والإزالة ← العقود
  const [instTasks, remTasks] = await Promise.all([
    byIds('installation_tasks', 'id, contract_id, task_type', 'id', installItems.map((i: any) => i.task_id)),
    byIds('removal_tasks', 'id, contract_id, contract_ids, status', 'id', [...removalRef, ...removalPendingAll].map((i: any) => i.task_id)),
  ]);
  const instTaskMap = new Map(instTasks.map((t: any) => [t.id, t]));
  const remTaskMap = new Map(remTasks.map((t: any) => [t.id, t]));
  // نفس قواعد صفحة الإزالة: لا تُحتسب بنود أوامر ملغاة أو مغلقة، ولا لوحة أُزيلت سابقاً لنفس العقد، ولا التكرار
  const liveTask = (id: string) => { const t: any = remTaskMap.get(id); return !!t && t.status !== 'cancelled' && t.status !== 'completed'; };
  const contractsOf = (t: any) => (t?.contract_ids?.length ? t.contract_ids : [t?.contract_id]).filter((n: any) => n != null).map(Number);
  const pendingCandidates = removalPendingAll.filter((i: any) => liveTask(i.task_id));
  const doneElsewhere = new Set<string>();
  if (pendingCandidates.length) {
    const other = (await byIds('removal_task_items', 'task_id, billboard_id, status, removal_date', 'billboard_id', pendingCandidates.map((i: any) => Number(i.billboard_id))))
      .filter((i: any) => i.status === 'completed' && (!i.removal_date || String(i.removal_date).slice(0, 10) <= to));
    const otherTasks = new Map((await byIds('removal_tasks', 'id, contract_id, contract_ids', 'id', other.map((i: any) => i.task_id))).map((t: any) => [t.id, t]));
    other.forEach((i: any) => contractsOf(otherTasks.get(i.task_id)).forEach((c: number) => doneElsewhere.add(`${c}:${Number(i.billboard_id)}`)));
  }
  const seenPending = new Set<string>();
  const pendingLive = pendingCandidates.filter((i: any) => {
    const cs = contractsOf(remTaskMap.get(i.task_id));
    const keys = cs.map((c: number) => `${c}:${Number(i.billboard_id)}`);
    if (keys.some((k: string) => doneElsewhere.has(k) || seenPending.has(k))) return false;
    keys.forEach((k: string) => seenPending.add(k));
    return true;
  });
  const removalRefLive = removalRef.filter((i: any) => { const t: any = remTaskMap.get(i.task_id); return !t || t.status !== 'cancelled'; });
  const contractNums = [...instTasks, ...remTasks].map((t: any) => Number(t.contract_id)).filter(Boolean);
  const [contractNames, billboards] = await Promise.all([
    byIds('Contract', 'Contract_Number, "Customer Name", "Ad Type"', 'Contract_Number', contractNums),
    byIds('billboards', 'ID, Billboard_Name, Size, City, Municipality', 'ID', [...installItems, ...removalRefLive].map((i: any) => Number(i.billboard_id))),
  ]);
  const custOf = new Map(contractNames.map((c: any) => [Number(c.Contract_Number), c['Customer Name'] || '—']));
  const adOf = new Map<number, string>(contractNames.map((c: any) => [Number(c.Contract_Number), String(c['Ad Type'] || '').replace(/\s+/g, ' ').trim()]));
  const pendingAd = new Map<string, number>();
  pendingLive.forEach((i: any) => {
    const ad = adOf.get(Number((remTaskMap.get(i.task_id) as any)?.contract_id)) || 'غير محدد';
    pendingAd.set(ad, (pendingAd.get(ad) || 0) + 1);
  });
  const bMap = new Map(billboards.map((b: any) => [Number(b.ID), b]));
  const contractTotal = (c: any) => Number(c.Total) || Number(c['Total Rent']) || 0;
  const countBoards = (c: any) => Number(c.billboards_count) || String(c.billboard_ids || '').split(/[^0-9]+/).filter(Boolean).length;

  // اسم الشركة لكل زبون (لجدول التحصيلات)
  const companyOf = new Map<string, string>((await byIds('customers', 'id, company', 'id', payments.map((p: any) => p.customer_id).filter(Boolean)).catch(() => []))
    .filter((c: any) => String(c.company || '').trim()).map((c: any) => [String(c.id), String(c.company).trim()]));

  return {
    from, to, prevFrom: prev.from, prevTo: prev.to,
    contracts: contracts.map((c: any) => ({
      number: Number(c.Contract_Number), customer: c['Customer Name'] || '—', adType: String(c['Ad Type'] || '').replace(/\s+/g, ' ').trim(),
      start: c['Contract Date'] || '', end: c['End Date'] || '', total: contractTotal(c), boards: countBoards(c),
    })),
    prevContracts: { count: prevContracts.length, total: prevContracts.reduce((s: number, c: any) => s + contractTotal(c), 0) },
    installs: installItems.map((i: any) => {
      const t: any = instTaskMap.get(i.task_id) || {};
      const b: any = bMap.get(Number(i.billboard_id)) || {};
      const contract = Number(t.contract_id) || null;
      return {
        billboardId: Number(i.billboard_id), name: b.Billboard_Name || `لوحة ${i.billboard_id}`, size: b.Size || '', city: b.Municipality || b.City || '',
        date: i.installation_date, reinstall: t.task_type === 'reinstallation' || Number(i.reinstall_count) > 0,
        contract, customer: contract ? custOf.get(contract) || '—' : '—',
      };
    }),
    prevInstalls: prevInstalls.count || 0,
    removalsReferred: removalRefLive.map((i: any) => {
      const t: any = remTaskMap.get(i.task_id) || {};
      const b: any = bMap.get(Number(i.billboard_id)) || {};
      const contract = Number(t.contract_id) || null;
      return { billboardId: Number(i.billboard_id), name: b.Billboard_Name || `لوحة ${i.billboard_id}`, size: b.Size || '', contract, customer: contract ? custOf.get(contract) || '—' : '—', adType: contract ? adOf.get(contract) || '' : '', done: i.status === 'completed' && (!i.removal_date || String(i.removal_date).slice(0, 10) <= to) };
    }),
    removalsDone: removalDone.count || 0,
    removalsPendingAll: pendingLive.length,
    removalsPendingByAd: [...pendingAd.entries()].map(([adType, n]) => ({ adType, n })).sort((a, b) => b.n - a.n),
    prevRemovals: prevRemovals.count || 0,
    payments: payments.map((p: any) => ({ amount: Number(p.amount) || 0, method: p.method || 'غير محدد', customer: p.customer_name || '—', company: companyOf.get(String(p.customer_id)) || '', date: p.paid_at, group: p.distributed_payment_id || p.id })),
    prevPayments: {
      total: prevPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0),
      count: new Set(prevPayments.map((p: any) => p.distributed_payment_id || p.id)).size,
    },
  };
}

/* ───────────── الصياغة ───────────── */

export interface ReportSections { contracts: boolean; installs: boolean; removals: boolean; payments: boolean; details: boolean; /** المقارنة بالفترة السابقة (زيادة أو تراجع) — افتراضياً لا */ declines?: boolean }
export const DEFAULT_SECTIONS: ReportSections = { contracts: true, installs: true, removals: true, payments: true, details: true, declines: false };

const money = (n: number) => `${Math.round(n).toLocaleString('en-US')} د.ل`;
const ORD = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً'];

/** عدّ عربي سليم: 1 عقد واحد، 2 عقدان، 3-10 عقود، 11+ عقداً */
function count(n: number, w: { one: string; two: string; few: string; many: string }) {
  if (n === 1) return w.one;
  if (n === 2) return w.two;
  if (n >= 3 && n <= 10) return `${n} ${w.few}`;
  return `${n.toLocaleString('en-US')} ${w.many}`;
}
const W = {
  contract: { one: 'عقداً واحداً', two: 'عقدين', few: 'عقود', many: 'عقداً' },
  contractN: { one: 'عقد واحد', two: 'عقدان', few: 'عقود', many: 'عقداً' },
  board: { one: 'لوحة واحدة', two: 'لوحتين', few: 'لوحات', many: 'لوحة' },
  boardN: { one: 'لوحة واحدة', two: 'لوحتان', few: 'لوحات', many: 'لوحة' },
  payment: { one: 'دفعة واحدة', two: 'دفعتين', few: 'دفعات', many: 'دفعة' },
  otherContracts: { one: 'عقد آخر', two: 'عقدين آخرين', few: 'عقود أخرى', many: 'عقداً آخر' },
};
const newAdj = (n: number) => (n === 1 || n > 10 ? 'جديداً' : n === 2 ? 'جديدين' : 'جديدة');

function pick<T>(arr: T[], seed: number, salt: number): T {
  const i = Math.abs(Math.floor(Math.sin(seed * 9301 + salt * 49297) * 233280)) % arr.length;
  return arr[i];
}

/** يُضبط في writeReport: هل تُذكر المقارنة بالفترة السابقة (زيادة/تراجع)؟ */
let showComparisons = false;
let showDeclines = false;

function change(cur: number, prev: number, unit: (n: number) => string, seed: number, salt: number): string {
  if (!showComparisons) return '';
  if (!prev && !cur) return '';
  if (!prev) return pick([`، ولم يُسجَّل شيء من ذلك في الفترة السابقة`, `، في حين خلت الفترة السابقة من أي نشاط مماثل`], seed, salt);
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct >= 15) return pick([`، بارتفاع نسبته ${pct}% عن الفترة السابقة التي سجّلت ${unit(prev)}`, `، أي بزيادة تقارب ${pct}% مقارنةً بـ${unit(prev)} في الفترة السابقة`], seed, salt);
  if (pct <= -15) return pick([`، بتراجع نسبته ${Math.abs(pct)}% عن الفترة السابقة التي سجّلت ${unit(prev)}`, `، وهو أقل بنحو ${Math.abs(pct)}% مما تحقق في الفترة السابقة (${unit(prev)})`], seed, salt);
  return pick([`، وهو مستوى قريب مما تحقق في الفترة السابقة (${unit(prev)})`, `، محافظاً تقريباً على مستوى الفترة السابقة (${unit(prev)})`], seed, salt);
}

/** تصحيح نص تقرير محفوظ: حذف عبارات التراجع والتوصيات فقط، مع إبقاء أي تعديل يدوي آخر كما هو */
const WORDING_FIXES: [RegExp, string][] = [
  // عبارات الختام والمجاملة (سطر كامل)
  [/(^|\n)[ \t]*(?:وفي ضوء ما سبق، )?(?:ونؤكد استمرارنا|ونأمل أن يكون هذا التقرير|ونبقى على استعداد|ونحن على استعداد)[^\n]*/g, '$1'],
  [/، (?:ونبقى|ونحن) على استعداد[^\n]*?\./g, '.'],
  // مقدمات المجاملة ← سطر واقعي
  [/(^|\n)[ \t]*نرفع إليكم تقرير أعمال الشركة عن الفترة من ([^\n،]+)، ونستعرض فيه ([^\n]*?)\./g, '$1تقرير أعمال الشركة للفترة $2، ويتناول: $3.'],
  [/(^|\n)[ \t]*يسرّنا أن نضع بين أيديكم ملخصاً لسير العمل [^\n(]*\(([^)\n]+)\)، يتناول ([^\n]*?)\./g, '$1تقرير أعمال الشركة للفترة $2، ويتناول: $3.'],
  [/(^|\n)[ \t]*فيما يلي عرض موجز لأهم ما شهدته الشركة [^\n،]*، أعددناه ليكون مرجعاً سريعاً لمتابعة ([^\n]*?)، مع الإشارة إلى ما يستدعي المتابعة\./g, '$1تقرير أعمال الشركة، ويتناول: $2.'],
  // عبارات المقارنة بالفترة السابقة (تنتهي بنقطة نهاية الجملة أو «، » — «د.ل» لا يقطعها)
  [/، (?:بارتفاع|بتراجع) نسبته \d+% عن الفترة السابقة التي سجّلت [^\n]*?(?=\.(?:\s|$)|، )/g, ''],
  [/، أي بزيادة تقارب \d+% مقارنةً بـ[^\n]*?في الفترة السابقة/g, ''],
  [/، (?:وهو مستوى قريب مما تحقق في|محافظاً تقريباً على مستوى) الفترة السابقة \([^)\n]*\)/g, ''],
  [/، (?:ولم يُسجَّل شيء من ذلك في الفترة السابقة|في حين خلت الفترة السابقة من أي نشاط مماثل)/g, ''],
  [/، بعد أن سُجّل [^\n]*? في الفترة السابقة/g, ''],
  [/، مع مقارنة مختصرة بالفترة السابقة لتوضيح اتجاه الأداء/g, ''],
  [/(^|\n)[ \t]*(?:وقد اتسمت هذه الفترة بنشاط واضح مقارنةً بسابقتها|وبصورة عامة، جاءت المؤشرات إيجابية وأفضل من الفترة السابقة|وجاءت المؤشرات العامة متوازنة إلى حد كبير|وقد حافظ العمل على وتيرة مستقرة قريبة من الفترة السابقة)[^\n]*?\.[ \t]*/g, '$1'],
  // جمل التباطؤ العامة (كل صيغها القديمة والجديدة)
  [/(^|\n)[ \t]*وقد شهدت الفترة تباطؤاً نسبياً مقارنةً بسابقتها[^\n]*?\.[ \t]*/g, '$1'],
  [/(^|\n)[ \t]*و(?:نلفت الانتباه إلى أن بعض المؤشرات جاءت|جاءت بعض المؤشرات) دون مستوى الفترة السابقة[^\n]*?\.[ \t]*/g, '$1'],
  [/، وهو أقل بنحو \d+% مما تحقق في الفترة السابقة \([^)\n]*\)/g, ''],
  [/، بعد أن بلغت [^؛\n]*? في الفترة السابقة(؛ ونوصي بمتابعة المستحقات المتأخرة مع الزبائن)?/g, ''],
  [/، ونوصي بجدولتها في أقرب وقت لإتاحتها للحجز من جديد/g, ''],
  [/، وتسريع إزالتها يعيدها إلى قائمة اللوحات المتاحة للبيع/g, ''],
  [/وفي ضوء ما سبق، نوصي ب[^\n]*?، (ونبقى على استعداد لتقديم أي تفاصيل إضافية تطلبونها\.)/g, '$1'],
  // أي جملة ختام توصيات: يبقى منها «ونبقى على استعداد…» فقط
  [/(?:وفي ضوء ما سبق، )?نوصي [^\n]*?(ونبقى على استعداد[^\n.]*\.)/g, '$1'],
  // مقطع توصية داخل جملة: «؛ ونوصي …» أو «، ونوصي …» حتى نهاية الجملة
  [/[؛،]\s*و?(?:نوصي|نقترح|ننصح|نرى أهمية|نرى ضرورة)[^.\n]*/g, ''],
  // جملة توصية كاملة: «ونوصي …» / «ونقترح …» / «ونرى أهمية …» / «ونلفت الانتباه …»
  [/(^|\.[ \t]*|\n[ \t]*)و?(?:نوصي|نقترح|ننصح|نرى أهمية|نرى ضرورة)[^.\n]*\.[ \t]*/gm, '$1'],
  [/، نوضح مؤشراته في البنود التالية مع ما نقترحه من معالجات\./g, '، نوضح مؤشراته في البنود التالية.'],
  [/ونلفت الانتباه إلى أن بعض المؤشرات/g, 'وجاءت بعض المؤشرات'],
  [/[ \t]+\n/g, '\n'],
];
/** حذف الأقسام الفارغة من تقرير محفوظ («لم تُبرم…»، «لم تُسجَّل تحصيلات…») ثم إعادة ترقيم العناوين */
const CLOSING_RE = /^و(نؤكد|نأمل|نبقى|نحن) /;
function dropEmptySections(body: string): string {
  const lines = String(body || '').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^##\s/.test(lines[i].trim())) { out.push(lines[i]); continue; }
    let j = i + 1;
    while (j < lines.length && !/^##\s/.test(lines[j].trim())) j++;
    const content = lines.slice(i + 1, j).map(l => l.trim()).filter(Boolean);
    const facts = content.filter(l => !CLOSING_RE.test(l));
    if (facts.length === 1 && /^لم /.test(facts[0])) {
      // يُحذف القسم ويبقى سطر الختام إن كان ضمنه
      content.filter(l => CLOSING_RE.test(l)).forEach(l => out.push('', l));
      i = j - 1;
      continue;
    }
    out.push(...lines.slice(i, j));
    i = j - 1;
  }
  let k = 0;
  return out.join('\n').replace(/^##\s*[^:\n]+:\s*/gm, () => `## ${ORD[k++] || `${k}`}: `).replace(/\n{3,}/g, '\n\n').trim();
}
export const hasDeclines = (body: string) => WORDING_FIXES.some(([p]) => { p.lastIndex = 0; return p.test(body || ''); }) || dropEmptySections(body) !== String(body || '').trim();
export function stripDeclines(body: string): string {
  return dropEmptySections(WORDING_FIXES.reduce((s, [p, r]) => s.replace(p, r), String(body || '')));
}

const top = <T,>(m: Map<string, T>, by: (v: T) => number, n: number) => [...m.entries()].sort((a, b) => by(b[1]) - by(a[1])).slice(0, n);
const joinAr = (items: string[]) => items.length <= 1 ? items.join('') : `${items.slice(0, -1).join('، ')} و${items[items.length - 1]}`;

export interface GeneratedReport { subject: string; body: string; recipient: string }

/** يكتب التقرير بلغة طبيعية؛ seed يغيّر الصياغة (زر «صياغة أخرى») */
export function writeReport(data: ReportData, period: ReportPeriod, sections: ReportSections, seed = 1): GeneratedReport {
  showComparisons = showDeclines = !!sections.declines;
  // التقرير يعرض الوقائع والأرقام فقط؛ التوصيات من عمل معدّ التقرير
  const withRecs = false;
  const during = DURING[period];
  const title = PERIODS.find(p => p.id === period)?.title || 'تقرير الفترة';
  const subject = `${title} لأعمال الشركة عن الفترة من ${dmy(data.from)} إلى ${dmy(data.to)}`;
  const out: string[] = [];
  let ord = 0;
  const heading = (t: string) => out.push('', `## ${ORD[ord++]}: ${t}`);

  const cTotal = data.contracts.reduce((s, c) => s + c.total, 0);
  const pTotal = data.payments.reduce((s, p) => s + p.amount, 0);
  const receipts = new Set(data.payments.map(p => p.group)).size;
  // ما لم يحدث منه شيء خلال الفترة لا يُذكر في التقرير
  const adjEnabled = sections.contracts;
  sections = {
    ...sections,
    contracts: sections.contracts && data.contracts.length > 0,
    installs: sections.installs && data.installs.length > 0,
    removals: sections.removals && (data.removalsReferred.length > 0 || data.removalsDone > 0),
    payments: sections.payments && pTotal > 0,
  };

  // المقدمة
  const covered = [
    sections.contracts && 'العقود الجديدة', adjEnabled && data.adjustments?.length && 'تعديلات العقود السابقة', sections.installs && 'أعمال التركيب', sections.removals && 'اللوحات المحالة للإزالة', sections.payments && 'التحصيلات المالية',
  ].filter(Boolean) as string[];
  if (!covered.length) out.push(`لم تُسجَّل أي عقود جديدة أو أعمال تركيب أو إزالة أو تحصيلات مالية ${during} (${dmy(data.from)} – ${dmy(data.to)}).`);
  else out.push(`تقرير أعمال الشركة للفترة من ${dmy(data.from)} إلى ${dmy(data.to)}، ويتناول: ${covered.join('، ')}.`);
  const up = (cur: number, prev: number) => (prev ? (cur - prev) / prev : cur > 0 ? 1 : 0);
  const trend = (sections.contracts ? up(data.contracts.length, data.prevContracts.count) : 0) + (sections.payments ? up(pTotal, data.prevPayments.total) : 0);
  // جملة عامة فقط عند تحسّن النشاط؛ لا تعليق على التباطؤ أو الثبات
  if (showComparisons && (sections.contracts || sections.payments) && trend > 0.2) {
    out.push(pick(['وقد اتسمت هذه الفترة بنشاط واضح مقارنةً بسابقتها، سواء في حجم التعاقدات أو في مستوى التحصيل.', 'وبصورة عامة، جاءت المؤشرات إيجابية وأفضل من الفترة السابقة في أغلب البنود.'], seed, 2));
  }

  // العقود
  if (sections.contracts) {
    heading('العقود الجديدة');
    const n = data.contracts.length;
    if (!n) {
      out.push(`لم تُبرم الشركة أي عقود جديدة ${during}${data.prevContracts.count && showDeclines ? `، بعد أن سُجّل ${count(data.prevContracts.count, W.contractN)} في الفترة السابقة` : ''}.${withRecs ? ` ${pick(['ونرى أهمية تكثيف التواصل مع الزبائن الحاليين والمحتملين خلال الفترة القادمة.', 'ونقترح مراجعة العروض المرسلة ومتابعتها مع الزبائن لتحويلها إلى عقود.'], seed, 3)}` : ''}`);
    } else {
      out.push(`${pick(['أبرمت الشركة', 'وقّعت الشركة', 'تمكّنت الشركة من إبرام'], seed, 4)} ${during} ${count(n, W.contract)} ${newAdj(n)} بقيمة إجمالية بلغت ${money(cTotal)}${change(n, data.prevContracts.count, c => count(c, W.contractN), seed, 5)}.`);
      const boards = data.contracts.reduce((s, c) => s + c.boards, 0);
      const biggest = [...data.contracts].sort((a, b) => b.total - a.total)[0];
      const extra: string[] = [];
      if (boards) extra.push(`${n === 1 ? 'ويشمل هذا العقد' : 'وتشمل هذه العقود'} ${count(boards, W.board)}`);
      if (n > 1 && biggest) extra.push(`ويُعدّ عقد ${biggest.customer} (رقم ${biggest.number}) الأكبر قيمةً بمبلغ ${money(biggest.total)}`);
      const ads = new Map<string, number>();
      data.contracts.forEach(c => c.adType && ads.set(c.adType, (ads.get(c.adType) || 0) + 1));
      if (ads.size > 1) extra.push(`وتنوّعت مجالات الإعلان بين ${joinAr(top(ads, v => v, 4).map(([k]) => k))}`);
      if (extra.length) out.push(`${extra.join('، ')}.`);
      if (sections.details) {
        out.push('', pick(['وفيما يلي بيان بهذه العقود:', 'وتفصيلها كالتالي:'], seed, 6));
        data.contracts.slice(0, 15).forEach(c => out.push(`- عقد رقم ${c.number} — ${c.customer}${c.adType ? ` (${c.adType})` : ''}${c.boards ? `، ${count(c.boards, W.boardN)}` : ''}، من ${dmy(c.start)} إلى ${dmy(c.end)}، بقيمة ${money(c.total)}.`));
        if (n > 15) out.push(`- إضافة إلى ${count(n - 15, W.otherContracts)} بقيمة ${money(data.contracts.slice(15).reduce((s, c) => s + c.total, 0))}.`);
      }
    }
  }

  // تعديلات على عقود وردت في تقارير سابقة (التقرير القديم يبقى كما هو، والتعديل يُذكر هنا)
  const adj = adjEnabled ? (data.adjustments || []) : [];
  if (adj.length) {
    heading('تعديلات على عقود وردت في تقارير سابقة');
    const net = adj.reduce((s, a) => s + (a.after - a.before), 0);
    const k = adj.length;
    out.push(`${k === 1 ? 'عُدّلت قيمة عقد واحد سبق ذكره' : k === 2 ? 'عُدّلت قيمة عقدين سبق ذكرهما' : `عُدّلت قيم ${k} ${k <= 10 ? 'عقود' : 'عقداً'} سبق ذكرها`} في تقارير سابقة،${Math.abs(net) >= 1 ? `وصافي أثر التعديل ${net > 0 ? '+' : '−'}${money(Math.abs(net))}` : 'دون أثر صافٍ على الإجمالي'}:`);
    adj.forEach(a => out.push(`- عقد رقم ${a.number} — ${a.customer}${a.adType ? ` (${a.adType})` : ''}: من ${money(a.before)} إلى ${money(a.after)} (${a.after > a.before ? '+' : '−'}${money(Math.abs(a.after - a.before))})${a.reportedTo ? `، وكان قد ورد في تقرير ${a.reportedFrom ? `${dmy(a.reportedFrom)} – ` : ''}${dmy(a.reportedTo)}` : ''}.`));
  }

  // التركيب
  if (sections.installs) {
    heading('أعمال التركيب');
    const n = data.installs.length;
    if (!n) {
      out.push(`لم تُسجَّل أعمال تركيب مكتملة ${during}${data.prevInstalls ? `، مقارنةً بـ${count(data.prevInstalls, W.boardN)} في الفترة السابقة` : ''}.`);
    } else {
      const re = data.installs.filter(i => i.reinstall).length;
      const fresh = n - re;
      const split = re && fresh ? `، منها ${fresh} للتركيب الجديد و${re} لإعادة التركيب` : re ? '، وجميعها أعمال إعادة تركيب' : '';
      out.push(`${pick(['أنجزت فرق التركيب', 'نفّذت فرق التركيب', 'استكملت فرق التركيب'], seed, 7)} ${during} أعمال التركيب على ${count(n, W.board)}${split}${change(n, data.prevInstalls, c => count(c, W.boardN), seed, 8)}.`);
      const byCust = new Map<string, number>();
      data.installs.forEach(i => byCust.set(i.customer, (byCust.get(i.customer) || 0) + 1));
      const cities = new Map<string, number>();
      data.installs.forEach(i => i.city && cities.set(i.city, (cities.get(i.city) || 0) + 1));
      const parts: string[] = [];
      if (byCust.size > 1) parts.push(`وتركّز الجزء الأكبر من العمل في لوحات ${joinAr(top(byCust, v => v, 3).map(([k, v]) => `${k} (${v})`))}`);
      if (cities.size > 1) parts.push(`وتوزّعت المواقع على ${joinAr(top(cities, v => v, 4).map(([k]) => k))}`);
      if (parts.length) out.push(`${parts.join('، ')}.`);
      if (sections.details) {
        const groups = new Map<string, { customer: string; contract: number | null; items: typeof data.installs }>();
        data.installs.forEach(i => {
          const k = `${i.contract}|${i.customer}`;
          if (!groups.has(k)) groups.set(k, { customer: i.customer, contract: i.contract, items: [] });
          groups.get(k)!.items.push(i);
        });
        out.push('', 'وتوزّعت اللوحات المركّبة على النحو التالي:');
        [...groups.values()].sort((a, b) => b.items.length - a.items.length).slice(0, 15).forEach(g => {
          const sizes = new Map<string, number>();
          g.items.forEach(i => i.size && sizes.set(i.size, (sizes.get(i.size) || 0) + 1));
          out.push(`- ${g.customer}${g.contract ? ` — عقد ${g.contract}` : ''}: ${count(g.items.length, W.boardN)}${sizes.size ? ` (${[...sizes.entries()].map(([s, c]) => `${c} × ${s}`).join('، ')})` : ''}.`);
        });
        if (groups.size > 15) out.push(`- وبقية الأعمال موزعة على ${count(groups.size - 15, W.otherContracts)}.`);
      }
    }
  }

  // الإزالة
  if (sections.removals) {
    heading('اللوحات المحالة للإزالة');
    const n = data.removalsReferred.length;
    const pendingHere = data.removalsReferred.filter(r => !r.done).length;
    if (!n && !data.removalsDone) {
      out.push(`لم تُحَل أي لوحات إلى الإزالة ${during}${data.removalsPendingAll ? `، علماً بأن هناك ${count(data.removalsPendingAll, W.boardN)} من فترات سابقة لا تزال بانتظار الإزالة` : ''}.`);
    } else {
      out.push(`${n ? `أُحيلت ${during} ${count(n, W.board).replace(/^(\d)/, '$1')} إلى الإزالة بعد انتهاء عقودها` : `لم تُحَل لوحات جديدة إلى الإزالة ${during}`}${change(n, data.prevRemovals, c => count(c, W.boardN), seed, 9)}، ${data.removalsDone ? `ونُفّذت إزالة ${count(data.removalsDone, W.board)} فعلياً خلال الفترة` : 'ولم تُنفَّذ أي إزالة فعلية خلال الفترة'}.`);
      if (data.removalsPendingAll) {
        out.push(pick([
          `ولا يزال إجمالي ${count(data.removalsPendingAll, W.boardN)} بانتظار الإزالة${pendingHere ? `، منها ${pendingHere} من إحالات هذه الفترة` : ''}${withRecs ? '، ونوصي بجدولتها في أقرب وقت لإتاحتها للحجز من جديد' : ''}.`,
          `ويبلغ عدد اللوحات التي لم تُزَل بعد ${count(data.removalsPendingAll, W.boardN)}${pendingHere ? ` (منها ${pendingHere} أُحيلت في هذه الفترة)` : ''}.`,
        ], seed, 10));
        const ads = data.removalsPendingByAd.filter(a => a.adType !== 'غير محدد');
        if (ads.length) out.push(`وتتوزع اللوحات المنتظرة للإزالة حسب نوع الإعلان: ${ads.slice(0, 8).map(a => `${a.adType} (${a.n})`).join('، ')}${ads.length > 8 ? `، وأنواع أخرى (${ads.slice(8).reduce((s, a) => s + a.n, 0)})` : ''}.`);
      }
      if (sections.details && n) {
        const groups = new Map<string, { customer: string; contract: number | null; adType: string; n: number; done: number }>();
        data.removalsReferred.forEach(r => {
          const k = `${r.contract}|${r.customer}`;
          const g = groups.get(k) || { customer: r.customer, contract: r.contract, adType: r.adType, n: 0, done: 0 };
          g.n += 1; if (r.done) g.done += 1;
          groups.set(k, g);
        });
        out.push('', 'وتفصيل الإحالات حسب العقود:');
        [...groups.values()].sort((a, b) => b.n - a.n).slice(0, 12).forEach(g => out.push(`- ${g.customer}${g.contract ? ` — عقد ${g.contract}` : ''}${g.adType ? ` (${g.adType})` : ''}: ${count(g.n, W.boardN)}${g.done === g.n ? '، أُزيلت جميعها' : g.done ? `، أُزيل منها ${g.done === 1 ? 'لوحة واحدة' : g.done}` : '، لم تُزَل بعد'}.`));
        if (groups.size > 12) out.push(`- إضافة إلى إحالات من ${count(groups.size - 12, W.otherContracts)}.`);
      }
    }
  }

  // التحصيلات
  if (sections.payments) {
    heading('التحصيلات المالية');
    if (!pTotal) {
      out.push(`لم تُسجَّل تحصيلات مالية ${during}${data.prevPayments.total && showDeclines ? `، بعد أن بلغت ${money(data.prevPayments.total)} في الفترة السابقة` : ''}${data.prevPayments.total && withRecs ? '؛ ونوصي بمتابعة المستحقات المتأخرة مع الزبائن' : ''}.`);
    } else {
      out.push(`بلغ إجمالي التحصيلات المالية ${during} ${money(pTotal)} ${pick(['من خلال', 'توزعت على', 'عبر'], seed, 11)} ${count(receipts, W.payment)}${receipts > 1 ? `، بمتوسط ${money(pTotal / receipts)} للدفعة الواحدة` : ''}${change(pTotal, data.prevPayments.total, money, seed, 12)}.`);
      const byMethod = new Map<string, number>();
      data.payments.forEach(p => byMethod.set(p.method, (byMethod.get(p.method) || 0) + p.amount));
      if (byMethod.size > 1) out.push(`وجاءت التحصيلات حسب طريقة السداد: ${joinAr(top(byMethod, v => v, 5).map(([k, v]) => `${k} ${money(v)} (${Math.round((v / pTotal) * 100)}%)`))}.`);
      const byCust = new Map<string, number>();
      data.payments.forEach(p => byCust.set(p.customer, (byCust.get(p.customer) || 0) + p.amount));
      const tops = top(byCust, v => v, 3);
      if (tops.length > 1) out.push(`${pick(['وكان أكبر المسدِّدين', 'وتصدّر قائمة المسدِّدين'], seed, 13)} ${tops[0][0]} بمبلغ ${money(tops[0][1])}${tops.slice(1).length ? `، ${pick(['يليه', 'ثم'], seed, 14)} ${joinAr(tops.slice(1).map(([k, v]) => `${k} (${money(v)})`))}` : ''}.`);
      if (sections.details && byCust.size > 3) {
        const counts = new Map<string, Set<string>>();
        const companies = new Map<string, string>();
        data.payments.forEach(p => {
          if (!counts.has(p.customer)) counts.set(p.customer, new Set());
          counts.get(p.customer)!.add(p.group);
          if (p.company && !companies.has(p.customer)) companies.set(p.customer, p.company);
        });
        out.push('', '| الزبون | الشركة | عدد الدفعات | المبلغ |', '|---|---|---|---|');
        top(byCust, v => v, 15).forEach(([k, v]) => out.push(`| ${k} | ${companies.get(k) || '—'} | ${counts.get(k)?.size || 0} | ${money(v)} |`));
        out.push(`| الإجمالي | | ${receipts} | ${money(pTotal)} |`);
      }
    }
  }

  // بلا خاتمة أو عبارات مجاملة: التقارير أرشيف للمراجعة

  // فصل الفقرات المتتالية بسطر فارغ (كل جملة رئيسية فقرة مستقلة)
  const plain = (l: string) => !!l.trim() && !/^(##|-|\|)/.test(l.trim());
  const lines: string[] = [];
  out.forEach(l => { if (plain(l) && lines.length && plain(lines[lines.length - 1])) lines.push(''); lines.push(l); });
  return { subject, body: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), recipient: '' };
}
