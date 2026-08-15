import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export type Unit = "mm" | "px" | "%";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseUnitValue(raw: string | undefined, defaultUnit: Unit): { value: number; unit: Unit } {
  if (!raw) return { value: 0, unit: defaultUnit };

  const v = raw.toString().trim();
  const match = v.match(/^(-?\d*\.?\d+)\s*(mm|px|%)?$/i);
  if (!match) return { value: 0, unit: defaultUnit };

  const num = Number(match[1]);
  const unit = ((match[2] || defaultUnit) as Unit);
  return { value: Number.isFinite(num) ? num : 0, unit };
}

function formatUnitValue(value: number, unit: Unit) {
  // keep up to 2 decimals
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}${unit}`;
}

interface UnitSliderFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  defaultUnit: Unit;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: string) => void;
}

export function UnitSliderField({
  label,
  value,
  placeholder,
  defaultUnit,
  min,
  max,
  step = 1,
  onValueChange,
}: UnitSliderFieldProps) {
  const parsed = React.useMemo(() => parseUnitValue(value, defaultUnit), [value, defaultUnit]);

  // If unit is %, use percent range
  const effectiveMin = parsed.unit === "%" ? 0 : min;
  const effectiveMax = parsed.unit === "%" ? 100 : max;
  const effectiveStep = parsed.unit === "%" ? 0.5 : step;

  const clamped = clamp(parsed.value, effectiveMin, effectiveMax);

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="grid grid-cols-1 gap-2">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={Number.isFinite(parsed.value) ? parsed.value : 0}
            onChange={(e) => {
              const num = Number(e.target.value);
              const next = Number.isFinite(num) ? num : 0;
              onValueChange(formatUnitValue(next, parsed.unit));
            }}
            placeholder={placeholder}
            className="w-28"
          />
          <div className="text-xs text-muted-foreground min-w-8">{parsed.unit}</div>
          <Slider
            value={[clamped]}
            onValueChange={([v]) => onValueChange(formatUnitValue(v, parsed.unit))}
            min={effectiveMin}
            max={effectiveMax}
            step={effectiveStep}
            className="flex-1"
          />
          <div className="text-xs text-muted-foreground w-12 text-left">{Math.round(clamped * 10) / 10}</div>
        </div>
      </div>
    </div>
  );
}
