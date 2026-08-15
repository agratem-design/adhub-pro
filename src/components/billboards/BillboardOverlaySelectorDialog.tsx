import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Camera, Sparkles, Check, ArrowRight } from 'lucide-react';
import { Billboard } from '@/types';

interface BillboardOverlaySelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboards: Billboard[];
  onSelectBillboard: (billboard: Billboard) => void;
}

export const BillboardOverlaySelectorDialog: React.FC<BillboardOverlaySelectorDialogProps> = ({
  open,
  onOpenChange,
  billboards,
  onSelectBillboard,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBillboards = useMemo(() => {
    if (!searchTerm.trim()) return billboards.slice(0, 30); // show top 30 initially
    const term = searchTerm.trim().toLowerCase();
    return billboards.filter((b: any) => {
      const seqStr = String(b.ID || b.sequence_number || '');
      const nameStr = String(b.Name || b.Billboard_Name || b.billboard_name || '').toLowerCase();
      const locStr = String(b.Location || b.location_text || b.Nearest_Landmark || '').toLowerCase();
      const munStr = String(b.Municipality || b.municipality || '').toLowerCase();
      return seqStr.includes(term) || nameStr.includes(term) || locStr.includes(term) || munStr.includes(term);
    }).slice(0, 50);
  }, [billboards, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] border-border/30 rounded-3xl bg-background text-foreground shadow-2xl p-6">
        <DialogHeader>
          <DialogTitle className="font-extrabold text-xl flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Sparkles className="h-5 w-5" />
            </div>
            <span>اختيار اللوحة لمحرر التراكب والواقعية</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            ابحث برقم اللوحة أو اسم اللوحة أو الموقع واضغط عليها لفتح محرر التراكب فوراً
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative mt-3 mb-4">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث برقم اللوحة (مثلاً 102) أو الاسم أو الموقع..."
            className="pr-10 h-11 rounded-2xl bg-muted/30 border-border/50 font-bold text-sm"
            autoFocus
          />
        </div>

        {/* List of Billboards */}
        <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1 no-scrollbar">
          {filteredBillboards.map((b: any) => {
            const seq = b.ID || b.sequence_number;
            const name = b.Name || b.Billboard_Name || b.billboard_name || `لوحة #${seq}`;
            const location = b.Location || b.location_text || b.Nearest_Landmark || 'بدون عنوان';
            const size = b.Size || b.size || 'غير محدد';
            const imgUrl = b.Image_URL || b.image_url;
            const hasOverlay = !!b.overlay_config?.enabled;

            return (
              <button
                key={seq}
                onClick={() => {
                  onSelectBillboard(b);
                  onOpenChange(false);
                }}
                className="w-full p-3 bg-card hover:bg-amber-500/10 border border-border/40 hover:border-amber-500/50 rounded-2xl transition-all text-right flex items-center justify-between group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-12 rounded-xl bg-muted overflow-hidden flex-shrink-0 border border-border/30 relative">
                    {imgUrl ? (
                      <img src={imgUrl} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Camera className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        #{seq} - {name}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono border-border">
                        {size}
                      </Badge>
                      {hasOverlay && (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] gap-1">
                          <Check className="h-3 w-3" /> مفعّل التراكب
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                      {location}
                    </p>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-muted/50 group-hover:bg-amber-500 text-muted-foreground group-hover:text-slate-950 transition-colors">
                  <ArrowRight className="h-4 w-4 rotate-180" />
                </div>
              </button>
            );
          })}

          {filteredBillboards.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              لا توجد لوحة مطابقة للبحث "{searchTerm}"
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default BillboardOverlaySelectorDialog;
