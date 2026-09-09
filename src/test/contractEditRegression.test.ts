import { describe, expect, it, vi } from 'vitest';
import { allocateMoney, parsePriceSnapshot, storedRental, validateContractInstallments } from '@/utils/contractEditMoney';
import { calculateRemainingBillboardValue } from '@/utils/contractBillboardCalculations';
import { calculateAllBillboardPrices } from '@/utils/contractBillboardPricing';

describe('Contract editing: monetary round trips', () => {
  it('preserves a negotiated zero instead of falling back to the catalog', () => {
    expect(storedRental({ basePriceBeforeDiscount: 0, contractPrice: 3000 })).toBe(0);
    expect(storedRental(undefined)).toBeNull();
  });
  it('reads both legacy serialized and native snapshots', () => {
    const rows = [{ billboardId: '1', baseRental: 75.25 }];
    expect(parsePriceSnapshot(JSON.stringify(rows))).toEqual(rows);
    expect(parsePriceSnapshot(rows)).toEqual(rows);
    expect(parsePriceSnapshot('{}')).toEqual([]);
  });
  it.each([0, 0.01, 100, 100.01, 123456.78])('allocates %s without creating or losing cents', total => {
    const values = allocateMoney(total, [1, 1, 1, 1, 1, 1, 1]);
    expect(values.reduce((sum, value) => sum + Math.round(value * 100), 0)).toBe(Math.round(total * 100));
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(0.011);
  });
  it('supports a zero-priced group and rejects invalid monetary input', () => {
    expect(allocateMoney(1, [0, 0])).toEqual([0.5, 0.5]);
    expect(() => allocateMoney(NaN, [1])).toThrow();
  });
  it('requires exact installment totals and valid nonnegative amounts', () => {
    const row = { amount: 10, dueDate: '2026-09-08' };
    expect(validateContractInstallments([row], 10)).toBeNull();
    expect(validateContractInstallments([row], 10.01)).not.toBeNull();
    expect(validateContractInstallments([{ ...row, amount: NaN }], 10)).not.toBeNull();
    expect(validateContractInstallments([{ ...row, amount: -1 }], -1)).not.toBeNull();
  });
});

describe('Pause calculations use the actual service interval', () => {
  it.each([true, false])('preserves completed service costs with include=%s', include => {
    const result = calculateRemainingBillboardValue({ startDate: '2026-01-01', endDate: '2026-01-30',
      effectiveDate: '2026-01-16', contractedPrice: 3500, printCost: 300, installCost: 200,
      includePrint: include, includeInstall: include });
    expect(result.remainingValue).toBe(1500);
    expect(result.consumedValue).toBe(2000);
    expect(result.remainingValue + result.consumedValue).toBe(3500);
  });
  it('includes the final contract day, with the pause day outside the consumed period', () => {
    const result = calculateRemainingBillboardValue({ startDate: '2026-01-01', endDate: '2026-01-30',
      effectiveDate: '2026-01-30', contractedPrice: 3000 });
    expect(result.elapsedDays).toBe(29);
    expect(result.remainingValue).toBe(100);
  });
  it('keeps individual discounts in the priced result used for the customer total', () => {
    const result = calculateAllBillboardPrices([{ billboardId: '1', baseRentalPrice: 1000,
      installationPrice: 0, printCost: 0, isSingleFace: false, individualDiscountValue: 100, individualDiscountType: 'amount' }],
    { totalDiscount: 0, printCostEnabled: false, includePrintInPrice: false, installationEnabled: false, includeInstallationInPrice: false });
    expect(result[0].totalForBoard).toBe(900);
  });
  it('keeps fractional discounts exact across multiple billboards', () => {
    for (const discount of [0.01, 0.99, 10.01, 33.33, 101.01]) {
      const inputs = [300.11, 500.22, 800.33].map((value, i) => ({billboardId:String(i),baseRentalPrice:value,installationPrice:0,printCost:0,isSingleFace:false}));
      const rows = calculateAllBillboardPrices(inputs, {totalDiscount:discount,printCostEnabled:false,includePrintInPrice:false,installationEnabled:false,includeInstallationInPrice:false});
      expect(Math.round(rows.reduce((sum,row)=>sum+row.totalForBoard,0)*100)).toBe(Math.round((1600.66-discount)*100));
    }
  });
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));
import { supabase } from '@/integrations/supabase/client';
import { saveContractEditAtomic } from '@/services/contractEditService';
it('does not fall back to a partial save if the transaction fails', async () => {
  vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'CONTRACT_VERSION_CONFLICT' } } as any);
  await expect(saveContractEditAtomic('5', { Total: 100 }, 4)).rejects.toThrow('تغيّر العقد');
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});

describe('Smart proportional discount distribution', () => {
  const options = {roundingMode: 'proportional' as const,totalDiscount:100,printCostEnabled:true,includePrintInPrice:true,installationEnabled:true,includeInstallationInPrice:true};
  const board = (id:string,base:number,extra:Record<string,unknown>={}) => ({billboardId:id,baseRentalPrice:base,printCost:0,installationPrice:0,isSingleFace:false,...extra});
  it('allocates by remaining rent after individual discounts and protects service costs', () => {
    const rows=calculateAllBillboardPrices([board('1',1000,{printCost:200,installationPrice:100,individualDiscountValue:100}),board('2',400)],options);
    expect(rows.map(row=>row.discountPerBillboard)).toEqual([60,40]);
    expect(rows.map(row=>row.totalForBoard)).toEqual([840,360]);
  });
  it('caps discounts at rental capacity and preserves fixed allocations', () => {
    const rows=calculateAllBillboardPrices([board('1',100,{printCost:60,installationPrice:40}),board('2',30),board('3',200,{isReplacement:true,replacementAllocation:200})],{...options,totalDiscount:500});
    expect(rows.map(row=>row.totalForBoard)).toEqual([100,0,200]);
    expect(rows.map(row=>row.discountPerBillboard)).toEqual([0,30,0]);
  });
  it('keeps cent ties stable when the page is sorted differently', () => {
    const input=[board('3',10),board('1',10),board('2',10)];
    const price=(rows:typeof input)=>Object.fromEntries(calculateAllBillboardPrices(rows,{...options,totalDiscount:0.01}).map(row=>[row.billboardId,row.discountPerBillboard]));
    expect(price(input)).toEqual(price([...input].reverse()));
    expect(price(input)).toEqual({'1':0.01,'2':0,'3':0});
  });
  it('preserves an unchanged saved distribution and redistributes when its sum changes', () => {
    const input=[board('1',100,{savedDiscount:60}),board('2',100,{savedDiscount:40})];
    expect(calculateAllBillboardPrices(input,options).map(row=>row.discountPerBillboard)).toEqual([60,40]);
    expect(calculateAllBillboardPrices(input,{...options,totalDiscount:80}).map(row=>row.discountPerBillboard)).toEqual([40,40]);
  });
  it('retains fractional single-face costs and caps individual percentage discounts', () => {
    const row=calculateAllBillboardPrices([board('1',100,{isSingleFace:true,printCost:25,installationPrice:15,individualDiscountValue:150,individualDiscountType:'percent'})],options)[0];
    expect(row.printCost).toBe(12.5);
    expect(row.installationPrice).toBe(7.5);
    expect(row.individualDiscountAmt).toBe(80);
    expect(row.totalForBoard).toBe(20);
  });
  it('conserves cents for a large varied contract without combinatorial search', () => {
    const input=Array.from({length:1000},(_,i)=>board(String(i),100+i*3.17));
    const rows=calculateAllBillboardPrices(input,{...options,totalDiscount:12345.67});
    expect(rows.reduce((sum,row)=>sum+Math.round(row.discountPerBillboard*100),0)).toBe(1234567);
    for(const row of rows) {
      expect(row.discountPerBillboard).toBeGreaterThanOrEqual(0);
      expect(row.discountPerBillboard).toBeLessThanOrEqual(row.netRentalBeforeDiscount);
      expect(Math.abs(row.discountPerBillboard-row.rawDiscountPerBillboard)).toBeLessThan(0.010001);
    }
  });
});

 it('keeps clean prices by default and settles only the unavoidable residual', () => {
   const inputs = ['a','b','c'].map(billboardId=>({billboardId,baseRentalPrice:1000,printCost:0,installationPrice:0,isSingleFace:false}));
   const options={totalDiscount:150,printCostEnabled:false,includePrintInPrice:false,installationEnabled:false,includeInstallationInPrice:false};
   expect(calculateAllBillboardPrices(inputs,options).map(row=>row.totalForBoard)).toEqual([950,950,950]);
   const rows=calculateAllBillboardPrices(inputs,{...options,totalDiscount:150.01});
   expect(rows.reduce((sum,row)=>sum+Math.round(row.discountPerBillboard*100),0)).toBe(15001);
   expect(rows.filter(row=>row.totalForBoard%50===0).length).toBeGreaterThanOrEqual(2);
   expect(calculateAllBillboardPrices([...inputs].reverse(),{...options,totalDiscount:150.01}).reverse()).toEqual(rows);
 });

it('clean distribution protects all service floors and conserves the total across varied contracts', () => {
  for (let count=1;count<=100;count++) {
    const inputs=Array.from({length:count},(_,i)=>({billboardId:String(i),baseRentalPrice:100+i*317.13,printCost:40,installationPrice:35,isSingleFace:false}));
    const capacity=inputs.reduce((sum,row)=>sum+Math.round((row.baseRentalPrice-75)*100),0)/100;
    const totalDiscount=Math.round(capacity*0.37*100)/100;
    const rows=calculateAllBillboardPrices(inputs,{totalDiscount,printCostEnabled:true,includePrintInPrice:true,installationEnabled:true,includeInstallationInPrice:true});
    expect(rows.reduce((sum,row)=>sum+Math.round(row.discountPerBillboard*100),0)).toBe(Math.round(totalDiscount*100));
    rows.forEach(row=>{expect(row.totalForBoard).toBeGreaterThanOrEqual(75);expect(row.discountPerBillboard).toBeGreaterThanOrEqual(0);});
  }
});
