import { Card } from '@/components/ui/card';
import { FileText, Calendar, CheckCircle } from 'lucide-react';

interface ReportStatsProps {
  totalReports: number;
  dailyReports: number;
  weeklyReports: number;
  monthlyReports: number;
}

export function ReportStats({ totalReports, dailyReports, weeklyReports, monthlyReports }: ReportStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">إجمالي التقارير</p>
            <p className="text-2xl font-bold">{totalReports}</p>
          </div>
          <FileText className="h-8 w-8 text-primary" />
        </div>
      </Card>
      
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">تقارير يومية</p>
            <p className="text-2xl font-bold">{dailyReports}</p>
          </div>
          <Calendar className="h-8 w-8 text-blue-500" />
        </div>
      </Card>
      
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">تقارير أسبوعية</p>
            <p className="text-2xl font-bold">{weeklyReports}</p>
          </div>
          <Calendar className="h-8 w-8 text-green-500" />
        </div>
      </Card>
      
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">تقارير شهرية</p>
            <p className="text-2xl font-bold">{monthlyReports}</p>
          </div>
          <CheckCircle className="h-8 w-8 text-purple-500" />
        </div>
      </Card>
    </div>
  );
}
