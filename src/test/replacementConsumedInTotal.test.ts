import { describe, expect, it } from 'vitest';
import {
  historicalPauseContribution,
  pauseIdsWithConsumedInReplacement,
  replacementPriceIncludesConsumed,
} from '@/utils/pausedReplacementAccounting';

// انحدار العقد #1303: تبديل لوحة مركبة أظهر «-15,400 عن المحفوظ» لأن مستهلك
// الموقوفة المستبدلة استُثني من الإجمالي بينما سعر البديلة = المتبقي فقط.
describe('consumed part of a replaced installed board stays in the contract total', () => {
  const pauseId = 'p-1303';
  const installedPause = { id: pauseId, price_snapshot: { retainExecutedServices: true }, consumed_amount: 15400 };
  const fullPrice = 23100;
  const refund = 7700;

  it('counts consumed when the replacement price is the remaining rental only', () => {
    const prices = [{ billboardId: '900', _replacement_of: pauseId, finalPrice: refund, consumedCarryover: 15400 }];
    const included = pauseIdsWithConsumedInReplacement(JSON.stringify(prices));
    expect(included.has(pauseId)).toBe(false);
    const consumed = historicalPauseContribution(installedPause, fullPrice, refund, refund);
    const others = 76400 - fullPrice;
    // الإجمالي في الصفحة = باقي اللوحات + البديلة + مستهلك الموقوفة = المحفوظ
    expect(others + refund + (included.has(pauseId) ? 0 : consumed)).toBe(76400);
  });

  it('does not count consumed twice when the replacement row carries the full price', () => {
    const prices = [{ billboardId: '260', _replacement_of: pauseId, finalPrice: 5900, remainingRental: 4006.56, consumedCarryover: 1893.44 }];
    const included = pauseIdsWithConsumedInReplacement(prices);
    expect(included.has(pauseId)).toBe(true);
    expect(3600 + 5900 + (included.has(pauseId) ? 0 : 1893.44)).toBe(9500);
  });

  it('reads double-encoded or empty price snapshots safely', () => {
    const row = { _replacement_of: 'x', remainingRental: 10 };
    expect(pauseIdsWithConsumedInReplacement(JSON.stringify(JSON.stringify([row]))).has('x')).toBe(true);
    expect(pauseIdsWithConsumedInReplacement('').size).toBe(0);
    expect(pauseIdsWithConsumedInReplacement(null).size).toBe(0);
    expect(pauseIdsWithConsumedInReplacement('not json').size).toBe(0);
  });

  it('treats consumedCarryover alone as informational', () => {
    expect(replacementPriceIncludesConsumed({ consumedCarryover: 100 })).toBe(false);
    expect(replacementPriceIncludesConsumed({ remainingRental: 0 })).toBe(true);
    expect(replacementPriceIncludesConsumed({ remainingRental: '' })).toBe(false);
  });
});
