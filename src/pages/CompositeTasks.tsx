import { buttonVariants } from '@/components/ui/button';
import { CompositeTasksListEnhanced } from '@/components/composite-tasks/CompositeTasksListEnhanced';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';

export default function CompositeTasks() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-full flex-col" dir="rtl">
      <div className="space-y-3 p-3 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-primary/10 p-2 text-primary"><FolderKanban className="h-5 w-5" /></span>
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">المهام المجمعة</h1>
              <p className="text-xs text-muted-foreground">اختر العقد، ثم المهمة التي تريد إدارتها.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/installation-tasks?create=1&from=hub')}
            className={buttonVariants({ size: 'sm' }) + ' min-h-10 cursor-pointer'}
          >
            <Plus className="h-4 w-4" />
            إنشاء مهمة تركيب
          </button>
        </header>
        <CompositeTasksListEnhanced />
      </div>
    </div>
  );
}
