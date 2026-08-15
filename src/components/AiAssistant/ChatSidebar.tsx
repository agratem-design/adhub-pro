import { useState, useEffect } from 'react';
import { Plus, Trash2, MessageSquare, Search, RefreshCw } from 'lucide-react';
import { KnowledgeManager } from './KnowledgeManager';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ChatSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRefreshMemory: () => void;
  refreshKey: number;
}

export function ChatSidebar({ activeConversationId, onSelectConversation, onNewConversation, onRefreshMemory, refreshKey }: ChatSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [refreshKey]);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setConversations(data);
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('ai_messages').delete().eq('conversation_id', id);
    await supabase.from('ai_conversations').delete().eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      onNewConversation();
    }
    toast.success('تم حذف المحادثة');
  };

  const handleRefreshMemory = async () => {
    setIsRefreshing(true);
    try {
      onRefreshMemory();
      toast.success('جارٍ تحديث الذاكرة الذكية...');
    } finally {
      setTimeout(() => setIsRefreshing(false), 2000);
    }
  };

  const filtered = search
    ? conversations.filter(c => (c.title || '').includes(search))
    : conversations;

  return (
    <div className="w-full h-full flex flex-col border-l border-border bg-muted/20">
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onNewConversation}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            محادثة جديدة
          </button>
          <button
            onClick={handleRefreshMemory}
            className="p-2.5 rounded-xl bg-accent hover:bg-accent/80 transition-colors border border-border/50"
            title="تحديث الذاكرة الذكية"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في المحادثات..."
            className="w-full bg-background rounded-xl px-3 py-2 pr-9 text-xs outline-none border border-border/60 focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>
        <KnowledgeManager />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {filtered.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-right text-xs transition-all group",
              activeConversationId === conv.id
                ? "bg-primary/10 text-primary shadow-sm"
                : "hover:bg-accent text-foreground"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 truncate">{conv.title || 'محادثة بدون عنوان'}</span>
            <button
              onClick={(e) => deleteConversation(conv.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">لا توجد محادثات</p>
        )}
      </div>
    </div>
  );
}
