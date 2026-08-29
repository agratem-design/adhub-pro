/**
 * صفحة تنظيم لوحات البلدية
 * - إضافة/جلب لوحات بلدية
 * - ترتيب تسلسلي + سحب وإفلات
 * - بحث داخلي
 * - عرض على الخريطة
 * - طباعة الكل
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Plus, Trash2, Save, Printer, MapPin, ArrowUp, ArrowDown, ArrowUpDown, Search, Edit2, FolderOpen, Upload, Building2, Settings2, GripVertical, ArrowLeftRight, Replace, Filter, Sticker, LayoutGrid, List, FileSpreadsheet, Camera, ImageIcon, Loader2, CheckCircle2, AlertTriangle, Sparkles, X as XIcon, XIcon as XIcon2, Info, RefreshCw, Eye, Check, SlidersHorizontal, ChevronDown, Wrench, Clock, Ban, Clipboard, Maximize2, ZoomIn, ZoomOut, ExternalLink, Download, PenTool, FileText, Layers, Tag, Copy, Files, Calendar, BookOpen } from 'lucide-react';
import { extractExifData } from '@/utils/exifExtractor';
import { uploadImage } from '@/services/imageUploadService';
import { compressLossless } from '@/utils/imageCompressor';
import { reverseGeocode } from '@/utils/geocoding';
import BillboardPhotoOverlayEditor, { BillboardOverlayConfig } from '@/components/municipality/BillboardPhotoOverlayEditor';
import QRCode from 'qrcode';
import MunicipalityStickerSettings, { useStickerSettings } from '@/components/municipality/MunicipalityStickerSettings';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';
import { printStickers } from '@/components/municipality/MunicipalityStickerPrint';
import { usePrintCustomization } from '@/hooks/usePrintCustomization';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';
import GoogleHomeMap from '@/components/Map/GoogleHomeMap';
import type { Billboard } from '@/types';
import * as XLSX from 'xlsx';
import { createPinSvgUrl } from '@/hooks/useMapMarkers';
import MunicipalityPrintSettingsDialog from '@/components/municipality/MunicipalityPrintSettingsDialog';
import { ExcelColumnMappingDialog, ColumnMapping } from '@/components/municipality/ExcelColumnMappingDialog';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';

import { Switch } from '@/components/ui/switch';
import { calculateDistance } from '@/hooks/useMapNavigation';
// Google Maps is loaded live in the print window - no static generator needed

interface CollectionItem {
  id?: string;
  sequence_number: number;
  billboard_id?: number | null;
  billboard_name?: string;
  size: string;
  faces_count: string;
  location_text: string;
  nearest_landmark: string;
  latitude: number | null;
  longitude: number | null;
  item_type: 'existing' | 'new';
  design_face_a?: string | null;
  design_face_b?: string | null;
  image_url?: string | null;
  municipality?: string;
  status?: string;
  overlay_config?: BillboardOverlayConfig;
}

interface Collection {
  id?: string;
  name: string;
  municipality_name?: string;
  description?: string;
  items: CollectionItem[];
}

const normalizeMuniName = (name: string | null | undefined): string => {
  if (!name) return '';
  const clean = String(name).trim();
  const legacyMap: Record<string, string> = {
    'قصر خيار': 'قصر الاخيار',
    'قصر_خيار': 'قصر الاخيار',
    'قصر الخيار': 'قصر الاخيار',
    'القره بوللي': 'القره بوللي',
    'القره_بوللي': 'القره بوللي',
    'القرهبوللي': 'القره بوللي',
    'طرابلس': 'طرابلس المركز',
    'طرابلس القديمة': 'طرابلس المركز',
    'صبراتة': 'صبراته',
    'امسلاته': 'امسلاتة',
    'مسلاتة': 'امسلاتة',
  };
  return legacyMap[clean] || clean;
};

const parseDimensions = (sizeStr: string) => {
  if (!sizeStr) return { length: '', width: '', height: '' };
  
  const normalized = String(sizeStr || '').trim();
  const lower = normalized.toLowerCase();

  // Specific preset mapping for non-numeric labels
  if (lower.includes('سوسيت') || lower.includes('soussette') || lower.includes('mupi')) {
    return { length: '2', width: '1.2', height: '' };
  }

  // Split by 'x' or 'X' or '×' or '*'
  const parts = normalized.replace(/×/g, 'x').replace(/\*/g, 'x').split(/x/i).map(p => p.trim());

  if (parts.length >= 2) {
    const cleanNum = (str: string) => {
      const match = str.match(/([0-9]+(?:\.[0-9]+)?)/);
      return match ? match[1] : '';
    };

    const d1 = cleanNum(parts[0]);
    const d2 = cleanNum(parts[1]);
    const d3 = parts[2] ? cleanNum(parts[2]) : '';

    if (d1 && d2) {
      const num1 = parseFloat(d1);
      const num2 = parseFloat(d2);
      const length = Math.max(num1, num2).toString();
      const width = Math.min(num1, num2).toString();
      return { length, width, height: d3 };
    }
  }

  // Fallback regex match for any 2 numbers in string
  const nums = normalized.match(/([0-9]+(?:\.[0-9]+)?)/g);
  if (nums && nums.length >= 2) {
    const n1 = parseFloat(nums[0]);
    const n2 = parseFloat(nums[1]);
    return {
      length: Math.max(n1, n2).toString(),
      width: Math.min(n1, n2).toString(),
      height: nums[2] || ''
    };
  }

  return { length: '', width: '', height: '' };
};

// Same as parseDimensions but returns numeric values + ratio (used in print overlay)
const parseSizeDimensions = (sizeStr: string) => {
  const dims = parseDimensions(sizeStr);
  const l = parseFloat(dims.length) || 8;
  const w = parseFloat(dims.width) || 3;
  const h = parseFloat(dims.height) || 0;
  return { length: l, width: w, height: h, ratio: l > 0 && w > 0 ? l / w : 2.67 };
};

const formatDimensions = (length: string, width: string, height: string) => {
  const l = String(length || '').trim();
  const w = String(width || '').trim();
  const h = String(height || '').trim();
  if (!l && !w && !h) return '';
  return `${l}x${w}${h ? 'x' + h : ''}`;
};

const formatSizeForPrint = (sizeStr: string, showHeight: boolean) => {
  if (!sizeStr) return '';
  const dims = parseDimensions(sizeStr);
  if (!dims.length && !dims.width && !dims.height) return '';
  if (showHeight && dims.height) {
    return `${dims.length} × ${dims.width} × ${dims.height}`;
  }
  return `${dims.length} × ${dims.width}`;
};

const generatePrintedSizeHtml = (sizeStr: string, showHeight: boolean, showLabels: boolean = false) => {
  if (!sizeStr) return '';
  const dims = parseDimensions(sizeStr);
  if (!dims.length && !dims.width && !dims.height) return '';

  const showH = showHeight && !!dims.height;
  
  return `
    <div class="print-size-container">
      <div class="print-dim-col">
        ${showLabels ? `<div class="print-dim-label">طول</div>` : ''}
        <div class="print-dim-value">${dims.length || '-'}</div>
      </div>
      <div class="print-dim-separator">×</div>
      <div class="print-dim-col">
        ${showLabels ? `<div class="print-dim-label">عرض</div>` : ''}
        <div class="print-dim-value">${dims.width || '-'}</div>
      </div>
      ${showH ? `
        <div class="print-dim-separator">×</div>
        <div class="print-dim-col">
          ${showLabels ? `<div class="print-dim-label">ارتفاع</div>` : ''}
          <div class="print-dim-value">${dims.height}</div>
        </div>
      ` : ''}
    </div>
  `;
};

// Status preset options with color themes and icons
const STATUS_PRESETS = [
  { value: 'تم التركيب', label: 'تم التركيب', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' },
  { value: 'لم يتم التركيب', label: 'لم يتم التركيب', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
];

const StatusQuickSelector = ({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) => {
  const currentPreset = STATUS_PRESETS.find(p => p.value === value) || {
    value: value || 'تم التركيب',
    label: value || 'تم التركيب',
    color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-500',
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border transition-all hover:scale-105 shadow-xs cursor-pointer ${currentPreset.color} ${className}`}
        >
          <span className="flex items-center gap-1.5 truncate">
            <span className={`w-2 h-2 rounded-full shrink-0 ${currentPreset.dot} animate-pulse`} />
            <span className="truncate">{currentPreset.label}</span>
          </span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2.5 rounded-2xl border border-border bg-popover/98 backdrop-blur-xl shadow-2xl space-y-2 dir-rtl" align="center">
        <div className="text-[11px] font-black text-muted-foreground px-1 pb-1 border-b border-border/10 flex items-center justify-between">
          <span>اختر حالة اللوحة:</span>
        </div>
        <div className="grid grid-cols-1 gap-1">
          {STATUS_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                value === preset.value
                  ? `${preset.color} font-black shadow-xs`
                  : 'hover:bg-muted/60 text-foreground'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${preset.dot}`} />
                <span>{preset.label}</span>
              </span>
              {value === preset.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
        <div className="pt-1.5 border-t border-border/10 space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground px-1">حالة مخصصة:</span>
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="أدخل حالة مخصصة..."
            className="h-8 text-xs font-bold rounded-xl bg-background border-border/30"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

const SIZE_PRESETS = [
  '8x3',
  '10x4',
  '12x4',
  '6x3',
  '14x4',
  '15x5',
  '4x3',
  '5x3',
  '2x1',
  '3x2',
  '8x3x3',
  '12x4x3',
];

// Unified custom Dimension input component with Sliders and Presets
const DimensionInput = ({
  value,
  onChange,
  availableSizes = [],
  className = ''
}: {
  value: string;
  onChange: (v: string) => void;
  availableSizes?: string[];
  className?: string;
}) => {
  const { length, width, height } = parseDimensions(value);

  const numLength = parseFloat(String(length)) || 8;
  const numWidth = parseFloat(String(width)) || 3;

  const activePresets = availableSizes && availableSizes.length > 0 ? availableSizes : SIZE_PRESETS;

  const handleChange = (field: 'length' | 'width' | 'height', val: string) => {
    const newDims = { length, width, height };
    newDims[field] = val;
    onChange(formatDimensions(newDims.length, newDims.width, newDims.height));
  };

  const handleSliderLength = (val: number) => {
    onChange(formatDimensions(String(val), String(width), String(height)));
  };

  const handleSliderWidth = (val: number) => {
    onChange(formatDimensions(String(length), String(val), String(height)));
  };

  const formattedDisplay = value ? value : 'حدد المقاس';
  const parsedValue = parseDimensions(value);
  const numericBadge = parsedValue.length && parsedValue.width ? `${parsedValue.length}×${parsedValue.width}م` : '';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 transition-all hover:scale-105 shadow-xs cursor-pointer ${className}`}
        >
          <span className="flex items-center gap-1.5 font-mono">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="font-bold">{formattedDisplay}</span>
            {numericBadge && (
              <span className="text-[10px] opacity-75 font-normal bg-indigo-500/10 px-1.5 py-0.5 rounded-md dir-ltr">
                ({numericBadge})
              </span>
            )}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3.5 rounded-2xl border border-border bg-popover/98 backdrop-blur-xl shadow-2xl space-y-3 dir-rtl" align="center">
        <div className="flex items-center justify-between border-b border-border/10 pb-2">
          <span className="text-xs font-black text-foreground flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500" /> اختيار المقاس
          </span>
          <Badge className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono font-extrabold px-2 py-0.5">
            {formattedDisplay} {numericBadge ? `(${numericBadge})` : ''}
          </Badge>
        </div>

        {/* Quick Presets Grid from Settings */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground">مقاسات ونماذج الإعدادات:</span>
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-0.5">
            {activePresets.map((preset) => {
              const isSelected = String(value || '').trim().toLowerCase() === String(preset || '').trim().toLowerCase();
              const pDims = parseDimensions(preset);
              const pDimStr = pDims.length && pDims.width ? `${pDims.length}×${pDims.width}م` : '';

              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange(preset)}
                  className={`py-1.5 px-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-between border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-muted/40 border-border/15 text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="font-extrabold truncate max-w-[110px]">{preset}</span>
                  {pDimStr && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${isSelected ? 'text-indigo-100 bg-white/20' : 'text-muted-foreground bg-muted/60'}`}>
                      {pDimStr}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Sliders Section */}
        <div className="space-y-2.5 pt-1.5 border-t border-border/10">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-muted-foreground">الطول:</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">{numLength} م</span>
            </div>
            <Slider
              value={[numLength]}
              min={1}
              max={25}
              step={0.5}
              onValueChange={([v]) => handleSliderLength(v)}
              className="py-1"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-muted-foreground">العرض:</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">{numWidth} م</span>
            </div>
            <Slider
              value={[numWidth]}
              min={1}
              max={12}
              step={0.5}
              onValueChange={([v]) => handleSliderWidth(v)}
              className="py-1"
            />
          </div>
        </div>

        {/* Custom 3D Inputs */}
        <div className="pt-2 border-t border-border/10 space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground">تخصيص يدوي (طول × عرض × ارتفاع):</span>
          <div className="flex items-center gap-1.5 justify-between bg-muted/40 p-1.5 rounded-xl border border-border/15">
            <Input
              type="text"
              value={length}
              onChange={e => handleChange('length', e.target.value)}
              className="w-16 h-7.5 text-xs text-center font-bold rounded-lg bg-background border-border/15"
              placeholder="طول"
            />
            <span className="text-xs font-bold text-muted-foreground">×</span>
            <Input
              type="text"
              value={width}
              onChange={e => handleChange('width', e.target.value)}
              className="w-16 h-7.5 text-xs text-center font-bold rounded-lg bg-background border-border/15"
              placeholder="عرض"
            />
            <span className="text-xs font-bold text-muted-foreground">×</span>
            <Input
              type="text"
              value={height}
              onChange={e => handleChange('height', e.target.value)}
              className="w-16 h-7.5 text-xs text-center font-bold rounded-lg bg-background border-border/15"
              placeholder="ارتفاع"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Returns true if the URL is a Google Maps short link that needs expansion.
 */
const isShortGoogleMapsUrl = (url: string): boolean => {
  const str = url.trim().toLowerCase();
  return str.includes('maps.app.goo.gl') || str.includes('goo.gl/maps');
};

/**
 * Extracts lat/lng from a Google Maps URL.
 * Supports formats:
 *  - https://www.google.com/maps?q=lat,lng
 *  - https://www.google.com/maps/@lat,lng,zoom
 *  - https://www.google.com/maps/place/.../data=...!3dlat!4dlng
 *  - https://www.google.com/maps/place/name/@lat,lng,zoom
 *  - Raw HTML pages containing coordinate patterns
 */
const parseGoogleMapsUrl = (url: string): { lat: number; lng: number } | null => {
  if (!url || !url.trim()) return null;
  const str = url.trim();

  // Pattern 1: ?q=lat,lng or ?q=lat%2Clng
  const qMatch = str.match(/[?&]q=(-?\d+\.?\d*)[,%2C]+(-?\d+\.?\d*)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 2: /@lat,lng,zoom
  const atMatch = str.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 3: !3dlat!4dlng (data param)
  const d3Match = str.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (d3Match) {
    const lat = parseFloat(d3Match[1]);
    const lng = parseFloat(d3Match[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 4: plain coords anywhere in URL/text (fallback)
  const coordMatch = str.match(/(-?\d{1,3}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }

  return null;
};

/**
 * Expands a short Google Maps URL (maps.app.goo.gl / goo.gl/maps)
 * by fetching it through allorigins.win CORS proxy.
 * Returns the final expanded URL and/or extracted coordinates.
 */
const expandShortGoogleMapsUrl = async (
  shortUrl: string
): Promise<{ lat: number; lng: number } | null> => {
  // Try via allorigins which follows redirects and returns status.url
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(shortUrl)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  const data = await res.json();

  // 1. Try the final redirect URL from allorigins metadata
  if (data.status?.url) {
    const coords = parseGoogleMapsUrl(data.status.url);
    if (coords) return coords;
  }

  // 2. Search raw HTML content for coordinate patterns
  const html: string = data.contents || '';
  const coords = parseGoogleMapsUrl(html);
  if (coords) return coords;

  // 3. Try og:url meta tag inside the HTML
  const ogMatch = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:url"/i);
  if (ogMatch) {
    const coords2 = parseGoogleMapsUrl(ogMatch[1]);
    if (coords2) return coords2;
  }

  // 4. Try canonical link
  const canonMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  if (canonMatch) {
    const coords3 = parseGoogleMapsUrl(canonMatch[1]);
    if (coords3) return coords3;
  }

  return null;
};

export default function MunicipalityBillboardOrganizer() {
  const [collections, setCollections] = useState<{ id: string; name: string; created_at: string; municipality_name?: string; city?: string }[]>([]);
  const [currentCollection, setCurrentCollection] = useState<Collection>({ name: '', municipality_name: '', items: [] });
  
  // Duplicate / Save as copy / Delete collection states
  const [duplicateTarget, setDuplicateTarget] = useState<{ id: string; name: string } | null>(null);
  const [duplicateNewName, setDuplicateNewName] = useState<string>('');
  const [duplicateAutoOpen, setDuplicateAutoOpen] = useState<boolean>(true);
  const [isDuplicating, setIsDuplicating] = useState<boolean>(false);

  const [showSaveAsCopyDialog, setShowSaveAsCopyDialog] = useState<boolean>(false);
  const [saveAsCopyName, setSaveAsCopyName] = useState<string>('');
  const [isSavingAsCopy, setIsSavingAsCopy] = useState<boolean>(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [collectionsSearchQuery, setCollectionsSearchQuery] = useState<string>('');
  
  // Helper to parse size and calculate area
  const parseDimensions = (sizeStr: string) => {
    if (!sizeStr) return { length: 0, width: 0 };
    const normalized = sizeStr.replace(/×/g, 'x').replace(/X/g, 'x').replace(/\*/g, 'x');
    const parts = normalized.split('x').map(p => parseFloat(p.trim()));
    return {
      length: parts[0] || 0,
      width: parts[1] || 0
    };
  };

  const getFacesCountNumber = (facesStr: string | number | undefined | null): number => {
    if (!facesStr) return 2;
    if (typeof facesStr === 'number') return facesStr;
    const clean = facesStr.trim();
    if (clean === 'وجه' || clean === 'وجه واحد' || clean === '1') return 1;
    return 2;
  };

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCollectionsDialog, setShowCollectionsDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);
  const [showBatchImportDialog, setShowBatchImportDialog] = useState(false);
  const [batchImportFiles, setBatchImportFiles] = useState<File[]>([]);
  const [batchUnifiedSize, setBatchUnifiedSize] = useState<string>('');
  const [batchFacesCount, setBatchFacesCount] = useState<string>('وجهين');
  const [batchUnifiedStatus, setBatchUnifiedStatus] = useState<string>('تم التركيب');
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchProgressMsg, setBatchProgressMsg] = useState('');
  const [allBillboards, setAllBillboards] = useState<any[]>([]);
  const [searchBillboard, setSearchBillboard] = useState('');
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<Set<number>>(new Set());
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('/ipg.svg');
  const [printBackgrounds, setPrintBackgrounds] = useState<any[]>([]);
  const [printLoading, setPrintLoading] = useState(false);
  const { settings: customSettings, updateStatusOverride, saveSettings, refetch } = usePrintCustomization('municipality');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [comparisonMunicipality, setComparisonMunicipality] = useState<string>('none');

  const totalAreaMeters = useMemo(() => {
    const facesHidden = customSettings.faces_count_show === 'false';
    const localVal = localStorage.getItem('calc_meters_as_single_face');
    const isSingleFaceMode = facesHidden && (localVal !== null ? localVal === 'true' : String(customSettings.calc_meters_as_single_face) === 'true');

    return currentCollection.items.reduce((sum, item) => {
      const { length, width } = parseDimensions(item.size);
      const l = typeof length === 'number' ? length : (parseFloat(length) || 0);
      const w = typeof width === 'number' ? width : (parseFloat(width) || 0);
      const area = l * w;
      const faces = isSingleFaceMode ? 1 : getFacesCountNumber(item.faces_count);
      return sum + (area * faces);
    }, 0);
  }, [currentCollection.items, customSettings.faces_count_show, customSettings.calc_meters_as_single_face]);

  const sizeStats = useMemo(() => {
    const stats: Record<string, { count: number; totalMeters: number }> = {};
    const facesHidden = customSettings.faces_count_show === 'false';
    const localVal = localStorage.getItem('calc_meters_as_single_face');
    const isSingleFaceMode = facesHidden && (localVal !== null ? localVal === 'true' : String(customSettings.calc_meters_as_single_face) === 'true');
    
    currentCollection.items.forEach(item => {
      const sizeStr = item.size || 'بدون مقاس';
      if (!stats[sizeStr]) {
        stats[sizeStr] = { count: 0, totalMeters: 0 };
      }
      stats[sizeStr].count += 1;
      
      const { length, width } = parseDimensions(item.size);
      const l = typeof length === 'number' ? length : (parseFloat(length) || 0);
      const w = typeof width === 'number' ? width : (parseFloat(width) || 0);
      const area = l * w;
      const faces = isSingleFaceMode ? 1 : getFacesCountNumber(item.faces_count);
      stats[sizeStr].totalMeters += area * faces;
    });
    
    return Object.entries(stats).map(([size, data]) => ({
      size,
      count: data.count,
      totalMeters: data.totalMeters
    })).sort((a, b) => b.count - a.count);
  }, [currentCollection.items, customSettings.faces_count_show, customSettings.calc_meters_as_single_face]);

  const selectedItemsStats = useMemo(() => {
    const stats: Record<string, { count: number; totalMeters: number }> = {};
    const facesHidden = customSettings.faces_count_show === 'false';
    const localVal = localStorage.getItem('calc_meters_as_single_face');
    const isSingleFaceMode = facesHidden && (localVal !== null ? localVal === 'true' : String(customSettings.calc_meters_as_single_face) === 'true');
    
    const selItems = currentCollection.items.filter(item => selectedItems.has(item.sequence_number));
    selItems.forEach(item => {
      const sizeStr = item.size || 'بدون مقاس';
      if (!stats[sizeStr]) {
        stats[sizeStr] = { count: 0, totalMeters: 0 };
      }
      stats[sizeStr].count += 1;
      
      const { length, width } = parseDimensions(item.size);
      const l = typeof length === 'number' ? length : (parseFloat(length) || 0);
      const w = typeof width === 'number' ? width : (parseFloat(width) || 0);
      const area = l * w;
      const faces = isSingleFaceMode ? 1 : getFacesCountNumber(item.faces_count);
      stats[sizeStr].totalMeters += area * faces;
    });
    
    const totalArea = Object.values(stats).reduce((sum, d) => sum + d.totalMeters, 0);
    
    return {
      totalArea,
      totalCount: selItems.length,
      sizeStats: Object.entries(stats).map(([size, data]) => ({
        size,
        count: data.count,
        totalMeters: data.totalMeters
      })).sort((a, b) => b.count - a.count)
    };
  }, [currentCollection.items, selectedItems, customSettings.faces_count_show, customSettings.calc_meters_as_single_face]);

  const filteredCollections = useMemo(() => {
    if (!collectionsSearchQuery.trim()) return collections;
    const q = collectionsSearchQuery.toLowerCase().trim();
    return collections.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.municipality_name && c.municipality_name.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q))
    );
  }, [collections, collectionsSearchQuery]);

  const [collectionName, setCollectionName] = useState('');
  const [municipalityName, setMunicipalityName] = useState('');
  const [cityName, setCityName] = useState('');
  const [defaultSize, setDefaultSize] = useState('');
  const [showMunicipalityImportDialog, setShowMunicipalityImportDialog] = useState(false);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [dbSizes, setDbSizes] = useState<string[]>([]);
  const [sizesList, setSizesList] = useState<{ name: string; sort_order: number }[]>([]);
  const [selectedMunicipalityForImport, setSelectedMunicipalityForImport] = useState<string | null>(null);
  const [showImportConfigDialog, setShowImportConfigDialog] = useState(false);
  const [sizeMappings, setSizeMappings] = useState<Record<string, string>>({});
  const [municipalitySizesWithCounts, setMunicipalitySizesWithCounts] = useState<{ size: string; count: number }[]>([]);
  const [loadingBillboards, setLoadingBillboards] = useState(false);
  const [loadedBillboardsCount, setLoadedBillboardsCount] = useState(0);
  const [restrictImportToMunicipality, setRestrictImportToMunicipality] = useState(true);
  const [searchMunicipality, setSearchMunicipality] = useState('');
  const [showExcelMunicipalityDialog, setShowExcelMunicipalityDialog] = useState(false);
  const [excelPendingItems, setExcelPendingItems] = useState<CollectionItem[]>([]);
  const [excelMunicipalityName, setExcelMunicipalityName] = useState('');
  const [showColumnMappingDialog, setShowColumnMappingDialog] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRawRows, setExcelRawRows] = useState<Record<string, any>[]>([]);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printImageSource, setPrintImageSource] = useState<'actual_image' | 'map_pin' | 'map_only'>('map_pin');
  const munOverrides = customSettings.status_overrides?.['municipality'] || {};
  const showStatusInPrint = munOverrides.mun_show_status !== 'false';
  const statusPosition = munOverrides.mun_status_position || 'below_number';
  const statusTop = munOverrides.mun_status_top || '12mm';
  const statusLeft = munOverrides.mun_status_left || '50%';
  const statusFontSize = munOverrides.mun_status_font_size || '14px';
  const statusColor = munOverrides.mun_status_color || '#000000';
  const statusGap = munOverrides.mun_status_gap || '2mm';

  const updateAndSaveStatusSetting = async (key: string, value: string) => {
    updateStatusOverride('municipality', key as any, value);
    await saveSettings((prev) => {
      const currentOverrides = prev.status_overrides || ({} as any);
      const currentMunOverrides = currentOverrides['municipality'] || {};
      return {
        status_overrides: {
          ...currentOverrides,
          municipality: { ...currentMunOverrides, [key]: value }
        }
      };
    });
  };
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<'all' | 'selected'>('all');
  const [bulkStatusValue, setBulkStatusValue] = useState('تم التركيب');
  const [bulkStatusCustom, setBulkStatusCustom] = useState('');
  const [bulkSize, setBulkSize] = useState('');
  const [bulkFacesCount, setBulkFacesCount] = useState<'وجه' | 'وجهين' | ''>('');
  // Google Maps URL input state
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [googleMapsUrlError, setGoogleMapsUrlError] = useState('');
  const [googleMapsUrlLoading, setGoogleMapsUrlLoading] = useState(false);
  const [showGoogleMapsDialog, setShowGoogleMapsDialog] = useState(false);
  const [zoomImageModalUrl, setZoomImageModalUrl] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [inlineEditingCell, setInlineEditingCell] = useState<{ seq: number; field: 'location' | 'landmark' } | null>(null);
  const [searchItems, setSearchItems] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null);
  const [showStickerSettings, setShowStickerSettings] = useState(false);
  // Reordering / Moving states
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveSourceSeqs, setMoveSourceSeqs] = useState<number[]>([]);
  const [moveTargetSeq, setMoveTargetSeq] = useState<number | ''>('');
  const [movePosition, setMovePosition] = useState<'above' | 'below'>('above');
  const { settings: stickerSettings, reload: reloadStickerSettings } = useStickerSettings();
  const [showHeightInPrint, setShowHeightInPrint] = useState(() => {
    try {
      const val = localStorage.getItem('mun_show_height_in_print');
      return val !== 'false';
    } catch {
      return true;
    }
  });

  const [summaryRowsPerPage, setSummaryRowsPerPage] = useState<number>(() => {
    try {
      const val = localStorage.getItem('mun_summary_rows_per_page');
      const num = parseInt(val || '', 10);
      return !isNaN(num) && num > 0 ? num : 17;
    } catch {
      return 17;
    }
  });

  // 🆕 Header Title and Signatures Customization States
  const loadOrganizerDefault = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem('mun_organizer_defaults');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[key] !== undefined) return parsed[key];
      }
      return fallback;
    } catch {
      return fallback;
    }
  };

  interface MunicipalitySigner {
    id: string;
    enabled: boolean;
    title: string;
    name?: string;
    position: 'right' | 'left' | 'center';
  }

  const DEFAULT_MUNICIPALITY_SIGNERS: MunicipalitySigner[] = [
    { id: 'sig1', enabled: true, title: 'رئيس للجنة اللوحات الاعلانية', name: '', position: 'right' },
    { id: 'sig2', enabled: true, title: 'مدير مكتب إدارة التخطيط الحضري', name: '', position: 'left' },
    { id: 'sig3', enabled: true, title: 'يعتمد عميد البلدية', name: '', position: 'center' },
  ];

  const [summaryHeaderTitle, setSummaryHeaderTitle] = useState<string>(() => 
    loadOrganizerDefault('headerTitleTemplate', 'مواقع لوحات شركة الفارس الذهبي للدعاية والإعلان بلدية {البلدية}')
  );
  const [showSignatures, setShowSignatures] = useState<boolean>(() => 
    loadOrganizerDefault('showSignatures', true)
  );
  const [signaturesPage, setSignaturesPage] = useState<'last' | 'all'>(() => 
    loadOrganizerDefault('signaturesPage', 'last')
  );
  const [signersList, setSignersList] = useState<MunicipalitySigner[]>(() => {
    const saved = loadOrganizerDefault<MunicipalitySigner[]>('signersList', DEFAULT_MUNICIPALITY_SIGNERS);
    if (Array.isArray(saved) && saved.length > 0) return saved;
    return DEFAULT_MUNICIPALITY_SIGNERS;
  });

  const [signaturesFontSize, setSignaturesFontSize] = useState<number>(() => 
    loadOrganizerDefault('signaturesFontSize', 16)
  );

  // 🆕 Cover Page Customization States
  const [coverPageEnabled, setCoverPageEnabled] = useState<boolean>(() => 
    loadOrganizerDefault('coverPageEnabled', true)
  );
  const [coverTitle, setCoverTitle] = useState<string>(() => 
    loadOrganizerDefault('coverTitle', '')
  );
  const [coverPhrase, setCoverPhrase] = useState<string>(() => 
    loadOrganizerDefault('coverPhrase', 'لوحات')
  );
  const [coverSubtitle, setCoverSubtitle] = useState<string>(() => 
    loadOrganizerDefault('coverSubtitle', '')
  );
  const [coverTitleFontSize, setCoverTitleFontSize] = useState<number>(() => 
    loadOrganizerDefault('coverTitleFontSize', 36)
  );
  const [coverPhraseFontSize, setCoverPhraseFontSize] = useState<number>(() => 
    loadOrganizerDefault('coverPhraseFontSize', 28)
  );
  const [coverSubtitleFontSize, setCoverSubtitleFontSize] = useState<number>(() => 
    loadOrganizerDefault('coverSubtitleFontSize', 18)
  );
  const [coverLogoUrl, setCoverLogoUrl] = useState<string>(() => 
    loadOrganizerDefault('coverLogoUrl', 'auto')
  );
  const [coverLogoSize, setCoverLogoSize] = useState<number>(() => 
    loadOrganizerDefault('coverLogoSize', 220)
  );
  const [uploadingCoverLogo, setUploadingCoverLogo] = useState(false);
  const coverLogoInputRef = useRef<HTMLInputElement>(null);

  const matchingBg = useMemo(() => {
    return printBackgrounds.find(bg => bg.url === customBackgroundUrl);
  }, [printBackgrounds, customBackgroundUrl]);

  const activeCoverLogoUrl = useMemo(() => {
    if (coverLogoUrl && coverLogoUrl !== 'auto' && coverLogoUrl.trim() !== '') return coverLogoUrl;
    return matchingBg?.logo_url || (customSettings as any).cover_logo_url || '/logofaresgold.svg';
  }, [coverLogoUrl, matchingBg, customSettings]);

  const activeCoverLogoSize = useMemo(() => {
    if (coverLogoSize && coverLogoUrl && coverLogoUrl !== 'auto' && coverLogoUrl.trim() !== '') return `${coverLogoSize}px`;
    return matchingBg?.logo_size || (customSettings as any).cover_logo_size || '220px';
  }, [coverLogoSize, coverLogoUrl, matchingBg, customSettings]);

  const handleCoverLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCoverLogo(true);
    try {
      const fileName = `cover_logo_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const url = await uploadImage(file, fileName, 'municipality-logos');
      if (url) {
        setCoverLogoUrl(url);
        toast.success('تم رفع شعار الغلاف بنجاح');
      } else {
        throw new Error('فشل رفع الشعار');
      }
    } catch (err: any) {
      console.error('Error uploading cover logo:', err);
      toast.error(`فشل في رفع الشعار: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setUploadingCoverLogo(false);
      if (e.target) e.target.value = '';
    }
  };

  const [printStudioTab, setPrintStudioTab] = useState<'signatures' | 'cover' | 'layout' | 'status' | 'background'>('signatures');
  const [previewBlueprintMode, setPreviewBlueprintMode] = useState<'card' | 'cover'>('card');

  const resolveCoverTitle = (templateStr: string, municipality: string, cityNameVal: string, collName: string) => {
    if (!templateStr || !templateStr.trim()) {
      return municipality || collName || 'البلدية';
    }
    let res = templateStr;
    res = res.replace(/\{municipality\}/gi, municipality || '');
    res = res.replace(/\{البلدية\}/gi, municipality || '');
    res = res.replace(/\{city\}/gi, cityNameVal || '');
    res = res.replace(/\{المدينة\}/gi, cityNameVal || '');
    res = res.replace(/\{name\}/gi, collName || '');
    res = res.replace(/\{اسم المجموعة\}/gi, collName || '');
    res = res.replace(/\{القائمة\}/gi, collName || '');
    return res.trim();
  };

  const applySignersPreset = (preset: '3_official' | '2_side' | '1_center' | '4_grid') => {
    if (preset === '3_official') {
      setSignersList([
        { id: 'sig1', enabled: true, title: 'رئيس للجنة اللوحات الاعلانية', name: '', position: 'right' },
        { id: 'sig2', enabled: true, title: 'مدير مكتب إدارة التخطيط الحضري', name: '', position: 'left' },
        { id: 'sig3', enabled: true, title: 'يعتمد عميد البلدية', name: '', position: 'center' },
      ]);
    } else if (preset === '2_side') {
      setSignersList([
        { id: 'sig1', enabled: true, title: 'رئيس للجنة اللوحات الاعلانية', name: '', position: 'right' },
        { id: 'sig2', enabled: true, title: 'مدير مكتب إدارة التخطيط الحضري', name: '', position: 'left' },
        { id: 'sig3', enabled: false, title: 'يعتمد عميد البلدية', name: '', position: 'center' },
      ]);
    } else if (preset === '1_center') {
      setSignersList([
        { id: 'sig1', enabled: false, title: 'رئيس للجنة اللوحات الاعلانية', name: '', position: 'right' },
        { id: 'sig2', enabled: false, title: 'مدير مكتب إدارة التخطيط الحضري', name: '', position: 'left' },
        { id: 'sig3', enabled: true, title: 'يعتمد عميد البلدية', name: '', position: 'center' },
      ]);
    } else if (preset === '4_grid') {
      setSignersList([
        { id: 'sig1', enabled: true, title: 'رئيس للجنة اللوحات الاعلانية', name: '', position: 'right' },
        { id: 'sig2', enabled: true, title: 'مدير مكتب إدارة التخطيط الحضري', name: '', position: 'left' },
        { id: 'sig3', enabled: true, title: 'مدير إدارة شؤون الإصحاح البيئي', name: '', position: 'right' },
        { id: 'sig4', enabled: true, title: 'يعتمد عميد البلدية', name: '', position: 'center' },
      ]);
    }
  };

  const updateSigner = (id: string, partial: Partial<MunicipalitySigner>) => {
    setSignersList(prev => prev.map(s => s.id === id ? { ...s, ...partial } : s));
  };

  const addSigner = () => {
    const newId = `sig_${Date.now()}`;
    setSignersList(prev => [
      ...prev,
      { id: newId, enabled: true, title: 'مسمى التوقيع', name: '', position: 'right' }
    ]);
  };

  const removeSigner = (id: string) => {
    setSignersList(prev => prev.filter(s => s.id !== id));
  };

  useEffect(() => {
    try {
      localStorage.setItem('mun_show_height_in_print', String(showHeightInPrint));
    } catch {}
  }, [showHeightInPrint]);

  useEffect(() => {
    try {
      localStorage.setItem('mun_summary_rows_per_page', String(summaryRowsPerPage));
    } catch {}
  }, [summaryRowsPerPage]);

  // Fetch Global Defaults from Supabase on mount
  useEffect(() => {
    const fetchOrganizerGlobalDefaults = async () => {
      try {
        const { data } = await supabase
          .from('contract_template_settings')
          .select('*')
          .eq('setting_key', 'municipality_organizer_defaults')
          .maybeSingle();

        if (data?.setting_value) {
          const sv = data.setting_value as any;
          if (sv.headerTitleTemplate) setSummaryHeaderTitle(sv.headerTitleTemplate);
          if (sv.coverTitle !== undefined) setCoverTitle(sv.coverTitle);
          if (sv.coverPhrase !== undefined) setCoverPhrase(sv.coverPhrase);
          if (sv.coverSubtitle !== undefined) setCoverSubtitle(sv.coverSubtitle);
          if (sv.coverPageEnabled !== undefined) setCoverPageEnabled(sv.coverPageEnabled);
          if (sv.coverLogoUrl !== undefined) setCoverLogoUrl(sv.coverLogoUrl);
          if (sv.coverLogoSize !== undefined) setCoverLogoSize(sv.coverLogoSize);
          if (sv.coverTitleFontSize !== undefined) setCoverTitleFontSize(sv.coverTitleFontSize);
          if (sv.coverPhraseFontSize !== undefined) setCoverPhraseFontSize(sv.coverPhraseFontSize);
          if (sv.coverSubtitleFontSize !== undefined) setCoverSubtitleFontSize(sv.coverSubtitleFontSize);
          if (sv.showSignatures !== undefined) setShowSignatures(sv.showSignatures);
          if (sv.signaturesPage) setSignaturesPage(sv.signaturesPage);
          if (Array.isArray(sv.signersList) && sv.signersList.length > 0) {
            setSignersList(sv.signersList);
          }
          if (sv.summaryRowsPerPage) setSummaryRowsPerPage(sv.summaryRowsPerPage);
          if (sv.signaturesFontSize) setSignaturesFontSize(sv.signaturesFontSize);
        }
      } catch (err) {
        console.error('Error fetching municipality organizer defaults from DB:', err);
      }
    };
    fetchOrganizerGlobalDefaults();
  }, []);

  const saveAsGlobalDefaults = async () => {
    const defaultsPayload = {
      headerTitleTemplate: summaryHeaderTitle,
      coverTitle,
      coverPhrase,
      coverSubtitle,
      coverPageEnabled,
      coverLogoUrl,
      coverLogoSize,
      coverTitleFontSize,
      coverPhraseFontSize,
      coverSubtitleFontSize,
      showSignatures,
      signaturesPage,
      signersList,
      signaturesFontSize,
      summaryRowsPerPage,
      showStatusInPrint,
      showHeightInPrint,
      printImageSource,
    };

    try {
      localStorage.setItem('mun_organizer_defaults', JSON.stringify(defaultsPayload));
    } catch {}

    try {
      const { data: existing } = await supabase
        .from('contract_template_settings')
        .select('id')
        .eq('setting_key', 'municipality_organizer_defaults')
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('contract_template_settings')
          .update({
            setting_value: defaultsPayload as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('contract_template_settings')
          .insert({
            setting_key: 'municipality_organizer_defaults',
            setting_value: defaultsPayload as any,
            updated_at: new Date().toISOString()
          });
      }
      toast.success('تم حفظ إعدادات الغلاف والترويسة والتوقيعات كإعداد افتراضي عام');
    } catch (e: any) {
      toast.warning('تم الحفظ محلياً: ' + (e?.message || ''));
    }
  };

  const importSettingsFromCollection = async (sourceCollId: string) => {
    if (!sourceCollId) return;
    try {
      const { data } = await supabase
        .from('municipality_collections')
        .select('*')
        .eq('id', sourceCollId)
        .single();

      if (data?.description && data.description.trim().startsWith('{')) {
        const parsed = JSON.parse(data.description);
        if (parsed.headerTitleTemplate !== undefined) setSummaryHeaderTitle(parsed.headerTitleTemplate);
        if (parsed.coverTitle !== undefined) setCoverTitle(parsed.coverTitle);
        if (parsed.coverPhrase !== undefined) setCoverPhrase(parsed.coverPhrase);
        if (parsed.coverSubtitle !== undefined) setCoverSubtitle(parsed.coverSubtitle);
        if (parsed.coverPageEnabled !== undefined) setCoverPageEnabled(parsed.coverPageEnabled);
        if (parsed.coverLogoUrl !== undefined) setCoverLogoUrl(parsed.coverLogoUrl);
        if (parsed.coverLogoSize !== undefined) setCoverLogoSize(parsed.coverLogoSize);
        if (parsed.coverTitleFontSize !== undefined) setCoverTitleFontSize(parsed.coverTitleFontSize);
        if (parsed.coverPhraseFontSize !== undefined) setCoverPhraseFontSize(parsed.coverPhraseFontSize);
        if (parsed.coverSubtitleFontSize !== undefined) setCoverSubtitleFontSize(parsed.coverSubtitleFontSize);
        if (parsed.showSignatures !== undefined) setShowSignatures(parsed.showSignatures);
        if (parsed.signaturesPage !== undefined) setSignaturesPage(parsed.signaturesPage);
        if (Array.isArray(parsed.signersList)) {
          setSignersList(parsed.signersList);
        }
        if (parsed.signaturesFontSize !== undefined) setSignaturesFontSize(parsed.signaturesFontSize);
        if (parsed.summaryRowsPerPage !== undefined) setSummaryRowsPerPage(parsed.summaryRowsPerPage);
        toast.success(`تم استيراد إعدادات الغلاف والترويسة والتوقيعات من "${data.name}" بنجاح`);
      } else {
        toast.info('هذه القائمة لا تحتوي على تخصيصات ترويسة وتوقيعات محفوظة');
      }
    } catch (err) {
      toast.error('فشل استيراد الإعدادات من القائمة');
    }
  };

  const resolveSummaryTitle = (templateStr: string, municipality: string, cityNameVal: string, totalCount: number) => {
    if (!templateStr || !templateStr.trim()) {
      return `مواقع لوحات شركة الفارس الذهبي للدعاية والإعلان بلدية ${municipality || ''}`;
    }
    let res = templateStr;
    res = res.replace(/\{municipality\}/gi, municipality || '');
    res = res.replace(/\{البلدية\}/gi, municipality || '');
    res = res.replace(/\{city\}/gi, cityNameVal || '');
    res = res.replace(/\{المدينة\}/gi, cityNameVal || '');
    res = res.replace(/\{count\}/gi, String(totalCount || 0));
    res = res.replace(/\{العدد\}/gi, String(totalCount || 0));
    return res.trim();
  };

  useEffect(() => {
    const fetchBgs = async () => {
      try {
        const { data } = await supabase.from('print_backgrounds').select('*');
        if (data) setPrintBackgrounds(data);
      } catch (err) {
        console.error('Failed to fetch backgrounds:', err);
      }
    };
    fetchBgs();
  }, [showPrintDialog]);

  const handleDimChange = (sequenceNumber: number, field: 'length' | 'width' | 'height', value: string) => {
    setCurrentCollection(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.sequence_number === sequenceNumber) {
          const dims = parseDimensions(item.size || '');
          dims[field] = value;
          return {
            ...item,
            size: formatDimensions(dims.length, dims.width, dims.height)
          };
        }
        return item;
      })
    }));
  };

  // Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const cleanArabicName = (str: string) => {
    if (!str) return '';
    return str
      .replace(/^(بلدية|مدينة|البلدية|المدينة)\s+/g, '')
      .replace(/^ال/g, '')
      .trim();
  };

  const formatLocationText = (b: any, cityBindValue: string, muniVal?: string) => {
    const cleanMuni = cleanArabicName(muniVal || municipalityName);
    const cleanCity = cleanArabicName(cityBindValue || b.City);
    
    if (!cityBindValue || (cleanMuni && cleanCity && cleanMuni === cleanCity)) {
      return b.District || b.City || '';
    }
    return [b.City, b.District].filter(Boolean).join(' - ');
  };

  const handleCityChange = (value: string) => {
    const nextCity = value === '__none__' ? '' : value;
    setCityName(nextCity);
    
    setCurrentCollection(prev => {
      const cleanMuni = cleanArabicName(prev.municipality_name || municipalityName);
      
      const updatedItems = prev.items.map(item => {
        if (!item.billboard_id) return item;
        const original = allBillboards.find(b => b.ID === item.billboard_id);
        if (!original || !original.City) return item;
        
        const cityPrefix = original.City;
        let newLoc = item.location_text;
        
        const cleanOrigCity = cleanArabicName(original.City);
        const shouldStrip = nextCity === '' || (cleanMuni && cleanOrigCity && cleanMuni === cleanOrigCity);
        
        if (shouldStrip) {
          // Strip prefix
          if (newLoc.startsWith(cityPrefix)) {
            newLoc = newLoc.substring(cityPrefix.length);
            if (newLoc.startsWith(' - ')) {
              newLoc = newLoc.substring(3);
            }
            newLoc = newLoc.trim();
          }
          if (!newLoc) {
            newLoc = original.District || original.City || '';
          }
        } else {
          // Prepend prefix if not present
          if (!newLoc.startsWith(cityPrefix)) {
            newLoc = [cityPrefix, newLoc].filter(Boolean).join(' - ');
          }
        }
        
        return {
          ...item,
          location_text: newLoc,
        };
      });
      
      return {
        ...prev,
        items: updatedItems,
      };
    });
  };

  // New item form state
  const [newItem, setNewItem] = useState<Partial<CollectionItem>>({
    size: '',
    faces_count: 'وجهين',
    location_text: '',
    nearest_landmark: '',
    latitude: null,
    longitude: null,
    item_type: 'new',
  });

  // Photo import states
  const [photoImportState, setPhotoImportState] = useState<'idle' | 'compressing' | 'uploading' | 'geocoding' | 'done' | 'error'>('idle');
  const [photoImportProgress, setPhotoImportProgress] = useState(0);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoExifStatus, setPhotoExifStatus] = useState<'none' | 'found' | 'missing'>('none');
  const photoDropRef = useRef<HTMLInputElement>(null);
  const batchPhotoInputRef = useRef<HTMLInputElement>(null);

  // Photo Overlay Editor state
  const [showOverlayEditor, setShowOverlayEditor] = useState(false);
  const [overlayEditorIndex, setOverlayEditorIndex] = useState(0);
  const [sizeCutoutMap, setSizeCutoutMap] = useState<Record<string, string>>({});

  const handleSaveItemOverlay = async (seq: number, overlayConfig: BillboardOverlayConfig) => {
    // Update local state immediately
    setCurrentCollection(prev => ({
      ...prev,
      items: prev.items.map(it => it.sequence_number === seq ? { ...it, overlay_config: overlayConfig } : it),
    }));

    // Persist to DB: find the item row id and update overlay_config
    const collId = currentCollection.id;
    if (!collId) return; // collection not yet saved to DB
    try {
      const { error } = await supabase
        .from('municipality_collection_items')
        .update({ overlay_config: overlayConfig })
        .eq('collection_id', collId)
        .eq('sequence_number', seq);
      if (error) {
        console.error('[overlay] DB update error:', error.message);
        toast.error('فشل حفظ إعدادات التراكب في قاعدة البيانات');
      }
    } catch (e: any) {
      console.error('[overlay] DB update exception:', e?.message);
    }
  };

  const toggleItemMockup = (seq: number) => {
    const item = currentCollection.items.find(i => i.sequence_number === seq);
    if (!item) return;
    const currentOv = item.overlay_config || { enabled: true, show_image: true, x_pct: 50, y_pct: 78, scale_pct: 100, rotation_deg: 0 };
    const newEnabled = !(currentOv.enabled !== false);
    const updatedOv = { ...currentOv, enabled: newEnabled };
    handleSaveItemOverlay(seq, updatedOv);
    toast.success(newEnabled ? 'تم تفعيل مجسم اللوحة' : 'تم إلغاء تفعيل مجسم اللوحة');
  };

  const toggleItemPhoto = (seq: number) => {
    const item = currentCollection.items.find(i => i.sequence_number === seq);
    if (!item) return;
    const currentOv = item.overlay_config || { enabled: true, show_image: true, x_pct: 50, y_pct: 78, scale_pct: 100, rotation_deg: 0 };
    const newShowImage = !(currentOv.show_image !== false);
    const updatedOv = { ...currentOv, show_image: newShowImage };
    handleSaveItemOverlay(seq, updatedOv);
    toast.success(newShowImage ? 'تم تفعيل صورة اللوحة' : 'تم إلغاء تفعيل صورة اللوحة');
  };

  const handleBillboardLocationChange = async (id: number | string, newLat: number, newLng: number) => {
    const seq = Number(id);
    setCurrentCollection(prev => ({
      ...prev,
      items: prev.items.map(it =>
        it.sequence_number === seq || (it as any).id === id
          ? { ...it, latitude: newLat, longitude: newLng }
          : it
      ),
    }));

    const collId = currentCollection.id;
    if (collId) {
      try {
        await supabase
          .from('municipality_collection_items')
          .update({ latitude: newLat, longitude: newLng })
          .eq('collection_id', collId)
          .eq('sequence_number', seq);
      } catch (e: any) {
        console.error('[location] DB update exception:', e?.message);
      }
    }
  };

  const handleUpdateItemDetails = async (seq: number, details: Partial<CollectionItem>) => {
    setCurrentCollection(prev => ({
      ...prev,
      items: prev.items.map(it =>
        it.sequence_number === seq ? { ...it, ...details } : it
      ),
    }));

    const collId = currentCollection.id;
    if (collId) {
      try {
        const updatePayload: Record<string, any> = {};
        if (details.location_text !== undefined) updatePayload.location_text = details.location_text;
        if (details.nearest_landmark !== undefined) updatePayload.nearest_landmark = details.nearest_landmark;
        if (details.size !== undefined) updatePayload.size = details.size;
        if (details.municipality !== undefined) updatePayload.municipality = details.municipality;
        if (details.latitude !== undefined) updatePayload.latitude = details.latitude;
        if (details.longitude !== undefined) updatePayload.longitude = details.longitude;

        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from('municipality_collection_items')
            .update(updatePayload)
            .eq('collection_id', collId)
            .eq('sequence_number', seq);
        }
      } catch (e: any) {
        console.error('[item_update] DB update exception:', e?.message);
      }
    }
  };

  const loadSizeCutoutImages = async () => {
    try {
      const { data } = await supabase.from('sizes').select('name, width, height, image_url');
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(s => {
          if (s.image_url) {
            if (s.name) map[s.name.trim()] = s.image_url;
            if (s.width && s.height) {
              map[`${s.width}x${s.height}`] = s.image_url;
              map[`${s.height}x${s.width}`] = s.image_url;
            }
          }
        });
        setSizeCutoutMap(map);
      }
    } catch {}
  };

  // Load saved collections
  useEffect(() => {
    loadCollections();
    loadAllBillboards();
    loadSizes();
    loadSizeCutoutImages();
    try {
      const savedId = localStorage.getItem('last_municipality_collection_id');
      if (savedId) {
        loadCollection(savedId);
      }
    } catch {}
  }, []);

  const loadAllBillboards = async () => {
    setLoadingBillboards(true);
    setLoadedBillboardsCount(0);
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data, error } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Size, Faces_Count, City, District, Municipality, Nearest_Landmark, GPS_Coordinates, Image_URL, design_face_a, design_face_b, Status')
          .order('ID', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error('Error loading billboards page:', error);
          hasMore = false;
        } else if (data) {
          const cleaned = data.map((b: any) => ({
            ...b,
            Municipality: b.Municipality ? b.Municipality.trim() : null,
            City: b.City ? b.City.trim() : null,
            Size: b.Size ? b.Size.trim() : null,
          }));
          allData = [...allData, ...cleaned];
          setLoadedBillboardsCount(allData.length);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }
      
      setAllBillboards(allData);
      
      // Derive municipalities and cities from DB table + billboards
      const { data: dbMunis } = await supabase.from('municipalities').select('name').order('name');
      const dbMuniNames = (dbMunis || []).map(m => normalizeMuniName(m.name)).filter(Boolean) as string[];
      const billboardMunis = allData.map(b => normalizeMuniName(b.Municipality)).filter(Boolean) as string[];
      const uniqueMunicipalities = [...new Set([...dbMuniNames, ...billboardMunis])];
      setMunicipalities(uniqueMunicipalities.sort((a, b) => a.localeCompare(b, 'ar')));

      const uniqueCities = [...new Set(allData.map(b => b.City).filter(Boolean))] as string[];
      setCities(uniqueCities.sort());
      
    } catch (err) {
      console.error('Failed to load billboards in chunked query:', err);
    } finally {
      setLoadingBillboards(false);
    }
  };

  const loadMunicipalities = async () => {
    const { data: dbMunis } = await supabase.from('municipalities').select('name').order('name');
    const dbMuniNames = (dbMunis || []).map(m => normalizeMuniName(m.name)).filter(Boolean) as string[];
    const billboardMunis = (allBillboards || []).map(b => normalizeMuniName(b.Municipality)).filter(Boolean) as string[];
    const combined = [...new Set([...dbMuniNames, ...billboardMunis])];
    setMunicipalities(combined.sort((a, b) => a.localeCompare(b, 'ar')));
  };

  const loadCities = async () => {
    if (allBillboards.length > 0) {
      const unique = [...new Set(allBillboards.map(b => b.City).filter(Boolean))] as string[];
      setCities(unique.sort());
    } else {
      const { data } = await supabase
        .from('billboards')
        .select('City')
        .not('City', 'is', null);
      if (data) {
        const unique = [...new Set(data.map(d => d.City).filter(Boolean))] as string[];
        setCities(unique.sort());
      }
    }
  };

  const loadSizes = async () => {
    const { data } = await supabase
      .from('sizes')
      .select('name, sort_order')
      .order('sort_order', { ascending: true });
    if (data) {
      setSizesList(data as { name: string; sort_order: number }[]);
      setDbSizes((data as any[]).map((d: any) => d.name).filter(Boolean));
    }
  };

  const loadCollections = async () => {
    const { data } = await supabase
      .from('municipality_collections')
      .select('id, name, created_at, municipality_name, city')
      .order('created_at', { ascending: false });
    if (data) setCollections(data);
  };

  const loadCollection = async (collectionId: string) => {
    if (!collectionId) return;
    setLoading(true);
    try {
      const [collRes, itemsRes] = await Promise.all([
        supabase.from('municipality_collections').select('*').eq('id', collectionId).maybeSingle(),
        supabase.from('municipality_collection_items').select('*').eq('collection_id', collectionId).order('sequence_number'),
      ]);

      if (collRes.error) {
        console.error('[loadCollection] error loading collection:', collRes.error);
        throw new Error(collRes.error.message || 'فشل في جلب بيانات المجموعة');
      }
      if (itemsRes.error) {
        console.error('[loadCollection] error loading items:', itemsRes.error);
        throw new Error(itemsRes.error.message || 'فشل في جلب عناصر المجموعة');
      }
      if (!collRes.data) {
        throw new Error('المجموعة المحددة غير موجودة');
      }

      const name = collRes.data.name || '';
      const desc = collRes.data.description || '';
      let muni = normalizeMuniName((collRes.data as any).municipality_name || '');
      const cty = (collRes.data as any).city || '';
      const dsize = (collRes.data as any).default_size || '';

      // استخراج الإعدادات والتخصيصات من وصف المجموعة إن وجدت
      let parsedConfig: any = null;
      if (desc && typeof desc === 'string' && desc.trim().startsWith('{')) {
        try {
          parsedConfig = JSON.parse(desc);
          if (!muni && parsedConfig.municipality) {
            muni = normalizeMuniName(parsedConfig.municipality);
          }
        } catch (err) {
          console.warn('[loadCollection] Failed to parse config from description:', err);
        }
      } else if (!muni && desc) {
        muni = normalizeMuniName(desc);
      }

      if (parsedConfig) {
        if (parsedConfig.headerTitleTemplate !== undefined) setSummaryHeaderTitle(parsedConfig.headerTitleTemplate);
        if (parsedConfig.coverTitle !== undefined) setCoverTitle(parsedConfig.coverTitle);
        if (parsedConfig.coverPhrase !== undefined) setCoverPhrase(parsedConfig.coverPhrase);
        if (parsedConfig.coverSubtitle !== undefined) setCoverSubtitle(parsedConfig.coverSubtitle);
        if (parsedConfig.coverPageEnabled !== undefined) setCoverPageEnabled(parsedConfig.coverPageEnabled);
        if (parsedConfig.coverLogoUrl !== undefined) setCoverLogoUrl(parsedConfig.coverLogoUrl);
        if (parsedConfig.coverLogoSize !== undefined) setCoverLogoSize(parsedConfig.coverLogoSize);
        if (parsedConfig.coverTitleFontSize !== undefined) setCoverTitleFontSize(parsedConfig.coverTitleFontSize);
        if (parsedConfig.coverPhraseFontSize !== undefined) setCoverPhraseFontSize(parsedConfig.coverPhraseFontSize);
        if (parsedConfig.coverSubtitleFontSize !== undefined) setCoverSubtitleFontSize(parsedConfig.coverSubtitleFontSize);
        if (parsedConfig.showSignatures !== undefined) setShowSignatures(parsedConfig.showSignatures);
        if (parsedConfig.signaturesPage !== undefined) setSignaturesPage(parsedConfig.signaturesPage);
        if (Array.isArray(parsedConfig.signersList)) {
          setSignersList(parsedConfig.signersList);
        }
        if (parsedConfig.signaturesFontSize !== undefined) setSignaturesFontSize(parsedConfig.signaturesFontSize);
        if (parsedConfig.showStatusInPrint !== undefined) {
          updateAndSaveStatusSetting('mun_show_status', parsedConfig.showStatusInPrint ? 'true' : 'false');
        }
        if (parsedConfig.showHeightInPrint !== undefined) setShowHeightInPrint(parsedConfig.showHeightInPrint);
        if (parsedConfig.printImageSource !== undefined) setPrintImageSource(parsedConfig.printImageSource);
      }
      
      const cleanMuni = cleanArabicName(muni);
      const itemsData = Array.isArray(itemsRes.data) ? itemsRes.data : [];

      const loadedItems = itemsData.map((item: any) => {
        let locText = String(item.location_text || '');
        
        if (item.billboard_id && Array.isArray(allBillboards) && allBillboards.length > 0) {
          const original = allBillboards.find(b => b.ID === item.billboard_id);
          if (original && original.City) {
            const cityPrefix = String(original.City || '');
            const cleanCity = cleanArabicName(cty || original.City);
            const shouldStrip = !cty || (cleanMuni && cleanCity && cleanMuni === cleanCity);
            
            if (shouldStrip && cityPrefix && locText.startsWith(cityPrefix)) {
              locText = locText.substring(cityPrefix.length);
              if (locText.startsWith(' - ')) {
                locText = locText.substring(3);
              }
              locText = locText.trim() || String(original.District || original.City || '');
            }
          }
        }
        
        return {
          id: item.id,
          sequence_number: item.sequence_number,
          billboard_id: item.billboard_id,
          billboard_name: item.billboard_name || '',
          size: item.size || '',
          faces_count: item.faces_count || 'وجهين',
          location_text: locText,
          nearest_landmark: item.nearest_landmark || '',
          latitude: item.latitude !== null && item.latitude !== undefined ? Number(item.latitude) : null,
          longitude: item.longitude !== null && item.longitude !== undefined ? Number(item.longitude) : null,
          item_type: item.item_type || 'existing',
          design_face_a: item.design_face_a || null,
          design_face_b: item.design_face_b || null,
          image_url: item.image_url || null,
          municipality: muni || item.municipality || '',
          status: item.status || 'تم التركيب',
          overlay_config: item.overlay_config ?? undefined,
        };
      });

      setCurrentCollection({
        id: collRes.data.id,
        name: name,
        municipality_name: muni,
        description: desc,
        items: loadedItems,
      });
      setCollectionName(name);
      setMunicipalityName(muni);
      setCityName(cty);
      setDefaultSize(dsize);
      toast.success(`تم تحميل "${name}" (${loadedItems.length} لوحة)`);
      try { localStorage.setItem('last_municipality_collection_id', collectionId); } catch {}
    } catch (e: any) {
      console.error('[loadCollection] Exception:', e);
      toast.error(`فشل في تحميل المجموعة: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setLoading(false);
      setShowCollectionsDialog(false);
    }
  };

  const saveCollection = async () => {
    if (currentCollection.items.length === 0) {
      toast.error('أضف لوحات أولاً');
      return;
    }
    if (!collectionName.trim()) {
      toast.error('أدخل اسم المجموعة');
      return;
    }
    setSaving(true);
    try {
      let collectionId = currentCollection.id;
      const printConfig = {
        municipality: municipalityName,
        headerTitleTemplate: summaryHeaderTitle,
        coverTitle,
        coverPhrase,
        coverSubtitle,
        coverPageEnabled,
        coverLogoUrl,
        coverLogoSize,
        coverTitleFontSize,
        coverPhraseFontSize,
        coverSubtitleFontSize,
        showSignatures,
        signaturesPage,
        signersList,
        signaturesFontSize,
        summaryRowsPerPage,
        showStatusInPrint,
        showHeightInPrint,
        printImageSource,
      };

      const collectionPayload: any = {
        name: collectionName.trim(),
        description: JSON.stringify(printConfig),
        municipality_name: municipalityName || null,
        city: cityName || null,
        default_size: defaultSize || null,
      };

      if (collectionId) {
        await supabase.from('municipality_collections').update(collectionPayload).eq('id', collectionId);
        await supabase.from('municipality_collection_items').delete().eq('collection_id', collectionId);
      } else {
        const { data } = await supabase.from('municipality_collections').insert(collectionPayload).select('id').single();
        if (data) collectionId = data.id;
      }

      if (!collectionId) throw new Error('Failed to get collection ID');

      const itemsToInsert = currentCollection.items.map(item => ({
        collection_id: collectionId!,
        sequence_number: item.sequence_number,
        billboard_id: item.billboard_id || null,
        billboard_name: item.billboard_name || null,
        size: item.size,
        faces_count: item.faces_count,
        location_text: item.location_text,
        nearest_landmark: item.nearest_landmark,
        latitude: item.latitude,
        longitude: item.longitude,
        item_type: item.item_type,
        design_face_a: item.design_face_a || null,
        design_face_b: item.design_face_b || null,
        image_url: item.image_url || null,
        status: item.status || 'تم التركيب',
        overlay_config: item.overlay_config ? item.overlay_config : null,
      }));

      await supabase.from('municipality_collection_items').insert(itemsToInsert);

      setCurrentCollection(prev => ({ ...prev, id: collectionId, name: collectionName.trim() }));
      toast.success('تم الحفظ بنجاح');
      try { if (collectionId) localStorage.setItem('last_municipality_collection_id', collectionId); } catch {}
      loadCollections();
    } catch (e: any) {
      console.error('[saveCollection] error:', e);
      toast.error('فشل في الحفظ: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // حفظ اللوحات الحالية كنسخة جديدة منفصلة
  const saveAsNewCollection = async (customName: string) => {
    if (currentCollection.items.length === 0) {
      toast.error('أضف لوحات أولاً');
      return;
    }
    const finalName = customName.trim();
    if (!finalName) {
      toast.error('يرجى كتابة اسم النسخة الجديدة');
      return;
    }
    setIsSavingAsCopy(true);
    try {
      const printConfig = {
        municipality: municipalityName,
        headerTitleTemplate: summaryHeaderTitle,
        coverTitle,
        coverPhrase,
        coverSubtitle,
        coverPageEnabled,
        coverLogoUrl,
        coverLogoSize,
        coverTitleFontSize,
        coverPhraseFontSize,
        coverSubtitleFontSize,
        showSignatures,
        signaturesPage,
        signersList,
        signaturesFontSize,
        summaryRowsPerPage,
        showStatusInPrint,
        showHeightInPrint,
        printImageSource,
      };

      const collectionPayload: any = {
        name: finalName,
        description: JSON.stringify(printConfig),
        municipality_name: municipalityName || null,
        city: cityName || null,
        default_size: defaultSize || null,
      };

      const { data: newColl, error: collErr } = await supabase
        .from('municipality_collections')
        .insert(collectionPayload)
        .select('id')
        .single();

      if (collErr || !newColl?.id) {
        throw new Error(collErr?.message || 'فشل في إنشاء النسخة الجديدة');
      }

      const newCollectionId = newColl.id;

      const itemsToInsert = currentCollection.items.map(item => ({
        collection_id: newCollectionId,
        sequence_number: item.sequence_number,
        billboard_id: item.billboard_id || null,
        billboard_name: item.billboard_name || null,
        size: item.size,
        faces_count: item.faces_count,
        location_text: item.location_text,
        nearest_landmark: item.nearest_landmark,
        latitude: item.latitude,
        longitude: item.longitude,
        item_type: item.item_type,
        design_face_a: item.design_face_a || null,
        design_face_b: item.design_face_b || null,
        image_url: item.image_url || null,
        status: item.status || 'تم التركيب',
        overlay_config: item.overlay_config ? item.overlay_config : null,
      }));

      const { error: itemsErr } = await supabase.from('municipality_collection_items').insert(itemsToInsert);
      if (itemsErr) {
        throw new Error(itemsErr.message || 'فشل في نسخ عناصر اللوحات');
      }

      setCurrentCollection(prev => ({ ...prev, id: newCollectionId, name: finalName }));
      setCollectionName(finalName);
      toast.success(`تم حفظ القائمة كنسخة جديدة باسم "${finalName}" بنجاح (${itemsToInsert.length} لوحة)`);
      try { localStorage.setItem('last_municipality_collection_id', newCollectionId); } catch {}
      await loadCollections();
      setShowSaveAsCopyDialog(false);
    } catch (e: any) {
      console.error('[saveAsNewCollection] error:', e);
      toast.error(`فشل في حفظ النسخة: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setIsSavingAsCopy(false);
    }
  };

  // نسخ قائمة محفوظة بالكامل مع لوحاتها وتسميتها باسم جديد
  const handleDuplicateCollection = async () => {
    if (!duplicateTarget) return;
    const finalName = duplicateNewName.trim();
    if (!finalName) {
      toast.error('يرجى كتابة اسم النسخة الجديدة');
      return;
    }

    setIsDuplicating(true);
    try {
      // 1. جلب بيانات القائمة الأصلية وعناصرها
      const [collRes, itemsRes] = await Promise.all([
        supabase.from('municipality_collections').select('*').eq('id', duplicateTarget.id).single(),
        supabase.from('municipality_collection_items').select('*').eq('collection_id', duplicateTarget.id).order('sequence_number'),
      ]);

      if (collRes.error || !collRes.data) {
        throw new Error(collRes.error?.message || 'تعذر جلب بيانات القائمة الأصلية');
      }

      const sourceColl = collRes.data;
      const sourceItems = itemsRes.data || [];

      // 2. إنشاء السجل الجديد في جدول المجموعات
      const { data: newColl, error: collInsertErr } = await supabase
        .from('municipality_collections')
        .insert({
          name: finalName,
          description: sourceColl.description,
          municipality_name: sourceColl.municipality_name,
          city: sourceColl.city,
          default_size: sourceColl.default_size,
        })
        .select('id')
        .single();

      if (collInsertErr || !newColl?.id) {
        throw new Error(collInsertErr?.message || 'تعذر إنشاء القائمة الجديدة');
      }

      const newId = newColl.id;

      // 3. نسخ جميع اللوحات إن وجدت
      if (sourceItems.length > 0) {
        const clonedItems = sourceItems.map((item: any) => ({
          collection_id: newId,
          sequence_number: item.sequence_number,
          billboard_id: item.billboard_id || null,
          billboard_name: item.billboard_name || null,
          size: item.size || '',
          faces_count: item.faces_count || 'وجهين',
          location_text: item.location_text || '',
          nearest_landmark: item.nearest_landmark || '',
          latitude: item.latitude,
          longitude: item.longitude,
          item_type: item.item_type || 'existing',
          design_face_a: item.design_face_a || null,
          design_face_b: item.design_face_b || null,
          image_url: item.image_url || null,
          status: item.status || 'تم التركيب',
          overlay_config: item.overlay_config || null,
        }));

        const { error: itemsInsertErr } = await supabase.from('municipality_collection_items').insert(clonedItems);
        if (itemsInsertErr) {
          throw new Error(itemsInsertErr.message || 'تعذر نسخ اللوحات للقائمة الجديدة');
        }
      }

      toast.success(`تم نسخ القائمة باسم "${finalName}" بنجاح (${sourceItems.length} لوحة)`);
      await loadCollections();
      setDuplicateTarget(null);

      if (duplicateAutoOpen) {
        setShowCollectionsDialog(false);
        await loadCollection(newId);
      }
    } catch (err: any) {
      console.error('[handleDuplicateCollection] error:', err);
      toast.error(`فشل في نسخ القائمة: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setIsDuplicating(false);
    }
  };

  // حذف قائمة محفوظة
  const handleDeleteCollection = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await supabase.from('municipality_collection_items').delete().eq('collection_id', deleteTarget.id);
      const { error } = await supabase.from('municipality_collections').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      toast.success(`تم حذف القائمة "${deleteTarget.name}" بنجاح`);
      if (currentCollection.id === deleteTarget.id) {
        setCurrentCollection(prev => ({ ...prev, id: undefined }));
        try { localStorage.removeItem('last_municipality_collection_id'); } catch {}
      }
      await loadCollections();
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('[handleDeleteCollection] error:', err);
      toast.error(`فشل في حذف القائمة: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNewProject = () => {
    setCurrentCollection({ items: [] });
    setCollectionName('');
    setMunicipalityName('');
    setCityName('');
    setDefaultSize('');
    setCoverTitle('');
    setCoverPhrase('لوحات');
    setCoverSubtitle('');
    try {
      localStorage.removeItem('last_municipality_collection_id');
    } catch {}
    toast.success('تم فتح مشروع جديد فارغ');
  };

  // Helper to fetch default values pre-filled from the last item in the collection
  const getLastItemDefaults = () => {
    const lastItem = currentCollection.items.length > 0
      ? [...currentCollection.items].sort((a, b) => b.sequence_number - a.sequence_number)[0]
      : null;
    return {
      size: lastItem?.size || defaultSize || '',
      faces_count: lastItem?.faces_count || 'وجهين',
      status: lastItem?.status || 'تم التركيب',
      nearest_landmark: lastItem?.nearest_landmark || '',
      location_text: lastItem?.location_text || '',
    };
  };

  // Add new manual billboard
  const openAddDialog = () => {
    const defaults = getLastItemDefaults();
    setNewItem({
      size: defaults.size,
      faces_count: defaults.faces_count,
      status: defaults.status,
      location_text: defaults.location_text,
      nearest_landmark: defaults.nearest_landmark,
      latitude: null,
      longitude: null,
      item_type: 'new',
    });
    setPhotoImportState('idle');
    setPhotoImportProgress(0);
    setPendingImageUrl(null);
    setPhotoPreviewUrl(null);
    setPhotoExifStatus('none');
    setGoogleMapsUrl('');
    setGoogleMapsUrlError('');
    setGoogleMapsUrlLoading(false);
    setShowAddDialog(true);
  };

  // Handle direct paste from clipboard button
  const handlePasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `pasted-image-${Date.now()}.${imageType.split('/')[1] || 'png'}`, { type: imageType });
          handlePhotoImport(file);
          toast.success('تم جلب الصورة من الحافظة');
          return;
        }
      }
      toast.info('لم يتم العثور على صورة في الحافظة — استخدم Ctrl + V لصق الصورة مباشرة');
    } catch {
      toast.info('استخدم اختصار المفاتيح Ctrl + V لصق الصورة مباشرة');
    }
  };

  // Global Ctrl + V Paste Listener for Images
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;

          e.preventDefault();

          // 1. If currently in Edit Billboard Dialog → update currently edited billboard
          if (editingItem) {
            toast.loading('جاري رفع الصورة وتحديث اللوحة الحالية...', { id: 'paste-edit-upload' });
            try {
              const compressed = await compressLossless(file);
              const imgName = `mb-edit-paste-${editingItem.sequence_number}-${Date.now()}`;
              const folder = `municipality-billboards/${(municipalityName || 'general').replace(/[^\w\u0600-\u06FF-]/g, '_')}`;
              const imageUrl = await uploadImage(compressed, imgName, folder);
              setEditingItem(prev => (prev ? { ...prev, image_url: imageUrl } : null));
              updateItem(editingItem.sequence_number, { image_url: imageUrl });
              toast.success(`تم تحديث صورة اللوحة رقم ${editingItem.sequence_number} بنجاح`, { id: 'paste-edit-upload' });
            } catch (err: any) {
              toast.error('فشل رفع الصورة: ' + (err?.message || ''), { id: 'paste-edit-upload' });
            }
            return;
          }

          // 2. If Add Dialog or Google Maps Dialog is open → upload into dialog
          if (showAddDialog || showGoogleMapsDialog) {
            handlePhotoImport(file);
            toast.success('تم لصق الصورة في نافذة الإضافة (Ctrl+V)');
            return;
          }

          // 3. If exactly 1 billboard is selected in list → attach image to it directly
          if (selectedItems.size === 1) {
            const seq = Array.from(selectedItems)[0];
            toast.loading('جاري رفع الصورة الملصوقة...', { id: 'paste-upload' });
            try {
              const compressed = await compressLossless(file);
              const imgName = `mb-paste-${seq}-${Date.now()}`;
              const folder = `municipality-billboards/${(municipalityName || 'general').replace(/[^\w\u0600-\u06FF-]/g, '_')}`;
              const imageUrl = await uploadImage(compressed, imgName, folder);
              updateItem(seq, { image_url: imageUrl });
              toast.success(`تم إرفاق الصورة الملصوقة باللوحة رقم ${seq}`, { id: 'paste-upload' });
            } catch (err: any) {
              toast.error('فشل رفع الصورة: ' + (err?.message || ''), { id: 'paste-upload' });
            }
            return;
          }

          // 4. Otherwise (no dialog & no selection) → open Add Dialog with this pasted image
          openAddDialog();
          handlePhotoImport(file);
          toast.success('تم فتح نافذة الإضافة وإرفاق الصورة الملصوقة (Ctrl+V)');
          return;
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [showAddDialog, showGoogleMapsDialog, editingItem, selectedItems, municipalityName]);

  // Handle Google Maps URL parsing and geocoding
  const handleGoogleMapsUrlParse = async (url: string) => {
    setGoogleMapsUrl(url);
    setGoogleMapsUrlError('');

    if (!url.trim()) {
      setNewItem(prev => ({ ...prev, latitude: null, longitude: null }));
      return;
    }

    // Try direct parsing first
    let coords = parseGoogleMapsUrl(url);

    // If direct parsing failed and it's a short URL → expand it
    if (!coords && isShortGoogleMapsUrl(url)) {
      setGoogleMapsUrlLoading(true);
      setGoogleMapsUrlError('');
      try {
        coords = await expandShortGoogleMapsUrl(url);
      } catch {
        coords = null;
      }
      if (!coords) {
        setGoogleMapsUrlLoading(false);
        setGoogleMapsUrlError(
          'تعذّر استخراج الإحداثيات من الرابط المختصر — يرجى فتح الرابط في المتصفح ثم نسخ الرابط الكامل من شريط العنوان'
        );
        return;
      }
    } else if (!coords) {
      setGoogleMapsUrlError('تعذّر استخراج الإحداثيات من هذا الرابط — تأكد أنه رابط قوقل ماب صحيح');
      return;
    }

    const lat = Number(coords.lat.toFixed(6));
    const lng = Number(coords.lng.toFixed(6));
    setNewItem(prev => ({ ...prev, latitude: lat, longitude: lng }));
    setGoogleMapsUrlError('');

    // Auto-reverse geocode to fill location text and landmark
    setGoogleMapsUrlLoading(true);
    try {
      const geo = await reverseGeocode(lat, lng);
      if (geo) {
        setNewItem(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          location_text: prev.location_text || geo.location_text || '',
          nearest_landmark: prev.nearest_landmark || geo.nearest_landmark || '',
        }));
      }
    } finally {
      setGoogleMapsUrlLoading(false);
    }
  };

  // Handle Google Maps URL parsing for edit billboard dialog (editingItem)
  const handleEditGoogleMapsUrlParse = async (url: string) => {
    setGoogleMapsUrl(url);
    setGoogleMapsUrlError('');

    if (!url.trim()) return;

    let coords = parseGoogleMapsUrl(url);
    if (!coords && isShortGoogleMapsUrl(url)) {
      setGoogleMapsUrlLoading(true);
      try {
        coords = await expandShortGoogleMapsUrl(url);
      } catch {
        coords = null;
      }
      setGoogleMapsUrlLoading(false);
    }

    if (!coords) {
      setGoogleMapsUrlError('تعذّر استخراج الإحداثيات من هذا الرابط — تأكد أنه رابط قوقل ماب صحيح');
      return;
    }

    const lat = Number(coords.lat.toFixed(6));
    const lng = Number(coords.lng.toFixed(6));

    if (editingItem) {
      setEditingItem(prev => (prev ? { ...prev, latitude: lat, longitude: lng } : null));
    }
    setGoogleMapsUrlError('');

    // Auto-reverse geocode to fill location text and landmark
    setGoogleMapsUrlLoading(true);
    try {
      const geo = await reverseGeocode(lat, lng);
      if (geo) {
        setEditingItem(prev => (prev ? {
          ...prev,
          latitude: lat,
          longitude: lng,
          location_text: prev.location_text || geo.location_text || '',
          nearest_landmark: prev.nearest_landmark || geo.nearest_landmark || '',
        } : null));
      }
    } catch {
      // non-fatal
    } finally {
      setGoogleMapsUrlLoading(false);
    }
  };

  const handlePhotoImport = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالحة');
      return;
    }

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(previewUrl);
    setPendingImageUrl(null);
    setPhotoExifStatus('none');
    setPhotoImportState('compressing');
    setPhotoImportProgress(5);

    try {
      // 1. Extract EXIF BEFORE compression
      const exif = await extractExifData(file);
      const hasGps = exif.lat !== null && exif.lng !== null;
      setPhotoExifStatus(hasGps ? 'found' : 'missing');

      if (hasGps && exif.lat !== null && exif.lng !== null) {
        const cleanLat = Number(exif.lat.toFixed(6));
        const cleanLng = Number(exif.lng.toFixed(6));
        setNewItem(prev => ({ ...prev, latitude: cleanLat, longitude: cleanLng }));
        if (editingItem) {
          setEditingItem(prev => (prev ? { ...prev, latitude: cleanLat, longitude: cleanLng } : null));
        }
      }
      setPhotoImportProgress(15);

      // 2. Lossless compression with real progress updates
      const compressed = await compressLossless(file, (pct) => {
        setPhotoImportProgress(15 + Math.round(pct * 0.35));
      });
      setPhotoImportProgress(50);

      // 3. Upload to provider with real-time progress timer
      setPhotoImportState('uploading');
      let currentProgress = 50;
      const progressTimer = setInterval(() => {
        currentProgress = Math.min(88, currentProgress + Math.floor(Math.random() * 5 + 3));
        setPhotoImportProgress(currentProgress);
      }, 150);

      const imgName = `mun-photo-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_').slice(0, 40)}`;
      const folder = `municipality-billboards/${(municipalityName || 'general').replace(/[^\w\u0600-\u06FF-]/g, '_')}`;
      const imageUrl = await uploadImage(compressed, imgName, folder);

      clearInterval(progressTimer);
      setPendingImageUrl(imageUrl);

      // Sync image to editingItem if currently editing an existing billboard
      if (editingItem) {
        setEditingItem(prev => (prev ? { ...prev, image_url: imageUrl } : null));
        updateItem(editingItem.sequence_number, { image_url: imageUrl });
      }

      setPhotoImportProgress(90);

      // 4. Reverse Geocoding if we have coords
      if (hasGps && exif.lat && exif.lng) {
        setPhotoImportState('geocoding');
        const geo = await reverseGeocode(exif.lat, exif.lng);
        if (geo) {
          setNewItem(prev => ({
            ...prev,
            location_text: prev.location_text || geo.location_text,
            nearest_landmark: prev.nearest_landmark || geo.nearest_landmark,
          }));
          if (editingItem) {
            setEditingItem(prev => (prev ? {
              ...prev,
              location_text: prev.location_text || geo.location_text,
              nearest_landmark: prev.nearest_landmark || geo.nearest_landmark,
            } : null));
          }
        }
      }
      setPhotoImportProgress(100);
      setPhotoImportState('done');
      toast.success('تم رفع الصورة بنجاح وتحديد البيانات');
    } catch (err: any) {
      console.error('Photo import error:', err);
      setPhotoImportState('error');
      toast.error('فشل رفع الصورة: ' + (err?.message || 'خطأ غير معروف'));
    }
  };

  const handleDropOrSelectFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileList.length === 0) {
      toast.error('يرجى اختيار ملفات صور صالحة');
      return;
    }

    if (fileList.length === 1) {
      handlePhotoImport(fileList[0]);
    } else {
      setBatchImportFiles(fileList);
      setBatchUnifiedSize(defaultSize || dbSizes[0] || '');
      setBatchFacesCount('وجهين');
      setBatchUnifiedStatus('تم التركيب');
      setBatchProgressMsg('');
      setShowBatchImportDialog(true);
    }
  };

  const handleBatchPhotoImport = async () => {
    if (batchImportFiles.length === 0) return;
    const sizeToUse = batchUnifiedSize.trim();
    if (!sizeToUse) {
      toast.error('يرجى اختيار مقاس موحد للوحات');
      return;
    }

    setBatchImporting(true);
    let successCount = 0;
    const newItemsList: CollectionItem[] = [];
    let startSeq = currentCollection.items.length + 1;

    for (let i = 0; i < batchImportFiles.length; i++) {
      const file = batchImportFiles[i];
      setBatchProgressMsg(`جاري معالجة ورفع صورة ${i + 1} من ${batchImportFiles.length} (${file.name})...`);

      try {
        // 1. EXIF Coordinates extraction
        const exif = await extractExifData(file);
        const hasGps = exif.lat !== null && exif.lng !== null;
        const lat = hasGps ? Number(exif.lat!.toFixed(6)) : null;
        const lng = hasGps ? Number(exif.lng!.toFixed(6)) : null;

        // 2. Compression
        const compressed = await compressLossless(file, () => {});

        // 3. Upload to cloud/storage
        const imgName = `mun-photo-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_').slice(0, 40)}`;
        const folder = `municipality-billboards/${(municipalityName || 'general').replace(/[^\w\u0600-\u06FF-]/g, '_')}`;
        const imageUrl = await uploadImage(compressed, imgName, folder);

        // 4. Geocode to label
        let locText = '';
        let landmark = '';
        if (hasGps && lat && lng) {
          const geo = await reverseGeocode(lat, lng);
          if (geo) {
            locText = geo.location_text || '';
            landmark = geo.nearest_landmark || '';
          }
        }

        const seq = startSeq++;
        const item: CollectionItem = {
          sequence_number: seq,
          size: sizeToUse,
          faces_count: batchFacesCount || 'وجهين',
          location_text: locText || `موقع مستورد ${seq}`,
          nearest_landmark: landmark,
          latitude: lat,
          longitude: lng,
          item_type: 'new',
          billboard_name: locText || `لوحة مستوردة ${seq}`,
          municipality: municipalityName || '',
          status: batchUnifiedStatus || 'تم التركيب',
          image_url: imageUrl || undefined,
        };

        newItemsList.push(item);
        successCount++;
      } catch (err) {
        console.error(`Batch import failed for file ${file.name}:`, err);
      }
    }

    if (newItemsList.length > 0) {
      setCurrentCollection(prev => ({
        ...prev,
        items: [...prev.items, ...newItemsList]
      }));
    }

    setBatchImporting(false);
    setShowBatchImportDialog(false);
    setBatchImportFiles([]);
    
    if (successCount > 0) {
      toast.success(`تم استيراد ${successCount} لوحة بنجاح بمقاس موحد ${sizeToUse}`);
    } else {
      toast.error('فشل استيراد الصور المحددة');
    }
  };

  const addNewItem = () => {
    // 1. Block saving ONLY IF an image upload is actively in progress
    if (photoImportState === 'compressing' || photoImportState === 'uploading' || photoImportState === 'geocoding') {
      toast.info('جاري رفع ومعالجة الصورة... يرجى الانتظار حتى اكتمال شريط التقدم');
      return;
    }

    // 2. Validation for Google Maps dialog
    if (showGoogleMapsDialog) {
      if (!googleMapsUrl.trim()) {
        toast.error('يرجى إدخال رابط قوقل ماب أولاً');
        return;
      }
      if (!newItem.latitude || !newItem.longitude) {
        toast.error('تعذّر استخراج الإحداثيات من الرابط — يرجى التأكد من صحة الرابط');
        return;
      }
    }

    // 3. Validation for Billboard Size
    const sizeToUse = (newItem.size || '').trim() || defaultSize.trim();
    if (!sizeToUse) {
      toast.error('يرجى اختيار أو إدخال مقاس اللوحة أولاً');
      return;
    }

    // 3. Proceed with adding item
    const nextSeq = currentCollection.items.length + 1;
    const item: CollectionItem = {
      sequence_number: nextSeq,
      size: sizeToUse,
      faces_count: newItem.faces_count || 'وجهين',
      location_text: newItem.location_text || '',
      nearest_landmark: newItem.nearest_landmark || '',
      latitude: newItem.latitude || null,
      longitude: newItem.longitude || null,
      item_type: 'new',
      billboard_name: newItem.location_text || `لوحة جديدة ${nextSeq}`,
      municipality: municipalityName || '',
      status: newItem.status || 'تم التركيب',
      image_url: pendingImageUrl || photoPreviewUrl || newItem.image_url || undefined,
    };
    setCurrentCollection(prev => ({ ...prev, items: [...prev.items, item] }));
    setNewItem({ size: defaultSize || '', faces_count: 'وجهين', location_text: '', nearest_landmark: '', latitude: null, longitude: null, item_type: 'new' });
    setPendingImageUrl(null);
    setPhotoPreviewUrl(null);
    setPhotoImportState('idle');
    setGoogleMapsUrl('');
    setGoogleMapsUrlError('');
    setGoogleMapsUrlLoading(false);
    
    // Only close dialogs when validation passes and item is added
    setShowAddDialog(false);
    setShowGoogleMapsDialog(false);
    toast.success(`تمت إضافة لوحة رقم ${nextSeq}`);
  };

  // Quickly add a single billboard from system to the collection
  const quickAddBillboard = (b: any) => {
    if (currentCollection.items.some(i => i.billboard_id === b.ID)) {
      toast.info('هذه اللوحة موجودة بالفعل في القائمة');
      return;
    }
    const coords = b.GPS_Coordinates?.split(',').map((c: string) => parseFloat(c.trim()));
    const nextSeq = currentCollection.items.length + 1;
    const dbStatus = (b.Status || '').trim();
    const statusToUse = (dbStatus === 'إزالة' || dbStatus === 'ازالة') ? 'إزالة' : 'تم التركيب';
    const item: CollectionItem = {
      sequence_number: nextSeq,
      billboard_id: b.ID,
      billboard_name: b.Billboard_Name || `لوحة ${b.ID}`,
      size: b.Size || defaultSize || '',
      faces_count: b.Faces_Count ? (b.Faces_Count === 1 ? 'وجه' : 'وجهين') : 'وجهين',
      location_text: formatLocationText(b, cityName),
      nearest_landmark: b.Nearest_Landmark || '',
      latitude: coords?.[0] || null,
      longitude: coords?.[1] || null,
      item_type: 'existing',
      design_face_a: b.design_face_a,
      design_face_b: b.design_face_b,
      image_url: b.Image_URL,
      municipality: b.Municipality || '',
      status: statusToUse,
    };
    setCurrentCollection(prev => ({ ...prev, items: [...prev.items, item] }));
    toast.success(`تمت إضافة "${item.billboard_name}"`);
  };

  const handleAddComparisonToList = (bb: any) => {
    const realId = bb.ID > 1000000 ? bb.ID - 1000000 : bb.ID;
    const original = allBillboards.find(ob => ob.ID === realId);
    if (original) {
      quickAddBillboard(original);
    } else {
      toast.error('لم يتم العثور على بيانات اللوحة الأصلية');
    }
  };


  // Import existing billboards
  const importSelectedBillboards = () => {
    if (selectedBillboardIds.size === 0) {
      toast.error('اختر لوحات أولاً');
      return;
    }
    const existingIds = new Set(currentCollection.items.map(it => it.billboard_id).filter(Boolean));
    const startSeq = currentCollection.items.length + 1;
    const newItems: CollectionItem[] = [];
    let seq = startSeq;

    allBillboards
      .filter(b => selectedBillboardIds.has(b.ID) && !existingIds.has(b.ID))
      .forEach(b => {
        const coords = b.GPS_Coordinates?.split(',').map((c: string) => parseFloat(c.trim()));
        const dbStatus = (b.Status || '').trim();
        const statusToUse = (dbStatus === 'إزالة' || dbStatus === 'ازالة') ? 'إزالة' : 'تم التركيب';
        newItems.push({
          sequence_number: seq++,
          billboard_id: b.ID,
          billboard_name: b.Billboard_Name || `لوحة ${b.ID}`,
          size: b.Size || '',
          faces_count: b.Faces_Count ? (b.Faces_Count === 1 ? 'وجه' : 'وجهين') : 'وجهين',
          location_text: formatLocationText(b, cityName),
          nearest_landmark: b.Nearest_Landmark || '',
          latitude: coords?.[0] || null,
          longitude: coords?.[1] || null,
          item_type: 'existing',
          design_face_a: b.design_face_a,
          design_face_b: b.design_face_b,
          image_url: b.Image_URL,
          municipality: b.Municipality || '',
          status: statusToUse,
        });
      });

    setCurrentCollection(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
    setSelectedBillboardIds(new Set());
    setShowImportDialog(false);
    toast.success(`تمت إضافة ${newItems.length} لوحة`);
  };

  // Remove item and re-sequence
  const removeItem = (seq: number) => {
    setCurrentCollection(prev => {
      const filtered = prev.items.filter(i => i.sequence_number !== seq);
      const reSequenced = filtered.map((item, idx) => ({ ...item, sequence_number: idx + 1 }));
      return { ...prev, items: reSequenced };
    });
    setSelectedItems(prev => { const n = new Set(prev); n.delete(seq); return n; });
  };

  // Move item up/down
  const moveItem = (seq: number, direction: 'up' | 'down') => {
    setCurrentCollection(prev => {
      const items = [...prev.items].sort((a, b) => a.sequence_number - b.sequence_number);
      const idx = items.findIndex(i => i.sequence_number === seq);
      if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === items.length - 1)) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
      const reSequenced = items.map((item, i) => ({ ...item, sequence_number: i + 1 }));
      return { ...prev, items: reSequenced };
    });
  };

  // Execute bulk or single move reordering
  const executeMoveBillboards = () => {
    const targetNum = Number(moveTargetSeq);
    if (!moveTargetSeq || isNaN(targetNum) || targetNum < 1 || targetNum > currentCollection.items.length) {
      toast.error('رقم اللوحة المستهدفة غير صحيح');
      return;
    }

    if (moveSourceSeqs.includes(targetNum)) {
      toast.error('لا يمكن نقل اللوحات إلى رقم إحداها');
      return;
    }

    setCurrentCollection(prev => {
      // Sort items by sequence number first
      const sorted = [...prev.items].sort((a, b) => a.sequence_number - b.sequence_number);
      
      const movedItems = sorted.filter(item => moveSourceSeqs.includes(item.sequence_number));
      const remainingItems = sorted.filter(item => !moveSourceSeqs.includes(item.sequence_number));
      
      const idxInRemaining = remainingItems.findIndex(item => item.sequence_number === targetNum);
      if (idxInRemaining === -1) return prev;

      const insertIndex = movePosition === 'above' ? idxInRemaining : idxInRemaining + 1;
      
      const newItems = [
        ...remainingItems.slice(0, insertIndex),
        ...movedItems,
        ...remainingItems.slice(insertIndex)
      ];

      const reSequenced = newItems.map((item, index) => ({
        ...item,
        sequence_number: index + 1
      }));

      return { ...prev, items: reSequenced };
    });

    toast.success('تم إعادة ترتيب ونقل اللوحات بنجاح');
    setSelectedItems(new Set());
    setShowMoveDialog(false);
    setMoveSourceSeqs([]);
    setMoveTargetSeq('');
  };

  // Update item (Enhanced to apply changes to all items with the same size or selected items)
  const updateItem = (seq: number, updates: Partial<CollectionItem>) => {
    setCurrentCollection(prev => {
      const targetItem = prev.items.find(item => item.sequence_number === seq);
      const oldSize = targetItem ? targetItem.size : '';
      const isSelected = selectedItems.has(seq);

      return {
        ...prev,
        items: prev.items.map(item => {
          // If this is the direct target item
          if (item.sequence_number === seq) {
            return { ...item, ...updates };
          }

          // If size is updated
          if (updates.size !== undefined) {
            // Apply to other selected items
            if (isSelected && selectedItems.has(item.sequence_number)) {
              return { ...item, size: updates.size };
            }
            // Apply to all items sharing the exact same old size
            if (oldSize && item.size === oldSize) {
              return { ...item, size: updates.size };
            }
          }

          // If status is updated
          if (updates.status !== undefined) {
            if (isSelected && selectedItems.has(item.sequence_number)) {
              return { ...item, status: updates.status };
            }
          }

          return item;
        }),
      };
    });
  };

  const clearAllItems = () => {
    if (currentCollection.items.length === 0) {
      toast.info('الجدول فارغ بالفعل');
      return;
    }

    const confirmed = window.confirm('سيتم مسح جميع عناصر الجدول الحالي. هل تريد المتابعة؟');
    if (!confirmed) return;

    setCurrentCollection(prev => ({ ...prev, items: [] }));
    setSelectedItems(new Set());
    setSelectedBillboardIds(new Set());
    setSearchItems('');
    setBulkSize('');
    toast.success('تم تصفير الجدول ومسح جميع العناصر');
  };

  // ✅ تحويل العناصر المحددة إلى لوحات رسمية في جدول billboards
  const convertSelectedToOfficialBillboards = async () => {
    if (selectedItems.size === 0) {
      toast.error('اختر لوحة واحدة على الأقل أولاً');
      return;
    }
    if (!municipalityName) {
      toast.error('يجب ربط القائمة ببلدية أولاً قبل التحويل');
      return;
    }

    const itemsToConvert = currentCollection.items.filter(i => selectedItems.has(i.sequence_number));
    const missingSize = itemsToConvert.filter(i => !i.size || !i.size.trim());
    if (missingSize.length > 0) {
      toast.error(`${missingSize.length} لوحة بدون مقاس — يجب تعيين مقاس لكل لوحة قبل التحويل`);
      return;
    }

    const confirmed = window.confirm(
      `سيتم إنشاء ${itemsToConvert.length} لوحة رسمية في قائمة اللوحات (سيُسند لكل واحدة كود تلقائياً).\n\nمتابعة؟`
    );
    if (!confirmed) return;

    try {
      // الحصول على أعلى ID لإسناد أكواد جديدة
      const { data: maxRow } = await supabase
        .from('billboards')
        .select('ID')
        .order('ID', { ascending: false })
        .limit(1);
      let nextId = ((maxRow?.[0]?.ID as number) || 0) + 1;

      const rows = itemsToConvert.map(item => {
        const id = nextId++;
        const facesCount = item.faces_count === 'وجه' ? 1 : 2;
        const billboardName = item.billboard_name?.trim() || `${municipalityName}-${id}`;
        return {
          ID: id,
          Billboard_Name: billboardName,
          Size: item.size,
          Faces_Count: facesCount,
          Municipality: municipalityName,
          City: cityName || item.location_text || '',
          Nearest_Landmark: item.nearest_landmark || '',
          GPS_Coordinates: item.latitude && item.longitude ? `${item.latitude},${item.longitude}` : null,
          Image_URL: item.image_url || null,
          Status: 'متاح',
        } as any;
      });

      const { data: inserted, error } = await supabase
        .from('billboards')
        .insert(rows)
        .select('ID, Billboard_Name');

      if (error) throw error;

      // ربط العناصر بالـ IDs الجديدة وتحويل النوع إلى existing
      const idsBySeq = new Map<number, number>();
      itemsToConvert.forEach((item, idx) => {
        const newId = inserted?.[idx]?.ID as number | undefined;
        if (newId) idsBySeq.set(item.sequence_number, newId);
      });

      setCurrentCollection(prev => ({
        ...prev,
        items: prev.items.map(item => {
          const newId = idsBySeq.get(item.sequence_number);
          if (!newId) return item;
          return {
            ...item,
            billboard_id: newId,
            billboard_name: rows.find(r => r.ID === newId)?.Billboard_Name || item.billboard_name,
            item_type: 'existing' as const,
            municipality: municipalityName,
          };
        }),
      }));
      setSelectedItems(new Set());
      toast.success(`تم تحويل ${rows.length} لوحة إلى لوحات رسمية في قائمة اللوحات`);
    } catch (err: any) {
      console.error('Convert to official billboards failed:', err);
      toast.error(`فشل التحويل: ${err?.message || 'خطأ غير معروف'}`);
    }
  };

  // ✅ الاستماع لحدث تعديل اللوحة من نوافذ الخريطة
  useEffect(() => {
    const handler = (e: Event) => {
      const editId = (e as CustomEvent).detail;
      if (!editId) return;
      const seq = Number(editId);
      const item = currentCollection.items.find(i => i.sequence_number === seq);
      if (item) {
        setEditingItem(item);
      } else {
        toast.error('تعذّر إيجاد العنصر للتعديل');
      }
    };
    window.addEventListener('edit-billboard', handler);
    return () => window.removeEventListener('edit-billboard', handler);
  }, [currentCollection.items]);

  // Drag & Drop handlers
  const handleDragStart = (seq: number) => {
    dragItem.current = seq;
  };

  const handleDragEnter = (seq: number) => {
    dragOverItem.current = seq;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    setCurrentCollection(prev => {
      const items = [...prev.items].sort((a, b) => a.sequence_number - b.sequence_number);
      const fromIdx = items.findIndex(i => i.sequence_number === dragItem.current);
      const toIdx = items.findIndex(i => i.sequence_number === dragOverItem.current);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [removed] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, removed);
      const reSequenced = items.map((item, i) => ({ ...item, sequence_number: i + 1 }));
      return { ...prev, items: reSequenced };
    });
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // Replace one item with another from the system
  const handleReplace = (targetSeq: number) => {
    setReplaceTarget(targetSeq);
    setSearchBillboard('');
    setSelectedBillboardIds(new Set());
    setShowReplaceDialog(true);
  };

  const confirmReplace = () => {
    if (replaceTarget === null || selectedBillboardIds.size !== 1) return;
    const billboardId = [...selectedBillboardIds][0];
    const b = allBillboards.find(bb => bb.ID === billboardId);
    if (!b) return;
    const coords = b.GPS_Coordinates?.split(',').map((c: string) => parseFloat(c.trim()));
    updateItem(replaceTarget, {
      billboard_id: b.ID,
      billboard_name: b.Billboard_Name || `لوحة ${b.ID}`,
      size: b.Size || '',
      faces_count: b.Faces_Count ? (b.Faces_Count === 1 ? 'وجه' : 'وجهين') : 'وجهين',
      location_text: formatLocationText(b, cityName),
      nearest_landmark: b.Nearest_Landmark || '',
      latitude: coords?.[0] || null,
      longitude: coords?.[1] || null,
      item_type: 'existing',
      design_face_a: b.design_face_a,
      design_face_b: b.design_face_b,
      image_url: b.Image_URL,
      municipality: b.Municipality || '',
    });
    setShowReplaceDialog(false);
    setReplaceTarget(null);
    setSelectedBillboardIds(new Set());
    toast.success('تم استبدال اللوحة');
  };

  // Import from Excel file
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        
        if (rows.length === 0) {
          toast.error('الملف فارغ');
          return;
        }

        const headers = Object.keys(rows[0]);
        setExcelHeaders(headers);
        setExcelRawRows(rows);
        setShowColumnMappingDialog(true);
      } catch {
        toast.error('فشل في قراءة ملف Excel');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleColumnMappingConfirm = (mapping: ColumnMapping) => {
    const rows = excelRawRows;
    const startSeq = currentCollection.items.length + 1;

    const newItems: CollectionItem[] = rows.map((row, idx) => {
      // 1. Try to find if billboard exists in the database
      let matchedBillboard: any = null;
      
      if (mapping.billboard_id && row[mapping.billboard_id]) {
        const rawIdOrCode = String(row[mapping.billboard_id]).trim().toLowerCase();
        
        // Find matching billboard in database list (match by ID or Name/Code)
        matchedBillboard = allBillboards.find(b => {
          const dbIdStr = String(b.ID).toLowerCase();
          const dbCodeStr = String(b.Code || '').toLowerCase();
          const dbNameStr = String(b.Billboard_Name || '').toLowerCase();
          return dbIdStr === rawIdOrCode || dbCodeStr === rawIdOrCode || dbNameStr === rawIdOrCode;
        });
      }

      // If matched, we reuse coordinates, size, faces, image, design from DB
      let lat: number | null = null;
      let lng: number | null = null;
      let size = '';
      let faces: 'وجه' | 'وجهين' = 'وجهين';
      let locationText = '';
      let nearestLandmark = '';
      let billboardName = '';
      let designFaceA: string | null = null;
      let designFaceB: string | null = null;
      let imageUrl: string | null = null;
      let dbMunicipality = '';
      let itemType: 'existing' | 'new' = 'new';
      let billboardId: number | null = null;

      if (matchedBillboard) {
        itemType = 'existing';
        billboardId = matchedBillboard.ID;
        size = matchedBillboard.Size || '';
        faces = matchedBillboard.Faces_Count === 1 ? 'وجه' : 'وجهين';
        locationText = formatLocationText(matchedBillboard, cityName, matchedBillboard.Municipality);
        nearestLandmark = matchedBillboard.Nearest_Landmark || '';
        billboardName = matchedBillboard.Billboard_Name || `لوحة ${matchedBillboard.ID}`;
        designFaceA = matchedBillboard.design_face_a || null;
        designFaceB = matchedBillboard.design_face_b || null;
        imageUrl = matchedBillboard.Image_URL || null;
        dbMunicipality = matchedBillboard.Municipality || '';
        
        if (matchedBillboard.GPS_Coordinates) {
          const parts = matchedBillboard.GPS_Coordinates.split(',').map((c: string) => parseFloat(c.trim()));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            lat = parts[0];
            lng = parts[1];
          }
        }
      } else {
        // Fallback to row fields if not matched
        if (mapping.coordsMode === 'combined' && mapping.coords_combined) {
          const coordsStr = String(row[mapping.coords_combined] || '');
          const parts = coordsStr.split(',').map((c: string) => parseFloat(c.trim()));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            lat = parts[0];
            lng = parts[1];
          }
        } else if (mapping.coordsMode === 'separate') {
          if (mapping.coords_lat) {
            const v = parseFloat(String(row[mapping.coords_lat]));
            if (!isNaN(v)) lat = v;
          }
          if (mapping.coords_lng) {
            const v = parseFloat(String(row[mapping.coords_lng]));
            if (!isNaN(v)) lng = v;
          }
        }

        const facesRaw = mapping.faces_count ? String(row[mapping.faces_count] || 'وجهين') : 'وجهين';
        faces = facesRaw.includes('وجه') && !facesRaw.includes('وجهين') ? 'وجه' : 'وجهين';
        size = mapping.size ? String(row[mapping.size] || '') : '';
        locationText = mapping.location_text ? String(row[mapping.location_text] || '') : '';
        nearestLandmark = mapping.nearest_landmark ? String(row[mapping.nearest_landmark] || '') : '';
        billboardName = mapping.billboard_name 
          ? String(row[mapping.billboard_name] || locationText || `لوحة ${startSeq + idx}`)
          : (locationText || `لوحة ${startSeq + idx}`);
      }

      return {
        sequence_number: startSeq + idx,
        billboard_id: billboardId,
        size,
        faces_count: faces,
        location_text: locationText,
        nearest_landmark: nearestLandmark,
        latitude: lat,
        longitude: lng,
        item_type: itemType,
        billboard_name: billboardName,
        design_face_a: designFaceA,
        design_face_b: designFaceB,
        image_url: imageUrl,
        municipality: dbMunicipality,
        status: matchedBillboard ? ((matchedBillboard.Status === 'إزالة' || matchedBillboard.Status === 'ازالة') ? 'إزالة' : 'تم التركيب') : 'تم التركيب'
      };
    });

    const activeMunicipality = municipalityName || currentCollection.municipality_name;
    if (activeMunicipality) {
      setCurrentCollection(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
      setShowColumnMappingDialog(false);
      setExcelPendingItems([]);
      toast.success(`تم استيراد ${newItems.length} لوحة وإضافتها للبلدية الحالية "${activeMunicipality}"`);
    } else {
      setExcelPendingItems(newItems);
      setExcelMunicipalityName('');
      setShowColumnMappingDialog(false);
      setShowExcelMunicipalityDialog(true);
    }
  };

  const confirmExcelImport = () => {
    if (!excelMunicipalityName.trim()) {
      toast.error('أدخل اسم البلدية');
      return;
    }
    setCurrentCollection(prev => ({ ...prev, items: [...prev.items, ...excelPendingItems] }));
    setMunicipalityName(excelMunicipalityName.trim());
    if (!collectionName) setCollectionName(excelMunicipalityName.trim());
    setShowExcelMunicipalityDialog(false);
    setExcelPendingItems([]);
    toast.success(`تم استيراد ${excelPendingItems.length} لوحة تحت "${excelMunicipalityName.trim()}"`);
  };

  const getSizeSortOrder = (sizeStr: string) => {
    if (!sizeStr) return 99999;
    const normalize = (str: string) => str.replace(/×/g, 'x').replace(/X/g, 'x').replace(/\*/g, 'x').replace(/\s+/g, '').trim().toLowerCase();
    const normalized = normalize(sizeStr);
    const found = sizesList.find(s => normalize(s.name) === normalized);
    if (found) return found.sort_order;
    return 99999;
  };

  // Import all billboards from a specific municipality
  const importByMunicipality = (municipality: string) => {
    const totalCount = allBillboards.filter(b => b.Municipality === municipality).length;
    if (totalCount === 0) {
      toast.error(`لا توجد لوحات في بلدية "${municipality}" في النظام`);
      return;
    }

    const existingIds = new Set(currentCollection.items.map(it => it.billboard_id).filter(Boolean));
    const filtered = allBillboards.filter(b => b.Municipality === municipality && !existingIds.has(b.ID));
    if (filtered.length === 0) {
      toast.info(`جميع لوحات بلدية "${municipality}" مضافة بالفعل إلى القائمة`);
      return;
    }
    
    // Find unique sizes and counts in the chosen municipality
    const sizeCounts: Record<string, number> = {};
    filtered.forEach(b => {
      const s = b.Size || 'بدون مقاس';
      sizeCounts[s] = (sizeCounts[s] || 0) + 1;
    });

    const sizesList = Object.entries(sizeCounts).map(([size, count]) => ({ size, count }));
    setMunicipalitySizesWithCounts(sizesList);

    // Initialize mapping dictionary (default: each size maps to itself)
    const initialMappings: Record<string, string> = {};
    sizesList.forEach(({ size }) => {
      initialMappings[size] = size;
    });

    setSelectedMunicipalityForImport(municipality);
    setSizeMappings(initialMappings);
    setShowImportConfigDialog(true);
  };

  const executeImportByMunicipality = (municipality: string) => {
    const existingIds = new Set(currentCollection.items.map(it => it.billboard_id).filter(Boolean));
    let filtered = allBillboards.filter(b => b.Municipality === municipality && !existingIds.has(b.ID));
    if (filtered.length === 0) {
      toast.error(`لا توجد لوحات جديدة للاستيراد في بلدية "${municipality}"`);
      return;
    }

    // Apply size mappings using sizeMappings dictionary
    filtered = filtered.map(b => {
      const srcSize = b.Size || 'بدون مقاس';
      const mappedSize = sizeMappings[srcSize] || srcSize;
      return {
        ...b,
        Size: mappedSize === 'بدون مقاس' ? null : mappedSize
      };
    });

    // Sort by sort_order of sizes, falling back to billboard ID
    const sortedBillboards = [...filtered].sort((a, b) => {
      const orderA = getSizeSortOrder(a.Size || '');
      const orderB = getSizeSortOrder(b.Size || '');
      if (orderA !== orderB) return orderA - orderB;
      return (a.ID || 0) - (b.ID || 0);
    });

    const firstCity = !cityName ? (filtered.find(b => b.City)?.City || '') : cityName;
    const startSeq = currentCollection.items.length + 1;
    const newItems: CollectionItem[] = sortedBillboards.map((b, idx) => {
      const coords = b.GPS_Coordinates?.split(',').map((c: string) => parseFloat(c.trim()));
      const dbStatus = (b.Status || '').trim();
      const statusToUse = (dbStatus === 'إزالة' || dbStatus === 'ازالة') ? 'إزالة' : 'تم التركيب';
      return {
        sequence_number: startSeq + idx,
        billboard_id: b.ID,
        billboard_name: b.Billboard_Name || `لوحة ${b.ID}`,
        size: b.Size || '',
        faces_count: b.Faces_Count ? (b.Faces_Count === 1 ? 'وجه' : 'وجهين') : 'وجهين',
        location_text: formatLocationText(b, firstCity, municipality),
        nearest_landmark: b.Nearest_Landmark || '',
        latitude: coords?.[0] || null,
        longitude: coords?.[1] || null,
        item_type: 'existing' as const,
        design_face_a: b.design_face_a,
        design_face_b: b.design_face_b,
        image_url: b.Image_URL,
        municipality: municipality,
        status: statusToUse,
      };
    });

    setCurrentCollection(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
    setMunicipalityName(municipality);
    // Auto-bind city from first billboard if empty
    if (!cityName && firstCity) {
      setCityName(firstCity);
    }
    if (!collectionName) setCollectionName(municipality);
    setShowImportConfigDialog(false);
    setShowMunicipalityImportDialog(false);
    setSelectedMunicipalityForImport(null);
    setSizeMappings({});
    setMunicipalitySizesWithCounts([]);
    toast.success(`تم جلب ${newItems.length} لوحة مرتبة من بلدية "${municipality}"`);
  };

  // Convert items to Billboard format for map
  const mapBillboards: Billboard[] = useMemo(() => {
    const list = currentCollection.items
      .filter(item => item.latitude && item.longitude)
      .map(item => {
        // Find matching database billboard by ID or spatially within 30m
        let dbB = allBillboards.find(ob => ob.ID === item.billboard_id);
        
        if (!dbB && item.latitude && item.longitude) {
          // Look for nearest database billboard in the same municipality (if selected) or generally within 30m
          const municipalityFilter = comparisonMunicipality && comparisonMunicipality !== 'none' ? comparisonMunicipality : null;
          let candidates = allBillboards;
          if (municipalityFilter) {
            candidates = candidates.filter(ob => ob.Municipality === municipalityFilter);
          }
          
          let nearest: any = null;
          let minDist = Infinity;
          
          candidates.forEach(ob => {
            if (!ob.GPS_Coordinates) return;
            const obCoords = ob.GPS_Coordinates.split(',').map((c: string) => parseFloat(c.trim()));
            if (obCoords.length < 2 || isNaN(obCoords[0]) || isNaN(obCoords[1])) return;
            
            const dist = calculateDistance(item.latitude!, item.longitude!, obCoords[0], obCoords[1]);
            if (dist < minDist) {
              minDist = dist;
              nearest = ob;
            }
          });
          
          if (minDist <= 30) {
            dbB = nearest;
          }
        }

        return {
          ID: item.sequence_number,
          Billboard_Name: item.billboard_name || `${item.sequence_number}`,
          Size: item.size,
          Faces_Count: item.faces_count === 'وجه' ? 1 : 2,
          GPS_Coordinates: `${item.latitude},${item.longitude}`,
          Status: item.item_type === 'existing' ? 'محجوز' : 'متاح',
          City: item.location_text,
          Municipality: currentCollection.municipality_name || '',
          District: '',
          Nearest_Landmark: item.nearest_landmark,
          Image_URL: item.image_url || '',
          design_face_a: item.design_face_a || '',
          design_face_b: item.design_face_b || '',
          sequence_number: item.sequence_number,
          comparisonMatch: dbB ? {
            ID: dbB.ID,
            Billboard_Name: dbB.Billboard_Name,
            Size: dbB.Size,
            Faces_Count: dbB.Faces_Count,
            GPS_Coordinates: dbB.GPS_Coordinates,
            Status: dbB.Status,
            City: dbB.City,
            Municipality: dbB.Municipality,
            District: dbB.District,
            Nearest_Landmark: dbB.Nearest_Landmark,
            Image_URL: dbB.Image_URL,
            design_face_a: dbB.design_face_a,
            design_face_b: dbB.design_face_b,
          } : null
        } as any;
      });

    if (showAddDialog && newItem.latitude && newItem.longitude) {
      list.push({
        ID: 999999,
        Billboard_Name: 'لوحة جديدة (قيد الإضافة)',
        Size: newItem.size || '',
        Faces_Count: newItem.faces_count === 'وجه' ? 1 : 2,
        GPS_Coordinates: `${newItem.latitude},${newItem.longitude}`,
        Status: 'temp_adding',
        City: newItem.location_text || '',
        Municipality: '',
        District: '',
        Nearest_Landmark: newItem.nearest_landmark || '',
        Image_URL: '',
        design_face_a: '',
        design_face_b: '',
      } as any);
    }

    // Add comparison billboards if selected
    if (comparisonMunicipality && comparisonMunicipality !== 'none') {
      const compList = allBillboards.filter(b => b.Municipality === comparisonMunicipality);
      const existingIds = new Set(currentCollection.items.map(it => it.billboard_id).filter(Boolean));
      
      compList.forEach(b => {
        if (!b.GPS_Coordinates) return;
        const coords = b.GPS_Coordinates.split(',').map((c: string) => parseFloat(c.trim()));
        if (coords.length < 2 || isNaN(coords[0]) || isNaN(coords[1])) return;
        
        // 1. Skip if already in collection by ID
        if (existingIds.has(b.ID)) return;
        
        // 2. Skip if spatially matched within 30 meters of any collection item
        const latB = coords[0];
        const lngB = coords[1];
        const hasSpatialMatch = currentCollection.items.some(item => {
          if (item.latitude === null || item.longitude === null) return false;
          const dist = calculateDistance(latB, lngB, item.latitude, item.longitude);
          return dist <= 30; // 30 meters threshold
        });

        if (hasSpatialMatch) return;
        
        list.push({
          ID: b.ID + 1000000, // Safe offset to prevent ID collisions on map
          Billboard_Name: b.Billboard_Name || `لوحة ${b.ID}`,
          Size: b.Size || '',
          Faces_Count: b.Faces_Count || 2,
          GPS_Coordinates: b.GPS_Coordinates,
          Status: b.Status || 'متاح',
          City: b.City || '',
          Municipality: b.Municipality || '',
          District: b.District || '',
          Nearest_Landmark: b.Nearest_Landmark || '',
          Image_URL: b.Image_URL || '',
          design_face_a: b.design_face_a || '',
          design_face_b: b.design_face_b || '',
          isFaded: true,
          isComparison: true
        } as any);
      });
    }

    return list;
  }, [currentCollection.items, showAddDialog, newItem, allBillboards, comparisonMunicipality]);

  const comparisonDifferenceCount = useMemo(() => {
    if (!comparisonMunicipality || comparisonMunicipality === 'none') return 0;
    return mapBillboards.filter(b => (b as any).isComparison).length;
  }, [mapBillboards, comparisonMunicipality]);

  // إشعار توجيهي في حال كانت الخريطة فارغة
  useEffect(() => {
    if (mapBillboards.length === 0) {
      toast.info('الخريطة فارغة. يمكنك الضغط بالزر الأيمن على الخريطة لإضافة لوحة جديدة مباشرة في أي مكان.', {
        id: 'empty-map-info-toast',
        duration: 5000
      });
    }
  }, [mapBillboards.length]);

  // Set of IDs already in the current collection to prevent duplicates
  const existingIds = useMemo(() => {
    return new Set(currentCollection.items.map(it => it.billboard_id).filter(Boolean));
  }, [currentCollection.items]);

  // Filtered billboards for import dialog
  const filteredImportBillboards = useMemo(() => {
    let base = allBillboards.filter(b => !existingIds.has(b.ID));
    if (restrictImportToMunicipality) {
      if (municipalityName) base = base.filter(b => (b.Municipality || '') === municipalityName);
      if (cityName) base = base.filter(b => (b.City || '') === cityName);
    }
    if (!searchBillboard) return base.slice(0, 200);
    const q = searchBillboard.toLowerCase();
    return base.filter(b =>
      (b.Billboard_Name || '').toLowerCase().includes(q) ||
      (b.City || '').toLowerCase().includes(q) ||
      (b.Nearest_Landmark || '').toLowerCase().includes(q) ||
      String(b.ID).includes(q) ||
      (b.Size || '').includes(q) ||
      (b.Municipality || '').toLowerCase().includes(q)
    ).slice(0, 200);
  }, [allBillboards, searchBillboard, restrictImportToMunicipality, municipalityName, cityName, existingIds]);

  // Filtered items in table
  const sortedItems = useMemo(() => {
    const sorted = [...currentCollection.items].sort((a, b) => a.sequence_number - b.sequence_number);
    if (!searchItems.trim()) return sorted;
    const q = searchItems.toLowerCase();
    return sorted.filter(item =>
      (item.location_text || '').toLowerCase().includes(q) ||
      (item.nearest_landmark || '').toLowerCase().includes(q) ||
      (item.size || '').toLowerCase().includes(q) ||
      (item.municipality || '').toLowerCase().includes(q) ||
      String(item.sequence_number).includes(q) ||
      (item.billboard_name || '').toLowerCase().includes(q)
    );
  }, [currentCollection.items, searchItems]);

  const sortByDbSizeRank = () => {
    if (currentCollection.items.length === 0) {
      toast.error('لا توجد لوحات لترتيبها');
      return;
    }
    setCurrentCollection(prev => {
      const sorted = [...prev.items].sort((a, b) => {
        const orderA = getSizeSortOrder(a.size);
        const orderB = getSizeSortOrder(b.size);
        if (orderA !== orderB) return orderA - orderB;
        return a.sequence_number - b.sequence_number;
      });
      const resequenced = sorted.map((item, idx) => ({ ...item, sequence_number: idx + 1 }));
      return { ...prev, items: resequenced };
    });
    toast.success('تم إعادة ترتيب وتسلسل اللوحات حسب رتبة المقاسات المعتمدة في الإعدادات');
  };

  // Get unique sizes from current items sorted strictly by DB size rank (sort_order)
  const availableSizes = useMemo(() => {
    const unique = [...new Set(currentCollection.items.map(i => i.size).filter(Boolean))];
    return unique.sort((a, b) => {
      const orderA = getSizeSortOrder(a);
      const orderB = getSizeSortOrder(b);
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b, 'ar');
    });
  }, [currentCollection.items, sizesList]);

  // ============ PRINT ============
  const handlePrint = async () => {
    if (currentCollection.items.length === 0) {
      toast.error('لا توجد لوحات للطباعة');
      return;
    }
    setPrintLoading(true);
    try {
      const s = customSettings;
      const pages: string[] = [];
      const printItems = [...currentCollection.items].sort((a, b) => a.sequence_number - b.sequence_number);
      const displayMunicipality = municipalityName || collectionName;
      const readStoredStatusValue = (key: string, fallback: string) => {
        try {
          return localStorage.getItem(key) || fallback;
        } catch {
          return fallback;
        }
      };
      const effectiveStatusPosition = statusPosition;
      const effectiveStatusGap = statusGap;
      const effectiveStatusTop = statusTop;
      const effectiveStatusLeft = statusLeft;
      const effectiveStatusFontSize = statusFontSize;
      const effectiveStatusColor = statusColor;

      // ✅ صفحة الغلاف
      const coverEnabled = coverPageEnabled && (s as any).cover_page_enabled !== 'false';
      const effectiveCoverTitle = resolveCoverTitle(coverTitle, municipalityName, cityName, collectionName);
      if (coverEnabled && (effectiveCoverTitle || displayMunicipality)) {
        const matchingBg = printBackgrounds.find(bg => bg.url === customBackgroundUrl);
        const finalCoverLogoUrl = (coverLogoUrl && coverLogoUrl !== 'auto' && coverLogoUrl.trim() !== '')
          ? coverLogoUrl
          : (matchingBg?.logo_url || (s as any).cover_logo_url || '/logofaresgold.svg');
        const finalCoverPhrase = coverPhrase || (s as any).cover_phrase || 'لوحات';
        const finalCoverTitle = effectiveCoverTitle || displayMunicipality;
        const finalCoverSubtitle = coverSubtitle || '';

        const formatCssSize = (val: any, fallback: string) => {
          if (!val) return fallback;
          const str = String(val).trim();
          const num = parseFloat(str);
          if (!isNaN(num) && num > 0) {
            if (str.endsWith('mm')) return `${num}mm`;
            if (str.endsWith('%')) return `${num}%`;
            // Convert px to mm relative to A4 page width (794px = 210mm)
            const mm = (num / 794) * 210;
            return `${mm.toFixed(1)}mm`;
          }
          return str;
        };

        const rawLogoSize = (coverLogoSize && coverLogoUrl && coverLogoUrl !== 'auto' && coverLogoUrl.trim() !== '')
          ? `${coverLogoSize}px`
          : (matchingBg?.logo_size || (s as any).cover_logo_size || '220px');
        const finalCoverLogoSize = formatCssSize(rawLogoSize, '220px');
        const effectiveCoverPhraseFontSize = coverPhraseFontSize ? `${coverPhraseFontSize}px` : formatCssSize((s as any).cover_phrase_font_size, '28px');
        const effectiveCoverTitleFontSize = coverTitleFontSize ? `${coverTitleFontSize}px` : formatCssSize((s as any).cover_municipality_font_size, '36px');
        const effectiveCoverSubtitleFontSize = coverSubtitleFontSize ? `${coverSubtitleFontSize}px` : '18px';

        const coverBgEnabled = (s as any).cover_background_enabled === 'true';
        const coverBgUrl = (s as any).cover_background_url;
        const coverBgHtml = coverBgEnabled && coverBgUrl 
          ? `<div class="background" style="position:absolute;top:0;left:0;width:210mm;height:297mm;z-index:0;overflow:hidden;"><img src="${coverBgUrl}" style="width:210mm;height:297mm;object-fit:fill;object-position:center;display:block;" /></div>` 
          : '';

        pages.push(`
            <div class="page" style="position:relative;width:210mm;height:297mm;overflow:hidden;background:#ffffff !important;margin:0 auto;page-break-after:always;page-break-inside:avoid;">
              ${coverBgHtml}
              <div style="position:absolute;top:45%;left:0;right:0;width:100%;transform:translateY(-50%);text-align:center;margin:0 auto;display:block;z-index:5;">
                <div style="width:100%;text-align:center;margin:0 auto 20px auto;display:block;clear:both;">
                  <img src="${normalizeGoogleImageUrl(finalCoverLogoUrl)}" alt="شعار" style="display:inline-block;margin:0 auto;text-align:center;width:${finalCoverLogoSize};max-width:90%;height:auto;vertical-align:middle;" crossorigin="anonymous" onerror="this.style.display='none'" />
                </div>
                <div style="width:100%;text-align:center;margin:0 auto;display:block;">
                  <div style="font-family:'Doran',Arial,sans-serif;font-size:${effectiveCoverPhraseFontSize};font-weight:700;color:#000;line-height:1.3;text-align:center;margin:0 auto 8px auto;display:block;">
                    ${finalCoverPhrase}
                  </div>
                  <div style="font-family:'Doran',Arial,sans-serif;font-size:${effectiveCoverTitleFontSize};font-weight:700;color:#000;line-height:1.3;text-align:center;margin:0 auto;display:block;">
                    ${finalCoverTitle}
                  </div>
                  ${finalCoverSubtitle ? `
                    <div style="font-family:'Doran',Arial,sans-serif;font-size:${effectiveCoverSubtitleFontSize};font-weight:600;color:#555;line-height:1.4;text-align:center;margin:12px auto 0 auto;display:block;">
                      ${finalCoverSubtitle}
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          `);
      }

      // Map settings from DB
      const mapZoom = parseFloat(s.map_zoom || '16') || 16;
      const mapTypeRaw = (s.map_show_labels || 'hybrid') as 'satellite' | 'hybrid' | 'roadmap';
      const mapLabelScale = parseFloat((s as any).map_label_scale || '1') || 1;

      // Helper: convert mm → px at print DPI for crisp map output
      const mmToPx = (mm: number, dpi = 250) => Math.round((mm / 25.4) * dpi);
      const widthMm = parseFloat(String(s.main_image_width || '120')) || 120;
      const heightMm = parseFloat(String(s.main_image_height || '140')) || 140;
      const mapW = Math.min(1600, Math.max(900, mmToPx(widthMm)));
      const mapHFull = Math.min(1600, Math.max(700, mmToPx(heightMm)));
      const mapHHalf = Math.min(1600, Math.max(500, mmToPx(heightMm / 2)));

      // Pre-generate Google Maps images using direct tile stitching (no API needed, never grays out)
      const mapImages = new Map<number, string>();
      if (printImageSource === 'map_pin' || printImageSource === 'map_only') {
        const itemsWithCoords = printItems.filter(item => item.latitude && item.longitude);
        if (itemsWithCoords.length > 0) {
          toast.info(`جاري تجهيز ${itemsWithCoords.length} خريطة...`);
          const { generateGoogleTilesMapDataUrl } = await import('@/utils/googleTilesMapGenerator');
          const batchSize = 3;
          for (let i = 0; i < itemsWithCoords.length; i += batchSize) {
            const batch = itemsWithCoords.slice(i, i + batchSize);
            const results = await Promise.all(
              batch.map(async (item) => {
                try {
                  // ✅ في وضع "خريطة فقط" لا نقسّم الارتفاع حتى لو وُجدت صورة
                  const halve = printImageSource === 'map_pin' && !!item.image_url;
                  const dataUrl = await generateGoogleTilesMapDataUrl({
                    lat: item.latitude!,
                    lng: item.longitude!,
                    zoom: mapZoom,
                    width: mapW,
                    height: halve ? mapHHalf : mapHFull,
                    mapType: mapTypeRaw,
                    labelScale: mapLabelScale,
                  });
                  return { seq: item.sequence_number, dataUrl };
                } catch {
                  return { seq: item.sequence_number, dataUrl: '' };
                }
              })
            );
            results.forEach(r => mapImages.set(r.seq, r.dataUrl));
          }
        }
      }

      // Pre-generate QR codes (Google Maps links) for all print items
      const qrCodes = new Map<number, { content: string; dataUrl: string }>();
      await Promise.all(
        printItems.map(async (item) => {
          const coords = item.latitude && item.longitude ? `${item.latitude},${item.longitude}` : '';
          const qrContent = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
          let qrDataUrl = '';
          if (qrContent) {
            try {
              qrDataUrl = await QRCode.toDataURL(qrContent, { width: 100, margin: 1 });
            } catch (e) {
              console.error('Error generating QR code:', e);
            }
          }
          qrCodes.set(item.sequence_number, { content: qrContent, dataUrl: qrDataUrl });
        })
      );

      // 🆕 صفحة جدول ملخّص اللوحات
      {
        const rowsPerPage = Math.max(1, summaryRowsPerPage || 17);
        const compactSummary = rowsPerPage > 14;
        
        // ارتفاع الصفوف قياسي وطبيعي بحيث تزيد المسافة السفلية تلقائياً كلما أنقصنا عدد الصفوف
        const rowHeightVal = rowsPerPage > 18 ? 10.5 : 12.5;
        const rowHeight = `${rowHeightVal}mm`;
        
        // Total table width is 190mm (210mm A4 width - 20mm margins). Allocating exact column widths in mm:
        const showFacesCol = s.faces_count_show !== 'false';
        const indexWidth = 10;
        const facesWidth = showFacesCol ? 14 : 0;
        const sizeWidth = 20;
        const qrWidth = rowHeightVal; // Perfectly square width
        
        const remainingWidth = 190 - (indexWidth + facesWidth + sizeWidth + qrWidth);
        
        let locWidth: number, coordsWidth: number, statusWidth: number, landmarkWidth: number;
        if (showStatusInPrint) {
          locWidth = 32;
          coordsWidth = 38;
          statusWidth = 18;
          landmarkWidth = remainingWidth - (locWidth + coordsWidth + statusWidth);
        } else {
          locWidth = 36;
          coordsWidth = 42;
          landmarkWidth = remainingWidth - (locWidth + coordsWidth);
          statusWidth = 0;
        }

        const rowFontSize = rowsPerPage > 18 ? '10px' : '11px';
        const rowPadding = rowsPerPage > 18 ? '2.5px 4px' : '3.5px 5px';
        const qrImgSize = `${rowHeightVal - 1}mm`;
        const totalSummaryPages = Math.max(1, Math.ceil(printItems.length / rowsPerPage));
        for (let pIdx = 0; pIdx < totalSummaryPages; pIdx++) {
          const chunk = printItems.slice(pIdx * rowsPerPage, (pIdx + 1) * rowsPerPage);
          const tableRowsHtml = chunk.map(it => {
            const qrInfo = qrCodes.get(it.sequence_number);
            const qrContent = qrInfo?.content || '';
            const qrDataUrl = qrInfo?.dataUrl || '';
            return `
              <tr>
                <td class="num">${it.sequence_number}</td>
                <td class="loc">${it.location_text || '-'}</td>
                <td class="loc">${it.nearest_landmark || '-'}</td>
                <td class="num">${formatSizeForPrint(it.size, showHeightInPrint) || '-'}</td>
                ${showFacesCol ? `<td class="num">${it.faces_count || '-'}</td>` : ''}
                <td class="coords">${it.latitude && it.longitude ? `${it.latitude}, ${it.longitude}` : '-'}</td>
                ${showStatusInPrint ? `<td class="num">${it.status || '-'}</td>` : ''}
                <td class="qr-col-cell">
                  ${qrDataUrl ? `
                    <a href="${qrContent}" target="_blank" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; cursor: pointer; text-decoration: none;">
                      <img src="${qrDataUrl}" alt="QR" style="width: ${qrImgSize}; height: ${qrImgSize}; display: block; margin: 0 auto; object-fit: contain;" />
                    </a>
                  ` : '-'}
                </td>
              </tr>
            `;
          }).join('');

          const totalColumnsCount = 6 + (showFacesCol ? 1 : 0) + (showStatusInPrint ? 1 : 0);
          const facesHidden = s.faces_count_show === 'false';
          const localSingleVal = localStorage.getItem('calc_meters_as_single_face');
          const isSingleFaceMode = facesHidden && (localSingleVal !== null 
            ? localSingleVal === 'true' 
            : String((s as any).calc_meters_as_single_face) === 'true');
          const showTotalMeters = !facesHidden || isSingleFaceMode;

          const totalAreaMeters = printItems.reduce((sum, item) => {
            const { length, width } = parseDimensions(item.size);
            const l = typeof length === 'number' ? length : (parseFloat(length) || 0);
            const w = typeof width === 'number' ? width : (parseFloat(width) || 0);
            const area = l * w;
            const faces = isSingleFaceMode ? 1 : getFacesCountNumber(item.faces_count);
            return sum + (area * faces);
          }, 0);

          const isLastPage = pIdx === totalSummaryPages - 1;
          const tableFooterHtml = (isLastPage && showTotalMeters) ? `
            <tfoot>
              <tr style="background-color: #f8fafc !important; font-weight: bold; border-top: 2px solid #000; height: ${rowHeight};">
                <td colspan="${totalColumnsCount}" style="text-align: center; padding: 5px 8px; font-size: 12px; color: #000; background-color: #f8fafc !important; font-weight: 700;">
                  <span>إجمالي مساحة اللوحات: </span>
                  <span style="font-size: 14px; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif; color: #000; margin: 0 4px; font-weight: 800;">
                    ${totalAreaMeters.toLocaleString('en-US', { maximumFractionDigits: 2 })} م²
                  </span>
                </td>
              </tr>
            </tfoot>
          ` : '';

          const resolvedTitle = resolveSummaryTitle(summaryHeaderTitle, displayMunicipality, cityName, printItems.length);
          const shouldShowSignaturesHere = showSignatures && (signaturesPage === 'all' || isLastPage);

          // Calculate dynamic spacing & enlarged font sizes for signatures
          const rowsOnPage = chunk.length;
          const baseSigFontSize = signaturesFontSize || 16;
          const sigFontSize = `${baseSigFontSize}px`;
          const sigNameFontSize = `${Math.max(12, baseSigFontSize - 2.5)}px`;
          const sigLineWidth = `${Math.max(175, baseSigFontSize * 11.5)}px`;

          let sigMarginTop = rowsOnPage >= 17 ? '2mm' : (rowsOnPage >= 14 ? '4mm' : '7mm');
          let sigPaddingTop = rowsOnPage >= 17 ? '1.5mm' : (rowsOnPage >= 14 ? '3mm' : '6mm');
          let sigGap = rowsOnPage >= 17 ? '3.5mm' : '5.5mm';

          const activeSigners = signersList.filter(s => s.enabled && s.title.trim());
          const topSigners = activeSigners.filter(s => s.position === 'right' || s.position === 'left');
          const centerSigners = activeSigners.filter(s => s.position === 'center');

          pages.push(`
          <div class="page summary-page">
            <div class="summary-inner">
              <h2 class="summary-title">
                ${resolvedTitle}
                ${totalSummaryPages > 1 ? `<span style="font-size:14px;font-weight:500;margin-right:8px;color:#555;">(صفحة ${pIdx + 1} من ${totalSummaryPages})</span>` : ''}
              </h2>
              <table class="summary-table">
                <thead>
                  <tr>
                    <th style="width:${indexWidth}mm;">#</th>
                    <th style="width:${locWidth}mm;">الموقع</th>
                    <th style="width:${landmarkWidth}mm;">أقرب نقطة</th>
                    <th style="width:${sizeWidth}mm;">المقاس</th>
                    ${showFacesCol ? `<th style="width:${facesWidth}mm;">الأوجه</th>` : ''}
                    <th style="width:${coordsWidth}mm;">الإحداثيات</th>
                    ${showStatusInPrint ? `<th style="width:${statusWidth}mm;">الحالة</th>` : ''}
                    <th class="qr-col-cell" style="width:${qrWidth}mm !important;">QR</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml}
                </tbody>
                ${tableFooterHtml}
              </table>

              ${shouldShowSignaturesHere && activeSigners.length > 0 ? `
              <div class="summary-signatures-wrapper">
                ${topSigners.length > 0 ? `
                <div class="signatures-row-top" style="display: flex; justify-content: ${topSigners.length === 1 ? 'center' : 'space-between'}; align-items: flex-start; width: 100%; padding: 0 6mm; box-sizing: border-box;">
                  ${topSigners.map(s => `
                    <div class="sig-block" style="display: flex; flex-direction: column; align-items: center; text-align: center; min-width: 50mm; max-width: 80mm;">
                      <div class="sig-title" style="font-size: ${sigFontSize}; font-weight: 800; color: #000; margin-bottom: 3px; white-space: nowrap; font-family: 'Doran', 'Noto Sans Arabic', sans-serif;">${s.title}</div>
                      ${s.name ? `<div class="sig-name" style="font-size: ${sigNameFontSize}; font-weight: 700; color: #222; margin-bottom: 2px; font-family: 'Doran', 'Noto Sans Arabic', sans-serif;">${s.name}</div>` : ''}
                      <div class="sig-dot-line" style="width: ${sigLineWidth}; border-bottom: 2px dotted #000; margin-top: 6px; height: 1px;"></div>
                    </div>
                  `).join('')}
                </div>
                ` : ''}
                
                ${centerSigners.length > 0 ? `
                <div class="signatures-row-bottom" style="display: flex; justify-content: center; align-items: center; width: 100%; gap: 15mm;">
                  ${centerSigners.map(s => `
                    <div class="sig-block" style="display: flex; flex-direction: column; align-items: center; text-align: center; min-width: 50mm; max-width: 80mm;">
                      <div class="sig-title" style="font-size: ${sigFontSize}; font-weight: 800; color: #000; margin-bottom: 3px; white-space: nowrap; font-family: 'Doran', 'Noto Sans Arabic', sans-serif;">${s.title}</div>
                      ${s.name ? `<div class="sig-name" style="font-size: ${sigNameFontSize}; font-weight: 700; color: #222; margin-bottom: 2px; font-family: 'Doran', 'Noto Sans Arabic', sans-serif;">${s.name}</div>` : ''}
                      <div class="sig-dot-line" style="width: ${sigLineWidth}; border-bottom: 2px dotted #000; margin-top: 6px; height: 1px;"></div>
                    </div>
                  `).join('')}
                </div>
                ` : ''}
              </div>
              ` : ''}
            </div>
            <style>
              .summary-page { padding: 0 !important; background: #fff !important; width: 210mm !important; height: 297mm !important; overflow: hidden !important; page-break-after: always !important; page-break-inside: avoid !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .summary-inner { padding: 8mm 10mm 6mm 10mm; box-sizing: border-box; width: 100%; height: 100%; overflow: hidden; display:flex; flex-direction:column; justify-content:flex-start; align-items:stretch; gap:3.5mm; }
              .summary-title { text-align:center; font-family:'Doran'; font-size:20px; margin:0; color:#000; letter-spacing:0.5px; font-weight:800; flex:0 0 auto; }
              .summary-table { width:190mm !important; border-collapse:separate; border-spacing:0; font-family:'Doran'; border:1px solid #000; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; table-layout:fixed; }
              .summary-table thead tr { background:#000 !important; color:#fff !important; }
              .summary-table thead { display: table-header-group; }
              .summary-table thead th { background:#000 !important; color:#fff !important; font-size:13px; padding:6px 5px; border-bottom:1px solid #000; border-right:1px solid #333; font-weight:700; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .summary-table thead th:first-child { border-right:none; }
              .summary-table thead th.qr-col-cell { width: ${rowHeight} !important; padding: 0 !important; text-align: center; }
              .summary-table tbody tr { height: ${rowHeight}; background:#ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; page-break-inside: avoid; }
              .summary-table tbody td { padding:${rowPadding}; font-size:${rowFontSize}; border-bottom:1px solid #ccc; border-right:1px solid #ccc; text-align:center; color:#000; vertical-align:middle; line-height:1.45 !important; }
              .summary-table tbody td:first-child { border-right:none; }
              .summary-table tbody td.loc { text-align:right; padding-right:8px; padding-left:8px; word-break:break-word; line-height:1.45 !important; }
              .summary-table tbody td.num { font-family: '${s.coords_font_family || 'Manrope'}', sans-serif; font-weight: 600; }
              .summary-table tbody td.coords { direction:ltr; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif; font-size:${compactSummary ? '9px' : '9.5px'}; letter-spacing:0.1px; word-break:break-all; white-space:normal; font-weight: 600; line-height:1.35; }
              .summary-table tbody td.qr-col-cell { width: ${rowHeight} !important; height: ${rowHeight} !important; padding: 0 !important; vertical-align: middle; text-align: center; }
              .summary-table tbody tr:nth-child(even) { background:#f0f0f0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .summary-table tbody tr:nth-child(even) td { background:#f0f0f0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .summary-table tbody tr:last-child td { border-bottom:none; }
              .summary-table { page-break-inside: avoid; }

              /* Signatures Section Styling */
              .summary-signatures-wrapper {
                margin-top: ${sigMarginTop};
                padding-top: ${sigPaddingTop};
                padding-bottom: 0mm;
                width: 100%;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                gap: ${sigGap};
                font-family: 'Doran', 'Noto Sans Arabic', sans-serif;
                page-break-inside: avoid;
                flex-shrink: 0;
              }

              @media print {
                .summary-page { padding: 0 !important; width: 210mm !important; height: 297mm !important; overflow: hidden !important; }
                .summary-inner { padding: 8mm 10mm 6mm 10mm !important; }
              }
            </style>
          </div>
          `);
        }
      }

      // ── Normalize all image URLs for the print popup ──────────────────────
      // lh3.googleusercontent.com URLs work fine as <img src> but CANNOT be
      // fetched with credentials (CORS wildcard restriction). The popup window
      // (about:blank) can load them directly as <img> tags since they are
      // public URLs — no preloading needed, just ensure normalized form.
      const _blobUrls: string[] = []; // kept for API compat with cleanup code below

      const resolveImg = (url: string | null | undefined): string => {
        if (!url) return '';
        return normalizeGoogleImageUrl(url);
      };
      // ─────────────────────────────────────────────────────────────────────

      for (const item of printItems) {
        const qrInfo = qrCodes.get(item.sequence_number);
        const qrContent = qrInfo?.content || '';
        const qrDataUrl = qrInfo?.dataUrl || '';
        const coords = item.latitude && item.longitude ? `${item.latitude},${item.longitude}` : '';

        const hasDesign = item.design_face_a || item.design_face_b;
        const mainImage = item.image_url || '';

        const pinColor = (s as any).pin_color?.trim() || undefined;
        const pinTextColor = (s as any).pin_text_color?.trim() || undefined;
        const printedSize = formatSizeForPrint(item.size, showHeightInPrint);
        const pinData = createPinSvgUrl(printedSize || 'متاحة', item.status || 'متاحة', false, undefined, undefined, pinColor, pinTextColor, undefined, undefined, undefined, undefined, true);
        const customPinUrl = (s as any).custom_pin_url?.trim();
        const pinSvgDataUrl = customPinUrl || pinData.url;

        let imageSectionHtml = '';

        if (printImageSource === 'map_pin' || printImageSource === 'map_only') {
          if (coords) {
            const [lat, lng] = coords.split(',').map(c => c.trim());
            const mapDataUrl = mapImages.get(item.sequence_number) || '';
            // Use pre-captured static image instead of live Google Map
            // ✅ في وضع "خريطة فقط" نتجاهل صورة اللوحة الفعلية
            const hasUploadedImage = printImageSource === 'map_pin' && !!item.image_url;
            // The printed pin must anchor by its real SVG tip, not by the image bounds.
            const pinWidth = parseInt(String(s.pin_size || '80')) || 80;
            const pinTipOffsetPercent = customPinUrl ? 100 : (pinData.anchorY / pinData.height) * 100;
            const mapBlockHtml = `
              <div style="width: 100%; height: 100%; position: relative; overflow: hidden;">
                ${mapDataUrl
                  ? `<img src="${mapDataUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />`
                  : `<div style="width: 100%; height: 100%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #666;">لا تتوفر خريطة</div>`
                }
                <img src="${pinSvgDataUrl}" alt="دبوس" style="position: absolute; left: 50%; top: 50%; width: ${pinWidth}px; height: auto; transform: translate(-50%, -${pinTipOffsetPercent}%); pointer-events: none; z-index: 10;" />
              </div>
            `;
            imageSectionHtml = `
              <div style="
                position: absolute; top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%);
                width: ${s.main_image_width}; height: ${s.main_image_height};
                border: 2px solid #ccc; border-radius: 8px;
                overflow: hidden; z-index: 5;
                display: flex; flex-direction: column;
              ">
                ${(hasUploadedImage && (item.overlay_config?.show_image !== false)) ? (() => {
                  const ov = item.overlay_config;
                  const sizeKey = String(item.size || '').trim();
                  const sizeCutoutUrl = sizeCutoutMap[sizeKey] || sizeCutoutMap[sizeKey.replace(/×/g, 'x').replace(/X/g, 'x')] || null;
                  const activeCutout = ov?.cutout_image_url || sizeCutoutUrl || null;
                  const isOverlayActive = (ov?.enabled !== false);
                  const isCutoutPresent = !!activeCutout;
                  const x = ov?.x_pct ?? 50;
                  const y = ov?.y_pct ?? 50;
                  const scale = (ov?.scale_pct ?? 100) / 100;
                  const rot = ov?.rotation_deg ?? 0;
                  const cropBottom = ov?.crop_bottom_pct || 0;
                  const dims = parseSizeDimensions(item.size);
                  const isV2 = ov?.anchor_version === 'v2';
                  const translateY = isV2 ? '-100%' : '-50%';
                  const transformOrigin = isV2 ? 'bottom center' : 'center center';

                  return `
                    <div class="overlay-container" style="position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background: #fafafa; border-bottom: 1px solid #ddd; flex-shrink: 0;">
                      <img src="${resolveImg(item.image_url)}" alt="صورة اللوحة" class="billboard-image" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
                      ${isOverlayActive ? (isCutoutPresent ? `
                        <img src="${resolveImg(activeCutout)}" class="overlay-cutout" data-x="${x}" data-y="${y}" data-scale="${scale}" data-rot="${rot}" data-anchor="${isV2 ? 'v2' : 'v1'}" style="
                          position: absolute;
                          left: ${x}%;
                          top: ${y}%;
                          width: 27.15%;
                          min-width: 40px;
                          height: auto;
                          display: block;
                          transform: translate(-50%, ${translateY}) scale(${scale}) rotate(${rot}deg);
                          transform-origin: ${transformOrigin};
                          clip-path: inset(0 0 ${cropBottom}% 0);
                          -webkit-clip-path: inset(0 0 ${cropBottom}% 0);
                          z-index: 10;
                        " />
                      ` : `
                        <div class="overlay-cutout" data-x="${x}" data-y="${y}" data-scale="${scale}" data-rot="${rot}" data-anchor="${isV2 ? 'v2' : 'v1'}" style="position: absolute; left: ${x}%; top: ${y}%; transform: translate(-50%, ${translateY}) scale(${scale}) rotate(${rot}deg); transform-origin: ${transformOrigin}; clip-path: inset(0 0 ${cropBottom}% 0); -webkit-clip-path: inset(0 0 ${cropBottom}% 0); z-index: 10; display: flex; flex-direction: column; align-items: center;">
                          <div style="background: linear-gradient(135deg, #b45309, #1e293b); border: 2.5px solid #f59e0b; color: #fff; padding: 5px 10px; border-radius: 10px; font-weight: bold; font-size: 10px; text-align: center; box-shadow: 0 8px 20px rgba(0,0,0,0.8); width: ${Math.max(110, 80 * dims.ratio)}px; height: 70px; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: Tajawal, sans-serif;">
                            <span style="font-size: 10px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${item.billboard_name || `لوحة #${item.sequence_number}`}</span>
                            <span style="font-size: 8px; color: #f59e0b; margin-top: 2px;">${item.size}</span>
                          </div>
                          <div style="width: 6px; height: 40px; background: linear-gradient(to bottom, #cbd5e1, #475569); box-shadow: 0 4px 8px rgba(0,0,0,0.4);" />
                          <div style="width: 24px; height: 2px; background: #0f172a;" />
                        </div>
                      `) : ''}
                    </div>
                    <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
                      ${mapBlockHtml}
                    </div>
                  `;
                })() : `
                  <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
                    ${mapBlockHtml}
                  </div>
                `}
                <div style="height: ${s.coords_bar_height || '26px'}; background: rgba(255,255,255,0.95); display: flex; align-items: center; justify-content: center; z-index: 12; border-top: 1px solid #ddd; flex-shrink: 0;">
                  <span style="font-size: ${s.coords_font_size || '11px'}; font-weight: 700; color: #222; direction: ltr; font-family: '${s.coords_font_family || 'Manrope'}-Bold', '${s.coords_font_family || 'Manrope'}', monospace; letter-spacing: 0.5px;">${lat}, ${lng}</span>
                </div>
              </div>
            `;
          } else {
            imageSectionHtml = `
              <div style="
                position: absolute; top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%);
                width: ${s.main_image_width}; height: ${s.main_image_height};
                border: 2px solid #e0e0e0; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                background: linear-gradient(145deg, #f0f4f8, #e2e8f0);
                flex-direction: column; gap: 6px; z-index: 5;
              ">
                <img src="${pinSvgDataUrl}" alt="دبوس" style="width: 80px; height: auto;" />
                <div style="font-size: 14px; font-weight: 700; color: #333;">لا توجد إحداثيات</div>
              </div>
            `;
          }
        } else {
          if (hasDesign) {
            imageSectionHtml = '';
          } else if (mainImage) {
            imageSectionHtml = `
              <div class="absolute-field" style="top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%); width: ${s.main_image_width}; height: ${s.main_image_height}; overflow: hidden; border: 3px solid #000; border-radius: 0 0 0 8px; z-index: 5;">
                <img src="${mainImage}" alt="" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>
            `;
          } else if (coords) {
            imageSectionHtml = `
              <div style="
                position: absolute; top: ${s.main_image_top}; left: ${s.main_image_left}; transform: translateX(-50%);
                width: ${s.main_image_width}; height: ${s.main_image_height};
                border: 3px solid #000; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                background: #f5f5f5; flex-direction: column; gap: 8px; z-index: 5;
              ">
                <div style="font-size: 14px; font-weight: 700; color: #333;">الإحداثيات</div>
                <div style="font-size: 18px; font-weight: 700; color: #000; direction: ltr; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif;">${coords}</div>
                <div style="font-size: 12px; color: #666; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif;">المقاس: ${formatSizeForPrint(item.size, showHeightInPrint)}</div>
              </div>
            `;
          }
        }

        const statusHtml = showStatusInPrint && item.status
          ? `<span class="mb-status" style="font-size: ${effectiveStatusPosition === 'custom' ? effectiveStatusFontSize : '14px'}; font-weight: 700; color: ${effectiveStatusPosition === 'custom' ? effectiveStatusColor : '#000'};">${item.status}</span>`
          : '';
        const statusAbove = effectiveStatusPosition === 'above_number' ? `<div style="margin-bottom: ${effectiveStatusGap} !important; display:block;">${statusHtml}</div>` : '';
        const statusBelow = effectiveStatusPosition === 'below_number' ? `<div style="margin-top: ${effectiveStatusGap} !important; display:block;">${statusHtml}</div>` : '';
        const statusBeside = effectiveStatusPosition === 'beside_number' ? `<span style="margin-right: ${effectiveStatusGap} !important; display:inline-block;">${statusHtml}</span>` : '';
        const statusHeader = effectiveStatusPosition === 'header' && statusHtml
          ? `<div class="absolute-field" style="top: ${effectiveStatusGap}; left: 50%; transform: translateX(-50%); text-align:center; z-index: 50;">${statusHtml}</div>` : '';
        const statusFooter = effectiveStatusPosition === 'footer' && statusHtml
          ? `<div class="absolute-field" style="bottom: ${effectiveStatusGap}; left: 50%; transform: translateX(-50%); text-align:center; z-index: 50;">${statusHtml}</div>` : '';
        const statusCustom = effectiveStatusPosition === 'custom' && statusHtml
          ? `<div class="absolute-field" style="top: ${effectiveStatusTop}; left: ${effectiveStatusLeft}; transform: translateX(-50%); text-align:center; z-index: 50;">${statusHtml}</div>` : '';

        pages.push(`
          <div class="page">
            <div class="background"></div>
            ${statusHeader}

            <div class="absolute-field" style="top: ${s.billboard_name_top}; left: ${s.billboard_name_left}; transform: translateX(-50%); width: 120mm; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: ${s.billboard_name_font_size || '32px'}; font-weight: ${s.billboard_name_font_weight || '700'}; color: ${s.billboard_name_color || '#000'}; line-height: 1; z-index: 5;">
              ${statusAbove}
              <div style="font-family: '${s.coords_font_family || 'Manrope'}', sans-serif;">${String(item.sequence_number).padStart(2, '0')}${statusBeside}</div>
              ${statusBelow}
            </div>
            ${statusFooter}
            ${statusCustom}

            <div class="absolute-field" style="top: ${s.size_top}; left: ${s.size_left}; transform: translateX(-50%); width: 70mm; display: flex; align-items: center; justify-content: center; text-align: center; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight || '500'}; color: ${s.size_color}; z-index: 5; margin: 0; padding: 0;">
              ${generatePrintedSizeHtml(item.size, showHeightInPrint, (s as any).show_size_dimension_labels === 'true')}
            </div>

            ${s.faces_count_show !== 'false' ? `
            <div class="absolute-field" style="top: ${s.faces_count_top || `calc(${s.size_top} + 12mm)`}; left: ${s.size_left}; transform: translateX(-50%); width: 70mm; display: flex; align-items: center; justify-content: center; text-align: center; font-size: ${s.faces_count_font_size}; font-weight: ${(s as any).faces_count_font_weight || '700'}; color: ${s.faces_count_color || '#000000'}; font-family: '${(s as any).faces_count_font_family || s.coords_font_family || 'Doran'}', sans-serif; z-index: 5; margin: 0; padding: 0; line-height: 1;">
              ${(!item.faces_count || item.faces_count === 'وجهين' || item.faces_count === '2' || item.faces_count === 2) ? 'وجهين' : 'وجه واحد'}
            </div>
            ` : ''}

            ${imageSectionHtml}

            <div class="absolute-field" style="top: ${s.location_info_top}; left: ${s.location_info_left}; width: ${s.location_info_width}; font-size: ${s.location_info_font_size}; z-index: 5;">
              ${displayMunicipality ? displayMunicipality + ' - ' : ''}${item.location_text || '—'}
            </div>

            <div class="absolute-field" style="top: ${s.landmark_info_top}; left: ${s.landmark_info_left}; width: ${s.landmark_info_width}; font-size: ${s.landmark_info_font_size}; z-index: 5;">
              ${item.nearest_landmark || '—'}
            </div>

            ${qrDataUrl ? `
              <div class="absolute-field" style="top: ${s.qr_top}; left: ${s.qr_left}; width: ${s.qr_size}; text-align: center; z-index: 5;">
                <a href="${qrContent}" target="_blank" style="display: inline-block; cursor: pointer;">
                  <img src="${qrDataUrl}" alt="QR" style="width: ${s.qr_size}; height: ${s.qr_size}; object-fit: contain;" />
                </a>
              </div>
            ` : ''}

            ${hasDesign && printImageSource === 'actual_image' ? `
              <div class="absolute-field" style="top: ${s.designs_top}; left: ${s.designs_left}; width: ${s.designs_width}; display: flex; gap: ${s.designs_gap}; z-index: 5;">
                ${item.design_face_a ? `
                  <div style="flex: 1; text-align: center;">
                    <div style="font-size: 13px; font-weight: 500; margin-bottom: 4px; color: #333;">التصميم - الوجه الأمامي</div>
                    <img src="${resolveImg(item.design_face_a)}" alt="" style="width: 100%; max-height: ${s.design_image_height}; object-fit: contain; border: 1px solid #ddd; border-radius: 4px;" />
                  </div>
                ` : ''}
                ${item.design_face_b ? `
                  <div style="flex: 1; text-align: center;">
                    <div style="font-size: 13px; font-weight: 500; margin-bottom: 4px; color: #333;">التصميم - الوجه الخلفي</div>
                    <img src="${resolveImg(item.design_face_b)}" alt="" style="width: 100%; max-height: ${s.design_image_height}; object-fit: contain; border: 1px solid #ddd; border-radius: 4px;" />
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        `);
      }

      const bUrl = window.location.origin;
      const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <title>${collectionName} - ${printItems.length} لوحة</title>
          <style>
            @font-face { font-family: 'Manrope'; src: url('${bUrl}/Manrope-Medium.otf') format('opentype'); font-weight: 500; }
            @font-face { font-family: 'Manrope-Bold'; src: url('${bUrl}/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
            @font-face { font-family: 'Doran'; src: url('${bUrl}/Doran-Medium.otf') format('opentype'); font-weight: 500; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: 210mm; margin: 0 auto; padding: 0; background: white; }
            body { font-family: 'Doran', Arial, sans-serif; direction: rtl; color: #000; }
            .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; page-break-inside: avoid; }
            .page:last-child { page-break-after: auto; }
            .background { position: absolute; top: 0; left: 0; width: 210mm; height: 297mm; background-image: url('${customBackgroundUrl}'); background-size: 210mm 297mm; background-repeat: no-repeat; z-index: 0; }
            .absolute-field { position: absolute; color: #000; }
            .print-size-container { display: inline-flex; align-items: center; justify-content: center; gap: 0.12em; direction: rtl; color: inherit; }
            .print-dim-col { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; color: inherit; }
            .print-dim-label { font-size: 0.45em; font-weight: 700; opacity: 1; margin-bottom: 2px; letter-spacing: 0.5px; color: inherit; }
            .print-dim-value { font-size: 1em; font-weight: 700; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif; color: inherit; }
            .print-dim-separator { font-size: 0.65em; opacity: 1; margin-top: 0.25em; font-weight: 700; font-family: '${s.coords_font_family || 'Manrope'}', sans-serif; color: inherit; }
            @page { size: 210mm 297mm; margin: 0; }
            @media print {
              html, body { width: 210mm !important; margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .page { width: 210mm !important; height: 297mm !important; page-break-after: always !important; page-break-inside: avoid !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; }
              .page:last-child { page-break-after: auto !important; }
              @page { size: 210mm 297mm; margin: 0; }
            }
            @media screen { body { background: #f0f0f0; } .page { margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.2); } }
          </style>
        </head>
        <body>${pages.join('\n')}
        <script>
          function adjustOverlayPositions() {
            var containers = document.querySelectorAll('.overlay-container');
            containers.forEach(function(container) {
              var bgImg = container.querySelector('.billboard-image');
              var cutoutImg = container.querySelector('.overlay-cutout');
              if (!bgImg || !cutoutImg) return;

              var cw = container.clientWidth;
              var ch = container.clientHeight;
              var nw = bgImg.naturalWidth;
              var nh = bgImg.naturalHeight;
              if (!cw || !ch || !nw || !nh) return;

              var imgRatio = nw / nh;
              var boxRatio = cw / ch;

              var renderW = cw;
              var renderH = ch;
              var renderLeft = 0;
              var renderTop = 0;

              if (imgRatio > boxRatio) {
                renderH = cw / imgRatio;
                renderTop = (ch - renderH) / 2;
              } else {
                renderW = ch * imgRatio;
                renderLeft = (cw - renderW) / 2;
              }

              var xPct = parseFloat(cutoutImg.getAttribute('data-x') || '50');
              var yPct = parseFloat(cutoutImg.getAttribute('data-y') || '50');
              var scale = parseFloat(cutoutImg.getAttribute('data-scale') || '1');
              var rot = parseFloat(cutoutImg.getAttribute('data-rot') || '0');
              var isV2 = cutoutImg.getAttribute('data-anchor') === 'v2';

              var overlayLeftPx = renderLeft + (xPct / 100) * renderW;
              var overlayTopPx = renderTop + (yPct / 100) * renderH;
              var overlayWidthPx = (27.15 / 100) * renderW;

              var translateY = isV2 ? '-100%' : '-50%';
              var transformOrigin = isV2 ? 'bottom center' : 'center center';

              cutoutImg.style.left = overlayLeftPx + 'px';
              cutoutImg.style.top = overlayTopPx + 'px';
              cutoutImg.style.width = overlayWidthPx + 'px';
              cutoutImg.style.transform = 'translate(-50%, ' + translateY + ') scale(' + scale + ') rotate(' + rot + 'deg)';
              cutoutImg.style.transformOrigin = transformOrigin;
            });
          }

          function printWhenLoaded() {
            var images = Array.from(document.querySelectorAll('img'));
            var loaded = 0;
            var total = images.length;
            if (total === 0) {
              adjustOverlayPositions();
              setTimeout(function() { window.print(); }, 300);
              return;
            }
            function onDone() {
              loaded++;
              if (loaded >= total) {
                adjustOverlayPositions();
                setTimeout(function() { window.print(); }, 400);
              }
            }
            images.forEach(function(img) {
              if (img.complete && img.naturalWidth !== 0) {
                onDone();
              } else {
                img.addEventListener('load', onDone);
                img.addEventListener('error', onDone);
              }
            });
          }
          if (document.readyState === 'complete') {
            printWhenLoaded();
          } else {
            window.addEventListener('load', printWhenLoaded);
          }
        </script></body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        toast.success(`تم تحضير ${printItems.length} صفحة للطباعة`);
        // Clean up blob URLs after a delay to allow the popup to load them
        setTimeout(() => {
          _blobUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
        }, 30000);
      } else {
        _blobUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
        toast.error('لم يتم فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة (Popups) في المتصفح');
      }
    } catch (e: any) {
      console.error('[handlePrint] failed:', e?.message || e);
      toast.error(`فشل في الطباعة: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setPrintLoading(false);
      setShowPrintDialog(false);
    }
  };

  // ============ EXPORT TO EXCEL (same layout as print summary table + all display columns) ============
  const handleExportExcel = () => {
    if (currentCollection.items.length === 0) {
      toast.error('لا توجد لوحات للتصدير');
      return;
    }
    try {
      const items = [...currentCollection.items].sort((a, b) => a.sequence_number - b.sequence_number);
      const displayMunicipality = municipalityName || collectionName || 'لوحات البلدية';
      const headers = [
        '#',
        'الموقع / اسم اللوحة',
        'البلدية',
        'أقرب نقطة دالة',
        'المقاس',
        'الأوجه',
        'الإحداثيات',
        'حالة اللوحة',
        'رابط الصورة',
      ];
      const rows = items.map(it => [
        it.sequence_number,
        it.location_text || it.billboard_name || '',
        it.municipality || '',
        it.nearest_landmark || '',
        formatSizeForPrint(it.size, showHeightInPrint) || '',
        it.faces_count || '',
        it.latitude && it.longitude ? `${it.latitude}, ${it.longitude}` : '',
        it.status || '',
        it.image_url || '',
      ]);
      const aoa = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Column widths matching the printed summary proportions + extra columns
      ws['!cols'] = [
        { wch: 5 },   // #
        { wch: 32 },  // location
        { wch: 18 },  // municipality
        { wch: 32 },  // landmark
        { wch: 14 },  // size
        { wch: 8 },   // faces
        { wch: 24 },  // coords
        { wch: 14 },  // status
        { wch: 40 },  // image url
      ];
      // RTL view
      (ws as any)['!sheetView'] = [{ rightToLeft: true }];
      // Freeze header row
      ws['!freeze'] = { xSplit: 0, ySplit: 1 } as any;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'لوحات البلدية');
      const fileName = `لوحات-${displayMunicipality}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`تم تصدير ${items.length} لوحة`);
    } catch (e) {
      console.error(e);
      toast.error('فشل تصدير ملف Excel');
    }
  };

  return (
    <div className="min-h-screen bg-background relative pb-20 selection:bg-indigo-500/30">
      {/* Ambient decorative glows */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[450px] h-[450px] bg-purple-500/5 rounded-full blur-[130px] pointer-events-none" />

      {/* ─── Header ─── */}
      <div className="sticky top-0 z-40 w-full border-b border-border/10 bg-background/90 backdrop-blur-xl shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {/* Top row: title + save/new/open */}
          <div className="flex items-center justify-between py-3 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">تنظيم لوحات البلدية</h1>
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5">ترتيب • تصنيف • طباعة</p>
              </div>
              {/* live counters */}
              <div className="hidden sm:flex items-center gap-2 mr-1">
                <div className="flex items-center gap-1.5 bg-indigo-500/8 border border-indigo-500/15 rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  {currentCollection.items.length} لوحة
                </div>
                {currentCollection.items.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {totalAreaMeters.toLocaleString('en-US', { maximumFractionDigits: 1 })} م²
                  </div>
                )}
              </div>
            </div>

            {/* Right actions: file ops + print */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={handleNewProject}>
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">جديد</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => setShowCollectionsDialog(true)}>
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">المحفوظات</span>
              </Button>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 border-border/20" onClick={saveCollection} disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                {saving ? 'حفظ...' : 'حفظ'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs gap-1.5 border-indigo-500/20 bg-indigo-500/8 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 font-medium"
                onClick={() => {
                  if (currentCollection.items.length === 0) {
                    toast.error('أضف لوحات أولاً لحفظ نسخة');
                    return;
                  }
                  setSaveAsCopyName(collectionName ? `${collectionName} - نسخة` : 'قائمة جديدة');
                  setShowSaveAsCopyDialog(true);
                }}
                disabled={currentCollection.items.length === 0 || isSavingAsCopy}
                title="حفظ اللوحات الحالية كقائمة جديدة منفصلة باسم جديد"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">حفظ كنسخة</span>
              </Button>
              <div className="w-px h-5 bg-border/30 mx-1 hidden sm:block" />
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs gap-1.5 border-amber-500/20 bg-amber-500/8 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15" onClick={() => printStickers(currentCollection.items, stickerSettings, municipalityName)} disabled={currentCollection.items.length === 0}>
                <Sticker className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ملصقات</span>
              </Button>
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs gap-1.5 border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15" onClick={handleExportExcel} disabled={currentCollection.items.length === 0}>
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs gap-1 border-border/20" onClick={() => setShowPrintSettings(true)}>
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="h-8 rounded-lg text-xs gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow shadow-indigo-600/20" onClick={() => { setPrintImageSource('map_pin'); setShowPrintDialog(true); }} disabled={currentCollection.items.length === 0}>
                <Printer className="h-3.5 w-3.5" />
                طباعة الكل
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
        {/* Collection name & Binding (Municipality + City + Default Size) */}
        <Card className="border border-border/15 bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-transparent opacity-70" />
          <CardHeader className="pb-3 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <Settings2 className="h-4 w-4 text-indigo-500" />
              تكوين المجموعة وربط البيانات
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">اسم المجموعة *</Label>
                <Input
                  value={collectionName}
                  onChange={e => setCollectionName(e.target.value)}
                  placeholder="مثال: قائمة يناير 2026"
                  className="h-10 rounded-xl bg-background/50 border-border/15 focus-visible:ring-indigo-500 font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">البلدية المرتبطة *</Label>
                <Select value={normalizeMuniName(municipalityName) || '__none__'} onValueChange={v => setMunicipalityName(v === '__none__' ? '' : normalizeMuniName(v))}>
                  <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/15 focus:ring-indigo-500"><SelectValue placeholder="اختر البلدية" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    <SelectItem value="__none__">— بدون —</SelectItem>
                    {municipalities.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">المدينة المرتبطة</Label>
                <Select value={cityName || '__none__'} onValueChange={handleCityChange}>
                  <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/15 focus:ring-indigo-500"><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    <SelectItem value="__none__">— بدون —</SelectItem>
                    {cities.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">المقاس الافتراضي</Label>
                <Select value={defaultSize || '__none__'} onValueChange={v => setDefaultSize(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/15 focus:ring-indigo-500"><SelectValue placeholder="اختر مقاساً" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    <SelectItem value="__none__">— بدون —</SelectItem>
                    {dbSizes.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cover Page Title & Phrase Section */}
            <div className="mt-4 pt-4 border-t border-border/10">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-6 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                      <span>العنوان المطبوع في صفحة الغلاف</span>
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      (الصفحة الأولى للمستند)
                    </span>
                  </div>
                  <Input
                    value={coverTitle}
                    onChange={e => setCoverTitle(e.target.value)}
                    placeholder={`تلقائي: ${municipalityName || collectionName || 'اسم البلدية أو المجموعة'}`}
                    className="h-10 rounded-xl bg-background/50 border-border/15 focus-visible:ring-indigo-500 font-bold"
                  />
                </div>

                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">العبارة الافتتاحية للغلاف</Label>
                  <Input
                    value={coverPhrase}
                    onChange={e => setCoverPhrase(e.target.value)}
                    placeholder="مثال: لوحات (أو مواقع لوحات...)"
                    className="h-10 rounded-xl bg-background/50 border-border/15 focus-visible:ring-indigo-500 font-medium"
                  />
                </div>

                <div className="md:col-span-3 flex items-center justify-between p-2.5 rounded-xl border border-border/15 bg-background/40 h-10">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">تفعيل الغلاف</span>
                  </div>
                  <Switch
                    checked={coverPageEnabled}
                    onCheckedChange={setCoverPageEnabled}
                  />
                </div>
              </div>

              {/* Quick variable buttons & live preview */}
              <div className="flex items-center gap-2 flex-wrap mt-2.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground">إدراج ذكي:</span>
                  <button
                    type="button"
                    onClick={() => setCoverTitle(prev => (prev ? prev + ' ' : '') + '{البلدية}')}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 border border-indigo-500/20 transition-all"
                  >
                    + {'{البلدية}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverTitle(prev => (prev ? prev + ' ' : '') + '{المدينة}')}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 border border-purple-500/20 transition-all"
                  >
                    + {'{المدينة}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverTitle(prev => (prev ? prev + ' ' : '') + '{اسم المجموعة}')}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition-all"
                  >
                    + {'{اسم المجموعة}'}
                  </button>
                </div>

                <div className="text-[10px] text-muted-foreground mr-auto flex items-center gap-1.5 bg-muted/20 px-2.5 py-1 rounded-lg border border-border/10">
                  <span className="text-amber-500 font-bold">معاينة نص الغلاف:</span>
                  <span className="text-foreground font-semibold">
                    {coverPageEnabled 
                      ? `"${coverPhrase || 'لوحات'} ${resolveCoverTitle(coverTitle, municipalityName, cityName, collectionName)}"`
                      : '(الغلاف معطّل)'}
                  </span>
                </div>
              </div>
            </div>

            {(municipalityName || cityName || defaultSize || coverTitle) && (
              <div className="flex items-center gap-2 flex-wrap mt-4 pt-3.5 border-t border-border/10">
                <span className="text-[11px] text-muted-foreground">روابط البيانات النشطة:</span>
                {municipalityName && <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 gap-1 rounded-lg"><Building2 className="h-3 w-3" />{municipalityName}</Badge>}
                {cityName && <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/10 rounded-lg">{cityName}</Badge>}
                {defaultSize && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 rounded-lg">المقاس الافتراضي: {defaultSize}</Badge>}
                {coverTitle && <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/10 rounded-lg">عنوان الغلاف: {resolveCoverTitle(coverTitle, municipalityName, cityName, collectionName)}</Badge>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Items stats */}
        {selectedItems.size > 0 && (
          <div className="border border-amber-500/30 bg-amber-500/[0.04] rounded-3xl p-5 space-y-4 animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                ملخص اللوحات المحددة ({selectedItems.size} لوحة)
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedItems(new Set())}
                className="h-8 rounded-lg text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                إلغاء التحديد
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card className="border border-amber-500/20 bg-slate-900/90 rounded-2xl shadow-sm p-4 flex flex-col justify-between">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">اللوحات المحددة</span>
                <span className="text-2xl font-black text-amber-400 mt-1">{selectedItemsStats.totalCount}</span>
                <span className="text-[10px] text-slate-400 mt-1">لوحة محددة</span>
              </Card>
              <Card className="border border-amber-500/20 bg-slate-900/90 rounded-2xl shadow-sm p-4 flex flex-col justify-between">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">مساحة المحددة</span>
                <span className="text-2xl font-black text-amber-400 mt-1">
                  {selectedItemsStats.totalArea.toLocaleString('en-US', { maximumFractionDigits: 2 })} م²
                </span>
                <span className="text-[10px] text-slate-400 mt-1">
                  {customSettings.calc_meters_by_faces === 'true' ? 'محتسباً بعدد الأوجه' : 'مساحة الوجه الواحد'}
                </span>
              </Card>
              {selectedItemsStats.sizeStats.map(stat => (
                <Card key={stat.size} className="border border-slate-800 bg-slate-900/90 rounded-2xl shadow-sm p-4 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-500/40" />
                  <span className="text-[10px] text-slate-400 font-bold truncate" title={stat.size}>{stat.size}</span>
                  <span className="text-xl font-bold text-slate-100 mt-1">{stat.count} <span className="text-xs font-normal text-slate-400">لوحات</span></span>
                  <span className="text-[11px] text-amber-400 font-semibold mt-1">
                    {stat.totalMeters.toLocaleString('en-US', { maximumFractionDigits: 2 })} م²
                  </span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ─── Action Toolbar ─── */}
        <div className="flex items-center gap-2 flex-wrap p-3 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-lg">
          {/* Group: Add/Import */}
          <div className="flex items-center gap-1.5">
            <Button
              onClick={openAddDialog}
              size="sm"
              className="h-9 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 gap-2"
            >
              <Plus className="h-4 w-4" />
              إضافة لوحة
            </Button>
            <input
              ref={batchPhotoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { handleDropOrSelectFiles(e.target.files); e.target.value = ''; }}
            />
            <Button
              onClick={() => batchPhotoInputRef.current?.click()}
              size="sm"
              variant="outline"
              className="h-9 rounded-xl border-slate-700 bg-slate-950 text-amber-400 hover:bg-slate-800 gap-1.5 font-bold"
              title="استيراد صورة ميدانية واستخراج إحداثياتها تلقائياً"
            >
              <Camera className="h-4 w-4" />
              من صورة
            </Button>
            {/* Google Maps URL add button */}
            <Button
              onClick={() => {
                const defaults = getLastItemDefaults();
                setNewItem({
                  size: defaults.size,
                  faces_count: defaults.faces_count,
                  status: defaults.status,
                  location_text: defaults.location_text,
                  nearest_landmark: defaults.nearest_landmark,
                  latitude: null,
                  longitude: null,
                  item_type: 'new',
                });
                setGoogleMapsUrl('');
                setGoogleMapsUrlError('');
                setGoogleMapsUrlLoading(false);
                setShowGoogleMapsDialog(true);
              }}
              size="sm"
              variant="outline"
              className="h-9 rounded-xl border-emerald-500/30 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/50 gap-1.5 font-bold"
              title="إضافة لوحة عبر رابط قوقل ماب — يُستخرج الإحداثي والموقع تلقائياً"
            >
              <MapPin className="h-4 w-4" />
              من قوقل ماب
            </Button>
            {/* Overlay Editor shortcut */}
            <Button
              onClick={() => {
                if (currentCollection.items.length === 0) {
                  toast.error('أضف لوحات أولاً لفتح محرر التراكب والسكيل');
                  return;
                }
                setOverlayEditorIndex(0);
                setShowOverlayEditor(true);
              }}
              size="sm"
              variant="outline"
              className="h-9 rounded-xl border-amber-500/25 bg-amber-500/8 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/40 gap-1.5 font-semibold"
              title="فتح محرر التراكب الواقعي والمقياس المرجعي لصور اللوحات"
            >
              <Sparkles className="h-4 w-4" />
              تراكب ومقياس اللوحات
            </Button>
          </div>

          <div className="w-px h-6 bg-border/30" />

          {/* Group: System import */}
          <div className="flex items-center gap-1.5">
            <Button onClick={() => setShowImportDialog(true)} variant="outline" size="sm" className="h-9 rounded-xl border-border/15 bg-background/50 hover:bg-indigo-500/5 hover:border-indigo-500/20 gap-1.5 text-xs">
              <Search className="h-3.5 w-3.5 text-indigo-500" />
              جلب لوحات موجودة
            </Button>
            <Button onClick={() => setShowMunicipalityImportDialog(true)} variant="outline" size="sm" className="h-9 rounded-xl border-border/15 bg-background/50 hover:bg-indigo-500/5 hover:border-indigo-500/20 gap-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5 text-indigo-500" />
              جلب بلدية كاملة
            </Button>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/15 bg-background/50 text-xs font-medium hover:bg-indigo-500/5 hover:border-indigo-500/20 cursor-pointer transition-colors">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                Excel
              </span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
            </label>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Group: Danger */}
          <Button onClick={clearAllItems} variant="outline" size="sm" className="h-9 rounded-xl border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 gap-1.5 text-xs">
            <Trash2 className="h-3.5 w-3.5" />
            مسح الكل
          </Button>
        </div>

        {/* Items Organizer */}
        <Card className="border border-border/15 bg-gradient-to-br from-card/50 to-card/25 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 pt-5 border-b border-border/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span>اللوحات الحالية</span>
                  <span className="text-xs text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-md">
                    {currentCollection.items.length}
                  </span>
                </CardTitle>
                {municipalityName && (
                  <Badge variant="outline" className="text-[10px] bg-indigo-500/5 text-indigo-500 border-indigo-500/10">
                    <Building2 className="h-3 w-3 ml-1" />
                    {municipalityName}
                  </Badge>
                )}
              </div>

              {/* View Switcher & Search & Bulk Status */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* View Mode Switcher */}
                <div className="bg-muted/60 p-1 rounded-xl flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    className={`h-7 px-2.5 rounded-lg text-xs gap-1.5 ${viewMode === 'table' ? 'shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setViewMode('table')}
                  >
                    <List className="h-3.5 w-3.5" />
                    جدول
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    className={`h-7 px-2.5 rounded-lg text-xs gap-1.5 ${viewMode === 'grid' ? 'shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    شبكة
                  </Button>
                </div>

                {/* Search in Items */}
                <div className="relative">
                  <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchItems}
                    onChange={e => setSearchItems(e.target.value)}
                    placeholder="بحث في القائمة..."
                    className="h-8 w-44 text-xs pr-8.5 rounded-xl border-border/15 bg-background/50 focus-visible:ring-indigo-500"
                  />
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs rounded-xl border-border/20 bg-card/45 backdrop-blur-sm hover:bg-accent gap-1"
                  disabled={currentCollection.items.length === 0}
                  onClick={() => { setBulkStatusTarget('all'); setBulkStatusValue('متاحة'); setBulkStatusCustom(''); setShowBulkStatusDialog(true); }}
                  title="تغيير حالة جميع اللوحات"
                >
                  تغيير حالة الكل
                </Button>
              </div>
            </div>

            {/* Bulk actions */}
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-3 flex-wrap mt-3.5 pt-3 border-t border-border/10">
                <Badge className="bg-indigo-500 text-white rounded-lg px-2.5 py-0.5 text-xs font-semibold">
                  {selectedItems.size} محدد
                </Badge>
                
                {/* Bulk size change */}
                <div className="flex items-center gap-1.5">
                  <Select value={bulkSize} onValueChange={setBulkSize}>
                    <SelectTrigger className="h-8 w-32 text-xs rounded-xl bg-background/50 border-border/15">
                      <SelectValue placeholder="اختر مقاس" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                      {availableSizes.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={bulkSize}
                    onChange={e => setBulkSize(e.target.value)}
                    placeholder="أو اكتب مقاس"
                    className="h-8 w-28 text-xs rounded-xl bg-background/50 border-border/15"
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl border-border/20 bg-card/45" onClick={() => {
                    if (!bulkSize) return;
                    setCurrentCollection(prev => ({
                      ...prev,
                      items: prev.items.map(item => selectedItems.has(item.sequence_number) ? { ...item, size: bulkSize } : item),
                    }));
                    toast.success(`تم تغيير مقاس ${selectedItems.size} لوحة إلى ${bulkSize}`);
                    setBulkSize('');
                  }}>
                    تطبيق المقاس
                  </Button>
                </div>

                {/* Swap 2 selected */}
                {selectedItems.size === 2 && (
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl border-border/20 bg-card/45 gap-1.5" onClick={() => {
                    const seqs = [...selectedItems];
                    setCurrentCollection(prev => {
                      const items = [...prev.items];
                      const idx1 = items.findIndex(i => i.sequence_number === seqs[0]);
                      const idx2 = items.findIndex(i => i.sequence_number === seqs[1]);
                      if (idx1 >= 0 && idx2 >= 0) {
                        const seq1 = items[idx1].sequence_number;
                        const seq2 = items[idx2].sequence_number;
                        const temp = { ...items[idx1] };
                        items[idx1] = { ...items[idx2], sequence_number: seq1 };
                        items[idx2] = { ...temp, sequence_number: seq2 };
                      }
                      return { ...prev, items };
                    });
                    setSelectedItems(new Set());
                    toast.success('تم تبديل الموقعين');
                  }}>
                    <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-500" />
                    تبديل المواقع
                  </Button>
                )}

                {/* Convert selected to official billboards */}
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  onClick={convertSelectedToOfficialBillboards}
                  title="إنشاء لوحات رسمية في قائمة اللوحات وإسناد كود لكل واحدة"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  تحويل إلى لوحات رسمية
                </Button>

                {/* Delete selected */}
                <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10 gap-1" onClick={() => {
                  setCurrentCollection(prev => {
                    const filtered = prev.items.filter(i => !selectedItems.has(i.sequence_number));
                    const reSequenced = filtered.map((item, idx) => ({ ...item, sequence_number: idx + 1 }));
                    return { ...prev, items: reSequenced };
                  });
                  toast.success(`تم حذف ${selectedItems.size} لوحة`);
                  setSelectedItems(new Set());
                }}>
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف المحدد
                </Button>

                <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl border-border/20 bg-card/45" onClick={() => { setBulkStatusTarget('selected'); setBulkStatusValue('متاحة'); setBulkStatusCustom(''); setShowBulkStatusDialog(true); }}>
                  تغيير حالة المحدد
                </Button>

                {/* Bulk faces count change */}
                <div className="flex items-center gap-1.5">
                  <Select value={bulkFacesCount} onValueChange={(v) => setBulkFacesCount(v as 'وجه' | 'وجهين')}>
                    <SelectTrigger className="h-8 w-28 text-xs rounded-xl bg-background/50 border-border/15">
                      <SelectValue placeholder="عدد الأوجه" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                      <SelectItem value="وجه" className="text-xs">وجه واحد</SelectItem>
                      <SelectItem value="وجهين" className="text-xs">وجهين</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs rounded-xl border-border/20 bg-card/45"
                    disabled={!bulkFacesCount}
                    onClick={() => {
                      if (!bulkFacesCount) return;
                      setCurrentCollection(prev => ({
                        ...prev,
                        items: prev.items.map(item =>
                          selectedItems.has(item.sequence_number) ? { ...item, faces_count: bulkFacesCount } : item
                        ),
                      }));
                      toast.success(`تم تغيير عدد الأوجه لـ ${selectedItems.size} لوحة إلى ${bulkFacesCount === 'وجه' ? 'وجه واحد' : 'وجهين'}`);
                      setBulkFacesCount('');
                    }}
                  >
                    تطبيق الأوجه
                  </Button>
                </div>

                <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl border-border/20 bg-card/45 gap-1.5" onClick={() => { setMoveSourceSeqs(Array.from(selectedItems).sort((a, b) => a - b)); setMoveTargetSeq(''); setMovePosition('above'); setShowMoveDialog(true); }}>
                  <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-500" />
                  نقل المحدد إلى رقم...
                </Button>

                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedItems(new Set())}>
                  إلغاء التحديد
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {currentCollection.items.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <MapPin className="h-14 w-14 mx-auto mb-3 opacity-20 text-indigo-500" />
                <p className="text-sm">لا توجد لوحات في هذه المجموعة حتى الآن.</p>
                <p className="text-xs text-muted-foreground mt-1">ابدأ بـ إضافة لوحة جديدة، أو جلب لوحات من النظام أو ملف Excel.</p>
              </div>
            ) : viewMode === 'table' ? (
              /* ==================== TABLE VIEW ==================== */
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/10 bg-muted/30">
                      <th className="p-3 text-center w-6"></th>
                      <th className="p-3 text-center w-8">
                        <Checkbox
                          checked={selectedItems.size === currentCollection.items.length && currentCollection.items.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedItems(new Set(currentCollection.items.map(i => i.sequence_number)));
                            } else {
                              setSelectedItems(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="p-3 text-center w-12 font-semibold">#</th>
                      <th className="p-3 text-right font-semibold">الموقع / اسم اللوحة</th>
                      <th className="p-3 text-right font-semibold">أقرب نقطة دالة</th>
                      <th className="p-3 text-center w-[220px] font-semibold">المقاس</th>
                      <th className="p-3 text-center font-semibold">الأوجه</th>
                      <th className="p-3 text-center font-semibold">الإحداثيات</th>
                      <th className="p-3 text-center w-32 font-semibold">حالة اللوحة</th>
                      <th className="p-3 text-center w-44 font-semibold">صورة اللوحة</th>
                      <th className="p-3 text-center w-40 font-semibold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map(item => (
                      <tr
                        key={item.sequence_number}
                        className={`border-b border-border/10 transition-all cursor-grab active:cursor-grabbing hover:bg-muted/10 ${selectedItems.has(item.sequence_number) ? 'bg-indigo-500/[0.03] hover:bg-indigo-500/[0.05]' : ''} ${dragItem.current === item.sequence_number ? 'opacity-40 scale-[0.99] border-dashed border-indigo-500/30' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(item.sequence_number)}
                        onDragEnter={() => handleDragEnter(item.sequence_number)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <td className="p-2 text-center text-muted-foreground">
                          <GripVertical className="h-4 w-4 mx-auto opacity-40 hover:opacity-100 transition-opacity" />
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedItems.has(item.sequence_number)}
                            onCheckedChange={(checked) => {
                              setSelectedItems(prev => {
                                const n = new Set(prev);
                                if (checked) n.add(item.sequence_number); else n.delete(item.sequence_number);
                                return n;
                              });
                            }}
                          />
                        </td>
                        <td className="p-3 text-center font-bold text-indigo-500">{item.sequence_number}</td>
                        {/* Location / Billboard Name Cell with Pencil Quick Edit */}
                        {inlineEditingCell?.seq === item.sequence_number && inlineEditingCell?.field === 'location' ? (
                          <td className="p-2" onClick={(e) => e.stopPropagation()}>
                            <Input
                              autoFocus
                              value={item.location_text || item.billboard_name || ''}
                              onChange={(e) => updateItem(item.sequence_number, { location_text: e.target.value, billboard_name: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') setInlineEditingCell(null); }}
                              onBlur={() => setInlineEditingCell(null)}
                              placeholder="اسم الموقع / الشارع..."
                              className="h-8 text-xs font-semibold rounded-lg border-indigo-500/50 bg-background focus-visible:ring-indigo-500"
                            />
                          </td>
                        ) : (
                          <td
                            className="p-3 group/cell cursor-pointer hover:bg-indigo-500/5 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setInlineEditingCell({ seq: item.sequence_number, field: 'location' }); }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground/90 text-xs">{item.location_text || item.billboard_name || '—'}</span>
                                {item.municipality && (
                                  <span className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                                    <Building2 className="h-2.5 w-2.5" />
                                    {item.municipality}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                className="opacity-0 group-hover/cell:opacity-100 p-1 text-muted-foreground hover:text-indigo-600 transition-all rounded-md hover:bg-indigo-500/10"
                                title="تعديل اسم الموقع"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}

                        {/* Nearest Landmark Cell with Pencil Quick Edit */}
                        {inlineEditingCell?.seq === item.sequence_number && inlineEditingCell?.field === 'landmark' ? (
                          <td className="p-2" onClick={(e) => e.stopPropagation()}>
                            <Input
                              autoFocus
                              value={item.nearest_landmark || ''}
                              onChange={(e) => updateItem(item.sequence_number, { nearest_landmark: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') setInlineEditingCell(null); }}
                              onBlur={() => setInlineEditingCell(null)}
                              placeholder="أقرب نقطة دالة..."
                              className="h-8 text-xs rounded-lg border-indigo-500/50 bg-background focus-visible:ring-indigo-500"
                            />
                          </td>
                        ) : (
                          <td
                            className="p-3 group/cell cursor-pointer hover:bg-indigo-500/5 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setInlineEditingCell({ seq: item.sequence_number, field: 'landmark' }); }}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">{item.nearest_landmark || '—'}</span>
                              <button
                                type="button"
                                className="opacity-0 group-hover/cell:opacity-100 p-1 text-muted-foreground hover:text-indigo-600 transition-all rounded-md hover:bg-indigo-500/10"
                                title="تعديل أقرب نقطة دالة"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <DimensionInput
                            value={item.size}
                            onChange={newSize => updateItem(item.sequence_number, { size: newSize })}
                            availableSizes={dbSizes}
                          />
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={item.faces_count || 'وجهين'}
                            onValueChange={v => updateItem(item.sequence_number, { faces_count: v })}
                          >
                            <SelectTrigger className="h-8 w-24 mx-auto rounded-lg text-xs border-border/15 bg-background/50 font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                              <SelectItem value="وجه" className="text-xs">وجه واحد</SelectItem>
                              <SelectItem value="وجهين" className="text-xs">وجهين</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-center text-[10px] font-mono text-muted-foreground" dir="ltr">
                          {item.latitude && item.longitude ? `${item.latitude?.toFixed(6)}, ${item.longitude?.toFixed(6)}` : '—'}
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <StatusQuickSelector
                            value={item.status || 'متاحة'}
                            onChange={newStatus => updateItem(item.sequence_number, { status: newStatus })}
                          />
                        </td>
                        <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="w-40 mx-auto">
                            {item.image_url ? (
                              <div className="relative group overflow-hidden rounded-lg border border-border/15 shadow-sm cursor-pointer" onClick={() => setZoomImageModalUrl(item.image_url || null)}>
                                <img
                                  src={item.image_url}
                                  alt="صورة اللوحة"
                                  className="w-full h-12.5 object-cover transition-transform duration-300 group-hover:scale-105"
                                  onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                  <Maximize2 className="h-4 w-4 text-white drop-shadow" />
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); updateItem(item.sequence_number, { image_url: null }); }}
                                  className="absolute top-1 right-1 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center shadow transition-all scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100"
                                  title="حذف الصورة"
                                >
                                  <XIcon className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <ImageUploadZone
                                value={item.image_url || ''}
                                onChange={(url) => updateItem(item.sequence_number, { image_url: url })}
                                imageName={`mb-${item.sequence_number}-${(item.billboard_name || item.location_text || 'lwh').replace(/\s+/g, '-').slice(0, 30)}`}
                                folder={`municipality-billboards/${(municipalityName || 'general').replace(/[^\w\u0600-\u06FF-]/g, '_')}/${(collectionName || 'untitled').replace(/[^\w\u0600-\u06FF-]/g, '_')}`}
                                showUrlInput={false}
                                showPreview={false}
                                label=""
                                dropZoneHeight="h-12.5"
                              />
                            )}
                          </div>
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/80" onClick={() => moveItem(item.sequence_number, 'up')} disabled={item.sequence_number === 1} title="أعلى">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/80" onClick={() => moveItem(item.sequence_number, 'down')} disabled={item.sequence_number === currentCollection.items.length} title="أسفل">
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/80" onClick={() => handleReplace(item.sequence_number)} title="استبدال">
                              <Replace className="h-3.5 w-3.5 text-indigo-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/80" onClick={() => { setMoveSourceSeqs([item.sequence_number]); setMoveTargetSeq(''); setMovePosition('above'); setShowMoveDialog(true); }} title="نقل اللوحة">
                              <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 rounded-lg ${item.overlay_config?.enabled !== false ? 'hover:bg-amber-500/10 text-amber-500' : 'hover:bg-muted text-muted-foreground line-through opacity-40'}`}
                              onClick={() => toggleItemMockup(item.sequence_number)}
                              title={item.overlay_config?.enabled !== false ? 'مجسم اللوحة: مفعل (اضغط للإلغاء)' : 'مجسم اللوحة: معطل (اضغط للتفعيل)'}
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 rounded-lg ${item.overlay_config?.show_image !== false ? 'hover:bg-blue-500/10 text-blue-500' : 'hover:bg-muted text-muted-foreground line-through opacity-40'}`}
                              onClick={() => toggleItemPhoto(item.sequence_number)}
                              title={item.overlay_config?.show_image !== false ? 'صورة اللوحة: مفعلة (اضغط للإلغاء)' : 'صورة اللوحة: معطلة (اضغط للتفعيل)'}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/80" onClick={() => setEditingItem(item)} title="تعديل">
                              <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-destructive" onClick={() => removeItem(item.sequence_number)} title="حذف">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {searchItems && sortedItems.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    لا توجد نتائج للبحث "{searchItems}"
                  </div>
                )}
              </div>
            ) : (
              /* ==================== PREMIUM CARD GRID VIEW ==================== */
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in-50 duration-200">
                  {sortedItems.map(item => (
                    <div
                      key={item.sequence_number}
                      className={`relative overflow-hidden rounded-[20px] border border-border/15 bg-gradient-to-br from-card/65 to-card/35 backdrop-blur-md p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.015] hover:border-indigo-500/20 group flex flex-col justify-between min-h-[340px] select-none ${selectedItems.has(item.sequence_number) ? 'border-indigo-500/40 ring-1 ring-indigo-500/30 shadow-indigo-500/5 bg-indigo-500/[0.015]' : ''} ${dragItem.current === item.sequence_number ? 'opacity-40 scale-[0.98] border-dashed border-indigo-500/30' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(item.sequence_number)}
                      onDragEnter={() => handleDragEnter(item.sequence_number)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      {/* Drag Grip & Checkbox top bar */}
                      <div className="flex items-center justify-between mb-3 shrink-0">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedItems.has(item.sequence_number)}
                            onCheckedChange={(checked) => {
                              setSelectedItems(prev => {
                                const n = new Set(prev);
                                if (checked) n.add(item.sequence_number); else n.delete(item.sequence_number);
                                return n;
                              });
                            }}
                            className="rounded-md border-border/20"
                          />
                          <div className="flex items-center gap-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-lg text-xs">
                            <span>#</span>
                            <span>{String(item.sequence_number).padStart(2, '0')}</span>
                          </div>
                        </div>

                        {/* Drag Handle */}
                        <div className="cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-muted/60 opacity-60 hover:opacity-100 transition-opacity">
                          <GripVertical className="h-4 w-4" />
                        </div>
                      </div>

                      {/* Image Preview / Placeholder */}
                      <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-muted/40 border border-border/10 mb-3.5 group-hover:border-indigo-500/10 transition-colors" onClick={(e) => e.stopPropagation()}>
                        {item.image_url ? (
                          <div className="relative w-full h-full cursor-pointer" onClick={() => setZoomImageModalUrl(item.image_url || null)}>
                            <img
                              src={item.image_url}
                              alt="صورة اللوحة"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                              <Maximize2 className="h-5 w-5 text-white drop-shadow" />
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); updateItem(item.sequence_number, { image_url: null }); }}
                              className="absolute top-1.5 right-1.5 bg-destructive/95 hover:bg-destructive text-white rounded-full h-6 w-6 flex items-center justify-center shadow transition-all scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 z-10"
                              title="حذف الصورة"
                            >
                              <XIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                            <ImageUploadZone
                              value={item.image_url || ''}
                              onChange={(url) => updateItem(item.sequence_number, { image_url: url })}
                              imageName={`mb-${item.sequence_number}-${(item.billboard_name || item.location_text || 'lwh').replace(/\s+/g, '-').slice(0, 30)}`}
                              folder={`municipality-billboards/${(municipalityName || 'general').replace(/[^\w\u0600-\u06FF-]/g, '_')}/${(collectionName || 'untitled').replace(/[^\w\u0600-\u06FF-]/g, '_')}`}
                              showUrlInput={false}
                              showPreview={false}
                              label="اضغط أو اسحب صورة"
                              dropZoneHeight="h-full w-full"
                            />
                          </div>
                        )}
                      </div>

                      {/* Info body */}
                      <div className="flex-1 space-y-2.5">
                        <div>
                          <div className="font-bold text-sm text-foreground/90 line-clamp-1">
                            {item.location_text || item.billboard_name || 'لوحة بدون اسم'}
                          </div>
                          {item.nearest_landmark && (
                            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {item.nearest_landmark}
                            </div>
                          )}
                        </div>

                        {/* Badges metadata */}
                        <div className="flex flex-wrap gap-1.5">
                          {item.latitude && item.longitude && (
                            <Badge variant="outline" className="text-[9px] rounded-lg px-1.5 font-mono border-border/15 bg-background/40">
                              {item.latitude?.toFixed(6)}, {item.longitude?.toFixed(6)}
                            </Badge>
                          )}
                        </div>

                        {/* Quick Overlay Toggles: Mockup & Image */}
                        <div className="flex items-center gap-1.5 pt-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleItemMockup(item.sequence_number)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              (item.overlay_config?.enabled !== false)
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-xs'
                                : 'bg-muted/40 border-border/20 text-muted-foreground line-through opacity-60'
                            }`}
                            title="تفعيل/إلغاء مجسم اللوحة في الطباعة"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>المجسم: {(item.overlay_config?.enabled !== false) ? 'مفعل' : 'معطل'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleItemPhoto(item.sequence_number)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              (item.overlay_config?.show_image !== false)
                                ? 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-xs'
                                : 'bg-muted/40 border-border/20 text-muted-foreground line-through opacity-60'
                            }`}
                            title="تفعيل/إلغاء صورة اللوحة في الطباعة"
                          >
                            <Eye className="h-3 w-3" />
                            <span>الصورة: {(item.overlay_config?.show_image !== false) ? 'مفعلة' : 'معطلة'}</span>
                          </button>
                        </div>

                        {/* Size 3D Dimension Editor */}
                        <div className="space-y-1 pt-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] text-muted-foreground font-semibold">المقاس (طول × عرض × ارتفاع)</span>
                          <DimensionInput
                            value={item.size}
                            onChange={newSize => updateItem(item.sequence_number, { size: newSize })}
                            availableSizes={dbSizes}
                            className="w-full bg-background/30"
                          />
                        </div>

                        {/* Inline controls (Faces count & status) */}
                        <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground font-semibold">الأوجه</span>
                            <Select value={item.faces_count || 'وجهين'} onValueChange={v => updateItem(item.sequence_number, { faces_count: v })}>
                              <SelectTrigger className="h-7.5 text-[11px] rounded-lg bg-background/40 border-border/15"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                                <SelectItem value="وجه" className="text-xs">وجه واحد</SelectItem>
                                <SelectItem value="وجهين" className="text-xs">وجهين</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground font-semibold">الحالة</span>
                            <StatusQuickSelector
                              value={item.status || 'متاحة'}
                              onChange={newStatus => updateItem(item.sequence_number, { status: newStatus })}
                              className="w-full justify-between h-7.5"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card actions bottom bar */}
                      <div className="flex items-center justify-between border-t border-border/10 mt-3 pt-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted/80" onClick={() => moveItem(item.sequence_number, 'up')} disabled={item.sequence_number === 1} title="أعلى">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted/80" onClick={() => moveItem(item.sequence_number, 'down')} disabled={item.sequence_number === currentCollection.items.length} title="أسفل">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted/80" onClick={() => handleReplace(item.sequence_number)} title="استبدال لوحة">
                            <Replace className="h-3.5 w-3.5 text-indigo-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted/80" onClick={() => { setMoveSourceSeqs([item.sequence_number]); setMoveTargetSeq(''); setMovePosition('above'); setShowMoveDialog(true); }} title="نقل اللوحة">
                            <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted/80" onClick={() => setEditingItem(item)} title="تعديل البيانات">
                            <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-destructive" onClick={() => removeItem(item.sequence_number)} title="حذف">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {searchItems && sortedItems.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    لا توجد نتائج للبحث "{searchItems}"
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="border border-border/15 bg-gradient-to-br from-card/50 to-card/25 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden relative">
          <CardHeader className="pb-3 pt-5 border-b border-border/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="h-4.5 w-4.5 text-indigo-500" />
                <span>خريطة توزع اللوحات</span>
                <span className="text-xs text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-md">
                  {mapBillboards.length} معرّفة الإحداثيات
                </span>
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {comparisonMunicipality && comparisonMunicipality !== 'none' && (
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse text-[10px] font-bold px-2 py-0.5 whitespace-nowrap">
                    فروقات غير متوفرة: {comparisonDifferenceCount} لوحة
                  </Badge>
                )}
                <Label htmlFor="compare-municipality" className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                  مقارنة مع بلدية:
                </Label>
                <Select
                  value={comparisonMunicipality}
                  onValueChange={setComparisonMunicipality}
                >
                  <SelectTrigger id="compare-municipality" className="h-8 rounded-lg border-border/20 bg-background/50 text-xs w-48 font-bold">
                    <SelectValue placeholder="اختر بلدية للمقارنة" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    <SelectItem value="none" className="font-bold text-xs">بدون مقارنة</SelectItem>
                    {municipalities.map(m => (
                      <SelectItem key={m} value={m} className="font-bold text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div style={{ height: '780px' }} className="rounded-b-[20px] overflow-hidden relative">
              <GoogleHomeMap
                billboards={mapBillboards}
                onMapRightClick={(lat, lng) => {
                  setNewItem({
                    size: defaultSize || '',
                    faces_count: 'وجهين',
                    location_text: '',
                    nearest_landmark: '',
                    latitude: Number(lat.toFixed(6)),
                    longitude: Number(lng.toFixed(6)),
                    item_type: 'new',
                  });
                  setShowAddDialog(true);
                }}
                onRemoveFromList={(b) => {
                  removeItem(b.ID);
                }}
                onAddToList={handleAddComparisonToList}
                onSelectionChange={setSelectedItems}
                externalSelectedIds={selectedItems}
                showStatsOverlay={true}
                calcMetersByFaces={customSettings.calc_meters_by_faces === 'true'}
                onLocationChange={handleBillboardLocationChange}
                onDeleteSelected={() => {
                  setCurrentCollection(prev => {
                    const filtered = prev.items.filter(i => !selectedItems.has(i.sequence_number));
                    const reSequenced = filtered.map((item, idx) => ({ ...item, sequence_number: idx + 1 }));
                    return { ...prev, items: reSequenced };
                  });
                  toast.success(`تم حذف ${selectedItems.size} لوحة`);
                  setSelectedItems(new Set());
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== DIALOGS ===== */}

      {/* Interactive Photo Overlay & Scale Editor */}
      <BillboardPhotoOverlayEditor
        open={showOverlayEditor}
        onOpenChange={setShowOverlayEditor}
        items={currentCollection.items}
        initialIndex={overlayEditorIndex}
        onSaveItemOverlay={handleSaveItemOverlay}
        onSaveCoordinates={handleBillboardLocationChange}
        onUpdateItemDetails={handleUpdateItemDetails}
        sizeCutoutMap={sizeCutoutMap}
        availableSizes={dbSizes}
      />

      {/* Batch Photos Import Dialog */}
      <Dialog open={showBatchImportDialog} onOpenChange={setShowBatchImportDialog}>
        <DialogContent className="max-w-md border-border/10 rounded-3xl bg-background/98 backdrop-blur-xl shadow-2xl p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-border/10 bg-gradient-to-r from-amber-500/5 to-amber-600/5">
            <DialogTitle className="font-extrabold text-base flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/10 rounded-lg">
                <Camera className="h-4 w-4 text-amber-500" />
              </div>
              <span>استيراد جماعي للصور الميدانية</span>
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground mt-1">
              تم تحديد ({batchImportFiles.length}) صورة للرفع واستخراج الإحداثيات دفعة واحدة.
            </DialogDescription>
          </div>

          <div className="px-6 py-5 space-y-4">
            {batchImporting ? (
              <div className="py-6 text-center space-y-3">
                <RefreshCw className="h-10 w-10 text-amber-500 animate-spin mx-auto" />
                <p className="text-sm font-bold text-foreground">{batchProgressMsg}</p>
                <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">تحديد مقاس موحد لجميع الصور</Label>
                  <select
                    value={batchUnifiedSize}
                    onChange={e => setBatchUnifiedSize(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border/15 bg-background/50 text-sm font-bold focus:ring-amber-500 outline-none"
                  >
                    <option value="">-- اختر المقاس --</option>
                    {dbSizes.map(sz => (
                      <option key={sz} value={sz}>{sz}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">عدد الأوجه الافتراضي</Label>
                  <select
                    value={batchFacesCount}
                    onChange={e => setBatchFacesCount(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border/15 bg-background/50 text-sm font-semibold outline-none"
                  >
                    <option value="وجهين">وجهين</option>
                    <option value="وجه واحد">وجه واحد</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">حالة اللوحات المستوردة من الصور</Label>
                  <StatusQuickSelector
                    value={batchUnifiedStatus}
                    onChange={setBatchUnifiedStatus}
                    className="w-full justify-between h-10 bg-background/50 border-border/15"
                  />
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                    سيقوم النظام بقراءة إحداثيات GPS تلقائياً من ملفات EXIF الخاصة بكل صورة لتموضعها على الخريطة، وجلب اسم المنطقة تلقائياً.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border/10 flex items-center justify-between gap-3 bg-muted/20">
            <Button
              variant="ghost"
              onClick={() => setShowBatchImportDialog(false)}
              className="rounded-xl h-10 text-muted-foreground"
              disabled={batchImporting}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleBatchPhotoImport}
              className="rounded-xl h-10 px-5 bg-amber-500 text-black hover:bg-amber-600 font-bold gap-1.5 text-xs shadow-md"
              disabled={batchImporting || batchImportFiles.length === 0}
            >
              <CheckCircle2 className="h-4 w-4" />
              بدء الاستيراد الجماعي
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Google Maps URL Billboard Dialog ─── */}
      <Dialog open={showGoogleMapsDialog} onOpenChange={(open) => {
        if (!open) { setGoogleMapsUrl(''); setGoogleMapsUrlError(''); setGoogleMapsUrlLoading(false); }
        setShowGoogleMapsDialog(open);
      }}>
        <DialogContent className="max-w-md border-border/10 rounded-3xl bg-background/98 backdrop-blur-xl shadow-2xl p-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-border/10 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
            <DialogTitle className="font-bold text-base flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                <MapPin className="h-4 w-4 text-emerald-500" />
              </div>
              إضافة لوحة من رابط قوقل ماب
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground mt-1">
              الصق رابط Google Maps لاستخراج الإحداثيات وتعبئة البيانات تلقائياً
            </DialogDescription>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* URL Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                رابط قوقل ماب
                {googleMapsUrlLoading && (
                  <span className="mr-auto text-[10px] text-emerald-500 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> جاري استخراج البيانات...
                  </span>
                )}
                {!googleMapsUrlLoading && newItem.latitude && newItem.longitude && googleMapsUrl && !googleMapsUrlError && (
                  <span className="mr-auto text-[10px] text-emerald-500 flex items-center gap-1 font-normal">
                    <CheckCircle2 className="h-3 w-3" /> تم استخراج الإحداثيات
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  dir="ltr"
                  autoFocus
                  value={googleMapsUrl}
                  onChange={e => handleGoogleMapsUrlParse(e.target.value)}
                  placeholder="https://maps.google.com/maps?q=..."
                  className={`font-mono text-xs rounded-xl border-border/15 bg-background/50 h-11 pl-9 ${
                    googleMapsUrlError ? 'border-destructive/50 bg-destructive/5' :
                    (newItem.latitude && newItem.longitude && googleMapsUrl && !googleMapsUrlError) ? 'border-emerald-500/40 bg-emerald-500/5' : ''
                  }`}
                />
                {googleMapsUrlLoading ? (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 animate-spin" />
                ) : (newItem.latitude && newItem.longitude && !googleMapsUrlError) ? (
                  <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                ) : (
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
              {googleMapsUrlError && (
                <p className="text-[11px] text-destructive flex items-center gap-1.5 bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {googleMapsUrlError}
                </p>
              )}
              {/* Instructions */}
              {!googleMapsUrl && (
                <div className="bg-muted/40 border border-border/10 rounded-xl p-3 space-y-1.5">
                  <p className="text-[11px] text-muted-foreground font-semibold">كيفية الحصول على الرابط:</p>
                  <ol className="text-[10px] text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                    <li>افتح قوقل ماب وانتقل إلى موقع اللوحة</li>
                    <li>اضغط بزر اليمين على الموقع ← نسخ الإحداثيات، أو شارك الموقع</li>
                    <li>الصق الرابط في الحقل أعلاه</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Extracted Coordinates Preview */}
            {newItem.latitude && newItem.longitude && (
              <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl p-3.5 space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  البيانات المُستخرجة
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-semibold">خط العرض (Lat)</span>
                    <div className="font-mono font-bold text-foreground">{newItem.latitude.toFixed(6)}</div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-semibold">خط الطول (Lng)</span>
                    <div className="font-mono font-bold text-foreground">{newItem.longitude.toFixed(6)}</div>
                  </div>
                  {newItem.location_text && (
                    <div className="col-span-2 space-y-0.5">
                      <span className="text-[10px] text-muted-foreground font-semibold">الموقع (مُعبَّأ تلقائياً)</span>
                      <div className="font-medium text-foreground/90">{newItem.location_text}</div>
                    </div>
                  )}
                  {newItem.nearest_landmark && (
                    <div className="col-span-2 space-y-0.5">
                      <span className="text-[10px] text-muted-foreground font-semibold">أقرب نقطة دالة</span>
                      <div className="font-medium text-foreground/90">{newItem.nearest_landmark}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Size & Faces */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">المقاس</Label>
                <Select value={dbSizes.includes(newItem.size || '') ? newItem.size : ''} onValueChange={v => setNewItem(p => ({ ...p, size: v }))}>
                  <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-9 text-xs">
                    <SelectValue placeholder="اختر مقاس" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    {dbSizes.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">عدد الأوجه</Label>
                <Select value={newItem.faces_count || 'وجهين'} onValueChange={v => setNewItem(p => ({ ...p, faces_count: v }))}>
                  <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    <SelectItem value="وجه" className="text-xs">وجه واحد</SelectItem>
                    <SelectItem value="وجهين" className="text-xs">وجهين</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Photo Zone */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-emerald-500" />
                  صورة اللوحة (اختياري)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handlePasteFromClipboard(); }}
                  className="h-6 text-[10px] rounded-lg border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 font-semibold hover:bg-emerald-500/20"
                  title="لصق صورة مباشرة من الحافظة (Ctrl + V)"
                >
                  <Clipboard className="h-3 w-3" />
                  لصق صورة (Ctrl+V)
                </Button>
              </div>

              {/* Progress Bar Indicator */}
              {(photoImportState === 'compressing' || photoImportState === 'uploading' || photoImportState === 'geocoding') && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>
                        {photoImportState === 'compressing' ? 'جاري ضغط الصورة...' :
                         photoImportState === 'uploading' ? 'جاري رفع الصورة إلى السحابة...' :
                         'استخراج بيانات الموقع...'}
                      </span>
                    </div>
                    <span className="font-mono font-bold">{photoImportProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-emerald-500/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                      style={{ width: `${photoImportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {photoImportState === 'done' && (
                <div className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  تم رفع الصورة بنجاح وحفظها
                </div>
              )}

              {photoPreviewUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-emerald-500/30 h-28 group">
                  <img src={photoPreviewUrl} alt="معاينة" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setZoomImageModalUrl(photoPreviewUrl)}
                      className="h-7 text-[11px] font-semibold gap-1 bg-white/90 text-black hover:bg-white shadow"
                    >
                      <Maximize2 className="h-3 w-3" />
                      تكبير
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setPhotoPreviewUrl(null); setPendingImageUrl(null); setPhotoImportState('idle'); }}
                      className="h-7 px-2 bg-destructive/90 hover:bg-destructive text-white rounded-md text-[11px] font-semibold flex items-center gap-1 shadow"
                    >
                      <XIcon className="h-3 w-3" />
                      حذف
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl border border-dashed border-border/30 p-3 bg-muted/20 hover:bg-muted/40 cursor-pointer flex items-center justify-center gap-2 text-xs text-muted-foreground"
                  onClick={() => photoDropRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); if (e.dataTransfer.files) handleDropOrSelectFiles(e.dataTransfer.files); }}
                >
                  <Camera className="h-4 w-4 text-emerald-500" />
                  <span>اسحب صورة هنا أو اضغط للاختيار أو <strong>Ctrl + V</strong></span>
                </div>
              )}
            </div>

            {/* Location text (editable) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                موقع اللوحة
                {googleMapsUrlLoading && <span className="mr-auto text-[10px] text-indigo-500">جاري التعبئة...</span>}
              </Label>
              <Input
                value={newItem.location_text || ''}
                onChange={e => setNewItem(p => ({ ...p, location_text: e.target.value }))}
                placeholder="مثال: طريق الشط"
                className="rounded-xl border-border/15 bg-background/50 h-9 text-sm"
              />
            </div>

            {/* Nearest landmark (editable) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">أقرب نقطة دالة</Label>
              <Input
                value={newItem.nearest_landmark || ''}
                onChange={e => setNewItem(p => ({ ...p, nearest_landmark: e.target.value }))}
                placeholder="مثال: أمام مسجد..."
                className="rounded-xl border-border/15 bg-background/50 h-9 text-sm"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/10 flex items-center justify-between gap-3 bg-muted/20">
            <Button variant="ghost" onClick={() => setShowGoogleMapsDialog(false)} className="rounded-xl h-10 text-muted-foreground">إلغاء</Button>
            <Button
              onClick={addNewItem}
              disabled={googleMapsUrlLoading}
              className="rounded-xl h-10 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow shadow-emerald-600/20 gap-2"
            >
              {googleMapsUrlLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جاري التحديد...</>
              ) : (
                <><Plus className="h-4 w-4" /> إضافة اللوحة</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add new billboard dialog */}
      {/* ─── Add Billboard Dialog (enhanced with photo import) ─── */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) { setPhotoPreviewUrl(null); setPendingImageUrl(null); setPhotoImportState('idle'); setGoogleMapsUrl(''); setGoogleMapsUrlError(''); } setShowAddDialog(open); }}>
        <DialogContent className="max-w-lg border-border/10 rounded-3xl bg-background/98 backdrop-blur-xl shadow-2xl p-0 overflow-hidden">
          {/* Dialog header strip */}
          <div className="px-6 pt-5 pb-4 border-b border-border/10 bg-gradient-to-r from-indigo-500/5 to-violet-500/5">
            <DialogTitle className="font-bold text-base flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                <MapPin className="h-4 w-4 text-indigo-500" />
              </div>
              إضافة لوحة جديدة
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground mt-1">ارفع صورة ميدانية لاستخراج الإحداثيات وتسمية الموقع تلقائياً</DialogDescription>
          </div>

          <div className="overflow-y-auto max-h-[75vh]">
            <div className="px-6 py-4 space-y-4">

              {/* ── Photo Import Zone ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-violet-500" />
                    صورة ميدانية
                    <span className="text-[10px] font-normal text-muted-foreground/60">(اختر، اسحب، أو اضغط Ctrl+V للصق)</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handlePasteFromClipboard(); }}
                    className="h-7 text-[11px] rounded-lg border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 gap-1 font-semibold hover:bg-indigo-500/20"
                    title="لصق صورة مباشرة من الحافظة"
                  >
                    <Clipboard className="h-3 w-3" />
                    لصق صورة (Ctrl+V)
                  </Button>
                </div>

                {/* Drop zone */}
                <div
                  className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 overflow-hidden cursor-pointer ${
                    photoImportState === 'done'
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : photoImportState === 'error'
                      ? 'border-destructive/40 bg-destructive/5'
                      : 'border-border/25 bg-muted/20 hover:border-indigo-500/40 hover:bg-indigo-500/5'
                  }`}
                  onClick={() => photoDropRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={e => { e.preventDefault(); if (e.dataTransfer.files) handleDropOrSelectFiles(e.dataTransfer.files); }}
                >
                  <input
                    ref={photoDropRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => { if (e.target.files) handleDropOrSelectFiles(e.target.files); e.target.value = ''; }}
                  />

                  {photoPreviewUrl ? (
                    /* Preview + status overlay */
                    <div className="relative">
                      <img src={photoPreviewUrl} alt="معاينة" className="w-full h-36 object-cover" />
                      {/* Status bar over image */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                        {photoImportState === 'compressing' && (
                          <div className="flex items-center gap-2 text-xs text-white">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>ضغط الصورة... {photoImportProgress}%</span>
                          </div>
                        )}
                        {photoImportState === 'uploading' && (
                          <div className="flex items-center gap-2 text-xs text-white">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>رفع الصورة... {photoImportProgress}%</span>
                          </div>
                        )}
                        {photoImportState === 'geocoding' && (
                          <div className="flex items-center gap-2 text-xs text-white">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>استخراج اسم الموقع...</span>
                          </div>
                        )}
                        {photoImportState === 'done' && (
                          <div className="flex items-center gap-2 text-xs text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>
 {photoExifStatus === 'found' ? 'تم استخراج الإحداثيات والموقع ' : 'تم رفع الصورة (بدون GPS)'}
                            </span>
                          </div>
                        )}
                        {photoImportState === 'error' && (
                          <div className="flex items-center gap-2 text-xs text-red-300">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>فشل رفع الصورة — تحقق من الإعدادات</span>
                          </div>
                        )}
                      </div>
                      {/* Clear button */}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setPhotoPreviewUrl(null); setPendingImageUrl(null); setPhotoImportState('idle'); }}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full h-6 w-6 flex items-center justify-center transition-colors"
                      >
                        <XIcon2 className="h-3.5 w-3.5" />
                      </button>
                      {/* EXIF badge */}
                      {photoExifStatus !== 'none' && (
                        <div className={`absolute top-2 left-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          photoExifStatus === 'found' ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'
                        }`}>
                          {photoExifStatus === 'found' ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {photoExifStatus === 'found' ? 'GPS موجود' : 'لا GPS'}
                        </div>
                      )}
                      {/* Progress bar */}
                      {(photoImportState === 'compressing' || photoImportState === 'uploading' || photoImportState === 'geocoding') && (
                        <div className="absolute inset-x-0 top-0 h-1 bg-black/20">
                          <div
                            className="h-full bg-indigo-400 transition-all duration-300 rounded-full"
                            style={{ width: `${photoImportProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Empty drop zone */
                    <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
                      <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-500">
                        <Camera className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">اسحب صورة هنا أو اضغط للاختيار</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">الصورة تُضغط لossless ثم تُرفع — إذا كانت تحتوي GPS يُعبأ الموقع تلقائياً</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Size ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>المقاس (طول × عرض × ارتفاع) *</span>
                  {defaultSize && <span className="text-[10px] text-indigo-500 font-normal">الافتراضي: {defaultSize}</span>}
                </Label>
                <div className="flex flex-col gap-2">
                  <Select value={dbSizes.includes(newItem.size || '') ? newItem.size : ''} onValueChange={v => setNewItem(p => ({ ...p, size: v }))}>
                    <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-10"><SelectValue placeholder="اختر مقاساً جاهزاً (اختياري)" /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                      {dbSizes.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <DimensionInput
                    value={newItem.size || ''}
                    onChange={newSize => setNewItem(p => ({ ...p, size: newSize }))}
                    availableSizes={dbSizes}
                    className="w-full bg-background/50"
                  />
                </div>
              </div>

              {/* ── Faces ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">عدد الأوجه</Label>
                <Select value={newItem.faces_count || 'وجهين'} onValueChange={v => setNewItem(p => ({ ...p, faces_count: v }))}>
                  <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    <SelectItem value="وجه">وجه واحد</SelectItem>
                    <SelectItem value="وجهين">وجهين</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ── Status ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">حالة اللوحة</Label>
                <StatusQuickSelector
                  value={newItem.status || 'تم التركيب'}
                  onChange={v => setNewItem(p => ({ ...p, status: v }))}
                  className="w-full justify-between h-10 bg-background/50"
                />
              </div>

              {/* ── Location text ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-indigo-500" />
                  موقع اللوحة
                  {photoImportState === 'done' && newItem.location_text && (
                    <span className="mr-auto text-[10px] text-emerald-500 font-normal flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> مُعبَّأ تلقائياً
                    </span>
                  )}
                </Label>
                <Input
                  value={newItem.location_text || ''}
                  onChange={e => setNewItem(p => ({ ...p, location_text: e.target.value }))}
                  placeholder="مثال: طريق الشط"
                  className="rounded-xl border-border/15 bg-background/50 h-10"
                />
              </div>

              {/* ── Landmark ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  أقرب نقطة دالة
                  {photoImportState === 'done' && newItem.nearest_landmark && (
                    <span className="mr-auto text-[10px] text-emerald-500 font-normal flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> مُعبَّأ تلقائياً
                    </span>
                  )}
                </Label>
                <Input
                  value={newItem.nearest_landmark || ''}
                  onChange={e => setNewItem(p => ({ ...p, nearest_landmark: e.target.value }))}
                  placeholder="مثال: وسط جسر القبة الفلكية"
                  className="rounded-xl border-border/15 bg-background/50 h-10"
                />
              </div>

              {/* ── Google Maps URL ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                  رابط قوقل ماب
                  <span className="text-[10px] font-normal text-muted-foreground/60">(الصق الرابط لاستخراج الإحداثيات تلقائياً)</span>
                  {googleMapsUrlLoading && (
                    <span className="mr-auto text-[10px] text-indigo-500 font-normal flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> جاري التحديد...
                    </span>
                  )}
                  {!googleMapsUrlLoading && newItem.latitude && newItem.longitude && googleMapsUrl && !googleMapsUrlError && (
                    <span className="mr-auto text-[10px] text-emerald-500 font-normal flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> تم استخراج الإحداثيات
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    dir="ltr"
                    value={googleMapsUrl}
                    onChange={e => handleGoogleMapsUrlParse(e.target.value)}
                    placeholder="https://maps.google.com/maps?q=... أو الصق رابط قوقل ماب"
                    className={`font-mono text-xs rounded-xl border-border/15 bg-background/50 h-10 pr-9 ${
                      googleMapsUrlError ? 'border-destructive/40 bg-destructive/5' :
                      (newItem.latitude && newItem.longitude && googleMapsUrl) ? 'border-emerald-500/30 bg-emerald-500/5' : ''
                    }`}
                  />
                  {googleMapsUrl && (
                    <button
                      type="button"
                      onClick={() => { setGoogleMapsUrl(''); setGoogleMapsUrlError(''); }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {googleMapsUrlError && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {googleMapsUrlError}
                  </p>
                )}
              </div>

              {/* ── Coordinates ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  الإحداثيات (Lat, Lng)
                  {photoExifStatus === 'found' && (
                    <span className="mr-auto text-[10px] text-emerald-500 font-normal flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> من EXIF
                    </span>
                  )}
                </Label>
                <Input
                  dir="ltr"
                  value={newItem.latitude && newItem.longitude ? `${Number(newItem.latitude.toFixed(6))}, ${Number(newItem.longitude.toFixed(6))}` : ''}
                  onChange={e => {
                    const parts = e.target.value.split(',').map(c => c.trim());
                    const parsedLat = parts[0] ? parseFloat(parts[0]) : null;
                    const parsedLng = parts[1] ? parseFloat(parts[1]) : null;
                    const lat = parsedLat !== null && !isNaN(parsedLat) ? Number(parsedLat.toFixed(6)) : null;
                    const lng = parsedLng !== null && !isNaN(parsedLng) ? Number(parsedLng.toFixed(6)) : null;
                    setNewItem(p => ({ ...p, latitude: lat, longitude: lng }));
                  }}
                  placeholder="32.901753, 13.217222"
                  className={`font-mono text-sm rounded-xl border-border/15 bg-background/50 h-10 ${
                    photoExifStatus === 'found' ? 'border-emerald-500/30 bg-emerald-500/5' : ''
                  }`}
                />
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/10 flex items-center justify-between gap-3 bg-muted/20">
            <Button variant="ghost" onClick={() => setShowAddDialog(false)} className="rounded-xl h-10 text-muted-foreground">إلغاء</Button>
            <Button
              onClick={addNewItem}
              disabled={photoImportState === 'compressing' || photoImportState === 'uploading' || photoImportState === 'geocoding'}
              className="rounded-xl h-10 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow shadow-indigo-600/20 gap-2"
            >
              {(photoImportState === 'compressing' || photoImportState === 'uploading' || photoImportState === 'geocoding') ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جاري المعالجة...</>
              ) : (
                <><Plus className="h-4 w-4" /> إضافة اللوحة</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import existing billboards dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] border-border/15 rounded-3xl bg-background/98 backdrop-blur-md flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-2 border-b border-border/10">
            <DialogTitle className="font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              <span>جلب لوحات من النظام</span>
            </DialogTitle>
            <DialogDescription className="sr-only">اختر اللوحات لجلبها من قاعدة بيانات النظام</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="relative shrink-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchBillboard} onChange={e => setSearchBillboard(e.target.value)} placeholder="بحث بالاسم أو المدينة أو المقاس أو الرقم..." className="rounded-xl border-border/15 bg-background/50 h-10 pr-9.5" />
            </div>

            {(municipalityName || cityName) && (
              <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 border border-border/10 rounded-xl text-xs shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="font-medium text-muted-foreground">الفلترة النشطة:</span>
                  {municipalityName && <Badge variant="outline" className="bg-indigo-500/5 text-indigo-500 border-indigo-500/10 rounded-lg">{municipalityName}</Badge>}
                  {cityName && <Badge variant="outline" className="bg-purple-500/5 text-purple-500 border-purple-500/10 rounded-lg">{cityName}</Badge>}
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={restrictImportToMunicipality} onCheckedChange={(c) => setRestrictImportToMunicipality(!!c)} className="rounded-md" />
                  <span className="text-muted-foreground font-semibold">اقتصار النتائج على الفلترة</span>
                </label>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground flex items-center justify-between px-1 shrink-0">
              <span>تم اختيار: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedBillboardIds.size}</strong> لوحة</span>
              <span>يعرض أول 200 نتيجة مطابقة</span>
            </div>

            <div className="flex-1 overflow-hidden border border-border/15 rounded-2xl bg-background/30">
              <ScrollArea className="h-full">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/15 z-10">
                    <tr>
                      <th className="p-3 w-10 text-center"></th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">ID</th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">الاسم</th>
                      <th className="p-3 text-center font-semibold text-muted-foreground">المقاس</th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">المدينة</th>
                      <th className="p-3 text-center font-semibold text-muted-foreground">الحالة</th>
                      <th className="p-3 text-center w-16 font-semibold text-muted-foreground">إضافة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredImportBillboards.map(b => (
                      <tr key={b.ID} className={`border-b border-border/10 hover:bg-muted/30 cursor-pointer transition-colors ${selectedBillboardIds.has(b.ID) ? 'bg-indigo-500/[0.02]' : ''}`} onClick={() => {
                        setSelectedBillboardIds(prev => {
                          const n = new Set(prev);
                          if (n.has(b.ID)) n.delete(b.ID); else n.add(b.ID);
                          return n;
                        });
                      }}>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedBillboardIds.has(b.ID)} onCheckedChange={(checked) => {
                            setSelectedBillboardIds(prev => {
                              const n = new Set(prev);
                              if (checked) n.add(b.ID); else n.delete(b.ID);
                              return n;
                            });
                          }} className="rounded-md" />
                        </td>
                        <td className="p-3 font-mono text-xs">{b.ID}</td>
                        <td className="p-3 font-medium">{b.Billboard_Name || '—'}</td>
                        <td className="p-3 text-center"><Badge variant="outline" className="rounded-lg">{b.Size || '—'}</Badge></td>
                        <td className="p-3">{b.City || '—'}</td>
                        <td className="p-3 text-center">
                          <Badge variant={b.Status === 'متاح' ? 'default' : 'secondary'} className="rounded-lg">{b.Status || '—'}</Badge>
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-500 rounded-lg hover:bg-indigo-500/10" title="إضافة سريعة تلقائية" onClick={() => quickAddBillboard(b)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredImportBillboards.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-muted-foreground py-10">لا توجد نتائج مطابقة. {restrictImportToMunicipality && (municipalityName || cityName) ? 'جرّب إلغاء تفعيل اقتصار النتائج.' : ''}</td></tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </div>
          
          <DialogFooter className="gap-2 shrink-0 border-t border-border/10 pt-4">
            <Button variant="outline" onClick={() => setShowImportDialog(false)} className="rounded-xl h-10">إلغاء</Button>
            <Button onClick={importSelectedBillboards} disabled={selectedBillboardIds.size === 0} className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white">
              جلب {selectedBillboardIds.size} لوحة محددة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace billboard dialog */}
      <Dialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] border-border/15 rounded-3xl bg-background/98 backdrop-blur-md flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-2 border-b border-border/10">
            <DialogTitle className="font-bold flex items-center gap-2">
              <Replace className="h-5 w-5 text-indigo-500" />
              <span>استبدال لوحة رقم {replaceTarget}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">اختر لوحة بديلة من النظام لتنوب عن اللوحة الحالية</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="relative shrink-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchBillboard} onChange={e => setSearchBillboard(e.target.value)} placeholder="بحث عن اللوحة البديلة في النظام..." autoFocus className="rounded-xl border-border/15 bg-background/50 h-10 pr-9.5" />
            </div>

            <div className="flex-1 overflow-hidden border border-border/15 rounded-2xl bg-background/30">
              <ScrollArea className="h-full">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/15 z-10">
                    <tr>
                      <th className="p-3 w-10 text-center"></th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">ID</th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">الاسم</th>
                      <th className="p-3 text-center font-semibold text-muted-foreground">المقاس</th>
                      <th className="p-3 text-right font-semibold text-muted-foreground">المدينة</th>
                      <th className="p-3 text-center font-semibold text-muted-foreground">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredImportBillboards.map(b => (
                      <tr key={b.ID} className={`border-b border-border/10 hover:bg-muted/30 cursor-pointer transition-colors ${selectedBillboardIds.has(b.ID) ? 'bg-indigo-500/[0.04]' : ''}`} onClick={() => {
                        setSelectedBillboardIds(new Set([b.ID]));
                      }}>
                        <td className="p-3 text-center">
                          <Checkbox checked={selectedBillboardIds.has(b.ID)} onCheckedChange={() => setSelectedBillboardIds(new Set([b.ID]))} className="rounded-md" />
                        </td>
                        <td className="p-3 font-mono text-xs">{b.ID}</td>
                        <td className="p-3 font-medium">{b.Billboard_Name || '—'}</td>
                        <td className="p-3 text-center"><Badge variant="outline" className="rounded-lg">{b.Size || '—'}</Badge></td>
                        <td className="p-3">{b.City || '—'}</td>
                        <td className="p-3 text-center">
                          <Badge variant={b.Status === 'متاح' ? 'default' : 'secondary'} className="rounded-lg">{b.Status || '—'}</Badge>
                        </td>
                      </tr>
                    ))}
                    {filteredImportBillboards.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted-foreground py-10">لا توجد نتائج مطابقة.</td></tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="gap-2 shrink-0 border-t border-border/10 pt-4">
            <Button variant="outline" onClick={() => setShowReplaceDialog(false)} className="rounded-xl h-10">إلغاء</Button>
            <Button onClick={confirmReplace} disabled={selectedBillboardIds.size !== 1} className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white">
              تأكيد الاستبدال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-md border-border/15 rounded-3xl bg-background/98 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-bold">تعديل لوحة رقم {editingItem?.sequence_number}</DialogTitle>
            <DialogDescription className="sr-only">تعديل بيانات اللوحة المحددة</DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">المقاس (طول × عرض × ارتفاع)</Label>
                <div className="flex flex-col gap-2">
                  <Select value={dbSizes.includes(editingItem.size || '') ? editingItem.size : ''} onValueChange={v => setEditingItem({ ...editingItem, size: v })}>
                    <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-10"><SelectValue placeholder="اختر مقاساً جاهزاً (اختياري)" /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                      {dbSizes.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <DimensionInput
                    value={editingItem.size || ''}
                    onChange={newSize => setEditingItem({ ...editingItem, size: newSize })}
                    availableSizes={dbSizes}
                    className="w-full bg-background/50"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">عدد الأوجه</Label>
                <Select value={editingItem.faces_count} onValueChange={v => setEditingItem({ ...editingItem, faces_count: v })}>
                  <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                    <SelectItem value="وجه">وجه واحد</SelectItem>
                    <SelectItem value="وجهين">وجهين</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Photo Zone */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Camera className="h-3.5 w-3.5 text-indigo-500" />
                    صورة اللوحة
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handlePasteFromClipboard(); }}
                    className="h-6 text-[10px] rounded-lg border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 gap-1 font-semibold hover:bg-indigo-500/20"
                    title="لصق صورة مباشرة من الحافظة (Ctrl + V)"
                  >
                    <Clipboard className="h-3 w-3" />
                    لصق صورة (Ctrl+V)
                  </Button>
                </div>
                {/* Photo Upload / Status Progress Indicator */}
                {(photoImportState === 'compressing' || photoImportState === 'uploading' || photoImportState === 'geocoding') && (
                  <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-2.5 space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>
                          {photoImportState === 'compressing' ? 'جاري ضغط الصورة...' :
                           photoImportState === 'uploading' ? 'جاري رفع الصورة إلى السحابة...' :
                           'استخراج بيانات الموقع...'}
                        </span>
                      </div>
                      <span className="font-mono">{photoImportProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-indigo-500/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                        style={{ width: `${photoImportProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {photoImportState === 'done' && (
                  <div className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    تم رفع الصورة بنجاح وحفظها
                  </div>
                )}

                {editingItem.image_url ? (
                  <div className="relative rounded-xl overflow-hidden border border-border/15 h-36 group">
                    <img src={editingItem.image_url} alt="صورة اللوحة" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setZoomImageModalUrl(editingItem.image_url || null)}
                        className="h-8 text-xs font-semibold gap-1 bg-white/90 text-black hover:bg-white shadow"
                        title="تكبير ومعاينة الصورة"
                      >
                        <Maximize2 className="h-3.5 w-3.5 text-indigo-600" />
                        تكبير
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => photoDropRef.current?.click()}
                        className="h-8 text-xs font-semibold gap-1 bg-white/90 text-black hover:bg-white shadow"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        تغيير
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setEditingItem({ ...editingItem, image_url: null })}
                        className="h-8 text-xs font-semibold gap-1 shadow"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                        حذف
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-xl border border-dashed border-border/30 p-4 bg-muted/20 hover:bg-muted/40 cursor-pointer flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors"
                    onClick={() => photoDropRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); if (e.dataTransfer.files) handleDropOrSelectFiles(e.dataTransfer.files); }}
                  >
                    <Camera className="h-5 w-5 text-indigo-500" />
                    <span>اضغط لاختيار صورة، اسحب هنا، أو <strong>Ctrl + V</strong> للصق</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">حالة اللوحة</Label>
                <StatusQuickSelector
                  value={editingItem.status || 'متاحة'}
                  onChange={v => setEditingItem({ ...editingItem, status: v })}
                  className="w-full justify-between h-10 bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">موقع اللوحة</Label>
                <Input value={editingItem.location_text} onChange={e => setEditingItem({ ...editingItem, location_text: e.target.value })} className="rounded-xl border-border/15 bg-background/50 h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">أقرب نقطة دالة</Label>
                <Input value={editingItem.nearest_landmark} onChange={e => setEditingItem({ ...editingItem, nearest_landmark: e.target.value })} className="rounded-xl border-border/15 bg-background/50 h-10" />
              </div>
              {/* Google Maps URL Field in Edit Dialog */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                  رابط قوقل ماب
                  <span className="text-[10px] font-normal text-muted-foreground/60">(الصق الرابط لاستخراج الإحداثيات تلقائياً)</span>
                  {googleMapsUrlLoading && (
                    <span className="mr-auto text-[10px] text-emerald-500 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> جاري التحديد...
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    dir="ltr"
                    value={googleMapsUrl}
                    onChange={e => handleEditGoogleMapsUrlParse(e.target.value)}
                    placeholder="https://maps.google.com/maps?q=... أو الصق رابط قوقل ماب"
                    className={`font-mono text-xs rounded-xl border-border/15 bg-background/50 h-10 pr-9 ${
                      googleMapsUrlError ? 'border-destructive/40 bg-destructive/5' :
                      (editingItem.latitude && editingItem.longitude && googleMapsUrl) ? 'border-emerald-500/30 bg-emerald-500/5' : ''
                    }`}
                  />
                  {googleMapsUrl && (
                    <button
                      type="button"
                      onClick={() => { setGoogleMapsUrl(''); setGoogleMapsUrlError(''); }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {googleMapsUrlError && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {googleMapsUrlError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">الإحداثيات (Lat, Lng)</Label>
                <Input
                  dir="ltr"
                  value={editingItem.latitude && editingItem.longitude ? `${Number(editingItem.latitude.toFixed(6))}, ${Number(editingItem.longitude.toFixed(6))}` : ''}
                  onChange={e => {
                    const parts = e.target.value.split(',').map(c => c.trim());
                    const parsedLat = parts[0] ? parseFloat(parts[0]) : null;
                    const parsedLng = parts[1] ? parseFloat(parts[1]) : null;
                    const lat = parsedLat !== null && !isNaN(parsedLat) ? Number(parsedLat.toFixed(6)) : null;
                    const lng = parsedLng !== null && !isNaN(parsedLng) ? Number(parsedLng.toFixed(6)) : null;
                    setEditingItem({ ...editingItem, latitude: lat, longitude: lng });
                  }}
                  placeholder="32.901753, 13.217222"
                  className="font-mono text-sm rounded-xl border-border/15 bg-background/50 h-10"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditingItem(null)} className="rounded-xl h-10">إلغاء</Button>
            <Button
              disabled={photoImportState === 'compressing' || photoImportState === 'uploading' || photoImportState === 'geocoding'}
              onClick={() => {
                if (photoImportState === 'compressing' || photoImportState === 'uploading') {
                  toast.info('جاري رفع ومعالجة الصورة... يرجى الانتظار حتى اكتمال شريط التقدم');
                  return;
                }
                if (editingItem) {
                  updateItem(editingItem.sequence_number, editingItem);
                  setEditingItem(null);
                  toast.success('تم تحديث بيانات اللوحة');
                }
              }}
              className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              {(photoImportState === 'compressing' || photoImportState === 'uploading' || photoImportState === 'geocoding') ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جاري المعالجة...</>
              ) : (
                <>حفظ التعديلات</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved collections dialog */}
      <Dialog open={showCollectionsDialog} onOpenChange={(open) => { setShowCollectionsDialog(open); if (open) loadCollections(); }}>
        <DialogContent className="max-w-lg border-border/15 rounded-3xl bg-background/98 backdrop-blur-xl shadow-2xl p-0 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-border/15 bg-card/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded-xl shadow-sm">
                  <FolderOpen className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="font-bold text-base">المجموعات المحفوظة</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    إدارة، فتح، نسخ، وحذف القوائم المنظمة سابقةً
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-semibold bg-primary/5 text-primary border-primary/20">
                {collections.length} قائمة
              </Badge>
            </div>

            {collections.length > 0 && (
              <div className="mt-3.5 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={collectionsSearchQuery}
                  onChange={(e) => setCollectionsSearchQuery(e.target.value)}
                  placeholder="بحث باسم القائمة أو البلدية أو المدينة..."
                  className="pr-9 pl-8 h-9 text-xs rounded-xl bg-background/80 border-border/20 focus-visible:ring-indigo-500"
                />
                {collectionsSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCollectionsSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4 max-h-[420px] overflow-y-auto custom-scrollbar">
            {collections.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                <FolderOpen className="h-8 w-8 mx-auto opacity-30" />
                <p className="font-medium">لا توجد مجموعات محفوظة حالياً</p>
                <p className="text-xs text-muted-foreground/70">قم بتنظيم اللوحات والضغط على "حفظ" لحفظ قائمتك الأولى</p>
              </div>
            ) : filteredCollections.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs">
                لا توجد نتائج مطابقة لبحثك "{collectionsSearchQuery}"
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCollections.map(c => {
                  const isCurrent = currentCollection.id === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between p-3 sm:p-3.5 border rounded-2xl transition-all group/item ${
                        isCurrent
                          ? 'border-indigo-500/40 bg-indigo-500/5 shadow-sm'
                          : 'border-border/15 hover:border-border/40 hover:bg-muted/40'
                      }`}
                    >
                      <div
                        className="flex-1 min-w-0 cursor-pointer pl-2"
                        onClick={() => loadCollection(c.id)}
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground group-hover/item:text-indigo-500 transition-colors truncate">
                            {c.name}
                          </span>
                          {isCurrent && (
                            <Badge className="text-[10px] h-5 bg-indigo-500 text-white font-bold px-1.5">
                              الحالية
                            </Badge>
                          )}
                          {c.municipality_name && (
                            <Badge variant="outline" className="text-[10px] h-4.5 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5 px-1.5">
                              {c.municipality_name}
                            </Badge>
                          )}
                          {c.city && c.city !== c.municipality_name && (
                            <Badge variant="outline" className="text-[10px] h-4.5 border-slate-500/20 text-muted-foreground px-1.5">
                              {c.city}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5 font-mono">
                          <Calendar className="h-3 w-3 inline text-muted-foreground/60" />
                          <span>{new Date(c.created_at).toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-xl h-8 px-3 text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15 hover:bg-indigo-500 hover:text-white transition-all gap-1"
                          onClick={() => loadCollection(c.id)}
                          title="فتح وتحميل القائمة"
                        >
                          <FolderOpen className="h-3 w-3" />
                          <span>فتح</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl h-8 px-2.5 text-xs font-semibold border-amber-500/25 bg-amber-500/8 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all gap-1"
                          onClick={() => {
                            setDuplicateTarget({ id: c.id, name: c.name });
                            setDuplicateNewName(`${c.name} - نسخة`);
                          }}
                          title="نسخ هذه القائمة باسم جديد"
                        >
                          <Copy className="h-3 w-3" />
                          <span className="hidden sm:inline">نسخ</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-xl h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                          title="حذف القائمة"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Collection Modal */}
      <Dialog open={!!duplicateTarget} onOpenChange={(open) => { if (!open) setDuplicateTarget(null); }}>
        <DialogContent className="max-w-md border-border/20 rounded-3xl bg-background/98 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-amber-500 mb-1">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <Copy className="h-4 w-4" />
              </div>
              <DialogTitle className="font-bold text-base text-foreground">نسخ قائمة وتسميتها باسم جديد</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              سيتم استنساخ جميع لوحات وترتيب وإعدادات القائمة <strong className="text-foreground">"{duplicateTarget?.name}"</strong> إلى قائمة جديدة تماماً.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">اسم القائمة الجديدة *</Label>
              <Input
                value={duplicateNewName}
                onChange={(e) => setDuplicateNewName(e.target.value)}
                placeholder="أدخل اسم النسخة الجديدة..."
                className="h-10 rounded-xl font-bold bg-background/60 border-border/20 focus-visible:ring-amber-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isDuplicating && duplicateNewName.trim()) {
                    handleDuplicateCollection();
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border/15 bg-muted/20">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground">فتح القائمة بعد النسخ فوراً</div>
                <div className="text-[11px] text-muted-foreground">تحميل القائمة الجديدة في مساحة العمل تلقائياً</div>
              </div>
              <Switch
                checked={duplicateAutoOpen}
                onCheckedChange={setDuplicateAutoOpen}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => setDuplicateTarget(null)}
              disabled={isDuplicating}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              className="rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 gap-1.5 shadow-md shadow-amber-500/20"
              onClick={handleDuplicateCollection}
              disabled={isDuplicating || !duplicateNewName.trim()}
            >
              {isDuplicating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>جاري النسخ...</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>تأكيد النسخ</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save As Copy Modal */}
      <Dialog open={showSaveAsCopyDialog} onOpenChange={setShowSaveAsCopyDialog}>
        <DialogContent className="max-w-md border-border/20 rounded-3xl bg-background/98 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-indigo-500 mb-1">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <Copy className="h-4 w-4" />
              </div>
              <DialogTitle className="font-bold text-base text-foreground">حفظ كنسخة جديدة</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              حفظ اللوحات والتخصيصات الحالية كقائمة جديدة منفصلة دون التعديل على القائمة الأصلية.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">اسم القائمة الجديدة *</Label>
              <Input
                value={saveAsCopyName}
                onChange={(e) => setSaveAsCopyName(e.target.value)}
                placeholder="أدخل اسم القائمة الجديدة..."
                className="h-10 rounded-xl font-bold bg-background/60 border-border/20 focus-visible:ring-indigo-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSavingAsCopy && saveAsCopyName.trim()) {
                    saveAsNewCollection(saveAsCopyName);
                  }
                }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded-xl border border-border/10">
              💡 سيتم حفظ <strong className="text-foreground">{currentCollection.items.length}</strong> لوحة بالترتيب والإعدادات الحالية في سجل جديد.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => setShowSaveAsCopyDialog(false)}
              disabled={isSavingAsCopy}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-md shadow-indigo-600/20"
              onClick={() => saveAsNewCollection(saveAsCopyName)}
              disabled={isSavingAsCopy || !saveAsCopyName.trim()}
            >
              {isSavingAsCopy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>حفظ كنسخة جديدة</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md border-destructive/20 rounded-3xl bg-background/98 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-destructive mb-1">
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-xl">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <DialogTitle className="font-bold text-base text-foreground">تأكيد حذف القائمة</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              هل أنت متأكد من حذف القائمة <strong className="text-destructive font-bold">"{deleteTarget?.name}"</strong>؟
              <br />
              سيتم حذف جميع اللوحات المنسوبة إليها بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-xl text-xs font-semibold gap-1.5 shadow-md shadow-destructive/20"
              onClick={handleDeleteCollection}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>جاري الحذف...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>تأكيد الحذف</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-7xl w-[96vw] h-[92vh] max-h-[92vh] border-border/30 rounded-3xl bg-background/98 backdrop-blur-xl shadow-2xl p-0 overflow-hidden flex flex-col">
          {/* Top Header */}
          <div className="px-6 py-3.5 border-b border-border/20 bg-card/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary border border-primary/20 rounded-2xl shadow-sm">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-extrabold text-base flex items-center gap-2">
                  <span>استوديو تحضير الطباعة الشاملة</span>
                  <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
                    {currentCollection.items.length} لوحة
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                  تجهيز ومعاينة مستند الطباعة النهائي، ضبط ترويسة الجدول والتوقيعات وتخطيط الأوراق
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={saveAsGlobalDefaults}
                className="h-8 text-xs rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1.5 hover:bg-amber-500/20 font-bold"
                title="حفظ هذه الإعدادات كافتراضي عام لجميع القوائم الجديدة"
              >
                <Save className="h-3.5 w-3.5" />
                حفظ كافتراضي عام
              </Button>
            </div>
          </div>

          {/* Main 2-column Workspace */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-0">
            
            {/* ── LEFT PANEL: Live Card Blueprint Preview & Stats (4 Cols) ── */}
            <div className="lg:col-span-4 bg-muted/20 p-5 flex flex-col justify-between border-l border-border/20 overflow-y-auto custom-scrollbar">
              <div className="space-y-4 flex flex-col items-center">
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-background/80 p-1 rounded-xl border border-border/20">
                    <button
                      type="button"
                      onClick={() => setPreviewBlueprintMode('card')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        previewBlueprintMode === 'card'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      معاينة البطاقة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewBlueprintMode('cover');
                        setPrintStudioTab('cover');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                        previewBlueprintMode === 'cover'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <BookOpen className="h-3 w-3" />
                      <span>معاينة الغلاف</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    A4 Portrait
                  </span>
                </div>
                
                {previewBlueprintMode === 'cover' ? (
                  /* Simulated Cover Page Blueprint */
                  <div className="w-full max-w-[280px] aspect-[1/1.38] bg-white text-black border border-slate-300 rounded-2xl shadow-xl p-4 flex flex-col justify-between items-center text-center relative overflow-hidden select-none font-sans">
                    <div className="w-full flex items-center justify-between border-b border-slate-100 pb-1.5 text-[8px] font-bold text-slate-400">
                      <span>صفحة الغلاف (الصفحة 1)</span>
                      <span>{coverPageEnabled ? 'مفعّلة' : 'معطّلة'}</span>
                    </div>

                    {!coverPageEnabled ? (
                      <div className="my-auto p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-600 text-[11px] font-bold space-y-1">
                        <div>صفحة الغلاف معطّلة</div>
                        <div className="text-[9px] font-normal text-rose-500">لن يتم طباعة صفحة الغلاف في المستند</div>
                      </div>
                    ) : (
                      <div className="space-y-3 w-full my-auto py-4">
                        <div className="mx-auto flex items-center justify-center p-1.5" style={{ height: `${Math.min(90, Math.max(40, (parseFloat(activeCoverLogoSize) / 220) * 64))}px` }}>
                          <img 
                            src={normalizeGoogleImageUrl(activeCoverLogoUrl)} 
                            alt="شعار" 
                            style={{ maxHeight: '100%', maxWidth: `${Math.min(180, (parseFloat(activeCoverLogoSize) / 220) * 120)}px` }}
                            className="object-contain" 
                            onError={e => { (e.target as HTMLElement).style.display = 'none'; }} 
                          />
                        </div>
                        <div className="space-y-1.5 px-2">
                          <div className="text-[11px] font-bold text-slate-600">
                            {coverPhrase || 'لوحات'}
                          </div>
                          <div className="text-xs font-black text-slate-900 leading-tight">
                            {resolveCoverTitle(coverTitle, municipalityName || 'الخمس', cityName, collectionName)}
                          </div>
                          {coverSubtitle && (
                            <div className="text-[9px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                              {coverSubtitle}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="w-full border-t border-slate-100 pt-1 text-[8px] text-slate-400 font-mono flex justify-between items-center">
                      <span>شركة الفارس الذهبي</span>
                      <span>A4 Paper</span>
                    </div>
                  </div>
                ) : (
                  /* Simulated Card Blueprint */
                  <div className="w-full max-w-[280px] aspect-[1/1.38] bg-white text-black border border-slate-300 rounded-2xl shadow-xl p-4 flex flex-col justify-between relative overflow-hidden select-none font-sans">
                    {/* Header info */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-extrabold text-slate-700">موقع بلدية {municipalityName || 'الخمس'}</div>
                        <div className="text-[9px] text-slate-400">لوحة رقم #1</div>
                      </div>
                      {/* Status badge representation */}
                      {showStatusInPrint && (
                        <div className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase ${
                          statusColor ? '' : 'bg-amber-100 border-amber-300 text-amber-600'
                        }`} style={{ 
                          color: statusColor || undefined, 
                          borderColor: statusColor || undefined,
                          fontSize: statusFontSize ? `${parseFloat(statusFontSize) * 0.7}px` : undefined 
                        }}>
                          متاحة
                        </div>
                      )}
                    </div>

                    {/* Main Image Block */}
                    <div className="flex-1 my-2.5 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col relative">
                      {printImageSource === 'actual_image' && (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2">
                          <ImageIcon className="h-8 w-8 mb-1 opacity-40 text-slate-500" />
                          <span className="text-[9px] font-bold">صورة الموقع الميدانية</span>
                        </div>
                      )}

                      {printImageSource === 'map_pin' && (
                        <div className="w-full h-full flex flex-col">
                          <div className="flex-1 bg-slate-100 border-b border-slate-200 flex items-center justify-center text-slate-400">
                            <ImageIcon className="h-6 w-6 opacity-30 text-slate-500" />
                          </div>
                          <div className="flex-1 bg-slate-200 flex items-center justify-center text-slate-500 gap-1">
                            <MapPin className="h-4 w-4 text-amber-500 animate-bounce" />
                            <span className="text-[8px] font-bold">تحديد الإحداثيات</span>
                          </div>
                        </div>
                      )}

                      {printImageSource === 'map_only' && (
                        <div className="w-full h-full bg-slate-200 flex flex-col items-center justify-center text-slate-600 p-2 gap-1.5">
                          <MapPin className="h-6 w-6 text-amber-600 animate-bounce" />
                          <span className="text-[8px] font-bold">الخريطة الجغرافية فقط</span>
                        </div>
                      )}

                      {/* Coords bar */}
                      <div className="h-5 bg-slate-800 text-white flex items-center justify-center text-[8px] font-mono whitespace-nowrap">
                        32.8872, 13.1913
                      </div>
                    </div>

                    {/* Bottom details block */}
                    <div className="flex justify-between items-end border-t border-slate-100 pt-2 text-[9px] font-medium text-slate-500">
                      <div className="space-y-0.5">
                        <div>المقاس: 8 × 3 {showHeightInPrint ? '× 1.2' : ''}</div>
                        {customSettings.faces_count_show !== 'false' && <div>الأوجه: وجهين</div>}
                      </div>
                      <div className="w-8 h-8 bg-slate-100 border border-slate-200 flex items-center justify-center text-[7px] text-slate-400">
                        QR
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Stats Overview */}
              <div className="mt-4 p-3.5 rounded-2xl border border-border/15 bg-background/60 space-y-2 text-xs">
                <div className="text-[11px] font-extrabold text-foreground flex items-center gap-1.5 border-b border-border/10 pb-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" /> ملخص مخرجات الطباعة
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-muted/40 flex flex-col">
                    <span className="text-[10px] text-muted-foreground">عدد اللوحات الكلي:</span>
                    <span className="font-extrabold text-foreground">{currentCollection.items.length} لوحة</span>
                  </div>
                  <div className="p-2 rounded-xl bg-muted/40 flex flex-col">
                    <span className="text-[10px] text-muted-foreground">صفحة الغلاف:</span>
                    <span className={`font-extrabold ${coverPageEnabled ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      {coverPageEnabled ? 'مفعّلة (صفحة 1)' : 'معطّلة'}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-muted/40 flex flex-col">
                    <span className="text-[10px] text-muted-foreground">صفحات الملخص:</span>
                    <span className="font-extrabold text-foreground">{Math.max(1, Math.ceil(currentCollection.items.length / (summaryRowsPerPage || 17)))} صفحة</span>
                  </div>
                  <div className="p-2 rounded-xl bg-muted/40 flex flex-col">
                    <span className="text-[10px] text-muted-foreground">الموقعون المفعلون:</span>
                    <span className="font-extrabold text-foreground">{showSignatures ? signersList.filter(s => s.enabled).length : 0} موقعين</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL: Spacious Tabbed Configuration Workspace (8 Cols) ── */}
            <div className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden bg-background">
              
              {/* Tab Switcher Header */}
              <div className="p-3 border-b border-border/20 bg-muted/10 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintStudioTab('signatures');
                      setPreviewBlueprintMode('card');
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 border ${
                      printStudioTab === 'signatures'
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background hover:bg-muted/60 text-muted-foreground border-border/20'
                    }`}
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    <span>التوقيعات والترويسة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintStudioTab('cover');
                      setPreviewBlueprintMode('cover');
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 border ${
                      printStudioTab === 'cover'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-background hover:bg-muted/60 text-muted-foreground border-border/20'
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>صفحة الغلاف</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintStudioTab('layout');
                      setPreviewBlueprintMode('card');
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 border ${
                      printStudioTab === 'layout'
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background hover:bg-muted/60 text-muted-foreground border-border/20'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                    <span>تخطيط الصفوف</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintStudioTab('status');
                      setPreviewBlueprintMode('card');
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 border ${
                      printStudioTab === 'status'
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background hover:bg-muted/60 text-muted-foreground border-border/20'
                    }`}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span>شارة الحالة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintStudioTab('background');
                      setPreviewBlueprintMode('card');
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 border ${
                      printStudioTab === 'background'
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background hover:bg-muted/60 text-muted-foreground border-border/20'
                    }`}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>ورقة الخلفية</span>
                  </button>
                </div>
              </div>

              {/* Tab Contents (Spacious Scroll Area) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                
                {/* ── TAB: COVER PAGE ── */}
                {printStudioTab === 'cover' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    
                    {/* Master Cover Enable Switch */}
                    <div className="p-4 border border-border/20 rounded-2xl bg-card space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="cover_page_enabled_toggle" className="text-xs font-black text-foreground flex items-center gap-1.5">
                            <BookOpen className="h-4 w-4 text-indigo-500" />
                            <span>تضمين صفحة الغلاف في مستند الطباعة</span>
                          </Label>
                          <div className="text-[10px] text-muted-foreground">
                            طباعة صفحة أولى رسمية مستقلة تحتوي على الشعار والعبارة الافتتاحية واسم البلدية
                          </div>
                        </div>
                        <Switch
                          id="cover_page_enabled_toggle"
                          checked={coverPageEnabled}
                          onCheckedChange={setCoverPageEnabled}
                        />
                      </div>
                    </div>

                    {coverPageEnabled && (
                      <div className="space-y-4">
                        {/* Cover Title Main Card */}
                        <div className="p-4 border border-border/20 rounded-2xl bg-card space-y-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="cover_title_input" className="text-xs font-black text-foreground flex items-center gap-1.5">
                                <Building2 className="h-4 w-4 text-primary" />
                                <span>العنوان الرئيسي لصفحة الغلاف *</span>
                              </Label>
                              <div className="text-[10px] text-muted-foreground">
                                النص البارز الذي يظهر بخط كبير في وسط صفحة الغلاف
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCoverTitle(municipalityName ? `بلدية ${municipalityName}` : '')}
                              className="text-[11px] text-primary hover:underline font-semibold"
                            >
                              استخدام اسم البلدية
                            </button>
                          </div>

                          <Input
                            id="cover_title_input"
                            value={coverTitle}
                            onChange={e => setCoverTitle(e.target.value)}
                            placeholder={`تلقائي: ${municipalityName || collectionName || 'بلدية الخمس'}`}
                            className="h-10 text-xs rounded-xl bg-background border-border/30 font-bold"
                          />

                          {/* Variable Insert buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-muted-foreground">إدراج متغير ذكي:</span>
                              <button
                                type="button"
                                onClick={() => setCoverTitle(prev => (prev ? prev + ' ' : '') + '{البلدية}')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
                              >
                                + {'{البلدية}'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setCoverTitle(prev => (prev ? prev + ' ' : '') + '{المدينة}')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
                              >
                                + {'{المدينة}'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setCoverTitle(prev => (prev ? prev + ' ' : '') + '{اسم المجموعة}')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
                              >
                                + {'{اسم المجموعة}'}
                              </button>
                            </div>
                          </div>

                          {/* Live Cover Title Preview */}
                          <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-2 text-xs">
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">معاينة الغلاف:</span>
                            <span>"{coverPhrase || 'لوحات'} {resolveCoverTitle(coverTitle, municipalityName || 'الخمس', cityName, collectionName)}"</span>
                          </div>
                        </div>

                        {/* Cover Phrase & Subtitle Card */}
                        <div className="p-4 border border-border/20 rounded-2xl bg-card space-y-4 shadow-sm">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label htmlFor="cover_phrase_input" className="text-xs font-bold text-foreground">
                                العبارة الافتتاحية (أعلى العنوان)
                              </Label>
                              <Input
                                id="cover_phrase_input"
                                value={coverPhrase}
                                onChange={e => setCoverPhrase(e.target.value)}
                                placeholder="لوحات"
                                className="h-9 text-xs rounded-xl bg-background border-border/30 font-medium"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="cover_subtitle_input" className="text-xs font-bold text-foreground">
                                عنوان فرعي / نص إضافي (اختياري)
                              </Label>
                              <Input
                                id="cover_subtitle_input"
                                value={coverSubtitle}
                                onChange={e => setCoverSubtitle(e.target.value)}
                                placeholder="مثلاً: تقرير المواقع المعتمدة لعام 2026"
                                className="h-9 text-xs rounded-xl bg-background border-border/30 font-medium"
                              />
                            </div>
                          </div>

                          {/* Font Sizes Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/10">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-muted-foreground">حجم خط العنوان:</span>
                                <span className="font-mono font-bold text-primary">{coverTitleFontSize}px</span>
                              </div>
                              <Slider
                                value={[coverTitleFontSize]}
                                onValueChange={([val]) => setCoverTitleFontSize(val)}
                                min={20}
                                max={60}
                                step={1}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-muted-foreground">حجم خط العبارة:</span>
                                <span className="font-mono font-bold text-primary">{coverPhraseFontSize}px</span>
                              </div>
                              <Slider
                                value={[coverPhraseFontSize]}
                                onValueChange={([val]) => setCoverPhraseFontSize(val)}
                                min={16}
                                max={48}
                                step={1}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-muted-foreground">حجم خط العنوان الفرعي:</span>
                                <span className="font-mono font-bold text-primary">{coverSubtitleFontSize}px</span>
                              </div>
                              <Slider
                                value={[coverSubtitleFontSize]}
                                onValueChange={([val]) => setCoverSubtitleFontSize(val)}
                                min={12}
                                max={32}
                                step={1}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Cover Logo Customization Card */}
                        <div className="p-4 border border-border/20 rounded-2xl bg-card space-y-4 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-xs font-black text-foreground flex items-center gap-1.5">
                                <ImageIcon className="h-4 w-4 text-amber-500" />
                                <span>شعار صفحة الغلاف</span>
                              </Label>
                              <div className="text-[10px] text-muted-foreground">
                                يتم ربط الشعار تلقائياً بورقة الخلفية المختارة، أو يمكنك تخصيص شعار مستقل
                              </div>
                            </div>
                            {coverLogoUrl !== 'auto' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCoverLogoUrl('auto');
                                }}
                                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                              >
                                <RotateCcw className="h-3 w-3" />
                                العودة للشعار التلقائي من الخلفية
                              </button>
                            )}
                          </div>

                          {/* Auto Background-Linked Banner */}
                          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                            coverLogoUrl === 'auto' || !coverLogoUrl 
                              ? 'bg-primary/10 border-primary/40 text-primary' 
                              : 'bg-muted/30 border-border/20 text-muted-foreground'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-900 border border-border/20 p-1 flex items-center justify-center shrink-0">
                                <img 
                                  src={normalizeGoogleImageUrl(matchingBg?.logo_url || '/logofaresgold.svg')} 
                                  alt="شعار الخلفية" 
                                  className="h-full max-w-full object-contain" 
                                />
                              </div>
                              <div>
                                <div className="text-xs font-bold flex items-center gap-1.5">
                                  <span>شعار قالب الخلفية:</span>
                                  <span className="text-foreground underline">{matchingBg?.name || 'الخلفية الافتراضية'}</span>
                                  {(coverLogoUrl === 'auto' || !coverLogoUrl) && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-primary text-primary-foreground font-black mr-1">
                                      مُفعّل تلقائياً
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] opacity-80">
                                  الحجم المعتمد للخلفية: <span className="font-mono font-bold">{matchingBg?.logo_size || '220px'}</span> (يتغير تلقائياً بتغيير ورقة الخلفية)
                                </div>
                              </div>
                            </div>

                            {(coverLogoUrl !== 'auto' && coverLogoUrl) && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setCoverLogoUrl('auto')}
                                className="h-8 text-xs rounded-xl gap-1 shrink-0"
                              >
                                تفعيل شعار الخلفية
                              </Button>
                            )}
                          </div>

                          {/* Preset Logos Grid (Manual Overrides) */}
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[11px] font-bold text-foreground">أو اختر شعاراً بديلاً يدوياً:</div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              <button
                                type="button"
                                onClick={() => setCoverLogoUrl('auto')}
                                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                                  coverLogoUrl === 'auto' || !coverLogoUrl 
                                    ? 'border-primary bg-primary/15 shadow-sm ring-1 ring-primary' 
                                    : 'border-border/20 bg-background hover:bg-muted/40'
                                }`}
                              >
                                <div className="h-8 w-full flex items-center justify-center p-0.5 bg-slate-950/20 rounded-lg">
                                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                                </div>
                                <span className={`text-[10px] font-bold ${coverLogoUrl === 'auto' || !coverLogoUrl ? 'text-primary' : 'text-muted-foreground'}`}>
                                  تلقائي (من الخلفية)
                                </span>
                              </button>

                              {[
                                { id: 'gold', name: 'الشعار الذهبي', url: '/logofaresgold.svg' },
                                { id: 'white', name: 'الشعار الأبيض', url: '/logofares2.svg' },
                                { id: 'symbol', name: 'الرمز فقط', url: '/logo-symbol.svg' },
                                { id: 'text', name: 'النص فقط', url: '/logo-text.svg' },
                              ].map(preset => {
                                const isSelected = coverLogoUrl === preset.url;
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setCoverLogoUrl(preset.url)}
                                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                                      isSelected 
                                        ? 'border-primary bg-primary/15 shadow-sm ring-1 ring-primary' 
                                        : 'border-border/20 bg-background hover:bg-muted/40'
                                    }`}
                                  >
                                    <div className="h-8 w-full flex items-center justify-center p-0.5 bg-slate-950/20 rounded-lg">
                                      <img src={preset.url} alt={preset.name} className="h-full max-w-full object-contain" />
                                    </div>
                                    <span className={`text-[10px] font-bold ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                      {preset.name}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Custom Logo Upload & Input */}
                          <div className="pt-2 border-t border-border/10 flex flex-col sm:flex-row items-center gap-3">
                            <input
                              ref={coverLogoInputRef}
                              type="file"
                              accept="image/*,.svg"
                              onChange={handleCoverLogoUpload}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadingCoverLogo}
                              onClick={() => coverLogoInputRef.current?.click()}
                              className="h-9 text-xs rounded-xl gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/10 w-full sm:w-auto"
                            >
                              {uploadingCoverLogo ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              <span>{uploadingCoverLogo ? 'جاري الرفع...' : 'رفع شعار مخصص (SVG / PNG)'}</span>
                            </Button>

                            <div className="flex-1 w-full flex items-center gap-2">
                              <Input
                                value={coverLogoUrl === 'auto' ? '' : coverLogoUrl}
                                onChange={e => setCoverLogoUrl(e.target.value)}
                                placeholder="أو اكتب رابط شعار مخصص..."
                                className="h-9 text-[11px] rounded-xl bg-background border-border/30"
                              />
                            </div>
                          </div>

                          {/* Logo Size Slider */}
                          <div className="pt-2 border-t border-border/10 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-muted-foreground">حجم وعرض الشعار في الغلاف:</span>
                              <span className="font-mono font-bold text-amber-500">{activeCoverLogoSize}</span>
                            </div>
                            <Slider
                              value={[parseInt(activeCoverLogoSize) || 220]}
                              onValueChange={([val]) => setCoverLogoSize(val)}
                              min={100}
                              max={450}
                              step={5}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* ── TAB 1: SIGNATURES & HEADER TITLE ── */}
                {printStudioTab === 'signatures' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    
                    {/* Header Title Editor */}
                    <div className="p-4 border border-border/20 rounded-2xl bg-card space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="header_title_input" className="text-xs font-black text-foreground flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span>عنوان ترويسة جدول اللوحات</span>
                          </Label>
                          <div className="text-[10px] text-muted-foreground">
                            النص الذي يظهر في أعلى صفحات جدول الملخص الرسمي
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSummaryHeaderTitle('مواقع لوحات شركة الفارس الذهبي للدعاية والإعلان بلدية {البلدية}')}
                          className="text-[11px] text-primary hover:underline font-semibold"
                        >
                          استعادة العنوان الافتراضي
                        </button>
                      </div>

                      <Input
                        id="header_title_input"
                        value={summaryHeaderTitle}
                        onChange={e => setSummaryHeaderTitle(e.target.value)}
                        placeholder="مواقع لوحات شركة الفارس الذهبي للدعاية والإعلان بلدية {البلدية}"
                        className="h-10 text-xs rounded-xl bg-background border-border/30 font-medium"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground">إدراج متغير ذكي:</span>
                          <button
                            type="button"
                            onClick={() => setSummaryHeaderTitle(prev => prev + ' {البلدية}')}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
                          >
                            + {'{البلدية}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSummaryHeaderTitle(prev => prev + ' {المدينة}')}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
                          >
                            + {'{المدينة}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSummaryHeaderTitle(prev => prev + ' {العدد}')}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
                          >
                            + {'{العدد}'}
                          </button>
                        </div>
                      </div>

                      {/* Live rendered preview */}
                      <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-primary font-bold flex items-center gap-2 text-xs">
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">معاينة فورية:</span>
                        <span>{resolveSummaryTitle(summaryHeaderTitle, municipalityName || 'الخمس', cityName, currentCollection.items.length)}</span>
                      </div>
                    </div>

                    {/* Signatures Master Section */}
                    <div className="p-4 border border-border/20 rounded-2xl bg-card space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-border/15 pb-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="show_signatures_toggle" className="text-xs font-black text-foreground flex items-center gap-1.5">
                            <PenTool className="h-4 w-4 text-primary" />
                            <span>إظهار التوقيعات والاعتمادات أسفل الملخص</span>
                          </Label>
                          <div className="text-[10px] text-muted-foreground">
                            إضافة خانات توقيع اللجان والإدارة واعتماد عميد البلدية أسفل الصفحة كما في النموذج الرسمي
                          </div>
                        </div>
                        <Switch
                          id="show_signatures_toggle"
                          checked={showSignatures}
                          onCheckedChange={setShowSignatures}
                        />
                      </div>

                      {showSignatures && (
                        <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                          
                          {/* Presets & Controls Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-border/15">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-extrabold text-muted-foreground">توزيع الموقعين:</span>
                              <button
                                type="button"
                                onClick={() => applySignersPreset('3_official')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-all"
                              >
                                3 موقعين (نموذج رسمي)
                              </button>
                              <button
                                type="button"
                                onClick={() => applySignersPreset('2_side')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-background hover:bg-muted text-foreground border border-border/30 transition-all"
                              >
                                2 موقعين (جنباً لجنب)
                              </button>
                              <button
                                type="button"
                                onClick={() => applySignersPreset('1_center')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-background hover:bg-muted text-foreground border border-border/30 transition-all"
                              >
                                1 موقع واحد (اعتماد فقط)
                              </button>
                              <button
                                type="button"
                                onClick={() => applySignersPreset('4_grid')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-background hover:bg-muted text-foreground border border-border/30 transition-all"
                              >
                                4 موقعين
                              </button>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addSigner}
                              className="h-7 text-xs rounded-xl gap-1.5 border-border/30 hover:bg-primary hover:text-primary-foreground font-bold"
                            >
                              <Plus className="h-3.5 w-3.5" /> إضافة توقيع جديد
                            </Button>
                          </div>

                          {/* Page destination toggle & Font Size selector */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/15">
                              <Label className="text-xs font-bold text-foreground">مكان ظهور التوقيعات:</Label>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSignaturesPage('last')}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                    signaturesPage === 'last'
                                      ? 'bg-primary text-primary-foreground shadow-sm'
                                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                  }`}
                                >
                                  الصفحة الأخيرة
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSignaturesPage('all')}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                    signaturesPage === 'all'
                                      ? 'bg-primary text-primary-foreground shadow-sm'
                                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                  }`}
                                >
                                  جميع الصفحات
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/15">
                              <div className="space-y-0.5">
                                <Label className="text-xs font-bold text-foreground">حجم خط التوقيعات:</Label>
                                <div className="text-[10px] text-muted-foreground">تكبير نصوص المسميات والأسماء</div>
                              </div>
                              <div className="flex items-center gap-1">
                                {[14, 16, 18, 20].map(sz => (
                                  <button
                                    key={sz}
                                    type="button"
                                    onClick={() => setSignaturesFontSize(sz)}
                                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                                      signaturesFontSize === sz
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                    }`}
                                  >
                                    {sz}px {sz === 16 ? '(افتراضي)' : ''}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Spacious Signers Cards Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pt-1">
                            {signersList.map((sig, idx) => (
                              <div 
                                key={sig.id} 
                                className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                                  sig.enabled 
                                    ? 'border-border/30 bg-background shadow-sm hover:border-primary/40' 
                                    : 'border-dashed border-border/20 bg-muted/10 opacity-60'
                                }`}
                              >
                                <div className="flex items-center justify-between border-b border-border/10 pb-2">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={sig.enabled}
                                      onCheckedChange={(checked) => updateSigner(sig.id, { enabled: checked })}
                                    />
                                    <span className="text-xs font-black text-foreground">
                                      توقيع #{idx + 1}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <Select 
                                      value={sig.position} 
                                      onValueChange={(pos: any) => updateSigner(sig.id, { position: pos })}
                                    >
                                      <SelectTrigger className="h-7 text-[11px] font-bold rounded-lg px-2 border-border/30 bg-muted/40 w-20">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-xl border-border/20 bg-popover text-xs">
                                        <SelectItem value="right">يمين</SelectItem>
                                        <SelectItem value="left">يسار</SelectItem>
                                        <SelectItem value="center">وسط (اعتماد)</SelectItem>
                                      </SelectContent>
                                    </Select>

                                    {signersList.length > 1 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeSigner(sig.id)}
                                        className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                                        title="حذف هذا التوقيع"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <Label className="text-[11px] font-bold text-muted-foreground">المسمى الوظيفي / الاعتماد</Label>
                                  <Input
                                    value={sig.title}
                                    onChange={e => updateSigner(sig.id, { title: e.target.value })}
                                    placeholder="مسمى الوظيفة أو الاعتماد"
                                    className="h-9 text-xs rounded-xl bg-muted/20 border-border/30 font-semibold"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <Label className="text-[11px] font-bold text-muted-foreground">الاسم الكامل (اختياري)</Label>
                                  <Input
                                    value={sig.name || ''}
                                    onChange={e => updateSigner(sig.id, { name: e.target.value })}
                                    placeholder="مثلاً: د. علي المحمودي..."
                                    className="h-9 text-xs rounded-xl bg-muted/20 border-border/30 font-medium"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Copy/Import from another collection dropdown */}
                          {collections.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/10">
                              <span className="text-xs text-muted-foreground font-medium">استيراد الترويسة والتوقيعات من قائمة سابقة:</span>
                              <Select onValueChange={(val) => importSettingsFromCollection(val)}>
                                <SelectTrigger className="h-8 text-xs rounded-xl border-border/30 bg-background w-64">
                                  <SelectValue placeholder="اختر قائمة لنسخ إعداداتها..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/20 bg-popover text-xs">
                                  {collections.map(c => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* ── TAB 2: LAYOUT & ROWS ── */}
                {printStudioTab === 'layout' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    
                    {/* Image Source Mode */}
                    <div className="p-4 border border-border/20 rounded-2xl bg-card space-y-3 shadow-sm">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-black text-foreground flex items-center gap-1.5">
                          <ImageIcon className="h-4 w-4 text-primary" />
                          <span>صورة اللوحة في الطباعة</span>
                        </Label>
                        <div className="text-[10px] text-muted-foreground">
                          تحديد طريقة عرض الموقع (صورة فعلية، صورة وخريطة، أو خريطة جغرافية فقط)
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                        {[
                          { id: 'actual_image', title: 'صورة فعلية', desc: 'عرض الصورة الميدانية الملتقطة للوحة بالكامل', icon: Camera },
                          { id: 'map_pin', title: 'صورة وخريطة (نصفين)', desc: 'تقسيم بطاقة الموقع إلى نصف صورة ونصف خريطة جغرافية', icon: MapPin },
                          { id: 'map_only', title: 'خريطة فقط', desc: 'عرض الموقع عبر الخريطة الجغرافية بدون صور', icon: LayoutGrid }
                        ].map(opt => {
                          const IconComp = opt.icon;
                          const isSelected = printImageSource === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setPrintImageSource(opt.id as any)}
                              className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between h-28 ${
                                isSelected
                                  ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/30 shadow-md'
                                  : 'border-border/20 bg-background hover:bg-muted/40 text-muted-foreground'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className={`text-xs font-black ${isSelected ? 'text-primary' : 'text-foreground'}`}>{opt.title}</span>
                                <IconComp className={`h-5 w-5 ${isSelected ? 'text-primary' : 'opacity-40'}`} />
                              </div>
                              <span className="text-[11px] leading-relaxed opacity-80">{opt.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Rows per page controller for summary table */}
                    <div className="p-4 border border-border/20 rounded-2xl bg-card space-y-3.5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="summary_rows_per_page" className="text-xs font-black text-foreground flex items-center gap-1.5">
                            <List className="h-4 w-4 text-primary" />
                            <span>عدد الصفوف في جدول الملخص</span>
                          </Label>
                          <div className="text-[10px] text-muted-foreground">
                            تحديد عدد اللوحات بكل صفحة في جدول ملخص اللوحات (الافتراضي: 17)
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-xl border-border/30 font-black text-base"
                            onClick={() => setSummaryRowsPerPage(prev => Math.max(1, prev - 1))}
                          >
                            -
                          </Button>
                          <Input
                            id="summary_rows_per_page"
                            type="number"
                            min={1}
                            max={50}
                            value={summaryRowsPerPage}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setSummaryRowsPerPage(isNaN(val) ? 17 : Math.max(1, Math.min(50, val)));
                            }}
                            className="h-9 w-20 text-center font-black text-sm rounded-xl bg-background border-border/30"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-xl border-border/30 font-black text-base"
                            onClick={() => setSummaryRowsPerPage(prev => Math.min(50, prev + 1))}
                          >
                            +
                          </Button>
                        </div>
                      </div>

                      {/* Quick Presets & Page count preview */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/10">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground">خيارات سريعة:</span>
                          {[10, 12, 15, 17, 20, 25].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setSummaryRowsPerPage(num)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                summaryRowsPerPage === num
                                  ? 'bg-primary text-primary-foreground shadow-sm'
                                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                              }`}
                            >
                              {num} {num === 17 ? '(افتراضي)' : ''}
                            </button>
                          ))}
                        </div>
                        <div className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-xl">
                          صفحات الملخص: {Math.max(1, Math.ceil(currentCollection.items.length / (summaryRowsPerPage || 17)))} صفحة
                        </div>
                      </div>
                    </div>

                    {/* Switches Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="flex items-center justify-between p-3.5 border border-border/20 rounded-2xl bg-card">
                        <Label htmlFor="faces_count_show" className="text-xs font-bold text-foreground">عرض الأوجه</Label>
                        <Switch 
                          id="faces_count_show" 
                          checked={customSettings.faces_count_show !== 'false'} 
                          onCheckedChange={async (v) => {
                            await saveSettings({ faces_count_show: v ? 'true' : 'false' });
                          }} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3.5 border border-border/20 rounded-2xl bg-card">
                        <Label htmlFor="show_status_in_print" className="text-xs font-bold text-foreground">عرض الحالة</Label>
                        <Switch id="show_status_in_print" checked={showStatusInPrint} onCheckedChange={(v) => updateAndSaveStatusSetting('mun_show_status', v ? 'true' : 'false')} />
                      </div>

                      <div className="flex items-center justify-between p-3.5 border border-border/20 rounded-2xl bg-card">
                        <Label htmlFor="show_height_in_print" className="text-xs font-bold text-foreground">عرض الارتفاع</Label>
                        <Switch id="show_height_in_print" checked={showHeightInPrint} onCheckedChange={setShowHeightInPrint} />
                      </div>

                      <div className="flex items-center justify-between p-3.5 border border-border/20 rounded-2xl bg-card">
                        <Label htmlFor="show_size_dimension_labels" className="text-xs font-bold text-foreground">كلمات المقاس (طول/عرض)</Label>
                        <Switch 
                          id="show_size_dimension_labels" 
                          checked={customSettings.show_size_dimension_labels === 'true'} 
                          onCheckedChange={async (v) => {
                            await saveSettings({ show_size_dimension_labels: v ? 'true' : 'false' });
                          }} 
                        />
                      </div>
                    </div>

                    {customSettings.faces_count_show === 'false' && (
                      <div className="p-3.5 border border-amber-500/30 rounded-2xl bg-amber-500/10 flex items-center justify-between animate-in fade-in duration-200">
                        <div className="flex flex-col gap-0.5">
                          <Label htmlFor="calc_meters_as_single_face" className="text-xs font-bold text-amber-700 dark:text-amber-300">
                            حساب وإظهار إجمالي الأمتار (كوجه واحد)
                          </Label>
                          <span className="text-[10px] text-muted-foreground">
                            عند التفعيل، يظهر إجمالي المساحة في المستند بحسابه كوجه واحد (طول × عرض). وعند إيقافه لا يظهر إجمالي الأمتار إطلاقاً.
                          </span>
                        </div>
                        <Switch 
                          id="calc_meters_as_single_face" 
                          checked={customSettings.calc_meters_as_single_face === 'true'} 
                          onCheckedChange={async (v) => {
                            await saveSettings({ calc_meters_as_single_face: v ? 'true' : 'false' });
                          }} 
                        />
                      </div>
                    )}

                  </div>
                )}

                {/* ── TAB 3: STATUS BADGE & APPEARANCE ── */}
                {printStudioTab === 'status' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="p-4 border border-border/20 rounded-2xl bg-card space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-border/10 pb-3">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-black text-foreground flex items-center gap-1.5">
                            <Tag className="h-4 w-4 text-primary" />
                            <span>تخصيص موضع وتصميم شارة الحالة</span>
                          </Label>
                          <div className="text-[10px] text-muted-foreground">
                            التحكم في موضع الشارة (متاحة، مؤجرة، صيانة) ولونها وحجمها داخل بطاقات اللوحات
                          </div>
                        </div>
                        <Switch id="show_status_in_print_tab" checked={showStatusInPrint} onCheckedChange={(v) => updateAndSaveStatusSetting('mun_show_status', v ? 'true' : 'false')} />
                      </div>

                      {showStatusInPrint ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          <div className="space-y-1.5 md:col-span-2">
                            <Label className="font-bold text-xs text-muted-foreground">الموقع في بطاقة اللوحة</Label>
                            <Select value={statusPosition} onValueChange={(v) => updateAndSaveStatusSetting('mun_status_position', v)}>
                              <SelectTrigger className="h-10 rounded-xl bg-background border-border/30 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl border-border/20 bg-popover text-xs">
                                <SelectItem value="below_number">تحت رقم اللوحة</SelectItem>
                                <SelectItem value="above_number">فوق رقم اللوحة</SelectItem>
                                <SelectItem value="beside_number">بجانب رقم اللوحة</SelectItem>
                                <SelectItem value="header">في رأس الصفحة</SelectItem>
                                <SelectItem value="footer">في تذييل الصفحة</SelectItem>
                                <SelectItem value="custom">موقع مخصص (إحداثيات حرّة)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {statusPosition === 'custom' ? (
                            <>
                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-muted-foreground">موضع رأسي (Top mm)</Label>
                                <Input value={statusTop} onChange={e => updateAndSaveStatusSetting('mun_status_top', e.target.value)} className="h-10 text-xs rounded-xl bg-background border-border/30 font-mono" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-muted-foreground">موضع أفقي (Left %)</Label>
                                <Input value={statusLeft} onChange={e => updateAndSaveStatusSetting('mun_status_left', e.target.value)} className="h-10 text-xs rounded-xl bg-background border-border/30 font-mono" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-muted-foreground">حجم الخط (Size px)</Label>
                                <Input value={statusFontSize} onChange={e => updateAndSaveStatusSetting('mun_status_font_size', e.target.value)} className="h-10 text-xs rounded-xl bg-background border-border/30 font-mono" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-muted-foreground">لون شارة الحالة</Label>
                                <Input type="color" value={statusColor} onChange={e => updateAndSaveStatusSetting('mun_status_color', e.target.value)} className="h-10 p-1 rounded-xl bg-background border-border/30 w-full cursor-pointer" />
                              </div>
                            </>
                          ) : (
                            (statusPosition === 'below_number' || statusPosition === 'above_number' || statusPosition === 'beside_number') && (
                              <div className="space-y-1 md:col-span-2">
                                <Label className="text-[11px] font-bold text-muted-foreground">البُعد عن الرقم (Gap mm)</Label>
                                <Input value={statusGap} onChange={e => updateAndSaveStatusSetting('mun_status_gap', e.target.value)} className="h-10 text-xs rounded-xl bg-background border-border/30 font-mono" />
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground text-xs bg-muted/20 rounded-xl border border-dashed border-border/30">
                          شارة الحالة معطلة حالياً. يمكنك تفعيلها من المفتاح بالأعلى لتخصيص مظهرها.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── TAB 4: BACKGROUND SHEET TEMPLATE ── */}
                {printStudioTab === 'background' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="p-4 border border-border/20 rounded-2xl bg-card space-y-3 shadow-sm">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-black text-foreground flex items-center gap-1.5">
                          <FileSpreadsheet className="h-4 w-4 text-primary" />
                          <span>قالب ورقة الخلفية والهوية الرسمية</span>
                        </Label>
                        <div className="text-[10px] text-muted-foreground">
                          اختيار ورقة الخلفية الرسمية مع الترويسة والترقيم للبلدية
                        </div>
                      </div>
                      <BackgroundSelector 
                        value={customBackgroundUrl} 
                        onChange={(newUrl) => {
                          setCustomBackgroundUrl(newUrl);
                          const bg = printBackgrounds.find(b => b.url === newUrl);
                          if (bg) {
                            toast.info(`تم تطبيق قالب "${bg.name}" وربط شعاره تلقائياً`);
                          }
                        }} 
                      />
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="px-6 py-3.5 border-t border-border/20 bg-card flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs font-bold text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>جاهز لتوليد وطباعة المستند بجودة عالية</span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowPrintDialog(false)}
                className="rounded-xl h-10 text-muted-foreground hover:bg-muted text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                onClick={handlePrint}
                disabled={printLoading}
                className="rounded-xl h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/95 font-black gap-2 text-xs shadow-md"
              >
                <Printer className="h-4 w-4" />
                {printLoading ? 'جاري تصدير القوالب...' : 'توليد ملف الطباعة للكل'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk status dialog */}
      <Dialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
        <DialogContent className="max-w-md border-border/15 rounded-3xl bg-background/98 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-bold">
              {bulkStatusTarget === 'all' ? 'تغيير حالة جميع اللوحات' : `تغيير حالة ${selectedItems.size} لوحة محددة`}
            </DialogTitle>
            <DialogDescription className="sr-only">تحديد وتحديث الحالة الجماعية للوحات المختارة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">اختر حالة جاهزة</Label>
              <Select value={bulkStatusValue} onValueChange={(v) => { setBulkStatusValue(v); setBulkStatusCustom(''); }}>
                <SelectTrigger className="rounded-xl border-border/15 bg-background/50 h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md">
                  <SelectItem value="تم التركيب">تم التركيب</SelectItem>
                  <SelectItem value="لم يتم التركيب">لم يتم التركيب</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">أو أدخل حالة مخصصة</Label>
              <Input
                value={bulkStatusCustom}
                onChange={e => setBulkStatusCustom(e.target.value)}
                placeholder="مثلاً: قيد الصيانة بعد 1 يونيو"
                className="rounded-xl border-border/15 bg-background/50 h-10 text-sm"
              />
              <div className="text-[10px] text-muted-foreground">عند إدخال نص مخصص سيُستخدم كحالة رسمية بدلاً من القيمة الجاهزة المحددة أعلاه.</div>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowBulkStatusDialog(false)} className="rounded-xl h-10">إلغاء</Button>
            <Button onClick={() => {
              const finalStatus = (bulkStatusCustom.trim() || bulkStatusValue).trim();
              if (!finalStatus) { toast.error('يرجى تحديد أو إدخال حالة'); return; }
              setCurrentCollection(prev => ({
                ...prev,
                items: prev.items.map(item => {
                  if (bulkStatusTarget === 'all' || selectedItems.has(item.sequence_number)) {
                    return { ...item, status: finalStatus };
                  }
                  return item;
                }),
              }));
              const count = bulkStatusTarget === 'all' ? currentCollection.items.length : selectedItems.size;
              toast.success(`تم تحديث حالة ${count} لوحة إلى "${finalStatus}"`);
              setShowBulkStatusDialog(false);
            }} className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white">تطبيق الحالة الجديدة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Municipality import dialog */}
      <Dialog open={showMunicipalityImportDialog} onOpenChange={setShowMunicipalityImportDialog}>
        <DialogContent className="max-w-md border-border/15 rounded-3xl bg-background/98 backdrop-blur-md flex flex-col max-h-[80vh] p-6">
          <DialogHeader className="shrink-0 pb-2 border-b border-border/10">
            <DialogTitle className="font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              <span>جلب لوحات بلدية كاملة</span>
            </DialogTitle>
            <DialogDescription className="sr-only">اختر البلدية لاستيراد كافة اللوحات التابعة لها</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="relative shrink-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchMunicipality}
                onChange={e => setSearchMunicipality(e.target.value)}
                placeholder="بحث عن بلدية..."
                className="rounded-xl border-border/15 bg-background/50 h-10 pr-9.5 text-sm"
              />
            </div>
            
            <div className="flex-1 overflow-hidden border border-border/15 rounded-2xl bg-background/30">
              <ScrollArea className="h-full">
                <div className="space-y-2 p-3">
                  {loadingBillboards && (
                    <div className="text-center py-10 text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
                      <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                      <span>جاري تحميل كافة اللوحات من السيرفر ({loadedBillboardsCount} لوحة)...</span>
                    </div>
                  )}
                  {!loadingBillboards && municipalities
                    .filter(m => !searchMunicipality || m.includes(searchMunicipality))
                    .map(m => {
                      const count = allBillboards.filter(b => b.Municipality === m).length;
                      return (
                        <div
                          key={m}
                          className="flex items-center justify-between p-3.5 border border-border/10 rounded-2xl hover:bg-muted/60 hover:border-indigo-500/10 cursor-pointer transition-all group/mun"
                          onClick={() => importByMunicipality(m)}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-indigo-500/5 text-indigo-500 group-hover/mun:bg-indigo-500 group-hover/mun:text-white transition-colors">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-sm text-foreground/90">{m}</span>
                          </div>
                          <Badge variant="secondary" className="rounded-lg font-mono text-xs">{count} لوحة</Badge>
                        </div>
                      );
                    })}
                  {!loadingBillboards && municipalities.filter(m => !searchMunicipality || m.includes(searchMunicipality)).length === 0 && (
                    <p className="text-center text-muted-foreground py-10 text-xs">لا توجد بلديات مطابقة للبحث</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excel municipality name dialog */}
      <Dialog open={showExcelMunicipalityDialog} onOpenChange={(open) => { if (!open) { setShowExcelMunicipalityDialog(false); setExcelPendingItems([]); } }}>
        <DialogContent className="max-w-sm border-border/15 rounded-3xl bg-background/98 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-bold">تسمية البلدية المستوردة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              تم بنجاح قراءة <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{excelPendingItems.length}</strong> لوحة من الملف المرفوع. الرجاء تحديد اسم البلدية لربط القائمة المستوردة بها.
            </DialogDescription>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">اسم البلدية المرتبطة *</Label>
              <Input
                value={excelMunicipalityName}
                onChange={e => setExcelMunicipalityName(e.target.value)}
                placeholder="مثال: طرابلس المركز"
                autoFocus
                className="rounded-xl border-border/15 bg-background/50 h-10 text-sm font-medium"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => { setShowExcelMunicipalityDialog(false); setExcelPendingItems([]); }} className="rounded-xl h-10">إلغاء</Button>
            <Button onClick={confirmExcelImport} className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white">
              تأكيد الاستيراد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Column Mapping Dialog */}
      <ExcelColumnMappingDialog
        open={showColumnMappingDialog}
        onOpenChange={(open) => { if (!open) { setShowColumnMappingDialog(false); setExcelRawRows([]); setExcelHeaders([]); } }}
        headers={excelHeaders}
        sampleRows={excelRawRows}
        onConfirm={handleColumnMappingConfirm}
      />

      <MunicipalityPrintSettingsDialog
        open={showPrintSettings}
        onOpenChange={setShowPrintSettings}
        backgroundUrl={customBackgroundUrl}
        items={currentCollection.items}
        onSaveSuccess={refetch}
      />

      <MunicipalityStickerSettings
        open={showStickerSettings}
        onOpenChange={setShowStickerSettings}
        onSettingsChange={() => reloadStickerSettings()}
      />

      {/* Municipality Import Configuration Dialog */}
      <Dialog open={showImportConfigDialog} onOpenChange={setShowImportConfigDialog}>
        <DialogContent className="max-w-xl border-border/15 rounded-3xl bg-background/98 backdrop-blur-md flex flex-col max-h-[85vh] p-6">
          <DialogHeader className="shrink-0 pb-2 border-b border-border/10">
            <DialogTitle className="font-bold flex items-center gap-2 text-foreground">
              <Settings2 className="h-5 w-5 text-indigo-500" />
              <span>إعدادات استيراد بلدية {selectedMunicipalityForImport}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed shrink-0">
              يرجى مراجعة وتعديل مقاسات اللوحات التي سيتم استيرادها. يمكنك الإبقاء على المقاس كما هو، أو تغييره لمقاس آخر (من القائمة أو بالكتابة يدوياً):
            </DialogDescription>

            <div className="flex-1 overflow-hidden border border-border/15 rounded-2xl bg-muted/10 p-1">
              <ScrollArea className="h-full">
                <div className="space-y-3 p-3">
                  {municipalitySizesWithCounts.map(({ size, count }) => {
                    const currentTarget = sizeMappings[size] || size;
                    return (
                      <div key={size} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 border border-border/10 rounded-2xl bg-background/50 hover:bg-background/80 transition-all">
                        {/* Size and Count Info */}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="rounded-xl px-2.5 py-1 text-xs border-indigo-500/20 bg-indigo-500/[0.02] text-indigo-600 dark:text-indigo-400 font-semibold font-mono">
                            {size}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            ({count} لوحة)
                          </span>
                        </div>

                        {/* Mapping inputs */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-semibold shrink-0">تغيير إلى:</span>
                          
                          {/* Target Select */}
                          <Select
                            value={currentTarget}
                            onValueChange={(val) => {
                              setSizeMappings(prev => ({ ...prev, [size]: val }));
                            }}
                          >
                            <SelectTrigger className="h-9 w-32 rounded-xl bg-background/50 border-border/15 focus:ring-indigo-500 text-xs font-semibold">
                              <SelectValue placeholder="اختر المقاس" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/15 bg-popover/95 backdrop-blur-md max-h-56">
                              {[...new Set([
                                currentTarget,
                                ...municipalitySizesWithCounts.map(x => x.size),
                                ...dbSizes
                              ])].filter(Boolean).map(s => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Manual Input */}
                          <Input
                            value={currentTarget}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSizeMappings(prev => ({ ...prev, [size]: val }));
                            }}
                            placeholder="كتابة يدوية..."
                            className="h-9 w-28 rounded-xl bg-background/50 border-border/15 text-xs font-semibold"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="text-[11px] text-muted-foreground bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-3 leading-relaxed shrink-0">
              * سيتم استيراد كافة اللوحات وتطبيق ترتيبها تلقائياً تِبعاً لتسلسل المقاسات المعتمد في إعدادات النظام.
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportConfigDialog(false);
                setSelectedMunicipalityForImport(null);
              }}
              className="rounded-xl h-10 cursor-pointer"
            >
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (selectedMunicipalityForImport) {
                  executeImportByMunicipality(selectedMunicipalityForImport);
                }
              }}
              className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            >
              تأكيد الاستيراد والترتيب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Billboards Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-md border-border/15 rounded-3xl bg-background/98 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-bold flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-indigo-500" />
              <span>نقل اللوحات في القائمة</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {moveSourceSeqs.length === 1 
                ? `أنت تقوم بنقل اللوحة رقم (${moveSourceSeqs[0]}) إلى موضع جديد في القائمة بدون استبدال.`
                : `أنت تقوم بنقل (${moveSourceSeqs.length}) لوحة محددة إلى موضع جديد في القائمة دفعة واحدة.`}
            </DialogDescription>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">رقم اللوحة المستهدفة (المنقول إليها):</Label>
              <Input
                type="number"
                min={1}
                max={currentCollection.items.length}
                value={moveTargetSeq}
                onChange={(e) => setMoveTargetSeq(e.target.value ? Number(e.target.value) : '')}
                placeholder="أدخل رقم اللوحة..."
                className="h-10 rounded-xl bg-background/50 border-border/15 focus-visible:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">موضع اللوحات المنقولة بالنسبة للمستهدفة:</Label>
              <RadioGroup
                value={movePosition}
                onValueChange={(val: 'above' | 'below') => setMovePosition(val)}
                className="flex items-center gap-6"
              >
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="above" id="pos_above" />
                  <Label htmlFor="pos_above" className="text-xs font-medium cursor-pointer">فوق الرقم (قبل اللوحة)</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="below" id="pos_below" />
                  <Label htmlFor="pos_below" className="text-xs font-medium cursor-pointer">تحت الرقم (بعد اللوحة)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-border/20 bg-card/45"
              onClick={() => setShowMoveDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={executeMoveBillboards}
            >
              تأكيد النقل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Image Zoom Lightbox Modal ─── */}
      <Dialog open={!!zoomImageModalUrl} onOpenChange={(open) => { if (!open) { setZoomImageModalUrl(null); setZoomScale(1); } }}>
        <DialogContent className="max-w-4xl border-border/10 rounded-3xl bg-black/95 backdrop-blur-2xl shadow-2xl p-0 overflow-hidden text-white flex flex-col items-center">
          {/* Header */}
          <div className="w-full px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Eye className="h-4 w-4 text-emerald-400" />
              معاينة وتكبير صورة اللوحة
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomScale(s => Math.min(3.5, s + 0.25))}
                className="h-8 w-8 p-0 text-white hover:bg-white/10 rounded-lg"
                title="تكبير (+)"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomScale(s => Math.max(0.5, s - 0.25))}
                className="h-8 w-8 p-0 text-white hover:bg-white/10 rounded-lg"
                title="تصغير (-)"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomScale(1)}
                className="h-8 text-xs text-white/70 hover:bg-white/10 px-2 rounded-lg"
              >
                إعادة ضبط (100%)
              </Button>
              {zoomImageModalUrl && (
                <a
                  href={zoomImageModalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 px-2 flex items-center gap-1 text-xs text-indigo-300 hover:bg-white/10 rounded-lg transition-colors"
                  title="فتح الحجم الكامل في تبويب جديد"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  الرابط الأصلي
                </a>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setZoomImageModalUrl(null); setZoomScale(1); }}
                className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Image Container with Smooth Scaling */}
          <div className="w-full h-[75vh] p-6 flex items-center justify-center overflow-auto cursor-grab active:cursor-grabbing">
            {zoomImageModalUrl && (
              <img
                src={zoomImageModalUrl}
                alt="صورة اللوحة"
                style={{ transform: `scale(${zoomScale})`, transition: 'transform 0.2s ease-out' }}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl select-none"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
