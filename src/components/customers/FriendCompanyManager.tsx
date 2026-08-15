import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FriendCompany {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  logo_url: string | null;
  brand_color: string | null;
  company_type: string | null;
}

interface FriendCompanyManagerProps {
  customerId: string;
  customerName: string;
  linkedFriendCompanyId?: string | null;
  onUpdate: () => void;
}

export function FriendCompanyManager({ 
  customerId, 
  customerName,
  linkedFriendCompanyId, 
  onUpdate 
}: FriendCompanyManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [friendCompanies, setFriendCompanies] = useState<FriendCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(linkedFriendCompanyId || '');
  
  // New company form
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyContact, setNewCompanyContact] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyEmail, setNewCompanyEmail] = useState('');
  const [newCompanyNotes, setNewCompanyNotes] = useState('');
  const [newCompanyType, setNewCompanyType] = useState<string>('friend');

  const loadFriendCompanies = async () => {
    const { data, error } = await supabase
      .from('friend_companies')
      .select('*')
      .order('name');
    
    if (!error && data) {
      setFriendCompanies(data);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    loadFriendCompanies();
    setSelectedCompanyId(linkedFriendCompanyId || '');
  };

  const handleAddNewCompany = async () => {
    if (!newCompanyName.trim()) {
      toast.error('الرجاء إدخال اسم الشركة');
      return;
    }

    const { data, error } = await supabase
      .from('friend_companies')
      .insert([{
        name: newCompanyName,
        contact_person: newCompanyContact || null,
        phone: newCompanyPhone || null,
        email: newCompanyEmail || null,
        notes: newCompanyNotes || null,
        company_type: newCompanyType || 'friend',
      }])
      .select()
      .single();

    if (error) {
      toast.error('فشل إضافة الشركة الصديقة');
      console.error(error);
      return;
    }

    toast.success('تمت إضافة الشركة الصديقة بنجاح');
    setIsAddingNew(false);
    setNewCompanyName('');
    setNewCompanyContact('');
    setNewCompanyPhone('');
    setNewCompanyEmail('');
    setNewCompanyNotes('');
    setNewCompanyType('friend');
    loadFriendCompanies();
    setSelectedCompanyId(data.id);
  };

  const handleSave = async () => {
    const { error } = await supabase
      .from('customers')
      .update({ 
        linked_friend_company_id: selectedCompanyId || null,
        is_supplier: selectedCompanyId ? true : undefined,
        supplier_type: selectedCompanyId ? 'billboard_rental' : undefined
      })
      .eq('id', customerId);

    if (error) {
      toast.error('فشل ربط الشركة الصديقة');
      console.error(error);
      return;
    }

    toast.success('تم ربط الشركة الصديقة بنجاح');
    setIsOpen(false);
    onUpdate();
  };

  const handleUnlink = async () => {
    const { error } = await supabase
      .from('customers')
      .update({ linked_friend_company_id: null })
      .eq('id', customerId);

    if (error) {
      toast.error('فشل إلغاء ربط الشركة الصديقة');
      console.error(error);
      return;
    }

    toast.success('تم إلغاء ربط الشركة الصديقة');
    setIsOpen(false);
    onUpdate();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="gap-2"
      >
        <Building2 className="h-4 w-4" />
        {linkedFriendCompanyId ? 'تعديل الشركة الصديقة' : 'ربط شركة صديقة'}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>إدارة الشركة الصديقة - {customerName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {!isAddingNew ? (
              <>
                <div className="space-y-2">
                  <Label>اختر شركة صديقة موجودة</Label>
                  <Select value={selectedCompanyId || 'none'} onValueChange={(value) => setSelectedCompanyId(value === 'none' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر شركة صديقة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون شركة صديقة</SelectItem>
                      {friendCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                          {company.company_type === 'own' ? ' (خاصة)' : ''}
                          {company.phone && ` - ${company.phone}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsAddingNew(true)}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة شركة صديقة جديدة
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">إضافة شركة صديقة جديدة</h3>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setIsAddingNew(false)}
                    >
                      إلغاء
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>اسم الشركة *</Label>
                    <Input
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="اسم الشركة"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>نوع الشركة</Label>
                    <Select value={newCompanyType} onValueChange={setNewCompanyType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="own">خاصة بنا</SelectItem>
                        <SelectItem value="friend">شركة صديقة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>الشخص المسؤول</Label>
                    <Input
                      value={newCompanyContact}
                      onChange={(e) => setNewCompanyContact(e.target.value)}
                      placeholder="اسم الشخص المسؤول"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input
                      value={newCompanyPhone}
                      onChange={(e) => setNewCompanyPhone(e.target.value)}
                      placeholder="رقم الهاتف"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      type="email"
                      value={newCompanyEmail}
                      onChange={(e) => setNewCompanyEmail(e.target.value)}
                      placeholder="البريد الإلكتروني"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>ملاحظات</Label>
                    <Textarea
                      value={newCompanyNotes}
                      onChange={(e) => setNewCompanyNotes(e.target.value)}
                      placeholder="ملاحظات إضافية"
                      rows={3}
                    />
                  </div>

                  <Button onClick={handleAddNewCompany} className="w-full">
                    إضافة الشركة
                  </Button>
                </div>
              </>
            )}

            {linkedFriendCompanyId && !isAddingNew && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">الشركة الحالية:</span>
                  <Badge variant="secondary">
                    {friendCompanies.find(c => c.id === linkedFriendCompanyId)?.name || 'غير معروف'}
                  </Badge>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleUnlink}
                >
                  إلغاء الربط
                </Button>
              </div>
            )}
          </div>

          {!isAddingNew && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleSave}>
                حفظ
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
