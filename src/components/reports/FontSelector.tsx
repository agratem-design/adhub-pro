import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FontSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const AVAILABLE_FONTS = [
  { value: 'system', label: 'خط النظام (افتراضي)', family: 'system-ui' },
  { value: 'cairo', label: 'Cairo', family: 'Cairo, sans-serif' },
  { value: 'tajawal', label: 'Tajawal', family: 'Tajawal, sans-serif' },
  { value: 'almarai', label: 'Almarai', family: 'Almarai, sans-serif' },
  { value: 'amiri', label: 'Amiri', family: 'Amiri, serif' },
  { value: 'scheherazade', label: 'Scheherazade New', family: 'Scheherazade New, serif' },
  { value: 'doran', label: 'Doran (محلي)', family: 'Doran, sans-serif' },
  { value: 'manrope', label: 'Manrope (محلي)', family: 'Manrope, sans-serif' },
];

export function FontSelector({ value, onChange }: FontSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>نوع الخط</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="اختر نوع الخط" />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_FONTS.map(font => (
            <SelectItem 
              key={font.value} 
              value={font.value}
              style={{ fontFamily: font.family }}
            >
              {font.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function getFontFamily(fontValue: string): string {
  const font = AVAILABLE_FONTS.find(f => f.value === fontValue);
  return font?.family || 'system-ui';
}
