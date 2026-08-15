import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  FileText, CheckCircle, Clock, AlertCircle, 
  Wrench, PaintBucket, DollarSign, TrendingUp, Ruler 
} from 'lucide-react';
import { Contract } from '@/services/contractService';

interface ContractStatsProps {
  contracts: Contract[];
}

export const ContractStats: React.FC<ContractStatsProps> = ({ contracts }) => {
  // حساب الإحصائيات
  const getStats = () => {
    const today = new Date();
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let upcoming = 0;
    let totalInstallation = 0;
    let totalPrint = 0;
    let totalAmount = 0;
    let totalPaid = 0;

    contracts.forEach(contract => {
      const startDate = new Date(contract.start_date || '');
      const endDate = new Date(contract.end_date || '');
      
      // حساب الحالات
      if (contract.start_date && contract.end_date) {
        if (today < startDate) {
          upcoming++;
        } else if (today > endDate) {
          expired++;
        } else {
          const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysRemaining <= 7) {
            expiring++;
          }
          active++;
        }
      }
      
      // حساب المبالغ
      totalInstallation += Number((contract as any).installation_cost || 0);
      totalPrint += Number((contract as any).print_cost || 0);
      totalAmount += Number((contract as any)['Total'] || (contract as any).total_cost || 0);
      totalPaid += Number((contract as any)['Total Paid'] || (contract as any).total_paid || 0);
    });

    // حساب إجمالي الأمتار من بيانات اللوحات
    let totalArea = 0;
    contracts.forEach(contract => {
      const billboardsData = (contract as any).billboards_data;
      if (billboardsData) {
        try {
          const billboards = typeof billboardsData === 'string' ? JSON.parse(billboardsData) : billboardsData;
          if (Array.isArray(billboards)) {
            billboards.forEach((b: any) => {
              const size = String(b.Size ?? b.size ?? '');
              const match = size.match(/(\d+(?:[.,]\d+)?)\s*[×xX*\-]\s*(\d+(?:[.,]\d+)?)/);
              if (match) {
                const faces = Number(b.Faces_Count ?? b.faces ?? b.Faces ?? 1);
                totalArea += parseFloat(match[1].replace(',', '.')) * parseFloat(match[2].replace(',', '.')) * faces;
              }
            });
          }
        } catch {}
      }
    });

    return {
      total: contracts.length,
      active,
      expiring,
      expired,
      upcoming,
      totalInstallation,
      totalPrint,
      totalAmount,
      totalPaid,
      remaining: totalAmount - totalPaid,
      totalArea
    };
  };

  const stats = getStats();

  const statCards = [
    {
      title: 'إجمالي العقود',
      value: stats.total,
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      title: 'العقود النشطة',
      value: stats.active,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30'
    },
    {
      title: 'قريبة الانتهاء',
      value: stats.expiring,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30'
    },
    {
      title: 'منتهية',
      value: stats.expired,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30'
    },
    {
      title: 'إجمالي التركيب',
      value: `${stats.totalInstallation.toLocaleString('ar-LY')} د.ل`,
      icon: Wrench,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      isAmount: true
    },
    {
      title: 'إجمالي الطباعة',
      value: `${stats.totalPrint.toLocaleString('ar-LY')} د.ل`,
      icon: PaintBucket,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      isAmount: true
    },
    {
      title: 'إجمالي المدفوع',
      value: `${stats.totalPaid.toLocaleString('ar-LY')} د.ل`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      isAmount: true
    },
    {
      title: 'المبالغ المتبقية',
      value: `${stats.remaining.toLocaleString('ar-LY')} د.ل`,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      isAmount: true
    },
    {
      title: 'إجمالي الأمتار',
      value: `${stats.totalArea.toLocaleString('ar-LY', { maximumFractionDigits: 1 })} م²`,
      icon: Ruler,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100 dark:bg-teal-900/30',
      isAmount: true
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index} className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{stat.title}</p>
<p className={`text-lg font-bold font-manrope ${stat.color} ${stat.isAmount ? 'text-sm' : ''}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
