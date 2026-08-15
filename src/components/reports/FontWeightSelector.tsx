import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FontWeightSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const FONT_WEIGHTS = [
  { value: '300', label: 'خفيف (Light)', weight: 300 },
  { value: '400', label: 'عادي (Regular)', weight: 400 },
  { value: '500', label: 'متوسط (Medium)', weight: 500 },
  { value: '600', label: 'نصف عريض (Semi Bold)', weight: 600 },
  { value: '700', label: 'عريض (Bold)', weight: 700 },
  { value: '800', label: 'عريض جداً (Extra Bold)', weight: 800 },
];

export function FontWeightSelector({ value, onChange }: FontWeightSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>وزن الخط</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="اختر وزن الخط" />
        </SelectTrigger>
        <SelectContent>
          {FONT_WEIGHTS.map(weight => (
            <SelectItem 
              key={weight.value} 
              value={weight.value}
              style={{ fontWeight: weight.weight }}
            >
              {weight.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function getFontWeight(weightValue: string): number {
  const weight = FONT_WEIGHTS.find(w => w.value === weightValue);
  return weight?.weight || 400;
}
