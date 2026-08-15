import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  FileText, 
  CreditCard, 
  Printer, 
  Layers, 
  Plus, 
  Pencil, 
  Trash2, 
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAmount } from '@/lib/formatUtils';

interface ActivityLogEntry {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  contract_number: number | null;
  customer_name: string | null;
  ad_type: string | null;
  description: string;
  details: any;
}

interface ChangeItem {
  field: string;
  label: string;
  old?: any;
  new?: any;
}

const ACTION_CONFIG: Record<string, { icon: typeof Plus; label: string; color: string }> = {
  create: { icon: Plus, label: 'إنشاء', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  update: { icon: Pencil, label: 'تعديل', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  delete: { icon: Trash2, label: 'حذف', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' },
};

const ENTITY_CONFIG: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  contract: { icon: FileText, label: 'عقد', color: 'text-primary' },
  payment: { icon: CreditCard, label: 'دفعة', color: 'text-emerald-600 dark:text-emerald-400' },
  sales_invoice: { icon: FileText, label: 'فاتورة مبيعات', color: 'text-blue-600 dark:text-blue-400' },
  printed_invoice: { icon: Printer, label: 'فاتورة طباعة', color: 'text-violet-600 dark:text-violet-400' },
  composite_task: { icon: Layers, label: 'مهمة مجمعة', color: 'text-orange-600 dark:text-orange-400' },
  installation_item: { icon: Layers, label: 'تركيب لوحة', color: 'text-cyan-600 dark:text-cyan-400' },
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  receipt: 'إيصال',
  invoice: 'فاتورة',
  distributed: 'دفعة موزعة',
  advance: 'سلفة',
  refund: 'استرداد',
  purchase_invoice: 'فاتورة مشتريات',
};

const MONEY_FIELDS = ['amount', 'total', 'total_rent', 'discount', 'customer_total', 'company_total', 'install_cost', 'print_cost', 'installation_cost', 'print_cost'];

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (diffHrs < 24) return `منذ ${diffHrs} ساعة`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  return new Date(dateStr).toLocaleDateString('ar-LY');
}

function formatChangeValue(field: string, value: any): string {
  if (value === null || value === undefined) return '-';
  if (MONEY_FIELDS.includes(field)) {
    return formatAmount(Number(value)) + ' د.ل';
  }
  return String(value);
}

function ChangesList({ changes }: { changes: ChangeItem[] }) {
  if (!changes || changes.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-0.5 border-r-2 border-primary/20 pr-2 mr-1">
      {changes.map((change, idx) => (
        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground/70">{change.label}:</span>
          {change.field === 'billboards_added' ? (
            <span className="text-emerald-600 dark:text-emerald-400">+ {change.new}</span>
          ) : change.field === 'billboards_removed' ? (
            <span className="text-red-500">- {change.old}</span>
          ) : (
            <>
              {change.old !== undefined && change.old !== null && (
                <span className="text-red-500/70 line-through">{formatChangeValue(change.field, change.old)}</span>
              )}
              {change.old !== undefined && change.new !== undefined && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              )}
              {change.new !== undefined && change.new !== null && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatChangeValue(change.field, change.new)}</span>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function RecentActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    loadEntries();
    const interval = setInterval(loadEntries, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  const loadEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error loading activity log:', error);
        return;
      }
      setEntries(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-muted">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>جاري تحميل سجل النشاط...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) return null;

  const displayEntries = expanded ? entries : entries.slice(0, 5);

  return (
    <Card className="border-border bg-gradient-to-br from-muted/30 to-muted/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            آخر الأحداث
            <Badge variant="secondary" className="text-xs">
              {entries.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {entries.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setExpanded(!expanded);
                  if (!expanded && limit === 10) setLimit(30);
                }}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    أقل
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    المزيد
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className={expanded ? 'h-[400px]' : ''}>
          <div className="space-y-1.5">
            {displayEntries.map((entry) => {
              const actionCfg = ACTION_CONFIG[entry.action] || ACTION_CONFIG.update;
              const entityCfg = ENTITY_CONFIG[entry.entity_type] || ENTITY_CONFIG.contract;
              const ActionIcon = actionCfg.icon;
              const EntityIcon = entityCfg.icon;
              const changes: ChangeItem[] = entry.details?.changes || [];

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  {/* أيقونة الحدث */}
                  <div className={`mt-0.5 p-1.5 rounded-md border ${actionCfg.color} shrink-0`}>
                    <ActionIcon className="h-3.5 w-3.5" />
                  </div>

                  {/* المحتوى */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <EntityIcon className={`h-3.5 w-3.5 ${entityCfg.color} shrink-0`} />
                      <span className="text-sm font-medium truncate">
                        {entry.description}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {entry.contract_number && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          عقد #{entry.contract_number}
                        </Badge>
                      )}
                      {entry.ad_type && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                          {entry.ad_type}
                        </Badge>
                      )}
                      {entry.details?.entry_type && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {ENTRY_TYPE_LABELS[entry.details.entry_type] || entry.details.entry_type}
                        </Badge>
                      )}
                      {entry.customer_name && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {entry.customer_name}
                        </span>
                      )}
                      {!changes.length && entry.details?.amount && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {formatAmount(entry.details.amount)} د.ل
                        </Badge>
                      )}
                      {!changes.length && entry.details?.total && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {formatAmount(entry.details.total)} د.ل
                        </Badge>
                      )}
                      {entry.details?.distributed_payment_id && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-500/30 text-orange-600 dark:text-orange-400">
                          موزعة
                        </Badge>
                      )}
                    </div>

                    {/* عرض التغييرات التفصيلية */}
                    {changes.length > 0 && <ChangesList changes={changes} />}
                  </div>

                  {/* الوقت */}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    <Clock className="h-3 w-3" />
                    <span>{timeAgo(entry.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
