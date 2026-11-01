import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import type { CustomerStamp } from '@/lib/customerStamp';

export function CustomerStampEditor({ value, onChange }: { value: CustomerStamp; onChange: (value: any) => void }) {
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);
  return <section className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
    <h3 className="font-bold">ختم العميل في العقود</h3>
    <label className="block space-y-2 text-sm">صورة الختم (PNG أو JPG أو WebP، بحد أقصى 2 ميجابايت)
      <Input type="file" accept="image/png,image/jpeg,image/webp" disabled={loading} className="cursor-pointer" onChange={async e => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
          toast.error('اختر صورة PNG أو JPG أو WebP لا تتجاوز 2 ميجابايت'); return;
        }
        const current = ++revision.current;
        setLoading(true);
        try {
          const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
          const img = new Image();
          await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = data; });
          if (revision.current === current) onChange({ ...value, stamp_image: data, stamp_enabled: true });
        } catch { toast.error('تعذر قراءة صورة الختم'); } finally { setLoading(false); }
      }} />
    </label>
    {value.stamp_image && <div className="flex items-center gap-3">
      <img src={value.stamp_image} alt="معاينة ختم العميل" className="h-28 w-28 rounded border bg-white object-contain" />
      <Button type="button" variant="outline" className="cursor-pointer transition-all duration-200 hover:bg-destructive/10" onClick={() => { revision.current++; onChange({ ...value, stamp_image: null, stamp_enabled: false }); }}>حذف الختم</Button>
    </div>}
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={value.stamp_enabled ?? false} disabled={!value.stamp_image || loading} onCheckedChange={checked => onChange({ ...value, stamp_enabled: checked === true })} />
      إظهار ختم العميل تلقائياً في العقود
    </label>
    <p className="text-xs text-muted-foreground">يظهر الختم تلقائياً في خانة الطرف الثاني بجانب ختم الشركة أسفل العقد. يفضل استخدام صورة بخلفية شفافة. لا يظهر الختم في عروض الأسعار.</p>
  </section>;
}
