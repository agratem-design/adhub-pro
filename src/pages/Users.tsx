/**
 * Users Management Page - Role-Based Permission System
 * 
 * IMPORTANT: Permissions are role-based only. User-level permissions are deprecated.
 * To change a user's permissions, change their role via the role change dialog.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users as UsersIcon, Shield, Key, UserPlus, Search, RefreshCw, 
  UserCheck, UserX, Edit, Info, Trash2, Link2, Link2Off, Mail, Phone, 
  Building2, Calendar, MoreVertical, ChevronDown, ChevronUp
} from 'lucide-react';
import { EditUserDialog } from '@/components/users/EditUserDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Role {
  id: string;
  name: string;
  display_name: string;
  permissions: string[];
}

interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  roleDisplayName?: string;
  created_at: string | null;
  allowed_clients?: string[] | null;
  price_tier?: string | null;
  approved?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  rolePermissions?: string[];
  linked_customer_id?: string | null;
  linked_customer_name?: string | null;
}

export default function Users() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const { profile, isAdmin } = useAuth();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 20;
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  
  // Dialog states
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordTargetId, setPasswordTargetId] = useState<string | null>(null);
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('user');
  const [linkedCustomerId, setLinkedCustomerId] = useState<string>('');
  const [customersList, setCustomersList] = useState<{id: string, name: string}[]>([]);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null);
  const [viewPermissionsOpen, setViewPermissionsOpen] = useState(false);
  const [viewingUserPermissions, setViewingUserPermissions] = useState<string[]>([]);
  const [viewingUserName, setViewingUserName] = useState<string>('');

  const loadAvailableRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, display_name, permissions')
        .order('name', { ascending: true });
      if (!error && data) {
        setAvailableRoles(data.map((r: any) => ({
          id: r.id, name: r.name, display_name: r.display_name, permissions: r.permissions || []
        })));
      }
    } catch (e) { console.error('Failed to load roles:', e); }
  };

  const loadPricingCategories = async () => {
    try {
      const { data, error } = await supabase.from('pricing_categories').select('name').order('name', { ascending: true });
      if (!error && Array.isArray(data)) {
        const categories = data.map((item: any) => item.name);
        const staticCategories = ['عادي', 'المدينة', 'مسوق', 'شركات'];
        setPricingCategories(Array.from(new Set([...staticCategories, ...categories])));
      } else {
        setPricingCategories(['عادي', 'المدينة', 'مسوق', 'شركات']);
      }
    } catch (e) {
      setPricingCategories(['عادي', 'المدينة', 'مسوق', 'شركات']);
    }
  };

  const fetchPage = async (pageIndex: number) => {
    setLoading(true);
    setError(null);
    const from = (pageIndex - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      let query = supabase
        .from('profiles')
        .select('id, name, email, username, phone, company, created_at, approved, status, price_tier, allowed_clients, linked_customer_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const resp = await query;
      if (resp.error) { setError(resp.error.message); setRows([]); setCount(0); setLoading(false); return; }

      // Get all linked customer IDs to fetch names
      const linkedIds = (resp.data || []).map(p => (p as any).linked_customer_id).filter(Boolean);
      let customerNames: Record<string, string> = {};
      if (linkedIds.length > 0) {
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', linkedIds);
        if (customers) {
          customers.forEach(c => { customerNames[c.id] = c.name; });
        }
      }

      const profilesWithDetails = await Promise.all(
        (resp.data || []).map(async (prof: any) => {
          const { data: roleData } = await supabase
            .from('user_roles').select('role').eq('user_id', prof.id).maybeSingle();
          const roleName = roleData?.role || 'user';
          const roleInfo = availableRoles.find(r => r.name === roleName);
          return {
            ...prof,
            role: roleName,
            roleDisplayName: roleInfo?.display_name || roleName,
            status: prof.status as 'pending' | 'approved' | 'rejected',
            rolePermissions: roleInfo?.permissions || [],
            linked_customer_id: prof.linked_customer_id,
            linked_customer_name: prof.linked_customer_id ? customerNames[prof.linked_customer_id] || null : null,
          };
        })
      );

      setRows(profilesWithDetails);
      setCount(resp.count || 0);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { loadAvailableRoles(); loadPricingCategories(); }, []);
  useEffect(() => { if (availableRoles.length > 0) fetchPage(page); }, [page, availableRoles]);
  useEffect(() => {
    const timer = setTimeout(() => { if (availableRoles.length > 0) { fetchPage(1); setPage(1); } }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleSaveUser = async (row: ProfileRow) => {
    setSavingId(row.id);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ price_tier: row.price_tier, allowed_clients: row.allowed_clients })
        .eq('id', row.id);
      if (profileError) throw profileError;
      toast.success('تم حفظ التعديلات بنجاح');
      fetchPage(page);
    } catch (error: any) {
      toast.error(`فشل حفظ التعديلات: ${error.message}`);
    } finally { setSavingId(null); }
  };

  const handleApproveUser = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase.from('profiles').update({
        status, approved: status === 'approved',
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        approved_by: status === 'approved' ? profile?.id : null,
      }).eq('id', userId);
      if (error) throw error;
      if (status === 'approved') {
        const { data: existingRole } = await supabase.from('user_roles').select('id').eq('user_id', userId).maybeSingle();
        if (!existingRole) await supabase.from('user_roles').insert({ user_id: userId, role: 'user' });
      }
      toast.success(status === 'approved' ? 'تم قبول المستخدم' : 'تم رفض المستخدم');
      fetchPage(page);
    } catch (error: any) { toast.error(`فشل تحديث الحالة: ${error.message}`); }
  };

  const handleOpenRoleModal = async (userId: string) => {
    setSelectedUserId(userId);
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
    setSelectedRole(data?.role || 'user');
    const { data: prof } = await supabase.from('profiles').select('linked_customer_id').eq('id', userId).maybeSingle();
    setLinkedCustomerId((prof as any)?.linked_customer_id || '');
    if (customersList.length === 0) {
      const { data: customers } = await supabase.from('customers').select('id, name').order('name');
      setCustomersList(customers || []);
    }
    setRoleModalOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUserId) return;
    try {
      const { data: existingRole } = await supabase.from('user_roles').select('id').eq('user_id', selectedUserId).maybeSingle();
      if (existingRole) {
        await supabase.from('user_roles').update({ role: selectedRole as any }).eq('user_id', selectedUserId);
      } else {
        await supabase.from('user_roles').insert({ user_id: selectedUserId, role: selectedRole as any });
      }
      await supabase.from('profiles')
        .update({ linked_customer_id: (linkedCustomerId && linkedCustomerId !== 'none') ? linkedCustomerId : null } as any)
        .eq('id', selectedUserId);
      toast.success('تم تحديث الدور بنجاح');
      setRoleModalOpen(false);
      fetchPage(page);
    } catch (error: any) { toast.error(`فشل تحديث الدور: ${error.message}`); }
  };

  const handleDeleteUser = async (user: ProfileRow) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف المستخدم "${user.name || user.email}"؟`);
    if (!confirmed) return;
    try {
      await supabase.from('user_roles').delete().eq('user_id', user.id);
      const { error } = await supabase.from('profiles').delete().eq('id', user.id);
      if (error) throw error;
      toast.success('تم حذف المستخدم بنجاح');
      fetchPage(page);
    } catch (e: any) { toast.error(`تعذر حذف المستخدم: ${e?.message || 'غير معروف'}`); }
  };

  const handleViewPermissions = (user: ProfileRow) => {
    setViewingUserName(user.name || 'المستخدم');
    setViewingUserPermissions(user.rolePermissions || []);
    setViewPermissionsOpen(true);
  };

  const handleChangePassword = async () => {
    if (!passwordTargetId) return;
    if (!passwordNew) { toast.error('ادخل كلمة المرور'); return; }
    if (passwordNew !== passwordConfirm) { toast.error('كلمات المرور غير متطابقة'); return; }
    if (passwordNew.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    try {
      const { data, error } = await supabase.functions.invoke('admin-set-password', {
        body: { userId: passwordTargetId, password: passwordNew }
      });
      if (error || (data && data.error)) {
        toast.error(error?.message || data?.error || 'فشل تحديث كلمة المرور');
      } else {
        toast.success('تم تحديث كلمة المرور');
        setPasswordModalOpen(false);
        setPasswordTargetId(null);
        setPasswordNew('');
        setPasswordConfirm('');
      }
    } catch (e: any) {
      toast.error(e?.message || 'فشل تحديث كلمة المرور');
    }
  };

  const getRoleBadgeStyle = (role: string | null) => {
    switch (role) {
      case 'admin': return 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800';
      case 'marketer': return 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800';
      case 'user': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-accent/50 text-accent-foreground border-border';
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'approved': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'rejected': return 'bg-red-500/10 text-red-600 border-red-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusText = (status: string | undefined) => {
    switch (status) {
      case 'pending': return 'قيد المراجعة';
      case 'approved': return 'نشط';
      case 'rejected': return 'مرفوض';
      default: return 'غير محدد';
    }
  };

  const selectedRoleInfo = availableRoles.find(r => r.name === selectedRole);
  const pendingCount = rows.filter(r => r.status === 'pending').length;
  const approvedCount = rows.filter(r => r.status === 'approved').length;
  const adminCount = rows.filter(r => r.role === 'admin').length;
  const linkedCount = rows.filter(r => r.linked_customer_id).length;

  const getInitials = (name: string | null) => {
    if (!name) return '؟';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2);
  };

  const getAvatarColor = (role: string | null) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'marketer': return 'bg-blue-500';
      default: return 'bg-primary';
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <UsersIcon className="h-6 w-6 text-primary" />
              </div>
              إدارة المستخدمين
            </h1>
            <p className="text-muted-foreground text-sm mt-1">إدارة الحسابات والأدوار والصلاحيات</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 w-full sm:w-56 h-9"
              />
            </div>
            <Button onClick={() => fetchPage(page)} variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'إجمالي', value: count, icon: UsersIcon, color: 'text-foreground' },
            { label: 'بانتظار الموافقة', value: pendingCount, icon: UserPlus, color: 'text-amber-600' },
            { label: 'نشطون', value: approvedCount, icon: UserCheck, color: 'text-emerald-600' },
            { label: 'مدراء', value: adminCount, icon: Shield, color: 'text-red-600' },
            { label: 'مربوطون بعميل', value: linkedCount, icon: Link2, color: 'text-blue-600' },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <stat.icon className={`h-5 w-5 ${stat.color} shrink-0`} />
                  <div className="min-w-0">
                    <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Users List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin ml-2" />
            جاري التحميل...
          </div>
        ) : error ? (
          <Card className="border-destructive/50">
            <CardContent className="py-8 text-center text-destructive">خطأ: {error}</CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <UsersIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا يوجد مستخدمون</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => {
              const isExpanded = expandedCard === r.id;
              return (
                <Card 
                  key={r.id} 
                  className={`transition-all duration-200 border-border/50 hover:border-border ${
                    r.status === 'pending' ? 'border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/10' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    {/* Main Row */}
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`h-11 w-11 rounded-full ${getAvatarColor(r.role)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                        {getInitials(r.name)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground truncate">{r.name || '—'}</span>
                          {r.username && (
                            <span className="text-xs text-muted-foreground">@{r.username}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          {r.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />
                              {r.email}
                            </span>
                          )}
                          {r.phone && (
                            <span className="flex items-center gap-1" dir="ltr">
                              <Phone className="h-3 w-3 shrink-0" />
                              {r.phone}
                            </span>
                          )}
                          {r.company && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 shrink-0" />
                              {r.company}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Badges & Status - Desktop */}
                      <div className="hidden md:flex items-center gap-2">
                        {/* Linked Customer */}
                        <Tooltip>
                          <TooltipTrigger>
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                              r.linked_customer_id 
                                ? 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800' 
                                : 'bg-muted/50 text-muted-foreground border-transparent'
                            }`}>
                              {r.linked_customer_id ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
                              {r.linked_customer_id 
                                ? (r.linked_customer_name || 'مربوط') 
                                : 'غير مربوط'
                              }
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {r.linked_customer_id 
                              ? `مربوط بحساب العميل: ${r.linked_customer_name || 'غير معروف'}` 
                              : 'غير مربوط بأي حساب عميل'
                            }
                          </TooltipContent>
                        </Tooltip>

                        {/* Role */}
                        <Badge variant="outline" className={`${getRoleBadgeStyle(r.role)} text-xs`}>
                          {r.roleDisplayName || r.role}
                        </Badge>

                        {/* Status */}
                        <Badge variant="outline" className={`${getStatusColor(r.status)} text-xs`}>
                          {getStatusText(r.status)}
                        </Badge>

                        {/* Permissions count */}
                        <Tooltip>
                          <TooltipTrigger>
                            <button 
                              onClick={() => handleViewPermissions(r)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
                            >
                              <Key className="h-3 w-3" />
                              {r.rolePermissions?.length || 0}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>عرض الصلاحيات</TooltipContent>
                        </Tooltip>

                        {/* Price tier */}
                        {r.status === 'approved' && (
                          <Select
                            value={r.price_tier || ''}
                            onValueChange={(val) => {
                              setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, price_tier: val } : x));
                            }}
                          >
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue placeholder="الفئة" />
                            </SelectTrigger>
                            <SelectContent>
                              {pricingCategories.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {r.status === 'pending' && (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => handleApproveUser(r.id, 'approved')}>
                              <UserCheck className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleApproveUser(r.id, 'rejected')}>
                              <UserX className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-8 text-xs hidden sm:flex"
                              onClick={() => handleSaveUser(r)} 
                              disabled={savingId === r.id}
                            >
                              حفظ
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleSaveUser(r)} className="sm:hidden">
                                  حفظ التعديلات
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setEditingUser(r); setEditUserOpen(true); }}>
                                  <Edit className="h-4 w-4 ml-2" />
                                  تعديل البيانات
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenRoleModal(r.id)}>
                                  <Shield className="h-4 w-4 ml-2" />
                                  تغيير الدور والربط
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewPermissions(r)}>
                                  <Info className="h-4 w-4 ml-2" />
                                  عرض الصلاحيات
                                </DropdownMenuItem>
                                {isAdmin && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => { 
                                      setPasswordTargetId(r.id); setPasswordNew(''); setPasswordConfirm(''); setPasswordModalOpen(true); 
                                    }}>
                                      <Key className="h-4 w-4 ml-2" />
                                      تغيير كلمة المرور
                                    </DropdownMenuItem>
                                    {r.id !== profile?.id && (
                                      <DropdownMenuItem onClick={() => handleDeleteUser(r)} className="text-destructive focus:text-destructive">
                                        <Trash2 className="h-4 w-4 ml-2" />
                                        حذف المستخدم
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                        {/* Expand on mobile */}
                        <Button 
                          size="icon" variant="ghost" className="h-8 w-8 md:hidden"
                          onClick={() => setExpandedCard(isExpanded ? null : r.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Mobile expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/50 md:hidden space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className={`${getRoleBadgeStyle(r.role)} text-xs`}>
                            {r.roleDisplayName || r.role}
                          </Badge>
                          <Badge variant="outline" className={`${getStatusColor(r.status)} text-xs`}>
                            {getStatusText(r.status)}
                          </Badge>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                            r.linked_customer_id 
                              ? 'bg-blue-500/10 text-blue-600 border-blue-200' 
                              : 'bg-muted/50 text-muted-foreground border-transparent'
                          }`}>
                            {r.linked_customer_id ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
                            {r.linked_customer_id ? (r.linked_customer_name || 'مربوط') : 'غير مربوط'}
                          </div>
                        </div>
                        {r.status === 'approved' && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">الفئة:</span>
                            <Select
                              value={r.price_tier || ''}
                              onValueChange={(val) => setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, price_tier: val } : x))}
                            >
                              <SelectTrigger className="w-28 h-7 text-xs">
                                <SelectValue placeholder="اختر" />
                              </SelectTrigger>
                              <SelectContent>
                                {pricingCategories.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {r.created_at ? new Date(r.created_at).toLocaleDateString('ar-LY') : '—'}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {count > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              السابق
            </Button>
            <span className="text-sm text-muted-foreground px-3">
              {page} من {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              التالي
            </Button>
          </div>
        )}

        {/* Password Modal */}
        <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Key className="h-5 w-5" />تغيير كلمة المرور</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>كلمة المرور الجديدة</Label>
                <Input type="password" placeholder="أدخل كلمة المرور الجديدة" value={passwordNew} onChange={(e) => setPasswordNew(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>تأكيد كلمة المرور</Label>
                <Input type="password" placeholder="أعد إدخال كلمة المرور" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>إلغاء</Button>
                <Button onClick={handleChangePassword}>حفظ</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Role Modal */}
        <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />تغيير دور المستخدم</DialogTitle>
              <DialogDescription>تغيير الدور سيحدّث الصلاحيات فوراً</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>الدور</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger><SelectValue placeholder="اختر الدور" /></SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role.name} value={role.name}>{role.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedRoleInfo && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border/50">
                  <Label className="text-xs font-medium">صلاحيات هذا الدور ({selectedRoleInfo.permissions.length}):</Label>
                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                    {selectedRoleInfo.permissions.length > 0 ? (
                      selectedRoleInfo.permissions.map((perm) => (
                        <Badge key={perm} variant="outline" className="text-xs">{perm}</Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">لا توجد صلاحيات</span>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>ربط بحساب عميل (اختياري)</Label>
                <Select value={linkedCustomerId} onValueChange={setLinkedCustomerId}>
                  <SelectTrigger><SelectValue placeholder="اختر عميل لربطه" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون ربط</SelectItem>
                    {customersList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">عند ربط المستخدم بعميل، سيرى فقط عقوده الخاصة</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRoleModalOpen(false)}>إلغاء</Button>
                <Button onClick={handleSaveRole}>حفظ</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Permissions Modal */}
        <Dialog open={viewPermissionsOpen} onOpenChange={setViewPermissionsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Info className="h-5 w-5" />صلاحيات {viewingUserName}</DialogTitle>
              <DialogDescription>لتغيير الصلاحيات، غيّر الدور</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-2">
                {viewingUserPermissions.length > 0 ? (
                  viewingUserPermissions.map((perm) => (
                    <Badge key={perm} variant="secondary" className="text-sm">{perm}</Badge>
                  ))
                ) : (
                  <p className="text-muted-foreground">لا توجد صلاحيات</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewPermissionsOpen(false)}>إغلاق</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <EditUserDialog open={editUserOpen} onOpenChange={setEditUserOpen} user={editingUser} onUserUpdated={() => fetchPage(page)} />
      </div>
    </TooltipProvider>
  );
}
