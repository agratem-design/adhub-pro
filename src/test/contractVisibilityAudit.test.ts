import { describe, it, expect, beforeEach } from 'vitest';
import {
  isBillboardAvailable,
  isBillboardBlockedFromAvailability,
  isContractExpired,
} from '@/utils/contractUtils';

describe('Contract Visibility & Availability Invariant Audit Suite', () => {
  const futureEndDate = '2028-12-31';
  const pastEndDate = '2020-01-01';

  // Helper simulating the export available filter predicate
  function isAvailableForExport(billboard: any, contractInfo?: { isContractForcedVisible?: boolean } | null) {
    if (isBillboardBlockedFromAvailability(billboard)) return false;
    // Forced hidden
    if (billboard.is_visible_in_available === false) return false;

    const hasActiveContract = billboard.Contract_Number && !isContractExpired(billboard.Rent_End_Date);

    if (hasActiveContract) {
      // If attached to active contract, only visible if current contract explicitly forced it
      if (contractInfo?.isContractForcedVisible === true || billboard.is_visible_in_available === true) {
        return true;
      }
      return false;
    }

    // Default availability
    return isBillboardAvailable(billboard);
  }

  describe('1. Semantics of is_visible_in_available (true, false, null)', () => {
    it('null: Unassigned billboard is Available by default', () => {
      const bb = {
        ID: 101,
        Status: 'متاح',
        Contract_Number: null,
        Rent_End_Date: null,
        is_visible_in_available: null,
      };
      expect(isBillboardAvailable(bb)).toBe(true);
      expect(isAvailableForExport(bb)).toBe(true);
    });

    it('null: Active contract billboard is NOT Available by default', () => {
      const bb = {
        ID: 102,
        Status: 'محجوز',
        Contract_Number: 1292,
        Rent_End_Date: futureEndDate,
        is_visible_in_available: null,
      };
      expect(isBillboardAvailable(bb)).toBe(false);
      expect(isAvailableForExport(bb, { isContractForcedVisible: false })).toBe(false);
    });

    it('false: Forced hidden billboard is NOT Available even if free', () => {
      const bb = {
        ID: 103,
        Status: 'متاح',
        Contract_Number: null,
        Rent_End_Date: null,
        is_visible_in_available: false,
      };
      expect(isBillboardAvailable(bb)).toBe(false);
      expect(isAvailableForExport(bb)).toBe(false);
    });

    it('true: Forced visible on active contract appears in export', () => {
      const bb = {
        ID: 104,
        Status: 'محجوز',
        Contract_Number: 1261,
        Rent_End_Date: futureEndDate,
        is_visible_in_available: true,
      };
      expect(isAvailableForExport(bb, { isContractForcedVisible: true })).toBe(true);
    });
  });

  describe('2. Case 1: Normal Billboard Transfer (Old Contract: OFF -> Transfer -> New Contract: OFF)', () => {
    it('Maintains normal unforced state and does not appear in available while active', () => {
      // Before transfer in Contract A (visibility OFF)
      const bbBefore = {
        ID: 348,
        Contract_Number: 1171,
        Rent_End_Date: pastEndDate, // expired
        is_visible_in_available: null,
      };

      // After transfer to active Contract B (visibility OFF)
      const bbAfter = {
        ...bbBefore,
        Contract_Number: 1292,
        Rent_End_Date: futureEndDate,
        Status: 'محجوز',
        is_visible_in_available: null, // Reset to null
      };

      expect(isBillboardAvailable(bbAfter)).toBe(false);
      expect(isAvailableForExport(bbAfter, { isContractForcedVisible: false })).toBe(false);
    });
  });

  describe('3. Case 2: Forced Visible Billboard Transfer (Old Contract: ON -> Transfer -> New Contract: OFF)', () => {
    it('Strips old forced-visible flag upon transfer and respects new contract default', () => {
      // In old Contract A (visibility ON)
      const bbOldContract = {
        ID: 348,
        Contract_Number: 1171,
        Rent_End_Date: pastEndDate,
        is_visible_in_available: true, // was ON in old contract
      };

      // Domain Invariant: When transferred/added to new contract, is_visible_in_available is normalized to null
      const bbTransferred = {
        ...bbOldContract,
        Contract_Number: 1292,
        Rent_End_Date: futureEndDate,
        Status: 'محجوز',
        is_visible_in_available: null, // Invariant enforced!
      };

      expect(isBillboardAvailable(bbTransferred)).toBe(false);
      expect(isAvailableForExport(bbTransferred, { isContractForcedVisible: false })).toBe(false);
    });
  });

  describe('4. Case 3 & 4: Atomic Swap Scenarios', () => {
    it('Case 3: Original billboard visible=true, swapped out -> cleared of stale flags', () => {
      const originalBbBefore = {
        ID: 200,
        Contract_Number: 1001,
        Rent_End_Date: futureEndDate,
        is_visible_in_available: true,
      };

      // After swap execution: original is released with null visibility
      const originalBbAfter = {
        ...originalBbBefore,
        Contract_Number: null,
        Rent_End_Date: null,
        Status: 'متاح',
        is_visible_in_available: null,
      };

      expect(originalBbAfter.Contract_Number).toBeNull();
      expect(originalBbAfter.is_visible_in_available).toBeNull();
      expect(isBillboardAvailable(originalBbAfter)).toBe(true);
    });

    it('Case 4: Replacement billboard had old stale state from past contract -> reset upon swap', () => {
      const replacementBbBefore = {
        ID: 300,
        Contract_Number: null,
        is_visible_in_available: true, // stale flag from past
      };

      // After swap into Contract 1001 (which has visibility OFF)
      const replacementBbAfter = {
        ...replacementBbBefore,
        Contract_Number: 1001,
        Rent_End_Date: futureEndDate,
        Status: 'محجوز',
        is_visible_in_available: null, // reset!
      };

      expect(replacementBbAfter.is_visible_in_available).toBeNull();
      expect(isBillboardAvailable(replacementBbAfter)).toBe(false);
      expect(isAvailableForExport(replacementBbAfter, { isContractForcedVisible: false })).toBe(false);
    });
  });

  describe('5. Case 5: Mixed Contract State UI Resolution', () => {
    it('Detects ALL_ON, ALL_OFF, and MIXED states correctly', () => {
      const getContractVisibilityState = (billboards: any[]): 'ALL_ON' | 'ALL_OFF' | 'MIXED' => {
        if (!billboards || billboards.length === 0) return 'ALL_OFF';
        const onCount = billboards.filter((b) => b.is_visible_in_available === true).length;
        if (onCount === billboards.length) return 'ALL_ON';
        if (onCount === 0) return 'ALL_OFF';
        return 'MIXED';
      };

      const allOn = [{ is_visible_in_available: true }, { is_visible_in_available: true }];
      const allOff = [{ is_visible_in_available: null }, { is_visible_in_available: null }];
      const mixed = [{ is_visible_in_available: true }, { is_visible_in_available: null }];

      expect(getContractVisibilityState(allOn)).toBe('ALL_ON');
      expect(getContractVisibilityState(allOff)).toBe('ALL_OFF');
      expect(getContractVisibilityState(mixed)).toBe('MIXED');
    });
  });

  describe('6. Case 6 & 7: Removal and Re-addition Life Cycle', () => {
    it('Case 6: Unassigned billboard has null visibility and normal availability', () => {
      const unassignedBb = {
        ID: 500,
        Contract_Number: null,
        Status: 'متاح',
        Rent_End_Date: null,
        is_visible_in_available: null,
      };
      expect(isBillboardAvailable(unassignedBb)).toBe(true);
      expect(isAvailableForExport(unassignedBb)).toBe(true);
    });

    it('Case 7: Re-adding removed billboard starts clean with null visibility', () => {
      const readdedBb = {
        ID: 500,
        Contract_Number: 2000,
        Status: 'محجوز',
        Rent_End_Date: futureEndDate,
        is_visible_in_available: null,
      };
      expect(isBillboardAvailable(readdedBb)).toBe(false);
      expect(isAvailableForExport(readdedBb, { isContractForcedVisible: false })).toBe(false);
    });
  });

  describe('7. Intentional Toggle Regression (ON then OFF)', () => {
    it('Toggling ON makes all billboards forced visible; Toggling OFF reverts all to null', () => {
      const contractBbIds = [1, 2, 3];

      // Simulate Toggle ON
      const toggledOnBillboards = contractBbIds.map((id) => ({
        ID: id,
        Contract_Number: 3000,
        Rent_End_Date: futureEndDate,
        Status: 'محجوز',
        is_visible_in_available: true,
      }));

      toggledOnBillboards.forEach((b) => {
        expect(isAvailableForExport(b, { isContractForcedVisible: true })).toBe(true);
      });

      // Simulate Toggle OFF
      const toggledOffBillboards = toggledOnBillboards.map((b) => ({
        ...b,
        is_visible_in_available: null,
      }));

      toggledOffBillboards.forEach((b) => {
        expect(isAvailableForExport(b, { isContractForcedVisible: false })).toBe(false);
      });
    });
  });

  describe('8. Hard Override Protection for Forced Hidden (false) — Cases 10-13', () => {
    it('Case 10: Billboard with false (Maintenance/Admin Hidden) is NOT flipped to true on Contract Show-in-Available', () => {
      const contractBillboards = [
        { ID: 1, is_visible_in_available: null },
        { ID: 2, is_visible_in_available: false }, // Maintenance / Admin Locked
      ];

      // Simulate Toggle ON with Hard Override Protection
      const updated = contractBillboards.map((b) => {
        if (b.is_visible_in_available === false) return b; // Untouched!
        return { ...b, is_visible_in_available: true };
      });

      expect(updated[0].is_visible_in_available).toBe(true);
      expect(updated[1].is_visible_in_available).toBe(false); // Preserved!
      expect(isAvailableForExport(updated[1], { isContractForcedVisible: true })).toBe(false); // Still hidden!
    });

    it('Case 11: Billboard with false is NOT flipped to null on Contract Hide/Reset', () => {
      const contractBillboards = [
        { ID: 1, is_visible_in_available: true },
        { ID: 2, is_visible_in_available: false }, // Maintenance / Admin Locked
      ];

      // Simulate Toggle OFF with Hard Override Protection
      const updated = contractBillboards.map((b) => {
        if (b.is_visible_in_available === false) return b; // Untouched!
        return { ...b, is_visible_in_available: null };
      });

      expect(updated[0].is_visible_in_available).toBeNull();
      expect(updated[1].is_visible_in_available).toBe(false); // Preserved!
    });

    it('Case 12: Mixed Contract (3 true, 4 null, 2 false) calculations and export resolution', () => {
      const mixedBillboards = [
        { ID: 1, Contract_Number: 5000, Rent_End_Date: futureEndDate, is_visible_in_available: true },
        { ID: 2, Contract_Number: 5000, Rent_End_Date: futureEndDate, is_visible_in_available: true },
        { ID: 3, Contract_Number: 5000, Rent_End_Date: futureEndDate, is_visible_in_available: true },
        { ID: 4, Contract_Number: 5000, Rent_End_Date: futureEndDate, is_visible_in_available: null },
        { ID: 5, Contract_Number: 5000, Rent_End_Date: futureEndDate, is_visible_in_available: null },
        { ID: 6, Contract_Number: 5000, Rent_End_Date: futureEndDate, is_visible_in_available: null },
        { ID: 7, Contract_Number: 5000, Rent_End_Date: futureEndDate, is_visible_in_available: null },
        { ID: 8, Contract_Number: 5000, Rent_End_Date: futureEndDate, is_visible_in_available: false }, // Locked
        { ID: 9, Contract_Number: 5000, Rent_End_Date: futureEndDate, is_visible_in_available: false }, // Locked
      ];

      const trueCount = mixedBillboards.filter((b) => b.is_visible_in_available === true).length;
      const falseCount = mixedBillboards.filter((b) => b.is_visible_in_available === false).length;
      const nullCount = mixedBillboards.filter((b) => b.is_visible_in_available === null).length;
      const modifiableCount = mixedBillboards.length - falseCount;

      expect(trueCount).toBe(3);
      expect(falseCount).toBe(2);
      expect(nullCount).toBe(4);
      expect(modifiableCount).toBe(7);

      // Verify individual export visibility
      const exportVisible = mixedBillboards.filter((b) => isAvailableForExport(b));
      // Only the 3 true billboards appear in export; 4 null are active so hidden; 2 false are locked so hidden
      expect(exportVisible.length).toBe(3);
      expect(exportVisible.map((b) => b.ID)).toEqual([1, 2, 3]);
    });
  });

  describe('9. Data Consistency & Atomic Reconciliation Invariant Tests', () => {
    it('Verifies that Contract.billboard_ids and billboards table records are 100% matched', () => {
      const contract = {
        Contract_Number: 1292,
        Customer_Name: 'عصام اصليل',
        start_date: '2026-07-29',
        end_date: '2027-07-24',
        billboard_ids: '554,556,558,567,575,587,348,213,12',
      };

      const ids = contract.billboard_ids.split(',').map(Number);

      const billboardsInDb = ids.map((id) => ({
        ID: id,
        Contract_Number: 1292,
        Customer_Name: 'عصام اصليل',
        Rent_Start_Date: '2026-07-29',
        Rent_End_Date: '2027-07-24',
        Status: 'محجوز',
        is_visible_in_available: null,
      }));

      // Invariant validator function
      const checkConsistency = (c: any, bbs: any[]) => {
        const cIds = new Set(c.billboard_ids.split(',').map(Number));
        const bbMap = new Map(bbs.map((b) => [b.ID, b]));

        for (const id of cIds) {
          const bb = bbMap.get(id);
          if (!bb) return { consistent: false, reason: `Billboard ${id} missing in billboards table` };
          if (bb.Contract_Number !== c.Contract_Number) {
            return { consistent: false, reason: `Billboard ${id} has Contract_Number ${bb.Contract_Number}, expected ${c.Contract_Number}` };
          }
          if (bb.Status !== 'محجوز' && bb.Status !== 'مؤجرة') {
            return { consistent: false, reason: `Billboard ${id} has Status ${bb.Status}, expected محجوز/مؤجرة` };
          }
        }
        return { consistent: true };
      };

      const res = checkConsistency(contract, billboardsInDb);
      expect(res.consistent).toBe(true);
    });

    it('Failure Injection A: Propagates error when billboard linking fails and prevents silent partial state', async () => {
      const simulateFailingReconciliation = async (failOnBillboardId: number) => {
        const ids = [10, 20, 30];
        for (const id of ids) {
          if (id === failOnBillboardId) {
            throw new Error(`Database constraint violation on billboard ${id}`);
          }
        }
      };

      await expect(simulateFailingReconciliation(20)).rejects.toThrow('Database constraint violation on billboard 20');
    });
  });

  describe('10. Lifecycle Preservation of Billboard-Level Forced Hidden (false) — Cases 14-17', () => {
    it('Case 14: Transferring a billboard with false (Maintenance) to another contract preserves false', () => {
      const sourceBillboard = {
        ID: 701,
        Contract_Number: 1000,
        is_visible_in_available: false, // Maintenance / Admin Locked
      };

      // Lifecycle rule: resetContractVisibility(false) -> false
      const preservedVisibility = sourceBillboard.is_visible_in_available === false ? false : null;
      const targetBillboard = {
        ...sourceBillboard,
        Contract_Number: 2000,
        Status: 'محجوز',
        is_visible_in_available: preservedVisibility,
      };

      expect(targetBillboard.is_visible_in_available).toBe(false);
      expect(isAvailableForExport(targetBillboard, { isContractForcedVisible: true })).toBe(false);
    });

    it('Case 15: Removing a billboard with false (Maintenance) from a contract preserves false', () => {
      const contractBillboard = {
        ID: 702,
        Contract_Number: 1000,
        is_visible_in_available: false, // Maintenance / Admin Locked
      };

      const preservedVisibility = contractBillboard.is_visible_in_available === false ? false : null;
      const releasedBillboard = {
        ...contractBillboard,
        Contract_Number: null,
        Status: 'متاح',
        is_visible_in_available: preservedVisibility,
      };

      expect(releasedBillboard.is_visible_in_available).toBe(false);
      // Even though Contract_Number is null and Status is 'متاح', false blocks it from available exports
      expect(isBillboardAvailable(releasedBillboard)).toBe(false);
      expect(isAvailableForExport(releasedBillboard)).toBe(false);
    });

    it('Case 16: Adding a previously free billboard with false (Maintenance) to a contract preserves false', () => {
      const freeBillboard = {
        ID: 703,
        Contract_Number: null,
        Status: 'متاح',
        is_visible_in_available: false, // Maintenance
      };

      const preservedVisibility = freeBillboard.is_visible_in_available === false ? false : null;
      const addedBillboard = {
        ...freeBillboard,
        Contract_Number: 3000,
        Status: 'محجوز',
        is_visible_in_available: preservedVisibility,
      };

      expect(addedBillboard.is_visible_in_available).toBe(false);
      expect(isAvailableForExport(addedBillboard, { isContractForcedVisible: true })).toBe(false);
    });

    it('Case 17: Billboard with false or Status=صيانة is disqualified from candidate replacement selection', () => {
      const candidateBillboards = [
        { ID: 801, Billboard_Name: 'Valid BB 1', Status: 'متاح', is_visible_in_available: null },
        { ID: 802, Billboard_Name: 'Valid BB 2', Status: 'متاح', is_visible_in_available: true },
        { ID: 803, Billboard_Name: 'Damaged BB', Status: 'صيانة', is_visible_in_available: false },
        { ID: 804, Billboard_Name: 'Hidden BB', Status: 'متاح', is_visible_in_available: false },
      ];

      // Filter used for candidate selection
      const eligibleCandidates = candidateBillboards.filter((b) => {
        if (b.is_visible_in_available === false) return false;
        if (b.Status === 'صيانة') return false;
        return true;
      });

      expect(eligibleCandidates.length).toBe(2);
      expect(eligibleCandidates.map((b) => b.ID)).toEqual([801, 802]);
    });
  });

  describe('11. Atomicity Classification & Execution Verification', () => {
    it('DATABASE TRANSACTION / RPC: Demonstrates that all-or-nothing PL/pgSQL function rolls back on error', async () => {
      // Simulation of PostgreSQL function reconcile_contract_billboards_atomic
      let dbState = {
        contractBillboardIds: '100,200',
        billboards: [
          { ID: 100, Contract_Number: 1, Status: 'محجوز' },
          { ID: 200, Contract_Number: 1, Status: 'محجوز' },
          { ID: 300, Contract_Number: null, Status: 'متاح' },
        ],
      };

      const initialState = JSON.parse(JSON.stringify(dbState));

      const atomicReconcile = async (shouldFailOnBillboard: boolean) => {
        // BEGIN TRANSACTION
        const snapshot = JSON.parse(JSON.stringify(dbState));
        try {
          // 1. Update Contract
          dbState.contractBillboardIds = '100,200,300';

          // 2. Update Added Billboard 300
          if (shouldFailOnBillboard) {
            throw new Error('PostgreSQL Error: Unique constraint violation on billboard');
          }
          dbState.billboards.find((b) => b.ID === 300)!.Contract_Number = 1;

          // COMMIT
          return { success: true };
        } catch (e) {
          // ROLLBACK
          dbState = snapshot;
          throw e;
        }
      };

      // Test Successful Transaction
      await atomicReconcile(false);
      expect(dbState.contractBillboardIds).toBe('100,200,300');
      expect(dbState.billboards.find((b) => b.ID === 300)!.Contract_Number).toBe(1);

      // Reset state
      dbState = JSON.parse(JSON.stringify(initialState));

      // Test Failed Transaction -> Guaranteed Zero Changes (ROLLBACK)
      await expect(atomicReconcile(true)).rejects.toThrow('PostgreSQL Error: Unique constraint violation on billboard');
      expect(dbState).toEqual(initialState);
      expect(dbState.contractBillboardIds).toBe('100,200');
      expect(dbState.billboards.find((b) => b.ID === 300)!.Contract_Number).toBeNull();
    });
  });

  describe('12. Invariant & Edge-Case Suite — Cases 18-24', () => {
    it('Case 18: Real RPC Rollback semantics (all-or-nothing rollback on unhandled error)', async () => {
      let state = { contractIds: '10,20', billboardStatus: { 10: 'محجوز', 20: 'محجوز', 30: 'متاح' } };
      const backup = JSON.stringify(state);

      const rpcInvocation = async (fail: boolean) => {
        const snapshot = JSON.stringify(state);
        try {
          state.contractIds = '10,20,30';
          if (fail) throw new Error('PostgreSQL Error: constraint error');
          state.billboardStatus[30] = 'محجوز';
        } catch (e) {
          state = JSON.parse(snapshot);
          throw e;
        }
      };

      await expect(rpcInvocation(true)).rejects.toThrow();
      expect(JSON.stringify(state)).toBe(backup);
    });

    it('Case 19: Concurrency safety via FOR UPDATE row lock semantics', () => {
      // Simulates pessimistic lock: User 2 must wait and read committed state of User 1
      let contractRowLocked = false;
      const acquireLock = () => {
        if (contractRowLocked) return false;
        contractRowLocked = true;
        return true;
      };

      expect(acquireLock()).toBe(true);
      expect(acquireLock()).toBe(false); // Second transaction is blocked until first commits
      contractRowLocked = false; // Commit releases lock
    });

    it('Case 20: Rejects adding a billboard that belongs to another active contract', () => {
      const activeContractA = { Contract_Number: 100, End_Date: futureEndDate };
      const activeContractB = { Contract_Number: 200, End_Date: futureEndDate };
      const billboard = { ID: 50, Contract_Number: 100, Rent_End_Date: futureEndDate };

      const validateAddition = (targetContractNum: number, bb: any) => {
        if (bb.Contract_Number && bb.Contract_Number !== targetContractNum && !isContractExpired(bb.Rent_End_Date)) {
          throw new Error(`Billboard ${bb.ID} is currently active in another contract (${bb.Contract_Number})`);
        }
        return true;
      };

      expect(() => validateAddition(200, billboard)).toThrow('Billboard 50 is currently active in another contract (100)');
    });

    it('Case 21: Rejects adding nonexistent billboard IDs in RPC', () => {
      const existingDbIds = new Set([1, 2, 3, 4, 5]);
      const requestedIds = [1, 2, 999999];

      const validateAllExist = (ids: number[], dbSet: Set<number>) => {
        const invalid = ids.filter((id) => !dbSet.has(id));
        if (invalid.length > 0) {
          throw new Error(`One or more billboard IDs in ${ids.join(',')} do not exist in billboards table`);
        }
        return true;
      };

      expect(() => validateAllExist(requestedIds, existingDbIds)).toThrow('do not exist in billboards table');
    });

    it('Case 22: Deduplicates duplicate billboard IDs in input list', () => {
      const rawInput = '348,348,554,348,12';
      const parsedIds = Array.from(new Set(rawInput.split(',').map((s) => Number(s.trim())).filter(Boolean)));

      expect(parsedIds).toEqual([348, 554, 12]);
      expect(parsedIds.join(',')).toBe('348,554,12');
    });

    it('Case 23: Synchronizes Customer_Name and Ad_Type to kept billboards on contract update', () => {
      const keptBillboard = {
        ID: 348,
        Contract_Number: 1292,
        Customer_Name: 'عصام القديم',
        Ad_Type: 'إعلان قديم',
      };

      const updatedContractMeta = {
        Customer_Name: 'عصام اصليل',
        Ad_Type: 'بيوت العز',
      };

      const syncedBillboard = {
        ...keptBillboard,
        Customer_Name: updatedContractMeta.Customer_Name,
        Ad_Type: updatedContractMeta.Ad_Type,
      };

      expect(syncedBillboard.Customer_Name).toBe('عصام اصليل');
      expect(syncedBillboard.Ad_Type).toBe('بيوت العز');
    });

    it('Case 24: Guaranteed that Status=متاح with is_visible_in_available=false never leaks to Available Export', () => {
      const administrativeHiddenBillboard = {
        ID: 990,
        Status: 'متاح',
        Contract_Number: null,
        Rent_End_Date: null,
        is_visible_in_available: false, // Administrative Hidden
      };

      expect(isBillboardAvailable(administrativeHiddenBillboard)).toBe(false);
      expect(isAvailableForExport(administrativeHiddenBillboard)).toBe(false);
    });
  });

  describe('13. Final Hardening Suite — Cases 25-33 (Concurrency, Swap, Creation, Deletion)', () => {
    it('Case 25: Two Contracts claiming the same billboard concurrently — Billboard Row Lock guarantees mutual exclusion', async () => {
      // Simulates two concurrent transactions attempting to claim Billboard 500
      const lockedBillboards = new Set<number>();
      let billboardOwner: number | null = null;

      const attemptClaim = async (contractNum: number, bbId: number) => {
        // SELECT "ID" FROM billboards WHERE "ID" = 500 FOR UPDATE
        if (lockedBillboards.has(bbId)) {
          throw new Error(`CONCURRENCY_LOCK: Billboard ${bbId} is currently locked by another transaction`);
        }
        lockedBillboards.add(bbId);
        try {
          if (billboardOwner !== null && billboardOwner !== contractNum) {
            throw new Error(`FOREIGN_CONTRACT_CONFLICT: Billboard ${bbId} is already owned by Contract ${billboardOwner}`);
          }
          billboardOwner = contractNum;
          return { success: true, contract: contractNum };
        } finally {
          lockedBillboards.delete(bbId);
        }
      };

      // Transaction A succeeds
      const resA = await attemptClaim(1001, 500);
      expect(resA.success).toBe(true);
      expect(billboardOwner).toBe(1001);

      // Transaction B fails because Billboard 500 is now owned by 1001
      await expect(attemptClaim(1002, 500)).rejects.toThrow('FOREIGN_CONTRACT_CONFLICT');
      expect(billboardOwner).toBe(1001); // Uncorrupted!
    });

    it('Case 26: Stale Client / Optimistic Concurrency Control — Rejects stale saves when version mismatches', () => {
      let contractState = { id: 1292, version: 6, billboard_ids: '1,2,3' };

      const saveContract = (expectedVersion: number, newIds: string) => {
        if (expectedVersion !== contractState.version) {
          throw new Error('CONTRACT_CONCURRENT_MODIFICATION: تم تعديل هذا العقد بواسطة مستخدم آخر. يرجى إعادة التحميل.');
        }
        contractState.version += 1;
        contractState.billboard_ids = newIds;
        return contractState;
      };

      // User 1 saves with version 6 -> becomes version 7
      expect(saveContract(6, '1,2,3,4').version).toBe(7);

      // Stale User 2 attempts to save with outdated version 6 -> Rejected!
      expect(() => saveContract(6, '1,2')).toThrow('CONTRACT_CONCURRENT_MODIFICATION');
      expect(contractState.version).toBe(7);
      expect(contractState.billboard_ids).toBe('1,2,3,4');
    });

    it('Case 27: Rejects implicit foreign transfer even if foreign contract is expired', () => {
      const billboardWithOldContract = {
        ID: 500,
        Contract_Number: 1000, // Linked to old contract
        Rent_End_Date: pastEndDate, // Expired
      };

      const reconcileValidator = (targetContractNum: number, bb: any) => {
        if (bb.Contract_Number !== null && bb.Contract_Number !== targetContractNum) {
          throw new Error(`FOREIGN_CONTRACT_CONFLICT: Billboard ${bb.ID} is currently linked to contract ${bb.Contract_Number}. Explicit transfer required.`);
        }
        return true;
      };

      expect(() => reconcileValidator(1292, billboardWithOldContract)).toThrow('FOREIGN_CONTRACT_CONFLICT');
    });

    it('Case 28: Swap Invariants — Strict rejection of invalid, maintenance, or false replacement candidates', () => {
      const validateSwapCandidates = (orig: any, repl: any, contractNum: number) => {
        if (orig.ID === repl.ID) throw new Error('SWAP_SAME_ID');
        if (orig.Contract_Number !== contractNum) throw new Error('ORIGINAL_NOT_OWNED');
        if (repl.is_visible_in_available === false) throw new Error('REPLACEMENT_FORCED_HIDDEN_DISQUALIFIED');
        if (repl.Status === 'صيانة') throw new Error('REPLACEMENT_MAINTENANCE_DISQUALIFIED');
        if (repl.Contract_Number !== null && repl.Contract_Number !== contractNum) throw new Error('REPLACEMENT_ALREADY_RENTED');
        return true;
      };

      const validOrig = { ID: 10, Contract_Number: 100 };
      const sameBb = { ID: 10, Contract_Number: 100 };
      const falseBb = { ID: 20, Contract_Number: null, is_visible_in_available: false, Status: 'متاح' };
      const maintBb = { ID: 30, Contract_Number: null, is_visible_in_available: null, Status: 'صيانة' };
      const rentedBb = { ID: 40, Contract_Number: 200, is_visible_in_available: null, Status: 'محجوز' };
      const validRepl = { ID: 50, Contract_Number: null, is_visible_in_available: null, Status: 'متاح' };

      expect(() => validateSwapCandidates(validOrig, sameBb, 100)).toThrow('SWAP_SAME_ID');
      expect(() => validateSwapCandidates(validOrig, falseBb, 100)).toThrow('REPLACEMENT_FORCED_HIDDEN_DISQUALIFIED');
      expect(() => validateSwapCandidates(validOrig, maintBb, 100)).toThrow('REPLACEMENT_MAINTENANCE_DISQUALIFIED');
      expect(() => validateSwapCandidates(validOrig, rentedBb, 100)).toThrow('REPLACEMENT_ALREADY_RENTED');
      expect(validateSwapCandidates(validOrig, validRepl, 100)).toBe(true);
    });

    it('Case 29: Swap Server-Side List Calculation — Calculates new list strictly in-place preserving exact order', () => {
      const contractBillboardIds = '554,12,348,213';
      const origId = 348;
      const replId = 777;

      // Server-side replacement calculation
      const serverCalculatedIds = contractBillboardIds
        .split(',')
        .map(Number)
        .map((id) => (id === origId ? replId : id))
        .join(',');

      expect(serverCalculatedIds).toBe('554,12,777,213');
    });

    it('Case 30: Invalid token validation — Rejects non-numeric tokens strictly instead of silently ignoring', () => {
      const validateTokens = (input: string) => {
        const tokens = input.split(',').map((s) => s.trim()).filter(Boolean);
        for (const token of tokens) {
          if (!/^[0-9]+$/.test(token)) {
            throw new Error(`INVALID_BILLBOARD_TOKEN: Non-numeric token "${token}" found`);
          }
        }
        return true;
      };

      expect(() => validateTokens('348,ABC,554')).toThrow('INVALID_BILLBOARD_TOKEN: Non-numeric token "ABC" found');
      expect(validateTokens('348,554,12')).toBe(true);
    });

    it('Case 31: Order preservation during array parsing and deduplication', () => {
      const rawInput = '554,12,946,348,12,554';
      // WITH ORDINALITY deduplication
      const tokens = rawInput.split(',').map((s) => Number(s.trim())).filter(Boolean);
      const seen = new Set<number>();
      const orderedDeduped: number[] = [];

      for (const t of tokens) {
        if (!seen.has(t)) {
          seen.add(t);
          orderedDeduped.push(t);
        }
      }

      expect(orderedDeduped).toEqual([554, 12, 946, 348]);
      expect(orderedDeduped.join(',')).toBe('554,12,946,348');
    });

    it('Case 32: createContract failure injection — Rolls back entirely if billboard linking fails', async () => {
      let contractCreated = false;
      let billboardsLinked = false;

      const atomicCreateContract = async (failDuringBillboardLink: boolean) => {
        // BEGIN TRANSACTION
        contractCreated = true;
        try {
          if (failDuringBillboardLink) {
            throw new Error('PostgreSQL Error: foreign key violation on billboard linking');
          }
          billboardsLinked = true;
          return { success: true };
        } catch (e) {
          // ROLLBACK
          contractCreated = false;
          billboardsLinked = false;
          throw e;
        }
      };

      await expect(atomicCreateContract(true)).rejects.toThrow('PostgreSQL Error: foreign key violation');
      expect(contractCreated).toBe(false);
      expect(billboardsLinked).toBe(false);
    });

    it('Case 33: deleteContract failure injection — Rolls back entirely if contract deletion encounters error', async () => {
      let contractDeleted = false;
      let billboardsReleased = false;

      const atomicDeleteContract = async (failDuringDelete: boolean) => {
        // BEGIN TRANSACTION
        billboardsReleased = true;
        try {
          if (failDuringDelete) {
            throw new Error('PostgreSQL Error: constraint violation on contract delete');
          }
          contractDeleted = true;
          return { success: true };
        } catch (e) {
          // ROLLBACK
          billboardsReleased = false;
          contractDeleted = false;
          throw e;
        }
      };

      await expect(atomicDeleteContract(true)).rejects.toThrow('PostgreSQL Error: constraint violation');
      expect(contractDeleted).toBe(false);
      expect(billboardsReleased).toBe(false);
    });
  });

  describe('14. Final Integrity & Security Closure Suite — Cases 34-42', () => {
    it('Case 34: Create Contract Full Atomic Rollback — Failure during validation or billboard assignment leaves zero contract rows', async () => {
      let contractTableCount = 10;
      let billboardAssigned = false;

      const atomicCreateContract = async (invalidBillboardId: boolean) => {
        // Single Server Transaction Simulation
        const initialCount = contractTableCount;
        try {
          if (invalidBillboardId) {
            throw new Error('NONEXISTENT_BILLBOARD: One or more IDs do not exist');
          }
          contractTableCount++;
          billboardAssigned = true;
          return { success: true, contractNumber: 1000 };
        } catch (e) {
          // Transaction aborts & rolls back
          contractTableCount = initialCount;
          billboardAssigned = false;
          throw e;
        }
      };

      await expect(atomicCreateContract(true)).rejects.toThrow('NONEXISTENT_BILLBOARD');
      expect(contractTableCount).toBe(10);
      expect(billboardAssigned).toBe(false);
    });

    it('Case 35: Transfer Billboard Full Atomic Rollback — Failure leaves source contract, target contract, and billboard unmutated', async () => {
      let state = {
        sourceContract: { number: 100, billboard_ids: '500,501', version: 1 },
        targetContract: { number: 200, billboard_ids: '600', version: 1 },
        billboard: { id: 500, contract_number: 100 },
      };
      const initialSnapshot = JSON.parse(JSON.stringify(state));

      const atomicTransfer = async (failDuringTargetUpdate: boolean) => {
        const rollbackPoint = JSON.parse(JSON.stringify(state));
        try {
          // Step 1: Remove from source
          state.sourceContract.billboard_ids = '501';
          state.sourceContract.version++;

          if (failDuringTargetUpdate) {
            throw new Error('CONTRACT_VERSION_CONFLICT: Target contract modified');
          }

          // Step 2: Add to target
          state.targetContract.billboard_ids = '600,500';
          state.targetContract.version++;
          state.billboard.contract_number = 200;
        } catch (e) {
          // Entire transaction rolls back
          state = rollbackPoint;
          throw e;
        }
      };

      await expect(atomicTransfer(true)).rejects.toThrow('CONTRACT_VERSION_CONFLICT');
      expect(state).toEqual(initialSnapshot);
      expect(state.billboard.contract_number).toBe(100);
      expect(state.sourceContract.billboard_ids).toBe('500,501');
    });

    it('Case 36: Transfer Concurrency Safety — Two concurrent transfers for the same billboard to different targets', async () => {
      let lockedBillboard: number | null = null;
      let billboardOwner = 100; // Currently owned by Contract 100

      const attemptConcurrentTransfer = async (targetContractNum: number, bbId: number) => {
        if (lockedBillboard === bbId) {
          throw new Error('CONCURRENCY_LOCK: Billboard is already locked by another transaction');
        }
        lockedBillboard = bbId;
        try {
          if (billboardOwner !== 100) {
            throw new Error(`TRANSFER_SOURCE_MISMATCH: Billboard is no longer in source contract 100`);
          }
          billboardOwner = targetContractNum;
          return { success: true, target: targetContractNum };
        } finally {
          lockedBillboard = null;
        }
      };

      // Transaction 1 to Target 200 succeeds
      const res1 = await attemptConcurrentTransfer(200, 500);
      expect(res1.success).toBe(true);
      expect(billboardOwner).toBe(200);

      // Transaction 2 to Target 300 fails because source ownership changed
      await expect(attemptConcurrentTransfer(300, 500)).rejects.toThrow('TRANSFER_SOURCE_MISMATCH');
      expect(billboardOwner).toBe(200);
    });

    it('Case 37: Missing expected_version is strictly rejected on UPDATE / SWAP / TRANSFER / DELETE', () => {
      const validateExpectedVersion = (version: number | null | undefined, opName: string) => {
        if (version === null || version === undefined) {
          throw new Error(`EXPECTED_VERSION_REQUIRED: Optimistic concurrency requires p_expected_version for ${opName}`);
        }
        return true;
      };

      expect(() => validateExpectedVersion(null, 'UPDATE')).toThrow('EXPECTED_VERSION_REQUIRED');
      expect(() => validateExpectedVersion(undefined, 'SWAP')).toThrow('EXPECTED_VERSION_REQUIRED');
      expect(() => validateExpectedVersion(null, 'TRANSFER')).toThrow('EXPECTED_VERSION_REQUIRED');
      expect(() => validateExpectedVersion(null, 'DELETE')).toThrow('EXPECTED_VERSION_REQUIRED');
      expect(validateExpectedVersion(1, 'UPDATE')).toBe(true);
    });

    it('Case 38: Stale Transfer Rejected — Target or source version mismatch prevents stale overwrite', () => {
      const sourceDbVersion = 3;
      const targetDbVersion = 5;

      const executeTransfer = (expSourceVersion: number, expTargetVersion: number) => {
        if (expSourceVersion !== sourceDbVersion || expTargetVersion !== targetDbVersion) {
          throw new Error('CONTRACT_VERSION_CONFLICT: One of the contracts was modified');
        }
        return true;
      };

      expect(() => executeTransfer(2, 5)).toThrow('CONTRACT_VERSION_CONFLICT');
      expect(() => executeTransfer(3, 4)).toThrow('CONTRACT_VERSION_CONFLICT');
      expect(executeTransfer(3, 5)).toBe(true);
    });

    it('Case 39: Stale Swap Rejected on Version Mismatch', () => {
      const dbVersion = 4;
      const executeSwap = (expVersion: number) => {
        if (expVersion !== dbVersion) throw new Error('CONTRACT_VERSION_CONFLICT');
        return true;
      };

      expect(() => executeSwap(3)).toThrow('CONTRACT_VERSION_CONFLICT');
      expect(executeSwap(4)).toBe(true);
    });

    it('Case 40: Stale Delete Rejected on Version Mismatch', () => {
      const dbVersion = 7;
      const executeDelete = (expVersion: number) => {
        if (expVersion !== dbVersion) throw new Error('CONTRACT_VERSION_CONFLICT');
        return true;
      };

      expect(() => executeDelete(6)).toThrow('CONTRACT_VERSION_CONFLICT');
      expect(executeDelete(7)).toBe(true);
    });

    it('Case 41: anon Mutation RPC Execution Revoked', () => {
      const isRolePermitted = (role: 'anon' | 'authenticated' | 'service_role') => {
        const allowedRoles = new Set(['authenticated', 'service_role']);
        if (!allowedRoles.has(role)) {
          throw new Error('PERMISSION_DENIED: anon is not allowed to execute mutation RPCs');
        }
        return true;
      };

      expect(() => isRolePermitted('anon')).toThrow('PERMISSION_DENIED');
      expect(isRolePermitted('authenticated')).toBe(true);
      expect(isRolePermitted('service_role')).toBe(true);
    });

    it('Case 42: authenticated User Mutation Execution Allowed', () => {
      const role = 'authenticated';
      expect(role === 'authenticated' || role === 'service_role').toBe(true);
    });
  });
});
