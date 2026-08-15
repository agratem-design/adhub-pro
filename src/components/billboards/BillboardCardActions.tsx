import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Link, Unlink, Trash2, ExternalLink, Camera, Wrench, Settings, AlertTriangle, Sparkles } from 'lucide-react';
import { Billboard } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BillboardStatusDialog } from './BillboardStatusDialog';

interface BillboardCardActionsProps {
  billboard: Billboard;
  hasContract: boolean;
  canEdit: boolean;
  onEdit: (billboard: Billboard) => void;
  onContractAction: (billboard: Billboard) => void;
  onDelete: (id: number | string) => void;
  onMaintenance: (billboard: Billboard) => void;
  onUpdate: () => void;
  onLocalUpdate?: (id: number | string, updates: Record<string, any>) => void;
  onOpenOverlayEditor?: (billboard: Billboard) => void;
}

export const BillboardCardActions: React.FC<BillboardCardActionsProps> = ({
  billboard,
  hasContract,
  canEdit,
  onEdit,
  onContractAction,
  onDelete,
  onMaintenance,
  onUpdate,
  onLocalUpdate,
  onOpenOverlayEditor,
}) => {
  const billboardId = (billboard as any).ID || (billboard as any).id;

  const handleOpenLocation = () => {
    const coords = billboard.GPS_Coordinates || (billboard as any).gps_coordinates || null;
    if (!coords) {
      toast.error('لا توجد إحداثيات جغرافية لهذه اللوحة');
      return;
    }
    const coordStr = String(coords).trim().replace(/\s+/g, ' ');
    const match = coordStr.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (!match) {
      toast.error('تنسيق الإحداثيات غير صحيح');
      return;
    }
    window.open(`https://maps.google.com/?q=${match[1]},${match[3]}`, '_blank', 'noopener,noreferrer');
  };

  const handleToggleRephotography = async () => {
    try {
      const currentStatus = (billboard as any).needs_rephotography || false;
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('billboards')
        // @ts-ignore
        .update({ needs_rephotography: newStatus })
        .eq('ID', billboardId);
      if (error) throw error;
      toast.success(newStatus ? 'تم إضافة اللوحة لقائمة إعادة التصوير' : 'تم إزالة اللوحة من قائمة إعادة التصوير');
      if (onLocalUpdate) {
        onLocalUpdate(billboardId, { needs_rephotography: newStatus });
      } else {
        onUpdate();
      }
    } catch {
      toast.error('فشل في تحديث حالة إعادة التصوير');
    }
  };

  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="إعدادات اللوحة"
          title="إعدادات اللوحة"
          className="h-8 w-8 rounded-xl bg-background/95 dark:bg-card/95 backdrop-blur-md border border-border/60 text-foreground shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md hover:scale-105 transition-all"
        >
          <Settings className="h-4 w-4 transition-transform duration-500 hover:rotate-90" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {canEdit && (
          <>
            {onOpenOverlayEditor && (
              <DropdownMenuItem onClick={() => onOpenOverlayEditor(billboard)} className="cursor-pointer gap-2 font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 focus:bg-amber-500/20">
                <Sparkles className="h-4 w-4 text-amber-500" />
                محرر التراكب والواقعية
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(billboard)} className="cursor-pointer gap-2">
              <Edit className="h-4 w-4 text-blue-500" />
              تعديل
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onContractAction(billboard)} 
              className="cursor-pointer gap-2"
            >
              {hasContract ? (
                <>
                  <Unlink className="h-4 w-4 text-amber-500" />
                  إزالة من العقد
                </>
              ) : (
                <>
                  <Link className="h-4 w-4 text-emerald-500" />
                  إضافة لعقد
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={handleOpenLocation} className="cursor-pointer gap-2">
          <ExternalLink className="h-4 w-4 text-sky-500" />
          فتح الموقع
        </DropdownMenuItem>
        {canEdit && (
          <>
            <DropdownMenuItem onClick={handleToggleRephotography} className="cursor-pointer gap-2">
              <Camera className="h-4 w-4 text-violet-500" />
              {(billboard as any).needs_rephotography ? 'إلغاء التصوير' : 'إعادة تصوير'}
            </DropdownMenuItem>
            {hasContract && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  // أغلق القائمة المنسدلة أولاً ثم افتح الحوار في tick جديد
                  // لتفادي تجمّد pointer-events:none على body من Radix
                  setTimeout(() => setStatusOpen(true), 0);
                }}
                className="cursor-pointer gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-red-500" />
                تسجيل حالة (ممزق / تغيير مقاس / إزالة)
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onMaintenance(billboard)} className="cursor-pointer gap-2">
              <Wrench className="h-4 w-4 text-amber-500" />
              صيانة
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(billboardId)} 
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              حذف
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <BillboardStatusDialog open={statusOpen} onOpenChange={setStatusOpen} billboard={billboard} onLocalUpdate={onLocalUpdate} />
    </>
  );
};
