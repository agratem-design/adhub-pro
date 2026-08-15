import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Bot, X, Send, Maximize2, Minimize2, History, Plus, MessageSquare, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatMessages } from './ChatMessages';
import { useAiChat } from './useAiChat';
import { supabase } from '@/integrations/supabase/client';

interface MiniConversation {
  id: string;
  title: string | null;
  updated_at: string | null;
}

function ChatHistoryPanel({
  activeId,
  onSelect,
  onNew,
  onClose,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [convos, setConvos] = useState<MiniConversation[]>([]);

  useEffect(() => {
    supabase
      .from('ai_conversations')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setConvos(data || []));
  }, []);

  return (
    <div className="absolute inset-0 z-10 bg-background flex flex-col animate-in slide-in-from-right-4 duration-200" dir="rtl">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent text-muted-foreground">
          <ArrowRight className="w-4 h-4" />
        </button>
        <span className="flex-1 text-sm font-semibold">سجل المحادثات</span>
        <button
          onClick={() => { onNew(); onClose(); }}
          className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto ai-chat-scroll p-2 space-y-0.5">
        {convos.map(c => (
          <button
            key={c.id}
            onClick={() => { onSelect(c.id); onClose(); }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-right text-xs transition-colors",
              activeId === c.id ? "bg-primary/10 text-primary" : "hover:bg-accent text-foreground"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 truncate">{c.title || 'محادثة بدون عنوان'}</span>
          </button>
        ))}
        {convos.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">لا توجد محادثات سابقة</p>
        )}
      </div>
    </div>
  );
}

export function FloatingAiChat() {
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem('ai_chat_open') === 'true'; } catch { return false; }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    messages, isLoading, conversationId, provider,
    sendMessage, loadConversation, startNewConversation,
  } = useAiChat();

  useEffect(() => {
    try { localStorage.setItem('ai_chat_open', String(isOpen)); } catch {}
  }, [isOpen]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 left-4 lg:bottom-6 lg:left-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {/* Chat popup */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 border border-border bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300",
            isFullscreen
              ? "inset-0 rounded-none"
              : "bottom-24 left-4 lg:bottom-6 lg:left-6 w-[420px] h-[620px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] rounded-2xl"
          )}
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-l from-primary/5 to-transparent shrink-0 relative">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold">المساعد الذكي</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-muted-foreground">متصل</span>
              </div>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                showHistory ? "bg-primary/10 text-primary" : "hover:bg-accent text-muted-foreground"
              )}
              title="سجل المحادثات"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
              title={isFullscreen ? 'تصغير' : 'ملء الشاشة'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { setIsOpen(false); setIsFullscreen(false); }}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* History panel overlay */}
          <div className="flex-1 relative min-h-0 flex flex-col">
            {showHistory && (
              <ChatHistoryPanel
                activeId={conversationId}
                onSelect={loadConversation}
                onNew={startNewConversation}
                onClose={() => setShowHistory(false)}
              />
            )}

            {/* Messages */}
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              onSuggestionClick={(q) => { sendMessage(q); }}
              provider={provider}
            />
          </div>

          {/* Input */}
          <div className="border-t border-border px-3 py-2.5 shrink-0 bg-gradient-to-t from-muted/20 to-transparent">
            <form
              onSubmit={e => { e.preventDefault(); handleSend(); }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب سؤالك... (Shift+Enter لسطر جديد)"
                rows={1}
                className="flex-1 bg-accent/60 backdrop-blur rounded-2xl px-4 py-2.5 text-sm outline-none border border-border/50 focus:ring-2 focus:ring-primary/30 transition-all resize-none ai-chat-scroll leading-relaxed"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2.5 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95 mb-0.5"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
