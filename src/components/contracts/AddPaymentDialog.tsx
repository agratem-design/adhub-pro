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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign } from "lucide-react";

interface AddPaymentDialogProps {
  contractNumber: string;
  customerName: string;
  customerId?: string;
  onPaymentAdded?: () => void;
}

export function AddPaymentDialog({
  contractNumber,
  customerName,
  customerId,
  onPaymentAdded,
}: AddPaymentDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("نقدي");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال مبلغ صحيح",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("customer_payments").insert({
        contract_number: parseInt(contractNumber),
        customer_id: customerId,
        customer_name: customerName,
        amount: parseFloat(amount),
        method,
        reference: reference || null,
        notes: notes || null,
        entry_type: "receipt",
        paid_at: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: "نجح",
        description: "تم إضافة الدفعة بنجاح",
      });

      // Reset form
      setAmount("");
      setMethod("نقدي");
      setReference("");
      setNotes("");
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setOpen(false);

      if (onPaymentAdded) {
        onPaymentAdded();
      }
    } catch (error: any) {
      console.error("Error adding payment:", error);
      toast({
        title: "خطأ",
        description: "فشل إضافة الدفعة",
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
          <DollarSign className="h-4 w-4 mr-2" />
          دفعة
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-primary">إضافة دفعة</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            إضافة دفعة جديدة للعقد {contractNumber} - {customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-foreground">المبلغ (د.ل)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method" className="text-foreground">طريقة الدفع</Label>
            <select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="نقدي">نقدي</option>
              <option value="شيك">شيك</option>
              <option value="تحويل بنكي">تحويل بنكي</option>
              <option value="بطاقة">بطاقة</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference" className="text-foreground">رقم المرجع (اختياري)</Label>
            <Input
              id="reference"
              placeholder="رقم الشيك أو التحويل"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-foreground">ملاحظات (اختياري)</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="أي ملاحظات إضافية"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate" className="text-foreground">تاريخ الدفعة</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="bg-input border-border text-foreground"
            />
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button 
              onClick={handleSubmit} 
              disabled={loading} 
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "جاري الحفظ..." : "إضافة الدفعة"}
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
