import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, Plus, Shield, UserCheck, Mail, Phone, Save, Check, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { smartArabicMatch } from '@/lib/arabicSearch';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { SystemDialog, useSystemDialog } from '@/components/ui/system-dialog';

interface ProfileUser {
  id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
  role: string | null;
  company?: string | null;
  created_at: string | null;
  updated_at: string | null;
  pricing_category?: string | null;
  allowed_customers?: string[] | null;
  allowed_clients?: string[] | null;
  price_tier?: string | null;
}

export const UsersTable = () => {
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedCustomersInput, setSelectedCustomersInput] = useState<string>('');
  const [allowedEdits, setAllowedEdits] = useState<Record<string, string[]>>({});
  const [customers, setCustomers] = useState<string[]>([]);
  const { showDialog, DialogComponent } = useSystemDialog();

  useEffect(() => {
    loadUsers();
    loadCustomers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // تحويل البيانات لتتوافق مع الهيكل المطلوب
      const mappedUsers: ProfileUser[] = (data || []).map((profile: any) => ({
        ...profile,
        pricing_category: profile.pricing_category || profile.price_tier,
        allowed_customers: profile.allowed_customers || profile.allowed_clients || [],
      }));
      setUsers(mappedUsers);
    } catch (error) {
      toast({
        title: "خطأ في تحميل المستخدمين",
        description: "تعذر تحميل بيانات المستخدمين",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('Contract')
        .select('"Customer Name"');

      if (!error && Array.isArray(data)) {
        const list = Array.from(new Set((data.map((r: any) => r['Customer Name']).filter(Boolean)))).sort(
          (a, b) => String(a).localeCompare(String(b), 'ar')
        ) as string[];
        setCustomers(list);
        return;
      }
    } catch (e: any) {
      console.error('loadCustomers error', e?.message || JSON.stringify(e));
      setCustomers([]);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = smartArabicMatch(
      [
        user.name,
        user.email,
        user.company,
        (user as any).phone,
        user.role,
        user.pricing_category,
        ...(user.allowed_customers || []),
      ],
      searchTerm
    );
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    const selectedNames = selectedCustomersInput
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const matchesSelectedCustomers =
      selectedNames.length === 0 ||
      (user.role === 'customer' && !!user.name && selectedNames.includes(user.name.toLowerCase())) ||
      (!!user.email && selectedNames.includes(user.email.toLowerCase()));

    return matchesSearch && matchesRole && matchesSelectedCustomers;
  });

  const getRoleBadge = (role: string) => {
    const variants = {
      'admin': 'destructive',
      'user': 'secondary',
      'customer': 'outline'
    };
    
    const labels = {
      'admin': 'مدير',
      'user': 'مستخدم',
      'customer': 'عميل'
    };

    return (
      <Badge variant={variants[role as keyof typeof variants] as any}>
        {labels[role as keyof typeof labels] || role}
      </Badge>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-LY');
  };

  const handlePricingCategoryChange = async (userId: string, category: string) => {
    try {
      const normalized = category === 'none' ? null : category;
      const { error } = await supabase
        .from('profiles')
        .update({ pricing_category: normalized, price_tier: normalized })
        .eq('id', userId)
        .select('*')
        .single();
      if (error) throw error;
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, pricing_category: normalized } : u)));
      toast({ title: 'تم الحفظ', description: 'تم تحديث فئة الأسعار' });
    } catch (e: any) {
      console.error('pricing_category update error:', e?.message || e);
      toast({ title: 'خطأ', description: `تعذر تحديث فئة الأسعار: ${e?.message || 'غير معروف'}`, variant: 'destructive' });
    }
  };

  const handleAllowedCustomersSave = async (userId: string) => {
    try {
      const arr = allowedEdits[userId] ?? (users.find(u => u.id === userId)?.allowed_customers ?? []);
      const { error } = await supabase
        .from('profiles')
        .update({ allowed_customers: arr, allowed_clients: arr })
        .eq('id', userId)
        .select('*')
        .single();
      if (error) throw error;
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, allowed_customers: arr } : u)));
      toast({ title: 'تم الحفظ', description: 'تم تحديث العملاء المسموح بهم' });
    } catch (e: any) {
      console.error('allowed_customers update error:', e?.message || e);
      toast({ title: 'خطأ', description: `تعذر تحديث العملاء المسموح بهم: ${e?.message || 'غير معروف'}`, variant: 'destructive' });
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select('*')
        .single();

      if (error) throw error;

      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));

      toast({
        title: "تم تحديث الدور",
        description: "تم تحديث دور المستخدم بنجاح"
      });
    } catch (error: any) {
      console.error('role update error:', error?.message || error);
      toast({
        title: "خطأ في التحديث",
        description: `تعذر تحديث دور المستخدم: ${error?.message || 'غير معروف'}`,
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = async (user: ProfileUser) => {
    const confirmed = await showDialog(
      'حذف المستخدم',
      `هل أنت متأكد من حذف المستخدم "${user.name || user.email}"؟\nسيتم حذف جميع بياناته نهائياً.`,
      'حذف',
      'إلغاء'
    );
    if (!confirmed) return;

    try {
      // حذف الأدوار أولاً
      await supabase.from('user_roles').delete().eq('user_id', user.id);
      // حذف الملف الشخصي
      const { error } = await supabase.from('profiles').delete().eq('id', user.id);
      if (error) throw error;

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast({ title: 'تم الحذف', description: 'تم حذف المستخدم بنجاح' });
    } catch (e: any) {
      console.error('delete user error:', e?.message || e);
      toast({ title: 'خطأ', description: `تعذر حذف المستخدم: ${e?.message || 'غير معروف'}`, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="mr-2">جاري تحميل المستخدمين...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* رأس القسم */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">إدارة المستخدمين</h2>
            <p className="text-muted-foreground">عرض وإدارة حسابات المستخدمين والصلاحيات</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            مستخدم جديد
          </Button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المستخدمين</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Shield className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المديرين</p>
                <p className="text-2xl font-bold text-red-600">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">العملاء</p>
                <p className="text-2xl font-bold text-green-600">
                  {users.filter(u => u.role === 'customer').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مستخدمين عاديين</p>
                <p className="text-2xl font-bold text-blue-600">
                  {users.filter(u => u.role === 'user').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البحث والفلاتر */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن ��لمستخدمين..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الدور" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأدوار</SelectItem>
                <SelectItem value="admin">مدير</SelectItem>
                <SelectItem value="user">مستخدم</SelectItem>
                <SelectItem value="customer">عميل</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="أدخل أسماء العملاء (افصل بينها بفواصل)"
              value={selectedCustomersInput}
              onChange={(e) => setSelectedCustomersInput(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* جدول المستخدمين */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">البريد الإلكتروني</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">الشركة</TableHead>
                <TableHead className="text-right">الدور</TableHead>
                <TableHead className="text-right">فئة الأسعار المسموحة</TableHead>
                <TableHead className="text-right">العملاء المسموح بهم</TableHead>
                <TableHead className="text-right">تاريخ التسجيل</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {user.phone || 'غير محدد'}
                    </div>
                  </TableCell>
                  <TableCell>{user.company || 'غير محدد'}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value)}
                    >
                      <SelectTrigger className="h-8 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">مدير</SelectItem>
                        <SelectItem value="user">مستخدم</SelectItem>
                        <SelectItem value="customer">عميل</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.pricing_category ?? 'none'}
                      onValueChange={(value) => handlePricingCategoryChange(user.id, value)}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue placeholder="اختر فئة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون</SelectItem>
                        <SelectItem value="شركات">شركات</SelectItem>
                        <SelectItem value="عادي">عادي</SelectItem>
                        <SelectItem value="مسوق">مسوق</SelectItem>
                        <SelectItem value="المدينة">المدينة</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {(allowedEdits[user.id] ?? user.allowed_customers ?? []).slice(0, 5).map((name) => (
                          <Badge key={name} variant="outline">{name}</Badge>
                        ))}
                        {((allowedEdits[user.id] ?? user.allowed_customers ?? []).length || 0) > 5 && (
                          <Badge variant="secondary">+{(allowedEdits[user.id] ?? user.allowed_customers ?? []).length - 5}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm">تحديد العملاء</Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0" align="start">
                            <Command>
                              <CommandInput placeholder="ابحث عن عميل..." />
                              <CommandList>
                                <CommandEmpty>لا يوجد نتائج</CommandEmpty>
                                <CommandGroup>
                                  {customers.map((c) => {
                                    const selected = (allowedEdits[user.id] ?? user.allowed_customers ?? []).includes(c);
                                    return (
                                      <CommandItem
                                        key={c}
                                        onSelect={() => {
                                          setAllowedEdits((prev) => {
                                            const current = prev[user.id] ?? (user.allowed_customers ?? []);
                                            const next = selected ? current.filter((n) => n !== c) : [...current, c];
                                            return { ...prev, [user.id]: next };
                                          });
                                        }}
                                      >
                                        <Check className={`mr-2 h-4 w-4 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                                        {c}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleAllowedCustomersSave(user.id)}>
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getRoleBadge(user.role)}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteUser(user)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <DialogComponent />
    </div>
  );
};
