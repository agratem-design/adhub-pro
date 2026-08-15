import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UnitSliderField } from '@/components/print/UnitSliderField';
import { PrintSettings } from '@/hooks/useBillboardPrintSettings';
import { Image, Type, Upload, RotateCcw } from 'lucide-react';

interface GlobalSettingsEditorProps {
  settings: PrintSettings;
  onUpdateSetting: <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => void;
  onResetToDefault: () => void;
}

const FONT_OPTIONS = [
  { value: 'Doran', label: 'Doran' },
  { value: 'Manrope', label: 'Manrope' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Cairo', label: 'Cairo' },
  { value: 'Tajawal', label: 'Tajawal' },
];

export function GlobalSettingsEditor({
  settings,
  onUpdateSetting,
  onResetToDefault,
}: GlobalSettingsEditorProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // لأغراض العرض، نستخدم Data URL
    // في الإنتاج، يجب رفع الملف إلى Supabase Storage
    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdateSetting('background_url', reader.result as string);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {/* الخلفية */}
      <Card className="border-border/50">
        <CardHeader className="p-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Image className="h-4 w-4 text-blue-500" />
            الخلفية
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">رابط الخلفية</Label>
            <div className="flex gap-2">
              <Input
                value={settings.background_url}
                onChange={(e) => onUpdateSetting('background_url', e.target.value)}
                placeholder="/ipg.svg"
                className="flex-1 h-8 text-xs"
              />
              <Label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBackgroundUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={isUploading}
                  asChild
                >
                  <span>
                    <Upload className="h-3 w-3" />
                  </span>
                </Button>
              </Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <UnitSliderField
              label="العرض"
              value={settings.background_width}
              onValueChange={(val) => onUpdateSetting('background_width', val)}
              min={150}
              max={300}
              defaultUnit="mm"
            />
            <UnitSliderField
              label="الارتفاع"
              value={settings.background_height}
              onValueChange={(val) => onUpdateSetting('background_height', val)}
              min={200}
              max={450}
              defaultUnit="mm"
            />
          </div>

          {/* معاينة مصغرة للخلفية */}
          <div className="aspect-[210/297] bg-muted rounded-lg overflow-hidden border max-h-32">
            <img
              src={settings.background_url}
              alt="خلفية"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* الخطوط */}
      <Card className="border-border/50">
        <CardHeader className="p-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Type className="h-4 w-4 text-green-500" />
            الخطوط
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">الخط الرئيسي</Label>
            <select
              value={settings.primary_font}
              onChange={(e) => onUpdateSetting('primary_font', e.target.value)}
              className="w-full h-8 text-sm border rounded-md px-2 bg-background"
            >
              {FONT_OPTIONS.map(font => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">الخط الثانوي</Label>
            <select
              value={settings.secondary_font}
              onChange={(e) => onUpdateSetting('secondary_font', e.target.value)}
              className="w-full h-8 text-sm border rounded-md px-2 bg-background"
            >
              {FONT_OPTIONS.map(font => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* إعادة التعيين */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onResetToDefault}
      >
        <RotateCcw className="h-3 w-3 ml-1" />
        إعادة تعيين للافتراضي
      </Button>
    </div>
  );
}
