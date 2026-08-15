import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Pencil, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OwnerCompanyChangerProps {
  billboardId: number | string;
  currentOwnCompanyId?: string | null;
  onUpdate: () => void;
}

export function OwnerCompanyChanger({ billboardId, currentOwnCompanyId, onUpdate }: OwnerCompanyChangerProps) {
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string; brand_color: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from('friend_companies').select('id, name, brand_color').eq('company_type', 'own').order('name')
      .then(({ data }) => { setCompanies(data || []); setLoading(false); });
  }, [open]);

  const handleSelect = async (companyId: string | null) => {
    setSaving(true);
    const { error } = await supabase.from('billboards').update({ own_company_id: companyId } as any).eq('ID', Number(billboardId));
    setSaving(false);
    if (error) {
      toast.error('فشل تغيير الشركة المالكة');
    } else {
      toast.success('تم تغيير الشركة المالكة');
      onUpdate();
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-6 h-6 rounded-full flex items-center justify-center bg-muted hover:bg-accent transition-colors"
          title="تغيير الشركة المالكة"
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">اختر الشركة المالكة</div>
        {loading ? (
          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            <button
              className={`w-full text-right px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors flex items-center justify-between ${!currentOwnCompanyId ? 'bg-accent font-semibold' : ''}`}
              onClick={() => handleSelect(null)}
              disabled={saving}
            >
              <span>بدون شركة</span>
              {!currentOwnCompanyId && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
            {companies.map((c) => (
              <button
                key={c.id}
                className={`w-full text-right px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors flex items-center justify-between ${currentOwnCompanyId === c.id ? 'bg-accent font-semibold' : ''}`}
                onClick={() => handleSelect(c.id)}
                disabled={saving}
              >
                <div className="flex items-center gap-2">
                  {c.brand_color && <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c.brand_color }} />}
                  <span>{c.name}</span>
                </div>
                {currentOwnCompanyId === c.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
