import { describe, it, expect } from 'vitest';
import { fitCoverTitle } from '../components/design-studio/coverLayout';

describe('glass cover title sizing', () => {
  it('shrinks long Arabic titles within the glass focal area', () => {
    expect(fitCoverTitle(160, 'حملة إعلانية متكاملة لعلامتنا التجارية الجديدة في جميع المدن', 600)).toBeLessThan(fitCoverTitle(160, 'حملتنا', 600));
  });
  it('preserves a smaller user selected font size', () => {
    expect(fitCoverTitle(24, 'حملتنا', 600)).toBe(24);
  });
  it('scales proportionately for smaller cover dimensions', () => {
    expect(fitCoverTitle(80, 'حملتنا', 300)).toBe(fitCoverTitle(160, 'حملتنا', 600) / 2);
  });
});
