import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Ruler, XCircle, Wrench } from 'lucide-react';
import { BillboardStatus, STATUS_LABELS } from '@/hooks/useBillboardStatuses';
import { cn } from '@/lib/utils';

interface Props {
  statuses?: (BillboardStatus | (Omit<BillboardStatus, 'status_type'> & { status_type: 'maintenance' }))[];
  size?: 'sm' | 'xs';
  className?: string;
}

const ICONS: Record<string, any> = {
  torn_ad: AlertTriangle,
  size_changed: Ruler,
  removed: XCircle,
  maintenance: Wrench,
};

const COLORS: Record<string, string> = {
  torn_ad: 'bg-destructive text-destructive-foreground border-destructive',
  size_changed: 'bg-amber-500 text-white border-amber-500',
  removed: 'bg-muted text-muted-foreground border-border',
  maintenance: 'bg-slate-500 text-white border-slate-500',
};

const EXTRA_LABELS: Record<string, string> = { maintenance: 'صيانة' };

export const BillboardStatusBadges: React.FC<Props> = ({ statuses, size = 'sm', className }) => {
  if (!statuses || statuses.length === 0) return null;
  const seen = new Set<string>();
  const unique = statuses.filter((s) => {
    if (seen.has(s.status_type)) return false;
    seen.add(s.status_type);
    return true;
  });
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {unique.map((s) => {
        const Icon = ICONS[s.status_type];
        const label = s.status_type === 'size_changed' && s.old_size && s.new_size
          ? `${s.old_size} → ${s.new_size}`
          : (STATUS_LABELS as any)[s.status_type] || EXTRA_LABELS[s.status_type] || s.status_type;
        return (
          <Badge
            key={s.id}
            className={cn(
              'gap-1 border',
              COLORS[s.status_type],
              size === 'xs' ? 'text-[9px] h-4 px-1.5' : 'text-[10px] h-5'
            )}
            title={s.note || label}
          >
            <Icon className={size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            {label}
          </Badge>
        );
      })}
    </div>
  );
};
