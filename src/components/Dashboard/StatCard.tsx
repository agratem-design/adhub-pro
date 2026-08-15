import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, description, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden bg-gradient-card border-0 shadow-card hover:shadow-elegant transition-smooth", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground/60">{description}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{value}</span>
                {trend && (
                  <span className={cn(
                    "text-sm font-medium px-2 py-1 rounded-full",
                    trend.isPositive 
                      ? "text-success bg-success/10" 
                      : "text-destructive bg-destructive/10"
                  )}>
                    {trend.isPositive ? "+" : ""}{trend.value}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* تدرج زخرفي */}
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-primary opacity-80"></div>
      </CardContent>
    </Card>
  );
}