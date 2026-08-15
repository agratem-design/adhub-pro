import { Button } from '@/components/ui/button';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Trash2, 
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  Calendar,
  Hash,
  FileText,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface GeneralTransaction {
  id: string;
  paid_at: string;
  amount: number;
  entry_type: 'general_debit' | 'general_credit';
  notes: string | null;
  reference: string | null;
  method: string | null;
}

interface GeneralTransactionsSectionProps {
  transactions: GeneralTransaction[];
  onAddDebit: () => void;
  onAddCredit: () => void;
  onRefresh: () => void;
}

export default function GeneralTransactionsSection({
  transactions,
  onAddDebit,
  onAddCredit,
  onRefresh
}: GeneralTransactionsSectionProps) {
  
  const { confirm: systemConfirm } = useSystemDialog();
  const debits = transactions.filter(t => t.entry_type === 'general_debit');
  const credits = transactions.filter(t => t.entry_type === 'general_credit');
  
  const totalDebits = debits.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalCredits = credits.reduce((sum, t) => sum + Number(t.amount), 0);
  const netBalance = totalDebits - totalCredits;
  
  const handleDelete = async (id: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذه المعاملة؟', variant: 'destructive', confirmText: 'حذف' })) return;
    
    try {
      const { error } = await supabase
        .from('customer_payments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('تم حذف المعاملة بنجاح');
      onRefresh();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('فشل حذف المعاملة');
    }
  };
  
  return (
    <div className="space-y-6">
      {/* ملخص الواردات والصادرات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* إجمالي الواردات */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-red-500/20 via-red-500/10 to-transparent border border-red-500/30 p-5 shadow-lg shadow-red-500/5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-red-500/20 shadow-inner">
                <ArrowUpCircle className="h-5 w-5 text-red-400" />
              </div>
              <span className="text-sm font-medium text-red-300">إجمالي الواردات</span>
            </div>
            <div className="text-3xl font-bold text-red-400 mb-1">
              {totalDebits.toLocaleString('en-US')}
              <span className="text-sm font-normal text-red-300/70 mr-1">د.ل</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {debits.length} معاملة
            </p>
          </div>
        </div>
        
        {/* إجمالي الصادرات */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent border border-green-500/30 p-5 shadow-lg shadow-green-500/5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-green-500/20 shadow-inner">
                <ArrowDownCircle className="h-5 w-5 text-green-400" />
              </div>
              <span className="text-sm font-medium text-green-300">إجمالي الصادرات</span>
            </div>
            <div className="text-3xl font-bold text-green-400 mb-1">
              {totalCredits.toLocaleString('en-US')}
              <span className="text-sm font-normal text-green-300/70 mr-1">د.ل</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {credits.length} معاملة
            </p>
          </div>
        </div>
        
        {/* الصافي */}
        <div className={`relative overflow-hidden rounded-xl p-5 shadow-lg ${
          netBalance > 0 
            ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/30 shadow-amber-500/5' 
            : 'bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent border-blue-500/30 shadow-blue-500/5'
        } border`}>
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 ${
            netBalance > 0 ? 'bg-amber-500/10' : 'bg-blue-500/10'
          }`} />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 rounded-xl shadow-inner ${
                netBalance > 0 ? 'bg-amber-500/20' : 'bg-blue-500/20'
              }`}>
                <Wallet className={`h-5 w-5 ${netBalance > 0 ? 'text-amber-400' : 'text-blue-400'}`} />
              </div>
              <span className={`text-sm font-medium ${netBalance > 0 ? 'text-amber-300' : 'text-blue-300'}`}>
                الصافي
              </span>
            </div>
            <div className={`text-3xl font-bold mb-1 ${netBalance > 0 ? 'text-amber-400' : 'text-blue-400'}`}>
              {Math.abs(netBalance).toLocaleString('en-US')}
              <span className={`text-sm font-normal mr-1 ${netBalance > 0 ? 'text-amber-300/70' : 'text-blue-300/70'}`}>
                د.ل
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {netBalance > 0 ? 'مستحق للعميل' : netBalance < 0 ? 'مستحق من العميل' : 'متوازن'}
            </p>
          </div>
        </div>
      </div>
      
      {/* أزرار الإضافة */}
      <div className="flex gap-3">
        <Button
          onClick={onAddDebit}
          className="flex-1 h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/20"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة وارد عام
        </Button>
        <Button
          onClick={onAddCredit}
          className="flex-1 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/20"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة صادر عام
        </Button>
      </div>
      
      {/* قائمة الواردات */}
      {debits.length > 0 && (
        <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent overflow-hidden">
          <CardHeader className="border-b border-red-500/10 bg-red-500/5">
            <CardTitle className="text-lg flex items-center gap-3 text-red-400">
              <div className="p-2 rounded-lg bg-red-500/20">
                <TrendingUp className="h-5 w-5" />
              </div>
              الواردات العامة
              <Badge className="bg-red-500/20 text-red-300 border-0 mr-auto">
                {debits.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {debits.map(transaction => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 bg-card/50 rounded-xl border border-red-500/10 hover:border-red-500/30 transition-all hover:shadow-lg hover:shadow-red-500/5"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        وارد عام
                      </Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(transaction.paid_at).toLocaleDateString('ar-LY')}
                      </span>
                    </div>
                    <div className="text-sm text-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {transaction.notes || 'بدون ملاحظات'}
                    </div>
                    {transaction.reference && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        المرجع: {transaction.reference}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className="text-xl font-bold text-red-400">
                        {Number(transaction.amount).toLocaleString('en-US')}
                        <span className="text-sm font-normal text-red-300/70 mr-1">د.ل</span>
                      </div>
                      {transaction.method && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {transaction.method}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(transaction.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-10 w-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* قائمة الصادرات */}
      {credits.length > 0 && (
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent overflow-hidden">
          <CardHeader className="border-b border-green-500/10 bg-green-500/5">
            <CardTitle className="text-lg flex items-center gap-3 text-green-400">
              <div className="p-2 rounded-lg bg-green-500/20">
                <TrendingDown className="h-5 w-5" />
              </div>
              الصادرات العامة
              <Badge className="bg-green-500/20 text-green-300 border-0 mr-auto">
                {credits.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {credits.map(transaction => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 bg-card/50 rounded-xl border border-green-500/10 hover:border-green-500/30 transition-all hover:shadow-lg hover:shadow-green-500/5"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        صادر عام
                      </Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(transaction.paid_at).toLocaleDateString('ar-LY')}
                      </span>
                    </div>
                    <div className="text-sm text-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {transaction.notes || 'بدون ملاحظات'}
                    </div>
                    {transaction.reference && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        المرجع: {transaction.reference}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className="text-xl font-bold text-green-400">
                        {Number(transaction.amount).toLocaleString('en-US')}
                        <span className="text-sm font-normal text-green-300/70 mr-1">د.ل</span>
                      </div>
                      {transaction.method && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {transaction.method}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(transaction.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-10 w-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {transactions.length === 0 && (
        <Card className="border-border/50 bg-gradient-to-br from-accent/30 to-transparent">
          <CardContent className="py-16 text-center">
            <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
              <Receipt className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground mb-2">
              لا توجد معاملات عامة حتى الآن
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              استخدم الأزرار أعلاه لإضافة واردات أو صادرات خارج العقود
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
