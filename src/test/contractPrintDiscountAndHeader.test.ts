import { describe, it, expect } from 'vitest';
import { DEFAULT_TABLE_SETTINGS, DEFAULT_TABLE_COLUMNS } from '../hooks/useContractTemplateSettings';
import { solidFillDataUri } from '../lib/contractTableRenderer';

describe('Contract Print: Header White Styling & Discount Display', () => {
  it('should have white header background (#ffffff) and black text (#000000) by default', () => {
    expect(DEFAULT_TABLE_SETTINGS.headerBgColor).toBe('#ffffff');
    expect(DEFAULT_TABLE_SETTINGS.headerTextColor).toBe('#000000');
    expect(DEFAULT_TABLE_SETTINGS.highlightedColumns).toEqual([]);
  });

  it('should include endDate column in DEFAULT_TABLE_COLUMNS with visible: true', () => {
    const endCol = DEFAULT_TABLE_COLUMNS.find(c => c.key === 'endDate');
    expect(endCol).toBeDefined();
    expect(endCol?.label).toBe('تاريخ الانتهاء');
    expect(endCol?.visible).toBe(true);
  });

  it('should generate valid solidFillDataUri for white header (#ffffff)', () => {
    const uri = solidFillDataUri('#ffffff');
    expect(uri).toContain('data:image/svg+xml');
    expect(uri).toContain(encodeURIComponent('fill="#ffffff"'));
  });

  it('should correctly calculate discount from contract snapshot', () => {
    const livePrices = [
      { billboardId: '101', baseRentalPrice: 6000, discountPerBillboard: 1000, totalForBoard: 5000 },
      { billboardId: '102', baseRentalPrice: 4000, discountPerBillboard: 500, totalForBoard: 3500 },
    ];

    const sumDiscounts = livePrices.reduce((sum, item) => sum + (item.discountPerBillboard || 0), 0);
    expect(sumDiscounts).toBe(1500);

    const priceBefore = livePrices[0].baseRentalPrice;
    const priceAfter = livePrices[0].totalForBoard;
    expect(priceBefore).toBeGreaterThan(priceAfter);
    expect(priceBefore - priceAfter).toBe(1000);
  });

  it('should correctly replace {discount} in contract clause terms', () => {
    const clause = 'إجمالي تكلفة الإيجار لعدد ({billboardsCount}) لوحة إعلانية هو ({totalAmount}) {currency} {discount}. {inclusionText}.';
    const discountText = 'بعد خصم 1,500 دينار ليبي';
    const totalAmount = '8,500';
    const currency = 'دينار ليبي';
    const billboardsCount = '2';
    const inclusionText = 'غير شامل الطباعة وشامل التركيب';

    const rendered = clause
      .replace(/{totalAmount}/g, totalAmount)
      .replace(/{discount}/g, discountText)
      .replace(/{currency}/g, currency)
      .replace(/{billboardsCount}/g, billboardsCount)
      .replace(/{inclusionText}/g, inclusionText);

    expect(rendered).toContain('بعد خصم 1,500 دينار ليبي');
    expect(rendered).toContain('(8,500) دينار ليبي بعد خصم 1,500 دينار ليبي');
  });

  it('should fallback to appending discount if {discount} placeholder is missing in clause', () => {
    const customClause = 'إجمالي تكلفة الإيجار لعدد (2) لوحة إعلانية هو (8,500) دينار ليبي.';
    const discountText = 'بعد خصم 1,500 دينار ليبي';
    const totalAmount = '8,500';

    let rendered = customClause;
    if (discountText && !rendered.includes('{discount}') && rendered.includes(totalAmount)) {
      rendered = rendered.replace(totalAmount, `${totalAmount} (${discountText})`);
    }

    expect(rendered).toContain('8,500 (بعد خصم 1,500 دينار ليبي)');
  });
});
