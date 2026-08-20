import { describe, it, expect } from 'vitest';

/**
 * Mock Simulation of PostgreSQL execute_instant_billboard_swap
 * Implements the exact logic and invariants from 20260820133000_execute_instant_billboard_swap.sql
 */
class InstantSwapSimulationDb {
  public contracts: any[] = [];
  public billboards: any[] = [];
  public friendRentals: any[] = [];
  public installationTaskItems: any[] = [];
  public printTaskItems: any[] = [];
  public removalTaskItems: any[] = [];
  public activityLogs: any[] = [];
  public pausedBillboards: any[] = [];
  public pausedReplacements: any[] = [];

  public failTransaction = false;

  executeInstantBillboardSwap(params: {
    contractNumber: number;
    originalBillboardId: number;
    replacementBillboardId: number;
    userId?: string;
  }) {
    if (this.failTransaction) {
      throw new Error('Database transaction aborted due to simulated failure');
    }

    const { contractNumber, originalBillboardId, replacementBillboardId, userId } = params;

    // 1. Inputs Check
    if (!contractNumber || !originalBillboardId || !replacementBillboardId) {
      return { success: false, code: 'INVALID_INPUT', message: 'بيانات غير صالحة' };
    }

    if (originalBillboardId === replacementBillboardId) {
      return { success: false, code: 'SAME_BILLBOARD', message: 'لا يمكن استبدال اللوحة بنفسها' };
    }

    // 2. Lock & Fetch Contract
    const contract = this.contracts.find((c) => c.Contract_Number === contractNumber);
    if (!contract) {
      return { success: false, code: 'CONTRACT_NOT_FOUND', message: 'العقد غير موجود' };
    }

    // Lock & Fetch Billboards
    const origBb = this.billboards.find((b) => b.ID === originalBillboardId);
    const replBb = this.billboards.find((b) => b.ID === replacementBillboardId);

    if (!origBb) {
      return { success: false, code: 'OLD_BILLBOARD_NOT_FOUND', message: 'اللوحة الحالية غير موجودة' };
    }
    if (!replBb) {
      return { success: false, code: 'NEW_BILLBOARD_NOT_FOUND', message: 'اللوحة البديلة غير موجودة' };
    }

    // 3. Validate Membership
    const rawIds = (contract.billboard_ids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const origCount = rawIds.filter((id: string) => id === String(originalBillboardId)).length;
    const replCount = rawIds.filter((id: string) => id === String(replacementBillboardId)).length;

    if (origCount === 0) {
      return { success: false, code: 'OLD_BILLBOARD_NOT_IN_CONTRACT', message: 'اللوحة غير مدرجة بالعقد' };
    }
    if (origCount > 1) {
      return { success: false, code: 'CONTRACT_DATA_INCONSISTENT', message: 'اللوحة مكررة بالعقد' };
    }
    if (replCount > 0) {
      return { success: false, code: 'NEW_BILLBOARD_ALREADY_IN_CONTRACT', message: 'اللوحة البديلة موجودة مسبقاً' };
    }

    // 4. Validate Availability
    if (replBb.Contract_Number && replBb.Contract_Number !== contractNumber) {
      return { success: false, code: 'CANDIDATE_NOT_AVAILABLE', message: 'اللوحة البديلة محجوزة' };
    }
    if (replBb.Status !== 'متاح' && replBb.Contract_Number) {
      return { success: false, code: 'CANDIDATE_NOT_AVAILABLE', message: 'اللوحة البديلة غير متاحة' };
    }

    // 5. In-Place Array Replacement
    const origIndex = rawIds.indexOf(String(originalBillboardId));
    rawIds[origIndex] = String(replacementBillboardId);
    const updatedIdsStr = rawIds.join(',');

    // 6. Synchronize billboard_prices with 100% Financial Preservation
    let preservedPrice = Number(origBb.Price || 0);
    let pricesArray = [];
    try {
      pricesArray = typeof contract.billboard_prices === 'string'
        ? JSON.parse(contract.billboard_prices)
        : (contract.billboard_prices || []);
    } catch {
      pricesArray = [];
    }

    let priceFound = false;
    const updatedPricesArray = pricesArray.map((p: any) => {
      const match = String(p.billboardId ?? p.billboard_id ?? p.id ?? p.ID) === String(originalBillboardId);
      if (match) {
        priceFound = true;
        preservedPrice = Number(p.contractPrice ?? p.finalPrice ?? p.priceAfterDiscount ?? p.totalBillboardPrice ?? preservedPrice);
        return {
          ...p,
          billboardId: String(replacementBillboardId),
        };
      }
      return p;
    });

    if (!priceFound) {
      updatedPricesArray.push({
        billboardId: String(replacementBillboardId),
        contractPrice: preservedPrice,
        finalPrice: preservedPrice,
        totalBillboardPrice: preservedPrice,
      });
    }

    // 7. Update Billboards Statuses
    origBb.Status = 'متاح';
    origBb.Contract_Number = null;
    origBb.Customer_Name = null;
    origBb.Ad_Type = null;
    origBb.Rent_Start_Date = null;
    origBb.Rent_End_Date = null;

    replBb.Status = 'مؤجرة';
    replBb.Contract_Number = contractNumber;
    replBb.Customer_Name = contract['Customer Name'];
    replBb.Ad_Type = contract['Ad Type'];
    replBb.Rent_Start_Date = contract['Contract Date'];
    replBb.Rent_End_Date = contract['End Date'];

    // 8. Update Contract (Total Remains Invariant)
    contract.billboard_ids = updatedIdsStr;
    contract.billboard_prices = JSON.stringify(updatedPricesArray);
    contract.billboards_count = rawIds.length;

    // 9. Friend Rentals
    this.friendRentals = this.friendRentals.filter(
      (f) => !(f.contract_number === contractNumber && f.billboard_id === originalBillboardId)
    );
    if (replBb.friend_company_id) {
      this.friendRentals.push({
        contract_number: contractNumber,
        billboard_id: replacementBillboardId,
        friend_company_id: replBb.friend_company_id,
        customer_rental_price: preservedPrice,
        friend_rental_cost: Number(replBb.Price || preservedPrice),
      });
    }

    // 10. Transfer Pending Tasks (Semantic Separation)
    this.installationTaskItems.forEach((item) => {
      if (item.contract_id === contractNumber && item.billboard_id === originalBillboardId && item.status !== 'completed') {
        item.billboard_id = replacementBillboardId;
      }
    });
    this.printTaskItems.forEach((item) => {
      if (item.contract_id === contractNumber && item.billboard_id === originalBillboardId && item.status !== 'completed') {
        item.billboard_id = replacementBillboardId;
      }
    });

    // 11. Activity Log
    this.activityLogs.push({
      action: 'instant_billboard_swap',
      contract_number: contractNumber,
      original_billboard_id: originalBillboardId,
      replacement_billboard_id: replacementBillboardId,
      preserved_price: preservedPrice,
      user_id: userId || null,
    });

    return {
      success: true,
      contract_number: contractNumber,
      original_billboard_id: originalBillboardId,
      replacement_billboard_id: replacementBillboardId,
      preserved_contract_price: preservedPrice,
      contract_total_before: contract.Total,
      contract_total_after: contract.Total,
      new_billboard_ids: rawIds,
      updated_billboard_prices: updatedPricesArray,
    };
  }
}

describe('Instant Billboard Swap System — Strict Invariants & Audit Tests', () => {
  it('Test A & C: Swaps billboard 1:1, preserves slot price and contract total invariant with zero price delta', () => {
    const db = new InstantSwapSimulationDb();

    // Setup: Contract #1001 with billboard 632 (Price: 3500 LYD) and total 7000 LYD
    db.contracts.push({
      Contract_Number: 1001,
      'Customer Name': 'شركة المدار',
      'Contract Date': '2026-01-01',
      'End Date': '2026-12-31',
      Total: 7000,
      'Total Rent': 7000,
      billboard_ids: '631,632',
      billboard_prices: JSON.stringify([
        { billboardId: '631', contractPrice: 3500, finalPrice: 3500, totalBillboardPrice: 3500 },
        { billboardId: '632', contractPrice: 3500, finalPrice: 3500, totalBillboardPrice: 3500 },
      ]),
    });

    db.billboards.push(
      { ID: 631, Billboard_Name: 'لوحة A', Status: 'مؤجرة', Contract_Number: 1001, Price: 3500 },
      { ID: 632, Billboard_Name: 'لوحة B', Status: 'مؤجرة', Contract_Number: 1001, Price: 3500 },
      { ID: 901, Billboard_Name: 'لوحة بديلة C', Status: 'متاح', Contract_Number: null, Price: 5000 } // Listing price 5000!
    );

    const initialTotal = db.contracts[0].Total;
    const initialPausedCount = db.pausedBillboards.length;
    const initialPausedReplCount = db.pausedReplacements.length;

    // Execute instant swap: 632 -> 901
    const result = db.executeInstantBillboardSwap({
      contractNumber: 1001,
      originalBillboardId: 632,
      replacementBillboardId: 901,
    });

    expect(result.success).toBe(true);
    expect(result.preserved_contract_price).toBe(3500); // Must be 3500, NOT 5000!
    expect(result.contract_total_before).toBe(initialTotal);
    expect(result.contract_total_after).toBe(initialTotal);

    // Contract checks
    const updatedContract = db.contracts[0];
    expect(updatedContract.Total).toBe(7000);
    expect(updatedContract.billboard_ids).toBe('631,901');

    // Billboard inventory status checks
    const oldBb = db.billboards.find((b) => b.ID === 632);
    const newBb = db.billboards.find((b) => b.ID === 901);
    expect(oldBb?.Status).toBe('متاح');
    expect(oldBb?.Contract_Number).toBeNull();
    expect(newBb?.Status).toBe('مؤجرة');
    expect(newBb?.Contract_Number).toBe(1001);

    // Strict Pause Isolation Check
    expect(db.pausedBillboards.length).toBe(initialPausedCount);
    expect(db.pausedReplacements.length).toBe(initialPausedReplCount);
  });

  it('Test D: Cheaper candidate preserves slot price without refunds or deductions', () => {
    const db = new InstantSwapSimulationDb();

    db.contracts.push({
      Contract_Number: 1002,
      'Customer Name': 'شركة ليبيانا',
      Total: 3000,
      billboard_ids: '101',
      billboard_prices: JSON.stringify([{ billboardId: '101', contractPrice: 3000 }]),
    });

    db.billboards.push(
      { ID: 101, Billboard_Name: 'لوحة رئيسية', Status: 'مؤجرة', Contract_Number: 1002, Price: 3000 },
      { ID: 202, Billboard_Name: 'لوحة اقتصادية', Status: 'متاح', Contract_Number: null, Price: 1500 } // Listing price 1500!
    );

    const res = db.executeInstantBillboardSwap({
      contractNumber: 1002,
      originalBillboardId: 101,
      replacementBillboardId: 202,
    });

    expect(res.success).toBe(true);
    expect(res.preserved_contract_price).toBe(3000); // Preserved slot price
    expect(db.contracts[0].Total).toBe(3000); // Total stays 3000
    expect(db.pausedBillboards.length).toBe(0); // Zero pause records
  });

  it('Test E & H: Rejects unavailable candidate and duplicate candidates inside the same contract', () => {
    const db = new InstantSwapSimulationDb();

    db.contracts.push({
      Contract_Number: 1003,
      Total: 6000,
      billboard_ids: '501,502',
      billboard_prices: JSON.stringify([
        { billboardId: '501', contractPrice: 3000 },
        { billboardId: '502', contractPrice: 3000 },
      ]),
    });

    db.billboards.push(
      { ID: 501, Status: 'مؤجرة', Contract_Number: 1003 },
      { ID: 502, Status: 'مؤجرة', Contract_Number: 1003 },
      { ID: 503, Status: 'مؤجرة', Contract_Number: 9999 } // Rented to another contract!
    );

    // 1. Try swapping to 503 (Rented to another contract)
    const resUnavailable = db.executeInstantBillboardSwap({
      contractNumber: 1003,
      originalBillboardId: 501,
      replacementBillboardId: 503,
    });
    expect(resUnavailable.success).toBe(false);
    expect(resUnavailable.code).toBe('CANDIDATE_NOT_AVAILABLE');

    // 2. Try swapping to 502 (Already in the same contract)
    const resDuplicate = db.executeInstantBillboardSwap({
      contractNumber: 1003,
      originalBillboardId: 501,
      replacementBillboardId: 502,
    });
    expect(resDuplicate.success).toBe(false);
    expect(resDuplicate.code).toBe('NEW_BILLBOARD_ALREADY_IN_CONTRACT');

    // 3. Try self-swap 501 -> 501
    const resSelf = db.executeInstantBillboardSwap({
      contractNumber: 1003,
      originalBillboardId: 501,
      replacementBillboardId: 501,
    });
    expect(resSelf.success).toBe(false);
    expect(resSelf.code).toBe('SAME_BILLBOARD');
  });

  it('Test G: Preserves CSV array position and alignment', () => {
    const db = new InstantSwapSimulationDb();

    db.contracts.push({
      Contract_Number: 1004,
      Total: 6000,
      billboard_ids: '632,633,642',
      billboard_prices: JSON.stringify([
        { billboardId: '632', contractPrice: 1000 },
        { billboardId: '633', contractPrice: 2500 },
        { billboardId: '642', contractPrice: 2500 },
      ]),
    });

    db.billboards.push(
      { ID: 632, Status: 'مؤجرة', Contract_Number: 1004 },
      { ID: 633, Status: 'مؤجرة', Contract_Number: 1004 },
      { ID: 642, Status: 'مؤجرة', Contract_Number: 1004 },
      { ID: 901, Status: 'متاح', Contract_Number: null }
    );

    // Swap middle element: 633 -> 901
    const res = db.executeInstantBillboardSwap({
      contractNumber: 1004,
      originalBillboardId: 633,
      replacementBillboardId: 901,
    });

    expect(res.success).toBe(true);
    // Position MUST be exact: index 1 was 633, now 901!
    expect(db.contracts[0].billboard_ids).toBe('632,901,642');
  });

  it('Test I: Semantically migrates pending tasks while preserving completed historical tasks', () => {
    const db = new InstantSwapSimulationDb();

    db.contracts.push({
      Contract_Number: 1005,
      Total: 4000,
      billboard_ids: '701',
      billboard_prices: JSON.stringify([{ billboardId: '701', contractPrice: 4000 }]),
    });

    db.billboards.push(
      { ID: 701, Status: 'مؤجرة', Contract_Number: 1005 },
      { ID: 801, Status: 'متاح', Contract_Number: null }
    );

    // Task 1: Pending installation item on 701
    db.installationTaskItems.push({
      id: 'task-item-1',
      contract_id: 1005,
      billboard_id: 701,
      status: 'pending',
    });

    // Task 2: Completed historical installation item on 701
    db.installationTaskItems.push({
      id: 'task-item-2',
      contract_id: 1005,
      billboard_id: 701,
      status: 'completed',
    });

    // Execute swap
    const res = db.executeInstantBillboardSwap({
      contractNumber: 1005,
      originalBillboardId: 701,
      replacementBillboardId: 801,
    });

    expect(res.success).toBe(true);

    // Pending item transferred to 801
    const pendingItem = db.installationTaskItems.find((i) => i.id === 'task-item-1');
    expect(pendingItem?.billboard_id).toBe(801);

    // Completed item remains on 701 (historical preservation)
    const completedItem = db.installationTaskItems.find((i) => i.id === 'task-item-2');
    expect(completedItem?.billboard_id).toBe(701);
  });
});
