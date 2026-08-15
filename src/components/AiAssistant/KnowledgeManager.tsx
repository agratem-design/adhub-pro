import { useState, useEffect } from 'react';
import { Plus, Trash2, BookOpen, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: number;
}

const CATEGORIES = ['عام', 'سياسات', 'أسعار', 'عملاء', 'تسويق', 'ملاحظات'];

export function KnowledgeManager() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newEntry, setNewEntry] = useState({ title: '', content: '', category: 'عام', priority: 1 });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) loadEntries();
  }, [isOpen]);

  const loadEntries = async () => {
    const { data } = await supabase
      .from('ai_knowledge_base')
      .select('*')
      .order('priority', { ascending: false });
    if (data) setEntries(data);
  };

  const addEntry = async () => {
    if (!newEntry.title.trim() || !newEntry.content.trim()) {
      toast.error('يرجى ملء العنوان والمحتوى');
      return;
    }
    const { error } = await supabase.from('ai_knowledge_base').insert({
      title: newEntry.title,
      content: newEntry.content,
      category: newEntry.category,
      priority: newEntry.priority,
    });
    if (error) {
      toast.error('خطأ في الحفظ');
    } else {
      toast.success('تمت إضافة المعرفة');
      setNewEntry({ title: '', content: '', category: 'عام', priority: 1 });
      setIsAdding(false);
      loadEntries();
    }
  };

  const deleteEntry = async (id: string) => {
    await supabase.from('ai_knowledge_base').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success('تم الحذف');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-accent/50 hover:bg-accent text-xs transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span>إدارة المعرفة ({entries.length || '...'})</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 bg-background rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" /> المعرفة المخصصة
        </span>
        <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-muted">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Entries list */}
      <div className="max-h-40 overflow-y-auto space-y-1">
        {entries.map(entry => (
          <div key={entry.id} className="flex items-start gap-1 p-1.5 rounded bg-muted/50 text-[11px]">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{entry.title}</div>
              <div className="text-muted-foreground truncate">{entry.content.slice(0, 60)}...</div>
              <span className="text-[10px] text-primary/70">{entry.category}</span>
            </div>
            <button onClick={() => deleteEntry(entry.id)} className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive shrink-0">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {entries.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-2">لا توجد معرفة مضافة</p>}
      </div>

      {/* Add form */}
      {isAdding ? (
        <div className="space-y-1.5 border-t border-border pt-2">
          <input
            value={newEntry.title}
            onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))}
            placeholder="العنوان"
            className="w-full bg-muted rounded px-2 py-1 text-[11px] outline-none border border-border/60 focus:ring-1 focus:ring-primary/30"
          />
          <textarea
            value={newEntry.content}
            onChange={e => setNewEntry(p => ({ ...p, content: e.target.value }))}
            placeholder="المحتوى (معلومات، سياسات، ملاحظات...)"
            rows={3}
            className="w-full bg-muted rounded px-2 py-1 text-[11px] outline-none border border-border/60 focus:ring-1 focus:ring-primary/30 resize-none"
          />
          <select
            value={newEntry.category}
            onChange={e => setNewEntry(p => ({ ...p, category: e.target.value }))}
            className="w-full bg-muted rounded px-2 py-1 text-[11px] outline-none border border-border/60"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-1">
            <button onClick={addEntry} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground text-[11px] hover:bg-primary/90">
              <Save className="w-3 h-3" /> حفظ
            </button>
            <button onClick={() => setIsAdding(false)} className="px-2 py-1 rounded bg-muted text-[11px] hover:bg-muted/80">
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setIsAdding(true)} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-primary/10 text-primary text-[11px] hover:bg-primary/20">
          <Plus className="w-3 h-3" /> إضافة معرفة
        </button>
      )}
    </div>
  );
}
