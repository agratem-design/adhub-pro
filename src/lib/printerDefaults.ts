import { supabase } from '@/integrations/supabase/client';
import { collectStatementRows } from '@/lib/printerStatement';

/**
 * المطبعة الافتراضية لمهام الطباعة:
 * - العقد الشامل للتركيب والطباعة معاً → مطبعة الشركة (الفارس الذهبي).
 * - غير ذلك → المطبعة الرئيسية المعتمدة في تاريخ إنشاء العقد (جدول فترات في إعدادات المطابع).
 * يمكن دائماً تغيير المطبعة من المهمة نفسها.
 */
export const PRINTER_DEFAULTS_KEY = 'printer_defaults';

export interface MainPrinterPeriod { printer_id: string; from: string }
export interface PrinterDefaults { in_house_printer_id: string | null; schedule: MainPrinterPeriod[] }

export async function loadPrinterDefaults(): Promise<PrinterDefaults> {
  const { data, error } = await supabase.from('system_settings').select('setting_value').eq('setting_key', PRINTER_DEFAULTS_KEY).maybeSingle();
  if (error) throw error;
  try {
    const v = data?.setting_value ? JSON.parse(String(data.setting_value)) : {};
    return {
      in_house_printer_id: v.in_house_printer_id || null,
      schedule: Array.isArray(v.schedule) ? v.schedule.filter((r: any) => r?.printer_id && r?.from) : [],
    };
  } catch {
    return { in_house_printer_id: null, schedule: [] };
  }
}

export async function savePrinterDefaults(v: PrinterDefaults) {
  const schedule = [...v.schedule].sort((a, b) => a.from.localeCompare(b.from));
  const { error } = await supabase.from('system_settings').upsert({
    setting_key: PRINTER_DEFAULTS_KEY,
    setting_value: JSON.stringify({ in_house_printer_id: v.in_house_printer_id, schedule }),
    setting_type: 'json',
    category: 'printers',
    description: 'المطبعة الرئيسية حسب الفترة ومطبعة الشركة للعقود الشاملة',
  } as any, { onConflict: 'setting_key' });
  if (error) throw error;
}

/** مطبعة الشركة: المحددة في الإعدادات، وإلا أول مطبعة نشطة اسمها يحتوي «الفارس» */
export function inHousePrinterId(defaults: PrinterDefaults, printers: { id: string; name: string }[]): string | null {
  if (defaults.in_house_printer_id && printers.some(p => p.id === defaults.in_house_printer_id)) return defaults.in_house_printer_id;
  return printers.find(p => /الفارس/.test(p.name))?.id || null;
}

/** المطبعة الرئيسية في تاريخ معيّن (آخر فترة بدأت قبله أو فيه) */
export function mainPrinterAt(defaults: PrinterDefaults, date: string | null | undefined, printers: { id: string; name: string }[] = []): string | null {
  const d = String(date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const rows = [...defaults.schedule].sort((a, b) => a.from.localeCompare(b.from));
  let pick: string | null = null;
  for (const r of rows) if (r.from <= d) pick = r.printer_id;
  return pick || rows[0]?.printer_id || inHousePrinterId(defaults, printers);
}

const truthy = (v: unknown) => v === true || v === 1 || v === 'true' || v === '1';

/** هل العقد شامل للتركيب وشامل للطباعة في سعر اللوحة؟ */
export function contractIncludesInstallAndPrint(c: any): boolean {
  return truthy(c?.include_installation_in_price) && truthy(c?.include_print_in_billboard_price);
}

export interface DefaultPrinterResult { printerId: string | null; reason: string }

/** Preserve explicit assignment; otherwise apply the contract rule and fall back to the company printer. */
export function defaultPrinterForContract(defaults: PrinterDefaults, printers: { id: string; name: string }[], contract: any, taskDate?: string): string | null {
  if (contractIncludesInstallAndPrint(contract)) {
    const company = inHousePrinterId(defaults, printers);
    if (company) return company;
  }
  const main = mainPrinterAt(defaults, contract?.['Contract Date'] || taskDate, printers);
  return printers.some(p => p.id === main) ? main : inHousePrinterId(defaults, printers);
}

let assigning: Promise<number> | null = null;
/** Persist missing assignments so statements, task lists, and account balances use the same printer. */
export function ensureDefaultPrinterAssignments(): Promise<number> {
  if (assigning) return assigning;
  assigning = (async () => {
    const { data: tasks } = await collectStatementRows((from, to) => supabase.from('print_tasks')
      .select('id, contract_id, created_at, invoice_id').is('printer_id', null).neq('status', 'cancelled').order('id').range(from, to));
    if (!tasks.length) return 0;
    const [defaults, printerResult] = await Promise.all([
      loadPrinterDefaults(), supabase.from('printers').select('id, name').eq('is_active', true),
    ]);
    if (printerResult.error) throw printerResult.error;
    const printers = printerResult.data || [];
    const ids = [...new Set(tasks.map(t => t.contract_id).filter((id): id is number => id != null))];
    const contracts = new Map<number, any>();
    for (let start = 0; start < ids.length; start += 40) {
      const result = await supabase.from('Contract').select('Contract_Number, "Contract Date", include_installation_in_price, include_print_in_billboard_price').in('Contract_Number', ids.slice(start, start + 40));
      if (result.error) throw result.error;
      for (const contract of result.data || []) contracts.set(contract.Contract_Number, contract);
    }
    let changed = 0;
    for (const task of tasks) {
      const printerId = defaultPrinterForContract(defaults, printers, contracts.get(task.contract_id!), task.created_at);
      if (!printerId) continue;
      // Conditional update avoids overwriting a printer selected while this request was in flight.
      const result = await supabase.from('print_tasks').update({ printer_id: printerId }).eq('id', task.id).is('printer_id', null).select('id');
      if (result.error) throw result.error;
      if (!result.data?.length) continue;
      changed++;
      if (task.invoice_id) {
        const invoice = await supabase.from('printed_invoices').update({ printer_id: printerId }).eq('id', task.invoice_id).is('printer_id', null);
        if (invoice.error) throw invoice.error;
      }
    }
    return changed;
  })().finally(() => { assigning = null; });
  return assigning;
}

/** المطبعة الافتراضية لمهمة طباعة مرتبطة بعقد (أو عدة عقود: يُعتمد أحدثها) */
export async function resolveDefaultPrinterForContracts(contractNumbers: number[], printers: { id: string; name: string }[]): Promise<DefaultPrinterResult> {
  const defaults = await loadPrinterDefaults();
  let contract: any = null;
  if (contractNumbers.length) {
    const { data, error } = await supabase.from('Contract')
      .select('Contract_Number, "Contract Date", include_installation_in_price, include_print_in_billboard_price')
      .in('Contract_Number', contractNumbers);
    if (error) throw error;
    contract = (data || []).sort((a: any, b: any) => Number(b.Contract_Number) - Number(a.Contract_Number))[0] || null;
  }
  if (contract && contractIncludesInstallAndPrint(contract)) {
    const id = inHousePrinterId(defaults, printers);
    if (id) return { printerId: id, reason: 'العقد شامل للتركيب والطباعة — مطبعة الشركة' };
  }
  const when = contract?.['Contract Date'] || null;
  const id = defaultPrinterForContract(defaults, printers, contract);
  if (id && printers.some(p => p.id === id)) {
    return { printerId: id, reason: `المطبعة الرئيسية بتاريخ ${String(when || '').slice(0, 10) || 'اليوم'}` };
  }
  return { printerId: null, reason: '' };
}
