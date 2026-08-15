import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SendTextlyMessageParams {
  phone: string;
  message: string;
}

interface SendTextlyDocumentParams {
  phone: string;
  caption: string;
  fileName: string;
  mimeType: string;
  base64Content: string;
}

export function useSendTextly() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const formatPhoneNumber = (phone: string): string => {
    // Textly expects local format like 0912345678 (no + or country code)
    let digits = phone.replace(/\D/g, '');

    // Strip Libya country code if present
    if (digits.startsWith('218')) {
      digits = digits.slice(3);
    }

    // Ensure leading zero
    if (!digits.startsWith('0')) {
      digits = '0' + digits;
    }

    return digits;
  };

  const getApiKey = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('messaging_api_settings')
        .select('api_key')
        .eq('platform', 'textly')
        .eq('is_active', true)
        .single();

      if (error || !data?.api_key) {
        toast({
          title: "خطأ",
          description: "لم يتم تفعيل Textly API أو لم يتم إدخال مفتاح API",
          variant: "destructive",
        });
        return null;
      }

      return data.api_key;
    } catch (error) {
      console.error('Error fetching Textly API key:', error);
      return null;
    }
  };

  const sendMessage = async ({ phone, message }: SendTextlyMessageParams): Promise<boolean> => {
    if (!phone || !message) {
      toast({
        title: "خطأ",
        description: "رقم الهاتف والرسالة مطلوبان",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    try {
      const apiKey = await getApiKey();
      if (!apiKey) return false;

      const formattedPhone = formatPhoneNumber(phone);
      
      console.log('Sending to Textly:', { phone: formattedPhone, messageLength: message.length });

      const response = await fetch('https://api.textly.ly/api/v1/client/whatsapp/send_plain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          target_numbers: [formattedPhone],
          content: message,
          wait_for_send: false,
        }),
      });

      const responseData = await response.text();
      console.log('Textly response:', response.status, responseData);

      if (!response.ok) {
        throw new Error(`فشل الإرسال: ${response.status} - ${responseData}`);
      }

      toast({
        title: "تم الإرسال بنجاح",
        description: "تم إرسال الرسالة عبر واتساب",
      });
      return true;
    } catch (error: any) {
      console.error('Error sending Textly message:', error);
      toast({
        title: "خطأ في الإرسال",
        description: error.message || "تأكد من صحة إعدادات Textly API",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const sendDocument = async ({
    phone,
    caption,
    fileName,
    mimeType,
    base64Content,
  }: SendTextlyDocumentParams): Promise<boolean> => {
    if (!phone || !base64Content) {
      toast({
        title: "خطأ",
        description: "رقم الهاتف والملف مطلوبان",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    try {
      const apiKey = await getApiKey();
      if (!apiKey) return false;

      const formattedPhone = formatPhoneNumber(phone);

      console.log('Sending Textly document:', {
        phone: formattedPhone,
        captionLength: (caption || '').length,
        fileName,
        mimeType,
        base64Size: base64Content.length,
      });

      const response = await fetch('https://api.textly.ly/api/v1/client/whatsapp/send_document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          target_numbers: [formattedPhone],
          caption: caption ?? '',
          file_name: fileName,
          mime_type: mimeType,
          mimeType: mimeType, // keep both keys for compatibility
          base64_content: base64Content,
          wait_for_send: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Textly API error:', errorText);
        throw new Error(`فشل إرسال المستند: ${response.status} - ${errorText}`);
      }

      toast({
        title: "تم الإرسال بنجاح",
        description: "تم إرسال المستند عبر واتساب",
      });
      return true;
    } catch (error: any) {
      console.error('Error sending Textly document:', error);
      toast({
        title: "خطأ في الإرسال",
        description: error.message || "تأكد من صحة إعدادات Textly API",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    sendMessage,
    sendDocument,
    loading,
  };
}
