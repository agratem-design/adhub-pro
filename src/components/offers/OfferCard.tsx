import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BillboardImageWithBlur } from '@/components/BillboardImageWithBlur';
import { 
  Edit, Trash2, Copy, Printer, FileOutput, Calendar, Clock, 
  Building2, DollarSign, User2, Hash, Wrench, TrendingUp,
  ChevronLeft, MapPin, Layers, FileSpreadsheet
} from 'lucide-react';

interface OfferCardProps {
  offer: any;
  customerInfo?: { company?: string; phone?: string } | null;
  currencySymbol: string;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onPrint: () => void;
  onPrintAll: () => void;
  onConvert: () => void;
  onExportExcel?: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

export function OfferCard({
  offer,
  customerInfo,
  currencySymbol,
  onEdit,
  onDelete,
  onCopy,
  onPrint,
  onPrintAll,
  onConvert,
  onExportExcel,
  getStatusBadge,
}: OfferCardProps) {
  const getStatusGradient = (status: string) => {
    switch (status) {
      case 'approved':
        return 'from-green-500 via-emerald-500 to-teal-500';
      case 'converted':
        return 'from-blue-500 via-indigo-500 to-violet-500';
      case 'rejected':
        return 'from-red-500 via-rose-500 to-pink-500';
      default:
        return 'from-amber-500 via-orange-500 to-yellow-500';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/5 dark:bg-green-500/10';
      case 'converted':
        return 'bg-blue-500/5 dark:bg-blue-500/10';
      case 'rejected':
        return 'bg-red-500/5 dark:bg-red-500/10';
      default:
        return 'bg-amber-500/5 dark:bg-amber-500/10';
    }
  };

  // Parse billboards data for preview
  const billboardsData = (() => {
    try {
      return JSON.parse(offer.billboards_data || '[]');
    } catch {
      return [];
    }
  })();

  // Get unique sizes from billboards
  const sizes = [...new Set(billboardsData.map((b: any) => b.Size || b.size).filter(Boolean))];

  return (
    <Card 
      className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 border-border/40 ${getStatusBgColor(offer.status)}`}
    >
      {/* Status gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getStatusGradient(offer.status)}`} />
      
      {/* Decorative corner accent */}
      <div className={`absolute -top-12 -right-12 w-24 h-24 rounded-full bg-gradient-to-br ${getStatusGradient(offer.status)} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity duration-500`} />
      
      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1">
            {/* Offer Number with enhanced styling */}
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${getStatusGradient(offer.status)} bg-opacity-10`}>
                <Hash className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-xl font-bold">
                عرض <span className="text-primary">#{offer.offer_number}</span>
              </CardTitle>
            </div>
            
            {/* Customer info with icon */}
            <div className="flex items-center gap-2">
              <User2 className="h-4 w-4 text-muted-foreground" />
              <CardDescription className="text-base font-medium text-foreground/80">
                {offer.customer_name}
              </CardDescription>
            </div>
            
            {/* Company & Phone */}
            {customerInfo && (customerInfo.company || customerInfo.phone) && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {customerInfo.company && (
                  <span className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
                    <Building2 className="h-3 w-3" />
                    {customerInfo.company}
                  </span>
                )}
                {customerInfo.phone && (
                  <span className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full" dir="ltr">
 {customerInfo.phone}
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Status Badge */}
          <div className="shrink-0">
            {getStatusBadge(offer.status)}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Billboard Images Preview */}
        {billboardsData.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {billboardsData.slice(0, 4).map((billboard: any, idx: number) => (
              <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-border/30">
                <BillboardImageWithBlur
                  billboard={{
                    Image_URL: billboard.Image_URL || billboard.image_url || billboard.image,
                    Billboard_Name: billboard.Billboard_Name || billboard.name,
                    image_name: billboard.image_name,
                  }}
                  className="w-full h-full"
                  alt={billboard.Billboard_Name || billboard.name || 'لوحة'}
                />
                {idx === 3 && billboardsData.length > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">+{billboardsData.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {/* Info Grid with enhanced cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 transition-colors hover:bg-muted/50">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">تاريخ البداية</p>
              <p className="text-sm font-semibold">{offer.start_date}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 transition-colors hover:bg-muted/50">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">المدة</p>
              <p className="text-sm font-semibold">{offer.duration_months} شهر</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 transition-colors hover:bg-muted/50">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Layers className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">اللوحات</p>
              <p className="text-sm font-semibold">{offer.billboards_count} لوحة</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 transition-colors hover:from-primary/10 hover:to-primary/15">
            <div className="p-2 rounded-lg bg-primary/20">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">الإجمالي</p>
              <p className="text-sm font-bold text-primary">{offer.total?.toLocaleString('ar-LY')} {currencySymbol}</p>
            </div>
          </div>
        </div>
        
        {/* Sizes badges */}
        {sizes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground ml-1">المقاسات:</span>
            {sizes.slice(0, 4).map((size: string, idx: number) => (
              <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5 bg-muted/60">
                {size}
              </Badge>
            ))}
            {sizes.length > 4 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                +{sizes.length - 4}
              </Badge>
            )}
          </div>
        )}
        
        {/* Additional costs badges */}
        {(offer.installation_cost > 0 || (offer.print_cost > 0 && offer.print_cost_enabled) || offer.operating_fee_rate > 0) && (
          <div className="flex flex-wrap gap-2">
            {offer.installation_cost > 0 && (
              <Badge 
                variant="outline" 
                className={`${offer.installation_enabled ? 'border-orange-500/40 bg-orange-500/5 text-orange-600 dark:text-orange-400' : 'border-muted text-muted-foreground line-through opacity-50'} transition-colors`}
              >
                <Wrench className="h-3 w-3 ml-1" />
                تركيب: {offer.installation_cost.toLocaleString('ar-LY')}
              </Badge>
            )}
            {offer.print_cost > 0 && offer.print_cost_enabled && (
              <Badge variant="outline" className="border-blue-500/40 bg-blue-500/5 text-blue-600 dark:text-blue-400">
                <Printer className="h-3 w-3 ml-1" />
                طباعة: {offer.print_cost.toLocaleString('ar-LY')}
              </Badge>
            )}
            {offer.operating_fee_rate > 0 && (
              <Badge variant="outline" className="border-green-500/40 bg-green-500/5 text-green-600 dark:text-green-400">
                <TrendingUp className="h-3 w-3 ml-1" />
                تشغيل: {offer.operating_fee_rate}%
                {offer.operating_fee ? ` (${offer.operating_fee.toLocaleString('ar-LY')})` : ''}
              </Badge>
            )}
          </div>
        )}
        
        <Separator className="bg-border/50" />
        
        {/* Actions with enhanced styling */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="flex-1 min-w-[80px] gap-1.5 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all"
          >
            <Edit className="h-3.5 w-3.5" />
            تعديل
          </Button>
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={onPrint}
            className="gap-1 hover:bg-blue-500/10 hover:border-blue-500/40 hover:text-blue-600 transition-all"
            title="طباعة العرض"
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={onPrintAll}
            className="gap-1 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-600 transition-all"
            title="طباعة الكل"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="text-xs">الكل</span>
          </Button>

          {onExportExcel && (
            <Button
              size="sm"
              variant="outline"
              onClick={onExportExcel}
              className="gap-1 hover:bg-green-600/10 hover:border-green-600/40 hover:text-green-600 transition-all"
              title="تصدير Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </Button>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={onCopy}
            className="gap-1 hover:bg-purple-500/10 hover:border-purple-500/40 hover:text-purple-600 transition-all"
            title="نسخ العرض"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={onConvert}
            disabled={offer.status === 'converted'}
            className="gap-1 hover:bg-green-500/10 hover:border-green-500/40 hover:text-green-600 transition-all disabled:opacity-40"
            title="تحويل لعقد"
          >
            <FileOutput className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="hover:bg-destructive/10 hover:text-destructive transition-all"
            title="حذف"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
