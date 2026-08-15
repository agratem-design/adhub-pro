import { useRef, useEffect, useState, useCallback } from 'react';
import { Bot, User, Copy, Check, Sparkles, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  onSuggestionClick: (text: string) => void;
  provider?: string | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
      title="نسخ"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

/** Detect if text content is numeric (possibly with commas/decimals) */
function isNumericContent(node: React.ReactNode): boolean {
  if (typeof node === 'string') return /^[\d,.\s٬٫]+$/.test(node.trim());
  if (typeof node === 'number') return true;
  return false;
}

/** Status badge colors */
function getStatusClass(text: string): string {
  const t = typeof text === 'string' ? text.trim() : '';
  if (['متاح', 'متاحة', 'فارغ', 'فارغة', 'available'].includes(t))
    return 'inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (['محجوز', 'محجوزة', 'مؤجر', 'مؤجرة', 'booked', 'rented'].includes(t))
    return 'inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  if (['صيانة', 'maintenance'].includes(t))
    return 'inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return '';
}

export function ChatMessages({ messages, isLoading, onSuggestionClick, provider }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.clientHeight - el.scrollTop;
    setShowScrollBtn(gap > 120);
  }, []);

  return (
    <div className="flex-1 min-h-0 relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto ai-chat-scroll px-2 sm:px-4 py-4 space-y-1"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-5 px-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10 shadow-lg">
              <Sparkles className="w-9 h-9 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">المساعد الذكي</h3>
              <p className="text-sm text-muted-foreground max-w-sm">اسألني أي سؤال عن اللوحات، العقود، العملاء، أو اقترح حملة إعلانية</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-md mt-1">
              {[
                'كم عدد اللوحات؟',
                'ما هي العقود النشطة؟',
                'ملخص الإيرادات',
                'اللوحات المتاحة في زليتن',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => onSuggestionClick(q)}
                  className="px-4 py-3 rounded-2xl border border-border bg-card text-xs hover:bg-accent hover:border-primary/30 hover:shadow-sm transition-all text-start"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`group flex gap-3 py-3 px-3 rounded-2xl transition-colors animate-in fade-in-50 duration-300 ${
              msg.role === 'user'
                ? 'bg-primary/[0.04]'
                : 'hover:bg-muted/30'
            }`}
          >
            {/* Avatar */}
            <div className="flex-shrink-0 mt-0.5">
              {msg.role === 'assistant' ? (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {msg.role === 'assistant' ? (
                <div className="ai-markdown-content text-sm leading-relaxed text-foreground">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 text-foreground border-b border-border pb-1">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-bold mt-4 mb-2 text-foreground">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold mt-3 mb-1.5 text-foreground">{children}</h3>,
                      p: ({ children }) => <p className="mb-2.5 leading-7">{children}</p>,
                      ul: ({ children }) => <ul className="mb-3 mr-4 space-y-1 list-disc marker:text-primary/60">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-3 mr-4 space-y-1 list-decimal marker:text-primary/60">{children}</ol>,
                      li: ({ children }) => <li className="leading-7 pr-1">{children}</li>,
                      strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                      em: ({ children }) => <em className="text-muted-foreground italic">{children}</em>,
                      code: ({ children, className }) => {
                        const isBlock = className?.includes('language-');
                        if (isBlock) {
                          return (
                            <div className="relative my-3 rounded-xl overflow-hidden border border-border">
                              <div className="bg-muted/80 px-3 py-1.5 text-[10px] text-muted-foreground font-mono border-b border-border">
                                {className?.replace('language-', '') || 'code'}
                              </div>
                              <pre className="bg-muted/40 p-3 overflow-x-auto text-xs leading-5">
                                <code className="font-mono">{children}</code>
                              </pre>
                            </div>
                          );
                        }
                        return (
                          <code className="bg-muted/60 text-primary px-1.5 py-0.5 rounded text-[13px] font-mono">
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => <>{children}</>,
                      table: ({ children }) => (
                        <div className="my-3 overflow-x-auto rounded-xl border border-border shadow-sm ai-table-wrapper">
                          <table className="w-full text-sm border-collapse min-w-[400px]">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-primary/10 sticky top-0">{children}</thead>,
                      th: ({ children }) => (
                        <th className="px-3 py-2.5 text-start text-xs font-bold text-foreground border-b-2 border-primary/20 whitespace-nowrap">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => {
                        const isNum = isNumericContent(children);
                        const statusClass = typeof children === 'string' ? getStatusClass(children) :
                          (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string')
                            ? getStatusClass(children[0]) : '';

                        return (
                          <td className={`px-3 py-2 text-xs border-b border-border/50 whitespace-nowrap ${
                            isNum ? 'font-mono tabular-nums direction-ltr text-left' : 'text-foreground'
                          }`}>
                            {statusClass ? <span className={statusClass}>{children}</span> : children}
                          </td>
                        );
                      },
                      tr: ({ children }) => <tr className="hover:bg-muted/40 transition-colors even:bg-muted/20">{children}</tr>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-r-3 border-primary/50 pr-3 mr-1 my-3 text-muted-foreground italic">
                          {children}
                        </blockquote>
                      ),
                      hr: () => <hr className="my-4 border-border" />,
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  <div className="flex items-center gap-1 mt-1">
                    <CopyButton text={msg.content} />
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-7 text-foreground whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-3 py-3 px-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 ring-1 ring-primary/10">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {provider && messages.length > 0 && (
          <div className="flex justify-center pt-1">
            <span className="text-[10px] text-muted-foreground/40">
              {provider === 'gemini' ? 'Gemini' : 'Lovable AI'}
            </span>
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-primary/90 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary transition-all animate-in fade-in zoom-in-75 duration-200"
          title="النزول للأسفل"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
