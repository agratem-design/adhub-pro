// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

/**
 * Helper to update billboard_ids in the Contract table.
 * Handles adding/removing a billboard ID from the comma-separated string.
 */

// Remove a billboard ID from a contract's billboard_ids
export const removeBillboardIdFromContract = async (contractNumber: number, billboardId: number) => {
  const { data, error } = await supabase
    .from('Contract')
    .select('billboard_ids')
    .eq('Contract_Number', contractNumber)
    .single();

  if (error || !data) {
    console.warn('⚠️ Could not fetch contract for billboard_ids sync:', error);
    return;
  }

  const currentIds = data.billboard_ids
    ? data.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean)
    : [];

  const updatedIds = currentIds.filter((id: string) => String(id) !== String(billboardId));

  const { error: updateError } = await supabase
    .from('Contract')
    .update({ billboard_ids: updatedIds.length > 0 ? updatedIds.join(',') : null })
    .eq('Contract_Number', contractNumber);

  if (updateError) {
    console.error('❌ Error removing billboard from contract billboard_ids:', updateError);
    throw updateError;
  }

  console.log(`✅ Removed billboard ${billboardId} from contract ${contractNumber} billboard_ids`);
};

// Add a billboard ID to a contract's billboard_ids
export const addBillboardIdToContract = async (contractNumber: number, billboardId: number) => {
  const { data, error } = await supabase
    .from('Contract')
    .select('billboard_ids')
    .eq('Contract_Number', contractNumber)
    .single();

  if (error || !data) {
    console.warn('⚠️ Could not fetch contract for billboard_ids sync:', error);
    return;
  }

  const currentIds = data.billboard_ids
    ? data.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean)
    : [];

  // Don't add duplicates
  if (!currentIds.includes(String(billboardId))) {
    currentIds.push(String(billboardId));
  }

  const { error: updateError } = await supabase
    .from('Contract')
    .update({ billboard_ids: currentIds.join(',') })
    .eq('Contract_Number', contractNumber);

  if (updateError) {
    console.error('❌ Error adding billboard to contract billboard_ids:', updateError);
    throw updateError;
  }

  console.log(`✅ Added billboard ${billboardId} to contract ${contractNumber} billboard_ids`);
};

// Transfer a billboard between contracts securely and correctly reset the is_visible_in_available flag
export const transferBillboardToContract = async (
  billboardId: number, 
  oldContractNumber: number | null, 
  newContractNumber: number,
  newContractData: any
) => {
  // 1. Remove from old contract if exists
  if (oldContractNumber && Number(oldContractNumber) !== Number(newContractNumber)) {
    await removeBillboardIdFromContract(Number(oldContractNumber), Number(billboardId));
  }

  // 2. Add to new contract
  await addBillboardIdToContract(Number(newContractNumber), Number(billboardId));

  // 3. Update the billboard table with exact details and clear is_visible_in_available
  const { error: billboardError } = await supabase
    .from('billboards')
    .update({
      Contract_Number: Number(newContractNumber),
      Customer_Name: newContractData['Customer Name'] || newContractData.Customer_Name,
      Ad_Type: newContractData['Ad Type'] || newContractData.Ad_Type,
      Rent_Start_Date: newContractData['Contract Date'] || newContractData.Rent_Start_Date,
      Rent_End_Date: newContractData['End Date'] || newContractData.Rent_End_Date,
      Status: 'محجوز', // Set to rented / reserved
      is_visible_in_available: null // CRITICAL FIX: Always clear the flag so it doesn't carry over from previous contracts
    })
    .eq('ID', billboardId);
  
  if (billboardError) {
    console.error('❌ Error updating billboard during transfer:', billboardError);
    throw billboardError;
  }
  
  console.log(`✅ Successfully transferred billboard ${billboardId} to contract ${newContractNumber}`);
};
