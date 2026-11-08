import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Bold, ClipboardPaste, Copy, Eraser, Heading, List, ListOrdered, Plus, Sigma, Table2, Trash2, Wand2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { cleanPastedMarkdown, htmlToMarkup, isTotalLabel, parseCellNumber, renderMarkup, splitPastedLetter, tsvToMarkupTable, type PastedLetterParts } from '@/services/correspondence';

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

function AutoTextarea({ value, onChange, onPaste, onSelect, inputRef, placeholder, font, className }: { value: string; onChange: (v: string) => void; onPaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void; onSelect: (start: number, end: number) => void; inputRef: (el: HTMLTextAreaElement | null) => void; placeholder?: string; font?: string; className?: string }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; } }, [value]);
  const track = () => { const el = ref.current; onSelect(el?.selectionStart ?? value.length, el?.selectionEnd ?? value.length); };
  /** Enter داخل قائمة مرقّمة «1.» أو نقطية «-» يكمل الترقيم تلقائياً؛ Enter على عنصر فارغ ينهي القائمة */
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    const el = e.currentTarget, pos = el.selectionStart;
    if (pos !== el.selectionEnd) return;
    const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
    const lineEndRaw = value.indexOf('\n', pos);
    const lineEnd = lineEndRaw < 0 ? value.length : lineEndRaw;
    if (pos !== lineEnd) return;
    const line = value.slice(lineStart, lineEnd);
    const m = line.match(/^(\s*)(?:([0-9٠-٩]+)([.)\-])|([-•]))\s+(.*)$/) || line.match(/^(\s*)(?:([0-9٠-٩]+)([.)\-])|([-•]))\s*()$/);
    if (!m) return;
    e.preventDefault();
    let next: string, caret: number;
    if (!m[5].trim()) { next = value.slice(0, lineStart) + value.slice(lineEnd); caret = lineStart; }
    else {
      const arabic = m[2] && /[٠-٩]/.test(m[2]);
      const n = m[2] ? Number(m[2].replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))) + 1 : 0;
      const marker = m[2] ? `${arabic ? String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]) : n}${m[3]} ` : `${m[4]} `;
      const ins = `\n${m[1]}${marker}`;
      next = value.slice(0, pos) + ins + value.slice(pos); caret = pos + ins.length;
    }
    onChange(next);
    requestAnimationFrame(() => { const t = ref.current; if (t) { t.setSelectionRange(caret, caret); onSelect(caret, caret); } });
  };
  return (
    <textarea ref={el => { ref.current = el; inputRef(el); }} value={value} dir="rtl" placeholder={placeholder} rows={2} onKeyDown={onKeyDown}
      onChange={e => { onChange(e.target.value); onSelect(e.target.selectionStart, e.target.selectionEnd); }} onPaste={onPaste} onSelect={track} onFocus={track}
      style={{ fontFamily: font }}
      className={cn('block w-full resize-none overflow-hidden bg-transparent px-3 py-2.5 text-base leading-8 outline-none placeholder:text-muted-foreground/70 md:text-[17px]', className)} />
  );
}

const fmtNumber = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

// ===== جدول ذكي مثل إكسل: ترقيم تلقائي + ضرب العدد × السعر + صف إجمالي يُحدَّث مع كل كتابة =====
const hd = (c: string) => (c || '').replace(/\*\*/g, '').trim();
const SERIAL_RE = /^(م|ت|#|ر\.?\s?م|رقم|الرقم|ت\.?|التسلسل|تسلسل|no\.?)$/i;
/** أعمدة لا تُجمع (سنوات، هواتف، تواريخ، أكواد، نسب، مقاسات) */
const NO_SUM_RE = /(سنة|السنة|عام|تاريخ|هاتف|جوال|رقم|كود|نسبة|%|مقاس|المقاس|الأبعاد|ترتيب)/;
const QTY_RE = /^(ال)?(عدد|كمية|كميه)/;
const PRICE_RE = /(سعر|الفئة|فئة)/;
const AMOUNT_RE = /(إجمالي|اجمالي|الإجمالي|المجموع|مجموع|القيمة|قيمة|المبلغ|مبلغ)/;
/** أعمدة تستحق صف إجمالي تلقائي */
const SUMMABLE_HINT_RE = /(مبلغ|قيمة|سعر|تكلفة|إجمالي|اجمالي|مجموع|عدد|كمية|د\.?ل|دينار|مساحة|المساحة)/;

const isTotalRow = (r: string[]) => isTotalLabel(r[0] || '') || r.some(c => isTotalLabel(c));
export const serialCol = (head: string[]) => head.findIndex(c => SERIAL_RE.test(hd(c)));

/** يعيد حساب الجدول: ترقيم عمود «م»، عمود الإجمالي = العدد × السعر، وصف الإجمالي إن وُجد */
function recalcTable(rows: string[][], opts: { autoTotal: boolean }): string[][] {
  if (rows.length < 2) return rows;
  const head = rows[0].map(hd);
  const sc = serialCol(head);
  const qc = head.findIndex(c => QTY_RE.test(c));
  const pc = head.findIndex(c => PRICE_RE.test(c) && !AMOUNT_RE.test(c));
  const ac = head.findIndex((c, i) => i !== pc && i !== qc && i !== sc && AMOUNT_RE.test(c));
  let next = rows.map(r => [...r]);
  // صف الإجمالي دائماً في الآخر
  const totalIdx = next.findIndex((r, i) => i > 0 && isTotalRow(r));
  let total = totalIdx > 0 ? next.splice(totalIdx, 1)[0] : null;
  const body = next.slice(1);
  // ١) ترقيم تلقائي للصفوف التي فيها محتوى
  if (sc >= 0) {
    let n = 0;
    body.forEach(r => { r[sc] = r.some((c, j) => j !== sc && c.trim()) ? String(++n) : ''; });
  }
  // ٢) الإجمالي في كل صف = العدد × السعر
  if (qc >= 0 && pc >= 0 && ac >= 0) {
    body.forEach(r => {
      const q = parseCellNumber(r[qc]), p = parseCellNumber(r[pc]);
      if (q !== null && p !== null) r[ac] = fmtNumber(q * p);
    });
  }
  // ٣) صف الإجمالي: يُضاف تلقائياً إذا وُجد عمود مبالغ فيه رقمان أو أكثر
  const sums = head.map((h, c) => {
    // سعر الوحدة لا يُجمع (جمع الأسعار لا معنى له)
    if (c === sc || c === pc || NO_SUM_RE.test(h)) return '';
    const cells = body.map(r => (r[c] || '').trim()).filter(Boolean);
    const nums = cells.map(parseCellNumber);
    if (!cells.length || nums.some(n => n === null) || cells.some(x => x.includes('%'))) return '';
    return fmtNumber(nums.reduce((s, n) => s + (n as number), 0));
  });
  const worth = head.some((h, c) => sums[c] && SUMMABLE_HINT_RE.test(h) && body.filter(r => parseCellNumber(r[c]) !== null).length >= 2);
  if (!total && opts.autoTotal && worth) total = head.map(() => '');
  if (total) {
    // يُحتفظ بنص التسمية الموجود (مثل «الإجمالي العام للوحات») ؛ وعند وجود «م» أولاً تُكتب في الخانة الثانية
    const old = total;
    const label = sc === 0 && head.length > 1 ? 1 : 0;
    const labelText = old.find(c => isTotalLabel(c)) || 'الإجمالي';
    total = head.map((_, c) => (c === label ? labelText : c === sc ? '' : sums[c] ? (/^\*\*.*\*\*$/.test(old[c] || '') ? `**${sums[c]}**` : sums[c]) : ''));
  }
  next = [next[0], ...body, ...(total ? [total] : [])];
  return next;
}

function TableBlock({ rows, onChange, onRemove }: { rows: string[][]; onChange: (rows: string[][]) => void; onRemove: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  /** إذا حذف المستخدم صف الإجمالي لا يُعاد إضافته تلقائياً */
  const noAutoTotal = useRef(false);
  const cols = rows[0]?.length || 1;
  const commit = (next: string[][]) => onChange(recalcTable(next, { autoTotal: !noAutoTotal.current }));
  const focusCell = (r: number, c: number) => requestAnimationFrame(() => box.current?.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`)?.focus());
  const setCell = (r: number, c: number, v: string) => commit(rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
  // الصف الجديد يُضاف قبل صف الإجمالي إن وُجد
  const totalAt = rows.length > 1 && isTotalRow(rows[rows.length - 1]) ? rows.length - 1 : -1;
  const sc = serialCol(rows[0] || []);
  const computedCol = (() => {
    const h = (rows[0] || []).map(hd);
    const qc = h.findIndex(c => QTY_RE.test(c)), pc = h.findIndex(c => PRICE_RE.test(c) && !AMOUNT_RE.test(c));
    return qc >= 0 && pc >= 0 ? h.findIndex((c, i) => i !== pc && i !== qc && i !== sc && AMOUNT_RE.test(c)) : -1;
  })();
  const addRow = (after = (totalAt > 0 ? totalAt : rows.length) - 1) => { const next = [...rows]; next.splice(after + 1, 0, Array(cols).fill('')); onChange(next); return after + 1; };
  const removeRow = (r: number) => { if (rows.length <= 1) return; if (r === totalAt) noAutoTotal.current = true; commit(rows.filter((_, i) => i !== r)); };
  const addCol = () => onChange(rows.map(r => [...r, '']));
  const removeCol = (c: number) => cols > 1 && commit(rows.map(r => r.filter((_, j) => j !== c)));
  const toggleTotal = () => {
    if (totalAt > 0) { noAutoTotal.current = true; onChange(rows.slice(0, totalAt)); toast.info('أُزيل صف الإجمالي'); return; }
    noAutoTotal.current = false;
    const next = recalcTable([...rows, ['الإجمالي', ...Array(cols - 1).fill('')]], { autoTotal: true });
    if (next[next.length - 1].slice(1).some(v => v.trim())) { onChange(next); toast.success('الإجمالي يُحسب تلقائياً مع كل تعديل'); }
    else toast.info('لا توجد أعمدة أرقام لجمعها');
  };
  /** يضيف عمود «م» في البداية ويرقّم الصفوف (أو يزيله) */
  const toggleNumbering = () => {
    if (sc >= 0) { commit(rows.map(r => r.filter((_, j) => j !== sc))); return; }
    commit(rows.map((r, i) => [i === 0 ? 'م' : '', ...r]));
    toast.success('ترقيم تلقائي للصفوف');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Enter = الخانة التالية في نفس العمود، ويُضاف صف جديد عند آخر صف (قبل الإجمالي)
    if (r === rows.length - 1 || r + 1 === totalAt) addRow(r);
    focusCell(r + 1, c);
  };
  return (
    <div ref={box} className="my-1 overflow-hidden rounded-xl border-2 border-primary/30 bg-primary/[0.03]">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-primary/20 bg-primary/10 px-2 py-1.5">
        <span className="me-auto flex items-center gap-1.5 px-1 text-sm font-semibold"><Table2 className="h-4 w-4 text-primary" />جدول <span className="text-xs font-normal text-muted-foreground">{rows.length} صف × {cols} عمود</span></span>
        <Button type="button" size="sm" variant="outline" className="h-9 bg-background" onClick={() => { const r = addRow(); focusCell(r, 0); }}><Plus className="h-3.5 w-3.5" />صف</Button>
        <Button type="button" size="sm" variant="outline" className="h-9 bg-background" onClick={addCol}><Plus className="h-3.5 w-3.5" />عمود</Button>
        <Button type="button" size="sm" variant="outline" className="h-9 bg-background" title={sc >= 0 ? 'إزالة عمود الترقيم' : 'يضيف عمود «م» يُرقَّم تلقائياً'} aria-pressed={sc >= 0} onClick={toggleNumbering}><ListOrdered className="h-3.5 w-3.5" />{sc >= 0 ? 'إزالة الترقيم' : 'ترقيم'}</Button>
        <Button type="button" size="sm" variant="outline" className="h-9 bg-background" title={totalAt > 0 ? 'إزالة صف الإجمالي' : 'يضيف صفاً يجمع أعمدة الأرقام تلقائياً'} aria-pressed={totalAt > 0} onClick={toggleTotal}><Sigma className="h-3.5 w-3.5" />{totalAt > 0 ? 'إزالة الإجمالي' : 'الإجمالي'}</Button>
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
                    <input data-cell={`${r}-${c}`} value={v} dir="rtl" enterKeyHint="next"
                      readOnly={r > 0 && (c === sc || c === computedCol || (r === totalAt && c > 0))}
                      title={r > 0 && c === sc ? 'ترقيم تلقائي' : r > 0 && c === computedCol ? 'يُحسب تلقائياً: العدد × السعر' : r === totalAt && c > 0 ? 'يُجمع تلقائياً' : undefined}
                      onChange={e => setCell(r, c, e.target.value)} onKeyDown={e => onKey(e, r, c)}
                      placeholder={r === 0 ? `عنوان ${c + 1}` : ''} inputMode={r > 0 && c > 0 && parseCellNumber(v) !== null ? 'decimal' : undefined}
                      className={cn('h-11 w-full min-w-[7.5rem] bg-transparent px-2.5 text-base outline-none focus:bg-background focus:ring-2 focus:ring-inset focus:ring-primary/60',
                        r === 0 && 'bg-primary/10 text-center font-bold', r === totalAt && 'bg-primary/15 font-bold', r > 0 && parseCellNumber(v) !== null && 'text-center tabular-nums',
                        r > 0 && (c === sc || c === computedCol) && 'cursor-default bg-muted/50 text-muted-foreground', c === sc && 'min-w-[3rem] text-center')} />
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
      <p className="px-3 py-1.5 text-xs text-muted-foreground">الصف الأول هو العناوين. Enter ينقلك للخانة التالية ويضيف صفاً في الآخر. الترقيم والإجمالي (وعمود الإجمالي = العدد × السعر) تُحسب تلقائياً مثل إكسل.</p>
    </div>
  );
}

type Caret = { i: number; start: number; end: number };

/** محرر نص المراسلة: فقرات + جداول مرئية، مع لصق الجداول والمراسلات الكاملة من ChatGPT وإكسل وWord */
export function LetterBodyEditor({ value, onChange, font, companyNames = [], onLetter }: {
  value: string; onChange: (v: string) => void; font?: string; companyNames?: string[];
  /** توزيع مراسلة ملصوقة على الحقول — يعيد دالة للتراجع */
  onLetter?: (parts: PastedLetterParts) => (() => void) | void;
}) {
  const { confirm } = useSystemDialog();
  const [segs, setSegs] = useState<Seg[]>(() => parseBody(value));
  const lastOut = useRef(value);
  const caret = useRef<Caret | null>(null);
  const els = useRef(new Map<number, HTMLTextAreaElement>());
  // تحميل مراسلة أخرى (أو تغيير خارجي) يعيد بناء المحرر
  useEffect(() => { if (value !== lastOut.current) { lastOut.current = value; setSegs(parseBody(value)); } }, [value]);
  const commit = (next: Seg[]) => { setSegs(next); const s = serialize(next); lastOut.current = s; onChange(s); };
  /** تنفيذ تغيير كبير مع زر «تراجع» في الإشعار */
  const commitUndoable = (next: Seg[], msg: string) => {
    const prev = segs;
    commit(next);
    toast.success(msg, { action: { label: 'تراجع', onClick: () => commit(prev) } });
  };
  const caretOrEnd = (): Caret => {
    const c = caret.current;
    if (c && segs[c.i]?.kind === 'text') return c;
    const i = segs.length - 1, len = (segs[i] as { value: string }).value.length;
    return { i, start: len, end: len };
  };

  /** إدراج نص مبسّط (قد يحتوي جداول) في موضع المؤشر داخل الفقرة i */
  const insertAt = (i: number, start: number, end: number, markup: string, msg: string) => {
    const s = segs[i];
    const text = s?.kind === 'text' ? s.value : '';
    commitUndoable(normalize([...segs.slice(0, i), { kind: 'text', value: text.slice(0, start) }, ...parseBody(markup), { kind: 'text', value: text.slice(end) }, ...segs.slice(i + 1)]), msg);
  };
  /** مراسلة كاملة ← توزيعها على الحقول (الموجَّه إليه/الموضوع/التحية/الختام) والمتن هنا */
  const applyLetter = (parts: PastedLetterParts) => {
    const undo = onLetter!(parts);
    const filled = [parts.recipient && 'الموجَّه إليه', parts.subject && 'الموضوع', parts.greeting && 'التحية', parts.closing && 'الختام', parts.signer_name && 'الموقِّع', parts.signer_title && 'الصفة', parts.letter_date && 'التاريخ'].filter(Boolean);
    toast.success(`تم ترتيب المراسلة${filled.length ? `: ${filled.join('، ')}` : ''}`, undo ? { action: { label: 'تراجع', onClick: undo } } : undefined);
  };
  const letterParts = (markup: string) => (onLetter ? splitPastedLetter(markup, companyNames) : null);
  /** لصق محتوى: مراسلة كاملة ← ترتيب (مع سؤال الاستبدال إن كان هناك نص)، جدول ← إدراج */
  const handlePasted = async (markup: string, at: Caret, alwaysInsert: boolean) => {
    const parts = letterParts(markup);
    if (parts && (parts.subject || parts.greeting)) {
      if (!serialize(segs).trim()) { applyLetter(parts); return true; }
      const replace = await confirm({ title: 'لصق مراسلة كاملة', message: 'النص الملصوق مراسلة كاملة. هل تستبدل بها المراسلة الحالية وتُرتَّب في الحقول، أم تُضاف في مكان المؤشر؟', confirmText: 'استبدال وترتيب', cancelText: 'إضافة في مكان المؤشر' } as any);
      if (replace) applyLetter(parts); else insertAt(at.i, at.start, at.end, markup, 'تم اللصق');
      return true;
    }
    if (alwaysInsert || markup.split('\n').some(isRow)) { insertAt(at.i, at.start, at.end, markup, markup.split('\n').some(isRow) ? 'تم لصق الجدول' : 'تم اللصق'); return true; }
    return false;
  };
  const pasteInto = (i: number) => (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html'), plain = e.clipboardData.getData('text/plain');
    const markup = clipboardToMarkup(html, plain) ?? (html.trim() ? htmlToMarkup(html) : cleanPastedMarkdown(plain));
    const el = e.currentTarget, at = { i, start: el.selectionStart, end: el.selectionEnd };
    const parts = letterParts(markup);
    // نص عادي بدون جداول ولا مراسلة كاملة ← لصق المتصفح العادي
    if (!(parts && (parts.subject || parts.greeting)) && !markup.split('\n').some(isRow)) return;
    e.preventDefault();
    void handlePasted(markup, at, true);
  };
  const organize = () => {
    const parts = letterParts(serialize(segs));
    if (parts) applyLetter(parts); else toast.info('لم يُعثر على أجزاء مراسلة (الموجَّه إليه، الموضوع، التحية، الختام) لترتيبها');
  };
  const insertTable = () => { const at = caretOrEnd(); insertAt(at.i, at.end, at.end, '| البند | التفاصيل |\n|  |  |', 'أُدرج جدول'); };
  /** لصق من زر (مفيد على الهاتف) عبر Clipboard API */
  const pasteButton = async () => {
    if (!window.isSecureContext || !navigator.clipboard) {
      toast.info('المتصفح يمنع زر اللصق على هذا الرابط (http). الصق مباشرة داخل الخانة: Ctrl+V، أو ضغطة مطوّلة ثم «لصق» على الهاتف', { duration: 7000 });
      return;
    }
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
      await handlePasted(markup, caretOrEnd(), true);
    } catch { toast.error('اسمح للمتصفح بالوصول إلى الحافظة، أو الصق مباشرة داخل الخانة'); }
  };

  /** تنسيق النص المحدد: غامق / عنوان / قائمة */
  const format = (kind: 'bold' | 'heading' | 'list' | 'numbered') => {
    const at = caretOrEnd(), seg = segs[at.i] as { kind: 'text'; value: string };
    const v = seg.value;
    let next = v, selStart = at.start, selEnd = at.end;
    if (kind === 'bold') {
      const sel = v.slice(at.start, at.end);
      next = `${v.slice(0, at.start)}**${sel}**${v.slice(at.end)}`;
      selStart = at.start + 2; selEnd = at.end + 2;
    } else {
      const ls = v.lastIndexOf('\n', at.start - 1) + 1;
      const le = v.indexOf('\n', Math.max(at.end - (at.end > at.start ? 1 : 0), ls));
      const block = v.slice(ls, le < 0 ? v.length : le);
      const lines = block.split('\n');
      let out: string;
      if (kind === 'numbered') {
        // ترقيم تلقائي 1. 2. 3. (أو إزالته إن كان مرقّماً)
        const re = /^\s*[0-9٠-٩]+[.)\-]\s+/;
        const on = lines.every(l => !l.trim() || re.test(l));
        let n = 0;
        out = lines.map(l => (!l.trim() ? l : on ? l.replace(re, '') : `${++n}. ${l.replace(/^(## |- )/, '').replace(re, '')}`)).join('\n');
      } else {
        const mark = kind === 'heading' ? '## ' : '- ';
        const on = lines.every(l => !l.trim() || l.startsWith(mark));
        out = lines.map(l => (!l.trim() ? l : on ? l.slice(mark.length) : `${mark}${l.replace(/^(## |- |\s*[0-9٠-٩]+[.)\-]\s+)/, '')}`)).join('\n');
      }
      next = v.slice(0, ls) + out + v.slice(le < 0 ? v.length : le);
      selStart = ls; selEnd = ls + out.length;
    }
    commit(segs.map((x, j) => (j === at.i ? { kind: 'text', value: next } : x)));
    caret.current = { i: at.i, start: selStart, end: selEnd };
    requestAnimationFrame(() => { const el = els.current.get(at.i); if (el) { el.focus(); el.setSelectionRange(selStart, selEnd); } });
  };
  const keep = (e: { preventDefault: () => void }) => e.preventDefault(); // يبقي التحديد في الخانة عند الضغط على الأزرار

  /** نسخ النص كاملاً: نص عادي + HTML (الجداول تُلصق جداول في Word/إكسل) */
  const copyAll = async () => {
    const text = serialize(segs);
    if (!text.trim()) { toast.info('لا يوجد نص لنسخه'); return; }
    const html = `<div dir="rtl">${renderMarkup(text)}</div>`;
    try {
      if (window.isSecureContext && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
        toast.success('نُسخ النص'); return;
      }
    } catch { /* ننتقل للطريقة البديلة */ }
    // بديل يعمل على http (مثل 192.168.x.x) حيث يحظر المتصفح الحافظة
    const onCopy = (e: globalThis.ClipboardEvent) => { e.preventDefault(); e.clipboardData?.setData('text/plain', text); e.clipboardData?.setData('text/html', html); };
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta); ta.select();
    document.addEventListener('copy', onCopy);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.removeEventListener('copy', onCopy); ta.remove();
    if (ok) toast.success('نُسخ النص'); else toast.error('تعذّر النسخ — حدّد النص وانسخه يدوياً');
  };
  /** مسح النص كاملاً (مع تراجع) */
  const clearAll = () => {
    if (!serialize(segs).trim()) return;
    commitUndoable(normalize([{ kind: 'text', value: '' }]), 'مُسح النص');
  };

  const tool = 'h-9 bg-background px-2.5';
  return (
    <div className="overflow-hidden rounded-xl border-2 border-border bg-background shadow-sm transition-colors focus-within:border-primary/60">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/60 px-2 py-1.5 backdrop-blur">
        <Button type="button" size="sm" variant="outline" className={tool} onMouseDown={keep} onClick={() => format('bold')} title="غامق" aria-label="غامق"><Bold className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="outline" className={tool} onMouseDown={keep} onClick={() => format('heading')} title="عنوان"><Heading className="h-4 w-4" /><span className="hidden sm:inline">عنوان</span></Button>
        <Button type="button" size="sm" variant="outline" className={tool} onMouseDown={keep} onClick={() => format('list')} title="قائمة نقاط"><List className="h-4 w-4" /><span className="hidden sm:inline">قائمة</span></Button>
        <Button type="button" size="sm" variant="outline" className={tool} onMouseDown={keep} onClick={() => format('numbered')} title="ترقيم تلقائي 1. 2. 3."><ListOrdered className="h-4 w-4" /><span className="hidden sm:inline">ترقيم</span></Button>
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden="true" />
        <Button type="button" size="sm" variant="outline" className={tool} onMouseDown={keep} onClick={insertTable}><Table2 className="h-4 w-4" />جدول</Button>
        <Button type="button" size="sm" variant="outline" className={tool} onClick={pasteButton}><ClipboardPaste className="h-4 w-4" />لصق</Button>
        {onLetter && <Button type="button" size="sm" variant="outline" className={tool} title="يوزّع الموجَّه إليه والموضوع والتحية والختام على حقولها ويحذف اسم الشركة المكرر" onClick={organize}><Wand2 className="h-4 w-4" />تنظيم</Button>}
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden="true" />
        <Button type="button" size="sm" variant="outline" className={tool} onClick={copyAll} title="نسخ النص كاملاً (مع الجداول)"><Copy className="h-4 w-4" /><span className="hidden sm:inline">نسخ</span></Button>
        <Button type="button" size="sm" variant="outline" className={cn(tool, 'text-destructive hover:bg-destructive/10 hover:text-destructive')} onClick={clearAll} title="مسح النص كاملاً (يمكن التراجع)"><Eraser className="h-4 w-4" /><span className="hidden sm:inline">مسح</span></Button>
        <span className="hidden text-xs text-muted-foreground lg:inline">الصق مراسلة كاملة من ChatGPT وتُرتَّب تلقائياً، والجداول تظهر جدولاً</span>
      </div>
      <div className="space-y-1 p-1.5">
        {segs.map((s, i) => s.kind === 'text'
          ? <AutoTextarea key={i} value={s.value} font={font} onPaste={pasteInto(i)} onSelect={(start, end) => { caret.current = { i, start, end }; }}
              inputRef={el => { if (el) els.current.set(i, el); else els.current.delete(i); }}
              onChange={v => commit(segs.map((x, j) => (j === i ? { kind: 'text', value: v } : x)))}
              placeholder={i === 0 ? 'اكتب تفاصيل المراسلة هنا… أو الصق مراسلة كاملة من ChatGPT' : i === segs.length - 1 ? 'تابع الكتابة هنا…' : ''}
              className={cn(i === 0 && segs.length === 1 && 'min-h-[14rem]', segs.length > 1 && !s.value && 'py-1 leading-6')} />
          : <TableBlock key={i} rows={s.rows} onChange={rows => commit(segs.map((x, j) => (j === i ? { kind: 'table', rows } : x)))} onRemove={() => commitUndoable(normalize(segs.filter((_, j) => j !== i)), 'حُذف الجدول')} />)}
      </div>
    </div>
  );
}
