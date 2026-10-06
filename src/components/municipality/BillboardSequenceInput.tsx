import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export function BillboardSequenceInput({ sequence, total, name, onApply }: {
  sequence: number; total: number; name: string; onApply: (target: number) => void;
}) {
  const [value, setValue] = useState(String(sequence));
  const [error, setError] = useState(false);
  useEffect(() => { setValue(String(sequence)); setError(false); }, [sequence, name]);
  const changed = value !== String(sequence);
  const apply = () => {
    const target = Number(value);
    if (!value.trim() || !Number.isInteger(target) || target < 1 || target > total) {
      setError(true);
      return;
    }
    setError(false);
    if (target !== sequence) {
      onApply(target);
      setValue(String(sequence));
    }
  };
  return (
    <div className="flex flex-col gap-1" onClick={event => event.stopPropagation()}>
      <div className="flex items-center gap-1">
        <Input type="number" min={1} max={total} step={1} dir="ltr"
          aria-label={`رقم ترتيب ${name}`} aria-invalid={error}
          title={`رقم اللوحة في القائمة: من 1 إلى ${total}`}
          value={value} onFocus={event => event.target.select()}
          onChange={event => { setValue(event.target.value); setError(false); }}
          onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); apply(); }
            if (event.key === 'Escape') { setValue(String(sequence)); setError(false); }
          }}
          className="h-10 w-[70px] rounded-lg border-primary/25 bg-primary/5 text-center text-[13px] font-semibold text-primary" />
        {changed && <Button type="button" size="icon" variant="outline"
          aria-label={`تطبيق رقم ترتيب ${name}`} title="تطبيق الرقم"
          className="h-10 w-10 shrink-0 cursor-pointer text-primary transition-all duration-200 hover:bg-primary/10"
          onClick={apply}><Check className="h-4 w-4" /></Button>}
      </div>
      {error && <span role="alert" className="max-w-[120px] text-[11px] text-destructive">أدخل رقمًا من 1 إلى {total}</span>}
    </div>
  );
}
