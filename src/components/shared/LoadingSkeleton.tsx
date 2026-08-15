import React from 'react';
import { cn } from '@/lib/utils';

export const SkeletonLine: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('h-4 rounded bg-muted/60 animate-pulse', className)} />
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-2xl border border-border/60 bg-card p-5 space-y-3', className)}>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-muted/60 animate-pulse" />
      <div className="flex-1 space-y-2">
        <SkeletonLine className="w-1/3" />
        <SkeletonLine className="w-1/2 h-3" />
      </div>
    </div>
    <SkeletonLine />
    <SkeletonLine className="w-4/5" />
  </div>
);

export const LoadingGrid: React.FC<{ count?: number; cols?: number }> = ({ count = 6, cols = 3 }) => (
  <div
    className={cn('grid gap-4', cols === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3')}
    dir="rtl"
  >
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);
