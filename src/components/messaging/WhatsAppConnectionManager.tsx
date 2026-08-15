import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, MessageSquare, QrCode, CheckCircle2, XCircle, Save, Send, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSendWhatsApp } from "@/hooks/useSendWhatsApp";

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

interface WhatsAppConnectionManagerProps {
  provider?: 'wppconnect' | 'whatsapp-web';
}

export function WhatsAppConnectionManager({ provider = 'wppconnect' }: WhatsAppConnectionManagerProps) {
  const { toast } = useToast();
  const { sendMessage, loading: sendingTest } = useSendWhatsApp();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [qrCode, setQrCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);

  const isWPPConnect = provider === 'wppconnect';
  const providerLabel = isWPPConnect ? 'WPPConnect' : 'WhatsApp Web.js';
  const bridgeField = isWPPConnect ? 'wppconnect_bridge_url' : 'whatsapp_bridge_url';

  const statusConfig = {
    disconnected: { color: "secondary", icon: XCircle, text: "غير متصل" },
    connecting: { color: "default", icon: Loader2, text: "جاري الاتصال..." },
    qr_ready: { color: "default", icon: QrCode, text: "امسح رمز QR" },
    connected: { color: "default", icon: CheckCircle2, text: "متصل" }
  };

  const checkConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-service', {
        body: { action: 'status' }
      });
      if (error) throw error;
      setStatus(data.connected ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const startConnection = async () => {
    setLoading(true);
    setStatus('connecting');
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-service', {
        body: { action: 'start' }
      });
      if (error) throw error;

      if (data.qrCode) {
        setQrCode(data.qrCode);
        setStatus('qr_ready');
        toast({ title: "رمز QR جاهز", description: "افتح واتساب على هاتفك وامسح الرمز" });
        
        const checkInterval = setInterval(async () => {
          const { data: statusData } = await supabase.functions.invoke('whatsapp-service', {
            body: { action: 'status' }
          });
          if (statusData?.connected) {
            setStatus('connected');
            setQrCode("");
            clearInterval(checkInterval);
            toast({ title: "تم الاتصال بنجاح", description: "واتساب جاهز للاستخدام" });
          }
        }, 3000);
        setTimeout(() => clearInterval(checkInterval), 120000);
      }
    } catch (error: any) {
      setStatus('disconnected');
      toast({ title: "خطأ في الاتصال", description: error.message || "تأكد من تشغيل الخادم المحلي", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      await supabase.functions.invoke('whatsapp-service', { body: { action: 'disconnect' } });
      setStatus('disconnected');
      setQrCode("");
      toast({ title: "تم قطع الاتصال", description: "تم فصل واتساب بنجاح" });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const loadBridgeUrl = async () => {
    try {
      const { data } = await supabase
        .from('messaging_settings')
        .select(`${bridgeField}`)
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();
      
      if (data && data[bridgeField]) {
        setBridgeUrl(data[bridgeField]);
      }
    } catch (error) {
      console.error('Error loading bridge URL:', error);
    }
  };

  const saveBridgeUrl = async () => {
    setSavingUrl(true);
    try {
      const { error } = await supabase
        .from('messaging_settings')
        .upsert({
          id: '00000000-0000-0000-0000-000000000001',
          [bridgeField]: bridgeUrl.trim(),
          updated_at: new Date().toISOString()
        } as any);

      if (error) throw error;
      toast({ title: "تم الحفظ", description: "تم حفظ رابط الجسر بنجاح" });
    } catch (error: any) {
      toast({ title: "خطأ في الحفظ", description: error.message, variant: "destructive" });
    } finally {
      setSavingUrl(false);
    }
  };

  const handleTestMessage = async () => {
    const testPhone = "0914148865";
 const testMessage = `مرحباً! هذه رسالة اختبار من نظام إدارة اللوحات الإعلانية.\n\nالمزود: ${providerLabel}\nالنظام يعمل بنجاح! `;
    const success = await sendMessage({ phone: testPhone, message: testMessage });
    if (success) {
 toast({ title: " نجح الاختبار", description: `تم إرسال رسالة تجريبية إلى ${testPhone}` });
    }
  };

  useEffect(() => {
    loadBridgeUrl();
    checkConnection();
  }, [provider]);

  const StatusIcon = statusConfig[status].icon;
  const ProviderIcon = isWPPConnect ? Zap : MessageSquare;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ProviderIcon className="h-5 w-5" />
              اتصال واتساب — {providerLabel}
            </CardTitle>
            <CardDescription>
              {isWPPConnect 
                ? 'اتصال عبر WPPConnect — أسرع وأكثر استقراراً من whatsapp-web.js'
                : 'قم بتوصيل واتساب لإرسال الرسائل تلقائياً'}
            </CardDescription>
          </div>
          <Badge variant={statusConfig[status].color as any} className="flex items-center gap-1">
            <StatusIcon className={`h-4 w-4 ${status === 'connecting' ? 'animate-spin' : ''}`} />
            {statusConfig[status].text}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bridge URL Configuration */}
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <ProviderIcon className="h-4 w-4 text-primary" />
            <h4 className="font-semibold">إعدادات الاتصال — {providerLabel}</h4>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`bridge-url-${provider}`}>رابط الجسر (Bridge URL)</Label>
            <div className="flex gap-2">
              <Input
                id={`bridge-url-${provider}`}
                type="url"
                placeholder="https://your-tunnel-url.loca.lt"
                value={bridgeUrl}
                onChange={(e) => setBridgeUrl(e.target.value)}
                className="flex-1"
                dir="ltr"
              />
              <Button onClick={saveBridgeUrl} disabled={savingUrl || !bridgeUrl.trim()} size="icon" variant="secondary">
                {savingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isWPPConnect 
                ? 'شغّل خادم WPPConnect محلياً (المنفذ 3002) ثم استخدم ngrok أو localtunnel'
                : 'أدخل الرابط العام من localtunnel أو ngrok (مثال: https://xxxx.loca.lt)'}
            </p>
          </div>
        </div>

        {isWPPConnect && (
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              مميزات WPPConnect
            </h4>
            <ul className="text-sm text-green-800 dark:text-green-200 space-y-1 list-disc list-inside">
              <li>أسرع في الاتصال وإرسال الرسائل</li>
              <li>أكثر استقراراً — أقل انقطاعات</li>
              <li>يدعم إرسال الصور والملفات</li>
              <li>مفتوح المصدر ومجاني بالكامل</li>
            </ul>
          </div>
        )}

        {status === 'disconnected' && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-semibold">خطوات الاتصال:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>تأكد من تشغيل خادم {providerLabel} المحلي</li>
                <li>اضغط على زر "بدء الاتصال"</li>
                <li>امسح رمز QR باستخدام واتساب على هاتفك</li>
                <li>انتظر حتى يتم الاتصال</li>
              </ol>
            </div>
            <Button onClick={startConnection} disabled={loading} className="w-full" size="lg">
              {loading ? (
                <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري الاتصال...</>
              ) : (
                <><ProviderIcon className="ml-2 h-4 w-4" />بدء الاتصال</>
              )}
            </Button>
          </div>
        )}

        {status === 'qr_ready' && qrCode && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg border">
              <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              <p className="mt-4 text-sm text-muted-foreground text-center">امسح هذا الرمز باستخدام واتساب على هاتفك</p>
            </div>
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-600 dark:text-blue-400">في انتظار المسح...</span>
            </div>
          </div>
        )}

        {status === 'connected' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="font-semibold text-green-600 dark:text-green-400">واتساب متصل ويعمل ({providerLabel})</p>
                <p className="text-sm text-green-600/80 dark:text-green-400/80">يمكنك الآن إرسال الرسائل والعقود تلقائياً</p>
              </div>
            </div>
            <Button onClick={handleTestMessage} disabled={sendingTest} variant="outline" className="w-full">
              {sendingTest ? (
                <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري الإرسال...</>
              ) : (
                <><Send className="ml-2 h-4 w-4" />إرسال رسالة تجريبية (0914148865)</>
              )}
            </Button>
            <Button onClick={disconnect} variant="destructive" className="w-full">
              <XCircle className="ml-2 h-4 w-4" />قطع الاتصال
            </Button>
          </div>
        )}

        {status === 'connecting' && (
          <div className="flex items-center justify-center p-8">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">جاري الاتصال...</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
