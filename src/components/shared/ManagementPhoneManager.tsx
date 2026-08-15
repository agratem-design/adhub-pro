// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Phone, Users, Plus, Trash2, Settings2, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ManagementPhone {
  id: string;
  phone_number: string;
  label: string | null;
  is_active: boolean;
}

interface ManagementPhoneManagerProps {
  selectedPhones: string[];
  onSelectedPhonesChange: (phones: string[]) => void;
  phones: ManagementPhone[];
  onPhonesChange: (phones: ManagementPhone[]) => void;
  /** Optional: show WhatsApp quick-send button per phone */
  onWhatsAppClick?: (phone: ManagementPhone) => void;
  title?: string;
}

export function ManagementPhoneManager({
  selectedPhones,
  onSelectedPhonesChange,
  phones,
  onPhonesChange,
  onWhatsAppClick,
  title = 'أرقام الإدارة',
}: ManagementPhoneManagerProps) {
  const { toast } = useToast();
  const [showManager, setShowManager] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newPhoneLabel, setNewPhoneLabel] = useState('');

  const togglePhone = (id: string) => {
    onSelectedPhonesChange(
      selectedPhones.includes(id)
        ? selectedPhones.filter(p => p !== id)
        : [...selectedPhones, id]
    );
  };

  const handleAddPhone = async () => {
    if (!newPhoneNumber.trim()) return;
    const { error } = await supabase.from('management_phones').insert({
      phone_number: newPhoneNumber.trim(),
      label: newPhoneLabel.trim() || null,
      is_active: true,
    });
    if (!error) {
      setNewPhoneNumber('');
      setNewPhoneLabel('');
      await refreshPhones();
      toast({ title: 'تمت الإضافة' });
    }
  };

  const handleDeletePhone = async (id: string) => {
    const { error } = await supabase.from('management_phones').delete().eq('id', id);
    if (!error) {
      await refreshPhones();
      toast({ title: 'تم الحذف' });
    }
  };

  const refreshPhones = async () => {
    const { data } = await supabase
      .from('management_phones')
      .select('*')
      .eq('is_active', true)
      .order('created_at');
    if (data) {
      onPhonesChange(data);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" />
          {title}
        </Label>
        <Button variant="ghost" size="sm" onClick={() => setShowManager(!showManager)} className="gap-1 text-xs">
          <Settings2 className="h-3.5 w-3.5" />
          {showManager ? 'إغلاق' : 'تعديل'}
        </Button>
      </div>

      {showManager && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
          <div className="flex gap-2">
            <Input value={newPhoneNumber} onChange={(e) => setNewPhoneNumber(e.target.value)} placeholder="رقم الهاتف" className="flex-1 text-sm" dir="ltr" />
            <Input value={newPhoneLabel} onChange={(e) => setNewPhoneLabel(e.target.value)} placeholder="الاسم (اختياري)" className="w-32 text-sm" />
            <Button size="sm" onClick={handleAddPhone} disabled={!newPhoneNumber.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {phones.map(p => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1">
              <span>{p.phone_number} {p.label && <span className="text-muted-foreground">({p.label})</span>}</span>
              <Button variant="ghost" size="sm" onClick={() => handleDeletePhone(p.id)} className="text-destructive h-7 w-7 p-0">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {phones.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد أرقام. أضف أرقام من زر "تعديل" أعلاه.</p>
      ) : (
        <div className="space-y-1 rounded-lg border border-border p-3">
          {phones.map(p => (
            <div key={p.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-3">
                <Checkbox id={`mgmt-phone-${p.id}`} checked={selectedPhones.includes(p.id)} onCheckedChange={() => togglePhone(p.id)} />
                <Label htmlFor={`mgmt-phone-${p.id}`} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {p.phone_number}
                  {p.label && <Badge variant="outline" className="text-xs">{p.label}</Badge>}
                </Label>
              </div>
              {onWhatsAppClick && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => onWhatsAppClick(p)}
                  title="إرسال عبر واتساب"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Helper to fetch management phones */
export async function fetchManagementPhones(): Promise<ManagementPhone[]> {
  const { data } = await supabase
    .from('management_phones')
    .select('*')
    .eq('is_active', true)
    .order('created_at');
  return data || [];
}
