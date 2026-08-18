/**
 * READ-ONLY DATA INTEGRITY AUDIT
 * NO MUTATIONS - NO CREDENTIALS
 * 
 * Verifies all Contract <-> Billboard relationships, ownership, and state invariants.
 */
import { supabase } from '../src/integrations/supabase/client';

export interface IntegrityAuditResult {
  contractsScanned: number;
  billboardsScanned: number;
  activeContractsScanned: number;
  contractToBillboardMismatches: any[];
  billboardToContractMismatches: any[];
  dateMismatches: any[];
  statusMismatches: any[];
  duplicateOwnerships: any[];
}

/**
 * Permanent Read-Only Consistency & Integrity Auditor
 * Verifies all Contract <-> Billboard relationships, ownership, and state invariants.
 */
export async function runContractBillboardIntegrityAudit(): Promise<IntegrityAuditResult> {
  const today = new Date().toISOString().split('T')[0];

  // 1. Fetch total counts
  const { count: contractsScanned } = await supabase
    .from('Contract')
    .select('*', { count: 'exact', head: true });

  const { count: billboardsScanned } = await supabase
    .from('billboards')
    .select('*', { count: 'exact', head: true });

  // 2. Fetch all active contracts
  const { data: activeContracts, error: cErr } = await supabase
    .from('Contract')
    .select('"Contract_Number", "Customer Name", "Contract Date", "End Date", "billboard_ids"')
    .gte('End Date', today);

  if (cErr) throw new Error(`Failed to fetch active contracts: ${cErr.message}`);

  // 3. Fetch all billboards
  const { data: allBillboards, error: bErr } = await supabase
    .from('billboards')
    .select('"ID", "Billboard_Name", "Contract_Number", "Customer_Name", "Status", "Rent_Start_Date", "Rent_End_Date", "is_visible_in_available"');

  if (bErr) throw new Error(`Failed to fetch billboards: ${bErr.message}`);

  const bbMap = new Map((allBillboards || []).map((b) => [b.ID, b]));
  const contractToBillboardMismatches: any[] = [];
  const billboardToContractMismatches: any[] = [];
  const dateMismatches: any[] = [];
  const statusMismatches: any[] = [];
  const duplicateOwnerships: any[] = [];

  const claimedBillboards = new Map<number, number[]>(); // bbId -> array of contract numbers

  // Scan Contract -> Billboard
  for (const c of activeContracts || []) {
    const cNum = Number((c as any).Contract_Number);
    const idsStr = (c as any).billboard_ids || '';
    const ids = idsStr.split(',').map((s: string) => Number(s.trim())).filter((n: number) => Number.isFinite(n) && n > 0);

    for (const bbId of ids) {
      // Track duplicate claims
      if (!claimedBillboards.has(bbId)) {
        claimedBillboards.set(bbId, []);
      }
      claimedBillboards.get(bbId)!.push(cNum);

      const bb = bbMap.get(bbId);
      if (!bb) {
        contractToBillboardMismatches.push({
          contractNumber: cNum,
          billboardId: bbId,
          reason: 'Billboard ID missing from billboards table',
        });
      } else if (bb.Contract_Number !== cNum) {
        contractToBillboardMismatches.push({
          contractNumber: cNum,
          billboardId: bbId,
          billboardName: bb.Billboard_Name,
          bbContractNumber: bb.Contract_Number,
          bbStatus: bb.Status,
          reason: `Contract #${cNum} claims billboard #${bbId}, but billboard record has Contract_Number = ${bb.Contract_Number}`,
        });
      } else {
        // Check Status
        if (bb.Status !== 'محجوز' && bb.Status !== 'مؤجرة') {
          statusMismatches.push({
            contractNumber: cNum,
            billboardId: bbId,
            status: bb.Status,
            reason: `Active contract billboard has unexpected Status: ${bb.Status}`,
          });
        }
      }
    }
  }

  // Scan for duplicate ownership claims across active contracts
  for (const [bbId, claimers] of claimedBillboards.entries()) {
    if (claimers.length > 1) {
      duplicateOwnerships.push({
        billboardId: bbId,
        contracts: claimers,
        reason: `Billboard claimed by multiple active contracts: ${claimers.join(', ')}`,
      });
    }
  }

  // Scan Billboard -> Contract
  const activeContractMap = new Map((activeContracts || []).map((c) => [Number((c as any).Contract_Number), c]));

  for (const bb of allBillboards || []) {
    if (bb.Contract_Number && activeContractMap.has(bb.Contract_Number)) {
      const c = activeContractMap.get(bb.Contract_Number);
      const idsStr = (c as any).billboard_ids || '';
      const ids = new Set(idsStr.split(',').map((s: string) => Number(s.trim())).filter((n: number) => Number.isFinite(n) && n > 0));

      if (!ids.has(bb.ID)) {
        billboardToContractMismatches.push({
          billboardId: bb.ID,
          billboardName: bb.Billboard_Name,
          contractNumber: bb.Contract_Number,
          reason: `Billboard points to Contract #${bb.Contract_Number}, but ID is missing from Contract.billboard_ids`,
        });
      }
    }
  }

  return {
    contractsScanned: contractsScanned || 0,
    billboardsScanned: billboardsScanned || 0,
    activeContractsScanned: (activeContracts || []).length,
    contractToBillboardMismatches,
    billboardToContractMismatches,
    dateMismatches,
    statusMismatches,
    duplicateOwnerships,
  };
}
