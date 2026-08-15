// @ts-nocheck
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ManagementPhone {
  id: string;
  phone_number: string;
  label?: string | null;
}

interface InlinePhoneEditorProps {
  phones: ManagementPhone[];
  onPhonesUpdated: () => void;
}

/**
 * Small inline editor for adding/removing management phones.
 * Use this inside dialogs that already have their own phone selection UI.
 */
export function InlinePhoneEditor({ phones, onPhonesUpdated }: InlinePhoneEditorProps) {
  const { toast } = useToast();
  const [showEditor, setShowEditor] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newPhoneLabel, setNewPhoneLabel] = useState('');

  const handleAdd = async () => {
    if (!newPhoneNumber.trim()) return;
    const { error } = await supabase.from('management_phones').insert({
      phone_number: newPhoneNumber.trim(),
      label: newPhoneLabel.trim() || null,
      is_active: true,
    });
    if (!error) {
      setNewPhoneNumber('');
      setNewPhoneLabel('');
      onPhonesUpdated();
      toast({ title: 'تمت الإضافة' });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('management_phones').delete().eq('id', id);
    if (!error) {
      onPhonesUpdated();
      toast({ title: 'تم الحذف' });
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowEditor(!showEditor)}
        className="gap-1 text-xs w-full justify-center"
      >
        <Settings2 className="h-3.5 w-3.5" />
        {showEditor ? 'إغلاق تعديل الأرقام' : 'تعديل أرقام الإدارة'}
      </Button>

      {showEditor && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3" dir="rtl">
          <div className="flex gap-2">
            <Input value={newPhoneNumber} onChange={(e) => setNewPhoneNumber(e.target.value)} placeholder="رقم الهاتف" className="flex-1 text-sm" dir="ltr" />
            <Input value={newPhoneLabel} onChange={(e) => setNewPhoneLabel(e.target.value)} placeholder="الاسم (اختياري)" className="w-32 text-sm" />
            <Button size="sm" onClick={handleAdd} disabled={!newPhoneNumber.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {phones.map(p => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1">
              <span>{p.phone_number} {p.label && <span className="text-muted-foreground">({p.label})</span>}</span>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-destructive h-7 w-7 p-0">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
