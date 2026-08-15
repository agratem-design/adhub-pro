import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { 
  Image, 
  Type, 
  MapPin, 
  QrCode, 
  ChevronDown, 
  RotateCcw, 
  Save,
  Settings2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MoveHorizontal,
  Tag
} from 'lucide-react';
import { PrintCustomizationSettings } from '@/hooks/usePrintCustomization';

export type PreviewStatusMode = 'normal' | 'no-design' | 'one-design' | 'one-face' | 'with-cutout';

interface PrintCustomizationPanelProps {
  settings: PrintCustomizationSettings;
  onSettingChange: (key: keyof PrintCustomizationSettings, value: string) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
  previewStatusMode?: PreviewStatusMode;
  onPreviewStatusModeChange?: (mode: PreviewStatusMode) => void;
}

// تحويل قيمة mm إلى رقم للمنزلق
const mmToNumber = (value: string): number => {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
};

// تحويل رقم إلى mm
const numberToMm = (value: number): string => `${value}mm`;

// تحويل px إلى رقم
const pxToNumber = (value: string): number => {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 12 : num;
};

// تحويل رقم إلى px
const numberToPx = (value: number): string => `${value}px`;

// تحويل نسبة مئوية إلى رقم
const percentToNumber = (value: string): number => {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 50 : num;
};

// تحويل رقم إلى نسبة مئوية
const numberToPercent = (value: number): string => `${value}%`;

interface SettingSliderProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  step?: number;
  unit: 'mm' | 'px' | '%';
}

function SettingSlider({ label, value, onChange, min, max, step = 1, unit }: SettingSliderProps) {
  const parseValue = () => {
    if (unit === 'mm') return mmToNumber(value);
    if (unit === 'px') return pxToNumber(value);
    return percentToNumber(value);
  };

  const formatValue = (num: number) => {
    if (unit === 'mm') return numberToMm(num);
    if (unit === 'px') return numberToPx(num);
    return numberToPercent(num);
  };

  const numValue = parseValue();

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-xs">{label}</Label>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 h-7 text-xs text-center"
        />
      </div>
      <Slider
        value={[numValue]}
        onValueChange={([v]) => onChange(formatValue(v))}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );
}

// مكون التحكم بالمحاذاة
interface AlignmentControlProps {
  value: string;
  onChange: (value: string) => void;
}

function AlignmentControl({ value, onChange }: AlignmentControlProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">المحاذاة</Label>
      <ToggleGroup type="single" value={value} onValueChange={(v) => v && onChange(v)} className="justify-start">
        <ToggleGroupItem value="right" aria-label="يمين" className="h-7 w-7">
          <AlignRight className="h-3.5 w-3.5" />
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="وسط" className="h-7 w-7">
          <AlignCenter className="h-3.5 w-3.5" />
        </ToggleGroupItem>
        <ToggleGroupItem value="left" aria-label="يسار" className="h-7 w-7">
          <AlignLeft className="h-3.5 w-3.5" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

// مكون الإزاحة الأفقية
interface OffsetControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function OffsetControl({ label, value, onChange }: OffsetControlProps) {
  const numValue = mmToNumber(value);
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-xs flex items-center gap-1">
          <MoveHorizontal className="h-3 w-3" />
          {label}
        </Label>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 h-7 text-xs text-center"
        />
      </div>
      <Slider
        value={[numValue]}
        onValueChange={([v]) => onChange(numberToMm(v))}
        min={-50}
        max={50}
        step={1}
        className="w-full"
      />
    </div>
  );
}

interface SettingGroupProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  conditionNote?: string;
}

function SettingGroup({ title, icon, children, defaultOpen = false, conditionNote }: SettingGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <div className="text-right">
            <span className="font-medium text-sm block">{title}</span>
            {conditionNote && (
              <span className="text-[10px] text-muted-foreground">{conditionNote}</span>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PrintCustomizationPanel({
  settings,
  onSettingChange,
  onSave,
  onReset,
  saving,
  previewStatusMode,
  onPreviewStatusModeChange
}: PrintCustomizationPanelProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            تخصيص الطباعة
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
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs defaultValue="images" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b px-4">
            <TabsTrigger value="images" className="text-xs">
              <Image className="h-3.5 w-3.5 ml-1" />
              الصور
            </TabsTrigger>
            <TabsTrigger value="text" className="text-xs">
              <Type className="h-3.5 w-3.5 ml-1" />
              النصوص
            </TabsTrigger>
            <TabsTrigger value="location" className="text-xs">
              <MapPin className="h-3.5 w-3.5 ml-1" />
              الموقع
            </TabsTrigger>
            <TabsTrigger value="qr" className="text-xs">
              <QrCode className="h-3.5 w-3.5 ml-1" />
              QR
            </TabsTrigger>
            <TabsTrigger value="status" className="text-xs">
              <Tag className="h-3.5 w-3.5 ml-1" />
              الحالة
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-4">
              {/* تبويب الصور */}
              <TabsContent value="images" className="mt-0 space-y-4">
                <SettingGroup title="صورة اللوحة الرئيسية" icon={<Image className="h-4 w-4" />} defaultOpen>
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.main_image_top}
                    onChange={(v) => onSettingChange('main_image_top', v)}
                    min={50}
                    max={150}
                    unit="mm"
                  />
                  <SettingSlider
                    label="العرض"
                    value={settings.main_image_width}
                    onChange={(v) => onSettingChange('main_image_width', v)}
                    min={60}
                    max={180}
                    unit="mm"
                  />
                  <SettingSlider
                    label="الارتفاع"
                    value={settings.main_image_height}
                    onChange={(v) => onSettingChange('main_image_height', v)}
                    min={60}
                    max={180}
                    unit="mm"
                  />
                </SettingGroup>

                <SettingGroup title="صور التركيب (وجهين)" icon={<Image className="h-4 w-4" />}>
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.installed_images_top}
                    onChange={(v) => onSettingChange('installed_images_top', v)}
                    min={50}
                    max={150}
                    unit="mm"
                  />
                  <SettingSlider
                    label="العرض الكلي"
                    value={settings.installed_images_width}
                    onChange={(v) => onSettingChange('installed_images_width', v)}
                    min={100}
                    max={200}
                    unit="mm"
                  />
                  <SettingSlider
                    label="ارتفاع الصورة"
                    value={settings.installed_image_height}
                    onChange={(v) => onSettingChange('installed_image_height', v)}
                    min={40}
                    max={120}
                    unit="mm"
                  />
                  <SettingSlider
                    label="المسافة بين الصور"
                    value={settings.installed_images_gap}
                    onChange={(v) => onSettingChange('installed_images_gap', v)}
                    min={2}
                    max={20}
                    unit="mm"
                  />
                </SettingGroup>

                <SettingGroup title="صور التصاميم" icon={<Image className="h-4 w-4" />}>
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.designs_top}
                    onChange={(v) => onSettingChange('designs_top', v)}
                    min={150}
                    max={220}
                    unit="mm"
                  />
                  <SettingSlider
                    label="المسافة من اليسار"
                    value={settings.designs_left}
                    onChange={(v) => onSettingChange('designs_left', v)}
                    min={5}
                    max={50}
                    unit="mm"
                  />
                  <SettingSlider
                    label="ارتفاع صورة التصميم"
                    value={settings.design_image_height}
                    onChange={(v) => onSettingChange('design_image_height', v)}
                    min={30}
                    max={80}
                    unit="mm"
                  />
                </SettingGroup>
              </TabsContent>

              {/* تبويب النصوص */}
              <TabsContent value="text" className="mt-0 space-y-4">
                <SettingGroup title="اسم اللوحة" icon={<Type className="h-4 w-4" />} defaultOpen>
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.billboard_name_top}
                    onChange={(v) => onSettingChange('billboard_name_top', v)}
                    min={40}
                    max={80}
                    step={0.1}
                    unit="mm"
                  />
                  <SettingSlider
                    label="حجم الخط"
                    value={settings.billboard_name_font_size}
                    onChange={(v) => onSettingChange('billboard_name_font_size', v)}
                    min={12}
                    max={32}
                    unit="px"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">اللون</Label>
                      <Input
                        type="color"
                        value={settings.billboard_name_color}
                        onChange={(e) => onSettingChange('billboard_name_color', e.target.value)}
                        className="h-8 w-full"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">الوزن</Label>
                      <Input
                        type="text"
                        value={settings.billboard_name_font_weight}
                        onChange={(e) => onSettingChange('billboard_name_font_weight', e.target.value)}
                        className="h-8"
                        placeholder="500"
                      />
                    </div>
                  </div>
                  <AlignmentControl
                    value={settings.billboard_name_alignment}
                    onChange={(v) => onSettingChange('billboard_name_alignment', v)}
                  />
                  <OffsetControl
                    label="الإزاحة الأفقية"
                    value={settings.billboard_name_offset_x}
                    onChange={(v) => onSettingChange('billboard_name_offset_x', v)}
                  />
                </SettingGroup>

                <SettingGroup title="حالة اللوحة (أسفل الاسم)" icon={<Type className="h-4 w-4" />}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="billboard_status_enabled"
                      className="w-4 h-4"
                      checked={settings.billboard_status_enabled !== 'false'}
                      onChange={(e) => onSettingChange('billboard_status_enabled', e.target.checked ? 'true' : 'false')}
                    />
                    <Label htmlFor="billboard_status_enabled" className="text-xs cursor-pointer">إظهار حالة اللوحة تحت الاسم</Label>
                  </div>
                  <SettingSlider
                    label="حجم الخط"
                    value={settings.billboard_status_font_size}
                    onChange={(v) => onSettingChange('billboard_status_font_size', v)}
                    min={8}
                    max={28}
                    unit="px"
                  />
                  <SettingSlider
                    label="المسافة تحت اسم اللوحة"
                    value={settings.billboard_status_offset_y}
                    onChange={(v) => onSettingChange('billboard_status_offset_y', v)}
                    min={0}
                    max={20}
                    step={0.5}
                    unit="mm"
                  />
                  <p className="text-[10px] text-muted-foreground">اللون يتم استيراده تلقائياً من إدارة حالات الصيانة. الموقع مرتبط بحركة اسم اللوحة.</p>
                </SettingGroup>

                <SettingGroup title="المقاس" icon={<Type className="h-4 w-4" />}>
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.size_top}
                    onChange={(v) => onSettingChange('size_top', v)}
                    min={40}
                    max={80}
                    unit="mm"
                  />
                  <SettingSlider
                    label="حجم الخط"
                    value={settings.size_font_size}
                    onChange={(v) => onSettingChange('size_font_size', v)}
                    min={20}
                    max={60}
                    unit="px"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">اللون</Label>
                      <Input
                        type="color"
                        value={settings.size_color}
                        onChange={(e) => onSettingChange('size_color', e.target.value)}
                        className="h-8 w-full"
                      />
                    </div>
                  </div>
                  <AlignmentControl
                    value={settings.size_alignment}
                    onChange={(v) => onSettingChange('size_alignment', v)}
                  />
                  <OffsetControl
                    label="الإزاحة الأفقية"
                    value={settings.size_offset_x}
                    onChange={(v) => onSettingChange('size_offset_x', v)}
                  />
                </SettingGroup>

                <SettingGroup 
                  title="عدد الأوجه" 
                  icon={<Type className="h-4 w-4" />}
                  conditionNote="يظهر فقط عند وجود تصاميم"
                >
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.faces_count_top}
                    onChange={(v) => onSettingChange('faces_count_top', v)}
                    min={0}
                    max={90}
                    step={1}
                    unit="mm"
                  />
                  <SettingSlider
                    label="حجم الخط"
                    value={settings.faces_count_font_size}
                    onChange={(v) => onSettingChange('faces_count_font_size', v)}
                    min={8}
                    max={20}
                    unit="px"
                  />
                  <div className="flex-1">
                    <Label className="text-xs">اللون</Label>
                    <Input
                      type="color"
                      value={settings.faces_count_color}
                      onChange={(e) => onSettingChange('faces_count_color', e.target.value)}
                      className="h-8 w-full"
                    />
                  </div>
                  <AlignmentControl
                    value={settings.faces_count_alignment}
                    onChange={(v) => onSettingChange('faces_count_alignment', v)}
                  />
                  <OffsetControl
                    label="الإزاحة الأفقية"
                    value={settings.faces_count_offset_x}
                    onChange={(v) => onSettingChange('faces_count_offset_x', v)}
                  />
                </SettingGroup>

                <SettingGroup title="رقم العقد" icon={<Type className="h-4 w-4" />}>
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.contract_number_top}
                    onChange={(v) => onSettingChange('contract_number_top', v)}
                    min={30}
                    max={60}
                    step={0.1}
                    unit="mm"
                  />
                  <SettingSlider
                    label="حجم الخط"
                    value={settings.contract_number_font_size}
                    onChange={(v) => onSettingChange('contract_number_font_size', v)}
                    min={10}
                    max={24}
                    unit="px"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">اللون</Label>
                      <Input
                        type="color"
                        value={settings.contract_number_color || '#333'}
                        onChange={(e) => onSettingChange('contract_number_color', e.target.value)}
                        className="h-8 w-full"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">الوزن</Label>
                      <Input
                        type="text"
                        value={settings.contract_number_font_weight}
                        onChange={(e) => onSettingChange('contract_number_font_weight', e.target.value)}
                        className="h-8"
                        placeholder="500"
                      />
                    </div>
                  </div>
                  <AlignmentControl
                    value={settings.contract_number_alignment}
                    onChange={(v) => onSettingChange('contract_number_alignment', v)}
                  />
                  <OffsetControl
                    label="الإزاحة الأفقية"
                    value={settings.contract_number_offset_x}
                    onChange={(v) => onSettingChange('contract_number_offset_x', v)}
                  />
                </SettingGroup>

                <SettingGroup title="تاريخ التركيب" icon={<Type className="h-4 w-4" />}>
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.installation_date_top}
                    onChange={(v) => onSettingChange('installation_date_top', v)}
                    min={30}
                    max={60}
                    step={0.1}
                    unit="mm"
                  />
                  <SettingSlider
                    label="حجم الخط"
                    value={settings.installation_date_font_size}
                    onChange={(v) => onSettingChange('installation_date_font_size', v)}
                    min={8}
                    max={20}
                    unit="px"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">اللون</Label>
                      <Input
                        type="color"
                        value={settings.installation_date_color || '#333'}
                        onChange={(e) => onSettingChange('installation_date_color', e.target.value)}
                        className="h-8 w-full"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">الوزن</Label>
                      <Input
                        type="text"
                        value={settings.installation_date_font_weight || 'normal'}
                        onChange={(e) => onSettingChange('installation_date_font_weight', e.target.value)}
                        className="h-8"
                        placeholder="normal"
                      />
                    </div>
                  </div>
                  <AlignmentControl
                    value={settings.installation_date_alignment}
                    onChange={(v) => onSettingChange('installation_date_alignment', v)}
                  />
                  <OffsetControl
                    label="الإزاحة الأفقية"
                    value={settings.installation_date_offset_x}
                    onChange={(v) => onSettingChange('installation_date_offset_x', v)}
                  />
                </SettingGroup>

                <SettingGroup 
                  title="فريق التركيب" 
                  icon={<Type className="h-4 w-4" />}
                  conditionNote="يظهر فقط عند اختيار فرقة"
                >
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.team_name_top}
                    onChange={(v) => onSettingChange('team_name_top', v)}
                    min={60}
                    max={100}
                    unit="mm"
                  />
                  <SettingSlider
                    label="حجم الخط"
                    value={settings.team_name_font_size}
                    onChange={(v) => onSettingChange('team_name_font_size', v)}
                    min={10}
                    max={20}
                    unit="px"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">اللون</Label>
                      <Input
                        type="color"
                        value={settings.team_name_color || '#333'}
                        onChange={(e) => onSettingChange('team_name_color', e.target.value)}
                        className="h-8 w-full"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">الوزن</Label>
                      <Input
                        type="text"
                        value={settings.team_name_font_weight}
                        onChange={(e) => onSettingChange('team_name_font_weight', e.target.value)}
                        className="h-8"
                        placeholder="bold"
                      />
                    </div>
                  </div>
                  <AlignmentControl
                    value={settings.team_name_alignment}
                    onChange={(v) => onSettingChange('team_name_alignment', v)}
                  />
                  <OffsetControl
                    label="الإزاحة الأفقية"
                    value={settings.team_name_offset_x}
                    onChange={(v) => onSettingChange('team_name_offset_x', v)}
                  />
                </SettingGroup>
              </TabsContent>

              {/* تبويب الموقع */}
              <TabsContent value="location" className="mt-0 space-y-4">
                <SettingGroup title="البلدية والحي" icon={<MapPin className="h-4 w-4" />} defaultOpen>
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.location_info_top}
                    onChange={(v) => onSettingChange('location_info_top', v)}
                    min={200}
                    max={260}
                    unit="mm"
                  />
                  <SettingSlider
                    label="المسافة من اليسار"
                    value={settings.location_info_left}
                    onChange={(v) => onSettingChange('location_info_left', v)}
                    min={0}
                    max={150}
                    unit="mm"
                  />
                  <SettingSlider
                    label="حجم الخط"
                    value={settings.location_info_font_size}
                    onChange={(v) => onSettingChange('location_info_font_size', v)}
                    min={10}
                    max={24}
                    unit="px"
                  />
                  <div className="flex-1">
                    <Label className="text-xs">اللون</Label>
                    <Input
                      type="color"
                      value={settings.location_info_color || '#333'}
                      onChange={(e) => onSettingChange('location_info_color', e.target.value)}
                      className="h-8 w-full"
                    />
                  </div>
                  <AlignmentControl
                    value={settings.location_info_alignment}
                    onChange={(v) => onSettingChange('location_info_alignment', v)}
                  />
                  <OffsetControl
                    label="الإزاحة الأفقية"
                    value={settings.location_info_offset_x}
                    onChange={(v) => onSettingChange('location_info_offset_x', v)}
                  />
                </SettingGroup>

                <SettingGroup title="أقرب معلم" icon={<MapPin className="h-4 w-4" />}>
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.landmark_info_top}
                    onChange={(v) => onSettingChange('landmark_info_top', v)}
                    min={210}
                    max={270}
                    unit="mm"
                  />
                  <SettingSlider
                    label="المسافة من اليسار"
                    value={settings.landmark_info_left}
                    onChange={(v) => onSettingChange('landmark_info_left', v)}
                    min={0}
                    max={150}
                    unit="mm"
                  />
                  <SettingSlider
                    label="حجم الخط"
                    value={settings.landmark_info_font_size}
                    onChange={(v) => onSettingChange('landmark_info_font_size', v)}
                    min={10}
                    max={24}
                    unit="px"
                  />
                  <div className="flex-1">
                    <Label className="text-xs">اللون</Label>
                    <Input
                      type="color"
                      value={settings.landmark_info_color || '#333'}
                      onChange={(e) => onSettingChange('landmark_info_color', e.target.value)}
                      className="h-8 w-full"
                    />
                  </div>
                  <AlignmentControl
                    value={settings.landmark_info_alignment}
                    onChange={(v) => onSettingChange('landmark_info_alignment', v)}
                  />
                  <OffsetControl
                    label="الإزاحة الأفقية"
                    value={settings.landmark_info_offset_x}
                    onChange={(v) => onSettingChange('landmark_info_offset_x', v)}
                  />
                </SettingGroup>
              </TabsContent>

              {/* تبويب QR */}
              <TabsContent value="qr" className="mt-0 space-y-4">
                <SettingGroup title="رمز QR" icon={<QrCode className="h-4 w-4" />} defaultOpen>
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.qr_top}
                    onChange={(v) => onSettingChange('qr_top', v)}
                    min={220}
                    max={280}
                    unit="mm"
                  />
                  <SettingSlider
                    label="المسافة من اليسار"
                    value={settings.qr_left}
                    onChange={(v) => onSettingChange('qr_left', v)}
                    min={10}
                    max={180}
                    unit="mm"
                  />
                  <SettingSlider
                    label="الحجم"
                    value={settings.qr_size}
                    onChange={(v) => onSettingChange('qr_size', v)}
                    min={20}
                    max={50}
                    unit="mm"
                  />
                </SettingGroup>
              </TabsContent>

              {/* تبويب شارات الحالة */}
              <TabsContent value="status" className="mt-0 space-y-4">
                {/* أزرار التبديل بين الحالات */}
                <SettingGroup title="محاكاة الحالة" icon={<Tag className="h-4 w-4" />} defaultOpen conditionNote="اختر حالة لمشاهدة التأثير في المعاينة">
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { mode: 'normal' as PreviewStatusMode, label: 'عادي (الكل)' },
                      { mode: 'no-design' as PreviewStatusMode, label: 'بدون تصميم' },
                      { mode: 'one-design' as PreviewStatusMode, label: 'تصميم واحد' },
                      { mode: 'one-face' as PreviewStatusMode, label: 'وجه واحد' },
                      { mode: 'with-cutout' as PreviewStatusMode, label: 'مع مجسم' },
                    ]).map(({ mode, label }) => (
                      <Button
                        key={mode}
                        variant={(previewStatusMode || 'normal') === mode ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => onPreviewStatusModeChange?.(mode)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </SettingGroup>

                <SettingGroup title="شارات الحالة" icon={<Tag className="h-4 w-4" />} defaultOpen conditionNote="بدون تصميم / تصميم واحد / وجه واحد">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">إظهار الشارات</Label>
                      <input
                        type="checkbox"
                        checked={settings.status_badges_show !== 'false'}
                        onChange={(e) => onSettingChange('status_badges_show', e.target.checked ? 'true' : 'false')}
                        className="h-4 w-4"
                      />
                    </div>
                  </div>
                  <SettingSlider
                    label="المسافة من الأعلى"
                    value={settings.status_badges_top}
                    onChange={(v) => onSettingChange('status_badges_top', v)}
                    min={30}
                    max={250}
                    unit="mm"
                  />
                  <SettingSlider
                    label="الموضع الأفقي"
                    value={settings.status_badges_left}
                    onChange={(v) => onSettingChange('status_badges_left', v)}
                    min={10}
                    max={90}
                    unit="%"
                  />
                  <SettingSlider
                    label="حجم الخط"
                    value={settings.status_badges_font_size}
                    onChange={(v) => onSettingChange('status_badges_font_size', v)}
                    min={8}
                    max={18}
                    unit="px"
                  />
                </SettingGroup>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}
