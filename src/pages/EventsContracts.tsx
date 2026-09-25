// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Plus,
  Search,
  PartyPopper,
  Pencil,
  Trash2,
  User,
  Filter,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  DollarSign,
  RefreshCw,
  ExternalLink,
  Printer,
} from 'lucide-react';
import {
  listEventContracts,
  getEventContract,
  deleteEventContract,
  EventContract,
} from '@/services/eventContractService';
import { toast } from 'sonner';
import { useSystemDialog } from '@/contexts/SystemDialogContext';

export default function EventsContracts() {
  const navigate = useNavigate();
  const { confirm } = useSystemDialog();
  const [items, setItems] = useState<EventContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = async () => {
    try {
      setLoading(true);
      const data = await listEventContracts();
      setItems(data);
    } catch (e: any) {
      toast.error('فشل تحميل عقود المناسبات: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [i.event_name, i.customer_name, i.event_contract_number, i.event_type]
        .map((v) => String(v || ''))
        .join(' ');
      return hay.includes(q);
    });
  }, [items, q, statusFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.status === 'active').length;
    const completed = items.filter((i) => i.status === 'completed').length;
    const totalAmount = items.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    return { total, active, completed, totalAmount };
  }, [items]);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'حذف عقد المناسبة',
      message: `هل أنت متأكد من حذف عقد المناسبة "${name}"؟`,
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteEventContract(id);
      toast.success('تم الحذف');
      load();
    } catch (e: any) {
      toast.error('فشل الحذف: ' + e.message);
    }
  };

  const printEventContract = async (id: string) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) { toast.error('اسمح بفتح النوافذ المنبثقة للطباعة'); return; }
    try {
      const { contract, billboards } = await getEventContract(id);
      const rows = billboards.map((b: any) => `<tr><td>${b.billboard_name || b.billboard_id}</td><td>${Number(b.daily_price || 0).toLocaleString('ar-LY')} د.ل</td><td>${Number(b.total_price || 0).toLocaleString('ar-LY')} د.ل</td></tr>`).join('');
      printWindow.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${contract.event_contract_number}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#1f2937}h1{color:#b8860b;margin-bottom:4px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#faf7ed;padding:16px;border-radius:8px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #d1d5db;padding:10px;text-align:right}th{background:#f5e9b8}.total{font-size:20px;font-weight:bold;text-align:left;margin-top:20px}</style></head><body><h1>عقد إيجار لوحات مناسبة</h1><div>رقم العقد: <strong>${contract.event_contract_number}</strong></div><div class="meta"><div>المناسبة: <strong>${contract.event_name}</strong></div><div>العميل: <strong>${contract.customer_name}</strong></div><div>من: <strong>${contract.start_date}</strong></div><div>إلى: <strong>${contract.end_date}</strong></div><div>نوع المناسبة: <strong>${contract.event_type || '—'}</strong></div></div><h2>اللوحات المؤجرة للمناسبة</h2><table><thead><tr><th>اللوحة</th><th>سعر اليوم</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table><div class="total">الإجمالي النهائي: ${Number(contract.total_amount || 0).toLocaleString('ar-LY')} د.ل</div><script>window.onload=function(){window.print()}</script></body></html>`);
      printWindow.document.close();
    } catch (e: any) { printWindow.close(); toast.error('تعذر تجهيز العقد للطباعة: ' + e.message); }
  };

  const statusBadge = (s: string) => {
    if (s === 'active')
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
          <CheckCircle className="h-3 w-3 ml-1" />
          نشط
        </Badge>
      );
    if (s === 'completed')
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
          <Clock className="h-3 w-3 ml-1" />
          مكتمل
        </Badge>
      );
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30">
        <XCircle className="h-3 w-3 ml-1" />
        ملغى
      </Badge>
    );
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <PartyPopper className="h-7 w-7 text-primary" />
            عقود المناسبات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة عقود إيجار اللوحات للمناسبات والفعاليات
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} disabled={loading} title="تحديث القائمة" className="cursor-pointer">
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
          <Button onClick={() => navigate('/admin/events-contracts/new')} className="gap-2 cursor-pointer">
            <Plus className="h-4 w-4" /> عقد مناسبة جديد
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">إجمالي العقود</p>
                <p className="text-2xl font-bold text-primary tabular-nums">{stats.total}</p>
              </div>
              <PartyPopper className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
          <Card className="border-border bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">نشطة</p>
                <p className="text-2xl font-bold text-emerald-600 tabular-nums">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500/40" />
            </div>
          </CardContent>
        </Card>
          <Card className="border-border bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">مكتملة</p>
                <p className="text-2xl font-bold text-blue-600 tabular-nums">{stats.completed}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">إجمالي المبالغ</p>
                <p className="text-xl font-bold text-amber-600 tabular-nums">
                  {stats.totalAmount.toLocaleString('en-US')}
                </p>
                <p className="text-[10px] text-muted-foreground">د.ل</p>
              </div>
              <DollarSign className="h-8 w-8 text-amber-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم العقد، اسم العميل أو المناسبة..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <Filter className="h-4 w-4 ml-2" />
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="cancelled">ملغى</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">جاري التحميل...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <PartyPopper className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا توجد عقود مناسبات بعد</p>
            <p className="text-xs mt-1">ابدأ بإنشاء عقد مناسبة جديد من الزر أعلاه</p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            العقود ({filtered.length})
          </h3>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}
          >
            {filtered.map((c) => (
              <Card
                key={c.id}
                className="hover:shadow-lg transition-all border-border hover:border-primary/40 overflow-hidden"
              >
                <div className="h-1 bg-primary" />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="text-primary border-primary/40 font-bold"
                    >
                      {c.event_contract_number}
                    </Badge>
                    {statusBadge(c.status)}
                  </div>
                  <CardTitle className="text-lg mt-2 truncate">{c.event_name}</CardTitle>
                  {c.event_type && (
                    <p className="text-xs text-muted-foreground">{c.event_type}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span className="text-foreground font-medium truncate">{c.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Calendar className="h-4 w-4" />
                    {c.start_date} ← {c.end_date}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>لوحات المناسبة</span>
                    <span className="font-semibold text-foreground">{Number((c as any).billboard_count || 0)} لوحة</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">الإجمالي</span>
                    <span className="text-lg font-bold text-primary tabular-nums">
                      {Number(c.total_amount).toLocaleString('en-US')} د.ل
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1"
                      onClick={() => navigate(`/admin/events-contracts/edit/${c.id}`)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> تعديل
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 cursor-pointer" onClick={() => navigate(`/admin/events-contracts/edit/${c.id}`)} title="فتح العقد">
                      <ExternalLink className="h-3.5 w-3.5" /> فتح
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 cursor-pointer" onClick={() => printEventContract(c.id)} title="طباعة العقد">
                      <Printer className="h-3.5 w-3.5" /> طباعة
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(c.id, c.event_name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
