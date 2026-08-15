import { useState } from 'react';
import { Bot, Send, PanelRightClose, PanelRightOpen, Maximize2, Minimize2 } from 'lucide-react';
import { ChatMessages } from '@/components/AiAssistant/ChatMessages';
import { ChatSidebar } from '@/components/AiAssistant/ChatSidebar';
import { useAiChat } from '@/components/AiAssistant/useAiChat';
import { cn } from '@/lib/utils';

export default function AiAssistant() {
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    messages, isLoading, conversationId, refreshKey, provider,
    sendMessage, loadConversation, startNewConversation, refreshMemory,
  } = useAiChat();

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div
      className={cn(
        "flex mx-auto transition-all duration-300",
        isFullscreen
          ? "fixed inset-0 z-[60] bg-background max-w-none"
          : "h-[calc(100vh-4rem)] max-w-6xl"
      )}
      dir="rtl"
    >
      {/* Sidebar */}
      {sidebarOpen && (
        <div className={cn("shrink-0 hidden md:block", isFullscreen ? "w-72" : "w-64")}>
          <ChatSidebar
            activeConversationId={conversationId}
            onSelectConversation={loadConversation}
            onNewConversation={startNewConversation}
            onRefreshMemory={refreshMemory}
            refreshKey={refreshKey}
          />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-l from-primary/5 to-transparent shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
          >
            {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold text-foreground">المساعد الذكي</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[11px] text-muted-foreground">متصل — يقرأ بيانات النظام ويجيب أسئلتك</p>
            </div>
          </div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            title={isFullscreen ? 'تصغير' : 'ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Messages */}
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          onSuggestionClick={(q) => { sendMessage(q); }}
          provider={provider}
        />

        {/* Input */}
        <div className="border-t border-border px-4 py-3 shrink-0 bg-gradient-to-t from-muted/30 to-transparent">
          <form
            onSubmit={e => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2 max-w-3xl mx-auto"
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="اكتب سؤالك هنا..."
              className="flex-1 bg-accent/60 backdrop-blur rounded-2xl px-5 py-3 text-sm outline-none border border-border/50 focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-3 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
