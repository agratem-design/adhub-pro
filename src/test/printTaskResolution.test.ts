import { describe, it, expect } from 'vitest';
import {
  resolveItemDesign,
  resolveDimensions,
  resolveCustomerAndContract,
  resolveAndValidatePrintItems,
  calculatePrintTaskTotals,
  InstallationItemInput,
  BillboardLookup,
  TaskDesignLookup,
  ContractDesignItem,
  ContractLookup
} from '@/services/printTaskResolutionService';

describe('Print Task Resolution & Integrity Service (P0)', () => {
  // Test 1: Single contract + single billboard + single design
  it('Test 1: should resolve exact design for single contract, billboard and design', () => {
    const item: InstallationItemInput = {
      id: 'item-1',
      billboard_id: 101,
      selected_design_id: 'design-1'
    };
    const billboard: BillboardLookup = {
      id: 101,
      size: '3x4',
      contractNumber: 1289
    };
    const taskDesignsMap: Record<string, TaskDesignLookup> = {
      'design-1': {
        id: 'design-1',
        designFaceAUrl: 'https://cdn.example.com/d1_a.jpg',
        designFaceBUrl: 'https://cdn.example.com/d1_b.jpg'
      }
    };

    const resolved = resolveItemDesign(item, billboard, taskDesignsMap);
    expect(resolved.faceA).toBe('https://cdn.example.com/d1_a.jpg');
    expect(resolved.faceB).toBe('https://cdn.example.com/d1_b.jpg');
    expect(resolved.source).toBe('SELECTED_DESIGN');
  });

  // Test 2: Single contract + 3 billboards + 3 different designs (Exact mapping, NO [0] cross-contamination)
  it('Test 2: should map 3 different designs to 3 billboards under same contract without cross-contamination', () => {
    const items: InstallationItemInput[] = [
      { id: 'item-1', billboard_id: 101 },
      { id: 'item-2', billboard_id: 102 },
      { id: 'item-3', billboard_id: 103 }
    ];

    const billboards: Record<number, BillboardLookup> = {
      101: { id: 101, size: '3x4', contractNumber: 1289 },
      102: { id: 102, size: '3x4', contractNumber: 1289 },
      103: { id: 103, size: '3x4', contractNumber: 1289 }
    };

    const contractDesignDataMap: Record<number, ContractDesignItem[]> = {
      1289: [
        { billboardId: 101, designFaceA: 'https://cdn.example.com/design_101.jpg' },
        { billboardId: 102, designFaceA: 'https://cdn.example.com/design_102.jpg' },
        { billboardId: 103, designFaceA: 'https://cdn.example.com/design_103.jpg' }
      ]
    };

    const res1 = resolveItemDesign(items[0], billboards[101], {}, contractDesignDataMap);
    const res2 = resolveItemDesign(items[1], billboards[102], {}, contractDesignDataMap);
    const res3 = resolveItemDesign(items[2], billboards[103], {}, contractDesignDataMap);

    expect(res1.faceA).toBe('https://cdn.example.com/design_101.jpg');
    expect(res2.faceA).toBe('https://cdn.example.com/design_102.jpg');
    expect(res3.faceA).toBe('https://cdn.example.com/design_103.jpg');

    // Verify no cross-contamination
    expect(res1.faceA).not.toBe(res2.faceA);
    expect(res2.faceA).not.toBe(res3.faceA);
  });

  // Test 3: Multi-Contract Isolation (2 contracts + 4 billboards)
  it('Test 3: should maintain exact contract identity for billboards across multiple contracts', () => {
    const taskItems: InstallationItemInput[] = [
      { id: 'item-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/c1_d1.jpg' },
      { id: 'item-2', billboard_id: 102, design_face_a: 'https://cdn.example.com/c1_d2.jpg' },
      { id: 'item-3', billboard_id: 201, design_face_a: 'https://cdn.example.com/c2_d1.jpg' },
      { id: 'item-4', billboard_id: 202, design_face_a: 'https://cdn.example.com/c2_d2.jpg' }
    ];

    const billboardsMap: Record<number, BillboardLookup> = {
      101: { id: 101, size: '3x4', contractNumber: 1289 },
      102: { id: 102, size: '3x4', contractNumber: 1289 },
      201: { id: 201, size: '4x12', contractNumber: 1302 },
      202: { id: 202, size: '4x12', contractNumber: 1302 }
    };

    const contractMap: Record<number, ContractLookup> = {
      1289: { contractNumber: 1289, customerId: 'cust-1', customerName: 'شركة الأفق' },
      1302: { contractNumber: 1302, customerId: 'cust-1', customerName: 'شركة الأفق' }
    };

    const validation = resolveAndValidatePrintItems({
      selectedBillboardIds: [101, 102, 201, 202],
      taskItems,
      billboardsMap,
      contractMap,
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    });

    expect(validation.valid).toBe(true);
    expect(validation.resolvedItems).toHaveLength(4);

    expect(validation.resolvedItems[0].contractId).toBe(1289);
    expect(validation.resolvedItems[1].contractId).toBe(1289);
    expect(validation.resolvedItems[2].contractId).toBe(1302);
    expect(validation.resolvedItems[3].contractId).toBe(1302);
  });

  // Test 4: Two-Face Billboard (Face A vs Face B)
  it('Test 4: should create separate items for Face A and Face B with correct designs and 1-quantity each', () => {
    const taskItems: InstallationItemInput[] = [
      {
        id: 'item-1',
        billboard_id: 301,
        design_face_a: 'https://cdn.example.com/face_a.jpg',
        design_face_b: 'https://cdn.example.com/face_b.jpg',
        faces_to_install: 2
      }
    ];

    const billboardsMap: Record<number, BillboardLookup> = {
      301: { id: 301, size: '3x4', contractNumber: 1289, facesCount: 2 }
    };

    const contractMap: Record<number, ContractLookup> = {
      1289: { contractNumber: 1289, customerId: 'cust-1', customerName: 'العميل' }
    };

    const validation = resolveAndValidatePrintItems({
      selectedBillboardIds: [301],
      taskItems,
      billboardsMap,
      contractMap,
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    });

    expect(validation.valid).toBe(true);
    expect(validation.resolvedItems).toHaveLength(2);

    const faceAItem = validation.resolvedItems.find(i => i.face === 'a')!;
    const faceBItem = validation.resolvedItems.find(i => i.face === 'b')!;

    expect(faceAItem.designUrl).toBe('https://cdn.example.com/face_a.jpg');
    expect(faceBItem.designUrl).toBe('https://cdn.example.com/face_b.jpg');
    expect(faceAItem.quantity).toBe(1);
    expect(faceBItem.quantity).toBe(1);
    expect(faceAItem.area).toBe(12);
    expect(faceBItem.area).toBe(12);
    expect(faceAItem.printerTotalCost).toBe(120); // 12m² * 10
    expect(faceBItem.printerTotalCost).toBe(120);
  });

  // Test 5: Fallback to exact billboard in Contract.design_data
  it('Test 5: should resolve design from Contract.design_data strictly for matching billboard ID', () => {
    const item: InstallationItemInput = { id: 'item-1', billboard_id: 555 };
    const billboard: BillboardLookup = { id: 555, size: '3x4', contractNumber: 1289 };

    const contractDesignDataMap: Record<number, ContractDesignItem[]> = {
      1289: [
        { billboardId: 111, designFaceA: 'https://cdn.example.com/wrong.jpg' },
        { billboardId: 555, designFaceA: 'https://cdn.example.com/correct_555.jpg' }
      ]
    };

    const resolved = resolveItemDesign(item, billboard, {}, contractDesignDataMap);
    expect(resolved.faceA).toBe('https://cdn.example.com/correct_555.jpg');
    expect(resolved.source).toBe('CONTRACT_DESIGN_DATA');
  });

  // Test 6: Missing Design Error
  it('Test 6: should fail validation and report missing design when no design exists', () => {
    const taskItems: InstallationItemInput[] = [{ id: 'item-1', billboard_id: 999 }];
    const billboardsMap: Record<number, BillboardLookup> = {
      999: { id: 999, size: '3x4', contractNumber: 1289 }
    };
    const contractMap: Record<number, ContractLookup> = {
      1289: { contractNumber: 1289, customerId: 'cust-1', customerName: 'العميل' }
    };

    const validation = resolveAndValidatePrintItems({
      selectedBillboardIds: [999],
      taskItems,
      billboardsMap,
      contractMap,
      printerPricePerMeter: 10,
      customerPricePerMeter: 20,
      allowDraftWithoutDesign: false
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors[0].code).toBe('MISSING_DESIGN');
    expect(validation.errors[0].billboardId).toBe(999);
  });

  // Test 7: Customer Conflict Detection
  it('Test 7: should detect and reject customer conflict between Contract and Composite Task', () => {
    const billboard: BillboardLookup = { id: 100, size: '3x4', contractNumber: 1289 };
    const contractMap: Record<number, ContractLookup> = {
      1289: { contractNumber: 1289, customerId: 'cust-74', customerName: 'شركة النور' }
    };
    const compositeCustomer = { customerId: 'cust-91', customerName: 'شركة الفجر' };

    const res = resolveCustomerAndContract(100, billboard, 1289, contractMap, compositeCustomer);
    expect(res.conflict).not.toBeNull();
    expect(res.conflict?.code).toBe('CUSTOMER_CONFLICT');
  });

  // Test 8: Missing Customer (Never unknown_customer)
  it('Test 8: should reject missing customer and never return unknown_customer', () => {
    const billboard: BillboardLookup = { id: 100, size: '3x4', contractNumber: 1289 };
    const contractMap: Record<number, ContractLookup> = {
      1289: { contractNumber: 1289, customerId: '', customerName: '' }
    };

    const res = resolveCustomerAndContract(100, billboard, 1289, contractMap, { customerId: null, customerName: null });
    expect(res.conflict).not.toBeNull();
    expect(res.conflict?.code).toBe('MISSING_CUSTOMER');
    expect(res.customerId).not.toBe('unknown_customer');
  });

  // Test 9: Dimension Resolution
  it('Test 9: should resolve dimensions from sizes table or parse string', () => {
    const sizesMap = {
      'mega-3x4': { width: 3, height: 4 },
      '4x12': { width: 4, height: 12 }
    };

    expect(resolveDimensions('mega-3x4', sizesMap)).toEqual({ width: 3, height: 4, valid: true });
    expect(resolveDimensions('5x10', sizesMap)).toEqual({ width: 5, height: 10, valid: true });
    expect(resolveDimensions('6*15', sizesMap)).toEqual({ width: 6, height: 15, valid: true });
    expect(resolveDimensions('invalid', sizesMap)).toEqual({ width: 0, height: 0, valid: false });
    expect(resolveDimensions(null, sizesMap)).toEqual({ width: 0, height: 0, valid: false });
  });

  // Test 10: Invalid Pricing Rejection
  it('Test 10: should reject negative or NaN pricing', () => {
    const validation = resolveAndValidatePrintItems({
      selectedBillboardIds: [101],
      taskItems: [{ id: 'item-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d.jpg' }],
      billboardsMap: { 101: { id: 101, size: '3x4', contractNumber: 1289 } },
      contractMap: { 1289: { contractNumber: 1289, customerId: 'cust-1', customerName: 'العميل' } },
      printerPricePerMeter: -10,
      customerPricePerMeter: NaN
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.code === 'INVALID_PRICING')).toBe(true);
  });

  // Test 11: Accurate Totals & Profit Margins
  it('Test 11: should compute print totals and net profits accurately', () => {
    const taskItems: InstallationItemInput[] = [
      { id: 'item-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d1.jpg' },
      { id: 'item-2', billboard_id: 102, design_face_a: 'https://cdn.example.com/d2.jpg' }
    ];

    const billboardsMap: Record<number, BillboardLookup> = {
      101: { id: 101, size: '3x4', contractNumber: 1289 }, // 12 m²
      102: { id: 102, size: '4x12', contractNumber: 1289 } // 48 m²
    };

    const contractMap: Record<number, ContractLookup> = {
      1289: { contractNumber: 1289, customerId: 'cust-1', customerName: 'العميل' }
    };

    const validation = resolveAndValidatePrintItems({
      selectedBillboardIds: [101, 102],
      taskItems,
      billboardsMap,
      contractMap,
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    });

    expect(validation.valid).toBe(true);

    const totals = calculatePrintTaskTotals(validation.resolvedItems, { printerTotal: 50, customerTotal: 100 });
    // Total area: 12 + 48 = 60 m²
    // Printer print cost: 60 * 10 = 600
    // Customer print cost: 60 * 20 = 1200
    // Print Profit: 1200 - 600 = 600
    // Cutout Profit: 100 - 50 = 50
    // Total Profit: 650
    expect(totals.totalArea).toBe(60);
    expect(totals.printerPrintTotal).toBe(600);
    expect(totals.customerPrintTotal).toBe(1200);
    expect(totals.printerTotal).toBe(650);
    expect(totals.customerTotal).toBe(1300);
    expect(totals.printProfit).toBe(600);
    expect(totals.cutoutProfit).toBe(50);
    expect(totals.totalProfit).toBe(650);
  });
});
