import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  AlertTriangle,
  Trash2,
  Printer,
  CalendarDays,
  Image as ImageIcon,
  X,
  Undo2,
  MessageCircle,
  MapPin,
  Camera,
  Package,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useResolvedImage } from '@/utils/imageResolver';

/* ─────────────────────────────────────────
   DesignPanel — exactly like InstallationTasksTable
   ───────────────────────────────────────── */
const DesignPanel = ({
  urls,
  accent,
  onColorExtracted,
}: {
  urls: string[];
  accent: string;
  onColorExtracted?: (color: string | null) => void;
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const url = urls.length > 0 ? urls[currentIdx % urls.length] : undefined;
  const { src: resolvedUrl } = useResolvedImage(url);
  const displayUrl = resolvedUrl || url;

  useEffect(() => {
    if (!url || !onColorExtracted) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 50; canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const br = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (br > 30 && br < 225) { r += data[i]; g += data[i + 1]; b += data[i + 2]; count++; }
        }
        if (count > 0) onColorExtracted(`${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`);
      } catch { onColorExtracted(null); }
    };
    img.onerror = () => onColorExtracted?.(null);
    img.src = displayUrl || url;
  }, [url, displayUrl, onColorExtracted]);

  const goNext = (e: React.MouseEvent) => { e.stopPropagation(); setCurrentIdx(i => (i + 1) % urls.length); };
  const goPrev = (e: React.MouseEvent) => { e.stopPropagation(); setCurrentIdx(i => (i - 1 + urls.length) % urls.length); };

  return (
    <>
      <div
        className="relative flex-shrink-0 overflow-hidden h-full cursor-pointer group"
        style={{ width: '100%', minHeight: '100%' }}
        onClick={() => url && setLightboxOpen(true)}
      >
        {displayUrl ? (
          <>
            {/* Blurred background */}
            <div className="absolute inset-0">
              <img src={displayUrl} alt="" className="w-full h-full object-cover scale-150 blur-xl opacity-50" aria-hidden="true" />
              <div className="absolute inset-0 bg-black/40" />
            </div>
            {/* Main image */}
            <img
              src={displayUrl}
              alt="تصميم"
              className="relative w-full h-full object-contain z-10 p-2"
              style={{ minHeight: '100%' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {/* Navigation arrows */}
            {urls.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-30 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={goNext}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-30 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {/* Dots */}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-30 flex gap-1">
                  {urls.map((_, i) => (
                    <button
                      key={i}
                      onClick={e => { e.stopPropagation(); setCurrentIdx(i); }}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIdx % urls.length ? 'bg-white scale-125' : 'bg-white/40'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ minHeight: '100%', background: `linear-gradient(135deg, hsl(var(--muted)/0.6), ${accent}18)` }}
          >
            <div className="flex flex-col items-center gap-2 opacity-40">
              <ImageIcon className="h-10 w-10" style={{ color: accent }} />
              <span className="text-[10px] text-muted-foreground">لا يوجد تصميم</span>
            </div>
          </div>
        )}

        {/* Accent vertical bar (on inner left = outer left of card in RTL) */}
        <div className="absolute top-0 right-0 bottom-0 w-[4px]" style={{ background: accent, opacity: 0.85 }} />
      </div>

      {/* Lightbox via Portal */}
      {lightboxOpen && url && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/20"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          {urls.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setCurrentIdx(i => (i - 1 + urls.length) % urls.length); }}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setCurrentIdx(i => (i + 1) % urls.length); }}
                className="absolute left-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                {urls.map((_, i) => (
                  <button
                    key={i}
                    onClick={e => { e.stopPropagation(); setCurrentIdx(i); }}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentIdx % urls.length ? 'bg-white scale-125' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          )}
          <img
            src={displayUrl}
            alt="معاينة التصميم"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </>
  );
};

/* ─────────────────────────────────────────
   Props
   ───────────────────────────────────────── */
interface RemovalMobileTaskCardProps {
  task: any;
  billboardById: Record<number, any>;
  isSelected: boolean;
  children?: React.ReactNode;
  onToggleSelect: () => void;
  onCompleteAll?: () => void;
  onPrintPending: () => void;
  onPrintCompleted: () => void;
  onUndoLast?: () => void;
  onDelete: () => void;
  onSendWhatsApp?: () => void;
  onViewInstalledPhoto?: () => void;
  hasInstalledPhoto?: boolean;
  onSyncMissing?: () => void;
}

/* ─────────────────────────────────────────
   Main component
   ───────────────────────────────────────── */
export function RemovalMobileTaskCard({
  task,
  isSelected,
  children,
  onToggleSelect,
  onCompleteAll,
  onPrintPending,
  onPrintCompleted,
  onUndoLast,
  onDelete,
  onSendWhatsApp,
  onViewInstalledPhoto,
  hasInstalledPhoto = false,
  onSyncMissing,
}: RemovalMobileTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dominantColor, setDominantColor] = useState<string | null>(null);

  const items: any[] = task.items || [];

  // Collect all unique design images from items
  const allDesignImages = items
    .flatMap((item: any) => [item.design_face_a, item.design_face_b])
    .filter(Boolean) as string[];
  const uniqueDesignImages = [...new Set(allDesignImages)];

  const completedItems = items.filter((i: any) => i.status === 'completed').length;
  const completionPct = items.length > 0 ? Math.round((completedItems / items.length) * 100) : 0;
  const isFullyCompleted = completedItems === items.length && items.length > 0;
  const isPartiallyCompleted = completedItems > 0 && !isFullyCompleted;

  const accent = dominantColor
    ? `rgb(${dominantColor})`
    : task.accent || 'hsl(0, 65%, 55%)';

  const handleColorExtracted = useCallback((color: string | null) => {
    setDominantColor(color);
  }, []);

  // Dynamic card background and border from dominant color (same as InstallationTasksTable)
  const cardBg = dominantColor
    ? `linear-gradient(to right, rgba(${dominantColor}, 0.22) 0%, rgba(${dominantColor}, 0.10) 35%, rgba(${dominantColor}, 0.03) 70%, hsl(var(--card)) 100%)`
    : `linear-gradient(to right, color-mix(in srgb, ${task.accent} 12%, transparent) 0%, color-mix(in srgb, ${task.accent} 4%, transparent) 35%, hsl(var(--card)) 100%)`;

  const cardBorder = dominantColor
    ? `1.5px solid rgba(${dominantColor}, 0.4)`
    : isSelected
      ? `1.5px solid ${task.accent}`
      : `1.5px solid color-mix(in srgb, ${task.accent} 20%, hsl(var(--border)/0.5))`;

  const cardShadow = dominantColor
    ? `0 4px 24px rgba(${dominantColor}, 0.25), 0 0 0 1px rgba(${dominantColor}, 0.1)`
    : `0 2px 16px rgba(0,0,0,0.18)`;

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow, minHeight: 160 }}
    >
      {/* Progress bar at top */}
      {items.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted/30 overflow-hidden z-20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn(
              'h-full',
              isFullyCompleted
                ? 'bg-gradient-to-l from-emerald-500 to-green-400'
                : 'bg-gradient-to-l from-red-500 to-red-400'
            )}
          />
        </div>
      )}

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        {/* ── Main horizontal row (responsive) ── */}
        <div className="flex flex-col md:flex-row md:items-stretch" dir="rtl">

          {/* ── Right: Design Panel (responsive width and height) ── */}
          <div
            className="w-full md:w-[170px] h-[200px] md:h-auto shrink-0 overflow-hidden relative pt-1"
            onClick={e => e.stopPropagation()}
          >
            <DesignPanel
              urls={uniqueDesignImages}
              accent={task.accent || 'hsl(0,65%,55%)'}
              onColorExtracted={handleColorExtracted}
            />

            {/* Checkbox overlay */}
            <div className="absolute top-3 right-3 z-30">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                className="h-5 w-5 rounded-full border-2 border-white/45 bg-black/40 backdrop-blur-sm data-[state=checked]:!bg-red-500 data-[state=checked]:!border-red-500 cursor-pointer transition-all [&_svg]:!text-white [&_svg]:stroke-[3.5px] [&_svg]:h-3 [&_svg]:w-3"
              />
            </div>

            {/* Design count badge */}
            {uniqueDesignImages.length > 1 && (
              <div className="absolute bottom-2.5 left-2.5 z-30 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[9px] font-bold border border-white/10">
                {uniqueDesignImages.length} تصاميم
              </div>
            )}

            {/* إزالة دعاية badge */}
            <div className="absolute top-3 left-2 z-30">
              <span className="inline-flex items-center gap-1 text-[9px] bg-red-600/85 text-white px-1.5 py-0.5 rounded-md backdrop-blur-sm font-bold">
                <AlertTriangle className="h-2.5 w-2.5" />
                إزالة
              </span>
            </div>
          </div>

          {/* ── Center: Info ── */}
          <div className="flex-1 min-w-0 px-4 py-4 flex flex-col justify-between gap-3 pt-3">

            {/* Customer name + status */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-black text-foreground leading-tight truncate">
                  {task.customerName}
                </span>
                {isFullyCompleted ? (
                  <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-extrabold text-[10px] h-5 px-2 py-0 rounded-full shrink-0">
                    <CheckCircle2 className="h-3 w-3 ml-1" />
                    مكتملة
                  </Badge>
                ) : isPartiallyCompleted ? (
                  <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 font-extrabold text-[10px] h-5 px-2 py-0 rounded-full shrink-0">
                    <Clock className="h-3 w-3 ml-1" />
                    {completedItems}/{items.length}
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 font-extrabold text-[10px] h-5 px-2 py-0 rounded-full shrink-0">
                    <AlertTriangle className="h-3 w-3 ml-1" />
                    معلقة
                  </Badge>
                )}
              </div>
            </div>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {task.contract_id && (
                <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 border border-red-500/20 font-extrabold px-2 py-0.5 rounded-lg font-mono">
                  #{task.contract_id}
                </span>
              )}
              {task.adType && task.adType !== '—' && (
                <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold px-2 py-0.5 rounded-lg">
                  {task.adType}
                </span>
              )}
              {task.contractEndDate && (
                <span className="inline-flex items-center gap-1 bg-muted/40 border border-border/25 px-2 py-0.5 rounded-lg text-muted-foreground font-semibold">
                  <CalendarDays className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  {format(new Date(task.contractEndDate), 'dd/MM/yyyy', { locale: ar })}
                </span>
              )}
              {task.team && (
                <span className="inline-flex items-center gap-1 bg-muted/40 border border-border/25 px-2 py-0.5 rounded-lg text-muted-foreground font-semibold">
                  <Users className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  <span className="truncate max-w-[120px]">{task.team.team_name}</span>
                </span>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1 bg-muted/40 border border-border/25 px-2 py-0.5 rounded-lg text-muted-foreground font-semibold">
                <MapPin className="h-3 w-3 text-red-400/80 shrink-0" />
                {items.length} لوحة
              </span>
              {hasInstalledPhoto && (
                <span className="inline-flex items-center gap-1 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-lg text-violet-500 font-semibold cursor-pointer hover:bg-violet-500/20 transition-colors"
                  onClick={e => { e.stopPropagation(); onViewInstalledPhoto?.(); }}
                >
                  <Camera className="h-3 w-3 shrink-0" />
                  صورة تركيب
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/80">
                <span>إنجاز الإزالة:</span>
                <span>{completedItems} من {items.length} ({completionPct}%)</span>
              </div>
              <div className="relative h-1.5 w-full rounded-full bg-muted/40 overflow-hidden border border-border/10">
                <motion.div
                  className={`h-full rounded-full ${isFullyCompleted ? 'bg-emerald-500' : 'bg-red-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPct}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Expand/collapse trigger */}
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors bg-muted/30 hover:bg-muted/50 rounded-lg px-3 py-1.5 w-full"
                onClick={e => e.stopPropagation()}
              >
                <span>{isExpanded ? 'إخفاء اللوحات' : `عرض اللوحات (${items.length})`}</span>
                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </CollapsibleTrigger>
          </div>

          {/* ── Left: Actions column (responsive layout) ── */}
          <div
            className="w-full md:w-[160px] shrink-0 p-3 flex flex-col justify-between items-stretch border-t md:border-t-0 md:border-r border-border/30 pt-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Action buttons */}
            <div className="flex flex-col gap-2 w-full">
              {onCompleteAll && items.some((i: any) => i.status !== 'completed') && (
                <Button
                  size="sm"
                  onClick={() => onCompleteAll()}
                  className="w-full h-8 rounded-xl font-bold text-xs gap-1 shadow-sm bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  إكمال الكل
                </Button>
              )}

              {items.some((i: any) => i.status !== 'completed') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPrintPending()}
                  className="w-full h-8 rounded-xl font-bold text-xs gap-1 border-amber-500/20 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/50 hover:text-amber-500 transition-all animate-pulse"
                >
                  <Printer className="h-3.5 w-3.5" />
                  طباعة المعلقة
                </Button>
              )}

              {items.some((i: any) => i.status === 'completed') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPrintCompleted()}
                  className="w-full h-8 rounded-xl font-bold text-xs gap-1 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:text-emerald-500 transition-all"
                >
                  <Printer className="h-3.5 w-3.5" />
                  طباعة المكتملة
                </Button>
              )}

              {onSendWhatsApp && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSendWhatsApp()}
                  className="w-full h-8 rounded-xl font-bold text-xs gap-1 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  واتساب
                </Button>
              )}

              {onUndoLast && items.some((i: any) => i.status === 'completed') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUndoLast()}
                  className="w-full h-8 rounded-xl font-bold text-xs gap-1 border-orange-500/20 text-orange-400 hover:bg-orange-500/10 transition-all"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  تراجع
                </Button>
              )}

              {onSyncMissing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSyncMissing()}
                  className="w-full h-8 rounded-xl font-bold text-xs gap-1 border-blue-500/20 text-blue-500 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all"
                >
                  <Package className="h-3.5 w-3.5" />
                  إضافة الناقصة
                </Button>
              )}
            </div>

            {/* Delete button at bottom */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete()}
              className="w-full h-8 rounded-xl font-bold text-xs gap-1 text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/40 transition-all mt-3 md:mt-auto"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف
            </Button>
          </div>
        </div>

        {/* ── Expanded items grid ── */}
        <CollapsibleContent>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="border-t border-border/50 bg-muted/10"
            >
              {children}
            </motion.div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
