import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';

interface DimensionsRowProps {
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  onChange: (field: 'width' | 'height' | 'depth', value: number | null) => void;
}

export function DimensionsRow({ width, height, depth, onChange }: DimensionsRowProps) {
  const handle = (field: 'width' | 'height' | 'depth') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(field, v === '' ? null : Number(v));
  };
  return (
    <div className="mt-3">
      <label className="expenses-form-label block mb-2">الأبعاد (اختياري - سم)</label>
      <div className="grid grid-cols-3 gap-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={width ?? ''}
          onChange={handle('width')}
          placeholder="الطول"
          className="bg-input border-border text-card-foreground"
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          value={height ?? ''}
          onChange={handle('height')}
          placeholder="العرض"
          className="bg-input border-border text-card-foreground"
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          value={depth ?? ''}
          onChange={handle('depth')}
          placeholder="الارتفاع"
          className="bg-input border-border text-card-foreground"
        />
      </div>
    </div>
  );
}

interface DuplicateItemControlProps {
  onDuplicate: (count: number) => void;
  disabled?: boolean;
}

export function DuplicateItemControl({ onDuplicate, disabled }: DuplicateItemControlProps) {
  const [count, setCount] = useState(1);
  return (
    <div className="mt-3 flex items-center gap-2 bg-muted/20 p-2 rounded border border-dashed border-border">
      <span className="text-sm text-muted-foreground">تكرار هذا الصنف:</span>
      <Input
        type="number"
        min="1"
        max="100"
        value={count}
        onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
        className="bg-input border-border text-card-foreground w-20 h-8"
      />
      <span className="text-sm text-muted-foreground">مرة</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => onDuplicate(count)}
        className="h-8"
      >
        <Copy className="h-3.5 w-3.5 ml-1" />
        نسخ
      </Button>
    </div>
  );
}
