import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, FileText, CreditCard, Printer, Layers, Wrench,
  Plus, Pencil, Trash2, Clock, Loader2, Search, RefreshCw,
  ChevronLeft, ChevronRight, Filter, ArrowRight, MapPin, Ruler, Image,
} from 'lucide-react';
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
  installation_item: { icon: Wrench, label: 'تركيب لوحة', color: 'text-cyan-600 dark:text-cyan-400' },
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  receipt: 'إيصال',
  invoice: 'فاتورة',
  distributed: 'دفعة موزعة',
  advance: 'سلفة',
  refund: 'استرداد',
  purchase_invoice: 'فاتورة مشتريات',
};

const MONEY_FIELDS = [
  'amount', 'total', 'total_rent', 'discount', 'customer_total', 'company_total',
  'install_cost', 'print_cost', 'installation_cost', 'print_cost',
  'customer_installation_cost', 'company_installation_cost', 'company_additional_cost',
  'customer_cutout_cost', 'company_cutout_cost', 'company_install_cost', 'company_print_cost',
  'net_profit', 'paid_amount',
];

const IMAGE_FIELDS = ['installed_image_a', 'installed_image_b', 'design_a', 'design_b'];

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
    + ' ' + d.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' });
}

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
  return formatDateTime(dateStr);
}

function formatChangeValue(field: string, value: any): string {
  if (value === null || value === undefined) return '-';
  if (MONEY_FIELDS.includes(field)) {
    return formatAmount(Number(value)) + ' د.ل';
  }
  return String(value);
}

function isImageUrl(value: any): boolean {
  if (typeof value !== 'string') return false;
  return value.startsWith('http') && (value.includes('.jpg') || value.includes('.jpeg') || value.includes('.png') || value.includes('.webp') || value.includes('supabase') || value.includes('imgbb'));
}

function ChangesList({ changes }: { changes: ChangeItem[] }) {
  if (!changes || changes.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 border-r-2 border-primary/20 pr-3 mr-1">
      {changes.map((change, idx) => (
        <div key={idx} className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-foreground/70">{change.label}:</span>
            {change.field === 'billboards_added' ? (
              <span className="text-emerald-600 dark:text-emerald-400">+ {change.new}</span>
            ) : change.field === 'billboards_removed' ? (
              <span className="text-red-500">- {change.old}</span>
            ) : IMAGE_FIELDS.includes(change.field) ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Image className="h-3 w-3" />
                تم إضافة صورة
              </span>
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
          {/* صورة مصغرة */}
          {IMAGE_FIELDS.includes(change.field) && isImageUrl(change.new) && (
            <a href={change.new} target="_blank" rel="noopener noreferrer" className="inline-block mt-1">
              <img src={change.new} alt={change.label} className="h-12 w-12 rounded-md object-cover border border-border hover:opacity-80 transition-opacity" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function BillboardDetails({ details }: { details: any }) {
  if (!details?.billboard_name && !details?.billboard_size && !details?.nearest_landmark) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground mt-1">
      {details.billboard_name && (
        <span className="inline-flex items-center gap-0.5 font-medium text-foreground/60">
          {details.billboard_name}
        </span>
      )}
      {details.billboard_size && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5">
          <Ruler className="h-2.5 w-2.5" />
          {details.billboard_size}
        </Badge>
      )}
      {details.nearest_landmark && (
        <span className="inline-flex items-center gap-0.5">
          <MapPin className="h-2.5 w-2.5" />
          {details.nearest_landmark}
        </span>
      )}
    </div>
  );
}

const PAGE_SIZE = 50;

export default function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  useEffect(() => {
    loadEntries();
  }, [page, actionFilter, entityFilter]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('activity_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) {
        console.error('Error loading activity log:', error);
        return;
      }
      setEntries(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) return entries;
    const term = searchTerm.toLowerCase();
    return entries.filter(e =>
      e.description.toLowerCase().includes(term) ||
      e.customer_name?.toLowerCase().includes(term) ||
      e.contract_number?.toString().includes(term) ||
      e.ad_type?.toLowerCase().includes(term)
    );
  }, [entries, searchTerm]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">سجل النشاطات</h1>
            <p className="text-sm text-muted-foreground">جميع الحركات والتعديلات في النظام</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {totalCount} حركة
          </Badge>
          <Button variant="outline" size="sm" onClick={() => { setPage(0); loadEntries(); }}>
            <RefreshCw className="h-4 w-4 ml-1" />
            تحديث
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث في الحركات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="نوع الحدث" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="create">إنشاء</SelectItem>
                  <SelectItem value="update">تعديل</SelectItem>
                  <SelectItem value="delete">حذف</SelectItem>
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="نوع الكيان" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="contract">عقود</SelectItem>
                  <SelectItem value="payment">دفعات</SelectItem>
                  <SelectItem value="sales_invoice">فواتير مبيعات</SelectItem>
                  <SelectItem value="printed_invoice">فواتير طباعة</SelectItem>
                  <SelectItem value="composite_task">مهام مجمعة</SelectItem>
                  <SelectItem value="installation_item">تركيب لوحات</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity List */}
      <Card className="border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>جاري تحميل السجل...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Activity className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-lg font-medium">لا توجد حركات</p>
              <p className="text-sm">لم يتم تسجيل أي نشاط بعد</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredEntries.map((entry) => {
                const actionCfg = ACTION_CONFIG[entry.action] || ACTION_CONFIG.update;
                const entityCfg = ENTITY_CONFIG[entry.entity_type] || ENTITY_CONFIG.contract;
                const ActionIcon = actionCfg.icon;
                const EntityIcon = entityCfg.icon;
                const changes: ChangeItem[] = entry.details?.changes || [];

                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors"
                  >
                    {/* Action icon */}
                    <div className={`mt-0.5 p-2 rounded-lg border ${actionCfg.color} shrink-0`}>
                      <ActionIcon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <EntityIcon className={`h-4 w-4 ${entityCfg.color} shrink-0`} />
                        <span className="font-medium text-sm">
                          {entry.description}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                          {actionCfg.label}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                          {entityCfg.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                        {entry.contract_number && (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            عقد #{entry.contract_number}
                          </span>
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
                          <span>{entry.customer_name}</span>
                        )}
                        {!changes.length && entry.details?.amount && (
                          <span className="font-medium text-primary">
                            {formatAmount(entry.details.amount)} د.ل
                          </span>
                        )}
                        {!changes.length && entry.details?.total && (
                          <span className="font-medium text-primary">
                            {formatAmount(entry.details.total)} د.ل
                          </span>
                        )}
                        {entry.details?.distributed_payment_id && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-500/30 text-orange-600 dark:text-orange-400">
                            دفعة موزعة
                          </Badge>
                        )}
                        {entry.details?.notes && entry.details.distributed_payment_id && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {entry.details.notes}
                          </span>
                        )}
                      </div>

                      {/* تفاصيل اللوحة */}
                      <BillboardDetails details={entry.details} />

                      {/* التغييرات التفصيلية */}
                      {changes.length > 0 && <ChangesList changes={changes} />}
                    </div>

                    {/* Time */}
                    <div className="flex flex-col items-end gap-0.5 shrink-0 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{timeAgo(entry.created_at)}</span>
                      </div>
                      <span className="text-[10px]">{formatDateTime(entry.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                صفحة {page + 1} من {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                  السابق
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  التالي
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
