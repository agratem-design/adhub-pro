import type { ComponentType, MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Check, MapPin } from 'lucide-react';

/**
 * الهيكل الموحد لكرت اللوحة في كل النظام:
 * رأس (الكود، المقاس، المستوى، الإجراءات) ← الصورة مع شارات الحالة ← العنوان وأقرب نقطة دالة
 * ← البلدية / المنطقة / المدينة ← محتوى خاص بالصفحة ← تذييل السعر.
 * صفحة اللوحات، اللوحات المتاحة، ولوحات العقد تستخدم الهيكل نفسه وتختلف في الإجراءات فقط.
 */

export type CardTone = 'default' | 'selected' | 'locked' | 'danger' | 'renewed' | 'replacement';

const TONE: Record<CardTone, string> = {
  default: 'border-border hover:border-primary/40',
  selected: 'border-primary ring-2 ring-primary/30',
  locked: 'border-rose-500/30 hover:border-amber-400/60',
  danger: 'border-destructive ring-2 ring-destructive/30',
  renewed: 'border-emerald-500/40',
  replacement: 'border-primary ring-2 ring-primary/40',
};

export type StatusKind = 'available' | 'soon' | 'rented' | 'maintenance' | 'locked' | 'unlocked' | 'info' | 'warning';

const STATUS: Record<StatusKind, string> = {
  available: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60',
  soon: 'bg-amber-950/90 text-amber-300 border-amber-500/60',
  rented: 'bg-rose-950/90 text-rose-300 border-rose-500/60',
  maintenance: 'bg-amber-950/90 text-amber-300 border-amber-500/60',
  locked: 'bg-rose-700 text-white border-rose-400/80 hover:bg-amber-600',
  unlocked: 'bg-emerald-700 text-white border-emerald-400/80',
  info: 'bg-black/75 text-white border-white/20',
  warning: 'bg-amber-600/90 text-white border-amber-400/40',
};

export function CardStatusBadge({ kind, label, icon: Icon, onClick, title }: {
  kind: StatusKind; label: ReactNode; icon?: ComponentType<{ className?: string }>; onClick?: (e: MouseEvent) => void; title?: string;
}) {
  return (
    <span
      onClick={onClick}
      title={title}
      className={cn('pointer-events-auto inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold shadow-md backdrop-blur-sm',
        STATUS[kind], onClick && 'cursor-pointer')}
    >
      {Icon && <Icon className="h-3 w-3" />}{label}
    </span>
  );
}

export function CardIconButton({ icon: Icon, onClick, title, tone = 'default', active }: {
  icon: ComponentType<{ className?: string }>; onClick: (e: MouseEvent) => void; title: string;
  tone?: 'default' | 'primary' | 'warning' | 'danger'; active?: boolean;
}) {
  const tones = {
    default: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    primary: 'text-primary hover:bg-primary/10',
    warning: 'text-amber-500 hover:bg-amber-500/10',
    danger: 'text-destructive hover:bg-destructive/10',
  };
  return (
    <button type="button" title={title} aria-label={title}
      onClick={e => { e.stopPropagation(); onClick(e); }}
      className={cn('inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        tones[tone], active && 'bg-muted')}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Chip({ children, onClick, title, strong }: { children: ReactNode; onClick?: () => void; title?: string; strong?: boolean }) {
  return (
    <span
      onClick={onClick ? (e => { e.stopPropagation(); onClick(); }) : undefined}
      title={title}
      className={cn('inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-xs font-semibold',
        strong ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-foreground/85',
        onClick && 'cursor-pointer hover:border-primary/60 hover:text-primary')}
    >
      {children}
    </span>
  );
}

export function BillboardCardFrame({
  tone = 'default', onClick, code, size, onSizeClick, level, faces, headerExtra, headerActions, banner,
  image, imageHeight = 'aspect-[16/10]', statusBadges, selectMark, imageOverlayBottom,
  title, landmark, municipality, district, city, onMunicipalityClick, onDistrictClick, onCityClick, billboardType, compact = false,
  children, priceLabel, price, priceTone = 'primary', footer, after, className, dimmed,
}: {
  tone?: CardTone;
  onClick?: () => void;
  code: string;
  size?: string;
  onSizeClick?: () => void;
  level?: string;
  faces?: string;
  headerExtra?: ReactNode;
  headerActions?: ReactNode;
  banner?: ReactNode;
  image: ReactNode;
  imageHeight?: string;
  statusBadges?: ReactNode;
  /** null = لا تظهر علامة الاختيار، true/false = حالة الاختيار */
  selectMark?: boolean | null;
  imageOverlayBottom?: ReactNode;
  title: string;
  billboardType?: string;
  compact?: boolean;
  landmark?: string | null;
  municipality?: string;
  district?: string;
  city?: string;
  onMunicipalityClick?: () => void;
  onDistrictClick?: () => void;
  onCityClick?: () => void;
  children?: ReactNode;
  priceLabel?: string;
  price?: ReactNode;
  priceTone?: 'primary' | 'good';
  footer?: ReactNode;
  after?: ReactNode;
  className?: string;
  dimmed?: boolean;
}) {
  return (
    <article
      dir="rtl"
      onClick={onClick}
      className={cn('group relative flex flex-col overflow-hidden rounded-xl border bg-card text-right shadow-sm transition-colors',
        TONE[tone], onClick && 'cursor-pointer', dimmed && 'opacity-90', className)}
    >
      {/* الرأس */}
      <header className="flex min-h-11 items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="font-manrope text-sm font-bold tracking-wide text-foreground">{code}</span>
          {size && (
            <span
              dir="ltr"
              onClick={onSizeClick ? (e => { e.stopPropagation(); onSizeClick(); }) : undefined}
              title={onSizeClick ? `تصفية بالمقاس ${size}` : undefined}
              className={cn('rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-manrope text-xs font-extrabold text-primary',
                onSizeClick && 'cursor-pointer hover:bg-primary/20')}
            >
              {size}
            </span>
          )}
          {level && <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-bold">مستوى {level}</span>}
          {faces && <span className="text-xs text-muted-foreground">{faces}</span>}
          {headerExtra}
        </div>
        {headerActions && <div className="flex shrink-0 items-center gap-0.5">{headerActions}</div>}
      </header>

      {banner}

      {/* الصورة */}
      <div className={cn('relative w-full shrink-0 overflow-hidden bg-muted/40', imageHeight)}>
        {image}
        {statusBadges && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 flex max-w-[85%] flex-col items-end gap-1">{statusBadges}</div>
        )}
        {selectMark !== null && selectMark !== undefined && (
          <span className={cn('absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg border shadow-md backdrop-blur-sm transition-colors',
            selectMark ? 'border-primary bg-primary text-primary-foreground' : 'border-white/30 bg-black/50 text-white/60')}>
            <Check className="h-4 w-4" />
          </span>
        )}
        {imageOverlayBottom}
      </div>

      {/* الموقع */}
      <div className={cn('flex flex-1 flex-col p-3', compact ? 'gap-2.5' : 'gap-3')}>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn('min-w-0 flex-1 font-semibold text-foreground', compact ? 'line-clamp-2 text-[13px] leading-5' : 'line-clamp-1 text-sm')}>{title}</h4>
            {billboardType && <span title={`نوع اللوحة: ${billboardType}`} className="inline-flex max-w-[45%] shrink-0 items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"><span className="truncate">{billboardType}</span></span>}
          </div>
          {landmark && (
            <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="line-clamp-2">{landmark}</span>
            </p>
          )}
        </div>
        {(municipality || district || city) && (
          <div className="flex flex-wrap items-center gap-1">
            {municipality && <Chip strong onClick={onMunicipalityClick} title={onMunicipalityClick ? `تصفية ببلدية ${municipality}` : 'البلدية'}>{municipality}</Chip>}
            {district && district !== municipality && <Chip onClick={onDistrictClick} title={onDistrictClick ? `تصفية بـ ${district}` : 'المنطقة'}>{district}</Chip>}
            {city && <Chip onClick={onCityClick} title={onCityClick ? `تصفية بمدينة ${city}` : 'المدينة'}>{city}</Chip>}
          </div>
        )}
        {children}
      </div>

      {(price !== undefined && price !== null) && (
        <footer className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <span className="truncate text-xs text-muted-foreground">{priceLabel || 'السعر'}</span>
          <span className={cn('shrink-0 font-manrope text-base font-bold tabular-nums', priceTone === 'good' ? 'text-emerald-500' : 'text-primary')}>{price}</span>
        </footer>
      )}
      {footer}
      {after}
    </article>
  );
}

/** قراءة الحقول بأسمائها المختلفة في الجداول */
export function billboardFields(b: any) {
  const id = Number(b?.ID ?? b?.id);
  const code = b?.code || b?.Code || `TR-${String(id).padStart(4, '0')}`;
  const rawName = String(b?.name || b?.Billboard_Name || '').trim();
  const landmark = String(b?.location || b?.Nearest_Landmark || b?.Nearest_landmark || '').trim();
  const isCodeOnly = !rawName || rawName.toLowerCase() === String(code).toLowerCase() || (rawName.startsWith('TR-') && rawName.length <= 12);
  const facesRaw = String(b?.Faces_Count || b?.faces_count || b?.Faces || '');
  return {
    id,
    code,
    title: isCodeOnly ? (landmark || 'لوحة إعلانية') : rawName,
    landmark: isCodeOnly ? null : (landmark && landmark !== rawName ? landmark : null),
    size: b?.Size || b?.size || '',
    level: b?.Level || b?.level || '',
    faces: facesRaw === '2' ? 'وجهين' : facesRaw === '1' ? 'وجه واحد' : facesRaw ? `${facesRaw} أوجه` : '',
    municipality: b?.municipality || b?.Municipality || b?.Municipality_Name || '',
    district: b?.district || b?.District || b?.area || b?.Area || '',
    city: b?.city || b?.City || b?.City_Name || '',
  };
}
