import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Mail, Lock, User, Phone, Building2 } from 'lucide-react';

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdded: () => void;
}

export function AddUserDialog({ open, onOpenChange, onUserAdded }: AddUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    username: '',
    phone: '',
    company: '',
    role: 'user',
  });

  // ✅ SECURITY: Check if current user is admin to determine if they can assign admin role
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsCurrentUserAdmin(false);
          return;
        }

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        setIsCurrentUserAdmin(!!roleData);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsCurrentUserAdmin(false);
      }
    };

    if (open) {
      checkAdminStatus();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.name) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('كلمات المرور غير متطابقة');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }

    if (!/[A-Z]/.test(formData.password)) {
      toast.error('كلمة المرور يجب أن تحتوي على حرف كبير');
      return;
    }

    if (!/[a-z]/.test(formData.password)) {
      toast.error('كلمة المرور يجب أن تحتوي على حرف صغير');
      return;
    }

    if (!/[0-9]/.test(formData.password)) {
      toast.error('كلمة المرور يجب أن تحتوي على رقم');
      return;
    }

    setLoading(true);
    try {
      // إنشاء المستخدم باستخدام signUp (الطريقة الصحيحة من الواجهة الأمامية)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            username: formData.username,
          }
        }
      });

      if (signUpError) throw signUpError;
      
      if (signUpData.user) {
        // تحديث الملف الشخصي
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: signUpData.user.id,
            name: formData.name,
            email: formData.email,
            username: formData.username,
            phone: formData.phone,
            company: formData.company,
            status: 'approved',
            approved: true,
            role: formData.role,
          });

        if (profileError) console.error('Profile update error:', profileError);

        // ✅ SECURITY: Only add admin role if current user is admin
        if (formData.role === 'admin' && isCurrentUserAdmin) {
          const { error: roleError } = await supabase.from('user_roles').insert({
            user_id: signUpData.user.id,
            role: 'admin'
          });
          
          if (roleError) {
            console.error('Role assignment error:', roleError);
            toast.error('تم إنشاء المستخدم لكن فشل تعيين صلاحية المدير');
          }
        }
      }

      toast.success('تم إضافة المستخدم بنجاح');
      onUserAdded();
      onOpenChange(false);
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        username: '',
        phone: '',
        company: '',
        role: 'user',
      });
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.error(error.message || 'فشل في إضافة المستخدم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            إضافة مستخدم جديد
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">الاسم *</Label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="pr-10"
                placeholder="الاسم الكامل"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">اسم المستخدم</Label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                className="pr-10"
                placeholder="اسم المستخدم (اختياري)"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني *</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="pr-10"
                placeholder="example@email.com"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">الهاتف</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="pr-10"
                  placeholder="0912345678"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">الشركة</Label>
              <div className="relative">
                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  className="pr-10"
                  placeholder="اسم الشركة"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور *</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="pr-10"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">تأكيد كلمة المرور *</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="pr-10"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">الدور</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الدور" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">مستخدم عادي</SelectItem>
 {/* SECURITY: Only show admin option if current user is admin */}
                {isCurrentUserAdmin && (
                  <SelectItem value="admin">مدير</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'جاري الإضافة...' : 'إضافة المستخدم'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
