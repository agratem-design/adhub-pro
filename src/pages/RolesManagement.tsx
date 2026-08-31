import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Plus, Edit, Trash2, Save, Users, Eye, Pencil, ChevronDown, ChevronUp, Check, X, Home, MapPin, Building2, Landmark, DollarSign, Receipt, Tag, ClipboardList, BarChart3, HardHat, Settings, LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  permissions: string[];
  users_count?: number;
  created_at: string;
}

interface PermissionItem {
  id: string;
  label: string;
  description: string;
  hasEdit: boolean;
}

interface PermissionGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: PermissionItem[];
}

// تجميع الصلاحيات حسب أقسام القائمة الجانبية
const permissionGroups: PermissionGroup[] = [
  {
    id: 'core',
    title: 'الصفحات الأساسية',
    icon: Home,
    items: [
      { id: 'dashboard', label: 'لوحة التحكم', description: 'الصفحة الرئيسية', hasEdit: false },
      { id: 'contracts', label: 'العقود', description: 'إدارة العقود', hasEdit: true },
      { id: 'offers', label: 'العروض', description: 'إدارة العروض', hasEdit: true },
      { id: 'booking_requests', label: 'طلبات الحجز', description: 'إدارة طلبات الحجز', hasEdit: true },
    ],
  },
  {
    id: 'billboards',
    title: 'اللوحات',
    icon: MapPin,
    items: [
      { id: 'billboards', label: 'جميع اللوحات', description: 'عرض وإدارة اللوحات', hasEdit: true },
      { id: 'billboard_photos', label: 'معرض الصور', description: 'عرض معرض صور اللوحات', hasEdit: false },
      { id: 'extended_billboards', label: 'اللوحات الممددة', description: 'عرض اللوحات الممددة', hasEdit: false },
      { id: 'billboard_cleanup', label: 'تنظيف المنتهية', description: 'تنظيف اللوحات المنتهية', hasEdit: true },
      { id: 'billboard_maintenance', label: 'الصيانة', description: 'إدارة صيانة اللوحات', hasEdit: true },
      { id: 'delayed_billboards', label: 'اللوحات المتأخرة', description: 'عرض اللوحات المتأخرة', hasEdit: false },
      { id: 'smart_distribution', label: 'التوزيع الذكي', description: 'عرض التوزيع الذكي', hasEdit: false },
    ],
  },
  {
    id: 'partnerships',
    title: 'الشراكات',
    icon: Building2,
    items: [
      { id: 'shared_billboards', label: 'اللوحات المشتركة', description: 'عرض اللوحات المشتركة', hasEdit: true },
      { id: 'shared_companies', label: 'الشركات المشاركة', description: 'إدارة الشركات المشاركة', hasEdit: true },
      { id: 'friend_billboards', label: 'لوحات الأصدقاء', description: 'عرض لوحات الأصدقاء', hasEdit: true },
      { id: 'friend_accounts', label: 'حسابات الأصدقاء', description: 'إدارة حسابات الأصدقاء', hasEdit: true },
    ],
  },
  {
    id: 'municipalities',
    title: 'البلديات',
    icon: Landmark,
    items: [
      { id: 'municipality_stickers', label: 'ملصقات البلديات', description: 'إدارة ملصقات البلديات', hasEdit: true },
      { id: 'municipality_stats', label: 'الإحصائيات', description: 'عرض إحصائيات البلديات', hasEdit: false },
      { id: 'municipality_rent_prices', label: 'أسعار الإيجار', description: 'إدارة أسعار الإيجار', hasEdit: true },
      { id: 'municipality_organizer', label: 'تنظيم اللوحات', description: 'تنظيم لوحات البلدية', hasEdit: true },
    ],
  },
  {
    id: 'customers',
    title: 'العملاء',
    icon: Users,
    items: [
      { id: 'customers', label: 'قائمة العملاء', description: 'إدارة بيانات العملاء', hasEdit: true },
      { id: 'customer_billing', label: 'حسابات العملاء', description: 'عرض حسابات العملاء', hasEdit: true },
      { id: 'customer_merge', label: 'دمج المكررين', description: 'دمج العملاء المكررين', hasEdit: true },
    ],
  },
  {
    id: 'finance',
    title: 'المالية',
    icon: DollarSign,
    items: [
      { id: 'overdue_payments', label: 'الدفعات المتأخرة', description: 'عرض الدفعات المتأخرة', hasEdit: false },
      { id: 'payments', label: 'الدفعات والإيصالات', description: 'إدارة الدفعات', hasEdit: true },
      { id: 'revenue', label: 'الإيرادات', description: 'عرض تقارير الإيرادات', hasEdit: false },
      { id: 'expenses', label: 'المصروفات', description: 'إدارة المصروفات', hasEdit: true },
      { id: 'salaries', label: 'الرواتب', description: 'إدارة رواتب الموظفين', hasEdit: true },
      { id: 'custody', label: 'العهد المالية', description: 'إدارة العهد المالية', hasEdit: true },
    ],
  },
  {
    id: 'accounts',
    title: 'الحسابات',
    icon: Receipt,
    items: [
      { id: 'printed_invoices_page', label: 'فواتير الطباعة', description: 'عرض فواتير الطباعة', hasEdit: true },
      { id: 'printer_accounts', label: 'حسابات المطابع', description: 'إدارة حسابات المطابع', hasEdit: true },
      { id: 'installation_team_accounts', label: 'حسابات فرق التركيب', description: 'إدارة حسابات الفرق', hasEdit: true },
    ],
  },
  {
    id: 'pricing',
    title: 'التسعير',
    icon: Tag,
    items: [
      { id: 'pricing', label: 'أسعار الإيجار', description: 'إدارة أسعار الإيجار', hasEdit: true },
      { id: 'pricing_factors', label: 'نظام المعاملات', description: 'إدارة معاملات التسعير', hasEdit: true },
    ],
  },
  {
    id: 'tasks',
    title: 'المهام',
    icon: ClipboardList,
    items: [
      { id: 'tasks', label: 'المهمات اليومية', description: 'إدارة المهام اليومية', hasEdit: true },
      { id: 'installation_tasks', label: 'التركيب', description: 'الوصول إلى مهام التركيب الشاملة', hasEdit: true },
      { id: 'removal_tasks', label: 'الإزالة', description: 'إدارة مهام الإزالة', hasEdit: true },
      { id: 'print_tasks', label: 'الطباعة', description: 'الوصول إلى مهام التركيب الشاملة', hasEdit: true },
      { id: 'cutout_tasks', label: 'المجسمات', description: 'الوصول إلى مهام التركيب الشاملة', hasEdit: true },
      { id: 'composite_tasks', label: 'مهام التركيب الشاملة', description: 'إدارة العقود وعمليات الطباعة والقص والتركيب من صفحة واحدة', hasEdit: true },
      { id: 'image_gallery', label: 'معرض الصور', description: 'عرض وإدارة معرض الصور', hasEdit: true },
    ],
  },
  {
    id: 'reports',
    title: 'التقارير',
    icon: BarChart3,
    items: [
      { id: 'activity_log', label: 'سجل الحركات', description: 'عرض سجل الحركات والنشاطات', hasEdit: false },
      { id: 'reports', label: 'التقارير والإحصائيات', description: 'عرض التقارير', hasEdit: false },
      { id: 'kpi_dashboard', label: 'مؤشرات الأداء', description: 'لوحة مؤشرات الأداء', hasEdit: false },
      { id: 'profitability_reports', label: 'تقارير الربحية', description: 'عرض تقارير الربحية', hasEdit: false },
    ],
  },
  {
    id: 'team',
    title: 'الفريق',
    icon: HardHat,
    items: [
      { id: 'users', label: 'المستخدمين', description: 'إدارة المستخدمين', hasEdit: true },
      { id: 'roles', label: 'الأدوار والصلاحيات', description: 'إدارة الأدوار والصلاحيات', hasEdit: true },
      { id: 'installation_teams', label: 'فرق التركيب', description: 'إدارة فرق التركيب', hasEdit: true },
      { id: 'printers', label: 'المطابع', description: 'إدارة المطابع', hasEdit: true },
    ],
  },
  {
    id: 'settings',
    title: 'الإعدادات',
    icon: Settings,
    items: [
      { id: 'settings', label: 'الإعدادات العامة', description: 'الإعدادات العامة للنظام', hasEdit: true },
      { id: 'system_settings', label: 'إعدادات النظام', description: 'إعدادات النظام المتقدمة', hasEdit: true },
      { id: 'messaging_settings', label: 'المراسلات', description: 'إعدادات الرسائل', hasEdit: true },
      { id: 'currency_settings', label: 'العملة', description: 'إعدادات العملة', hasEdit: true },
      { id: 'print_design', label: 'تصميم الطباعة', description: 'تصميم قوالب الطباعة', hasEdit: true },
      { id: 'billboard_print_settings', label: 'إعدادات طباعة اللوحات', description: 'إعدادات طباعة اللوحات', hasEdit: true },
      { id: 'quick_print_settings', label: 'إعدادات الطباعة السريعة', description: 'إعدادات الطباعة السريعة', hasEdit: true },
      { id: 'pdf_templates', label: 'قوالب PDF', description: 'إدارة قوالب PDF', hasEdit: true },
      { id: 'contract_terms', label: 'بنود العقد', description: 'إدارة بنود العقد', hasEdit: true },
      { id: 'database_backup', label: 'النسخ الاحتياطي', description: 'النسخ الاحتياطي', hasEdit: true },
      { id: 'database_setup', label: 'إعداد قاعدة البيانات', description: 'إعداد وتهيئة قاعدة البيانات', hasEdit: true },
    ],
  },
];

// Flat list for lookups
const allPermissions = permissionGroups.flatMap(g => g.items);
const editablePermissions = allPermissions.filter(p => p.hasEdit);

export default function RolesManagement() {
  const { canEdit, isAdmin } = useAuth();
  const canEditRoles = canEdit('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    permissions: [] as string[],
  });

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rolesWithCount: Role[] = await Promise.all(
        (data || []).map(async (role: any) => {
          const { count } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role', role.name as any);
          
          return {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            permissions: role.permissions || [],
            users_count: count || 0,
            created_at: role.created_at,
          };
        })
      );

      setRoles(rolesWithCount);
    } catch (error: any) {
      console.error('Error fetching roles:', error);
      toast.error('فشل في تحميل الأدوار');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleOpenCreate = () => {
    setEditingRole(null);
    setFormData({ name: '', display_name: '', description: '', permissions: [] });
    setDialogOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      permissions: role.permissions || [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.display_name) {
      toast.error('يرجى إدخال اسم الدور والاسم المعروض');
      return;
    }

    try {
      if (editingRole) {
        const { error } = await supabase
          .from('roles')
          .update({
            display_name: formData.display_name,
            description: formData.description || null,
            permissions: formData.permissions,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', editingRole.id);

        if (error) throw error;
        toast.success('تم تحديث الدور بنجاح');
      } else {
        const { error } = await supabase
          .from('roles')
          .insert({
            name: formData.name.toLowerCase().replace(/\s+/g, '_'),
            display_name: formData.display_name,
            description: formData.description || null,
            permissions: formData.permissions,
          } as any);

        if (error) throw error;
        toast.success('تم إنشاء الدور بنجاح');
      }

      setDialogOpen(false);
      fetchRoles();
    } catch (error: any) {
      toast.error(`فشل في حفظ الدور: ${error.message}`);
    }
  };

  const handleDelete = async (role: Role) => {
    if (role.name === 'admin' || role.name === 'user') {
      toast.error('لا يمكن حذف الأدوار الأساسية');
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف دور "${role.display_name}"؟`)) return;

    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', role.id as any);

      if (error) throw error;
      toast.success('تم حذف الدور بنجاح');
      fetchRoles();
    } catch (error: any) {
      toast.error(`فشل في حذف الدور: ${error.message}`);
    }
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

  // Toggle all view permissions for a group
  const toggleGroupView = (group: PermissionGroup, enable: boolean) => {
    setFormData(prev => {
      let perms = [...prev.permissions];
      group.items.forEach(item => {
        if (enable) {
          if (!perms.includes(item.id)) perms.push(item.id);
        } else {
          perms = perms.filter(p => p !== item.id && p !== `${item.id}_edit`);
        }
      });
      return { ...prev, permissions: perms };
    });
  };

  // Toggle all edit permissions for a group
  const toggleGroupEdit = (group: PermissionGroup, enable: boolean) => {
    setFormData(prev => {
      let perms = [...prev.permissions];
      group.items.filter(i => i.hasEdit).forEach(item => {
        const editId = `${item.id}_edit`;
        if (enable) {
          if (!perms.includes(item.id)) perms.push(item.id);
          if (!perms.includes(editId)) perms.push(editId);
        } else {
          perms = perms.filter(p => p !== editId);
        }
      });
      return { ...prev, permissions: perms };
    });
  };

  const selectAllPermissions = () => {
    const allPerms = [
      ...allPermissions.map(p => p.id),
      ...editablePermissions.map(p => `${p.id}_edit`)
    ];
    setFormData(prev => ({ ...prev, permissions: allPerms }));
  };

  const clearAllPermissions = () => {
    setFormData(prev => ({ ...prev, permissions: [] }));
  };

  // Stats for a group
  const getGroupStats = (group: PermissionGroup) => {
    const viewCount = group.items.filter(i => formData.permissions.includes(i.id)).length;
    const editItems = group.items.filter(i => i.hasEdit);
    const editCount = editItems.filter(i => formData.permissions.includes(`${i.id}_edit`)).length;
    return { viewCount, editCount, totalView: group.items.length, totalEdit: editItems.length };
  };

  const totalViewSelected = formData.permissions.filter(p => !p.endsWith('_edit')).length;
  const totalEditSelected = formData.permissions.filter(p => p.endsWith('_edit')).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8" />
            إدارة الأدوار والصلاحيات
          </h1>
          <p className="text-muted-foreground">تعريف الأدوار وتحديد صلاحياتها مجمّعة حسب الأقسام</p>
        </div>
        {canEditRoles && (
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة دور جديد
        </Button>
        )}
      </div>

      {/* Roles Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : (
          roles.map((role) => {
            const viewPerms = role.permissions.filter(p => !p.endsWith('_edit'));
            const editPerms = role.permissions.filter(p => p.endsWith('_edit'));
            return (
              <Card key={role.id} className="relative overflow-hidden">
                <div className={`absolute top-0 right-0 left-0 h-1 ${role.name === 'admin' ? 'bg-destructive' : 'bg-primary'}`} />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={role.name === 'admin' ? 'destructive' : 'secondary'} className="text-sm">
                        {role.display_name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">({role.name})</span>
                    </div>
                    {canEditRoles && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(role)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {role.name !== 'admin' && role.name !== 'user' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(role)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                  )}
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{role.users_count || 0} مستخدم</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-600">
                      <Eye className="h-4 w-4" />
                      <span>{viewPerms.length} عرض</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-green-600">
                      <Pencil className="h-4 w-4" />
                      <span>{editPerms.length} تعديل</span>
                    </div>
                  </div>
                  
                  {/* Mini group summary */}
                  <div className="flex flex-wrap gap-1">
                    {permissionGroups.map(group => {
                      const groupViewCount = group.items.filter(i => role.permissions.includes(i.id)).length;
                      if (groupViewCount === 0) return null;
                      const allInGroup = groupViewCount === group.items.length;
                      return (
                        <Badge 
                          key={group.id} 
                          variant="outline" 
                          className={`text-xs ${allInGroup ? 'bg-primary/10 border-primary text-primary' : ''}`}
                        >
                          {group.icon} {group.title} ({groupViewCount}/{group.items.length})
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingRole ? `تعديل دور: ${editingRole.display_name}` : 'إضافة دور جديد'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم الدور (بالإنجليزية)</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: editor"
                  disabled={!!editingRole}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">الاسم المعروض</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="مثال: محرر"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">الوصف</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="وصف اختياري..."
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-medium">الصلاحيات:</span>
                <Badge variant="secondary">{totalViewSelected} عرض</Badge>
                <Badge variant="secondary" className="bg-green-100 text-green-700">{totalEditSelected} تعديل</Badge>
                <span className="text-muted-foreground">من أصل {allPermissions.length} صلاحية</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllPermissions}>
                  <Check className="h-3 w-3 ml-1" />
                  تحديد الكل
                </Button>
                <Button variant="outline" size="sm" onClick={clearAllPermissions}>
                  <X className="h-3 w-3 ml-1" />
                  إلغاء الكل
                </Button>
              </div>
            </div>

            {/* Permission Groups */}
            <Accordion type="multiple" defaultValue={permissionGroups.map(g => g.id)} className="space-y-2">
              {permissionGroups.map((group) => {
                const stats = getGroupStats(group);
                const allViewSelected = stats.viewCount === stats.totalView;
                const allEditSelected = stats.totalEdit > 0 && stats.editCount === stats.totalEdit;
                
                return (
                  <AccordionItem key={group.id} value={group.id} className="border rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                      <div className="flex items-center gap-3 flex-1">
                        <group.icon className="h-5 w-5 text-primary shrink-0" />
                        <span className="font-semibold">{group.title}</span>
                        <div className="flex items-center gap-2 mr-auto">
                          <Badge variant={allViewSelected ? 'default' : 'outline'} className="text-xs">
                            <Eye className="h-3 w-3 ml-1" />
                            {stats.viewCount}/{stats.totalView}
                          </Badge>
                          {stats.totalEdit > 0 && (
                            <Badge 
                              variant={allEditSelected ? 'default' : 'outline'} 
                              className={`text-xs ${allEditSelected ? 'bg-green-600' : ''}`}
                            >
                              <Pencil className="h-3 w-3 ml-1" />
                              {stats.editCount}/{stats.totalEdit}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {/* Group quick actions */}
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => toggleGroupView(group, true)}
                        >
                          <Eye className="h-3 w-3 ml-1" />
                          تحديد كل العرض
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => toggleGroupView(group, false)}
                        >
                          إلغاء كل العرض
                        </Button>
                        {group.items.some(i => i.hasEdit) && (
                          <>
                            <span className="text-muted-foreground">|</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 text-green-600"
                              onClick={() => toggleGroupEdit(group, true)}
                            >
                              <Pencil className="h-3 w-3 ml-1" />
                              تحديد كل التعديل
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => toggleGroupEdit(group, false)}
                            >
                              إلغاء كل التعديل
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Permission items table */}
                      <div className="space-y-1">
                        {/* Header */}
                        <div className="grid grid-cols-[1fr,80px,80px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                          <span>الصلاحية</span>
                          <span className="text-center">عرض</span>
                          <span className="text-center">تعديل</span>
                        </div>
                        
                        {group.items.map((perm) => {
                          const hasView = formData.permissions.includes(perm.id);
                          const hasEditPerm = formData.permissions.includes(`${perm.id}_edit`);
                          
                          return (
                            <div
                              key={perm.id}
                              className={`grid grid-cols-[1fr,80px,80px] gap-2 items-center px-3 py-2.5 rounded-lg border transition-colors ${
                                hasView ? 'bg-primary/5 border-primary/20' : 'border-transparent hover:bg-muted/50'
                              }`}
                            >
                              <div>
                                <p className="text-sm font-medium">{perm.label}</p>
                                <p className="text-xs text-muted-foreground">{perm.description}</p>
                              </div>
                              
                              {/* View checkbox */}
                              <div className="flex justify-center">
                                <div
                                  className={`flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer transition-all ${
                                    hasView 
                                      ? 'bg-primary text-primary-foreground shadow-sm' 
                                      : 'bg-muted hover:bg-muted/80'
                                  }`}
                                  onClick={() => {
                                    if (hasView && hasEditPerm) {
                                      // Remove both
                                      setFormData(prev => ({
                                        ...prev,
                                        permissions: prev.permissions.filter(p => p !== perm.id && p !== `${perm.id}_edit`),
                                      }));
                                    } else {
                                      togglePermission(perm.id);
                                    }
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </div>
                              </div>

                              {/* Edit checkbox */}
                              <div className="flex justify-center">
                                {perm.hasEdit ? (
                                  <div
                                    className={`flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer transition-all ${
                                      hasEditPerm 
                                        ? 'bg-green-600 text-white shadow-sm' 
                                        : hasView
                                          ? 'bg-muted hover:bg-green-100'
                                          : 'bg-muted/50 opacity-40 cursor-not-allowed'
                                    }`}
                                    onClick={() => {
                                      if (!hasView) return;
                                      togglePermission(`${perm.id}_edit`);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 ml-2" />
              حفظ الدور
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
