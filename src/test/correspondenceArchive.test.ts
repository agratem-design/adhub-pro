import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseCellNumber,
  isTotalLabel,
  renderMarkup,
  archiveLetter,
  nextReference,
  MISSING_ARCHIVE_COLUMN,
  type Letter,
} from '@/services/correspondence';
import { supabase } from '@/integrations/supabase/client';

describe('Correspondence Archive & Number formatting', () => {
  it('parses Arabic, English and formatted currency numbers correctly', () => {
    expect(parseCellNumber('1500')).toBe(1500);
    expect(parseCellNumber('1,500')).toBe(1500);
    expect(parseCellNumber('١٥٠٠')).toBe(1500);
    expect(parseCellNumber('1500 د.ل')).toBe(1500);
    expect(parseCellNumber('**2,350.50 دينار**')).toBe(2350.5);
    expect(parseCellNumber('15%')).toBe(15);
    expect(parseCellNumber('نص عادي')).toBeNull();
    expect(parseCellNumber('طرابلس')).toBeNull();
  });

  it('detects total label row in various Arabic forms', () => {
    expect(isTotalLabel('الإجمالي')).toBe(true);
    expect(isTotalLabel('الاجمالي')).toBe(true);
    expect(isTotalLabel('المجموع')).toBe(true);
    expect(isTotalLabel('المجموع الكلي')).toBe(true);
    expect(isTotalLabel('**الإجمالي العام**')).toBe(true);
    expect(isTotalLabel('البند الأول')).toBe(false);
  });

  it('renders table markup with num and total classes', () => {
    const markup = [
      '| البيان | الكمية | السعر |',
      '| لافتة | 5 | 1000 |',
      '| الإجمالي | 5 | 5000 |',
    ].join('\n');
    const html = renderMarkup(markup);
    expect(html).toContain('<table');
    expect(html).toContain('class="num"');
    expect(html).toContain('class="total"');
  });

  it('computes nextReference correctly', () => {
    const letters: Partial<Letter>[] = [
      { reference_number: 'F101' },
      { reference_number: 'F105' },
      { reference_number: 'F99' },
    ];
    expect(nextReference('F', letters as Letter[])).toBe('F106');
    expect(nextReference('F', [])).toBe('F1');
  });

  it('archiveLetter updates archived_at timestamp or clears it', async () => {
    const eqSpy = vi.fn().mockResolvedValue({ error: null });
    const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
    vi.spyOn(supabase as any, 'from').mockReturnValue({ update: updateSpy });

    await archiveLetter('letter-123', true);
    expect(supabase.from).toHaveBeenCalledWith('letters');
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      archived_at: expect.any(String),
    }));
    expect(eqSpy).toHaveBeenCalledWith('id', 'letter-123');

    await archiveLetter('letter-123', false);
    expect(updateSpy).toHaveBeenCalledWith({ archived_at: null });
  });

  it('archiveLetter returns friendly error if archived_at column is missing', async () => {
    const eqSpy = vi.fn().mockResolvedValue({ error: { message: 'column "archived_at" of relation "letters" does not exist' } });
    const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
    vi.spyOn(supabase as any, 'from').mockReturnValue({ update: updateSpy });

    await expect(archiveLetter('letter-123', true)).rejects.toThrow(MISSING_ARCHIVE_COLUMN);
  });
});
