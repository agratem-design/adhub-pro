import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ClipboardPaste, Plus, Table2, Trash2, Wand2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cleanPastedMarkdown, htmlToMarkup, splitPastedLetter, tsvToMarkupTable, type PastedLetterParts } from '@/services/correspondence';

/** النص مقسّم إلى فقرات نصية وجداول — يُخزَّن في قاعدة البيانات كنص مبسّط «| a | b |» */
type Seg = { kind: 'text'; value: string } | { kind: 'table'; rows: string[][] };

const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isSep = (cells: string[]) => cells.every(c => /^\s*:?-{2,}:?\s*$/.test(c));
const splitRow = (l: string) => l.trim().slice(1, -1).split('|').map(c => c.trim());
const padRows = (rows: string[][]) => { const n = Math.max(1, ...rows.map(r => r.length)); return rows.map(r => Array.from({ length: n }, (_, i) => r[i] || '')); };

/** دمج الفقرات المتجاورة، وضمان فقرة قبل وبعد كل جدول ليسهل الكتابة حوله */
function normalize(segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (s.kind === 'text' && last?.kind === 'text') last.value = [last.value.trimEnd(), s.value.trimStart()].filter(Boolean).join('\n\n');
    else {
      if (s.kind === 'table' && last?.kind !== 'text') out.push({ kind: 'text', value: '' });
      out.push(s.kind === 'table' ? { kind: 'table', rows: padRows(s.rows) } : { ...s });
    }
  }
  if (out[out.length - 1]?.kind !== 'text') out.push({ kind: 'text', value: '' });
  return out;
}

function parseBody(body: string): Seg[] {
  const segs: Seg[] = [];
  for (const line of String(body || '').replace(/\r/g, '').split('\n')) {
    const last = segs[segs.length - 1];
    if (isRow(line)) {
      const cells = splitRow(line);
      if (isSep(cells)) continue;
      if (last?.kind === 'table') last.rows.push(cells);
      else segs.push({ kind: 'table', rows: [cells] });
    } else if (last?.kind === 'text') last.value += '\n' + line;
    else segs.push({ kind: 'text', value: line });
  }
  return normalize(segs.map(s => (s.kind === 'text' ? { ...s, value: s.value.replace(/^\n+|\n+$/g, '') } : s)));
}

const cellOut = (c: string) => (c || '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '/').trim();
function serialize(segs: Seg[]): string {
  // الصفوف الفارغة تماماً تبقى في المحرر ولا تُطبع
  return segs.map(s => (s.kind === 'text' ? s.value.replace(/^\n+|\n+$/g, '') : s.rows.filter(r => r.some(c => c.trim())).map(r => `| ${r.map(cellOut).join(' | ')} |`).join('\n')))
    .filter(p => p.trim()).join('\n\n');
}

/** يحوّل محتوى الحافظة إلى نص مبسّط إن كان يحتوي جدولاً (ChatGPT / إكسل / Word / Sheets) */
function clipboardToMarkup(html: string, plain: string): string | null {
  if (/<table[\s>]/i.test(html)) return htmlToMarkup(html);
  if (plain.split(/\r?\n/).filter(isRow).length >= 2) return cleanPastedMarkdown(plain);
  if (/\t/.test(plain) && /\n/.test(plain.trim())) return tsvToMarkupTable(plain);
  return null;
}

function AutoTextarea({ value, onChange, onPaste, onSelect, placeholder, font, className }: { value: string; onChange: (v: string) => void; onPaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void; onSelect: (pos: number) => void; placeholder?: string; font?: string; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; } }, [value]);
  const track = () => onSelect(ref.current?.selectionStart ?? value.length);
  return (
    <textarea ref={ref} value={value} dir="rtl" placeholder={placeholder} rows={2}
      onChange={e => { onChange(e.target.value); onSelect(e.target.selectionStart); }} onPaste={onPaste} onSelect={track} onFocus={track}
      style={{ fontFamily: font }}
      className={cn('block w-full resize-none overflow-hidden bg-transparent px-3 py-2.5 text-base leading-8 outline-none placeholder:text-muted-foreground/70 md:text-[17px]', className)} />
  );
}

function TableBlock({ rows, onChange, onRemove }: { rows: string[][]; onChange: (rows: string[][]) => void; onRemove: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cols = rows[0]?.length || 1;
  const focusCell = (r: number, c: number) => requestAnimationFrame(() => box.current?.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`)?.focus());
  const setCell = (r: number, c: number, v: string) => onChange(rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
  const addRow = (after = rows.length - 1) => { const next = [...rows]; next.splice(after + 1, 0, Array(cols).fill('')); onChange(next); return after + 1; };
  const removeRow = (r: number) => rows.length > 1 && onChange(rows.filter((_, i) => i !== r));
  const addCol = () => onChange(rows.map(r => [...r, '']));
  const removeCol = (c: number) => cols > 1 && onChange(rows.map(r => r.filter((_, j) => j !== c)));
  const onKey = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Enter = الخانة التالية في نفس العمود، ويُضاف صف جديد عند آخر صف
    if (r === rows.length - 1) addRow(r);
    focusCell(r + 1, c);
  };
  return (
    <div ref={box} className="my-1 overflow-hidden rounded-xl border-2 border-primary/30 bg-primary/[0.03]">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-primary/20 bg-primary/10 px-2 py-1.5">
        <span className="me-auto flex items-center gap-1.5 px-1 text-sm font-semibold"><Table2 className="h-4 w-4 text-primary" />جدول <span className="text-xs font-normal text-muted-foreground">{rows.length} صف × {cols} عمود</span></span>
        <Button type="button" size="sm" variant="outline" className="h-9 bg-background" onClick={() => { const r = addRow(); focusCell(r, 0); }}><Plus className="h-3.5 w-3.5" />صف</Button>
        <Button type="button" size="sm" variant="outline" className="h-9 bg-background" onClick={addCol}><Plus className="h-3.5 w-3.5" />عمود</Button>
        <Button type="button" size="sm" variant="ghost" className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" />حذف الجدول</Button>
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full border-collapse text-base">
          <tbody>
            {cols > 1 && (
              <tr>
                {rows[0].map((_, c) => (
                  <td key={c} className="p-0.5 text-center">
                    <button type="button" aria-label={`حذف العمود ${c + 1}`} title="حذف العمود" onClick={() => removeCol(c)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                  </td>
                ))}
                <td />
              </tr>
            )}
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((v, c) => (
                  <td key={c} className="border border-primary/25 p-0">
                    <input data-cell={`${r}-${c}`} value={v} dir="rtl" enterKeyHint="next" onChange={e => setCell(r, c, e.target.value)} onKeyDown={e => onKey(e, r, c)}
                      placeholder={r === 0 ? `عنوان ${c + 1}` : ''}
                      className={cn('h-11 w-full min-w-[7.5rem] bg-transparent px-2.5 text-base outline-none focus:bg-background focus:ring-2 focus:ring-inset focus:ring-primary/60', r === 0 && 'bg-primary/10 font-bold')} />
                  </td>
                ))}
                <td className="w-10 p-0.5 text-center">
                  {rows.length > 1 && <button type="button" aria-label={`حذف الصف ${r + 1}`} title="حذف الصف" onClick={() => removeRow(r)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-1.5 text-xs text-muted-foreground">الصف الأول هو العناوين. Enter ينقلك للخانة التالية ويضيف صفاً في الآخر.</p>
    </div>
  );
}

/** محرر نص المراسلة: فقرات + جداول مرئية، مع لصق الجداول من ChatGPT وإكسل وWord */
export function LetterBodyEditor({ value, onChange, font, companyNames = [], onLetter }: { value: string; onChange: (v: string) => void; font?: string; companyNames?: string[]; onLetter?: (parts: PastedLetterParts) => void }) {
  const [segs, setSegs] = useState<Seg[]>(() => parseBody(value));
  const lastOut = useRef(value);
  const caret = useRef<{ i: number; pos: number } | null>(null);
  // تحميل مراسلة أخرى (أو تغيير خارجي) يعيد بناء المحرر
  useEffect(() => { if (value !== lastOut.current) { lastOut.current = value; setSegs(parseBody(value)); } }, [value]);
  const commit = (next: Seg[]) => { setSegs(next); const s = serialize(next); lastOut.current = s; onChange(s); };

  /** إدراج نص مبسّط (قد يحتوي جداول) في موضع المؤشر داخل الفقرة i */
  const insertAt = (i: number, start: number, end: number, markup: string) => {
    const s = segs[i];
    const text = s?.kind === 'text' ? s.value : '';
    commit(normalize([...segs.slice(0, i), { kind: 'text', value: text.slice(0, start) }, ...parseBody(markup), { kind: 'text', value: text.slice(end) }, ...segs.slice(i + 1)]));
  };
  /** مراسلة كاملة ← توزيعها على الحقول (الموجَّه إليه/الموضوع/التحية/الختام) والمتن هنا */
  const applyLetter = (markup: string) => {
    const parts = onLetter ? splitPastedLetter(markup, companyNames) : null;
    if (!parts) return false;
    onLetter!(parts);
    const filled = [parts.recipient && 'الموجَّه إليه', parts.subject && 'الموضوع', parts.greeting && 'التحية', parts.closing && 'الختام', parts.signer_title && 'الصفة'].filter(Boolean);
    toast.success(`تم ترتيب المراسلة${filled.length ? `: ${filled.join('، ')}` : ''}`);
    return true;
  };
  const pasteInto = (i: number) => (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html'), plain = e.clipboardData.getData('text/plain');
    const markup = clipboardToMarkup(html, plain) ?? (html.trim() ? htmlToMarkup(html) : cleanPastedMarkdown(plain));
    const el = e.currentTarget;
    // لصق مراسلة كاملة في خانة فارغة ← توزيع تلقائي على الحقول
    if (!serialize(segs).trim() && applyLetter(markup)) { e.preventDefault(); return; }
    if (!markup.split('\n').some(isRow)) return;
    e.preventDefault();
    insertAt(i, el.selectionStart, el.selectionEnd, markup);
    toast.success('تم لصق الجدول');
  };
  const organize = () => { if (!applyLetter(serialize(segs))) toast.info('لم يُعثر على أجزاء مراسلة (الموجَّه إليه، الموضوع، التحية، الختام) لترتيبها'); };
  const insertTable = () => {
    const at = caret.current && segs[caret.current.i]?.kind === 'text' ? caret.current : { i: segs.length - 1, pos: (segs[segs.length - 1] as { value: string }).value.length };
    insertAt(at.i, at.pos, at.pos, '| البند | التفاصيل |\n|  |  |');
  };
  /** لصق من زر (مفيد على الهاتف) عبر Clipboard API */
  const pasteButton = async () => {
    try {
      let html = '', plain = '';
      if (navigator.clipboard?.read) {
        for (const item of await navigator.clipboard.read()) {
          if (item.types.includes('text/html')) html = await (await item.getType('text/html')).text();
          if (item.types.includes('text/plain')) plain = await (await item.getType('text/plain')).text();
        }
      } else plain = await navigator.clipboard.readText();
      const markup = clipboardToMarkup(html, plain) ?? (html.trim() ? htmlToMarkup(html) : cleanPastedMarkdown(plain));
      if (!markup.trim()) { toast.info('الحافظة فارغة'); return; }
      if (!serialize(segs).trim() && applyLetter(markup)) return;
      const at = caret.current && segs[caret.current.i]?.kind === 'text' ? caret.current : { i: segs.length - 1, pos: (segs[segs.length - 1] as { value: string }).value.length };
      insertAt(at.i, at.pos, at.pos, markup);
      toast.success('تم اللصق');
    } catch { toast.error('اسمح للمتصفح بالوصول إلى الحافظة، أو الصق مباشرة داخل الخانة'); }
  };

  return (
    <div className="overflow-hidden rounded-xl border-2 border-border bg-background shadow-sm transition-colors focus-within:border-primary/60">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/60 px-2 py-1.5 backdrop-blur">
        <Button type="button" size="sm" variant="outline" className="h-9 bg-background" onClick={insertTable}><Table2 className="h-4 w-4" />إدراج جدول</Button>
        <Button type="button" size="sm" variant="outline" className="h-9 bg-background" onClick={pasteButton}><ClipboardPaste className="h-4 w-4" />لصق</Button>
        {onLetter && <Button type="button" size="sm" variant="outline" className="h-9 bg-background" title="يوزّع الموجَّه إليه والموضوع والتحية والختام على حقولها ويحذف اسم الشركة المكرر" onClick={organize}><Wand2 className="h-4 w-4" />تنظيم المراسلة</Button>}
        <span className="text-xs text-muted-foreground">الصق مراسلة كاملة من ChatGPT وتُرتَّب تلقائياً، والجداول تظهر جدولاً</span>
      </div>
      <div className="space-y-1 p-1.5">
        {segs.map((s, i) => s.kind === 'text'
          ? <AutoTextarea key={i} value={s.value} font={font} onPaste={pasteInto(i)} onSelect={pos => { caret.current = { i, pos }; }}
              onChange={v => commit(segs.map((x, j) => (j === i ? { kind: 'text', value: v } : x)))}
              placeholder={i === 0 ? 'اكتب تفاصيل المراسلة هنا… (سطر فارغ بين الفقرات)' : i === segs.length - 1 ? 'تابع الكتابة هنا…' : ''}
              className={cn(i === 0 && segs.length === 1 && 'min-h-[14rem]', segs.length > 1 && !s.value && 'py-1 leading-6')} />
          : <TableBlock key={i} rows={s.rows} onChange={rows => commit(segs.map((x, j) => (j === i ? { kind: 'table', rows } : x)))} onRemove={() => commit(normalize(segs.filter((_, j) => j !== i)))} />)}
      </div>
    </div>
  );
}
