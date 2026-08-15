import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

import { MapPin, Calendar, Ruler, ImageIcon, Maximize2, Edit2, X, Check } from 'lucide-react';

interface TeamBillboardCardProps {
  account: {
    id: string;
    billboard_id: number;
    contract_id: number;
    installation_date: string;
    amount: number;
    status: string;
    notes?: string;
  };
  billboardDetails: {
    billboard_name: string;
    customer_name: string;
    size: string;
    image_url?: string;
    installation_image_url?: string;
    design_face_a?: string;
    design_face_b?: string;
  } | undefined;
  sizePriceFromTable?: number;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onUpdateAmount?: (id: string, newAmount: number, reason: string) => void;
  disabled?: boolean;
}

export default function TeamBillboardCard({
  account,
  billboardDetails,
  sizePriceFromTable,
  isSelected,
  onSelectChange,
  onUpdateAmount,
  disabled = false
}: TeamBillboardCardProps) {
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [previewImageTitle, setPreviewImageTitle] = useState('');
  const [editingAmount, setEditingAmount] = useState(false);
  const [newAmount, setNewAmount] = useState(account.amount);
  const [editReason, setEditReason] = useState('');

  const baseAmount = sizePriceFromTable;
  const storedAmount = Number(account.amount || 0);
  const effectiveAmount = storedAmount > 0 ? storedAmount : Number(baseAmount || 0);
  const hasZeroPrice = effectiveAmount === 0;

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      pending: { label: 'معلق', className: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400' },
      paid: { label: 'مدفوع', className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400' },
      cancelled: { label: 'ملغي', className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400' }
    };
    const config = configs[status] || configs.pending;
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const openImagePreview = (url: string, title: string) => {
    setPreviewImageUrl(url);
    setPreviewImageTitle(title);
    setImagePreviewOpen(true);
  };

  const handleSaveAmount = () => {
    if (onUpdateAmount && newAmount !== account.amount) {
      onUpdateAmount(account.id, newAmount, editReason);
    }
    setEditingAmount(false);
    setEditReason('');
  };

  const handleCancelEdit = () => {
    setNewAmount(account.amount);
    setEditReason('');
    setEditingAmount(false);
  };

  // Use installation_image_url if available, otherwise fall back to image_url
  const displayImage = billboardDetails?.installation_image_url || billboardDetails?.image_url;
  const designA = billboardDetails?.design_face_a;
  const designB = billboardDetails?.design_face_b;

  return (
    <>
      <Card 
        className={`overflow-hidden ${
          isSelected 
            ? 'ring-2 ring-primary bg-primary/5' 
            : 'hover:shadow-md'
        } ${disabled ? 'opacity-60' : ''} ${hasZeroPrice ? 'border-red-300 dark:border-red-700' : ''}`}
      >
        {/* Billboard Image */}
        <div className="relative h-44 bg-muted overflow-hidden group">
          {displayImage ? (
            <>
              <img 
                src={displayImage} 
                alt={billboardDetails?.billboard_name}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => openImagePreview(displayImage, billboardDetails?.billboard_name || 'صورة اللوحة')}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-2 left-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                onClick={() => openImagePreview(displayImage, billboardDetails?.billboard_name || 'صورة اللوحة')}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
          
          {/* Status Badge Overlay */}
          <div className="absolute top-2 left-2">
            {getStatusBadge(account.status)}
          </div>
          
          {/* Checkbox Overlay */}
          {!disabled && account.status === 'pending' && (
            <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm rounded-md p-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelectChange}
                disabled={disabled}
              />
            </div>
          )}
        </div>

        <CardContent className="p-3">
          {/* Billboard Name */}
          <h4 className="font-semibold text-sm truncate mb-2">
            {billboardDetails?.billboard_name || `لوحة ${account.billboard_id}`}
          </h4>

          {/* Design Images */}
          {(designA || designB) && (
            <div className="flex gap-1.5 mb-2">
              {designA && (
                <div className="flex-1 relative group/design">
                  <div className="text-[9px] text-muted-foreground text-center mb-0.5">أمامي</div>
                  <img 
                    src={designA} 
                    alt="تصميم أمامي"
                    className="w-full h-14 object-contain rounded border border-border/50 cursor-pointer bg-muted/30"
                    onClick={() => openImagePreview(designA, 'التصميم الأمامي')}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
              {designB && (
                <div className="flex-1 relative group/design">
                  <div className="text-[9px] text-muted-foreground text-center mb-0.5">خلفي</div>
                  <img 
                    src={designB} 
                    alt="تصميم خلفي"
                    className="w-full h-14 object-contain rounded border border-border/50 cursor-pointer bg-muted/30"
                    onClick={() => openImagePreview(designB, 'التصميم الخلفي')}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-2">
            <div className="flex items-center gap-1">
              <Ruler className="h-3 w-3 text-primary" />
              <span>{billboardDetails?.size || '-'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary" />
              <span>{new Date(account.installation_date).toLocaleDateString('ar-LY')}</span>
            </div>
          </div>

          {billboardDetails?.customer_name && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <MapPin className="h-3 w-3 text-primary" />
              <span className="truncate">{billboardDetails.customer_name}</span>
            </div>
          )}

          <div className="pt-2 border-t">
            {editingAmount ? (
              <div className="space-y-2">
                <Input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(Number(e.target.value))}
                  className="h-8 text-sm"
                  placeholder="السعر الجديد"
                />
                <Textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="سبب التعديل..."
                  className="text-xs h-16 resize-none"
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 flex-1" onClick={handleCancelEdit}>
                    <X className="h-3 w-3" />
                  </Button>
                  <Button size="sm" className="h-6 flex-1" onClick={handleSaveAmount}>
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
               <div className="flex items-center justify-between">
                 <span className="text-xs text-muted-foreground">التركيب</span>
                 <div className="flex items-center gap-1">
                   <span className={`font-bold text-sm ${hasZeroPrice ? 'text-red-500' : 'text-primary'}`}>
                     {effectiveAmount ? effectiveAmount.toLocaleString('ar-LY') : '0'} د.ل
                   </span>
                   {account.status === 'pending' && onUpdateAmount && (
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-5 w-5"
                       onClick={() => {
                         setNewAmount(effectiveAmount || 0);
                         setEditingAmount(true);
                       }}
                     >
                       <Edit2 className="h-3 w-3" />
                     </Button>
                   )}
                 </div>
               </div>
             )}
             
             {/* Show base table price when it differs from stored amount */}
             {baseAmount !== undefined && baseAmount !== storedAmount && !editingAmount && (
               <div className="text-xs text-muted-foreground mt-1">
                 <span className="text-amber-600">سعر الجدول: {baseAmount.toLocaleString('ar-LY')} د.ل</span>
               </div>
             )}

            {/* Show notes if present */}
            {account.notes && !editingAmount && (
              <div className="text-xs text-muted-foreground mt-1 truncate" title={account.notes}>
 {account.notes}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewImageTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <img 
              src={previewImageUrl} 
              alt={previewImageTitle}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
