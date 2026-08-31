import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { format, differenceInDays, isAfter, isBefore, subDays, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  AlertTriangle, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Plus, 
  Search, 
  X,
  Building2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Bell,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { findOptimalTeamForRemoval, sortTeamsByPriority } from '@/utils/teamAssignment';

interface ExpiredContract {
  Contract_Number: number;
  'Customer Name': string;
  'Ad Type': string;
  'End Date': string;
  billboard_ids: string;
  daysExpired: number;
}

interface ExpiredContractsAlertProps {
  teams: any[];
  existingTaskContractIds: Set<number>;
  onTaskCreated: () => void;
}

export function ExpiredContractsAlert({ 
  teams, 
  existingTaskContractIds,
  onTaskCreated 
}: ExpiredContractsAlertProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContracts, setSelectedContracts] = useState<Set<number>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [filterDays, setFilterDays] = useState<'all' | '7' | '30' | '60'>('all');
  
  const queryClient = useQueryClient();

  // جلب العقود المنتهية
  const { data: expiredContracts = [], isLoading, refetch } = useQuery({
    queryKey: ['expired-contracts-for-alert', Array.from(existingTaskContractIds).join(',')],
    queryFn: async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const fourMonthsAgo = subMonths(today, 4);
      const fourMonthsAgoStr = fourMonthsAgo.toISOString().split('T')[0];
      
      const { data: contractsData, error } = await (supabase as any)
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "End Date", billboard_ids, ignore_removal_alert')
        .lte('End Date', today.toISOString())
        .gte('End Date', fourMonthsAgo.toISOString())
        .order('"End Date"', { ascending: false });
      
      if (error) throw error;

      // 2. جلب جميع العقود النشطة (غير منتهية) للتحقق من اللوحات المؤجرة حالياً
      const { data: activeContracts } = await supabase
        .from('Contract')
        .select('Contract_Number, billboard_ids')
        .gt('End Date', todayStr);
      
      // استخراج معرفات اللوحات المؤجرة حالياً في عقود نشطة
      const rentedBillboardIds = new Set<number>();
      (activeContracts || []).forEach(contract => {
        if (contract.billboard_ids) {
          const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
          ids.forEach((id: number) => rentedBillboardIds.add(id));
        }
      });

      // 3. جلب جميع اللوحات المنتهية من جدول اللوحات مباشرة (خلال آخر 4 أشهر فقط) للتأكد من جلب اللوحات المضافة يدوياً
      const { data: expiredBillboardsData } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Contract_Number, Rent_End_Date, Customer_Name, Ad_Type')
        .not('Contract_Number', 'is', null)
        .lte('Rent_End_Date', todayStr)
        .gte('Rent_End_Date', fourMonthsAgoStr);

      const expiredBillboardsByContract = new Map<number, any[]>();
      (expiredBillboardsData || []).forEach(b => {
        const cNum = Number(b.Contract_Number);
        if (!isNaN(cNum)) {
          if (!expiredBillboardsByContract.has(cNum)) {
            expiredBillboardsByContract.set(cNum, []);
          }
          expiredBillboardsByContract.get(cNum)!.push(b);
        }
      });

      // جلب جميع اللوحات المشمولة بالفعل في مهام إزالة معلقة أو مكتملة لمنع التكرار
      const { data: removalItems } = await supabase
        .from('removal_task_items')
        .select('billboard_id');
      const existingTaskBillboardIds = new Set(removalItems?.map(item => item.billboard_id).filter(Boolean) || []);

      // دمج وتجهيز القائمة النهائية
      const processedContracts = new Map<number, any>();

      // أ) معالجة العقود القادمة من جدول العقود
      (contractsData || []).forEach(contract => {
        if (contract.ignore_removal_alert) return;
        if (existingTaskContractIds.has(contract.Contract_Number)) return;

        const contractBillboardIds = contract.billboard_ids?.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean) || [];
        
        // جلب اللوحات الإضافية من جدول اللوحات التي ترتبط بنفس العقد
        const extraBillboards = expiredBillboardsByContract.get(contract.Contract_Number) || [];
        const extraIds = extraBillboards.map(b => b.ID);
        
        const mergedBillboardIds = Array.from(new Set([...contractBillboardIds, ...extraIds]));
        const availableBillboards = mergedBillboardIds.filter((id: number) => {
          return !rentedBillboardIds.has(id) && !existingTaskBillboardIds.has(id);
        });

        if (availableBillboards.length > 0) {
          processedContracts.set(contract.Contract_Number, {
            Contract_Number: contract.Contract_Number,
            'Customer Name': contract['Customer Name'] || 'غير محدد',
            'Ad Type': contract['Ad Type'] || '—',
            'End Date': contract['End Date'],
            billboard_ids: availableBillboards.join(','),
            originalBillboardCount: mergedBillboardIds.length,
            availableBillboardCount: availableBillboards.length,
            daysExpired: differenceInDays(today, new Date(contract['End Date'] || today))
          });
        }
      });

      // ب) معالجة العقود التي لديها لوحات منتهية في جدول اللوحات ولكن لا يوجد لها عقد مسجل أو العقد مسجل بدون لوحات
      expiredBillboardsByContract.forEach((billboards, contractNumber) => {
        if (existingTaskContractIds.has(contractNumber)) return;
        if (processedContracts.has(contractNumber)) return;

        // فلترة اللوحات المتاحة للإزالة
        const availableBillboards = billboards.filter(b => {
          return !rentedBillboardIds.has(b.ID) && !existingTaskBillboardIds.has(b.ID);
        });

        if (availableBillboards.length > 0) {
          const firstBill = availableBillboards[0];
          processedContracts.set(contractNumber, {
            Contract_Number: contractNumber,
            'Customer Name': firstBill.Customer_Name || 'غير محدد',
            'Ad Type': firstBill.Ad_Type || '—',
            'End Date': firstBill.Rent_End_Date || todayStr,
            billboard_ids: availableBillboards.map(b => b.ID).join(','),
            originalBillboardCount: billboards.length,
            availableBillboardCount: availableBillboards.length,
            daysExpired: differenceInDays(today, new Date(firstBill.Rent_End_Date || today))
          });
        }
      });

      const result = Array.from(processedContracts.values()).sort((a, b) => b.Contract_Number - a.Contract_Number);
      
      console.log('Final expired contracts in alert:', result.map(c => c.Contract_Number));
      return result;
    },
    refetchInterval: 60000 // تحديث كل دقيقة
  });

  // فلترة العقود
  const filteredContracts = useMemo(() => {
    let filtered = expiredContracts;
    
    // فلترة حسب الأيام
    if (filterDays !== 'all') {
      const days = parseInt(filterDays);
      filtered = filtered.filter(c => c.daysExpired <= days);
    }
    
    // فلترة حسب البحث
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        String(c.Contract_Number).includes(search) ||
        c['Customer Name']?.toLowerCase().includes(search) ||
        c['Ad Type']?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [expiredContracts, filterDays, searchTerm]);

  // إحصائيات سريعة
  const stats = useMemo(() => {
    const recentlyExpired = expiredContracts.filter(c => c.daysExpired <= 7).length;
    const expired30Days = expiredContracts.filter(c => c.daysExpired <= 30).length;
    const totalBillboards = expiredContracts.reduce((sum, c) => {
      const ids = c.billboard_ids?.split(',').filter(Boolean) || [];
      return sum + ids.length;
    }, 0);
    
    return { recentlyExpired, expired30Days, totalBillboards, total: expiredContracts.length };
  }, [expiredContracts]);

  // Toggle contract selection
  const toggleContract = (contractNumber: number) => {
    const newSet = new Set(selectedContracts);
    if (newSet.has(contractNumber)) {
      newSet.delete(contractNumber);
    } else {
      newSet.add(contractNumber);
    }
    setSelectedContracts(newSet);
  };

  // Select all visible contracts
  const selectAllVisible = () => {
    const allVisible = new Set<number>(filteredContracts.map((c: any) => c.Contract_Number as number));
    setSelectedContracts(allVisible);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedContracts(new Set());
  };

  // إنشاء مهام الإزالة
  const createTasksMutation = useMutation({
    mutationFn: async () => {
      if (selectedContracts.size === 0) {
        throw new Error('يرجى اختيار عقود');
      }

      let createdCount = 0;
      
      for (const contractNumber of selectedContracts) {
        const contract = expiredContracts.find(c => c.Contract_Number === contractNumber);
        if (!contract?.billboard_ids) continue;
        
        const billboardIds = contract.billboard_ids
          .split(',')
          .map(id => parseInt(id.trim()))
          .filter(Boolean);
        
        if (billboardIds.length === 0) continue;

        // جلب اللوحات - نستخدم الـ IDs التي حددها التنبيه مسبقاً (بعد استبعاد المؤجرة في عقود نشطة)
        const { data: billboards, error: billError } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', billboardIds);

        if (billError || !billboards || billboards.length === 0) continue;

        // نستخدم جميع اللوحات المجلوبة بدون فلترة إضافية
        // (التنبيه استبعد مسبقاً اللوحات المؤجرة في عقود نشطة)
        const expiredBillboards = billboards;

        if (expiredBillboards.length === 0) continue;

        const isAutoDistribute = !selectedTeamId || selectedTeamId === 'auto';

        if (isAutoDistribute) {
          // توزيع تلقائي ذكي حسب الرتبة، الأولوية، المقاس، والمدينة، والشركة الصديقة
          const teamBillboardsMap = new Map<string, any[]>();

          for (const billboard of expiredBillboards) {
            const optimalTeam = findOptimalTeamForRemoval(teams, billboard.Size, billboard.City, billboard.friend_company_id);
            const teamId = optimalTeam?.id || (teams.length > 0 ? sortTeamsByPriority(teams)[0]?.id : '');
            
            if (!teamId) continue;
            if (!teamBillboardsMap.has(teamId)) {
              teamBillboardsMap.set(teamId, []);
            }
            teamBillboardsMap.get(teamId)!.push(billboard);
          }

          // إنشاء مهمة لكل فريق
          for (const [teamId, teamBillboards] of teamBillboardsMap) {
            const { data: task, error: taskError } = await supabase
              .from('removal_tasks')
              .insert({
                contract_id: contractNumber,
                contract_ids: [contractNumber],
                team_id: teamId,
                status: 'pending'
              })
              .select()
              .single();

            if (taskError) throw taskError;

            for (const billboard of teamBillboards) {
              const { data: installationItem } = await supabase
                .from('installation_task_items')
                .select('design_face_a, design_face_b, installed_image_url')
                .eq('billboard_id', billboard.ID)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              await supabase
                .from('removal_task_items')
                .insert({
                  task_id: task.id,
                  billboard_id: billboard.ID,
                  status: 'pending',
                  design_face_a: installationItem?.design_face_a || null,
                  design_face_b: installationItem?.design_face_b || null,
                  installed_image_url: installationItem?.installed_image_url || null
                });
            }
            createdCount++;
          }
        } else {
          // فريق محدد يدوياً
          const { data: task, error: taskError } = await supabase
            .from('removal_tasks')
            .insert({
              contract_id: contractNumber,
              contract_ids: [contractNumber],
              team_id: selectedTeamId,
              status: 'pending'
            })
            .select()
            .single();

          if (taskError) throw taskError;

          for (const billboard of expiredBillboards) {
            const { data: installationItem } = await supabase
              .from('installation_task_items')
              .select('design_face_a, design_face_b, installed_image_url')
              .eq('billboard_id', billboard.ID)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            await supabase
              .from('removal_task_items')
              .insert({
                task_id: task.id,
                billboard_id: billboard.ID,
                status: 'pending',
                design_face_a: installationItem?.design_face_a || null,
                design_face_b: installationItem?.design_face_b || null,
                installed_image_url: installationItem?.installed_image_url || null
              });
          }
          createdCount++;
        }
      }
      
      return createdCount;
    },
    onSuccess: (count) => {
      toast.success(`تم إنشاء ${count} مهمة إزالة بنجاح`);
      setSelectedContracts(new Set());
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
      queryClient.invalidateQueries({ queryKey: ['expired-contracts-for-alert'] });
      onTaskCreated();
    },
    onError: (error: any) => {
      toast.error('فشل إنشاء المهام: ' + error.message);
    }
  });

  // الحصول على لون المدة
  const getDaysColor = (days: number) => {
    if (days <= 7) return 'text-red-500 bg-red-500/10';
    if (days <= 30) return 'text-orange-500 bg-orange-500/10';
    return 'text-yellow-500 bg-yellow-500/10';
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-primary/20 bg-card/55">
        <CardContent className="py-5">
          <div className="flex items-center justify-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
            <span className="text-muted-foreground">جاري تحميل العقود المنتهية...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (expiredContracts.length === 0) {
    return (
      <Card className="rounded-2xl border-emerald-500/25 bg-emerald-500/[0.05]">
        <CardContent className="py-5">
          <div className="flex items-center justify-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <span className="text-emerald-600 font-medium">لا توجد عقود منتهية تحتاج لإنشاء مهام إزالة</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="overflow-hidden rounded-2xl border-primary/20 bg-card/60 shadow-sm backdrop-blur-md">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-3.5 transition-colors duration-200 hover:bg-primary/[0.04]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                    <Bell className="h-5 w-5 text-primary" />
                    {stats.recentlyExpired > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-card bg-rose-500 px-1 text-[9px] font-bold text-white">
                        {stats.recentlyExpired}
                      </span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-black sm:text-base">
                      <span>عقود منتهية جاهزة لإنشاء مهام إزالة</span>
                      <Badge variant="secondary" className="h-6 rounded-lg border border-primary/20 bg-primary/10 text-[10px] text-primary">
                        {stats.total} عقد
                      </Badge>
                    </CardTitle>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {stats.recentlyExpired > 0 && (
                        <span className="text-red-500 font-medium">{stats.recentlyExpired} منتهي منذ أقل من أسبوع • </span>
                      )}
                      {stats.totalBillboards} لوحة تحتاج إزالة
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      refetch();
                    }}
                    className="h-10 w-10 cursor-pointer rounded-xl text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary active:scale-95"
                    aria-label="تحديث العقود المنتهية"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/35 text-muted-foreground">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-4 border-t border-border/30 pt-4">
              {/* إحصائيات سريعة */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-center">
                  <div className="text-xl font-black text-rose-400">{stats.recentlyExpired}</div>
                  <div className="text-xs text-muted-foreground">منذ أقل من أسبوع</div>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-center">
                  <div className="text-xl font-black text-amber-400">{stats.expired30Days}</div>
                  <div className="text-xs text-muted-foreground">منذ أقل من شهر</div>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3 text-center">
                  <div className="text-xl font-black text-primary">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">إجمالي العقود</div>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-3 text-center">
                  <div className="text-xl font-black text-blue-400">{stats.totalBillboards}</div>
                  <div className="text-xs text-muted-foreground">إجمالي اللوحات</div>
                </div>
              </div>

              {/* أدوات البحث والفلترة */}
              <div className="flex flex-col gap-3 rounded-2xl border border-border/35 bg-background/30 p-3 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث برقم العقد أو اسم الزبون..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 rounded-xl border-border/45 bg-background/70 pr-10 text-xs focus-visible:ring-primary/40"
                  />
                </div>
                <Select value={filterDays} onValueChange={(v: any) => setFilterDays(v)}>
                  <SelectTrigger className="h-10 w-full rounded-xl border-border/45 bg-background/70 text-xs md:w-[180px]">
                    <SelectValue placeholder="فترة الانتهاء" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفترات</SelectItem>
                    <SelectItem value="7">آخر أسبوع</SelectItem>
                    <SelectItem value="30">آخر شهر</SelectItem>
                    <SelectItem value="60">آخر شهرين</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllVisible}
                    className="h-10 cursor-pointer whitespace-nowrap rounded-xl px-3 text-xs font-bold active:scale-95"
                  >
                    تحديد الكل ({filteredContracts.length})
                  </Button>
                  {selectedContracts.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="h-10 cursor-pointer rounded-xl text-xs text-muted-foreground active:scale-95"
                    >
                      <X className="h-4 w-4 ml-1" />
                      إلغاء ({selectedContracts.size})
                    </Button>
                  )}
                </div>
              </div>

              {/* قائمة العقود */}
              <ScrollArea className="h-[320px] rounded-2xl border border-border/40 bg-background/25">
                <div className="p-2 space-y-2">
                  <AnimatePresence>
                    {filteredContracts.map((contract, index) => {
                      const isSelected = selectedContracts.has(contract.Contract_Number);
                      const availableCount = contract.availableBillboardCount || 0;
                      const originalCount = contract.originalBillboardCount || 0;
                      const hasFiltered = originalCount > availableCount;
                      
                      return (
                        <motion.div
                          key={contract.Contract_Number}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: index * 0.02 }}
                          className={`
                            flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all duration-200
                            ${isSelected 
                              ? 'border-primary bg-primary/10 shadow-sm'
                              : 'border-border/40 bg-card/70 hover:border-primary/40 hover:bg-primary/[0.04]'
                            }
                          `}
                          onClick={() => toggleContract(contract.Contract_Number)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleContract(contract.Contract_Number)}
                            className="pointer-events-none h-5 w-5 rounded-md"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-primary">#{contract.Contract_Number}</span>
                              <Badge variant="outline" className="h-6 rounded-lg border-border px-2 text-[10px]">
                                {contract['Ad Type'] || 'غير محدد'}
                              </Badge>
                              <Badge variant="secondary" className="h-6 gap-1 rounded-lg bg-muted px-2 text-[10px] text-foreground">
                                <MapPin className="h-3 w-3" />
                                {availableCount} لوحة
                                {hasFiltered && (
                                  <span className="text-muted-foreground">
                                    (من {originalCount})
                                  </span>
                                )}
                              </Badge>
                            </div>
                            <div className="text-sm text-foreground/80 mt-1 truncate">
                              <Building2 className="h-3 w-3 inline ml-1 text-muted-foreground" />
                              {contract['Customer Name'] || 'زبون غير محدد'}
                            </div>
                          </div>
                          
                          <div className="text-left shrink-0 flex items-center gap-1.5">
                            <div className="flex flex-col items-end">
                              <div className={`text-xs font-bold px-2 py-1 rounded-md ${getDaysColor(contract.daysExpired)}`}>
                                منذ {contract.daysExpired} يوم
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(new Date(contract['End Date']), 'dd/MM/yyyy')}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 shrink-0 cursor-pointer rounded-xl text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive active:scale-95"
                              title="تجاهل التنبيه"
                              aria-label={`تجاهل تنبيه العقد ${contract.Contract_Number}`}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                   const { error } = await (supabase as any)
                                    .from('Contract')
                                    .update({ ignore_removal_alert: true })
                                    .eq('Contract_Number', contract.Contract_Number);
                                  
                                  if (error) throw error;
                                  
                                  toast.success('تم تجاهل العقد بنجاح ولن يظهر في التنبيهات');
                                  refetch();
                                } catch (err: any) {
                                  console.error(err);
                                  toast.error('فشل في تجاهل العقد: ' + err.message);
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  
                  {filteredContracts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>لا توجد عقود مطابقة للبحث</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* زر إنشاء المهام */}
              {selectedContracts.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"
                >
                  <div>
                    <span className="font-medium">تم تحديد {selectedContracts.size} عقد</span>
                    <span className="text-muted-foreground text-sm mr-2">
                      ({selectedContracts.size === 1 ? 'عقد واحد' : `${selectedContracts.size} عقود`})
                    </span>
                  </div>
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    className="h-10 cursor-pointer gap-2 rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground shadow-sm shadow-primary/15 active:scale-95"
                  >
                    <Plus className="h-5 w-5" />
                    إنشاء مهام الإزالة
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* نافذة التأكيد */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="overflow-hidden rounded-2xl border-primary/20 bg-card p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border/35 bg-primary/[0.05] p-5">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              إنشاء مهام الإزالة
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-border/35 bg-muted/35 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground">العقود المختارة:</span>
                <Badge>{selectedContracts.size}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                سيتم إنشاء مهمة إزالة لكل عقد مع جميع لوحاته المنتهية
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">اختيار الفريق (اختياري)</label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="h-10 rounded-xl border-border/45 bg-background/70">
                  <SelectValue placeholder="توزيع تلقائي ذكي حسب الرتبة والأولوية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">توزيع تلقائي ذكي (حسب الرتبة والأولوية والمقاس)</SelectItem>
                  {sortTeamsByPriority(teams.filter(team => team.id && team.id.trim() !== '')).map((team, idx) => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{team.team_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                          رتبة #{idx + 1} (أولوية: {team.priority || 0})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="border-t border-border/35 p-5 pt-4">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="h-10 cursor-pointer rounded-xl px-5 text-xs font-bold active:scale-95">
              إلغاء
            </Button>
            <Button
              onClick={() => createTasksMutation.mutate()}
              disabled={createTasksMutation.isPending}
              className="h-10 cursor-pointer gap-2 rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground active:scale-95"
            >
              {createTasksMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  تأكيد الإنشاء
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
