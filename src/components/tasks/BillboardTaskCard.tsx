import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MapPin, Navigation, Image as ImageIcon, CheckCircle2, CalendarIcon, 
  PaintBucket, Printer, RotateCcw, Palette, Box, DollarSign, Trash2, 
  Pencil, Plus, AlertTriangle, Lock, Unlock, Camera, Link2, RefreshCw, 
  Replace, ArrowLeftRight, History, Building2, PauseCircle, Repeat2, 
  ChevronDown, ChevronUp, MoreVertical, SlidersHorizontal, Settings, HelpCircle, TrendingUp, TrendingDown, GitBranch, Layers, Clock
} from "lucide-react";
import { ReplaceBillboardDialog } from './ReplaceBillboardDialog';
import { EditReplacementDialog } from './EditReplacementDialog';
import { InstallationPhotoHistoryDialog } from './InstallationPhotoHistoryDialog';
import { differenceInDays } from "date-fns";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BillboardExtendRentalDialog } from '@/components/billboards/BillboardExtendRentalDialog';
import ImageLightbox from '@/components/Map/ImageLightbox';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TaskDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
}

interface BillboardTaskCardProps {
  item: any;
  billboard: any;
  isSelected: boolean;
  isCompleted: boolean;
  taskDesigns?: TaskDesign[];
  installationPrice?: number;
  allItems?: any[];
  onSelectionChange: (checked: boolean) => void;
  onEditDesign?: () => void;
  onPrint?: () => void;
  onUncomplete?: () => void;
  onDesignChange?: () => void;
  onRefresh?: () => void;
  onAddInstalledImage?: () => void;
  onDelete?: () => void;
  onApplyFacesToAll?: (faces: number) => void;
  pausedInfo?: { pauseDate?: string };
  replacementInfo?: { replacedName?: string; startDate?: string };
  isPrintActive?: boolean;
  printPricePerMeter?: number;
}

export function BillboardTaskCard({
  item,
  billboard,
  isSelected,
  isCompleted,
  isPrintActive = false,
  printPricePerMeter = 0,
  taskDesigns = [],
  installationPrice = 0,
  allItems = [],
  onSelectionChange,
  onEditDesign,
  onPrint,
  onUncomplete,
  onDesignChange,
  onRefresh,
  onAddInstalledImage,
  onDelete,
  onApplyFacesToAll,
  pausedInfo,
  replacementInfo,
}: BillboardTaskCardProps) {
  const [selectedDesignId, setSelectedDesignId] = useState<string>(item.selected_design_id || 'none');
  const [isExpanded, setIsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasCutout, setHasCutout] = useState<boolean>(item.has_cutout || false);
  const [customerInstallationCost, setCustomerInstallationCost] = useState<number>(item.customer_installation_cost || 0);
  const [customerOriginalInstallCost, setCustomerOriginalInstallCost] = useState<number>(item.customer_original_install_cost || 0);
  const [customerReinstallCost, setCustomerReinstallCost] = useState<number>(item.customer_reinstall_cost || 0);
  const [isOriginalCostEditable, setIsOriginalCostEditable] = useState(false);
  const [isReinstallCostEditable, setIsReinstallCostEditable] = useState(false);
  const [tempOriginalCost, setTempOriginalCost] = useState<number>(0);
  const [tempReinstallCost, setTempReinstallCost] = useState<number>(0);
  const [companyInstallationCost, setCompanyInstallationCost] = useState<number | null>(item.company_installation_cost);
  const [isCompanyCostEditable, setIsCompanyCostEditable] = useState(false);
  const [savingCompanyCost, setSavingCompanyCost] = useState(false);
  const [savingCost, setSavingCost] = useState(false);
  const [editDateDialogOpen, setEditDateDialogOpen] = useState(false);
  const [editingDate, setEditingDate] = useState(item.installation_date || '');
  const [savingDate, setSavingDate] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const availableFacesCount = Math.max(1, Number(
    billboard?.Faces_Count || 
    billboard?.faces_count || 
    billboard?.faces || 
    item?.billboard?.Faces_Count || 
    item?.billboard?.faces_count || 
    item?.faces_to_install || 
    2
  ));
  const [facesToInstall, setFacesToInstall] = useState<number>(
    item.faces_to_install ? Math.min(item.faces_to_install, availableFacesCount) : availableFacesCount
  );

  useEffect(() => {
    if (item.faces_to_install !== undefined && item.faces_to_install !== null) {
      setFacesToInstall(item.faces_to_install);
    }
  }, [item.faces_to_install]);
  const [photoHistoryItems, setPhotoHistoryItems] = useState<any[]>([]);
  const [isBranchesExpanded, setIsBranchesExpanded] = useState(false);
  const { confirm: systemConfirm } = useSystemDialog();

  useEffect(() => {
    if (item?.id && ((item.reinstall_count || 0) > 0 || item.replacement_status)) {
      supabase
        .from('installation_photo_history')
        .select('*')
        .eq('task_item_id', item.id)
        .order('reinstall_number', { ascending: true })
        .then(({ data }) => setPhotoHistoryItems(data || []));
    }
  }, [item?.id, item?.reinstall_count, item?.replacement_status]);
  const [isCustomerCostEditable, setIsCustomerCostEditable] = useState(false);
  const [additionalCost, setAdditionalCost] = useState<number>(item.additional_cost || 0);
  const [additionalCostNotes, setAdditionalCostNotes] = useState<string>(item.additional_cost_notes || '');
  const [isAdditionalCostEditable, setIsAdditionalCostEditable] = useState(false);
  const [savingAdditionalCost, setSavingAdditionalCost] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [editReplacementOpen, setEditReplacementOpen] = useState(false);
  const [isFinancialsExpanded, setIsFinancialsExpanded] = useState(false);
  const [photoHistoryOpen, setPhotoHistoryOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const renderDesignPreview = () => {
    const displayDesign = selectedDesign !== 'none' && selectedDesign ? taskDesigns.find(d => d.id === selectedDesign) : null;
    const fallbackDesign = item.design_face_a || item.design_face_b ? {
      design_name: 'التصميم المحفوظ',
      design_face_a_url: item.design_face_a,
      design_face_b_url: item.design_face_b
    } : (billboard?.design_face_a || billboard?.design_face_b ? {
      design_name: 'تصميم اللوحة',
      design_face_a_url: billboard.design_face_a,
      design_face_b_url: billboard.design_face_b
    } : (taskDesigns[0] ? {
      design_name: taskDesigns[0].design_name,
      design_face_a_url: taskDesigns[0].design_face_a_url,
      design_face_b_url: taskDesigns[0].design_face_b_url
    } : null));

    const finalDesign = displayDesign || fallbackDesign;
    if (!finalDesign) return null;
    const faceAUrl = finalDesign.design_face_a_url;
    const faceBUrl = finalDesign.design_face_b_url;
    if (!faceAUrl && !faceBUrl) return null;

    const hasBoth = Boolean(faceAUrl && faceBUrl);

    return (
      <div className="mt-2.5 p-2 bg-muted/20 border border-border/40 rounded-2xl space-y-1.5" onClick={e => e.stopPropagation()}>
        <div className="text-[10px] text-center text-foreground font-bold flex items-center justify-center gap-1">
          <Palette className="h-3.5 w-3.5 text-primary" />
          <span>التصميم المعتمد</span>
        </div>
        <div className={cn("grid gap-2", hasBoth ? "grid-cols-2" : "grid-cols-1")}>
          {faceAUrl && (
            <div className="space-y-1">
              {hasBoth && <div className="text-[9px] text-center text-muted-foreground font-bold">الوجه الأول (الأمامي)</div>}
              <div 
                className="relative aspect-[16/10] max-h-[140px] rounded-xl overflow-hidden bg-background border border-border/60 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all shadow-inner"
                onClick={() => setLightboxImage(faceAUrl)}
              >
                <img src={faceAUrl} alt="تصميم الوجه الأول" className="w-full h-full object-contain" />
              </div>
            </div>
          )}
          {faceBUrl && (
            <div className="space-y-1">
              {hasBoth && <div className="text-[9px] text-center text-muted-foreground font-bold">الوجه الثاني (الخلفي)</div>}
              <div 
                className="relative aspect-[16/10] max-h-[140px] rounded-xl overflow-hidden bg-background border border-border/60 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all shadow-inner"
                onClick={() => setLightboxImage(faceBUrl)}
              >
                <img src={faceBUrl} alt="تصميم الوجه الثاني" className="w-full h-full object-contain" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderInstalledPhotosPreview = () => {
    if (!item.installed_image_face_a_url && !item.installed_image_face_b_url) return null;

    const hasBoth = Boolean(item.installed_image_face_a_url && item.installed_image_face_b_url);

    return (
      <div className="mt-2.5 p-2 bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-1.5" onClick={e => e.stopPropagation()}>
        <div className="text-[10px] text-center text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center gap-1">
          <Camera className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>صور التركيب المنفذ</span>
        </div>
        <div className={cn("grid gap-2", hasBoth ? "grid-cols-2" : "grid-cols-1")}>
          {item.installed_image_face_a_url && (
            <div className="space-y-1">
              <div className="text-[9px] text-center text-muted-foreground font-bold">صورة الوجه الأمامي</div>
              <div 
                className="relative aspect-[16/10] max-h-[140px] rounded-xl overflow-hidden bg-background border border-emerald-500/40 cursor-pointer hover:ring-2 hover:ring-emerald-500/40 transition-all shadow-inner"
                onClick={() => setLightboxImage(item.installed_image_face_a_url)}
              >
                <img src={item.installed_image_face_a_url} alt="تركيب الوجه الأمامي" className="w-full h-full object-contain" />
              </div>
            </div>
          )}
          {item.installed_image_face_b_url && (
            <div className="space-y-1">
              <div className="text-[9px] text-center text-muted-foreground font-bold">صورة الوجه الخلفي</div>
              <div 
                className="relative aspect-[16/10] max-h-[140px] rounded-xl overflow-hidden bg-background border border-blue-500/40 cursor-pointer hover:ring-2 hover:ring-blue-500/40 transition-all shadow-inner"
                onClick={() => setLightboxImage(item.installed_image_face_b_url)}
              >
                <img src={item.installed_image_face_b_url} alt="تركيب الوجه الخلفي" className="w-full h-full object-contain" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const effectiveInstallationPrice = (() => {
    if (!installationPrice) return 0;
    const totalReinstalledFaces = item.total_reinstalled_faces || 0;
    if (totalReinstalledFaces > 0) {
      return installationPrice * (totalReinstalledFaces * 0.5);
    }
    return installationPrice;
  })();

  const hasCompanyCost = companyInstallationCost !== null && companyInstallationCost !== undefined;
  const displayCompanyCost = hasCompanyCost ? companyInstallationCost : effectiveInstallationPrice;
  
  useEffect(() => {
    setSelectedDesignId(item.selected_design_id || 'none');
  }, [item.selected_design_id]);

  useEffect(() => {
    setCustomerInstallationCost(item.customer_installation_cost || 0);
  }, [item.customer_installation_cost]);

  useEffect(() => {
    setCustomerOriginalInstallCost(item.customer_original_install_cost || 0);
  }, [item.customer_original_install_cost]);

  useEffect(() => {
    setCustomerReinstallCost(item.customer_reinstall_cost || 0);
  }, [item.customer_reinstall_cost]);

  useEffect(() => {
    setCompanyInstallationCost(item.company_installation_cost);
  }, [item.company_installation_cost]);

  useEffect(() => {
    setAdditionalCost(item.additional_cost || 0);
    setAdditionalCostNotes(item.additional_cost_notes || '');
  }, [item.additional_cost, item.additional_cost_notes]);

  useEffect(() => {
    setHasCutout(item.has_cutout || false);
  }, [item.has_cutout]);

  const handleEditDate = async () => {
    if (!editingDate) {
      toast.error('الرجاء تحديد تاريخ');
      return;
    }
    setSavingDate(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ installation_date: editingDate })
        .eq('id', item.id);
      
      if (error) throw error;
      
      toast.success('تم تعديل تاريخ التركيب');
      setEditDateDialogOpen(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating installation date:', error);
      toast.error('فشل في تعديل تاريخ التركيب');
    } finally {
      setSavingDate(false);
    }
  };

  const handleDesignChange = async (designId: string) => {
    setSelectedDesignId(designId);
    setSaving(true);

    try {
      let updateData: any = { selected_design_id: designId === 'none' ? null : designId };
      
      if (designId !== 'none') {
        const selectedDesign = taskDesigns.find(d => d.id === designId);
        if (selectedDesign) {
          updateData.design_face_a = selectedDesign.design_face_a_url;
          updateData.design_face_b = selectedDesign.design_face_b_url || null;
        }
      } else {
        updateData.design_face_a = null;
        updateData.design_face_b = null;
      }

      const { error } = await supabase
        .from('installation_task_items')
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;

      // Sync design to other print/cutout tasks
      try {
        const { data: installTask } = await supabase
          .from('installation_tasks')
          .select('contract_id')
          .eq('id', item.task_id)
          .single();

        if (installTask?.contract_id) {
          const contractId = installTask.contract_id;
          const billboardId = item.billboard_id;
          const designA = updateData.design_face_a ?? null;
          const designB = updateData.design_face_b ?? null;

          const { data: printTasks } = await supabase
            .from('print_tasks')
            .select('id')
            .eq('contract_id', contractId);

          if (printTasks?.length) {
            await supabase
              .from('print_task_items')
              .update({ design_face_a: designA, design_face_b: designB })
              .in('task_id', printTasks.map(t => t.id))
              .eq('billboard_id', billboardId);
          }

          await supabase
            .from('billboards')
            .update({ design_face_a: designA, design_face_b: designB })
            .eq('ID', billboardId);
        }
      } catch (syncError) {
        console.error('Error syncing design to related tasks:', syncError);
      }
      
      toast.success('تم تحديد التصميم بنجاح');
      onDesignChange?.();
      onRefresh?.();
    } catch (error) {
      console.error('Error updating design:', error);
      toast.error('فشل في تحديد التصميم');
    } finally {
      setSaving(false);
    }
  };

  const handleCutoutChange = async (checked: boolean) => {
    setHasCutout(checked);
    
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ has_cutout: checked })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success(checked ? 'تم تحديد اللوحة كمجسم' : 'تم إلغاء تحديد المجسم');
      onRefresh?.();
    } catch (error) {
      console.error('Error updating cutout status:', error);
      toast.error('فشل في تحديث حالة المجسم');
      setHasCutout(!checked);
    }
  };

  const handleCustomerCostBlur = async () => {
    if (customerInstallationCost === item.customer_installation_cost) return;
    
    setSavingCost(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ customer_installation_cost: customerInstallationCost })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success('تم تحديث تكلفة التركيب للزبون');
      onRefresh?.();
    } catch (error) {
      console.error('Error updating customer installation cost:', error);
      toast.error('فشل في تحديث التكلفة');
      setCustomerInstallationCost(item.customer_installation_cost || 0);
    } finally {
      setSavingCost(false);
    }
  };

  const handleCompanyCostSave = async () => {
    if (companyInstallationCost === item.company_installation_cost) {
      setIsCompanyCostEditable(false);
      return;
    }
    setSavingCompanyCost(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ company_installation_cost: companyInstallationCost })
        .eq('id', item.id);
      if (error) throw error;
      toast.success('تم تحديث تكلفة الشركة');
      setIsCompanyCostEditable(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating company installation cost:', error);
      toast.error('فشل في تحديث تكلفة الشركة');
      setCompanyInstallationCost(item.company_installation_cost);
    } finally {
      setSavingCompanyCost(false);
    }
  };

  const handleCustomerPaidAllCosts = async () => {
    setSavingCost(true);
    setSavingCompanyCost(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ 
          customer_installation_cost: 0,
          company_installation_cost: 0
        })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success('تم تحديد: الزبون سدد التكاليف (المهمة بدون تكاليف)');
      setCustomerInstallationCost(0);
      setCompanyInstallationCost(0);
      onRefresh?.();
    } catch (error) {
      console.error('Error setting customer paid costs:', error);
      toast.error('فشل في حفظ التغييرات');
    } finally {
      setSavingCost(false);
      setSavingCompanyCost(false);
    }
  };

  const handleAdditionalCostSave = async () => {
    setSavingAdditionalCost(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ 
          additional_cost: additionalCost,
          additional_cost_notes: additionalCostNotes || null
        })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success('تم حفظ التكلفة الإضافية');
      setIsAdditionalCostEditable(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error saving additional cost:', error);
      toast.error('فشل في حفظ التكلفة الإضافية');
    } finally {
      setSavingAdditionalCost(false);
    }
  };

  const handleFacesChange = async (faces: number) => {
    setFacesToInstall(faces);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({
          faces_to_install: faces,
          reinstalled_faces: faces === 1 ? 'face_a' : 'both',
        } as any)
        .eq('id', item.id);
      if (error) throw error;
      toast.success(
        faces === 1 ? 'تم تحديد وجه واحد للتركيب' :
        faces === 2 ? 'تم تحديد وجهين للتركيب' :
        `تم تحديد ${faces} أوجه للتركيب`
      );
      onRefresh?.();
    } catch (error) {
      console.error('Error updating faces_to_install:', error);
      toast.error('فشل في تحديث الوجه');
      setFacesToInstall(item.faces_to_install || availableFacesCount);
    }
  };

  const handleCustomerOriginalCostSave = async (val: number) => {
    try {
      setSavingCost(true);
      const { error } = await supabase
        .from('installation_task_items')
        .update({ customer_original_install_cost: val } as any)
        .eq('id', item.id);

      if (error) throw error;
      toast.success('تم تحديث تكلفة التركيب الأصلية');
      setCustomerOriginalInstallCost(val);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating customer original installation cost:', error);
      toast.error('فشل في تحديث التكلفة الأصلية');
      setCustomerOriginalInstallCost(item.customer_original_install_cost || 0);
    } finally {
      setSavingCost(false);
    }
  };

  const handleCustomerReinstallCostSave = async (val: number) => {
    try {
      setSavingCost(true);
      const { error } = await supabase
        .from('installation_task_items')
        .update({ 
          customer_installation_cost: val,
          customer_reinstall_cost: val 
        } as any)
        .eq('id', item.id);

      if (error) throw error;
      toast.success('تم تحديث تكلفة إعادة التركيب للزبون');
      setCustomerReinstallCost(val);
      setCustomerInstallationCost(val);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating customer reinstall cost:', error);
      toast.error('فشل في تحديث تكلفة إعادة التركيب');
      setCustomerReinstallCost(item.customer_reinstall_cost || 0);
      setCustomerInstallationCost(item.customer_installation_cost || 0);
    } finally {
      setSavingCost(false);
    }
  };

  const handleUndoReinstall = async () => {
    if (!await systemConfirm({
      title: 'التراجع عن إعادة التركيب',
      message: 'هل أنت متأكد من رغبتك في التراجع عن إعادة التركيب لهذه اللوحة واستعادة حالة وصور التركيب السابقة؟',
      confirmText: 'نعم، تراجع',
      cancelText: 'إلغاء'
    })) return;

    try {
      setSaving(true);
      
      const { data: historyItems, error: historyError } = await supabase
        .from('installation_photo_history')
        .select('*')
        .eq('task_item_id', item.id)
        .order('reinstall_number', { ascending: false })
        .limit(1);

      if (historyError) throw historyError;

      const currentReinstallCount = item.reinstall_count || 0;
      const nextReinstallCount = Math.max(0, currentReinstallCount - 1);
      
      const updateData: any = {
        reinstall_count: nextReinstallCount,
        status: 'completed',
      };

      if (nextReinstallCount === 0) {
        updateData.replacement_status = null;
        updateData.replacement_reason = null;
        updateData.replacement_cost_bearer = null;
        updateData.replacement_cost_percentage = null;
        updateData.reinstalled_faces = null;
        updateData.total_reinstalled_faces = 0;
        updateData.faces_to_install = billboard?.Faces_Count || 2;
        updateData.customer_reinstall_cost = 0;
        updateData.customer_installation_cost = item.customer_original_install_cost || item.customer_installation_cost || 0;
      } else {
        updateData.replacement_status = 'reinstalled';
      }

      if (historyItems && historyItems.length > 0) {
        const lastHistory = historyItems[0];
        updateData.installed_image_face_a_url = lastHistory.installed_image_face_a_url;
        updateData.installed_image_face_b_url = lastHistory.installed_image_face_b_url;
        updateData.installation_date = lastHistory.installation_date;

        const { error: deleteError } = await supabase
          .from('installation_photo_history')
          .delete()
          .eq('id', lastHistory.id);

        if (deleteError) throw deleteError;
      } else {
        updateData.installed_image_face_a_url = null;
        updateData.installed_image_face_b_url = null;
        updateData.installation_date = null;
        updateData.status = 'pending';
      }

      const { error: updateError } = await supabase
        .from('installation_task_items')
        .update(updateData)
        .eq('id', item.id);

      if (updateError) throw updateError;

      toast.success('تم التراجع عن إعادة التركيب بنجاح');
      onRefresh?.();
    } catch (err) {
      console.error('Error undoing reinstall:', err);
      toast.error('حدث خطأ أثناء التراجع عن إعادة التركيب');
    } finally {
      setSaving(false);
    }
  };

  const handleUndoReplacement = async () => {
    if (!await systemConfirm({
      title: 'التراجع عن الاستبدال',
      message: 'هل أنت متأكد من إلغاء عملية استبدال هذه اللوحة؟ سيتم مسح حالة الاستبدال وحذف اللوحة البديلة المضافة.',
      confirmText: 'نعم، تراجع',
      cancelText: 'إلغاء'
    })) return;

    try {
      setSaving(true);
      
      if (item.replaces_item_id) {
        await supabase.from('installation_task_items').update({
          replacement_status: null,
          replaced_by_item_id: null,
          replacement_reason: null,
          replacement_cost_bearer: null,
          replacement_cost_percentage: null
        } as any).eq('id', item.replaces_item_id);
        
        await supabase.from('installation_task_items').delete().eq('id', item.id);
      } else if (item.replaced_by_item_id) {
        await supabase.from('installation_task_items').delete().eq('id', item.replaced_by_item_id);
        
        await supabase.from('installation_task_items').update({
          replacement_status: null,
          replaced_by_item_id: null,
          replacement_reason: null,
          replacement_cost_bearer: null,
          replacement_cost_percentage: null
        } as any).eq('id', item.id);
      } else {
        await supabase.from('installation_task_items').update({
          replacement_status: null,
          replaced_by_item_id: null,
          replaces_item_id: null,
          replacement_reason: null,
          replacement_cost_bearer: null,
          replacement_cost_percentage: null
        } as any).eq('id', item.id);
      }

      toast.success('تم التراجع عن الاستبدال بنجاح');
      onRefresh?.();
    } catch (err) {
      console.error('Error undoing replacement:', err);
      toast.error('حدث خطأ أثناء التراجع عن الاستبدال');
    } finally {
      setSaving(false);
    }
  };

  const selectedDesign = taskDesigns.find(d => d.id === selectedDesignId);
  const isDelayed = !isCompleted && item.created_at && differenceInDays(new Date(), new Date(item.created_at)) > 15;
  const delayDays = item.created_at ? differenceInDays(new Date(), new Date(item.created_at)) : 0;

  const renderDesignSelector = () => {
    if (taskDesigns.length === 0) return null;

    const currentDesignImage = selectedDesign?.design_face_a_url || selectedDesign?.design_face_b_url;

    return (
      <div className="space-y-2 border-t border-border/40 pt-3" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-xs font-black text-foreground">
            <Palette className="h-4 w-4 text-primary" />
            التصميم المطبق
          </label>
          <span className="text-[10px] font-bold text-muted-foreground">اضغط لاختيار تصميم آخر</span>
        </div>
        <Select value={selectedDesignId} onValueChange={handleDesignChange} disabled={saving}>
          <SelectTrigger className="h-14 cursor-pointer rounded-xl border-primary/25 bg-primary/5 px-2.5 text-right transition-all duration-200 hover:border-primary/45 hover:bg-primary/10 focus:ring-2 focus:ring-primary/25">
            <div className="flex min-w-0 flex-1 items-center gap-3" dir="rtl">
              <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted/50">
                {currentDesignImage ? (
                  <img src={currentDesignImage} alt={selectedDesign?.design_name || 'التصميم المطبق'} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground/45" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-right">
                <div className="truncate text-xs font-black text-foreground">
                  {selectedDesign?.design_name || 'بدون تصميم محدد'}
                </div>
                <div className="mt-0.5 text-[10px] font-bold text-primary">
                  {selectedDesign ? 'مطبق حاليًا على اللوحة' : 'اختر من قائمة التصاميم'}
                </div>
              </div>
            </div>
          </SelectTrigger>
          <SelectContent className="max-h-[360px] min-w-[300px] rounded-xl border-border/60 p-1.5 shadow-xl" position="popper" sideOffset={6}>
            <SelectItem value="none" className="min-h-12 cursor-pointer rounded-lg px-2 py-1.5">
              <div className="flex items-center gap-3" dir="rtl">
                <div className="flex h-9 w-12 items-center justify-center rounded-lg border border-border/50 bg-muted/50">
                  <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <span className="text-xs font-bold">بدون تصميم</span>
              </div>
            </SelectItem>
            {taskDesigns.map((design) => {
              const preview = design.design_face_a_url || design.design_face_b_url;
              const isApplied = design.id === selectedDesignId;
              return (
                <SelectItem key={design.id} value={design.id} className="min-h-14 cursor-pointer rounded-lg px-2 py-1.5 focus:bg-primary/10">
                  <div className="flex min-w-0 items-center gap-3" dir="rtl">
                    <div className="h-11 w-16 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/50">
                      {preview ? (
                        <img src={preview} alt={design.design_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-right">
                      <div className="max-w-[180px] truncate text-xs font-black text-foreground">{design.design_name}</div>
                      <div className={cn("mt-0.5 flex items-center gap-1 text-[10px] font-bold", isApplied ? "text-emerald-500" : "text-muted-foreground")}> 
                        {isApplied && <CheckCircle2 className="h-3 w-3" />}
                        {isApplied ? 'التصميم المطبق' : 'تطبيق هذا التصميم'}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    );
  };

  // Visual layout for Reinstallation Branches (Collapsible)
  const renderReinstallBranches = () => {
    if ((item.reinstall_count || 0) === 0 && !item.replacement_status) return null;

    const totalIterations = (item.reinstall_count || 0) + 1;

    return (
      <div className="mt-2.5 bg-amber-500/5 dark:bg-amber-500/10 rounded-2xl border border-amber-500/30 overflow-hidden text-xs" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setIsBranchesExpanded(!isBranchesExpanded)}
          className="w-full flex items-center justify-between p-3 text-right hover:bg-amber-500/10 transition-colors font-bold text-amber-700 dark:text-amber-300 cursor-pointer"
        >
          <span className="flex items-center gap-1.5 font-extrabold">
            <GitBranch className="h-4 w-4 text-amber-500 shrink-0" />
            فروع وقوائم إعادات التركيب (سجل المرات)
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold border-amber-500/40">
              {totalIterations} قوائم / مرات
            </Badge>
            {isBranchesExpanded ? <ChevronUp className="h-4 w-4 text-amber-600 shrink-0" /> : <ChevronDown className="h-4 w-4 text-amber-600 shrink-0" />}
          </div>
        </button>

        {isBranchesExpanded && (
          <div className="p-3 pt-0 space-y-2 border-t border-amber-500/20">
            {/* الفرع 1: التركيب الأصلي (المرة الأولى) */}
            <div className="p-2.5 bg-card rounded-xl border border-border/60 space-y-1.5 shadow-sm mt-2">
              <div className="flex items-center justify-between font-bold text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Badge className="text-[9px] px-1.5 py-0 bg-blue-600 text-white border-0 font-black">الفرع 1</Badge>
                  <span className="text-foreground">التركيب الأصلي (المرة الأولى)</span>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                  التكلفة: {(customerOriginalInstallCost || customerInstallationCost || 0).toLocaleString('en-US')} د.ل
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {(photoHistoryItems.find(h => h.reinstall_number === 1)?.installed_image_face_a_url || item.installed_image_face_a_url || item.billboardImage) ? (
                    <img
                      src={photoHistoryItems.find(h => h.reinstall_number === 1)?.installed_image_face_a_url || item.installed_image_face_a_url || item.billboardImage}
                      alt="صورة التركيب الأصلي - أمامي"
                      className="h-10 w-14 object-cover rounded-lg border border-emerald-500/40 cursor-pointer hover:opacity-90 shadow-sm"
                      onClick={() => setPreviewImageUrl(photoHistoryItems.find(h => h.reinstall_number === 1)?.installed_image_face_a_url || item.installed_image_face_a_url || item.billboardImage)}
                      title="الوجه الأمامي"
                    />
                  ) : null}
                  {(photoHistoryItems.find(h => h.reinstall_number === 1)?.installed_image_face_b_url || item.installed_image_face_b_url) ? (
                    <img
                      src={photoHistoryItems.find(h => h.reinstall_number === 1)?.installed_image_face_b_url || item.installed_image_face_b_url}
                      alt="صورة التركيب الأصلي - خلفي"
                      className="h-10 w-14 object-cover rounded-lg border border-blue-500/40 cursor-pointer hover:opacity-90 shadow-sm"
                      onClick={() => setPreviewImageUrl(photoHistoryItems.find(h => h.reinstall_number === 1)?.installed_image_face_b_url || item.installed_image_face_b_url)}
                      title="الوجه الخلفي"
                    />
                  ) : null}
                  <div>
                    <div>التاريخ: {photoHistoryItems.find(h => h.reinstall_number === 1)?.installation_date ? format(new Date(photoHistoryItems.find(h => h.reinstall_number === 1).installation_date), 'dd/MM/yyyy', { locale: ar }) : (item.installation_date ? format(new Date(item.installation_date), 'dd/MM/yyyy', { locale: ar }) : 'غير محدد')}</div>
                    <div className="font-semibold text-foreground">الوجوه: {item.faces_to_install || availableFacesCount || 2} وجه</div>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] bg-green-500/10 text-green-600 border-green-500/30 font-bold">مكتملة</Badge>
              </div>
            </div>

            {/* الفروع 2، 3... (إعادات التركيب) */}
            {Array.from({ length: item.reinstall_count || 0 }).map((_, rIdx) => {
              const rNum = rIdx + 1;
              const branchNo = rNum + 1;
              const hist = photoHistoryItems.find(h => h.reinstall_number === branchNo) || photoHistoryItems[rIdx + 1];
              const rCost = customerReinstallCost || customerInstallationCost || 0;
              const rFacesText = item.reinstalled_faces === 'both' ? 'وجهين (أمامي وخلفي)' : item.reinstalled_faces === 'face_a' ? 'وجه أمامي' : 'وجه خلفي';

              return (
                <div key={rIdx} className="p-2.5 bg-card rounded-xl border border-amber-500/40 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between font-bold text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Badge className="text-[9px] px-1.5 py-0 bg-amber-500 text-white border-0 font-black">الفرع {branchNo}</Badge>
                      <span className="text-amber-700 dark:text-amber-300">إعادة تركيب ({rNum}) - المرة {branchNo}</span>
                    </div>
                    <span className="text-amber-600 font-black">
                      التكلفة: {rCost.toLocaleString('en-US')} د.ل
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(hist?.installed_image_face_a_url || (rNum === item.reinstall_count ? item.installed_image_face_a_url : null)) ? (
                        <img
                          src={hist?.installed_image_face_a_url || item.installed_image_face_a_url || ''}
                          alt={`صورة إعادة تركيب ${rNum} - أمامي`}
                          className="h-10 w-14 object-cover rounded-lg border border-emerald-500/40 cursor-pointer hover:opacity-90 shadow-sm"
                          onClick={() => setPreviewImageUrl(hist?.installed_image_face_a_url || item.installed_image_face_a_url || '')}
                          title="الوجه الأمامي"
                        />
                      ) : null}
                      {(hist?.installed_image_face_b_url || (rNum === item.reinstall_count ? item.installed_image_face_b_url : null)) ? (
                        <img
                          src={hist?.installed_image_face_b_url || item.installed_image_face_b_url || ''}
                          alt={`صورة إعادة تركيب ${rNum} - خلفي`}
                          className="h-10 w-14 object-cover rounded-lg border border-blue-500/40 cursor-pointer hover:opacity-90 shadow-sm"
                          onClick={() => setPreviewImageUrl(hist?.installed_image_face_b_url || item.installed_image_face_b_url || '')}
                          title="الوجه الخلفي"
                        />
                      ) : null}
                      <div>
                        <div>التاريخ: {hist?.installation_date ? format(new Date(hist.installation_date), 'dd/MM/yyyy', { locale: ar }) : (item.installation_date ? format(new Date(item.installation_date), 'dd/MM/yyyy', { locale: ar }) : 'غير محدد')}</div>
                        <div className="font-semibold text-amber-700 dark:text-amber-400">الوجوه المُعاد تركيبها: {rFacesText}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold">معاد تركيبها</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Visual layout for Location Hub
  const renderLocationHub = () => (
    <div className="p-4 bg-muted/40 dark:bg-muted/10 rounded-2xl border border-border/60 space-y-2 text-[12px] shadow-inner relative group-hover:bg-muted/50 transition-all duration-300">
      <div className="absolute top-3 left-3 flex gap-1.5 opacity-80">
        <MapPin className="h-4 w-4 text-primary" />
      </div>
      
      {billboard?.Nearest_Landmark && (
        <div className="flex items-start gap-2">
          <Navigation className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-extrabold text-foreground leading-tight">
            {billboard.Nearest_Landmark}
          </div>
        </div>
      )}

      {billboard?.District && (
        <div className={cn("flex items-start gap-2 pt-1.5", billboard?.Nearest_Landmark && "border-t border-border/40")}>
          <MapPin className="h-4 w-4 text-primary/80 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-bold text-foreground/80">
            {billboard.District}
          </div>
        </div>
      )}

      <div className={cn("flex items-start gap-2 pt-1.5", (billboard?.District || billboard?.Nearest_Landmark) && "border-t border-border/40")}>
        <MapPin className="h-4 w-4 text-primary/55 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 font-medium text-muted-foreground">
          {billboard?.Municipality || 'بلدية غير محددة'} • {billboard?.City || 'مدينة غير محددة'}
        </div>
      </div>

      {billboard?.GPS_Link && (
        <div className="pt-2.5 border-t border-border/40">
          <a
            href={billboard.GPS_Link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 text-xs text-primary hover:text-primary-foreground font-black transition-all bg-primary/10 hover:bg-primary px-3 py-1.5 rounded-xl border border-primary/20 hover:border-primary shadow-sm w-full"
          >
            <Navigation className="h-3.5 w-3.5" />
            <span>تتبع اللوحة على الخريطة (GPS)</span>
          </a>
        </div>
      )}
    </div>
  );

  // Financial comparative calculator cards
  const renderFinancialCalculator = () => {
    const isReinstalled = (item.reinstall_count || 0) > 0;
    const totalCustomerCost = isReinstalled
      ? (customerOriginalInstallCost + customerReinstallCost)
      : customerInstallationCost;

    return (
      <div className="pt-2 border-t border-border/45 space-y-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setIsFinancialsExpanded(!isFinancialsExpanded)}
          className="w-full flex items-center justify-between text-xs py-2.5 px-3 bg-muted/40 hover:bg-muted/60 border border-border/40 rounded-xl transition-all"
        >
          <span className="font-extrabold text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-primary shrink-0" />
            التكاليف والأسعار
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-[11px] font-black">
              <span className="text-emerald-500">الشركة: {displayCompanyCost.toLocaleString('en-US')} د.ل</span>
              {totalCustomerCost > 0 && (
                <span className="text-blue-500">
                  الزبون: {totalCustomerCost.toLocaleString('en-US')} د.ل
                  {isReinstalled && (
                    <span className="text-[9px] text-muted-foreground mr-1">({customerOriginalInstallCost} + {customerReinstallCost})</span>
                  )}
                </span>
              )}
            </div>
            {isFinancialsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isFinancialsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-3 pt-1"
            >
              {/* Inline Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Company Cost */}
                <div className="bg-emerald-500/[0.02] border border-emerald-500/10 p-3 rounded-xl flex flex-col justify-between gap-1.5 shadow-sm">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">تكلفة فرقة التركيب</span>
                  <div>
                    {isCompanyCostEditable ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          value={companyInstallationCost === null ? '' : companyInstallationCost}
                          onChange={(e) => setCompanyInstallationCost(e.target.value === '' ? null : Number(e.target.value))}
                          className="h-7 w-20 text-xs font-bold pl-1 bg-background border-border"
                          autoFocus
                        />
                        <Button size="sm" className="h-7 px-1.5 text-[9px] font-bold" onClick={handleCompanyCostSave} disabled={savingCompanyCost}>
                          حفظ
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setIsCompanyCostEditable(true); setCompanyInstallationCost(displayCompanyCost); }}
                        className="font-black text-sm text-foreground hover:underline flex items-center gap-1 leading-none animate-in fade-in duration-200"
                      >
                        <span>{displayCompanyCost.toLocaleString('en-US')} د.ل</span>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Customer Cost - Original/Standard */}
                <div className="bg-blue-500/[0.02] border border-blue-500/10 p-3 rounded-xl flex flex-col justify-between gap-1.5 shadow-sm">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 leading-none">
                    {isReinstalled ? "سعر الزبون (التركيب الأصلي)" : "سعر الزبون"}
                  </span>
                  <div>
                    {isOriginalCostEditable ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          value={tempOriginalCost === 0 ? '' : tempOriginalCost}
                          onChange={(e) => setTempOriginalCost(e.target.value === '' ? 0 : Number(e.target.value))}
                          className="h-7 w-20 text-xs font-bold pl-1 bg-background border-border"
                          autoFocus
                        />
                        <Button 
                          size="sm" 
                          className="h-7 px-1.5 text-[9px] font-bold" 
                          onClick={async () => { 
                            await handleCustomerOriginalCostSave(tempOriginalCost); 
                            setIsOriginalCostEditable(false); 
                          }} 
                          disabled={savingCost}
                        >
                          حفظ
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setIsOriginalCostEditable(true);
                          setTempOriginalCost(isReinstalled ? customerOriginalInstallCost : customerInstallationCost);
                        }}
                        className="font-black text-sm text-foreground hover:underline flex items-center gap-1 leading-none animate-in fade-in duration-200"
                      >
                        <span>
                          {(isReinstalled ? customerOriginalInstallCost : customerInstallationCost).toLocaleString('en-US')} د.ل
                        </span>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Customer Cost - Reinstall (Only shown if reinstall_count > 0) */}
                {isReinstalled && (
                  <div className="bg-amber-500/[0.02] border border-amber-500/10 p-3 rounded-xl flex flex-col justify-between gap-1.5 shadow-sm col-span-2">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-none">
                      سعر الزبون (إعادة التركيب)
                    </span>
                    <div className="flex items-center justify-between">
                      <div>
                        {isReinstallCostEditable ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              value={tempReinstallCost === 0 ? '' : tempReinstallCost}
                              onChange={(e) => setTempReinstallCost(e.target.value === '' ? 0 : Number(e.target.value))}
                              className="h-7 w-20 text-xs font-bold pl-1 bg-background border-border"
                              autoFocus
                            />
                            <Button 
                              size="sm" 
                              className="h-7 px-1.5 text-[9px] font-bold" 
                              onClick={async () => { 
                                await handleCustomerReinstallCostSave(tempReinstallCost); 
                                setIsReinstallCostEditable(false); 
                              }} 
                              disabled={savingCost}
                            >
                              حفظ
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setIsReinstallCostEditable(true);
                              setTempReinstallCost(customerReinstallCost || customerInstallationCost);
                            }}
                            className="font-black text-sm text-foreground hover:underline flex items-center gap-1 leading-none animate-in fade-in duration-200"
                          >
                            <span>
                              {(customerReinstallCost || customerInstallationCost).toLocaleString('en-US')} د.ل
                            </span>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[9px] bg-amber-500/10 border-amber-300 text-amber-700">
                        إعادة تركيب ({item.reinstall_count} مرة)
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Itemized breakdown per element: تركيب / قص / طباعة */}
              <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 space-y-1 text-right">
                <span className="text-[10px] font-bold text-muted-foreground block">تفاصيل التكلفة لكل عنصر لللوحة:</span>
                <div className="flex items-center gap-1.5 text-[10px] flex-wrap font-bold">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200">
 تركيب: {totalCustomerCost.toLocaleString('ar-LY')} د.ل
                  </Badge>
                  {item.has_cutout && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200">
 ️ قص/مجسم
                    </Badge>
                  )}
                  {(isPrintActive || (item.price_per_meter || printPricePerMeter) > 0) && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
 ️ طباعة {item.price_per_meter || printPricePerMeter ? `(${item.price_per_meter || printPricePerMeter} د.ل/م²)` : ''}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quick Action: Paid / Settled Costs */}
              <div className="flex items-center justify-between gap-2 bg-amber-500/[0.03] border border-amber-500/10 p-2.5 rounded-xl shadow-sm transition-all duration-200 hover:bg-amber-500/[0.06]">
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">حالة سداد التكاليف للزبون</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">تصفير التكاليف للشركة والزبون معاً</span>
                </div>
                <Button
                  variant={totalCustomerCost === 0 && companyInstallationCost === 0 ? "default" : "outline"}
                  size="sm"
                  onClick={handleCustomerPaidAllCosts}
                  className={cn(
                    "h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg transition-all duration-200 cursor-pointer",
                    totalCustomerCost === 0 && companyInstallationCost === 0
                      ? "bg-amber-500 hover:bg-amber-600 text-black border-0 shadow-sm"
                      : "border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  )}
                  disabled={savingCost || savingCompanyCost}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{totalCustomerCost === 0 && companyInstallationCost === 0 ? "تم السداد والتصفير" : "سدد التكاليف / بدون تكاليف"}</span>
                </Button>
              </div>

              {/* Profit margin bar */}
              {totalCustomerCost > 0 && displayCompanyCost > 0 && (
                <div className={cn(
                  "text-[11px] font-bold py-2 px-3 rounded-xl flex items-center justify-between border",
                  (totalCustomerCost - displayCompanyCost) >= 0
                    ? "bg-emerald-500/[0.02] border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/[0.02] border-rose-500/20 text-rose-600 dark:text-rose-400"
                )}>
                  <span>هامش الربح التقديري:</span>
                  <div className="flex items-center gap-1.5 font-black text-xs">
                    {(totalCustomerCost - displayCompanyCost) >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    <span>{(totalCustomerCost - displayCompanyCost).toLocaleString('en-US')} د.ل</span>
                  </div>
                </div>
              )}
            {(item.replacement_status === 'reinstalled' || item.reinstall_count > 0) && customerInstallationCost === 0 && item.replacement_cost_bearer !== 'company' && (
              <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-[10px] text-destructive space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>لوحة مكررة التركيب — يرجى تحديد تكلفة الزبون</span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 w-full text-[9px] font-bold rounded-lg"
                  onClick={() => setIsCustomerCostEditable(true)}
                >
                  إدخال التكلفة الآن
                </Button>
              </div>
            )}

            {/* Extra costs block */}
            <div className="pt-2 border-t border-dashed border-border/40 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-muted-foreground">رسوم وتكاليف إضافية:</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant={isAdditionalCostEditable ? "default" : "outline"}
                    size="sm"
                    className="h-6.5 text-[9px] font-bold px-2 rounded-lg"
                    onClick={async () => {
                      if (isAdditionalCostEditable) {
                        await handleAdditionalCostSave();
                      } else {
                        setIsAdditionalCostEditable(true);
                      }
                    }}
                    disabled={savingAdditionalCost}
                  >
                    {savingAdditionalCost ? 'جاري الحفظ...' : isAdditionalCostEditable ? 'حفظ الرسوم' : 'إضافة رسوم'}
                  </Button>
                  {additionalCost > 0 && !isAdditionalCostEditable && (
                    <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold">
                      +{additionalCost.toLocaleString('en-US')} د.ل
                    </Badge>
                  )}
                </div>
              </div>

              {isAdditionalCostEditable && (
                <div className="space-y-2 p-2.5 bg-muted/40 rounded-xl border border-border/40">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-muted-foreground">المبلغ الإضافي</Label>
                    <Input
                      type="number"
                      value={additionalCost}
                      onChange={(e) => setAdditionalCost(e.target.value === '' ? 0 : Number(e.target.value))}
                      className="h-7.5 text-xs bg-background"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-muted-foreground">البيان/الملاحظات</Label>
                    <Input
                      type="text"
                      value={additionalCostNotes}
                      onChange={(e) => setAdditionalCostNotes(e.target.value)}
                      className="h-7.5 text-xs bg-background"
                      placeholder="سبب التكلفة الإضافية..."
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6.5 w-full text-[9px] font-bold"
                    onClick={() => {
                      setIsAdditionalCostEditable(false);
                      setAdditionalCost(item.additional_cost || 0);
                      setAdditionalCostNotes(item.additional_cost_notes || '');
                    }}
                  >
                    إلغاء
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

  // Completed State rendering override
  if (isCompleted) {
    return (
      <div className="group relative w-full self-start overflow-hidden rounded-2xl border border-emerald-500/25 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/45 hover:shadow-lg motion-reduce:transform-none">
        <div className="space-y-0">
          
          {/* Billboard Image Panel */}
          <div 
            className="relative aspect-[16/9] overflow-hidden bg-muted cursor-pointer shadow-sm"
            onClick={() => billboard?.Image_URL && setLightboxImage(billboard.Image_URL)}
          >
            {billboard?.Image_URL ? (
              <img
                src={billboard.Image_URL}
                alt={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            
            {/* Action Checkbox overlay */}
            <div 
              className="absolute top-2.5 right-2.5 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectionChange(checked as boolean)}
                className="h-5 w-5 rounded-lg border-2 border-white/40 bg-black/40 backdrop-blur-sm data-[state=checked]:!bg-primary data-[state=checked]:!border-primary cursor-pointer transition-all [&_svg]:!text-white [&_svg]:stroke-[3.5px]"
              />
            </div>

            <div className="absolute right-3 bottom-3 z-10 flex items-center gap-2 text-white">
              <span className="rounded-lg border border-white/20 bg-black/45 px-2.5 py-1 text-xs font-black backdrop-blur-sm" dir="ltr">
                #{billboard?.ID || item.billboard_id}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/90 px-2 py-1 text-[10px] font-bold shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                مكتملة
              </span>
            </div>
            

            
            {/* Badges Overlay */}
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 z-10">
              <Badge className="text-[9px] px-2 py-0.5 font-extrabold bg-black/60 backdrop-blur-sm text-white border-0 shadow-sm flex items-center gap-0.5">
                <Box className="h-3 w-3" />
                {billboard?.Size}
              </Badge>
              {billboard?.Faces_Count && (
                <Badge className="text-[9px] px-1.5 py-0.5 font-extrabold bg-black/60 backdrop-blur-sm text-white border-0 shadow-sm">
                  {billboard.Faces_Count === 1 ? 'وجه واحد' : `${billboard.Faces_Count} أوجه`}
                </Badge>
              )}
              {hasCutout && (
                <Badge className="text-[9px] px-1.5 py-0.5 font-extrabold bg-accent/90 backdrop-blur-sm text-white border-0 shadow-sm">
                  مجسم
                </Badge>
              )}
              {isPrintActive && (
                <Badge className="text-[9px] px-1.5 py-0.5 font-extrabold bg-blue-600/90 backdrop-blur-sm text-white border-0 shadow-sm flex items-center gap-1">
                  <Printer className="h-3 w-3" />
                  <span>طباعة</span>
                </Badge>
              )}
            </div>

          </div>

          {/* Details & Tags */}
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2 border-b border-border/40 pb-2.5">
              <h3 className="flex-1 line-clamp-1 text-base font-black leading-tight text-foreground">
                {billboard?.Billboard_Name || 'لوحة إعلانية'}
              </h3>
              <span className="rounded-lg border border-border/50 bg-muted/40 px-2 py-1 font-mono text-[10px] font-black text-muted-foreground">
                {billboard?.Size || 'غير محدد'}
              </span>
            </div>
            
            {/* Status Tags */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className="text-[10px] px-2 py-0.5 font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                مكتملة بنجاح
              </Badge>
              {billboard?.Size && (
                <Badge variant="secondary" className="text-[9px] px-2 py-0.5 font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1 rounded-full">
                  <Box className="h-3 w-3 text-blue-500" />
                  <span>المقاس: {billboard.Size}</span>
                </Badge>
              )}
              <Badge variant="secondary" className="text-[9px] px-2 py-0.5 font-extrabold bg-primary/10 text-primary border border-primary/30 flex items-center gap-1 rounded-full">
                <Layers className="h-3 w-3 text-primary" />
                <span>
                  الوجوه: {
                    (facesToInstall ?? item.faces_to_install) === 1 ? 'وجه واحد (أمامي)' :
                    (facesToInstall ?? item.faces_to_install) === 2 ? 'وجهين (أمامي وخلفي)' :
                    item.reinstalled_faces === 'face_a' ? 'وجه أمامي (1)' :
                    item.reinstalled_faces === 'face_b' ? 'وجه خلفي (1)' :
                    item.reinstalled_faces === 'both' ? 'وجهين (أمامي وخلفي)' :
                    `${availableFacesCount || 1} وجه`
                  }
                </span>
              </Badge>
              {isPrintActive && (
                <Badge className="text-[9px] px-2 py-0.5 font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 flex items-center gap-1">
                  <Printer className="h-3 w-3" />
                  <span>تم احتساب الطباعة</span>
                </Badge>
              )}
              {onUncomplete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (await systemConfirm({ title: 'تراجع', message: 'هل تريد التراجع عن إكمال هذه اللوحة؟', confirmText: 'تراجع' })) {
                      onUncomplete();
                    }
                  }}
                  className="h-6.5 text-[9px] px-2 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 hover:text-orange-600 border-none font-bold rounded-lg flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  تراجع عن الإكمال
                </Button>
              )}
              {(item.replacement_status === 'reinstalled' || (item.reinstall_count || 0) > 0) && (
                <Badge className="text-[9px] px-2 py-0.5 font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 rounded-full">
                  <RefreshCw className="h-3 w-3 text-amber-500" />
                  <span>معاد تركيبها (المرة {(item.reinstall_count || 0) + 1})</span>
                </Badge>
              )}
              {pausedInfo && (
                <Badge className="text-[9px] px-2 py-0.5 font-bold bg-amber-500 text-white border-0">
                  موقوفة
                </Badge>
              )}
              {replacementInfo && (
                <Badge className="text-[9px] px-2 py-0.5 font-bold bg-blue-600 text-white border-0">
                  بديلة
                </Badge>
              )}
            </div>

            {/* Location Strip on Card Header */}
            {(billboard?.Nearest_Landmark || billboard?.District || billboard?.Municipality || billboard?.City || billboard?.GPS_Link) && (
              <div className="flex items-center justify-between gap-1.5 text-[11px] p-2 bg-muted/40 dark:bg-muted/15 rounded-xl border border-border/40 text-foreground font-bold flex-wrap mt-1">
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  {billboard?.Nearest_Landmark && (
                    <span className="text-foreground font-extrabold">{billboard.Nearest_Landmark}</span>
                  )}
                  {billboard?.District && (
                    <span className="text-muted-foreground">{billboard?.Nearest_Landmark ? '• ' : ''}{billboard.District}</span>
                  )}
                  {(billboard?.Municipality || billboard?.City) && (
                    <span className="text-muted-foreground/80">• {billboard.Municipality || billboard.City}</span>
                  )}
                </div>
                {billboard?.GPS_Link && (
                  <a
                    href={billboard.GPS_Link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-white font-extrabold bg-primary/10 hover:bg-primary px-2.5 py-0.5 rounded-lg border border-primary/30 transition-all shrink-0 mr-auto"
                    title="فتح اللوكيشن GPS"
                  >
                    <Navigation className="h-3 w-3" />
                    <span>الموقع GPS</span>
                  </a>
                )}
              </div>
            )}

            {/* Quick Actions Row */}
            <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-3 sm:grid-cols-4" onClick={e => e.stopPropagation()}>
              {/* Camera - Add Installed Image */}
              {onAddInstalledImage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddInstalledImage}
                  className="h-10 w-full rounded-xl text-[10px] font-bold gap-1 border-emerald-500/25 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/40 transition-all duration-200 cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5 text-green-500" />
                  <span>صور التركيب</span>
                </Button>
              )}

              {/* Manage Designs */}
              {onEditDesign && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEditDesign}
                  className="h-10 w-full rounded-xl text-[10px] font-bold gap-1 border-primary/25 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all duration-200 cursor-pointer"
                >
                  <PaintBucket className="h-3.5 w-3.5 text-primary" />
                  <span>التصاميم</span>
                </Button>
              )}

              {/* Print */}
              {onPrint && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPrint}
                  className="h-10 w-full rounded-xl text-[10px] font-bold gap-1 border-blue-500/25 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/40 transition-all duration-200 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-blue-500" />
                  <span>طباعة</span>
                </Button>
              )}

              {/* Replace */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReplaceDialogOpen(true)}
                className="h-10 w-full rounded-xl text-[10px] font-bold gap-1 border-amber-500/25 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/40 transition-all duration-200 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                <span>إعادة تركيب</span>
              </Button>
              
              {/* More / Dropdown (like uncomplete, extend rental, etc.) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="col-span-2 h-10 w-full rounded-xl border-border/80 hover:bg-muted text-muted-foreground transition-all duration-200 cursor-pointer sm:col-span-1"
                    title="المزيد"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52 bg-popover rounded-2xl shadow-xl border-border/60" align="start">
                  {onUncomplete && (
                    <DropdownMenuItem 
                      onClick={async () => {
                        if (await systemConfirm({ title: 'تراجع', message: 'هل تريد التراجع عن إكمال هذه اللوحة؟', confirmText: 'تراجع' })) {
                          onUncomplete();
                        }
                      }}
                      className="gap-2 text-orange-500 font-bold focus:text-orange-600 focus:bg-orange-500/5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      التراجع عن الإكمال
                    </DropdownMenuItem>
                  )}
                  {billboard?.Rent_End_Date && (
                    <DropdownMenuItem onClick={() => setExtendDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4 text-emerald-500" />
                      تمديد الإيجار
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* The applied design remains visible without expanding the card. */}
            {renderDesignSelector()}

            {/* Faces to install selector for completed billboards */}
            {availableFacesCount > 1 && (
              <div className="space-y-1.5 pt-1" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">تحديد الوجه المطلوب للتركيب:</Label>
                  {onApplyFacesToAll && (
                    <button
                      type="button"
                      onClick={() => onApplyFacesToAll(facesToInstall)}
                      className="text-[10px] text-primary hover:text-primary/80 font-bold underline transition-colors cursor-pointer"
                    >
                      تطبيق على الكل
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  {Array.from({ length: availableFacesCount }).map((_, idx) => {
                    const faceNum = idx + 1;
                    const label = availableFacesCount === 2
                      ? (faceNum === 1 ? 'الوجه الأمامي فقط (1)' : 'الوجهين بالكامل (2)')
                      : availableFacesCount === 1
                      ? 'وجه واحد (1)'
                      : `${faceNum} ${faceNum === 1 ? 'وجه' : faceNum === 2 ? 'وجهين' : 'أوجه'}`;

                    return (
                      <button
                        key={faceNum}
                        type="button"
                        onClick={() => handleFacesChange(faceNum)}
                        className={`flex-1 min-w-[80px] py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center ${
                          facesToInstall === faceNum
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/60'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reinstall history button */}
            {(item.replacement_status === 'reinstalled' || item.replacement_status === 'replaced') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoHistoryOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition-colors border border-amber-500/25 shadow-sm"
              >
                <History className="h-4 w-4" />
                عرض أرشيف الصور السابقة ({item.reinstall_count || 1})
              </button>
            )}

            {/* فروع وإعادات التركيب - المرات */}
            {renderReinstallBranches()}

          </div>

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 pt-2.5 border-t border-border/40 overflow-hidden"
              >
                {/* Completion Date */}
                {item.installation_date && (
                  <div className="flex items-center justify-between text-xs p-2.5 bg-blue-500/5 dark:bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-700 dark:text-blue-400 shadow-sm" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 font-bold">
                      <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                      <span>تاريخ التركيب المنفذ: {format(new Date(item.installation_date), "dd/MM/yyyy", { locale: ar })}</span>
                    </div>
                    <button
                      onClick={() => {
                        setEditingDate(item.installation_date || '');
                        setEditDateDialogOpen(true);
                      }}
                      className="h-6 px-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center transition-colors text-primary font-bold text-[10px] cursor-pointer"
                    >
                      تعديل التاريخ
                    </button>
                  </div>
                )}

                {renderDesignPreview()}
                {renderInstalledPhotosPreview()}

              </motion.div>
            )}
          </AnimatePresence>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="mt-1 h-10 w-full cursor-pointer gap-1.5 rounded-xl border border-border/40 bg-muted/25 text-xs font-bold text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/8 hover:text-primary active:scale-[0.99]"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                <span>إخفاء التفاصيل</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                <span>التاريخ والصور والتصميم</span>
              </>
            )}
          </Button>
        </div>

        {/* Dialog تمديد الإيجار */}
        <BillboardExtendRentalDialog
          open={extendDialogOpen}
          onOpenChange={setExtendDialogOpen}
          billboard={{
            ID: billboard?.ID,
            Billboard_Name: billboard?.Billboard_Name,
            Rent_End_Date: billboard?.Rent_End_Date,
            Contract_Number: billboard?.Contract_Number
          }}
          onSuccess={onRefresh}
        />

        {/* Lightbox */}
        {lightboxImage && createPortal(
          <ImageLightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />,
          document.body
        )}

        {/* Dialog تكرار/إعادة الاستبدال */}
        <ReplaceBillboardDialog
          open={replaceDialogOpen}
          onOpenChange={setReplaceDialogOpen}
          item={item}
          billboard={billboard}
          taskId={item.task_id}
          onSuccess={() => onRefresh?.()}
        />

        {/* Photo History */}
        <InstallationPhotoHistoryDialog
          open={photoHistoryOpen}
          onOpenChange={setPhotoHistoryOpen}
          taskItemId={item.id}
          billboardId={item.billboard_id}
        />
      </div>
    );
  }

  // Pending State Card View Override
  return (
    <div
      className={cn(
        "group relative min-w-0 w-full self-start overflow-hidden rounded-2xl bg-card border shadow-sm transition-all duration-200 motion-reduce:transform-none",
        isSelected 
          ? "border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/15 bg-primary/[0.02]" 
          : isDelayed
          ? "border-red-500/30 hover:shadow-lg hover:-translate-y-0.5"
          : "border-border/60 hover:border-primary/35 hover:shadow-lg hover:-translate-y-0.5"
      )}
    >
      <div className="space-y-0">
        
        {/* Main image preview */}
        <div 
          className="relative aspect-[16/9] overflow-hidden cursor-pointer shadow-sm"
          onClick={() => billboard?.Image_URL && setLightboxImage(billboard.Image_URL)}
        >
          {billboard?.Image_URL ? (
            <img
              src={billboard.Image_URL}
              alt={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          
          {/* Action Checkbox overlay */}
          <div 
            className="absolute top-2.5 right-2.5 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelectionChange(checked as boolean)}
              className="h-5 w-5 rounded-lg border-2 border-white/40 bg-black/40 backdrop-blur-sm data-[state=checked]:!bg-primary data-[state=checked]:!border-primary cursor-pointer transition-all [&_svg]:!text-white [&_svg]:stroke-[3.5px]"
            />
          </div>

          <div className="absolute right-3 bottom-3 z-10 flex items-center gap-2 text-white">
            <span className="rounded-lg border border-white/20 bg-black/45 px-2.5 py-1 text-xs font-black backdrop-blur-sm" dir="ltr">
              #{billboard?.ID || item.billboard_id}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/90 px-2 py-1 text-[10px] font-bold shadow-sm">
              <Clock className="h-3.5 w-3.5" />
              قيد التنفيذ
            </span>
          </div>

          {/* Badges Overlay */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 z-10">
            {isPrintActive && (
              <Badge className="text-[9px] px-1.5 py-0.5 font-extrabold bg-blue-600/90 backdrop-blur-sm text-white border-0 shadow-sm flex items-center gap-1">
                <Printer className="h-3 w-3" />
                <span>طباعة</span>
              </Badge>
            )}
            {hasCutout && (
              <Badge className="text-[9px] px-1.5 py-0.5 font-extrabold bg-accent/90 backdrop-blur-sm text-white border-0 shadow-sm">
                مجسم
              </Badge>
            )}
          </div>

          {/* Overdue delay badge */}
          {isDelayed && (
            <div className="absolute bottom-2.5 left-2.5 bg-red-500 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md text-[9px] animate-pulse font-bold">
              <AlertTriangle className="h-3 w-3" />
              <span>متأخر تركيبها {delayDays} يوم</span>
            </div>
          )}
          
        </div>

        {/* Details and tags */}
        <div className="space-y-3 p-3.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2.5 mb-2.5">
                <h3 className="flex-1 line-clamp-1 text-base font-black leading-tight text-foreground">
                  {billboard?.Billboard_Name || 'لوحة إعلانية'}
                </h3>
                <span className="rounded-lg border border-border/50 bg-muted/40 px-2 py-1 font-mono text-[10px] font-black text-muted-foreground">
                  {billboard?.Size || 'غير محدد'}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  قيد التركيب
                </span>
                {billboard?.Size && (
                  <Badge variant="secondary" className="text-[9px] px-2 py-0.5 font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1 rounded-full">
                    <Box className="h-3 w-3 text-blue-500" />
                    <span>المقاس: {billboard.Size}</span>
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[9px] px-2 py-0.5 font-extrabold bg-primary/10 text-primary border border-primary/30 flex items-center gap-1 rounded-full">
                  <Layers className="h-3 w-3 text-primary" />
                  <span>
                    الوجوه: {
                      item.reinstalled_faces === 'both' ? 'وجهين (أمامي وخلفي)' :
                      item.reinstalled_faces === 'face_a' ? 'وجه أمامي (1)' :
                      item.reinstalled_faces === 'face_b' ? 'وجه خلفي (1)' :
                      `${item.faces_to_install || availableFacesCount || 1} وجه`
                    }
                  </span>
                </Badge>
                {isPrintActive && (
                  <Badge className="text-[9px] px-2 py-0.5 font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 flex items-center gap-1 rounded-full">
                    <span>تم تفعيل الطباعة</span>
                  </Badge>
                )}
                {billboard?.friend_companies?.name && (
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-bold">
                    <Building2 className="h-3 w-3.5 shrink-0" />
                    <span className="truncate max-w-[100px]">{billboard.friend_companies.name}</span>
                  </div>
                )}
              </div>

              {/* Location Strip on Card Header */}
              {(billboard?.Nearest_Landmark || billboard?.District || billboard?.Municipality || billboard?.City || billboard?.GPS_Link) && (
                <div className="flex items-center justify-between gap-1.5 text-[11px] p-2 bg-muted/40 dark:bg-muted/15 rounded-xl border border-border/40 text-foreground font-bold flex-wrap mt-1">
                  <div className="flex items-center gap-1.5 flex-wrap flex-1">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    {billboard?.Nearest_Landmark && (
                      <span className="text-foreground font-extrabold">{billboard.Nearest_Landmark}</span>
                    )}
                    {billboard?.District && (
                      <span className="text-muted-foreground">{billboard?.Nearest_Landmark ? '• ' : ''}{billboard.District}</span>
                    )}
                    {(billboard?.Municipality || billboard?.City) && (
                      <span className="text-muted-foreground/80">• {billboard.Municipality || billboard.City}</span>
                    )}
                  </div>
                  {billboard?.GPS_Link && (
                    <a
                      href={billboard.GPS_Link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-white font-extrabold bg-primary/10 hover:bg-primary px-2.5 py-0.5 rounded-lg border border-primary/30 transition-all shrink-0 mr-auto"
                      title="فتح اللوكيشن GPS"
                    >
                      <Navigation className="h-3 w-3" />
                      <span>الموقع GPS</span>
                    </a>
                  )}
                </div>
              )}

              {/* Quick Actions Row */}
              <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-3 sm:grid-cols-5" onClick={e => e.stopPropagation()}>
                {onAddInstalledImage && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onAddInstalledImage}
                    className="h-10 w-full cursor-pointer gap-1 rounded-xl bg-primary px-2 text-[10px] font-black text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-95"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>صورة التركيب</span>
                  </Button>
                )}
                {/* Manage Designs */}
                {onEditDesign && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onEditDesign}
                    className="h-10 w-full rounded-xl text-[10px] font-bold gap-1 border-primary/25 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all duration-200 cursor-pointer"
                  >
                    <PaintBucket className="h-3.5 w-3.5 text-primary" />
                    <span>التصاميم</span>
                  </Button>
                )}
                
                {/* Print */}
                {onPrint && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPrint}
                    className="h-10 w-full rounded-xl text-[10px] font-bold gap-1 border-blue-500/25 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/40 transition-all duration-200 cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-500" />
                    <span>طباعة</span>
                  </Button>
                )}
                
                {/* Replace */}
                {item.replacement_status !== 'replaced' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReplaceDialogOpen(true)}
                    className="h-10 w-full rounded-xl text-[10px] font-bold gap-1 border-amber-500/25 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/40 transition-all duration-200 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                    <span>إعادة تركيب</span>
                  </Button>
                )}

                {/* Delete */}
                {onDelete && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      if (await systemConfirm({ title: 'تأكيد الحذف', message: 'هل تريد حذف هذه اللوحة من المهمة؟', variant: 'destructive', confirmText: 'حذف' })) {
                        onDelete();
                      }
                    }}
                    className="h-10 w-full rounded-xl border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-all duration-200 cursor-pointer"
                    title="إزالة اللوحة"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* The applied design remains visible without expanding the card. */}
              {renderDesignSelector()}
            </div>
            
          </div>

          {/* Replacement banner info */}
          {item.replacement_status && (
            <div className={cn(
              "flex flex-col gap-1.5 text-xs p-2.5 rounded-xl border",
              item.replacement_status === 'replaced' 
                ? 'bg-red-500/5 border-red-500/20 text-red-600'
                : item.replacement_status === 'replacement'
                ? 'bg-blue-500/5 border-blue-500/20 text-blue-600'
                : 'bg-amber-500/5 border-amber-500/20 text-amber-600'
            )}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold">
                  {item.replacement_status === 'replaced' && 'مستبدلة'}
                  {item.replacement_status === 'replacement' && 'لوحة بديلة'}
                  {item.replacement_status === 'reinstalled' && 'أعيد تركيبها'}
                </span>
                {item.replacement_status === 'reinstalled' && (
                  <Badge className="text-[9px] font-extrabold bg-amber-600 text-white border-0 px-1.5 py-0.5 rounded-md shadow-sm">
                    {item.reinstall_count || 1} مرة
                  </Badge>
                )}
                {item.replacement_cost_bearer && (
                  <Badge variant="outline" className="text-[8px] bg-background">
                    التكلفة: {item.replacement_cost_bearer === 'customer' ? 'الزبون' : item.replacement_cost_bearer === 'company' ? 'الشركة' : `${item.replacement_cost_percentage || 50}% زبون`}
                  </Badge>
                )}
              </div>
              {item.replacement_reason && (
                <p className="text-[9px] text-muted-foreground/80 leading-normal">السبب: {item.replacement_reason}</p>
              )}

              {/* History index */}
              {(item.replacement_status === 'reinstalled' || item.replacement_status === 'replaced') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoHistoryOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg font-bold text-[10px] bg-muted hover:bg-muted/80 text-foreground transition-all shadow-sm"
                >
                  <History className="h-3.5 w-3.5" />
                  عرض صور التركيب السابقة ({item.reinstall_count || 1})
                </button>
              )}

              {/* Link references */}
              {item.replacement_status === 'replaced' && item.replaced_by_item_id && (
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
                  <ArrowLeftRight className="h-3 w-3" />
                  <span>البديلة: لوحة #{allItems?.find(i => i.id === item.replaced_by_item_id)?.billboard_id || '...'}</span>
                </div>
              )}
              {item.replacement_status === 'replacement' && item.replaces_item_id && (
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
                  <ArrowLeftRight className="h-3 w-3" />
                  <span>بديلة للوحة #{allItems?.find(i => i.id === item.replaces_item_id)?.billboard_id || '...'}</span>
                </div>
              )}
              {/* فروع وإعادات التركيب - المرات */}
              {renderReinstallBranches()}
          </div>
          )}

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 pt-2.5 border-t border-border/40 overflow-hidden"
              >
                {/* Installation Date Picker inline row */}
                <div
                  className="flex items-center justify-between text-xs p-2.5 bg-blue-500/5 rounded-xl border border-blue-500/20 text-blue-700 dark:text-blue-400 shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className={item.installation_date ? 'font-bold' : 'italic text-muted-foreground'}>
                      {item.installation_date
                        ? format(new Date(item.installation_date), 'dd/MM/yyyy', { locale: ar })
                        : 'تاريخ التركيب غير محدد'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingDate(item.installation_date || '');
                      setEditDateDialogOpen(true);
                    }}
                    className="h-6 px-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center transition-all text-primary font-extrabold text-[10px] cursor-pointer"
                  >
                    تعديل التاريخ
                  </button>
                </div>

                {/* Faces to install selection */}
                {availableFacesCount >= 1 && (
                  <div className="pt-2 border-t border-border/40 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        الوجه المطلوب تركيبه
                        <span className="text-[10px] text-muted-foreground font-normal">
                          (من أصل {availableFacesCount} {availableFacesCount === 1 ? 'وجه متوفر' : availableFacesCount === 2 ? 'وجهين متوفرين' : 'أوجه متوفرة'})
                        </span>
                      </span>
                      {onApplyFacesToAll && availableFacesCount > 1 && (
                        <button
                          onClick={() => onApplyFacesToAll(facesToInstall)}
                          className="text-[9px] text-primary hover:underline font-bold flex items-center gap-0.5"
                        >
                          <Link2 className="h-3 w-3" />
                          تعميم الخيار للكل
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {Array.from({ length: availableFacesCount }).map((_, idx) => {
                        const faceNum = idx + 1;
                        const label = availableFacesCount === 2
                          ? (faceNum === 1 ? 'الوجه الأمامي فقط (1)' : 'الوجهين بالكامل (2)')
                          : availableFacesCount === 1
                          ? 'وجه واحد (1)'
                          : `${faceNum} ${faceNum === 1 ? 'وجه' : faceNum === 2 ? 'وجهين' : 'أوجه'}`;

                        return (
                          <button
                            key={faceNum}
                            type="button"
                            onClick={() => handleFacesChange(faceNum)}
                            className={`flex-1 min-w-[80px] py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center ${
                              facesToInstall === faceNum
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/60'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cutout toggle button */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleCutoutChange(!hasCutout)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      hasCutout 
                        ? 'bg-accent/15 text-accent border-accent/40 shadow-sm' 
                        : 'bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/60'
                    }`}
                  >
                    <Box className="h-4 w-4" />
                    {hasCutout ? 'يحتوي مجسم' : 'إضافة مجسم'}
                  </button>
                </div>

                {/* Visual and design controls stay inside the optional details area. */}
                {renderDesignPreview()}
                {renderInstalledPhotosPreview()}

              </motion.div>
            )}
          </AnimatePresence>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="mt-1 h-10 w-full cursor-pointer gap-1.5 rounded-xl border border-border/40 bg-muted/25 text-xs font-bold text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/8 hover:text-primary active:scale-[0.99]"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                <span>إخفاء التفاصيل</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                <span>التاريخ والوجوه والتصميم</span>
              </>
            )}
          </Button>
        </div>

      </div>

      {/* Dialog تعديل تاريخ التركيب للوحات غير المكتملة */}
      <Dialog open={editDateDialogOpen} onOpenChange={setEditDateDialogOpen}>
        <DialogContent className="max-w-sm rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-sm font-bold">
              <CalendarIcon className="h-5 w-5 text-primary" />
              تعديل تاريخ تركيب اللوحة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">تاريخ التركيب المقترح</Label>
              <CustomDatePicker
                value={editingDate}
                onChange={(val) => setEditingDate(val)}
                placeholder="اختر تاريخ التركيب"
              />
            </div>
            <div className="flex justify-end gap-2 shrink-0 pt-2">
              <Button variant="outline" className="rounded-xl font-bold text-xs h-10" onClick={() => setEditDateDialogOpen(false)}>
                إلغاء
              </Button>
              <Button className="rounded-xl font-bold text-xs h-10" onClick={handleEditDate} disabled={savingDate}>
                {savingDate ? 'جاري الحفظ...' : 'حفظ التاريخ'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend Rental */}
      <BillboardExtendRentalDialog
        open={extendDialogOpen}
        onOpenChange={setExtendDialogOpen}
        billboard={{
          ID: billboard?.ID,
          Billboard_Name: billboard?.Billboard_Name,
          Rent_End_Date: billboard?.Rent_End_Date,
          Contract_Number: billboard?.Contract_Number
        }}
        onSuccess={onRefresh}
      />

      {/* Lightbox */}
      {lightboxImage && createPortal(
        <ImageLightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />,
        document.body
      )}

      {/* Replace Billboard Dialog */}
      <ReplaceBillboardDialog
        open={replaceDialogOpen}
        onOpenChange={setReplaceDialogOpen}
        item={item}
        billboard={billboard}
        taskId={item.task_id}
        onSuccess={() => onRefresh?.()}
      />

      {/* Edit Replacement Dialog */}
      <EditReplacementDialog
        open={editReplacementOpen}
        onOpenChange={setEditReplacementOpen}
        item={item}
        allItems={allItems || []}
        onSaved={() => { onRefresh?.(); }}
      />

      {/* Photo History */}
      <InstallationPhotoHistoryDialog
        open={photoHistoryOpen}
        onOpenChange={setPhotoHistoryOpen}
        taskItemId={item.id}
        billboardId={item.billboard_id}
      />
    </div>
  );
}
