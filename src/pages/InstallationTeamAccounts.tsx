import { useEffect, useState, useMemo } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  CheckCircle, Clock, DollarSign, CreditCard, ArrowRight, Users,
  TrendingUp, Wallet, PiggyBank, Search, Filter, Printer,
  BarChart3, RefreshCw, FileText, Plus, Trash2
} from 'lucide-react';
import ContractBillboardsGroup from '@/components/teams/ContractBillboardsGroup';
import TeamPaymentReceiptDialog from '@/components/teams/TeamPaymentReceiptDialog';
import { FullStatementOptionsDialog, FullStatementOptions } from '@/components/billing/FullStatementOptionsDialog';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TeamAccount {
  id: string;
  team_id: string;
  task_item_id: string;
  billboard_id: number;
  contract_id: number;
  installation_date: string;
  amount: number;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface TeamSummary {
  team_id: string;
  team_name: string;
  total_installations: number;
  pending_count: number;
  paid_count: number;
  pending_amount: number;
  paid_amount: number;
  total_amount: number;
}

interface BillboardDetails {
  billboard_name: string;
  customer_name: string;
  size: string;
  image_url?: string;
  installation_image_url?: string;
  design_face_a?: string;
  design_face_b?: string;
}

interface TeamAccountExpense {
  id: string;
  team_account_id: string;
  description: string;
  amount: number;
  expense_date: string;
  notes: string | null;
  created_at: string;
}

const getBillboardContractKey = (billboardId: number, contractId: number): string => {
  return `${billboardId}_${contractId}`;
};

interface SizePricing {
  name: string;
  installation_price: number;
}

// Colors used in charts

export default function InstallationTeamAccounts() {
  const { confirm: systemConfirm } = useSystemDialog();
  const [summaries, setSummaries] = useState<TeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<TeamAccount[]>([]);
  const [billboardDetails, setBillboardDetails] = useState<Record<string, BillboardDetails>>({});
  const [billboardGpsData, setBillboardGpsData] = useState<Record<number, { gps_coordinates?: string; gps_link?: string }>>({});
  const [sizePricing, setSizePricing] = useState<SizePricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [fullStatementDialogOpen, setFullStatementDialogOpen] = useState(false);
  const [contractStatementId, setContractStatementId] = useState<number | null>(null);

  // Expenses state
  const [expenses, setExpenses] = useState<TeamAccountExpense[]>([]);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseTargetAccountId, setExpenseTargetAccountId] = useState<string | null>(null);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');
  const [showCharts, setShowCharts] = useState(false);

  const overallStats = useMemo(() => {
    return summaries.reduce((acc, s) => ({
      totalTeams: acc.totalTeams + 1,
      totalInstallations: acc.totalInstallations + s.total_installations,
      totalPending: acc.totalPending + s.pending_amount,
      totalPaid: acc.totalPaid + s.paid_amount,
      totalAmount: acc.totalAmount + s.total_amount,
    }), { totalTeams: 0, totalInstallations: 0, totalPending: 0, totalPaid: 0, totalAmount: 0 });
  }, [summaries]);

  // Chart data
  const pieData = useMemo(() => [
    { name: 'معلق', value: overallStats.totalPending, color: '#f97316' },
    { name: 'مدفوع', value: overallStats.totalPaid, color: '#22c55e' },
  ].filter(d => d.value > 0), [overallStats]);

  const barData = useMemo(() => summaries.map(s => ({
    name: s.team_name,
    معلق: s.pending_amount,
    مدفوع: s.paid_amount,
  })), [summaries]);

  const loadSizePricing = async () => {
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('name, installation_price')
        .not('installation_price', 'is', null);
      if (error) throw error;
      setSizePricing(data || []);
    } catch (error: any) {
      console.error('Error loading size pricing:', error);
    }
  };

  const loadSummaries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('team_accounts_summary')
        .select('*')
        .order('team_name');
      if (error) throw error;
      setSummaries(data || []);
    } catch (error: any) {
      console.error('Error loading team summaries:', error);
      toast.error('فشل في تحميل ملخص حسابات الفرق');
    } finally {
      setLoading(false);
    }
  };

  const loadExpenses = async (accountIds: string[]) => {
    if (accountIds.length === 0) { setExpenses([]); return; }
    const { data, error } = await supabase
      .from('team_account_expenses')
      .select('*')
      .in('team_account_id', accountIds)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading expenses:', error);
    }
    setExpenses(data || []);
  };

  const loadTeamAccounts = async (teamId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('installation_team_accounts')
        .select('*')
        .eq('team_id', teamId)
        .order('contract_id', { ascending: false });
      if (error) throw error;
      setAccounts(data || []);

      // Load expenses for these accounts
      if (data && data.length > 0) {
        loadExpenses(data.map(a => a.id));
        
        const billboardIds = [...new Set(data.map(a => a.billboard_id))];
        const contractIds = [...new Set(data.map(a => a.contract_id))];
        const taskItemIds = [...new Set(data.map(a => a.task_item_id).filter(Boolean))];
        const emptyRes = { data: [], error: null } as any;

        const [billboardsRes, contractsRes, taskItemsRes, historyRes] = await Promise.all([
          billboardIds.length ? supabase.from('billboards').select('ID, Billboard_Name, Size, Image_URL, design_face_a, design_face_b, GPS_Coordinates, GPS_Link').in('ID', billboardIds) : Promise.resolve(emptyRes),
          contractIds.length ? supabase.from('Contract').select('Contract_Number, "Customer Name"').in('Contract_Number', contractIds) : Promise.resolve(emptyRes),
          taskItemIds.length ? supabase.from('installation_task_items').select('id, installed_image_face_a_url, installed_image_face_b_url, installed_image_url, design_face_a, design_face_b').in('id', taskItemIds) : Promise.resolve(emptyRes),
          billboardIds.length && contractIds.length ? supabase.from('billboard_history').select('billboard_id, contract_number, installed_image_face_a_url, installed_image_face_b_url').in('billboard_id', billboardIds).in('contract_number', contractIds) : Promise.resolve(emptyRes),
        ]);

        const { data: billboards, error: billboardError } = billboardsRes;
        const { data: contracts } = contractsRes;
        const { data: taskItems } = taskItemsRes;
        const { data: historyData } = historyRes;
        if (billboardError) throw billboardError;

        const pickImageUrl = (...urls: Array<string | null | undefined>): string | undefined =>
          urls.find((u) => typeof u === 'string' && u.trim().length > 0) as string | undefined;

        const taskItemById = new Map((taskItems || []).map((ti: any) => [ti.id, ti]));

        if (billboards) {
          const detailsMap: Record<string, BillboardDetails> = {};
          data.forEach(account => {
            const billboard = billboards.find(b => b.ID === account.billboard_id);
            const contract = contracts?.find(c => c.Contract_Number === account.contract_id);
            const taskItem = taskItemById.get(account.task_item_id) as any;
            const history = historyData?.find((h: any) => h.billboard_id === account.billboard_id && h.contract_number === account.contract_id);

            if (billboard) {
              const key = getBillboardContractKey(account.billboard_id, account.contract_id);
              detailsMap[key] = {
                billboard_name: billboard.Billboard_Name || `لوحة ${account.billboard_id}`,
                customer_name: contract?.['Customer Name'] || '',
                size: billboard.Size || '',
                image_url: billboard.Image_URL || undefined,
                installation_image_url: pickImageUrl(
                  taskItem?.installed_image_face_a_url, taskItem?.installed_image_url,
                  taskItem?.installed_image_face_b_url, history?.installed_image_face_a_url, history?.installed_image_face_b_url
                ),
                design_face_a: pickImageUrl(taskItem?.design_face_a, billboard.design_face_a),
                design_face_b: pickImageUrl(taskItem?.design_face_b, billboard.design_face_b),
              };
            }
          });
          setBillboardDetails(detailsMap);

          // Build GPS data map
          const gpsMap: Record<number, { gps_coordinates?: string; gps_link?: string }> = {};
          billboards.forEach((b: any) => {
            if (b.GPS_Coordinates || b.GPS_Link) {
              gpsMap[b.ID] = { gps_coordinates: b.GPS_Coordinates || undefined, gps_link: b.GPS_Link || undefined };
            }
          });
          setBillboardGpsData(gpsMap);
        }
      }
    } catch (error: any) {
      console.error('Error loading team accounts:', error);
      toast.error('فشل في تحميل حسابات الفريق');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSummaries(); loadSizePricing(); }, []);
  useEffect(() => { if (selectedTeamId) { loadTeamAccounts(selectedTeamId); setSelectedIds(new Set()); } }, [selectedTeamId]);

  const getInstallationPrice = (size: string): number => {
    const sizeInfo = sizePricing.find(s => s.name === size);
    return sizeInfo?.installation_price || 0;
  };

  const getEffectiveAccountAmount = (a: TeamAccount): number => {
    const stored = Number(a.amount || 0);
    if (stored > 0) return stored;
    const key = getBillboardContractKey(a.billboard_id, a.contract_id);
    const details = billboardDetails[key];
    const base = details?.size ? getInstallationPrice(details.size) : 0;
    return Number(base || 0);
  };

  // Get expenses for an account
  const getAccountExpenses = (accountId: string) => expenses.filter(e => e.team_account_id === accountId);
  const getAccountExpensesTotal = (accountId: string) => getAccountExpenses(accountId).reduce((s, e) => s + Number(e.amount), 0);

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === filterStatus);
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(a => {
        const key = getBillboardContractKey(a.billboard_id, a.contract_id);
        const details = billboardDetails[key];
        return (
          details?.billboard_name?.toLowerCase().includes(s) ||
          details?.customer_name?.toLowerCase().includes(s) ||
          String(a.contract_id).includes(s) ||
          String(a.billboard_id).includes(s)
        );
      });
    }
    return filtered;
  }, [accounts, filterStatus, searchTerm, billboardDetails]);

  const groupedAccounts = filteredAccounts.reduce((groups, account) => {
    const contractId = account.contract_id;
    if (!groups[contractId]) groups[contractId] = [];
    groups[contractId].push(account);
    return groups;
  }, {} as Record<number, TeamAccount[]>);

  const selectedAccounts = accounts.filter(a => selectedIds.has(a.id));
  const selectedAmount = selectedAccounts.reduce((sum, a) => sum + getEffectiveAccountAmount(a), 0);

  const handleBulkPayment = async () => {
    if (selectedIds.size === 0) { toast.error('الرجاء تحديد لوحات للسداد'); return; }
    setPaymentDialogOpen(true);
  };

  const processPayment = async () => {
    try {
      setProcessingPayment(true);
      const billboardsForReceipt = selectedAccounts.map(a => {
        const key = getBillboardContractKey(a.billboard_id, a.contract_id);
        const details = billboardDetails[key];
        return { billboard_name: details?.billboard_name || `لوحة ${a.billboard_id}`, size: details?.size || '-', amount: getEffectiveAccountAmount(a), contract_id: a.contract_id };
      });
      const totalAmount = billboardsForReceipt.reduce((sum, b) => sum + b.amount, 0);

      for (const account of selectedAccounts) {
        const { error } = await supabase.from('installation_team_accounts').update({ status: 'paid', amount: getEffectiveAccountAmount(account), notes: paymentNotes || null }).eq('id', account.id);
        if (error) throw error;
      }

      toast.success(`تم سداد ${selectedIds.size} لوحة بمبلغ ${totalAmount.toLocaleString('en-US')} د.ل`);
      setReceiptData({ amount: totalAmount, paid_at: new Date().toISOString(), method: paymentMethod === 'cash' ? 'نقدي' : paymentMethod === 'bank' ? 'تحويل بنكي' : paymentMethod, notes: paymentNotes, billboards: billboardsForReceipt });
      setPaymentDialogOpen(false);
      setReceiptDialogOpen(true);
      if (selectedTeamId) await loadTeamAccounts(selectedTeamId);
      await loadSummaries();
      setSelectedIds(new Set());
      setPaymentNotes('');
      setPaymentMethod('cash');
    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast.error('فشل في معالجة السداد');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleUpdateAmount = async (id: string, newAmount: number, reason: string) => {
    try {
      const existingAccount = accounts.find(a => a.id === id);
      const newNotes = reason ? `${existingAccount?.notes ? existingAccount.notes + ' | ' : ''}تعديل السعر: ${reason}` : existingAccount?.notes;
      const { error } = await supabase.from('installation_team_accounts').update({ amount: newAmount, notes: newNotes }).eq('id', id);
      if (error) throw error;
      toast.success('تم تحديث السعر بنجاح');
      if (selectedTeamId) await loadTeamAccounts(selectedTeamId);
      await loadSummaries();
    } catch (error: any) {
      console.error('Error updating amount:', error);
      toast.error('فشل في تحديث السعر');
    }
  };

  // Add expense
  const handleAddExpense = async () => {
    if (!expenseTargetAccountId || !expenseDescription || !expenseAmount) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    const { error } = await supabase.from('team_account_expenses').insert({
      team_account_id: expenseTargetAccountId,
      description: expenseDescription,
      amount: parseFloat(expenseAmount),
      notes: expenseNotes || null,
    });
    if (error) {
      toast.error('فشل إضافة المصروف');
      console.error(error);
      return;
    }
    toast.success('تم إضافة المصروف بنجاح');
    setExpenseDialogOpen(false);
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseNotes('');
    setExpenseTargetAccountId(null);
    if (selectedTeamId) await loadTeamAccounts(selectedTeamId);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل تريد حذف هذا المصروف؟', variant: 'destructive', confirmText: 'حذف' })) return;
    const { error } = await supabase.from('team_account_expenses').delete().eq('id', expenseId);
    if (error) { toast.error('فشل حذف المصروف'); return; }
    toast.success('تم حذف المصروف');
    if (selectedTeamId) await loadTeamAccounts(selectedTeamId);
  };

  // Print team invoice (all pending)
  const handlePrintTeamInvoice = () => {
    if (!selectedTeamId || accounts.length === 0) return;
    const pendingAccounts = filterStatus === 'paid' ? filteredAccounts : filteredAccounts.filter(a => a.status === 'pending');
    if (pendingAccounts.length === 0) { toast.error('لا توجد مستحقات معلقة'); return; }

    const billboardsForReceipt = pendingAccounts.map(a => {
      const key = getBillboardContractKey(a.billboard_id, a.contract_id);
      const details = billboardDetails[key];
      return { billboard_name: details?.billboard_name || `لوحة ${a.billboard_id}`, size: details?.size || '-', amount: getEffectiveAccountAmount(a), contract_id: a.contract_id };
    });
    const totalAmount = billboardsForReceipt.reduce((sum, b) => sum + b.amount, 0);

    setReceiptData({
      amount: totalAmount,
      paid_at: new Date().toISOString(),
      method: 'كشف حساب',
      notes: filterStatus === 'paid' ? 'كشف المدفوعات' : 'كشف المستحقات المعلقة',
      billboards: billboardsForReceipt
    });
    setReceiptDialogOpen(true);
  };

  // ✅ Full Statement - like printer accounts (with designs, faces, task type)
  const handlePrintFullStatement = async (options: FullStatementOptions) => {
    // Support single-contract mode via contractStatementId
    const filteredAccounts = contractStatementId 
      ? accounts.filter(a => a.contract_id === contractStatementId)
      : accounts;
    
    if (!selectedTeamId || filteredAccounts.length === 0) {
      toast.info('لا توجد بيانات لهذا الفريق');
      setContractStatementId(null);
      return;
    }

    toast.info('جاري تجهيز الكشف الكامل...');

    // Load shared settings from print_settings (single source of truth)
    let logoPath = '';
    let fontFamily = 'Doran';
    let footerText = 'شكراً لتعاملكم معنا';
    try {
      const { getMergedInvoiceStylesAsync } = await import('@/hooks/useInvoiceSettingsSync');
      const styles = await getMergedInvoiceStylesAsync('installation');
      if (styles) {
        logoPath = styles.showLogo !== false ? (styles.logoPath || '') : '';
        fontFamily = styles.fontFamily || 'Doran';
        footerText = styles.footerText || footerText;
      }
    } catch { /* use defaults */ }

    // Load sizes map for dimensions
    const { data: sizesData } = await supabase.from('sizes').select('name, width, height, installation_price');
    const sizesMap: Record<string, { width: number; height: number; installPrice: number }> = {};
    (sizesData || []).forEach((s: any) => {
      sizesMap[s.name] = { width: s.width || 0, height: s.height || 0, installPrice: s.installation_price || 0 };
    });

    // Group accounts by contract
    const groupedByContract: Record<number, TeamAccount[]> = {};
    filteredAccounts.forEach(a => {
      if (!groupedByContract[a.contract_id]) groupedByContract[a.contract_id] = [];
      groupedByContract[a.contract_id].push(a);
    });

    const contractIds = [...new Set(filteredAccounts.map(a => a.contract_id))];
    const taskItemIds = [...new Set(filteredAccounts.map(a => a.task_item_id).filter(Boolean))];

    // Load contract info, installation tasks, task items with billboard details - all in parallel
    const [contractsRes, taskItemsRes, installTasksRes] = await Promise.all([
      contractIds.length ? supabase.from('Contract').select('"Contract_Number", "Customer Name", "Ad Type", "Renewal Status"').in('Contract_Number', contractIds) : Promise.resolve({ data: [] }),
      taskItemIds.length ? supabase.from('installation_task_items').select('*, billboard:billboards!installation_task_items_billboard_id_fkey(ID, Billboard_Name, Size, Faces_Count, design_face_a, design_face_b, has_cutout, Image_URL, Nearest_Landmark, billboard_type)').in('id', taskItemIds) : Promise.resolve({ data: [] }),
      // Get unique task_ids from task items to determine task_type
      taskItemIds.length ? supabase.from('installation_task_items').select('task_id').in('id', taskItemIds) : Promise.resolve({ data: [] }),
    ]);

    const contractInfoMap: Record<number, { customerName: string; adType: string; renewalStatus: string }> = {};
    ((contractsRes as any).data || []).forEach((c: any) => {
      contractInfoMap[c.Contract_Number] = {
        customerName: c['Customer Name'] || '',
        adType: c['Ad Type'] || '',
        renewalStatus: c['Renewal Status'] || '',
      };
    });

    const taskItemById: Record<string, any> = {};
    ((taskItemsRes as any).data || []).forEach((item: any) => { taskItemById[item.id] = item; });

    // Get task types
    const uniqueTaskIds: string[] = [...new Set(((installTasksRes as any).data || []).map((t: any) => t.task_id).filter(Boolean))] as string[];
    let installTaskTypeMap: Record<string, string> = {};
    if (uniqueTaskIds.length > 0) {
      const { data: tasksData } = await supabase.from('installation_tasks').select('id, task_type').in('id', uniqueTaskIds);
      (tasksData || []).forEach((t: any) => { installTaskTypeMap[t.id] = t.task_type || 'installation'; });
    }

    // Load billboard history for installed images
    const billboardIds = [...new Set(filteredAccounts.map(a => a.billboard_id))];
    let historyMap: Record<string, any> = {};
    if (billboardIds.length > 0 && contractIds.length > 0) {
      const { data: histData } = await supabase.from('billboard_history')
        .select('billboard_id, contract_number, installed_image_face_a_url, installed_image_face_b_url, design_face_a_url, design_face_b_url')
        .in('billboard_id', billboardIds).in('contract_number', contractIds);
      (histData || []).forEach((h: any) => { historyMap[`${h.billboard_id}_${h.contract_number}`] = h; });
    }

    const totalInstallation = filteredAccounts.reduce((s, a) => s + getEffectiveAccountAmount(a), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const pendingTotal = filteredAccounts.filter(a => a.status === 'pending').reduce((s, a) => s + getEffectiveAccountAmount(a), 0);
    const paidTotal = filteredAccounts.filter(a => a.status === 'paid').reduce((s, a) => s + getEffectiveAccountAmount(a), 0);
    const grandTotal = totalInstallation + totalExpenses;

    const sortedContractIds = contractIds.sort((a, b) => b - a);

    const contractSections = sortedContractIds.map((contractId, cIdx) => {
      const contractAccounts = groupedByContract[contractId] || [];
      const info = contractInfoMap[contractId] || { customerName: '', adType: '', renewalStatus: '' };
      const contractTotal = contractAccounts.reduce((s, a) => s + getEffectiveAccountAmount(a), 0);
      const contractExpenses = contractAccounts.reduce((s, a) => s + getAccountExpensesTotal(a.id), 0);

      // Determine task type (new installation vs reinstallation)
      let isRenewal = info.renewalStatus === 'renewed' || info.renewalStatus === 'إعادة تركيب';
      contractAccounts.forEach(a => {
        const ti = taskItemById[a.task_item_id];
        if (ti?.task_id && installTaskTypeMap[ti.task_id] === 'reinstallation') isRenewal = true;
      });
      const contractTypeLabel = isRenewal ? 'إعادة تركيب' : 'تركيب جديد';

      // Build detailed items with faces
      interface StatementItem {
        billboardImage: string;
        billboardName: string;
        billboardId: number;
        groupKey: string;
        sizeName: string;
        face: 'a' | 'b';
        designImage: string;
        installedImage: string;
        area: number;
        amount: number;
        facesCount: number;
        billboardType: string;
        status: string;
        installDate: string;
      }

      const items: StatementItem[] = [];
      let billboardCounter = 0;

      contractAccounts.forEach((account, idx) => {
        const ti = taskItemById[account.task_item_id];
        const billboard = ti?.billboard;
        const history = historyMap[`${account.billboard_id}_${account.contract_id}`];
        const key = getBillboardContractKey(account.billboard_id, account.contract_id);
        const details = billboardDetails[key];
        const amount = getEffectiveAccountAmount(account);
        const sizeName = billboard?.Size || details?.size || '';
        const dims = sizesMap[sizeName] || { width: 0, height: 0, installPrice: 0 };
        const areaPerFace = dims.width * dims.height;
        const actualFacesCount = ti?.faces_to_install ?? billboard?.Faces_Count ?? 1;
        const hasBackFace = actualFacesCount >= 2;
        const hasCutout = billboard?.has_cutout;
        const displaySizeName = hasCutout ? `${sizeName} (مجسم)` : sizeName;
        const gKey = `${account.billboard_id}-${account.id}-${idx}`;

        // Design images
        const faceADesign = ti?.design_face_a || billboard?.design_face_a || history?.design_face_a_url || '';
        const faceBDesign = hasBackFace ? (ti?.design_face_b || billboard?.design_face_b || history?.design_face_b_url || '') : '';

        // Installed images - check all possible sources including details
        const faceAInstalled = ti?.installed_image_face_a_url || ti?.installed_image_url || history?.installed_image_face_a_url || details?.installation_image_url || '';
        const faceBInstalled = hasBackFace ? (ti?.installed_image_face_b_url || history?.installed_image_face_b_url || '') : '';
        console.log(`[كشف] لوحة ${account.billboard_id}: وجوه=${actualFacesCount}, صورة_أمامي=${!!faceAInstalled}, صورة_خلفي=${!!faceBInstalled}, ti_b=${ti?.installed_image_face_b_url || 'فارغ'}, hist_b=${history?.installed_image_face_b_url || 'فارغ'}`);

        // Front face
        items.push({
          billboardImage: billboard?.Image_URL || details?.image_url || '',
          billboardName: billboard?.Billboard_Name || details?.billboard_name || `لوحة #${account.billboard_id}`,
          billboardId: account.billboard_id,
          groupKey: gKey,
          sizeName: displaySizeName,
          face: 'a',
          designImage: faceADesign,
          installedImage: faceAInstalled,
          area: areaPerFace,
          amount: hasBackFace ? amount / 2 : amount,
          facesCount: actualFacesCount,
          billboardType: billboard?.billboard_type || '',
          status: account.status === 'paid' ? 'مدفوع' : 'معلق',
          installDate: account.installation_date || '',
        });

        // Back face
        if (hasBackFace) {
          items.push({
            billboardImage: billboard?.Image_URL || details?.image_url || '',
            billboardName: billboard?.Billboard_Name || details?.billboard_name || `لوحة #${account.billboard_id}`,
            billboardId: account.billboard_id,
            groupKey: gKey,
            sizeName: displaySizeName,
            face: 'b',
            designImage: faceBDesign,
            installedImage: faceBInstalled,
            area: areaPerFace,
            amount: amount / 2,
            facesCount: actualFacesCount,
            billboardType: billboard?.billboard_type || '',
            status: account.status === 'paid' ? 'مدفوع' : 'معلق',
            installDate: account.installation_date || '',
          });
        }
      });

      // Helpers for rowspan grouping
      const isFirstInGroup = (item: StatementItem, idx: number): boolean => {
        for (let i = 0; i < idx; i++) { if (items[i].groupKey === item.groupKey) return false; }
        return true;
      };
      const getFaceCount = (groupKey: string): number => items.filter(i => i.groupKey === groupKey).length;

      const seenGroups = new Set<string>();
      const tableRowsHtml = items.map((item, idx) => {
        const isFirst = isFirstInGroup(item, idx);
        const faceCount = getFaceCount(item.groupKey);
        if (!seenGroups.has(item.groupKey)) { billboardCounter++; seenGroups.add(item.groupKey); }

        // Expense rows for first item of each group
        let expenseHtml = '';
        if (isFirst && idx < contractAccounts.length) {
          const accountIdx = Array.from(seenGroups).indexOf(item.groupKey);
          const account = contractAccounts[accountIdx >= 0 ? accountIdx : 0];
          if (account) {
            const accExpenses = getAccountExpenses(account.id);
            expenseHtml = accExpenses.map(exp => `
              <tr style="background-color:#fff8e1;">
                <td colspan="3" style="padding:4px;border:1px solid #ccc;text-align:center;font-size:8px;color:#f59e0b;">+مصروف</td>
                <td colspan="${options.showCost ? 4 : 3}" style="padding:4px;border:1px solid #ccc;font-size:8px;">${exp.description}${exp.notes ? ` (${exp.notes})` : ''}</td>
                ${options.showCost ? `<td style="padding:4px;border:1px solid #ccc;text-align:center;font-family:Manrope;font-size:9px;font-weight:bold;color:#f59e0b;">${Number(exp.amount).toLocaleString()} د.ل</td>` : ''}
                <td style="border:1px solid #ccc;"></td>
              </tr>
            `).join('');
          }
        }

        return `
          <tr style="background-color:${idx % 2 === 0 ? '#f5f5f5' : '#ffffff'};">
            ${isFirst ? `<td rowspan="${faceCount}" style="padding:6px 4px;border:1px solid #ccc;text-align:center;vertical-align:middle;">${billboardCounter}</td>` : ''}
            ${isFirst ? `
              <td rowspan="${faceCount}" style="padding:4px;border:1px solid #ccc;text-align:center;vertical-align:middle;">
                ${item.billboardImage ? `<img src="${item.billboardImage}" alt="صورة اللوحة" style="width:100%;max-height:${faceCount > 1 ? '90px' : '60px'};object-fit:contain;border-radius:4px;" onerror="this.style.display='none'" />` : '<span style="color:#999;font-size:8px;">—</span>'}
              </td>
            ` : ''}
            ${isFirst ? `
              <td rowspan="${faceCount}" style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-weight:bold;font-size:9px;vertical-align:middle;">
                ${item.billboardName || '—'}
              </td>
            ` : ''}
            ${isFirst ? `
              <td rowspan="${faceCount}" style="padding:6px 4px;border:1px solid #ccc;text-align:center;vertical-align:middle;">
                <div style="font-weight:bold;font-size:9px;">${item.sizeName || '—'}</div>
                ${item.billboardType ? `<div style="font-size:8px;color:#555;margin-top:2px;"><span style="background:${item.billboardType === 'تيبول' ? '#fff8e1' : '#f3e5f5'};padding:1px 4px;border-radius:3px;color:${item.billboardType === 'تيبول' ? '#f57c00' : '#7b1fa2'};">${item.billboardType}</span></div>` : ''}
                <div style="font-size:8px;color:#666;margin-top:2px;">
                  <span style="background:#e3f2fd;padding:1px 4px;border-radius:3px;color:#1565c0;font-weight:bold;">${faceCount === 1 ? 'وجه واحد' : faceCount === 2 ? 'وجهين' : faceCount + ' أوجه'}</span>
                </div>
              </td>
            ` : ''}
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:8px;">
              ${item.face === 'a' ? '<span style="background:#e8f5e9;padding:2px 6px;border-radius:3px;color:#2e7d32;">أمامي</span>' : '<span style="background:#fff3e0;padding:2px 6px;border-radius:3px;color:#ef6c00;">خلفي</span>'}
            </td>
            <td style="padding:2px;border:1px solid #ccc;text-align:center;">
              ${item.designImage ? `<img src="${item.designImage}" alt="تصميم" style="width:100%;height:45px;object-fit:contain;" onerror="this.style.display='none'" />` : '<span style="color:#999;font-size:8px;">—</span>'}
            </td>
            <td style="padding:2px;border:1px solid #ccc;text-align:center;">
              ${item.installedImage ? `<img src="${item.installedImage}" alt="صورة التركيب" style="width:100%;height:45px;object-fit:contain;" onerror="this.style.display='none'" />` : '<span style="color:#999;font-size:8px;">—</span>'}
            </td>
            ${options.showCost ? `<td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-family:Manrope;font-weight:bold;font-size:9px;background-color:#e5e5e5;">
              ${item.amount > 0 ? item.amount.toLocaleString() + ' د.ل' : '—'}
            </td>` : ''}
            <td style="padding:6px 4px;border:1px solid #ccc;text-align:center;font-size:9px;">
              <span style="background:${item.status === 'مدفوع' ? '#dcfce7' : '#fef3c7'};color:${item.status === 'مدفوع' ? '#166534' : '#92400e'};padding:2px 8px;border-radius:4px;">
                ${item.status}
              </span>
            </td>
          </tr>
          ${expenseHtml}
        `;
      }).join('');

      return `
        ${cIdx > 0 ? '<div style="margin:20px 0;border-top:3px dashed #ccc;"></div>' : ''}
        
        <div style="background:linear-gradient(135deg, #f5f5f5, #ffffff);padding:12px 16px;margin-bottom:12px;border-radius:8px;border-right:5px solid ${isRenewal ? '#f59e0b' : '#1a1a1a'};display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:16px;font-weight:bold;color:#1a1a1a;">
              عقد #${contractId}
              <span style="font-size:11px;margin-right:8px;padding:2px 8px;border-radius:4px;background:${isRenewal ? '#fef3c7' : '#dcfce7'};color:${isRenewal ? '#92400e' : '#166534'};">${contractTypeLabel}</span>
            </div>
            <div style="font-size:12px;color:#666;margin-top:2px;">
              ${info.customerName ? `<span style="margin-left:12px;">العميل: <strong>${info.customerName}</strong></span>` : ''}
              ${info.adType ? `<span>نوع الإعلان: <strong>${info.adType}</strong></span>` : ''}
              <span style="margin-right:12px;">${contractAccounts.length} لوحات</span>
            </div>
          </div>
          ${options.showCost ? `<div style="text-align:center;">
            <div style="font-size:18px;font-weight:bold;color:#D4AF37;font-family:Manrope;">${(contractTotal + contractExpenses).toLocaleString()}</div>
            <div style="font-size:10px;color:#666;">د.ل</div>
          </div>` : ''}
        </div>

        ${options.detailed ? `
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px;">
          <thead>
            <tr style="background-color:#1a1a1a;">
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;width:4%;">#</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;width:10%;">صورة اللوحة</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">اللوحة</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">المقاس</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">الوجه</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;width:12%;">التصميم</th>
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;width:12%;">صورة التركيب</th>
              ${options.showCost ? '<th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">المبلغ</th>' : ''}
              <th style="padding:8px 4px;color:#fff;border:1px solid #333;text-align:center;">الحالة</th>
            </tr>
          </thead>
          <tbody>${tableRowsHtml}</tbody>
          ${options.showCost ? `
          <tfoot>
            <tr style="background-color:#1a1a1a;font-weight:bold;">
              <td colspan="7" style="padding:10px 6px;border:1px solid #333;text-align:center;color:#fff;font-size:11px;">إجمالي العقد #${contractId}</td>
              <td style="padding:10px 6px;border:1px solid #333;text-align:center;font-family:Manrope;font-weight:bold;color:#fff;background-color:#000;font-size:11px;">${(contractTotal + contractExpenses).toLocaleString()} د.ل</td>
              <td style="border:1px solid #333;background-color:#1a1a1a;"></td>
            </tr>
          </tfoot>` : ''}
        </table>
        ` : `
        <div style="font-size:12px;color:#666;margin-bottom:12px;padding:8px;background:#f9f9f9;border-radius:6px;">
          عدد اللوحات: <strong>${contractAccounts.length}</strong>
          ${options.showCost ? ` · الإجمالي: <strong style="font-family:Manrope;">${(contractTotal + contractExpenses).toLocaleString()} د.ل</strong>` : ''}
        </div>
        `}
      `;
    }).join('');

    const baseUrl = window.location.origin;
    const fullLogoUrl = logoPath ? (logoPath.startsWith('http') ? logoPath : `${baseUrl}${logoPath}`) : '';
    const today = new Date().toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${contractStatementId ? `كشف عقد ${contractStatementId}` : 'كشف حساب كامل'} - ${selectedTeam?.team_name}</title>
        <style>
          @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
          * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
          html,body { font-family:'${fontFamily}','Noto Sans Arabic',Arial,sans-serif; direction:rtl; background:white; color:#000; font-size:10px; }
          .print-container { width:210mm; min-height:297mm; padding:15mm; background:#fff; margin:0 auto; }
          @media print { @page { size:A4; margin:15mm; } .print-container { width:100%; min-height:auto; padding:0; } }
        </style>
      </head>
      <body>
        <div class="print-container">
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:15px;border-bottom:3px solid #1a1a1a;">
           <div style="flex:1;">
              <h1 style="font-size:32px;font-weight:bold;color:#1a1a1a;margin-bottom:8px;">${contractStatementId ? `كشف حساب عقد #${contractStatementId}` : 'كشف حساب فريق التركيب'}</h1>
              <div style="font-size:12px;color:#666;line-height:1.8;">
                <div>التاريخ: ${today}</div>
                <div>عدد العقود: ${sortedContractIds.length} · عدد التركيبات: ${filteredAccounts.length}</div>
              </div>
            </div>
            ${fullLogoUrl ? `<img src="${fullLogoUrl}" style="height:100px;object-fit:contain;" onerror="this.style.display='none'" />` : ''}
          </div>

          <!-- Team Info -->
          <div style="background:linear-gradient(135deg, #f5f5f5, #ffffff);padding:20px;margin-bottom:24px;border-radius:12px;border-right:5px solid #1a1a1a;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:14px;color:#666;margin-bottom:4px;">فريق التركيب</div>
                <div style="font-size:28px;font-weight:bold;color:#1a1a1a;">${selectedTeam?.team_name || ''}</div>
              </div>
              <div style="display:flex;gap:24px;">
                <div style="text-align:center;">
                  <div style="font-size:24px;font-weight:bold;color:#D4AF37;font-family:Manrope;">${sortedContractIds.length}</div>
                  <div style="font-size:12px;color:#666;">عقد</div>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:24px;font-weight:bold;color:#D4AF37;font-family:Manrope;">${accounts.length}</div>
                  <div style="font-size:12px;color:#666;">تركيب</div>
                </div>
              </div>
            </div>
          </div>

          ${options.showCost ? `
          <!-- Summary Stats -->
          <div style="background:#f8f9fa;padding:12px 16px;margin-bottom:20px;border-radius:8px;border:1px solid #e9ecef;">
            <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
              <span style="font-size:12px;font-weight:bold;color:#495057;">ملخص:</span>
              <span style="background:#fff;padding:4px 8px;border-radius:6px;font-size:11px;color:#333;border:1px solid #dee2e6;">
                إجمالي التركيب: <strong style="font-family:Manrope;">${totalInstallation.toLocaleString()}</strong> د.ل
              </span>
              ${totalExpenses > 0 ? `<span style="background:#fff;padding:4px 8px;border-radius:6px;font-size:11px;color:#333;border:1px solid #dee2e6;">
                مصاريف إضافية: <strong style="font-family:Manrope;">${totalExpenses.toLocaleString()}</strong> د.ل
              </span>` : ''}
              <span style="background:#fef3c7;padding:4px 8px;border-radius:6px;font-size:11px;color:#92400e;border:1px solid #fde68a;font-weight:bold;">
                معلق: <strong style="font-family:Manrope;">${pendingTotal.toLocaleString()}</strong> د.ل
              </span>
              <span style="background:#dcfce7;padding:4px 8px;border-radius:6px;font-size:11px;color:#166534;border:1px solid #bbf7d0;font-weight:bold;">
                مدفوع: <strong style="font-family:Manrope;">${paidTotal.toLocaleString()}</strong> د.ل
              </span>
            </div>
          </div>
          ` : ''}

          <!-- Contract Details -->
          ${contractSections}

          ${options.showCost ? `
          <!-- Total Section -->
          <div style="background:linear-gradient(135deg, #1a1a1a, #000);padding:20px;text-align:center;border-radius:8px;margin-top:20px;">
            <div style="font-size:14px;color:#fff;opacity:0.9;margin-bottom:6px;">الإجمالي المستحق</div>
            <div style="font-size:28px;font-weight:bold;color:#D4AF37;font-family:Manrope;">
              ${grandTotal.toLocaleString()}
              <span style="font-size:16px;margin-right:8px;">دينار ليبي</span>
            </div>
            <div style="display:flex;justify-content:center;gap:30px;margin-top:8px;font-size:11px;">
              <span style="color:#fca5a5;">معلق: ${pendingTotal.toLocaleString()} د.ل</span>
              <span style="color:#86efac;">مدفوع: ${paidTotal.toLocaleString()} د.ل</span>
            </div>
          </div>
          ` : ''}

          ${options.showStampSignature ? `
          <div style="margin-top:40px;padding-top:20px;border-top:2px dashed #ccc;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div style="flex:1;text-align:center;padding-left:20px;">
                <div style="font-size:14px;font-weight:bold;color:#333;margin-bottom:60px;">الختم</div>
                <div style="border-top:2px solid #333;width:120px;margin:0 auto;"></div>
              </div>
              <div style="flex:1;text-align:center;padding-right:20px;">
                <div style="font-size:14px;font-weight:bold;color:#333;margin-bottom:60px;">التوقيع</div>
                <div style="border-top:2px solid #333;width:120px;margin:0 auto;"></div>
              </div>
            </div>
          </div>
          ` : ''}

          <div style="margin-top:30px;padding-top:15px;border-top:1px solid #D4AF37;text-align:center;font-size:10px;color:#666;">
            ${footerText}
          </div>
        </div>
      </body>
      </html>
    `;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 800);
    }
    setContractStatementId(null);
  };

  // Per-contract statement - uses the same full statement design but for a single contract
  const handlePrintContractStatement = (contractId: number) => {
    const contractAccounts = accounts.filter(a => a.contract_id === contractId);
    if (contractAccounts.length === 0) return;
    setContractStatementId(contractId);
    setFullStatementDialogOpen(true);
  };

  const selectedTeam = summaries.find(s => s.team_id === selectedTeamId);

  // Team detail stats
  const teamDetailStats = useMemo(() => {
    const pending = accounts.filter(a => a.status === 'pending');
    const paid = accounts.filter(a => a.status === 'paid');
    const pendingAmount = pending.reduce((s, a) => s + getEffectiveAccountAmount(a), 0);
    const paidAmount = paid.reduce((s, a) => s + getEffectiveAccountAmount(a), 0);
    const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
    return { pendingCount: pending.length, paidCount: paid.length, pendingAmount, paidAmount, total: pendingAmount + paidAmount, expensesTotal };
  }, [accounts, billboardDetails, sizePricing, expenses]);

  const paidPct = teamDetailStats.total > 0 ? Math.round((teamDetailStats.paidAmount / teamDetailStats.total) * 100) : 0;

  // Filtered summaries for team cards
  const filteredSummaries = useMemo(() => {
    if (!searchTerm) return summaries;
    return summaries.filter(s => s.team_name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [summaries, searchTerm]);

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">حسابات فرق التركيب</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">إدارة ومتابعة مستحقات فرق التركيب</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCharts(!showCharts)} className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            {showCharts ? 'إخفاء الإحصائيات' : 'إحصائيات'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { loadSummaries(); if (selectedTeamId) loadTeamAccounts(selectedTeamId); }} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            تحديث
          </Button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/15">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">عدد الفرق</p>
                <p className="text-xl font-bold">{overallStats.totalTeams}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/15">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي التركيبات</p>
                <p className="text-xl font-bold">{overallStats.totalInstallations}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-500/15">
                <Wallet className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي المعلق</p>
                <p className="text-lg font-bold text-orange-500">
                  {overallStats.totalPending.toLocaleString('en-US')} <span className="text-xs">د.ل</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/15">
                <PiggyBank className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي المدفوع</p>
                <p className="text-lg font-bold text-emerald-500">
                  {overallStats.totalPaid.toLocaleString('en-US')} <span className="text-xs">د.ل</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      {showCharts && summaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">نسبة المعلق / المدفوع</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toLocaleString('en-US')} د.ل`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">مقارنة الفرق</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical" margin={{ right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString('en-US')} د.ل`} />
                  <Legend />
                  <Bar dataKey="معلق" fill="#f97316" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="مدفوع" fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search (when no team selected) */}
      {!selectedTeamId && (
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن فريق..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
      )}

      {/* Team Cards */}
      {!selectedTeamId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
              <p className="text-muted-foreground mt-4">جاري التحميل...</p>
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">لا توجد فرق</div>
          ) : (
            filteredSummaries.map((summary) => {
              const pct = summary.total_amount > 0 ? Math.round((summary.paid_amount / summary.total_amount) * 100) : 0;
              return (
                <Card
                  key={summary.team_id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01] ${selectedTeamId === summary.team_id ? 'ring-2 ring-primary shadow-lg bg-primary/5' : 'hover:bg-muted/30'}`}
                  onClick={() => { setSelectedTeamId(summary.team_id); setSearchTerm(''); setFilterStatus('all'); }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary/10">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-base">{summary.team_name}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="text-xs">{summary.total_installations} تركيب</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>نسبة السداد</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-lg bg-orange-500/5 border border-orange-500/10">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-orange-500" />
                        <span className="text-xs">معلق ({summary.pending_count})</span>
                      </div>
                      <span className="text-sm font-bold text-orange-500">{summary.pending_amount.toLocaleString('en-US')} د.ل</span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs">مدفوع ({summary.paid_count})</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-500">{summary.paid_amount.toLocaleString('en-US')} د.ل</span>
                    </div>

                    <div className="pt-2 border-t border-border/50">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-xs">الإجمالي</span>
                        <span className="font-bold text-primary text-base">{summary.total_amount.toLocaleString('en-US')} د.ل</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Team Details */}
      {selectedTeamId && (
        <Card className="shadow-lg overflow-hidden">
          <CardHeader className="border-b bg-muted/30 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => { setSelectedTeamId(null); setSearchTerm(''); setFilterStatus('all'); }}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{selectedTeam?.team_name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{Object.keys(groupedAccounts).length} عقود - {filteredAccounts.length} لوحات</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handlePrintTeamInvoice} className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" />
                  كشف الحساب
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setContractStatementId(null); setFullStatementDialogOpen(true); }} className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  كشف كامل
                </Button>

                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20">
                    <span className="text-xs text-muted-foreground">
                      {selectedIds.size} لوحة | <span className="font-bold text-primary">{selectedAmount.toLocaleString('ar-LY')} د.ل</span>
                    </span>
                    <Button size="sm" onClick={handleBulkPayment} className="gap-1 h-7 text-xs">
                      <CreditCard className="h-3 w-3" />
                      تسديد
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-2.5 text-center">
                <p className="text-xs text-muted-foreground">معلق ({teamDetailStats.pendingCount})</p>
                <p className="text-sm font-bold text-orange-500">{teamDetailStats.pendingAmount.toLocaleString('ar-LY')} د.ل</p>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5 text-center">
                <p className="text-xs text-muted-foreground">مدفوع ({teamDetailStats.paidCount})</p>
                <p className="text-sm font-bold text-emerald-500">{teamDetailStats.paidAmount.toLocaleString('ar-LY')} د.ل</p>
              </div>
              {teamDetailStats.expensesTotal > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-muted-foreground">مصاريف إضافية</p>
                  <p className="text-sm font-bold text-amber-500">{teamDetailStats.expensesTotal.toLocaleString('ar-LY')} د.ل</p>
                </div>
              )}
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-2.5 text-center">
                <p className="text-xs text-muted-foreground">نسبة السداد</p>
                <p className="text-sm font-bold text-primary">{paidPct}%</p>
                <Progress value={paidPct} className="h-1 mt-1" />
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mt-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="بحث باللوحة أو الزبون أو العقد..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-9 h-8 text-xs"
                />
              </div>
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <Filter className="h-3 w-3 ml-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="pending">معلق فقط</SelectItem>
                  <SelectItem value="paid">مدفوع فقط</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
                <p className="text-muted-foreground mt-4">جاري التحميل...</p>
              </div>
            ) : Object.keys(groupedAccounts).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{searchTerm || filterStatus !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد حسابات لهذا الفريق'}</p>
              </div>
            ) : (
              Object.entries(groupedAccounts).map(([contractId, contractAccounts]) => {
                const firstAccount = contractAccounts[0];
                const firstKey = firstAccount ? getBillboardContractKey(firstAccount.billboard_id, firstAccount.contract_id) : '';
                const customerName = billboardDetails[firstKey]?.customer_name || '';
                return (
                  <div key={contractId} className="space-y-2">
                    <ContractBillboardsGroup
                      contractId={Number(contractId)}
                      customerName={customerName}
                      accounts={contractAccounts}
                      billboardDetails={billboardDetails}
                      sizePricing={sizePricing}
                      selectedIds={selectedIds}
                      onSelectionChange={setSelectedIds}
                      onUpdateAmount={handleUpdateAmount}
                      onPrintContractStatement={handlePrintContractStatement}
                      getBillboardContractKey={getBillboardContractKey}
                      billboardGpsData={billboardGpsData}
                    />
                    {/* Expenses for billboards in this contract */}
                    {contractAccounts.some(a => getAccountExpenses(a.id).length > 0) && (
                      <div className="mr-4 space-y-1">
                        {contractAccounts.map(a => {
                          const accExpenses = getAccountExpenses(a.id);
                          if (accExpenses.length === 0) return null;
                          const key = getBillboardContractKey(a.billboard_id, a.contract_id);
                          const details = billboardDetails[key];
                          return (
                            <div key={a.id} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                              <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                                مصاريف إضافية - {details?.billboard_name || `لوحة ${a.billboard_id}`}
                              </div>
                              {accExpenses.map(exp => (
                                <div key={exp.id} className="flex items-center justify-between text-xs py-0.5">
                                  <span>{exp.description}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-amber-600">{Number(exp.amount).toLocaleString('ar-LY')} د.ل</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleDeleteExpense(exp.id)}>
                                      <Trash2 className="h-3 w-3 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Add expense button per contract */}
                    <div className="mr-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-amber-600 hover:text-amber-700 gap-1"
                        onClick={() => {
                          // Open dialog to pick which billboard in this contract
                          setExpenseTargetAccountId(contractAccounts[0].id);
                          setExpenseDialogOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        إضافة مصروف
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              تسديد مستحقات الفريق
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/10 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">عدد اللوحات</span>
                <span className="font-bold">{selectedIds.size}</span>
              </div>
              <div className="flex justify-between items-center text-lg">
                <span className="text-sm">المبلغ الإجمالي</span>
                <span className="font-bold text-primary">{selectedAmount.toLocaleString('ar-LY')} د.ل</span>
              </div>
            </div>
            <div>
              <Label>طريقة الدفع</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="bank">تحويل بنكي</SelectItem>
                  <SelectItem value="check">شيك</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={3} placeholder="إضافة ملاحظات..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>إلغاء</Button>
              <Button onClick={processPayment} disabled={processingPayment}>
                {processingPayment ? 'جاري المعالجة...' : 'تأكيد السداد'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              إضافة مصروف إضافي
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Billboard selector if multiple accounts in context */}
            {expenseTargetAccountId && (
              <div>
                <Label>اللوحة</Label>
                <Select value={expenseTargetAccountId} onValueChange={setExpenseTargetAccountId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => {
                      const key = getBillboardContractKey(a.billboard_id, a.contract_id);
                      const details = billboardDetails[key];
                      return (
                        <SelectItem key={a.id} value={a.id}>
                          {details?.billboard_name || `لوحة ${a.billboard_id}`} - عقد #{a.contract_id}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>الوصف</Label>
              <Input value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} placeholder="مثال: أجرة رافعة..." />
            </div>
            <div>
              <Label>المبلغ (د.ل)</Label>
              <Input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>ملاحظات (اختياري)</Label>
              <Textarea value={expenseNotes} onChange={e => setExpenseNotes(e.target.value)} rows={2} placeholder="ملاحظات إضافية..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExpenseDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handleAddExpense}>إضافة المصروف</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <TeamPaymentReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        payment={receiptData}
        teamName={selectedTeam?.team_name || ''}
      />

      {/* Full Statement Options Dialog */}
      <FullStatementOptionsDialog
        open={fullStatementDialogOpen}
        onOpenChange={setFullStatementDialogOpen}
        onConfirm={handlePrintFullStatement}
        printerName={selectedTeam?.team_name}
      />
    </div>
  );
}
