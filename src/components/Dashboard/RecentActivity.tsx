import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Eye, Edit, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const activities = [
  {
    id: '1',
    user: 'محمد علي الحولة',
    company: 'شركة جرين للاعلان',
    action: 'طلب حجز جديد',
    billboards: ['لوحة 2', 'لوحة 3'],
    amount: '86,400 د.ل',
    status: 'مؤكد' as const,
    time: '2025-01-01 27-12-2025',
  },
  {
    id: '2', 
    user: 'علي عمار',
    company: 'شركة بريد',
    action: 'حجز مكتمل',
    billboards: ['لوحة 3'],
    amount: '132,000 د.ل',
    status: 'مؤكد' as const,
    time: '2025-05-24 19-05-2026',
  },
  {
    id: '3',
    user: 'محمد البحلاق',
    company: '',
    action: 'طلب جديد',
    billboards: ['لوحة 2'],
    amount: '75,600 د.ل',
    status: 'مؤكد' as const,
    time: '2025-02-01 27-01-2026',
  },
  {
    id: '4',
    user: 'أحمد المصباحي',
    company: '',
    action: 'في الانتظار',
    billboards: ['لوحة 2'],
    amount: '47,700 د.ل',
    status: 'في الانتظار' as const,
    time: '2025-07-19 15-01-2026',
  },
  {
    id: '5',
    user: 'إيهاب الجحادي',
    company: '',
    action: 'طلب جديد',
    billboards: ['لوحة 2'],
    amount: '60,000 د.ل',
    status: 'مؤكد' as const,
    time: '2024-10-15 10-10-2025',
  },
  {
    id: '6',
    user: 'عامر محمد سويد',
    company: '',
    action: 'حجز مكتمل',
    billboards: ['لوحة 2'],
    amount: '52,800 د.ل',
    status: 'مؤكد' as const,
    time: '2025-08-05 31-07-2026',
  }
];

export function RecentActivity() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'مؤكد':
        return <Badge className="bg-success/10 text-success border-success/20">مؤكد</Badge>;
      case 'في الانتظار':
        return <Badge className="bg-warning/10 text-warning border-warning/20">في الانتظار</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="bg-gradient-card border-0 shadow-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-lg">النشاطات الأخيرة</CardTitle>
          </div>
          <Button variant="outline" size="sm" className="text-xs">
            عرض الكل
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center gap-4 p-4 rounded-xl bg-background/50 hover:bg-background/80 transition-smooth border border-border/50">
            {/* أفاتار المستخدم */}
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {activity.user.split(' ')[0][0]}
              </AvatarFallback>
            </Avatar>
            
            {/* تفاصيل النشاط */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm text-foreground">{activity.user}</h4>
                {activity.company && (
                  <span className="text-xs text-muted-foreground">• {activity.company}</span>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{activity.billboards.join(', ')}</span>
                <span>•</span>
                <span>{activity.time}</span>
              </div>
            </div>

            {/* المبلغ والحالة */}
            <div className="text-left space-y-2">
              <div className="font-semibold text-primary">{activity.amount}</div>
              {getStatusBadge(activity.status)}
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}