import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { UnitSliderField } from '@/components/print/UnitSliderField';
import { ElementSettings, ELEMENT_LABELS } from '@/hooks/useBillboardPrintSettings';
import { ChevronDown, Eye, EyeOff, Type, Move, Image, Square } from 'lucide-react';

interface ElementEditorProps {
  elementKey: string;
  element: ElementSettings;
  onUpdate: (updates: Partial<ElementSettings>) => void;
}

const FONT_OPTIONS = [
  { value: 'Doran', label: 'Doran' },
  { value: 'Manrope', label: 'Manrope' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Cairo', label: 'Cairo' },
  { value: 'Tajawal', label: 'Tajawal' },
];

const FONT_WEIGHT_OPTIONS = [
  { value: '300', label: 'خفيف' },
  { value: '400', label: 'عادي' },
  { value: '500', label: 'متوسط' },
  { value: '600', label: 'نصف عريض' },
  { value: '700', label: 'عريض' },
  { value: '900', label: 'عريض جداً' },
];

const OBJECT_FIT_OPTIONS = [
  { value: 'contain', label: 'احتواء' },
  { value: 'cover', label: 'تغطية' },
  { value: 'fill', label: 'تعبئة' },
  { value: 'none', label: 'بدون' },
  { value: 'scale-down', label: 'تصغير' },
];

const TEXT_ALIGN_OPTIONS = [
  { value: 'right', label: 'يمين' },
  { value: 'center', label: 'وسط' },
  { value: 'left', label: 'يسار' },
];

export function ElementEditor({ elementKey, element, onUpdate }: ElementEditorProps) {
  const [isOpen, setIsOpen] = useState(true);
  const isImageElement = ['image', 'designs', 'cutoutImage', 'faceAImage', 'faceBImage', 'singleInstallationImage', 'linkedInstallationImages', 'twoFacesContainer', 'qrCode'].includes(elementKey);
  const isTextElement = ['contractNumber', 'adType', 'billboardName', 'size', 'facesCount', 'locationInfo', 'landmarkInfo', 'installationDate', 'printType'].includes(elementKey);

  return (
    <Card className="border-border/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {isImageElement ? <Image className="h-4 w-4 text-blue-500" /> : <Type className="h-4 w-4 text-green-500" />}
                {ELEMENT_LABELS[elementKey] || elementKey}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ visible: !element.visible });
                  }}
                >
                  {element.visible ? (
                    <Eye className="h-3 w-3 text-green-500" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="p-3 pt-0 space-y-4">
            {/* الموقع */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Move className="h-3 w-3" />
                الموقع
              </Label>
            <div className="grid grid-cols-2 gap-2">
              <UnitSliderField
                label="من الأعلى"
                value={element.top || '0'}
                onValueChange={(val) => onUpdate({ top: val })}
                min={0}
                max={300}
                defaultUnit="mm"
              />
              <UnitSliderField
                label={element.right ? 'من اليمين' : 'من اليسار'}
                value={element.right || element.left || '0'}
                onValueChange={(val) => onUpdate(element.right ? { right: val } : { left: val })}
                min={0}
                max={250}
                defaultUnit="mm"
              />
            </div>
          </div>

          {/* الأبعاد */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Square className="h-3 w-3" />
              الأبعاد
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <UnitSliderField
                label="العرض"
                value={element.width || '100px'}
                onValueChange={(val) => onUpdate({ width: val })}
                min={50}
                max={700}
                defaultUnit="px"
              />
              {isImageElement && (
                <UnitSliderField
                  label="الارتفاع"
                  value={element.height || '100px'}
                  onValueChange={(val) => onUpdate({ height: val })}
                  min={50}
                  max={500}
                  defaultUnit="px"
                />
              )}
            </div>
          </div>

            {/* خصائص النص */}
            {isTextElement && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Type className="h-3 w-3" />
                  النص
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <UnitSliderField
                    label="حجم الخط"
                    value={element.fontSize || '14px'}
                    onValueChange={(val) => onUpdate({ fontSize: val })}
                    min={8}
                    max={60}
                    defaultUnit="px"
                  />
                  <div className="space-y-1">
                    <Label className="text-[10px]">سُمك الخط</Label>
                    <Select
                      value={element.fontWeight || '400'}
                      onValueChange={(val) => onUpdate({ fontWeight: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_WEIGHT_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">اللون</Label>
                    <div className="flex gap-1">
                      <Input
                        type="color"
                        value={element.color || '#000000'}
                        onChange={(e) => onUpdate({ color: e.target.value })}
                        className="h-8 w-10 p-1 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={element.color || '#000000'}
                        onChange={(e) => onUpdate({ color: e.target.value })}
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">المحاذاة</Label>
                    <Select
                      value={element.textAlign || 'right'}
                      onValueChange={(val) => onUpdate({ textAlign: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEXT_ALIGN_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* خصائص الصورة */}
            {isImageElement && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Image className="h-3 w-3" />
                  الصورة
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">طريقة العرض</Label>
                    <Select
                      value={element.objectFit || 'contain'}
                      onValueChange={(val) => onUpdate({ objectFit: val as ElementSettings['objectFit'] })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OBJECT_FIT_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <UnitSliderField
                    label="سُمك الإطار"
                    value={element.borderWidth || '0px'}
                    onValueChange={(val) => onUpdate({ borderWidth: val })}
                    min={0}
                    max={10}
                    defaultUnit="px"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">لون الإطار</Label>
                    <div className="flex gap-1">
                      <Input
                        type="color"
                        value={element.borderColor || '#000000'}
                        onChange={(e) => onUpdate({ borderColor: e.target.value })}
                        className="h-8 w-10 p-1 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={element.borderColor || '#000000'}
                        onChange={(e) => onUpdate({ borderColor: e.target.value })}
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                  </div>
                  <UnitSliderField
                    label="استدارة الزوايا"
                    value={element.borderRadius || '0px'}
                    onValueChange={(val) => onUpdate({ borderRadius: val })}
                    min={0}
                    max={50}
                    defaultUnit="px"
                  />
                </div>
                
                {(elementKey === 'designs' || elementKey === 'twoFacesContainer' || elementKey === 'linkedInstallationImages') && (
                  <UnitSliderField
                    label="المسافة بين العناصر"
                    value={element.gap || '20px'}
                    onValueChange={(val) => onUpdate({ gap: val })}
                    min={0}
                    max={100}
                    defaultUnit="px"
                  />
                )}
              </div>
            )}

            {/* الدوران */}
            <div className="space-y-1">
              <Label className="text-[10px]">الدوران</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[parseInt(element.rotation || '0')]}
                  onValueChange={([val]) => onUpdate({ rotation: String(val) })}
                  min={-180}
                  max={180}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-10 text-center">
                  {element.rotation || '0'}°
                </span>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface ElementsEditorListProps {
  elements: Record<string, ElementSettings>;
  selectedElement: string | null;
  onSelectElement: (key: string) => void;
  onUpdateElement: (key: string, updates: Partial<ElementSettings>) => void;
}

export function ElementsEditorList({ 
  elements, 
  selectedElement, 
  onSelectElement, 
  onUpdateElement 
}: ElementsEditorListProps) {
  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-2 p-2">
        {Object.entries(elements).map(([key, element]) => (
          <div
            key={key}
            className={`rounded-lg transition-colors ${
              selectedElement === key ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onSelectElement(key)}
          >
            <ElementEditor
              elementKey={key}
              element={element}
              onUpdate={(updates) => onUpdateElement(key, updates)}
            />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
