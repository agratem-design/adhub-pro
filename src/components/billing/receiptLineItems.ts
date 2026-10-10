/**
 * بنود إيصال الاستلام الموحّد (نفس بناء إيصال الدفعة الموزعة)
 * تُستخدم لكل الإيصالات حتى يكون التصميم والمحتوى واحداً.
 */
import { supabase } from '@/integrations/supabase/client';
import { compositeTaskLabel } from '@/lib/compositeTaskLabel';

const n = (v: unknown) => Number(v) || 0;

/** صفوف الدفعة: إن كانت جزءاً من دفعة موزعة تُجلب كل صفوف التوزيع */
export async function loadReceiptGroup(payment: any): Promise<any[]> {
  if (!payment?.distributed_payment_id) return [payment];
  const { data } = await supabase
    .from('customer_payments')
    .select('*')
    .eq('distributed_payment_id', payment.distributed_payment_id)
    .order('created_at', { ascending: true });
  return data && data.length ? data : [payment];
}

/** تحويل صفوف الدفعة إلى بنود جدول الإيصال (عقد / مهمة مجمعة / فاتورة مبيعات / فاتورة طباعة / رصيد فائض) */
export async function buildReceiptLineItems(rows: any[]): Promise<any[]> {
  const compositeIds = [...new Set(rows.map(p => p.composite_task_id).filter(Boolean))];
  const salesIds = [...new Set(rows.map(p => p.sales_invoice_id).filter(Boolean))];
  const printedIds = [...new Set(rows.map(p => p.printed_invoice_id).filter(Boolean))];

  const compositeMap: Record<string, any> = {};
  if (compositeIds.length) {
    const { data: tasks } = await supabase
      .from('composite_tasks')
      .select('id, task_number, contract_id, task_type, installation_task_id, print_task_id, cutout_task_id, customer_total, paid_amount')
      .in('id', compositeIds);
    const itIds = (tasks || []).map((t: any) => t.installation_task_id).filter(Boolean);
    const itMap: Record<string, any> = {};
    if (itIds.length) {
      const { data: its } = await supabase.from('installation_tasks').select('id, contract_id, task_type, reinstallation_number').in('id', itIds);
      (its || []).forEach((it: any) => { itMap[it.id] = it; });
    }
    (tasks || []).forEach((t: any) => {
      const it = t.installation_task_id ? itMap[t.installation_task_id] : null;
      const taskType = it?.task_type || t.task_type;
      compositeMap[t.id] = {
        ...t,
        contract_id: t.contract_id || it?.contract_id || null,
        task_type: taskType,
        reinstallation_number: it?.reinstallation_number ?? (taskType === 'reinstallation' ? 1 : null),
        calculatedRemaining: Math.max(0, n(t.customer_total) - n(t.paid_amount)),
      };
    });
  }

  const contractNumbers = [...new Set([
    ...rows.map(p => p.contract_number),
    ...Object.values(compositeMap).map((t: any) => t.contract_id),
  ].filter(Boolean).map(Number).filter(x => !Number.isNaN(x)))];
  const contractMap: Record<number, any> = {};
  if (contractNumbers.length) {
    const [{ data: cs }, { data: pays }] = await Promise.all([
      supabase.from('Contract').select('Contract_Number, "Ad Type", Total').in('Contract_Number', contractNumbers),
      supabase.from('customer_payments').select('contract_number, amount, entry_type').in('contract_number', contractNumbers),
    ]);
    const paid: Record<number, number> = {};
    (pays || []).forEach((p: any) => {
      if (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment') {
        paid[Number(p.contract_number)] = (paid[Number(p.contract_number)] || 0) + n(p.amount);
      }
    });
    (cs || []).forEach((c: any) => {
      const p = paid[c.Contract_Number] || 0;
      contractMap[c.Contract_Number] = { ...c, calculatedPaid: p, calculatedRemaining: Math.max(0, n(c.Total) - p) };
    });
  }

  const salesMap: Record<string, any> = {};
  if (salesIds.length) {
    const { data } = await supabase.from('sales_invoices').select('id, invoice_number, invoice_name, total_amount, paid_amount, notes').in('id', salesIds);
    (data || []).forEach((i: any) => { salesMap[i.id] = { ...i, calculatedRemaining: Math.max(0, n(i.total_amount) - n(i.paid_amount)) }; });
  }
  const printedMap: Record<string, any> = {};
  if (printedIds.length) {
    const { data } = await supabase.from('printed_invoices').select('id, invoice_number, total_amount, paid_amount, notes').in('id', printedIds);
    (data || []).forEach((i: any) => { printedMap[i.id] = { ...i, calculatedRemaining: Math.max(0, n(i.total_amount) - n(i.paid_amount)) }; });
  }

  return rows.map((p) => {
    if (p.composite_task_id) {
      const task = compositeMap[p.composite_task_id];
      const contract = task?.contract_id ? contractMap[Number(task.contract_id)] : null;
      const rawAdType = contract?.['Ad Type'] || '';
      const adTypeClean = rawAdType && rawAdType !== 'لوحة إعلانية' ? String(rawAdType).trim() : '';
      const components: string[] = [];
      if (task?.print_task_id) components.push('طباعة');
      if (task?.cutout_task_id) components.push('قص');
      if (task?.installation_task_id) components.push('تركيب');
      const taskComponents = components.length ? components.join(' + ') : 'مهمة مجمعة';
      const description = adTypeClean
        ? (adTypeClean.includes('طباعة') || adTypeClean.includes('تركيب') ? adTypeClean : `${adTypeClean} (${taskComponents})`)
        : taskComponents;
      return {
        contractNumber: compositeTaskLabel({
          id: task?.id || p.composite_task_id,
          task_number: task?.task_number,
          contract_id: task?.contract_id,
          task_type: task?.task_type,
          reinstallation_number: task?.reinstallation_number,
          installation_task_id: task?.installation_task_id,
        } as any),
        compositeTaskId: p.composite_task_id,
        installationTaskId: task?.installation_task_id,
        adType: description,
        rawAdType: adTypeClean || undefined,
        taskComponents,
        contractId: task?.contract_id ? Number(task.contract_id) : undefined,
        amount: n(p.amount),
        total: task?.customer_total ?? null,
        totalPaid: task?.paid_amount ?? null,
        remaining: task?.calculatedRemaining ?? null,
        entityType: 'composite_task' as const,
        compositeTaskType: description,
      };
    }
    if (p.sales_invoice_id) {
      const inv = salesMap[p.sales_invoice_id];
      return {
        contractNumber: inv?.invoice_number ? (String(inv.invoice_number).startsWith('فاتورة') ? String(inv.invoice_number) : `فاتورة مبيعات #${inv.invoice_number}`) : 'فاتورة مبيعات',
        adType: inv?.invoice_name || inv?.notes || 'مبيعات',
        amount: n(p.amount),
        total: inv?.total_amount ?? null,
        totalPaid: inv?.paid_amount ?? null,
        remaining: inv?.calculatedRemaining ?? null,
        entityType: 'sales_invoice' as const,
      };
    }
    if (p.printed_invoice_id) {
      const inv = printedMap[p.printed_invoice_id];
      return {
        contractNumber: inv?.invoice_number ? (String(inv.invoice_number).startsWith('فاتورة') ? String(inv.invoice_number) : `فاتورة طباعة #${inv.invoice_number}`) : 'فاتورة طباعة',
        adType: inv?.notes || 'طباعة',
        amount: n(p.amount),
        total: inv?.total_amount ?? null,
        totalPaid: inv?.paid_amount ?? null,
        remaining: inv?.calculatedRemaining ?? null,
        entityType: 'printed_invoice' as const,
      };
    }
    if (!p.contract_number) {
      return {
        contractNumber: 'رصيد فائض (غير موزع)',
        adType: p.distributed_payment_id
          ? (p.notes?.replace(/^توزيع على.*?- /g, '') || 'فائض سداد متبقي في حساب العميل')
          : 'دفعة على الحساب العام',
        amount: n(p.amount),
        total: null,
        totalPaid: null,
        remaining: null,
        entityType: 'general_credit' as const,
      };
    }
    const cn = Number(p.contract_number);
    const c = contractMap[cn];
    return {
      contractNumber: String(p.contract_number),
      contractId: cn || undefined,
      adType: c?.['Ad Type'] || 'لوحة إعلانية',
      amount: n(p.amount),
      total: c?.Total ?? null,
      totalPaid: c?.calculatedPaid ?? null,
      remaining: c?.calculatedRemaining ?? null,
      entityType: 'contract' as const,
    };
  });
}
