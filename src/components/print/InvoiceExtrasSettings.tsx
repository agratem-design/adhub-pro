/**
 * InvoiceExtrasSettings - إعدادات التحويلات البنكية وصورة الختم
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Save, Loader2, Stamp, Building } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchInvoiceExtras, saveInvoiceExtras, type BankAccount } from '@/utils/invoiceExtras';

export function InvoiceExtrasSettings() {
  const queryClient = useQueryClient();

  const { data: extras, isLoading } = useQuery({
    queryKey: ['invoice-extras'],
    queryFn: fetchInvoiceExtras,
  });

  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [stampUrl, setStampUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (extras) {
      setBanks(extras.bankAccounts.length > 0 ? extras.bankAccounts : []);
      setStampUrl(extras.stampImageUrl || '');
    }
  }, [extras]);

  const saveMutation = useMutation({
    mutationFn: () => saveInvoiceExtras({ bankAccounts: banks, stampImageUrl: stampUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-extras'] });
      toast.success('تم حفظ الإعدادات بنجاح');
    },
    onError: () => toast.error('فشل في حفظ الإعدادات'),
  });

  const addBank = () => setBanks([...banks, { bankName: '', accountNumber: '' }]);
  const removeBank = (i: number) => setBanks(banks.filter((_, idx) => idx !== i));
  const updateBank = (i: number, field: keyof BankAccount, value: string) => {
    const updated = [...banks];
    updated[i] = { ...updated[i], [field]: value };
    setBanks(updated);
  };

  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `stamps/company-stamp-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('billboards').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('billboards').getPublicUrl(path);
      setStampUrl(urlData.publicUrl);
      toast.success('تم رفع صورة الختم');
    } catch (err) {
      console.error(err);
      toast.error('فشل في رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* التحويلات البنكية */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            التحويلات البنكية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {banks.map((bank, i) => (
            <div key={i} className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">اسم المصرف</Label>
                <Input
                  value={bank.bankName}
                  onChange={(e) => updateBank(i, 'bankName', e.target.value)}
                  placeholder="مثال: مصرف الجمهورية"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">رقم الحساب / IBAN</Label>
                <Input
                  value={bank.accountNumber}
                  onChange={(e) => updateBank(i, 'accountNumber', e.target.value)}
                  placeholder="LY88002103103201000034211"
                  className="h-8 text-sm font-mono"
                  dir="ltr"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeBank(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addBank} className="w-full">
            <Plus className="h-3.5 w-3.5 ml-1" />
            إضافة حساب بنكي
          </Button>
        </CardContent>
      </Card>

      {/* صورة الختم */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Stamp className="h-4 w-4 text-primary" />
            صورة الختم
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stampUrl && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <img src={stampUrl} alt="ختم الشركة" className="w-20 h-20 object-contain rounded border" />
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setStampUrl('')}>
                <Trash2 className="h-3.5 w-3.5 ml-1" />
                إزالة
              </Button>
            </div>
          )}
          <div>
            <Label className="text-xs mb-1 block">رفع صورة الختم (PNG / JPG)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={handleStampUpload}
              disabled={uploading}
              className="h-9 text-sm"
            />
            {uploading && <p className="text-xs text-muted-foreground mt-1">جاري الرفع...</p>}
          </div>
        </CardContent>
      </Card>

      {/* زر الحفظ */}
      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />}
        حفظ إعدادات الفواتير
      </Button>
    </div>
  );
}
