import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchContractDesignUrls } from '@/lib/contractDesignUtils';

interface GroupedTasks {
  contractId: number;
  /** عقود فعلية من اللوحات (قد تكون متعددة) */
  contractIds: number[];
  customerName: string;
  tasks: any[];
  totalCustomer: number;
  totalCompany: number;
  totalProfit: number;
}

interface CollapsibleGroupCardProps {
  group: GroupedTasks;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export const CollapsibleGroupCard: React.FC<CollapsibleGroupCardProps> = ({
  group,
  isExpanded,
  onToggle,
  onDelete,
  children
}) => {
  const [designImage, setDesignImage] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // جلب صورة التصميم الأولى للعقد بنفس آلية ContractCard
  useEffect(() => {
    const fetchDesignImage = async () => {
      try {
        const contractNumber = Number(group.contractId);
        if (!Number.isFinite(contractNumber)) return;
        
        const urls = await fetchContractDesignUrls(contractNumber);
        if (urls && urls.length > 0) {
          setDesignImage(urls[0]);
        } else {
          setDesignImage(null);
        }
      } catch (error) {
        console.error('Error fetching design image:', error);
      }
    };

    fetchDesignImage();
  }, [group.contractId]);

  // استخراج اللون السائد من الصورة
  useEffect(() => {
    if (!designImage) {
      setDominantColor(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < imageData.length; i += 4) {
          const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
          if (brightness > 30 && brightness < 225) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }
        
        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          setDominantColor(`${r}, ${g}, ${b}`);
        }
      } catch (e) {
        console.log('Could not extract color');
      }
    };
    img.src = designImage;
  }, [designImage]);

  const getCardStyle = () => {
    if (dominantColor) {
      return {
        borderColor: `rgba(${dominantColor}, 0.5)`,
        background: `linear-gradient(135deg, rgba(${dominantColor}, 0.08) 0%, rgba(${dominantColor}, 0.03) 100%)`,
        boxShadow: `0 4px 20px rgba(${dominantColor}, 0.15)`
      };
    }
    return {};
  };

  const getProgressBarStyle = () => {
    if (dominantColor) {
      return {
        background: `linear-gradient(90deg, rgba(${dominantColor}, 0.8), rgba(${dominantColor}, 1), rgba(${dominantColor}, 0.8))`
      };
    }
    return {};
  };

  return (
    <div 
      className="relative overflow-hidden rounded-lg border-2 transition-all duration-300 border-border/50 bg-card/95 backdrop-blur-sm"
      style={getCardStyle()}
    >
      {/* شريط الحالة العلوي */}
      <div 
        className="absolute top-0 left-0 right-0 h-1.5 transition-all duration-500 bg-gradient-to-r from-muted-foreground/20 via-muted-foreground/30 to-muted-foreground/20"
        style={dominantColor ? getProgressBarStyle() : {}}
      />
      
      {/* تأثير زجاجي */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/5 pointer-events-none" />
      
      {/* المحتوى مع الصورة */}
      <div className="flex relative z-10">
        {/* صورة التصميم */}
        {designImage && (
          <div 
            className="relative w-24 flex-shrink-0 overflow-hidden border-l-2"
            style={dominantColor ? { borderColor: `rgba(${dominantColor}, 0.3)` } : {}}
          >
            <img
              ref={imgRef}
              src={designImage}
              alt="التصميم"
              className="w-full h-full object-cover min-h-[100px]"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div 
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5"
            >
              <span 
                className="text-[9px] text-white font-bold px-1 py-0.5 rounded"
                style={dominantColor ? { backgroundColor: `rgba(${dominantColor}, 0.8)` } : { backgroundColor: 'rgba(0,0,0,0.5)' }}
              >
                تصميم
              </span>
            </div>
          </div>
        )}
        
        {/* المحتوى الرئيسي */}
        <div className="flex-1 min-w-0">
          <Collapsible 
            open={isExpanded}
            onOpenChange={onToggle}
          >
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <span className="text-foreground">{group.customerName}</span>
                        {group.contractIds.length > 1 ? (
                          <Badge variant="outline" className="border-primary/30 text-primary">
                            عقود #{group.contractIds.join(', #')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-primary/30 text-primary">عقد #{group.contractId}</Badge>
                        )}
                        {(() => {
                          const tasksCount = Math.max(group.contractIds.length, 1);
                          return (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                              {tasksCount} {tasksCount === 1 ? 'مهمة' : 'مهام'}
                            </Badge>
                          );
                        })()}
                      </CardTitle>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm flex-wrap">
                    <div className="px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
                      <span className="text-muted-foreground text-xs">إيراد: </span>
                      <span className="font-semibold text-primary">{group.totalCustomer.toLocaleString('ar-LY')}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <span className="text-muted-foreground text-xs">تكلفة: </span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">{group.totalCompany.toLocaleString('ar-LY')}</span>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg border ${group.totalProfit >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                      <span className="text-muted-foreground text-xs">ربح: </span>
                      <span className={`font-semibold ${group.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {group.totalProfit.toLocaleString('ar-LY')}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-4 pt-0 space-y-3 bg-muted/10">
                {children}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
};
