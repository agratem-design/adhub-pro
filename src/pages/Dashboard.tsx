// @ts-nocheck
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Calendar, FileText, Receipt, Monitor, Clock, Plus, Eye, Package, ChevronDown, ChevronUp, Maximize2, 
  TrendingUp, Users, BarChart3, MapPin, Image as ImageIcon, AlertTriangle, Layers, Building2, 
  RefreshCw, ArrowUpRight, Wallet, Target, Sparkles, Zap, Bell, Activity, TrendingDown,
  CircleDollarSign, ArrowRight, CheckCircle2, XCircle, Timer, CalendarDays,
  ClipboardList, LayoutDashboard, Wrench, BookOpen, MessageSquare, Loader2, CreditCard, Search, Info,
  PieChart as PieChartIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { OverduePaymentsAlert } from '@/components/billing/OverduePaymentsAlert';
import { OverdueInvoicesAlert } from '@/components/billing/OverdueInvoicesAlert';
import { OverdueCompositeTasksAlert } from '@/components/billing/OverdueCompositeTasksAlert';
import { RecentActivityLog } from '@/components/billing/RecentActivityLog';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PageHero } from '@/components/shared/PageHero';
import { StatBadge } from '@/components/shared/StatBadge';
import { isBillboardAvailable, isBillboardBlockedFromAvailability } from '@/utils/contractUtils';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';

// Tabs UI component
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';

// Recharts components
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, PieChart as RechartsPieChart, Pie, Cell, 
  BarChart as RechartsBarChart, Bar, LineChart, Line, Legend, ReferenceLine
} from 'recharts';

interface LegacyContract {
  Contract_Number: number;
  'Customer Name': string;
  'Ad Type': string;
  'Total Rent': number;
  'Start Date': string;
  'End Date': string;
  'Contract Date': string;
  customer_id: string;
  id: number;
  Total: number;
  billboards_count: number;
  Phone: string;
  installments_data: string;
}

interface Payment {
  id: string;
  customer_name: string;
  amount: number;
  paid_at: string;
  entry_type: string;
  created_at: string;
  contract_number: number | null;
}

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Size: string;
  Level: string;
  Municipality: string;
  District: string;
  Status: string;
  created_at: string;
  Nearest_Landmark: string;
  Image_URL: string;
  friend_company_id?: string;
}

interface InstallationTeam {
  id: string;
  team_name: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover text-popover-foreground border border-border/80 p-3 rounded-xl shadow-xl text-right dir-rtl font-numbers">
        <p className="text-xs font-bold text-muted-foreground mb-1.5">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs font-bold" style={{ color: entry.stroke || entry.color }}>
            {entry.name}: {Number(entry.value).toLocaleString('ar-LY')} د.ل
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { sendMessage, loading: whatsappLoading } = useSendWhatsApp();
  const [legacyContracts, setLegacyContracts] = useState<LegacyContract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [allBillboards, setAllBillboards] = useState<Billboard[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [installationTasks, setInstallationTasks] = useState<any[]>([]);
  const [removalTasks, setRemovalTasks] = useState<any[]>([]);
  const [installationTeams, setInstallationTeams] = useState<InstallationTeam[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [chartsOpen, setChartsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'monthly' | 'quarterly' | 'semi-annual' | 'annual'>('monthly');
  
  const [selectedImage, setSelectedImage] = useState<{url: string; name: string} | null>(null);

  // Unified Search state for Tasks Tab
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  
  // WhatsApp Dialog state expanded for Smart Templates
  const [whatsappDialog, setWhatsappDialog] = useState<{
    open: boolean;
    phone: string;
    message: string;
    title: string;
    customerName: string;
    contractNumber: string;
    endDate: string;
    amount: string;
    dueDate: string;
    installmentIndex: string;
  }>({
    open: false,
    phone: '',
    message: '',
    title: '',
    customerName: '',
    contractNumber: '',
    endDate: '',
    amount: '',
    dueDate: '',
    installmentIndex: ''
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 5) return 'يسعد مساؤك';
    if (hour < 12) return 'صباح الخير والبركة';
    if (hour < 17) return 'أهلاً بك، طاب يومك';
    return 'مساء الخير والأنوار';
  };

  const openWhatsAppDialog = useCallback(async (
    phone: string, 
    message: string, 
    title: string, 
    customerId?: string,
    templateData?: Partial<typeof whatsappDialog>
  ) => {
    let resolvedPhone = phone || '';
    
    // Attempt to fetch phone from database if empty
    if (!resolvedPhone && customerId) {
      try {
        const { data: customer } = await supabase
          .from('customers')
          .select('phone')
          .eq('id', customerId)
          .maybeSingle();
        if (customer?.phone) {
          resolvedPhone = customer.phone;
        }
      } catch (e) {
        console.warn('Failed to fetch customer phone:', e);
      }
    }
    
    setWhatsappDialog({ 
      open: true, 
      phone: resolvedPhone, 
      message, 
      title,
      customerName: templateData?.customerName || '',
      contractNumber: templateData?.contractNumber || '',
      endDate: templateData?.endDate || '',
      amount: templateData?.amount || '',
      dueDate: templateData?.dueDate || '',
      installmentIndex: templateData?.installmentIndex || ''
    });
  }, []);

  const handleSendWhatsApp = useCallback(async () => {
    const success = await sendMessage({ phone: whatsappDialog.phone, message: whatsappDialog.message });
    if (success) setWhatsappDialog(prev => ({ ...prev, open: false }));
  }, [whatsappDialog, sendMessage]);

  const applyTemplate = (type: string) => {
    const { customerName, contractNumber, endDate, amount, dueDate, installmentIndex } = whatsappDialog;
    let msg = '';
    switch (type) {
      case 'expired':
        msg = `مرحباً ${customerName || 'العميل الكريم'}،\n\nنود إعلامكم بأن عقدكم رقم ${contractNumber || ''} قد انتهى بتاريخ ${endDate || ''}.\nيرجى التواصل معنا لتجديد العقد وتأمين حجز اللوحات.\n\nشكراً لتعاملكم معنا.`;
        break;
      case 'expiring':
        msg = `مرحباً ${customerName || 'العميل الكريم'}،\n\nنود تذكيركم بأن عقدكم رقم ${contractNumber || ''} سينتهي قريباً بتاريخ ${endDate || ''}.\nيرجى التواصل معنا قبل موعد الانتهاء لتجديد الحجز.\n\nشكراً لكم.`;
        break;
      case 'installment':
        msg = `مرحباً ${customerName || 'العميل الكريم'}،\n\nنود تذكيركم بأن القسط رقم ${installmentIndex || ''} بمبلغ ${Number(amount).toLocaleString('ar-LY')} د.ل مستحق بتاريخ ${dueDate || ''}.\nيرجى السداد في الموعد المحدد لتفادي أي غرامات.\n\nشكراً لكم.`;
        break;
      case 'receipt':
        msg = `مرحباً ${customerName || 'العميل الكريم'}،\n\nتم استلام دفعتكم بمبلغ ${Number(amount).toLocaleString('ar-LY')} د.ل بنجاح.\nنشكركم على ثقتكم بنا وسدادكم في الموعد.`;
        break;
      case 'maintenance':
        msg = `مرحباً ${customerName || 'العميل الكريم'}،\n\nنفيدكم ببدء أعمال الصيانة الدورية للوحة الإعلانية الخاصة بكم (عقد رقم ${contractNumber || ''}).\nنحن ملتزمون دائماً بتقديم أفضل جودة لظهور إعلانكم.\n\nشكراً لكم.`;
        break;
      default:
        msg = whatsappDialog.message;
    }
    setWhatsappDialog(prev => ({ ...prev, message: msg }));
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: legacyData, error: legacyError } = await supabase
        .from('Contract')
        .select('*')
        .order('Contract Date', { ascending: false });

      if (legacyError) {
        console.error('خطأ في تحميل العقود:', legacyError);
        toast.error(`فشل في تحميل العقود`);
      } else {
        setLegacyContracts(legacyData || []);
      }

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('*')
        .in('entry_type', ['receipt', 'account_payment', 'payment'])
        .order('created_at', { ascending: false });

      if (!paymentsError) {
        setPayments(paymentsData || []);
      }

      const { data: billboardsData, error: billboardsError } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, Level, Municipality, District, Status, created_at, Nearest_Landmark, Image_URL')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!billboardsError) {
        setBillboards(billboardsData || []);
      }

      const { data: allBillboardsData } = await supabase
        .from('billboards')
        .select('ID, Size, Municipality, Status, friend_company_id, Contract_Number, Rent_End_Date, maintenance_status, maintenance_type, is_visible_in_available');

      if (allBillboardsData) {
        setAllBillboards(allBillboardsData);
      }

      const { data: teamsData } = await supabase
        .from('installation_teams')
        .select('id, team_name');

      if (teamsData) {
        setInstallationTeams(teamsData);
      }

      const today = new Date();
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .lt('due_date', today.toISOString())
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true })
        .limit(5);

      setOverdueTasks(tasksData || []);

      const { data: installTasksData, error: installError } = await supabase
        .from('installation_tasks')
        .select('id, contract_id, team_id, status, created_at')
        .in('status', ['pending', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (installError) {
        console.error('خطأ في تحميل مهام التركيب:', installError);
      }

      const enrichedInstallTasks = await Promise.all(
        (installTasksData || []).map(async (task) => {
          if (task.contract_id) {
            const { data: contractData } = await supabase
              .from('Contract')
              .select("\"Customer Name\", \"Ad Type\"")
              .eq('Contract_Number', task.contract_id)
              .maybeSingle();
            return {
              ...task,
              customer_name: contractData?.['Customer Name'] || 'غير محدد',
              ad_type: contractData?.['Ad Type'] || 'غير محدد'
            };
          }
          return { ...task, customer_name: 'غير محدد', ad_type: 'غير محدد' };
        })
      );

      setInstallationTasks(enrichedInstallTasks);

      const { data: removalTasksData, error: removalError } = await supabase
        .from('removal_tasks')
        .select('id, contract_id, status, created_at')
        .in('status', ['pending', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (removalError) {
        console.error('خطأ في تحميل مهام الإزالة:', removalError);
      }

      const enrichedRemovalTasks = await Promise.all(
        (removalTasksData || []).map(async (task) => {
          if (task.contract_id) {
            const { data: contractData } = await supabase
              .from('Contract')
              .select("\"Customer Name\", \"Ad Type\"")
              .eq('Contract_Number', task.contract_id)
              .maybeSingle();
            return {
              ...task,
              customer_name: contractData?.['Customer Name'] || 'غير محدد',
              ad_type: contractData?.['Ad Type'] || 'غير محدد'
            };
          }
          return { ...task, customer_name: 'غير محدد', ad_type: 'غير محدد' };
        })
      );

      setRemovalTasks(enrichedRemovalTasks);

    } catch (error) {
      console.error('خطأ عام في تحميل البيانات:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTeamName = (teamId: string) => {
    const team = installationTeams.find(t => t.id === teamId);
    return team?.team_name || 'غير محدد';
  };

  // Expiring Contracts Calculations
  const expiringContracts = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const legacyExpiring = legacyContracts
      .filter(contract => {
        try {
          if (!contract['End Date']) return false;
          const endDate = new Date(contract['End Date']);
          return endDate >= today && endDate <= thirtyDaysFromNow;
        } catch (error) {
          return false;
        }
      })
      .map(contract => ({
        id: `legacy_${contract.Contract_Number}`,
        contract_number: contract.Contract_Number?.toString() || '',
        customer_name: contract['Customer Name'] || '',
        ad_type: contract['Ad Type'] || 'غير محدد',
        end_date: contract['End Date'] || '',
        total_amount: Number(contract['Total']) || 0,
        billboards_count: contract.billboards_count || 0,
        phone: contract.Phone || '',
        customer_id: contract.customer_id || '',
        source: 'legacy'
      }));

    const sorted = legacyExpiring.sort((a, b) => {
      const daysLeftA = differenceInDays(new Date(a.end_date), today);
      const daysLeftB = differenceInDays(new Date(b.end_date), today);
      return daysLeftA - daysLeftB;
    });

    return sorted.slice(0, 10);
  }, [legacyContracts]);

  // Ended Contracts Calculations
  const recentlyEndedContracts = useMemo(() => {
    const today = new Date();

    const legacyEnded = legacyContracts
      .filter(contract => {
        try {
          if (!contract['End Date']) return false;
          const endDate = new Date(contract['End Date']);
          return endDate < today;
        } catch (error) {
          return false;
        }
      })
      .map(contract => ({
        id: `legacy_${contract.Contract_Number}`,
        contract_number: contract.Contract_Number?.toString() || '',
        customer_name: contract['Customer Name'] || '',
        ad_type: contract['Ad Type'] || 'غير محدد',
        end_date: contract['End Date'] || '',
        total_amount: Number(contract['Total']) || 0,
        billboards_count: contract.billboards_count || 0,
        phone: contract.Phone || '',
        customer_id: contract.customer_id || '',
        days_ago: Math.abs(differenceInDays(new Date(contract['End Date']), today))
      }));

    return legacyEnded.sort((a, b) => a.days_ago - b.days_ago).slice(0, 10);
  }, [legacyContracts]);

  // Installments payments check
  const [contractPaymentsMap, setContractPaymentsMap] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    const contractNumbers = legacyContracts
      .filter(c => c.installments_data)
      .map(c => c.Contract_Number);
    if (contractNumbers.length === 0) return;

    (async () => {
      const { data } = await supabase
        .from('customer_payments')
        .select('contract_number, amount')
        .in('contract_number', contractNumbers);
      const map = new Map<number, number>();
      for (const p of data || []) {
        if (p.contract_number) {
          map.set(p.contract_number, (map.get(p.contract_number) || 0) + (Number(p.amount) || 0));
        }
      }
      setContractPaymentsMap(map);
    })();
  }, [legacyContracts]);

  // Upcoming payments
  const upcomingInstallments = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const results: Array<{
      id: string;
      contractNumber: number;
      customerName: string;
      phone: string;
      customerId: string;
      amount: number;
      dueDate: string;
      daysLeft: number;
      installmentIndex: number;
    }> = [];

    legacyContracts.forEach(contract => {
      if (!contract.installments_data) return;
      try {
        const installments = JSON.parse(contract.installments_data);
        if (!Array.isArray(installments)) return;

        const sorted = [...installments]
          .map((inst: any, idx: number) => ({ ...inst, originalIdx: idx }))
          .filter((inst: any) => inst.dueDate || inst.due_date)
          .sort((a: any, b: any) => new Date(a.dueDate || a.due_date).getTime() - new Date(b.dueDate || b.due_date).getTime());

        let paymentsRemaining = contractPaymentsMap.get(contract.Contract_Number) || 0;

        sorted.forEach((inst: any) => {
          const instAmount = Number(inst.amount) || 0;
          const allocated = Math.min(instAmount, Math.max(0, paymentsRemaining));
          const overdueAmount = Math.max(0, instAmount - allocated);
          paymentsRemaining = Math.max(0, paymentsRemaining - allocated);

          if (overdueAmount <= 0) return; // fully paid

          const dueDate = new Date(inst.dueDate || inst.due_date);
          if (isNaN(dueDate.getTime())) return;
          if (dueDate >= today && dueDate <= thirtyDaysFromNow) {
            results.push({
              id: `${contract.Contract_Number}_${inst.originalIdx}`,
              contractNumber: contract.Contract_Number,
              customerName: contract['Customer Name'] || '',
              phone: contract.Phone || '',
              customerId: contract.customer_id || '',
              amount: overdueAmount,
              dueDate: inst.dueDate || inst.due_date,
              daysLeft: differenceInDays(dueDate, today),
              installmentIndex: inst.originalIdx + 1,
              adType: contract['Ad Type'] || 'غير محدد',
            });
          }
        });
      } catch { /* ignore */ }
    });

    return results.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 10);
  }, [legacyContracts, contractPaymentsMap]);

  const recentContracts = useMemo(() => {
    const legacyRecent = legacyContracts
      .map(contract => ({
        id: `legacy_${contract.Contract_Number}`,
        contract_number: contract.Contract_Number?.toString() || '',
        customer_name: contract['Customer Name'] || '',
        ad_type: contract['Ad Type'] || 'غير محدد',
        total_amount: Number(contract['Total']) || 0,
        created_at: contract['Contract Date'] || '',
        billboards_count: contract.billboards_count || 0,
        date_for_sorting: new Date(contract['Contract Date'] || '1970-01-01').getTime(),
      }));

    return legacyRecent.sort((a, b) => b.date_for_sorting - a.date_for_sorting).slice(0, 5);
  }, [legacyContracts]);

  const recentPayments = useMemo(() => {
    return payments
      .filter(p => 
        (p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment') &&
        p.amount > 0
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [payments]);

  const recentBillboards = useMemo(() => {
    return billboards
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [billboards]);

  const topCustomers = useMemo(() => {
    const customerTotals: { [key: string]: number } = {};
    
    legacyContracts.forEach(contract => {
      const customerName = contract['Customer Name'];
      if (customerName) {
        customerTotals[customerName] = (customerTotals[customerName] || 0) + (Number(contract['Total']) || 0);
      }
    });

    return Object.entries(customerTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [legacyContracts]);

  const ownBillboards = useMemo(() => {
    return allBillboards.filter(b => !b.friend_company_id);
  }, [allBillboards]);

  const friendBillboards = useMemo(() => {
    return allBillboards.filter(b => !!b.friend_company_id);
  }, [allBillboards]);

  const isDeBusSociet = useCallback((b: any): boolean => {
    const size = String(b.Size || '').trim().toLowerCase();
    return size === 'سوسيت' || size === '2.5x4' || size === '2.5x4 ' || size.includes('سوسيت') || size.includes('دي باس') || size.includes('دي باص') || size.includes('debus') || size.includes('de-bus');
  }, []);

  const isBillboardRemoved = useCallback((b: any): boolean => {
    const status = (b.Status || '').toString().trim().toLowerCase();
    const maintenanceStatus = String(b.maintenance_status || '').trim().toLowerCase();
    const maintenanceType = String(b.maintenance_type || '').trim();
    
    return (
      status === 'إزالة' || status === 'ازالة' || status === 'removed' ||
      maintenanceStatus === 'removed' || maintenanceStatus === 'تمت الإزالة' ||
      maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب' ||
      maintenanceType === 'تمت الإزالة' || maintenanceType === 'تحتاج إزالة' || maintenanceType === 'لم يتم التركيب'
    );
  }, []);

  // Filtered own billboards for statistics (excludes friendly, removed, hidden, and societ/debus size)
  const statsBillboards = useMemo(() => {
    return ownBillboards.filter(b => {
      // Exclude removed
      if (isBillboardRemoved(b)) return false;
      // Exclude hidden
      if (b.is_visible_in_available === false) return false;
      // Exclude debus/societ size
      if (isDeBusSociet(b)) return false;
      return true;
    });
  }, [ownBillboards, isBillboardRemoved, isDeBusSociet]);

  const getDaysLeft = (endDate: string) => {
    try {
      const today = new Date();
      const end = new Date(endDate);
      return differenceInDays(end, today);
    } catch (error) {
      return 0;
    }
  };

  const formatDateSafe = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateString;
    }
  };

  const totalSales = useMemo(() => {
    return legacyContracts.reduce((sum, c) => sum + (Number(c['Total']) || 0), 0);
  }, [legacyContracts]);

  const totalPaymentsAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  const activeContracts = useMemo(() => {
    const today = new Date();
    return legacyContracts.filter(contract => {
      try {
        if (!contract['End Date']) return false;
        const endDate = new Date(contract['End Date']);
        return endDate >= today;
      } catch {
        return false;
      }
    }).length;
  }, [legacyContracts]);

  // --- 📈 New Recharts Data Visualization calculations ---
  const financialTrendData = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();

    if (chartPeriod === 'monthly') {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push({
          key: format(d, 'yyyy-MM'),
          label: format(d, 'MMM yyyy', { locale: ar }),
          sales: 0,
          payments: 0
        });
      }

      legacyContracts.forEach(c => {
        if (!c['Contract Date']) return;
        try {
          const dateKey = c['Contract Date'].substring(0, 7); // yyyy-MM
          const monthObj = months.find(m => m.key === dateKey);
          if (monthObj) {
            monthObj.sales += Number(c['Total']) || 0;
          }
        } catch (e) {}
      });

      payments.forEach(p => {
        const dateStr = p.paid_at || p.created_at;
        if (!dateStr) return;
        try {
          const dateKey = dateStr.substring(0, 7);
          const monthObj = months.find(m => m.key === dateKey);
          if (monthObj) {
            monthObj.payments += Number(p.amount) || 0;
          }
        } catch (e) {}
      });

      return months;
    }

    if (chartPeriod === 'quarterly') {
      const quarters = [];
      for (let i = 3; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i * 3, 1);
        const qNumber = Math.floor(d.getMonth() / 3) + 1;
        const qYear = d.getFullYear();
        quarters.push({
          key: `${qYear}-Q${qNumber}`,
          label: `الربع ${qNumber === 1 ? 'الأول' : qNumber === 2 ? 'الثاني' : qNumber === 3 ? 'الثالث' : 'الرابع'} ${qYear}`,
          sales: 0,
          payments: 0,
          year: qYear,
          quarter: qNumber
        });
      }

      legacyContracts.forEach(c => {
        if (!c['Contract Date']) return;
        try {
          const date = new Date(c['Contract Date']);
          const qNumber = Math.floor(date.getMonth() / 3) + 1;
          const qYear = date.getFullYear();
          const key = `${qYear}-Q${qNumber}`;
          const qObj = quarters.find(q => q.key === key);
          if (qObj) {
            qObj.sales += Number(c['Total']) || 0;
          }
        } catch (e) {}
      });

      payments.forEach(p => {
        const dateStr = p.paid_at || p.created_at;
        if (!dateStr) return;
        try {
          const date = new Date(dateStr);
          const qNumber = Math.floor(date.getMonth() / 3) + 1;
          const qYear = date.getFullYear();
          const key = `${qYear}-Q${qNumber}`;
          const qObj = quarters.find(q => q.key === key);
          if (qObj) {
            qObj.payments += Number(p.amount) || 0;
          }
        } catch (e) {}
      });

      return quarters;
    }

    if (chartPeriod === 'semi-annual') {
      const halves = [];
      for (let i = 3; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i * 6, 1);
        const hNumber = d.getMonth() < 6 ? 1 : 2;
        const hYear = d.getFullYear();
        halves.push({
          key: `${hYear}-H${hNumber}`,
          label: `النصف ${hNumber === 1 ? 'الأول' : 'الثاني'} ${hYear}`,
          sales: 0,
          payments: 0,
          year: hYear,
          half: hNumber
        });
      }

      legacyContracts.forEach(c => {
        if (!c['Contract Date']) return;
        try {
          const date = new Date(c['Contract Date']);
          const hNumber = date.getMonth() < 6 ? 1 : 2;
          const hYear = date.getFullYear();
          const key = `${hYear}-H${hNumber}`;
          const hObj = halves.find(h => h.key === key);
          if (hObj) {
            hObj.sales += Number(c['Total']) || 0;
          }
        } catch (e) {}
      });

      payments.forEach(p => {
        const dateStr = p.paid_at || p.created_at;
        if (!dateStr) return;
        try {
          const date = new Date(dateStr);
          const hNumber = date.getMonth() < 6 ? 1 : 2;
          const hYear = date.getFullYear();
          const key = `${hYear}-H${hNumber}`;
          const hObj = halves.find(h => h.key === key);
          if (hObj) {
            hObj.payments += Number(p.amount) || 0;
          }
        } catch (e) {}
      });

      return halves;
    }

    // Default: annual
    const years = [];
    for (let i = 2; i >= 0; i--) {
      const y = currentYear - i;
      years.push({
        key: `${y}`,
        label: `عام ${y}`,
        sales: 0,
        payments: 0
      });
    }

    legacyContracts.forEach(c => {
      if (!c['Contract Date']) return;
      try {
        const year = new Date(c['Contract Date']).getFullYear().toString();
        const yObj = years.find(y => y.key === year);
        if (yObj) {
          yObj.sales += Number(c['Total']) || 0;
        }
      } catch (e) {}
    });

    payments.forEach(p => {
      const dateStr = p.paid_at || p.created_at;
      if (!dateStr) return;
      try {
        const year = new Date(dateStr).getFullYear().toString();
        const yObj = years.find(y => y.key === year);
        if (yObj) {
          yObj.payments += Number(p.amount) || 0;
        }
      } catch (e) {}
    });

    return years;
  }, [legacyContracts, payments, chartPeriod]);

  const averages = useMemo(() => {
    let monthsCount = 6;
    if (chartPeriod === 'quarterly') monthsCount = 12;
    else if (chartPeriod === 'semi-annual') monthsCount = 24;
    else if (chartPeriod === 'annual') monthsCount = 36;

    const totalSales = financialTrendData.reduce((sum, item) => sum + (item.sales || 0), 0);
    const totalPayments = financialTrendData.reduce((sum, item) => sum + (item.payments || 0), 0);
    const pointsCount = financialTrendData.length || 1;

    return {
      salesAverage: Math.round(totalSales / monthsCount),
      paymentsAverage: Math.round(totalPayments / monthsCount),
      chartSalesAverage: Math.round(totalSales / pointsCount),
      chartPaymentsAverage: Math.round(totalPayments / pointsCount)
    };
  }, [financialTrendData, chartPeriod]);

  const averageLabels = useMemo(() => {
    switch (chartPeriod) {
      case 'quarterly':
        return { sales: 'متوسط الربع', payments: 'متوسط الربع' };
      case 'semi-annual':
        return { sales: 'متوسط النصف سنوي', payments: 'متوسط النصف سنوي' };
      case 'annual':
        return { sales: 'متوسط السنوي', payments: 'متوسط السنوي' };
      default:
        return { sales: 'متوسط شهري', payments: 'متوسط شهري' };
    }
  }, [chartPeriod]);

  const availabilityStats = useMemo(() => {
    const total = statsBillboards.length;
    const available = statsBillboards.filter(b => isBillboardAvailable(b)).length;
    const rented = total - available;
    const occupancyRate = total > 0 ? Math.round((rented / total) * 100) : 0;
    const availabilityRate = total > 0 ? Math.round((available / total) * 100) : 0;
    return { total, available, rented, occupancyRate, availabilityRate };
  }, [statsBillboards]);

  const financeMetrics = useMemo(() => {
    const expectedRevenue = legacyContracts.reduce((acc, c) => acc + (Number(c['Total']) || 0), 0);
    const collected = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const overdue = Math.max(0, expectedRevenue - collected);
    const activeCount = legacyContracts.filter(c => {
      if (!c['End Date']) return false;
      try {
        const endDate = new Date(c['End Date']);
        return endDate >= new Date();
      } catch {
        return false;
      }
    }).length;
    return { expectedRevenue, collected, overdue, activeCount };
  }, [legacyContracts, payments]);

  const taskSummaryMetrics = useMemo(() => {
    const installPending = installationTasks.filter(t => t.status === 'pending' || !t.status).length;
    const installActive = installationTasks.filter(t => t.status === 'in_progress').length;
    const installDone = installationTasks.filter(t => t.status === 'completed').length;

    const removalPending = removalTasks.filter(t => t.status === 'pending' || !t.status).length;
    const removalActive = removalTasks.filter(t => t.status === 'in_progress').length;
    const removalDone = removalTasks.filter(t => t.status === 'completed').length;

    const totalInstall = installationTasks.length;
    const totalRemoval = removalTasks.length;

    const installProgressPct = totalInstall > 0 ? Math.round((installDone / totalInstall) * 100) : 0;
    const removalProgressPct = totalRemoval > 0 ? Math.round((removalDone / totalRemoval) * 100) : 0;

    return {
      installPending, installActive, installDone,
      removalPending, removalActive, removalDone,
      installProgressPct, removalProgressPct,
      overdueCount: overdueTasks.length
    };
  }, [installationTasks, removalTasks, overdueTasks]);

  const billboardOccupancyData = useMemo(() => {
    const available = statsBillboards.filter(b => isBillboardAvailable(b)).length;
    const rented = statsBillboards.length - available;
    return [
      { name: 'لوحات متاحة', value: available, color: '#22c55e' },
      { name: 'لوحات مؤجرة', value: rented, color: '#2D6BFF' }
    ];
  }, [statsBillboards]);

  const municipalityDistributionData = useMemo(() => {
    const muniCounts: { [key: string]: number } = {};
    statsBillboards.forEach(b => {
      if (b.Municipality) {
        muniCounts[b.Municipality] = (muniCounts[b.Municipality] || 0) + 1;
      }
    });
    return Object.entries(muniCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [statsBillboards]);

  // --- 📉 Sparklines Mock data calculations for KPI Cards ---
  const salesSparklineData = useMemo(() => {
    const data = [10, 15, 8, 22, activeContracts];
    return data.map((val, idx) => ({ id: idx, value: val }));
  }, [activeContracts]);

  const endedSparklineData = useMemo(() => {
    const data = [1, 5, 2, 4, recentlyEndedContracts.length];
    return data.map((val, idx) => ({ id: idx, value: val }));
  }, [recentlyEndedContracts]);

  const paymentsSparklineData = useMemo(() => {
    const last5 = [...payments].slice(0, 5).reverse();
    if (last5.length === 0) return [{ id: 0, value: 5 }, { id: 1, value: 12 }, { id: 2, value: 9 }];
    return last5.map((p, idx) => ({ id: idx, value: Number(p.amount) || 0 }));
  }, [payments]);

  const billboardsSparklineData = useMemo(() => {
    const total = statsBillboards.length;
    const data = [total - 15, total - 8, total - 3, total];
    return data.map((val, idx) => ({ id: idx, value: val }));
  }, [statsBillboards]);

  const advancedStats = useMemo(() => {
    const municipalityRevenue: Record<string, number> = {};
    const sizeRevenue: Record<string, number> = {};
    
    const municipalityCounts: Record<string, { total: number; rented: number; available: number }> = {};
    const sizeCounts: Record<string, { total: number; rented: number; available: number }> = {};
    const customerRevenue: Record<string, { revenue: number; totalContracts: number; activeContracts: number }> = {};

    // 1. Initialize counts from statsBillboards (excludes friendly, removed, hidden, and societ/debus size)
    statsBillboards.forEach(b => {
      const muni = b.Municipality || 'غير محدد';
      const size = b.Size || 'غير محدد';
      const isAvailable = isBillboardAvailable(b);

      if (!municipalityCounts[muni]) {
        municipalityCounts[muni] = { total: 0, rented: 0, available: 0 };
      }
      municipalityCounts[muni].total += 1;
      if (isAvailable) {
        municipalityCounts[muni].available += 1;
      } else {
        municipalityCounts[muni].rented += 1;
      }

      if (!sizeCounts[size]) {
        sizeCounts[size] = { total: 0, rented: 0, available: 0 };
      }
      sizeCounts[size].total += 1;
      if (isAvailable) {
        sizeCounts[size].available += 1;
      } else {
        sizeCounts[size].rented += 1;
      }
    });

    // 2. Map of billboard ID -> billboard object for easy lookup
    const billboardMap: Record<number, any> = {};
    allBillboards.forEach(b => { billboardMap[Number(b.ID)] = b; });

    // Helper to check if contract is active
    const isContractActiveLocal = (endDateStr: string | null) => {
      if (!endDateStr) return true; // Assume active if no end date
      try {
        const end = new Date(endDateStr);
        const today = new Date();
        end.setHours(23, 59, 59, 999);
        today.setHours(0, 0, 0, 0);
        return end >= today;
      } catch {
        return false;
      }
    };

    // 3. Process contracts to distribute revenue and count customers
    legacyContracts.forEach(c => {
      const totalRevenue = Number(c.Total) || 0;
      const totalRent = Number(c['Total Rent']) || 0;
      const customerName = c['Customer Name'] || 'عميل غير معروف';
      const isActive = isContractActiveLocal(c['End Date']);

      // Customer stats
      if (!customerRevenue[customerName]) {
        customerRevenue[customerName] = { revenue: 0, totalContracts: 0, activeContracts: 0 };
      }
      customerRevenue[customerName].revenue += totalRevenue;
      customerRevenue[customerName].totalContracts += 1;
      if (isActive) {
        customerRevenue[customerName].activeContracts += 1;
      }

      // Distribute revenue to municipalities and sizes
      let distributed = false;
      if (c.billboard_prices) {
        try {
          const prices = typeof c.billboard_prices === 'string' ? JSON.parse(c.billboard_prices) : c.billboard_prices;
          if (Array.isArray(prices) && prices.length > 0) {
            prices.forEach((p: any) => {
              const bbId = Number(p.billboardId);
              const bbPrice = Number(p.contractPrice || p.priceAfterDiscount || p.totalBillboardPrice || 0);
              const bb = billboardMap[bbId];
              
              if (bb) {
                // Check if bb is a stats billboard
                const size = String(bb.Size || '').trim().toLowerCase();
                const isSociet = size === 'سوسيت' || size === '2.5x4' || size === '2.5x4 ' || size.includes('سوسيت') || size.includes('دي باس') || size.includes('دي باص') || size.includes('debus') || size.includes('de-bus');
                const isRemoved = isBillboardRemoved(bb);
                const isHidden = bb.is_visible_in_available === false;
                
                if (!isRemoved && !isHidden && !isSociet && !bb.friend_company_id) {
                  const muni = bb.Municipality || 'غير محدد';
                  const bbSize = bb.Size || 'غير محدد';

                  municipalityRevenue[muni] = (municipalityRevenue[muni] || 0) + bbPrice;
                  sizeRevenue[bbSize] = (sizeRevenue[bbSize] || 0) + bbPrice;
                  distributed = true;
                }
              }
            });
          }
        } catch (e) {
          console.warn('Error parsing billboard prices in advancedStats:', e);
        }
      }

      // Fallback: split contract's Total Rent equally
      if (!distributed && c.Contract_Number) {
        const associatedBillboards = allBillboards.filter(b => Number(b.Contract_Number) === Number(c.Contract_Number));
        if (associatedBillboards.length > 0) {
          const share = totalRent / associatedBillboards.length;
          associatedBillboards.forEach(bb => {
            const size = String(bb.Size || '').trim().toLowerCase();
            const isSociet = size === 'سوسيت' || size === '2.5x4' || size === '2.5x4 ' || size.includes('سوسيت') || size.includes('دي باس') || size.includes('دي باص') || size.includes('debus') || size.includes('de-bus');
            const isRemoved = isBillboardRemoved(bb);
            const isHidden = bb.is_visible_in_available === false;

            if (!isRemoved && !isHidden && !isSociet && !bb.friend_company_id) {
              const muni = bb.Municipality || 'غير محدد';
              const bbSize = bb.Size || 'غير محدد';

              municipalityRevenue[muni] = (municipalityRevenue[muni] || 0) + share;
              sizeRevenue[bbSize] = (sizeRevenue[bbSize] || 0) + share;
            }
          });
        }
      }
    });

    return {
      municipalityRevenue,
      sizeRevenue,
      municipalityCounts,
      sizeCounts,
      customerRevenue
    };
  }, [statsBillboards, allBillboards, legacyContracts, isBillboardRemoved, isDeBusSociet]);

  // --- 🔍 Tasks Tab search filtering ---
  const filteredInstallTasks = useMemo(() => {
    return installationTasks.filter(t => {
      const matchesSearch = 
        t.customer_name?.toLowerCase().includes(taskSearch.toLowerCase()) ||
        t.contract_id?.toString().includes(taskSearch) ||
        t.ad_type?.toLowerCase().includes(taskSearch.toLowerCase());
      const matchesStatus = taskStatusFilter === 'all' || t.status === taskStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [installationTasks, taskSearch, taskStatusFilter]);

  const filteredRemovalTasks = useMemo(() => {
return removalTasks.filter(t => {
      const matchesSearch = 
        t.customer_name?.toLowerCase().includes(taskSearch.toLowerCase()) ||
        t.contract_id?.toString().includes(taskSearch) ||
        t.ad_type?.toLowerCase().includes(taskSearch.toLowerCase());
      const matchesStatus = taskStatusFilter === 'all' || t.status === taskStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [removalTasks, taskSearch, taskStatusFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-primary/20 rounded-full animate-spin border-t-primary mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Activity className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </div>
          <p className="text-foreground font-semibold text-lg">جاري تحميل لوحة التحكم...</p>
          <p className="text-muted-foreground text-sm font-numbers">يتم تحميل الإحصائيات والبيانات</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-8 p-2.5 sm:p-4 md:p-6 pb-20 bg-background/95 min-h-screen relative overflow-hidden" dir="rtl">
      
      {/* Background neon radial glows for rich aesthetics */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[400px] bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute top-[30%] left-[-10%] w-[55%] h-[500px] bg-gradient-to-tr from-blue-500/5 via-indigo-500/5 to-transparent blur-[140px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-0 right-[20%] w-[60%] h-[400px] bg-gradient-to-tr from-emerald-500/5 via-teal-500/5 to-transparent blur-[130px] rounded-full pointer-events-none z-0" />

      {/* Futuristic Glassmorphic Welcome Hero & Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 dark:border-white/5 bg-gradient-to-br from-card/80 via-card/50 to-card/30 backdrop-blur-xl p-3.5 sm:p-6 md:p-8 shadow-xl"
      >
        {/* Subtle grid pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4.5 min-w-0">
            <div className="shrink-0 w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-[0_8px_25px_rgba(218,165,32,0.3)]">
              <LayoutDashboard className="h-5 w-5 sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0 space-y-1">
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20">
                <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-500 animate-pulse" />
                <span>منصة الإدارة الذكية المتكاملة</span>
              </span>
              <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-foreground leading-none flex flex-wrap items-center gap-2">
                <span>{getGreeting()}</span>
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground max-w-xl font-medium">
                {format(currentTime, 'EEEE، dd MMMM yyyy', { locale: ar })}
              </p>
            </div>
          </div>

          {/* Clock & Action button row */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 shrink-0">
            {/* Live digital ticking clock widget */}
            <div className="bg-card/90 dark:bg-slate-900/90 border border-border/80 dark:border-amber-500/20 px-2.5 sm:px-4 py-1 sm:py-2 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2 sm:gap-3">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
              <span className="font-mono text-xs sm:text-base font-bold text-amber-500 tracking-wider font-numbers">
                {format(currentTime, 'hh:mm:ss a')}
              </span>
            </div>

            <Button 
              onClick={loadData} 
              variant="outline" 
              size="sm" 
              className="gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border-white/10 hover:border-primary/20 bg-background/50 hover:bg-primary/5 hover-lift h-8 sm:h-10 px-2.5 sm:px-4"
            >
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary animate-spin-slow" />
              <span className="text-[11px] sm:text-xs font-bold">تحديث البيانات</span>
            </Button>
          </div>
        </div>

        {/* Hero stat badges container */}
        <div className="relative mt-4 sm:mt-8 flex flex-wrap gap-2 sm:gap-3.5 border-t border-border/40 pt-3 sm:pt-5">
          <StatBadge label="العقود" value={legacyContracts.length} variant="primary" icon={<FileText className="h-3.5 w-3.5" />} />
          <StatBadge label="نشط" value={activeContracts} variant="success" />
          <StatBadge label="منتهية" value={recentlyEndedContracts.length} variant="danger" />
          <StatBadge label="اللوحات" value={statsBillboards.length} variant="default" icon={<Layers className="h-3.5 w-3.5" />} />
          <StatBadge label="التحصيلات" value={`${totalPaymentsAmount.toLocaleString('ar-LY')} د.ل`} variant="success" icon={<CircleDollarSign className="h-3.5 w-3.5" />} />
        </div>
      </motion.div>

      {/* Tabs Layout section */}
      <Tabs defaultValue="overview" className="w-full relative z-10 space-y-4 sm:space-y-6">
        
        {/* Navigation list for Tabs redesigned to look like glass pills */}
        <TabsList className="w-full grid grid-cols-2 md:flex md:w-fit gap-1 sm:gap-1.5 bg-card/40 border border-border/40 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl backdrop-blur-md shadow-lg">
          <TabsTrigger 
            value="overview" 
            className="gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_20px_rgba(218,165,32,0.35)]"
          >
            <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span>نظرة عامة</span>
          </TabsTrigger>
          <TabsTrigger 
            value="finance" 
            className="gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_20px_rgba(218,165,32,0.35)]"
          >
            <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span>العقود والمالية</span>
          </TabsTrigger>
          <TabsTrigger 
            value="tasks" 
            className="gap-2 px-6 py-3 rounded-xl text-xs md:text-sm font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_20px_rgba(218,165,32,0.35)]"
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span>العمليات والمهام</span>
          </TabsTrigger>
          <TabsTrigger 
            value="billboards" 
            className="gap-2 px-6 py-3 rounded-xl text-xs md:text-sm font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_20px_rgba(218,165,32,0.35)]"
          >
            <Monitor className="h-4 w-4 shrink-0" />
            <span>تحليلات اللوحات</span>
          </TabsTrigger>
          <TabsTrigger 
            value="advanced-stats" 
            className="gap-2 px-6 py-3 rounded-xl text-xs md:text-sm font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_20px_rgba(218,165,32,0.35)]"
          >
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span>إحصائيات تفصيلية</span>
          </TabsTrigger>
        </TabsList>

        {/* ---------------- 1. Overview Tab Content ---------------- */}
        <TabsContent value="overview" className="outline-none focus:outline-none space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Elegant KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                title="العقود النشطة الجارية"
                value={activeContracts}
                subtitle={`من إجمالي ${legacyContracts.length} عقداً نشطاً`}
                icon={<FileText className="h-5 w-5" />}
                color="blue"
                sparklineData={salesSparklineData}
                onClick={() => navigate('/admin/contracts')}
              />
              <StatCard
                title="عقود منتهية للمتابعة"
                value={recentlyEndedContracts.length}
                subtitle="تحتاج متابعة فوريّة للتجديد"
                icon={<AlertTriangle className="h-5 w-5 animate-pulse" />}
                color="red"
                sparklineData={endedSparklineData}
                onClick={() => navigate('/admin/contracts')}
              />
              <StatCard
                title="مجموع الإيرادات المحصلة"
                value={totalPaymentsAmount}
                subtitle={`${payments.length} عملية سداد مؤكدة بالخزينة`}
                icon={<CircleDollarSign className="h-5 w-5" />}
                color="green"
                sparklineData={paymentsSparklineData}
                suffix=" د.ل"
                onClick={() => navigate('/admin/payments-receipts-page')}
              />
              <StatCard
                title="إجمالي شبكة اللوحات"
                value={statsBillboards.length}
                subtitle={`${statsBillboards.length} لوحة نشطة (بدون الصديقة، المزالة، المخفية، والسوسيت)`}
                icon={<Layers className="h-5 w-5" />}
                color="purple"
                sparklineData={billboardsSparklineData}
                onClick={() => navigate('/admin/billboards')}
              />
            </div>

            {/* Quick Actions Panel */}
            <Card className="border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
              <CardHeader className="py-4.5 px-6 border-b border-border/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2.5">
                  <Zap className="h-5 w-5 text-primary animate-pulse" />
                  <span>الإجراءات الإدارية والتشغيلية السريعة</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5">
                  <QuickActionButton icon={<Plus className="h-4 w-4" />} label="إضافة عقد" onClick={() => navigate('/admin/contracts/new')} variant="primary" />
                  <QuickActionButton icon={<FileText className="h-4 w-4" />} label="العقود" onClick={() => navigate('/admin/contracts')} variant="outline" />
                  <QuickActionButton icon={<Users className="h-4 w-4" />} label="العملاء" onClick={() => navigate('/admin/customers')} variant="outline" />
                  <QuickActionButton icon={<Monitor className="h-4 w-4" />} label="اللوحات" onClick={() => navigate('/admin/billboards')} variant="outline" />
                  <QuickActionButton icon={<Wallet className="h-4 w-4" />} label="المدفوعات" onClick={() => navigate('/admin/payments-receipts-page')} variant="outline" />
                  <QuickActionButton icon={<BarChart3 className="h-4 w-4" />} label="التقارير" onClick={() => navigate('/admin/reports')} variant="outline" />
                  <QuickActionButton icon={<ClipboardList className="h-4 w-4" />} label="المهام المجمعة" onClick={() => navigate('/admin/composite-tasks')} variant="outline" />
                  <QuickActionButton icon={<BookOpen className="h-4 w-4" />} label="طلبات الحجز" onClick={() => navigate('/admin/booking-requests')} variant="outline" />
                </div>
              </CardContent>
            </Card>

            {/* Interactive Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Financial trend Line/Area chart (Col span 8) */}
              <Card className="lg:col-span-8 border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-border/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span>منحنى التدفق المالي وحجم المبيعات</span>
                  </CardTitle>
                  
                  {/* Period Switcher Segment Control */}
                  <div className="flex bg-muted/50 p-1 rounded-xl border border-border/30 text-[10px] font-bold">
                    {(['monthly', 'quarterly', 'semi-annual', 'annual'] as const).map((period) => (
                      <button
                        key={period}
                        onClick={() => setChartPeriod(period)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-lg transition-all text-xs font-semibold",
                          chartPeriod === period 
                            ? "bg-primary text-primary-foreground shadow-md" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {period === 'monthly' ? 'شهري' : period === 'quarterly' ? 'ربع سنوي' : period === 'semi-annual' ? 'نصف سنوي' : 'سنوي'}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {/* Averages Row */}
                  <div className="flex flex-wrap gap-4 mb-4 bg-slate-500/5 dark:bg-white/5 border border-border/20 rounded-2xl p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#DAA520]" />
                      <span className="text-xs text-muted-foreground font-semibold">متوسط المبيعات الشهري:</span>
                      <span className="text-xs font-black text-foreground font-numbers">
                        {averages.salesAverage.toLocaleString('ar-LY')} د.ل
                      </span>
                    </div>
                    <div className="h-4 w-[1px] bg-border/60 self-center hidden sm:block" />
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                      <span className="text-xs text-muted-foreground font-semibold">متوسط التحصيل الشهري:</span>
                      <span className="text-xs font-black text-foreground font-numbers">
                        {averages.paymentsAverage.toLocaleString('ar-LY')} د.ل
                      </span>
                    </div>
                  </div>

                  <div className="h-[290px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={financialTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorSalesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#DAA520" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#DAA520" stopOpacity={0.01}/>
                          </linearGradient>
                          <linearGradient id="colorPaymentsGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#88888812" />
                        <XAxis dataKey="label" stroke="#88888850" fontSize={10} tickLine={false} />
                        <YAxis stroke="#88888850" fontSize={10} tickLine={false} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                        <Area name="المبيعات والعقود (د.ل)" type="monotone" dataKey="sales" stroke="#DAA520" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSalesGrad)" />
                        <Area name="المدفوعات والتحصيلات (د.ل)" type="monotone" dataKey="payments" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPaymentsGrad)" />
                        <ReferenceLine 
                          y={averages.chartSalesAverage} 
                          stroke="#DAA520" 
                          strokeDasharray="4 4" 
                          strokeWidth={1.5}
                          label={{ 
                            value: `${averageLabels.sales} (${averages.chartSalesAverage.toLocaleString('ar-LY')} د.ل)`, 
                            fill: '#DAA520', 
                            position: 'insideBottomLeft',
                            fontSize: 9,
                            fontWeight: 'bold'
                          }} 
                        />
                        <ReferenceLine 
                          y={averages.chartPaymentsAverage} 
                          stroke="#10b981" 
                          strokeDasharray="4 4" 
                          strokeWidth={1.5}
                          label={{ 
                            value: `${averageLabels.payments} (${averages.chartPaymentsAverage.toLocaleString('ar-LY')} د.ل)`, 
                            fill: '#10b981', 
                            position: 'insideTopLeft',
                            fontSize: 9,
                            fontWeight: 'bold'
                          }} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Billboard Availability Radial circular indicator card */}
              <Card className="lg:col-span-4 border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-border/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-primary" />
                    <span>مؤشر توفر وحجوزات الشبكة</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 flex flex-col justify-between items-center min-h-[290px]">
                  
                  {/* Glowing circular gauge progress */}
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {/* Base circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        className="stroke-muted dark:stroke-muted/10"
                        strokeWidth="6"
                        fill="transparent"
                      />
                      {/* Glow path */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#10b981"
                        strokeWidth="7"
                        fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - availabilityStats.availabilityRate / 100)}`}
                        strokeLinecap="round"
                        className="opacity-20 blur-[4px]"
                      />
                      {/* Active green circle path */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="url(#availabilityGlowGrad)"
                        strokeWidth="6.5"
                        fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - availabilityStats.availabilityRate / 100)}`}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                      <defs>
                        <linearGradient id="availabilityGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                      </defs>
                    </svg>
                    
                    {/* Centered availability metric label */}
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-black font-numbers tracking-tight text-emerald-600 dark:text-emerald-400 drop-shadow-sm leading-none">
                        {availabilityStats.availabilityRate}%
                      </span>
                      <span className="text-[9px] text-muted-foreground font-bold mt-1.5">شاغر للحجز</span>
                    </div>
                  </div>

                  {/* Status pills/cards breakdown */}
                  <div className="w-full grid grid-cols-3 gap-2 mt-4">
                    <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 rounded-2xl p-2 text-center transition-all hover:bg-emerald-500/10 hover-lift">
                      <div className="flex items-center justify-center gap-1 text-[8.5px] text-emerald-600 dark:text-emerald-400 font-black mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                        <span>متاح</span>
                      </div>
                      <p className="text-sm font-black font-numbers text-emerald-600 dark:text-emerald-400 leading-none">{availabilityStats.available}</p>
                      <p className="text-[8px] text-muted-foreground mt-1">لوحة شاغرة</p>
                    </div>

                    <div className="bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/15 rounded-2xl p-2 text-center transition-all hover:bg-rose-500/10 hover-lift">
                      <div className="flex items-center justify-center gap-1 text-[8.5px] text-rose-600 dark:text-rose-400 font-black mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span>مؤجر</span>
                      </div>
                      <p className="text-sm font-black font-numbers text-rose-600 dark:text-rose-400 leading-none">{availabilityStats.rented}</p>
                      <p className="text-[8px] text-muted-foreground mt-1">عقود سارية</p>
                    </div>

                    <div className="bg-primary/5 dark:bg-primary/10 border border-primary/15 rounded-2xl p-2 text-center transition-all hover:bg-primary/10 hover-lift">
                      <div className="flex items-center justify-center gap-1 text-[8.5px] text-primary font-black mb-1">
                        <span>الإجمالي</span>
                      </div>
                      <p className="text-sm font-black font-numbers text-primary leading-none">{availabilityStats.total}</p>
                      <p className="text-[8px] text-muted-foreground mt-1">لوحة شبكة</p>
                    </div>
                  </div>

                </CardContent>
              </Card>

            </div>

            {/* Overdue Alerts section (Collapsible) */}
            <Collapsible open={alertsOpen} onOpenChange={setAlertsOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between gap-2 border-amber-500/20 text-amber-600 dark:text-amber-500 bg-amber-500/5 hover:bg-amber-500/10 transition-all rounded-2xl shadow-soft py-6"
                >
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-amber-500 animate-bounce" />
                    <span className="font-bold text-sm">التنبيهات والمتابعات التلقائية والميدانية</span>
                  </div>
                  {alertsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-5 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <OverduePaymentsAlert />
                  <OverdueInvoicesAlert />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <OverdueCompositeTasksAlert />
                  <RecentActivityLog />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </motion.div>
        </TabsContent>

        {/* ---------------- 2. Finance Tab Content ---------------- */}
        <TabsContent value="finance" className="outline-none focus:outline-none space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/20 pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">لوحة الرقابة والمطابقات المالية</h2>
                <p className="text-xs text-muted-foreground">تتبع مستحقاتك، التحصيل الفعلي، الذمم المالية وأجندة الأقساط المستحقة والنشطة</p>
              </div>
            </div>

            {/* Financial Overview Sub-cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-gradient-to-br from-emerald-500/8 to-emerald-500/1 border border-emerald-500/15 hover:border-emerald-500/35 hover:shadow-emerald-500/5 hover:shadow-lg transition-all duration-300 p-5 rounded-2xl hover-lift">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground">التحصيل الفعلي</p>
                    <h3 className="text-xl font-black font-numbers text-emerald-600 dark:text-emerald-400 leading-none">
                      {financeMetrics.collected.toLocaleString('ar-LY')} <span className="text-[10px] font-normal">د.ل</span>
                    </h3>
                  </div>
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 shrink-0">
                    <Receipt className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground mt-3 font-semibold">مجموع الإيصالات المؤكدة</p>
              </div>

              <div className="bg-gradient-to-br from-rose-500/8 to-rose-500/1 border border-rose-500/15 hover:border-rose-500/35 hover:shadow-rose-500/5 hover:shadow-lg transition-all duration-300 p-5 rounded-2xl hover-lift">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground">الذمم المدينة والأقساط</p>
                    <h3 className="text-xl font-black font-numbers text-rose-600 dark:text-rose-400 leading-none">
                      {financeMetrics.overdue.toLocaleString('ar-LY')} <span className="text-[10px] font-normal">د.ل</span>
                    </h3>
                  </div>
                  <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-500 shrink-0">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground mt-3 font-semibold">ذمم مالية غير مستردة</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500/8 to-blue-500/1 border border-blue-500/15 hover:border-blue-500/35 hover:shadow-blue-500/5 hover:shadow-lg transition-all duration-300 p-5 rounded-2xl hover-lift">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground">الإيراد التعاقدي المتوقع</p>
                    <h3 className="text-xl font-black font-numbers text-blue-600 dark:text-blue-400 leading-none">
                      {financeMetrics.expectedRevenue.toLocaleString('ar-LY')} <span className="text-[10px] font-normal">د.ل</span>
                    </h3>
                  </div>
                  <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500 shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground mt-3 font-semibold">مجموع قيمة العقود المبرمة</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/8 to-purple-500/1 border border-purple-500/15 hover:border-purple-500/35 hover:shadow-purple-500/5 hover:shadow-lg transition-all duration-300 p-5 rounded-2xl hover-lift">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground">العقود النشطة جارية</p>
                    <h3 className="text-xl font-black font-numbers text-purple-600 dark:text-purple-400 leading-none">
                      {financeMetrics.activeCount} <span className="text-[10px] font-normal">عقد</span>
                    </h3>
                  </div>
                  <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-500 shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground mt-3 font-semibold">عقود مستمرة تحت الإدارة</p>
              </div>
            </div>

            {/* Overdue Payments, Expiring and Ended Contracts grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Ended Contracts */}
              <Card className="border-rose-500/25 bg-rose-500/[0.02] backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="pb-3 pt-4 px-5 border-b border-border/20 bg-rose-500/[0.02]">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold text-rose-600 dark:text-rose-400">
                      <div className="p-2 bg-rose-500/10 rounded-xl">
                        <XCircle className="h-4 w-4 text-rose-500" />
                      </div>
                      <span>عقود منتهية الصلاحية</span>
                      <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 font-numbers font-bold text-xs px-2 py-0.5 rounded-full">
                        {recentlyEndedContracts.length}
                      </Badge>
                    </CardTitle>
                    <Link to="/admin/contracts">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground h-8.5 hover:bg-muted/80 rounded-xl">
                        <span>إدارة العقود</span> 
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {recentlyEndedContracts.length === 0 ? (
                    <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />} message="لا توجد عقود منتهية تحتاج لمتابعة" color="green" />
                  ) : (
                    <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                      {recentlyEndedContracts.map((contract) => (
                        <div
                          key={contract.id}
                          className="flex flex-col gap-3.5 p-4 rounded-2xl bg-card/40 hover:bg-rose-500/5 transition-all border border-border/40 hover:border-rose-500/20 hover-lift"
                        >
                          <div className="flex items-center justify-between min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/admin/contracts/view/${contract.contract_number}`)}>
                              <Badge variant="outline" className="font-mono font-numbers text-[9.5px] shrink-0 border-rose-500/20 text-rose-600 bg-rose-500/5 rounded-full font-bold px-2 py-0.5">#{contract.contract_number} - {contract.ad_type}</Badge>
                              <div className="min-w-0 space-y-0.5">
                                <p className="text-xs font-bold truncate text-foreground">{contract.customer_name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{contract.ad_type}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className="text-[9px] font-numbers gap-1 py-0.5 px-2 bg-rose-500/10 text-rose-600 border border-rose-500/20 rounded-full font-bold">
                                <Clock className="h-3 w-3 text-rose-500 shrink-0" /> منتهٍ منذ {contract.days_ago} يوم
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10 rounded-full border border-emerald-500/20 hover:scale-105"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openWhatsAppDialog(
                                    contract.phone,
                                    `مرحباً ${contract.customer_name}،\n\nنود إعلامكم بأن عقدكم رقم ${contract.contract_number} قد انتهى بتاريخ ${contract.end_date}.\nيرجى التواصل معنا لتجديد العقد وتأمين حجز اللوحات.\n\nشكراً لتعاملكم معنا.`,
                                    `تنبيه انتهاء عقد #${contract.contract_number}`,
                                    contract.customer_id,
                                    {
                                      customerName: contract.customer_name,
                                      contractNumber: contract.contract_number,
                                      endDate: contract.end_date,
                                      amount: contract.total_amount?.toString() || ''
                                    }
                                  );
                                }}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {/* Progress bar timeline (expired) */}
                          <div className="w-full">
                            <div className="w-full bg-rose-500/10 rounded-full h-1">
                              <div className="bg-rose-500 h-1 rounded-full animate-pulse" style={{ width: '100%' }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expiring Contracts */}
              <Card className="border-amber-500/25 bg-amber-500/[0.02] backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="pb-3 pt-4 px-5 border-b border-border/20 bg-amber-500/[0.02]">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold text-amber-600 dark:text-amber-500">
                      <div className="p-2 bg-amber-500/10 rounded-xl">
                        <Timer className="h-4 w-4 text-amber-500 animate-pulse" />
                      </div>
                      <span>عقود تنتهي قريباً (أجندة تجديد)</span>
                      <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 font-numbers font-bold text-xs px-2 py-0.5 rounded-full">
                        {expiringContracts.length}
                      </Badge>
                    </CardTitle>
                    <Link to="/admin/contracts">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground h-8.5 hover:bg-muted/80 rounded-xl">
                        <span>إدارة العقود</span> 
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {expiringContracts.length === 0 ? (
                    <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />} message="لا توجد عقود تنتهي قريباً" color="green" />
                  ) : (
                    <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                      {expiringContracts.map((contract) => {
                        const daysLeft = getDaysLeft(contract.end_date);
                        // Contract duration timeline percentage
                        let pct = 100;
                        if (contract.start_date && contract.end_date) {
                          try {
                            const start = new Date(contract.start_date).getTime();
                            const end = new Date(contract.end_date).getTime();
                            const now = new Date().getTime();
                            if (end > start) {
                              pct = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
                            }
                          } catch (e) {}
                        }
                        return (
                          <div
                            key={contract.id}
                            className="flex flex-col gap-3.5 p-4 rounded-2xl bg-card/40 hover:bg-amber-500/5 transition-all border border-border/40 hover:border-amber-500/20 hover-lift"
                          >
                            <div className="flex items-center justify-between min-w-0">
                              <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/admin/contracts/view/${contract.contract_number}`)}>
                                <Badge variant="outline" className="font-mono font-numbers text-[9.5px] shrink-0 border-amber-500/20 text-amber-600 bg-amber-500/5 rounded-full font-bold px-2 py-0.5">#{contract.contract_number} - {contract.ad_type}</Badge>
                                <div className="min-w-0 space-y-0.5">
                                  <p className="text-xs font-bold truncate text-foreground">{contract.customer_name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{contract.ad_type}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge className={cn("text-[9px] font-numbers py-0.5 px-2 rounded-full border font-bold",
                                  daysLeft <= 3 ? 'bg-rose-500/10 text-rose-600 border-rose-500/20 animate-pulse' :
                                  daysLeft <= 7 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                  'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                )}>
                                  {daysLeft === 0 ? 'اليوم' : `متبقي ${daysLeft} يوم`}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10 rounded-full border border-emerald-500/20 hover:scale-105"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWhatsAppDialog(
                                      contract.phone,
                                      `مرحباً ${contract.customer_name}،\n\nنود تذكيركم بأن عقدكم رقم ${contract.contract_number} ينتهي قريباً بتاريخ ${contract.end_date} (متبقي ${daysLeft} أيام).\nيرجى التواصل معنا لتجديد الحجز وتثبيت اللوحات.\n\nشكراً لكم.`,
                                      `تنبيه قرب انتهاء عقد #${contract.contract_number}`,
                                      contract.customer_id,
                                      {
                                        customerName: contract.customer_name,
                                        contractNumber: contract.contract_number,
                                        endDate: contract.end_date,
                                        amount: contract.total_amount?.toString() || ''
                                      }
                                    );
                                  }}
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {/* Visual Timeline bar */}
                            <div className="w-full">
                              <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1.5 font-semibold">
                                <span>تاريخ البدء</span>
                                <span className="font-numbers text-primary">{pct}% من مدة العقد</span>
                                <span>تاريخ الانتهاء</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={cn("h-1.5 rounded-full transition-all duration-500",
                                    pct >= 90 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-primary"
                                  )} 
                                  style={{ width: `${pct}%` }} 
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Upcoming Installments */}
            {upcomingInstallments.length > 0 && (
              <Card className="border-emerald-500/25 bg-emerald-500/[0.02] backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="pb-3 pt-4 px-5 border-b border-border/20 bg-emerald-500/[0.02]">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      <div className="p-2 bg-emerald-500/10 rounded-xl">
                        <CreditCard className="h-4 w-4 text-emerald-500 animate-pulse" />
                      </div>
                      <span>أجندة الأقساط والدفعات المستحقة قريباً (خلال 30 يوماً)</span>
                      <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-numbers font-bold text-xs px-2 py-0.5 rounded-full">
                        {upcomingInstallments.length} قسط
                      </Badge>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {upcomingInstallments.map((inst) => (
                      <div 
                        key={inst.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-card/40 border border-border/40 hover:border-emerald-500/25 hover:shadow-md hover-lift"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
                            <Receipt className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-xs text-foreground truncate">{inst.customerName}</p>
                              <Badge variant="outline" className="font-numbers text-[8px] py-0 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">عقد #{inst.contractNumber} - {inst.adType}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-numbers">قسط رقم {inst.installmentIndex} | مستحق: {formatDateSafe(inst.dueDate)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-xs font-black font-numbers text-emerald-600 dark:text-emerald-400">
                              +{inst.amount.toLocaleString('ar-LY')} <span className="text-[9px] font-normal">د.ل</span>
                            </p>
                            <Badge className="text-[8px] font-numbers mt-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              متبقي {inst.daysLeft} يوم
                            </Badge>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10 rounded-full border border-emerald-500/20"
                            onClick={() => {
                              openWhatsAppDialog(
                                inst.phone,
                                `مرحباً ${inst.customerName}،\n\nنود تذكيركم بأن القسط رقم ${inst.installmentIndex} بمبلغ ${Number(inst.amount).toLocaleString('ar-LY')} د.ل مستحق بتاريخ ${formatDateSafe(inst.dueDate)}.\nيرجى السداد في الموعد المحدد.\n\nشكراً لكم.`,
                                `تذكير بسداد قسط عقد #${inst.contractNumber}`,
                                inst.customerId,
                                {
                                  customerName: inst.customerName,
                                  contractNumber: inst.contractNumber.toString(),
                                  amount: inst.amount.toString(),
                                  dueDate: formatDateSafe(inst.dueDate),
                                  installmentIndex: inst.installmentIndex.toString()
                                }
                              );
                            }}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Payments & Contracts Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Recent Contracts */}
              <Card className="border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="pb-3.5 pt-4.5 px-5 border-b border-border/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <div className="p-2 bg-primary/10 rounded-xl">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <span>آخر العقود والاتفاقيات المبرمة</span>
                    </CardTitle>
                    <Link to="/admin/contracts">
                      <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary hover:bg-primary/10 h-8 rounded-xl">
                        <span>إدارة الكل</span> <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-3.5">
                    {recentContracts.map((contract) => (
                      <div 
                        key={contract.id} 
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-card/45 border border-border/40 hover-lift cursor-pointer"
                        onClick={() => navigate(`/admin/contracts/view/${contract.contract_number}`)}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                            <Plus className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-xs truncate text-foreground">{contract.customer_name}</p>
                              <Badge className="font-mono font-numbers text-[8px] bg-primary/5 text-primary border border-primary/20 px-1 py-0 rounded">#{contract.contract_number} - {contract.ad_type}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-numbers">{formatDateSafe(contract.created_at)} | {contract.ad_type}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black font-numbers text-primary">
                            {contract.total_amount.toLocaleString('ar-LY')} <span className="text-[9px] font-normal">د.ل</span>
                          </p>
                          <p className="text-[9px] text-muted-foreground font-numbers mt-0.5">{contract.billboards_count} لوحة</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Payments */}
              <Card className="border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="pb-3.5 pt-4.5 px-5 border-b border-border/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <div className="p-2 bg-emerald-500/10 rounded-xl">
                        <Receipt className="h-4 w-4 text-emerald-500" />
                      </div>
                      <span>آخر المقبوضات وتأكيدات الخزينة</span>
                    </CardTitle>
                    <Link to="/admin/payments-receipts-page">
                      <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary hover:bg-primary/10 h-8 rounded-xl">
                        <span>الدفتر المالي</span> <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {recentPayments.map((payment) => (
                      <div 
                        key={payment.id} 
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-card/45 border border-border/40 hover-lift"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 shrink-0">
                            <Receipt className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs truncate text-foreground">{payment.customer_name || 'عميل غير محدد'}</p>
                            <p className="text-[9px] text-muted-foreground font-numbers">{formatDateSafe(payment.paid_at)}</p>
                          </div>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono font-numbers text-[10px] py-1 px-2.5 rounded-full font-bold shrink-0">
                          +{payment.amount.toLocaleString('ar-LY')} د.ل
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>

          </motion.div>
        </TabsContent>

        {/* ---------------- 3. Tasks Tab Content ---------------- */}
        <TabsContent value="tasks" className="outline-none focus:outline-none space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/20 pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">لوحة الرقابة والعمليات الميدانية</h2>
                <p className="text-xs text-muted-foreground">متابعة سير مهام التركيب والإزالة المخططة وتفويض الفرق الميدانية ونسب إنجاز العمليات</p>
              </div>
            </div>

            {/* Kanban-style Operations overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Installation Progress Overview */}
              <div className="bg-gradient-to-br from-blue-500/8 to-blue-500/1 border border-blue-500/15 p-5 rounded-2xl hover-lift">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">مهام عمليات التركيب</span>
                  <Badge variant="outline" className="font-numbers text-[9px] font-bold border-blue-500/20 text-blue-600">
                    {taskSummaryMetrics.installProgressPct}% إنجاز
                  </Badge>
                </div>
                {/* Horizontal progress bar */}
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mb-4">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-700" style={{ width: `${taskSummaryMetrics.installProgressPct}%` }} />
                </div>
                {/* Detailed steps breakdown */}
                <div className="grid grid-cols-3 gap-2.5 text-center text-[9px] text-muted-foreground font-semibold">
                  <div className="bg-blue-500/5 p-2 rounded-xl border border-blue-500/10">
                    <p className="font-bold font-numbers text-blue-600 dark:text-blue-400 text-sm">{taskSummaryMetrics.installPending}</p>
                    <p className="mt-0.5">انتظار</p>
                  </div>
                  <div className="bg-amber-500/5 p-2 rounded-xl border border-amber-500/10">
                    <p className="font-bold font-numbers text-amber-600 dark:text-amber-400 text-sm">{taskSummaryMetrics.installActive}</p>
                    <p className="mt-0.5">جاري</p>
                  </div>
                  <div className="bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                    <p className="font-bold font-numbers text-emerald-600 dark:text-emerald-400 text-sm">{taskSummaryMetrics.installDone}</p>
                    <p className="mt-0.5">مكتمل</p>
                  </div>
                </div>
              </div>

              {/* Removal Progress Overview */}
              <div className="bg-gradient-to-br from-purple-500/8 to-purple-500/1 border border-purple-500/15 p-5 rounded-2xl hover-lift">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">مهام عمليات الإزالة</span>
                  <Badge variant="outline" className="font-numbers text-[9px] font-bold border-purple-500/20 text-purple-600">
                    {taskSummaryMetrics.removalProgressPct}% إنجاز
                  </Badge>
                </div>
                {/* Horizontal progress bar */}
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mb-4">
                  <div className="bg-purple-500 h-1.5 rounded-full transition-all duration-700" style={{ width: `${taskSummaryMetrics.removalProgressPct}%` }} />
                </div>
                {/* Detailed steps breakdown */}
                <div className="grid grid-cols-3 gap-2.5 text-center text-[9px] text-muted-foreground font-semibold">
                  <div className="bg-purple-500/5 p-2 rounded-xl border border-purple-500/10">
                    <p className="font-bold font-numbers text-purple-600 dark:text-purple-400 text-sm">{taskSummaryMetrics.removalPending}</p>
                    <p className="mt-0.5">انتظار</p>
                  </div>
                  <div className="bg-amber-500/5 p-2 rounded-xl border border-amber-500/10">
                    <p className="font-bold font-numbers text-amber-600 dark:text-amber-400 text-sm">{taskSummaryMetrics.removalActive}</p>
                    <p className="mt-0.5">جاري</p>
                  </div>
                  <div className="bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                    <p className="font-bold font-numbers text-emerald-600 dark:text-emerald-400 text-sm">{taskSummaryMetrics.removalDone}</p>
                    <p className="mt-0.5">مكتمل</p>
                  </div>
                </div>
              </div>

              {/* Overdue alert indicator */}
              <div className="bg-gradient-to-br from-rose-500/8 to-rose-500/1 border border-rose-500/15 p-5 rounded-2xl hover-lift flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400">المهام الميدانية المتأخرة</span>
                  <Badge className="bg-rose-500 text-white font-numbers font-bold text-[10px] px-2 py-0.5 rounded-full">
                    {taskSummaryMetrics.overdueCount} مهمة
                  </Badge>
                </div>
                <div className="flex items-center gap-2.5 mt-3">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <p className="text-[10px] text-muted-foreground font-semibold">مهام تجاوزت تاريخ استحقاقها المخطط، تتطلب إعادة جدولة.</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-rose-600 hover:bg-rose-500/5 mt-4 justify-end p-0 rounded-lg">
                  استعراض التفاصيل المالية والميدانية
                </Button>
              </div>
            </div>

            {/* Unified Search & Filters for Tasks */}
            <Card className="border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
              <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-full sm:flex-1">
                  <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="ابحث عن المهام (اسم العميل، رقم العقد، نوع الإعلان)..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="pr-10 border-border bg-background/50 focus-visible:ring-primary text-xs h-10.5 rounded-xl shadow-inner"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                  <Button 
                    variant={taskStatusFilter === 'all' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setTaskStatusFilter('all')}
                    className="text-[10.5px] h-9.5 px-4.5 rounded-xl font-bold shrink-0"
                  >
                    الكل
                  </Button>
                  <Button 
                    variant={taskStatusFilter === 'pending' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setTaskStatusFilter('pending')}
                    className="text-[10.5px] h-9.5 px-4.5 rounded-xl font-bold shrink-0"
                  >
                    الانتظار
                  </Button>
                  <Button 
                    variant={taskStatusFilter === 'in_progress' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setTaskStatusFilter('in_progress')}
                    className="text-[10.5px] h-9.5 px-4.5 rounded-xl font-bold shrink-0"
                  >
                    جاري العمل
                  </Button>
                  <Button 
                    variant={taskStatusFilter === 'completed' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setTaskStatusFilter('completed')}
                    className="text-[10.5px] h-9.5 px-4.5 rounded-xl font-bold shrink-0"
                  >
                    مكتمل
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Installation Tasks */}
              <Card className="border-blue-500/20 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="pb-3 pt-4 px-5 border-b border-border/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <div className="p-2 bg-blue-500/10 rounded-xl">
                        <Wrench className="h-4 w-4 text-blue-500" />
                      </div>
                      <span>مهام عمليات التركيب المجدولة</span>
                      <Badge className="bg-blue-500/15 text-blue-600 border border-blue-500/20 font-numbers font-bold text-xs px-2 py-0.5 rounded-full">
                        {filteredInstallTasks.length}
                      </Badge>
                    </CardTitle>
                    <Link to="/admin/installation-tasks">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground h-8.5 hover:bg-muted/80 rounded-xl">
                        <span>لوحة التركيب</span> <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {filteredInstallTasks.length === 0 ? (
                    <EmptyState icon={<Wrench className="h-8 w-8 text-muted-foreground/50" />} message="لا توجد مهام تركيب متطابقة" />
                  ) : (
                    <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                      {filteredInstallTasks.map((task) => (
                        <div key={task.id} className="p-4 bg-card/45 rounded-2xl hover:bg-blue-500/5 transition-all border border-border/40 hover:border-blue-500/20 hover-lift">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl shrink-0">
                                <Package className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <p className="font-bold text-xs truncate text-foreground">{task.customer_name}</p>
                                <p className="text-[10px] text-muted-foreground font-numbers">عقد رقم #{task.contract_id} {task.ad_type && ` - ${task.ad_type}`}</p>
                              </div>
                            </div>
                            <Badge className={cn("text-[9px] font-bold shrink-0 py-0.5 px-2 rounded-full",
                              task.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' :
                              task.status === 'in_progress' ? 'bg-blue-500/15 text-blue-600 border-blue-500/20' :
                              'bg-amber-500/15 text-amber-600 border-amber-500/20'
                            )}>
                              {task.status === 'completed' ? 'مكتمل' : task.status === 'in_progress' ? 'جاري' : 'انتظار'}
                            </Badge>
                          </div>
                          {/* Visual detail footer */}
                          <div className="flex flex-wrap gap-2 mt-4.5 border-t border-border/20 pt-2.5 text-[9.5px] text-muted-foreground font-semibold">
                            {task.ad_type && (
                              <span className="bg-blue-500/5 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-lg border border-blue-500/10">
                                {task.ad_type}
                              </span>
                            )}
                            {task.team_id && (
                              <span className="bg-purple-500/5 text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-lg border border-purple-500/10 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                الفرقة: {getTeamName(task.team_id)}
                              </span>
                            )}
                            <span className="font-numbers bg-muted px-2.5 py-0.5 rounded-lg border border-border/20">
                              تاريخ البدء: {formatDateSafe(task.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Removal Tasks */}
              <Card className="border-purple-500/20 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="pb-3 pt-4 px-5 border-b border-border/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <div className="p-2 bg-purple-500/10 rounded-xl">
                        <XCircle className="h-4 w-4 text-purple-500" />
                      </div>
                      <span>مهام عمليات الإزالة والتفكيك</span>
                      <Badge className="bg-purple-500/15 text-purple-600 border border-purple-500/20 font-numbers font-bold text-xs px-2 py-0.5 rounded-full">
                        {filteredRemovalTasks.length}
                      </Badge>
                    </CardTitle>
                    <Link to="/admin/removal-tasks">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground h-8.5 hover:bg-muted/80 rounded-xl">
                        <span>لوحة الإزالة</span> <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {filteredRemovalTasks.length === 0 ? (
                    <EmptyState icon={<XCircle className="h-8 w-8 text-muted-foreground/50" />} message="لا توجد مهام إزالة متطابقة" />
                  ) : (
                    <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                      {filteredRemovalTasks.map((task) => (
                        <div key={task.id} className="p-4 bg-card/45 rounded-2xl hover:bg-purple-500/5 transition-all border border-border/40 hover:border-purple-500/20 hover-lift">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2.5 bg-purple-500/10 text-purple-600 rounded-xl shrink-0">
                                <XCircle className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <p className="font-bold text-xs truncate text-foreground">{task.customer_name}</p>
                                <p className="text-[10px] text-muted-foreground font-numbers">عقد رقم #{task.contract_id} {task.ad_type && ` - ${task.ad_type}`}</p>
                              </div>
                            </div>
                            <Badge className={cn("text-[9px] font-bold shrink-0 py-0.5 px-2 rounded-full",
                              task.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' :
                              task.status === 'in_progress' ? 'bg-purple-500/15 text-purple-600 border-purple-500/20' :
                              'bg-amber-500/15 text-amber-600 border-amber-500/20'
                            )}>
                              {task.status === 'completed' ? 'مكتمل' : task.status === 'in_progress' ? 'جاري' : 'انتظار'}
                            </Badge>
                          </div>
                          {/* Visual detail footer */}
                          <div className="flex flex-wrap gap-2 mt-4.5 border-t border-border/20 pt-2.5 text-[9.5px] text-muted-foreground font-semibold">
                            {task.ad_type && (
                              <span className="bg-purple-500/5 text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-lg border border-purple-500/10">
                                {task.ad_type}
                              </span>
                            )}
                            <span className="font-numbers bg-muted px-2.5 py-0.5 rounded-lg border border-border/20">
                              تاريخ الإدراج: {formatDateSafe(task.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Overdue Tasks Alert */}
            {overdueTasks.length > 0 && (
              <Card className="border-rose-500/20 bg-rose-500/[0.02] backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="pb-3 pt-4 px-5 border-b border-border/20">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-bold text-rose-600 dark:text-rose-400">
                    <div className="p-2 bg-rose-500/10 rounded-xl">
                      <Bell className="h-4 w-4 text-rose-500 animate-pulse" />
                    </div>
                    <span>مهام معلقة متأخرة تجاوزت موعد الاستحقاق الميداني</span>
                    <Badge className="bg-rose-500 text-white font-numbers font-bold text-xs px-2 py-0.5 rounded-full">{overdueTasks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {overdueTasks.map((task) => (
                      <div 
                        key={task.id} 
                        className="flex items-center justify-between p-4 bg-rose-500/5 rounded-2xl border border-rose-500/15 hover-lift"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-rose-700 dark:text-rose-400 truncate">{task.title || 'مهمة بدون اسم'}</p>
                            <p className="text-[9.5px] text-muted-foreground font-numbers mt-0.5">تأخير منذ {Math.abs(differenceInDays(new Date(task.due_date), new Date()))} يوم</p>
                          </div>
                        </div>
                        <Badge className="bg-rose-500 text-white text-[8.5px] font-bold py-0.5 px-2.5 animate-pulse rounded-full shrink-0">متأخرة</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          </motion.div>
        </TabsContent>

        {/* ---------------- 4. Billboards Tab Content ---------------- */}
        <TabsContent value="billboards" className="outline-none focus:outline-none space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/20 pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">لوحة تحليلات وتوزيع اللوحات الإعلانية</h2>
                <p className="text-xs text-muted-foreground">عرض للتوزع الجغرافي للشبكة، مقارنة ملكية المواقع، ومعرض تفصيلي للوحات المضافة حديثاً</p>
              </div>
            </div>

            {/* Distribution analysis grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Municipality Distribution Bar Chart */}
              <Card className="border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="py-4 px-5 border-b border-border/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>توزيع اللوحات الجغرافي (أعلى 5 بلديات مأهولة)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 h-[270px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={municipalityDistributionData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#88888812" horizontal={false} />
                      <XAxis type="number" stroke="#88888850" fontSize={10} tickLine={false} />
                      <YAxis dataKey="name" type="category" stroke="#88888850" fontSize={10} tickLine={false} width={80} />
                      <RechartsTooltip 
                        contentStyle={{ 
                          background: 'rgba(15, 23, 42, 0.95)', 
                          border: '1px solid rgba(218, 165, 32, 0.3)', 
                          borderRadius: '12px', 
                          fontSize: '11px',
                          color: '#ffffff',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                          direction: 'rtl',
                          textAlign: 'right'
                        }}
                        labelStyle={{ color: '#a1a1aa', fontWeight: 'bold', marginBottom: '4px' }}
                        itemStyle={{ color: '#ffffff' }}
                      />
                      <Bar dataKey="value" fill="#DAA520" radius={[0, 4, 4, 0]} barSize={16}>
                        {municipalityDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#DAA520', '#B8860B', '#3b82f6', '#10b981', '#a855f7'][index % 5]} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Own vs Friend Company stats */}
              <Card className="border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="py-4 px-5 border-b border-border/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span>هيكل الملكية والشراكات الجغرافية</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 flex flex-col justify-between h-[270px]">
                  <div className="flex items-center justify-around w-full gap-5">
                    <div className="text-center space-y-2 group cursor-pointer">
                      <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/1 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-2xl hover:shadow-blue-500/15 hover:shadow-lg transition-all duration-300">
                        {ownBillboards.length}
                      </div>
                      <p className="text-xs font-bold text-foreground">اللوحات المملوكة</p>
                      <p className="text-[9px] text-muted-foreground font-numbers">تحت الإدارة الكاملة للوكالة</p>
                    </div>
                    
                    <div className="text-center space-y-2 group cursor-pointer">
                      <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/1 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-500 font-black text-2xl hover:shadow-amber-500/15 hover:shadow-lg transition-all duration-300">
                        {friendBillboards.length}
                      </div>
                      <p className="text-xs font-bold text-foreground">الشركات الصديقة</p>
                      <p className="text-[9px] text-muted-foreground font-numbers">مواقع تشاركية ومستأجرة</p>
                    </div>
                  </div>
                  
                  {/* A beautiful linear comparative bar */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground font-bold font-numbers">
                      <span>مملوكة للشركة ({Math.round(ownBillboards.length / (ownBillboards.length + friendBillboards.length || 1) * 100)}%)</span>
                      <span>علاقات تشاركية ({Math.round(friendBillboards.length / (ownBillboards.length + friendBillboards.length || 1) * 100)}%)</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden flex shadow-inner">
                      <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${(ownBillboards.length / (ownBillboards.length + friendBillboards.length || 1)) * 100}%` }} />
                      <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${(friendBillboards.length / (ownBillboards.length + friendBillboards.length || 1)) * 100}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Recent Added Billboards in Detail Card */}
            {recentBillboards.length > 0 && (
              <Card className="border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
                <CardHeader className="pb-4 pt-5 px-5 border-b border-border/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <div className="p-2 bg-primary/10 rounded-xl">
                        <Monitor className="h-4 w-4 text-primary" />
                      </div>
                      <span>اللوحات الإعلانية المضافة حديثاً للشبكة</span>
                    </CardTitle>
                    <Link to="/admin/billboards">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary hover:bg-primary/10 h-8.5 rounded-xl font-bold">
                        <span>إدارة الميدان بالكامل</span> <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recentBillboards.map((bb) => {
                      const imageUrl = bb.Image_URL || bb.image_name;
                      const isAvailable = isBillboardAvailable(bb);
                      return (
                        <div
                          key={bb.ID}
                          className="group relative flex flex-col rounded-2xl overflow-hidden border border-border/40 bg-card/50 hover:bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover-lift"
                        >
                          {/* Image Container */}
                          <div className="relative aspect-[16/10] bg-muted overflow-hidden border-b border-border/40">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={bb.Billboard_Name || ''}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30 bg-muted/40">
                                <ImageIcon className="h-9 w-9 mb-2" />
                                <span className="text-[10px] font-bold">لا تتوفر صورة مصورة للوحة</span>
                              </div>
                            )}
                            
                            {/* Absolute Badges on Image */}
                            <div className="absolute top-3 right-3 flex gap-2">
                              <Badge
                                className={cn(
                                  'text-[8px] font-black py-0.5 px-2 rounded-full border shadow-md backdrop-blur-md',
                                  isAvailable
                                    ? 'bg-emerald-500/90 text-white border-emerald-400'
                                    : 'bg-rose-500/90 text-white border-rose-400'
                                )}
                              >
                                {isAvailable ? 'متاحة للحجز' : 'مؤجرة حالياً'}
                              </Badge>
                            </div>

                            {/* Hover Overlay Button */}
                            {imageUrl && (
                              <div 
                                className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 cursor-pointer"
                                onClick={() => setSelectedImage({ url: imageUrl, name: bb.Billboard_Name || '' })}
                              >
                                <Button size="xs" variant="secondary" className="gap-1.5 text-[10px] font-bold h-7.5 px-3 rounded-xl shadow-lg">
                                  <ImageIcon className="h-3.5 w-3.5" />
                                  <span>تكبير الصورة</span>
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Detail Content */}
                          <div className="p-4.5 flex-1 flex flex-col justify-between space-y-4">
                            <div className="space-y-1.5">
                              <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                                {bb.Billboard_Name || `لوحة إعلانية #${bb.ID}`}
                              </h4>
                              {bb.Nearest_Landmark && (
                                <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1.5 font-semibold">
                                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" /> {bb.Nearest_Landmark}
                                </p>
                              )}
                            </div>

                            {/* Badges footer */}
                            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/20">
                              {bb.Size && (
                                <Badge variant="outline" className="text-[9px] font-numbers bg-primary/5 text-primary border-primary/20 flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold">
                                  <Package className="h-3 w-3 text-primary shrink-0" />
                                  <span>{bb.Size}</span>
                                </Badge>
                              )}
                              {(bb.Municipality || bb.District) && (
                                <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground border-border/40 flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold truncate max-w-[130px]">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span>{bb.Municipality || bb.District}</span>
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

          </motion.div>
        </TabsContent>

        {/* ---------------- 5. Advanced Stats Tab Content ---------------- */}
        <TabsContent value="advanced-stats" className="outline-none focus:outline-none space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/20 pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">التحليلات التفصيلية لدخل البلديات والمقاسات والعملاء</h2>
                <p className="text-xs text-muted-foreground">عرض مالي وتشغيلي مفصل بناءً على اللوحات النشطة وعقود العملاء الجارية (مستثنى منها اللوحات الصديقة، المزالة، المخفية، والسوسيت/دي باص)</p>
              </div>
            </div>

            {/* Sizes & Municipalities Side-by-side Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Municipalities stats card */}
              <Card className="border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden flex flex-col">
                <CardHeader className="py-4 px-5 border-b border-border/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>تحليل البلديات والدخل</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 flex-1 overflow-auto max-h-[400px]">
                  <div className="space-y-4">
                    {Object.keys(advancedStats.municipalityCounts).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">لا تتوفر بيانات للبلديات</p>
                    ) : (
                      <div className="divide-y divide-border/20">
                        {Object.entries(advancedStats.municipalityCounts)
                          .sort((a, b) => (advancedStats.municipalityRevenue[b[0]] || 0) - (advancedStats.municipalityRevenue[a[0]] || 0))
                          .map(([muni, counts]) => {
                            const rev = advancedStats.municipalityRevenue[muni] || 0;
                            const occupancy = counts.total > 0 ? Math.round((counts.rented / counts.total) * 100) : 0;
                            return (
                              <div key={muni} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 first:pt-0 last:pb-0">
                                <div className="space-y-1">
                                  <span className="text-xs font-bold text-foreground">{muni}</span>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-numbers">
                                    <span>إجمالي: {counts.total}</span>
                                    <span>•</span>
                                    <span className="text-emerald-500">شاغر: {counts.available}</span>
                                    <span>•</span>
                                    <span className="text-blue-500">مؤجر: {counts.rented}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6 justify-between md:justify-end">
                                  <div className="w-24 space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold font-numbers">
                                      <span>الإشغال</span>
                                      <span>{occupancy}%</span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div className="bg-primary h-full transition-all duration-500" style={{ width: `${occupancy}%` }} />
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs font-black text-primary font-numbers">
                                      {rev.toLocaleString('ar-LY')} <span className="text-[9px] font-bold text-muted-foreground">د.ل</span>
                                    </p>
                                    <p className="text-[8px] text-muted-foreground font-bold">الدخل الكلي</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Sizes stats card */}
              <Card className="border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden flex flex-col">
                <CardHeader className="py-4 px-5 border-b border-border/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Maximize2 className="h-4 w-4 text-primary" />
                    <span>تحليل المقاسات والدخل</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 flex-1 overflow-auto max-h-[400px]">
                  <div className="space-y-4">
                    {Object.keys(advancedStats.sizeCounts).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">لا تتوفر بيانات للمقاسات</p>
                    ) : (
                      <div className="divide-y divide-border/20">
                        {Object.entries(advancedStats.sizeCounts)
                          .sort((a, b) => (advancedStats.sizeRevenue[b[0]] || 0) - (advancedStats.sizeRevenue[a[0]] || 0))
                          .map(([size, counts]) => {
                            const rev = advancedStats.sizeRevenue[size] || 0;
                            const occupancy = counts.total > 0 ? Math.round((counts.rented / counts.total) * 100) : 0;
                            return (
                              <div key={size} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 first:pt-0 last:pb-0">
                                <div className="space-y-1">
                                  <span className="text-xs font-bold text-foreground font-numbers">{size}</span>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-numbers">
                                    <span>إجمالي: {counts.total}</span>
                                    <span>•</span>
                                    <span className="text-emerald-500">شاغر: {counts.available}</span>
                                    <span>•</span>
                                    <span className="text-blue-500">مؤجر: {counts.rented}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6 justify-between md:justify-end">
                                  <div className="w-24 space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold font-numbers">
                                      <span>الإشغال</span>
                                      <span>{occupancy}%</span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div className="bg-primary h-full transition-all duration-500" style={{ width: `${occupancy}%` }} />
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs font-black text-primary font-numbers">
                                      {rev.toLocaleString('ar-LY')} <span className="text-[9px] font-bold text-muted-foreground">د.ل</span>
                                    </p>
                                    <p className="text-[8px] text-muted-foreground font-bold">الدخل الكلي</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Customers table card */}
            <Card className="border-border/40 bg-card/30 backdrop-blur-xl rounded-2xl shadow-md overflow-hidden">
              <CardHeader className="py-4 px-5 border-b border-border/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>تحليل مساهمة ودخل العملاء (أعلى 10)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-auto">
                {Object.keys(advancedStats.customerRevenue).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">لا توجد بيانات عقود سارية للعملاء</p>
                ) : (
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/20 text-muted-foreground font-bold">
                        <th className="py-3 px-5">اسم العميل</th>
                        <th className="py-3 px-5 text-center">العقود الكلية</th>
                        <th className="py-3 px-5 text-center">العقود النشطة</th>
                        <th className="py-3 px-5 text-left">إجمالي الدخل المساهم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                      {Object.entries(advancedStats.customerRevenue)
                        .sort((a, b) => b[1].revenue - a[1].revenue)
                        .slice(0, 10)
                        .map(([name, stats]) => (
                          <tr key={name} className="hover:bg-muted/10 transition-colors">
                            <td className="py-3.5 px-5 font-bold text-foreground">{name}</td>
                            <td className="py-3.5 px-5 text-center font-numbers text-muted-foreground">{stats.totalContracts}</td>
                            <td className="py-3.5 px-5 text-center">
                              <Badge variant={stats.activeContracts > 0 ? 'success' : 'outline'} className="text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {stats.activeContracts > 0 ? `${stats.activeContracts} نشط` : 'منتهي'}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-5 text-left font-black text-primary font-numbers">
                              {stats.revenue.toLocaleString('ar-LY')} د.ل
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

          </motion.div>
        </TabsContent>

      </Tabs>

      {/* Selected Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-card border border-border/60 rounded-2xl shadow-2xl">
          <CardHeader className="py-3.5 px-5 border-b border-border/20">
            <DialogTitle className="text-sm font-bold">{selectedImage?.name}</DialogTitle>
          </CardHeader>
          <div className="p-3 bg-muted/20">
            {selectedImage && (
              <img 
                src={selectedImage.url} 
                alt={selectedImage.name}
                className="w-full h-auto max-h-[78vh] rounded-xl object-contain mx-auto shadow-md"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp dialog rendering */}
      <Dialog open={whatsappDialog.open} onOpenChange={(open) => setWhatsappDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md bg-card border border-border/60 rounded-2xl shadow-2xl p-5" dir="rtl">
          <DialogHeader className="pb-3 border-b border-border/20 text-right">
            <DialogTitle className="text-sm font-bold flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="h-5 w-5 animate-pulse" />
              <span>إرسال إشعار تذكير ذكي عبر الواتساب</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4.5 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">رقم الهاتف المستهدف</Label>
              <Input 
                value={whatsappDialog.phone}
                onChange={(e) => setWhatsappDialog(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="2189XXXXXXXX"
                className="font-mono text-xs border-border bg-background focus-visible:ring-emerald-500"
              />
            </div>

            {/* Smart Templates Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">القوالب التذكيرية الذكية</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => applyTemplate('expired')} 
                  variant="outline" 
                  size="xs" 
                  className="text-[9.5px] border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/5 h-8.5 rounded-xl font-bold"
                >
 ️ إخطار انتهاء العقد
                </Button>
                <Button 
                  onClick={() => applyTemplate('expiring')} 
                  variant="outline" 
                  size="xs" 
                  className="text-[9.5px] border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/5 h-8.5 rounded-xl font-bold"
                >
 تذكير قرب الانتهاء
                </Button>
                <Button 
                  onClick={() => applyTemplate('installment')} 
                  variant="outline" 
                  size="xs" 
                  className="text-[9.5px] border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5 h-8.5 rounded-xl font-bold"
                >
 تذكير بموعد القسط
                </Button>
                <Button 
                  onClick={() => applyTemplate('receipt')} 
                  variant="outline" 
                  size="xs" 
                  className="text-[9.5px] border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/5 h-8.5 rounded-xl font-bold"
                >
 تأكيد استلام الدفعة
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">نص الرسالة الموجهة للعميل</Label>
              <Textarea 
                value={whatsappDialog.message}
                onChange={(e) => setWhatsappDialog(prev => ({ ...prev, message: e.target.value }))}
                placeholder="اكتب نص الرسالة هنا..."
                rows={5}
                className="text-xs border-border bg-background focus-visible:ring-emerald-500 resize-none rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-border/20 pt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setWhatsappDialog(prev => ({ ...prev, open: false }))}
              className="text-xs font-bold rounded-xl h-9.5 px-4"
            >
              إلغاء الأمر
            </Button>
            <Button 
              disabled={whatsappLoading || !whatsappDialog.phone || !whatsappDialog.message}
              onClick={handleSendWhatsApp}
              className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 gap-2 text-xs font-bold rounded-xl h-9.5 px-4"
            >
              {whatsappLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري الإرسال...</span>
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span>إرسال الرسالة الآن</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Sparkline Component using SVG/Recharts directly (fully customized layout)
const Sparkline = ({ data, color }: { data: { id: number; value: number }[]; color: string }) => {
  return (
    <div className="w-16 h-8 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={1.8} 
            dot={false} 
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// StatCard Component redesigned with Sparkline support & colored hover glow shadow
interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'green' | 'purple' | 'orange';
  sparklineData?: { id: number; value: number }[];
  suffix?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color, sparklineData, suffix = '', onClick }) => {
  const colors = {
    blue: { 
      bg: 'from-blue-500/8 to-blue-500/1', 
      border: 'border-blue-500/15 hover:border-blue-500/35', 
      icon: 'bg-blue-500/10 text-blue-500 dark:text-blue-400', 
      text: 'text-blue-600 dark:text-blue-400', 
      sparkColor: '#3b82f6',
      shadow: 'hover:shadow-[0_8px_30px_rgba(59,130,246,0.18)]'
    },
    red: { 
      bg: 'from-rose-500/8 to-rose-500/1', 
      border: 'border-rose-500/15 hover:border-rose-500/35', 
      icon: 'bg-rose-500/10 text-rose-500 dark:text-rose-400', 
      text: 'text-rose-600 dark:text-rose-400', 
      sparkColor: '#ef4444',
      shadow: 'hover:shadow-[0_8px_30px_rgba(244,63,94,0.18)]'
    },
    green: { 
      bg: 'from-emerald-500/8 to-emerald-500/1', 
      border: 'border-emerald-500/15 hover:border-emerald-500/35', 
      icon: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400', 
      text: 'text-emerald-600 dark:text-emerald-400', 
      sparkColor: '#10b981',
      shadow: 'hover:shadow-[0_8px_30px_rgba(16,185,129,0.18)]'
    },
    purple: { 
      bg: 'from-purple-500/8 to-purple-500/1', 
      border: 'border-purple-500/15 hover:border-purple-500/35', 
      icon: 'bg-purple-500/10 text-purple-500 dark:text-purple-400', 
      text: 'text-purple-600 dark:text-purple-400', 
      sparkColor: '#a855f7',
      shadow: 'hover:shadow-[0_8px_30px_rgba(168,85,247,0.18)]'
    },
    orange: { 
      bg: 'from-orange-500/8 to-orange-500/1', 
      border: 'border-orange-500/15 hover:border-orange-500/35', 
      icon: 'bg-orange-500/10 text-orange-500 dark:text-orange-400', 
      text: 'text-orange-600 dark:text-orange-400', 
      sparkColor: '#f97316',
      shadow: 'hover:shadow-[0_8px_30px_rgba(249,115,22,0.18)]'
    },
  };
  const c = colors[color];

  return (
    <Card className={cn("bg-gradient-to-br transition-all duration-300 group cursor-pointer card-elegant hover-lift", c.bg, c.border, c.shadow)} onClick={onClick}>
      <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-black font-numbers tracking-tight", c.text)}>
              {value.toLocaleString('ar-LY')}
              {suffix}
            </p>
          </div>
          <div className={cn("p-2 rounded-lg transition-transform group-hover:scale-110", c.icon)}>
            <span className={c.iconColor}>{icon}</span>
          </div>
        </div>

        {/* Sparkline & Subtitle row */}
        <div className="flex items-center justify-between border-t border-border/30 pt-2.5">
          <p className="text-[10px] text-muted-foreground truncate max-w-[65%]">{subtitle}</p>
          {sparklineData && (
            <Sparkline data={sparklineData} color={c.sparkColor} />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// QuickActionButton redesigned with premium feel
interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant: 'primary' | 'outline';
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({ icon, label, onClick, variant }) => (
  <Button
    onClick={onClick}
    variant={variant === 'primary' ? 'default' : 'outline'}
    className={cn(
      "h-auto py-3.5 flex-col gap-2 rounded-xl text-[11px] font-bold transition-all duration-200 w-full hover-lift",
      variant === 'primary' 
        ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-gold hover:opacity-95" 
        : "border border-border/80 bg-background hover:bg-muted/70 hover:border-primary/30"
    )}
  >
    <div className={cn("p-1.5 rounded-lg", variant === 'primary' ? "bg-white/20 text-white" : "bg-primary/5 text-primary")}>
      {icon}
    </div>
    <span className="truncate w-full text-center">{label}</span>
  </Button>
);

// EmptyState component
interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  color?: 'default' | 'green';
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, color = 'default' }) => (
  <div className="text-center py-10 border border-dashed border-border/60 rounded-xl bg-card/20">
    <div className={cn("mx-auto mb-3 p-3 rounded-full w-fit", color === 'green' ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground/40")}>
      <span className="h-6 w-6 block">{icon}</span>
    </div>
    <p className="text-xs font-semibold text-muted-foreground">{message}</p>
  </div>
);
