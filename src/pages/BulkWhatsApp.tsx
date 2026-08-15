import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBulkWhatsApp, BulkRecipient } from '@/hooks/useBulkWhatsApp';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare, Send, Pause, Play, RotateCcw, CheckCircle2,
  XCircle, Loader2, Clock, Wifi, WifiOff, Users, Search
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
}

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  sending: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
  sent: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
};

const BulkWhatsApp = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState(
    'مرحباً {اسم_العميل},\n\nنود إعلامك بآخر المستجدات.\n\nشكراً لتعاملكم معنا.'
  );
  const [connected, setConnected] = useState<boolean | null>(null);

  const { checkConnection } = useSendWhatsApp();
  const bulk = useBulkWhatsApp();

  // Load customers
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone, company')
        .order('name');
      if (data) setCustomers(data);
    })();
  }, []);

  // Check WhatsApp connection
  useEffect(() => {
    checkConnection().then(setConnected);
  }, []);

  const filteredCustomers = customers.filter(c =>
    c.name?.includes(searchQuery) || c.phone?.includes(searchQuery) || c.company?.includes(searchQuery)
  );

  const toggleCustomer = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const withPhone = filteredCustomers.filter(c => c.phone?.trim());
    if (selectedIds.size === withPhone.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(withPhone.map(c => c.id)));
    }
  };

  const handleStartSending = () => {
    const selected = customers.filter(c => selectedIds.has(c.id));
    const recipients: BulkRecipient[] = selected.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone || '',
      status: 'pending',
    }));
    bulk.setRecipients(recipients);
    setTimeout(() => bulk.startSending(message), 100);
  };

  const progressPercent = bulk.progress.total > 0
    ? Math.round(((bulk.progress.sent + bulk.progress.failed) / bulk.progress.total) * 100)
    : 0;

  return (
    <div className="space-y-6 p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">إرسال رسائل واتساب جماعية</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? 'default' : 'destructive'} className="gap-1.5">
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected === null ? 'جاري الفحص...' : connected ? 'واتساب متصل' : 'غير متصل'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => checkConnection().then(setConnected)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Connection Guide - shown when disconnected */}
      {connected === false && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <WifiOff className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-3">
                <h3 className="font-bold text-lg text-destructive">واتساب غير متصل</h3>
                <p className="text-sm text-muted-foreground">
                  لإرسال الرسائل الجماعية، يجب أن يكون خادم WhatsApp Bridge قيد التشغيل ومتصل بحسابك.
                </p>
                <div className="bg-background rounded-lg p-4 border space-y-3">
                  <h4 className="font-semibold text-sm">خطوات الاتصال:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>تأكد من تشغيل خادم WhatsApp Bridge المحلي <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">node WhatsApp/index.ts</code></li>
                    <li>افتح <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">http://localhost:3001</code> في المتصفح</li>
                    <li>امسح رمز QR بتطبيق واتساب على هاتفك <span className="text-foreground">(الأجهزة المرتبطة → ربط جهاز)</span></li>
                    <li>بعد نجاح الاتصال، اضغط زر "إعادة الفحص" أعلاه</li>
                  </ol>
                </div>
                <p className="text-xs text-muted-foreground">
 بدلاً من ذلك، يمكنك استخدام <strong>الإرسال اليدوي</strong> من صفحة "تذكيرات المستحقات" التي تفتح واتساب مباشرة.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Customer Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              اختيار العملاء ({selectedIds.size} محدد)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو رقم الهاتف..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedIds.size === filteredCustomers.filter(c => c.phone?.trim()).length
                  ? 'إلغاء تحديد الكل'
                  : 'تحديد الكل (بأرقام هواتف)'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {filteredCustomers.filter(c => c.phone?.trim()).length} عميل لديه رقم هاتف
              </span>
            </div>

            <ScrollArea className="h-[350px] rounded-md border p-2">
              {filteredCustomers.map(c => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.has(c.id)}
                    onCheckedChange={() => toggleCustomer(c.id)}
                    disabled={!c.phone?.trim()}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {c.phone || 'بدون رقم هاتف'}
                    </p>
                  </div>
                  {!c.phone?.trim() && (
                    <Badge variant="outline" className="text-xs">بدون رقم</Badge>
                  )}
                </label>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Message & Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">نص الرسالة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={6}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="اكتب الرسالة هنا..."
                disabled={bulk.isSending}
              />
              <div className="flex flex-wrap gap-2">
                <Label className="text-sm text-muted-foreground">المتغيرات المتاحة:</Label>
                {['{اسم_العميل}', '{رقم_العقد}', '{رقم_الهاتف}'].map(v => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary/20"
                    onClick={() => !bulk.isSending && setMessage(prev => prev + ' ' + v)}
                  >
                    {v}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Controls */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2">
                {!bulk.isSending ? (
                  <Button
                    className="flex-1"
                    onClick={handleStartSending}
                    disabled={selectedIds.size === 0 || !message.trim() || !connected}
                  >
                    <Send className="h-4 w-4 ml-2" />
                    إرسال لـ {selectedIds.size} عميل
                  </Button>
                ) : (
                  <>
                    {bulk.isPaused ? (
                      <Button className="flex-1" onClick={bulk.resumeSending}>
                        <Play className="h-4 w-4 ml-2" />
                        استئناف
                      </Button>
                    ) : (
                      <Button variant="outline" className="flex-1" onClick={bulk.pauseSending}>
                        <Pause className="h-4 w-4 ml-2" />
                        إيقاف مؤقت
                      </Button>
                    )}
                    <Button variant="destructive" onClick={bulk.resetAll}>
                      <RotateCcw className="h-4 w-4 ml-2" />
                      إلغاء
                    </Button>
                  </>
                )}
              </div>

              {bulk.recipients.length > 0 && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>التقدم: {bulk.progress.sent + bulk.progress.failed} / {bulk.progress.total}</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} />
                    <div className="flex gap-4 text-sm">
 <span className="text-green-600"> تم: {bulk.progress.sent}</span>
 <span className="text-destructive"> فشل: {bulk.progress.failed}</span>
                    </div>
                  </div>

                  <ScrollArea className="h-[250px] rounded-md border">
                    {bulk.recipients.map((r, i) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0"
                      >
                        {statusIcon[r.status]}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                          <p className="text-xs text-muted-foreground" dir="ltr">{r.phone}</p>
                        </div>
                        {r.error && (
                          <span className="text-xs text-destructive">{r.error}</span>
                        )}
                      </div>
                    ))}
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BulkWhatsApp;
