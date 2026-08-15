import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2 } from "lucide-react";
import { useSendWhatsApp } from "@/hooks/useSendWhatsApp";

interface SendInvoiceWhatsAppProps {
  customerName: string;
  customerPhone?: string;
  invoiceNumber: string;
  invoiceType: 'invoice' | 'quote';
}

export function SendInvoiceWhatsApp({
  customerName,
  customerPhone,
  invoiceNumber,
  invoiceType
}: SendInvoiceWhatsAppProps) {
  const { sendMessage, loading } = useSendWhatsApp();
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(customerPhone || '');
  const [message, setMessage] = useState(
    invoiceType === 'invoice'
      ? `مرحباً ${customerName},\n\nنود إرسال تفاصيل الفاتورة رقم ${invoiceNumber} إليك.\n\nشكراً لك.`
      : `مرحباً ${customerName},\n\nنود إرسال تفاصيل عرض السعر رقم ${invoiceNumber} إليك.\n\nشكراً لك.`
  );

  const handleSend = async () => {
    const success = await sendMessage({
      phone: phoneNumber,
      message: message
    });

    if (success) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          إرسال عبر واتساب
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            إرسال {invoiceType === 'invoice' ? 'الفاتورة' : 'عرض السعر'} عبر واتساب
          </DialogTitle>
          <DialogDescription>
            أدخل رقم الهاتف وعدل الرسالة إذا لزم الأمر
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input
              id="phone"
              placeholder="+218912345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">الرسالة</Label>
            <Textarea
              id="message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleSend} 
              disabled={loading || !phoneNumber.trim()} 
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  إرسال
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="flex-1"
            >
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
