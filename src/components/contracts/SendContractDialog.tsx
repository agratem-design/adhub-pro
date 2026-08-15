import { useState, useEffect } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Share2, FileText } from "lucide-react";
import { openContractPDF } from "@/lib/contractPDFGenerator";

interface SendContractDialogProps {
  contractNumber: string;
  customerName: string;
  customerPhone?: string;
}

export function SendContractDialog({
  contractNumber,
  customerName,
  customerPhone,
}: SendContractDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState<'whatsapp' | 'whatsapp-web' | 'telegram'>('whatsapp');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sendPDF, setSendPDF] = useState(true);
  const [useInstallationImage, setUseInstallationImage] = useState(false);
  const [message, setMessage] = useState(
    `مرحباً ${customerName},\n\nنود إرسال تفاصيل العقد رقم ${contractNumber} إليك.\n\nشكراً لك.`
  );

  // تحديث رقم الهاتف عند تغيير customerPhone
  useEffect(() => {
    if (customerPhone) {
      setPhoneNumber(customerPhone);
    }
  }, [customerPhone]);

  const handleSend = async () => {
    if (!phoneNumber) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال رقم الهاتف",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // تنسيق رقم الهاتف (إزالة المسافات والرموز الخاصة)
      let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/[^\d+]/g, '');
      
      // إضافة +218 إذا لم يكن موجوداً
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('218')) {
          formattedPhone = '+' + formattedPhone;
        } else if (formattedPhone.startsWith('0')) {
          formattedPhone = '+218' + formattedPhone.substring(1);
        } else {
          formattedPhone = '+218' + formattedPhone;
        }
      }

      // إنشاء وعرض PDF إذا كان مطلوباً
      if (sendPDF) {
        try {
          // جلب بيانات العقد
          const contractNum = typeof contractNumber === 'string' ? parseInt(contractNumber) : contractNumber;
          const { data: contractData, error: contractError } = await supabase
            .from('Contract')
            .select('*, billboards(*)')
            .eq('Contract_Number', contractNum)
            .single();

          if (contractError) {
            console.error('Error fetching contract:', contractError);
            throw new Error('فشل في جلب بيانات العقد');
          }

          // تنسيق البيانات للمولد
          const startDate = (contractData as any)?.['Contract Date'] || '';
          const endDate = (contractData as any)?.['End Date'] || '';
          
          // حساب المدة
          let duration = '';
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            duration = `${days}`;
          }

          // تنسيق التاريخ بالعربية
          const formatArabicDate = (dateString: string): string => {
            if (!dateString) return '';
            const date = new Date(dateString);
            const arabicMonths = [
              'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
              'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
            ];
            const day = date.getDate();
            const month = arabicMonths[date.getMonth()];
            const year = date.getFullYear();
            return `${day} ${month} ${year}`;
          };

          const pdfData = {
            contractNumber: String(contractNumber),
            customerName: customerName,
            adType: (contractData as any)?.['Ad Type'] || 'عقد إيجار لوحات إعلانية',
            startDate: formatArabicDate(startDate),
            endDate: endDate ? formatArabicDate(endDate) : '',
            price: `${((contractData as any)?.Total || 0).toLocaleString('en-US')} د.ل`,
            duration: duration,
            year: startDate ? new Date(startDate).getFullYear().toString() : new Date().getFullYear().toString(),
            phoneNumber: phoneNumber,
            billboards: (contractData as any)?.billboards || [],
            useInstallationImage: useInstallationImage // استخدام صور التركيب الفعلية
          };

          // فتح PDF في نافذة جديدة
          const pdfWindow = await openContractPDF(pdfData);
          
          if (!pdfWindow) {
            throw new Error('فشل فتح نافذة PDF. يرجى السماح بالنوافذ المنبثقة.');
          }

          toast({
            title: "تم إنشاء PDF",
            description: "تم فتح PDF في نافذة جديدة. يمكنك طباعته أو حفظه.",
          });
        } catch (pdfError: any) {
          console.error('Error generating PDF:', pdfError);
          toast({
            title: "خطأ في إنشاء PDF",
            description: pdfError.message || "فشل إنشاء ملف PDF",
            variant: "destructive",
          });
          return; // إيقاف العملية إذا فشل إنشاء PDF
        }
      }

      // إرسال الرسالة
      const { data, error } = await supabase.functions.invoke('whatsapp-service', {
        body: {
          action: 'send',
          phone: formattedPhone,
          message: message
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "تم الإرسال بنجاح",
          description: `تم إرسال العقد رقم ${contractNumber} إلى ${customerName}`,
        });
        setOpen(false);
      } else {
        throw new Error(data.message || 'فشل الإرسال');
      }
    } catch (error: any) {
      console.error('Error sending contract:', error);
      toast({
        title: "خطأ في الإرسال",
        description: error.message || "تأكد من أن واتساب متصل",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          إرسال
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إرسال العقد</DialogTitle>
          <DialogDescription>
            اختر طريقة الإرسال وأدخل رقم الهاتف
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>طريقة الإرسال</Label>
            <RadioGroup
              value={platform}
              onValueChange={(value) => setPlatform(value as 'whatsapp' | 'whatsapp-web' | 'telegram')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="whatsapp" id="whatsapp" />
                <Label htmlFor="whatsapp" className="flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="h-4 w-4" />
                  واتساب
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="whatsapp-web" id="whatsapp-web" />
                <Label htmlFor="whatsapp-web" className="flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="h-4 w-4" />
                  واتساب ويب
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="telegram" id="telegram" />
                <Label htmlFor="telegram" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4" />
                  تليجرام
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input
              id="phone"
              placeholder="+218912345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
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

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="send-pdf" className="cursor-pointer">
                إرفاق ملف PDF للعقد
              </Label>
            </div>
            <Switch
              id="send-pdf"
              checked={sendPDF}
              onCheckedChange={setSendPDF}
            />
          </div>

          {sendPDF && (
            <>
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Label htmlFor="use-installation-image" className="cursor-pointer text-sm">
                    استخدام صور التركيب الفعلية بدلاً من الصور الافتراضية
                  </Label>
                </div>
                <Switch
                  id="use-installation-image"
                  checked={useInstallationImage}
                  onCheckedChange={setUseInstallationImage}
                />
              </div>
              
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <p>سيتم إنشاء وإرفاق ملف PDF يحتوي على:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>تفاصيل العقد الكاملة</li>
                  <li>معلومات اللوحات الإعلانية</li>
                  <li>جدول الأقساط والدفعات</li>
                  {useInstallationImage && (
                    <li className="text-primary font-medium">صور التركيب الفعلية للوحات</li>
                  )}
                </ul>
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSend} disabled={loading} className="flex-1">
              إرسال
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
