import React, { useRef, useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Image as ImageIcon,
  Palette,
  Upload,
  Sparkles,
  Check,
  RotateCcw,
  MapPin,
  Type,
  MoveVertical,
  MoveHorizontal,
  FlipVertical,
  Wand2,
  Maximize2,
  Minimize2,
  AlignCenterHorizontal,
  AlignCenterVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Layers,
  LayoutGrid,
  Columns,
  Sliders,
  Lock,
  Unlock,
  ZoomIn,
} from 'lucide-react';
import {
  LOCATION_STRIP_PRESETS,
  LOCATION_TEXT_COLOR_THEMES,
  LocationStripPreset,
  LocationTextColorTheme,
} from './locationStripPresets';
import {
  TEXT_BACKGROUND_PRESETS,
  applyTextBackgroundToElement,
} from './textBackgroundPresets';
import {
  autoHarmonizeFromImageUrl,
  generateHarmoniousColors,
  alignLocationTextsVertically,
  HarmonizedColors,
} from './locationHarmonizer';
import { CanvasElement } from './types';

interface LocationStripControlsProps {
  locationStrip: any;
  setLocationStrip: React.Dispatch<React.SetStateAction<any>>;
  textElements: CanvasElement[];
  setTextElements: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  glassPanel?: any;
  setGlassPanel?: React.Dispatch<React.SetStateAction<any>>;
  canvasWidth?: number;
  canvasHeight?: number;
}

export function LocationStripControls({
  locationStrip,
  setLocationStrip,
  textElements,
  setTextElements,
  glassPanel,
  setGlassPanel,
  canvasWidth = 1500,
  canvasHeight = 2000,
}: LocationStripControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Layout Mode: 'unified' (شريط موحد شامل يحمل المقاس والحملة والموقع) | 'separate' (شريطين منفصلين)
  // When locationStrip is hidden, we are in Unified Master Strip mode
  const isUnified = locationStrip.visible === false;

  // Unified variant: 'stacked' (المقاس والحملة بالأعلى + المنطقة والعنوان بالأسفل) | 'columns' (5 أعمدة متجاورة)
  const [unifiedVariant, setUnifiedVariant] = useState<'stacked' | 'columns'>('stacked');

  // Lock writings in place during background resizing or shifting (default true)
  const [lockTextsInPlace, setLockTextsInPlace] = useState<boolean>(true);

  // Active Strip tab in separate mode: 'panel' (العلوي) | 'location' (السفلي) | 'both' (كلاهما)
  const [activeStrip, setActiveStrip] = useState<'panel' | 'location' | 'both'>(
    isUnified ? 'panel' : 'panel'
  );

  // Palette & Harmonizer state
  const [extractedPalette, setExtractedPalette] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [primaryColor, setPrimaryColor] = useState<string>('#d6ac40');
  const [currentLuminance, setCurrentLuminance] = useState<'light' | 'dark'>('dark');

  // Text line spacing between municipality_region and landmark
  const [textLineSpacing, setTextLineSpacing] = useState<number>(34);

  // Current Y position of municipality_region
  const currentY =
    textElements.find((el) => el.id === 'municipality_region')?.y ?? 20;

  // Active strip background image URL
  const activeBgUrl =
    glassPanel?.bgMode === 'image' && glassPanel?.bgImageUrl
      ? glassPanel.bgImageUrl
      : locationStrip?.bgImageUrl || '';

  // Auto-extract palette when active background image changes
  useEffect(() => {
    if (activeBgUrl) {
      autoHarmonizeFromImageUrl(activeBgUrl)
        .then(({ palette, bgType }) => {
          setExtractedPalette(palette);
          setCurrentLuminance(bgType);
          if (palette.length > 0) {
            setPrimaryColor(palette[0]);
          }
        })
        .catch(() => {});
    }
  }, [activeBgUrl]);

  // ═════════════════════════════════════════════════════════════
  // 1A. UNIFIED MASTER STRIP: النمط الطابقي (المقاس والحملة بالأعلى + المنطقة والعنوان في الأسفل)
  // ═════════════════════════════════════════════════════════════

  const handleActivateUnifiedStacked = (overrideImg?: string, objectFit: 'fill' | 'cover' | 'contain' = 'fill') => {
    setUnifiedVariant('stacked');
    setLocationStrip((prev: any) => ({ ...prev, visible: false }));

    const ribbonImg =
      overrideImg || glassPanel?.bgImageUrl || locationStrip?.bgImageUrl || LOCATION_STRIP_PRESETS[0].imageUrl;

    const bannerHeight = 340;
    const bannerY = Math.max(0, canvasHeight - bannerHeight);

    if (setGlassPanel) {
      setGlassPanel((prev: any) => ({
        ...prev,
        visible: true,
        x: 0,
        y: bannerY,
        width: canvasWidth,
        height: bannerHeight,
        borderRadius: 0,
        borderWidth: 0,
        bgMode: 'image',
        bgImageUrl: ribbonImg,
        bgObjectFit: objectFit || prev.bgObjectFit || 'fill',
        bgScale: prev.bgScale ?? 1,
        bgOffsetY: prev.bgOffsetY ?? 0,
        opacity: prev.opacity ?? 1,
      }));
    }

    const cw = canvasWidth;
    const scale = cw / 1500;

    setTextElements((prev) =>
      prev.map((el) => {
        // Upper Row: Logo, Campaign, Size, Contacts
        if (el.id === 'company_logo') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(160 * scale),
            y: 40,
            width: 120,
            height: 120,
            alignment: 'center',
          };
        }
        if (el.id === 'campaign_label') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(560 * scale),
            y: 35,
            fontSize: 18,
            alignment: 'center',
          };
        }
        if (el.id === 'client_name') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(560 * scale),
            y: 78,
            fontSize: 32,
            fontWeight: '700',
            alignment: 'center',
          };
        }
        if (el.id === 'ad_type') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(560 * scale),
            y: 128,
            fontSize: 20,
            alignment: 'center',
          };
        }
        if (el.id === 'size_label') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(960 * scale),
            y: 38,
            fontSize: 18,
            alignment: 'center',
          };
        }
        if (el.id === 'size') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(960 * scale),
            y: 90,
            fontSize: 46,
            fontWeight: '700',
            alignment: 'center',
          };
        }
        if (el.id === 'phone') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(1440 * scale),
            y: 50,
            fontSize: 20,
            alignment: 'right',
          };
        }
        if (el.id === 'website') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(1440 * scale),
            y: 100,
            fontSize: 20,
            alignment: 'right',
          };
        }
        // Lower Row: Region & Address at the bottom (المنطقة والعنوان في الأسفل)
        if (el.id === 'municipality_region') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(750 * scale),
            y: 200,
            fontSize: 28,
            fontWeight: '700',
            alignment: 'center',
            icon: 'map-pin',
            iconSize: 22,
          };
        }
        if (el.id === 'landmark') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(750 * scale),
            y: 255,
            fontSize: 20,
            fontWeight: '500',
            alignment: 'center',
          };
        }
        return el;
      })
    );

    if (ribbonImg) {
      autoHarmonizeFromImageUrl(ribbonImg)
        .then(({ colors, palette, bgType }) => {
          setExtractedPalette(palette);
          setCurrentLuminance(bgType);
          setPrimaryColor(colors.primary);
          applyHarmoniousColorsToAll(colors);
        })
        .catch(() => {});
    }

    toast.success('تم تفعيل الشريط الموحد: المقاس والحملة بالأعلى + المنطقة والعنوان في الأسفل');
  };

  // ═════════════════════════════════════════════════════════════
  // 1B. UNIFIED MASTER STRIP: النمط الأفقي (5 أعمدة متجاورة)
  // ═════════════════════════════════════════════════════════════

  const handleActivateUnifiedColumns = (overrideImg?: string, objectFit: 'fill' | 'cover' | 'contain' = 'fill') => {
    setUnifiedVariant('columns');
    setLocationStrip((prev: any) => ({ ...prev, visible: false }));

    const ribbonImg =
      overrideImg || glassPanel?.bgImageUrl || locationStrip?.bgImageUrl || LOCATION_STRIP_PRESETS[0].imageUrl;

    const bannerHeight = 290;
    const bannerY = Math.max(0, canvasHeight - bannerHeight);

    if (setGlassPanel) {
      setGlassPanel((prev: any) => ({
        ...prev,
        visible: true,
        x: 0,
        y: bannerY,
        width: canvasWidth,
        height: bannerHeight,
        borderRadius: 0,
        borderWidth: 0,
        bgMode: 'image',
        bgImageUrl: ribbonImg,
        bgObjectFit: objectFit || prev.bgObjectFit || 'fill',
        bgScale: prev.bgScale ?? 1,
        bgOffsetY: prev.bgOffsetY ?? 0,
        opacity: prev.opacity ?? 1,
      }));
    }

    const cw = canvasWidth;
    const scale = cw / 1500;

    setTextElements((prev) =>
      prev.map((el) => {
        if (el.id === 'company_logo') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(135 * scale),
            y: 75,
            width: 130,
            height: 130,
            alignment: 'center',
          };
        }
        if (el.id === 'campaign_label') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(480 * scale),
            y: 55,
            fontSize: 18,
            alignment: 'center',
          };
        }
        if (el.id === 'client_name') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(480 * scale),
            y: 110,
            fontSize: 30,
            fontWeight: '700',
            alignment: 'center',
          };
        }
        if (el.id === 'ad_type') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(480 * scale),
            y: 175,
            fontSize: 20,
            alignment: 'center',
          };
        }
        if (el.id === 'size_label') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(820 * scale),
            y: 65,
            fontSize: 18,
            alignment: 'center',
          };
        }
        if (el.id === 'size') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(820 * scale),
            y: 125,
            fontSize: 44,
            fontWeight: '700',
            alignment: 'center',
          };
        }
        if (el.id === 'municipality_region') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(1140 * scale),
            y: 72,
            fontSize: 26,
            alignment: 'center',
          };
        }
        if (el.id === 'landmark') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(1140 * scale),
            y: 128,
            fontSize: 18,
            alignment: 'center',
          };
        }
        if (el.id === 'phone') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(1460 * scale),
            y: 75,
            fontSize: 20,
            alignment: 'right',
          };
        }
        if (el.id === 'website') {
          return {
            ...el,
            parentStrip: 'panel',
            x: Math.round(1460 * scale),
            y: 125,
            fontSize: 20,
            alignment: 'right',
          };
        }
        return el;
      })
    );

    if (ribbonImg) {
      autoHarmonizeFromImageUrl(ribbonImg)
        .then(({ colors, palette, bgType }) => {
          setExtractedPalette(palette);
          setCurrentLuminance(bgType);
          setPrimaryColor(colors.primary);
          applyHarmoniousColorsToAll(colors);
        })
        .catch(() => {});
    }

    toast.success('تم تفعيل الشريط الموحد: 5 أعمدة متجاورة على كامل العرض');
  };

  // Backwards compatibility alias
  const handleActivateUnifiedMasterStrip = () => handleActivateUnifiedStacked();

  // ═════════════════════════════════════════════════════════════
  // 1C. DECOUPLED BACKGROUND SIZING & POSITIONING (لا يحرك الكتابات ولا يغير حجمها)
  // ═════════════════════════════════════════════════════════════

  // Height change for background - does NOT move writings if lockTextsInPlace is active!
  const handleHeightChange = (newH: number) => {
    if (!setGlassPanel) return;
    const oldH = glassPanel?.height || 280;
    const oldY = glassPanel?.y ?? (canvasHeight - oldH);
    const isNearBottom = Math.abs(oldY + oldH - canvasHeight) < 40;
    let newY = oldY;
    if (isNearBottom) {
      newY = Math.max(0, canvasHeight - newH);
    }
    const deltaY = newY - oldY;

    if (lockTextsInPlace && deltaY !== 0) {
      setTextElements((prev) =>
        prev.map((el) =>
          el.parentStrip === 'panel' ? { ...el, y: el.y - deltaY } : el
        )
      );
    }

    setGlassPanel((p: any) => ({ ...p, height: newH, y: newY }));
  };

  // Y position change for background - does NOT move writings if lockTextsInPlace is active!
  const handleYChange = (newY: number) => {
    if (!setGlassPanel) return;
    const oldY = glassPanel?.y ?? 0;
    const deltaY = newY - oldY;

    if (lockTextsInPlace && deltaY !== 0) {
      setTextElements((prev) =>
        prev.map((el) =>
          el.parentStrip === 'panel' ? { ...el, y: el.y - deltaY } : el
        )
      );
    }

    setGlassPanel((p: any) => ({ ...p, y: newY }));
  };

  // Fine-tuning writings independently of background
  const handleNudgeWritings = (deltaY: number) => {
    setTextElements((prev) =>
      prev.map((el) =>
        el.parentStrip === 'panel' ? { ...el, y: el.y + deltaY } : el
      )
    );
    toast.success(deltaY < 0 ? 'تم رفع الكتابات للأعلى' : 'تم إنزال الكتابات للأسفل');
  };

  const handleCenterWritingsVertically = () => {
    const h = glassPanel?.height || 300;
    const panelEls = textElements.filter((el) => el.parentStrip === 'panel' && el.visible);
    if (panelEls.length === 0) return;
    const minY = Math.min(...panelEls.map((e) => e.y));
    const maxY = Math.max(...panelEls.map((e) => e.y + (e.height || e.fontSize || 24)));
    const contentH = maxY - minY;
    const targetTop = Math.max(10, Math.round((h - contentH) / 2));
    const shiftY = targetTop - minY;

    setTextElements((prev) =>
      prev.map((el) =>
        el.parentStrip === 'panel' ? { ...el, y: el.y + shiftY } : el
      )
    );
    toast.success('تم توسيط كافة الكتابات رأسياً داخل الخلفية');
  };

  const handleDeactivateUnifiedMode = () => {
    // 1. Re-enable the separate location strip
    setLocationStrip((prev: any) => ({
      ...prev,
      visible: true,
      x: 0,
      width: canvasWidth,
      height: 120,
      offsetY: 0,
    }));

    // 2. Position glassPanel right above locationStrip
    if (setGlassPanel) {
      setGlassPanel((prev: any) => ({
        ...prev,
        visible: true,
        x: 0,
        y: Math.max(0, canvasHeight - 120 - 280),
        width: canvasWidth,
        height: 280,
      }));
    }

    // 3. Move location texts back to locationStrip
    const cw = canvasWidth;
    const scale = cw / 1500;

    setTextElements((prev) =>
      prev.map((el) => {
        if (el.id === 'municipality_region') {
          return {
            ...el,
            parentStrip: 'location',
            x: Math.round(750 * scale),
            y: 20,
            alignment: 'center',
          };
        }
        if (el.id === 'landmark') {
          return {
            ...el,
            parentStrip: 'location',
            x: Math.round(750 * scale),
            y: 56,
            alignment: 'center',
          };
        }
        if (el.id === 'size_label') {
          return { ...el, x: Math.round(1035 * scale), y: 60 };
        }
        if (el.id === 'size') {
          return { ...el, x: Math.round(1035 * scale), y: 120 };
        }
        if (el.id === 'campaign_label') {
          return { ...el, x: Math.round(660 * scale), y: 40 };
        }
        if (el.id === 'client_name') {
          return { ...el, x: Math.round(660 * scale), y: 105 };
        }
        if (el.id === 'phone') {
          return { ...el, x: Math.round(1470 * scale), y: 60 };
        }
        if (el.id === 'website') {
          return { ...el, x: Math.round(1470 * scale), y: 110 };
        }
        return el;
      })
    );

    toast.success('تمت العودة لنظام الشريطين المنفصلين');
  };

  // ═════════════════════════════════════════════════════════════
  // 2. UNIFIED COLOR APPLICATION ACROSS ALL TEXTS (المقاس والحملة والموقع)
  // ═════════════════════════════════════════════════════════════

  const applyHarmoniousColorsToAll = (colors: HarmonizedColors) => {
    setLocationStrip((prev: any) => ({
      ...prev,
      textColor: colors.municipality,
    }));

    setTextElements((prev) =>
      prev.map((el) => {
        // Size & Size Label (المقاس)
        if (el.id === 'size') {
          return { ...el, fontColor: colors.primary };
        }
        if (el.id === 'size_label') {
          return { ...el, fontColor: colors.region };
        }
        // Campaign & Client (اسم الحملة)
        if (el.id === 'client_name') {
          return { ...el, fontColor: colors.municipality };
        }
        if (el.id === 'campaign_label') {
          return { ...el, fontColor: colors.region };
        }
        if (el.id === 'ad_type') {
          return { ...el, fontColor: colors.region };
        }
        // Location (الموقع)
        if (el.id === 'municipality_region') {
          return {
            ...el,
            fontColor: colors.municipality,
            parts: {
              separator: ' - ',
              municipality: { ...(el.parts?.municipality || {}), fontColor: colors.municipality },
              region: { ...(el.parts?.region || {}), fontColor: colors.region },
            },
          };
        }
        if (el.id === 'landmark') {
          return { ...el, fontColor: colors.landmark };
        }
        // Contacts & Icons (التواصل)
        if (el.id === 'phone' || el.id === 'website') {
          return {
            ...el,
            fontColor: colors.municipality,
            iconColor: colors.primary,
            iconBgColor: currentLuminance === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)',
          };
        }
        return el;
      })
    );
  };

  // Apply a Text Color Theme to ALL texts
  const applyTextColorTheme = (theme: LocationTextColorTheme) => {
    setLocationStrip((prev: any) => ({
      ...prev,
      textColor: theme.primaryColor,
      textColorTheme: theme.id,
    }));

    setTextElements((prev: CanvasElement[]) =>
      prev.map((el) => {
        if (el.id === 'size' || el.id === 'client_name' || el.id === 'phone' || el.id === 'website') {
          return { ...el, fontColor: theme.primaryColor };
        }
        if (el.id === 'size_label' || el.id === 'campaign_label' || el.id === 'ad_type' || el.id === 'landmark') {
          return { ...el, fontColor: theme.secondaryColor };
        }
        if (el.id === 'municipality_region') {
          return {
            ...el,
            fontColor: theme.primaryColor,
            parts: {
              separator: ' - ',
              municipality: { ...(el.parts?.municipality || {}), fontColor: theme.primaryColor },
              region: { ...(el.parts?.region || {}), fontColor: theme.secondaryColor },
            },
          };
        }
        return el;
      })
    );

    toast.success(`تم تطبيق نمط ألوان الكتابات: ${theme.name} على المقاس وكافة النصوص`);
  };

  // Apply a unified primary color with auto-generated secondary/accent tones
  const applyHarmoniousColorSystem = (chosenPrimary: string, notify = true) => {
    setPrimaryColor(chosenPrimary);
    const harm = generateHarmoniousColors(chosenPrimary, currentLuminance);
    applyHarmoniousColorsToAll(harm);

    if (notify) {
      toast.success('تم توليد ألوان الكتابات المتناغمة لكافة العناصر بنجاح');
    }
  };

  // Magic button: Automatically harmonize text colors directly from background image
  const handleAutoHarmonizeFromBackground = async () => {
    const activeUrl = activeBgUrl;
    if (!activeUrl) {
      toast.error('يرجى اختيار أو رفع خلفية شريط أولاً للمطابقة');
      return;
    }

    setIsExtracting(true);
    try {
      const { colors, palette, bgType } = await autoHarmonizeFromImageUrl(activeUrl);
      setExtractedPalette(palette);
      setCurrentLuminance(bgType);
      setPrimaryColor(colors.primary);
      applyHarmoniousColorsToAll(colors);

      toast.success(
        bgType === 'light'
          ? 'تمت مطابقة ألوان المقاس وكافة النصوص مع الخلفية الفاتحة (تباين عالي مريح)'
          : 'تمت مطابقة ألوان المقاس وكافة النصوص مع الخلفية الداكنة (سطوع وتناغم)'
      );
    } catch {
      toast.error('تعذر استخراج الألوان من الصورة');
    } finally {
      setIsExtracting(false);
    }
  };

  // Direct specific element color pickers
  const updateSpecificColor = (targetKey: 'size' | 'campaign' | 'location' | 'contacts', color: string) => {
    setTextElements((prev) =>
      prev.map((el) => {
        if (targetKey === 'size' && (el.id === 'size' || el.id === 'size_label')) {
          return { ...el, fontColor: color };
        }
        if (targetKey === 'campaign' && (el.id === 'client_name' || el.id === 'campaign_label' || el.id === 'ad_type')) {
          return { ...el, fontColor: color };
        }
        if (targetKey === 'location' && (el.id === 'municipality_region' || el.id === 'landmark')) {
          if (el.parts) {
            return {
              ...el,
              fontColor: color,
              parts: {
                ...el.parts,
                municipality: { ...(el.parts.municipality || {}), fontColor: color },
                region: { ...(el.parts.region || {}), fontColor: color },
              },
            };
          }
          return { ...el, fontColor: color };
        }
        if (targetKey === 'contacts' && (el.id === 'phone' || el.id === 'website')) {
          return { ...el, fontColor: color, iconColor: color };
        }
        return el;
      })
    );
  };

  // ── Full Screen Width (100% Canvas Width) ──
  const handleMakeFullWidth = (target: 'panel' | 'location' | 'both') => {
    if (target === 'panel' || target === 'both' || isUnified) {
      if (setGlassPanel) {
        setGlassPanel((p: any) => ({
          ...p,
          x: 0,
          width: canvasWidth,
          borderRadius: 0,
          bgObjectFit: 'fill',
        }));
      }
    }
    if ((target === 'location' || target === 'both') && !isUnified) {
      setLocationStrip((p: any) => ({
        ...p,
        x: 0,
        width: canvasWidth,
        borderRadius: 0,
        bgObjectFit: 'fill',
      }));
    }
    toast.success('تم ضبط الشريط ليمتد على كامل عرض الشاشة (100%) بنجاح');
  };

  // ── Apply background image according to activeStrip ──
  const applyBgToTargets = (
    imageUrl: string,
    objectFit: 'fill' | 'cover' | 'contain' = 'fill',
    height?: number
  ) => {
    if (isUnified) {
      // In unified mode, always apply to glassPanel
      if (setGlassPanel) {
        setGlassPanel((prev: any) => ({
          ...prev,
          bgMode: 'image',
          bgImageUrl: imageUrl,
          bgObjectFit: objectFit,
          x: 0,
          width: canvasWidth,
          borderRadius: 0,
          visible: true,
        }));
      }
      return;
    }

    const applyToLoc = activeStrip === 'location' || activeStrip === 'both';
    const applyToPanel = activeStrip === 'panel' || activeStrip === 'both';

    if (applyToPanel && setGlassPanel) {
      setGlassPanel((prev: any) => ({
        ...prev,
        bgMode: 'image',
        bgImageUrl: imageUrl,
        bgObjectFit: objectFit,
        x: 0,
        width: canvasWidth,
        borderRadius: 0,
        visible: true,
      }));
    }

    if (applyToLoc) {
      setLocationStrip((prev: any) => ({
        ...prev,
        bgMode: 'image',
        bgImageUrl: imageUrl,
        bgObjectFit: objectFit,
        x: 0,
        width: canvasWidth,
        borderRadius: 0,
        height: height || prev.height,
        visible: true,
      }));
    }
  };

  // ── Apply background image ONLY (no layout reset, no element movement) ──
  // Used when user is ALREADY in unified mode and just wants to swap the background image
  const applyBgImageOnly = (
    imageUrl: string,
    objectFit: 'fill' | 'cover' | 'contain' = 'fill'
  ) => {
    if (setGlassPanel) {
      setGlassPanel((prev: any) => ({
        ...prev,
        bgMode: 'image',
        bgImageUrl: imageUrl,
        bgObjectFit: objectFit,
      }));
    }
    // Harmonize colors from the new image without touching positions
    autoHarmonizeFromImageUrl(imageUrl)
      .then(({ colors, palette, bgType }) => {
        setExtractedPalette(palette);
        setCurrentLuminance(bgType);
        setPrimaryColor(colors.primary);
        applyHarmoniousColorsToAll(colors);
      })
      .catch(() => {});
  };

  // Apply a preset PNG strip
  const applyPresetStrip = (preset: LocationStripPreset) => {
    if (isUnified) {
      // Already in unified mode → only swap the background image, keep element positions
      applyBgImageOnly(preset.imageUrl, preset.objectFit);
      // Auto-apply recommended text theme
      const recTheme = LOCATION_TEXT_COLOR_THEMES.find(
        (t) => t.id === preset.recommendedTextColorTheme
      );
      if (recTheme) {
        applyTextColorTheme(recTheme);
      } else {
        applyHarmoniousColorSystem(preset.recommendedTextColor, false);
      }
    } else {
      // First time → perform full layout activation
      if (unifiedVariant === 'stacked') {
        handleActivateUnifiedStacked(preset.imageUrl, preset.objectFit);
      } else {
        handleActivateUnifiedColumns(preset.imageUrl, preset.objectFit);
      }
      // Auto-apply recommended text theme
      const recTheme = LOCATION_TEXT_COLOR_THEMES.find(
        (t) => t.id === preset.recommendedTextColorTheme
      );
      if (recTheme) {
        applyTextColorTheme(recTheme);
      } else {
        applyHarmoniousColorSystem(preset.recommendedTextColor, false);
      }
    }

    toast.success(`تم تطبيق ${preset.name} بكامل عرض الشاشة بنجاح`);
  };

  // Handle custom PNG upload from disk
  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح (PNG, WebP, SVG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        if (isUnified) {
          // Already in unified mode → only swap background, keep all element positions intact
          applyBgImageOnly(dataUrl, 'fill');
        } else {
          // First time → perform full layout activation
          if (unifiedVariant === 'stacked') {
            handleActivateUnifiedStacked(dataUrl, 'fill');
          } else {
            handleActivateUnifiedColumns(dataUrl, 'fill');
          }
        }

        toast.success('تم رفع خلفية الـ PNG وتطبيقها بكامل عرض الشاشة ومطابقة ألوان الكتابات');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Vertical position adjustment for location texts
  const handleVerticalPositionChange = (
    modeOrOffset: 'top' | 'center' | 'bottom' | number,
    spacing = textLineSpacing
  ) => {
    const h = isUnified ? glassPanel?.height || 280 : locationStrip.height;
    setTextElements((prev) =>
      alignLocationTextsVertically(prev, h, modeOrOffset, spacing)
    );
    if (typeof modeOrOffset === 'string') {
      const label =
        modeOrOffset === 'center' ? 'توسيط كامل' : modeOrOffset === 'top' ? 'أعلى' : 'أسفل';
      toast.success(`تم ضبط موضع نصوص الموقع: ${label}`);
    }
  };

  // Current values for direct pickers
  const sizeColor = textElements.find((e) => e.id === 'size')?.fontColor || '#ffffff';
  const campaignColor = textElements.find((e) => e.id === 'client_name')?.fontColor || '#ffffff';
  const locationColor = textElements.find((e) => e.id === 'municipality_region')?.fontColor || '#ffffff';
  const contactsColor = textElements.find((e) => e.id === 'phone')?.fontColor || '#ffffff';

  return (
    <div className="space-y-4" dir="rtl">
      {/* ═════════ 1. MASTER LAYOUT MODE TOGGLE ═════════ */}
      <div className="p-3 rounded-2xl bg-gradient-to-b from-primary/15 to-primary/5 border-2 border-primary/40 shadow-md space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-black text-foreground flex items-center gap-1.5">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <span>الهيكلية العامة للبطاقة وأشرطة العرض:</span>
          </Label>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
            {isUnified ? (unifiedVariant === 'stacked' ? 'شريط موحد: طابقي' : 'شريط موحد: أفقي') : 'شريطين منفصلين'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Option A: Unified Stacked (الموقع والعنوان في الأسفل) */}
          <button
            type="button"
            onClick={() => handleActivateUnifiedStacked()}
            className={`flex flex-col items-start p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
              isUnified && unifiedVariant === 'stacked'
                ? 'border-primary bg-primary/20 ring-2 ring-primary/50 shadow-sm text-foreground'
                : 'border-border/60 hover:border-primary/50 bg-background/70 text-muted-foreground'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>شريط موحد: المنطقة والعنوان بالأسفل</span>
            </div>
            <p className="text-[9px] mt-1 leading-relaxed opacity-85">
              موصى به: المقاس والحملة والشعار بالأعلى + المنطقة والعنوان بالأسفل فوق خلفية الـ PNG بكامل العرض
            </p>
          </button>

          {/* Option B: Unified Columns (أعمدة متجاورة) */}
          <button
            type="button"
            onClick={() => handleActivateUnifiedColumns()}
            className={`flex flex-col items-start p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
              isUnified && unifiedVariant === 'columns'
                ? 'border-primary bg-primary/20 ring-2 ring-primary/50 shadow-sm text-foreground'
                : 'border-border/60 hover:border-primary/50 bg-background/70 text-muted-foreground'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Columns className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>شريط موحد: 5 أعمدة متجاورة</span>
            </div>
            <p className="text-[9px] mt-1 leading-relaxed opacity-85">
              الشعار، الحملة، المقاس، الموقع، والتواصل في صف واحد متجاور
            </p>
          </button>

          {/* Option C: Separate Strips */}
          <button
            type="button"
            onClick={handleDeactivateUnifiedMode}
            className={`flex flex-col items-start p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
              !isUnified
                ? 'border-primary bg-primary/20 ring-2 ring-primary/50 shadow-sm text-foreground'
                : 'border-border/60 hover:border-primary/50 bg-background/70 text-muted-foreground'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>نظام الشريطين المنفصلين</span>
            </div>
            <p className="text-[9px] mt-1 leading-relaxed opacity-85">
              شريط علوي للمعلومات والمقاس + شريط سفلي مستقل للموقع الجغرافي
            </p>
          </button>
        </div>

        {isUnified && (
          <div className="flex items-center justify-between pt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
            <span>
              {unifiedVariant === 'stacked'
                ? 'النمط الحالي: المقاس والحملة بالأعلى + المنطقة والعنوان بالأسفل'
                : 'النمط الحالي: 5 أعمدة متجاورة فوق خلفية الـ PNG'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (unifiedVariant === 'stacked' ? handleActivateUnifiedStacked() : handleActivateUnifiedColumns())}
              className="h-6 text-[10px] font-bold px-2 rounded-lg border-emerald-500/40 hover:bg-emerald-500/10 gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>إعادة ضبط المحاذاة النموذجية</span>
            </Button>
          </div>
        )}
      </div>

      {/* ═════════ 2. FULL WIDTH & POSITIONING / DIMENSIONS ═════════ */}
      <div className="space-y-3 p-3 rounded-xl border border-primary/30 bg-card/80 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Maximize2 className="h-3.5 w-3.5 text-primary" />
            <span>عرض الشاشة والإزاحة والأبعاد</span>
          </span>
          <span className="text-[9px] font-mono text-primary font-bold">
            عرض اللوحة: {canvasWidth}px
          </span>
        </div>

        {/* Big One-Click Full Width Button */}
        <Button
          type="button"
          onClick={() => handleMakeFullWidth(activeStrip)}
          className="w-full h-9 text-xs font-bold gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <Maximize2 className="h-4 w-4" />
          <span>تمديد الشريط بكامل عرض الشاشة (100% Full Width)</span>
        </Button>

        {/* Lock Writings In Place Toggle */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/30">
          <div className="space-y-0.5 max-w-[80%]">
            <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>تثبيت موضع الكتابات عند تكبير أو تحريك الخلفية</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              عند تكبير ارتفاع الخلفية أو إزاحتها، تظل الكتابات ثابتة في مكانها تماماً ولا تتحرك معها
            </p>
          </div>
          <Switch
            checked={lockTextsInPlace}
            onCheckedChange={setLockTextsInPlace}
          />
        </div>

        {/* Position and Sizing Sliders */}
        <div className="space-y-2.5 p-2 rounded-lg bg-muted/40 border border-border/30">
          {/* Banner Height */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground font-medium">ارتفاع الشريط (تكبير الخلفية خلف الكتابات):</span>
              <span className="font-mono text-primary font-bold">{glassPanel?.height || 280}px</span>
            </div>
            <Slider
              min={150}
              max={650}
              step={5}
              value={[glassPanel?.height || 280]}
              onValueChange={([v]) => handleHeightChange(v)}
            />
          </div>

          {/* Upper / Unified Strip Y Position */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground font-medium">موضع الشريط الرأسي (Y):</span>
              <span className="font-mono text-primary font-bold">{glassPanel?.y || 0}px</span>
            </div>
            <Slider
              min={0}
              max={Math.max(100, canvasHeight - (glassPanel?.height || 280))}
              step={5}
              value={[glassPanel?.y || 0]}
              onValueChange={([v]) => handleYChange(v)}
            />
          </div>

          {/* Quick Snap Y Buttons */}
          <div className="grid grid-cols-3 gap-1 pt-1">
            <button
              type="button"
              onClick={() => handleYChange(0)}
              className="py-1 px-1 rounded text-[9px] font-bold border border-border/50 bg-background/60 hover:bg-muted text-center cursor-pointer"
            >
              أعلى الشاشة (0px)
            </button>
            <button
              type="button"
              onClick={() => handleYChange(Math.max(0, canvasHeight - (glassPanel?.height || 280)))}
              className="py-1 px-1 rounded text-[9px] font-bold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-center cursor-pointer"
            >
              أسفل الشاشة تماماً
            </button>
            <button
              type="button"
              onClick={() => handleYChange(Math.max(0, Math.round((canvasHeight - (glassPanel?.height || 280)) / 2)))}
              className="py-1 px-1 rounded text-[9px] font-bold border border-border/50 bg-background/60 hover:bg-muted text-center cursor-pointer"
            >
              منتصف اللوحة
            </button>
          </div>
        </div>

        {/* Independent Writings Adjustment Panel */}
        <div className="space-y-2 p-2.5 rounded-xl border border-primary/20 bg-muted/20">
          <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
            <span className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              <span>التحكم في موضع وتوسيط الكتابات:</span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleNudgeWritings(-10)}
              className="h-7 text-[10px] font-bold gap-1 rounded-lg border-border/50 hover:bg-primary/10 hover:border-primary/50"
            >
              <ArrowUp className="h-3 w-3" />
              <span>رفع الكتابات (+10)</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCenterWritingsVertically}
              className="h-7 text-[10px] font-bold gap-1 rounded-lg border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            >
              <AlignCenterVertical className="h-3 w-3" />
              <span>توسيط الكتابات</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleNudgeWritings(10)}
              className="h-7 text-[10px] font-bold gap-1 rounded-lg border-border/50 hover:bg-primary/10 hover:border-primary/50"
            >
              <ArrowDown className="h-3 w-3" />
              <span>إنزال الكتابات (-10)</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ═════════ 3. BACKGROUND IMAGE SELECTION & UPLOAD ═════════ */}
      <div className="space-y-3 p-3 rounded-xl border border-border/40 bg-card/70">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-primary" />
            <span>خلفية الشريط (نماذج PNG أو صورة مخصصة)</span>
          </Label>
          {activeBgUrl && (
            <button
              type="button"
              onClick={() => {
                if (setGlassPanel) setGlassPanel((p: any) => ({ ...p, bgMode: 'color', bgImageUrl: '' }));
                setLocationStrip((p: any) => ({ ...p, bgMode: 'color', bgImageUrl: '' }));
                toast.success('تمت إزالة خلفية الـ PNG');
              }}
              className="text-[10px] text-destructive hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              <span>إزالة الخلفية</span>
            </button>
          )}
        </div>

        {/* Ready Presets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LOCATION_STRIP_PRESETS.map((preset) => {
            const isSelected = activeBgUrl === preset.imageUrl;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPresetStrip(preset)}
                className={`group relative flex flex-col text-right p-2 rounded-xl border transition-all cursor-pointer overflow-hidden ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/40 bg-card shadow-md'
                    : 'border-border/50 hover:border-primary/50 bg-background/60'
                }`}
              >
                <div
                  className="w-full h-8 rounded-lg overflow-hidden relative border border-white/10 shadow-inner flex items-center justify-center px-2"
                  style={{ background: preset.previewGradient }}
                >
                  <span
                    className="text-[9px] font-bold truncate drop-shadow-sm"
                    style={{ color: preset.recommendedTextColor }}
                  >
                    معاينة الشريط
                  </span>
                  {isSelected && (
                    <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                  )}
                </div>

                <div className="mt-1.5">
                  <div className="text-[11px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {preset.name}
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate leading-tight">
                    {preset.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Upload Custom PNG Button */}
        <div className="pt-2 border-t border-border/30">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/webp,image/svg+xml,image/jpeg"
            className="hidden"
            onChange={handleCustomUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-9 text-xs font-bold gap-2 rounded-xl border-dashed border-primary/40 hover:bg-primary/10 hover:border-primary text-primary"
          >
            <Upload className="h-4 w-4" />
            <span>رفع شريط PNG مخصص وتطبيقه بكامل عرض الشاشة</span>
          </Button>
        </div>

        {/* Tuning Options for Image Mode */}
        {activeBgUrl && (
          <div className="space-y-2.5 pt-2 border-t border-border/30 text-xs">
            {/* Object Fit mode */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground font-medium">نمط ملاءمة صورة الخلفية:</span>
                <span className="font-mono text-primary font-bold">
                  {glassPanel?.bgObjectFit === 'cover' ? 'تغطية متناسقة (Cover)' : glassPanel?.bgObjectFit === 'contain' ? 'احتواء (Contain)' : 'تمدد كامل (Fill)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['fill', 'cover', 'contain'] as const).map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() => {
                      if (setGlassPanel) setGlassPanel((p: any) => ({ ...p, bgObjectFit: fit }));
                      setLocationStrip((p: any) => ({ ...p, bgObjectFit: fit }));
                    }}
                    className={`py-1 px-1.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                      (glassPanel?.bgObjectFit || 'fill') === fit
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border/50 bg-background/60 hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {fit === 'fill' ? 'تمدد كامل (Fill)' : fit === 'cover' ? 'تغطية (Cover)' : 'احتواء (Contain)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Image Scale / Zoom */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground font-medium">مقياس تكبير وتمدد صورة الشريط (Zoom):</span>
                <span className="font-mono text-primary font-bold">
                  {Math.round((glassPanel?.bgScale ?? 1) * 100)}%
                </span>
              </div>
              <Slider
                min={0.5}
                max={2.5}
                step={0.05}
                value={[glassPanel?.bgScale ?? 1]}
                onValueChange={([v]) => {
                  if (setGlassPanel) setGlassPanel((p: any) => ({ ...p, bgScale: v }));
                  setLocationStrip((p: any) => ({ ...p, bgScale: v }));
                }}
              />
            </div>

            {/* Background Image Vertical Offset */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground font-medium">إزاحة الصورة رأسياً داخل الخلفية:</span>
                <span className="font-mono text-primary font-bold">
                  {(glassPanel?.bgOffsetY ?? 0)}px
                </span>
              </div>
              <Slider
                min={-500}
                max={500}
                step={5}
                value={[glassPanel?.bgOffsetY ?? 0]}
                onValueChange={([v]) => {
                  if (setGlassPanel) setGlassPanel((p: any) => ({ ...p, bgOffsetY: v }));
                  setLocationStrip((p: any) => ({ ...p, bgOffsetY: v }));
                }}
              />
              <div className="grid grid-cols-2 gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (setGlassPanel) setGlassPanel((p: any) => ({ ...p, bgOffsetY: 0 }));
                    setLocationStrip((p: any) => ({ ...p, bgOffsetY: 0 }));
                  }}
                  className="py-1 rounded text-[9px] font-bold border border-border/50 bg-background/60 hover:bg-muted text-center cursor-pointer"
                >
                  توسيط (0px)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const offset = -(glassPanel?.height || 300) / 2;
                    if (setGlassPanel) setGlassPanel((p: any) => ({ ...p, bgOffsetY: offset }));
                    setLocationStrip((p: any) => ({ ...p, bgOffsetY: offset }));
                  }}
                  className="py-1 rounded text-[9px] font-bold border border-border/50 bg-background/60 hover:bg-muted text-center cursor-pointer"
                >
                  إزاحة للأعلى الكاملة
                </button>
              </div>
            </div>

            {/* Mirror Flip Toggle */}
            <div className="flex items-center justify-between pt-1 border-t border-border/20">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <FlipVertical className="h-3 w-3 text-primary" />
                <span>عكس اتجاه الشريط رأسياً (Mirror Flip)</span>
              </Label>
              <Switch
                checked={Boolean(glassPanel?.bgFlipY || locationStrip.bgFlipY)}
                onCheckedChange={(c) => {
                  if (setGlassPanel) setGlassPanel((p: any) => ({ ...p, bgFlipY: c }));
                  setLocationStrip((p: any) => ({ ...p, bgFlipY: c }));
                }}
              />
            </div>

            {/* Opacity */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground font-medium">شفافية خلفية الـ PNG:</span>
                <span className="font-mono text-primary font-bold">
                  {Math.round((glassPanel?.opacity ?? locationStrip.opacity ?? 1) * 100)}%
                </span>
              </div>
              <Slider
                min={0.1}
                max={1}
                step={0.05}
                value={[glassPanel?.opacity ?? locationStrip.opacity ?? 1]}
                onValueChange={([v]) => {
                  if (setGlassPanel) setGlassPanel((p: any) => ({ ...p, opacity: v }));
                  setLocationStrip((p: any) => ({ ...p, opacity: v }));
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ═════════ 4. 🎨 UNIFIED COLOR CONTROLS FOR ALL TEXTS (المقاس والحملة والموقع) ═════════ */}
      <div className="space-y-3 p-3 rounded-xl border-2 border-primary/30 bg-primary/[0.03]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Wand2 className="h-4 w-4 text-primary" />
            <span>التحكم في ألوان الكتابات (المقاس، الحملة، الموقع، التواصل)</span>
          </span>
          <span className="text-[9px] text-primary font-bold">تناغم ذكي</span>
        </div>

        {/* Magic One-Click Auto Harmonize from Background */}
        <Button
          type="button"
          disabled={isExtracting || !activeBgUrl}
          onClick={handleAutoHarmonizeFromBackground}
          className="w-full h-9 text-xs font-bold gap-2 rounded-xl bg-primary/10 border border-primary/50 text-primary hover:bg-primary/20 shadow-xs"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span>
            {isExtracting
              ? 'جاري تحليل ألوان الخلفية والمطابقة...'
              : '✨ مطابقة ألوان المقاس وكافة النصوص مع الخلفية تلقائياً'}
          </span>
        </Button>

        {/* Extracted Colors Swatches */}
        {extractedPalette.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border/30">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>الألوان المستخرجة من شريط الخلفية:</span>
              <span className="text-[9px]">انقر لتطبيق اللون على كافة الكتابات</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {extractedPalette.map((col, idx) => (
                <button
                  key={`palette-${idx}`}
                  type="button"
                  onClick={() => applyHarmoniousColorSystem(col)}
                  title={`تطبيق ${col} على كافة الكتابات`}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer shadow-xs ${
                    primaryColor === col
                      ? 'border-primary ring-2 ring-primary/50 scale-110'
                      : 'border-white/40'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Master Primary Color Picker */}
        <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs">
          <div>
            <Label className="text-[10px] font-bold block">اللون الرئيسي الشامل:</Label>
            <span className="text-[8px] text-muted-foreground">
              يولد درجات متناسقة للمقاس واسم الحملة والموقع
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="color"
              value={primaryColor}
              onChange={(e) => applyHarmoniousColorSystem(e.target.value)}
              className="w-7 h-7 p-0 border cursor-pointer rounded-md shrink-0"
            />
            <Input
              value={primaryColor}
              onChange={(e) => applyHarmoniousColorSystem(e.target.value)}
              className="w-20 h-7 text-[10px] font-mono rounded"
            />
          </div>
        </div>

        {/* Specific Element Color Pickers */}
        <div className="space-y-2 pt-2 border-t border-border/30">
          <Label className="text-[10px] font-bold text-muted-foreground block">
            تخصيص ألوان الأقسام بشكل مستقل:
          </Label>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {/* Size Color (المقاس) */}
            <div className="flex items-center justify-between p-1.5 rounded-lg bg-background/60 border border-border/40">
              <span className="font-bold">المقاس (6x3):</span>
              <Input
                type="color"
                value={sizeColor}
                onChange={(e) => updateSpecificColor('size', e.target.value)}
                className="w-6 h-6 p-0 border cursor-pointer rounded shrink-0"
              />
            </div>

            {/* Campaign Color (الحملة) */}
            <div className="flex items-center justify-between p-1.5 rounded-lg bg-background/60 border border-border/40">
              <span className="font-bold">اسم الحملة:</span>
              <Input
                type="color"
                value={campaignColor}
                onChange={(e) => updateSpecificColor('campaign', e.target.value)}
                className="w-6 h-6 p-0 border cursor-pointer rounded shrink-0"
              />
            </div>

            {/* Location Color (الموقع) */}
            <div className="flex items-center justify-between p-1.5 rounded-lg bg-background/60 border border-border/40">
              <span className="font-bold">الموقع (البلدية):</span>
              <Input
                type="color"
                value={locationColor}
                onChange={(e) => updateSpecificColor('location', e.target.value)}
                className="w-6 h-6 p-0 border cursor-pointer rounded shrink-0"
              />
            </div>

            {/* Contacts Color (التواصل) */}
            <div className="flex items-center justify-between p-1.5 rounded-lg bg-background/60 border border-border/40">
              <span className="font-bold">الهاتف والموقع:</span>
              <Input
                type="color"
                value={contactsColor}
                onChange={(e) => updateSpecificColor('contacts', e.target.value)}
                className="w-6 h-6 p-0 border cursor-pointer rounded shrink-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═════════ 5. ONE-CLICK TEXT COLOR THEMES ═════════ */}
      <div className="space-y-2.5 p-3 rounded-xl border border-border/40 bg-card/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Type className="h-3.5 w-3.5 text-primary" />
            <span>أنماط ألوان الكتابات السريعة (تطبق على المقاس وكافة النصوص)</span>
          </span>
          <span className="text-[9px] text-muted-foreground">ضغطة واحدة</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {LOCATION_TEXT_COLOR_THEMES.map((theme) => {
            const isCurrentTheme = locationStrip.textColorTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => applyTextColorTheme(theme)}
                className={`flex items-center gap-2 p-2 rounded-xl border text-right transition-all cursor-pointer ${
                  isCurrentTheme
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/40 font-bold shadow-sm'
                    : 'border-border/40 hover:border-primary/40 bg-background/50 hover:bg-muted/40'
                }`}
              >
                <div className="flex -space-x-1.5 shrink-0 rtl:space-x-reverse">
                  <span
                    className="h-4 w-4 rounded-full border border-black/40 shadow-sm block shrink-0"
                    style={{ background: theme.primaryColor }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-black/40 shadow-sm block shrink-0"
                    style={{ background: theme.secondaryColor }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-foreground truncate">
                    {theme.name}
                  </div>
                  <div className="text-[8px] text-muted-foreground truncate">
                    {theme.description}
                  </div>
                </div>

                {isCurrentTheme && <Check className="h-3 w-3 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═════════ 6. ONE-CLICK TEXT BACKGROUNDS (كبسولات نصوص الموقع) ═════════ */}
      <div className="space-y-2.5 p-3 rounded-xl border border-border/40 bg-card/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>خلفيات نصوص الموقع السريعة (كبسولات وشارات)</span>
          </span>
          <span className="text-[9px] text-muted-foreground">سرعة وسهولة بنقرة واحدة</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_BACKGROUND_PRESETS.map((preset) => {
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setTextElements((prev) =>
                    prev.map((el) => {
                      const isLoc =
                        el.parentStrip === 'location' ||
                        ['municipality', 'region', 'landmark', 'municipality_region'].includes(
                          el.id
                        );
                      if (!isLoc) return el;
                      return applyTextBackgroundToElement(el, preset, Boolean(preset.textColor));
                    })
                  );
                  toast.success(`تم تطبيق نمط خلفية النصوص: ${preset.name}`);
                }}
                className="flex items-center gap-2 p-1.5 rounded-lg border border-border/40 hover:border-primary/50 bg-background/50 text-right transition-all cursor-pointer"
              >
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
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
