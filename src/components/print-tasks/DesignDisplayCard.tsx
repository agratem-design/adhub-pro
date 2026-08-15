import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageIcon, Printer, ZoomIn, ExternalLink, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DesignGroup {
  design: string | null;
  face: 'a' | 'b';
  size: string;
  quantity: number;
  area: number;
  width: number;
  height: number;
  facesCount?: number;
  billboards?: number[];
  hasCutout?: boolean;
  cutoutCount?: number;
  cutoutImageUrl?: string;
}

interface DesignDisplayCardProps {
  group: DesignGroup;
  index: number;
  showCutoutImageInput?: boolean;
  onCutoutImageChange?: (imageUrl: string) => void;
  editMode?: boolean;
  // Status integration
  itemStatus?: string;
  onStatusChange?: (status: string) => void;
  isStatusUpdating?: boolean;
}

export function DesignDisplayCard({
  group,
  index,
  showCutoutImageInput = false,
  onCutoutImageChange,
  editMode = false,
  itemStatus,
  onStatusChange,
  isStatusUpdating = false
}: DesignDisplayCardProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageDialogOpen(true);
  };

  const handleOpenInNewTab = (imageUrl: string) => {
    window.open(imageUrl, '_blank');
  };

  return (
    <>
      <Card key={index} className="overflow-hidden border-2 hover:border-primary/50 transition-all">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* صورة التصميم */}
            <div className="flex flex-col gap-2">
              <div 
                className="relative group bg-muted rounded-lg p-4 min-h-48 flex items-center justify-center border-2 border-border hover:border-primary transition-all cursor-pointer"
                onClick={() => group.design && !imageError && handleImageClick(group.design)}
              >
                {group.design && !imageError ? (
                  <>
                    <img 
                      src={group.design} 
                      alt={`تصميم ${group.size}`}
                      className="max-h-44 max-w-full w-auto h-auto object-contain transition-transform group-hover:scale-105"
                      onError={() => setImageError(true)}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all rounded-lg flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageClick(group.design!);
                          }}
                          className="bg-background/90 hover:bg-background"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenInNewTab(group.design!);
                          }}
                          className="bg-background/90 hover:bg-background"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <ImageIcon className="h-16 w-16" />
                    <span className="text-xs text-center">
                      {imageError ? 'فشل تحميل الصورة' : 'لا يوجد تصميم'}
                    </span>
                  </div>
                )}
              </div>
              {group.design && !imageError && (
                <div className="text-xs text-muted-foreground text-center px-2 break-all">
                  {group.design.substring(0, 40)}...
                </div>
              )}
            </div>

            {/* التفاصيل */}
            <div className="md:col-span-3 space-y-4">
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <Printer className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xl text-foreground">
                      {group.size}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {group.face === 'a' ? 'الوجه الأمامي' : 'الوجه الخلفي'}
                      {(group.facesCount || 1) > 1 && <span className="font-semibold text-primary mr-2">- {group.facesCount} أوجه</span>}
                      {group.hasCutout && <span className="text-destructive font-semibold mr-2">- يحتوي على مجسم</span>}
                    </p>
              </div>

              {/* Status change integrated into card */}
              {onStatusChange && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border/50">
                  <span className="text-sm font-medium text-muted-foreground">حالة الطباعة:</span>
                  {itemStatus === 'completed' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {itemStatus === 'printing' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                  {itemStatus === 'pending' && <Clock className="h-4 w-4 text-amber-500" />}
                  <Select
                    value={itemStatus || 'pending'}
                    onValueChange={onStatusChange}
                    disabled={isStatusUpdating}
                  >
                    <SelectTrigger className="w-40 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">معلق</SelectItem>
                      <SelectItem value="printing">جاري الطباعة</SelectItem>
                      <SelectItem value="completed">مكتمل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
                </div>
                <div className="text-left">
                  <div className="text-sm text-muted-foreground">الكمية (مع الأوجه)</div>
                  <div className="font-bold text-3xl text-primary">×{group.quantity}</div>
                  {(group.facesCount || 1) > 1 && (
                    <div className="text-xs text-muted-foreground">{group.billboards?.length || '?'} لوحة × {group.facesCount} أوجه</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-muted-foreground text-xs mb-1">العرض</div>
                  <div className="font-bold text-lg">{group.width} متر</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-muted-foreground text-xs mb-1">الارتفاع</div>
                  <div className="font-bold text-lg">{group.height} متر</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="text-muted-foreground text-xs mb-1">مساحة الوحدة</div>
                  <div className="font-bold text-lg">{group.area.toFixed(2)} م²</div>
                </div>
                <div className="bg-gradient-to-br from-primary/20 to-primary/30 p-4 rounded-lg border-2 border-primary">
                  <div className="text-muted-foreground text-xs mb-1">إجمالي المساحة</div>
                  <div className="font-bold text-xl text-primary">{(group.area * group.quantity).toFixed(2)} م²</div>
                </div>
              </div>

              {group.hasCutout && (
                <div className="space-y-3 p-4 bg-destructive/5 rounded-lg border-2 border-destructive/30">
                  <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg">
                    <div className="bg-destructive/20 p-2 rounded">
                      <Printer className="h-5 w-5 text-destructive" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-destructive text-lg">
                        يحتوي على مجسمات
                      </div>
                      <div className="text-sm text-muted-foreground">
                        عدد المجسمات المطلوبة: <span className="font-bold text-destructive">{group.cutoutCount}</span>
                      </div>
                    </div>
                  </div>

                  {showCutoutImageInput && (
                    <div className="space-y-2">
                      <Label htmlFor={`cutout-url-${index}`} className="text-sm font-semibold">
                        صورة المجسم {editMode ? '(اختياري)' : ''}
                      </Label>
                      <Input
                        id={`cutout-url-${index}`}
                        type="url"
                        value={group.cutoutImageUrl || ''}
                        onChange={(e) => onCutoutImageChange?.(e.target.value)}
                        placeholder="https://example.com/cutout-image.jpg"
                        className="text-sm"
                        disabled={!editMode}
                      />
                      {group.cutoutImageUrl && (
                        <div 
                          className="mt-3 p-3 bg-background rounded-lg border-2 border-border hover:border-primary transition-all cursor-pointer group"
                          onClick={() => handleImageClick(group.cutoutImageUrl!)}
                        >
                          <div className="text-xs text-muted-foreground mb-2 font-semibold">معاينة صورة المجسم:</div>
                          <div className="relative">
                            <img 
                              src={group.cutoutImageUrl}
                              alt="معاينة صورة المجسم"
                              className="max-h-32 w-auto object-contain mx-auto transition-transform group-hover:scale-105"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.innerHTML = '<p class="text-destructive text-xs text-center">فشل تحميل الصورة</p>';
                                }
                              }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded flex items-center justify-center">
                              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog لعرض الصورة بحجم كامل */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <div className="relative w-full h-full flex items-center justify-center bg-black/95 rounded-lg overflow-hidden">
            {selectedImage && (
              <div className="relative w-full h-full flex items-center justify-center p-8">
                <img 
                  src={selectedImage} 
                  alt="عرض التصميم"
                  className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleOpenInNewTab(selectedImage)}
                  className="absolute top-4 right-4 bg-background/90 hover:bg-background"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  فتح في نافذة جديدة
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}