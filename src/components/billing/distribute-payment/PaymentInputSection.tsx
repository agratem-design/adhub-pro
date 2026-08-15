import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DollarSign, Upload, X, Loader2, Image as ImageIcon, ClipboardPaste, Plus, Banknote, FileText, Building2, CreditCard } from 'lucide-react';
import { uploadImage } from '@/services/imageUploadService';
import { toast } from 'sonner';

/** Parse transfer_image_url which can be a single URL string or JSON array */
export function parseImageUrls(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // not JSON — treat as single URL
  }
  return [raw];
}

/** Serialize image URLs array back to storage format */
export function serializeImageUrls(urls: string[]): string {
  if (urls.length === 0) return '';
  if (urls.length === 1) return urls[0];
  return JSON.stringify(urls);
}

interface PaymentInputSectionProps {
  totalAmount: string;
  setTotalAmount: (v: string) => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  paymentDate: string;
  setPaymentDate: (v: string) => void;
  paymentReference: string;
  setPaymentReference: (v: string) => void;
  paymentNotes: string;
  setPaymentNotes: (v: string) => void;
  sourceBank: string;
  setSourceBank: (v: string) => void;
  destinationBank: string;
  setDestinationBank: (v: string) => void;
  transferReference: string;
  setTransferReference: (v: string) => void;
  transferImageUrl: string;
  setTransferImageUrl: (v: string) => void;
  customerName?: string;
  contractIds?: (number | string)[];
}

export function PaymentInputSection({
  totalAmount, setTotalAmount,
  paymentMethod, setPaymentMethod,
  paymentDate, setPaymentDate,
  paymentReference, setPaymentReference,
  paymentNotes, setPaymentNotes,
  sourceBank, setSourceBank,
  destinationBank, setDestinationBank,
  transferReference, setTransferReference,
  transferImageUrl, setTransferImageUrl,
  customerName, contractIds,
}: PaymentInputSectionProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse current URLs from the serialized string
  const imageUrls = parseImageUrls(transferImageUrl);

  const updateUrls = (urls: string[]) => {
    setTransferImageUrl(serializeImageUrls(urls));
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة');
      return;
    }
    setUploading(true);
    try {
      const namePart = customerName ? `_${customerName}` : '';
      const contractPart = contractIds && contractIds.length > 0 ? `_عقد_${contractIds.join('-')}` : '';
      const url = await uploadImage(file, `وصل${namePart}${contractPart}_${Date.now()}`, 'payment-receipts');
      updateUrls([...imageUrls, url]);
      toast.success('تم رفع صورة الإيصال بنجاح');
    } catch (error) {
      console.error('Error uploading transfer image:', error);
      toast.error('فشل رفع الصورة');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        toast.error('المتصفح لا يدعم الوصول للحافظة أو يتطلب اتصالاً آمناً (HTTPS)');
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `clipboard-${Date.now()}.png`, { type: imageType });
          await handleFileUpload(file);
          return;
        }
      }
      toast.error('لا توجد صورة في الحافظة');
    } catch (error) {
      console.error('Clipboard paste error:', error);
      toast.error('تعذر الوصول للحافظة - يرجى السماح بالإذن');
    }
  };

  const removeImage = (index: number) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);
    updateUrls(newUrls);
  };

  // Listen for paste events globally
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (uploading) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleFileUpload(file);
          return;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [uploading, imageUrls]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" />
          المبلغ الكلي <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="أدخل المبلغ"
            className="text-base font-semibold text-right h-10 pr-3 pl-10 bg-background/80"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-accent/50 px-1.5 py-0.5 rounded">
            د.ل
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">طريقة الدفع</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="h-9 bg-background/80 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="نقدي">
                <span className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-500" />
                  نقدي
                </span>
              </SelectItem>
              <SelectItem value="شيك">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  شيك
                </span>
              </SelectItem>
              <SelectItem value="تحويل بنكي">
                <span className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-500" />
                  تحويل بنكي
                </span>
              </SelectItem>
              <SelectItem value="بطاقة ائتمان">
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-500" />
                  بطاقة ائتمان
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">التاريخ</Label>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="h-9 bg-background/80 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">المرجع / رقم الشيك</Label>
        <Input
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          placeholder="اختياري"
          className="h-9 bg-background/80 text-xs"
        />
      </div>

      {paymentMethod === 'تحويل بنكي' && (
        <div className="space-y-2 p-2.5 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-blue-700 dark:text-blue-400">المصرف المحول منه</Label>
            <Input value={sourceBank} onChange={(e) => setSourceBank(e.target.value)} placeholder="مصرف الجمهورية" className="h-8 bg-background text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-blue-700 dark:text-blue-400">المصرف المحول إليه</Label>
            <Input value={destinationBank} onChange={(e) => setDestinationBank(e.target.value)} placeholder="مصرف التجارة" className="h-8 bg-background text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-blue-700 dark:text-blue-400">رقم العملية</Label>
            <Input value={transferReference} onChange={(e) => setTransferReference(e.target.value)} placeholder="رقم إيصال التحويل" className="h-8 bg-background text-xs" />
          </div>
        </div>
      )}

      {/* صورة إيصال الدفع - تظهر دائماً */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold flex items-center gap-1">
          <ImageIcon className="h-3.5 w-3.5 text-primary" />
          صورة إيصال الدفع
        </Label>
        
        {/* عرض الصور المرفوعة */}
        {imageUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {imageUrls.map((url, index) => (
              <div key={index} className="relative group">
                <img
                  src={url}
                  alt={`إيصال الدفع ${index + 1}`}
                  className="w-full max-h-28 object-contain rounded-md border border-border bg-background"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 left-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeImage(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* أزرار الرفع */}
        <div className="flex gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs border-dashed"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-3 w-3 ml-1 animate-spin" />
                جاري الرفع...
              </>
            ) : (
              <>
                {imageUrls.length > 0 ? <Plus className="h-3 w-3 ml-1" /> : <Upload className="h-3 w-3 ml-1" />}
                {imageUrls.length > 0 ? 'إضافة صورة' : 'رفع صورة'}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs border-dashed"
            onClick={handlePasteFromClipboard}
            disabled={uploading}
            title="لصق من الحافظة (Ctrl+V)"
          >
            <ClipboardPaste className="h-3 w-3 ml-1" />
            لصق
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">ملاحظات</Label>
        <Input
          value={paymentNotes}
          onChange={(e) => setPaymentNotes(e.target.value)}
          placeholder="اختياري"
          className="h-9 bg-background/80 text-xs"
        />
      </div>
    </div>
  );
}
