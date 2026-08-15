import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, MapPin, RotateCcw, X, Navigation, Building, Ruler, Layers, Eye, ZoomIn, Copy } from "lucide-react";
import { EditGuard } from "@/components/EditGuard";
import { BillboardImageWithBlur } from "@/components/BillboardImageWithBlur";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface RephotoBillboard {
  ID: number;
  Billboard_Name: string | null;
  City: string | null;
  District: string | null;
  Municipality: string | null;
  Size: string | null;
  Level: string | null;
  Faces_Count: number | null;
  Nearest_Landmark: string | null;
  GPS_Coordinates: string | null;
  GPS_Link: string | null;
  Image_URL: string | null;
  Status: string | null;
  Ad_Type: string | null;
  billboard_type: string | null;
  Customer_Name: string | null;
  Contract_Number: number | null;
}

const RephotographyBillboards = () => {
  const queryClient = useQueryClient();
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: billboards = [], isLoading } = useQuery({
    queryKey: ["rephotography-billboards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billboards")
        .select("ID, Billboard_Name, City, District, Municipality, Size, Level, Faces_Count, Nearest_Landmark, GPS_Coordinates, GPS_Link, Image_URL, Status, Ad_Type, billboard_type, Customer_Name, Contract_Number")
        .eq("needs_rephotography", true)
        .order("ID", { ascending: true });
      if (error) throw error;
      return (data || []) as RephotoBillboard[];
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("billboards")
        .update({ needs_rephotography: false })
        .eq("needs_rephotography", true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rephotography-billboards"] });
      toast.success("تم تصفير جميع علامات إعادة التصوير");
    },
    onError: () => toast.error("حدث خطأ أثناء التصفير"),
  });

  const removeSingleMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("billboards")
        .update({ needs_rephotography: false })
        .eq("ID", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rephotography-billboards"] });
      toast.success("تم إزالة العلامة");
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const parseCoordinates = (gps: string | null): { lat: number; lng: number } | null => {
    if (!gps) return null;
    const match = gps.match(/([-\d.]+)[,\s]+([-\d.]+)/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  };

  const openGoogleMapsRoute = () => {
    const coords = billboards
      .map((b) => parseCoordinates(b.GPS_Coordinates))
      .filter(Boolean) as { lat: number; lng: number }[];

    if (coords.length === 0) {
      toast.error("لا توجد إحداثيات GPS متاحة");
      return;
    }

    const points = coords.map((c) => `${c.lat},${c.lng}`).join("/");
    window.open(`https://www.google.com/maps/dir/${points}`, "_blank");
  };

  const getFaceCountDisplay = (count: number | null) => {
    switch (String(count || '')) {
      case '1': return 'وجه واحد';
      case '2': return 'وجهين';
      case '3': return 'ثلاثة أوجه';
      case '4': return 'أربعة أوجه';
      default: return count ? `${count} أوجه` : 'غير محدد';
    }
  };

  const getStatusColor = (status: string | null) => {
    const s = (status || '').trim();
    if (s === 'متاح') return 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white';
    if (s === 'محجوز') return 'bg-gradient-to-r from-rose-500 to-pink-500 text-white';
    if (s === 'صيانة') return 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Camera className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">لوحات تحتاج إعادة تصوير</h1>
            <p className="text-sm text-muted-foreground">{billboards.length} لوحة معلّمة</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={openGoogleMapsRoute}
            disabled={billboards.length === 0}
          >
            <Navigation className="h-4 w-4 ml-2" />
            رحلة خرائط قوقل
          </Button>

          <EditGuard section="billboards">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={billboards.length === 0}>
                  <RotateCcw className="h-4 w-4 ml-2" />
                  تصفير الكل
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد التصفير</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم إزالة علامة إعادة التصوير من جميع اللوحات ({billboards.length} لوحة). هل أنت متأكد؟
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={() => resetAllMutation.mutate()}>
                    تأكيد
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </EditGuard>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : billboards.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Camera className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">لا توجد لوحات تحتاج إعادة تصوير</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {billboards.map((b) => (
            <Card
              key={b.ID}
              className="group relative overflow-hidden rounded-2xl border-2 border-border shadow-md transition-all duration-300 hover:shadow-xl"
            >
              {/* صورة اللوحة */}
              <div
                className="aspect-[4/3] bg-muted relative overflow-hidden cursor-pointer"
                onClick={() => {
                  if (b.Image_URL) setPreviewImage(b.Image_URL);
                }}
              >
                <div className="absolute inset-0 z-0">
                  <BillboardImageWithBlur
                    billboard={b as any}
                    alt={b.Billboard_Name || ''}
                    className="w-full h-full"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent z-10" />

                {/* أيقونة التكبير */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                  <div className="bg-black/50 rounded-full p-2 backdrop-blur-sm">
                    <ZoomIn className="h-6 w-6 text-white" />
                  </div>
                </div>

                {/* بادجات علوية */}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-30">
                  <Badge className="bg-white/95 dark:bg-slate-900/95 text-foreground shadow-xl border-0 font-bold px-3 py-1 text-sm backdrop-blur-sm">
                    {b.Size || '-'}
                  </Badge>
                  <Badge className={`shadow-xl border-0 font-semibold px-3 py-1 backdrop-blur-sm ${getStatusColor(b.Status)}`}>
                    {b.Status || 'غير محدد'}
                  </Badge>
                </div>

                {/* بادج إعادة التصوير */}
                <div className="absolute bottom-3 left-3 z-30">
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg">
                    <Camera className="h-3 w-3 ml-1" />
                    تحتاج تصوير
                  </Badge>
                </div>
              </div>

              {/* معلومات الموقع */}
              <div className="px-4 py-3 border-b border-border/30 bg-muted/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-lg text-foreground">
                      {b.Billboard_Name || `لوحة رقم ${b.ID}`}
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-primary shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(b.Billboard_Name || `لوحة رقم ${b.ID}`);
                        toast.success('تم نسخ اسم اللوحة');
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {b.Nearest_Landmark && (
                    <p className="font-bold text-base text-primary flex items-center gap-2">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      {b.Nearest_Landmark}
                    </p>
                  )}
                </div>

                {(b.Municipality || b.District) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {b.Municipality && (
                      <Badge variant="secondary" className="text-xs bg-muted/80">
                        <Building className="h-3 w-3 ml-1" />
                        {b.Municipality}
                      </Badge>
                    )}
                    {b.District && (
                      <Badge variant="secondary" className="text-xs bg-muted/80">
                        المنطقة: {b.District}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* بيانات اللوحة */}
              <CardContent className="p-3 space-y-2.5">
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg border bg-primary/5 border-primary/10">
                    <span className="text-[10px] text-muted-foreground mb-0.5">الأوجه</span>
                    <span className="font-bold text-sm">{getFaceCountDisplay(b.Faces_Count)}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg border bg-secondary/5 border-secondary/10">
                    <span className="text-[10px] text-muted-foreground mb-0.5">النوع</span>
                    <span className="font-bold text-xs text-center line-clamp-1">{b.billboard_type || 'غير محدد'}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg border bg-accent/5 border-accent/10">
                    <span className="text-[10px] text-muted-foreground mb-0.5">المستوى</span>
                    <span className="font-bold text-sm">{b.Level || '-'}</span>
                  </div>
                </div>

                {/* معلومات العقد والعميل */}
                {(b.Customer_Name || b.Contract_Number) && (
                  <div className="p-2 rounded-lg border border-border/50 bg-muted/20 space-y-1">
                    {b.Customer_Name && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">العميل:</span>
                        <span className="font-semibold text-foreground truncate">{b.Customer_Name}</span>
                      </div>
                    )}
                    {b.Contract_Number && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">العقد:</span>
                        <span className="font-semibold text-foreground">{b.Contract_Number}</span>
                      </div>
                    )}
                    {b.Ad_Type && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">نوع الإعلان:</span>
                        <span className="font-semibold text-foreground">{b.Ad_Type}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* أزرار الإجراءات */}
                <div className="flex items-center gap-2">
                  {(b.GPS_Link || b.GPS_Coordinates) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const url = b.GPS_Link || `https://www.google.com/maps?q=${b.GPS_Coordinates}`;
                        window.open(url, "_blank");
                      }}
                    >
                      <MapPin className="h-3.5 w-3.5 ml-1" />
                      الموقع
                    </Button>
                  )}
                  <EditGuard section="billboards">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeSingleMutation.mutate(b.ID)}
                      disabled={removeSingleMutation.isPending}
                    >
                      <X className="h-4 w-4 ml-1" />
                      إزالة العلامة
                    </Button>
                  </EditGuard>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* معاينة الصورة */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {previewImage && (
            <img src={previewImage} alt="معاينة" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RephotographyBillboards;
