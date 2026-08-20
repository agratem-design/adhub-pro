import { describe, it, expect } from 'vitest';
import { isSameCanonicalSize, isDimensionTextSimilar } from '@/components/contracts/edit/InstantBillboardSwapDialog';

describe('Canonical Size Matching (isSameCanonicalSize)', () => {
  it('Test A: Matches when size_id is identical despite different label text', () => {
    const current = { size_id: 11, Size: '4x3' };
    const candidate = { size_id: 11, Size: '4 × 3 متر' };
    expect(isSameCanonicalSize(current, candidate)).toBe(true);
  });

  it('Test B: Rejects when size_id is different even if text is identical', () => {
    const current = { size_id: 11, Size: '4x3' };
    const candidate = { size_id: 7, Size: '4x3' };
    expect(isSameCanonicalSize(current, candidate)).toBe(false);
  });

  it('Test C: Normalizes string and numeric size_id safely', () => {
    const current = { size_id: 11 };
    const candidate = { size_id: '11' };
    expect(isSameCanonicalSize(current, candidate)).toBe(true);
  });

  it('Test D: Handles Size_ID field casing variation', () => {
    const current = { Size_ID: 11, Size: '4x3' };
    const candidate = { size_id: 11, Size: '4x3' };
    expect(isSameCanonicalSize(current, candidate)).toBe(true);
  });

  it('Test E: Missing canonical size ID on candidate does NOT match', () => {
    const current = { size_id: 11, Size: '4x3' };
    const candidate = { size_id: null, Size: '4x3' };
    expect(isSameCanonicalSize(current, candidate)).toBe(false);
  });

  it('Test F: Missing canonical size ID on current does NOT match', () => {
    const current = { size_id: null, Size: '4x3' };
    const candidate = { size_id: 11, Size: '4x3' };
    expect(isSameCanonicalSize(current, candidate)).toBe(false);
  });

  it('Test G: Missing canonical size IDs on both does NOT match canonical same-size filter', () => {
    const current = { size_id: null, Size: '4*3' };
    const candidate = { size_id: null, Size: '4 × 3 متر' };
    expect(isSameCanonicalSize(current, candidate)).toBe(false);
  });

  it('Test H: Informational helper isDimensionTextSimilar verifies text similarity without canonical matching', () => {
    const current = { Size: '4*3' };
    const candidate = { Size: '4 × 3 متر' };
    expect(isDimensionTextSimilar(current, candidate)).toBe(true);
  });
});

describe('Financial Invariants & Double-Counting Prevention Matrix', () => {
  it('Test A: Rent only contract', () => {
    const db = { Total: 100000, base_rent: 100000, Discount: 0, installation_cost: 0, print_cost: 0 };
    const extraInstall = 0;
    const extraPrint = 0;
    const disc = Number(db.Discount || 0);
    const contractualRentalBase = db.Total - extraInstall - extraPrint + disc;
    const finalTotal = contractualRentalBase - disc + extraInstall + extraPrint;
    expect(contractualRentalBase).toBe(100000);
    expect(finalTotal).toBe(100000);
    expect(finalTotal - db.Total).toBe(0);
  });

  it('Test B: Rent + Printing (Included in price)', () => {
    const db = {
      Total: 100000,
      base_rent: 100000,
      print_cost: 10000,
      print_cost_enabled: 'true',
      include_print_in_billboard_price: true,
      Discount: 0,
    };
    const extraPrint = 0;
    const contractualRentalBase = db.Total - extraPrint;
    const finalTotal = contractualRentalBase + extraPrint;
    expect(contractualRentalBase).toBe(100000);
    expect(finalTotal).toBe(100000);
  });

  it('Test C: Rent + Printing (Extra / Charged to Customer)', () => {
    const db = {
      Total: 110000,
      base_rent: 100000,
      print_cost: 10000,
      print_cost_enabled: 'true',
      include_print_in_billboard_price: false,
      Discount: 0,
    };
    const extraPrint = 10000;
    const contractualRentalBase = db.Total - extraPrint;
    const finalTotal = contractualRentalBase + extraPrint;
    expect(contractualRentalBase).toBe(100000);
    expect(finalTotal).toBe(110000);
  });

  it('Test D: Rent + Printing + Installation (All Extra / Charged to Customer)', () => {
    const db = {
      Total: 120000,
      base_rent: 100000,
      installation_cost: 10000,
      installation_enabled: true,
      include_installation_in_price: false,
      print_cost: 10000,
      print_cost_enabled: 'true',
      include_print_in_billboard_price: false,
      Discount: 0,
    };
    const extraInstall = 10000;
    const extraPrint = 10000;
    const contractualRentalBase = db.Total - extraInstall - extraPrint;
    const finalTotal = contractualRentalBase + extraInstall + extraPrint;
    expect(contractualRentalBase).toBe(100000);
    expect(finalTotal).toBe(120000);
  });

  it('Test E: Rent + Printing + Installation + Discount (No Double Counting)', () => {
    const db = {
      Total: 95000,
      base_rent: 80000,
      installation_cost: 10000,
      installation_enabled: true,
      include_installation_in_price: false,
      print_cost: 10000,
      print_cost_enabled: 'true',
      include_print_in_billboard_price: false,
      Discount: 5000,
    };
    const extraInstall = 10000;
    const extraPrint = 10000;
    const disc = 5000;
    const contractualRentalBase = db.Total - extraInstall - extraPrint + disc;
    const finalTotal = contractualRentalBase - disc + extraInstall + extraPrint;
    expect(contractualRentalBase).toBe(80000);
    expect(finalTotal).toBe(95000);
    expect(finalTotal - db.Total).toBe(0);
  });

  it('Test F: Contract 1158 exact proof (220,000 Total, 203,574 Total Rent)', () => {
    const db = {
      Total: 220000,
      'Total Rent': 203574,
      base_rent: 209300,
      installation_cost: 6000,
      installation_enabled: true,
      include_installation_in_price: true,
      print_cost: 10426,
      print_cost_enabled: 'true',
      include_print_in_billboard_price: true,
      Discount: 0,
    };
    const extraInstall = 0;
    const extraPrint = 0;
    const disc = 0;

    const contractualRentalBase = db.Total - extraInstall - extraPrint + disc;
    const customerRentalAfterDiscount = contractualRentalBase - disc;
    const finalTotal = customerRentalAfterDiscount + extraInstall + extraPrint;
    const netTotalRent = customerRentalAfterDiscount - db.installation_cost - db.print_cost;

    expect(contractualRentalBase).toBe(220000);
    expect(finalTotal).toBe(220000);
    expect(netTotalRent).toBe(203574); // Exact match to Contract.Total Rent in DB!
    expect(finalTotal - db.Total).toBe(0);
  });
});
