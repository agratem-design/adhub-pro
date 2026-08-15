import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Calendar, User, Filter, Plus, Search, Check, X, Eye, Edit } from 'lucide-react';

const bookings = [
  {
    id: '1',
    client: 'محمد علي الحولة',
    company: 'شركة جرين للإعلان',
    billboards: ['لوحة 2'],
    startDate: '2025-01-01',
    endDate: '27-12-2025',
    amount: '86,400 د.ل',
    status: 'confirmed' as const,
    phone: '91-1234567 218+'
  },
  {
    id: '2',
    client: 'علي عمار',
    company: 'شركة بريد',
    billboards: ['لوحة 3'],
    startDate: '2025-05-24',
    endDate: '19-05-2026',
    amount: '132,000 د.ل',
    status: 'confirmed' as const,
    phone: '92-7654321 218+'
  },
  {
    id: '3',
    client: 'محمد البحلاق',
    company: '',
    billboards: ['لوحة 2'],
    startDate: '2025-02-01',
    endDate: '27-01-2026',
    amount: '75,600 د.ل',
    status: 'confirmed' as const,
    phone: '94-5555555 218+'
  },
  {
    id: '4',
    client: 'أحمد المصباحي',
    company: '',
    billboards: ['لوحة 2'],
    startDate: '2025-07-19',
    endDate: '15-01-2026',
    amount: '47,700 د.ل',
    status: 'pending' as const,
    phone: '93-9876543 218+'
  },
  {
    id: '5',
    client: 'إيهاب الجحادي',
    company: '',
    billboards: ['لوحة 2'],
    startDate: '2024-10-15',
    endDate: '10-10-2025',
    amount: '60,000 د.ل',
    status: 'confirmed' as const,
    phone: '95-1111111 218+'
  },
  {
    id: '6',
    client: 'عامر محمد سويد',
    company: '',
    billboards: ['لوحة 2'],
    startDate: '2025-08-05',
    endDate: '31-07-2026',
    amount: '52,800 د.ل',
    status: 'confirmed' as const,
    phone: '96-2222222 218+'
  }
];

const statistics = [
  { title: 'الإيرادات الشهرية', value: '406,800 د.ل', icon: DollarSign, color: 'text-primary' },
  { title: 'في الانتظار', value: '1', icon: Calendar, color: 'text-warning' },
  { title: 'حجوزات مؤكدة', value: '5', icon: Check, color: 'text-success' },
  { title: 'إجمالي الحجوزات', value: '6', icon: User, color: 'text-foreground' }
];

export default function Bookings() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-success/10 text-success border-success/20">مؤكد</Badge>;
      case 'pending':
        return <Badge className="bg-warning/10 text-warning border-warning/20">في الانتظار</Badge>;
      case 'rejected':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">مرفوض</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الحجوزات</h1>
          <p className="text-muted-foreground">إدارة شاملة للوحات الإعلانية</p>
        </div>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {statistics.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="bg-gradient-card border-0 shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* أدوات البحث والتصفية */}
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            البحث في الحجوزات...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="البحث في الحجوزات..." className="pr-10" />
            </div>
            
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="ترتيب بالتاريخ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">الأحدث أولاً</SelectItem>
                <SelectItem value="date-asc">الأقدم أولاً</SelectItem>
                <SelectItem value="amount-desc">المبلغ (الأعلى)</SelectItem>
                <SelectItem value="amount-asc">المبلغ (الأقل)</SelectItem>
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger>
                <SelectValue placeholder="جميع الأحجام" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأحجام</SelectItem>
                <SelectItem value="confirmed">مؤكد</SelectItem>
                <SelectItem value="pending">في الانتظار</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">فلتر</Button>
              <Button size="sm" className="bg-gradient-primary text-white">
                <Plus className="h-4 w-4 ml-1" />
                جديد
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* قائمة الحجوزات */}
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle>قائمة الحجوزات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-right">
                  <th className="text-right p-3 text-muted-foreground font-medium">الإجراءات</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">الحالة</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">المبلغ</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">التاريخ</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">اللوحات</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">العميل</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">رقم الحجز</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-border/50 hover:bg-background/50 transition-smooth">
                    <td className="p-3">
                      <div className="flex gap-1 justify-start">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {booking.status === 'pending' && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{getStatusBadge(booking.status)}</td>
                    <td className="p-3">
                      <span className="font-semibold text-primary">{booking.amount}</span>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div>{booking.startDate}</div>
                        <div className="text-muted-foreground text-xs">إلى {booking.endDate}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-sm">{booking.billboards.join(', ')}</span>
                    </td>
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{booking.client}</div>
                        {booking.company && (
                          <div className="text-sm text-muted-foreground">{booking.company}</div>
                        )}
                        <div className="text-xs text-muted-foreground">{booking.phone}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-sm text-primary">#{booking.id}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}