import { supabase } from '@/integrations/supabase/client';

export interface ContractHistoryRecord {
  id: string;
  contract_number: number;
  action: string;
  snapshot: any;
  change_summary: string | null;
  changed_by: string | null;
  created_at: string;
}

export const getContractHistory = async (contractNumber: number): Promise<ContractHistoryRecord[]> => {
  const { data, error } = await supabase
    .from('contract_history')
    .select('*')
    .eq('contract_number', contractNumber)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching contract history:', error);
    throw error;
  }

  return data as ContractHistoryRecord[];
};

export const restoreContractSnapshot = async (snapshot: any, currentContractNumber: number) => {
  // Restore contract base details
  const { Contract_Number, id, created_at, updated_at, ...updateData } = snapshot;
  
  const { error: contractError } = await supabase
    .from('Contract')
    .update(updateData)
    .eq('Contract_Number', currentContractNumber);

  if (contractError) throw contractError;

  // Restore billboards. First, remove from current contract what's not in the snapshot
  const { data: currentContract } = await supabase
    .from('Contract')
    .select('billboard_ids')
    .eq('Contract_Number', currentContractNumber)
    .single();

  const currentIds = currentContract?.billboard_ids
    ? currentContract.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean)
    : [];

  const snapshotIds = snapshot.billboard_ids
    ? snapshot.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean)
    : [];

  // Remove billboards that are not in snapshot
  const toRemove = currentIds.filter((id: string) => !snapshotIds.includes(id));
  if (toRemove.length > 0) {
    const { error: removeError } = await supabase
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
      .in('ID', toRemove.map(Number));
    if (removeError) throw removeError;
  }

  // Add billboards that are in snapshot
  if (snapshotIds.length > 0) {
    const { error: addError } = await supabase
      .from('billboards')
      .update({
        Contract_Number: currentContractNumber,
        Customer_Name: snapshot['Customer Name'] || snapshot.Customer_Name,
        Ad_Type: snapshot['Ad Type'] || snapshot.Ad_Type,
        Rent_Start_Date: snapshot['Contract Date'] || snapshot.Rent_Start_Date,
        Rent_End_Date: snapshot['End Date'] || snapshot.Rent_End_Date,
        Status: 'محجوز',
        is_visible_in_available: null
      })
      .in('ID', snapshotIds);
    if (addError) throw addError;
  }

  // Log restore action
  await supabase
    .from('contract_history')
    .insert({
      contract_number: currentContractNumber,
      action: 'RESTORE',
      snapshot: snapshot,
      change_summary: 'تم استرجاع النسخة السابقة'
    });

  return true;
};
