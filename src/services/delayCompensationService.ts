import { supabase } from '@/integrations/supabase/client';

const MAX_INSTALL_DAYS = 15;

export interface BillboardDelayInfo {
  billboardId: number;
  billboardName: string;
  size: string;
  designName?: string;
  designDate: string;
  expectedDate: string;
  actualInstallDate: string;
  delayDays: number;
  billboardCost: number;
  weight: number;
  equivalentExtensionDays: number;
  dailyValue: number;
  financialValue: number;
}

export interface BillboardContractStartDelay {
  billboardId: number;
  billboardName: string;
  size: string;
  contractStartDate: string;
  actualInstallDate: string;
  daysFromStart: number;
  billboardCost: number;
  dailyValue: number;
  financialValue: number;
}

export interface ContractDelayResult {
  contractNumber: number;
  totalBillboards: number;
  delayedBillboards: number;
  onTimeBillboards: number;
  totalEquivalentExtensionDays: number;
  totalFinancialValue: number;
  suggestedNewEndDate: string | null;
  suggestedNewStartDate: string | null;
  originalEndDate: string | null;
  originalStartDate: string | null;
  contractStartDate: string | null;
  contractDurationDays: number;
  totalContractValue: number;
  delayCorrected: boolean;
  details: BillboardDelayInfo[];
  fromContractStart: {
    totalDaysLost: number;
    totalFinancialValue: number;
    weightedAvgDays: number;
    details: BillboardContractStartDelay[];
  };
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export async function calculateContractDelay(contractNumber: number): Promise<ContractDelayResult | null> {
  try {
    // 1. جلب بيانات العقد
    const { data: contract } = await supabase
      .from('Contract')
      .select('Contract_Number, "Contract Date", "End Date", "Total Rent", Total, billboard_ids, billboards_data, Duration, original_start_date, original_end_date, total_extension_days')
      .eq('Contract_Number', contractNumber)
      .single();

    if (!contract) return null;

    // استخدام التواريخ الأصلية (الثابتة) لحسابات التأخير — fallback للتواريخ الحالية
    const originalStart = (contract as any).original_start_date || contract['Contract Date'];
    const originalEnd = (contract as any).original_end_date || contract['End Date'];
    const currentStart = contract['Contract Date'];
    const currentEnd = contract['End Date'];

    if (!originalStart || !originalEnd) return null;

    const contractStartOriginal = parseLocalDate(originalStart);
    const contractEndOriginal = parseLocalDate(originalEnd);
    const contractDurationDays = Math.max(1, Math.ceil((contractEndOriginal.getTime() - contractStartOriginal.getTime()) / (1000 * 60 * 60 * 24)));
    const totalContractValue = Number(contract['Total Rent'] || contract.Total || 0);

    // 2. جلب مهام التركيب المرتبطة بالعقد (فقط التركيب الجديد)
    const { data: directTasks } = await supabase
      .from('installation_tasks')
      .select('id')
      .eq('contract_id', contractNumber)
      .or('task_type.is.null,task_type.neq.reinstallation');

    const { data: compositeTasks } = await supabase
      .from('composite_tasks')
      .select('installation_task_id')
      .eq('contract_id', contractNumber)
      .not('installation_task_id', 'is', null);

    const allTaskIds = new Set<string>();
    (directTasks || []).forEach(t => allTaskIds.add(t.id));
    (compositeTasks || []).forEach(t => { if (t.installation_task_id) allTaskIds.add(t.installation_task_id); });

    const emptyResult: ContractDelayResult = {
      contractNumber,
      totalBillboards: 0,
      delayedBillboards: 0,
      onTimeBillboards: 0,
      totalEquivalentExtensionDays: 0,
      totalFinancialValue: 0,
      suggestedNewEndDate: null,
      suggestedNewStartDate: null,
      originalEndDate: originalEnd,
      originalStartDate: originalStart,
      contractStartDate: currentStart,
      contractDurationDays,
      totalContractValue,
      delayCorrected: true,
      details: [],
      fromContractStart: { totalDaysLost: 0, totalFinancialValue: 0, weightedAvgDays: 0, details: [] },
    };

    if (allTaskIds.size === 0) return emptyResult;

    const taskIds = Array.from(allTaskIds);

    // 3. جلب عناصر المهام مع تفاصيل اللوحة
    const { data: items } = await supabase
      .from('installation_task_items')
      .select(`
        id, task_id, billboard_id, status, installation_date, selected_design_id,
        billboard:billboards!installation_task_items_billboard_id_fkey(Billboard_Name, Size, Price, Contract_Number)
      `)
      .in('task_id', taskIds);

    if (!items || items.length === 0) return emptyResult;

    // فلترة اللوحات التي تخص هذا العقد
    const contractBillboardIds = new Set<number>();
    if (contract.billboard_ids) {
      contract.billboard_ids.split(',').forEach((id: string) => {
        const num = Number(id.trim());
        if (Number.isFinite(num)) contractBillboardIds.add(num);
      });
    }

    const relevantItems = items.filter(item => {
      if (contractBillboardIds.size === 0) return true;
      if (item.billboard_id && contractBillboardIds.has(item.billboard_id)) return true;
      const bb = item.billboard as any;
      return bb?.Contract_Number === contractNumber;
    });

    // 4. جلب جميع التصاميم لجميع المهام
    const designIds = relevantItems
      .map(i => i.selected_design_id)
      .filter(Boolean) as string[];

    let designDates: Record<string, { created_at: string; name?: string }> = {};

    if (designIds.length > 0) {
      const { data: designs } = await supabase
        .from('task_designs')
        .select('id, created_at, design_name')
        .in('id', designIds);
      if (designs) {
        designs.forEach(d => { designDates[d.id] = { created_at: d.created_at, name: d.design_name || undefined }; });
      }
    }

    const { data: allTaskDesigns } = await supabase
      .from('task_designs')
      .select('id, task_id, created_at, design_name')
      .in('task_id', taskIds);

    const taskDesignsMap: Record<string, { id: string; created_at: string; design_name: string }[]> = {};
    if (allTaskDesigns) {
      allTaskDesigns.forEach(d => {
        if (!taskDesignsMap[d.task_id]) taskDesignsMap[d.task_id] = [];
        taskDesignsMap[d.task_id].push(d);
        if (!designDates[d.id]) {
          designDates[d.id] = { created_at: d.created_at, name: d.design_name || undefined };
        }
      });
    }

    // 5. حساب تكلفة كل لوحة من billboards_data
    let billboardCosts: Record<number, number> = {};
    if (contract.billboards_data) {
      try {
        const bbs = typeof contract.billboards_data === 'string'
          ? JSON.parse(contract.billboards_data)
          : contract.billboards_data;
        if (Array.isArray(bbs)) {
          bbs.forEach((b: any) => {
            const id = Number(b.id);
            const cost = Number(b.contractPrice || b.price || b.Price || b.rent || 0);
            if (id) billboardCosts[id] = cost;
          });
        }
      } catch {}
    }

    const uniqueBillboardIds = new Set(relevantItems.map(i => i.billboard_id).filter(Boolean));

    if (Object.keys(billboardCosts).length === 0 && uniqueBillboardIds.size > 0) {
      const perBillboard = totalContractValue / uniqueBillboardIds.size;
      uniqueBillboardIds.forEach((id: any) => {
        if (id) billboardCosts[id as string | number] = perBillboard;
      });
    }

    // 6. حساب التأخير لكل عنصر — يستخدم دائماً التاريخ الأصلي
    const details: BillboardDelayInfo[] = [];
    const today = new Date();
    const usedDesignIds = new Set<string>();

    for (const item of relevantItems) {
      let designInfo: { created_at: string; name?: string } | null = null;

      if (item.selected_design_id && designDates[item.selected_design_id]) {
        designInfo = designDates[item.selected_design_id];
      } else {
        const candidates = taskDesignsMap[item.task_id] || [];
        const sorted = [...candidates].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        for (const c of sorted) {
          if (!usedDesignIds.has(c.id)) {
            designInfo = { created_at: c.created_at, name: c.design_name || undefined };
            usedDesignIds.add(c.id);
            break;
          }
        }
      }

      if (!designInfo) continue;
      if (item.selected_design_id) usedDesignIds.add(item.selected_design_id);

      const designDate = new Date(designInfo.created_at);
      // *** التغيير الجوهري: نستخدم التاريخ الأصلي الثابت ***
      const referenceDate = contractStartOriginal > designDate ? contractStartOriginal : designDate;
      const expectedDate = new Date(referenceDate);
      expectedDate.setDate(expectedDate.getDate() + MAX_INSTALL_DAYS);

      const compareDate = item.installation_date ? new Date(item.installation_date) : today;
      const delayMs = compareDate.getTime() - expectedDate.getTime();
      const delayDays = Math.max(0, Math.ceil(delayMs / (1000 * 60 * 60 * 24)));

      const bb = item.billboard as any;
      const billboardCost = billboardCosts[item.billboard_id] || Number(bb?.Price || 0);
      const weight = totalContractValue > 0 ? billboardCost / totalContractValue : 0;
      const equivalentExtensionDays = weight * delayDays;
      const dailyValue = contractDurationDays > 0 ? billboardCost / contractDurationDays : 0;
      const financialValue = dailyValue * delayDays;

      details.push({
        billboardId: item.billboard_id,
        billboardName: bb?.Billboard_Name || `لوحة ${item.billboard_id}`,
        size: bb?.Size || '',
        designName: designInfo.name,
        designDate: designInfo.created_at,
        expectedDate: formatLocalDate(expectedDate),
        actualInstallDate: item.installation_date || 'لم يُركّب بعد',
        delayDays,
        billboardCost,
        weight,
        equivalentExtensionDays,
        dailyValue,
        financialValue,
      });
    }

    const delayedDetails = details.filter(d => d.delayDays > 0);
    const totalExtension = delayedDetails.reduce((s, d) => s + d.equivalentExtensionDays, 0);
    const totalFinancial = delayedDetails.reduce((s, d) => s + d.financialValue, 0);

    const delayedBillboardIds = new Set(delayedDetails.map(d => d.billboardId));
    const onTimeBillboardIds = new Set(
      details.filter(d => d.delayDays === 0).map(d => d.billboardId)
    );
    const pureOnTimeBillboards = [...onTimeBillboardIds].filter(id => !delayedBillboardIds.has(id));

    let suggestedNewEndDate: string | null = null;
    let suggestedNewStartDate: string | null = null;

    if (totalExtension > 0) {
      const delayDaysCeil = Math.ceil(totalExtension);
      // الاقتراحات تُحسب من التواريخ الأصلية دائماً
      const newStart = new Date(contractStartOriginal.getFullYear(), contractStartOriginal.getMonth(), contractStartOriginal.getDate() + delayDaysCeil);
      suggestedNewStartDate = formatLocalDate(newStart);

      const newEnd = new Date(contractEndOriginal.getFullYear(), contractEndOriginal.getMonth(), contractEndOriginal.getDate() + delayDaysCeil);
      suggestedNewEndDate = formatLocalDate(newEnd);
    }

    // Check billboard_extensions table
    const { data: extensions } = await supabase
      .from('billboard_extensions')
      .select('extension_days')
      .eq('contract_number', contractNumber);

    const totalGrantedExtension = (extensions || []).reduce(
      (sum, ext) => sum + (ext.extension_days || 0), 0
    );

    const billboardIds = [...uniqueBillboardIds];
    const { data: billboardEndDates } = await supabase
      .from('billboards')
      .select('ID, Rent_End_Date')
      .in('ID', billboardIds);

    let maxBillboardExtension = 0;
    if (billboardEndDates) {
      for (const bb of billboardEndDates) {
        if (bb.Rent_End_Date) {
          const bbEnd = new Date(bb.Rent_End_Date);
          const extraDays = Math.ceil((bbEnd.getTime() - contractEndOriginal.getTime()) / (1000 * 60 * 60 * 24));
          if (extraDays > maxBillboardExtension) maxBillboardExtension = extraDays;
        }
      }
    }

    const totalCompensation = Math.max(totalGrantedExtension, maxBillboardExtension);
    const delayCorrected = !suggestedNewEndDate || totalCompensation >= Math.ceil(totalExtension);

    // 7. حساب التأخير من بداية العقد — يستخدم التاريخ الأصلي
    const fromStartDetails: BillboardContractStartDelay[] = [];
    const processedForStart = new Set<number>();
    for (const item of relevantItems) {
      if (!item.billboard_id || processedForStart.has(item.billboard_id)) continue;
      processedForStart.add(item.billboard_id);

      const compareDate = item.installation_date ? new Date(item.installation_date) : today;
      const daysFromStart = Math.max(0, Math.ceil((compareDate.getTime() - contractStartOriginal.getTime()) / (1000 * 60 * 60 * 24)));
      const bb = item.billboard as any;
      const billboardCost = billboardCosts[item.billboard_id] || Number(bb?.Price || 0);
      const dailyValue = contractDurationDays > 0 ? billboardCost / contractDurationDays : 0;
      const financialValue = dailyValue * daysFromStart;

      fromStartDetails.push({
        billboardId: item.billboard_id,
        billboardName: bb?.Billboard_Name || `لوحة ${item.billboard_id}`,
        size: bb?.Size || '',
        contractStartDate: originalStart,
        actualInstallDate: item.installation_date || 'لم يُركّب بعد',
        daysFromStart,
        billboardCost,
        dailyValue,
        financialValue,
      });
    }

    const totalDaysLost = fromStartDetails.reduce((s, d) => s + d.daysFromStart, 0);
    const totalFromStartFinancial = fromStartDetails.reduce((s, d) => s + d.financialValue, 0);
    const totalCostOfFromStart = fromStartDetails.reduce((s, d) => s + d.billboardCost, 0);
    const weightedAvgDays = totalCostOfFromStart > 0
      ? fromStartDetails.reduce((s, d) => s + d.daysFromStart * (d.billboardCost / totalCostOfFromStart), 0)
      : 0;

    return {
      contractNumber,
      totalBillboards: uniqueBillboardIds.size,
      delayedBillboards: delayedBillboardIds.size,
      onTimeBillboards: pureOnTimeBillboards.length,
      totalEquivalentExtensionDays: Math.round(totalExtension * 10) / 10,
      totalFinancialValue: Math.round(totalFinancial * 100) / 100,
      suggestedNewEndDate,
      suggestedNewStartDate,
      originalEndDate: originalEnd,
      originalStartDate: originalStart,
      contractStartDate: currentStart,
      contractDurationDays,
      totalContractValue,
      delayCorrected,
      details: delayedDetails,
      fromContractStart: {
        totalDaysLost,
        totalFinancialValue: Math.round(totalFromStartFinancial * 100) / 100,
        weightedAvgDays: Math.round(weightedAvgDays * 10) / 10,
        details: fromStartDetails.filter(d => d.daysFromStart > 0),
      },
    };
  } catch (error) {
    console.error('Error calculating contract delay:', error);
    return null;
  }
}

/**
 * تطبيق التمديد على العقد — يحدّث Contract Date و End Date و total_extension_days
 * لا يمس original_start_date و original_end_date أبداً (محمية بـ trigger)
 */
export async function applyContractExtension(contractNumber: number): Promise<{ success: boolean; extensionDays: number } | null> {
  const result = await calculateContractDelay(contractNumber);
  if (!result || !result.originalStartDate || !result.originalEndDate) return null;

  const extensionDays = Math.ceil(result.totalEquivalentExtensionDays);
  if (extensionDays <= 0) return { success: true, extensionDays: 0 };

  const origStart = parseLocalDate(result.originalStartDate);
  const origEnd = parseLocalDate(result.originalEndDate);

  const newStart = new Date(origStart);
  newStart.setDate(newStart.getDate() + extensionDays);

  const newEnd = new Date(origEnd);
  newEnd.setDate(newEnd.getDate() + extensionDays);

  const { error } = await supabase
    .from('Contract')
    .update({
      'Contract Date': formatLocalDate(newStart),
      'End Date': formatLocalDate(newEnd),
      total_extension_days: extensionDays,
    } as any)
    .eq('Contract_Number', contractNumber);

  if (error) {
    console.error('Error applying contract extension:', error);
    return null;
  }

  return { success: true, extensionDays };
}
