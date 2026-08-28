import React, { useMemo, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Eye, Edit, Trash2, Calendar, User, DollarSign, 
  Building, AlertCircle, Clock, CheckCircle, Printer, 
  Hammer, Wrench, Percent, PaintBucket, FileText, 
  Send, FileSpreadsheet, MoreHorizontal, Phone,
  TrendingUp, TrendingDown, Minus, ImageIcon, RefreshCw,
  Maximize2, X, MapPin, Landmark, ChevronDown, ChevronLeft, ChevronRight,
  AlertTriangle, Ruler, Navigation, FileArchive
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Contract } from '@/services/contractService';
import { useNavigate } from 'react-router-dom';

import { SendContractDialog } from './SendContractDialog';
import { ContractDelayAlert } from './ContractDelayAlert';
import { DesignZoomViewer } from './DesignZoomViewer';

import { EnhancedDistributePaymentDialog } from '@/components/billing/EnhancedDistributePaymentDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { resolveContractMarketingVisibility } from '@/services/billboardAvailabilityService';

const dominantColorCache = new Map<string, string | null>();
const contractDesignCache = new Map<number, string[]>();

interface ContractCardProps {
  contract: Contract;
  yearlyCode?: string;
  onDelete: (id: string) => void;
  onPrint: (contract: Contract) => void;
  onInstall: (contract: Contract) => void;
  onBillboardPrint: (contract: Contract) => void;
  onPrintAll?: (contract: Contract) => void;
  onExport: (contract: Contract, type: 'basic' | 'detailed' | 'installation' | 'csv' | 'zip' | 'review') => void;
  onRefresh: () => void;
  isSelected?: boolean;
  onToggleSelect?: (contractId: string | number) => void;
}

const ContractCardComponent: React.FC<ContractCardProps> = ({
  contract,
  yearlyCode,
  onDelete,
  onPrint,
  onInstall,
  onBillboardPrint,
  onPrintAll,
  onExport,
  onRefresh,
  isSelected = false,
  onToggleSelect
}) => {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [designImages, setDesignImages] = useState<string[]>([]);
  const [currentDesignIndex, setCurrentDesignIndex] = useState(0);
  const designImage = designImages.length > 0 ? designImages[currentDesignIndex] : null;
  const [dominantHsl, setDominantHsl] = useState<string | null>(null);
  const [actualPaid, setActualPaid] = useState<number | null>(null);
  const [contractPayments, setContractPayments] = useState<Array<{ id: string; amount: number; distributed_payment_id: string | null; paid_at: string; rowNumber: number }>>([]);
  const [isRenewing, setIsRenewing] = useState(false);
  const [showDesignFullscreen, setShowDesignFullscreen] = useState(false);
  const [distributeDialogOpen, setDistributeDialogOpen] = useState(false);
  const [delayRefreshKey, setDelayRefreshKey] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [suspensionDiscount, setSuspensionDiscount] = useState<number>(0);
  const [customerData, setCustomerData] = useState<{ phone: string | null; company: string | null } | null>(null);
  const [approachingDeadlineCount, setApproachingDeadlineCount] = useState(0);
  const [detectedPreviousContract, setDetectedPreviousContract] = useState<number | null>(null);
  const [showInAvailable, setShowInAvailable] = useState(false);
  const [togglingAvailable, setTogglingAvailable] = useState(false);
  const [installationTasks, setInstallationTasks] = useState<{
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    tasks: Array<{ id: string; billboard_name: string; status: string; installation_date: string | null; nearest_landmark: string | null; district: string | null }>;
  }>({ total: 0, completed: 0, inProgress: 0, pending: 0, tasks: [] });

  // Lazy loading: only fetch data when card is visible
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // استخدام البيانات المُجلبة مسبقاً من الـ view إذا كانت متاحة
  useEffect(() => {
    const c = contract as any;
    // بيانات العميل من الـ view
    if (c.customer_phone !== undefined || c.customer_company !== undefined) {
      setCustomerData({ phone: c.customer_phone || null, company: c.customer_company || null });
    } else if (isVisible && c.customer_id) {
      // Fallback: جلب من قاعدة البيانات
      supabase.from('customers').select('phone, company').eq('id', c.customer_id).single()
        .then(({ data }) => { if (data) setCustomerData(data); });
    }
    // المصاريف من الـ view
    if (c.total_expenses_amount !== undefined) {
      setTotalExpenses(Number(c.total_expenses_amount) || 0);
    } else if (isVisible) {
      const contractNum = Number(contract.Contract_Number ?? contract.id);
      if (contractNum && !isNaN(contractNum)) {
        supabase.from('contract_expenses').select('amount').eq('contract_number', contractNum)
          .then(({ data }) => { if (data) setTotalExpenses(data.reduce((sum, e) => sum + Number(e.amount), 0)); });
      }
    }
    // المدفوعات من الـ view
    if (c.actual_paid !== undefined && c.actual_paid !== null) {
      setActualPaid(Number(c.actual_paid));
    }
    // جلب خصم الإيقاف من جدول paused_billboards
    if (isVisible && detailsOpen) {
      const contractNum = Number(contract.Contract_Number ?? contract.id);
      if (contractNum && !isNaN(contractNum)) {
        supabase.from('paused_billboards' as any).select('refund_amount').eq('contract_number', contractNum)
          .then(({ data, error }) => {
            if (!error && data) {
              const sum = data.reduce((acc, pb: any) => acc + (Number(pb.refund_amount) || 0), 0);
              setSuspensionDiscount(sum);
            }
          });
      }
    }
  }, [contract, detailsOpen, isVisible]);

  const [visibilityState, setVisibilityState] = useState<'ALL_ON' | 'ALL_OFF' | 'MIXED'>('ALL_OFF');
  const [forceVisibleCount, setForceVisibleCount] = useState<number>(0);
  const [forceHiddenCount, setForceHiddenCount] = useState<number>(0);
  const [totalContractBoards, setTotalContractBoards] = useState<number>(0);

  // فحص حالة إظهار لوحات العقد في المتاح باستخدام المحرك الموحد ومصدر الحقيقة على مستوى العقد
  useEffect(() => {
    if (!isVisible || !detailsOpen) return;
    const isContractActivated = (contract as any).is_visible_in_available === true;
    const billboardIdsStr = (contract as any).billboard_ids;
    if (!billboardIdsStr) {
      setVisibilityState('ALL_OFF');
      setShowInAvailable(false);
      return;
    }
    const ids = billboardIdsStr.split(',').map((s: string) => Number(s.trim())).filter((n: number) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) {
      setVisibilityState('ALL_OFF');
      setShowInAvailable(false);
      return;
    }
    supabase.from('billboards').select('ID, is_visible_in_available').in('ID', ids)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const visInfo = resolveContractMarketingVisibility(data as any);

          setTotalContractBoards(visInfo.totalCount);
          setForceVisibleCount(visInfo.forceShowCount);
          setForceHiddenCount(visInfo.forceHideCount);

          if (!isContractActivated) {
            setVisibilityState('ALL_OFF');
            setShowInAvailable(false);
          } else if (visInfo.state === 'ON') {
            setVisibilityState('ALL_ON');
            setShowInAvailable(true);
          } else {
            // Contract is explicitly activated, but some or all boards might be blocked/hidden
            setVisibilityState('MIXED');
            setShowInAvailable(true);
          }
        }
      });
  }, [detailsOpen, isVisible, contract]);

  // جلب مهام التركيب المرتبطة بالعقد
  useEffect(() => {
    if (!isVisible || !detailsOpen) return;
    const fetchInstallationTasks = async () => {
      const contractNumber = Number(
        (contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? contract.id
      );
      if (!Number.isFinite(contractNumber)) return;

      try {
        // جلب billboard_ids من العقد للفلترة
        const contractBillboardIds = new Set<number>();
        const billboardIdsStr = (contract as any).billboard_ids;
        if (billboardIdsStr) {
          billboardIdsStr.split(',').forEach((id: string) => {
            const num = Number(id.trim());
            if (Number.isFinite(num)) contractBillboardIds.add(num);
          });
        }

        // 1. جلب مهام التركيب المباشرة لهذا العقد
        const { data: directTasks } = await supabase
          .from('installation_tasks')
          .select('id, status, contract_id')
          .eq('contract_id', contractNumber);

        // 2. جلب مهام التركيب المدمجة (contract_ids يحتوي على هذا العقد)
        const { data: combinedTasks } = await supabase
          .from('installation_tasks')
          .select('id, status, contract_id')
          .contains('contract_ids', [contractNumber]);

        // 3. جلب مهام التركيب عبر composite_tasks
        const { data: compositeTasks } = await supabase
          .from('composite_tasks')
          .select('installation_task_id')
          .eq('contract_id', contractNumber)
          .not('installation_task_id', 'is', null);

        const allTaskIds = new Set<string>();
        [...(directTasks || []), ...(combinedTasks || [])].forEach(t => allTaskIds.add(t.id));
        (compositeTasks || []).forEach(t => { if (t.installation_task_id) allTaskIds.add(t.installation_task_id); });

        if (allTaskIds.size === 0) {
          setInstallationTasks({ total: 0, completed: 0, inProgress: 0, pending: 0, tasks: [] });
          return;
        }

        // جلب عناصر المهام (اللوحات) لهذه المهام
        const { data: items } = await supabase
          .from('installation_task_items')
          .select(`
            id, task_id, billboard_id, status, installation_date, selected_design_id,
            billboard:billboards!installation_task_items_billboard_id_fkey(Billboard_Name, Contract_Number, Nearest_Landmark, District),
            task:installation_tasks!installation_task_items_task_id_fkey(task_type)
          `)
          .in('task_id', Array.from(allTaskIds));

        // جميع العناصر ذات صلة لأن المهام نفسها مرتبطة بالعقد
        // فلترة إضافية فقط إذا كان لدينا billboard_ids للدقة
        const relevantItems = (items || []).filter(item => {
          // إذا لم يكن لدينا قائمة محددة من اللوحات، نقبل كل العناصر
          if (contractBillboardIds.size === 0) return true;
          const billboard = item.billboard as any;
          if (billboard?.Contract_Number === contractNumber) return true;
          if (item.billboard_id && contractBillboardIds.has(item.billboard_id)) return true;
          return false;
        });

        // تجميع العناصر حسب billboard_id لتجنب التكرار (في حال وجود مهام متعددة لنفس اللوحة)
        const uniqueBillboards = new Map<number, typeof relevantItems[0]>();
        relevantItems.forEach(item => {
          if (item.billboard_id && !uniqueBillboards.has(item.billboard_id)) {
            uniqueBillboards.set(item.billboard_id, item);
          }
        });
        const uniqueItems = Array.from(uniqueBillboards.values());

        const completed = uniqueItems.filter(i => i.status === 'completed').length;
        const inProgress = uniqueItems.filter(i => i.status === 'in_progress').length;
        const pending = uniqueItems.length - completed - inProgress;

        // إعطاء الأولوية: جاري التركيب أولاً، ثم المعلقة (بدون المكتملة)
        const nonCompletedItems = uniqueItems.filter(i => i.status !== 'completed');
        const sortedItems = [...nonCompletedItems].sort((a, b) => {
          const order = { 'in_progress': 0, 'pending': 1 };
          return (order[a.status as keyof typeof order] ?? 1) - (order[b.status as keyof typeof order] ?? 1);
        });
        const tasksData = sortedItems.slice(0, 2).map(item => ({
          id: item.id,
          billboard_name: (item.billboard as any)?.Billboard_Name || `لوحة ${item.billboard_id}`,
          status: item.status || 'pending',
          installation_date: item.installation_date,
          nearest_landmark: (item.billboard as any)?.Nearest_Landmark || null,
          district: (item.billboard as any)?.District || null
        }));

        setInstallationTasks({
          total: uniqueItems.length,
          completed,
          inProgress,
          pending,
          tasks: tasksData
        });

        // حساب اللوحات التي تقترب من انتهاء مهلة التركيب (15 يوم)
        const pendingWithDesign = uniqueItems.filter(i => 
          i.status !== 'completed' && 
          i.selected_design_id && 
          !i.installation_date &&
          (i.task as any)?.task_type !== 'reinstallation'
        );
        if (pendingWithDesign.length > 0) {
          const designIds = [...new Set(pendingWithDesign.map(i => i.selected_design_id).filter(Boolean))] as string[];
          const { data: designs } = await supabase
            .from('task_designs')
            .select('id, created_at')
            .in('id', designIds);
          
          if (designs) {
            const designDates: Record<string, string> = {};
            designs.forEach(d => { designDates[d.id] = d.created_at; });
            const today = new Date();
            const MAX_DAYS = 15;
            const WARN_DAYS = 3; // تنبيه عندما يتبقى 3 أيام أو أقل
            let approaching = 0;
            for (const item of pendingWithDesign) {
              const createdAt = designDates[item.selected_design_id!];
              if (!createdAt) continue;
              const deadline = new Date(createdAt);
              deadline.setDate(deadline.getDate() + MAX_DAYS);
              const remainingMs = deadline.getTime() - today.getTime();
              const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
              if (remainingDays <= WARN_DAYS && remainingDays > 0) {
                approaching++;
              }
            }
            setApproachingDeadlineCount(approaching);
          }
        }
      } catch (error) {
        console.error('Error fetching installation tasks:', error);
      }
    };

    fetchInstallationTasks();
  }, [contract, detailsOpen, isVisible]);

  // كشف تلقائي للعقد السابق (التجديد) عند عدم وجود previous_contract_number
  useEffect(() => {
    if (!isVisible || !detailsOpen) return;
    const c = contract as any;
    if (c.previous_contract_number) return; // already set
    
    const customerName = c['Customer Name'] || c.customer_name;
    const billboardIdsStr = c.billboard_ids;
    const contractNum = Number(c.Contract_Number ?? c['Contract Number'] ?? c.id);
    if (!customerName || !billboardIdsStr || !contractNum) return;

    const currentIds = new Set(billboardIdsStr.split(',').map((s: string) => s.trim()).filter(Boolean));
    if (currentIds.size === 0) return;

    const detectRenewal = async () => {
      try {
        // جلب تاريخ بداية العقد الحالي
        const currentStart = (contract as any)['Contract Date'] || (contract as any).start_date;

        const { data: prevContracts } = await supabase
          .from('Contract')
          .select('Contract_Number, billboard_ids, "End Date"')
          .eq('Customer Name', customerName)
          .lt('Contract_Number', contractNum)
          .not('billboard_ids', 'is', null)
          .order('Contract_Number', { ascending: false })
          .limit(50);

        if (!prevContracts) return;
        
        for (const prev of prevContracts) {
          if (!prev.billboard_ids) continue;
          const prevIds = new Set(prev.billboard_ids.split(',').map((s: string) => s.trim()).filter(Boolean));
          // تحقق من التداخل: إذا كانت 50% أو أكثر من لوحات العقد الحالي موجودة في العقد السابق
          let overlap = 0;
          currentIds.forEach((id: string) => { if (prevIds.has(id)) overlap++; });
          if (overlap >= currentIds.size * 0.5) {
            // تحقق من فارق الوقت: لا يتجاوز شهر بين انتهاء السابق وبداية الحالي
            const prevEnd = (prev as any)['End Date'];
            if (prevEnd && currentStart) {
              const prevEndDate = new Date(prevEnd);
              const currStartDate = new Date(currentStart);
              const diffMs = Math.abs(currStartDate.getTime() - prevEndDate.getTime());
              const diffDays = diffMs / (1000 * 60 * 60 * 24);
              if (diffDays > 31) continue; // فارق أكثر من شهر، ليس تجديداً
            }
            setDetectedPreviousContract(prev.Contract_Number);
            return;
          }
        }
      } catch {}
    };
    detectRenewal();
  }, [contract, detailsOpen, isVisible]);

  // دالة تجديد العقد - إنشاء عقد جديد من بيانات العقد الحالي
  const handleRenewContract = async () => {
    try {
      setIsRenewing(true);
      
      const contractData = contract as any;
      const billboardIds = contractData.billboard_ids || '';
      
      // حساب التواريخ الجديدة
      const today = new Date();
      const origStart = contractData['Contract Date'] || contractData.start_date;
      const origEnd = contractData['End Date'] || contractData.end_date;
      
      let durationMonths = 3; // افتراضي
      if (origStart && origEnd) {
        const sd = new Date(origStart);
        const ed = new Date(origEnd);
        const diffDays = Math.ceil((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24));
        durationMonths = Math.max(1, Math.round(diffDays / 30));
      }
      
      const newEndDate = new Date(today);
      newEndDate.setMonth(newEndDate.getMonth() + durationMonths);
      
      // إنشاء العقد الجديد
      const { data: newContract, error } = await supabase
        .from('Contract')
        .insert({
          'Customer Name': contractData['Customer Name'] || contractData.customer_name,
          customer_id: contractData.customer_id,
          'Contract Date': today.toISOString().slice(0, 10),
          'End Date': newEndDate.toISOString().slice(0, 10),
          'Ad Type': contractData['Ad Type'] || contractData.ad_type || 'إعلان',
          'Total Rent': contractData['Total Rent'] || contractData.total_rent || 0,
          Discount: 0,
          Total: contractData['Total'] || contractData.total || 0,
          billboard_ids: billboardIds,
          billboards_count: billboardIds ? billboardIds.split(',').filter(Boolean).length : 0,
          customer_category: contractData.customer_category,
          contract_currency: contractData.contract_currency || 'LYD',
          exchange_rate: contractData.exchange_rate || '1',
          installation_cost: contractData.installation_cost || 0,
          installation_enabled: contractData.installation_enabled !== false,
          print_cost: contractData.print_cost || 0,
          print_cost_enabled: contractData.print_cost_enabled || 'false',
          print_price_per_meter: contractData.print_price_per_meter || '0',
          operating_fee_rate: contractData.operating_fee_rate || 3,
          payment_status: 'unpaid',
          'Renewal Status': 'نشط',
          previous_contract_number: contractData.Contract_Number || contractData.contract_number,
        })
        .select('Contract_Number')
        .single();
      
      if (error) throw error;
      
      if (newContract?.Contract_Number) {
        toast.success(`تم إنشاء العقد الجديد رقم ${newContract.Contract_Number}`);
        navigate(`/admin/contracts/edit?contract=${newContract.Contract_Number}`);
      }
    } catch (error) {
      console.error('Error renewing contract:', error);
      toast.error('حدث خطأ أثناء تجديد العقد');
    } finally {
      setIsRenewing(false);
    }
  };

  // فتح رحلة خرائط قوقل لجميع لوحات العقد
  const handleOpenGoogleMapsRoute = async () => {
    try {
      const contractData = contract as any;
      const billboardIdsStr = contractData.billboard_ids || '';
      if (!billboardIdsStr) {
        toast.error('لا توجد لوحات مرتبطة بهذا العقد');
        return;
      }
      const ids = billboardIdsStr.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
      if (ids.length === 0) {
        toast.error('لا توجد لوحات مرتبطة بهذا العقد');
        return;
      }
      const { data: billboards } = await supabase
        .from('billboards')
        .select('GPS_Coordinates')
        .in('ID', ids);
      
      const coords = (billboards || [])
        .map(b => {
          if (!b.GPS_Coordinates) return null;
          const match = b.GPS_Coordinates.match(/([-\d.]+)[,\s]+([-\d.]+)/);
          if (!match) return null;
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (isNaN(lat) || isNaN(lng)) return null;
          return `${lat},${lng}`;
        })
        .filter(Boolean);
      
      if (coords.length === 0) {
        toast.error('لا توجد إحداثيات GPS للوحات هذا العقد');
        return;
      }
      window.open(`https://www.google.com/maps/dir/${coords.join('/')}`, '_blank');
    } catch {
      toast.error('حدث خطأ في جلب بيانات المواقع');
    }
  };

  useEffect(() => {
    if (!isVisible || !detailsOpen) return;
    const fetchActualPayments = async () => {
      const contractNumber = (contract as any).Contract_Number || (contract as any)['Contract Number'] || contract.id;
      const customerId = (contract as any).customer_id;
      
      const { data, error } = await supabase
        .from('customer_payments')
        .select('id, amount, distributed_payment_id, paid_at')
        .eq('contract_number', contractNumber)
        .in('entry_type', ['receipt', 'payment']);
      
      if (!error && data) {
        const total = data.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        setActualPaid(total);
        
        // جلب رقم الصف الفعلي لكل دفعة (نفس الترتيب في صفحة الدفعات)
        let rowNumberMap = new Map<string, number>();
        if (customerId) {
          const { data: allPayments } = await supabase
            .from('customer_payments')
            .select('id, customer_id')
            .eq('customer_id', customerId)
            .order('paid_at', { ascending: true })
            .order('created_at', { ascending: true });
          
          (allPayments || []).forEach((p: any, idx: number) => {
            rowNumberMap.set(p.id, idx + 1);
          });
        }
        
        setContractPayments(data.map(p => ({
          id: p.id,
          amount: Number(p.amount || 0),
          distributed_payment_id: p.distributed_payment_id,
          paid_at: p.paid_at,
          rowNumber: rowNumberMap.get(p.id) || 0
        })));
      }
    };
    
    if ((contract as any).actual_paid !== undefined && (contract as any).actual_paid !== null) {
      setActualPaid(Number((contract as any).actual_paid));
      // Still fetch payment details for distributed payment refs
      fetchActualPayments();
    } else {
      fetchActualPayments();
    }
  }, [contract, detailsOpen, isVisible]);
  
  // حساب القيم
  const totalRent = Number(contract.rent_cost || (contract as any)['Total Rent'] || 0);
  const isInstallationEnabled = (contract as any).installation_enabled !== false && (contract as any).installation_enabled !== 'false' && (contract as any).installation_enabled !== 0 && (contract as any).installation_enabled !== '0';
  const installationCost = isInstallationEnabled ? Number((contract as any).installation_cost || 0) : 0;
  const isPrintCostEnabled = (contract as any).print_cost_enabled === true || (contract as any).print_cost_enabled === 'true' || (contract as any).print_cost_enabled === 1 || (contract as any).print_cost_enabled === '1';
  const printCost = isPrintCostEnabled ? Number((contract as any).print_cost || 0) : 0;

  // حساب إجمالي الأمتار من بيانات اللوحات مع جلب عدد الأوجه من قاعدة البيانات
  const [totalArea, setTotalArea] = useState(0);
  useEffect(() => {
    if (!detailsOpen) return;
    async function calcArea() {
      try {
        const raw = (contract as any).billboards_data;
        if (!raw) { setTotalArea(0); return; }
        const bbs = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(bbs) || bbs.length === 0) { setTotalArea(0); return; }

        // جلب عدد الأوجه والمقاس الفعلي لكل لوحة من قاعدة البيانات
        const ids = bbs.map((b: any) => Number(b.id)).filter((id: number) => !isNaN(id));
        let facesMap: Record<number, number> = {};
        let dbSizeMap: Record<number, string> = {};
        if (ids.length > 0) {
          const { data } = await supabase
            .from('billboards')
            .select('ID, Faces_Count, Size')
            .in('ID', ids);
          if (data) {
            data.forEach((row: any) => {
              facesMap[row.ID] = Number(row.Faces_Count) || 1;
              if (row.Size) dbSizeMap[row.ID] = String(row.Size).trim();
            });
          }
        }

        // جلب اللوحات ذات الوجه الواحد المختار في العقد
        let singleFaceSet = new Set<string>();
        const singleFaceRaw = (contract as any).single_face_billboards;
        if (singleFaceRaw) {
          try {
            const sfIds = typeof singleFaceRaw === 'string' ? JSON.parse(singleFaceRaw) : singleFaceRaw;
            if (Array.isArray(sfIds)) {
              singleFaceSet = new Set(sfIds.map(String));
            }
          } catch {}
        }

        // جلب الأبعاد من جدول المقاسات باستخدام المقاس الفعلي من قاعدة البيانات
        const allSizeNames = [...new Set([
          ...bbs.map((b: any) => String(b.size || b.Size || '').trim()).filter(Boolean),
          ...Object.values(dbSizeMap)
        ])];
        let sizeDimsMap: Record<string, { width: number; height: number }> = {};
        if (allSizeNames.length > 0) {
          const { data: sizesData } = await supabase
            .from('sizes')
            .select('name, width, height')
            .in('name', allSizeNames);
          if (sizesData) {
            sizesData.forEach((s: any) => {
              if (s.width && s.height) {
                sizeDimsMap[s.name.trim()] = { width: Number(s.width), height: Number(s.height) };
              }
            });
          }
        }

        let area = 0;
        bbs.forEach((b: any) => {
          const billboardId = String(b.id);
          // استخدام المقاس الفعلي من قاعدة البيانات أولاً
          const dbSize = dbSizeMap[Number(billboardId)] || '';
          const bbSize = String(b.size || b.Size || '').trim();
          let w = 0, h = 0;

          // أولاً: البحث بالمقاس الفعلي من قاعدة البيانات في جدول المقاسات
          if (dbSize && sizeDimsMap[dbSize]) {
            w = sizeDimsMap[dbSize].width;
            h = sizeDimsMap[dbSize].height;
          } else if (bbSize && sizeDimsMap[bbSize]) {
            w = sizeDimsMap[bbSize].width;
            h = sizeDimsMap[bbSize].height;
          } else {
            // تحليل المقاس الفعلي من قاعدة البيانات أولاً
            const sizeToparse = dbSize || bbSize;
            const match = sizeToparse.match(/(\d+(?:[.,]\d+)?)\s*[×xX*\-]\s*(\d+(?:[.,]\d+)?)/);
            if (match) {
              w = parseFloat(match[1].replace(',', '.'));
              h = parseFloat(match[2].replace(',', '.'));
            }
          }

          if (w > 0 && h > 0) {
            // استخدام عدد الأوجه المختار في العقد
            const dbFaces = facesMap[Number(billboardId)] || 1;
            const faces = singleFaceSet.has(billboardId) ? 1 : dbFaces;
            area += w * h * faces;
          }
        });
        setTotalArea(area);
      } catch {
        setTotalArea(0);
      }
    }
    calcArea();
  }, [contract, detailsOpen]);
  const printEnabled = (contract as any).print_cost_enabled === 'true' || (contract as any).print_cost_enabled === true || (contract as any).include_print_in_billboard_price === true;
  // ✅ احتساب رسوم التشغيل لحظياً ليتطابق مع صفحة تعديل العقد (لا نعتمد على قيمة fee المخزّنة فقط لأنها قد تكون قديمة)
  const operatingFeeRate = Number((contract as any).operating_fee_rate ?? 3) || 0;
  const operatingFeeRateInstall = Number((contract as any).operating_fee_rate_installation ?? operatingFeeRate) || 0;
  const operatingFeeRatePrint = Number((contract as any).operating_fee_rate_print ?? operatingFeeRate) || 0;
  const includeOperatingInInstallation = (contract as any).include_operating_in_installation === true;
  const includeOperatingInPrint = (contract as any).include_operating_in_print === true;
  const installationEnabledFlag = (contract as any).installation_enabled !== false;
  const partnershipOperatingData: any[] = (() => {
    const raw = (contract as any).partnership_operating_data;
    if (!raw) return [];
    try { return typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); } catch { return []; }
  })();
  const partnershipOperatingFeeAmount = partnershipOperatingData.reduce((sum, p) => sum + (Number(p?.operating_fee_amount) || 0), 0);
  const friendOpEnabled = (contract as any).friend_rental_operating_fee_enabled === true;
  const friendOpRate = Number((contract as any).friend_rental_operating_fee_rate ?? 0) || 0;
  const friendCostsTotal = (() => {
    const rawData = (contract as any).friend_rental_data;
    if (!rawData) return 0;
    try {
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      if (Array.isArray(data)) {
        return data.reduce((sum: number, item: any) => sum + (Number(item.friendRentalCost || item.friend_rental_cost) || 0), 0);
      }
    } catch (e) {
      console.warn('Failed to parse friend_rental_data in ContractCard:', e);
    }
    return 0;
  })();
  const friendOperatingFee = friendOpEnabled ? Math.round(friendCostsTotal * (friendOpRate / 100) * 100) / 100 : 0;

  const computedOperatingFee = (() => {
    const regularRentalBase = Math.max(0, totalRent - friendCostsTotal);
    let fee = Math.round(regularRentalBase * (operatingFeeRate / 100) * 100) / 100;
    if (includeOperatingInInstallation && installationEnabledFlag) {
      fee += Math.round(installationCost * (operatingFeeRateInstall / 100) * 100) / 100;
    }
    if (includeOperatingInPrint && printEnabled) {
      fee += Math.round(printCost * (operatingFeeRatePrint / 100) * 100) / 100;
    }
    fee += partnershipOperatingFeeAmount + friendOperatingFee;
    return Math.round(fee * 100) / 100;
  })();

  const storedFee = Number((contract as any).fee || 0);
  // نستخدم القيمة المحسوبة دائماً عندما تتوفر بيانات الإيجار، ونعود للمخزّنة كنسخة احتياطية
  const operatingFee = totalRent > 0 ? computedOperatingFee : storedFee;
  const totalCost = Number((contract as any).total_cost || (contract as any)['Total'] || 0);
  const discount = Number((contract as any).Discount || (contract as any).discount || 0);
  
  // إذا كان الإيجار = 0، لا نحسب التركيب والطباعة في المجموع المستحق لأنها لم تحدث بعد
  const hasRentalActivity = totalRent > 0 || totalCost > 0;
  const effectiveInstallationCost = hasRentalActivity ? installationCost : 0;
  const effectivePrintCost = hasRentalActivity ? printCost : 0;
  const effectiveOperatingFee = hasRentalActivity ? operatingFee : 0;
  
  const finalTotalCost = totalCost > 0 ? totalCost : (totalRent + effectiveInstallationCost + effectivePrintCost + effectiveOperatingFee);
  
  // استخدام المدفوعات الفعلية إذا توفرت، وإلا استخدام القيمة المحفوظة
  const totalPaid = actualPaid !== null ? actualPaid : Number((contract as any)['Total Paid'] || (contract as any).total_paid || 0);
  const paymentPercentage = finalTotalCost > 0 ? (totalPaid / finalTotalCost) * 100 : 0;
  const remaining = finalTotalCost - totalPaid;
  
  // استخراج اللون السائد من الصورة (كنمط HSL لتوافق أفضل مع الثيم)
  const extractDominantColor = (imageUrl: string) => {
    if (dominantColorCache.has(imageUrl)) {
      setDominantHsl(dominantColorCache.get(imageUrl) ?? null);
      return;
    }

    const rgbToHsl = (r: number, g: number, b: number) => {
      r /= 255;
      g /= 255;
      b /= 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;

      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1));
        switch (max) {
          case r:
            h = ((g - b) / delta) % 6;
            break;
          case g:
            h = (b - r) / delta + 2;
            break;
          default:
            h = (r - g) / delta + 4;
        }
        h *= 60;
        if (h < 0) h += 360;
      }

      return {
        h: Math.round(h),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
      };
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);

        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
          // تجاهل الأسود/الأبيض الشديد
          if (brightness > 30 && brightness < 225) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }

        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);

          const hsl = rgbToHsl(r, g, b);
          // ضبط السطوع لضمان تباين جيد - خفض السطوع للخلفية
          const adjustedL = Math.min(hsl.l, 25); // حد أقصى 25% سطوع للخلفية
          const color = `${hsl.h} ${Math.min(hsl.s, 60)}% ${adjustedL}%`;
          dominantColorCache.set(imageUrl, color);
          setDominantHsl(color);
        } else {
          dominantColorCache.set(imageUrl, null);
          setDominantHsl(null);
        }
      } catch (e) {
        dominantColorCache.set(imageUrl, null);
        setDominantHsl(null);
      }
    };
    img.onerror = () => {
      dominantColorCache.set(imageUrl, null);
      setDominantHsl(null);
    };
    img.decoding = 'async';
    img.src = imageUrl;
  };
  
  // جلب صور التصميم من بيانات العقد أو من مهام التركيب المرتبطة به
  useEffect(() => {
    if (!isVisible) return;

    let isMounted = true;

    const fetchDesignImage = async () => {
      const inlineImages: string[] = [];
      const addInlineImage = (url: unknown) => {
        if (typeof url === 'string') {
          const trimmed = url.trim();
          if (trimmed && (trimmed.startsWith('http') || trimmed.startsWith('/') || trimmed.startsWith('data:')) && !inlineImages.includes(trimmed)) {
            inlineImages.push(trimmed);
          }
        }
      };

      // 1. استخراج التصاميم المضمنة مباشرة في العقد (design_data)
      const rawInlineDesigns = (contract as any).design_data;
      if (rawInlineDesigns) {
        try {
          let parsed = typeof rawInlineDesigns === 'string'
            ? JSON.parse(rawInlineDesigns)
            : rawInlineDesigns;
          // التعامل مع JSON مشفر مرتين (double-stringified)
          if (typeof parsed === 'string') {
            try {
              parsed = JSON.parse(parsed);
            } catch {}
          }
          if (Array.isArray(parsed)) {
            parsed.forEach((design: any) => {
              addInlineImage(design?.designFaceA || design?.faceA || design?.design_face_a || design?.design_face_a_url || design?.designFaceAUrl);
              addInlineImage(design?.designFaceB || design?.faceB || design?.design_face_b || design?.design_face_b_url || design?.designFaceBUrl);
            });
          } else if (parsed && typeof parsed === 'object') {
            addInlineImage(parsed?.designFaceA || parsed?.faceA || parsed?.design_face_a || parsed?.design_face_a_url || parsed?.designFaceAUrl);
            addInlineImage(parsed?.designFaceB || parsed?.faceB || parsed?.design_face_b || parsed?.design_face_b_url || parsed?.designFaceBUrl);
          }
        } catch {
          // Ignore parse errors
        }
      }

      if (inlineImages.length > 0) {
        if (!isMounted) return;
        setDesignImages(inlineImages);
        setCurrentDesignIndex(0);
        extractDominantColor(inlineImages[0]);
        return;
      }

      const rawContractNumber =
        (contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? contract.id;

      const contractNumber = Number(rawContractNumber);
      if (!Number.isFinite(contractNumber)) return;

      // فحص الذاكرة المؤقتة (Cache)
      if (contractDesignCache.has(contractNumber)) {
        const cached = contractDesignCache.get(contractNumber) || [];
        if (!isMounted) return;
        if (cached.length > 0) {
          setDesignImages(cached);
          setCurrentDesignIndex(0);
          extractDominantColor(cached[0]);
        } else {
          setDesignImages([]);
          setDominantHsl(null);
        }
        return;
      }

      const currentContractImages: string[] = [];
      const addDesign = (url: unknown) => {
        if (typeof url === 'string') {
          const trimmed = url.trim();
          if (trimmed && (trimmed.startsWith('http') || trimmed.startsWith('/') || trimmed.startsWith('data:')) && !currentContractImages.includes(trimmed)) {
            currentContractImages.push(trimmed);
          }
        }
      };

      try {
        // 2. مهام التركيب المباشرة لهذا العقد (الأولوية القصوى)
        const { data: directTasks } = await supabase
          .from('installation_tasks')
          .select('id, reinstallation_number, task_type')
          .eq('contract_id', contractNumber)
          .order('reinstallation_number', { ascending: false, nullsFirst: false });

        if (directTasks && directTasks.length > 0) {
          for (const task of directTasks) {
            // أ) جلب التصاميم من جدول task_designs التابع للمهمة
            const { data: taskDesigns } = await supabase
              .from('task_designs')
              .select('design_face_a_url, design_face_b_url, cutout_image_url')
              .eq('task_id', task.id);

            (taskDesigns || []).forEach(td => {
              addDesign(td.design_face_a_url);
              addDesign(td.design_face_b_url);
              addDesign(td.cutout_image_url);
            });

            // ب) جلب التصاميم من عناصر المهمة installation_task_items
            const { data: taskItems } = await supabase
              .from('installation_task_items')
              .select('design_face_a, design_face_b')
              .eq('task_id', task.id)
              .or('design_face_a.not.is.null,design_face_b.not.is.null');

            (taskItems || []).forEach(item => {
              addDesign(item.design_face_a);
              addDesign(item.design_face_b);
            });

            if (currentContractImages.length > 0) break;
          }
        }

        // 3. المهام المدمجة (combined tasks)
        if (currentContractImages.length === 0) {
          const { data: combinedTasks } = await supabase
            .from('installation_tasks')
            .select('id')
            .contains('contract_ids', [contractNumber]);

          if (combinedTasks && combinedTasks.length > 0) {
            const taskIds = combinedTasks.map(t => t.id);
            const { data: combinedItems } = await supabase
              .from('installation_task_items')
              .select(`
                design_face_a, design_face_b,
                billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)
              `)
              .in('task_id', taskIds)
              .or('design_face_a.not.is.null,design_face_b.not.is.null');

            (combinedItems || []).forEach(item => {
              const bb = item.billboard as any;
              if (bb?.Contract_Number === contractNumber) {
                addDesign(item.design_face_a);
                addDesign(item.design_face_b);
              }
            });

            if (currentContractImages.length === 0) {
              const { data: combinedDesigns } = await supabase
                .from('task_designs')
                .select('design_face_a_url, design_face_b_url')
                .in('task_id', taskIds);

              (combinedDesigns || []).forEach(td => {
                addDesign(td.design_face_a_url);
                addDesign(td.design_face_b_url);
              });
            }
          }
        }

        // 4. المهام المجمعة (composite_tasks)
        if (currentContractImages.length === 0) {
          const { data: compositeTasks } = await supabase
            .from('composite_tasks')
            .select('installation_task_id')
            .eq('contract_id', contractNumber)
            .not('installation_task_id', 'is', null);

          if (compositeTasks && compositeTasks.length > 0) {
            const itIds = compositeTasks.map(c => c.installation_task_id).filter((id): id is string => Boolean(id));
            if (itIds.length > 0) {
              const { data: compDesigns } = await supabase
                .from('task_designs')
                .select('design_face_a_url, design_face_b_url')
                .in('task_id', itIds);

              (compDesigns || []).forEach(td => {
                addDesign(td.design_face_a_url);
                addDesign(td.design_face_b_url);
              });

              if (currentContractImages.length === 0) {
                const { data: compItems } = await supabase
                  .from('installation_task_items')
                  .select('design_face_a, design_face_b')
                  .in('task_id', itIds)
                  .or('design_face_a.not.is.null,design_face_b.not.is.null');

                (compItems || []).forEach(item => {
                  addDesign(item.design_face_a);
                  addDesign(item.design_face_b);
                });
              }
            }
          }
        }

        // 5. حالة واحدة فقط: إذا كان هذا العقد لم يُضف له أي تصميم في مهمة التركيب ولا في بيانات العقد
        // نأخذ فقط آخر تصميم تم تركيبه على إحدى لوحات هذا العقد من العقود السابقة
        if (currentContractImages.length === 0) {
          const bbIds = (contract as any).billboard_ids
            ? String((contract as any).billboard_ids).split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0)
            : [];

          if (bbIds.length > 0) {
            const { data: latestPreviousItem } = await supabase
              .from('installation_task_items')
              .select('design_face_a, design_face_b')
              .in('billboard_id', bbIds)
              .or('design_face_a.not.is.null,design_face_b.not.is.null')
              .order('created_at', { ascending: false })
              .limit(1);

            if (latestPreviousItem && latestPreviousItem.length > 0) {
              addDesign(latestPreviousItem[0].design_face_a);
              addDesign(latestPreviousItem[0].design_face_b);
            }
          }
        }

        // 6. حفظ في الذاكرة المؤقتة وتحديث الحالة
        contractDesignCache.set(contractNumber, currentContractImages);

        if (!isMounted) return;
        if (currentContractImages.length > 0) {
          setDesignImages(currentContractImages);
          setCurrentDesignIndex(0);
          extractDominantColor(currentContractImages[0]);
        } else {
          setDesignImages([]);
          setDominantHsl(null);
        }
      } catch (err) {
        console.error('Error fetching design image for contract:', contractNumber, err);
      }
    };

    fetchDesignImage();

    return () => {
      isMounted = false;
    };
  }, [contract, isVisible]);

  // حساب حالة العقد
  const getStatus = () => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    const startDate = new Date(contract.start_date || '');
    
    if (!contract.end_date || !contract.start_date) {
      return { 
        label: 'غير محدد', 
        icon: null,
        badgeStyle: 'bg-slate-600 text-white border-transparent'
      };
    }
    
    if (today < startDate) {
      return { 
        label: 'لم يبدأ', 
        icon: <Clock className="h-3 w-3" />,
        badgeStyle: 'bg-blue-600 text-white border-transparent'
      };
    } else if (today > endDate) {
      return { 
        label: 'منتهي', 
        icon: <AlertCircle className="h-3 w-3" />,
        badgeStyle: 'bg-rose-600 text-white border-transparent font-bold'
      };
    } else {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 7) {
        return { 
          label: `ينتهي خلال ${daysRemaining} أيام`, 
          icon: <Clock className="h-3 w-3" />,
          badgeStyle: 'bg-amber-500 text-white border-transparent animate-pulse font-bold'
        };
      }
      return { 
        label: 'نشط', 
        icon: <CheckCircle className="h-3 w-3" />,
        badgeStyle: 'bg-emerald-600 text-white border-transparent font-bold'
      };
    }
  };

  // حساب التقدم/التأخر
  const getProgress = () => {
    // إذا كانت نسبة السداد 100% أو أكثر - مكتمل
    if (paymentPercentage >= 100) {
      return { label: 'مكتمل', variant: 'default' as const, percent: 0, icon: <CheckCircle className="h-4 w-4" /> };
    }

    const startDate = contract.start_date ? new Date(contract.start_date) : null;
    const endDate = contract.end_date ? new Date(contract.end_date) : null;
    const today = new Date();

    if (!startDate || !endDate || today < startDate) {
      return { label: '—', variant: 'secondary' as const, percent: 0, icon: <Minus className="h-4 w-4" /> };
    }

    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();
    const timePercentage = totalDuration > 0 ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100) : 0;
    const diff = paymentPercentage - timePercentage;
    const percent = Math.abs(diff);

    if (percent < 5) {
      return { label: 'متوازن', variant: 'secondary' as const, percent, icon: <Minus className="h-4 w-4" /> };
    }
    if (diff > 0) {
      return { label: `متقدم ${percent.toFixed(0)}%`, variant: 'default' as const, percent, icon: <TrendingUp className="h-4 w-4" /> };
    }
    return { label: `متأخر ${percent.toFixed(0)}%`, variant: 'destructive' as const, percent, icon: <TrendingDown className="h-4 w-4" /> };
  };

  const getCardStyle = () => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    
    if (!contract.end_date) return '';
    
    if (today > endDate) {
      return 'border-destructive/50';
    }
    
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 7 && daysRemaining > 0) {
      return 'border-orange-500/50';
    }
    
    return 'border-border hover:border-primary/50';
  };

  const status = getStatus();
  const progress = getProgress();
  const contractNumber = String((contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? contract.id);

  // Preserve the design-derived colour as a refined accent instead of flooding
  // the entire surface. This keeps light/dark contrast stable and paints faster.
  const cardStyle = dominantHsl
    ? {
        background: `linear-gradient(155deg, hsl(${dominantHsl} / 0.16) 0%, hsl(var(--card)) 38%, hsl(var(--card)) 100%)`,
        borderColor: `hsl(${dominantHsl} / 0.48)`,
        boxShadow: `0 14px 34px -24px hsl(${dominantHsl} / 0.65)`,
        contentVisibility: 'auto' as const,
        containIntrinsicSize: '640px',
      }
    : {
        contentVisibility: 'auto' as const,
        containIntrinsicSize: '640px',
      };

  const textClass = 'text-foreground';
  const textMutedClass = 'text-muted-foreground';
  const textPrimaryClass = 'text-primary font-extrabold';
  const bgMutedClass = 'bg-background/55 border-border/60';
  const borderClass = 'border-border/50';

  return (
    <Card
      ref={cardRef}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card text-card-foreground transition-[border-color,box-shadow,transform] duration-200 motion-safe:hover:-translate-y-0.5 flex flex-col hover:shadow-xl hover:shadow-primary/5",
        getCardStyle(),
        isSelected && "ring-2 ring-primary ring-offset-2",
        showInAvailable && "ring-2 ring-emerald-500 ring-offset-1"
      )}
      style={cardStyle}
    >
      {/* Design-colour accent with a gold fallback */}
      <div
        className="absolute inset-x-0 top-0 h-1 z-40 pointer-events-none"
        style={{
          background: dominantHsl
            ? `linear-gradient(90deg, transparent, hsl(${dominantHsl}), transparent)`
            : 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)',
        }}
      />
      
      {/* Checkbox للاختيار - في أعلى اليمين فوق كل شيء */}
      {onToggleSelect && (
        <button
          type="button"
          aria-label={isSelected ? 'إلغاء تحديد العقد' : 'تحديد العقد'}
          className="absolute top-1 right-1 z-50 cursor-pointer p-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(contract.id);
          }}
        >
          <div className={cn(
            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shadow-md",
            isSelected 
              ? 'bg-primary border-primary text-primary-foreground' 
              : 'bg-background border-border hover:border-primary'
          )}>
            {isSelected && (
              <CheckCircle className="h-4 w-4" />
            )}
          </div>
        </button>
      )}
      
      {/* منطقة الصورة - بتنسيق فاخر بداخل بطاقة بحدود ناعمة */}
      <div className="p-3 pb-0 flex-shrink-0">
        <div className="relative h-40 w-full rounded-xl overflow-hidden bg-muted/20 border border-border/50 group/design">
          {designImage ? (
            <div 
              className="relative h-full w-full cursor-pointer"
              onClick={() => setShowDesignFullscreen(true)}
            >
              <img 
                src={designImage} 
                alt="تصميم الإعلان" 
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover motion-safe:transition-transform duration-200 motion-safe:group-hover/design:scale-[1.02]"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover/design:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover/design:opacity-100 transition-opacity duration-300" />
              </div>
              
              {/* أزرار التنقل بين التصاميم */}
              {designImages.length > 1 && (
                <>
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover/design:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newIdx = (currentDesignIndex + 1) % designImages.length;
                      setCurrentDesignIndex(newIdx);
                      extractDominantColor(designImages[newIdx]);
                    }}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover/design:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newIdx = (currentDesignIndex - 1 + designImages.length) % designImages.length;
                      setCurrentDesignIndex(newIdx);
                      extractDominantColor(designImages[newIdx]);
                    }}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {/* مؤشر التصاميم */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                    {designImages.map((_, i) => (
                      <button
                        key={i}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-all",
                          i === currentDesignIndex ? 'bg-white scale-125' : 'bg-white/50'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentDesignIndex(i);
                          extractDominantColor(designImages[i]);
                        }}
                      />
                    ))}
                  </div>
                  {/* عداد التصاميم */}
                  <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full z-10">
                    {currentDesignIndex + 1}/{designImages.length}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center bg-muted/10">
              <ImageIcon className="h-7 w-7 text-muted-foreground/30 mb-1" />
              <span className="text-[10px] text-muted-foreground/50">بدون تصميم متوفر</span>
            </div>
          )}

          {/* تراكب الشارات العلوية المباشرة */}
          {/* شارة رقم العقد في اليمين */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10">
            <span className="font-manrope font-extrabold text-[10px] bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg border border-white/10 shadow-sm">
              #{contractNumber}
            </span>
            {yearlyCode && (
              <span className="font-manrope font-extrabold text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-lg shadow-sm">
                {yearlyCode}
              </span>
            )}
          </div>

          {/* شارة حالة العقد في اليسار */}
          <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-end">
            <Badge variant="outline" className={cn("gap-1 shadow-sm text-[9px] py-0.5 px-2 border backdrop-blur-none", status.badgeStyle)}>
              {status.icon}
              <span>{status.label}</span>
            </Badge>
            {(() => {
              const prevNum = (contract as any).previous_contract_number || detectedPreviousContract;
              if (!prevNum) return null;
              return (
                <Badge 
                  variant="outline" 
                  className="gap-1 text-[8px] py-0 px-1.5 bg-emerald-500/90 hover:bg-emerald-600 text-white border-emerald-400/30 shadow-sm cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    const el = document.getElementById(`contract-${prevNum}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  <RefreshCw className="h-2 w-2 animate-spin-slow" />
                  <span>مجدد #{prevNum}</span>
                </Badge>
              );
            })()}
          </div>
        </div>
      </div>
      
      {/* Fullscreen Design Modal */}
      {showDesignFullscreen && designImage && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowDesignFullscreen(false)}
        >
          {designImages.length > 1 && (
            <>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 z-[55] h-11 w-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white shadow-lg transition-all hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  const newIdx = (currentDesignIndex + 1) % designImages.length;
                  setCurrentDesignIndex(newIdx);
                  extractDominantColor(designImages[newIdx]);
                }}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 z-[55] h-11 w-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white shadow-lg transition-all hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  const newIdx = (currentDesignIndex - 1 + designImages.length) % designImages.length;
                  setCurrentDesignIndex(newIdx);
                  extractDominantColor(designImages[newIdx]);
                }}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            </>
          )}
          <DesignZoomViewer 
            key={designImage} 
            src={designImage} 
            alt="تصميم الإعلان - عرض كامل" 
            onClose={() => setShowDesignFullscreen(false)} 
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            عقد #{contractNumber} - {contract.customer_name}
            {designImages.length > 1 && ` (${currentDesignIndex + 1}/${designImages.length})`}
          </div>
        </div>,
        document.body
      )}

      {/* شريط الحالة البصري السفلي للصورة */}
      <div
        className="h-1 w-full flex-shrink-0"
        style={dominantHsl ? { backgroundColor: `hsl(${dominantHsl})` } : { backgroundColor: 'hsl(var(--primary) / 0.2)' }}
      />
      
      {/* محتوى الكارد */}
      <CardContent className="p-4 flex-grow flex flex-col justify-between space-y-3">
        {/* صف معلومات العميل والشركة */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="p-1.5 rounded-lg shrink-0 bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
              <h3 className={cn("font-bold text-base truncate", textClass)}>{contract.customer_name}</h3>
            </div>
            
            {(contract.Phone || customerData?.phone) && (
              <a 
                href={`tel:${contract.Phone || customerData?.phone}`} 
                onClick={(e) => e.stopPropagation()} 
                className={cn(
                  "text-xs hover:text-primary transition-colors font-manrope flex items-center gap-1 px-2 py-0.5 rounded-md shrink-0",
                  "text-muted-foreground bg-muted/50 hover:bg-primary/10 cursor-pointer transition-all duration-200"
                )}
              >
                <Phone className="h-3 w-3" />
                <span>{contract.Phone || customerData?.phone}</span>
              </a>
            )}
          </div>

          {(contract.Company || customerData?.company) && (
            <div className="flex items-center gap-1.5 text-xs mr-7">
              <Building className="h-3.5 w-3.5 shrink-0 text-primary/80" />
              <span className={cn("font-semibold truncate", textMutedClass)}>{contract.Company || customerData?.company}</span>
            </div>
          )}
        </div>
        
        {/* نوع الإعلان وإجمالي المساحة بالأمتار */}
        <div className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border border-amber-500/30 dark:border-amber-400/30 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-primary/10 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-transparent shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 shrink-0">
              <PaintBucket className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[11px] font-medium text-muted-foreground dark:text-amber-200/70 shrink-0">نوع الإعلان:</span>
              <span className="text-xs sm:text-[13px] font-extrabold text-foreground dark:text-amber-100 truncate tracking-wide">
                {(contract as any)['Ad Type'] || (contract as any).ad_type || (contract as any).Ad_Type || 'غير محدد'}
              </span>
            </div>
          </div>
          {totalArea > 0 && (
            <Badge variant="outline" className="text-[11px] font-bold font-numbers px-2.5 py-0.5 shrink-0 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
              <Ruler className="h-3 w-3 ml-1 shrink-0 text-emerald-500 dark:text-emerald-400" />
              <span>{totalArea.toLocaleString('ar-LY', { maximumFractionDigits: 1 })} م²</span>
            </Badge>
          )}
        </div>
        
        {/* التواريخ */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className={cn("flex items-center gap-1.5 p-2 rounded-xl border", bgMutedClass)}>
            <Calendar className="h-4 w-4 shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <span className={cn("text-[9px] block", textMutedClass)}>تاريخ البدء</span>
              <span className={cn("font-semibold font-manrope truncate block", textClass)}>
                {contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar') : '—'}
              </span>
            </div>
          </div>
          <div className={cn("flex items-center gap-1.5 p-2 rounded-xl border", bgMutedClass)}>
            <Calendar className="h-4 w-4 shrink-0 text-rose-500" />
            <div className="min-w-0">
              <span className={cn("text-[9px] block", textMutedClass)}>تاريخ الانتهاء</span>
              <span className={cn("font-semibold font-manrope truncate block", textClass)}>
                {contract.end_date ? new Date(contract.end_date).toLocaleDateString('ar') : '—'}
              </span>
            </div>
          </div>
        </div>
        
        {/* مهام التركيب والعمليات */}
        {detailsOpen && installationTasks.total > 0 && (
          <div className={cn("p-3 rounded-xl border space-y-2.5", bgMutedClass)}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-amber-500" />
                <span className={cn("font-bold", textClass)}>التركيبات والعمليات</span>
              </div>
              <span className={cn("font-manrope font-semibold", textMutedClass)}>
                {installationTasks.completed}/{installationTasks.total}
              </span>
            </div>
            
            <div className="relative h-2 rounded-full overflow-hidden bg-muted">
              <div 
                className="absolute inset-y-0 right-0 rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(installationTasks.completed / installationTasks.total) * 100}%` }}
              />
              {installationTasks.inProgress > 0 && (
                <div 
                  className="absolute inset-y-0 rounded-full bg-blue-500 animate-pulse transition-all duration-500"
                  style={{
                    right: `${(installationTasks.completed / installationTasks.total) * 100}%`,
                    width: `${(installationTasks.inProgress / installationTasks.total) * 100}%`,
                  }}
                />
              )}
            </div>

            {installationTasks.tasks.length > 0 && (
              <div className={cn("space-y-1.5 pt-1.5 border-t", borderClass)}>
                {installationTasks.tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between text-[10px]">
                    <span className={cn("truncate max-w-[65%] flex items-center gap-1", textMutedClass)}>
                      <MapPin className="w-3 h-3 text-amber-500 shrink-0" /> {task.billboard_name}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[8px] py-0 px-1.5 rounded-full border",
                        task.status === 'completed'
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : task.status === 'in_progress'
                            ? "bg-blue-500/10 text-blue-600 border-blue-500/20 motion-safe:animate-pulse"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      )}
                    >
                      {task.status === 'completed' ? 'جاهزة' : task.status === 'in_progress' ? 'جاري' : 'معلقة'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* تنبيه اقتراب موعد التركيب */}
        {detailsOpen && approachingDeadlineCount > 0 && (
          <div className="p-2.5 rounded-lg border border-amber-200 text-amber-800 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300 flex items-center gap-2 text-[10px]">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold">
              {approachingDeadlineCount} لوحة تقترب من انتهاء مهلة التركيب (أقل من 3 أيام)
            </span>
          </div>
        )}

        {/* تنبيه تأخير التركيب */}
        {detailsOpen && isVisible && (
          <ContractDelayAlert
            key={`delay-${(contract as any).Contract_Number}-${(contract as any)['Contract Date']}-${(contract as any)['End Date']}-${delayRefreshKey}`}
            contractNumber={Number((contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? contract.id)}
            dominantHsl={null}
            refreshKey={`${(contract as any)['Contract Date']}-${(contract as any)['End Date']}-${delayRefreshKey}`}
          />
        )}
        
        {/* شريط السداد والمالية */}
        <div className="p-3.5 rounded-xl border border-border/60 bg-background/55 transition-colors duration-200 space-y-3 hover:border-primary/30">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-primary/10 text-primary">
                <DollarSign className="h-3.5 w-3.5" />
              </div>
              <span className={cn("font-bold text-xs", textClass)}>حالة السداد والمالية</span>
            </div>
            <Badge variant={progress.variant} className="text-[9px] font-bold px-2 py-0.5">
              {progress.label}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-semibold">
              <span className={textMutedClass}>نسبة المدفوع</span>
              <span className={cn("font-manrope", textPrimaryClass)}>{paymentPercentage.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden relative bg-muted">
              <div 
                className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-primary to-primary-glow transition-all duration-500"
                style={{ width: `${Math.min(paymentPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Paid / Remaining values */}
          <div className={cn("grid grid-cols-3 gap-2 text-[10px] pt-1.5 border-t", borderClass)}>
            <div>
              <span className={cn("block", textMutedClass)}>المستحق</span>
              <span className="font-bold font-manrope text-xs text-primary">
                {finalTotalCost.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
            <div>
              <span className={cn("block", textMutedClass)}>المحصل فعلياً</span>
              <span className="font-bold font-manrope text-xs text-green-600 dark:text-green-400">
                {totalPaid.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
            <div>
              <span className={cn("block", textMutedClass)}>الذمم المتبقية</span>
              <span className={cn("font-bold font-manrope text-xs", textClass)}>
                {remaining.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          </div>

          {/* Receipts list */}
          {detailsOpen && contractPayments.length > 0 && (
            <div className={cn("flex flex-wrap gap-1 pt-1.5 border-t", borderClass)}>
              {contractPayments.map((payment, idx) => {
                const isDistributed = !!payment.distributed_payment_id;
                return (
                  <button
                    key={payment.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDistributed && payment.distributed_payment_id) {
                        const customerId = (contract as any).customer_id;
                        const customerName = (contract as any)['Customer Name'] || (contract as any).customer_name || '';
                        if (customerId) {
                          navigate(`/admin/customer-billing?id=${customerId}&name=${encodeURIComponent(customerName)}&highlight_payment=${payment.distributed_payment_id}`);
                        }
                      }
                    }}
                    className={cn(
                      "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-medium transition-all hover:scale-105 border",
                      isDistributed
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 cursor-pointer"
                          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 cursor-default"
                    )}
                    title={`${isDistributed ? 'دفعة موزعة' : 'إيصال'} #${payment.rowNumber || (idx + 1)} - ${payment.amount.toLocaleString('ar-LY')} د.ل`}
                  >
                    {isDistributed ? <Send className="h-2.5 w-2.5 shrink-0" /> : <DollarSign className="h-2.5 w-2.5 shrink-0" />}
                    <span>#{payment.rowNumber || (idx + 1)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          className="h-9 w-full justify-between rounded-xl border border-border/50 bg-muted/20 px-3 text-xs font-bold text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-pointer transition-all duration-200"
        >
          <span>{detailsOpen ? 'إخفاء التفاصيل' : 'تفاصيل العقد والعمليات'}</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', detailsOpen && 'rotate-180')} />
        </Button>
        
        {/* التكاليف والتفاصيل الفنية */}
        {detailsOpen && (
        <div className="p-3 rounded-xl border border-border/50 bg-muted/15 space-y-1.5 text-[11px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
          <div className="flex justify-between items-center">
            <span className={textMutedClass}>قيمة الإيجار:</span>
            <span className={cn("font-bold font-manrope", textClass)}>{totalRent.toLocaleString('ar-LY')} د.ل</span>
          </div>
          
          {installationCost > 0 && (
            <div className="flex justify-between items-center">
              <span className={textMutedClass}>أعمال التركيب:</span>
              <span className={cn("font-semibold font-manrope", textClass)}>{installationCost.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          
          {friendCostsTotal > 0 && (
            <div className="flex justify-between items-center">
              <span className={textMutedClass}>إيجارات صديقة:</span>
              <span className={cn("font-semibold font-manrope", textClass)}>{friendCostsTotal.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          
          {(printCost > 0 || printEnabled) && (
            <div className="flex justify-between items-center">
              <span className={textMutedClass}>تكلفة الطباعة:</span>
              <span className={cn("font-semibold font-manrope", textClass)}>{printCost.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          
          {operatingFee > 0 && (
            <div className="flex justify-between items-center">
              <span className={textMutedClass}>رسوم التشغيل:</span>
              <span className={cn("font-semibold font-manrope", textClass)}>{operatingFee.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          
          {discount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-rose-500">التخفيض الممنوح:</span>
              <span className="font-bold font-manrope text-rose-600">-{discount.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          
          {totalExpenses > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-red-500">مصاريف وخسائر:</span>
              <span className="font-bold font-manrope text-red-600">-{totalExpenses.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          
          {suspensionDiscount > 0 ? (
            <>
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className={textMutedClass}>الإجمالي قبل الإيقاف:</span>
                <span className={cn("font-bold font-manrope text-sm", textClass)}>
                  {(finalTotalCost + suspensionDiscount).toLocaleString('ar-LY')} د.ل
                </span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-rose-500">
                <span className="text-rose-500">خصم الإيقاف:</span>
                <span className="font-bold font-manrope text-sm text-rose-600">
                  -{suspensionDiscount.toLocaleString('ar-LY')} د.ل
                </span>
              </div>
              <div className={cn("flex justify-between items-center pt-1.5 border-t text-xs font-bold", borderClass)}>
                <span className={textClass}>المجموع المستحق (بعد الإيقاف):</span>
                <span className={cn("font-bold font-manrope text-sm", textPrimaryClass)}>{finalTotalCost.toLocaleString('ar-LY')} د.ل</span>
              </div>
            </>
          ) : (
            <div className={cn("flex justify-between items-center pt-1.5 border-t text-xs font-bold", borderClass)}>
              <span className={textClass}>المجموع المستحق:</span>
              <span className={cn("font-bold font-manrope text-sm", textPrimaryClass)}>{finalTotalCost.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}

          {totalExpenses > 0 && (
            <div className={cn("flex justify-between items-center text-[10px] font-semibold pt-1 border-t text-emerald-600 dark:text-emerald-400", borderClass)}>
              <span>الصافي بعد المصاريف:</span>
              <span className="font-bold font-manrope">{(finalTotalCost - totalExpenses).toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
        </div>
        )}

        {/* أزرار العمليات (Bento Action Bar) */}
        <div className="space-y-2 pt-2 border-t border-border/20">
          <div className="flex gap-2">
            <Button
              onClick={() => onPrint(contract)}
              className="flex-1 h-10 font-bold text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-95 cursor-pointer transition-all duration-200"
            >
              <Printer className="h-4 w-4 ml-1 shrink-0" />
              طباعة العقد
            </Button>
            
            <Button
              onClick={() => navigate(`/admin/contracts/view/${contract.id}`)}
              variant="outline"
              className="flex-1 h-10 font-bold text-xs rounded-xl border-border hover:bg-muted active:scale-95 cursor-pointer transition-all duration-200"
            >
              <Eye className="h-4 w-4 ml-1 shrink-0" />
              عرض العقد
            </Button>
            
            <Button
              onClick={() => navigate(`/admin/contracts/edit?contract=${contract.id}`)}
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl border-border hover:bg-muted active:scale-95 cursor-pointer transition-all duration-200"
              title="تعديل العقد"
            >
              <Edit className="h-4 w-4" />
            </Button>

            <Button
              onClick={() => setDistributeDialogOpen(true)}
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 text-emerald-600 active:scale-95 cursor-pointer transition-all duration-200"
              title="توزيع دفعة مالية"
            >
              <DollarSign className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl border-border hover:bg-muted active:scale-95 cursor-pointer transition-all duration-200"
                  title="المزيد من العمليات"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleRenewContract} disabled={isRenewing}>
                  <RefreshCw className={cn("h-4 w-4 ml-2", isRenewing && "animate-spin")} />
                  تجديد العقد بنفس اللوحات
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onInstall(contract)}>
                  <Hammer className="h-4 w-4 ml-2" />
                  إنشاء مهمة تركيب
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBillboardPrint(contract)}>
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة فواتير اللوحات
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => onExport(contract, 'basic')}>
                  <FileSpreadsheet className="h-4 w-4 ml-2" />
                  تصدير Excel أساسي
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport(contract, 'detailed')}>
                  <FileSpreadsheet className="h-4 w-4 ml-2" />
                  تصدير Excel مفصّل
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport(contract, 'review')}>
                  <FileText className="h-4 w-4 ml-2" />
                  ورقة مراجعة العقد
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport(contract, 'csv')}>
                  <FileText className="h-4 w-4 ml-2" />
                  تصدير CSV (تركيب)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport(contract, 'zip')}>
                  <FileArchive className="h-4 w-4 ml-2" />
                  تنزيل صور العقد (ZIP)
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  disabled={togglingAvailable}
                  onClick={async () => {
                    const billboardIdsStr = (contract as any).billboard_ids;
                    if (!billboardIdsStr) { toast.error('لا توجد لوحات لهذا العقد'); return; }
                    const ids = billboardIdsStr.split(',').map((s: string) => Number(s.trim())).filter((n: number) => Number.isFinite(n) && n > 0);
                    if (ids.length === 0) return;
                    try {
                      setTogglingAvailable(true);

                      // جلب الحالة الحالية للوحات لضمان عدم لمس اللوحات المحظورة (false)
                      const { data: currentBbRows, error: fetchErr } = await supabase
                        .from('billboards')
                        .select('ID, is_visible_in_available')
                        .in('ID', ids);

                      if (fetchErr) throw fetchErr;

                      // استبعاد أي لوحة تحمل false (إخفاء إداري أو صيانة)
                      const modifiableIds = (currentBbRows || [])
                        .filter((b: any) => b.is_visible_in_available !== false)
                        .map((b: any) => b.ID);

                      if (modifiableIds.length === 0) {
                        toast.info('جميع لوحات هذا العقد في وضع الإخفاء الإداري / الصيانة (false) ولا يمكن تفعيل إظهارها.');
                        return;
                      }

                      // إذا كانت مفعّلة بالكامل أو مختلطة، فالضغط عليها يلغي الإظهار ويوحد القابلة للتعديل كـ null
                      const newVal = visibilityState === 'ALL_OFF';
                      const contractNum = Number(contract.Contract_Number ?? contract.id);

                      // 1. تحديث جدول العقود بالقرار الصريح للعقد (Scope C)
                      if (Number.isFinite(contractNum)) {
                        await supabase
                          .from('Contract')
                          .update({ is_visible_in_available: newVal ? true : null })
                          .eq('Contract_Number', contractNum);
                      }

                      // 2. تحديث اللوحات المرتبطة بالعقد
                      const { error } = await supabase
                        .from('billboards')
                        .update({ is_visible_in_available: newVal ? true : null })
                        .in('ID', modifiableIds);

                      if (error) throw error;

                      setShowInAvailable(newVal);
                      setVisibilityState(newVal ? 'ALL_ON' : 'ALL_OFF');
                      setForceVisibleCount(newVal ? modifiableIds.length : 0);

                      const hiddenNote = forceHiddenCount > 0 ? ` (مع الإبقاء على ${forceHiddenCount} لوحة مخفية إدارياً)` : '';
                      toast.success(newVal ? `تم إظهار لوحات العقد في المتاح${hiddenNote}` : `تم إلغاء إظهار اللوحات في المتاح${hiddenNote}`);
                      onRefresh();
                    } catch (e: any) {
                      console.error(e);
                      toast.error('فشل تحديث حالة اللوحات');
                    } finally {
                      setTogglingAvailable(false);
                    }
                  }}
                >
                  <Eye className="h-4 w-4 ml-2 text-primary" />
                  {visibilityState === 'ALL_ON'
                    ? 'إخفاء اللوحات من المتاح'
                    : visibilityState === 'MIXED'
                    ? `إلغاء الإظهار الجزئي (${forceVisibleCount}/${totalContractBoards || forceVisibleCount} مفعلة)`
                    : 'إظهار اللوحات في المتاح'}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  onClick={() => onDelete(String(contract.id))}
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  حذف العقد
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex gap-2">
            {onPrintAll && (
              <Button
                variant="outline"
                onClick={() => onPrintAll(contract)}
                className="flex-1 text-[10px] h-9 rounded-xl border-border hover:bg-muted active:scale-95 cursor-pointer transition-all duration-200"
              >
                <Printer className="h-3.5 w-3.5 ml-1 shrink-0" />
                <span>طباعة الكل</span>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/contracts/${contract.Contract_Number ?? contract.id}/expenses`)}
              className={cn(
                "flex-1 text-[10px] h-8 rounded-xl border-border",
                totalExpenses > 0 
                  ? "border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10" 
                  : "hover:bg-muted"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5 ml-1 shrink-0" />
              <span>المصاريف</span>
            </Button>
          </div>

        <div className="flex gap-2">
          <SendContractDialog
            contractNumber={String((contract as any).Contract_Number ?? contract.id)}
            customerName={contract.customer_name || (contract as any)['Customer Name'] || ''}
            customerPhone={customerData?.phone || undefined}
          />
        </div>
        </div>

        <EnhancedDistributePaymentDialog
          open={distributeDialogOpen}
          onOpenChange={setDistributeDialogOpen}
          customerId={(contract as any).customer_id || ''}
          customerName={contract.customer_name || ''}
          onSuccess={onRefresh}
        />
      </CardContent>
    </Card>
  );
};

export const ContractCard = React.memo(
  ContractCardComponent,
  (previous, next) =>
    previous.contract === next.contract &&
    previous.yearlyCode === next.yearlyCode &&
    previous.isSelected === next.isSelected &&
    Boolean(previous.onPrintAll) === Boolean(next.onPrintAll) &&
    Boolean(previous.onToggleSelect) === Boolean(next.onToggleSelect)
);

ContractCard.displayName = 'ContractCard';
