import React from 'react';
import { cn } from '@/lib/utils';

interface StatBadgeProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

const variants: Record<string, string> = {
  default: 'bg-muted/40 text-foreground border-border/60',
  primary: 'bg-primary/10 text-primary border-primary/30',
  success: 'bg-[hsl(var(--green))/0.12] text-[hsl(var(--green))] border-[hsl(var(--green))/0.3]',
  warning: 'bg-[hsl(var(--orange))/0.12] text-[hsl(var(--orange))] border-[hsl(var(--orange))/0.3]',
  danger:  'bg-destructive/10 text-destructive border-destructive/30',
};

export const StatBadge: React.FC<StatBadgeProps> = ({ label, value, icon, variant = 'default', className }) => {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-semibold backdrop-blur-sm transition-colors',
        variants[variant],
        className
      )}
    >
      {icon && <span className="opacity-80 shrink-0">{icon}</span>}
      <span className="opacity-70 font-medium">{label}</span>
      <span className="font-bold font-numbers tracking-tight">{value}</span>
    </div>
  );
};

export default StatBadge;
