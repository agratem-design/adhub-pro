import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loadBillboards } from '@/services/billboardService';
import { Printer, Filter, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

type Row = { size: string; install: number | null; print: number | null };

const LS_KEY = 'installation_print_pricing_v1';

function readOverrides(): Record<string, { install?: number; print?: number }> {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function writeOverrides(v: Record<string, { install?: number; print?: number }>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {}
}

export default function InstallationPricing() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const bbs = await loadBillboards();
      const bySize = new Map<string, number[]>();
      for (const b of bbs) {
        const sz = String((b as any).size || (b as any).Size || '').trim();
        if (!sz) continue;
        const inst = (b as any).installationPrice;
        if (!bySize.has(sz)) bySize.set(sz, []);
        if (typeof inst === 'number' && !isNaN(inst)) bySize.get(sz)!.push(inst);
      }
      const overrides = readOverrides();
      const base: Row[] = Array.from(bySize.keys()).sort().map((size) => {
        const list = bySize.get(size) || [];
        const avg = list.length ? Math.round(list.reduce((s, n) => s + n, 0) / list.length) : null;
        const ov = overrides[size] || {};
        return { size, install: ov.install ?? avg, print: ov.print ?? null };
      });
      try {
        const { data, error } = await supabase
          .from('installation_print_pricing')
          .select('size, install_price, print_price');
        if (!error && Array.isArray(data)) {
          const map = new Map(base.map(r => [r.size, { ...r }]));
          data.forEach((d: any) => {
            const k = String(d.size);
            const prev = map.get(k) || { size: k, install: null, print: null };
            map.set(k, { size: k, install: d.install_price ?? prev.install ?? null, print: d.print_price ?? prev.print ?? null });
          });
          setRows(Array.from(map.values()).sort((a,b)=>a.size.localeCompare(b.size)));
        } else {
          setRows(base);
        }
      } catch {
        setRows(base);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter(r => r.size.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const updateRow = (size: string, field: 'install' | 'print', value: number | null) => {
    setRows(prev => prev.map(r => r.size === size ? { ...r, [field]: value } : r));
    const ov = readOverrides();
    ov[size] = { ...(ov[size] || {}), [field]: value == null ? undefined : value } as any;
    writeOverrides(ov);
  };

  const saveAll = async () => {
    try {
      setSaving(true);
      const payload = rows.map(r => ({ size: r.size, install_price: r.install ?? null, print_price: r.print ?? null }));
      const { error } = await supabase
        .from('installation_print_pricing')
        .upsert(payload, { onConflict: 'size' });
      if (error) throw error;
      toast.success('تم حفظ الأسعار بنجاح');
    } catch (e: any) {
      toast.error(`تعذر الحفظ: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const printAll = () => {
    const today = new Date().toLocaleDateString('ar-LY');
    const body = filtered.map(r => `<tr><td class="sz">${r.size}</td><td>${r.install == null ? '—' : r.install.toLocaleString('en-US')} د.ل</td><td>${r.print == null ? '—' : r.print.toLocaleString('en-US')} د.ل</td></tr>`).join('');
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />
      <title>أسعار التركيب والطباعة</title>
      <style>
        body{font-family:'Cairo','Tajawal',system-ui,sans-serif;color:#111}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
        .title{font-weight:800;font-size:22px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #ddd;padding:8px;text-align:right}
        thead th{background:#f5f5f5}
        .sz{font-weight:700;background:#fafafa}
        @media print{button{display:none}}
      </style></head><body>
      <div class="header"><div class="title">أسعار التركيب والطباعة</div><div>${today}</div></div>
      <table><thead><tr><th>المقاس</th><th>سعر التركيب</th><th>سعر الطباعة</th></tr></thead>
      <tbody>${body}</tbody></table>
      <div style="margin-top:12px"><button onclick="window.print()">طباعة</button></div>
      </body></html>`;
    const w = window.open('', '_blank'); if (!w) return; w.document.write(html); w.document.close(); w.focus();
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">أسعار التركيب والطباعة</CardTitle>
              <p className="text-muted-foreground text-sm">لكل مقاس: سعر التركيب وسعر الطباعة (قابلة للتعديل)</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="تصفية حسب المقاس" value={query} onChange={(e)=>setQuery(e.target.value)} className="pr-10" />
              </div>
              <Button variant="outline" onClick={saveAll} disabled={saving}>
                <Save className="h-4 w-4 ml-2" /> {saving ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
              <Button onClick={printAll}><Printer className="h-4 w-4 ml-2" />طباعة</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-muted/20 border-b border-border/30">
                  <th className="p-3">المقاس</th>
                  <th className="p-3">سعر التركيب</th>
                  <th className="p-3">سعر الطباعة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.size} className="border-b border-border/20 hover:bg-background/50">
                    <td className="p-3 font-semibold">{r.size}</td>
                    <td className="p-3">
                      <input type="number" className="w-32 rounded-md border px-2 py-1 bg-background"
                        defaultValue={r.install ?? ''}
                        onBlur={(e)=>updateRow(r.size,'install', e.currentTarget.value.trim()===''?null:Number(e.currentTarget.value))}
                      />
                    </td>
                    <td className="p-3">
                      <input type="number" className="w-32 rounded-md border px-2 py-1 bg-background"
                        defaultValue={r.print ?? ''}
                        onBlur={(e)=>updateRow(r.size,'print', e.currentTarget.value.trim()===''?null:Number(e.currentTarget.value))}
                      />
                    </td>
                  </tr>
                ))}
                {filtered.length===0 && (
                  <tr><td className="p-6 text-muted-foreground" colSpan={3}>لا توجد مقاسات مطابقة</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
