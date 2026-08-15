import { supabase } from '@/integrations/supabase/client';

/**
 * تنظيف بيانات اللوحات التي تمت إزالتها من العقود
 * هذه الدالة تتحقق من أن اللوحات التي لها Contract_Number موجودة فعلاً في billboard_ids للعقد
 * إذا لم تكن موجودة، تحذف بيانات العقد من اللوحة
 */
export async function cleanupOrphanedBillboards() {
  console.log('🧹 Starting cleanup of orphaned billboards...');
  
  try {
    // جلب جميع اللوحات التي لها Contract_Number
    const { data: billboards, error: billboardsError } = await supabase
      .from('billboards')
      .select('ID, Contract_Number')
      .not('Contract_Number', 'is', null);

    if (billboardsError) {
      console.error('❌ Error fetching billboards:', billboardsError);
      throw billboardsError;
    }

    if (!billboards || billboards.length === 0) {
      console.log('✅ No billboards with contracts found');
      return { cleaned: 0, total: 0 };
    }

    console.log(`📊 Found ${billboards.length} billboards with contracts`);

    // تجميع اللوحات حسب رقم العقد
    const billboardsByContract = new Map<number, number[]>();
    for (const billboard of billboards) {
      const contractNum = billboard.Contract_Number;
      if (!billboardsByContract.has(contractNum)) {
        billboardsByContract.set(contractNum, []);
      }
      billboardsByContract.get(contractNum)!.push(billboard.ID);
    }

    console.log(`📊 Checking ${billboardsByContract.size} unique contracts`);

    // جلب بيانات العقود
    const contractNumbers = Array.from(billboardsByContract.keys());
    const { data: contracts, error: contractsError } = await supabase
      .from('Contract')
      .select('Contract_Number, billboard_ids')
      .in('Contract_Number', contractNumbers);

    if (contractsError) {
      console.error('❌ Error fetching contracts:', contractsError);
      throw contractsError;
    }

    // تحليل billboard_ids من كل عقد
    const contractBillboards = new Map<number, string[]>();
    const contractsList = contracts || [];
    for (const contract of contractsList) {
      let billboardIds: string[] = [];
      
      if (contract.billboard_ids) {
        if (typeof contract.billboard_ids === 'string') {
          billboardIds = contract.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean);
        } else if (Array.isArray(contract.billboard_ids)) {
          billboardIds = (contract.billboard_ids as any[]).map((id: any) => String(id).trim()).filter(Boolean);
        }
      }
      
      contractBillboards.set(contract.Contract_Number, billboardIds);
    }

    // تحديد اللوحات التي يجب تنظيفها
    const billboardsToClean: number[] = [];
    
    for (const [contractNum, billboardIds] of billboardsByContract.entries()) {
      const contractBillboardIds = contractBillboards.get(contractNum) || [];
      
      for (const billboardId of billboardIds) {
        const billboardIdStr = String(billboardId);
        if (!contractBillboardIds.includes(billboardIdStr)) {
          console.log(`🧹 Billboard ${billboardId} not in contract ${contractNum} billboard_ids`);
          billboardsToClean.push(billboardId);
        }
      }
    }

    if (billboardsToClean.length === 0) {
      console.log('✅ No orphaned billboards found');
      return { cleaned: 0, total: billboards.length };
    }

    console.log(`🧹 Cleaning ${billboardsToClean.length} orphaned billboards:`, billboardsToClean);

    // تنظيف اللوحات
    const { error: cleanupError } = await supabase
      .from('billboards')
      .update({
        Status: 'متاح',
        Contract_Number: null,
        Customer_Name: null,
        Ad_Type: null,
        Rent_Start_Date: null,
        Rent_End_Date: null,
      })
      .in('ID', billboardsToClean);

    if (cleanupError) {
      console.error('❌ Error cleaning billboards:', cleanupError);
      throw cleanupError;
    }

    console.log(`✅ Successfully cleaned ${billboardsToClean.length} billboards`);
    
    return {
      cleaned: billboardsToClean.length,
      total: billboards.length,
      cleanedIds: billboardsToClean
    };
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

/**
 * تنظيف لوحة واحدة محددة
 */
export async function cleanupSingleBillboard(billboardId: number) {
  console.log(`🧹 Cleaning billboard ${billboardId}...`);
  
  try {
    // جلب بيانات اللوحة
    const { data: billboard, error: billboardError } = await supabase
      .from('billboards')
      .select('ID, Contract_Number')
      .eq('ID', billboardId)
      .single();

    if (billboardError) {
      console.error('❌ Error fetching billboard:', billboardError);
      throw billboardError;
    }

    if (!billboard.Contract_Number) {
      console.log('✅ Billboard has no contract, nothing to clean');
      return { cleaned: false, reason: 'no_contract' };
    }

    // جلب العقد
    const { data: contract, error: contractError } = await supabase
      .from('Contract')
      .select('billboard_ids')
      .eq('Contract_Number', billboard.Contract_Number)
      .single();

    if (contractError) {
      console.error('❌ Error fetching contract:', contractError);
      throw contractError;
    }

    // تحليل billboard_ids
    let billboardIds: string[] = [];
    if (contract.billboard_ids) {
      if (typeof contract.billboard_ids === 'string') {
        billboardIds = contract.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean);
      } else if (Array.isArray(contract.billboard_ids)) {
        billboardIds = (contract.billboard_ids as any[]).map((id: any) => String(id).trim()).filter(Boolean);
      }
    }

    // تحقق من وجود اللوحة في العقد
    if (billboardIds.includes(String(billboardId))) {
      console.log('✅ Billboard is still in contract, no cleanup needed');
      return { cleaned: false, reason: 'in_contract' };
    }

    // تنظيف اللوحة
    console.log(`🧹 Billboard ${billboardId} not in contract, cleaning...`);
    const { error: cleanupError } = await supabase
      .from('billboards')
      .update({
        Status: 'متاح',
        Contract_Number: null,
        Customer_Name: null,
        Ad_Type: null,
        Rent_Start_Date: null,
        Rent_End_Date: null,
      })
      .eq('ID', billboardId);

    if (cleanupError) {
      console.error('❌ Error cleaning billboard:', cleanupError);
      throw cleanupError;
    }

    console.log(`✅ Successfully cleaned billboard ${billboardId}`);
    return { cleaned: true, reason: 'success' };
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}
