import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react';

/** حجم البطاقات: إعداد واحد محفوظ في هذا الجهاز ومشترك بين كل الصفحات */
export type CardSize = 'xs' | 'sm' | 'md' | 'lg';
const KEY = 'ui-card-size';
const EVENT = 'ui-card-size-change';
const ORDER: CardSize[] = ['xs', 'sm', 'md', 'lg'];

const read = (): CardSize => {
  try { const v = localStorage.getItem(KEY); return v === 'xs' || v === 'md' || v === 'lg' ? v : 'sm'; } catch { return 'sm'; }
};

export function useCardSize(): [CardSize, (s: CardSize) => void] {
  const [size, setSize] = useState<CardSize>(read);
  useEffect(() => {
    const sync = () => setSize(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const set = (s: CardSize) => {
    try { localStorage.setItem(KEY, s); } catch { /* ignore */ }
    setSize(s);
    window.dispatchEvent(new Event(EVENT));
  };
  return [size, set];
}

/** أصناف الشبكة وارتفاع البطاقة لكل حجم */
export const CARD_GRID: Record<CardSize, { grid: string; height: string; img: string; text: string }> = {
  xs: { grid: 'grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-6', height: '220px', img: '100px', text: 'text-[0.8rem]' },
  sm: { grid: 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1900px]:grid-cols-5', height: '280px', img: '130px', text: 'text-[0.9rem]' },
  md: { grid: 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4', height: '340px', img: '170px', text: 'text-[0.95rem]' },
  lg: { grid: 'grid gap-4 lg:grid-cols-2 2xl:grid-cols-3', height: '420px', img: '220px', text: 'text-base' },
};

export const cardVars = (s: CardSize) => ({ ['--card-h' as any]: CARD_GRID[s].height, ['--img-h' as any]: CARD_GRID[s].img }) as CSSProperties;

export function CardSizeControl({ className }: { className?: string }) {
  const [size, setSize] = useCardSize();
  const idx = ORDER.indexOf(size);
  const label = { xs: 'صغير جداً', sm: 'صغير', md: 'متوسط', lg: 'كبير' }[size];
  return (
    <div className={cn('flex items-center rounded-lg border border-border', className)} role="group" aria-label="حجم البطاقات">
      <button type="button" aria-label="تصغير البطاقات" disabled={idx === 0} onClick={() => setSize(ORDER[idx - 1])} className="flex h-9 w-9 items-center justify-center disabled:opacity-30"><Minus className="h-4 w-4" /></button>
      <span className="min-w-[4.5rem] text-center text-sm">{label}</span>
      <button type="button" aria-label="تكبير البطاقات" disabled={idx === ORDER.length - 1} onClick={() => setSize(ORDER[idx + 1])} className="flex h-9 w-9 items-center justify-center disabled:opacity-30"><Plus className="h-4 w-4" /></button>
    </div>
  );
}
