import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';

interface CompositeProfitCardProps {
  customerTotal: number;
  companyTotal: number;
  netProfit: number;
  profitPercentage: number;
  taskType?: string;
  companyInstallationCost?: number;
}

export const CompositeProfitCard: React.FC<CompositeProfitCardProps> = ({
  customerTotal,
  companyTotal,
  netProfit,
  profitPercentage,
  taskType,
  companyInstallationCost = 0
}) => {
  // For new_installation, exclude installation cost from company total since it's included in the contract
  const isNewInstallation = taskType === 'new_installation';
  const adjustedCompanyTotal = isNewInstallation ? companyTotal - companyInstallationCost : companyTotal;
  const adjustedNetProfit = isNewInstallation ? customerTotal - adjustedCompanyTotal : netProfit;
  const adjustedProfitPercentage = isNewInstallation && customerTotal > 0 
    ? (adjustedNetProfit / customerTotal) * 100 
    : profitPercentage;
  const isProfit = adjustedNetProfit >= 0;
  
  return (
    <Card className={`border ${isProfit ? 'border-green-500/50' : 'border-red-500/50'} bg-card`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-foreground">
          <div className={`p-1.5 rounded-lg ${isProfit ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            <DollarSign className={`h-4 w-4 ${isProfit ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          تحليل الربحية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* إجمالي من الزبون */}
        <div className="flex justify-between items-center p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm text-muted-foreground">إجمالي من الزبون:</span>
          <span className="font-bold text-primary">
            {customerTotal.toLocaleString('ar-LY')} د.ل
          </span>
        </div>

        {/* إجمالي تكلفة الشركة */}
        <div className="flex justify-between items-center p-2.5 bg-orange-500/5 border border-orange-500/20 rounded-lg">
          <span className="text-sm text-muted-foreground">
            تكلفة الشركة:
            {isNewInstallation && companyInstallationCost > 0 && (
              <span className="text-[10px] text-muted-foreground/60 mr-1">(بدون التركيب - شامل العقد)</span>
            )}
          </span>
          <span className="font-bold text-orange-600 dark:text-orange-400">
            {adjustedCompanyTotal.toLocaleString('ar-LY')} د.ل
          </span>
        </div>

        {/* صافي الربح */}
        <div className={`flex justify-between items-center p-3 rounded-lg border ${
          isProfit 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {isProfit ? (
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <span className="font-semibold text-foreground">صافي الربح:</span>
          </div>
          <span className={`text-xl font-bold ${
            isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {adjustedNetProfit.toLocaleString('ar-LY')} د.ل
          </span>
        </div>

        {/* نسبة الربح */}
        <div className="flex justify-between items-center p-2.5 bg-muted/50 border border-border/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">نسبة الربح:</span>
          </div>
          <span className={`font-bold ${
            isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {adjustedProfitPercentage.toFixed(1)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
