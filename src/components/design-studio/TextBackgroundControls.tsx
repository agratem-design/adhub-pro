// 📁 TextBackgroundControls.tsx - عناصر التحكم السريعة بخلفية النص (كبسولات وشارات النصوص)
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Sparkles,
  Layers,
  CopyCheck,
  RotateCcw,
  Check,
} from 'lucide-react';
import {
  TEXT_BACKGROUND_PRESETS,
  TextBackgroundPreset,
  applyTextBackgroundToElement,
} from './textBackgroundPresets';
import { CanvasElement } from './types';

interface TextBackgroundControlsProps {
  element: CanvasElement;
  setTextElements: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  currentStripContext?: 'location' | 'panel' | 'all';
}

export function TextBackgroundControls({
  element,
  setTextElements,
  currentStripContext = 'all',
}: TextBackgroundControlsProps) {
  const isEnabled = Boolean(element.textBackground);

  const handleApplyPreset = (preset: TextBackgroundPreset, applyTextColor = false) => {
    setTextElements((prev) =>
      prev.map((el) => {
        if (el.id !== element.id) return el;
        return applyTextBackgroundToElement(el, preset, applyTextColor);
      })
    );
    toast.success(`تم تطبيق نمط خلفية النص: ${preset.name}`);
  };

  const handleApplyToAllInStrip = (preset: TextBackgroundPreset) => {
    setTextElements((prev) =>
      prev.map((el) => {
        if (el.type === 'image' || el.type === 'icon') return el;
        // Filter by strip context if specified
        if (currentStripContext === 'location') {
          const isLoc =
            el.parentStrip === 'location' ||
            ['municipality', 'region', 'landmark', 'municipality_region'].includes(el.id);
          if (!isLoc) return el;
        } else if (currentStripContext === 'panel') {
          const isLoc =
            el.parentStrip === 'location' ||
            ['municipality', 'region', 'landmark', 'municipality_region'].includes(el.id);
          if (isLoc) return el;
        }
        return applyTextBackgroundToElement(el, preset, true);
      })
    );
    toast.success(
      currentStripContext === 'location'
        ? 'تم تطبيق نمط الخلفية على كافة نصوص الموقع بنجاح'
        : 'تم تطبيق نمط الخلفية على كافة النصوص بنجاح'
    );
  };

  const updatePatch = (patch: Partial<CanvasElement>) => {
    setTextElements((prev) =>
      prev.map((el) => (el.id === element.id ? { ...el, ...patch } : el))
    );
  };

  return (
    <div className="space-y-3 pt-2 border-t border-border/40" dir="rtl">
      {/* ── Toggle Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <Label className="text-xs font-bold text-foreground">
            خلفية النص (كبسولة / شارة)
          </Label>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => {
            if (checked && !element.textBgColor) {
              // Default to royal obsidian gold on enable
              handleApplyPreset(TEXT_BACKGROUND_PRESETS[1]);
            } else {
              updatePatch({ textBackground: checked });
            }
          }}
        />
      </div>

      {/* ── Quick 1-Click Presets Grid ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>أنماط سريعة بنقرة واحدة:</span>
          </span>
          {isEnabled && (
            <button
              type="button"
              onClick={() => handleApplyPreset(TEXT_BACKGROUND_PRESETS[0])}
              className="text-destructive hover:underline text-[9px] flex items-center gap-0.5 cursor-pointer"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>إلغاء</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_BACKGROUND_PRESETS.map((preset) => {
            const isSelected =
              isEnabled &&
              element.textBgColor === preset.bgColor &&
              (element.textBgBorder || 'none') === (preset.borderColor || 'none');

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset, Boolean(preset.textColor))}
                className={`relative flex items-center gap-2 p-1.5 rounded-lg border text-right transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary ring-1 ring-primary bg-primary/10 shadow-sm'
                    : 'border-border/40 hover:border-primary/50 bg-background/50'
                }`}
              >
                {/* Mini Preview Chip */}
                <div
                  className="w-7 h-5 rounded flex items-center justify-center shrink-0 text-[8px] font-bold"
                  style={{
                    backgroundColor: preset.previewBg,
                    border: preset.previewBorder,
                    color: preset.previewTextColor,
                  }}
                >
                  Aa
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-foreground truncate">
                    {preset.name}
                  </div>
                </div>

                {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Custom Background Controls (when enabled) ── */}
      {isEnabled && (
        <div className="space-y-2.5 p-2.5 rounded-xl border border-border/40 bg-card/50 text-xs">
          {/* Background Color */}
          <div className="space-y-1">
            <Label className="text-[10px]">لون خلفية النص والشفافية</Label>
            <div className="flex gap-1.5 items-center">
              <Input
                type="color"
                value={
                  element.textBgColor?.startsWith('#')
                    ? element.textBgColor
                    : '#0c0e14'
                }
                onChange={(e) => updatePatch({ textBgColor: e.target.value })}
                className="w-7 h-7 p-0 border cursor-pointer rounded shrink-0"
              />
              <Input
                value={element.textBgColor || 'rgba(12, 14, 20, 0.88)'}
                onChange={(e) => updatePatch({ textBgColor: e.target.value })}
                className="h-7 text-[10px] font-mono rounded w-full"
                placeholder="rgba(0,0,0,0.85)"
              />
            </div>
          </div>

          {/* Border Radius & Padding */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span>انحناء الحواف</span>
                <span className="font-mono">{element.textBgRadius ?? 8}px</span>
              </div>
              <Slider
                min={0}
                max={30}
                step={1}
                value={[element.textBgRadius ?? 8]}
                onValueChange={([v]) => updatePatch({ textBgRadius: v })}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span>الهوامش (Pad X)</span>
                <span className="font-mono">{element.textBgPaddingX ?? 12}px</span>
              </div>
              <Slider
                min={2}
                max={30}
                step={1}
                value={[element.textBgPaddingX ?? 12]}
                onValueChange={([v]) => updatePatch({ textBgPaddingX: v })}
              />
            </div>
          </div>

          {/* Quick Apply to all texts button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const currentPreset: TextBackgroundPreset = {
                id: 'custom',
                name: 'مخصص',
                description: '',
                enabled: true,
                bgColor: element.textBgColor || 'rgba(12, 14, 20, 0.88)',
                borderColor: element.textBgBorder || '1px solid rgba(214, 172, 64, 0.65)',
                borderRadius: element.textBgRadius ?? 8,
                paddingX: element.textBgPaddingX ?? 12,
                paddingY: element.textBgPaddingY ?? 4,
                blur: element.textBgBlur ?? 0,
                textColor: element.fontColor,
                previewBg: '',
                previewBorder: '',
                previewTextColor: '',
              };
              handleApplyToAllInStrip(currentPreset);
            }}
            className="w-full h-7 text-[10px] font-bold gap-1.5 rounded-lg border-primary/40 text-primary hover:bg-primary/10"
          >
            <CopyCheck className="h-3 w-3" />
            <span>
              {currentStripContext === 'location'
                ? 'تطبيق هذه الخلفية على كافة نصوص شريط الموقع'
                : 'تطبيق هذه الخلفية على كافة نصوص اللوحة'}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
