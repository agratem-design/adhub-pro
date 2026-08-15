import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, RotateCcw, Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_DEBT_TEMPLATE,
  DEFAULT_CONTRACT_EXPIRY_TEMPLATE,
  DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE,
  DEBT_TEMPLATE_VARIABLES,
  CONTRACT_EXPIRY_VARIABLES,
  CONTRACT_EXPIRY_ALERT_VARIABLES,
} from '@/utils/messageTemplates';

interface MessageTemplatesCardProps {
  debtTemplate: string;
  contractExpiryTemplate: string;
  contractExpiryAlertTemplate: string;
  onDebtTemplateChange: (v: string) => void;
  onContractExpiryTemplateChange: (v: string) => void;
  onContractExpiryAlertTemplateChange: (v: string) => void;
}

function VariableBadges({ variables }: { variables: { key: string; description: string }[] }) {
  const copyVariable = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success(`تم نسخ ${key}`);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {variables.map((v) => (
        <Badge
          key={v.key}
          variant="outline"
          className="cursor-pointer hover:bg-primary/10 transition-colors text-xs gap-1"
          onClick={() => copyVariable(v.key)}
          title={`${v.description} — اضغط للنسخ`}
        >
          <Copy className="h-3 w-3" />
          {v.key}
        </Badge>
      ))}
    </div>
  );
}

export default function MessageTemplatesCard({
  debtTemplate,
  contractExpiryTemplate,
  contractExpiryAlertTemplate,
  onDebtTemplateChange,
  onContractExpiryTemplateChange,
  onContractExpiryAlertTemplateChange,
}: MessageTemplatesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          قوالب رسائل التنبيهات
        </CardTitle>
        <CardDescription>
          تخصيص صيغة الرسائل المرسلة للعملاء. اضغط على المتغير لنسخه ثم الصقه في القالب.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Debt Reminder Template */}
        <div className="space-y-3 p-4 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">قالب تذكير المستحقات المالية</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDebtTemplateChange(DEFAULT_DEBT_TEMPLATE)}
              className="gap-1 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              استعادة الافتراضي
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">المتغيرات المتاحة (اضغط للنسخ):</Label>
            <VariableBadges variables={DEBT_TEMPLATE_VARIABLES} />
          </div>
          <Textarea
            value={debtTemplate}
            onChange={(e) => onDebtTemplateChange(e.target.value)}
            dir="rtl"
            className="min-h-[280px] font-mono text-sm leading-relaxed"
            placeholder="أدخل قالب رسالة تذكير المستحقات..."
          />
        </div>

        {/* Contract Expiry Alert Template */}
        <div className="space-y-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">قالب تنبيه انتهاء العقود</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onContractExpiryAlertTemplateChange(DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE)}
              className="gap-1 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              استعادة الافتراضي
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">المتغيرات المتاحة (اضغط للنسخ):</Label>
            <VariableBadges variables={CONTRACT_EXPIRY_ALERT_VARIABLES} />
          </div>
          <Textarea
            value={contractExpiryAlertTemplate}
            onChange={(e) => onContractExpiryAlertTemplateChange(e.target.value)}
            dir="rtl"
            className="min-h-[280px] font-mono text-sm leading-relaxed"
            placeholder="أدخل قالب رسالة تنبيه انتهاء العقود..."
          />
        </div>

        {/* Overdue Payments Template */}
        <div className="space-y-3 p-4 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">قالب تنبيه الدفعات المتأخرة</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onContractExpiryTemplateChange(DEFAULT_CONTRACT_EXPIRY_TEMPLATE)}
              className="gap-1 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              استعادة الافتراضي
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">المتغيرات المتاحة (اضغط للنسخ):</Label>
            <VariableBadges variables={CONTRACT_EXPIRY_VARIABLES} />
          </div>
          <Textarea
            value={contractExpiryTemplate}
            onChange={(e) => onContractExpiryTemplateChange(e.target.value)}
            dir="rtl"
            className="min-h-[240px] font-mono text-sm leading-relaxed"
            placeholder="أدخل قالب رسالة تنبيه الدفعات المتأخرة..."
          />
        </div>
      </CardContent>
    </Card>
  );
}
