import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Clock, CheckCircle2, Printer, AlertCircle, AlertTriangle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PrintTaskListProps {
  tasks: any[];
  selectedTaskId: string | null;
  onSelectTask: (task: any) => void;
  isLoading: boolean;
}

const statusConfig = {
  completed: { 
    icon: CheckCircle2, 
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
    label: 'مكتمل',
    dot: 'bg-emerald-500'
  },
  in_progress: { 
    icon: Printer, 
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
    label: 'قيد التنفيذ',
    dot: 'bg-blue-500'
  },
  cancelled: { 
    icon: AlertCircle, 
    color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
    label: 'ملغي',
    dot: 'bg-red-500'
  },
  pending: { 
    icon: Clock, 
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
    label: 'معلق',
    dot: 'bg-amber-500'
  }
};

const priorityConfig = {
  urgent: { color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400', label: 'عاجل' },
  high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400', label: 'عالية' },
  normal: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400', label: 'عادية' },
  low: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400', label: 'منخفضة' }
};

export function PrintTaskList({ tasks, selectedTaskId, onSelectTask, isLoading }: PrintTaskListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-blue-200 dark:border-blue-900 animate-pulse" />
          <Printer className="h-8 w-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 animate-pulse" />
        </div>
        <p className="mt-4 text-sm">جاري تحميل المهام...</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 mb-4">
          <Printer className="h-10 w-10 text-slate-400" />
        </div>
        <p className="font-medium">لا توجد مهام طباعة</p>
        <p className="text-xs mt-1">قم بإنشاء مهمة جديدة للبدء</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;
        const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.normal;
        const StatusIcon = status.icon;
        const needsPrinter = !task.printer_id;
        const isSelected = selectedTaskId === task.id;
        
        return (
          <Card
            key={task.id}
            onClick={() => onSelectTask(task)}
            className={cn(
              "p-3 cursor-pointer transition-all duration-200 hover:shadow-md border-r-4 group",
              isSelected 
                ? "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/20 border-r-blue-500" 
                : "border-r-transparent hover:border-r-blue-300 dark:hover:border-r-blue-700",
              needsPrinter && !isSelected && "border-r-amber-400 dark:border-r-amber-600"
            )}
          >
            <div className="space-y-2.5">
              {/* Header Row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", status.dot)} />
                    <h3 className="font-semibold text-sm truncate">
                      {task.customer_name || 'بدون اسم'}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {(() => {
                      const ids: number[] = Array.isArray(task._contractIds) && task._contractIds.length > 0
                        ? task._contractIds
                        : (task.contract_id ? [task.contract_id] : []);

                      if (ids.length > 1) return `عقود #${ids.join(', #')}`;
                      if (ids.length === 1) return `عقد #${ids[0]}`;
                      return task.printed_invoices?.invoice_number || `#${task.id.slice(0, 8)}`;
                    })()}
                  </p>
                </div>
                <Badge className={cn("text-[10px] px-1.5 py-0.5 font-medium", priority.color)}>
                  {priority.label}
                </Badge>
              </div>

              {/* Printer Warning */}
              {needsPrinter && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800/50">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="font-medium">يجب اختيار المطبعة</span>
                </div>
              )}

              {/* Stats Row */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                  <span className="text-muted-foreground">المساحة:</span>
                  <span className="font-semibold">{task.total_area?.toFixed(1)} م²</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                  <span className="text-muted-foreground">التكلفة:</span>
                  <span className="font-semibold">{task.total_cost?.toLocaleString()} د.ل</span>
                </div>
              </div>

              {/* Footer Row */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-xs">
                  <Building2 className={cn("h-3.5 w-3.5", needsPrinter ? "text-amber-500" : "text-muted-foreground")} />
                  <span className={cn(
                    "truncate max-w-[100px]",
                    needsPrinter ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"
                  )}>
                    {task.printers?.name || 'لم يتم التحديد'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[10px] px-1.5 py-0.5 gap-1", status.color)}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>
                </div>
              </div>

              {/* Date */}
              <div className="text-[10px] text-muted-foreground">
                {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
