import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Printer } from 'lucide-react';
import { PRINT_MODE_LABELS, type LetterPrintMode } from '@/services/correspondence';

export const MODE_HINT: Record<LetterPrintMode, string> = {
  full: 'الترويسة والكتابة معاً على ورق أبيض',
  background: 'الترويسة فقط لتجهيز أوراق رسمية مطبوعة مسبقاً',
  text: 'الكتابة فقط فوق ورقة مطبوعة الترويسة — اطبع بمقياس 100% وبدون هوامش',
};

/** زر طباعة بثلاثة أوضاع */
export function PrintMenu({ onPrint, size = 'default', label = 'طباعة', yearOnlyDate, onYearOnlyDateChange }: { onPrint: (m: LetterPrintMode) => void; size?: 'sm' | 'default'; label?: string; yearOnlyDate?: boolean; onYearOnlyDateChange?: (checked: boolean) => void }) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button size={size} variant="outline" className={size === 'sm' ? 'h-8' : ''}><Printer className="h-3.5 w-3.5" />{label}<ChevronDown className="h-3 w-3 opacity-60" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {onYearOnlyDateChange && <>
          <DropdownMenuCheckboxItem checked={yearOnlyDate} onCheckedChange={onYearOnlyDateChange} onSelect={e => e.preventDefault()} className="cursor-pointer transition-colors duration-200">
            التاريخ: السنة فقط (اليوم والشهر فارغان)
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
        </>}
        {(Object.keys(PRINT_MODE_LABELS) as LetterPrintMode[]).map(m => (
          <DropdownMenuItem key={m} onClick={() => onPrint(m)} className="flex-col items-start gap-0.5">
            <span className="font-semibold">{PRINT_MODE_LABELS[m]}</span>
            <span className="text-xs text-muted-foreground">{MODE_HINT[m]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** معاينة A4 مصغّرة بنفس HTML الطباعة */
export interface LetterFit { scale: number; overflow: boolean; pages: number }

export function LetterPreview({ html, onFit }: { html: string; onFit?: (f: LetterFit) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.5);
  const [docH, setDocH] = useState(1123);
  useEffect(() => {
    const h = (e: MessageEvent) => { if (e.source !== frame.current?.contentWindow || e.data?.type !== 'letter-fit') return;
      if (e.data.height) setDocH(Math.max(1123, Number(e.data.height)));
      onFit?.({ scale: e.data.scale, overflow: e.data.overflow, pages: e.data.pages || 1 }); };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [onFit]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / 794)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} dir="ltr" className="relative w-full min-w-0 overflow-hidden rounded-lg border border-border bg-[#e9e9e9]" style={{ height: docH * scale }}>
      <iframe ref={frame} title="معاينة المراسلة" srcDoc={html} className="absolute left-0 top-0 border-0" style={{ width: 794, height: docH, transform: `scale(${scale})`, transformOrigin: 'top left' }} />
    </div>
  );
}

