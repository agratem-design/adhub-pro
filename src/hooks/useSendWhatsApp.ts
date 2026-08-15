import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SendWhatsAppParams {
  phone: string;
  message: string;
}

export function useSendWhatsApp() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const formatPhoneNumber = (phone: string): string => {
    let formatted = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    
    if (!formatted.startsWith('+')) {
      if (formatted.startsWith('218')) {
        formatted = '+' + formatted;
      } else if (formatted.startsWith('0')) {
        formatted = '+218' + formatted.substring(1);
      } else {
        formatted = '+218' + formatted;
      }
    }
    
    return formatted;
  };

  const getActiveProvider = async (): Promise<string> => {
    try {
      const { data } = await supabase
        .from('messaging_settings')
        .select('whatsapp_provider')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();
      
      return data?.whatsapp_provider || 'wppconnect';
    } catch {
      return 'wppconnect';
    }
  };

  const sendViaTextly = async (phone: string, message: string): Promise<boolean> => {
    const { data: settings } = await supabase
      .from('messaging_api_settings')
      .select('api_key, is_active')
      .eq('platform', 'textly')
      .maybeSingle();

    if (!settings?.api_key || !settings?.is_active) {
      throw new Error('Textly API غير مفعل أو المفتاح غير موجود');
    }

    // Send via Textly API (through edge function to avoid CORS)
    const { data, error } = await supabase.functions.invoke('send-textly', {
      body: { phone, message, apiKey: settings.api_key }
    });

    if (error) throw error;
    return data?.success || false;
  };

  const sendMessage = async ({ phone, message }: SendWhatsAppParams): Promise<boolean> => {
    if (!phone || !message) {
      toast({ title: "خطأ", description: "رقم الهاتف والرسالة مطلوبان", variant: "destructive" });
      return false;
    }

    setLoading(true);
    try {
      // Ensure token is fresh before calling edge function
      await supabase.auth.getSession();
      const formattedPhone = formatPhoneNumber(phone);
      const provider = await getActiveProvider();

      if (provider === 'textly') {
        const success = await sendViaTextly(formattedPhone, message);
        if (success) {
          toast({ title: "تم الإرسال بنجاح", description: "تم إرسال الرسالة عبر Textly" });
        }
        return success;
      }

      // For wppconnect and whatsapp-web, use the same edge function
      const { data, error } = await supabase.functions.invoke('whatsapp-service', {
        body: { action: 'send', phone: formattedPhone, message }
      });

      if (error) throw error;

      if (data.success) {
        toast({ title: "تم الإرسال بنجاح", description: "تم إرسال الرسالة عبر واتساب" });
        return true;
      } else {
        throw new Error(data.message || 'فشل الإرسال');
      }
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error);
      const detail = (error?.context && (error.context.message || error.context.error || error.context.details)) || error?.message;
      toast({ title: "خطأ في الإرسال", description: detail || "تأكد من أن واتساب متصل", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-service', {
        body: { action: 'status' }
      });
      if (error) throw error;
      return data.connected || false;
    } catch (error) {
      console.error('Error checking WhatsApp connection:', error);
      return false;
    }
  };

  return { sendMessage, checkConnection, loading };
}
