import { supabase } from '@/integrations/supabase/client';

export interface PauseCalculationResult {
  billboardPrice: number;
  printShareTotal: number;
  installShareTotal: number;
  netRent: number;
  totalDays: number;
  elapsedDays: number;
  dueRent: number;
  amountConsumed: number;
  unusedRefund: number;
}

export const calculateBillboardPauseValue = (
  pauseDate: string,
  rentStartDate: string,
  contractEndDate: string,
  billboardPrice: number,
  printCost: number = 0,
  installCost: number = 0,
  includePrint: boolean = false,
  includeInstall: boolean = false
): PauseCalculationResult => {
  const printShareTotal = includePrint ? printCost : 0;
  const installShareTotal = includeInstall ? installCost : 0;
  
  const netRent = billboardPrice - printShareTotal - installShareTotal;
  
  const start = new Date(rentStartDate);
  const end = new Date(contractEndDate);
  const pause = new Date(pauseDate);
  
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.ceil((pause.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Calculate relative rent
  const dueRent = netRent * (Math.min(elapsedDays, totalDays) / totalDays);
  
  const amountConsumed = dueRent + printShareTotal + installShareTotal;
  const unusedRefund = Math.max(0, billboardPrice - amountConsumed);
  
  return {
    billboardPrice,
    printShareTotal,
    installShareTotal,
    netRent,
    totalDays,
    elapsedDays,
    dueRent,
    amountConsumed,
    unusedRefund
  };
};

export const pauseBillboardFromContract = async (
  billboardId: number,
  contractNumber: number,
  pauseDate: string,
  notes: string,
  refundAmount: number,
  deductFromContract: boolean
) => {
  const numBillboardId = Number(billboardId);
  const numContractNumber = Number(contractNumber);

  // 1. Get current contract info & installation tasks in parallel (saves 1 round trip)
  const [contractRes, installationItemsRes] = await Promise.all([
    supabase
      .from('Contract')
      .select('*')
      .eq('Contract_Number', contractNumber)
      .single(),
    supabase
      .from('installation_task_items')
      .select('design_face_a, design_face_b, selected_design_id, installed_image_face_a_url, installed_image_face_b_url, installation_date, installation_tasks(contract_number, team_id, installation_teams(team_name))')
      .eq('billboard_id', numBillboardId)
  ]);

  if (contractRes.error) throw contractRes.error;
  const contract = contractRes.data;

  // 2. Update the contract
  const currentIds = contract.billboard_ids
    ? contract.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean)
    : [];
  
  const updatedIds = currentIds.filter((id: string) => String(id) !== String(billboardId));

  const contractUpdates: any = {
    billboard_ids: updatedIds.length > 0 ? updatedIds.join(',') : null,
  };

  // 3. Update the contract & billboard in parallel, and select updated billboard details (saves 2 round trips)
  const [updateContractRes, updateBillboardRes] = await Promise.all([
    supabase
      .from('Contract')
      .update(contractUpdates)
      .eq('Contract_Number', contractNumber),
    supabase
      .from('billboards')
      .update({
        Contract_Number: null,
        Customer_Name: null,
        Ad_Type: null,
        Rent_Start_Date: null,
        Rent_End_Date: null,
        Status: 'متاح',
        is_visible_in_available: null
      })
      .eq('ID', billboardId)
      .select('*')
      .single()
  ]);

  if (updateContractRes.error) throw updateContractRes.error;
  if (updateBillboardRes.error) throw updateBillboardRes.error;

  const bb = updateBillboardRes.data;

  // Fetch installation task details (if any) to populate designs/images/team
  let teamName = '';
  let designA = bb?.design_face_a || '';
  let designB = bb?.design_face_b || '';
  let installedA = '';
  let installedB = '';
  let installationDate = '';

  try {
    const items = installationItemsRes.data;
    const contractItem = items?.find(
      (item: any) => Number(item?.installation_tasks?.contract_number) === numContractNumber
    );

    if (contractItem) {
      teamName = contractItem.installation_tasks?.installation_teams?.team_name || '';
      installedA = contractItem.installed_image_face_a_url || '';
      installedB = contractItem.installed_image_face_b_url || '';
      installationDate = contractItem.installation_date || '';

      if (contractItem.selected_design_id) {
        const { data: designObj } = await supabase
          .from('task_designs')
          .select('design_face_a_url, design_face_b_url')
          .eq('id', contractItem.selected_design_id)
          .maybeSingle();
        if (designObj) {
          designA = designObj.design_face_a_url || '';
          designB = designObj.design_face_b_url || '';
        }
      }

      if (!designA && contractItem.design_face_a) designA = contractItem.design_face_a;
      if (!designB && contractItem.design_face_b) designB = contractItem.design_face_b;
    }
  } catch (err) {
    console.warn('Error fetching installation task item details:', err);
  }

  // Calculate prices
  let priceBeforeDiscount = 0;
  let discountPerBillboard = 0;
  let printCost = 0;
  let installationCost = 0;
  let pricingCategory = '';
  let pricingMode = '';
  
  if (contract.billboard_prices) {
    try {
      const prices = typeof contract.billboard_prices === 'string'
        ? JSON.parse(contract.billboard_prices)
        : contract.billboard_prices;
      if (Array.isArray(prices)) {
        const pObj = prices.find((p: any) => String(p.billboardId ?? p.id) === String(billboardId));
        if (pObj) {
          priceBeforeDiscount = Number(pObj.priceBeforeDiscount ?? pObj.baseRental ?? pObj.contractPrice ?? 0);
          discountPerBillboard = Number(pObj.discountPerBillboard ?? 0);
          printCost = Number(pObj.printCost ?? 0);
          installationCost = Number(pObj.installationCost ?? pObj.installationPrice ?? 0);
          pricingCategory = pObj.pricingCategory || '';
          pricingMode = pObj.pricingMode || '';
        }
      }
    } catch (e) {
      console.warn('Error parsing contract.billboard_prices', e);
    }
  }
  
  if (priceBeforeDiscount === 0) {
    const count = contract.billboard_ids ? contract.billboard_ids.split(',').length : 1;
    priceBeforeDiscount = Number(contract['Total Rent'] || 0) / count;
    discountPerBillboard = Number(contract['Discount'] || 0) / count;
    installationCost = Number(contract.installation_cost || 0) / count;
    printCost = Number(contract.print_cost || 0) / count;
  }

  const durationText = contract.Duration || '0';
  const durationDays = parseInt(durationText.replace(/[^0-9]/g, '')) || 0;

  const includeInstall = contract.include_installation_in_price || false;
  const includePrint = contract.include_print_in_billboard_price || false;

  // finalAmount before pause
  const baseRentalAfterDiscount = priceBeforeDiscount - discountPerBillboard;
  const individualInstallCharged = includeInstall ? 0 : installationCost;
  const individualPrintCharged = includePrint ? 0 : printCost;
  const originalRentAmount = baseRentalAfterDiscount + individualInstallCharged + individualPrintCharged;

  const originalNetRental = baseRentalAfterDiscount - (includeInstall ? installationCost : 0) - (includePrint ? printCost : 0);

  // After pause adjustment
  const finalRentAmount = originalRentAmount - refundAmount;
  const finalNetRental = originalNetRental - refundAmount;
  const discountPct = priceBeforeDiscount > 0 ? (discountPerBillboard / priceBeforeDiscount) * 100 : 0;

  // 4. Log to billboard_history
  try {
    const { data: existingHistory } = await supabase
      .from('billboard_history')
      .select('id, notes, individual_billboard_data')
      .eq('billboard_id', numBillboardId)
      .eq('contract_number', numContractNumber)
      .maybeSingle();

    const existingData = existingHistory?.individual_billboard_data
      ? (typeof existingHistory.individual_billboard_data === 'string'
          ? JSON.parse(existingHistory.individual_billboard_data)
          : existingHistory.individual_billboard_data)
      : {};

    const updatedData = {
      ...existingData,
      type: 'pause',
      refundAmount,
      pauseDate,
      originalRentAmount,
      originalNetRental
    };

    const historyRow = {
      billboard_id: numBillboardId,
      contract_number: numContractNumber,
      customer_name: contract['Customer Name'] || '',
      ad_type: contract['Ad Type'] || '',
      start_date: (bb as any)?.Rent_Start_Date || (contract as any)['Contract Date'] || (contract as any)['Start Date'] || (contract as any).Rent_Start_Date || '',
      end_date: pauseDate,
      duration_days: durationDays,
      rent_amount: finalRentAmount,
      billboard_rent_price: bb?.Price || priceBeforeDiscount,
      discount_amount: discountPerBillboard,
      discount_percentage: discountPct,
      installation_cost: installationCost,
      total_before_discount: priceBeforeDiscount,
      print_cost: printCost,
      include_installation_in_price: includeInstall,
      include_print_in_price: includePrint,
      pricing_category: pricingCategory,
      pricing_mode: pricingMode,
      contract_total: contract.Total || 0,
      contract_total_rent: contract['Total Rent'] || 0,
      contract_discount: contract.Discount || 0,
      installation_date: installationDate || contract['Contract Date'] || new Date().toISOString().split('T')[0],
      design_face_a_url: designA,
      design_face_b_url: designB,
      installed_image_face_a_url: installedA,
      installed_image_face_b_url: installedB,
      team_name: teamName,
      notes: existingHistory
        ? (existingHistory.notes ? `${existingHistory.notes} | إيقاف: ${notes}` : `إيقاف: ${notes}`)
        : `إيقاف مبكر — ${notes}`,
      individual_billboard_data: updatedData,
      net_rental_amount: finalNetRental
    };

    const originalPrice = Number(bb?.Price || 0);
    const fullPrice = Math.max(0, originalPrice);

    const historyPromise = existingHistory
      ? supabase
          .from('billboard_history')
          .update(historyRow)
          .eq('id', existingHistory.id)
      : supabase
          .from('billboard_history')
          .insert(historyRow);

    const pausedPromise = supabase
      .from('paused_billboards' as any)
      .insert({
        contract_number: contractNumber,
        billboard_id: billboardId,
        billboard_name: bb?.Billboard_Name || null,
        pause_date: pauseDate,
        original_price: originalPrice,
        net_rent: fullPrice,
        full_price: fullPrice,
        consumed_amount: Math.max(0, fullPrice - refundAmount),
        refund_amount: refundAmount,
        manual_refund: refundAmount,
        // ✅ snapshot original contract dates so day-counters stay correct
        original_start_date: contract['Contract Date'] || null,
        original_end_date: contract['End Date'] || null,
        deducted_from_contract: !!deductFromContract,
        notes: notes || null,
      });

    const [historyRes, pausedRes] = await Promise.all([historyPromise, pausedPromise]);
    if (historyRes.error) console.error('Error with billboard_history:', historyRes.error);
    if (pausedRes.error) console.error('Error inserting into paused_billboards:', pausedRes.error);
  } catch (err) {
    console.error('Error in saving pause metadata:', err);
  }

  return true;
};

export const autoPauseBillboardFromActiveContract = async (
  billboardId: number,
  oldContractNumber: number,
  pauseDateStr: string
) => {
  // 1. Get the old contract info
  const { data: contractData, error: contractError } = await supabase
    .from('Contract')
    .select('*')
    .eq('Contract_Number', oldContractNumber)
    .single();

  if (contractError) throw contractError;
  const contract = contractData as any;

  // 2. Determine billboard prices and dates
  let priceBeforeDiscount = 0;
  let discountPerBillboard = 0;
  let printCost = 0;
  let installationCost = 0;
  
  if (contract.billboard_prices) {
    try {
      const prices = typeof contract.billboard_prices === 'string'
        ? JSON.parse(contract.billboard_prices)
        : contract.billboard_prices;
      if (Array.isArray(prices)) {
        const pObj = prices.find((p: any) => String(p.billboardId ?? p.id) === String(billboardId));
        if (pObj) {
          priceBeforeDiscount = Number(pObj.priceBeforeDiscount ?? pObj.baseRental ?? pObj.contractPrice ?? 0);
          discountPerBillboard = Number(pObj.discountPerBillboard ?? 0);
          printCost = Number(pObj.printCost ?? 0);
          installationCost = Number(pObj.installationCost ?? pObj.installationPrice ?? 0);
        }
      }
    } catch (e) {
      console.warn('Error parsing contract.billboard_prices', e);
    }
  }
  
  if (priceBeforeDiscount === 0) {
    const count = contract.billboard_ids ? contract.billboard_ids.split(',').length : 1;
    priceBeforeDiscount = Number(contract['Total Rent'] || 0) / count;
    discountPerBillboard = Number(contract['Discount'] || 0) / count;
    installationCost = Number(contract.installation_cost || 0) / count;
    printCost = Number(contract.print_cost || 0) / count;
  }

  const includeInstall = contract.include_installation_in_price || false;
  const includePrint = contract.include_print_in_billboard_price || false;
  
  const billboardPrice = priceBeforeDiscount - discountPerBillboard + (includeInstall ? 0 : installationCost) + (includePrint ? 0 : printCost);

  // We need the rent start date of this billboard in the old contract.
  const rentStartDate = contract['Contract Date'] || contract['Start Date'] || new Date().toISOString().split('T')[0];
  const contractEndDate = contract['End Date'] || new Date().toISOString().split('T')[0];

  // Calculate the refund amount using the same formula
  const result = calculateBillboardPauseValue(
    pauseDateStr,
    rentStartDate,
    contractEndDate,
    billboardPrice,
    printCost,
    installationCost,
    includePrint,
    includeInstall
  );

  // Deduct refundAmount from the old contract's total
  const oldContractTotal = Number(contract.Total || 0);
  const newContractTotal = Math.max(0, oldContractTotal - result.unusedRefund);
  
  // Update old contract's total in DB
  const { error: updateOldContractError } = await supabase
    .from('Contract')
    .update({ 
      Total: newContractTotal,
      notes: contract.notes ? `${contract.notes} | تم إيقاف لوحة ${billboardId} ونقلها لعقد آخر` : `إيقاف لوحة ${billboardId} ونقلها لعقد آخر`
    } as any)
    .eq('Contract_Number', oldContractNumber);

  if (updateOldContractError) {
    console.error('Failed to update old contract total:', updateOldContractError);
  }

  await pauseBillboardFromContract(
    billboardId,
    oldContractNumber,
    pauseDateStr,
    `تم نقل اللوحة تلقائياً إلى عقد آخر`,
    result.unusedRefund,
    true
  );
};


