import { CompositeTasksListEnhanced } from '@/components/composite-tasks/CompositeTasksListEnhanced';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, Printer, Scissors, Wrench } from 'lucide-react';

export default function CompositeTasks() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-full" dir="rtl">
      <div className="p-3 sm:p-6 space-y-6">
        <div className="flex flex-col gap-4 rounded-[22px] border border-amber-500/20 bg-card/55 p-5 shadow-lg backdrop-blur-md select-none md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3 text-right">
            <div className="mt-0.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-amber-400">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                مهام التركيب الشاملة
              </h1>
              <p className="text-xs font-medium text-muted-foreground/80">
                كل عقد غطاء واضح لعملياته، وتحت كل عملية مهام الطباعة والقص والتركيب الخاصة بها
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/installation-tasks?create=1&from=hub')}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-primary/45 bg-primary px-4 text-xs font-black text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Plus className="h-4 w-4" />
              إضافة تركيب أو إعادة تركيب
            </button>
            <div className="hidden flex-wrap items-center gap-2 xl:flex">
              {[
                { label: 'الطباعة', icon: Printer },
                { label: 'القص', icon: Scissors },
                { label: 'التركيب', icon: Wrench },
              ].map(({ label, icon: Icon }) => (
                <span key={label} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/35 bg-background/40 px-3 text-[11px] font-bold text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-amber-400" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <CompositeTasksListEnhanced />
      </div>
    </div>
  );
}
