import { buildPrintTaskHTML } from '@/lib/printTaskPrintGenerator';
import { useState, useEffect } from 'react';
import { Printer, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import { UnifiedPrintDialog } from '@/components/print/UnifiedPrintDialog';
interface PrintTask {
  id: string;
  contract_id: number;
  customer_name: string | null;
  status: string;
  total_area: number;
  total_cost: number;
  price_per_meter: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface PrintTaskItem {
  id: string;
  billboard_id: number;
  description: string | null;
  width: number;
  height: number;
  area: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  design_face_a: string | null;
  design_face_b: string | null;
  billboard_name?: string;
  billboard_image?: string;
  billboard_size?: string;
}

interface PrintTaskPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: PrintTask;
  printerName: string;
}

export function PrintTaskPrintDialog({ 
  open, 
  onOpenChange, 
  task, 
  printerName 
}: PrintTaskPrintDialogProps) {
  const [items, setItems] = useState<PrintTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedHtml, setGeneratedHtml] = useState('');

  useEffect(() => {
    if (open && task) {
      loadTaskItems();
    }
  }, [open, task]);

  const loadTaskItems = async () => {
    try {
      setLoading(true);
      const { data: taskItems, error } = await supabase
        .from('print_task_items')
        .select('*')
        .eq('task_id', task.id);

      if (error) throw error;

      if (taskItems && taskItems.length > 0) {
        const billboardIds = taskItems.map(item => item.billboard_id).filter(Boolean);
        
        let billboardsMap: Record<number, any> = {};
        if (billboardIds.length > 0) {
          const { data: billboards } = await supabase
            .from('billboards')
            .select('ID, Billboard_Name, Image_URL, Size')
            .in('ID', billboardIds);
          
          if (billboards) {
            billboardsMap = billboards.reduce((acc, b) => {
              acc[b.ID] = b;
              return acc;
            }, {} as Record<number, any>);
          }
        }

        const enrichedItems = taskItems.map(item => ({
          ...item,
          billboard_name: billboardsMap[item.billboard_id]?.Billboard_Name || `لوحة ${item.billboard_id}`,
          billboard_image: billboardsMap[item.billboard_id]?.Image_URL,
          billboard_size: billboardsMap[item.billboard_id]?.Size
        }));

        setItems(enrichedItems);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Error loading task items:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {

    // ✅ جلب إعدادات القالب المحفوظة (async)
    const styles = await getMergedInvoiceStylesAsync('print_task');
    const htmlContent = buildPrintTaskHTML(styles, task, items, printerName);
    setGeneratedHtml(htmlContent);
  };

  // Generate HTML on open
  useEffect(() => {
    if (!loading && items.length > 0 && open) {
      handlePrint();
    }
  }, [loading, items.length, open]);

  return (
    <UnifiedPrintDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`فاتورة طباعة - عقد #${task.contract_id}`}
      subtitle={`${items.length} لوحة | ${(task.total_cost || 0).toLocaleString()} د.ل`}
      icon={<Printer className="h-5 w-5 text-primary" />}
      html={generatedHtml}
      pdfFilename={`فاتورة_طباعة_عقد_${task.contract_id}`}
    />
  );
}
