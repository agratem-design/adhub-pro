// @ts-nocheck
import { useEffect, useState, useMemo } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getPriceFor, CustomerType, CUSTOMERS } from '@/data/pricing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { Plus, Eye, Edit, Trash2, Calendar, User, DollarSign, Search, Filter, Building, AlertCircle, Clock, CheckCircle, Printer, RefreshCcw, Hammer, Wrench, Percent, PaintBucket, FileText, Send, FileSpreadsheet, LayoutGrid, List, SlidersHorizontal, Hash, SplitSquareVertical, Download, X, Loader2, CheckSquare, Square, Ruler, ChevronLeft, ChevronRight, AlertTriangle, Shield, ShieldCheck } from 'lucide-react';
import { SendContractDialog } from '@/components/contracts/SendContractDialog';
import { AddPaymentDialog } from '@/components/contracts/AddPaymentDialog';
import { BillboardBulkPrintDialog } from '@/components/billboards/BillboardBulkPrintDialog';
import { UnifiedPrintAllDialog } from '@/components/shared/printing';
import { SendAlertsDialog } from '@/components/contracts/SendAlertsDialog';
import { SendContractReportDialog } from '@/components/contracts/SendContractReportDialog';
import { QuickContractDialog } from '@/components/contracts/QuickContractDialog';
import { MissingContractNumbersDialog } from '@/components/contracts/MissingContractNumbersDialog';
import { ContractCard } from '@/components/contracts/ContractCard';
import { DoubleBillboardDetector } from '@/components/contracts/DoubleBillboardDetector';
import { ContractStats } from '@/components/contracts/ContractStats';
import { SizesInvoicePrintDialog } from '@/components/contracts/SizesInvoicePrintDialog';
import { ContractRangeSelector } from '@/components/contracts/ContractRangeSelector';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createContract,
  getContracts,
  getContractWithBillboards,
  getAvailableBillboards,
  updateContract,
  deleteContract,
  addBillboardsToContract,
  removeBillboardFromContract,
  Contract,
  ContractCreate
} from '@/services/contractService';
import { checkBillboardConflicts, type BillboardConflict } from '@/utils/contractUtils';
import { Billboard } from '@/types';
import { ContractPDFDialog } from '@/components/Contract';
import { supabase } from '@/integrations/supabase/client';
import { exportBillboardsToExcel } from '@/utils/exportBillboardsToExcel';
import { exportBillboardsToCSV } from '@/utils/exportBillboardsToCSV';
import { exportContractImagesToZip } from '@/utils/exportContractImagesToZip';
import { exportContractReviewExcel } from '@/utils/exportContractReviewExcel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHero } from '@/components/shared/PageHero';
import { StatBadge } from '@/components/shared/StatBadge';

export default function Contracts() {
  const { confirm: systemConfirm } = useSystemDialog();
  const { canEdit, user, isAdmin } = useAuth();
  const canEditContracts = canEdit('contracts');
  const linkedCustomerId = user?.linkedCustomerId || null;
  // المستخدم المربوط بعميل لا يمكنه إنشاء أو حذف العقود
  const canCreateOrDelete = canEditContracts && !linkedCustomerId;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [availableBillboards, setAvailableBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selectedContractForPDF, setSelectedContractForPDF] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [searchQuery, setSearchQuery] = usePersistedState<string>('contracts.search', '');
  const [statusFilter, setStatusFilter] = usePersistedState<string>('contracts.statusFilter', 'all');
  const [customerFilter, setCustomerFilter] = usePersistedState<string>('contracts.customerFilter', 'all');
  const [yearFilter, setYearFilter] = usePersistedState<string>('contracts.yearFilter', 'all');
  const [showTrash, setShowTrash] = useState(false);
  const [showUnpaid, setShowUnpaid] = usePersistedState<boolean>('contracts.showUnpaid', false);
  const [viewMode, setViewMode] = usePersistedState<'cards' | 'table'>('contracts.viewMode', 'cards');
  const [statsOpen, setStatsOpen] = useState(true);
  const [showYearlyCode, setShowYearlyCode] = useState(true);
  const [separateExpired, setSeparateExpired] = useState(true);

  
  // فلاتر التواريخ بالأشهر
  const [startMonthFilter, setStartMonthFilter] = usePersistedState<string>('contracts.startMonthFilter', 'all');
  const [endMonthFilter, setEndMonthFilter] = usePersistedState<string>('contracts.endMonthFilter', 'all');
  
  // Multi-select state
  const [selectedContractIds, setSelectedContractIds] = useState<Set<string | number>>(new Set());
  const [isExportingMultiple, setIsExportingMultiple] = useState(false);
  const [sizesInvoiceOpen, setSizesInvoiceOpen] = useState(false);
  const [sizesInvoiceData, setSizesInvoiceData] = useState<{ billboards: any[]; customerName: string; contractNumbers: string[] }>({ billboards: [], customerName: '', contractNumbers: [] });
  const [isPrintingSelected, setIsPrintingSelected] = useState(false);
  const CONTRACTS_PER_PAGE = 30;
  const [currentPage, setCurrentPage] = usePersistedState<number>('contracts.currentPage', 1);
  const [billboardPrintData, setBillboardPrintData] = useState<{
    contractNumber: string | number;
    customerName: string;
    adType?: string;
    startDate?: string;
    endDate?: string;
    billboards: any[];
  } | null>(null);
  const [billboardPrintOpen, setBillboardPrintOpen] = useState(false);
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [missingNumbersOpen, setMissingNumbersOpen] = useState(false);
  
  // Print All Dialog state
  const [printAllDialogOpen, setPrintAllDialogOpen] = useState(false);
  const [printAllData, setPrintAllData] = useState<{
    contractNumber: number;
    customerName: string;
    adType: string;
    items: any[];
    billboards: Record<number, any>;
  } | null>(null);

  const [formData, setFormData] = useState<ContractCreate>({
    customer_name: '',
    ad_type: '',
    start_date: '',
    end_date: '',
    rent_cost: 0,
    billboard_ids: []
  });
  const [pricingCategory, setPricingCategory] = useState<CustomerType>('عادي');

  // Renew state
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewSource, setRenewSource] = useState<Contract | null>(null);
  const [renewStart, setRenewStart] = useState<string>('');
  const [renewEnd, setRenewEnd] = useState<string>('');
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [delayedContractIds, setDelayedContractIds] = useState<Set<number>>(new Set());
  // ─── Renewal conflict state ───
  const [renewConflicts, setRenewConflicts] = useState<BillboardConflict[]>([]);
  const [renewChecking, setRenewChecking] = useState(false);

  const [bbSearch, setBbSearch] = useState('');
  const [editBbSearch, setEditBbSearch] = useState('');

  const loadData = async () => {
    try {
      const [contractsData, billboardsData] = await Promise.all([
        getContracts(linkedCustomerId),
        getAvailableBillboards()
      ]);
      setContracts(contractsData as Contract[]);
      setAvailableBillboards(billboardsData || []);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // جلب العقود المتأخرة في الخلفية دون تعطيل ظهور العقود الرئيسي
    const timer = setTimeout(async () => {
      try {
        const MAX_INSTALL_DAYS = 15;
        const today = new Date();
        
        const { data: allItems } = await supabase
          .from('installation_task_items')
          .select(`
            billboard_id, installation_date, selected_design_id, status,
            task:installation_tasks!inner(contract_id, task_type)
          `)
          .not('selected_design_id', 'is', null);
        
        if (!allItems || allItems.length === 0) return;

        const designIds = [...new Set(allItems.map(i => i.selected_design_id).filter(Boolean))] as string[];
        const { data: designs } = await supabase
          .from('task_designs')
          .select('id, created_at')
          .in('id', designIds);
        
        const designDates: Record<string, string> = {};
        designs?.forEach(d => { designDates[d.id] = d.created_at; });

        const delayed = new Set<number>();
        for (const item of allItems) {
          const task = item.task as any;
          if (task?.task_type === 'reinstallation') continue;
          const designDate = designDates[item.selected_design_id!];
          if (!designDate) continue;
          
          const expected = new Date(designDate);
          expected.setDate(expected.getDate() + MAX_INSTALL_DAYS);
          
          if (item.installation_date) {
            if (new Date(item.installation_date) > expected && task?.contract_id) {
              delayed.add(task.contract_id);
            }
          } else {
            if (today > expected && task?.contract_id) {
              delayed.add(task.contract_id);
            }
          }
        }
        setDelayedContractIds(delayed);
      } catch (e) {
        console.error('Error fetching delayed contracts:', e);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleBillboardPrint = (event: any) => {
      const { contractNumber, billboards, customerName, adType, startDate, endDate } = event.detail;
      setBillboardPrintData({ contractNumber, billboards, customerName, adType, startDate, endDate });
      setBillboardPrintOpen(true);
    };

    window.addEventListener('openBillboardPrint', handleBillboardPrint);
    return () => window.removeEventListener('openBillboardPrint', handleBillboardPrint);
  }, []);

  // احسب تاريخ النهاية تلقائياً حسب المدة المختارة
  useEffect(() => {
    if (!formData.start_date || !durationMonths) return;
    const d = new Date(formData.start_date);
    if (isNaN(d.getTime())) return;
    const end = new Date(d);
    end.setMonth(end.getMonth() + durationMonths);
    setFormData(prev => ({ ...prev, end_date: end.toISOString().split('T')[0] }));
  }, [formData.start_date, durationMonths]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cn = params.get('contract');
    if (cn && !viewOpen) {
      handleViewContract(String(cn));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleCreateContract = async () => {
    try {
      if (!formData.customer_name || !formData.start_date || !formData.end_date || formData.billboard_ids.length === 0) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      await createContract(formData);
      toast.success('تم إنشاء العقد بنجاح');
      setCreateOpen(false);
      setFormData({
        customer_name: '',
        ad_type: '',
        start_date: '',
        end_date: '',
        rent_cost: 0,
        billboard_ids: []
      });
      loadData();
    } catch (error) {
      console.error('خطأ في إنشاء العقد:', error);
      toast.error('��شل في إنشاء العقد');
    }
  };

  const handleViewContract = async (contractId: string) => {
    try {
      const contractWithBillboards = await getContractWithBillboards(contractId);
      setSelectedContract(contractWithBillboards);
      setViewOpen(true);
    } catch (error) {
      console.error('خطأ في ج��ب تفاصيل العقد:', error);
      toast.error('فشل في جلب تفاصيل العقد');
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (await systemConfirm({ title: 'تأكيد حذف العقد', message: 'هل أنت متأكد من حذف هذا العقد؟', variant: 'destructive', confirmText: 'حذف' })) {
      try {
        await deleteContract(contractId);
        toast.success('تم حذف العقد بنجاح');
        loadData();
      } catch (error) {
        console.error('خطأ في حذف العقد:', error);
        toast.error('فشل في حذف العقد');
      }
    }
  };

  const handlePrintContract = async (contract: Contract) => {
    try {
      const contractWithBillboards = await getContractWithBillboards(String(contract.id));
      setSelectedContractForPDF(contractWithBillboards);
      setPdfOpen(true);
    } catch (error) {
      console.error('خطأ في جلب تفاصيل العقد للطباعة:', error);
      toast.error('فشل في جلب تفاصيل العقد');
    }
  };

  const handlePrintInstallationNew = async (contract: Contract) => {
    try {
      const data = await getContractWithBillboards(String(contract.id));
      const boards: any[] = Array.isArray((data as any).billboards) ? (data as any).billboards : [];
      if (!boards.length) { toast.info('لا توجد لوحات للطباعة'); return; }

      const norm = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const name = String(b.Billboard_Name ?? b.name ?? id);
        const image = String(b.image ?? b.Image ?? b.billboard_image ?? b.Image_URL ?? b['@IMAGE'] ?? b.image_url ?? b.imageUrl ?? '');
        const municipality = String(b.Municipality ?? b.municipality ?? b.City_Council ?? b.city_council ?? '');
        const district = String(b.District ?? b.district ?? b.Area ?? b.area ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.Location ?? '');
        const size = String(b.Size ?? b.size ?? b['Billboard size'] ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b['Number of Faces'] ?? '');
        let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude; const lng = b.Longitude ?? b.lng ?? b.longitude; if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
        return { id, name, image, municipality, district, landmark, size, faces, mapLink };
      };

      const normalized = boards.map(norm);
      const START_Y = 63.53;
      const ROW_H = 13.818;
      const PAGE_H = 297;
      const ROWS_PER_PAGE = Math.max(1, Math.floor((PAGE_H - START_Y) / ROW_H));

      const tablePagesHtml = normalized.length
        ? normalized
            .reduce((acc: any[][], r, i) => { const p = Math.floor(i / ROWS_PER_PAGE); (acc[p] ||= []).push(r); return acc; }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/in1.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load in1.svg')" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:15mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:40mm" />
                      <col style="width:18mm" />
                      <col style="width:18mm" />
                      <col style="width:20mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-name">${r.name || r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td>${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `)
            .join('')
        : '';

      const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>كشف تركيب - العقد ${String(contract.id)}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }
            * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
            html, body { width: 100% !important; height: 100% !important; overflow: hidden; font-family: 'Noto Sans Arabic','Doran','Arial Unicode MS',Arial,sans-serif; direction: rtl; text-align: right; background: #fff; color: #000; }
            .template-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: block; }
            .template-image { position: absolute; inset: 0; width: 100% !important; height: 100% !important; object-fit: cover; object-position: center; z-index: 1; display: block; }
            .page { page-break-after: always; page-break-inside: avoid; }
            .table-area { position: absolute; top: 63.53mm; left: 12.8765mm; right: 12.8765mm; z-index: 20; }
            .btable { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 8px; font-family: 'Doran','Noto Sans Arabic','Arial Unicode MS',Arial,sans-serif; table-layout: fixed; border: 0.2mm solid #000; }
            .btable tr { height: 13.818mm; }
            .btable td { border: 0.2mm solid #000; padding: 0 1mm; vertical-align: middle; text-align: center; background: transparent; color: #000; white-space: normal; word-break: break-word; overflow: hidden; }
            .c-img img { width: 100%; height: 100%; object-fit: contain; object-position: center; display: block; }
            @media print { html, body { width: 210mm !important; min-height: 297mm !important; height: auto !important; margin:0 !important; padding:0 !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .template-container { width: 210mm !important; height: 297mm !important; position: relative !important; }
              .template-image { width: 210mm !important; height: 297mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4; margin: 0 !important; padding: 0 !important; } .controls{display:none!important}
            }
            .controls{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99}
            .controls button{padding:8px 14px;border:0;border-radius:6px;background:#0066cc;color:#fff;cursor:pointer}
          </style>
        </head>
        <body>
          ${tablePagesHtml}
          <div class="controls"><button onclick="window.print()">طباعة</button></div>
        </body>
        </html>`;

      const w = window.open('', '_blank');
      if (!w) { toast.error('فشل فتح نافذة الطباعة'); return; }
      w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 600);
    } catch (e) {
      console.error(e);
      toast.error('فشل طباعة التركيب');
    }
  };

  // New: installation team selection + filtered print
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installationTeams, setInstallationTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [installContractTarget, setInstallContractTarget] = useState<Contract | null>(null);

  const openInstallDialog = async (contract: Contract) => {
    try {
      setInstallContractTarget(contract);
      // fetch teams from installation_teams table
      const { data, error } = await (supabase as any).from('installation_teams').select('*').order('id', { ascending: true });
      if (error) {
        console.error('Failed to load installation teams', error);
        toast.error('فشل في تحميل فرق التركيب');
        return;
      }
      setInstallationTeams(data || []);
      setSelectedTeamId(data && data.length ? String(data[0].id) : null);
      setInstallDialogOpen(true);
    } catch (e) {
      console.error(e);
      toast.error('فشل في تحميل فرق التركيب');
    }
  };

  const handlePrintInstallationForTeam = async () => {
    if (!installContractTarget) return;
    try {
      const contract = await getContractWithBillboards(String(installContractTarget.id));
      const boards: any[] = Array.isArray((contract as any).billboards) ? (contract as any).billboards : [];
      if (!boards.length) { toast.info('لا توجد لوحات للطباعة'); return; }

      // find selected team
      const team = installationTeams.find(t => String(t.id) === String(selectedTeamId));
      const teamName = team?.team_name || team?.name || `فرقة ${selectedTeamId}`;
      const teamSizes: string[] = Array.isArray(team?.sizes) ? team.sizes : (typeof team?.sizes === 'string' ? (team.sizes || '').split(',').map((s: string)=>s.trim()) : []);

      // filter boards by size membership in teamSizes
      const filtered = boards.filter((b: any) => {
        const size = String(b.Size ?? b.size ?? '');
        return teamSizes.length === 0 || teamSizes.includes(size);
      });

      if (!filtered.length) {
        toast.info('لا توجد لوحات ضمن المقاسات التي تتعامل بها الفرقة المختارة');
        return;
      }

      // Use same printing routine but with filtered boards
      const norm = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const name = String(b.Billboard_Name ?? b.name ?? id);
        const image = String(b.image ?? b.Image ?? b.billboard_image ?? b.Image_URL ?? b['@IMAGE'] ?? b.image_url ?? b.imageUrl ?? '');
        const municipality = String(b.Municipality ?? b.municipality ?? b.City_Council ?? b.city_council ?? '');
        const district = String(b.District ?? b.district ?? b.Area ?? b.area ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.Location ?? '');
        const size = String(b.Size ?? b.size ?? b['Billboard size'] ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b['Number of Faces'] ?? '');
        let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude; const lng = b.Longitude ?? b.lng ?? b.longitude; if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
        return { id, name, image, municipality, district, landmark, size, faces, mapLink };
      };

      const normalized = filtered.map(norm);

      const ROWS_PER_PAGE = 12;

      const tablePagesHtml = normalized.length
        ? normalized
            .reduce((acc: any[][], r, i) => { const p = Math.floor(i / ROWS_PER_PAGE); (acc[p] ||= []).push(r); return acc; }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/in1.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load in1.svg')" />
                <div class="contract-header">
                  <p style="font-size: 12px; font-weight: 700; color: #0066cc; margin-bottom: 8px;"><strong>فرقة التركيب:</strong> ${teamName}</p>
                  <p><strong>رقم العقد:</strong> ${String(installContractTarget.id)}</p>
                  <p><strong>نوع الإعلان:</strong> ${(installContractTarget as any).ad_type || 'غير محدد'}</p>
                  <p><strong>اسم الزبون:</strong> ${installContractTarget.customer_name}</p>
                </div>
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:40mm" />
                      <col style="width:18mm" />
                      <col style="width:18mm" />
                      <col style="width:20mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-name">${r.name || r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td>${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `)
            .join('')
        : '';

      const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>كشف تركيب - العقد ${String(installContractTarget.id)}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }
            * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
            html, body { width: 100% !important; height: 100% !important; overflow: hidden; font-family: 'Noto Sans Arabic','Doran','Arial Unicode MS',Arial,sans-serif; direction: rtl; text-align: right; background: #fff; color: #000; }
            .template-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: block; }
            .template-image { position: absolute; inset: 0; width: 100% !important; height: 100% !important; object-fit: cover; object-position: center; z-index: 1; display: block; }
            .page { page-break-after: always; page-break-inside: avoid; }
            .contract-header { position: absolute; top: 33mm; right: 13mm; z-index: 30; font-family: 'Doran', 'Noto Sans Arabic', sans-serif; font-size: 10px; text-align: right; }
            .contract-header p { margin: 0; padding: 1px 0; }
            .table-area { position: absolute; top: 63.53mm; left: 12.8765mm; right: 12.8765mm; z-index: 20; /* width is determined by left/right */ }
            .btable { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 8px; font-family: 'Doran','Noto Sans Arabic','Arial Unicode MS',Arial,sans-serif; table-layout: fixed; border: 0.2mm solid #000; }
            .btable tr { height: 15.5mm; max-height: 15.5mm; }
            .btable td { border: 0.2mm solid #000; padding: 0 1mm; vertical-align: middle; text-align: center; background: transparent; color: #000; white-space: normal; word-break: break-word; overflow: hidden; height: 15.5mm; }
            .c-img { height: 100%; padding: 0.5mm !important; }
            .c-img img { width: 100%; height: 100%; max-height: 14.5mm; object-fit: contain; object-position: center; display: block; }
            @media print { html, body { width: 210mm !important; min-height: 297mm !important; height: auto !important; margin:0 !important; padding:0 !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .template-container { width: 210mm !important; height: 297mm !important; position: relative !important; }
              .template-image { width: 210mm !important; height: 297mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4; margin: 0 !important; padding: 0 !important; } .controls{display:none!important}
            }
            .controls{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99}
            .controls button{padding:8px 14px;border:0;border-radius:6px;background:#0066cc;color:#fff;cursor:pointer}
          </style>
        </head>
        <body>
          ${tablePagesHtml}
          <div class="controls"><button onclick="window.print()">طباعة</button></div>
        </body>
        </html>`;

      const w = window.open('', '_blank');
      if (!w) { toast.error('فشل فتح نافذة الطباعة'); return; }
      w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 600);
      setInstallDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('فشل طباعة التركيب');
    }
  };

  const getContractStatus = (contract: Contract) => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    const startDate = new Date(contract.start_date || '');
    
    if (!contract.end_date || !contract.start_date) {
      return <Badge variant="secondary">غير محدد</Badge>;
    }
    
    if (today < startDate) {
      return <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        لم يبدأ
      </Badge>;
    } else if (today > endDate) {
      return <Badge className="bg-destructive text-destructive-foreground border-destructive gap-1">
        <AlertCircle className="h-3 w-3" />
        منتهي
      </Badge>;
    } else {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 7) {
        return <Badge className="bg-orange-500 text-white border-orange-500 hover:bg-orange-600 gap-1">
          <Clock className="h-3 w-3" />
          ينتهي قريباً ({daysRemaining} أيام)
        </Badge>;
      }
      return <Badge className="bg-primary text-primary-foreground border-primary gap-1">
        <CheckCircle className="h-3 w-3" />
        نشط
      </Badge>;
    }
  };

  const getRowClassName = (contract: Contract) => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    
    if (!contract.end_date) return '';
    
    if (today > endDate) {
      return 'bg-destructive/5 hover:bg-destructive/10 dark:bg-destructive/10 dark:hover:bg-destructive/20';
    }
    
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 7 && daysRemaining > 0) {
      return 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50';
    }
    
    return '';
  };

  // استخراج السنوات المتاحة
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    contracts.forEach(c => {
      const dateStr = c.start_date || (c as any)['Contract Date'] || (c as any).contract_date;
      if (dateStr) {
        const year = new Date(dateStr).getFullYear();
        if (!isNaN(year)) years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [contracts]);

  // فصل العقود المهملة (إيجار = 0 وبدون لوحات إعلانية وبدون اسم عميل)
  const trashContracts = useMemo(() => {
    return contracts.filter(c => {
      const customerName = (c as any).customer_name || (c as any)['Customer Name'] || '';
      const rentCost = Number((c as any).rent_cost || (c as any)['Total Rent'] || (c as any).Total || 0);
      const billboardCount = Number((c as any).billboards_count || 0);
      const hasBillboards = billboardCount > 0 || !!(c as any).billboard_ids;
      return !customerName.trim() && rentCost === 0 && !hasBillboards;
    });
  }, [contracts]);

  const validContracts = useMemo(() => {
    return contracts.filter(c => {
      const customerName = (c as any).customer_name || (c as any)['Customer Name'] || '';
      const rentCost = Number((c as any).rent_cost || (c as any)['Total Rent'] || (c as any).Total || 0);
      const billboardCount = Number((c as any).billboards_count || 0);
      const hasBillboards = billboardCount > 0 || !!(c as any).billboard_ids;
      return customerName.trim().length > 0 || rentCost > 0 || hasBillboards;
    });
  }, [contracts]);

  // العقود غير المسددة (المدفوع أقل من المجموع)
  const unpaidContracts = useMemo(() => {
    return validContracts.filter(c => {
      const totalRent = Number((c as any).rent_cost || (c as any)['Total Rent'] || 0);
      const installationCost = Number((c as any).installation_cost || 0);
      const printCost = Number((c as any).print_cost || 0);
      const operatingFee = Number((c as any).operating_fee_rate || 0) / 100 * totalRent;
      const totalCost = Number((c as any).Total || 0) || (totalRent + installationCost + printCost + operatingFee);
      const totalPaid = Number((c as any)['Total Paid'] || (c as any).total_paid || 0);
      const remaining = totalCost - totalPaid;
      return remaining > 0 && totalCost > 0;
    });
  }, [validContracts]);

  // تصفية العقود
  const baseContracts = showTrash ? trashContracts : (showUnpaid ? unpaidContracts : validContracts);
  
  const filteredContracts = baseContracts.filter(contract => {
    const matchesSearch = 
      contract.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((contract as any)['Ad Type'] || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(contract.id || '').includes(searchQuery);

    const matchesCustomer = customerFilter === 'all' || contract.customer_name === customerFilter;
    
    // فلتر السنة
    let matchesYear = true;
    if (yearFilter !== 'all') {
      const dateStr = contract.start_date || (contract as any)['Contract Date'] || (contract as any).contract_date;
      if (dateStr) {
        const year = new Date(dateStr).getFullYear();
        matchesYear = year === Number(yearFilter);
      } else {
        matchesYear = false;
      }
    }
    
    // فلتر شهر البداية
    let matchesStartMonth = true;
    if (startMonthFilter !== 'all') {
      const startDateStr = contract.start_date || (contract as any)['Contract Date'] || (contract as any).contract_date;
      if (startDateStr) {
        const startMonth = new Date(startDateStr).getMonth() + 1; // 1-12
        matchesStartMonth = startMonth === Number(startMonthFilter);
      } else {
        matchesStartMonth = false;
      }
    }
    
    // فلتر شهر النهاية
    let matchesEndMonth = true;
    if (endMonthFilter !== 'all') {
      const endDateStr = contract.end_date || (contract as any)['End Date'];
      if (endDateStr) {
        const endMonth = new Date(endDateStr).getMonth() + 1; // 1-12
        matchesEndMonth = endMonth === Number(endMonthFilter);
      } else {
        matchesEndMonth = false;
      }
    }
    
    if (statusFilter === 'all') return matchesSearch && matchesCustomer && matchesYear && matchesStartMonth && matchesEndMonth;
    
    // فلتر التأخير لا يعتمد على تواريخ العقد
    if (statusFilter === 'delayed') {
      const contractNum = (contract as any).Contract_Number || (contract as any).contract_number || contract.id;
      const matchesStatus = delayedContractIds.has(Number(contractNum));
      return matchesSearch && matchesCustomer && matchesStatus && matchesYear && matchesStartMonth && matchesEndMonth;
    }
    
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    const startDate = new Date(contract.start_date || '');
    
    if (!contract.end_date || !contract.start_date) return false;
    
    let matchesStatus = false;
    if (statusFilter === 'active') {
      matchesStatus = today >= startDate && today <= endDate;
    } else if (statusFilter === 'expired') {
      matchesStatus = today > endDate;
    } else if (statusFilter === 'upcoming') {
      matchesStatus = today < startDate;
    } else if (statusFilter === 'expiring') {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      matchesStatus = daysRemaining <= 7 && daysRemaining > 0;
    }

    return matchesSearch && matchesCustomer && matchesStatus && matchesYear && matchesStartMonth && matchesEndMonth;
  });

  // إعادة تعيين الصفحة عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, customerFilter, yearFilter, startMonthFilter, endMonthFilter, showTrash, showUnpaid, separateExpired]);

  // Pagination
  const totalPages = Math.ceil(filteredContracts.length / CONTRACTS_PER_PAGE);
  const paginatedContracts = filteredContracts.slice(
    (currentPage - 1) * CONTRACTS_PER_PAGE,
    currentPage * CONTRACTS_PER_PAGE
  );

  // حساب ترتيب العقد في السنة
  const getContractYearlyOrder = (contract: Contract): string => {
    const dateStr = contract.start_date || (contract as any)['Contract Date'] || (contract as any).contract_date;
    const startDate = dateStr ? new Date(dateStr) : null;
    if (!startDate || isNaN(startDate.getTime())) return '';
    
    const year = startDate.getFullYear();
    const yearShort = year.toString().slice(-2);
    
    const sameYearContracts = contracts
      .filter(c => {
        const cDateStr = c.start_date || (c as any)['Contract Date'] || (c as any).contract_date;
        const cDate = cDateStr ? new Date(cDateStr) : null;
        return cDate && !isNaN(cDate.getTime()) && cDate.getFullYear() === year;
      })
      .sort((a, b) => {
        const aNum = (a as any).Contract_Number || a.id || 0;
        const bNum = (b as any).Contract_Number || b.id || 0;
        return aNum - bNum;
      });
    
    const contractId = (contract as any).Contract_Number || contract.id;
    const order = sameYearContracts.findIndex(c => {
      const cId = (c as any).Contract_Number || c.id;
      return cId === contractId;
    }) + 1;
    
    return order > 0 ? `${order}/${yearShort}` : '';
  };

  // الأعداد الشاملة لكافة العقود المفلترة
  const allFilteredActiveContracts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredContracts.filter(c => {
      if (!c.end_date) return true;
      const endDate = new Date(c.end_date);
      endDate.setHours(23, 59, 59, 999);
      return today <= endDate;
    });
  }, [filteredContracts]);

  const allFilteredExpiredContracts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredContracts.filter(c => {
      if (!c.end_date) return false;
      const endDate = new Date(c.end_date);
      endDate.setHours(23, 59, 59, 999);
      return today > endDate;
    });
  }, [filteredContracts]);

  // فصل العقود النشطة والمنتهية (عناصر الصفحة الحالية لعرض الكروت)
  const activeContracts = paginatedContracts.filter(c => {
    if (!c.end_date) return true;
    const endDate = new Date(c.end_date);
    endDate.setHours(23, 59, 59, 999);
    return new Date() <= endDate;
  });

  const expiredContracts = paginatedContracts.filter(c => {
    if (!c.end_date) return false;
    const endDate = new Date(c.end_date);
    endDate.setHours(23, 59, 59, 999);
    return new Date() > endDate;
  });

  // تقسيم العقود حسب الحالة
  const contractStats = {
    total: contracts.length,
    active: contracts.filter(c => {
      if (!c.end_date || !c.start_date) return false;
      const today = new Date();
      const endDate = new Date(c.end_date);
      const startDate = new Date(c.start_date);
      return today >= startDate && today <= endDate;
    }).length,
    expired: contracts.filter(c => {
      if (!c.end_date) return false;
      return new Date() > new Date(c.end_date);
    }).length,
    expiring: contracts.filter(c => {
      if (!c.end_date) return false;
      const today = new Date();
      const endDate = new Date(c.end_date);
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysRemaining <= 7 && daysRemaining > 0;
    }).length
  };

  // ✅ FIXED: حساب إجمالي التركيب وتكلفة الطباعة ورسوم التشغيل من القيم المحفوظة مباشرة
  const totalInstallationCost = contracts.reduce((sum, contract) => {
    const installationCost = Number((contract as any).installation_cost || (contract as any)['Installation Cost'] || 0);
    return sum + installationCost;
  }, 0);

  const totalPrintCost = contracts.reduce((sum, contract) => {
    // ✅ NEW: حساب تكلفة الطباعة الإجمالية
    const printCost = Number((contract as any).print_cost || (contract as any)['Print Cost'] || 0);
    return sum + printCost;
  }, 0);

  const totalOperatingFees = contracts.reduce((sum, contract) => {
    const operatingFee = Number((contract as any).fee || (contract as any)['Operating Fee'] || 0);
    return sum + operatingFee;
  }, 0);

  const uniqueCustomers = [...new Set(contracts.map(c => c.customer_name))].filter(Boolean);

  const filteredAvailable = availableBillboards.filter((b) => {
    const q = bbSearch.trim().toLowerCase();
    if (!q) return true;
    return [b.name, b.location, b.size, (b as any).city]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const selectedBillboardsDetails = (formData.billboard_ids
    .map((id) => availableBillboards.find((b) => b.id === id))
    .filter(Boolean)) as Billboard[];



  // حساب التكلفة التقديرية حسب باقات الأسعار والفئة
  const estimatedTotal = useMemo(() => {
    const months = Number(durationMonths || 0);
    if (!months) return 0;
    return selectedBillboardsDetails.reduce((acc, b) => {
      const size = (b.size || (b as any).Size || '') as string;
      const level = (b.level || (b as any).Level) as any;
      const price = getPriceFor(size, level, pricingCategory as CustomerType, months);
      if (price !== null) return acc + price;
      const monthly = Number((b as any).price) || 0;
      return acc + monthly * months;
    }, 0);
  }, [selectedBillboardsDetails, durationMonths, pricingCategory]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, rent_cost: estimatedTotal }));
  }, [estimatedTotal]);

  // Multi-select handlers
  const toggleContractSelection = (contractId: string | number) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;
    
    const contractCustomerName = contract.customer_name || '';
    
    setSelectedContractIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contractId)) {
        newSet.delete(contractId);
      } else {
        newSet.add(contractId);
      }
      return newSet;
    });
  };

  const selectAllFiltered = () => {
    const ids = filteredContracts.map(c => c.id);
    setSelectedContractIds(new Set(ids));
  };

  const clearSelection = () => {
    setSelectedContractIds(new Set());
  };

  const handleExportMultipleContracts = async () => {
    if (selectedContractIds.size === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل');
      return;
    }

    setIsExportingMultiple(true);
    try {
      const allBillboards: any[] = [];
      const contractNumbers: string[] = [];

      for (const contractId of selectedContractIds) {
        try {
          const contractWithBillboards = await getContractWithBillboards(String(contractId));
          const billboardsData = (contractWithBillboards as any).billboards || [];
          const contractNumber = (contractWithBillboards as any).Contract_Number || contractId;
          contractNumbers.push(String(contractNumber));
          
          // ✅ جلب أسعار اللوحات التاريخية من العقد
          let billboardPricesMap: Record<string, number> = {};
          const billboardPrices = (contractWithBillboards as any).billboard_prices;
          if (billboardPrices) {
            try {
              const pricesData = typeof billboardPrices === 'string'
                ? JSON.parse(billboardPrices)
                : billboardPrices;
              if (Array.isArray(pricesData)) {
                pricesData.forEach((item: any) => {
                  const key = String(item.billboardId ?? item.billboard_id ?? item.ID ?? item.id ?? '');
                  if (!key) return;
                  const priceValue = item.finalPrice ?? item.calculatedPrice ?? item.price ?? item.contractPrice ?? item.priceBeforeDiscount ?? item.price_before_discount ?? item.billboardPrice ?? item.billboard_rent_price;
                  const price = Number(priceValue);
                  if (!Number.isNaN(price)) billboardPricesMap[key] = price;
                });
              }
            } catch (e) {
              console.warn('Failed to parse billboard_prices:', e);
            }
          }
          
          billboardsData.forEach((b: any) => {
            const billboardId = String(b.ID ?? b.id ?? '');
            const historicalPrice = billboardId ? billboardPricesMap[billboardId] : undefined;
            allBillboards.push({
              ...b,
              contractNumber: contractNumber,
              customerName: (contractWithBillboards as any).customer_name || '',
              contractAdType: (contractWithBillboards as any)['Ad Type'] || (contractWithBillboards as any).ad_type || '',
              historicalPrice: historicalPrice ?? (b.Price ?? null)
            });
          });
        } catch (e) {
          console.error(`Failed to load contract ${contractId}:`, e);
        }
      }

      if (allBillboards.length === 0) {
        toast.error('لا توجد لوحات في العقود المختارة');
        return;
      }

      // جلب صور التركيب لكل اللوحات دفعة واحدة
      const allBillboardIds = allBillboards
        .map((b: any) => Number(b.ID ?? b.id))
        .filter((id: number) => Number.isFinite(id));
      const installedImagesMap = new Map<number, { faceA: string; faceB: string }>();
      if (allBillboardIds.length > 0) {
        try {
          const { data: items, error: itemsErr } = await supabase
            .from('installation_task_items')
            .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, created_at')
            .in('billboard_id', allBillboardIds)
            .order('created_at', { ascending: false });
          if (itemsErr) console.warn('[handleExportMultipleContracts] installation_task_items error:', itemsErr);
          if (items) {
            // اختر أول صف يحوي صوراً فعلية لكل لوحة
            for (const it of items as any[]) {
              const bid = Number(it.billboard_id);
              if (!Number.isFinite(bid)) continue;
              const existing = installedImagesMap.get(bid);
              if (existing && (existing.faceA || existing.faceB)) continue;
              const faceA = it.installed_image_face_a_url || '';
              const faceB = it.installed_image_face_b_url || '';
              if (!faceA && !faceB && existing) continue;
              installedImagesMap.set(bid, { faceA, faceB });
            }
          }
          // Fallback من billboard_history
          const missing = allBillboardIds.filter((id) => {
            const e = installedImagesMap.get(id);
            return !e || (!e.faceA && !e.faceB);
          });
          if (missing.length > 0) {
            const { data: hist } = await supabase
              .from('billboard_history')
              .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, updated_at')
              .in('billboard_id', missing)
              .order('updated_at', { ascending: false });
            if (hist) {
              for (const h of hist as any[]) {
                const bid = Number(h.billboard_id);
                if (!Number.isFinite(bid)) continue;
                const existing = installedImagesMap.get(bid);
                if (existing && (existing.faceA || existing.faceB)) continue;
                if (!h.installed_image_face_a_url && !h.installed_image_face_b_url) continue;
                installedImagesMap.set(bid, {
                  faceA: h.installed_image_face_a_url || '',
                  faceB: h.installed_image_face_b_url || '',
                });
              }
            }
          }
          // لوغ تشخيصي
          const finalMissing = allBillboardIds.filter((id) => {
            const e = installedImagesMap.get(id);
            return !e || (!e.faceA && !e.faceB);
          });
          console.info(
            `[handleExportMultipleContracts] صور التركيب: ${allBillboardIds.length - finalMissing.length}/${allBillboardIds.length} لوحة`,
            finalMissing.length > 0 ? { missingBillboardIds: finalMissing } : ''
          );
        } catch (err) {
          console.warn('Failed to fetch installation images:', err);
        }
      }

      // Export using modified function
      const exportData = allBillboards.map((billboard) => {
        const bid = Number(billboard.ID ?? billboard.id);
        const installed = installedImagesMap.get(bid) || { faceA: '', faceB: '' };
        return {
        billboardName: billboard.Billboard_Name || billboard.name || billboard.ID || billboard.id || '',
        nearestLandmark: billboard.Nearest_Landmark || billboard.nearest_landmark || billboard.location || '',
        municipality: billboard.Municipality || billboard.municipality || billboard.City || '',
        size: billboard.Size || billboard.size || '',
        facesCount: billboard.Faces_Count || billboard.faces_count || billboard.Faces || billboard.faces || '',
        billboardType: billboard.billboard_type || billboard.Ad_Type || billboard.ad_type || billboard.type || '',
        imageUrl: billboard.Image_URL || billboard.image_url || billboard.image || '',
        coordinates: billboard.GPS_Coordinates || billboard.coordinates || billboard.coords || '',
        customerName: billboard.customerName || '',
        contractNumber: billboard.contractNumber || '',
        adType: billboard.Ad_Type || billboard.ad_type || billboard.contractAdType || '',
        price: billboard.historicalPrice ?? billboard.Price ?? '',
        installedFaceA: installed.faceA,
        installedFaceB: installed.faceB,
        };
      });

      const headers = {
        billboardName: 'اسم اللوحة',
        nearestLandmark: 'أقرب نقطة دالة',
        municipality: 'البلدية',
        size: 'المقاس',
        facesCount: 'عدد الأوجه',
        billboardType: 'نوع اللوحة',
        imageUrl: 'رابط الصورة',
        coordinates: 'إحداثيات اللوحة',
        customerName: 'اسم الزبون',
        contractNumber: 'رقم العقد',
        adType: 'نوع الإعلان',
        price: 'السعر',
        installedFaceA: 'رابط صورة التركيب - الوجه الأمامي',
        installedFaceB: 'رابط صورة التركيب - الوجه الخلفي',
      };

      const wsData = [
        Object.values(headers),
        ...exportData.map(row => Object.keys(headers).map(key => (row as any)[key] || ''))
      ];

      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
        { wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
        { wch: 40 }, { wch: 40 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'اللوحات');

      const fileName = `لوحات_${selectedContractIds.size}_عقود.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(`تم تصدير ${allBillboards.length} لوحة من ${selectedContractIds.size} عقد`);
    } catch (error) {
      console.error('Error exporting multiple contracts:', error);
      toast.error('فشل في تصدير اللوحات');
    } finally {
      setIsExportingMultiple(false);
    }
  };

  const handlePrintSizesInvoice = async () => {
    if (selectedContractIds.size === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل');
      return;
    }

    try {
      const allBillboards: any[] = [];
      const contractNumbers: string[] = [];
      let customerName = '';

      for (const contractId of selectedContractIds) {
        try {
          const contractWithBillboards = await getContractWithBillboards(String(contractId));
          const billboardsData = (contractWithBillboards as any).billboards || [];
          const contractNumber = (contractWithBillboards as any).Contract_Number || contractId;
          contractNumbers.push(String(contractNumber));
          
          if (!customerName) {
            customerName = (contractWithBillboards as any).customer_name || '';
          }

          // جلب اللوحات المحددة كوجه واحد في هذا العقد
          const singleFaceRaw = (contractWithBillboards as any).single_face_billboards;
          let singleFaceSet = new Set<string>();
          if (singleFaceRaw) {
            try {
              const ids = typeof singleFaceRaw === 'string' ? JSON.parse(singleFaceRaw) : singleFaceRaw;
              if (Array.isArray(ids)) singleFaceSet = new Set(ids.map(String));
            } catch {}
          }
          
          billboardsData.forEach((b: any) => {
            const bId = String(b.ID || b.id || '');
            // إذا كانت اللوحة محددة كوجه واحد، نعدّل Faces_Count لتظهر صحيحة في الطباعة
            if (singleFaceSet.has(bId)) {
              allBillboards.push({ ...b, Faces_Count: 1, faces_count: 1 });
            } else {
              allBillboards.push(b);
            }
          });
        } catch (e) {
          console.error(`Failed to load contract ${contractId}:`, e);
        }
      }

      if (allBillboards.length === 0) {
        toast.error('لا توجد لوحات في العقود المختارة');
        return;
      }

      setSizesInvoiceData({
        billboards: allBillboards,
        customerName,
        contractNumbers,
      });
      setSizesInvoiceOpen(true);
    } catch (error) {
      console.error('Error preparing sizes invoice:', error);
      toast.error('فشل في تجهيز فاتورة المقاسات');
    }
  };

  // طباعة جميع العقود المحددة
  const handlePrintSelectedContracts = async () => {
    if (selectedContractIds.size === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل');
      return;
    }

    setIsPrintingSelected(true);
    try {
      const contractsToPrint: any[] = [];
      
      for (const contractId of selectedContractIds) {
        try {
          const contractWithBillboards = await getContractWithBillboards(String(contractId));
          contractsToPrint.push(contractWithBillboards);
        } catch (e) {
          console.error(`Failed to load contract ${contractId}:`, e);
        }
      }

      if (contractsToPrint.length === 0) {
        toast.error('فشل في تحميل العقود المحددة');
        return;
      }

      // Print all contracts one after another
      for (let i = 0; i < contractsToPrint.length; i++) {
        const contract = contractsToPrint[i];
        setSelectedContractForPDF(contract);
        setPdfOpen(true);
        
        // Wait for user to close each print dialog before showing next
        await new Promise<void>((resolve) => {
          const checkClosed = setInterval(() => {
            // We'll handle this through state - for now just print the first one
            clearInterval(checkClosed);
            resolve();
          }, 100);
        });
      }

      toast.success(`تم فتح ${contractsToPrint.length} عقد للطباعة`);
    } catch (error) {
      console.error('Error printing selected contracts:', error);
      toast.error('فشل في طباعة العقود');
    } finally {
      setIsPrintingSelected(false);
    }
  };

  // Handle range selection
  const handleRangeSelection = (newSelectedIds: Set<string | number>) => {
    setSelectedContractIds(newSelectedIds);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">جاري تحميل العقود...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-2.5 sm:p-4 md:p-6" dir="rtl">
      <PageHero
        icon={<FileText className="h-5 w-5 sm:h-6 sm:w-6" />}
        title="إدارة العقود"
        description="إنشاء وإدارة عقود الإيجار مع اللوحات الإعلانية"
        actions={
          <>
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'cards' | 'table')} className="rounded-full bg-muted/40 p-0.5">
              <ToggleGroupItem value="cards" aria-label="عرض الكروت" className="gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>كروت</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="عرض الجدول" className="gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
                <List className="h-3.5 w-3.5" />
                <span>جدول</span>
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" size="sm" onClick={() => setAlertsDialogOpen(true)} className="gap-1.5 rounded-full h-8 sm:h-9 px-2.5 sm:px-3 text-xs">
              <Send className="h-3.5 w-3.5" />
              <span>تنبيهات</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setReportDialogOpen(true)} className="gap-1.5 rounded-full h-8 sm:h-9 px-2.5 sm:px-3 text-xs">
              <FileText className="h-3.5 w-3.5" />
              <span>تقرير</span>
            </Button>
            {canCreateOrDelete && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMissingNumbersOpen(true)}
                  className="gap-1.5 rounded-full h-8 sm:h-9 px-2.5 sm:px-3 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-bold"
                  title="البحث عن فجوات الترقيم وإضافة عقد برقم مفقود"
                >
                  <Hash className="h-3.5 w-3.5 text-amber-500" />
                  <span>أرقام ناقصة</span>
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 rounded-full h-8 sm:h-9 px-3 sm:px-4 text-xs font-bold bg-gradient-to-l from-primary to-primary/80 hover:shadow-[var(--shadow-luxury)] transition-shadow"
                  onClick={() => setQuickCreateOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>عقد جديد</span>
                </Button>
              </div>
            )}
          </>
        }
        stats={
          <>
            <StatBadge label="إجمالي" value={contracts.length} variant="primary" />
            <StatBadge label="نشطة" value={contracts.filter((c: any) => c.End_Date ? new Date(c.End_Date) >= new Date() : true).length} variant="success" />
            <StatBadge label="متأخرة" value={delayedContractIds.size} variant="danger" />
          </>
        }
      />

      {/* إحصائيات محسّنة */}
      <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <span className="font-medium">الإحصائيات السريعة</span>
            </div>
            <Badge variant="secondary">{statsOpen ? 'إخفاء' : 'إظهار'}</Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <ContractStats contracts={filteredContracts} />
        </CollapsibleContent>
      </Collapsible>

      {/* كاشف اللوحات المتضاربة (التأجير المزدوج) */}
      <DoubleBillboardDetector />

      {/* البحث والفلاتر المحسّنة */}
      <Card className="border-0 shadow-sm bg-gradient-to-l from-muted/30 to-background">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث برقم العقد، اسم العميل، أو نوع الإعلان..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-background border-border/50"
                />
              </div>
            
              <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 bg-background">
                  <SelectValue placeholder="حالة العقد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      نشطة
                    </div>
                  </SelectItem>
                  <SelectItem value="expiring">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      قريبة الانتهاء
                    </div>
                  </SelectItem>
                  <SelectItem value="expired">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      منتهية
                    </div>
                  </SelectItem>
                  <SelectItem value="upcoming">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      لم تبدأ
                    </div>
                  </SelectItem>
                  <SelectItem value="delayed">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      متأخرة التركيب ({delayedContractIds.size})
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="w-44 bg-background">
                  <SelectValue placeholder="العميل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع العملاء</SelectItem>
                  {uniqueCustomers.map(customer => (
                    <SelectItem key={customer} value={customer}>
                      {customer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(searchQuery || statusFilter !== 'all' || customerFilter !== 'all' || yearFilter !== 'all' || startMonthFilter !== 'all' || endMonthFilter !== 'all') && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setCustomerFilter('all');
                    setYearFilter('all');
                    setStartMonthFilter('all');
                    setEndMonthFilter('all');
                  }}
                  className="text-muted-foreground"
                >
                  مسح الفلاتر
                </Button>
              )}
            </div>
            </div>
            
            {/* أزرار السنوات السريعة */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-sm text-muted-foreground">السنة:</span>
              <Button
                variant={yearFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setYearFilter('all')}
                className="h-7 px-3"
              >
                الكل
              </Button>
              {availableYears.map(year => (
                <Button
                  key={year}
                  variant={yearFilter === String(year) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setYearFilter(String(year))}
                  className="h-7 px-3"
                >
                  {year}
                </Button>
              ))}
              
              <div className="border-r border-border h-6 mx-2" />
              
              <Button
                variant={showUnpaid ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setShowUnpaid(!showUnpaid);
                  if (!showUnpaid) setShowTrash(false);
                }}
                className="h-7 px-3 gap-1"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                غير مسددة ({unpaidContracts.length})
              </Button>
              
              <Button
                variant={showTrash ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => {
                  setShowTrash(!showTrash);
                  if (!showTrash) setShowUnpaid(false);
                }}
                className="h-7 px-3 gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                المهملات ({trashContracts.length})
              </Button>
            </div>
            
            {/* فلاتر الأشهر */}
            <div className="flex items-center gap-2 mt-3 flex-wrap overflow-x-auto">
              <span className="text-sm text-muted-foreground">شهر البداية:</span>
              <Select value={startMonthFilter} onValueChange={setStartMonthFilter}>
                <SelectTrigger className="w-32 h-7 bg-background text-xs">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="1">يناير</SelectItem>
                  <SelectItem value="2">فبراير</SelectItem>
                  <SelectItem value="3">مارس</SelectItem>
                  <SelectItem value="4">أبريل</SelectItem>
                  <SelectItem value="5">مايو</SelectItem>
                  <SelectItem value="6">يونيو</SelectItem>
                  <SelectItem value="7">يوليو</SelectItem>
                  <SelectItem value="8">أغسطس</SelectItem>
                  <SelectItem value="9">سبتمبر</SelectItem>
                  <SelectItem value="10">أكتوبر</SelectItem>
                  <SelectItem value="11">نوفمبر</SelectItem>
                  <SelectItem value="12">ديسمبر</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="border-r border-border h-6 mx-1" />
              
              <span className="text-sm text-muted-foreground">شهر النهاية:</span>
              <Select value={endMonthFilter} onValueChange={setEndMonthFilter}>
                <SelectTrigger className="w-32 h-7 bg-background text-xs">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="1">يناير</SelectItem>
                  <SelectItem value="2">فبراير</SelectItem>
                  <SelectItem value="3">مارس</SelectItem>
                  <SelectItem value="4">أبريل</SelectItem>
                  <SelectItem value="5">مايو</SelectItem>
                  <SelectItem value="6">يونيو</SelectItem>
                  <SelectItem value="7">يوليو</SelectItem>
                  <SelectItem value="8">أغسطس</SelectItem>
                  <SelectItem value="9">سبتمبر</SelectItem>
                  <SelectItem value="10">أكتوبر</SelectItem>
                  <SelectItem value="11">نوفمبر</SelectItem>
                  <SelectItem value="12">ديسمبر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* خيارات العرض الإضافية */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showYearlyCode} 
                onChange={(e) => setShowYearlyCode(e.target.checked)}
                className="rounded border-border"
              />
              <Hash className="h-4 w-4 text-primary" />
              <span className="text-sm">إظهار ترتيب السنة</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={separateExpired} 
                onChange={(e) => setSeparateExpired(e.target.checked)}
                className="rounded border-border"
              />
              <SplitSquareVertical className="h-4 w-4 text-orange-500" />
              <span className="text-sm">فصل المنتهية</span>
            </label>
          </div>
          
          {/* عداد النتائج وزر تحديد النطاق */}
          <div className="flex items-center justify-between gap-2 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>عرض {filteredContracts.length} من {contracts.length} عقد</span>
              {separateExpired && (
                <span className="text-muted-foreground">
                  ({allFilteredActiveContracts.length} نشط، {allFilteredExpiredContracts.length} منتهي)
                </span>
              )}
            </div>
            {selectedContractIds.size === 0 && (
              <ContractRangeSelector
                contracts={contracts}
                onSelectRange={handleRangeSelection}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* شريط الاختيار المتعدد */}
      {selectedContractIds.size > 0 && (
        <Card className="border-primary/50 bg-primary/5 shadow-lg sticky top-4 z-40">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="text-base px-3 py-1">
                  {selectedContractIds.size} عقد مختار
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="gap-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  إلغاء الاختيار
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ContractRangeSelector
                  contracts={contracts}
                  onSelectRange={handleRangeSelection}
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllFiltered}
                    className="gap-2"
                  >
                    <CheckSquare className="h-4 w-4" />
                    اختيار الكل ({filteredContracts.length})
                  </Button>
                </div>
                <Button
                  onClick={handlePrintSelectedContracts}
                  disabled={isPrintingSelected}
                  variant="outline"
                  className="gap-2 border-primary text-primary hover:bg-primary/10"
                >
                  {isPrintingSelected ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  طباعة العقود ({selectedContractIds.size})
                </Button>
                <Button
                  onClick={handlePrintSizesInvoice}
                  variant="outline"
                  className="gap-2 border-amber-500 text-amber-600 hover:bg-amber-50"
                >
                  <Ruler className="h-4 w-4" />
                  طباعة فاتورة المقاسات
                </Button>
                <Button
                  onClick={handleExportMultipleContracts}
                  disabled={isExportingMultiple}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isExportingMultiple ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  تنزيل اللوحات Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sizes Invoice Dialog */}
      <SizesInvoicePrintDialog
        open={sizesInvoiceOpen}
        onOpenChange={setSizesInvoiceOpen}
        billboards={sizesInvoiceData.billboards}
        customerName={sizesInvoiceData.customerName}
        contractNumbers={sizesInvoiceData.contractNumbers}
      />

      {/* عرض الكروت */}
      {viewMode === 'cards' && (
        <div className="space-y-6">
          {/* العقود النشطة */}
          {separateExpired ? (
            <>
              {/* Pagination أعلى - الوضع المفصول */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm" dir="rtl">
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className="h-8 px-2 text-xs">
                      <ChevronRight className="h-3.5 w-3.5 ml-0.5" />الأولى
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 px-3 text-xs">
                      السابق
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 7) page = i + 1;
                      else if (currentPage <= 4) page = i + 1;
                      else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                      else page = currentPage - 3 + i;
                      return (
                        <Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`h-8 w-8 p-0 text-xs ${currentPage === page ? '' : 'text-muted-foreground'}`}>
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 px-3 text-xs">
                      التالي
                    </Button>
                    <Button variant="ghost" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} className="h-8 px-2 text-xs">
                      الأخيرة<ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                    </Button>
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  العقود النشطة ({allFilteredActiveContracts.length})
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                  {activeContracts.map((contract) => (
                    <ContractCard
                      key={contract.id}
                      contract={contract}
                      yearlyCode={showYearlyCode ? getContractYearlyOrder(contract) : undefined}
                      isSelected={selectedContractIds.has(contract.id)}
                      onToggleSelect={toggleContractSelection}
                      onDelete={handleDeleteContract}
                      onPrint={handlePrintContract}
                      onInstall={openInstallDialog}
                      onPrintAll={async (c) => {
                        try {
                          const contractWithBillboards = await getContractWithBillboards(String(c.id));
                          const billboardsData = (contractWithBillboards as any).billboards || [];
                          if (billboardsData.length === 0) {
                            toast.info('لا توجد لوحات لهذا العقد');
                            return;
                          }
                          const billboardsMap: Record<number, any> = {};
                          const items = billboardsData.map((bb: any) => {
                            billboardsMap[bb.ID] = bb;
                            return {
                              id: bb.ID,
                              billboard_id: bb.ID,
                              design_face_a: bb.design_face_a,
                              design_face_b: bb.design_face_b,
                            };
                          });
                          setPrintAllData({
                            contractNumber: (c as any).Contract_Number || c.id,
                            customerName: c.customer_name || '',
                            adType: c.ad_type || (c as any)['Ad Type'] || (contractWithBillboards as any)['Ad Type'] || '',
                            items,
                            billboards: billboardsMap
                          });
                          setPrintAllDialogOpen(true);
                        } catch (error) {
                          console.error('Error:', error);
                          toast.error('فشل في تحميل البيانات');
                        }
                      }}
                      onBillboardPrint={async (c) => {
                        try {
                          const contractWithBillboards = await getContractWithBillboards(String(c.id));
                          const billboardsData = (contractWithBillboards as any).billboards || [];
                          if (billboardsData.length === 0) {
                            toast.info('لا توجد لوحات لهذا العقد');
                            return;
                          }
                          window.dispatchEvent(new CustomEvent('openBillboardPrint', {
                            detail: {
                              contractNumber: c.id,
                              billboards: billboardsData,
                              customerName: c.customer_name || (contractWithBillboards as any).customer_name || (contractWithBillboards as any)['Customer Name'] || '',
                              adType: (c as any)['Ad Type'] || (contractWithBillboards as any)['Ad Type'] || '',
                              startDate: c.start_date || (contractWithBillboards as any).start_date || (contractWithBillboards as any)['Contract Date'] || '',
                              endDate: c.end_date || (contractWithBillboards as any).end_date || (contractWithBillboards as any)['End Date'] || ''
                            }
                          }));
                        } catch (error) {
                          console.error('Error loading contract data:', error);
                          toast.error('فشل في تحميل بيانات العقد');
                        }
                      }}
                      onExport={async (c, type) => {
                        try {
                          const contractWithBillboards = await getContractWithBillboards(String(c.id));
                          const billboardsData = (contractWithBillboards as any).billboards || [];
                          if (billboardsData.length === 0) {
                            toast.info('لا توجد لوحات لهذا العقد');
                            return;
                          }
                          if (type === 'review') {
                            await exportContractReviewExcel({ contract: contractWithBillboards });
                          } else if (type === 'csv') {
                            await exportBillboardsToCSV({
                              contractNumber: c.Contract_Number || c.id,
                              billboards: billboardsData,
                              customerName: c.customer_name || '',
                              includePrices: false,
                            });
                          } else if (type === 'zip') {
                            const tId = toast.loading('جاري تنزيل صور العقد...');
                            try {
                              const { added, failed } = await exportContractImagesToZip({
                                contractNumber: c.Contract_Number || c.id,
                                billboards: billboardsData,
                                customerName: c.customer_name || '',
                              });
                              toast.dismiss(tId);
                              toast.success(`تم تنزيل ${added} صورة${failed ? ` (تعذّر ${failed})` : ''}`);
                            } catch (err: any) {
                              toast.dismiss(tId);
                              toast.error(err?.message || 'فشل تنزيل ملف ZIP');
                            }
                            return;
                          } else {
                            await exportBillboardsToExcel({
                              contractNumber: c.Contract_Number || c.id,
                              billboards: billboardsData,
                              customerName: c.customer_name || '',
                              includePrices: type !== 'basic'
                            });
                          }
                          toast.success('تم تصدير اللوحات بنجاح');
                        } catch (error) {
                          console.error('Error exporting billboards:', error);
                          toast.error('فشل في تصدير اللوحات');
                        }
                      }}
                      onRefresh={loadData}
                    />
                  ))}
                </div>
              </div>

              {/* العقود المنتهية */}
              {expiredContracts.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    العقود المنتهية ({allFilteredExpiredContracts.length})
                  </h3>
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                    {expiredContracts.map((contract) => (
                      <ContractCard
                        key={contract.id}
                        contract={contract}
                        yearlyCode={showYearlyCode ? getContractYearlyOrder(contract) : undefined}
                        isSelected={selectedContractIds.has(contract.id)}
                        onToggleSelect={toggleContractSelection}
                        onDelete={handleDeleteContract}
                        onPrint={handlePrintContract}
                        onInstall={openInstallDialog}
                        onPrintAll={async (c) => {
                          try {
                            const contractWithBillboards = await getContractWithBillboards(String(c.id));
                            const billboardsData = (contractWithBillboards as any).billboards || [];
                            if (billboardsData.length === 0) {
                              toast.info('لا توجد لوحات لهذا العقد');
                              return;
                            }
                            const billboardsMap: Record<number, any> = {};
                            const items = billboardsData.map((bb: any) => {
                              billboardsMap[bb.ID] = bb;
                              return {
                                id: bb.ID,
                                billboard_id: bb.ID,
                                design_face_a: bb.design_face_a,
                                design_face_b: bb.design_face_b,
                              };
                            });
                            setPrintAllData({
                              contractNumber: (c as any).Contract_Number || c.id,
                              customerName: c.customer_name || '',
                              adType: c.ad_type || (c as any)['Ad Type'] || (contractWithBillboards as any)['Ad Type'] || '',
                              items,
                              billboards: billboardsMap
                            });
                            setPrintAllDialogOpen(true);
                          } catch (error) {
                            console.error('Error:', error);
                            toast.error('فشل في تحميل البيانات');
                          }
                        }}
                        onBillboardPrint={async (c) => {
                          try {
                            const contractWithBillboards = await getContractWithBillboards(String(c.id));
                            const billboardsData = (contractWithBillboards as any).billboards || [];
                            if (billboardsData.length === 0) {
                              toast.info('لا توجد لوحات لهذا العقد');
                              return;
                            }
                            window.dispatchEvent(new CustomEvent('openBillboardPrint', {
                              detail: {
                                contractNumber: c.id,
                                billboards: billboardsData,
                                customerName: c.customer_name || (contractWithBillboards as any).customer_name || '',
                                adType: (c as any)['Ad Type'] || (contractWithBillboards as any)['Ad Type'] || ''
                              }
                            }));
                          } catch (error) {
                            console.error('Error loading contract data:', error);
                            toast.error('فشل في تحميل بيانات العقد');
                          }
                        }}
                        onExport={async (c, type) => {
                          try {
                            const contractWithBillboards = await getContractWithBillboards(String(c.id));
                            const billboardsData = (contractWithBillboards as any).billboards || [];
                            if (billboardsData.length === 0) {
                              toast.info('لا توجد لوحات لهذا العقد');
                              return;
                            }
                            if (type === 'review') {
                              await exportContractReviewExcel({ contract: contractWithBillboards });
                            } else if (type === 'csv') {
                              await exportBillboardsToCSV({
                                contractNumber: c.Contract_Number || c.id,
                                billboards: billboardsData,
                                customerName: c.customer_name || '',
                                includePrices: false,
                              });
                            } else if (type === 'zip') {
                              const tId = toast.loading('جاري تنزيل صور العقد...');
                              try {
                                const { added, failed } = await exportContractImagesToZip({
                                  contractNumber: c.Contract_Number || c.id,
                                  billboards: billboardsData,
                                  customerName: c.customer_name || '',
                                });
                                toast.dismiss(tId);
                                toast.success(`تم تنزيل ${added} صورة${failed ? ` (تعذّر ${failed})` : ''}`);
                              } catch (err: any) {
                                toast.dismiss(tId);
                                toast.error(err?.message || 'فشل تنزيل ملف ZIP');
                              }
                              return;
                            } else {
                              await exportBillboardsToExcel({
                                contractNumber: c.Contract_Number || c.id,
                                billboards: billboardsData,
                                customerName: c.customer_name || '',
                                includePrices: type !== 'basic'
                              });
                            }
                            toast.success('تم تصدير اللوحات بنجاح');
                          } catch (error) {
                            console.error('Error exporting billboards:', error);
                            toast.error('فشل في تصدير اللوحات');
                          }
                        }}
                        onRefresh={loadData}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>

              {/* Pagination أعلى */}
              {totalPages > 1 && (
                <div className="col-span-full flex items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm" dir="rtl">
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className="h-8 px-2 text-xs">
                      <ChevronRight className="h-3.5 w-3.5 ml-0.5" />الأولى
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 px-3 text-xs">
                      السابق
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 7) {
                        page = i + 1;
                      } else if (currentPage <= 4) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        page = totalPages - 6 + i;
                      } else {
                        page = currentPage - 3 + i;
                      }
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`h-8 w-8 p-0 text-xs ${currentPage === page ? '' : 'text-muted-foreground'}`}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 px-3 text-xs">
                      التالي
                    </Button>
                    <Button variant="ghost" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} className="h-8 px-2 text-xs">
                      الأخيرة<ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                    </Button>
                  </div>
                </div>
              )}

              {paginatedContracts.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  yearlyCode={showYearlyCode ? getContractYearlyOrder(contract) : undefined}
                  isSelected={selectedContractIds.has(contract.id)}
                  onToggleSelect={toggleContractSelection}
                  onDelete={handleDeleteContract}
                  onPrint={handlePrintContract}
                  onInstall={openInstallDialog}
                  onBillboardPrint={async (c) => {
                    try {
                      const contractWithBillboards = await getContractWithBillboards(String(c.id));
                      const billboardsData = (contractWithBillboards as any).billboards || [];
                      let designData = null;
                      try {
                        const rawDesignData = (contractWithBillboards as any).design_data;
                        if (rawDesignData) {
                          designData = typeof rawDesignData === 'string' ? JSON.parse(rawDesignData) : rawDesignData;
                        }
                      } catch (e) {
                        console.error('Failed to parse design_data:', e);
                      }
                      if (billboardsData.length === 0) {
                        toast.info('لا توجد لوحات لهذا العقد');
                        return;
                      }
                      window.dispatchEvent(new CustomEvent('openBillboardPrint', {
                        detail: {
                          contractNumber: c.id,
                          billboards: billboardsData,
                          designData: designData,
                          customerName: c.customer_name || (contractWithBillboards as any).customer_name || (contractWithBillboards as any)['Customer Name'] || '',
                          customerPhone: (c as any).Phone || (contractWithBillboards as any).Phone || '',
                          startDate: c.start_date || (contractWithBillboards as any).start_date || (contractWithBillboards as any)['Contract Date'] || '',
                          endDate: c.end_date || (contractWithBillboards as any).end_date || (contractWithBillboards as any)['End Date'] || ''
                        }
                      }));
                    } catch (error) {
                      console.error('Error loading contract data:', error);
                      toast.error('فشل في تحميل بيانات العقد');
                    }
                  }}
                  onExport={async (c, type) => {
                    try {
                      const contractWithBillboards = await getContractWithBillboards(String(c.id));
                      const billboardsData = (contractWithBillboards as any).billboards || [];
                      if (billboardsData.length === 0) {
                        toast.info('لا توجد لوحات لهذا العقد');
                        return;
                      }
                       if (type === 'review') {
                         await exportContractReviewExcel({ contract: contractWithBillboards });
                       } else if (type === 'csv') {
                         await exportBillboardsToCSV({
                           contractNumber: c.Contract_Number || c.id,
                           billboards: billboardsData,
                           customerName: c.customer_name || '',
                           includePrices: false,
                         });
                       } else {
                         await exportBillboardsToExcel({
                           contractNumber: c.Contract_Number || c.id,
                           billboards: billboardsData,
                           customerName: c.customer_name || '',
                           includePrices: type !== 'basic'
                         });
                       }
                       toast.success('تم تصدير اللوحات بنجاح');
                     } catch (error) {
                       console.error('Error exporting billboards:', error);
                       toast.error('فشل في تصدير اللوحات');
                     }
                   }}
                  onRefresh={loadData}
                />
              ))}
            </div>
          )}

          {/* Pagination أسفل */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 mt-6 p-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm" dir="rtl">
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => { setCurrentPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="h-8 px-2 text-xs">
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />الأولى
                </Button>
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="h-8 px-3 text-xs">
                  السابق
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 7) {
                    page = i + 1;
                  } else if (currentPage <= 4) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    page = totalPages - 6 + i;
                  } else {
                    page = currentPage - 3 + i;
                  }
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className={`h-8 w-8 p-0 text-xs ${currentPage === page ? '' : 'text-muted-foreground'}`}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="h-8 px-3 text-xs">
                  التالي
                </Button>
                <Button variant="ghost" size="sm" disabled={currentPage === totalPages} onClick={() => { setCurrentPage(totalPages); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="h-8 px-2 text-xs">
                  الأخيرة<ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* جدول العقود */}
      {viewMode === 'table' && (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            قائمة العقود
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم العقد</TableHead>
                  <TableHead>اسم الزبون</TableHead>
                  <TableHead>نوع الإعلان</TableHead>
                  <TableHead>تاريخ البداية</TableHead>
                  <TableHead>تاريخ النهاية</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>التركيب</TableHead>
                  <TableHead>الطباعة</TableHead>
                  <TableHead>رسوم التشغيل</TableHead>
                  <TableHead>المجموع الكلي</TableHead>
                  <TableHead>نسبة السداد</TableHead>
                  <TableHead>التقدم / التأخر</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContracts.map((contract) => {
                  // ✅ عرض القيم المحفوظة في قاعدة البيانات مباشرة بدون أي حسابات أو تعديلات
                  const totalRent = Number(contract.rent_cost || (contract as any)['Total Rent'] || 0);
                  const installationCost = Number((contract as any).installation_cost || (contract as any)['Installation Cost'] || 0);
                  const printCost = Number((contract as any).print_cost || (contract as any)['Print Cost'] || 0);
                  const operatingFee = Number((contract as any).fee || (contract as any)['Operating Fee'] || 0);
                  const totalCost = Number((contract as any).total_cost || (contract as any)['Total'] || 0);
                  
                  // ✅ المجموع الكلي: إما من قاعدة البيانات أو مجموع القيم المحفوظة
                  const finalTotalCost = totalCost > 0 ? totalCost : (totalRent + installationCost + printCost + operatingFee);
                  
                  // حساب نسبة السداد
                  const totalPaid = Number((contract as any)['Total Paid'] || (contract as any).total_paid || 0);
                  const paymentPercentage = finalTotalCost > 0 ? (totalPaid / finalTotalCost) * 100 : 0;
                  
                  // حساب نسبة المدة المقضية
                  const startDate = contract.start_date ? new Date(contract.start_date) : null;
                  const endDate = contract.end_date ? new Date(contract.end_date) : null;
                  const today = new Date();
                  let timePercentage = 0;
                  let timeDifference = 0;
                  
                  if (startDate && endDate) {
                    const totalDuration = endDate.getTime() - startDate.getTime();
                    const elapsed = today.getTime() - startDate.getTime();
                    timePercentage = totalDuration > 0 ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100) : 0;
                    timeDifference = paymentPercentage - timePercentage;
                  }
                  
                  // تحديد لون ورمز المؤشر
                  const getProgressIndicator = () => {
                    if (!startDate || !endDate || today < startDate) {
                      return { text: '—', color: 'text-muted', icon: null };
                    }
                    if (Math.abs(timeDifference) < 5) {
                      return { text: 'متوازن', color: 'text-green', icon: <CheckCircle className="h-4 w-4" /> };
                    }
                    if (timeDifference > 0) {
                      return { text: `متقدم ${Math.abs(timeDifference).toFixed(0)}%`, color: 'text-blue', icon: <CheckCircle className="h-4 w-4" /> };
                    }
                    return { text: `متأخر ${Math.abs(timeDifference).toFixed(0)}%`, color: 'text-red', icon: <AlertCircle className="h-4 w-4" /> };
                  };
                  
                  const progressIndicator = getProgressIndicator();
                  
                  return (
                    <TableRow key={contract.id} className={`card-hover ${getRowClassName(contract)}`}>
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{String((contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? contract.id)}</span>
                          {showYearlyCode && (
                            <Badge variant="secondary" className="text-xs">
                              {getContractYearlyOrder(contract)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{contract.customer_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Building className="h-3 w-3" />
                          {(contract as any)['Ad Type'] || 'غير محدد'}
                        </Badge>
                      </TableCell>
                      <TableCell>{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar') : '—'}</TableCell>
                      <TableCell>{contract.end_date ? new Date(contract.end_date).toLocaleDateString('ar') : '—'}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-green">
                          {totalRent > 0 ? `${totalRent.toLocaleString('ar-LY')} د.ل` : '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {installationCost > 0 ? (
                          <div className="font-semibold text-orange flex items-center gap-1">
                            <Wrench className="h-3 w-3" />
                            {installationCost.toLocaleString('ar-LY')} د.ل
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {printCost > 0 ? (
                          <div className="font-semibold text-purple flex items-center gap-1">
                            <PaintBucket className="h-3 w-3" />
                            {printCost.toLocaleString('ar-LY')} د.ل
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {operatingFee > 0 ? (
                          <div className="font-semibold text-blue flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            {operatingFee.toLocaleString('ar-LY')} د.ل
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {finalTotalCost > 0 ? `${finalTotalCost.toLocaleString('ar-LY')} د.ل` : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold">
                            {paymentPercentage.toFixed(0)}%
                          </div>
                          <div className="text-xs text-muted">
                            ({totalPaid.toLocaleString('ar-LY')} من {finalTotalCost.toLocaleString('ar-LY')})
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 ${progressIndicator.color} font-medium text-sm`}>
                          {progressIndicator.icon}
                          <span>{progressIndicator.text}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getContractStatus(contract)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Use contract ID directly for navigation - matching ContractView useParams
                              const contractId = String(contract.id);
                              navigate(`/admin/contracts/view/${contractId}`);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEditContracts && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/admin/contracts/edit?contract=${String(contract.id)}`)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {canCreateOrDelete && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteContract(String(contract.id))}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              )}
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrintContract(contract)}
                            className="h-8 px-2 gap-1"
                          >
                            <Printer className="h-4 w-4" />
                            طباعة
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openInstallDialog(contract)}
                            className="h-8 px-2 gap-1"
                            title="طباعة تركيب - جدول"
                          >
                            <Hammer className="h-4 w-4" />
                            تركيب
                          </Button>
                          <AddPaymentDialog
                            contractNumber={String(contract.Contract_Number || contract.id)}
                            customerName={contract.customer_name || ''}
                            customerId={(contract as any).customer_id}
                            onPaymentAdded={loadData}
                          />
                          <SendContractDialog
                            contractNumber={String(contract.Contract_Number || contract.id)}
                            customerName={contract.customer_name || ''}
                            customerPhone={(contract as any).Phone}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const contractWithBillboards = await getContractWithBillboards(String(contract.id));
                                const billboardsData = (contractWithBillboards as any).billboards || [];
                                let designData = null;
                                try {
                                  const rawDesignData = (contractWithBillboards as any).design_data;
                                  if (rawDesignData) {
                                    designData = typeof rawDesignData === 'string' ? JSON.parse(rawDesignData) : rawDesignData;
                                  }
                                } catch (e) {
                                  console.error('Failed to parse design_data:', e);
                                }

                                if (billboardsData.length === 0) {
                                  toast.info('لا توجد لوحات لهذا العقد');
                                  return;
                                }

                                window.dispatchEvent(new CustomEvent('openBillboardPrint', {
                                  detail: {
                                    contractNumber: contract.id,
                                    billboards: billboardsData,
                                    designData: designData,
                                    customerPhone: (contract as any).Phone || (contractWithBillboards as any).Phone || ''
                                  }
                                }));
                              } catch (error) {
                                console.error('Error loading contract data:', error);
                                toast.error('فشل في تحميل بيانات العقد');
                              }
                            }}
                            className="h-8 px-2 gap-1"
                            title="طباعة اللوحات منفصلة"
                          >
                            <FileText className="h-4 w-4" />
                            لوحات منفصلة
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 gap-1"
                                title="تصدير اللوحات إلى Excel"
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                                Excel
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const contractWithBillboards = await getContractWithBillboards(String(contract.id));
                                    const billboardsData = (contractWithBillboards as any).billboards || [];
                                    
                                    if (billboardsData.length === 0) {
                                      toast.info('لا توجد لوحات لهذا العقد');
                                      return;
                                    }

                                    await exportBillboardsToExcel({
                                      contractNumber: contract.Contract_Number || contract.id,
                                      billboards: billboardsData,
                                      customerName: contract.customer_name || '',
                                      includePrices: false
                                    });
                                    
                                    toast.success('تم تصدير اللوحات بنجاح');
                                  } catch (error) {
                                    console.error('Error exporting billboards:', error);
                                    toast.error('فشل في تصدير اللوحات');
                                  }
                                }}
                              >
                                تصدير بدون أسعار
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const contractWithBillboards = await getContractWithBillboards(String(contract.id));
                                    const billboardsData = (contractWithBillboards as any).billboards || [];
                                    
                                    if (billboardsData.length === 0) {
                                      toast.info('لا توجد لوحات لهذا العقد');
                                      return;
                                    }

                                    await exportBillboardsToExcel({
                                      contractNumber: contract.Contract_Number || contract.id,
                                      billboards: billboardsData,
                                      customerName: contract.customer_name || '',
                                      includePrices: true
                                    });
                                    
                                    toast.success('تم تصدير اللوحات بنجاح');
                                  } catch (error) {
                                    console.error('Error exporting billboards:', error);
                                    toast.error('فشل في تصدير اللوحات');
                                  }
                                }}
                              >
                                تصدير مع الأسعار
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const contractWithBillboards = await getContractWithBillboards(String(contract.id));
                                    const billboardsData = (contractWithBillboards as any).billboards || [];

                                    if (billboardsData.length === 0) {
                                      toast.info('لا توجد لوحات لهذا العقد');
                                      return;
                                    }

                                    await exportBillboardsToCSV({
                                      contractNumber: contract.Contract_Number || contract.id,
                                      billboards: billboardsData,
                                      customerName: contract.customer_name || '',
                                      includePrices: false,
                                    });

                                    toast.success('تم تصدير اللوحات بنجاح');
                                  } catch (error) {
                                    console.error('Error exporting billboards:', error);
                                    toast.error('فشل في تصدير اللوحات');
                                  }
                                }}
                              >
                                تصدير CSV (يدعم العربية)
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const s = contract.start_date || (contract as any)['Contract Date'] || '';
                              const e = contract.end_date || (contract as any)['End Date'] || '';
                              let months = 1;
                              try {
                                if (s && e) { const sd = new Date(s); const ed = new Date(e); const diffDays = Math.max(1, Math.ceil(Math.abs(ed.getTime() - sd.getTime())/86400000)); months = Math.max(1, Math.round(diffDays/30)); }
                              } catch {}
                              const start = new Date();
                              const end = new Date(start); end.setMonth(end.getMonth() + months);
                              setRenewSource(contract); setRenewStart(start.toISOString().slice(0,10)); setRenewEnd(end.toISOString().slice(0,10)); setRenewOpen(true);
                            }}
                            className="h-8 px-2 gap-1"
                            title="تجديد العقد ب��فس اللوحات"
                          >
                            <RefreshCcw className="h-4 w-4" />
                            تجديد
                          </Button>
                        </div>
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

      {/* رسائل فارغة */}
      {filteredContracts.length === 0 && contracts.length > 0 && viewMode === 'cards' && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد نتائج</h3>
          <p className="text-muted-foreground">لم يتم العثور على عقود تطابق معايير البحث</p>
        </div>
      )}

      {contracts.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد عقود</h3>
          <p className="text-muted-foreground">ابدأ بإنشاء عقد جديد</p>
        </div>
      )}

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>تفاصيل العقد</DialogTitle>
          </DialogHeader>
          
          {selectedContract && (
            <div className="space-y-6">
              {/* معلومات العقد */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      معلومات الزبون
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>الاسم:</strong> {selectedContract.customer_name}</p>
                      <p><strong>نوع الإعلان:</strong> {selectedContract.ad_type || '—'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      تفاصيل العقد
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>تاريخ البداية:</strong> {selectedContract.start_date ? new Date(selectedContract.start_date).toLocaleDateString('ar') : '—'}</p>
                      <p><strong>تاريخ النهاية:</strong> {selectedContract.end_date ? new Date(selectedContract.end_date).toLocaleDateString('ar') : '—'}</p>
                      <p><strong>الإيجار:</strong> {(selectedContract.rent_cost || 0).toLocaleString()} د.ل</p>
                      <p><strong>التركيب:</strong> {(selectedContract.installation_cost || 0).toLocaleString()} د.ل</p>
                      <p><strong>الطباعة:</strong> {(selectedContract.print_cost || 0).toLocaleString()} د.ل</p>
                      <p><strong>الإجمالي:</strong> {(selectedContract.total_cost || selectedContract.rent_cost || 0).toLocaleString()} د.ل</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* اللوحات المرتبطة */}
              {selectedContract.billboards && selectedContract.billboards.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">اللوحات المرتبطة ({selectedContract.billboards.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedContract.billboards.map((billboard: any) => (
                        <Card key={billboard.ID || billboard.id} className="border">
                          <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold">{billboard.Billboard_Name || billboard.name}</h4>
                              <p className="text-sm text-muted">{billboard.Nearest_Landmark || billboard.location}</p>
                              <p className="text-sm">الحجم: {billboard.Size || billboard.size}</p>
                              <p className="text-sm">المدي��ة: {billboard.City || billboard.city}</p>
                            </div>
                            <div className="text-xs text-muted">ضمن العقد</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PDF Dialog */}
      <ContractPDFDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        contract={selectedContractForPDF}
      />

      {/* Renew Dialog — مع كشف التعارضات */}
      <Dialog open={renewOpen} onOpenChange={(o) => { setRenewOpen(o); if (!o) { setRenewConflicts([]); } }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-primary" />
              تجديد العقد #{String(renewSource?.id || '')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* معلومات العقد الأصلي */}
            {renewSource && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span>{renewSource.customer_name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>عدد اللوحات: <strong className="text-foreground">
                    {(() => { const ids = renewSource.billboard_ids; if (!ids) return 0; if (Array.isArray(ids)) return ids.length; return String(ids).split(',').filter(Boolean).length; })()}
                  </strong> لوحة</span>
                </div>
              </div>
            )}

            {/* تواريخ التجديد */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">تاريخ البداية الجديد</Label>
                <Input
                  type="date"
                  value={renewStart}
                  onChange={async (e) => {
                    const newStart = e.target.value;
                    setRenewStart(newStart);
                    setRenewConflicts([]);
                    if (newStart && renewEnd && renewSource) {
                      setRenewChecking(true);
                      try {
                        const ids = renewSource.billboard_ids;
                        const bbIds: string[] = Array.isArray(ids)
                          ? ids.map(String)
                          : String(ids || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (bbIds.length > 0) {
                          const found = await checkBillboardConflicts(
                            bbIds, newStart, renewEnd,
                            String(renewSource.id || '')
                          );
                          setRenewConflicts(found);
                        }
                      } finally { setRenewChecking(false); }
                    }
                  }}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">تاريخ النهاية الجديد</Label>
                <Input
                  type="date"
                  value={renewEnd}
                  onChange={async (e) => {
                    const newEnd = e.target.value;
                    setRenewEnd(newEnd);
                    setRenewConflicts([]);
                    if (renewStart && newEnd && renewSource) {
                      setRenewChecking(true);
                      try {
                        const ids = renewSource.billboard_ids;
                        const bbIds: string[] = Array.isArray(ids)
                          ? ids.map(String)
                          : String(ids || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (bbIds.length > 0) {
                          const found = await checkBillboardConflicts(
                            bbIds, renewStart, newEnd,
                            String(renewSource.id || '')
                          );
                          setRenewConflicts(found);
                        }
                      } finally { setRenewChecking(false); }
                    }
                  }}
                />
              </div>
            </div>

            {/* حالة الفحص */}
            {renewChecking && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري فحص التعارضات...</span>
              </div>
            )}

            {/* نتيجة الفحص — لا تعارض */}
            {!renewChecking && renewStart && renewEnd && renewConflicts.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-300">
                  جميع لوحات العقد متاحة في هذه الفترة — يمكن التجديد بأمان
                </p>
              </div>
            )}

            {/* نتيجة الفحص — يوجد تعارض */}
            {!renewChecking && renewConflicts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <div>
                    <p className="text-xs text-red-300 font-semibold">
                      {renewConflicts.length} لوحة مؤجرة في هذه الفترة لزبائن آخرين
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      سيتم تجديد العقد بجميع اللوحات بما فيها المتعارضة — تأكد قبل المتابعة
                    </p>
                  </div>
                </div>

                {/* قائمة التعارضات */}
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {renewConflicts.map((c, i) => (
                    <div
                      key={c.billboardId + i}
                      className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground truncate">{c.billboardName}</span>
                        <span className={`text-xs font-bold shrink-0 ${
                          c.daysRemaining <= 7 ? 'text-red-400' :
                          c.daysRemaining <= 30 ? 'text-amber-400' : 'text-orange-400'
                        }`}>
                          {c.daysRemaining} يوم
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3 text-amber-400" />
                          عقد #{c.activeContractNumber}
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-3 w-3 text-blue-400" />
                          {c.activeContractCustomer || 'غير محدد'}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Calendar className="h-3 w-3 text-emerald-400" />
                          {new Date(c.activeContractEndDate).toLocaleDateString('ar-LY', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* أزرار */}
            <div className="flex justify-end gap-2 pt-1 border-t border-border/40">
              <Button variant="outline" onClick={() => { setRenewOpen(false); setRenewConflicts([]); }}>إلغاء</Button>
              <Button
                disabled={!renewStart || !renewEnd || renewChecking}
                variant={renewConflicts.length > 0 ? 'destructive' : 'default'}
                className={renewConflicts.length > 0
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-primary hover:bg-primary/90'
                }
                onClick={async () => {
                  if (!renewSource) return;
                  try {
                    const { renewContract } = await import('@/services/contractService');
                    const created = await renewContract(String(renewSource.id), { start_date: renewStart, end_date: renewEnd, keep_cost: true });
                    toast.success(`تم إنشاء عقد جديد برقم ${String(created?.Contract_Number ?? created?.id ?? '')}`);
                    setRenewOpen(false); setRenewSource(null); setRenewStart(''); setRenewEnd('');
                    setRenewConflicts([]);
                    loadData();
                  } catch (e) {
                    console.error(e);
                    toast.error('فشل تجديد العقد');
                  }
                }}
              >
                {renewConflicts.length > 0 ? (
                  <><AlertTriangle className="h-4 w-4 ml-1" />تجديد رغم التحذير</>
                ) : (
                  <><RefreshCcw className="h-4 w-4 ml-1" />تجديد العقد</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Install Team Selection Dialog */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>اختر فرقة التركيب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اختر فرقة التركيب التي ستقوم بالتركيب لهذه العقدة</Label>
              <Select value={selectedTeamId || 'none'} onValueChange={(v) => setSelectedTeamId(v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر فرقة" />
                </SelectTrigger>
                <SelectContent>
                  {installationTeams.length === 0 ? (
                    <SelectItem value="none">لا توجد فرق</SelectItem>
                  ) : (
                    installationTeams.map(team => (
                      <SelectItem key={team.id} value={String(team.id)}>{team.team_name || team.name || `فرقة ${team.id}`}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handlePrintInstallationForTeam}>طباعة التركيب للفرقة</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Billboard Bulk Print Dialog */}
      {billboardPrintData && (
        <BillboardBulkPrintDialog
          open={billboardPrintOpen}
          onOpenChange={(open) => {
            setBillboardPrintOpen(open);
            if (!open) setBillboardPrintData(null);
          }}
          billboards={billboardPrintData.billboards}
          contractInfo={{
            number: Number(billboardPrintData.contractNumber),
            customerName: billboardPrintData.customerName || '',
            adType: billboardPrintData.adType,
            startDate: billboardPrintData.startDate,
            endDate: billboardPrintData.endDate
          }}
        />
      )}

      {/* Send Alerts Dialog */}
      <SendAlertsDialog
        open={alertsDialogOpen}
        onOpenChange={setAlertsDialogOpen}
        contracts={contracts}
      />

      {/* Send Contract Report Dialog */}
      <SendContractReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        contracts={filteredContracts}
      />

      {/* Quick Contract Creation Dialog */}
      <QuickContractDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
      />

      {/* Missing Contract Numbers Finder Dialog */}
      <MissingContractNumbersDialog
        open={missingNumbersOpen}
        onOpenChange={setMissingNumbersOpen}
        onSelectMissingNumber={(num, yr) => navigate(`/admin/contracts/new?contract_number=${num}&year=${yr}`)}
      />

      {/* Unified Print All Dialog */}
      {printAllData && (
        <UnifiedPrintAllDialog
          open={printAllDialogOpen}
          onOpenChange={(open) => {
            setPrintAllDialogOpen(open);
            if (!open) setPrintAllData(null);
          }}
          contextType="contract"
          contextNumber={printAllData.contractNumber}
          customerName={printAllData.customerName}
          adType={printAllData.adType}
          items={printAllData.items}
          billboards={printAllData.billboards}
          title="طباعة لوحات العقد"
        />
      )}
    </div>
  );
}
