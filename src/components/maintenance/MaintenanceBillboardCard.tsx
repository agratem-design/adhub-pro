import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wrench, CheckCircle, MapPin, Ruler, Calendar, DollarSign, ImageIcon, ExternalLink } from 'lucide-react';

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Nearest_Landmark: string;
  District: string;
  Municipality: string;
  Size: string;
  Status: string;
  maintenance_status: string;
  maintenance_date: string | null;
  maintenance_notes: string | null;
  maintenance_type: string | null;
  maintenance_cost: number | null;
  next_maintenance_date: string | null;
  maintenance_priority: string;
  Image_URL: string | null;
  GPS_Link: string | null;
}

interface MaintenanceBillboardCardProps {
  billboard: Billboard;
  onMaintenanceClick: (billboard: Billboard) => void;
  onCompleteClick: (billboardId: number) => void;
  onStatusChange: (billboardId: number, status: string) => void;
}

export function MaintenanceBillboardCard({
  billboard,
  onMaintenanceClick,
  onCompleteClick,
  onStatusChange
}: MaintenanceBillboardCardProps) {
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      operational: { label: 'بحالة جيدة', className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400' },
      maintenance: { label: 'قيد الصيانة', className: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400' },
      repair_needed: { label: 'تحتاج إصلاح', className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400' },
      out_of_service: { label: 'خارج الخدمة', className: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400' },
      removed: { label: 'تمت الإزالة', className: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/30 dark:text-slate-400' }
    };

    const config = statusConfig[status] || statusConfig.operational;
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { label: string; className: string }> = {
      low: { label: 'منخفضة', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      normal: { label: 'عادية', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      high: { label: 'عالية', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
      urgent: { label: 'عاجلة', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
    };

    const config = priorityConfig[priority] || priorityConfig.normal;
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 hover:scale-[1.01]">
      {/* Billboard Image */}
      <div className="relative h-36 bg-muted overflow-hidden">
        {billboard.Image_URL ? (
          <img
            src={billboard.Image_URL}
            alt={billboard.Billboard_Name || 'لوحة'}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}

        {/* Status & Priority Badges Overlay - Only show if NOT operational */}
        {billboard.maintenance_status && billboard.maintenance_status !== 'operational' && (
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {getStatusBadge(billboard.maintenance_status)}
          </div>
        )}
        {billboard.maintenance_priority && billboard.maintenance_priority !== 'normal' && (
          <div className="absolute top-2 left-2">
            {getPriorityBadge(billboard.maintenance_priority)}
          </div>
        )}

        {/* GPS Link */}
        {billboard.GPS_Link && (
          <a
            href={billboard.GPS_Link}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-full p-1.5 hover:bg-background transition-colors"
          >
            <ExternalLink className="h-4 w-4 text-primary" />
          </a>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Billboard Name */}
        <h4 className="font-semibold text-sm truncate">
          {billboard.Billboard_Name || `لوحة رقم ${billboard.ID}`}
        </h4>

        {/* Location Info */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-primary shrink-0" />
            <span className="truncate">{billboard.Nearest_Landmark || billboard.District || 'غير محدد'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Ruler className="h-3 w-3 text-primary shrink-0" />
            <span className="truncate">{billboard.Size || 'غير محدد'}</span>
          </div>
        </div>

        {/* Maintenance Info */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-primary shrink-0" />
            <span>
              {billboard.maintenance_date
                ? new Date(billboard.maintenance_date).toLocaleDateString('ar-LY')
                : 'لا يوجد'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-primary shrink-0" />
            <span>
              {billboard.maintenance_cost
                ? `${billboard.maintenance_cost.toLocaleString()} د.ل`
                : '-'}
            </span>
          </div>
        </div>

        {/* Maintenance Notes */}
        {billboard.maintenance_type && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 line-clamp-2">
            {billboard.maintenance_type}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 gap-1 text-xs"
            onClick={() => onMaintenanceClick(billboard)}
          >
            <Wrench className="h-3 w-3" />
            صيانة
          </Button>

          <Button
            size="sm"
            variant="default"
            className="flex-1 h-8 gap-1 text-xs"
            onClick={() => onCompleteClick(billboard.ID)}
          >
            <CheckCircle className="h-3 w-3" />
            إكمال
          </Button>
        </div>

        {/* Status Select */}
        <Select
          value={billboard.maintenance_status}
          onValueChange={(value) => onStatusChange(billboard.ID, value)}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue placeholder="تغيير الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="operational">طبيعي</SelectItem>
            <SelectItem value="maintenance">صيانة</SelectItem>
            <SelectItem value="repair_needed">إصلاح</SelectItem>
            <SelectItem value="out_of_service">خارج الخدمة</SelectItem>
            <SelectItem value="removed">تمت الإزالة</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
