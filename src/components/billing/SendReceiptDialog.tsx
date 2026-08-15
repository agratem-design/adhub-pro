import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { formatAmount } from '@/lib/formatUtils';
import { Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
import { useSendTextly } from '@/hooks/useSendTextly';
import { PaymentRow } from './BillingTypes';

interface SendReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentRow | null;
  customerName: string;
}

export function SendReceiptDialog({ open, onOpenChange, payment, customerName }: SendReceiptDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sendingMethod, setSendingMethod] = useState<'textly' | 'whatsapp'>('textly');
  const [additionalMessage, setAdditionalMessage] = useState('');
  
  const { sendMessage: sendWhatsApp, loading: whatsappLoading } = useSendWhatsApp();
  const { sendMessage: sendTextly, loading: textlyLoading } = useSendTextly();

  // تحميل رقم هاتف العميل
  useEffect(() => {
    const loadCustomerPhone = async () => {
      if (!payment?.customer_id) return;
      
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('phone')
          .eq('id', payment.customer_id)
          .single();
        
        if (!error && data?.phone) {
          setPhoneNumber(data.phone);
        }
      } catch (error) {
        console.error('Error loading customer phone:', error);
      }
    };

    if (open) {
      loadCustomerPhone();
    }
  }, [open, payment]);

  const formatReceiptMessage = () => {
    if (!payment) return '';

    const amount = Number(payment.amount) || 0;
    const contractNumber = payment.contract_number ? `رقم ${payment.contract_number}` : 'حساب عام';
    const paymentDate = payment.paid_at 
      ? new Date(payment.paid_at).toLocaleDateString('ar-LY')
      : new Date().toLocaleDateString('ar-LY');
    const paymentMethod = payment.method || 'نقدي';
    const reference = payment.reference ? `\nالمرجع: ${payment.reference}` : '';
    const notes = payment.notes ? `\nملاحظات: ${payment.notes}` : '';

    let message = `إيصال استلام دفعة\n`;
    message += `═══════════════\n\n`;
    message += `العميل: ${customerName}\n`;
    message += `العقد: ${contractNumber}\n`;
    message += `المبلغ المدفوع: ${formatAmount(amount)} د.ل\n`;
    message += `التاريخ: ${paymentDate}\n`;
    message += `طريقة الدفع: ${paymentMethod}`;
    message += reference;
    message += notes;

    if (additionalMessage) {
      message += `\n\n${additionalMessage}`;
    }

    message += `\n\n═══════════════\n`;
    message += `شكراً لثقتكم بنا`;

    return message;
  };

  const handleSend = async () => {
    if (!phoneNumber) {
      toast.error('الرجاء إدخال رقم الهاتف');
      return;
    }

    if (!payment) {
      toast.error('لا توجد بيانات إيصال');
      return;
    }

    const message = formatReceiptMessage();

    try {
      let success = false;

      if (sendingMethod === 'textly') {
        success = await sendTextly({ phone: phoneNumber, message });
      } else {
        success = await sendWhatsApp({ phone: phoneNumber, message });
      }

      if (success) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error sending receipt:', error);
      toast.error('فشل في إرسال الإيصال');
    }
  };

  const loading = whatsappLoading || textlyLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">إرسال الإيصال عبر واتساب</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* معلومات الإيصال */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">العميل:</span>
              <span>{customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">المبلغ:</span>
              <span className="text-green-600 font-bold">
                {formatAmount(Number(payment?.amount) || 0)} د.ل
              </span>
            </div>
            {payment?.contract_number && (
              <div className="flex justify-between">
                <span className="font-semibold">العقد:</span>
                <span>رقم {payment.contract_number}</span>
              </div>
            )}
          </div>

          {/* طريقة الإرسال */}
          <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
            <div>
              <Label className="text-base font-semibold mb-3 block">طريقة الإرسال</Label>
              <RadioGroup
                value={sendingMethod}
                onValueChange={(value) => setSendingMethod(value as 'textly' | 'whatsapp')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="textly" id="textly-receipt" />
                  <Label htmlFor="textly-receipt" className="cursor-pointer font-normal">
                    Textly API (موصى به)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="whatsapp" id="whatsapp-receipt" />
                  <Label htmlFor="whatsapp-receipt" className="cursor-pointer font-normal">
                    واتساب Web
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* رقم الهاتف */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-base font-semibold">
              رقم الهاتف
            </Label>
            <Input
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="0912345678 أو +218912345678"
              dir="ltr"
              className="text-lg"
            />
          </div>

          {/* رسالة إضافية */}
          <div className="space-y-2">
            <Label htmlFor="additional-message" className="text-base font-semibold">
              رسالة إضافية (اختياري)
            </Label>
            <Input
              id="additional-message"
              value={additionalMessage}
              onChange={(e) => setAdditionalMessage(e.target.value)}
              placeholder="أضف رسالة إضافية للعميل..."
              className="text-lg"
            />
          </div>

          {/* معاينة الرسالة */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">معاينة الرسالة</Label>
            <div className="p-4 bg-muted rounded-lg border max-h-[200px] overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-sans" dir="rtl">
                {formatReceiptMessage()}
              </pre>
            </div>
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSend}
              disabled={loading || !phoneNumber}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 ml-2" />
                  إرسال الآن
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
