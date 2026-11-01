import { useState } from 'react';
import { Layers, Link2, Printer, Save, ShieldCheck, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { linkSizeGroup, sizeGroupsOf, unlinkSizeGroup, type PricingRules } from '@/utils/pricingRules';

export function PricingRulesEditor({ value, savedValue, onChange, levels, sizes, onSave, onSaveDisplay, busy }: {
  value: PricingRules; savedValue: PricingRules; onChange: (value: PricingRules) => void; levels: string[]; sizes: string[]; onSave: () => void; onSaveDisplay: () => void; busy: boolean;
}) {
  const [section, setSection] = useState<'rates' | 'sizes' | 'print'>('rates');
  const [search, setSearch] = useState('');
  const dirty = JSON.stringify(value) !== JSON.stringify(savedValue);
  const selectClass = 'h-11 w-full rounded-lg border border-border bg-background px-3 cursor-pointer';
  const tabs = [{ key: 'rates', label: 'نسب المستويات', icon: Layers }, { key: 'sizes', label: 'ربط المقاسات', icon: Link2 }, { key: 'print', label: 'ظهور النسب بالطباعة', icon: Printer }] as const;
  const otherLevels = levels.filter(level => level !== value.baseLevel);
  const [groupSizes, setGroupSizes] = useState<string[]>([]);
  const [groupSource, setGroupSource] = useState('');
  const activeGroupSource = groupSizes.includes(groupSource) ? groupSource : groupSizes[0] || '';
  const linkedSizes = new Set([...Object.keys(value.sizeAliases), ...Object.values(value.sizeAliases)]);
  const availableForGroup = sizes.filter(size => !linkedSizes.has(size));
  const savedGroups = sizeGroupsOf(value.sizeAliases);
  return <section className="pricing-rules-panel rounded-2xl border border-border bg-card overflow-hidden" aria-label="قواعد التسعير والطباعة">
    <div className="border-b border-border p-5 sm:p-6 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-bold">قواعد التسعير والطباعة</h2><p className="text-sm text-muted-foreground mt-1">اضبط أساس التسعير، ثم اختر ما يظهر لعملائك.</p></div>
      <span role="status" className={`rounded-full px-3 py-1.5 text-xs font-semibold ${dirty ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-muted text-muted-foreground'}`}>{dirty ? 'تغييرات لم تُحفظ' : 'الإعدادات مطابقة للمحفوظ'}</span>
    </div>
    <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="أقسام إعدادات الأسعار" className="bg-muted/30 p-3 flex lg:flex-col gap-2 overflow-x-auto lg:border-l border-border">{tabs.map(({ key, label, icon: Icon }) => <Button key={key} variant={section === key ? 'default' : 'ghost'} aria-pressed={section === key} onClick={() => setSection(key)} className="justify-start h-12 shrink-0"><Icon className="h-4 w-4 ml-2" />{label}</Button>)}<p className="hidden lg:block mt-5 text-xs text-muted-foreground leading-6 px-3">القواعد محفوظة في النظام ومتاحة من الأجهزة الأخرى بعد الحفظ.</p></nav>
      <div className="p-4 sm:p-6 min-w-0 space-y-5">
        {section === 'rates' && <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div><h3 className="font-bold">التسعير من مستوى مرجعي</h3><p className="text-sm text-muted-foreground mt-1">تُحسب النسب داخل كل فئة عملاء على حدة.</p></div>
            <label className="flex gap-2 items-center cursor-pointer text-sm font-semibold"><input className="accent-primary cursor-pointer h-5 w-5" type="checkbox" checked={value.enabled} onChange={e => onChange({ ...value, enabled: e.target.checked })} />تفعيل القواعد</label>
          </div>
          <label className="block max-w-xs space-y-2"><span className="text-sm font-semibold">المستوى المرجعي</span><select className={selectClass} value={value.baseLevel} onChange={e => onChange({ ...value, baseLevel: e.target.value, rates: {} })}>{levels.map(level => <option key={level}>{level}</option>)}</select></label>
          <p className="text-sm text-muted-foreground">الموجب زيادة، والسالب تخفيض. اترك الحقل فارغًا للاحتفاظ بالسعر المستقل.</p>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{otherLevels.map(level => {
            const rate = value.rates[level];
            return <label key={level} className="rounded-xl border border-border p-4 space-y-3 bg-background"><span className="flex justify-between items-center font-bold">المستوى {level}<Percent className="w-4 h-4 text-primary" /></span><Input aria-label={`نسبة المستوى ${level}`} className="h-11 text-lg font-semibold" dir="ltr" type="number" min={-100} step="0.1" placeholder="سعر مستقل" value={rate ?? ''} onChange={e => { const rates = { ...value.rates }; if (e.target.value === '') delete rates[level]; else rates[level] = Number(e.target.value); onChange({ ...value, rates }); }} /><span className="block text-xs text-muted-foreground">{rate === undefined ? 'لا توجد نسبة ثابتة' : rate === 0 ? 'بنفس سعر المستوى المرجعي' : `${rate < 0 ? 'تخفيض' : 'زيادة'} ${Math.abs(rate)}% عن ${value.baseLevel}`}</span></label>;
          })}</div>
          <p className="text-sm rounded-lg bg-muted/50 p-3 leading-6">الحفظ والتطبيق يحدّث الأسعار الفعلية لجميع فئات العملاء. بعد تغيير السعر الأساسي، أعد التطبيق لتحديث المستويات المرتبطة.</p>
        </>}
        {section === 'sizes' && <>
          <div><h3 className="font-bold">مقاسان بسعر واحد</h3><p className="text-sm text-muted-foreground mt-1">اختر المقاس الأعلى ليكون مصدر السعر. سيظهر المقاس المصدر وحده في الطباعة مع ملاحظة تساوي الأسعار.</p></div>
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-4">
            <div><h4 className="font-bold">إضافة مجموعة بسعر مماثل</h4><p className="text-sm text-muted-foreground mt-1">حدد عدة مقاسات بنفس السعر. يُطبَّق سعر المقاس الممثل عليها، وتظهر المجموعة كمقاس واحد في الطباعة. تعمل المجموعات عند تفعيل القواعد.</p></div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">{availableForGroup.map(size => <label key={size} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer"><input className="accent-primary h-5 w-5 cursor-pointer shrink-0" type="checkbox" checked={groupSizes.includes(size)} onChange={e => setGroupSizes(e.target.checked ? [...groupSizes, size] : groupSizes.filter(item => item !== size))} /><span className="font-semibold" dir="ltr">{size}</span></label>)}</div>
            {availableForGroup.length === 0 && <p className="text-sm text-muted-foreground">كل المقاسات مرتبطة بمجموعات حاليًا.</p>}
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-2 min-w-48"><span className="text-sm font-semibold">المقاس الممثل (يحدد السعر)</span><select aria-label="المقاس الممثل للمجموعة" className={selectClass} value={activeGroupSource} onChange={e => setGroupSource(e.target.value)} disabled={groupSizes.length < 2}>{groupSizes.map(size => <option key={size} value={size} dir="ltr">{size}</option>)}</select></label>
              <Button className="h-11" disabled={groupSizes.length < 2} onClick={() => { onChange({ ...value, sizeAliases: linkSizeGroup(value.sizeAliases, activeGroupSource, groupSizes) }); setGroupSizes([]); setGroupSource(''); }}><Link2 className="h-4 w-4 ml-2" />حفظ المجموعة</Button>
            </div>
          </div>
          {savedGroups.length > 0 && <div className="space-y-2">
            <h4 className="font-bold">المجموعات المحفوظة</h4>
            {savedGroups.map(group => <div key={group.source} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span className="text-sm"><b dir="ltr">{group.source}</b><span className="text-muted-foreground"> (الممثل) ← </span><span dir="ltr">{group.members.join('، ')}</span></span>
              <Button variant="outline" className="h-9" onClick={() => onChange({ ...value, sizeAliases: unlinkSizeGroup(value.sizeAliases, group.source) })}>فك المجموعة</Button>
            </div>)}
          </div>}
          <Input aria-label="البحث في المقاسات المرتبطة" placeholder="ابحث عن مقاس..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm h-11" />
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{sizes.filter(size => size.includes(search.trim())).map(size => <label key={size} className="rounded-xl border border-border p-4 space-y-2"><span className="font-semibold block" dir="ltr">{size}</span><select aria-label={`مصدر سعر المقاس ${size}`} className={selectClass} value={value.sizeAliases[size] || ''} onChange={e => { const sizeAliases = { ...value.sizeAliases }; if (e.target.value) sizeAliases[size] = e.target.value; else delete sizeAliases[size]; onChange({ ...value, sizeAliases }); }}><option value="">سعر مستقل</option>{sizes.filter(other => other !== size && !value.sizeAliases[other] && !Object.values(value.sizeAliases).includes(size)).map(other => <option key={other}>{other}</option>)}</select></label>)}</div>
          {!sizes.some(size => size.includes(search.trim())) && <p className="py-8 text-center text-muted-foreground">لا توجد مقاسات مطابقة.</p>}
        </>}
        {section === 'print' && <>
          <div><h3 className="font-bold">بيان فروق المستويات</h3><p className="text-sm text-muted-foreground mt-1">حدد المستويات التي تريد إظهار نسبها. إخفاء النسبة لا يغيّر السعر.</p></div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{otherLevels.map(level => { const visible = !value.hiddenPrintLevels?.includes(level); return <label key={level} className={`flex justify-between items-center gap-3 rounded-xl border p-4 cursor-pointer transition-colors duration-200 ${visible ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30'}`}><span><b className="block">المستوى {level}</b><span className="text-xs text-muted-foreground">{visible ? 'تظهر نسبته في الطباعة' : 'مخفي من بيان النسب'}</span></span><input className="cursor-pointer accent-primary h-5 w-5" type="checkbox" checked={visible} onChange={e => onChange({ ...value, hiddenPrintLevels: e.target.checked ? (value.hiddenPrintLevels || []).filter(item => item !== level) : [...(value.hiddenPrintLevels || []), level] })} /></label>; })}</div>
          <label className="block max-w-xs space-y-2"><span className="text-sm font-semibold">موضع بيان النسب</span><select className={selectClass} value={value.position} onChange={e => onChange({ ...value, position: e.target.value as 'top' | 'bottom' })}><option value="top">أعلى القائمة</option><option value="bottom">أسفل القائمة</option></select></label>
          <label className="flex gap-3 rounded-xl border border-border p-4 cursor-pointer"><input className="h-5 w-5 accent-primary cursor-pointer shrink-0" type="checkbox" checked={value.baseOnly} onChange={e => onChange({ ...value, baseOnly: e.target.checked })} /><span className="text-sm">طباعة صفحة المستوى المرجعي فقط مع نسب بقية المستويات<span className="block text-xs text-muted-foreground mt-1">يُحفظ هذا الخيار مع قواعد التسعير، ويعمل عند تفعيلها.</span></span></label>
          <p className="text-sm text-muted-foreground">لإخفاء صفحة أسعار مستوى معين، ألغِ تحديده من «مستويات اللوحات المطلوبة» في نافذة الطباعة.</p>
        </>}
      </div>
    </div>
    <div className="border-t border-border bg-muted/20 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
      <p className="text-xs text-muted-foreground flex items-center gap-2"><ShieldCheck className="w-4 h-4 shrink-0" />يتطلب حفظ التغييرات اتصالًا بالنظام.</p>
      <div className="flex flex-wrap gap-2">{section === 'print' && <Button className="h-11" variant="outline" disabled={busy} onClick={onSaveDisplay}><Save className="h-4 w-4 ml-2" />حفظ ظهور النسب وموضعها</Button>}<Button className="h-11" disabled={busy} onClick={onSave}><Save className="h-4 w-4 ml-2" />{busy ? 'جارٍ الحفظ...' : 'حفظ القواعد وتطبيق الأسعار'}</Button></div>
    </div>
  </section>;
}
