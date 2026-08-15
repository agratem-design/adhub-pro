import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw, Save, Palette } from 'lucide-react';
import { SiteThemeSettings } from '@/hooks/useSiteTheme';

interface SiteThemePanelProps {
  theme: SiteThemeSettings;
  onThemeChange: (key: keyof SiteThemeSettings, value: string) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

function ColorInput({ label, value, onChange, description }: ColorInputProps) {
  return (
    <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-14 p-1 cursor-pointer"
          />
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-24 text-xs font-mono"
            placeholder="#000000"
          />
        </div>
      </div>
    </div>
  );
}

export function SiteThemePanel({
  theme,
  onThemeChange,
  onSave,
  onReset,
  saving
}: SiteThemePanelProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            ألوان الموقع
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="h-8"
            >
              <RotateCcw className="h-3.5 w-3.5 ml-1" />
              افتراضي
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={saving}
              className="h-8"
            >
              <Save className="h-3.5 w-3.5 ml-1" />
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          تخصيص ألوان الواجهة (شكلي فقط - لا يؤثر على المنطق)
        </p>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-3">
            <ColorInput
              label="اللون الأساسي"
              value={theme.primary_color}
              onChange={(v) => onThemeChange('primary_color', v)}
              description="لون الأزرار والروابط الرئيسية"
            />
            
            <ColorInput
              label="اللون الثانوي"
              value={theme.secondary_color}
              onChange={(v) => onThemeChange('secondary_color', v)}
              description="لون العناصر الثانوية"
            />
            
            <ColorInput
              label="لون التمييز"
              value={theme.accent_color}
              onChange={(v) => onThemeChange('accent_color', v)}
              description="لون العناصر المميزة"
            />
            
            <ColorInput
              label="لون الخلفية"
              value={theme.background_color}
              onChange={(v) => onThemeChange('background_color', v)}
              description="لون خلفية الصفحة"
            />
            
            <ColorInput
              label="لون النصوص"
              value={theme.text_color}
              onChange={(v) => onThemeChange('text_color', v)}
              description="لون النصوص العامة"
            />
            
            <ColorInput
              label="لون الحدود"
              value={theme.border_color}
              onChange={(v) => onThemeChange('border_color', v)}
              description="لون حدود العناصر"
            />
            
            <ColorInput
              label="لون الخلفيات الخافتة"
              value={theme.muted_color}
              onChange={(v) => onThemeChange('muted_color', v)}
              description="لون الخلفيات الثانوية"
            />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
