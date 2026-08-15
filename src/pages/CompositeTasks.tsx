import { CompositeTasksListEnhanced } from '@/components/composite-tasks/CompositeTasksListEnhanced';

export default function CompositeTasks() {
  return (
    <div className="flex flex-col min-h-full" dir="rtl">
      <div className="p-3 sm:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card/45 backdrop-blur-md border border-border/30 rounded-[22px] p-5 shadow-lg select-none">
          <div className="space-y-1 text-right">
            <h1 className="text-3xl font-black tracking-tight text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              المهام المجمعة
            </h1>
            <p className="text-xs font-medium text-muted-foreground/80">
              إدارة ومتابعة المهام المجمعة (تركيب + طباعة + قص) وحساب التكاليف والأرباح
            </p>
          </div>
        </div>
        <CompositeTasksListEnhanced />
      </div>
    </div>
  );
}
