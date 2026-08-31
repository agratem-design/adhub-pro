import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  MapPin, 
  Ruler, 
  Building2, 
  Users, 
  UserPlus, 
  UserMinus, 
  DollarSign, 
  Phone, 
  Handshake, 
  Crown, 
  Shield, 
  Award, 
  ArrowUp, 
  ArrowDown, 
  LayoutGrid, 
  Table as TableIcon, 
  Search, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface InstallationTeam {
  id: string;
  team_name: string;
  sizes: string[];
  cities: string[];
  phone_number?: string;
  priority?: number;
  friend_company_id?: string;
  friend_company_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

interface FriendCompany {
  id: string;
  name: string;
}

interface TeamEmployee {
  id: string;
  name: string;
  position: string;
  phone: string;
  status: string;
}

export default function InstallationTeams() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('installation_teams');
  const navigate = useNavigate();
  const [teams, setTeams] = useState<InstallationTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [friendCompanies, setFriendCompanies] = useState<FriendCompany[]>([]);

  // Search & View Mode State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'general' | 'partner'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [current, setCurrent] = useState<Partial<InstallationTeam>>({});
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);

  // Team members state
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamEmployee[]>>({});
  const [allEmployees, setAllEmployees] = useState<TeamEmployee[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTeamId, setAssignTeamId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Team accounts summary
  const [teamAccountsSummary, setTeamAccountsSummary] = useState<Record<string, { pending: number; paid: number; total: number }>>({});

  const loadTeams = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('installation_teams')
        .select('*')
        .order('priority', { ascending: false });

      if (error) throw error;
      setTeams((data as any) || []);
      
      // Load sizes
      if (availableSizes.length === 0) {
        try {
          const { data: sdata, error: serror } = await (supabase as any)
            .from('sizes')
            .select('name')
            .order('sort_order', { ascending: true });

          if (!serror && Array.isArray(sdata)) {
            setAvailableSizes(sdata.map((r: any) => String(r.name)));
          }
        } catch (e) {
          console.warn('Failed to load sizes for installation teams:', e);
        }
      }

      // Load cities
      if (availableCities.length === 0) {
        try {
          const { data: cdata, error: cerror } = await supabase
            .from('billboards')
            .select('City')
            .not('City', 'is', null);

          if (!cerror && Array.isArray(cdata)) {
            const uniqueCities = [...new Set(cdata.map((r: any) => String(r.City)).filter(Boolean))].sort();
            setAvailableCities(uniqueCities);
          }
        } catch (e) {
          console.warn('Failed to load cities for installation teams:', e);
        }
      }

      // Load friend companies
      if (friendCompanies.length === 0) {
        try {
          const { data: fcData } = await supabase
            .from('friend_companies')
            .select('id, name')
            .order('name');
          if (fcData) setFriendCompanies(fcData as FriendCompany[]);
        } catch (e) {
          console.warn('Failed to load friend companies:', e);
        }
      }

      // Load team members
      await loadTeamMembers();
      // Load team accounts
      await loadTeamAccounts((data as any) || []);
    } catch (error: any) {
      console.error('Error loading installation teams:', error);
      toast.error('فشل في تحميل فرق التركيب');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, position, phone, status, installation_team_id')
      .not('installation_team_id', 'is', null)
      .eq('status', 'active');

    const grouped: Record<string, TeamEmployee[]> = {};
    (employees || []).forEach((emp: any) => {
      if (!grouped[emp.installation_team_id]) grouped[emp.installation_team_id] = [];
      grouped[emp.installation_team_id].push(emp);
    });
    setTeamMembers(grouped);
  };

  const loadTeamAccounts = async (teamsList: InstallationTeam[]) => {
    const summaries: Record<string, { pending: number; paid: number; total: number }> = {};
    for (const team of teamsList) {
      const { data } = await supabase
        .from('installation_team_accounts')
        .select('amount, status')
        .eq('team_id', team.id);
      
      const pending = (data || []).filter(d => d.status === 'pending').reduce((s, d) => s + (Number(d.amount) || 0), 0);
      const paid = (data || []).filter(d => d.status === 'paid').reduce((s, d) => s + (Number(d.amount) || 0), 0);
      summaries[team.id] = { pending, paid, total: pending + paid };
    }
    setTeamAccountsSummary(summaries);
  };

  const loadAvailableEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, name, position, phone, status')
      .eq('status', 'active')
      .is('installation_team_id', null)
      .order('name');
    setAllEmployees((data || []) as TeamEmployee[]);
  };

  useEffect(() => {
    loadTeams();
  }, []);

  // Quick Priority Reordering (Move Up / Move Down)
  const handleQuickReorder = async (teamId: string, direction: 'up' | 'down') => {
    if (!canEditSection) return;
    const currentIndex = teams.findIndex(t => t.id === teamId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= teams.length) return;

    const currentTeam = teams[currentIndex];
    const targetTeam = teams[targetIndex];

    const currentPriority = Number(currentTeam.priority) || 0;
    const targetPriority = Number(targetTeam.priority) || 0;

    let newCurrentPriority = targetPriority;
    let newTargetPriority = currentPriority;

    // If both had the exact same priority value, adjust properly
    if (currentPriority === targetPriority) {
      if (direction === 'up') {
        newCurrentPriority = targetPriority + 1;
      } else {
        newCurrentPriority = Math.max(0, targetPriority - 1);
      }
    }

    try {
      const updatedList = [...teams];
      updatedList[currentIndex] = { ...currentTeam, priority: newCurrentPriority };
      updatedList[targetIndex] = { ...targetTeam, priority: newTargetPriority };
      updatedList.sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
      setTeams(updatedList);

      await Promise.all([
        (supabase as any).from('installation_teams').update({ priority: newCurrentPriority }).eq('id', currentTeam.id),
        (supabase as any).from('installation_teams').update({ priority: newTargetPriority }).eq('id', targetTeam.id),
      ]);

      toast.success(`تم تحديث رتبة فرقة ${currentTeam.team_name} بنجاح`);
      loadTeams();
    } catch (e: any) {
      toast.error('فشل في تعديل رتبة الفرقة');
      loadTeams();
    }
  };

  const openCreate = () => {
    setEditMode(false);
    setCurrent({ team_name: '', sizes: [], cities: [], priority: 10 });
    setSelectedSizes(new Set());
    setSelectedCities(new Set());
    setDialogOpen(true);
  };

  const openEdit = (team: InstallationTeam) => {
    setEditMode(true);
    setCurrent({ ...team });
    setSelectedSizes(new Set(Array.isArray(team.sizes) ? team.sizes : []));
    setSelectedCities(new Set(Array.isArray(team.cities) ? team.cities : []));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!current?.team_name) {
        toast.error('يرجى إدخال اسم الفرقة');
        return;
      }

      const payload = {
        team_name: current.team_name,
        sizes: Array.from(selectedSizes),
        cities: Array.from(selectedCities),
        phone_number: current.phone_number || null,
        priority: current.priority ?? 0,
        friend_company_id: current.friend_company_id || null,
        friend_company_ids: current.friend_company_ids?.length ? current.friend_company_ids : null,
      };

      if (editMode && current.id) {
        const { error } = await (supabase as any)
          .from('installation_teams')
          .update(payload)
          .eq('id', current.id);
        if (error) throw error;
        toast.success('تم تحديث الفرقة بنجاح');
      } else {
        const { error } = await (supabase as any)
          .from('installation_teams')
          .insert(payload);
        if (error) throw error;
        toast.success('تم إضافة الفرقة بنجاح');
      }

      setDialogOpen(false);
      loadTeams();
    } catch (error: any) {
      console.error('Error saving team:', error);
      toast.error('فشل في حفظ الفرقة');
    }
  };

  const confirmDelete = (id: string) => {
    setToDeleteId(id);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!toDeleteId) return;
    try {
      await supabase
        .from('employees')
        .update({ installation_team_id: null })
        .eq('installation_team_id', toDeleteId);

      const { error } = await (supabase as any)
        .from('installation_teams')
        .delete()
        .eq('id', toDeleteId);
      if (error) throw error;
      toast.success('تم حذف الفرقة');
      setConfirmOpen(false);
      setToDeleteId(null);
      loadTeams();
    } catch (error: any) {
      console.error('Error deleting team:', error);
      toast.error('فشل في حذف الفرقة');
    }
  };

  const openAssignDialog = (teamId: string) => {
    setAssignTeamId(teamId);
    setSelectedEmployeeId('');
    loadAvailableEmployees();
    setAssignDialogOpen(true);
  };

  const handleAssignEmployee = async () => {
    if (!selectedEmployeeId || !assignTeamId) return;
    try {
      const { error } = await supabase
        .from('employees')
        .update({ installation_team_id: assignTeamId })
        .eq('id', selectedEmployeeId);
      if (error) throw error;
      toast.success('تم إضافة الموظف للفرقة');
      setAssignDialogOpen(false);
      loadTeamMembers();
      loadAvailableEmployees();
    } catch (error: any) {
      toast.error('فشل في إضافة الموظف');
    }
  };

  const handleRemoveEmployee = async (employeeId: string) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ installation_team_id: null })
        .eq('id', employeeId);
      if (error) throw error;
      toast.success('تم إزالة الموظف من الفرقة');
      loadTeamMembers();
    } catch (error: any) {
      toast.error('فشل في إزالة الموظف');
    }
  };

  // Filtered teams based on search and type
  const filteredTeams = useMemo(() => {
    let result = teams;

    if (filterType === 'general') {
      result = result.filter(t => !t.friend_company_id && (!t.friend_company_ids || t.friend_company_ids.length === 0));
    } else if (filterType === 'partner') {
      result = result.filter(t => !!t.friend_company_id || (Array.isArray(t.friend_company_ids) && t.friend_company_ids.length > 0));
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(t => {
        const nameMatch = t.team_name?.toLowerCase().includes(search);
        const phoneMatch = t.phone_number?.includes(search);
        const cityMatch = t.cities?.some(c => c.toLowerCase().includes(search));
        const sizeMatch = t.sizes?.some(s => s.toLowerCase().includes(search));
        const memberMatch = (teamMembers[t.id] || []).some(m => m.name.toLowerCase().includes(search));
        return nameMatch || phoneMatch || cityMatch || sizeMatch || memberMatch;
      });
    }

    return result;
  }, [teams, filterType, searchTerm, teamMembers]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalTeams = teams.length;
    const generalTeams = teams.filter(t => !t.friend_company_id && (!t.friend_company_ids || t.friend_company_ids.length === 0)).length;
    const partnerTeams = totalTeams - generalTeams;
    const topTeam = teams[0] || null;
    const totalMembers = Object.values(teamMembers).reduce((sum, members) => sum + members.length, 0);
    const totalPending = Object.values(teamAccountsSummary).reduce((sum, acc) => sum + acc.pending, 0);
    const totalPaid = Object.values(teamAccountsSummary).reduce((sum, acc) => sum + acc.paid, 0);

    return { totalTeams, generalTeams, partnerTeams, topTeam, totalMembers, totalPending, totalPaid };
  }, [teams, teamMembers, teamAccountsSummary]);

  // Helper for Rank Badge Styling
  const getRankBadge = (index: number, priority: number = 0) => {
    if (index === 0) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 font-bold text-xs shadow-sm shadow-amber-500/10">
          <Crown className="h-4 w-4 text-amber-500" />
          <span>الرتبة الأولى (أولوية {priority})</span>
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-400/15 border border-slate-400/30 text-slate-300 font-bold text-xs">
          <Shield className="h-4 w-4 text-slate-400" />
          <span>الرتبة الثانية (أولوية {priority})</span>
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-700/15 border border-amber-700/30 text-amber-600 font-bold text-xs">
          <Award className="h-4 w-4 text-amber-700" />
          <span>الرتبة الثالثة (أولوية {priority})</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-xs">
        <TrendingUp className="h-3.5 w-3.5" />
        <span>رتبة #{index + 1} (أولوية {priority})</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-l from-card via-card/90 to-card/70 p-6 rounded-3xl border border-primary/20 shadow-lg shadow-black/20 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30 text-primary shadow-inner">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                فرق التركيبات والإزالة
                <Badge variant="outline" className="h-6 rounded-lg border-primary/30 bg-primary/10 text-xs font-bold text-primary">
                  {teams.length} فرق
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                إدارة هيكل الرتب والأولويات وتخصيصات المقاسات والمدن للتوزيع التلقائي الذكي
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {canEditSection && (
            <Button 
              onClick={openCreate} 
              className="h-11 cursor-pointer gap-2 rounded-2xl bg-primary px-5 text-xs font-black text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all duration-200"
            >
              <Plus className="h-4 w-4" /> إضافة فرقة جديدة
            </Button>
          )}
        </div>
      </div>

      {/* Stats & Rank Hierarchy Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Top Priority Team Card */}
        <Card className="rounded-3xl border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-transparent shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
              <Crown className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] text-muted-foreground font-medium block">أعلى فرقة رتبة وأولوية</span>
              <p className="text-sm font-black text-foreground truncate mt-0.5">
                {stats.topTeam ? stats.topTeam.team_name : 'لا يوجد'}
              </p>
              <span className="text-[10px] text-amber-500 font-bold">
                أولوية: {stats.topTeam?.priority || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* General vs Partner Teams */}
        <Card className="rounded-3xl border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary border border-primary/30">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground font-medium block">الفرق العامة / الشركاء</span>
              <p className="text-base font-black text-foreground mt-0.5">
                {stats.generalTeams} <span className="text-xs text-muted-foreground font-normal">عامة</span> • {stats.partnerTeams} <span className="text-xs text-muted-foreground font-normal">شركاء</span>
              </p>
              <span className="text-[10px] text-primary font-bold">
                إجمالي: {stats.totalTeams} فرقة
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Employees */}
        <Card className="rounded-3xl border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.06] to-transparent shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground font-medium block">إجمالي أعضاء الفرق</span>
              <p className="text-base font-black text-emerald-500 mt-0.5">
                {stats.totalMembers} موظف
              </p>
              <span className="text-[10px] text-muted-foreground">
                موزعون على الفرق
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Financial Overview */}
        <Card className="rounded-3xl border-blue-500/25 bg-gradient-to-br from-blue-500/[0.06] to-transparent shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-500 border border-blue-500/30">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground font-medium block">المستحقات المعلقة</span>
              <p className="text-base font-black text-amber-500 mt-0.5">
                {stats.totalPending.toLocaleString('en-US')} <span className="text-xs text-muted-foreground font-normal">د.ل</span>
              </p>
              <span className="text-[10px] text-emerald-500 font-bold">
                مدفوع: {stats.totalPaid.toLocaleString('en-US')} د.ل
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search, Filters & View Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card/60 p-3 rounded-2xl border border-border/40 backdrop-blur-md">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالاسم، المدينة، المقاس، أو العضو..."
              className="h-10 rounded-xl border-border/50 bg-background/60 pr-9 text-xs focus-visible:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="h-10 w-[150px] rounded-xl border-border/50 bg-background/60 text-xs">
              <SelectValue placeholder="نوع الفرقة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفرق ({teams.length})</SelectItem>
              <SelectItem value="general">فرق عامة فقط ({stats.generalTeams})</SelectItem>
              <SelectItem value="partner">فرق الشركات الصديقة ({stats.partnerTeams})</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-xl border border-border/50 bg-background/60 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('grid')}
              className={cn(
                "h-8 w-8 rounded-lg transition-all duration-200",
                viewMode === 'grid' ? "bg-primary/20 text-primary font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              title="عرض البطاقات"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('table')}
              className={cn(
                "h-8 w-8 rounded-lg transition-all duration-200",
                viewMode === 'table' ? "bg-primary/20 text-primary font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              title="عرض الجدول"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filteredTeams.map((team, idx) => {
              const members = teamMembers[team.id] || [];
              const account = teamAccountsSummary[team.id] || { pending: 0, paid: 0, total: 0 };
              const isPartner = !!team.friend_company_id || (Array.isArray(team.friend_company_ids) && team.friend_company_ids.length > 0);
              const partnerCompany = friendCompanies.find(f => f.id === team.friend_company_id);

              return (
                <motion.div
                  key={team.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: idx * 0.03 }}
                >
                  <Card className={cn(
                    "rounded-3xl border transition-all duration-200 hover:shadow-xl hover:shadow-black/25 overflow-hidden flex flex-col h-full bg-card/85",
                    idx === 0 ? "border-amber-500/40 bg-gradient-to-b from-amber-500/[0.04] to-card/90 shadow-amber-500/5" : "border-border/60 hover:border-primary/40"
                  )}>
                    {/* Card Header with Rank & Priority Controls */}
                    <div className="p-5 pb-3 border-b border-border/30 bg-muted/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5 min-w-0">
                          {getRankBadge(idx, team.priority || 0)}
                          <h3 className="text-lg font-black text-foreground truncate flex items-center gap-2 mt-1">
                            {team.team_name}
                          </h3>
                        </div>

                        {/* Quick Priority Up/Down Controls */}
                        {canEditSection && (
                          <div className="flex flex-col items-center gap-1 bg-background/80 border border-border/40 rounded-xl p-1 shrink-0 shadow-sm">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={idx === 0}
                              onClick={() => handleQuickReorder(team.id, 'up')}
                              className="h-6 w-6 rounded-md hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                              title="رفع الرتبة (أولوية أعلى)"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-[10px] font-mono font-bold text-muted-foreground">
                              {team.priority || 0}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={idx === filteredTeams.length - 1}
                              onClick={() => handleQuickReorder(team.id, 'down')}
                              className="h-6 w-6 rounded-md hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                              title="خفض الرتبة (أولوية أقل)"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Partner or General Type Tag */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {isPartner ? (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-purple-500/10 text-purple-400 border-purple-500/25">
                            <Handshake className="h-3 w-3" />
                            شركة شريكة: {partnerCompany ? partnerCompany.name : 'مخصصة'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/25">
                            <CheckCircle2 className="h-3 w-3" />
                            فرقة عامة رئيسية
                          </Badge>
                        )}
                        {team.phone_number && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 dir-ltr">
                            <Phone className="h-3 w-3 text-primary" />
                            {team.phone_number}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3.5">
                        {/* Specialized Sizes */}
                        <div>
                          <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 mb-1.5">
                            <Ruler className="h-3 w-3 text-primary" />
                            المقاسات المتخصصة:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(team.sizes) && team.sizes.length > 0 ? (
                              team.sizes.map(size => (
                                <Badge key={size} variant="secondary" className="text-[10px] font-mono px-2 py-0.5 rounded-lg">
                                  {size}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">جميع المقاسات دون قيود</span>
                            )}
                          </div>
                        </div>

                        {/* Specialized Cities */}
                        <div>
                          <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 mb-1.5">
                            <MapPin className="h-3 w-3 text-primary" />
                            المدن المغطاة:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(team.cities) && team.cities.length > 0 ? (
                              team.cities.map(city => (
                                <Badge key={city} variant="outline" className="text-[10px] px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border-blue-500/20">
                                  {city}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">جميع المدن</span>
                            )}
                          </div>
                        </div>

                        {/* Team Members */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3 text-primary" />
                              الأعضاء ({members.length}):
                            </span>
                            {canEditSection && (
                              <button 
                                onClick={() => openAssignDialog(team.id)} 
                                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <UserPlus className="h-3 w-3" /> إضافة
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {members.length > 0 ? (
                              members.map(m => (
                                <Badge 
                                  key={m.id} 
                                  variant="secondary" 
                                  className="text-[11px] gap-1 group cursor-pointer rounded-lg bg-muted/60 hover:bg-primary/10 hover:text-primary transition-all duration-150"
                                  onClick={() => navigate(`/admin/employees/${m.id}`)}
                                >
                                  <span>{m.name}</span>
                                  {canEditSection && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleRemoveEmployee(m.id); }}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity mr-1 hover:scale-110"
                                      title="إزالة من الفرقة"
                                    >
                                      <UserMinus className="h-3 w-3 text-destructive" />
                                    </button>
                                  )}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">لا يوجد أعضاء معينين</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Financial Summary & Actions */}
                      <div className="pt-3 border-t border-border/30 flex items-center justify-between gap-2 mt-4">
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-[11px]">معلق:</span>
                            <span className="font-bold text-amber-500 font-mono">{account.pending.toLocaleString('en-US')} د.ل</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-[11px]">مدفوع:</span>
                            <span className="font-bold text-emerald-500 font-mono">{account.paid.toLocaleString('en-US')} د.ل</span>
                          </div>
                        </div>

                        {canEditSection && (
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => openEdit(team)}
                              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-150 cursor-pointer"
                              title="تعديل الفرقة"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => confirmDelete(team.id)}
                              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 cursor-pointer"
                              title="حذف الفرقة"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <Card className="rounded-3xl border-border/50 bg-card/80 shadow-md backdrop-blur-md overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead className="w-48">الرتبة والأولوية</TableHead>
                    <TableHead>اسم الفرقة</TableHead>
                    <TableHead>نوع الفرقة</TableHead>
                    <TableHead>الأعضاء</TableHead>
                    <TableHead>المقاسات</TableHead>
                    <TableHead>المدن</TableHead>
                    <TableHead>المستحقات</TableHead>
                    <TableHead className="w-24 text-center">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeams.map((team, idx) => {
                    const members = teamMembers[team.id] || [];
                    const account = teamAccountsSummary[team.id] || { pending: 0, paid: 0, total: 0 };
                    const isPartner = !!team.friend_company_id || (Array.isArray(team.friend_company_ids) && team.friend_company_ids.length > 0);
                    const partnerCompany = friendCompanies.find(f => f.id === team.friend_company_id);

                    return (
                      <TableRow key={team.id} className="border-b border-border/30 hover:bg-primary/[0.02] transition-colors">
                        <TableCell className="text-center font-mono font-bold text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {canEditSection && (
                              <div className="flex flex-col gap-0.5">
                                <button
                                  disabled={idx === 0}
                                  onClick={() => handleQuickReorder(team.id, 'up')}
                                  className="text-muted-foreground hover:text-primary disabled:opacity-20 cursor-pointer"
                                  title="رفع"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  disabled={idx === filteredTeams.length - 1}
                                  onClick={() => handleQuickReorder(team.id, 'down')}
                                  className="text-muted-foreground hover:text-primary disabled:opacity-20 cursor-pointer"
                                  title="خفض"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                            {getRankBadge(idx, team.priority || 0)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-foreground">{team.team_name}</div>
                          {team.phone_number && (
                            <div className="text-xs text-muted-foreground dir-ltr text-right">{team.phone_number}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPartner ? (
                            <Badge variant="outline" className="text-[10px] gap-1 bg-purple-500/10 text-purple-400 border-purple-500/20">
                              <Handshake className="h-3 w-3" />
                              {partnerCompany ? partnerCompany.name : 'شركة شريكة'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" />
                              عامة رئيسية
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {members.map(m => (
                              <Badge key={m.id} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                {m.name}
                              </Badge>
                            ))}
                            {members.length === 0 && <span className="text-xs text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {Array.isArray(team.sizes) && team.sizes.length > 0 ? (
                              team.sizes.slice(0, 2).map(s => (
                                <Badge key={s} variant="secondary" className="text-[10px] font-mono">
                                  {s}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">الكل</span>
                            )}
                            {Array.isArray(team.sizes) && team.sizes.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{team.sizes.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {Array.isArray(team.cities) && team.cities.length > 0 ? (
                              team.cities.slice(0, 2).map(c => (
                                <Badge key={c} variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                                  {c}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">جميع المدن</span>
                            )}
                            {Array.isArray(team.cities) && team.cities.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{team.cities.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5 font-mono">
                            <div className="text-amber-500">معلق: {account.pending.toLocaleString('en-US')}</div>
                            <div className="text-emerald-500">مدفوع: {account.paid.toLocaleString('en-US')}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {canEditSection && (
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(team)} className="h-8 w-8 rounded-lg hover:text-primary">
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => confirmDelete(team.id)} className="h-8 w-8 rounded-lg hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit Team Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-3xl border-primary/20 bg-card">
          <DialogHeader className="p-6 border-b border-border/30 bg-muted/20">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-black">
              {editMode ? <Edit className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editMode ? 'تعديل بيانات الفرقة والرتبة' : 'إضافة فرقة تركيب جديدة'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs">اسم الفرقة *</Label>
                <Input 
                  value={current?.team_name || ''} 
                  onChange={(e) => setCurrent(c => ({ ...c, team_name: e.target.value }))}
                  placeholder="مثال: فرقة عبدالرزاق العاتي"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-xs">رقم هاتف الفرقة</Label>
                <Input 
                  value={current?.phone_number || ''} 
                  onChange={(e) => setCurrent(c => ({ ...c, phone_number: e.target.value }))}
                  placeholder="0912345678"
                  className="h-11 rounded-xl dir-ltr"
                />
              </div>
            </div>

            {/* Priority / Rank with Quick Presets */}
            <div className="space-y-2.5 rounded-2xl border border-primary/25 bg-primary/[0.03] p-4">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-sm flex items-center gap-1.5 text-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  الرتبة والأولوية (Priority Weight)
                </Label>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  القيمة الحالية: {current?.priority ?? 0}
                </span>
              </div>

              <Input 
                type="number"
                value={current?.priority ?? 0} 
                onChange={(e) => setCurrent(c => ({ ...c, priority: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                min={0}
                className="h-11 rounded-xl font-mono text-base"
              />

              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-muted-foreground">اختيار سريع:</span>
                {[
                  { label: 'قصوى (100)', val: 100 },
                  { label: 'عالية جداً (80)', val: 80 },
                  { label: 'عالية (50)', val: 50 },
                  { label: 'متوسطة (20)', val: 20 },
                  { label: 'عادية (10)', val: 10 },
                  { label: 'افتراضي (0)', val: 0 },
                ].map(preset => (
                  <Button
                    key={preset.val}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrent(c => ({ ...c, priority: preset.val }))}
                    className={cn(
                      "h-7 text-[10px] rounded-lg px-2.5 font-bold cursor-pointer",
                      current?.priority === preset.val ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-primary/40"
                    )}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground mt-1">
                الرقم الأعلى = رتبة وأولوية متقدمة. عند وجود أكثر من فرقة بنفس التخصص (المقاس والمدينة)، تُسند مهام التركيب والإزالة تلقائياً للفرقة ذات الرتبة الأعلى أولاً.
              </p>
            </div>

            {/* Friend Companies */}
            <div className="space-y-2">
              <Label className="font-bold text-xs flex items-center gap-1.5">
                <Handshake className="h-4 w-4 text-purple-400" />
                الشركة الصديقة الرئيسية (اختياري)
              </Label>
              <Select 
                value={current?.friend_company_id || '_none'} 
                onValueChange={(v) => setCurrent(c => ({ ...c, friend_company_id: v === '_none' ? undefined : v }))}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="اختر شركة صديقة..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">فرقة عامة (بدون شركة صديقة)</SelectItem>
                  {friendCompanies.map(fc => (
                    <SelectItem key={fc.id} value={fc.id}>{fc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sizes Selection */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-xs flex items-center gap-1.5">
                  <Ruler className="h-4 w-4 text-primary" />
                  المقاسات المتخصصة
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {selectedSizes.size > 0 ? `${selectedSizes.size} محدد` : 'جميع المقاسات'}
                </span>
              </div>
              <ScrollArea className="h-[130px] border border-border/50 rounded-2xl p-3 bg-background/50">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableSizes.map((sz) => {
                    const checked = selectedSizes.has(sz);
                    return (
                      <label 
                        key={sz} 
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all text-xs font-mono",
                          checked 
                            ? "bg-primary/10 border-primary text-primary font-bold shadow-sm" 
                            : "border-border/50 hover:bg-muted/40"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedSizes(prev => {
                              const next = new Set(Array.from(prev));
                              if (e.target.checked) next.add(sz); else next.delete(sz);
                              return next;
                            });
                          }}
                          className="accent-primary"
                        />
                        <span>{sz}</span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Cities Selection */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-xs flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-blue-400" />
                  المدن المغطاة
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {selectedCities.size > 0 ? `${selectedCities.size} محدد` : 'جميع المدن'}
                </span>
              </div>
              <ScrollArea className="h-[130px] border border-border/50 rounded-2xl p-3 bg-background/50">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableCities.map((city) => {
                    const checked = selectedCities.has(city);
                    return (
                      <label 
                        key={city} 
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all text-xs",
                          checked 
                            ? "bg-blue-500/10 border-blue-500/40 text-blue-400 font-bold shadow-sm" 
                            : "border-border/50 hover:bg-muted/40"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedCities(prev => {
                              const next = new Set(Array.from(prev));
                              if (e.target.checked) next.add(city); else next.delete(city);
                              return next;
                            });
                          }}
                          className="accent-blue-500"
                        />
                        <span>{city}</span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="p-5 border-t border-border/30 bg-muted/20 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-10 rounded-xl px-5 text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleSave} className="h-10 rounded-xl px-6 text-xs font-black bg-primary text-primary-foreground">
              <Save className="h-4 w-4 ml-1.5" />
              حفظ الفرقة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Employee Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl border-primary/20 bg-card p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <UserPlus className="h-5 w-5 text-primary" />
              تعيين موظف في الفرقة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-xs font-bold">اختر الموظف المتاح</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="اختر موظف..." />
                </SelectTrigger>
                <SelectContent>
                  {allEmployees.length === 0 ? (
                    <SelectItem value="_none" disabled>لا يوجد موظفين متاحين</SelectItem>
                  ) : (
                    allEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} ({emp.position || 'موظف تركيب'})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)} className="h-10 rounded-xl text-xs">
                إلغاء
              </Button>
              <Button onClick={handleAssignEmployee} disabled={!selectedEmployeeId} className="h-10 rounded-xl text-xs font-bold bg-primary text-primary-foreground">
                <UserPlus className="h-4 w-4 ml-1.5" />
                تعيين الموظف
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-3xl border-border/50 bg-card p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black">تأكيد حذف الفرقة</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              هل أنت متأكد من حذف هذه الفرقة؟ سيتم إلغاء ربط جميع الموظفين المرتبطين بها تلقائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-3">
            <AlertDialogCancel onClick={() => setConfirmOpen(false)} className="h-10 rounded-xl text-xs font-bold">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="h-10 rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90">
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
