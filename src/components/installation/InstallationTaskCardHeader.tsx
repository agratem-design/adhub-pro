import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2,
  Clock,
  Printer,
  Package,
  PaintBucket,
  Layers,
  Edit,
  ArrowRight,
  FileText,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Users,
  MapPin,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InstallationTaskCardHeaderProps {
  task: any;
  contract: any;
  contractById: Record<number, any>;
  team: any;
  taskItems: any[];
  taskDesigns: any[];
  isSelected: boolean;
  isExpanded: boolean;
  completedItems: number;
  completionPercentage: number;
  totalInstallCost: number;
  derivedContractIds?: number[];
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onManageDesigns: () => void;
  onDistributeDesigns: () => void;
  onEditTaskType: () => void;
  onTransferBillboards: () => void;
  onPrintAll: () => void;
  onDelete: () => void;
  onCreatePrintTask: () => void;
  onCompleteBillboards: () => void;
  onSetInstallationDate: () => void;
  onUnmerge?: () => void;
  onNavigateToPrint?: () => void;
  onNavigateToCutout?: () => void;
}

export function InstallationTaskCardHeader({
  task,
  contract,
  contractById,
  team,
  taskItems,
  taskDesigns,
  isSelected,
  isExpanded,
  completedItems,
  completionPercentage,
  totalInstallCost,
  derivedContractIds,
  onToggleSelect,
  onToggleExpand,
  onManageDesigns,
  onDistributeDesigns,
  onEditTaskType,
  onTransferBillboards,
  onPrintAll,
  onDelete,
  onCreatePrintTask,
  onCompleteBillboards,
  onSetInstallationDate,
  onUnmerge,
  onNavigateToPrint,
  onNavigateToCutout
}: InstallationTaskCardHeaderProps) {
  // استخدام derivedContractIds إن وُجدت، وإلا نرجع للـ contract_ids، وإلا نعتمد على contract_id الواحد
  const effectiveContractIds = derivedContractIds && derivedContractIds.length > 0
    ? derivedContractIds
    : (task.contract_ids && task.contract_ids.length > 0 ? task.contract_ids : [task.contract_id]);
  const isMergedTask = effectiveContractIds.length > 1;
  const taskContractIds = effectiveContractIds;
  const isFullyCompleted = completedItems === taskItems.length && taskItems.length > 0;
  const isPartiallyCompleted = completedItems > 0 && !isFullyCompleted;
  
  const customerTotal = taskItems.reduce((sum, item) => {
    const isReinstalled = (item.reinstall_count || 0) > 0;
    const origCost = Number(item.customer_original_install_cost) || Number(item.customer_installation_cost) || 0;
    const reinstallCost = isReinstalled
      ? (Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0)
      : 0;
    const itemCost = isReinstalled ? (origCost + reinstallCost) : (Number(item.customer_installation_cost) || 0);
    return sum + itemCost;
  }, 0);
  const additionalTotal = taskItems.reduce((sum, item) => sum + (item.additional_cost || 0), 0);

  return (
    <div className="relative">
      {/* Progress Bar */}
      {taskItems.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted overflow-hidden rounded-t-xl">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`h-full ${
              isFullyCompleted 
                ? 'bg-gradient-to-r from-emerald-500 to-green-500' 
                : 'bg-gradient-to-r from-primary to-primary/70'
            }`}
          />
        </div>
      )}

      <div className="p-4 pt-5">
        <div className="flex items-start gap-4">
          {/* Selection Checkbox */}
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              className="h-5 w-5 data-[state=checked]:bg-primary"
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Contract Info Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {isMergedTask ? (
                <>
                  {taskContractIds.slice(0, 3).map((contractId: number, index: number) => {
                    const mergedContract = contractById[contractId];
                    return (
                      <div key={contractId} className="flex items-center gap-1">
                        <Badge 
                          variant="outline" 
                          className="font-bold bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30"
                        >
                          #{contractId}
                        </Badge>
                        {mergedContract?.['Ad Type'] && (
                          <Badge variant="secondary" className="text-xs">
                            {mergedContract['Ad Type']}
                          </Badge>
                        )}
                        {index < Math.min(taskContractIds.length, 3) - 1 && (
                          <span className="text-muted-foreground text-xs mx-1">|</span>
                        )}
                      </div>
                    );
                  })}
                  {taskContractIds.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{taskContractIds.length - 3} عقود
                    </Badge>
                  )}
                  <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs border-0 shadow-sm">
                    مدمجة
                  </Badge>
                </>
              ) : (
                <>
                  <Badge 
                    variant="outline" 
                    className="font-bold text-sm bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30"
                  >
                    #{task.contract_id}
                  </Badge>
                  {contract?.['Ad Type'] && (
                    <Badge variant="secondary" className="text-xs">
                      {contract['Ad Type']}
                    </Badge>
                  )}
                </>
              )}
              
              {/* Task Type Badge */}
              {task.task_type === 'reinstallation' ? (
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs border-0 shadow-sm gap-1">
                  <ArrowRight className="h-3 w-3" />
                  إعادة تركيب
                </Badge>
              ) : (
                <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs border-0 shadow-sm gap-1">
                  <Sparkles className="h-3 w-3" />
                  تركيب جديد
                </Badge>
              )}
            </div>

            {/* Customer & Team Info */}
            <div className="flex items-center gap-4 flex-wrap">
              <h3 className="font-bold text-lg">
                {contract?.['Customer Name'] || 'غير محدد'}
              </h3>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {team?.team_name || 'غير محدد'}
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Billboards Count */}
              <div className="flex items-center gap-1.5 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium">{taskItems.length} لوحة</span>
              </div>

              {/* Completion Status */}
              {isFullyCompleted ? (
                <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-sm gap-1.5 px-3">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  مكتملة بالكامل
                </Badge>
              ) : isPartiallyCompleted ? (
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm gap-1.5 px-3">
                  <Clock className="h-3.5 w-3.5" />
                  {completedItems}/{taskItems.length} ({completionPercentage}%)
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-muted-foreground gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  لم تبدأ بعد
                </Badge>
              )}
              
              {/* Installation Costs - Team / Customer */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 rounded-lg border text-xs">
                <span className="text-muted-foreground">التركيب:</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="font-manrope font-bold text-emerald-600 dark:text-emerald-400">
                        {totalInstallCost > 0 ? totalInstallCost.toLocaleString('ar-LY') : '0'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>تكلفة الفريق</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-muted-foreground">/</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="font-manrope font-bold text-blue-600 dark:text-blue-400">
                        {customerTotal > 0 ? customerTotal.toLocaleString('ar-LY') : '0'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>تكلفة الزبون</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-muted-foreground">د.ل</span>
              </div>

              {/* Print/Cutout Status */}
              {task.print_tasks && (
                <Badge 
                  className={`cursor-pointer gap-1 ${
                    task.print_tasks.status === 'completed' 
                      ? 'bg-emerald-500 hover:bg-emerald-600' 
                      : task.print_tasks.status === 'in_progress' 
                        ? 'bg-amber-500 hover:bg-amber-600' 
                        : 'bg-red-500 hover:bg-red-600'
                  }`}
                  onClick={onNavigateToPrint}
                >
                  <Printer className="h-3 w-3" />
                  طباعة
                </Badge>
              )}
              
              {task.cutout_tasks && (
                <Badge 
                  className={`cursor-pointer gap-1 ${
                    task.cutout_tasks.status === 'completed' 
                      ? 'bg-emerald-500 hover:bg-emerald-600' 
                      : task.cutout_tasks.status === 'in_progress' 
                        ? 'bg-amber-500 hover:bg-amber-600' 
                        : 'bg-red-500 hover:bg-red-600'
                  }`}
                  onClick={onNavigateToCutout}
                >
                  <Package className="h-3 w-3" />
                  مجسمات
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Quick Actions */}
            <div className="hidden xl:flex items-center gap-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onManageDesigns}
                      className="h-9 px-3 hover:bg-primary/10 hover:text-primary"
                    >
                      <PaintBucket className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>إدارة التصاميم</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDistributeDesigns}
                      className={`h-9 px-3 ${taskDesigns.length > 0 ? 'hover:bg-primary/10 hover:text-primary' : 'text-muted-foreground'}`}
                    >
                      <Layers className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>توزيع التصاميم</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onPrintAll}
                      className="h-9 px-3 hover:bg-primary/10 hover:text-primary"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>طباعة الكل</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  الإجراءات
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onManageDesigns} className="gap-2">
                  <PaintBucket className="h-4 w-4" />
                  إدارة التصاميم
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDistributeDesigns} className="gap-2">
                  <Layers className="h-4 w-4" />
                  توزيع التصاميم
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEditTaskType} className="gap-2">
                  <Edit className="h-4 w-4" />
                  تعديل النوع
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onTransferBillboards} className="gap-2">
                  <ArrowRight className="h-4 w-4" />
                  نقل لوحات
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPrintAll} className="gap-2">
                  <FileText className="h-4 w-4" />
                  طباعة الكل
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {!task.print_tasks && !task.cutout_tasks && (
                  <DropdownMenuItem onClick={onCreatePrintTask} className="gap-2">
                    <Printer className="h-4 w-4" />
                    إنشاء مهام
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onCompleteBillboards} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  إكمال اللوحات
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSetInstallationDate} className="gap-2">
                  <Calendar className="h-4 w-4" />
                  تحديد تاريخ تركيب
                </DropdownMenuItem>
                {isMergedTask && onUnmerge && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onUnmerge} className="gap-2 text-orange-600">
                      <ArrowRight className="h-4 w-4 rotate-180" />
                      التراجع عن الدمج
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Expand/Collapse */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="h-9 w-9 p-0"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-5 w-5" />
              </motion.div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
